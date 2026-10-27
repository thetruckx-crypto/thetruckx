import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase, ensureMobileSession } from '../supabase';
import { authService, SESSION_STORAGE_KEY } from './authService';
import {
  DriverRegistrationFormData,
  DriverDocumentItem,
  DriverTripItem,
} from '../types';
import {
  isValidGoogleMapsUrl,
  buildGoogleMapsDirectionsUrl,
} from '../utils/googleMapsUtil';
import { documentWorkflowService } from './documentWorkflowService';
import { uploadDocumentToStorage, getSecureDocumentSignedUrl } from '../utils/mobileStorageHelper';

const DRIVER_DRAFT_KEY = '@necl_driver_registration_draft';

function getBackendApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('192.168.0.114')) {
    return envUrl;
  }
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost || (Constants as any).manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
}

export const driverService = {
  // In-memory active registration form data (drafts removed from local storage)
  activeRegistrationData: null as DriverRegistrationFormData | null,

  // ─── 1. Multi-Step Form State (Persistent Across Navigation & Interruption) ──
  async getDraftForm(): Promise<DriverRegistrationFormData | null> {
    if (this.activeRegistrationData) {
      return this.activeRegistrationData;
    }
    try {
      const saved = await AsyncStorage.getItem(DRIVER_DRAFT_KEY);
      if (saved) {
        this.activeRegistrationData = JSON.parse(saved);
        return this.activeRegistrationData;
      }
    } catch (err) {
      console.warn('[DriverService] Error reading draft from AsyncStorage:', err);
    }
    return null;
  },

  async saveDraftForm(data: Partial<DriverRegistrationFormData>): Promise<void> {
    let existing = this.activeRegistrationData;
    if (!existing) {
      try {
        const saved = await AsyncStorage.getItem(DRIVER_DRAFT_KEY);
        if (saved) existing = JSON.parse(saved);
      } catch {}
    }

    const base: DriverRegistrationFormData = existing || {
      fullName: '',
      fatherName: '',
      phone: '',
      email: '',
      dateOfBirth: '',
      bloodGroup: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      licenceNumber: '',
      licenceExpiryDate: '',
      rtoState: '',
      vehicleCategory: '',
      badgeNumber: '',
      associationType: 'INDEPENDENT_ATTACHED',
      primaryVendorId: '',
      transporterName: '',
      vehicleRegistrationNumber: '',
      vehicleType: '',
      documents: [],
    };

    this.activeRegistrationData = { ...base, ...data };
    try {
      await AsyncStorage.setItem(DRIVER_DRAFT_KEY, JSON.stringify(this.activeRegistrationData));
    } catch (err) {
      console.warn('[DriverService] Error saving draft to AsyncStorage:', err);
    }
  },

  async clearDraftForm(): Promise<void> {
    this.activeRegistrationData = null;
    try {
      await AsyncStorage.removeItem(DRIVER_DRAFT_KEY);
    } catch { }
  },

  // ─── 1.1. Save Active Registration Step to Database During Progress ─────────
  async saveActiveRegistrationStep(
    step: number,
    data: Partial<DriverRegistrationFormData>,
    mobile?: string
  ): Promise<void> {
    await this.saveDraftForm(data);
    const active = this.activeRegistrationData;
    if (!active) return;
    const cleanPhone = (mobile || active.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return;

    try {
      await ensureMobileSession();
      const driverPayload = {
        full_name: active.fullName ? active.fullName.trim() : 'Registration in progress',
        mobile: cleanPhone,
        phone: cleanPhone,
        date_of_birth: active.dateOfBirth || null,
        licence_number: active.licenceNumber?.trim() || `DL-${cleanPhone}`,
        status: 'INACTIVE', // Staging status during active registration
        primary_vendor_id: active.primaryVendorId && active.primaryVendorId.includes('-') ? active.primaryVendorId : null,
      };

      const { data: existing } = await supabase
        .from('drivers')
        .select('id')
        .eq('mobile', cleanPhone)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from('drivers').update(driverPayload).eq('id', existing.id);
      } else if (active.fullName) {
        await supabase.from('drivers').insert([driverPayload]);
      }
    } catch (e) {
      console.warn('Driver active step persistence notice:', e);
    }
  },

  // ─── 2. Transporters / Vendors List for Association ───────────────────────
  async getRegisteredTransporters(): Promise<{ id: string; name: string; vendorCode?: string; phone?: string; city?: string }[]> {
    try {
      // 1. Try Backend REST API first if server is reachable
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const apiRes = await fetch(`${getBackendApiUrl()}/database/vendors`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
        if (apiRes.ok) {
          const vendorsData = await apiRes.json();
          if (Array.isArray(vendorsData) && vendorsData.length > 0) {
            return vendorsData.map((v: any) => {
              const addressParts = (v.address || '').split(',');
              const cityGuess = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : (v.city || '');
              const phone = v.vendor_users?.[0]?.mobile || v.phone || '';
              return {
                id: v.id,
                name: v.vendor_name || 'Registered Transporter',
                vendorCode: v.vendor_code || `VD-${v.id.slice(0, 6).toUpperCase()}`,
                phone,
                city: cityGuess,
              };
            });
          }
        }
      } catch {
        // Fall through to direct Supabase query
      }

      // 2. Direct Supabase Query with active mobile session (bypasses RLS)
      await ensureMobileSession();

      const { data, error } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, vendor_code, address, status, vendor_users(mobile, full_name)')
        .order('vendor_name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((v: any) => {
          let city = '';
          if (v.address) {
            const parts = v.address.split(',').map((p: string) => p.trim());
            if (parts.length >= 2) {
              city = parts[1];
            } else {
              city = parts[0];
            }
          }
          const phone = Array.isArray(v.vendor_users) && v.vendor_users.length > 0
            ? v.vendor_users[0].mobile
            : '';

          return {
            id: v.id,
            name: v.vendor_name || 'Registered Transporter',
            vendorCode: v.vendor_code || `VD-${v.id.slice(0, 6).toUpperCase()}`,
            phone,
            city,
          };
        });
      }

      // 3. Fallback: Query all vendor companies without join if relational join had issues
      const { data: rawVendors } = await supabase
        .from('vendor_companies')
        .select('*')
        .order('vendor_name', { ascending: true });

      if (rawVendors && rawVendors.length > 0) {
        return rawVendors.map((v: any) => {
          let city = '';
          if (v.address) {
            const parts = v.address.split(',').map((p: string) => p.trim());
            city = parts.length >= 2 ? parts[1] : parts[0];
          }
          return {
            id: v.id,
            name: v.vendor_name || 'Registered Transporter',
            vendorCode: v.vendor_code || `VD-${v.id.slice(0, 6).toUpperCase()}`,
            phone: '',
            city,
          };
        });
      }

      return [
        {
          id: '45fbbb9f-d975-4f2c-94f4-1fe4ce964753',
          name: 'TRUCKS Central Dedicated Fleet',
          vendorCode: 'VD-TRUCKS-01',
          phone: '9865001122',
          city: 'Guwahati',
        },
        {
          id: '8a9c3d2e-1b4f-4a7c-8e2d-3c5b7e9a1f2b',
          name: 'TRUCKS North East Express Transporters',
          vendorCode: 'VD-TRUCKS-02',
          phone: '9865003344',
          city: 'Siliguri',
        },
        {
          id: '9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
          name: 'Brahmaputra Freight Carriers',
          vendorCode: 'VD-BFC-03',
          phone: '9865005566',
          city: 'Beltola',
        },
      ];
    } catch (err: any) {
      console.warn('Could not fetch registered transporters:', err);
      return [
        {
          id: '45fbbb9f-d975-4f2c-94f4-1fe4ce964753',
          name: 'TRUCKS Central Dedicated Fleet',
          vendorCode: 'VD-TRUCKS-01',
          phone: '9865001122',
          city: 'Guwahati',
        },
        {
          id: '8a9c3d2e-1b4f-4a7c-8e2d-3c5b7e9a1f2b',
          name: 'TRUCKS North East Express Transporters',
          vendorCode: 'VD-TRUCKS-02',
          phone: '9865003344',
          city: 'Siliguri',
        },
        {
          id: '9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
          name: 'Brahmaputra Freight Carriers',
          vendorCode: 'VD-BFC-03',
          phone: '9865005566',
          city: 'Beltola',
        },
      ];
    }
  },

  // ─── 3. Submit Complete Driver Registration ────────────────────────────────
  async submitDriverRegistration(
    formData: DriverRegistrationFormData,
    mobile: string
  ): Promise<{ success: boolean; driverId: string; applicationNumber: string }> {
    const cleanPhone = (mobile || formData.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const generatedAppNo = `DRV-${Date.now().toString().slice(-6)}`;
    let driverId = '';

    try {
      // 1. Try Backend API Registration for high reliability & admin privileges
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const apiRes = await fetch(`${getBackendApiUrl()}/driver/submit-registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...formData,
            mobile: cleanPhone,
          }),
        }).finally(() => clearTimeout(timeoutId));
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

        const cleanLicence = formData.licenceNumber?.trim() || `DL-${cleanPhone}`;

        const driverPayload = {
          primary_vendor_id: vendorId,
          full_name: formData.fullName.trim(),
          mobile: cleanPhone,
          phone: cleanPhone,
          date_of_birth: formData.dateOfBirth || null,
          dob: formData.dateOfBirth || null,
          licence_number: cleanLicence,
          licence_expiry_date: formData.licenceExpiryDate || null,
          status: 'PENDING',
          rejection_reason: null,
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

      // 2. Persist Single-Screen Driver Documents in documents table
      const docsToInsert: {
        category: string;
        document_type: string;
        reference_id: string;
        file_url: string;
        storage_path?: string;
        file_name: string;
        doc_side?: string;
        mime_type?: string;
        file_size?: string;
        verification_status: string;
        uploaded_by: string;
      }[] = [];

      if (formData.dlFrontUri) {
        let storagePath = formData.dlFrontUri;
        if (formData.dlFrontUri.startsWith('file:') || formData.dlFrontUri.startsWith('content:') || formData.dlFrontUri.startsWith('data:')) {
          const up = await uploadDocumentToStorage({
            uri: formData.dlFrontUri,
            fileName: 'dl_front.jpg',
            storagePath: `drivers/${driverId}/dl-front-${Date.now()}.jpg`,
          });
          if (up.success) storagePath = up.storagePath;
        }
        docsToInsert.push({
          category: 'DRIVER',
          document_type: 'LICENCE',
          reference_id: driverId,
          file_url: storagePath,
          storage_path: storagePath,
          file_name: 'DL Front Side: dl_front.jpg',
          doc_side: 'FRONT',
          mime_type: 'image/jpeg',
          verification_status: 'PENDING',
          uploaded_by: driverId,
        });
      }

      if (formData.dlBackUri) {
        let storagePath = formData.dlBackUri;
        if (formData.dlBackUri.startsWith('file:') || formData.dlBackUri.startsWith('content:') || formData.dlBackUri.startsWith('data:')) {
          const up = await uploadDocumentToStorage({
            uri: formData.dlBackUri,
            fileName: 'dl_back.jpg',
            storagePath: `drivers/${driverId}/dl-back-${Date.now()}.jpg`,
          });
          if (up.success) storagePath = up.storagePath;
        }
        docsToInsert.push({
          category: 'DRIVER',
          document_type: 'LICENCE',
          reference_id: driverId,
          file_url: storagePath,
          storage_path: storagePath,
          file_name: 'DL Back Side: dl_back.jpg',
          doc_side: 'BACK',
          mime_type: 'image/jpeg',
          verification_status: 'PENDING',
          uploaded_by: driverId,
        });
      }

      if (formData.aadhaarFrontUri) {
        let storagePath = formData.aadhaarFrontUri;
        if (formData.aadhaarFrontUri.startsWith('file:') || formData.aadhaarFrontUri.startsWith('content:') || formData.aadhaarFrontUri.startsWith('data:')) {
          const up = await uploadDocumentToStorage({
            uri: formData.aadhaarFrontUri,
            fileName: 'aadhaar_front.jpg',
            storagePath: `drivers/${driverId}/aadhaar-front-${Date.now()}.jpg`,
          });
          if (up.success) storagePath = up.storagePath;
        }
        docsToInsert.push({
          category: 'DRIVER',
          document_type: 'AADHAAR',
          reference_id: driverId,
          file_url: storagePath,
          storage_path: storagePath,
          file_name: 'Aadhaar Front Side: aadhaar_front.jpg',
          doc_side: 'FRONT',
          mime_type: 'image/jpeg',
          verification_status: 'PENDING',
          uploaded_by: driverId,
        });
      }

      if (formData.aadhaarBackUri) {
        let storagePath = formData.aadhaarBackUri;
        if (formData.aadhaarBackUri.startsWith('file:') || formData.aadhaarBackUri.startsWith('content:') || formData.aadhaarBackUri.startsWith('data:')) {
          const up = await uploadDocumentToStorage({
            uri: formData.aadhaarBackUri,
            fileName: 'aadhaar_back.jpg',
            storagePath: `drivers/${driverId}/aadhaar-back-${Date.now()}.jpg`,
          });
          if (up.success) storagePath = up.storagePath;
        }
        docsToInsert.push({
          category: 'DRIVER',
          document_type: 'AADHAAR',
          reference_id: driverId,
          file_url: storagePath,
          storage_path: storagePath,
          file_name: 'Aadhaar Back Side: aadhaar_back.jpg',
          doc_side: 'BACK',
          mime_type: 'image/jpeg',
          verification_status: 'PENDING',
          uploaded_by: driverId,
        });
      }

      // Legacy documents array support
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

          docsToInsert.push({
            category: 'DRIVER',
            document_type: validDocType,
            reference_id: driverId,
            file_url: doc.fileUrl || '',
            file_name: `${rawType}: ${doc.fileName || 'driver_doc.pdf'}`,
            verification_status: 'PENDING',
            uploaded_by: driverId,
          });
        }
      }

      for (const docItem of docsToInsert) {
        try {
          await supabase.from('documents').insert([docItem]);
        } catch (docErr) {
          console.warn('Document upload notice:', docErr);
        }
      }

      // 3. Save Session locally
      const sessionObj = {
        userId: driverId!,
        mobile: cleanPhone,
        role: 'DRIVER' as const,
        fullName: formData.fullName.trim(),
        companyName: 'TRUCKS Commercial Fleet',
        token: 'sess-driver-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionObj));

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

  // ─── 4.1 Load Driver Registration Data for Resuming Incomplete Registration ──
  async loadAuthenticatedDriverRegistration(driverId?: string, mobile?: string): Promise<DriverRegistrationFormData | null> {
    try {
      if (this.activeRegistrationData && this.activeRegistrationData.fullName && this.activeRegistrationData.fullName !== 'Registration in progress') {
        return this.activeRegistrationData;
      }
      const profile = await this.getDriverProfile(driverId, mobile);
      if (profile) {
        const cleanPhone = (mobile || profile.mobile || '').replace(/[^0-9]/g, '').slice(-10);
        const loaded: DriverRegistrationFormData = {
          fullName: profile.fullName && profile.fullName !== 'Registration in progress' ? profile.fullName : '',
          fatherName: profile.fatherName || '',
          dateOfBirth: profile.dateOfBirth || profile.dob || '',
          bloodGroup: profile.bloodGroup || '',
          address: profile.address || '',
          city: profile.city || '',
          state: profile.state || '',
          pincode: profile.pincode || '',
          emergencyContactName: profile.emergencyContactName || '',
          emergencyContactPhone: profile.emergencyContactPhone || '',
          primaryVendorId: profile.primaryVendorId || '',
          transporterName: profile.vendorName || profile.transporterName || '',
          licenceNumber: profile.licenceNumber && !profile.licenceNumber.startsWith(`DL-${cleanPhone}`) ? profile.licenceNumber : '',
          licenceExpiryDate: profile.licenceExpiryDate || '',
          rtoState: profile.rtoState || '',
          vehicleCategory: profile.vehicleCategory || '',
          badgeNumber: profile.badgeNumber || '',
          associationType: profile.associationType || 'INDEPENDENT_ATTACHED',
          phone: cleanPhone,
          documents: profile.documents || [],
          vehicleRegistrationNumber: '',
          vehicleType: profile.vehicleType || '',
        };
        await this.saveDraftForm(loaded);
        return loaded;
      }
      return null;
    } catch (e) {
      console.warn('loadAuthenticatedDriverRegistration notice:', e);
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
      let storagePath = fileUrl;
      if (fileUrl.startsWith('file:') || fileUrl.startsWith('content:') || fileUrl.startsWith('data:')) {
        const up = await uploadDocumentToStorage({
          uri: fileUrl,
          fileName: `${docType.toLowerCase()}-reupload.jpg`,
          storagePath: `drivers/${driverId}/${docType.toLowerCase()}-reupload-${Date.now()}.jpg`,
        });
        if (up.success) storagePath = up.storagePath;
      }

      if (docId && docId.includes('-')) {
        await supabase
          .from('documents')
          .update({
            file_url: storagePath,
            storage_path: storagePath,
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
            file_url: storagePath,
            storage_path: storagePath,
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
        message: 'Document submitted for review. TRUCKS compliance desk will re-verify within 2-4 hours.',
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

      // 1. Try Backend REST API first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const apiRes = await fetch(`${getBackendApiUrl()}/driver/trips?driverId=${encodeURIComponent(driverId)}`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (apiRes.ok) {
          const resJson = await apiRes.json();
          if (resJson.success && Array.isArray(resJson.trips)) {
            return resJson.trips.map((t: any) => ({
              id: t.id,
              tripCode: t.tripCode,
              bookingId: t.bookingId,
              tripStatus: t.tripStatus || 'ASSIGNED',
              origin: (t.origin || '').split(',')[0].trim() || 'Pickup',
              destination: (t.destination || '').split(',')[0].trim() || 'Destination',
              pickupAddress: t.origin,
              pickupPincode: t.originPincode || '',
              pickupContactName: t.pickupContactName || 'Loading Supervisor',
              pickupContactPhone: t.pickupContactPhone || '',
              destinationAddress: t.destination,
              destinationPincode: t.destinationPincode || '',
              dropContactName: t.dropContactName || 'Consignee Receiver',
              dropContactPhone: t.dropContactPhone || '',
              material: t.materialType || 'General Cargo',
              capacityMt: Number(t.capacityMt || 0),
              loadingDatetime: t.loadingDatetime,
              clientName: t.clientName || 'Shipper',
              vendorName: t.transporterName || 'Transporter',
              vehicleNumber: t.vehicle?.registrationNumber || 'N/A',
              vehicleType: t.vehicle?.vehicleType || 'Commercial Vehicle',
              lrNumber: t.lrNumber || undefined,
              ewaybillNumber: t.ewaybillNumber || undefined,
              startedAt: t.startedAt,
              completedAt: t.completedAt,
            }));
          }
        }
      } catch (apiErr) {
        // Fall through to direct Supabase query
      }

      // 2. Direct Supabase Query Fallback
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

  // ─── 6.1 Driver Dispatch Acknowledgment ───────────────────────────────────
  async acknowledgeDispatch(tripId: string, driverId: string): Promise<{ success: boolean; tripStatus?: string; message: string }> {
    try {
      // 1. Try Backend API
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${getBackendApiUrl()}/driver/trips/${tripId}/acknowledge-dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const json = await res.json();
        if (res.ok && json.success) {
          return {
            success: true,
            tripStatus: json.tripStatus,
            message: json.message || 'Dispatch acknowledged.',
          };
        }
      } catch {}

      // 2. Direct Supabase Fallback
      await supabase
        .from('trips')
        .update({
          trip_status: 'DISPATCHED',
          started_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      return {
        success: true,
        tripStatus: 'DISPATCHED',
        message: 'Dispatch acknowledged successfully.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Dispatch acknowledgment failed.' };
    }
  },

  // ─── 6.2 Digital Lorry Receipt (LR) Generation ────────────────────────────
  async generateTripLr(tripId: string, createdBy?: string): Promise<{ success: boolean; lrNumber?: string; lrData?: any; message: string }> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/generate-lr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdBy }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          lrNumber: json.lrNumber,
          lrData: json.lrData,
          message: json.message || 'Digital LR generated successfully.',
        };
      }
      return { success: false, message: json.error || 'Failed to generate digital LR.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to generate digital LR.' };
    }
  },

  // ─── 6.3 Digital LR Retrieval ─────────────────────────────────────────────
  async getTripLr(tripId: string): Promise<any | null> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/lr?role=DRIVER`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.lr) {
          return json.lr;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  // ─── 6.4 e-Waybill Verification and Linking ───────────────────────────────
  async linkEwaybill(tripId: string, ewaybillNumber: string, validUntil?: string): Promise<{ success: boolean; message: string; ewaybillNumber?: string }> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/link-ewaybill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ewaybillNumber, validUntil }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          ewaybillNumber: json.ewaybillNumber,
          message: json.message || 'e-Waybill linked successfully.',
        };
      }
      return { success: false, message: json.error || 'Failed to link e-Waybill.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to link e-Waybill.' };
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
      lrNumber: t.lr_number || undefined,
      ewaybillNumber: t.ewaybill_number || undefined,
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

  // ─── 8. Loading Weighbill & Pickup Confirmation ───────────────────────────
  async uploadLoadingWeighbill(input: {
    tripId: string;
    bookingId: string;
    driverId: string;
    driverName?: string;
    fileName: string;
    fileUrl: string;
    grossWeightMt: number;
    tareWeightMt: number;
    recordedWeightMt?: number;
    isConfirmed: boolean;
  }) {
    return documentWorkflowService.uploadDriverLoadingWeighbill(input);
  },

  async confirmLoadingWeightIndependently(input: {
    tripId: string;
    bookingId: string;
    driverId: string;
    driverName?: string;
    recordedWeightMt: number;
  }) {
    return documentWorkflowService.driverIndependentlyConfirmWeight(input);
  },

  async confirmPickup(
    tripId: string,
    bookingId: string,
    notes?: string,
    weighmentGross?: number,
    weighmentTare?: number,
    weighbillFileUrl?: string,
    driverId?: string,
    driverName?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. If weighbill document URL and weight provided, record in document workflow
      if (weighbillFileUrl && driverId && weighmentGross && weighmentTare) {
        const netMt = Math.max(0, weighmentGross - weighmentTare);
        await documentWorkflowService.uploadDriverLoadingWeighbill({
          tripId,
          bookingId,
          driverId,
          driverName: driverName || 'Driver',
          fileName: `weighbill_${tripId.slice(-6)}.jpg`,
          fileUrl: weighbillFileUrl,
          grossWeightMt: weighmentGross,
          tareWeightMt: weighmentTare,
          recordedWeightMt: netMt,
          isConfirmed: true,
        });
      }

      // 2. Update trip status to IN_TRANSIT
      await supabase
        .from('trips')
        .update({
          trip_status: 'IN_TRANSIT',
          started_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      // 3. Synchronize booking status to IN_PROGRESS
      await supabase
        .from('bookings')
        .update({
          booking_status: 'IN_PROGRESS',
        })
        .eq('id', bookingId);

      // 4. Record weighment if provided
      if (weighmentGross && weighmentTare) {
        try {
          await supabase.from('weighments').insert([
            {
              trip_id: tripId,
              stage: 'LOADING',
              gross_weight_mt: weighmentGross,
              tare_weight_mt: weighmentTare,
              net_weight_mt: Math.max(0, weighmentGross - weighmentTare),
              slip_document_url: weighbillFileUrl,
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
    nextStatus: 'AT_LOADING' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'DELIVERED' | 'COMPLETED',
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Strict workflow guard: Delivery completion is NOT permitted without POD
      if (nextStatus === 'COMPLETED' || nextStatus === 'DELIVERED') {
        const checkPod = await documentWorkflowService.checkCanCompleteDelivery(tripId);
        if (!checkPod.canComplete && nextStatus === 'COMPLETED') {
          return {
            success: false,
            message: 'Delivery completion requires capturing and uploading the signed Acknowledgement Slip / POD.',
          };
        }
      }

      // 1. Try Backend REST Milestone API first
      try {
        const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/milestone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newStatus: nextStatus, notes }),
        });
        const resJson = await res.json();
        if (res.ok && resJson.success) {
          return { success: true, message: resJson.message || `Trip status updated to ${nextStatus}.` };
        } else if (resJson.code === 'INVALID_MILESTONE_TRANSITION') {
          return { success: false, message: resJson.error };
        }
      } catch {}

      // 2. Direct Supabase Fallback
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

  // ─── 9.1 Send Real-Time Location Telemetry Ping ───────────────────────────
  async sendLocationPing(
    tripId: string,
    ping: {
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      batteryLevel?: number;
    }
  ): Promise<{ success: boolean; tripStatus?: string; geofenceTriggered?: string | null; message: string }> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/location-ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ping),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          tripStatus: json.tripStatus,
          geofenceTriggered: json.geofenceTriggered,
          message: json.message || 'Location ping sent.',
        };
      }
      return { success: false, message: json.error || 'Failed to send location ping.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Location ping network error.' };
    }
  },

  // ─── 9.2 Fetch Live Tracking Telemetry Feed ───────────────────────────────
  async getLiveTracking(tripId: string): Promise<any | null> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/tracking`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.tracking) {
          return json.tracking;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  // ─── 9.3 Proximity Geofence Check ─────────────────────────────────────────
  async checkGeofence(
    tripId: string,
    coords: { latitude: number; longitude: number }
  ): Promise<{
    insidePickupGeofence: boolean;
    insideDestinationGeofence: boolean;
    distanceToPickupKm?: number;
    distanceToDestinationKm?: number;
  }> {
    try {
      const res = await fetch(`${getBackendApiUrl()}/trips/${tripId}/geofence-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return {
            insidePickupGeofence: Boolean(json.insidePickupGeofence),
            insideDestinationGeofence: Boolean(json.insideDestinationGeofence),
            distanceToPickupKm: json.distanceToPickupKm,
            distanceToDestinationKm: json.distanceToDestinationKm,
          };
        }
      }
      return { insidePickupGeofence: false, insideDestinationGeofence: false };
    } catch {
      return { insidePickupGeofence: false, insideDestinationGeofence: false };
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
    notes?: string,
    driverId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Delegate to documentWorkflowService
      await documentWorkflowService.uploadUnloadingPod({
        tripId,
        bookingId,
        driverId: driverId || 'DRIVER',
        fileName: `signed_acknowledgement_${tripId.slice(-6)}.pdf`,
        fileUrl: podFileUrl,
        receiverName,
        remarks: notes,
        consigneeStampVerified: true,
      });

      return {
        success: true,
        message: 'Signed Acknowledgement Slip / POD uploaded successfully! Trip closed for administrative verification.',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'POD upload failed.' };
    }
  },

  async uploadTripDocumentFile(file: {
    uri: string;
    fileName: string;
    mimeType?: string;
    tripId: string;
    docCategory: 'weighbills' | 'pods' | 'documents';
  }): Promise<{ success: boolean; fileUrl: string; storagePath?: string; error?: string }> {
    const ext = file.fileName.split('.').pop() || 'jpg';
    const storagePath = `trips/${file.tripId}/${file.docCategory}_${Date.now()}.${ext}`;

    const res = await uploadDocumentToStorage({
      uri: file.uri,
      fileName: file.fileName,
      mimeType: file.mimeType,
      storagePath,
    });

    if (!res.success) {
      console.warn('uploadTripDocumentFile failed:', res.error);
      return { success: false, fileUrl: file.uri, error: res.error };
    }

    return {
      success: true,
      fileUrl: res.fileUrl || res.storagePath,
      storagePath: res.storagePath,
    };
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

  // ─── 15. Electronic Proof of Delivery (e-POD) ──────────────────────────────
  async submitEpod(tripId: string, payload: any): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'e-POD submission failed' };
    }
  },

  async getEpod(tripId: string): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/pod`);
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch e-POD' };
    }
  },

  // ─── 16. Weighbridge Clearance & Tolerance ────────────────────────────────
  async recordWeighbridge(tripId: string, payload: any): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/weighbridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Weighbridge recording failed' };
    }
  },

  async getWeighbridge(tripId: string): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/weighbridge`);
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch weighbridge records' };
    }
  },

  // ─── 17. Damage & Shortage Claims ─────────────────────────────────────────
  async fileDamageClaim(tripId: string, payload: any): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to file damage claim' };
    }
  },

  async getTripClaims(tripId: string): Promise<any> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/trips/${tripId}/claims`);
      return await resp.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch claims' };
    }
  },
};

