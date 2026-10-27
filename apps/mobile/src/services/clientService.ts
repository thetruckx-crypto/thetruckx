import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, ensureMobileSession } from '../supabase';
import { authService } from './authService';
import { formatDisplayId } from '../utils/idGenerator';
import {
  TransportRequirementDraft,
  ClientInvoice,
  GenerateInvoicePayload,
  PaymentRecord,
  RecordPaymentPayload,
  FinancialReconciliation,
} from '../types';
import { documentWorkflowService } from './documentWorkflowService';
import { uploadDocumentToStorage, getSecureDocumentSignedUrl } from '../utils/mobileStorageHelper';

const SAVED_ADDRESSES_KEY = '@necl_client_saved_addresses';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// In-memory caches for ultra-fast screen navigation and immediate invalidation on mutations
const accountStatusCache = new Map<string, CacheItem<ClientAccountStatusResult>>();
const ACCOUNT_STATUS_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateClientStatusCache(identifier?: string) {
  if (identifier) {
    const raw = identifier.trim().toLowerCase();
    accountStatusCache.delete(raw);
    const cleanPhone = identifier.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone) accountStatusCache.delete(cleanPhone);
  } else {
    accountStatusCache.clear();
  }
}

const clientShipmentsCache = new Map<string, CacheItem<any[]>>();
const CLIENT_SHIPMENTS_TTL_MS = 30 * 1000; // 30 seconds

export function invalidateClientShipmentsCache(clientId?: string) {
  if (clientId) {
    clientShipmentsCache.delete(clientId);
  } else {
    clientShipmentsCache.clear();
  }
}

export function getBackendApiUrl(): string {
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

export interface SavedAddressItem {
  id: string;
  label: string; // e.g., 'Primary Depot', 'Factory Gate 2', 'Port Yard'
  contactPerson: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  pincode: string;
  isDefault?: boolean;
}

export interface ClientBusinessDetails {
  companyName: string;
  businessType:
  | 'Private Limited'
  | 'Public Limited'
  | 'Partnership'
  | 'Sole Proprietorship'
  | 'LLP'
  | 'MSME / PSU'
  | string;
  gstin: string;
  pan: string;
  registeredAddress: string;
  city: string;
  state: string;
  pincode: string;
  submittedAt?: string;
}

export interface ClientDocumentItem {
  id: string;
  name?: string;
  docType: 'GST_CERTIFICATE' | 'COMPANY_PAN' | 'INCORPORATION_PROOF' | 'MSME_UDYAM';
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  storagePath?: string;
  fileUrl?: string;
  uploadedAt: string;
  status: 'UPLOADED' | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'REPLACEMENT_REQUESTED' | 'PENDING_UPLOAD';
  rejectionReason?: string;
  uploadResponsibility?: 'ADMIN' | 'CLIENT';
}

export interface CreateRequirementInput {
  clientId: string;
  pickupAddress: string;
  pickupPincode: string;
  pickupCity?: string;
  destinationAddress: string;
  destinationPincode: string;
  destinationCity?: string;
  vehicleTypeRequired: string;
  materialType: string;
  requiredCapacityMt: number;
  packagingType?: string;
  numberOfUnits?: number;
  loadingDatetime: string;
  targetBudget?: string;
  transitInsuranceNeeded?: boolean;
  declaredCargoValue?: string;
  specialInstructions?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  dropContactName?: string;
  dropContactPhone?: string;
  // Extended fields (Multi-vehicle & Cargo specifications)
  vehicleGroups?: any[];
  totalVehiclesCount?: number;
  commodityType?: string;
  materialDescription?: string;
  totalCargoWeight?: number;
  weightUnit?: string;
  totalQuantity?: number;
  quantityUnit?: string;
  unitCount?: number;
  packageType?: string;
  packageMode?: string;
  packageDescription?: string;
  isHazardous?: boolean;
  hazardousMaterialName?: string;
  hazardClass?: string;
  unNumber?: string;
  packingGroup?: string;
  safetyHandlingInstructions?: string;
  requiredPrecautions?: string;
  emergencyContact?: string;
  emergencyInstructions?: string;
  additionalHazardousInfo?: string;
  cargoLength?: number;
  cargoWidth?: number;
  cargoHeight?: number;
  cargoVolume?: number;
  isStackable?: boolean;
  loadingPointWeightDeclared?: number;
  loadingPointQuantityDeclared?: number;
}

export interface ClientAccountStatusResult {
  status:
  | 'NEW_USER'
  | 'ONBOARDING_INCOMPLETE'
  | 'INACTIVE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'CORRECTIONS_REQUESTED'
  | 'SUSPENDED'
  | 'ROLE_CONFLICT'
  | 'INVALID_PHONE';
  companyId?: string;
  companyName?: string;
  clientCode?: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  rejectionReason?: string;
  correctionNotes?: string;
  submittedAt?: string;
  previousRole?: string;
  message?: string;
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  incompleteFields?: string[];
  documentUploadResponsibility?: Record<string, 'ADMIN' | 'CLIENT'>;
  kycStatus?: string;
  pan?: string;
  pincode?: string;
  city?: string;
  state?: string;
  registeredAddress?: string;
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseIsoLoadingDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) {
    return new Date(Date.now() + 86400000).toISOString();
  }
  const clean = dateStr.trim();
  if (clean.includes('T') && !isNaN(Date.parse(clean))) {
    return new Date(clean).toISOString();
  }
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch;
    const timeMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    let hour = 10;
    let minute = 0;
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const min = parseInt(timeMatch[2], 10);
      const meridiem = (timeMatch[4] || '').toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      hour = h;
      minute = min;
    }
    const isoString = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
    return new Date(isoString).toISOString();
  }
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date(Date.now() + 86400000).toISOString();
}

export const clientService = {
  // ─── 1. Saved Addresses (Real Storage) ──────────────────────────────────────
  async getSavedAddresses(clientId?: string): Promise<SavedAddressItem[]> {
    try {
      const stored = await AsyncStorage.getItem(`${SAVED_ADDRESSES_KEY}_${clientId || 'default'}`);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch {
      return [];
    }
  },

  async saveAddress(address: SavedAddressItem, clientId?: string): Promise<SavedAddressItem[]> {
    try {
      const existing = await this.getSavedAddresses(clientId);
      const filtered = existing.filter((a) => a.id !== address.id);
      const updated = [address, ...filtered];
      await AsyncStorage.setItem(
        `${SAVED_ADDRESSES_KEY}_${clientId || 'default'}`,
        JSON.stringify(updated)
      );
      return updated;
    } catch {
      return [];
    }
  },

  async deleteAddress(addressId: string, clientId?: string): Promise<SavedAddressItem[]> {
    try {
      const existing = await this.getSavedAddresses(clientId);
      const updated = existing.filter((a) => a.id !== addressId);
      await AsyncStorage.setItem(
        `${SAVED_ADDRESSES_KEY}_${clientId || 'default'}`,
        JSON.stringify(updated)
      );
      return updated;
    } catch {
      return [];
    }
  },

  // ─── 2. Real Document Upload to Supabase Storage ───────────────────────────
  async uploadClientDocument(file: {
    uri?: string;
    blob?: Blob | ArrayBuffer | Uint8Array;
    fileName: string;
    fileSize?: string;
    mimeType?: string;
    docType: 'GST_CERTIFICATE' | 'COMPANY_PAN' | 'INCORPORATION_PROOF' | 'MSME_UDYAM';
    referenceKey: string;
  }): Promise<{ success: boolean; storagePath: string; fileUrl?: string; error?: string }> {
    const cleanRef = file.referenceKey.replace(/[^a-zA-Z0-9_-]/g, '') || 'client';
    const cleanDocType = file.docType.toLowerCase().replace(/_/g, '-');
    const ext = file.fileName.split('.').pop() || 'pdf';
    const storagePath = `clients/${cleanRef}/${cleanDocType}-${Date.now()}.${ext}`;

    return await uploadDocumentToStorage({
      uri: file.uri,
      blob: file.blob,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      storagePath,
    });
  },

  // ─── 2.1 Get Signed URL for Secure Document Preview / Download ─────────────
  async getSignedDocumentUrl(storagePath: string): Promise<string | null> {
    return getSecureDocumentSignedUrl(storagePath);
  },

  // ─── 3. Complete Atomic Client Registration & Persistence ──────────────────
  async submitCompleteRegistration(params: {
    fullName: string;
    mobile: string;
    companyPhone?: string;
    email: string;
    designation: string;
    department: string;
    companyName: string;
    businessType: string;
    gstin: string;
    pan: string;
    registeredAddress: string;
    city: string;
    state: string;
    pincode: string;
    documents: ClientDocumentItem[];
  }): Promise<{
    success: boolean;
    companyId?: string;
    userId?: string;
    clientCode?: string;
    status?: string;
    error?: string;
    roleConflict?: boolean;
    previousRole?: string;
  }> {
    const cleanContactPhone = params.mobile.replace(/[^0-9]/g, '').slice(-10);
    const cleanCompanyPhone = (params.companyPhone || params.mobile).replace(/[^0-9]/g, '').slice(-10);

    // 1. Primary: Server Backend Atomic Registration (Admin Authenticated Persistence)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${getBackendApiUrl()}/client/submit-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          fullName: params.fullName.trim(),
          mobile: cleanContactPhone,
          companyPhone: cleanCompanyPhone,
          email: params.email.trim().toLowerCase(),
          designation: params.designation.trim(),
          department: params.department.trim(),
          companyName: params.companyName.trim(),
          businessType: params.businessType.trim(),
          gstin: params.gstin.trim().toUpperCase(),
          pan: params.pan.trim().toUpperCase(),
          registeredAddress: params.registeredAddress.trim(),
          city: params.city.trim(),
          state: params.state.trim(),
          pincode: params.pincode.trim(),
          documents: params.documents,
        }),
      }).finally(() => clearTimeout(timeoutId));

      const data = await response.json().catch(() => null);

      if (response.status === 409 || data?.roleConflict) {
        return {
          success: false,
          roleConflict: true,
          previousRole: data?.previousRole || 'Another Role',
          error: data?.message || 'You have previously registered under another role.',
        };
      }

      if (response.ok && data?.success) {
        invalidateClientStatusCache(cleanContactPhone);
        return {
          success: true,
          companyId: data.companyId,
          clientCode: data.clientCode,
          status: data.status || 'PENDING_APPROVAL',
        };
      }
    } catch (apiEx) {
      console.warn('Backend submit-registration notice, falling back to direct operations:', apiEx);
    }

    // 2. Direct Supabase fallback operations
    try {
      await ensureMobileSession();

      // Role conflict check in vendor_users and drivers
      const [venCheck, drvCheck] = await Promise.all([
        supabase
          .from('vendor_users')
          .select('id, status')
          .or(`mobile.eq.${cleanContactPhone},mobile.eq.+91${cleanContactPhone}`)
          .maybeSingle(),
        supabase
          .from('drivers')
          .select('id, status')
          .or(`mobile.eq.${cleanContactPhone},phone.eq.${cleanContactPhone}`)
          .maybeSingle(),
      ]);

      if (venCheck.data && venCheck.data.status !== 'DEACTIVATED') {
        return {
          success: false,
          roleConflict: true,
          previousRole: 'VENDOR',
          error: 'You have previously registered with the role of Vendor. Please contact Admin to change role.',
        };
      }
      if (drvCheck.data && drvCheck.data.status !== 'DEACTIVATED') {
        return {
          success: false,
          roleConflict: true,
          previousRole: 'DRIVER',
          error: 'You have previously registered with the role of Driver. Please contact Admin to change role.',
        };
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('client_users')
        .select('id, client_id, client_company_id')
        .eq('mobile', cleanContactPhone)
        .maybeSingle();

      let targetCompanyId = existingUser?.client_company_id || existingUser?.client_id;
      let generatedCode = `CLI-${Math.floor(100000 + Math.random() * 900000)}`;

      if (targetCompanyId) {
        // Update existing company: try rich columns first, fall back to base columns
        const { error: updErr } = await supabase
          .from('client_companies')
          .update({
            company_name: params.companyName.trim(),
            business_type: params.businessType.trim(),
            gstin: params.gstin.trim().toUpperCase() || null,
            pan: params.pan.trim().toUpperCase() || null,
            registered_address: params.registeredAddress.trim(),
            city: params.city.trim(),
            state: params.state.trim(),
            pincode: params.pincode.trim(),
            company_phone: cleanCompanyPhone,
            company_email: params.email.trim().toLowerCase(),
            status: 'PENDING_APPROVAL',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetCompanyId);

        if (updErr) {
          await supabase
            .from('client_companies')
            .update({
              company_name: params.companyName.trim(),
              gstin: params.gstin.trim().toUpperCase() || null,
              pan: params.pan.trim().toUpperCase() || null,
              registered_address: params.registeredAddress.trim(),
              city: params.city.trim(),
              pincode: params.pincode.trim(),
              status: 'INACTIVE',
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetCompanyId);
        }
      } else {
        // Insert client_companies: try rich columns first, fall back to base columns
        let { data: compRec, error: cErr } = await supabase
          .from('client_companies')
          .insert([
            {
              company_name: params.companyName.trim(),
              business_type: params.businessType.trim(),
              gstin: params.gstin.trim().toUpperCase() || null,
              pan: params.pan.trim().toUpperCase() || null,
              registered_address: params.registeredAddress.trim(),
              city: params.city.trim(),
              state: params.state.trim(),
              pincode: params.pincode.trim(),
              company_phone: cleanCompanyPhone,
              company_email: params.email.trim().toLowerCase(),
              client_code: generatedCode,
              status: 'PENDING_APPROVAL',
              submitted_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select('id, client_code')
          .maybeSingle();

        if (cErr || !compRec) {
          const { data: baseCompRec, error: bErr } = await supabase
            .from('client_companies')
            .insert([
              {
                company_name: params.companyName.trim(),
                gstin: params.gstin.trim().toUpperCase() || null,
                pan: params.pan.trim().toUpperCase() || null,
                registered_address: params.registeredAddress.trim(),
                city: params.city.trim(),
                pincode: params.pincode.trim(),
                status: 'PENDING_APPROVAL',
              },
            ])
            .select('id')
            .single();

          if (bErr) {
            console.error('Base client_companies insert failed:', bErr);
            throw new Error(`Database persistence failed: ${bErr.message || cErr?.message}`);
          } else {
            compRec = baseCompRec as any;
          }
        }

        if (!compRec?.id) {
          throw new Error('Database persistence failed: client_companies record was not created.');
        }

        targetCompanyId = compRec.id;
        generatedCode = compRec.client_code || `CLI-${targetCompanyId.slice(0, 8).toUpperCase()}`;
      }

      // Upsert client_users: try rich columns first, fall back to base columns
      let targetUserId = generateUuid();
      const { data: userRec, error: uErr } = await supabase
        .from('client_users')
        .upsert([
          {
            client_id: targetCompanyId,
            client_company_id: targetCompanyId,
            full_name: params.fullName.trim(),
            mobile: cleanContactPhone,
            email: params.email.trim().toLowerCase(),
            designation: params.designation.trim(),
            department: params.department.trim(),
            is_primary_contact: true,
            phone_verified: true,
            status: 'PENDING_APPROVAL',
          },
        ], { onConflict: 'mobile' })
        .select('id')
        .maybeSingle();

      if (uErr || !userRec) {
        const { data: baseUserRec } = await supabase
          .from('client_users')
          .upsert([
            {
              client_id: targetCompanyId,
              full_name: params.fullName.trim(),
              mobile: cleanContactPhone,
              email: params.email.trim().toLowerCase(),
              status: 'PENDING_APPROVAL',
            },
          ], { onConflict: 'mobile' })
          .select('id')
          .maybeSingle();

        targetUserId = baseUserRec?.id || targetUserId;
      } else {
        targetUserId = userRec.id;
      }

      // Persist documents in documents table
      for (const doc of params.documents) {
        try {
          const docPath = doc.storagePath || `clients/${cleanContactPhone}/${doc.docType.toLowerCase()}.pdf`;
          await supabase.from('documents').insert([
            {
              category: 'CLIENT_TRANSIT',
              document_type: 'CLIENT_INVOICE',
              reference_id: targetCompanyId,
              file_url: docPath,
              storage_path: docPath,
              file_name: `${doc.docType}: ${doc.fileName || `${doc.docType.toLowerCase()}.pdf`}`,
              file_size: doc.fileSize || '500 KB',
              mime_type: doc.mimeType || 'application/pdf',
              verification_status: 'PENDING',
              uploaded_by: targetUserId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        } catch (dEx) {
          console.warn('Doc insert notice:', dEx);
        }
      }

      // Audit Log
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: cleanContactPhone,
            user_type: 'CLIENT_MOBILE',
            event_type: 'CLIENT_REGISTRATION_SUBMITTED',
            details: {
              companyId: targetCompanyId,
              clientCode: generatedCode,
              companyName: params.companyName,
              contactName: params.fullName,
              phone: cleanContactPhone,
            },
          },
        ]);
      } catch { }

      // Synchronize local registry
      try {
        const registry = await authService.getLocalRegistry();
        const filtered = registry.filter((u) => u.mobile !== cleanContactPhone);
        filtered.unshift({
          mobile: cleanContactPhone,
          role: 'CLIENT',
          fullName: params.fullName.trim(),
          email: params.email.trim(),
          companyName: params.companyName.trim(),
          status: 'PENDING_APPROVAL',
          registeredAt: new Date().toISOString(),
        });
        await authService.saveLocalRegistry(filtered);
      } catch { }

      return {
        success: true,
        companyId: targetCompanyId,
        userId: targetUserId,
        clientCode: generatedCode,
        status: 'PENDING_APPROVAL',
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Registration submission failed. Please try again.',
      };
    }
  },

  // ─── 3.0. Persistent Registration Draft Across App Restarts & Navigation ───
  async getRegistrationDraft(): Promise<{
    profileData?: any;
    businessDetails?: any;
    documents?: ClientDocumentItem[];
    step?: number;
  } | null> {
    try {
      const saved = await AsyncStorage.getItem('@necl_client_registration_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[ClientService] Error reading registration draft:', e);
    }
    return null;
  },

  async saveRegistrationDraft(data: {
    profileData?: any;
    businessDetails?: any;
    documents?: ClientDocumentItem[];
    step?: number;
  }): Promise<void> {
    try {
      const existing = (await this.getRegistrationDraft()) || {};
      const merged = {
        profileData: data.profileData !== undefined ? data.profileData : existing.profileData,
        businessDetails: data.businessDetails !== undefined ? data.businessDetails : existing.businessDetails,
        documents: data.documents !== undefined ? data.documents : existing.documents,
        step: data.step !== undefined ? data.step : existing.step,
      };
      await AsyncStorage.setItem('@necl_client_registration_draft', JSON.stringify(merged));
    } catch (e) {
      console.warn('[ClientService] Error saving registration draft:', e);
    }
  },

  async clearRegistrationDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@necl_client_registration_draft');
    } catch {}
  },

  // ─── 3.1. Save Active Registration Step to Database During Progress ─────────
  async saveActiveRegistrationStep(
    step: number,
    params: {
      profileData?: any;
      businessDetails?: any;
      documents?: ClientDocumentItem[];
      mobile?: string;
    }
  ): Promise<void> {
    // 1. Always persist to local AsyncStorage draft first so app interruptions never lose state
    await this.saveRegistrationDraft({ ...params, step });

    const cleanPhone = (params.mobile || params.profileData?.mobileNumber || '').replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return;

    try {
      await ensureMobileSession();

      let targetCompanyId: string | null = null;
      if (params.businessDetails?.companyName) {
        const fullAddress = `${params.businessDetails.registeredAddress || ''}, ${params.businessDetails.city || ''}, ${params.businessDetails.state || ''} - ${params.businessDetails.pincode || ''}`.replace(/^, /, '').trim();
        const { data: comp } = await supabase
          .from('client_companies')
          .upsert([
            {
              company_name: params.businessDetails.companyName.trim(),
              gstin: params.businessDetails.gstin ? params.businessDetails.gstin.trim().toUpperCase() : null,
              pan: params.businessDetails.pan ? params.businessDetails.pan.trim().toUpperCase() : null,
              registered_address: fullAddress || 'In progress',
              city: params.businessDetails.city || null,
              pincode: params.businessDetails.pincode || null,
              status: 'INACTIVE', // Staging status during active multi-step registration
            },
          ], { onConflict: 'gstin' })
          .select('id')
          .maybeSingle();

        targetCompanyId = comp?.id || null;
      }

      if (params.profileData?.fullName) {
        await supabase
          .from('client_users')
          .upsert([
            {
              full_name: params.profileData.fullName.trim(),
              mobile: cleanPhone,
              email: params.profileData.emailAddress ? params.profileData.emailAddress.trim().toLowerCase() : null,
              designation: params.profileData.designation ? params.profileData.designation.trim() : null,
              department: params.profileData.department ? params.profileData.department.trim() : null,
              status: 'INACTIVE', // Active registration in progress
            },
          ], { onConflict: 'mobile' });
      }

      if (step === 3 && params.documents && params.documents.length > 0 && targetCompanyId) {
        for (const doc of params.documents) {
          const docPath = doc.storagePath || `clients/${cleanPhone}/${doc.docType.toLowerCase()}.pdf`;
          try {
            await supabase.from('documents').insert([
              {
                category: 'CLIENT_TRANSIT',
                document_type: 'CLIENT_INVOICE',
                reference_id: targetCompanyId,
                file_url: docPath,
                storage_path: docPath,
                file_name: `${doc.docType}: ${doc.fileName || `${doc.docType.toLowerCase()}.pdf`}`,
                file_size: doc.fileSize || '500 KB',
                mime_type: doc.mimeType || 'application/pdf',
                verification_status: 'PENDING',
              },
            ]);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Client step persistence notice:', e);
    }
  },

  // ─── 4. Real Client Account Status Check from Database ─────────────────────
  async getClientAccountStatus(identifier: string, bypassCache: boolean = false): Promise<ClientAccountStatusResult> {
    const raw = (identifier || '').trim();
    const cleanPhone = raw.replace(/[^0-9]/g, '').slice(-10);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const isClientCode = raw.toUpperCase().startsWith('CLI-');
    const isPhone = cleanPhone.length === 10 && !isClientCode && !isUuid;
    const lookupKey = isPhone ? cleanPhone : raw;

    if (!lookupKey) {
      return { status: 'INVALID_PHONE' };
    }

    // Check fast in-memory cache first if not explicitly bypassed
    const cacheKey = lookupKey.trim().toLowerCase();
    if (!bypassCache) {
      const cached = accountStatusCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ACCOUNT_STATUS_TTL_MS) {
        return cached.data;
      }
    }

    // 0. Ensure authenticated mobile session for Supabase queries
    await ensureMobileSession().catch(() => {});

    // 1. Primary: Server Backend Live Status API with 800ms abort timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const response = await fetch(`${getBackendApiUrl()}/client/status/${encodeURIComponent(lookupKey)}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          const rawStatus = data.status;
          const normalizedStatus = rawStatus === 'APPROVED' || rawStatus === 'ACTIVE' ? 'APPROVED' : rawStatus;
          const result: ClientAccountStatusResult = {
            status: normalizedStatus as any,
            companyId: data.companyId,
            companyName: data.companyName,
            clientCode: data.clientCode,
            fullName: data.fullName,
            email: data.email,
            mobile: data.mobile || (isPhone ? cleanPhone : undefined),
            rejectionReason: data.rejectionReason,
            correctionNotes: data.correctionNotes,
            submittedAt: data.submittedAt,
          };
          accountStatusCache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      }
    } catch { }

    // 2. Try DB RPC if phone (SECURITY DEFINER, always reliable)
    if (isPhone) {
      try {
        const { data, error } = await supabase.rpc('check_client_account_status', {
          p_mobile: cleanPhone,
        });
        if (!error && data && data.status && data.status !== 'NEW_USER' && data.status !== 'NOT_FOUND') {
          const rawStatus = data.status;
          const normalizedStatus = rawStatus === 'APPROVED' || rawStatus === 'ACTIVE' ? 'APPROVED' : rawStatus;
          const result: ClientAccountStatusResult = {
            status: normalizedStatus as any,
            companyId: data.company_id,
            companyName: data.company_name,
            clientCode: data.client_code,
            fullName: data.full_name,
            email: data.email,
            mobile: data.mobile || cleanPhone,
            rejectionReason: data.rejection_reason,
            correctionNotes: data.correction_notes,
            submittedAt: data.submitted_at,
            previousRole: data.previous_role,
          };
          accountStatusCache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      } catch { }
    }

    // 3. Direct query fallback
    try {
      let user: any = null;
      let comp: any = null;

      if (isPhone) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('*, client_companies(*)')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();
        user = userRec;
        comp = userRec?.client_companies;
      } else {
        const { data: compRec } = await supabase
          .from('client_companies')
          .select('*')
          .or(`id.eq.${lookupKey},client_code.eq.${lookupKey}`)
          .maybeSingle();
        comp = compRec;
        if (comp) {
          const { data: userRec } = await supabase
            .from('client_users')
            .select('*')
            .or(`client_company_id.eq.${comp.id},client_id.eq.${comp.id}`)
            .maybeSingle();
          user = userRec;
        }
      }

      if (comp || user) {
        const rawStatus = comp?.status || user?.status || 'PENDING_APPROVAL';
        const normalizedStatus =
          rawStatus === 'APPROVED' || rawStatus === 'ACTIVE'
            ? 'APPROVED'
            : rawStatus === 'INACTIVE'
            ? 'INACTIVE'
            : rawStatus === 'PENDING'
            ? 'PENDING_APPROVAL'
            : rawStatus;

        const missingFields: string[] = [];
        if (!comp?.company_name) missingFields.push('Company Name');
        if (!comp?.pan && !comp?.gstin) missingFields.push('PAN / GSTIN');
        if (!comp?.registered_address) missingFields.push('Registered Address');
        if (!comp?.pincode) missingFields.push('PIN Code');
        const isApprovedState = normalizedStatus === 'APPROVED';
        const isProfileComplete = isApprovedState || (missingFields.length === 0 && normalizedStatus !== 'INACTIVE');

        const result: ClientAccountStatusResult = {
          status: normalizedStatus as any,
          companyId: comp?.id || user?.client_company_id || user?.client_id,
          companyName: comp?.company_name,
          clientCode: comp?.client_code || `CLI-${(comp?.id || '847291').slice(-6)}`,
          fullName: user?.full_name,
          email: user?.email,
          mobile: user?.mobile || (isPhone ? cleanPhone : undefined),
          rejectionReason: comp?.rejection_reason,
          correctionNotes: comp?.correction_notes,
          submittedAt: comp?.submitted_at || comp?.created_at,
          profileCompletionStatus: (isProfileComplete ? 'COMPLETE' : 'INCOMPLETE') as any,
          incompleteFields: missingFields,
          documentUploadResponsibility: comp?.document_upload_responsibility || {},
          kycStatus: comp?.kyc_status,
          pan: comp?.pan,
          pincode: comp?.pincode,
          city: comp?.city,
          state: comp?.state,
          registeredAddress: comp?.registered_address,
        };
        accountStatusCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      // Check cross-role conflict
      const [venCheck, drvCheck] = await Promise.all([
        supabase
          .from('vendor_users')
          .select('id, status')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle(),
        supabase
          .from('drivers')
          .select('id, status')
          .or(`mobile.eq.${cleanPhone},phone.eq.${cleanPhone}`)
          .maybeSingle(),
      ]);

      if (venCheck.data && venCheck.data.status !== 'DEACTIVATED') {
        return {
          status: 'ROLE_CONFLICT',
          previousRole: 'VENDOR',
          message: 'Account is registered as Vendor',
        };
      }

      if (drvCheck.data && drvCheck.data.status !== 'DEACTIVATED') {
        return {
          status: 'ROLE_CONFLICT',
          previousRole: 'DRIVER',
          message: 'Account is registered as Driver',
        };
      }

      // 3. Check local user registry for synced client registration
      try {
        const localReg = await authService.getLocalRegistry();
        const found = localReg.find((u) => u.mobile === cleanPhone);
        if (found) {
          if (found.role !== 'CLIENT') {
            return {
              status: 'ROLE_CONFLICT',
              previousRole: found.role,
              message: `Account is registered as ${found.role}`,
            };
          }
          const isApproved = found.status === 'APPROVED' || (found.status as any) === 'ACTIVE';
          return {
            status: isApproved ? 'APPROVED' : 'PENDING_APPROVAL',
            companyName: found.companyName,
            fullName: found.fullName,
            email: found.email,
            mobile: found.mobile,
            clientCode: `CLI-${cleanPhone.slice(-6)}`,
          };
        }
      } catch { }

      return { status: 'NEW_USER' };
    } catch {
      return { status: 'NEW_USER' };
    }
  },

  // ─── 4.1 Load Client Registration Data for Resuming Incomplete Registration ──
  async loadClientRegistrationData(identifier: string): Promise<{
    profileData: {
      fullName: string;
      emailAddress: string;
      mobileNumber: string;
      companyName: string;
      companyPhone?: string;
      designation?: string;
      department?: string;
      gstNumber?: string;
      businessType?: string;
    };
    businessDetails: ClientBusinessDetails;
    documents: ClientDocumentItem[];
  } | null> {
    try {
      await ensureMobileSession().catch(() => {});
      const cleanPhone = (identifier || '').replace(/[^0-9]/g, '').slice(-10);

      let comp: any = null;
      let user: any = null;

      if (cleanPhone.length === 10) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('*, client_companies(*)')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();
        user = userRec;
        comp = userRec?.client_companies;

        if (!comp) {
          const { data: compRec } = await supabase
            .from('client_companies')
            .select('*')
            .or(`company_phone.eq.${cleanPhone},company_phone.eq.+91${cleanPhone}`)
            .maybeSingle();
          comp = compRec;
        }
      } else {
        const { data: compRec } = await supabase
          .from('client_companies')
          .select('*, client_users(*)')
          .eq('id', identifier)
          .maybeSingle();
        comp = compRec;
        user = compRec?.client_users?.[0];
      }

      if (!comp && !user) {
        return null;
      }

      const compId = comp?.id || user?.client_company_id || user?.client_id;
      let documents: ClientDocumentItem[] = [];
      if (compId) {
        documents = await this.getClientDocuments(compId);
      }

      const profileData = {
        fullName: user?.full_name || '',
        emailAddress: user?.email || comp?.company_email || '',
        mobileNumber: user?.mobile || cleanPhone,
        companyName: comp?.company_name || '',
        companyPhone: comp?.company_phone || '',
        designation: user?.designation || '',
        department: user?.department || '',
        gstNumber: comp?.gstin || '',
        businessType: comp?.business_type || '',
      };

      const businessDetails: ClientBusinessDetails = {
        companyName: comp?.company_name || '',
        businessType: comp?.business_type || 'Private Limited',
        gstin: comp?.gstin || '',
        pan: comp?.pan || '',
        registeredAddress: comp?.registered_address || '',
        city: comp?.city || '',
        state: comp?.state || '',
        pincode: comp?.pincode || '',
      };

      return {
        profileData,
        businessDetails,
        documents,
      };
    } catch (e) {
      console.warn('loadClientRegistrationData notice:', e);
      return null;
    }
  },

  // ─── 5. Fetch Client KYC Documents from Database ───────────────────────────
  async getClientDocuments(companyId: string): Promise<ClientDocumentItem[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', companyId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((d) => {
        let docType = d.document_type;
        let cleanFileName = d.file_name || `${d.document_type}.pdf`;

        if (d.file_name && d.file_name.includes(':')) {
          const [prefix, ...rest] = d.file_name.split(':');
          docType = prefix.trim();
          cleanFileName = rest.join(':').trim();
        } else if (d.storage_path) {
          const lower = d.storage_path.toLowerCase();
          if (lower.includes('gst')) docType = 'GST_CERTIFICATE';
          else if (lower.includes('pan')) docType = 'COMPANY_PAN';
          else if (lower.includes('incorporation')) docType = 'INCORPORATION_PROOF';
          else if (lower.includes('msme') || lower.includes('udyam')) docType = 'MSME_UDYAM';
        }

        return {
          id: d.id,
          docType: docType as any,
          fileName: cleanFileName,
          fileSize: d.file_size || '500 KB',
          mimeType: d.mime_type || 'application/pdf',
          storagePath: d.storage_path || d.file_url,
          fileUrl: d.file_url,
          uploadedAt: d.created_at,
          status: (d.verification_status as any) || 'PENDING',
          rejectionReason: d.rejection_reason,
          uploadResponsibility: d.metadata?.upload_responsibility || (d.uploaded_by === 'CLIENT' ? 'CLIENT' : 'ADMIN'),
        };
      });
    } catch {
      return [];
    }
  },

  // ─── 6. Client Document Re-Upload / Replacement ───────────────────────────
  async replaceClientDocument(params: {
    companyId: string;
    docId?: string;
    docType: 'GST_CERTIFICATE' | 'COMPANY_PAN' | 'INCORPORATION_PROOF' | 'MSME_UDYAM';
    fileName: string;
    fileSize?: string;
    mimeType?: string;
    storagePath: string;
    mobile: string;
  }): Promise<{ success: boolean; error?: string }> {
    const cleanPhone = params.mobile.replace(/[^0-9]/g, '').slice(-10);

    try {
      // Find existing document if docId not provided
      let targetDocId = params.docId;
      let previousDoc: any = null;
      if (!targetDocId) {
        const { data: existingDocs } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', params.companyId);

        const match = (existingDocs || []).find((d) => {
          const fn = (d.file_name || '').toUpperCase();
          const sp = (d.storage_path || '').toUpperCase();
          return fn.includes(params.docType) || sp.includes(params.docType.toLowerCase().replace(/_/g, '-'));
        });
        targetDocId = match?.id;
        previousDoc = match;
      } else {
        const { data: dRec } = await supabase.from('documents').select('*').eq('id', targetDocId).maybeSingle();
        previousDoc = dRec;
      }

      // Update documents record: mark as PENDING (Pending Review), clear rejection reason
      if (targetDocId) {
        const { error: updErr } = await supabase
          .from('documents')
          .update({
            file_url: params.storagePath,
            storage_path: params.storagePath,
            file_name: `${params.docType}: ${params.fileName}`,
            file_size: params.fileSize || '500 KB',
            mime_type: params.mimeType || 'application/pdf',
            verification_status: 'PENDING',
            rejection_reason: null,
            uploaded_by: cleanPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetDocId);

        if (updErr) throw updErr;
      } else {
        // Fallback insert if not found
        const { error: insErr } = await supabase
          .from('documents')
          .insert([
            {
              category: 'CLIENT_TRANSIT',
              document_type: 'CLIENT_INVOICE',
              reference_id: params.companyId,
              file_url: params.storagePath,
              storage_path: params.storagePath,
              file_name: `${params.docType}: ${params.fileName}`,
              file_size: params.fileSize || '500 KB',
              mime_type: params.mimeType || 'application/pdf',
              verification_status: 'PENDING',
              rejection_reason: null,
              uploaded_by: cleanPhone,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

        if (insErr) throw insErr;
      }

      // Set client company back to PENDING_APPROVAL and notify admin of replacement
      await supabase
        .from('client_companies')
        .update({
          status: 'PENDING_APPROVAL',
          correction_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.companyId);

      // Audit trail preserving previous document & rejection history
      try {
        invalidateClientStatusCache(cleanPhone);
        invalidateClientStatusCache(params.companyId);
        await supabase.from('auth_audit_log').insert([
          {
            user_id: cleanPhone,
            user_type: 'CLIENT_MOBILE',
            event_type: 'DOCUMENT_REPLACED_FOR_APPROVAL',
            details: {
              companyId: params.companyId,
              documentId: targetDocId,
              docType: params.docType,
              newFileName: params.fileName,
              newStoragePath: params.storagePath,
              previousFileName: previousDoc?.file_name,
              previousStoragePath: previousDoc?.storage_path,
              previousRejectionReason: previousDoc?.rejection_reason,
            },
          },
        ]);
      } catch { }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to replace document' };
    }
  },

  // ─── 6b. Update Missing Client Profile Information ─────────────────────────
  async updateClientProfileDetails(params: {
    companyId: string;
    pan?: string;
    pincode?: string;
    city?: string;
    state?: string;
    registeredAddress?: string;
    businessType?: string;
    industryType?: string;
    companyEmail?: string;
    companyPhone?: string;
  }): Promise<{ success: boolean; error?: string; incompleteFields?: string[]; profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE' }> {
    try {
      const { data: comp, error: fetchErr } = await supabase
        .from('client_companies')
        .select('*')
        .eq('id', params.companyId)
        .maybeSingle();

      if (fetchErr || !comp) {
        throw new Error('Client company not found');
      }

      const merged = {
        company_name: comp.company_name,
        pan: params.pan !== undefined ? params.pan.trim().toUpperCase() : comp.pan,
        pincode: params.pincode !== undefined ? params.pincode.trim() : comp.pincode,
        city: params.city !== undefined ? params.city.trim() : comp.city,
        state: params.state !== undefined ? params.state.trim() : comp.state,
        registered_address: params.registeredAddress !== undefined ? params.registeredAddress.trim() : comp.registered_address,
        business_type: params.businessType !== undefined ? params.businessType.trim() : (params.industryType !== undefined ? params.industryType.trim() : comp.business_type),
        industry_type: params.industryType !== undefined ? params.industryType.trim() : (comp.business_type || ''),
        company_email: params.companyEmail !== undefined ? params.companyEmail.trim() : comp.company_email,
        company_phone: params.companyPhone !== undefined ? params.companyPhone.trim() : comp.company_phone,
      };

      // Check required fields
      const missing: string[] = [];
      if (!merged.company_name) missing.push('Company Name');
      if (!merged.pan || merged.pan.length !== 10) missing.push('Company PAN Number');
      if (!merged.pincode || merged.pincode.length !== 6) missing.push('PIN Code');
      if (!merged.city) missing.push('City');
      if (!merged.state) missing.push('State');
      if (!merged.registered_address) missing.push('Registered Address');

      const profileCompletionStatus: 'COMPLETE' | 'INCOMPLETE' = missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE';

      const { error: updErr } = await supabase
        .from('client_companies')
        .update({
          pan: merged.pan,
          pincode: merged.pincode,
          city: merged.city,
          state: merged.state,
          registered_address: merged.registered_address,
          business_type: merged.business_type,
          company_email: merged.company_email,
          company_phone: merged.company_phone,
          profile_completion_status: profileCompletionStatus,
          incomplete_fields: missing,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.companyId);

      if (updErr) throw updErr;

      return {
        success: true,
        incompleteFields: missing,
        profileCompletionStatus,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile details' };
    }
  },

  // ─── 7. Transport Requirements (Scoped to Real Client Company) ─────────────
  async createTransportRequirement(
    input: CreateRequirementInput
  ): Promise<{ success: boolean; requirementId: string; error?: string }> {
    // 1. Ensure authenticated session for Supabase RLS
    await ensureMobileSession();

    // 2. Resolve client ID that actually exists in client_companies
    let targetClientId = input.clientId;
    let isValidClient = false;

    if (targetClientId && targetClientId.includes('-') && targetClientId.length >= 30) {
      try {
        const { data: comp } = await supabase
          .from('client_companies')
          .select('id')
          .eq('id', targetClientId)
          .maybeSingle();
        if (comp?.id) {
          isValidClient = true;
        }
      } catch {}
    }

    if (!isValidClient) {
      const activeSession = await authService.checkExistingSession();
      if (activeSession?.userId && activeSession.userId.includes('-')) {
        try {
          const { data: userRec } = await supabase
            .from('client_users')
            .select('client_id, client_company_id')
            .eq('id', activeSession.userId)
            .maybeSingle();
          const mappedCompId = userRec?.client_id || userRec?.client_company_id;
          if (mappedCompId) {
            targetClientId = mappedCompId;
            isValidClient = true;
          }
        } catch {}
      }
    }

    if (!isValidClient) {
      const activeSession = await authService.checkExistingSession();
      if (activeSession?.mobile) {
        try {
          const cleanPhone = activeSession.mobile.replace(/[^0-9]/g, '').slice(-10);
          const { data: userRec } = await supabase
            .from('client_users')
            .select('client_id, client_company_id')
            .eq('mobile', cleanPhone)
            .maybeSingle();
          const mappedCompId = userRec?.client_id || userRec?.client_company_id;
          if (mappedCompId) {
            targetClientId = mappedCompId;
            isValidClient = true;
          }
        } catch {}
      }
    }

    if (!isValidClient || !targetClientId) {
      return {
        success: false,
        requirementId: '',
        error: 'Unable to verify client company ownership. Please complete client profile registration before posting requirements.',
      };
    }

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `REQ-${datePrefix}-${randSuffix}`;
    const isoLoadingDatetime = parseIsoLoadingDate(input.loadingDatetime);

    try {
      const reqPayload: Record<string, any> = {
        id: generatedId,
        client_id: targetClientId,
        pickup_address: input.pickupAddress,
        pickup_pincode: input.pickupPincode,
        destination_address: input.destinationAddress,
        destination_pincode: input.destinationPincode,
        vehicle_type: input.vehicleTypeRequired,
        material_type: input.materialType || 'General Cargo',
        required_capacity_mt: input.requiredCapacityMt || input.totalCargoWeight || 1,
        loading_datetime: isoLoadingDatetime,
        special_instructions: input.specialInstructions || null,
        status: 'NEW_REQUIREMENT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (input.vehicleGroups && input.vehicleGroups.length > 0) {
        reqPayload.vehicle_groups = input.vehicleGroups;
        reqPayload.total_vehicles_count = input.totalVehiclesCount || input.vehicleGroups.reduce((acc: number, g: any) => acc + (Number(g.vehiclesNeeded) || 1), 0);
        reqPayload.total_requirement_entries_count = input.vehicleGroups.length;
      }
      if (input.commodityType) reqPayload.commodity_type = input.commodityType;
      if (input.materialDescription) reqPayload.material_description = input.materialDescription;
      if (input.totalCargoWeight !== undefined) reqPayload.total_cargo_weight = input.totalCargoWeight;
      if (input.weightUnit) reqPayload.weight_unit = input.weightUnit;
      if (input.totalQuantity !== undefined) reqPayload.total_quantity = input.totalQuantity;
      if (input.quantityUnit) {
        reqPayload.quantity_unit = input.quantityUnit;
        reqPayload.package_type = input.quantityUnit;
      }
      if (input.unitCount !== undefined) reqPayload.unit_count = input.unitCount;
      if (input.packageType && !reqPayload.package_type) reqPayload.package_type = input.packageType;
      if (input.packagingType || input.packageMode) reqPayload.package_mode = input.packageMode || input.packagingType;
      if (input.packageDescription) reqPayload.package_description = input.packageDescription;
      if (input.targetBudget) reqPayload.target_budget = input.targetBudget;

      // Hazardous cargo
      if (input.isHazardous !== undefined) reqPayload.is_hazardous = input.isHazardous;
      if (input.hazardousMaterialName) reqPayload.hazardous_material_name = input.hazardousMaterialName;
      if (input.hazardClass) reqPayload.hazard_class = input.hazardClass;
      if (input.unNumber) reqPayload.un_number = input.unNumber;
      if (input.packingGroup) reqPayload.packing_group = input.packingGroup;
      if (input.safetyHandlingInstructions) reqPayload.safety_handling_instructions = input.safetyHandlingInstructions;
      if (input.requiredPrecautions) reqPayload.required_precautions = input.requiredPrecautions;
      if (input.emergencyContact) reqPayload.emergency_contact = input.emergencyContact;
      if (input.emergencyInstructions) reqPayload.emergency_instructions = input.emergencyInstructions;
      if (input.additionalHazardousInfo) reqPayload.additional_hazardous_info = input.additionalHazardousInfo;

      // Dimensions & handling
      if (input.cargoLength !== undefined) reqPayload.cargo_length = input.cargoLength;
      if (input.cargoWidth !== undefined) reqPayload.cargo_width = input.cargoWidth;
      if (input.cargoHeight !== undefined) reqPayload.cargo_height = input.cargoHeight;
      if (input.cargoVolume !== undefined) reqPayload.cargo_volume = input.cargoVolume;
      if (input.isStackable !== undefined) reqPayload.is_stackable = input.isStackable;

      // Loading point measurements
      if (input.loadingPointWeightDeclared !== undefined) reqPayload.loading_point_weight_declared = input.loadingPointWeightDeclared;
      if (input.loadingPointQuantityDeclared !== undefined) reqPayload.loading_point_quantity_declared = input.loadingPointQuantityDeclared;

      let { data: insertData, error } = await supabase
        .from('requirements')
        .insert([reqPayload])
        .select('*')
        .single();

      if (error) {
        // Fallback to base columns if extended columns are not yet recognized
        console.warn('Extended columns insert notice, attempting base requirements schema:', error.message);
        const basePayload = {
          id: generatedId,
          client_id: targetClientId,
          pickup_address: input.pickupAddress,
          pickup_pincode: input.pickupPincode,
          destination_address: input.destinationAddress,
          destination_pincode: input.destinationPincode,
          vehicle_type: input.vehicleTypeRequired,
          material_type: input.materialType || 'General Cargo',
          required_capacity_mt: input.requiredCapacityMt || 1,
          loading_datetime: isoLoadingDatetime,
          special_instructions: input.specialInstructions || null,
          status: 'NEW_REQUIREMENT',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const fallbackRes = await supabase.from('requirements').insert([basePayload]).select('*').single();
        if (fallbackRes.error) {
          console.error('Supabase requirement creation error:', fallbackRes.error);
          return {
            success: false,
            requirementId: '',
            error: fallbackRes.error.message || 'Database error creating transport requirement',
          };
        }
      }

      // Clear draft on successful persist
      await this.clearTransportRequirementDraft(input.clientId);
      invalidateClientShipmentsCache(targetClientId);
      invalidateClientShipmentsCache(input.clientId);

      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: targetClientId,
            user_type: 'CLIENT_MOBILE',
            event_type: 'REQUIREMENT_POSTED',
            details: {
              requirementId: generatedId,
              route: `${input.pickupAddress} -> ${input.destinationAddress}`,
              material: input.materialType,
              capacityMt: input.requiredCapacityMt,
            },
          },
        ]);
      } catch {}

      return { success: true, requirementId: generatedId };
    } catch (err: any) {
      console.error('Exception creating transport requirement:', err);
      return {
        success: false,
        requirementId: '',
        error: err?.message || 'Network exception creating transport requirement',
      };
    }
  },

  async fetchClientRequirements(clientId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('requirements')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId && clientId.includes('-')) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query.limit(50);
      if (error || !data) return [];

      const reqIds = data.map((r) => r.id);
      if (reqIds.length > 0) {
        try {
          const { data: quotes } = await supabase
            .from('client_quotes')
            .select('id, requirement_id, status, total_client_amount, gst_amount, created_at')
            .in('requirement_id', reqIds);

          if (quotes && quotes.length > 0) {
            const quotesByReq: Record<string, any[]> = {};
            quotes.forEach((q: any) => {
              if (!quotesByReq[q.requirement_id]) quotesByReq[q.requirement_id] = [];
              quotesByReq[q.requirement_id].push({
                id: q.id,
                requirement_id: q.requirement_id,
                status: q.status,
                rate: Number(q.total_client_amount || 0),
                total_client_amount: Number(q.total_client_amount || 0),
                total_amount: Number(q.total_client_amount || 0),
                gst_amount: Number(q.gst_amount || 0),
                vendorName: 'TRUCKS Verified Fleet Carrier',
                tierName: 'TRUCKS Priority Cargo',
                created_at: q.created_at,
              });
            });

            return data.map((r) => ({
              ...r,
              quotationsCount: (quotesByReq[r.id] || []).length,
              quotations: quotesByReq[r.id] || [],
            }));
          }
        } catch { }
      }

      return data.map((r) => ({
        ...r,
        quotationsCount: 0,
        quotations: [],
      }));
    } catch {
      return [];
    }
  },

  async fetchClientQuotations(clientId?: string): Promise<any[]> {
    try {
      if (!clientId || !clientId.includes('-')) return [];

      const { data: reqs } = await supabase
        .from('requirements')
        .select('id')
        .eq('client_id', clientId);

      if (!reqs || reqs.length === 0) return [];

      const reqIds = reqs.map((r) => r.id);
      const { data: quotes, error } = await supabase
        .from('client_quotes')
        .select('id, requirement_id, version, total_client_amount, gst_rate_percent, gst_amount, validity_expires_at, status, created_at, requirements(*)')
        .in('requirement_id', reqIds)
        .order('created_at', { ascending: false });

      if (error || !quotes) return [];
      return quotes.map((q: any, idx: number) => ({
        id: q.id,
        requirement_id: q.requirement_id,
        version: q.version,
        rate: Number(q.total_client_amount || 0),
        total_client_amount: Number(q.total_client_amount || 0),
        total_amount: Number(q.total_client_amount || 0),
        gst_rate_percent: Number(q.gst_rate_percent || 18),
        gst_amount: Number(q.gst_amount || 0),
        validity_expires_at: q.validity_expires_at,
        status: q.status,
        created_at: q.created_at,
        requirements: q.requirements,
        tierName: idx === 0 ? 'TRUCKS Priority Cargo' : idx === 1 ? 'TRUCKS Standard Express' : 'TRUCKS Dedicated Fleet',
        vendorName: 'TRUCKS Verified Fleet Carrier',
      }));
    } catch {
      return [];
    }
  },

  async fetchClientBookings(clientId?: string): Promise<any[]> {
    try {
      if (!clientId) return [];

      let targetCompanyId = clientId;
      if (clientId.includes('-')) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('client_id, client_company_id')
          .eq('id', clientId)
          .maybeSingle();

        if (userRec?.client_id || userRec?.client_company_id) {
          targetCompanyId = userRec.client_id || userRec.client_company_id;
        }
      }

      let query = supabase
        .from('bookings')
        .select('*, requirements(*)')
        .order('confirmed_at', { ascending: false });

      if (targetCompanyId !== clientId) {
        query = query.or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`);
      } else {
        query = query.eq('client_id', clientId);
      }

      const { data: bData, error } = await query;
      if (error || !bData) return [];

      const bookingIds = bData.map((b) => b.id);
      if (bookingIds.length > 0) {
        const { data: tripsData } = await supabase
          .from('trips')
          .select('id, booking_id, vehicle_id, driver_id, trip_status, started_at, completed_at, created_at, pod_approved, pod_approved_at, vehicles(registration_number, vehicle_type, model), drivers(name, full_name, phone, mobile, license_number, licence_number)')
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false });

        if (tripsData && tripsData.length > 0) {
          const tripsByBooking: Record<string, any[]> = {};
          tripsData.forEach((t) => {
            if (!tripsByBooking[t.booking_id]) tripsByBooking[t.booking_id] = [];
            tripsByBooking[t.booking_id].push(t);
          });

          return bData.map((b) => ({
            ...b,
            trips: tripsByBooking[b.id] || [],
            trip: (tripsByBooking[b.id] && tripsByBooking[b.id][0]) || null,
          }));
        }
      }

      return bData;
    } catch {
      return [];
    }
  },

  async fetchShipmentTracking(trackingId: string, clientId?: string): Promise<any | null> {
    try {
      if (!trackingId) return null;
      const cleanId = trackingId.trim();

      await ensureMobileSession();

      // Resolve company ID if clientId is user ID
      let targetCompanyId = clientId;
      if (clientId && clientId.includes('-')) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('client_id, client_company_id')
          .eq('id', clientId)
          .maybeSingle();

        if (userRec?.client_id || userRec?.client_company_id) {
          targetCompanyId = userRec.client_id || userRec.client_company_id;
        }
      }

      // 1. Try to find trip by ID or booking_id
      const query = supabase
        .from('trips')
        .select(`
          id, booking_id, vehicle_id, driver_id, trip_status, started_at, completed_at, created_at, pod_approved, pod_approved_at,
          vehicles(id, registration_number, vehicle_type, model, rated_capacity_mt),
          drivers(id, full_name, mobile, licence_number),
          bookings(id, requirement_id, client_id, booking_status, payment_status, confirmed_at, grand_total, booking_code, requirements(*))
        `)
        .or(`id.eq.${cleanId},booking_id.eq.${cleanId},lr_number.eq.${cleanId}`);

      const { data, error } = await query.maybeSingle();

      if (data && !error) {
        // Enforce authorization: ensure client owns this booking
        if (clientId || targetCompanyId) {
          const bObj: any = Array.isArray((data as any).bookings) ? (data as any).bookings[0] : (data as any).bookings;
          const bookingClientId = bObj?.client_id;
          if (bookingClientId && bookingClientId !== clientId && bookingClientId !== targetCompanyId) {
            return null; // IDOR protection: unauthorized access blocked
          }
        }
        return data;
      }

      // 2. If no trip created yet, check if it exists as an active booking
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, requirements(*)')
        .or(`id.eq.${cleanId},booking_code.eq.${cleanId}`)
        .maybeSingle();

      if (bookingData) {
        if (clientId || targetCompanyId) {
          if (bookingData.client_id !== clientId && bookingData.client_id !== targetCompanyId) {
            return null; // IDOR protection: unauthorized
          }
        }

        const isCancelled = (bookingData.booking_status || '').toUpperCase() === 'CANCELLED';
        return {
          id: bookingData.id,
          booking_id: bookingData.id,
          lr_number: formatDisplayId('BK', bookingData.id, bookingData.created_at),
          trip_status: isCancelled ? 'CANCELLED' : (bookingData.booking_status || 'BOOKED'),
          status: isCancelled ? 'CANCELLED' : (bookingData.booking_status || 'BOOKED'),
          pickup_city:
            bookingData.requirements?.pickup_city ||
            (bookingData.requirements?.pickup_address
              ? bookingData.requirements.pickup_address.split(',')[0].trim()
              : 'Origin Depot'),
          destination_city:
            bookingData.requirements?.destination_city ||
            (bookingData.requirements?.destination_address
              ? bookingData.requirements.destination_address.split(',')[0].trim()
              : 'Destination Depot'),
          created_at: bookingData.confirmed_at || bookingData.created_at,
          bookings: bookingData,
          vehicles: null,
          drivers: null,
        };
      }

      return null;
    } catch {
      return null;
    }
  },

  async cancelBooking(bookingId: string, clientId?: string, reason?: string): Promise<{ success: boolean; message?: string }> {
    try {
      if (!bookingId) return { success: false, message: 'Invalid booking ID' };

      const { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select('booking_status, client_id')
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchErr || !booking) {
        return { success: false, message: 'Booking not found' };
      }

      const st = (booking.booking_status || '').toUpperCase();
      if (st === 'DELIVERED' || st === 'IN_TRANSIT' || st === 'CANCELLED') {
        return { success: false, message: `Cannot cancel a booking that is ${st.toLowerCase()}` };
      }

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({
          booking_status: 'CANCELLED',
          cancellation_reason: reason || 'Cancelled by client',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (updateErr) {
        return { success: false, message: updateErr.message };
      }

      invalidateClientShipmentsCache(clientId);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to cancel booking' };
    }
  },

  async acceptQuotation(quoteId: string, clientId: string): Promise<boolean> {
    const res = await this.acceptQuotationAndBook('', quoteId, clientId);
    return res.success;
  },

  async acceptQuotationAndBook(
    requirementId: string,
    quoteId: string,
    clientId: string,
    _rate?: number
  ): Promise<{ success: boolean; bookingId: string; message?: string; isIdempotent?: boolean }> {
    try {
      await ensureMobileSession();

      // 1. First try calling the atomic stored procedure
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          'rpc_accept_quotation_and_create_booking',
          {
            p_client_quote_id: quoteId,
            p_client_id: clientId,
          }
        );

        if (!rpcErr && rpcRes) {
          if (rpcRes.success) {
            invalidateClientShipmentsCache(clientId);
            return {
              success: true,
              bookingId: rpcRes.booking_id,
              isIdempotent: rpcRes.is_idempotent,
              message: rpcRes.message,
            };
          } else {
            return {
              success: false,
              bookingId: '',
              message: rpcRes.message || rpcRes.error,
            };
          }
        }
      } catch (rpcEx) {
        console.warn('RPC invocation fallback triggered:', rpcEx);
      }

      // 2. Fallback to Express backend endpoint
      try {
        const backendUrl = getBackendApiUrl();
        const response = await fetch(`${backendUrl}/client/quotes/${quoteId}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            invalidateClientShipmentsCache(clientId);
            return {
              success: true,
              bookingId: resJson.bookingId,
              isIdempotent: resJson.isIdempotent,
              message: resJson.message,
            };
          } else {
            return {
              success: false,
              bookingId: '',
              message: resJson.message || resJson.error,
            };
          }
        }
      } catch (backendEx) {
        console.warn('Backend API fallback triggered:', backendEx);
      }

      // 3. Fallback to direct Supabase transactional operations
      // 3.1 Idempotency check: check if booking already exists for this quote
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id, requirement_id, booking_status, confirmed_at')
        .eq('accepted_quote_id', quoteId)
        .maybeSingle();

      if (existingBooking) {
        invalidateClientShipmentsCache(clientId);
        return {
          success: true,
          bookingId: existingBooking.id,
          isIdempotent: true,
          message: 'Booking already exists for this quotation (Idempotent response).',
        };
      }

      // 3.2 Fetch quote & requirement
      let reqId = requirementId;
      let totalAmount = 0;
      let quoteValidity: string | null = null;
      let vendorQuoteId: string | null = null;

      const { data: quoteRec } = await supabase
        .from('client_quotes')
        .select('requirement_id, total_client_amount, validity_expires_at, status, vendor_quotation_id')
        .eq('id', quoteId)
        .maybeSingle();

      if (quoteRec) {
        reqId = quoteRec.requirement_id || reqId;
        totalAmount = quoteRec.total_client_amount || 0;
        quoteValidity = quoteRec.validity_expires_at;
        vendorQuoteId = quoteRec.vendor_quotation_id;

        // Validity check
        if (quoteValidity && new Date(quoteValidity).getTime() < Date.now()) {
          await supabase.from('client_quotes').update({ status: 'EXPIRED' }).eq('id', quoteId);
          return {
            success: false,
            bookingId: '',
            message: `Quotation validity expired on ${quoteValidity}. Please request an updated quotation.`,
          };
        }
      }

      // 3.3 Check if requirement is already booked
      if (reqId) {
        const { data: competingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('requirement_id', reqId)
          .neq('booking_status', 'CANCELLED')
          .maybeSingle();

        if (competingBooking) {
          return {
            success: false,
            bookingId: competingBooking.id,
            message: `This requirement is already booked under reference ${competingBooking.id}.`,
          };
        }
      }

      // 3.4 Generate Collision-Resistant Booking ID
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const newBokId = `BOK-${dateStr}-${randNum}`;
      const confirmedAt = new Date().toISOString();

      // 3.5 Insert into bookings
      const { data: bData, error: bErr } = await supabase.from('bookings').insert([
        {
          id: newBokId,
          client_id: clientId,
          requirement_id: reqId,
          accepted_quote_id: quoteId,
          booking_status: 'CLIENT_ACCEPTED',
          payment_status: 'NOT_DUE',
          grand_total: totalAmount,
          confirmed_at: confirmedAt,
        },
      ]).select('id').single();

      if (bErr) {
        console.warn('Booking insertion notice:', bErr.message);
      }

      // 3.6 Mark client_quote as ACCEPTED
      await supabase
        .from('client_quotes')
        .update({ status: 'ACCEPTED' })
        .eq('id', quoteId);

      // 3.7 Update requirement status to BOOKED
      if (reqId) {
        await supabase
          .from('requirements')
          .update({ status: 'BOOKED', updated_at: confirmedAt })
          .eq('id', reqId);

        // 3.8 Transition competing client quotes to SUPERSEDED
        await supabase
          .from('client_quotes')
          .update({ status: 'SUPERSEDED' })
          .eq('requirement_id', reqId)
          .neq('id', quoteId)
          .in('status', ['SENT', 'ISSUED', 'DRAFT']);
      }

      // 3.9 Synchronize winning vendor quote
      if (vendorQuoteId) {
        await supabase.from('vendor_quotations').update({ status: 'ACCEPTED' }).eq('id', vendorQuoteId);
      }

      // 3.10 Log audit trail
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: clientId,
            user_type: 'CLIENT',
            event_type: 'CLIENT_QUOTE_ACCEPTED',
            details: {
              booking_id: bData?.id || newBokId,
              quote_id: quoteId,
              requirement_id: reqId,
              total_client_amount: totalAmount,
              confirmed_at: confirmedAt,
            },
          },
        ]);
      } catch {}

      invalidateClientShipmentsCache(clientId);
      return { success: true, bookingId: bData?.id || newBokId, message: 'Quotation accepted and booking confirmed.' };
    } catch (err: any) {
      console.error('acceptQuotationAndBook error:', err);
      return { success: false, bookingId: '', message: err?.message || 'Quotation acceptance failed.' };
    }
  },

  async rejectQuotation(quoteId: string, clientId?: string, reason?: string): Promise<boolean> {
    try {
      // 1. Try calling rejection RPC
      if (clientId) {
        const { data: rpcRes } = await supabase.rpc('rpc_reject_client_quotation', {
          p_client_quote_id: quoteId,
          p_client_id: clientId,
          p_rejection_reason: reason || null,
        });
        if (rpcRes && rpcRes.success) {
          invalidateClientShipmentsCache(clientId);
          return true;
        }
      }

      // 2. Direct fallback
      await supabase
        .from('client_quotes')
        .update({ status: 'REJECTED' })
        .eq('id', quoteId);

      if (clientId) {
        try {
          await supabase.from('auth_audit_log').insert([
            {
              user_id: clientId,
              user_type: 'CLIENT',
              event_type: 'CLIENT_QUOTE_REJECTED',
              details: {
                quote_id: quoteId,
                reason: reason || 'Client opted not to proceed with this quote.',
                rejected_at: new Date().toISOString(),
              },
            },
          ]);
        } catch {}
      }

      if (clientId) invalidateClientShipmentsCache(clientId);
      return true;
    } catch {
      return false;
    }
  },

  async getShipmentDocuments(tripId: string, clientId?: string): Promise<any[]> {
    try {
      if (!tripId) return [];
      await ensureMobileSession();

      if (clientId) {
        const tracking = await this.fetchShipmentTracking(tripId, clientId);
        if (!tracking) return []; // Unauthorized or not found
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', tripId);
      return error || !data ? [] : data;
    } catch {
      return [];
    }
  },

  async getProofOfDelivery(tripId: string, clientId?: string): Promise<any | null> {
    try {
      if (!tripId) return null;
      await ensureMobileSession();

      if (clientId) {
        const tracking = await this.fetchShipmentTracking(tripId, clientId);
        if (!tracking) return null; // Unauthorized or not found
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', tripId)
        .in('document_type', ['POD_LR', 'SIGNED_ACKNOWLEDGEMENT', 'PROOF_OF_DELIVERY'])
        .maybeSingle();
      return error || !data ? null : data;
    } catch {
      return null;
    }
  },

  async getClientLoadingDocuments(bookingId: string, tripId?: string) {
    return documentWorkflowService.getClientLoadingDocuments(bookingId, tripId);
  },

  async uploadClientLoadingDocument(input: {
    bookingId: string;
    tripId?: string;
    clientId: string;
    clientName?: string;
    documentType: 'TAX_INVOICE' | 'LOADING_WEIGHBILL' | 'MATERIAL_DOC';
    fileName: string;
    fileUrl: string;
    fileSize?: string;
    recordedWeightMt?: number;
    isConfirmed?: boolean;
  }) {
    return documentWorkflowService.uploadClientLoadingDocument(input);
  },

  async getDualWeighbillStatus(bookingId: string, tripId?: string) {
    return documentWorkflowService.evaluateAndUpdateDualStatus(bookingId, tripId);
  },

  async fetchRequirementById(reqId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .eq('id', reqId)
        .maybeSingle();
      if (error || !data) return null;

      let bookingId: string | null = null;
      try {
        const { data: bRow } = await supabase
          .from('bookings')
          .select('id')
          .eq('requirement_id', reqId)
          .maybeSingle();
        if (bRow?.id) {
          bookingId = bRow.id;
        }
      } catch {
        // Fallback if query fails
      }

      try {
        const { data: quotes } = await supabase
          .from('client_quotes')
          .select('id, requirement_id, version, total_client_amount, gst_rate_percent, gst_amount, validity_expires_at, status, created_at')
          .eq('requirement_id', reqId)
          .order('created_at', { ascending: false });

        const mappedQuotes = (quotes || []).map((q: any, idx: number) => ({
          id: q.id,
          requirement_id: q.requirement_id,
          version: q.version,
          rate: Number(q.total_client_amount || 0),
          total_client_amount: Number(q.total_client_amount || 0),
          total_amount: Number(q.total_client_amount || 0),
          gst_rate_percent: Number(q.gst_rate_percent || 18),
          gst_amount: Number(q.gst_amount || 0),
          validity_expires_at: q.validity_expires_at,
          status: q.status,
          created_at: q.created_at,
          tierName: idx === 0 ? 'TRUCKS Priority Cargo' : idx === 1 ? 'TRUCKS Standard Express' : 'TRUCKS Dedicated Fleet',
          vendorName: 'TRUCKS Verified Fleet Carrier',
        }));

        return {
          ...data,
          booking_id: bookingId,
          quotationsCount: mappedQuotes.length,
          quotations: mappedQuotes,
        };
      } catch {
        return {
          ...data,
          booking_id: bookingId,
          quotationsCount: 0,
          quotations: [],
        };
      }
    } catch {
      return null;
    }
  },

  async fetchQuotationsForRequirement(reqId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('client_quotes')
        .select('id, requirement_id, version, total_client_amount, gst_rate_percent, gst_amount, validity_expires_at, status, created_at')
        .eq('requirement_id', reqId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((q: any, idx: number) => ({
        id: q.id,
        requirement_id: q.requirement_id,
        version: q.version,
        rate: Number(q.total_client_amount || 0),
        total_client_amount: Number(q.total_client_amount || 0),
        total_amount: Number(q.total_client_amount || 0),
        gst_rate_percent: Number(q.gst_rate_percent || 18),
        gst_amount: Number(q.gst_amount || 0),
        validity_expires_at: q.validity_expires_at,
        status: q.status,
        created_at: q.created_at,
        tierName: idx === 0 ? 'TRUCKS Priority Cargo' : idx === 1 ? 'TRUCKS Standard Express' : 'TRUCKS Dedicated Fleet',
        vendorName: 'TRUCKS Verified Fleet Carrier',
      }));
    } catch {
      return [];
    }
  },

  async fetchBookingById(bookingId: string, clientId?: string): Promise<any | null> {
    try {
      if (!bookingId) return null;
      const cleanId = bookingId.trim();

      await ensureMobileSession();

      let targetCompanyId = clientId;
      if (clientId && clientId.includes('-')) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('client_id, client_company_id')
          .eq('id', clientId)
          .maybeSingle();

        if (userRec?.client_id || userRec?.client_company_id) {
          targetCompanyId = userRec.client_id || userRec.client_company_id;
        }
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*, requirements(*)')
        .eq('id', cleanId)
        .maybeSingle();

      if (error || !data) return null;

      // Ownership authorization check
      if (clientId || targetCompanyId) {
        if (data.client_id && data.client_id !== clientId && data.client_id !== targetCompanyId) {
          return null; // IDOR protection: unauthorized
        }
      }

      const { data: trip } = await supabase
        .from('trips')
        .select('id, booking_id, vehicle_id, driver_id, trip_status, started_at, completed_at, created_at, pod_approved, pod_approved_at, vehicles(registration_number, vehicle_type, model), drivers(name, full_name, phone, mobile, license_number, licence_number)')
        .eq('booking_id', cleanId)
        .maybeSingle();

      return {
        ...data,
        trip: trip || null,
      };
    } catch {
      return null;
    }
  },

  async cancelRequirement(
    requirementId: string,
    clientId?: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      if (!requirementId) return { success: false, message: 'Invalid requirement ID' };

      const { data: req, error: fetchErr } = await supabase
        .from('requirements')
        .select('status, client_id')
        .eq('id', requirementId)
        .maybeSingle();

      if (fetchErr || !req) {
        return { success: false, message: 'Requirement not found' };
      }

      const st = (req.status || '').toUpperCase();
      if (st === 'BOOKED' || st === 'COMPLETED') {
        return { success: false, message: `Cannot cancel a requirement that is already ${st.toLowerCase()}` };
      }

      const { error: updateErr } = await supabase
        .from('requirements')
        .update({
          status: 'CANCELLED',
          special_instructions: reason ? `[Cancelled: ${reason}]` : 'Cancelled by client',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requirementId);

      if (updateErr) {
        return { success: false, message: updateErr.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to cancel requirement' };
    }
  },

  async fetchClientShipments(clientId?: string): Promise<any[]> {
    try {
      if (!clientId) return [];

      const cacheKey = clientId.trim();
      const cached = clientShipmentsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CLIENT_SHIPMENTS_TTL_MS) {
        return cached.data;
      }

      await ensureMobileSession();

      // Resolve company ID if clientId is user ID
      let targetCompanyId = clientId;
      if (clientId.includes('-')) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('client_id, client_company_id')
          .eq('id', clientId)
          .maybeSingle();

        if (userRec?.client_id || userRec?.client_company_id) {
          targetCompanyId = userRec.client_id || userRec.client_company_id;
        }
      }

      // 1. Fetch requirements for this client
      const { data: myReqs } = await supabase
        .from('requirements')
        .select('id')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`);
      const reqIds = (myReqs || []).map((r) => r.id);

      // 2. Fetch all real bookings for this client
      let bookingsData: any[] = [];
      const { data: bData } = await supabase
        .from('bookings')
        .select('*, requirements(*)')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
        .order('created_at', { ascending: false });

      if (bData && bData.length > 0) {
        bookingsData = bData;
      } else if (reqIds.length > 0) {
        const { data: bByReq } = await supabase
          .from('bookings')
          .select('*, requirements(*)')
          .in('requirement_id', reqIds)
          .order('created_at', { ascending: false });
        bookingsData = bByReq || [];
      }

      // If client has no bookings at all, they have 0 shipments
      if (bookingsData.length === 0) {
        clientShipmentsCache.set(cacheKey, { data: [], timestamp: Date.now() });
        return [];
      }

      // 3. Fetch associated trips for these bookings
      const bookingIds = bookingsData.map((b) => b.id);
      const { data: tripsData } = await supabase
        .from('trips')
        .select(`
          id, booking_id, vehicle_id, driver_id, trip_status, started_at, completed_at, created_at, pod_approved, pod_approved_at,
          vehicles(registration_number, vehicle_type),
          drivers(full_name, mobile, licence_number),
          bookings(id, requirement_id, client_id, booking_status, payment_status, confirmed_at, grand_total, booking_code, requirements(*))
        `)
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      const tripsByBookingId = new Map<string, any>();
      ((tripsData as any[]) || []).forEach((t: any) => {
        if (t.booking_id && !tripsByBookingId.has(t.booking_id)) {
          tripsByBookingId.set(t.booking_id, t);
        }
      });

      const result: any[] = [];

      // Add trips first
      ((tripsData as any[]) || []).forEach((t: any) => {
        let shipmentStatus = 'In Transit';
        const st = (t.trip_status || '').toUpperCase();
        if (st === 'DELIVERED' || st === 'COMPLETED') shipmentStatus = 'Delivered';
        else if (st === 'DELAYED' || st === 'EXCEPTION') shipmentStatus = 'Delayed';
        else if (st === 'CANCELLED') shipmentStatus = 'Cancelled';
        else if (st === 'OUT_FOR_DELIVERY') shipmentStatus = 'Out for Delivery';
        else if (st === 'AT_LOADING' || st === 'PICKUP_SCHEDULED') shipmentStatus = 'Pickup Scheduled';
        else if (st === 'LOADED' || st === 'PICKED_UP') shipmentStatus = 'Picked Up';
        else if (st === 'ON_HOLD') shipmentStatus = 'On Hold';
        else if (st === 'CREATED' || st === 'BOOKED' || st === 'LORRY_ASSIGNED') shipmentStatus = 'Booked';

        const bObj: any = Array.isArray(t.bookings) ? t.bookings[0] : t.bookings;
        const reqObj: any = Array.isArray(bObj?.requirements) ? bObj.requirements[0] : bObj?.requirements;
        const vehObj: any = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles;
        const drvObj: any = Array.isArray(t.drivers) ? t.drivers[0] : t.drivers;

        result.push({
          id: t.id,
          booking_id: t.booking_id,
          lr_number: t.lr_number || formatDisplayId('TRP', t.id, t.created_at),
          tracking_number: t.lr_number || formatDisplayId('TRP', t.id, t.created_at),
          origin_city:
            t.pickup_city ||
            reqObj?.pickup_city ||
            (reqObj?.pickup_address
              ? reqObj.pickup_address.split(',')[0].trim()
              : 'Origin Depot'),
          destination_city:
            t.destination_city ||
            reqObj?.destination_city ||
            (reqObj?.destination_address
              ? reqObj.destination_address.split(',')[0].trim()
              : 'Destination Depot'),
          origin_address: reqObj?.pickup_address,
          destination_address: reqObj?.destination_address,
          shipment_status: shipmentStatus,
          raw_status: t.trip_status,
          created_at: t.created_at || bObj?.created_at,
          completed_at: t.completed_at,
          expected_delivery: t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-GB') : undefined,
          vehicle: vehObj?.registration_number || 'Transport Unit Assigned',
          vehicle_type: vehObj?.vehicle_type || reqObj?.vehicle_type || 'Commercial Fleet',
          driver_name: drvObj?.full_name || drvObj?.name || 'Driver Assigned',
          driver_phone: drvObj?.mobile || drvObj?.phone || '—',
          carrier: 'TRUCKS',
          freight_amount: bObj?.grand_total || bObj?.total_amount,
          bookings: bObj,
        });
      });

      // Add bookings that don't have an assigned trip yet (they are in 'Booked' status)
      bookingsData.forEach((b) => {
        if (!tripsByBookingId.has(b.id)) {
          const isCancelled = (b.booking_status || '').toUpperCase() === 'CANCELLED';
          result.push({
            id: b.id,
            booking_id: b.id,
            lr_number: formatDisplayId('BK', b.id, b.confirmed_at || b.created_at),
            tracking_number: formatDisplayId('BK', b.id, b.confirmed_at || b.created_at),
            origin_city:
              b.requirements?.pickup_city ||
              (b.requirements?.pickup_address
                ? b.requirements.pickup_address.split(',')[0].trim()
                : 'Origin Depot'),
            destination_city:
              b.requirements?.destination_city ||
              (b.requirements?.destination_address
                ? b.requirements.destination_address.split(',')[0].trim()
                : 'Destination Depot'),
            origin_address: b.requirements?.pickup_address,
            destination_address: b.requirements?.destination_address,
            shipment_status: isCancelled ? 'Cancelled' : 'Booked',
            raw_status: b.booking_status || 'BOOKED',
            created_at: b.confirmed_at || b.created_at,
            completed_at: undefined,
            expected_delivery: undefined,
            vehicle: 'Vehicle Allocation Pending',
            vehicle_type: b.requirements?.vehicle_type_required || b.requirements?.vehicle_type || 'Fleet Allocation Pending',
            driver_name: 'Driver Allocation Pending',
            driver_phone: '—',
            carrier: 'TRUCKS',
            freight_amount: b.total_amount,
            bookings: b,
          });
        }
      });

      clientShipmentsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch {
      return [];
    }
  },

  async saveTransportRequirementDraft(
    draft: Partial<TransportRequirementDraft>,
    clientId?: string
  ): Promise<boolean> {
    try {
      const key = `NECL_REQ_DRAFT_${clientId || 'default'}`;
      const existing = await this.getTransportRequirementDraft(clientId);
      const merged = {
        ...(existing || {}),
        ...draft,
        lastSavedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(merged));
      return true;
    } catch {
      return false;
    }
  },

  async getTransportRequirementDraft(
    clientId?: string
  ): Promise<Partial<TransportRequirementDraft> | null> {
    try {
      const key = `NECL_REQ_DRAFT_${clientId || 'default'}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) return JSON.parse(raw);
      if (clientId && clientId !== 'default') {
        const fallbackRaw = await AsyncStorage.getItem('NECL_REQ_DRAFT_default');
        if (fallbackRaw) return JSON.parse(fallbackRaw);
      }
      return null;
    } catch {
      return null;
    }
  },

  async clearTransportRequirementDraft(clientId?: string): Promise<void> {
    try {
      const key = `NECL_REQ_DRAFT_${clientId || 'default'}`;
      await AsyncStorage.removeItem(key);
      if (clientId && clientId !== 'default') {
        await AsyncStorage.removeItem('NECL_REQ_DRAFT_default');
      }
    } catch {}
  },

  // ─── 15. Phase 11: Commercial Invoicing & Payment Collection ──────────────────
  async generateInvoice(payload: GenerateInvoicePayload): Promise<{
    success: boolean;
    isIdempotent?: boolean;
    invoiceId?: string;
    invoiceNumber?: string;
    baseAmount?: number;
    taxableAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    totalTax?: number;
    totalAmount?: number;
    balanceDue?: number;
    paymentStatus?: string;
    message?: string;
  }> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/invoices/client/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, message: err?.message || 'Invoice generation request failed.' };
    }
  },

  async getInvoice(invoiceId: string): Promise<ClientInvoice | null> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/invoices/client/${encodeURIComponent(invoiceId)}`);
      const data = await resp.json();
      return data?.invoice || null;
    } catch {
      return null;
    }
  },

  async recordPayment(invoiceId: string, payload: RecordPaymentPayload): Promise<{
    success: boolean;
    invoiceId?: string;
    invoiceNumber?: string;
    amountPaid?: number;
    balanceDue?: number;
    paymentStatus?: string;
    transactionReference?: string;
    message?: string;
  }> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/invoices/client/${encodeURIComponent(invoiceId)}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (err: any) {
      return { success: false, message: err?.message || 'Payment recording failed.' };
    }
  },

  async getFinancialReconciliation(): Promise<FinancialReconciliation | null> {
    try {
      const resp = await fetch(`${getBackendApiUrl()}/api/finance/reconciliation`);
      const data = await resp.json();
      return data?.summary || null;
    } catch {
      return null;
    }
  },
};

