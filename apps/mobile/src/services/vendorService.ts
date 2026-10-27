import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, ensureMobileSession } from '../supabase';
import { authService, SESSION_STORAGE_KEY } from './authService';
import {
  VendorRegistrationFormData,
  VendorDocumentItem,
  ScreenId,
  TransporterPayout,
  GeneratePayoutPayload,
  RecordDisbursalPayload,
} from '../types';
import { documentWorkflowService } from './documentWorkflowService';
import { formatDisplayId } from '../utils/idGenerator';
import { uploadDocumentToStorage, getSecureDocumentSignedUrl } from '../utils/mobileStorageHelper';

const VENDOR_FORM_KEY = '@necl_vendor_registration_draft';
const VENDOR_APP_PREFIX = '@necl_vendor_app_data_';
// Session storage key compatibility for recovery: necl_mobile_session_v1
const LOCAL_SESSION_KEY = 'necl_mobile_session_v1';

export interface VendorStepValidationItem {
  stepIndex: number;
  stepTitle: string;
  screenId: ScreenId;
  isComplete: boolean;
  missingFields: string[];
}

export interface VendorStepValidationResult {
  isAllComplete: boolean;
  steps: VendorStepValidationItem[];
  incompleteSteps: VendorStepValidationItem[];
  firstIncompleteStep: VendorStepValidationItem | null;
  totalSteps: number;
  completedCount: number;
}

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

export interface RegionalHub {
  id: string;
  name: string;
  city?: string;
  state: string;
  region: string;
  status?: string;
  isCustom?: boolean;
}

export const FALLBACK_REGIONAL_HUBS: RegionalHub[] = [
  { id: 'hub_ghy', name: 'Guwahati (Gateway Hub)', city: 'Guwahati', state: 'Assam', region: 'North East', status: 'ACTIVE' },
  { id: 'hub_slg', name: 'Siliguri (North Bengal Corridor)', city: 'Siliguri', state: 'West Bengal', region: 'East', status: 'ACTIVE' },
  { id: 'hub_ccu', name: 'Kolkata (Dankuni Port Hub)', city: 'Kolkata', state: 'West Bengal', region: 'East', status: 'ACTIVE' },
  { id: 'hub_del', name: 'Delhi / NCR Logistics Hub', city: 'Delhi', state: 'Delhi', region: 'North', status: 'ACTIVE' },
  { id: 'hub_bom', name: 'Mumbai / Bhiwandi Terminal', city: 'Mumbai', state: 'Maharashtra', region: 'West', status: 'ACTIVE' },
  { id: 'hub_hyd', name: 'Hyderabad Logistics Hub', city: 'Hyderabad', state: 'Telangana', region: 'South', status: 'ACTIVE' },
  { id: 'hub_agt', name: 'Agartala (Tripura Corridor)', city: 'Agartala', state: 'Tripura', region: 'North East', status: 'ACTIVE' },
  { id: 'hub_dmp', name: 'Dimapur (Nagaland Hub)', city: 'Dimapur', state: 'Nagaland', region: 'North East', status: 'ACTIVE' },
  { id: 'hub_shl', name: 'Shillong (Meghalaya Hub)', city: 'Shillong', state: 'Meghalaya', region: 'North East', status: 'ACTIVE' },
  { id: 'hub_maa', name: 'Chennai Logistics Hub', city: 'Chennai', state: 'Tamil Nadu', region: 'South', status: 'ACTIVE' },
  { id: 'hub_blr', name: 'Bengaluru Logistics Terminal', city: 'Bengaluru', state: 'Karnataka', region: 'South', status: 'ACTIVE' },
  { id: 'hub_amd', name: 'Ahmedabad Logistics Park', city: 'Ahmedabad', state: 'Gujarat', region: 'West', status: 'ACTIVE' },
  { id: 'hub_pat', name: 'Patna Freight Hub', city: 'Patna', state: 'Bihar', region: 'East', status: 'ACTIVE' },
  { id: 'hub_bbs', name: 'Bhubaneswar Logistics Hub', city: 'Bhubaneswar', state: 'Odisha', region: 'East', status: 'ACTIVE' },
  { id: 'hub_rpr', name: 'Raipur Logistics Terminal', city: 'Raipur', state: 'Chhattisgarh', region: 'Central', status: 'ACTIVE' },
  { id: 'hub_jpr', name: 'Jaipur Transport Hub', city: 'Jaipur', state: 'Rajasthan', region: 'North', status: 'ACTIVE' },
];

const REGIONAL_HUBS_CACHE_KEY = '@necl_regional_hubs_cache';

export function normalizeVendorDocType(rawType?: string): { category: string; docType: string } {
  const t = (rawType || '').toUpperCase().trim();
  if (t === 'COMPANY_PAN' || t === 'PAN' || t === 'VENDOR_PAN') {
    return { category: 'CLIENT_TRANSIT', docType: 'COMPANY_PAN' };
  }
  if (t === 'GST_CERTIFICATE' || t === 'GSTIN' || t === 'GST') {
    return { category: 'CLIENT_TRANSIT', docType: 'GST_CERTIFICATE' };
  }
  if (t === 'BANK_CANCELLED_CHEQUE' || t === 'BANK_PASSBOOK' || t === 'CHEQUE' || t === 'BANK_PROOF') {
    return { category: 'CLIENT_TRANSIT', docType: 'BANK_PASSBOOK' };
  }
  if (t === 'MSME_UDYAM' || t === 'MSME') {
    return { category: 'CLIENT_TRANSIT', docType: 'MSME_UDYAM' };
  }
  if (t === 'INCORPORATION_PROOF' || t === 'CERTIFICATE_OF_INCORPORATION') {
    return { category: 'CLIENT_TRANSIT', docType: 'INCORPORATION_PROOF' };
  }
  if (t === 'TRANSPORT_DECLARATION' || t === 'TIE_UP_AUTHORIZATION') {
    return { category: 'CLIENT_TRANSIT', docType: 'TIE_UP_AUTHORIZATION' };
  }
  return { category: 'CLIENT_TRANSIT', docType: 'OTHER' };
}

export const vendorService = {
  // In-memory active registration form data for the active multi-step session (drafts removed from local storage)
  activeRegistrationData: null as VendorRegistrationFormData | null,

  // ─── 1. Persistent Form State Across Navigation & Interruption ──────────
  async getDraftForm(): Promise<VendorRegistrationFormData | null> {
    if (this.activeRegistrationData) {
      return this.activeRegistrationData;
    }
    try {
      const saved = await AsyncStorage.getItem(VENDOR_FORM_KEY);
      if (saved) {
        this.activeRegistrationData = JSON.parse(saved);
        return this.activeRegistrationData;
      }
    } catch (err) {
      console.warn('[VendorService] Error reading draft from AsyncStorage:', err);
    }
    return null;
  },

  async saveDraftForm(data: Partial<VendorRegistrationFormData>): Promise<void> {
    let existing = this.activeRegistrationData;
    if (!existing) {
      try {
        const saved = await AsyncStorage.getItem(VENDOR_FORM_KEY);
        if (saved) existing = JSON.parse(saved);
      } catch {}
    }

    const base: VendorRegistrationFormData = existing || {
      transporterName: '',
      businessType: '',
      yearEstablished: '',
      msmeNumber: '',
      pan: '',
      gstin: '',
      registeredAddress: '',
      city: '',
      state: '',
      pincode: '',
      contactPerson: '',
      email: undefined,
      phone: '',
      altPhone: '',
      operatingHubs: [],
      manualOperatingLocations: [],
      interstatePermits: [],
      totalFleetCount: 0,
      fleetStrength: '',
      vehicleConfigs: [],
      truckCategories: [],
      servicesOffered: [],
      documents: [],
    };

    this.activeRegistrationData = { ...base, ...data };
    try {
      await AsyncStorage.setItem(VENDOR_FORM_KEY, JSON.stringify(this.activeRegistrationData));
    } catch (err) {
      console.warn('[VendorService] Error saving draft to AsyncStorage:', err);
    }
  },

  async clearDraftForm(): Promise<void> {
    this.activeRegistrationData = null;
    try {
      await AsyncStorage.removeItem(VENDOR_FORM_KEY);
    } catch { }
  },

  // ─── 1.0. Save Active Registration Step to Database During Progress ─────────
  async saveActiveRegistrationStep(
    step: number,
    data: Partial<VendorRegistrationFormData>,
    mobile?: string
  ): Promise<void> {
    // 1. Maintain in-memory state during session
    await this.saveDraftForm(data);
    const activeData = this.activeRegistrationData;
    if (!activeData) return;

    const cleanPhone = (mobile || activeData.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return;

    try {
      await ensureMobileSession();

      const { data: existingUser } = await supabase
        .from('vendor_users')
        .select('vendor_id')
        .eq('mobile', cleanPhone)
        .maybeSingle();

      let targetVendorId = existingUser?.vendor_id;
      const fullAddress = `${activeData.registeredAddress || ''}, ${activeData.city || ''}, ${activeData.state || ''} - ${activeData.pincode || ''}`.replace(/^, /, '').trim();

      if (targetVendorId) {
        await supabase
          .from('vendor_companies')
          .update({
            vendor_name: activeData.transporterName ? activeData.transporterName.trim() : 'Active Registration',
            pan: activeData.pan ? activeData.pan.trim().toUpperCase() : 'NOT_PROVIDED',
            gstin: activeData.gstin ? activeData.gstin.trim().toUpperCase() : null,
            address: fullAddress || null,
            status: 'INACTIVE', // Staging: active registration in progress, not yet submitted for review
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetVendorId);
      } else if (activeData.transporterName) {
        const { data: newComp } = await supabase
          .from('vendor_companies')
          .insert([
            {
              vendor_name: activeData.transporterName.trim(),
              pan: activeData.pan ? activeData.pan.trim().toUpperCase() : 'NOT_PROVIDED',
              gstin: activeData.gstin ? activeData.gstin.trim().toUpperCase() : null,
              address: fullAddress || null,
              status: 'INACTIVE',
              onboarding_source: 'SELF_REGISTERED',
            },
          ])
          .select('id')
          .maybeSingle();

        if (newComp?.id) {
          targetVendorId = newComp.id;
          await supabase.from('vendor_users').upsert([
            {
              vendor_id: targetVendorId,
              full_name: (activeData.contactPerson || activeData.transporterName).trim(),
              mobile: cleanPhone,
              email: activeData.email?.trim().toLowerCase() || null,
              status: 'ACTIVE',
            },
          ], { onConflict: 'mobile' });
        }
      }

      // Step 5: Fleet strength configs are saved in vendor_companies.vehicle_configs.
      // Explicit vehicle records are registered only through Vendor App -> Vehicle Registration.

    } catch (err) {
      console.warn('Vendor step-by-step persistence notice:', err);
    }
  },

  // ─── 1.05. Upload Vendor KYC Document via Camera or File/Storage ───────────
  async uploadVendorDocument(file: {
    uri?: string;
    blob?: Blob | ArrayBuffer | Uint8Array;
    fileName: string;
    fileSize?: string;
    mimeType?: string;
    docType: string;
    referenceKey?: string;
  }): Promise<{ success: boolean; storagePath: string; fileUrl?: string; error?: string }> {
    const cleanRef = (file.referenceKey || 'vendor_kyc').replace(/[^a-zA-Z0-9_-]/g, '') || 'vendor_kyc';
    const cleanDocType = file.docType.toLowerCase().replace(/_/g, '-');
    const ext = file.fileName.split('.').pop() || 'jpg';
    const storagePath = `vendors/${cleanRef}/${cleanDocType}-${Date.now()}.${ext}`;

    return await uploadDocumentToStorage({
      uri: file.uri,
      blob: file.blob,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      storagePath,
    });
  },

  async getSignedDocumentUrl(storagePath: string): Promise<string | null> {
    return getSecureDocumentSignedUrl(storagePath);
  },

  // ─── 1.1. Load Genuine Saved Registration for Authenticated Vendor ─────────
  async loadAuthenticatedVendorRegistration(vendorId?: string, mobile?: string): Promise<VendorRegistrationFormData | null> {
    try {
      // 1. If active registration exists in memory, return it
      if (this.activeRegistrationData && this.activeRegistrationData.transporterName) {
        return this.activeRegistrationData;
      }

      const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);

      // 2. Resolve vendorId if only mobile is supplied
      let resolvedVendorId = vendorId && vendorId.includes('-') ? vendorId : undefined;
      if (!resolvedVendorId && cleanPhone) {
        const { data: uRec } = await supabase
          .from('vendor_users')
          .select('vendor_id')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();
        if (uRec?.vendor_id) {
          resolvedVendorId = uRec.vendor_id;
        } else {
          const { data: cRec } = await supabase
            .from('vendor_companies')
            .select('id')
            .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
            .maybeSingle();
          if (cRec?.id) resolvedVendorId = cRec.id;
        }
      }

      // 3. Try loading from local application storage
      let cachedData: any = null;
      if (resolvedVendorId) {
        const cached = await AsyncStorage.getItem(`${VENDOR_APP_PREFIX}${resolvedVendorId}`);
        if (cached) {
          try {
            cachedData = JSON.parse(cached);
          } catch {}
        }
      }

      // 4. Try loading from database
      if (resolvedVendorId) {
        const { data: vRecord } = await supabase
          .from('vendor_companies')
          .select('*')
          .eq('id', resolvedVendorId)
          .maybeSingle();

        if (vRecord) {
          const { data: uRecord } = await supabase
            .from('vendor_users')
            .select('*')
            .eq('vendor_id', resolvedVendorId)
            .maybeSingle();

          // Recover saved rich fields from audit log if available
          let auditDetails: any = null;
          try {
            const { data: auditLogs } = await supabase
              .from('auth_audit_log')
              .select('details')
              .eq('user_id', resolvedVendorId)
              .order('created_at', { ascending: false })
              .limit(1);
            if (auditLogs && auditLogs.length > 0 && auditLogs[0].details) {
              auditDetails = auditLogs[0].details;
            }
          } catch {}

          // Load vehicle configurations and associated drivers
          const vehicleConfigs: any[] = [];
          const fleetDocuments: any[] = [];
          const linkedVehicleIds: string[] = [];
          const linkedDriverIds: string[] = [];
          const vehicleMap = new Map<string, any>();

          try {
            const { data: vLinks } = await supabase
              .from('vendor_vehicle_links')
              .select('vehicle_id, vehicles(*)')
              .eq('vendor_id', resolvedVendorId);
            if (vLinks && vLinks.length > 0) {
              for (const l of vLinks) {
                const v: any = Array.isArray(l.vehicles) ? l.vehicles[0] : l.vehicles;
                if (v) {
                  linkedVehicleIds.push(v.id);
                  vehicleMap.set(v.id, v);
                  vehicleConfigs.push({
                    id: v.id,
                    vehicleType: v.vehicle_type || 'Lorry',
                    capacity: v.rated_capacity_mt || 10,
                    capacityUnit: 'MT',
                    bodyType: v.body_type || 'Open Body',
                    ownership: 'Owned',
                    wheelCount: 6,
                    registrationNumber: v.registration_number,
                    rcNumber: v.rc_number,
                    vehicleCount: 1,
                  });
                }
              }
            }

            // Fetch drivers associated to this vendor
            const { data: driverList } = await supabase
              .from('drivers')
              .select('*')
              .eq('primary_vendor_id', resolvedVendorId);
            if (driverList && driverList.length > 0) {
              for (let i = 0; i < driverList.length; i++) {
                const drv = driverList[i];
                linkedDriverIds.push(drv.id);
                if (vehicleConfigs[i]) {
                  vehicleConfigs[i].driverName = drv.full_name || drv.name;
                  vehicleConfigs[i].driverPhone = drv.mobile || drv.phone;
                  vehicleConfigs[i].driverLicence = drv.licence_number || drv.license_number;
                }
              }
            }
          } catch (vehLoadErr) {
            console.warn('Vehicle and driver loading notice:', vehLoadErr);
          }

          // Load documents (Company KYC + Fleet vehicle docs + Driver docs)
          const documents: VendorDocumentItem[] = [];
          try {
            const allDocRefs = [resolvedVendorId, ...linkedVehicleIds, ...linkedDriverIds];
            const { data: docRecords } = await supabase
              .from('documents')
              .select('*')
              .in('reference_id', allDocRefs);
            if (docRecords && docRecords.length > 0) {
              for (const d of docRecords) {
                if (d.reference_id === resolvedVendorId) {
                  documents.push({
                    id: d.id,
                    docType: d.document_type as any,
                    title: d.file_name || `${d.document_type}.pdf`,
                    fileName: d.file_name || `${d.document_type}.pdf`,
                    storagePath: d.storage_path,
                    fileUrl: d.file_url,
                    uploadedAt: d.created_at,
                    status: (d.verification_status === 'APPROVED' ? 'APPROVED' : d.verification_status === 'REJECTED' ? 'REJECTED' : 'PENDING') as any,
                    rejectionReason: d.rejection_reason,
                  });
                } else {
                  const matchedVeh = vehicleMap.get(d.reference_id);
                  let mappedType = d.document_type;
                  if (mappedType === 'FITNESS') mappedType = 'C_BOOK';
                  fleetDocuments.push({
                    id: d.id,
                    vehicleId: d.reference_id,
                    registrationNumber: matchedVeh?.registration_number || '',
                    docType: mappedType,
                    title: d.file_name || mappedType,
                    fileName: d.file_name,
                    fileUrl: d.file_url,
                    storagePath: d.storage_path,
                    status: (d.verification_status === 'APPROVED' ? 'APPROVED' : d.verification_status === 'REJECTED' ? 'REJECTED' : 'PENDING') as any,
                    rejectionReason: d.rejection_reason,
                    uploadedAt: d.created_at,
                  });
                }
              }
            }
          } catch (docLoadErr) {
            console.warn('Document loading notice:', docLoadErr);
          }

          // Parse address components if city/state/pincode not separated
          let parsedAddress = vRecord.address || cachedData?.registeredAddress || '';
          let parsedCity = vRecord.city || cachedData?.city || '';
          let parsedState = vRecord.state || cachedData?.state || '';
          let parsedPincode = vRecord.pincode || cachedData?.pincode || '';
          if (parsedAddress && (!parsedCity || !parsedState || !parsedPincode)) {
            const pinMatch = parsedAddress.match(/(\d{6})/);
            if (pinMatch && !parsedPincode) parsedPincode = pinMatch[1];
            const parts = parsedAddress.split(',').map((p: string) => p.trim());
            if (parts.length >= 2 && !parsedCity) parsedCity = parts[parts.length - 2];
          }

          const loadedData: VendorRegistrationFormData = {
            transporterName: vRecord.vendor_name || cachedData?.transporterName || '',
            businessType: cachedData?.businessType || auditDetails?.businessType || vRecord.business_type || '',
            yearEstablished: cachedData?.yearEstablished || auditDetails?.yearEstablished || vRecord.year_established || '',
            msmeNumber: cachedData?.msmeNumber || auditDetails?.msmeNumber || vRecord.msme_number || '',
            pan: vRecord.pan && vRecord.pan !== 'NOT_PROVIDED' ? vRecord.pan : (cachedData?.pan || ''),
            gstin: vRecord.gstin || cachedData?.gstin || '',
            registeredAddress: parsedAddress,
            city: parsedCity,
            state: parsedState,
            pincode: parsedPincode,
            contactPerson: uRecord?.full_name || cachedData?.contactPerson || '',
            email: uRecord?.email || cachedData?.email || undefined,
            phone: uRecord?.mobile || cleanPhone || cachedData?.phone || '',
            operatingHubs: (cachedData?.operatingHubs && cachedData.operatingHubs.length > 0) ? cachedData.operatingHubs : (auditDetails?.operatingHubs || []),
            manualOperatingLocations: (cachedData?.manualOperatingLocations && cachedData.manualOperatingLocations.length > 0) ? cachedData.manualOperatingLocations : (auditDetails?.manualOperatingLocations || []),
            interstatePermits: (cachedData?.interstatePermits && cachedData.interstatePermits.length > 0) ? cachedData.interstatePermits : (auditDetails?.interstatePermits || []),
            totalFleetCount: cachedData?.totalFleetCount || auditDetails?.totalFleetCount || vehicleConfigs.length || (vRecord.fleet_size ? Number(vRecord.fleet_size) : 0),
            fleetStrength: cachedData?.fleetStrength || auditDetails?.fleetStrength || (vehicleConfigs.length > 0 ? `${vehicleConfigs.length} Commercial Trucks` : ''),
            vehicleConfigs: (cachedData?.vehicleConfigs && cachedData.vehicleConfigs.length > 0) ? cachedData.vehicleConfigs : (auditDetails?.vehicleConfigs || vehicleConfigs),
            truckCategories: cachedData?.truckCategories || auditDetails?.truckCategories || [],
            servicesOffered: (cachedData?.servicesOffered && cachedData.servicesOffered.length > 0) ? cachedData.servicesOffered : (auditDetails?.servicesOffered || []),
            documents: documents.length > 0 ? documents : (cachedData?.documents || []),
            fleetDocuments: (cachedData?.fleetDocuments && cachedData.fleetDocuments.length > 0) ? cachedData.fleetDocuments : (auditDetails?.fleetDocuments || fleetDocuments),
          };
          await this.saveDraftForm(loadedData);
          return loadedData;
        }
      }

      if (cachedData && (cachedData.transporterName || cachedData.vendor_name)) {
        await this.saveDraftForm(cachedData);
        return cachedData;
      }

      const activeDraft = await this.getDraftForm();
      if (activeDraft && (activeDraft.transporterName || activeDraft.contactPerson)) {
        return activeDraft;
      }

      return null;
    } catch (e) {
      console.warn('loadAuthenticatedVendorRegistration notice:', e);
      return null;
    }
  },

  // ─── 1.1. Intelligent Registration Step Validation ─────────────────────────
  validateVendorRegistrationData(
    formData: Partial<VendorRegistrationFormData> | null,
    documents?: VendorDocumentItem[]
  ): VendorStepValidationResult {
    const data = formData || {};
    const docs = documents || data.documents || [];

    // Step 1: Enterprise Registration (transporterName, contactPerson, phone, pan)
    const step1Missing: string[] = [];
    const transporterName = (data.transporterName || '').trim();
    if (!transporterName || transporterName === 'Active Registration' || transporterName === 'Active Registration (Pending Details)') {
      step1Missing.push('Enterprise / Firm Name');
    }
    const contactPerson = (data.contactPerson || '').trim();
    if (!contactPerson) {
      step1Missing.push('Authorized Contact Person Name');
    }
    const cleanPhone = (data.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      step1Missing.push('10-digit Mobile Number');
    }
    const pan = (data.pan || '').trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!pan || pan === 'NOT_PROVIDED' || !panRegex.test(pan)) {
      step1Missing.push('Valid 10-character Permanent Account Number (PAN)');
    }
    // GSTIN is optional in Step 1

    // Step 2: Business Constitution (businessType, yearEstablished)
    const step2Missing: string[] = [];
    const businessType = (data.businessType || '').trim();
    if (!businessType) {
      step2Missing.push('Business Entity Type');
    }
    const yearEstablished = (data.yearEstablished || '').trim();
    const yearNum = Number(yearEstablished);
    const currentYear = new Date().getFullYear();
    if (!yearEstablished || isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
      step2Missing.push('4-digit Year of Establishment');
    }
    // MSME Number is optional in Step 2

    // Step 3: Registered Office & Depot (registeredAddress, city, pincode, state)
    const step3Missing: string[] = [];
    const address = (data.registeredAddress || '').trim();
    if (!address) {
      step3Missing.push('Registered Office Address');
    }
    const city = (data.city || '').trim();
    if (!city) {
      step3Missing.push('City');
    }
    const pincode = (data.pincode || '').replace(/[^0-9]/g, '').trim();
    if (!pincode || pincode.length !== 6) {
      step3Missing.push('Valid 6-digit PIN Code');
    }
    const state = (data.state || '').trim();
    if (!state) {
      step3Missing.push('State');
    }
    // Email is optional in Step 3

    // Step 4: Route Coverage & Regional Hubs (operatingHubs or manualOperatingLocations)
    const step4Missing: string[] = [];
    const hubs = Array.isArray(data.operatingHubs) ? data.operatingHubs : [];
    const manualLocations = Array.isArray(data.manualOperatingLocations) ? data.manualOperatingLocations : [];
    if (hubs.length === 0 && manualLocations.length === 0) {
      step4Missing.push('Operating Regional Hubs / Freight Routes');
    }

    // Step 5: Fleet Strength & Commercial Vehicles (totalFleetCount > 0, vehicleConfigs.length > 0)
    const step5Missing: string[] = [];
    const fleetCount = Number(data.totalFleetCount) || 0;
    const configs = Array.isArray(data.vehicleConfigs) ? data.vehicleConfigs : [];
    if (fleetCount <= 0 && configs.length === 0) {
      step5Missing.push('Total Active Fleet Count');
      step5Missing.push('At least one Commercial Vehicle Configuration');
    } else if (fleetCount <= 0) {
      step5Missing.push('Total Active Fleet Count (> 0)');
    } else if (configs.length === 0) {
      step5Missing.push('At least one Commercial Vehicle Configuration');
    }

    // Step 6: Service Offerings (servicesOffered.length > 0)
    const step6Missing: string[] = [];
    const services = Array.isArray(data.servicesOffered) ? data.servicesOffered : [];
    if (services.length === 0) {
      step6Missing.push('At least one Transport Service Capability');
    }

    // Step 7: Document Uploads (Mandatory: COMPANY_PAN, BANK_CANCELLED_CHEQUE; no rejected docs)
    const step7Missing: string[] = [];
    const hasPanDoc = docs.some(
      (d) =>
        (d.docType === 'COMPANY_PAN' || (d.docType as string) === 'PAN' || (d.docType as string) === 'PAN_CARD') &&
        d.status !== 'REJECTED' &&
        Boolean(d.fileUrl || d.fileName)
    );
    const hasChequeDoc = docs.some(
      (d) =>
        (d.docType === 'BANK_CANCELLED_CHEQUE' || (d.docType as string) === 'CANCELLED_CHEQUE' || (d.docType as string) === 'BANK_DETAILS') &&
        d.status !== 'REJECTED' &&
        Boolean(d.fileUrl || d.fileName)
    );
    const rejectedDocs = docs.filter((d) => d.status === 'REJECTED');

    if (!hasPanDoc) {
      step7Missing.push('PAN Card Document Upload');
    }
    if (!hasChequeDoc) {
      step7Missing.push('Bank Cancelled Cheque Document Upload');
    }
    if (rejectedDocs.length > 0) {
      step7Missing.push(`${rejectedDocs.length} Document(s) Flagged for Correction`);
    }

    const steps: VendorStepValidationItem[] = [
      {
        stepIndex: 1,
        stepTitle: 'Enterprise Registration',
        screenId: 'VENDOR_REGISTRATION',
        isComplete: step1Missing.length === 0,
        missingFields: step1Missing,
      },
      {
        stepIndex: 2,
        stepTitle: 'Business Constitution',
        screenId: 'VENDOR_BUSINESS_INFO',
        isComplete: step2Missing.length === 0,
        missingFields: step2Missing,
      },
      {
        stepIndex: 3,
        stepTitle: 'Registered Office & Depot',
        screenId: 'VENDOR_ADDRESS_CONTACT',
        isComplete: step3Missing.length === 0,
        missingFields: step3Missing,
      },
      {
        stepIndex: 4,
        stepTitle: 'Route Coverage & Hubs',
        screenId: 'VENDOR_OPERATING_LOCATIONS',
        isComplete: step4Missing.length === 0,
        missingFields: step4Missing,
      },
      {
        stepIndex: 5,
        stepTitle: 'Fleet Strength & Vehicles',
        screenId: 'VENDOR_FLEET_INFO',
        isComplete: step5Missing.length === 0,
        missingFields: step5Missing,
      },
      {
        stepIndex: 6,
        stepTitle: 'Service Offerings',
        screenId: 'VENDOR_TRANSPORT_SERVICES',
        isComplete: step6Missing.length === 0,
        missingFields: step6Missing,
      },
      {
        stepIndex: 7,
        stepTitle: 'KYC Document Uploads',
        screenId: 'VENDOR_DOC_UPLOAD',
        isComplete: step7Missing.length === 0,
        missingFields: step7Missing,
      },
    ];

    const incompleteSteps = steps.filter((s) => !s.isComplete);
    const completedCount = steps.filter((s) => s.isComplete).length;

    return {
      isAllComplete: incompleteSteps.length === 0,
      steps,
      incompleteSteps,
      firstIncompleteStep: incompleteSteps.length > 0 ? incompleteSteps[0] : null,
      totalSteps: 7,
      completedCount,
    };
  },

  async getVendorRegistrationStepValidation(
    vendorId: string,
    phone?: string
  ): Promise<VendorStepValidationResult> {
    const data = await this.loadAuthenticatedVendorRegistration(vendorId, phone);
    return this.validateVendorRegistrationData(data, data?.documents);
  },

  // ─── 1.2. Dynamic Regional Hubs (Backend / Supabase / Cache) ────────────────
  async getActiveRegionalHubs(): Promise<RegionalHub[]> {
    try {
      // 1. Try Backend REST API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      try {
        const res = await fetch(`${getBackendApiUrl()}/regional-hubs`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.hubs) && json.hubs.length > 0) {
            const mapped: RegionalHub[] = json.hubs.map((h: any) => ({
              id: h.id,
              name: h.name,
              city: h.city,
              state: h.state,
              region: h.region || 'National',
              status: h.status || 'ACTIVE',
              isCustom: !!h.is_custom,
            }));
            await AsyncStorage.setItem(REGIONAL_HUBS_CACHE_KEY, JSON.stringify(mapped));
            return mapped;
          }
        }
      } catch {
        clearTimeout(timeoutId);
      }

      // 2. Direct Supabase Query
      const { data: dbHubs, error } = await supabase
        .from('regional_hubs')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('is_custom', { ascending: true })
        .order('name', { ascending: true });

      if (!error && dbHubs && dbHubs.length > 0) {
        const mapped: RegionalHub[] = dbHubs.map((h: any) => ({
          id: h.id,
          name: h.name,
          city: h.city,
          state: h.state,
          region: h.region || 'National',
          status: h.status || 'ACTIVE',
          isCustom: !!h.is_custom,
        }));
        await AsyncStorage.setItem(REGIONAL_HUBS_CACHE_KEY, JSON.stringify(mapped));
        return mapped;
      }

      // 3. Fallback to cached hubs
      const cached = await AsyncStorage.getItem(REGIONAL_HUBS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }

      return FALLBACK_REGIONAL_HUBS;
    } catch {
      return FALLBACK_REGIONAL_HUBS;
    }
  },

  async addRegionalHub(hubData: {
    name: string;
    city: string;
    state: string;
    region?: string;
  }): Promise<RegionalHub> {
    const cleanName = hubData.name.trim();
    const cleanCity = hubData.city.trim();
    const cleanState = hubData.state.trim();
    const cleanRegion = hubData.region?.trim() || 'National';
    const hubId = `hub_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const formattedName = cleanName.toLowerCase().includes(cleanCity.toLowerCase())
      ? cleanName
      : `${cleanName} (${cleanCity})`;

    // Check existing hubs in local cache / active list to prevent duplicates
    try {
      const current = await this.getActiveRegionalHubs();
      const existingMatch = current.find(
        (h) => h.city?.trim().toLowerCase() === cleanCity.toLowerCase() &&
               (h.name?.trim().toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(h.name?.trim().toLowerCase()))
      );
      if (existingMatch) {
        return existingMatch;
      }
    } catch {}

    const newHub: RegionalHub = {
      id: hubId,
      name: formattedName,
      city: cleanCity,
      state: cleanState,
      region: cleanRegion,
      status: 'ACTIVE',
      isCustom: true,
    };

    // 1. Try Backend REST API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${getBackendApiUrl()}/regional-hubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: cleanName,
          city: cleanCity,
          state: cleanState,
          region: cleanRegion,
        }),
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.hub) {
          newHub.id = json.hub.id || hubId;
        }
      }
    } catch (apiErr) {
      console.warn('Backend add regional hub notice:', apiErr);
    }

    // 2. Direct Supabase Insert
    try {
      await supabase.from('regional_hubs').insert([
        {
          id: newHub.id,
          name: newHub.name,
          city: newHub.city,
          state: newHub.state,
          region: newHub.region,
          status: 'ACTIVE',
          is_custom: true,
        },
      ]);
    } catch (sbErr) {
      console.warn('Supabase add regional hub notice:', sbErr);
    }

    // 3. Update local cache
    try {
      const current = await this.getActiveRegionalHubs();
      const exists = current.some((h) => h.id === newHub.id || h.name.toLowerCase() === newHub.name.toLowerCase());
      if (!exists) {
        const updated = [...current, newHub];
        await AsyncStorage.setItem(REGIONAL_HUBS_CACHE_KEY, JSON.stringify(updated));
      }
    } catch { }

    return newHub;
  },

  // ─── 2. Submit Complete Vendor Registration ────────────────────────────────
  async submitVendorRegistration(
    formData: VendorRegistrationFormData,
    mobile: string
  ): Promise<{ success: boolean; vendorId: string; applicationNumber: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
    let vendorId = '';
    let canonicalAppNo = '';

    try {
      // 1. Try Backend API Registration for high reliability & admin privileges
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const apiRes = await fetch(`${getBackendApiUrl()}/vendor/submit-registration`, {
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
          vendorId = resData.vendorId;
          canonicalAppNo = resData.applicationNumber || formatDisplayId('VD', vendorId);
        } else if (resData.roleConflict) {
          throw new Error(resData.message || 'Mobile number already registered under another role');
        }
      } catch (apiErr: any) {
        if (apiErr.message?.includes('another role') || apiErr.message?.includes('already registered')) {
          throw apiErr;
        }
        console.warn('Backend vendor registration notice, using direct operations:', apiErr.message);
      }

      const fullAddress = `${formData.registeredAddress}, ${formData.city}, ${formData.state} - ${formData.pincode}`;

      if (!vendorId) {
        await ensureMobileSession();

        // Check if user or company already exists for this phone (e.g. invited by admin)
        const { data: existingUser } = await supabase
          .from('vendor_users')
          .select('vendor_id')
          .eq('mobile', cleanPhone)
          .maybeSingle();

        if (existingUser?.vendor_id) {
          vendorId = existingUser.vendor_id;
          canonicalAppNo = formatDisplayId('VD', vendorId);
          const { error: updErr } = await supabase
            .from('vendor_companies')
            .update({
              vendor_name: formData.transporterName.trim(),
              pan: formData.pan.trim().toUpperCase() || 'NOT_PROVIDED',
              gstin: formData.gstin.trim().toUpperCase() || null,
              address: fullAddress,
              vendor_code: canonicalAppNo,
              status: 'PENDING',
              compliance_status: 'PENDING',
              operating_routes: formData.operatingHubs || [],
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorId);

          if (updErr) {
            console.error('vendor_companies update error:', updErr);
            throw new Error(`Database persistence failed: ${updErr.message}`);
          }
        } else {
          // Pre-generate canonical code
          const initialCode = formatDisplayId('VD', cleanPhone);
          const { data: vRecord, error: vErr } = await supabase
            .from('vendor_companies')
            .insert([
              {
                vendor_name: formData.transporterName.trim(),
                pan: formData.pan.trim().toUpperCase() || 'NOT_PROVIDED',
                gstin: formData.gstin.trim().toUpperCase() || null,
                address: fullAddress,
                vendor_code: initialCode,
                status: 'PENDING',
                compliance_status: 'PENDING',
                operating_routes: formData.operatingHubs || [],
                onboarding_source: 'SELF_REGISTERED',
              },
            ])
            .select('id')
            .single();

          if (vErr || !vRecord?.id) {
            console.error('vendor_companies insert error:', vErr);
            throw new Error(`Database persistence failed: ${vErr?.message || 'Unable to register vendor company'}`);
          }

          vendorId = vRecord.id;
          canonicalAppNo = formatDisplayId('VD', vendorId);
          await supabase
            .from('vendor_companies')
            .update({ vendor_code: canonicalAppNo })
            .eq('id', vendorId);
        }
      } else if (!canonicalAppNo) {
        canonicalAppNo = formatDisplayId('VD', vendorId);
      }

      // Upsert into vendor_users so login via phone works seamlessly without duplicate key errors
      try {
        const { data: existingVendorUser } = await supabase
          .from('vendor_users')
          .select('id')
          .eq('mobile', cleanPhone)
          .maybeSingle();

        if (existingVendorUser?.id) {
          await supabase
            .from('vendor_users')
            .update({
              vendor_id: vendorId,
              full_name: (formData.contactPerson || formData.transporterName).trim(),
              email: formData.email?.trim().toLowerCase() || null,
              status: 'ACTIVE',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingVendorUser.id);
        } else {
          await supabase.from('vendor_users').insert([
            {
              vendor_id: vendorId,
              full_name: (formData.contactPerson || formData.transporterName).trim(),
              mobile: cleanPhone,
              email: formData.email?.trim().toLowerCase() || null,
              status: 'ACTIVE',
            },
          ]);
        }
      } catch (uErr) {
        console.warn('vendor_users upsert notice:', uErr);
      }

      // 1. Persist vehicles into vehicles table & link to vendor
      const vehicleIdByReg = new Map<string, string>();
      const vehicleIdByConfigId = new Map<string, string>();
      const driverIdByReg = new Map<string, string>();

      if (formData.vehicleConfigs && formData.vehicleConfigs.length > 0) {
        for (const cfg of formData.vehicleConfigs) {
          try {
            const rawReg = (cfg.registrationNumber || '').trim().toUpperCase();
            if (!rawReg) continue;

            const category = cfg.vehicleType || 'Lorry';
            const bodyType = cfg.bodyType || 'Open Body';
            const ratedCap = Number(cfg.capacity) || 10;
            const minCap = Math.max(1, Math.round(ratedCap * 0.7));
            const rcNum = (cfg.rcNumber || rawReg).trim().toUpperCase();

            const { data: vRecord, error: vErr } = await supabase
              .from('vehicles')
              .upsert([
                {
                  registration_number: rawReg,
                  vehicle_type: category,
                  body_type: bodyType,
                  rated_capacity_mt: ratedCap,
                  minimum_capacity_mt: minCap,
                  rc_number: rcNum,
                  status: 'ACTIVE',
                  verification_status: 'PENDING_DOCS',
                  rc_verification_status: 'PENDING',
                  insurance_verification_status: 'PENDING',
                  fitness_verification_status: 'PENDING',
                  permit_verification_status: 'PENDING',
                },
              ], { onConflict: 'registration_number' })
              .select('id, registration_number')
              .maybeSingle();

            if (vErr) {
              console.warn(`Vehicle insertion notice for ${rawReg}:`, vErr.message);
            }

            const targetVehId = vRecord?.id;
            if (targetVehId) {
              vehicleIdByReg.set(rawReg, targetVehId);
              if (cfg.id) vehicleIdByConfigId.set(cfg.id, targetVehId);

              // Link to vendor
              await supabase
                .from('vendor_vehicle_links')
                .upsert([
                  {
                    vendor_id: vendorId,
                    vehicle_id: targetVehId,
                    status: 'PENDING',
                  },
                ], { onConflict: 'vendor_id,vehicle_id' });
            }

            // Driver enrollment for this vehicle if driver info provided
            const drvName = (cfg.driverName || '').trim();
            const drvPhone = (cfg.driverPhone || '').replace(/[^0-9]/g, '').slice(-10);
            const drvLicence = (cfg.driverLicence || (drvPhone ? `DL-${drvPhone}` : '')).trim().toUpperCase();

            if (drvName || drvPhone || drvLicence) {
              const driverInsertPayload: Record<string, any> = {
                primary_vendor_id: vendorId,
                full_name: drvName || `Driver for ${rawReg}`,
                name: drvName || `Driver for ${rawReg}`,
                licence_number: drvLicence || `DL-TEMP-${Date.now().toString().slice(-6)}`,
                license_number: drvLicence || `DL-TEMP-${Date.now().toString().slice(-6)}`,
                licence_expiry_date: '2029-12-31',
                status: 'PENDING',
              };
              if (drvPhone) {
                driverInsertPayload.mobile = drvPhone;
                driverInsertPayload.phone = drvPhone;
              }

              const { data: dRecord, error: dErr } = await supabase
                .from('drivers')
                .upsert([driverInsertPayload], drvPhone ? { onConflict: 'mobile' } : undefined)
                .select('id')
                .maybeSingle();

              if (dErr) {
                console.warn(`Driver enrollment notice for ${rawReg}:`, dErr.message);
              }

              if (dRecord?.id) {
                driverIdByReg.set(rawReg, dRecord.id);
                if (cfg.id) driverIdByReg.set(cfg.id, dRecord.id);
              }
            }
          } catch (vehLoopErr) {
            console.warn('Vehicle enrollment error in registration:', vehLoopErr);
          }
        }
      }

      // 2. Persist Company KYC documents in documents table
      if (formData.documents && formData.documents.length > 0) {
        for (const doc of formData.documents) {
          if (doc.fileUrl || doc.fileName) {
            try {
              const { category, docType } = normalizeVendorDocType(doc.docType);
              await supabase.from('documents').insert([
                {
                  category,
                  document_type: docType,
                  reference_id: vendorId,
                  file_url: doc.fileUrl || `https://trucks.in/vendor-docs/${vendorId}/${docType.toLowerCase()}.pdf`,
                  file_name: doc.fileName ? `${docType}: ${doc.fileName}` : `${docType}.pdf`,
                  file_size: doc.fileSize || '350 KB',
                  mime_type: 'application/pdf',
                  verification_status: 'PENDING',
                  uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
                },
              ]);
            } catch (dErr) {
              console.warn('Vendor doc upload notice:', dErr);
            }
          }
        }
      }

      // 3. Persist Individual Fleet & Driver Documents in documents table
      if (formData.fleetDocuments && formData.fleetDocuments.length > 0) {
        for (const fDoc of formData.fleetDocuments) {
          if (fDoc.fileUrl || fDoc.fileName || fDoc.storagePath) {
            try {
              const cleanReg = (fDoc.registrationNumber || '').trim().toUpperCase();
              const matchedVehId = vehicleIdByReg.get(cleanReg) || vehicleIdByConfigId.get(fDoc.vehicleId) || fDoc.vehicleId;
              const matchedDriverId = driverIdByReg.get(cleanReg) || driverIdByReg.get(fDoc.vehicleId);

              if (fDoc.docType === 'DRIVING_LICENCE') {
                await supabase.from('documents').insert([
                  {
                    category: 'DRIVER',
                    document_type: 'LICENCE',
                    reference_id: matchedDriverId || matchedVehId || vendorId,
                    file_url: fDoc.fileUrl || fDoc.storagePath || `https://trucks.in/vendor-docs/${vendorId}/dl-${cleanReg || 'driver'}.pdf`,
                    file_name: fDoc.fileName ? `[${cleanReg || 'Fleet'}] Driver Licence: ${fDoc.fileName}` : `[${cleanReg || 'Fleet'}] Driver Licence.pdf`,
                    file_size: fDoc.fileSize || '350 KB',
                    mime_type: 'application/pdf',
                    storage_path: fDoc.storagePath || null,
                    verification_status: 'PENDING',
                    uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
                  },
                ]);
              } else {
                let mappedType: string = fDoc.docType;
                if (mappedType === 'C_BOOK') mappedType = 'FITNESS';
                else if (mappedType === 'PUC') mappedType = 'OTHER';

                if (matchedVehId) {
                  await supabase.from('documents').insert([
                    {
                      category: 'VEHICLE',
                      document_type: mappedType,
                      reference_id: matchedVehId,
                      file_url: fDoc.fileUrl || fDoc.storagePath || `https://trucks.in/vendor-docs/${vendorId}/${mappedType.toLowerCase()}-${cleanReg}.pdf`,
                      file_name: fDoc.fileName ? `[${cleanReg}] ${fDoc.title || (fDoc.docType === 'PUC' ? 'Pollution Certificate (PUC)' : mappedType)}: ${fDoc.fileName}` : `[${cleanReg}] ${fDoc.title || (fDoc.docType === 'PUC' ? 'Pollution Certificate (PUC)' : mappedType)}.pdf`,
                      file_size: fDoc.fileSize || '350 KB',
                      mime_type: 'application/pdf',
                      storage_path: fDoc.storagePath || null,
                      verification_status: 'PENDING',
                      uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
                    },
                  ]);
                }
              }
            } catch (fdErr) {
              console.warn('Fleet doc insert notice:', fdErr);
            }
          }
        }
      }

      // Save Session locally
      const sessionObj = {
        userId: vendorId,
        mobile: cleanPhone,
        role: 'VENDOR' as const,
        fullName: (formData.contactPerson || formData.transporterName).trim(),
        companyName: formData.transporterName.trim(),
        token: 'sess-vendor-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionObj));

      // Synchronize local registry
      try {
        const registry = await authService.getLocalRegistry();
        const filtered = registry.filter((u) => u.mobile !== cleanPhone);
        filtered.unshift({
          mobile: cleanPhone,
          role: 'VENDOR',
          fullName: (formData.contactPerson || formData.transporterName).trim(),
          companyName: formData.transporterName.trim(),
          status: 'PENDING',
          registeredAt: new Date().toISOString(),
        });
        await authService.saveLocalRegistry(filtered);
      } catch { }

      // Persist application snapshot locally for offline recovery
      await AsyncStorage.setItem(
        `${VENDOR_APP_PREFIX}${vendorId}`,
        JSON.stringify({
          ...formData,
          vendorId,
          applicationNumber: canonicalAppNo,
          submittedAt: new Date().toISOString(),
          status: 'PENDING',
        })
      );

      // Audit log with full fleet strength, vehicle configuration, and fleet documents details
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: vendorId,
            user_type: 'VENDOR_MOBILE',
            event_type: 'VENDOR_REGISTRATION_SUBMITTED',
            details: {
              appNo: canonicalAppNo,
              transporter: formData.transporterName,
              fleet: formData.fleetStrength,
              totalFleetCount: formData.totalFleetCount,
              fleetStrength: formData.fleetStrength,
              operatingHubs: formData.operatingHubs || [],
              manualOperatingLocations: formData.manualOperatingLocations || [],
              vehicleConfigs: formData.vehicleConfigs,
              configs: formData.vehicleConfigs,
              fleetDocuments: formData.fleetDocuments,
            },
          },
        ]);
      } catch { }

      await this.clearDraftForm();
      return { success: true, vendorId, applicationNumber: canonicalAppNo };
    } catch (err: any) {
      console.error('submitVendorRegistration error:', err);
      // DO NOT fake success if database write failed!
      throw new Error(err.message || 'Database registration persistence failed. Please verify your connection and try again.');
    }
  },

  // ─── 3. Check Live Verification Status ─────────────────────────────────────
  async getVendorVerificationStatus(vendorId?: string, mobile?: string): Promise<{
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
    complianceStatus?: 'PENDING' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED';
    vendorName?: string;
    vendorCode?: string;
    rejectionReason?: string;
    correctionNotes?: string;
    vendorId?: string;
    approvedAt?: string;
  }> {
    try {
      const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);

      // 1. Try Backend API first for authoritative compliance status (bypasses mobile RLS)
      try {
        const lookupKey = cleanPhone || vendorId;
        if (lookupKey) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1800);
          const apiRes = await fetch(`${getBackendApiUrl()}/vendor/status/${lookupKey}`, {
            signal: controller.signal,
          }).finally(() => clearTimeout(timer));

          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData && apiData.success) {
              const resStatus = apiData.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
              // Update local cache to keep offline & session in sync
              const cKey = apiData.vendorId || vendorId || cleanPhone;
              if (cKey) {
                const existingRaw = await AsyncStorage.getItem(`${VENDOR_APP_PREFIX}${cKey}`);
                const existing = existingRaw ? JSON.parse(existingRaw) : {};
                await AsyncStorage.setItem(
                  `${VENDOR_APP_PREFIX}${cKey}`,
                  JSON.stringify({
                    ...existing,
                    status: resStatus,
                    vendorName: apiData.vendorName || existing.vendorName,
                    transporterName: apiData.vendorName || existing.transporterName,
                    vendorId: apiData.vendorId || existing.vendorId,
                  })
                );
              }

              return {
                status: resStatus,
                complianceStatus: apiData.complianceStatus || (resStatus === 'APPROVED' ? 'APPROVED' : 'UNDER_REVIEW'),
                vendorName: apiData.vendorName,
                vendorCode: apiData.vendorCode,
                vendorId: apiData.vendorId,
                approvedAt: apiData.approvedAt,
                rejectionReason: apiData.rejectionReason,
                correctionNotes: apiData.correctionNotes,
              };
            }
          }
        }
      } catch (apiErr: any) {
        // Fall through to direct Supabase query
      }

      // 2. Direct Supabase Query with active mobile session (handles RLS)
      await ensureMobileSession();

      let resolvedId = (vendorId && vendorId.includes('-') && !vendorId.startsWith('NECL-') && !vendorId.startsWith('VND-')) ? vendorId : undefined;

      // If vendorId is a vendor_code, lookup UUID by vendor_code
      if (!resolvedId && vendorId && (vendorId.startsWith('NECL-') || vendorId.startsWith('VND-'))) {
        const { data: cByCode } = await supabase
          .from('vendor_companies')
          .select('id')
          .eq('vendor_code', vendorId)
          .maybeSingle();
        if (cByCode?.id) resolvedId = cByCode.id;
      }

      if (!resolvedId && cleanPhone) {
        const { data: uRec } = await supabase
          .from('vendor_users')
          .select('vendor_id')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();
        if (uRec?.vendor_id) resolvedId = uRec.vendor_id;
        else {
          const { data: cRec } = await supabase
            .from('vendor_companies')
            .select('id')
            .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
            .maybeSingle();
          if (cRec?.id) resolvedId = cRec.id;
        }
      }

      if (resolvedId && resolvedId.includes('-')) {
        const { data: vComp, error: vErr } = await supabase
          .from('vendor_companies')
          .select('id, status, compliance_status, vendor_name, vendor_code, rejection_reason, correction_notes, approved_at, approved_by')
          .eq('id', resolvedId)
          .maybeSingle();

        // Also check if any compliance documents have been rejected or replacement requested
        const { data: docData } = await supabase
          .from('documents')
          .select('verification_status, rejection_reason')
          .eq('reference_id', resolvedId);

        const hasRejectedDoc = docData?.some(
          (d) => d.verification_status === 'REJECTED' || d.verification_status === 'REPLACEMENT_REQUESTED'
        );
        const rejectedDoc = docData?.find(
          (d) => (d.verification_status === 'REJECTED' || d.verification_status === 'REPLACEMENT_REQUESTED') && d.rejection_reason
        );

        if (!vErr && vComp) {
          const displayCode = vComp.vendor_code || formatDisplayId('VD', vComp.id);

          if (vComp.status === 'APPROVED') {
            // Synchronize local cache with approved state
            await AsyncStorage.setItem(
              `${VENDOR_APP_PREFIX}${resolvedId}`,
              JSON.stringify({
                status: 'APPROVED',
                vendorName: vComp.vendor_name,
                transporterName: vComp.vendor_name,
                vendorId: vComp.id,
              })
            );

            return {
              status: 'APPROVED',
              complianceStatus: 'APPROVED',
              vendorName: vComp.vendor_name,
              vendorCode: displayCode,
              vendorId: vComp.id,
              approvedAt: vComp.approved_at,
            };
          }
          if (vComp.status === 'REJECTED' || vComp.status === 'ACTION_REQUIRED' || hasRejectedDoc || vComp.compliance_status === 'ACTION_REQUIRED') {
            return {
              status: 'REJECTED',
              complianceStatus: 'ACTION_REQUIRED',
              vendorName: vComp.vendor_name,
              vendorCode: displayCode,
              rejectionReason: rejectedDoc?.rejection_reason || vComp.rejection_reason || vComp.correction_notes || 'Compliance document clarification required.',
              correctionNotes: vComp.correction_notes || rejectedDoc?.rejection_reason,
              vendorId: vComp.id,
            };
          }
          if (vComp.status === 'INACTIVE') {
            return {
              status: 'INACTIVE',
              complianceStatus: 'PENDING',
              vendorName: vComp.vendor_name,
              vendorCode: displayCode,
              vendorId: vComp.id,
            };
          }
          return {
            status: 'PENDING',
            complianceStatus: (vComp.compliance_status as any) || 'UNDER_REVIEW',
            vendorName: vComp.vendor_name,
            vendorCode: displayCode,
            vendorId: vComp.id,
          };
        }
      }

      // Check local cache
      const cacheKey = resolvedId || vendorId;
      if (cacheKey) {
        const cached = await AsyncStorage.getItem(`${VENDOR_APP_PREFIX}${cacheKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            status: parsed.status || 'PENDING',
            complianceStatus: 'UNDER_REVIEW',
            vendorName: parsed.transporterName,
            vendorCode: parsed.applicationNumber || formatDisplayId('VD', cacheKey),
            rejectionReason: parsed.rejectionReason,
            vendorId: parsed.vendorId,
          };
        }
      }

      return { status: 'PENDING', complianceStatus: 'UNDER_REVIEW' };
    } catch {
      return { status: 'PENDING', complianceStatus: 'UNDER_REVIEW' };
    }
  },

  // ─── 4. Documents & Corrections ───────────────────────────────────────────
  async getVendorDocuments(vendorId: string): Promise<VendorDocumentItem[]> {
    try {
      // 1. Check database documents
      if (vendorId && vendorId.includes('-')) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', vendorId);

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            docType: d.document_type || 'OTHER',
            title: d.document_type?.replace(/_/g, ' ') || 'Compliance Document',
            fileName: d.file_name || d.file_url?.split('/').pop() || `${d.document_type || 'document'}.pdf`,
            fileUrl: d.file_url,
            status: (d.verification_status || 'PENDING') as any,
            rejectionReason: d.rejection_reason || undefined,
            uploadedAt: d.created_at,
          }));
        }
      }

      // 2. Check local application cache
      const cached = await AsyncStorage.getItem(`${VENDOR_APP_PREFIX}${vendorId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.documents && parsed.documents.length > 0) {
          return parsed.documents;
        }
      }

      return [];
    } catch {
      return [];
    }
  },

  async resubmitCorrectedDocument(
    vendorId: string,
    docId: string,
    fileName: string,
    fileUrl: string
  ): Promise<boolean> {
    try {
      if (docId && docId.includes('-') && docId.length > 10) {
        await supabase
          .from('documents')
          .update({
            verification_status: 'PENDING',
            rejection_reason: null,
            file_url: fileUrl,
          })
          .eq('id', docId);
      }

      // Reset compliance_status and status to review when vendor re-uploads corrected documents
      if (vendorId) {
        try {
          await supabase
            .from('vendor_companies')
            .update({
              compliance_status: 'UNDER_REVIEW',
              status: 'PENDING_APPROVAL',
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorId);
        } catch (dbErr) {
          console.warn('vendor_companies compliance reset notice:', dbErr);
        }
      }

      // Update local cache
      const cached = await AsyncStorage.getItem(`${VENDOR_APP_PREFIX}${vendorId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const docs = parsed.documents || [];
        const updated = docs.map((d: any) =>
          d.id === docId
            ? { ...d, fileName, fileUrl, status: 'PENDING', rejectionReason: undefined }
            : d
        );
        parsed.documents = updated;
        parsed.complianceStatus = 'UNDER_REVIEW';
        parsed.status = 'PENDING_APPROVAL';
        await AsyncStorage.setItem(`${VENDOR_APP_PREFIX}${vendorId}`, JSON.stringify(parsed));
      }

      return true;
    } catch {
      return true;
    }
  },

  // ─── 5. Available Transport Requirements (RFQs) ───────────────────────────
  async getAvailableRequirements(vendorId?: string): Promise<any[]> {
    try {
      if (vendorId && vendorId.includes('-')) {
        // Query vendor_requests addressed specifically to this vendor (Vendor Isolation)
        const { data: vrList, error: vrErr } = await supabase
          .from('vendor_requests')
          .select(`
            id,
            requirement_id,
            status,
            deadline_at,
            created_at,
            requirements (
              id,
              pickup_address,
              pickup_pincode,
              destination_address,
              destination_pincode,
              vehicle_type,
              material_type,
              required_capacity_mt,
              loading_datetime,
              special_instructions,
              status,
              created_at,
              client_companies (
                company_name
              )
            )
          `)
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!vrErr && vrList && vrList.length > 0) {
          return vrList
            .filter((vr: any) => vr.requirements && vr.status !== 'DECLINED')
            .map((vr: any) => {
              const r = vr.requirements;
              const isDeadlinePassed = Boolean(vr.deadline_at && new Date(vr.deadline_at).getTime() < Date.now());
              return {
                id: r.id,
                vendorRequestId: vr.id,
                pickupAddress: r.pickup_address,
                pickupPincode: r.pickup_pincode,
                destinationAddress: r.destination_address,
                destinationPincode: r.destination_pincode,
                vehicleType: r.vehicle_type,
                materialType: r.material_type,
                requiredCapacityMt: r.required_capacity_mt,
                loadingDatetime: r.loading_datetime,
                specialInstructions: r.special_instructions,
                status: r.status,
                rfqStatus: isDeadlinePassed && vr.status === 'PENDING' ? 'EXPIRED' : vr.status,
                deadlineAt: vr.deadline_at,
                isExpired: isDeadlinePassed,
                clientName: r.client_companies?.company_name || 'Verified Industrial Shipper',
                hasQuoted: vr.status === 'QUOTED',
                createdAt: r.created_at,
              };
            });
        }
      }

      // Fallback for general bidding when vendorId is not provided
      const { data, error } = await supabase
        .from('requirements')
        .select('*, client_companies(company_name)')
        .in('status', ['UNDER_REVIEW', 'ASSIGNED', 'RFQ_SENT', 'SOURCING'])
        .order('created_at', { ascending: false })
        .limit(25);

      if (!error && data && data.length > 0) {
        return data.map((r) => ({
          id: r.id,
          pickupAddress: r.pickup_address,
          pickupPincode: r.pickup_pincode,
          destinationAddress: r.destination_address,
          destinationPincode: r.destination_pincode,
          vehicleType: r.vehicle_type,
          materialType: r.material_type,
          requiredCapacityMt: r.required_capacity_mt,
          loadingDatetime: r.loading_datetime,
          specialInstructions: r.special_instructions,
          status: r.status,
          clientName: r.client_companies?.company_name || 'Verified Industrial Shipper',
          hasQuoted: false,
          createdAt: r.created_at,
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  async getRequirementDetails(requirementId: string, vendorId?: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*, client_companies(company_name, city)')
        .eq('id', requirementId)
        .maybeSingle();

      if (!error && data) {
        let vendorStatus: string | null = null;
        let quotedRate: number | null = null;
        let vendorRequestId: string | null = null;
        let deadlineAt: string | null = null;
        let isExpired = false;

        if (vendorId && vendorId.includes('-')) {
          const { data: vr } = await supabase
            .from('vendor_requests')
            .select('id, status, deadline_at, vendor_quotations(quoted_rate)')
            .eq('requirement_id', requirementId)
            .eq('vendor_id', vendorId)
            .maybeSingle();

          if (vr) {
            vendorRequestId = vr.id;
            vendorStatus = vr.status;
            deadlineAt = vr.deadline_at;
            if (deadlineAt && new Date(deadlineAt).getTime() < Date.now()) {
              isExpired = true;
              if (vendorStatus === 'PENDING') vendorStatus = 'EXPIRED';
            }
            const quotes = (vr as any).vendor_quotations;
            if (Array.isArray(quotes) && quotes.length > 0) {
              quotedRate = quotes[0].quoted_rate;
            }
          }
        }

        return {
          id: data.id,
          vendorRequestId,
          pickupAddress: data.pickup_address,
          pickupPincode: data.pickup_pincode,
          destinationAddress: data.destination_address,
          destinationPincode: data.destination_pincode,
          vehicleType: data.vehicle_type,
          materialType: data.material_type,
          requiredCapacityMt: data.required_capacity_mt,
          loadingDatetime: data.loading_datetime,
          specialInstructions: data.special_instructions,
          status: data.status,
          deadlineAt,
          isExpired,
          clientName: data.client_companies?.company_name || 'Industrial Enterprise',
          clientCity: data.client_companies?.city || 'India',
          createdAt: data.created_at,
          vendorStatus,
          quotedRate,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async declineRequirement(
    vendorId: string,
    requirementId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await ensureMobileSession();

      // 1. Check if vendor_request already exists
      const { data: existingVR } = await supabase
        .from('vendor_requests')
        .select('id')
        .eq('requirement_id', requirementId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (existingVR?.id) {
        let { error } = await supabase
          .from('vendor_requests')
          .update({
            status: 'DECLINED',
            decline_reason: reason || 'Declined due to operational constraints',
            declined_at: new Date().toISOString(),
          })
          .eq('id', existingVR.id);

        if (error && (error.message?.includes('decline_reason') || error.code === 'PGRST204')) {
          const fb = await supabase
            .from('vendor_requests')
            .update({ status: 'DECLINED' })
            .eq('id', existingVR.id);
          error = fb.error;
        }

        if (error) {
          console.warn('vendor_requests decline update error:', error.message);
          return { success: false, error: error.message };
        }
      } else {
        let { error: insErr } = await supabase
          .from('vendor_requests')
          .insert([
            {
              requirement_id: requirementId,
              vendor_id: vendorId,
              deadline_at: new Date(Date.now() + 86400000).toISOString(),
              status: 'DECLINED',
              decline_reason: reason || 'Declined due to operational constraints',
              declined_at: new Date().toISOString(),
            },
          ]);

        if (insErr && (insErr.message?.includes('decline_reason') || insErr.code === 'PGRST204')) {
          const fb = await supabase
            .from('vendor_requests')
            .insert([
              {
                requirement_id: requirementId,
                vendor_id: vendorId,
                deadline_at: new Date(Date.now() + 86400000).toISOString(),
                status: 'DECLINED',
              },
            ]);
          insErr = fb.error;
        }

        if (insErr) {
          console.warn('vendor_requests decline insert error:', insErr.message);
          return { success: false, error: insErr.message };
        }
      }

      // 2. Persist decline reason to audit log
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: vendorId,
            user_type: 'VENDOR_MOBILE',
            event_type: 'VENDOR_RFQ_DECLINED',
            details: {
              requirementId,
              declineReason: reason || 'Declined due to operational constraints',
              timestamp: new Date().toISOString(),
            },
          },
        ]);
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error('declineRequirement exception:', err);
      return { success: false, error: err.message || 'Failed to decline requirement' };
    }
  },

  // ─── 6. Quotation Submission & Tracking ────────────────────────────────────
  async submitQuotation(input: {
    vendorId: string;
    requirementId: string;
    vehicleId?: string;
    driverId?: string;
    quotedRate: number;
    transitDays?: number;
    remarks?: string;
  }): Promise<{ success: boolean; quotationId: string; error?: string }> {
    try {
      // 0. Enforce authorization: Vendor account must be approved before submitting bids
      if (input.vendorId && input.vendorId.includes('-')) {
        const { data: vComp } = await supabase
          .from('vendor_companies')
          .select('status')
          .eq('id', input.vendorId)
          .maybeSingle();

        if (vComp && vComp.status !== 'APPROVED') {
          return {
            success: false,
            quotationId: '',
            error: 'Your transporter account is under compliance review. Quotation submission is enabled once approved by admin.',
          };
        }
      }

      // Check vehicle verification if vehicleId provided
      if (input.vehicleId && input.vehicleId.includes('-')) {
        const { data: veh } = await supabase
          .from('vehicles')
          .select('id, registration_number, verification_status, eligible_for_operations')
          .eq('id', input.vehicleId)
          .maybeSingle();

        if (veh && (veh.verification_status !== 'APPROVED' || !veh.eligible_for_operations)) {
          return {
            success: false,
            quotationId: '',
            error: `Selected vehicle ${veh.registration_number} is pending compliance approval. Only verified vehicles can be bid.`,
          };
        }
      }

      // Check driver verification if driverId provided
      if (input.driverId && input.driverId.includes('-')) {
        const { data: drv } = await supabase
          .from('drivers')
          .select('id, full_name, verification_status, is_active, licence_expiry_date')
          .eq('id', input.driverId)
          .maybeSingle();

        if (drv && (drv.verification_status !== 'APPROVED' || !drv.is_active)) {
          return {
            success: false,
            quotationId: '',
            error: `Selected driver ${drv.full_name} is pending verification or inactive. Only approved drivers can be assigned to quotes.`,
          };
        }

        if (drv?.licence_expiry_date && new Date(drv.licence_expiry_date) < new Date()) {
          return {
            success: false,
            quotationId: '',
            error: `Compliance Alert: Driver ${drv.full_name}'s licence expired on ${drv.licence_expiry_date}. Assignment blocked.`,
          };
        }
      }

      // 1. Find or create vendor_request & validate deadline
      let vrId = '';
      const { data: existingVR } = await supabase
        .from('vendor_requests')
        .select('id, deadline_at, status')
        .eq('requirement_id', input.requirementId)
        .eq('vendor_id', input.vendorId)
        .maybeSingle();

      if (existingVR) {
        if (existingVR.status === 'DECLINED') {
          return {
            success: false,
            quotationId: '',
            error: 'This RFQ participation was previously declined. Cannot submit quotation.',
          };
        }

        if (existingVR.deadline_at && new Date(existingVR.deadline_at).getTime() < Date.now()) {
          return {
            success: false,
            quotationId: '',
            error: `The bidding window for this RFQ closed on ${new Date(existingVR.deadline_at).toLocaleString('en-IN')}. New quotations cannot be submitted.`,
          };
        }

        vrId = existingVR.id;
        await supabase
          .from('vendor_requests')
          .update({ status: 'QUOTED' })
          .eq('id', vrId);
      } else {
        const { data: newVR, error: vrErr } = await supabase
          .from('vendor_requests')
          .insert([
            {
              requirement_id: input.requirementId,
              vendor_id: input.vendorId,
              deadline_at: new Date(Date.now() + 86400000).toISOString(),
              status: 'QUOTED',
            },
          ])
          .select('id')
          .single();

        if (vrErr) console.warn('vendor_requests insert notice:', vrErr.message);
        vrId = newVR?.id || `vr-${Date.now()}`;
      }

      // 2. Check for existing quotation to avoid conflicts
      const { data: existingQuote } = await supabase
        .from('vendor_quotations')
        .select('id, version, is_locked')
        .eq('vendor_request_id', vrId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingQuote?.is_locked) {
        return { success: false, quotationId: existingQuote.id, error: 'Quotation is locked and under client review.' };
      }

      const nextVersion = existingQuote ? (existingQuote.version || 1) + 1 : 1;

      // 3. Insert new quotation revision
      const { data: vqData, error: vqErr } = await supabase
        .from('vendor_quotations')
        .insert([
          {
            vendor_request_id: vrId,
            vehicle_id: input.vehicleId || null,
            driver_id: input.driverId || null,
            quoted_rate: input.quotedRate,
            version: nextVersion,
            is_locked: false,
            submitted_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (vqErr) {
        console.error('vendor_quotations insert error:', vqErr.message);
        return { success: false, quotationId: '', error: vqErr.message || 'Failed to submit quotation' };
      }

      const generatedId = vqData?.id || `VQ-${Date.now().toString().slice(-6)}`;
      return { success: true, quotationId: generatedId };
    } catch (err: any) {
      console.error('submitQuotation exception:', err);
      return { success: false, quotationId: '', error: err.message || 'Quotation submission failed' };
    }
  },

  async getMyQuotations(vendorId: string): Promise<any[]> {
    try {
      if (!vendorId) return [];

      const { data: vrList, error } = await supabase
        .from('vendor_requests')
        .select('*, requirements(*), vendor_quotations(*)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (!error && vrList && vrList.length > 0) {
        const quotes: any[] = [];
        vrList.forEach((vr) => {
          const vqItems = vr.vendor_quotations || [];
          if (vqItems.length > 0) {
            vqItems.forEach((vq: any) => {
              quotes.push({
                id: vq.id,
                requirementId: vr.requirement_id,
                route: `${vr.requirements?.pickup_address?.split(',')[0] || 'Origin'} → ${vr.requirements?.destination_address?.split(',')[0] || 'Destination'}`,
                fullPickup: vr.requirements?.pickup_address,
                fullDestination: vr.requirements?.destination_address,
                material: vr.requirements?.material_type,
                capacityMt: vr.requirements?.required_capacity_mt,
                quotedRate: vq.quoted_rate,
                submittedAt: vq.submitted_at || vr.created_at,
                status: vr.requirements?.status === 'BOOKED' ? 'AWARDED' : vr.status,
                vehicleType: vr.requirements?.vehicle_type,
              });
            });
          }
        });
        return quotes;
      }

      // Strictly return empty array for this vendor; never leak other vendors' quotations
      return [];
    } catch {
      return [];
    }
  },

  // ─── 7. Awarded Bookings & Booking Operations ─────────────────────────────
  async getAwardedBookings(vendorId?: string): Promise<any[]> {
    try {
      if (!vendorId) return [];

      // 1. Query trips assigned to this authenticated vendor
      const { data: vendorTrips, error: tripErr } = await supabase
        .from('trips')
        .select('*, bookings(*, requirements(*)), vehicles(*), drivers(*)')
        .eq('vendor_id', vendorId)
        .order('started_at', { ascending: false });

      if (!tripErr && vendorTrips && vendorTrips.length > 0) {
        return vendorTrips.map((t) => {
          const b = t.bookings;
          const req = b?.requirements;
          return {
            id: b?.id || t.booking_id || t.id,
            requirementId: b?.requirement_id || req?.id,
            origin: req?.pickup_address?.split(',')[0] || 'Origin',
            destination: req?.destination_address?.split(',')[0] || 'Destination',
            pickupAddress: req?.pickup_address,
            destinationAddress: req?.destination_address,
            materialType: req?.material_type || 'General Cargo',
            capacityMt: Number(req?.required_capacity_mt) || 0,
            vehicleType: req?.vehicle_type || t.vehicles?.vehicle_type || 'Commercial Vehicle',
            bookingStatus: b?.booking_status || 'CONFIRMED',
            paymentStatus: b?.payment_status || 'NOT_DUE',
            rate: Number(t.vendor_rate) || 0,
            hasAssignedFleet: !!(t.vehicle_id && t.driver_id),
            tripId: t.id,
            tripStatus: t.trip_status || 'LORRY_ASSIGNED',
            confirmedAt: b?.confirmed_at || t.started_at,
          };
        });
      }

      // 2. Also check if any vendor_requests are awarded to this vendor
      const { data: awardedVRs } = await supabase
        .from('vendor_requests')
        .select('requirement_id, requirements(*, bookings(*, trips(*)))')
        .eq('vendor_id', vendorId)
        .eq('status', 'AWARDED');

      if (awardedVRs && awardedVRs.length > 0) {
        const bookingsList: any[] = [];
        awardedVRs.forEach((vr: any) => {
          const req = vr.requirements;
          const b = Array.isArray(req?.bookings) ? req.bookings[0] : req?.bookings;
          if (b) {
            const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
            bookingsList.push({
              id: b.id,
              requirementId: req?.id,
              origin: req?.pickup_address?.split(',')[0] || 'Origin',
              destination: req?.destination_address?.split(',')[0] || 'Destination',
              pickupAddress: req?.pickup_address,
              destinationAddress: req?.destination_address,
              materialType: req?.material_type || 'General Cargo',
              capacityMt: Number(req?.required_capacity_mt) || 0,
              vehicleType: req?.vehicle_type || 'Commercial Vehicle',
              bookingStatus: b.booking_status,
              paymentStatus: b.payment_status,
              rate: Number(trip?.vendor_rate) || 0,
              hasAssignedFleet: !!(trip && trip.vehicle_id && trip.driver_id),
              tripId: trip?.id,
              tripStatus: trip?.trip_status || 'PENDING_ASSIGNMENT',
              confirmedAt: b.confirmed_at,
            });
          }
        });
        return bookingsList;
      }

      return [];
    } catch {
      return [];
    }
  },

  async getBookingDetails(bookingId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, requirements(*, client_companies(*)), trips(*, vehicles(*), drivers(*))')
        .eq('id', bookingId)
        .maybeSingle();

      if (!error && data) {
        const trip = data.trips && data.trips.length > 0 ? data.trips[0] : null;
        return {
          id: data.id,
          requirementId: data.requirement_id,
          pickupAddress: data.requirements?.pickup_address,
          pickupPincode: data.requirements?.pickup_pincode,
          destinationAddress: data.requirements?.destination_address,
          destinationPincode: data.requirements?.destination_pincode,
          vehicleType: data.requirements?.vehicle_type,
          materialType: data.requirements?.material_type,
          capacityMt: Number(data.requirements?.required_capacity_mt) || 0,
          loadingDatetime: data.requirements?.loading_datetime,
          specialInstructions: data.requirements?.special_instructions,
          bookingStatus: data.booking_status,
          paymentStatus: data.payment_status,
          clientName: data.requirements?.client_companies?.company_name || 'Commercial Shipper',
          confirmedAt: data.confirmed_at,
          trip: trip
            ? {
              id: trip.id,
              vehicleNumber: trip.vehicles?.registration_number || null,
              vehicleType: trip.vehicles?.vehicle_type || null,
              driverName: trip.drivers?.full_name || null,
              driverPhone: trip.drivers?.mobile || null,
              tripStatus: trip.trip_status,
              vendorRate: Number(trip.vendor_rate) || 0,
              startedAt: trip.started_at,
              completedAt: trip.completed_at,
            }
            : null,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  // ─── 8. Fleet & Vehicles ──────────────────────────────────────────────────
  async getVendorVehicles(vendorId: string): Promise<any[]> {
    try {
      if (vendorId) {
        const { data: links, error: lErr } = await supabase
          .from('vendor_vehicle_links')
          .select('*, vehicles(*)')
          .eq('vendor_id', vendorId);

        if (!lErr && links && links.length > 0) {
          return links.map((l) => ({
            id: l.vehicles?.id || l.vehicle_id,
            registrationNumber: l.vehicles?.registration_number || 'Unregistered',
            vehicleType: l.vehicles?.vehicle_type || 'Commercial Vehicle',
            category: l.vehicles?.vehicle_type || 'Lorry',
            bodyType: l.vehicles?.body_type || 'Open Body',
            ratedCapacityMt: Number(l.vehicles?.rated_capacity_mt) || 0,
            minimumCapacityMt: Number(l.vehicles?.minimum_capacity_mt) || 0,
            rcNumber: l.vehicles?.rc_number || '',
            status: l.vehicles?.status || 'ACTIVE',
            verificationStatus: l.vehicles?.verification_status || 'PENDING_DOCS',
            rcVerificationStatus: l.vehicles?.rc_verification_status || 'PENDING',
            insuranceVerificationStatus: l.vehicles?.insurance_verification_status || 'PENDING',
            fitnessVerificationStatus: l.vehicles?.fitness_verification_status || 'PENDING',
            permitVerificationStatus: l.vehicles?.permit_verification_status || 'PENDING',
            isAvailable: true,
          }));
        }
      }

      return [];
    } catch {
      return [];
    }
  },

  async addVendorVehicle(
    vendorId: string,
    vehicleData: {
      registrationNumber: string;
      category?: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier' | string;
      bodyType?: 'Open Body' | 'Closed Body' | string;
      vehicleType?: string;
      capacityMt?: number;
      ratedCapacityMt?: number;
      minimumCapacityMt?: number;
      ownership?: 'Owned' | 'Attached' | string;
      rcNumber?: string;
      documents?: Array<{
        docType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT';
        fileName: string;
        fileSize?: string;
        mimeType?: string;
        uri?: string;
        blob?: any;
      }>;
    }
  ): Promise<{ success: boolean; vehicleId?: string }> {
    try {
      const regNum = vehicleData.registrationNumber.trim().toUpperCase();
      const category = vehicleData.category || vehicleData.vehicleType || 'Lorry';
      const bodyType = vehicleData.bodyType || 'Open Body';
      const ratedCap = Number(vehicleData.ratedCapacityMt || vehicleData.capacityMt) || 20;
      const minCap = Number(vehicleData.minimumCapacityMt) || Math.max(1, Math.round(ratedCap * 0.5));
      const rcNum = (vehicleData.rcNumber || regNum).trim().toUpperCase();

      const { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .upsert([
          {
            registration_number: regNum,
            vehicle_type: category,
            body_type: bodyType,
            rated_capacity_mt: ratedCap,
            minimum_capacity_mt: minCap,
            rc_number: rcNum,
            status: 'ACTIVE',
            verification_status: 'PENDING_DOCS',
            rc_verification_status: 'PENDING',
            insurance_verification_status: 'PENDING',
            fitness_verification_status: 'PENDING',
            permit_verification_status: 'PENDING',
          },
        ], { onConflict: 'registration_number' })
        .select('id')
        .maybeSingle();

      if (vErr) console.warn('Vehicle insertion notice:', vErr.message);

      const vehicleId = newV?.id || `veh-${Date.now()}`;

      // Associate vehicle with the authenticated vendor
      if (vendorId) {
        await supabase
          .from('vendor_vehicle_links')
          .upsert([
            {
              vendor_id: vendorId,
              vehicle_id: vehicleId,
              status: 'PENDING',
            },
          ], { onConflict: 'vendor_id,vehicle_id' });
      }

      // Upload and attach vehicle documents if provided
      if (vehicleData.documents && vehicleData.documents.length > 0) {
        for (const doc of vehicleData.documents) {
          try {
            const uploadRes = await this.uploadVendorDocument({
              uri: doc.uri,
              blob: doc.blob,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              docType: `VEHICLE_${doc.docType}`,
              referenceKey: `veh_${regNum.replace(/[^a-zA-Z0-9]/g, '')}`,
            });

            await supabase.from('documents').insert([
              {
                category: 'VEHICLE',
                document_type: doc.docType,
                reference_id: vehicleId,
                file_url: uploadRes.fileUrl || uploadRes.storagePath,
                file_name: doc.fileName,
                file_size: doc.fileSize || null,
                mime_type: doc.mimeType || 'image/jpeg',
                verification_status: 'PENDING',
                uploaded_by: vendorId || 'VENDOR',
              },
            ]);
          } catch (dErr) {
            console.warn(`Vehicle doc upload notice (${doc.docType}):`, dErr);
          }
        }
      }

      return { success: true, vehicleId };
    } catch {
      return { success: true };
    }
  },


  // ─── 9. Driver Management ─────────────────────────────────────────────────
  async getVendorDrivers(vendorId: string): Promise<any[]> {
    try {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('primary_vendor_id', vendorId);

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          fullName: d.full_name,
          mobile: d.mobile,
          licenceNumber: d.licence_number,
          licenceExpiryDate: d.licence_expiry_date,
          status: d.status,
          isAvailable: true,
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  async addVendorDriver(
    vendorId: string,
    driverData: {
      fullName: string;
      mobile: string;
      licenceNumber: string;
      licenceExpiryDate: string;
    }
  ): Promise<{ success: boolean; driverId?: string }> {
    try {
      const cleanPhone = driverData.mobile.replace(/[^0-9]/g, '').slice(-10);
      const { data: newD, error } = await supabase
        .from('drivers')
        .insert([
          {
            primary_vendor_id: vendorId && vendorId.includes('-') ? vendorId : null,
            full_name: driverData.fullName.trim(),
            mobile: cleanPhone,
            licence_number: driverData.licenceNumber.trim().toUpperCase(),
            licence_expiry_date: driverData.licenceExpiryDate || '2028-12-31',
            status: 'APPROVED',
          },
        ])
        .select('id')
        .single();

      if (error) console.warn('Driver insertion notice:', error.message);

      return { success: true, driverId: newD?.id };
    } catch {
      return { success: true };
    }
  },

  // ─── 10. Vehicle & Driver Assignment to Booking ───────────────────────────
  async assignVehicleAndDriver(input: {
    bookingId: string;
    vendorId: string;
    vehicleId: string;
    driverId: string;
    rate?: number;
  }): Promise<{ success: boolean; tripId: string; error?: string }> {
    try {
      // 0. Enforce authorization: Transporter account must be approved to assign fleet
      if (input.vendorId && input.vendorId.includes('-')) {
        const { data: vComp } = await supabase
          .from('vendor_companies')
          .select('status')
          .eq('id', input.vendorId)
          .maybeSingle();

        if (vComp && vComp.status !== 'APPROVED') {
          return { success: false, tripId: '', error: 'Transporter account must be verified by admin before assigning vehicles and drivers.' };
        }
      }

      // 1. Validate Driver and Vehicle are not already on active transit
      if (input.driverId && input.driverId.includes('-')) {
        const { data: busyDriver } = await supabase
          .from('trips')
          .select('id, booking_id, trip_status')
          .eq('driver_id', input.driverId)
          .in('trip_status', ['LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING'])
          .maybeSingle();

        if (busyDriver && (!input.bookingId || busyDriver.booking_id !== input.bookingId)) {
          return { success: false, tripId: '', error: 'Selected driver is currently allocated to an active trip.' };
        }
      }

      if (input.vehicleId && input.vehicleId.includes('-')) {
        const { data: busyVehicle } = await supabase
          .from('trips')
          .select('id, booking_id, trip_status')
          .eq('vehicle_id', input.vehicleId)
          .in('trip_status', ['LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING'])
          .maybeSingle();

        if (busyVehicle && (!input.bookingId || busyVehicle.booking_id !== input.bookingId)) {
          return { success: false, tripId: '', error: 'Selected vehicle is currently allocated to an active trip.' };
        }
      }

      // 2. Check if a trip already exists for this booking
      const { data: existingTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('booking_id', input.bookingId)
        .maybeSingle();

      let targetTripId = '';

      if (existingTrip) {
        await supabase
          .from('trips')
          .update({
            vehicle_id: input.vehicleId,
            driver_id: input.driverId,
            vendor_id: input.vendorId,
            trip_status: 'LORRY_ASSIGNED',
          })
          .eq('id', existingTrip.id);

        targetTripId = existingTrip.id;
      } else {
        // Create new trip
        const { data: newTrip, error: tripErr } = await supabase
          .from('trips')
          .insert([
            {
              booking_id: input.bookingId,
              vehicle_id: input.vehicleId,
              driver_id: input.driverId,
              vendor_id: input.vendorId,
              vendor_rate: input.rate || 0,
              trip_status: 'LORRY_ASSIGNED',
              started_at: new Date().toISOString(),
            },
          ])
          .select('id')
          .single();

        if (tripErr) console.warn('Trip insert notice:', tripErr.message);
        targetTripId = newTrip?.id || `trip-${Date.now()}`;
      }

      // 3. Mark booking as confirmed
      if (input.bookingId && input.bookingId.includes('-')) {
        await supabase
          .from('bookings')
          .update({ booking_status: 'CONFIRMED' })
          .eq('id', input.bookingId);
      }

      return { success: true, tripId: targetTripId };
    } catch (err: any) {
      console.error('assignVehicleAndDriver exception:', err);
      return { success: false, tripId: '', error: err.message || 'Assignment failed' };
    }
  },

  // ─── 11. Trip Management & Lifecycle ──────────────────────────────────────
  async getVendorTrips(vendorId?: string): Promise<any[]> {
    try {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from('trips')
        .select('*, bookings(*, requirements(*)), vehicles(*), drivers(*)')
        .eq('vendor_id', vendorId)
        .order('started_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((t) => ({
          id: t.id,
          bookingId: t.booking_id,
          origin: t.bookings?.requirements?.pickup_address?.split(',')[0] || 'Origin',
          destination: t.bookings?.requirements?.destination_address?.split(',')[0] || 'Destination',
          pickupAddress: t.bookings?.requirements?.pickup_address,
          destinationAddress: t.bookings?.requirements?.destination_address,
          material: t.bookings?.requirements?.material_type || 'General Cargo',
          tripStatus: t.trip_status,
          vehicleNumber: t.vehicles?.registration_number || 'Unassigned',
          vehicleType: t.vehicles?.vehicle_type || 'Vehicle',
          driverName: t.drivers?.full_name || 'Unassigned',
          driverMobile: t.drivers?.mobile || '',
          rate: Number(t.vendor_rate) || 0,
          startedAt: t.started_at,
          completedAt: t.completed_at,
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  async getTripDetails(tripId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), drivers(*)')
        .eq('id', tripId)
        .maybeSingle();

      if (!error && data) {
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', tripId);

        return {
          id: data.id,
          bookingId: data.booking_id,
          tripStatus: data.trip_status,
          rate: Number(data.vendor_rate) || 0,
          startedAt: data.started_at,
          completedAt: data.completed_at,
          pickupAddress: data.bookings?.requirements?.pickup_address,
          pickupPincode: data.bookings?.requirements?.pickup_pincode,
          destinationAddress: data.bookings?.requirements?.destination_address,
          destinationPincode: data.bookings?.requirements?.destination_pincode,
          cargoDescription: data.bookings?.requirements?.material_type,
          capacityMt: Number(data.bookings?.requirements?.required_capacity_mt) || 0,
          loadingDatetime: data.bookings?.requirements?.loading_datetime,
          clientName: data.bookings?.requirements?.client_companies?.company_name || 'Shipper',
          vehicle: data.vehicles
            ? {
              id: data.vehicles.id,
              registrationNumber: data.vehicles.registration_number,
              vehicleType: data.vehicles.vehicle_type,
            }
            : null,
          driver: data.drivers
            ? {
              id: data.drivers.id,
              fullName: data.drivers.full_name,
              mobile: data.drivers.mobile,
              licenceNumber: data.drivers.licence_number,
            }
            : null,
          documents: (docs || []).map((d) => ({
            id: d.id,
            type: d.document_type,
            fileUrl: d.file_url,
            status: d.verification_status,
            uploadedAt: d.created_at,
          })),
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async updateTripStatus(
    tripId: string,
    bookingId: string,
    nextStatus: 'AT_LOADING' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'DELIVERED' | 'COMPLETED'
  ): Promise<boolean> {
    try {
      const updatePayload: any = { trip_status: nextStatus };
      if (nextStatus === 'COMPLETED') {
        updatePayload.completed_at = new Date().toISOString();
      }

      await supabase.from('trips').update(updatePayload).eq('id', tripId);

      // Synchronize booking status
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

      return true;
    } catch {
      return true;
    }
  },

  // ─── 12. Trip Documents & Proof of Delivery (POD) ─────────────────────────
  async uploadTripDocument(input: {
    tripId: string;
    documentType: 'POD_LR' | 'WEIGHBRIDGE_SLIP' | 'DELIVERY_RECEIPT' | 'WAYBILL';
    fileUrl: string;
    uploadedBy?: string;
  }): Promise<{ success: boolean; documentId?: string }> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert([
          {
            category: 'TRIP',
            document_type: input.documentType,
            reference_id: input.tripId,
            file_url: input.fileUrl,
            verification_status: 'PENDING',
            uploaded_by: input.uploadedBy || '5fa0f865-0388-4779-99ad-03d8979c484a',
          },
        ])
        .select('id')
        .single();

      if (error) console.warn('Trip document insert notice:', error.message);

      return { success: true, documentId: data?.id };
    } catch {
      return { success: true };
    }
  },

  async getTripDocuments(tripId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', tripId);

      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          documentType: d.document_type,
          fileUrl: d.file_url,
          status: d.verification_status,
          rejectionReason: d.rejection_reason,
          createdAt: d.created_at,
          uploadedBy: d.uploaded_by,
          uploadResponsibility: d.upload_responsibility,
          metadata: documentWorkflowService.parseNotes(d.rejection_notes),
        }));
      }

      return [];
    } catch {
      return [];
    }
  },

  // ─── 13. Vendor Upload Weighbill on Behalf of Driver ───────────────────────
  async uploadWeighbillOnBehalfOfDriver(input: {
    bookingId: string;
    tripId: string;
    vendorId: string;
    vendorName?: string;
    driverId: string;
    driverName?: string;
    fileName: string;
    fileUrl: string;
    grossWeightMt?: number;
    tareWeightMt?: number;
    recordedWeightMt?: number;
  }) {
    return documentWorkflowService.vendorUploadOnBehalfOfDriver(input);
  },

  // ─── 14. Get Pending Driver Loading Documents for Vendor Fleet ─────────────
  async getPendingDriverLoadingTrips(vendorId: string): Promise<any[]> {
    try {
      const trips = await this.getVendorTrips(vendorId);
      const pendingList: any[] = [];

      for (const trip of trips) {
        // Query loading weighbill for trip
        const { data: weighDoc } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', trip.id)
          .eq('document_type', 'LOADING_WEIGHBILL')
          .maybeSingle();

        const meta = weighDoc ? documentWorkflowService.parseNotes(weighDoc.rejection_notes) : null;
        const isUploaded = !!weighDoc;
        const isConfirmed = isUploaded && (meta?.driverConfirmed || weighDoc.upload_responsibility === 'DRIVER');

        if (!isConfirmed) {
          pendingList.push({
            ...trip,
            weighDoc: weighDoc ? documentWorkflowService.mapDocumentRow(weighDoc) : null,
            hasVendorUploaded: weighDoc?.upload_responsibility === 'VENDOR_ON_BEHALF_OF_DRIVER',
            driverConfirmationPending: true,
          });
        }
      }

      return pendingList;
    } catch {
      return [];
    }
  },

  // ─── 15. Phase 11: Transporter Payout Slips & TDS Settlement ────────────────
  async generatePayoutSlip(payload: GeneratePayoutPayload): Promise<{
    success: boolean;
    isIdempotent?: boolean;
    payoutId?: string;
    payoutNumber?: string;
    vendorRate?: number;
    tdsSection?: string;
    tdsRatePercent?: number;
    tdsDeductedAmount?: number;
    advancePaidAmount?: number;
    claimDeductionAmount?: number;
    netPayableAmount?: number;
    payoutStatus?: string;
    message?: string;
  }> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/payouts/transporter/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, message: err?.message || 'Payout generation request failed.' };
    }
  },

  async getPayoutSlip(payoutId: string): Promise<TransporterPayout | null> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/payouts/transporter/${encodeURIComponent(payoutId)}`);
      const data = await resp.json();
      return data?.payout || null;
    } catch {
      return null;
    }
  },

  async recordDisbursal(payoutId: string, payload: RecordDisbursalPayload): Promise<{
    success: boolean;
    payoutId?: string;
    payoutNumber?: string;
    payoutStatus?: string;
    amountDisbursed?: number;
    bankReferenceUtr?: string;
    disbursalDate?: string;
    message?: string;
  }> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/payouts/transporter/${encodeURIComponent(payoutId)}/record-disbursal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, message: err?.message || 'Disbursal recording failed.' };
    }
  },
};


