import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking, Alert } from 'react-native';
import { supabase, ensureMobileSession } from '../supabase';
import { authService } from './authService';
import {
  DriverRegistrationFormData,
  DriverDocumentItem,
  DriverTripItem,
} from '../types';
import {
  isValidGoogleMapsUrl,
  buildGoogleMapsDirectionsUrl,
} from '../utils/googleMapsUtil';

const DRIVER_DRAFT_KEY = '@necl_driver_registration_draft';

function getBackendApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    if (Platform.OS === 'android') {
      if (envUrl.includes('localhost') || envUrl.includes('10.0.2.2')) {
        return envUrl.replace(/localhost|10\.0\.2\.2/, '192.168.0.114');
      }
    }
    return envUrl;
  }
  return Platform.OS === 'android' ? 'http://192.168.0.114:5000/api' : 'http://localhost:5000/api';
}

export const driverService = {
  // ─── 1. Multi-Step Draft Form Persistence ──────────────────────────────────
  async getDraftForm(): Promise<DriverRegistrationFormData | null> {
    try {
      const stored = await AsyncStorage.getItem(DRIVER_DRAFT_KEY);
      if (stored) return JSON.parse(stored);
      return null;
    } catch {
      return null;
    }
  },

  async saveDraftForm(data: Partial<DriverRegistrationFormData>): Promise<void> {
    try {
      const existing = (await this.getDraftForm()) || {
        fullName: '',
        fatherName: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        bloodGroup: 'B+',
        address: '',
        city: '',
        state: 'Assam',
        pincode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        licenceNumber: '',
        licenceExpiryDate: '',
        rtoState: 'AS - Assam',
        vehicleCategory: '32 FT Multi-Axle (18-25 MT)',
        badgeNumber: '',
        associationType: 'VENDOR_FLEET',
        primaryVendorId: undefined,
        transporterName: '',
        vehicleRegistrationNumber: '',
        vehicleType: '32 FT Multi-Axle',
        documents: [],
      };
      const updated = { ...existing, ...data };
      await AsyncStorage.setItem(DRIVER_DRAFT_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save driver draft:', e);
    }
  },

  async clearDraftForm(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DRIVER_DRAFT_KEY);
    } catch { }
  },

  // ─── 2. Transporters / Vendors List for Association ───────────────────────
  async getRegisteredTransporters(): Promise<{ id: string; name: string; city?: string }[]> {
    try {
      const { data, error } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, city')
        .order('vendor_name', { ascending: true })
        .limit(30);

      if (!error && data && data.length > 0) {
        return data.map((v) => ({
          id: v.id,
          name: v.vendor_name,
          city: v.city,
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  // ─── 3. Submit Complete Driver Registration ────────────────────────────────
  async submitDriverRegistration(
    formData: DriverRegistrationFormData,
    mobile: string
  ): Promise<{ success: boolean; driverId: string; applicationNumber: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
    const generatedAppNo = `DRV-${Date.now().toString().slice(-6)}`;
    let driverId = '';

    try {
      // 1. Try Backend API Registration for high reliability & admin privileges
      try {
        const apiRes = await fetch(`${getBackendApiUrl()}/driver/submit-registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            mobile: cleanPhone,
          }),
        });
        const resData = await apiRes.json();
        if (apiRes.ok && resData.success) {
          driverId = resData.driverId;
        } else if (resData.roleConflict) {
          throw new Error(resData.message || 'Mobile number already registered under another role');
        }
      } catch (apiErr: any) {
        if (apiErr.message?.includes('another role') || apiErr.message?.includes('already registered')) {
          throw apiErr;
        }
        console.warn('Backend driver registration notice, using direct operations:', apiErr.message);
      }

      if (!driverId) {
        await ensureMobileSession();

        // Direct database operation fallback
        const { data: existing } = await supabase
          .from('drivers')
          .select('id')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();

        driverId = existing?.id;

        const vendorId =
          formData.primaryVendorId && formData.primaryVendorId.includes('-')
            ? formData.primaryVendorId
            : null;

        const driverPayload = {
          primary_vendor_id: vendorId,
          full_name: formData.fullName.trim(),
          mobile: cleanPhone,
          licence_number: formData.licenceNumber.trim().toUpperCase(),
          licence_expiry_date: formData.licenceExpiryDate || null,
          status: 'PENDING',
        };

        if (driverId) {
          const { error: updErr } = await supabase.from('drivers').update(driverPayload).eq('id', driverId);
          if (updErr) throw updErr;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('drivers')
            .insert([driverPayload])
            .select('id')
            .single();

          if (insertErr || !inserted?.id) {
            console.error('Driver creation error:', insertErr);
            throw new Error(`Database persistence failed: ${insertErr?.message || 'Unable to register driver'}`);
          }
          driverId = inserted.id;
        }
      }

      // 2. Persist Documents in documents table
      if (formData.documents && formData.documents.length > 0) {
        for (const doc of formData.documents) {
          const rawType = doc.docType || 'LICENCE';
          const validDocType = rawType.toUpperCase().includes('AADHA')
            ? 'AADHAAR'
            : rawType.toUpperCase().includes('FITNESS')
              ? 'FITNESS'
              : rawType.toUpperCase().includes('PERMIT')
                ? 'PERMIT'
                : 'LICENCE';

          try {
            await supabase.from('documents').insert([
              {
                category: 'DRIVER',
                document_type: validDocType,
                reference_id: driverId,
                file_url: doc.fileUrl || '',
                file_name: `${rawType}: ${doc.fileName || 'driver_doc.pdf'}`,
                validity_expiry_date: doc.expiryDate || formData.licenceExpiryDate || null,
                verification_status: 'PENDING',
                uploaded_by: driverId,
              },
            ]);
          } catch (docErr) {
            console.warn('Document upload notice:', docErr);
          }
        }
      }

      // 3. Save Session locally
      const sessionObj = {
        userId: driverId!,
        mobile: cleanPhone,
        role: 'DRIVER' as const,
        fullName: formData.fullName.trim(),
        companyName: 'NECL Commercial Fleet',
        token: 'sess-driver-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('necl_mobile_session_v1', JSON.stringify(sessionObj));

      // 4. Synchronize local registry
      try {
        const registry = await authService.getLocalRegistry();
        const filtered = registry.filter((u) => u.mobile !== cleanPhone);
        filtered.unshift({
          mobile: cleanPhone,
          role: 'DRIVER',
          fullName: formData.fullName.trim(),
          status: 'PENDING',
          registeredAt: new Date().toISOString(),
        });
        await authService.saveLocalRegistry(filtered);
      } catch { }

      // 5. Clear draft
      await this.clearDraftForm();

      return {
        success: true,
        driverId: driverId!,
        applicationNumber: generatedAppNo,
      };
    } catch (err: any) {
      console.warn('Driver submission error:', err);
      return {
        success: false,
        driverId: '',
        applicationNumber: generatedAppNo,
      };
    }
  },

  // ─── 4. Query Driver Profile & Verification Status ────────────────────────
  async getDriverProfile(driverId?: string, mobile?: string): Promise<any | null> {
    try {
      let query = supabase.from('drivers').select('*');

      if (driverId && driverId.includes('-')) {
        query = query.eq('id', driverId);
      } else if (mobile) {
        const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
        query = query.or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        // Query associated vendor
        let vendorName: string | undefined;
        if (data.primary_vendor_id) {
          const { data: vData } = await supabase
            .from('vendor_companies')
            .select('vendor_name')
            .eq('id', data.primary_vendor_id)
            .maybeSingle();
          vendorName = vData?.vendor_name;
        }

        // Query documents
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('category', 'DRIVER')
          .eq('reference_id', data.id);

        return {
          id: data.id,
          fullName: data.full_name || data.name,
          mobile: data.mobile || data.phone,
          email: data.email,
          licenceNumber: data.licence_number || data.license_number,
          licenceExpiryDate: data.licence_expiry_date,
          status: data.status || data.verification_status || 'PENDING',
          rejectionReason: data.rejection_reason,
          primaryVendorId: data.primary_vendor_id,
          vendorName: vendorName || 'Direct / Independent Fleet',
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          emergencyContactName: data.emergency_contact_name,
          emergencyContactPhone: data.emergency_contact_phone,
          createdAt: data.created_at,
          documents: (docs || []).map((d) => ({
            id: d.id,
            docType: d.document_type,
            title: d.document_type.replace(/_/g, ' '),
            fileUrl: d.file_url,
            status: d.verification_status,
            rejectionReason: d.rejection_reason,
            expiryDate: d.validity_expiry_date,
            uploadedAt: d.created_at,
          })),
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  // ─── 5. Re-Upload / Document Correction ───────────────────────────────────
  async reuploadDriverDocument(
    driverId: string,
    docId: string,
    docType: string,
    fileUrl: string,
    expiryDate?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (docId && docId.includes('-')) {
        await supabase
          .from('documents')
          .update({
            file_url: fileUrl,
            verification_status: 'PENDING',
            rejection_reason: null,
            validity_expiry_date: expiryDate || null,
          })
          .eq('id', docId);
      } else {
        await supabase.from('documents').insert([
          {
            category: 'DRIVER',
            document_type: docType,
            reference_id: driverId,
            file_url: fileUrl,
            verification_status: 'PENDING',
            uploaded_by: driverId,
            validity_expiry_date: expiryDate || null,
          },
        ]);
      }

      // Re-trigger driver status to PENDING for admin review
      await supabase
        .from('drivers')
        .update({
          status: 'PENDING',
          verification_status: 'PENDING',
          rejection_reason: null,
        })
        .eq('id', driverId);

      return {
        success: true,
        message: 'Document submitted for review. NECL compliance desk will re-verify within 2-4 hours.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Correction upload failed.' };
    }
  },

  // ─── 6. Assigned Trips for Authenticated Driver ───────────────────────────
  async getDriverTrips(driverId: string): Promise<DriverTripItem[]> {
    try {
      if (!driverId || !driverId.includes('-')) {
        return [];
      }

      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          bookings (
            id,
            booking_status,
            payment_status,
            requirements (
              id,
              pickup_address,
              pickup_pincode,
              destination_address,
              destination_pincode,
              material_type,
              required_capacity_mt,
              loading_datetime,
              client_companies (
                company_name
              )
            )
          ),
          vehicles (
            id,
            registration_number,
            vehicle_type
          ),
          drivers (
            id,
            full_name,
            mobile,
            licence_number
          ),
          vendor_companies:vendor_id (
            id,
            vendor_name,
            phone
          )
        `)
        .eq('driver_id', driverId)
        .order('started_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((t: any) => this.mapTripItem(t));
      }

      return [];
    } catch {
      return [];
    }
  },

  mapTripItem(t: any): DriverTripItem {
    const pickup = t.bookings?.requirements?.pickup_address || '';
    const dest = t.bookings?.requirements?.destination_address || '';
    const originCity = pickup ? pickup.split(',')[0].trim() : 'Pickup';
    const destCity = dest ? dest.split(',')[0].trim() : 'Destination';

    return {
      id: t.id,
      bookingId: t.booking_id,
      tripStatus: t.trip_status || 'ASSIGNED',
      origin: originCity,
      destination: destCity,
      pickupAddress: pickup,
      pickupPincode: t.bookings?.requirements?.pickup_pincode || '',
      pickupContactName: t.bookings?.requirements?.loading_contact_person || 'Loading Supervisor',
      pickupContactPhone: t.bookings?.requirements?.loading_contact_phone || '',
      destinationAddress: dest,
      destinationPincode: t.bookings?.requirements?.destination_pincode || '',
      dropContactName: t.bookings?.requirements?.unloading_contact_person || 'Consignee Receiver',
      dropContactPhone: t.bookings?.requirements?.unloading_contact_phone || '',
      material: t.bookings?.requirements?.material_type || 'General Cargo',
      capacityMt: Number(t.bookings?.requirements?.required_capacity_mt) || 0,
      loadingDatetime: t.bookings?.requirements?.loading_datetime,
      clientName: t.bookings?.requirements?.client_companies?.company_name || 'Shipper',
      vendorName: t.vendor_companies?.vendor_name || 'Transporter',
      vehicleNumber: t.vehicles?.registration_number || 'N/A',
      vehicleType: t.vehicles?.vehicle_type || 'Vehicle',
      rate: Number(t.vendor_rate) || 0,
      startedAt: t.started_at,
      completedAt: t.completed_at,
    };
  },

  // ─── 7. Single Trip Details ───────────────────────────────────────────────
  async getTripDetails(tripId: string): Promise<DriverTripItem | null> {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          bookings (
            id,
            booking_status,
            payment_status,
            requirements (
              id,
              pickup_address,
              pickup_pincode,
              destination_address,
              destination_pincode,
              material_type,
              required_capacity_mt,
              loading_datetime,
              client_companies (
                company_name
              )
            )
          ),
          vehicles (
            id,
            registration_number,
            vehicle_type
          ),
          drivers (
            id,
            full_name,
            mobile,
            licence_number
          ),
          vendor_companies:vendor_id (
            id,
            vendor_name,
            phone
          )
        `)
        .eq('id', tripId)
        .maybeSingle();

      if (!error && data) {
        // Query documents for this trip
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', tripId);

        const mapped = this.mapTripItem(data);
        mapped.documents = (docs || []).map((d) => ({
          id: d.id,
          type: d.document_type,
          fileUrl: d.file_url,
          status: d.verification_status,
          consigneeStampVerified: d.consignee_stamp_verified,
          uploadedAt: d.created_at,
        }));
        return mapped;
      }
      return null;
    } catch {
      return null;
    }
  },

  // ─── 8. Pickup Confirmation ───────────────────────────────────────────────
  async confirmPickup(
    tripId: string,
    bookingId: string,
    notes?: string,
    weighmentGross?: number,
    weighmentTare?: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Update trip status to IN_TRANSIT
      await supabase
        .from('trips')
        .update({
          trip_status: 'IN_TRANSIT',
          started_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      // 2. Synchronize booking status to IN_PROGRESS
      await supabase
        .from('bookings')
        .update({
          booking_status: 'IN_PROGRESS',
        })
        .eq('id', bookingId);

      // 3. Record weighment if provided
      if (weighmentGross && weighmentTare) {
        try {
          await supabase.from('weighments').insert([
            {
              trip_id: tripId,
              stage: 'LOADING',
              gross_weight_mt: weighmentGross,
              tare_weight_mt: weighmentTare,
              net_weight_mt: Math.max(0, weighmentGross - weighmentTare),
              status: 'APPROVED',
            },
          ]);
        } catch { }
      }

      return {
        success: true,
        message: 'Pickup confirmed! Consignment loaded and dispatched. GPS tracking activated.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Pickup confirmation failed.' };
    }
  },

  // ─── 9. Trip Progress Milestone Update ────────────────────────────────────
  async updateTripMilestone(
    tripId: string,
    bookingId: string,
    nextStatus: 'AT_LOADING' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'DELIVERED' | 'COMPLETED'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updatePayload: any = { trip_status: nextStatus };
      if (nextStatus === 'COMPLETED') {
        updatePayload.completed_at = new Date().toISOString();
      }

      await supabase.from('trips').update(updatePayload).eq('id', tripId);

      if (nextStatus === 'IN_TRANSIT') {
        await supabase
          .from('bookings')
          .update({ booking_status: 'IN_PROGRESS' })
          .eq('id', bookingId);
      } else if (nextStatus === 'COMPLETED') {
        await supabase
          .from('bookings')
          .update({ booking_status: 'COMPLETED', payment_status: 'PAID' })
          .eq('id', bookingId);
      }

      return { success: true, message: `Trip status updated to ${nextStatus}.` };
    } catch (e: any) {
      return { success: false, message: e.message || 'Milestone update failed.' };
    }
  },

  // ─── 10. Delivery Confirmation ────────────────────────────────────────────
  async confirmDelivery(
    tripId: string,
    bookingId: string,
    receiverName: string,
    receiverPhone: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await supabase
        .from('trips')
        .update({
          trip_status: 'DELIVERED',
        })
        .eq('id', tripId);

      return {
        success: true,
        message: `Delivery confirmed with consignee ${receiverName}. Please upload the signed physical POD to close the trip.`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Delivery confirmation failed.' };
    }
  },

  // ─── 11. Proof of Delivery (POD) Upload & Trip Completion ─────────────────
  async uploadPodAndCompleteTrip(
    tripId: string,
    bookingId: string,
    podFileUrl: string,
    receiverName: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Insert POD document into documents table
      await supabase.from('documents').insert([
        {
          category: 'TRIP',
          document_type: 'POD_LR',
          reference_id: tripId,
          file_url: podFileUrl,
          verification_status: 'PENDING',
          consignee_stamp_verified: true,
          uploaded_by: 'DRIVER',
        },
      ]);

      // 2. Mark trip completed
      await supabase
        .from('trips')
        .update({
          trip_status: 'COMPLETED',
          completed_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      // 3. Mark booking completed
      await supabase
        .from('bookings')
        .update({
          booking_status: 'COMPLETED',
          payment_status: 'PAID',
        })
        .eq('id', bookingId);

      return {
        success: true,
        message: 'POD uploaded successfully! Trip closed. Freight settlement submitted for approval.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'POD upload failed.' };
    }
  },

  // ─── 12. Trip History ─────────────────────────────────────────────────────
  async getDriverTripHistory(driverId: string): Promise<DriverTripItem[]> {
    try {
      let query = supabase
        .from('trips')
        .select(`
          *,
          bookings (
            id,
            booking_status,
            payment_status,
            requirements (
              id,
              pickup_address,
              destination_address,
              material_type,
              required_capacity_mt,
              loading_datetime,
              client_companies (
                company_name
              )
            )
          ),
          vehicles (
            id,
            registration_number,
            vehicle_type
          ),
          vendor_companies:vendor_id (
            id,
            vendor_name
          )
        `)
        .eq('trip_status', 'COMPLETED')
        .order('completed_at', { ascending: false });

      if (driverId && driverId.includes('-')) {
        query = query.eq('driver_id', driverId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return data.map((t: any) => this.mapTripItem(t));
      }

      return [];
    } catch {
      return [];
    }
  },

  // ─── 13. Map Navigation Native Integration (Zero Paid API Cost) ─────────────
  openNavigation(
    address: string,
    city?: string,
    options?: {
      latitude?: number;
      longitude?: number;
      googleMapsUrl?: string;
    }
  ) {
    if (!address && !options?.latitude && !options?.googleMapsUrl) {
      Alert.alert('Address Missing', 'No destination address specified for navigation.');
      return;
    }

    let url: string;
    if (options?.googleMapsUrl && isValidGoogleMapsUrl(options.googleMapsUrl)) {
      url = options.googleMapsUrl;
    } else {
      url = buildGoogleMapsDirectionsUrl({
        latitude: options?.latitude,
        longitude: options?.longitude,
        address: `${address || ''}${city ? ', ' + city : ''}`.trim(),
      });
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(url);
        }
      })
      .catch(() => {
        Linking.openURL(url);
      });
  },

  // ─── 14. Dial Phone Contact ───────────────────────────────────────────────
  callPhone(phone: string) {
    if (!phone) return;
    const clean = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Notice', `Unable to make phone call to ${clean}`);
    });
  },
};
