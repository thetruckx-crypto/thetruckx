import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, ensureMobileSession } from '../supabase';
import { MobileRole, ClientProfileFormData, ScreenId } from '../types';

export const SESSION_STORAGE_KEY = 'necl_mobile_session_v2';
export const USER_REGISTRY_KEY = '@necl_user_registry_v4';
export const ROLE_DEACTIVATION_REQUESTS_KEY = '@necl_role_deactivation_requests_v3';

export function getBackendApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || '';
  const hostIp = hostUri ? hostUri.split(':')[0] : '';

  if (envUrl && !envUrl.includes('192.168.0.114')) {
    if (Platform.OS === 'android') {
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return envUrl.replace(/localhost|127\.0\.0\.1|10\.0\.2\.2/, hostIp);
      }
      return envUrl;
    }
    return envUrl;
  }

  if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
    return `http://${hostIp}:5000/api`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
}

const roleCheckCache = new Map<string, { result: MobileRegistrationCheckResult; timestamp: number }>();
const ROLE_CHECK_TTL = 30 * 1000; // 30 seconds

export function invalidateRoleCheckCache(mobile?: string) {
  if (mobile) {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
    for (const key of roleCheckCache.keys()) {
      if (key.includes(cleanPhone)) roleCheckCache.delete(key);
    }
  } else {
    roleCheckCache.clear();
  }
}

async function callBackendApi<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T | null> {
  try {
    const controller = new AbortController();
    // Fast 800ms timeout so offline/local-only apps never stall navigation
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${getBackendApiUrl()}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `API error ${res.status}`);
      (err as any).status = res.status;
      (err as any).data = data;
      throw err;
    }
    return data;
  } catch (e: any) {
    if (e?.status && e.status >= 400 && e.status < 500) {
      throw e;
    }
    return null;
  }
}

export interface AuthSessionData {
  userId: string;
  mobile: string;
  role: MobileRole;
  fullName: string;
  companyName?: string;
  token: string;
  createdAt: string;
  accountStatus?: string;
  isRegistrationComplete?: boolean;
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
}

export interface RegisteredUserRecord {
  mobile: string;
  role: MobileRole;
  fullName: string;
  email?: string;
  companyName?: string;
  status:
  | 'ACTIVE'
  | 'PENDING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTIONS_REQUESTED'
  | 'DEACTIVATED'
  | string;
  registeredAt: string;
}

export interface RoleDeactivationRequest {
  id: string;
  mobile: string;
  currentRole: MobileRole;
  requestedRole: MobileRole;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedAt?: string;
}

export interface MobileRegistrationCheckResult {
  isRegistered: boolean;
  registeredRole?: MobileRole;
  isRegisteredOtherRole: boolean;
  otherRole?: MobileRole;
  status:
  | 'ACTIVE'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTIONS_REQUESTED'
  | 'PENDING_APPROVAL'
  | 'INACTIVE'
  | 'DEACTIVATED'
  | 'NOT_REGISTERED'
  | string;
  isRegistrationComplete?: boolean;
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  missingFields?: string[];
  nextStep?: string;
  userProfile?: any;
  message?: string;
}

export const authService = {
  // ─── 0. User Registry Persistence ──────────────────────────────────────────
  async getLocalRegistry(): Promise<RegisteredUserRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(USER_REGISTRY_KEY);
      if (!stored) {
        return [];
      }
      const parsed: RegisteredUserRecord[] = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveLocalRegistry(records: RegisteredUserRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(records));
      if (records.length > 0) {
        const latest = records[0];
        callBackendApi('/auth/register-sync', 'POST', {
          fullName: latest.fullName,
          mobile: latest.mobile,
          role: latest.role,
          email: latest.email,
          companyName: latest.companyName,
          status: latest.status,
        }).catch(() => { });
      }
    } catch (e) {
      console.warn('Failed to save user registry:', e);
    }
  },

  // ─── 0.1 Role Deactivation Requests ─────────────────────────────────────────
  async getDeactivationRequests(): Promise<RoleDeactivationRequest[]> {
    try {
      const stored = await AsyncStorage.getItem(ROLE_DEACTIVATION_REQUESTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  async saveDeactivationRequests(reqs: RoleDeactivationRequest[]): Promise<void> {
    try {
      await AsyncStorage.setItem(ROLE_DEACTIVATION_REQUESTS_KEY, JSON.stringify(reqs));
    } catch (e) {
      console.warn('Failed to save deactivation requests:', e);
    }
  },

  // ─── 0.2 Check Mobile Registration Across All Roles ─────────────────────────
  async checkMobileRegistration(
    phoneNumber: string,
    requestedRole?: MobileRole
  ): Promise<MobileRegistrationCheckResult> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return {
        isRegistered: false,
        isRegisteredOtherRole: false,
        status: 'NOT_REGISTERED',
        message: 'Please enter a valid 10-digit mobile number.',
      };
    }

    // 1. Attempt Backend API validation first
    try {
      const apiRes = await callBackendApi<any>('/auth/check-registration', 'POST', {
        mobile: cleanPhone,
        role: requestedRole,
      });

      if (apiRes && typeof apiRes.isRegistered === 'boolean') {
        const registry = await this.getLocalRegistry();

        // Sync local registry if verified by backend
        if (apiRes.isRegistered && apiRes.registeredRole) {
          const filtered = registry.filter((u) => u.mobile !== cleanPhone);
          filtered.unshift({
            mobile: cleanPhone,
            role: apiRes.registeredRole,
            fullName: apiRes.userProfile?.fullName || apiRes.userProfile?.name || 'Registered User',
            email: apiRes.userProfile?.email,
            companyName: apiRes.userProfile?.companyName || apiRes.userProfile?.company,
            status: apiRes.status || 'ACTIVE',
            registeredAt: new Date().toISOString(),
          });
          await this.saveLocalRegistry(filtered);
        }

        return {
          isRegistered: apiRes.isRegistered,
          registeredRole: apiRes.registeredRole,
          isRegisteredOtherRole: apiRes.isRegisteredOtherRole,
          otherRole: apiRes.otherRole,
          status: apiRes.status,
          isRegistrationComplete: apiRes.isRegistrationComplete,
          profileCompletionStatus: apiRes.profileCompletionStatus,
          missingFields: apiRes.missingFields,
          nextStep: apiRes.nextStep,
          userProfile: apiRes.userProfile,
          message: apiRes.message,
        };
      }
    } catch (apiErr: any) {
      console.warn('Backend registration check notice, using direct queries:', apiErr?.message);
    }

    // 2. Ensure mobile session for direct database queries
    await ensureMobileSession().catch(() => { });

    // 3. Fallback: Query Supabase across role tables and RPC in parallel
    const activeRoles: Array<{
      role: MobileRole;
      profile: any;
      status: string;
      isComplete?: boolean;
      missingFields?: string[];
      nextStep?: string;
    }> = [];

    // Priority 3a: Check SECURITY DEFINER RPC check_client_account_status
    try {
      const { data: rpcClient, error: rpcErr } = await supabase.rpc('check_client_account_status', {
        p_mobile: cleanPhone,
      });

      if (!rpcErr && rpcClient && rpcClient.status && rpcClient.status !== 'NEW_USER' && rpcClient.status !== 'NOT_FOUND') {
        if (rpcClient.status === 'ROLE_CONFLICT') {
          activeRoles.push({
            role: rpcClient.previous_role || 'VENDOR',
            status: 'ACTIVE',
            isComplete: true,
            missingFields: [],
            profile: {
              name: `${rpcClient.previous_role || 'Other'} User`,
              mobile: cleanPhone,
            },
          });
        } else {
          const rawStatus = rpcClient.status;
          const normalizedStatus = rawStatus === 'APPROVED' || rawStatus === 'ACTIVE' ? 'APPROVED' : rawStatus;
          activeRoles.push({
            role: 'CLIENT',
            profile: {
              name: rpcClient.full_name,
              fullName: rpcClient.full_name,
              email: rpcClient.email,
              company: rpcClient.company_name || 'Client Enterprise',
              companyName: rpcClient.company_name || 'Client Enterprise',
              clientId: rpcClient.company_id,
              companyId: rpcClient.company_id,
              clientCode: rpcClient.client_code,
              status: normalizedStatus,
              rejectionReason: rpcClient.rejection_reason,
              correctionNotes: rpcClient.correction_notes,
              mobile: cleanPhone,
            },
            status: normalizedStatus,
            isComplete: normalizedStatus === 'APPROVED' || normalizedStatus === 'PENDING_APPROVAL',
            missingFields: [],
            nextStep: normalizedStatus === 'APPROVED' ? undefined : 'CLIENT_BUSINESS_DETAILS',
          });
        }
      }
    } catch (rpcE) {
      console.warn('RPC check_client_account_status notice:', rpcE);
    }

    // Priority 3b: Direct database table checks
    try {
      const [clientRes, vendorRes, driverRes] = await Promise.all([
        supabase
          .from('client_users')
          .select('*, client_companies(*)')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle(),
        supabase
          .from('vendor_users')
          .select('*, vendor_companies(*)')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle(),
        supabase
          .from('drivers')
          .select('*')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone},phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
          .maybeSingle(),
      ]);

      if (clientRes.data && clientRes.data.status !== 'DEACTIVATED') {
        const comp = clientRes.data.client_companies;
        const rawCompStatus = comp?.status || clientRes.data.status || 'PENDING_APPROVAL';
        const compStatus = rawCompStatus === 'APPROVED' || rawCompStatus === 'ACTIVE'
          ? 'APPROVED'
          : rawCompStatus === 'INACTIVE'
            ? 'INACTIVE'
            : rawCompStatus;
        const clientMissing: string[] = [];
        if (!comp?.company_name) clientMissing.push('Company Name');
        if (!comp?.pan && !comp?.gstin) clientMissing.push('PAN / GSTIN');
        if (!comp?.registered_address) clientMissing.push('Registered Address');
        const isClientApproved = compStatus === 'APPROVED';
        const isClientComplete = isClientApproved || (clientMissing.length === 0 && compStatus !== 'INACTIVE');

        if (!activeRoles.some((r) => r.role === 'CLIENT')) {
          activeRoles.push({
            role: 'CLIENT',
            profile: {
              name: clientRes.data.full_name,
              fullName: clientRes.data.full_name,
              email: clientRes.data.email,
              company: comp?.company_name || 'Client Enterprise',
              companyName: comp?.company_name || 'Client Enterprise',
              clientId: comp?.id || clientRes.data.client_company_id || clientRes.data.id,
              companyId: comp?.id || clientRes.data.client_company_id || clientRes.data.id,
              clientCode: comp?.client_code,
              status: compStatus,
              rejectionReason: comp?.rejection_reason,
              correctionNotes: comp?.correction_notes,
              mobile: cleanPhone,
            },
            status: compStatus,
            isComplete: isClientComplete,
            missingFields: clientMissing,
            nextStep: clientMissing.length > 0 ? 'CLIENT_BUSINESS_DETAILS' : 'CLIENT_DOC_UPLOAD',
          });
        }
      }

      if (vendorRes.data && vendorRes.data.status !== 'DEACTIVATED') {
        const comp = vendorRes.data.vendor_companies;
        const compStatus = comp?.status || 'PENDING';
        const vendorMissing: string[] = [];
        if (!comp?.vendor_name || comp.vendor_name === 'Active Registration') vendorMissing.push('Transporter Name');
        if (!comp?.pan || comp.pan === 'NOT_PROVIDED' || comp.pan.length !== 10) vendorMissing.push('PAN');
        if (!comp?.address) vendorMissing.push('Address');
        const isVendorApproved = compStatus === 'APPROVED';
        const isVendorComplete = isVendorApproved || (vendorMissing.length === 0 && compStatus !== 'INACTIVE');

        if (!activeRoles.some((r) => r.role === 'VENDOR')) {
          activeRoles.push({
            role: 'VENDOR',
            profile: {
              name: vendorRes.data.full_name || comp?.vendor_name,
              email: vendorRes.data.email,
              company: comp?.vendor_name,
              vendorId: comp?.id || vendorRes.data.vendor_id || vendorRes.data.id,
            },
            status: compStatus,
            isComplete: isVendorComplete,
            missingFields: vendorMissing,
            nextStep: vendorMissing.includes('Transporter Name') || vendorMissing.includes('PAN')
              ? 'VENDOR_BUSINESS_INFO'
              : vendorMissing.includes('Address')
                ? 'VENDOR_ADDRESS_CONTACT'
                : 'VENDOR_FLEET_INFO',
          });
        }
      } else if (!activeRoles.some((r) => r.role === 'VENDOR')) {
        // Direct vendor_companies check if vendor_users record was not linked yet
        const { data: directComp } = await supabase
          .from('vendor_companies')
          .select('*')
          .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
          .maybeSingle();
        if (directComp && directComp.status !== 'DEACTIVATED') {
          const compStatus = directComp.status || 'PENDING';
          const vendorMissing: string[] = [];
          if (!directComp.vendor_name || directComp.vendor_name === 'Active Registration') vendorMissing.push('Transporter Name');
          if (!directComp.pan || directComp.pan === 'NOT_PROVIDED' || directComp.pan.length !== 10) vendorMissing.push('PAN');
          if (!directComp.address) vendorMissing.push('Address');
          const isVendorApproved = compStatus === 'APPROVED';
          const isVendorComplete = isVendorApproved || (vendorMissing.length === 0 && compStatus !== 'INACTIVE');

          activeRoles.push({
            role: 'VENDOR',
            profile: {
              name: directComp.vendor_name,
              company: directComp.vendor_name,
              vendorId: directComp.id,
            },
            status: compStatus,
            isComplete: isVendorComplete,
            missingFields: vendorMissing,
            nextStep: 'VENDOR_BUSINESS_INFO',
          });
        }
      }

      if (driverRes.data && driverRes.data.status !== 'DEACTIVATED') {
        const d = driverRes.data;
        const driverStatus = d.status || 'PENDING';
        const driverMissing: string[] = [];
        if (!d.full_name || d.full_name === 'Registration in progress') driverMissing.push('Full Name');
        if (!d.licence_number || d.licence_number.startsWith(`DL-${cleanPhone}`) || d.licence_number.includes('Pending')) {
          driverMissing.push('Driving Licence');
        }
        if (!d.primary_vendor_id) driverMissing.push('Transporter Association');
        const isDriverApproved = driverStatus === 'APPROVED';
        const isDriverComplete = isDriverApproved || (driverMissing.length === 0 && driverStatus !== 'INACTIVE');

        if (!activeRoles.some((r) => r.role === 'DRIVER')) {
          activeRoles.push({
            role: 'DRIVER',
            profile: {
              id: d.id,
              name: d.full_name || d.name,
              licenceNumber: d.licence_number,
            },
            status: driverStatus,
            isComplete: isDriverComplete,
            missingFields: driverMissing,
            nextStep: 'DRIVER_REGISTRATION',
          });
        }
      }
    } catch (e) {
      console.warn('Supabase cross-role check notice:', e);
    }

    // 4. Prune stale local registry if DB returned nothing
    if (activeRoles.length === 0) {
      const registry = await this.getLocalRegistry();
      const existingInRegistry = registry.find((u) => u.mobile === cleanPhone);
      if (existingInRegistry) {
        const filtered = registry.filter((u) => u.mobile !== cleanPhone);
        await this.saveLocalRegistry(filtered);
      }
    }

    if (activeRoles.length === 0) {
      return {
        isRegistered: false,
        isRegisteredOtherRole: false,
        status: 'NOT_REGISTERED',
        isRegistrationComplete: false,
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: [],
        userProfile: null,
        message: 'You are not registered yet. Please register before logging in.',
      };
    }

    // Sync client local registry if approved
    const matchedClientRole = activeRoles.find((r) => r.role === 'CLIENT');
    if (matchedClientRole && (matchedClientRole.status === 'APPROVED' || matchedClientRole.status === 'ACTIVE')) {
      try {
        const registry = await this.getLocalRegistry();
        const filtered = registry.filter((u) => u.mobile !== cleanPhone);
        filtered.unshift({
          mobile: cleanPhone,
          role: 'CLIENT',
          fullName: matchedClientRole.profile?.fullName || matchedClientRole.profile?.name || 'Registered Client',
          email: matchedClientRole.profile?.email,
          companyName: matchedClientRole.profile?.companyName || matchedClientRole.profile?.company,
          status: 'APPROVED',
          registeredAt: new Date().toISOString(),
        });
        await this.saveLocalRegistry(filtered);
      } catch { }
    }

    if (requestedRole) {
      const matched = activeRoles.find((r) => r.role === requestedRole);
      if (matched) {
        return {
          isRegistered: true,
          registeredRole: matched.role,
          isRegisteredOtherRole: false,
          otherRole: undefined,
          status: matched.status,
          isRegistrationComplete: matched.isComplete ?? true,
          profileCompletionStatus: (matched.isComplete ?? true) ? 'COMPLETE' : 'INCOMPLETE',
          missingFields: matched.missingFields ?? [],
          nextStep: matched.nextStep,
          userProfile: matched.profile,
          message: `Registered as ${matched.role}`,
        };
      } else {
        const other = activeRoles[0];
        return {
          isRegistered: false,
          registeredRole: other.role,
          isRegisteredOtherRole: true,
          otherRole: other.role,
          status: other.status,
          isRegistrationComplete: other.isComplete ?? true,
          profileCompletionStatus: (other.isComplete ?? true) ? 'COMPLETE' : 'INCOMPLETE',
          missingFields: other.missingFields ?? [],
          nextStep: other.nextStep,
          userProfile: other.profile,
          message: `This mobile number is registered under the ${other.role} role. Please select the correct role or complete the appropriate registration process.`,
        };
      }
    }

    const first = activeRoles[0];
    return {
      isRegistered: true,
      registeredRole: first.role,
      isRegisteredOtherRole: false,
      otherRole: undefined,
      status: first.status,
      isRegistrationComplete: first.isComplete ?? true,
      profileCompletionStatus: (first.isComplete ?? true) ? 'COMPLETE' : 'INCOMPLETE',
      missingFields: first.missingFields ?? [],
      nextStep: first.nextStep,
      userProfile: first.profile,
      message: `Registered as ${first.role}`,
    };
  },

  // ─── 0.3 Request Admin Role Deactivation / Reset ───────────────────────────
  async requestAdminRoleDeactivation(
    mobile: string,
    currentRole: MobileRole,
    requestedRole: MobileRole,
    reason: string = 'User registered under incorrect role and requires account reset'
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
    const requestId = 'REQ-ROLE-' + Math.floor(100000 + Math.random() * 900000);

    const newRequest: RoleDeactivationRequest = {
      id: requestId,
      mobile: cleanPhone,
      currentRole,
      requestedRole,
      reason,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    const existingReqs = await this.getDeactivationRequests();
    // Replace any previous pending request for this mobile
    const filtered = existingReqs.filter((r) => r.mobile !== cleanPhone);
    filtered.unshift(newRequest);
    await this.saveDeactivationRequests(filtered);

    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: cleanPhone,
          user_type: 'MOBILE_ROLE_DISPUTE',
          event_type: 'ROLE_DEACTIVATION_REQUESTED',
          details: newRequest,
        },
      ]);
    } catch { }

    return {
      success: true,
      requestId,
      message: `Deactivation request ${requestId} submitted to Admin. An administrator will verify and deactivate the previous ${currentRole} account so you can register as ${requestedRole}.`,
    };
  },

  // ─── 0.4 Admin Action: Deactivate Account for Role Re-Registration ─────────
  async adminDeactivateAccount(
    mobile: string,
    role: MobileRole
  ): Promise<{ success: boolean; message: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);

    // Update local registry
    const registry = await this.getLocalRegistry();
    const updated = registry.map((u) => {
      if (u.mobile === cleanPhone) {
        return { ...u, status: 'DEACTIVATED' as const };
      }
      return u;
    });
    await this.saveLocalRegistry(updated);

    // Mark deactivation request as approved
    const reqs = await this.getDeactivationRequests();
    const updatedReqs = reqs.map((r) => {
      if (r.mobile === cleanPhone) {
        return { ...r, status: 'APPROVED' as const, resolvedAt: new Date().toISOString() };
      }
      return r;
    });
    await this.saveDeactivationRequests(updatedReqs);

    // Update Supabase if possible
    try {
      if (role === 'CLIENT') {
        await supabase.from('client_users').update({ status: 'DEACTIVATED' }).eq('mobile', cleanPhone);
      } else if (role === 'VENDOR') {
        await supabase.from('vendor_users').update({ status: 'DEACTIVATED' }).eq('mobile', cleanPhone);
      } else if (role === 'DRIVER') {
        await supabase.from('drivers').update({ status: 'DEACTIVATED' }).eq('mobile', cleanPhone);
      }
    } catch { }

    return {
      success: true,
      message: `Account for mobile ${cleanPhone} (${role}) has been deactivated. The user may now register under their correct role.`,
    };
  },

  // ─── 0.5 Admin Action: Delete Account ──────────────────────────────────────
  async adminDeleteAccount(
    mobile: string,
    role: MobileRole
  ): Promise<{ success: boolean; message: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);

    // Remove from local registry
    const registry = await this.getLocalRegistry();
    const filtered = registry.filter((u) => u.mobile !== cleanPhone);
    await this.saveLocalRegistry(filtered);

    // Remove from deactivation requests
    const reqs = await this.getDeactivationRequests();
    const filteredReqs = reqs.filter((r) => r.mobile !== cleanPhone);
    await this.saveDeactivationRequests(filteredReqs);

    try {
      if (role === 'CLIENT') {
        await supabase.from('client_users').delete().eq('mobile', cleanPhone);
      } else if (role === 'VENDOR') {
        await supabase.from('vendor_users').delete().eq('mobile', cleanPhone);
      } else if (role === 'DRIVER') {
        await supabase.from('drivers').delete().eq('mobile', cleanPhone);
      }
    } catch { }

    return {
      success: true,
      message: `Account for mobile ${cleanPhone} (${role}) has been deleted. The mobile number is now free to register again.`,
    };
  },

  // ─── 0.6 Immediate User Registration & Database Persistence ────────────────
  async registerUserImmediately(data: {
    fullName: string;
    mobileNumber: string;
    emailAddress?: string;
    role: MobileRole;
  }): Promise<{ success: boolean; userId: string; message: string }> {
    const cleanPhone = data.mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    const trimmedName = data.fullName.trim();
    const trimmedEmail = (data.emailAddress || '').trim().toLowerCase();

    // Cross-role verification: Check if already registered under a different role
    const check = await this.checkMobileRegistration(cleanPhone, data.role);
    if (check.isRegisteredOtherRole && check.status !== 'DEACTIVATED') {
      throw new Error(
        `WRONG_ROLE_REGISTERED: This mobile number is already registered under the ${check.otherRole} role.\n\nTo register as a ${data.role}, an TRUCKS Administrator must verify and deactivate/delete your previous ${check.otherRole} account first.`
      );
    }
    if (check.isRegistered && check.status !== 'DEACTIVATED') {
      throw new Error(
        `ALREADY_REGISTERED: This mobile number is already registered as a ${data.role}. Please proceed to login with OTP.`
      );
    }

    const userId = `${data.role.toLowerCase()}-${cleanPhone}-${Date.now()}`;
    const companyName =
      data.role === 'CLIENT'
        ? `${trimmedName} Enterprise`
        : data.role === 'VENDOR'
          ? `${trimmedName} Logistics`
          : 'TRUCKS Logistics Fleet';

    // 1. Immediately persist to database (Supabase)
    try {
      if (data.role === 'CLIENT') {
        const { data: comp } = await supabase
          .from('client_companies')
          .insert([
            {
              company_name: companyName,
              status: 'ACTIVE',
              registered_address: 'Operational Logistics Hub',
              city: 'Guwahati',
              pincode: '781001',
            },
          ])
          .select()
          .maybeSingle();

        const compId = comp?.id || `comp-${cleanPhone}`;
        await supabase.from('client_users').insert([
          {
            client_company_id: compId,
            full_name: trimmedName,
            mobile: cleanPhone,
            email: trimmedEmail || `${cleanPhone}@neclclient.in`,
            status: 'ACTIVE',
          },
        ]);
      } else if (data.role === 'VENDOR') {
        const { data: vComp } = await supabase
          .from('vendor_companies')
          .insert([
            {
              vendor_name: companyName,
              status: 'PENDING',
              address: 'Regional Freight Corridor Hub',
            },
          ])
          .select()
          .maybeSingle();

        const vId = vComp?.id || `ven-${cleanPhone}`;
        await supabase.from('vendor_users').insert([
          {
            vendor_id: vId,
            full_name: trimmedName,
            mobile: cleanPhone,
            email: trimmedEmail || `${cleanPhone}@neclvendor.in`,
          },
        ]);
      } else if (data.role === 'DRIVER') {
        await supabase.from('drivers').insert([
          {
            full_name: trimmedName,
            mobile: cleanPhone,
            licence_number: `DL-${cleanPhone.slice(-4)}-NECL`,
            licence_expiry_date: '2028-12-31',
            status: 'PENDING',
          },
        ]);
      }
    } catch (dbErr) {
      console.warn('Supabase immediate registration notice:', dbErr);
    }

    // 2. Immediately persist to local registry
    const registry = await this.getLocalRegistry();
    const existingIndex = registry.findIndex((u) => u.mobile === cleanPhone);
    const newRecord: RegisteredUserRecord = {
      mobile: cleanPhone,
      role: data.role,
      fullName: trimmedName,
      email: trimmedEmail,
      companyName,
      status: 'ACTIVE',
      registeredAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      registry[existingIndex] = newRecord;
    } else {
      registry.unshift(newRecord);
    }
    await this.saveLocalRegistry(registry);

    // 3. Mark any past deactivation request as resolved
    const reqs = await this.getDeactivationRequests();
    const updatedReqs = reqs.map((r) => {
      if (r.mobile === cleanPhone) {
        return { ...r, status: 'APPROVED' as const, resolvedAt: new Date().toISOString() };
      }
      return r;
    });
    await this.saveDeactivationRequests(updatedReqs);

    // 4. Log audit trail
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: cleanPhone,
          user_type: 'MOBILE_REGISTRATION',
          event_type: 'USER_REGISTERED_IMMEDIATE',
          details: { role: data.role, name: trimmedName, mobile: cleanPhone },
        },
      ]);
    } catch { }

    return {
      success: true,
      userId,
      message: `Registration data saved immediately for ${trimmedName} (${data.role}).`,
    };
  },

  // ─── 0.7 Ensure Initial Draft Registration in Database & Registry ──────────
  async ensureInitialRegistrationDraft(
    role: MobileRole,
    mobile: string,
    initialData?: { fullName?: string; email?: string; companyName?: string }
  ): Promise<{ success: boolean; userId: string }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return { success: false, userId: '' };
    }

    try {
      await ensureMobileSession().catch(() => { });

      if (role === 'CLIENT') {
        const { data: existingUser } = await supabase
          .from('client_users')
          .select('id, client_company_id, status')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();

        if (!existingUser) {
          const compName = initialData?.companyName || 'Active Registration (Pending Details)';
          const { data: comp } = await supabase
            .from('client_companies')
            .insert([
              {
                company_name: compName,
                status: 'INACTIVE',
                registered_address: 'Operational Logistics Hub',
                city: 'Guwahati',
                pincode: '781001',
              },
            ])
            .select()
            .maybeSingle();

          const compId = comp?.id || `comp-${cleanPhone}`;
          await supabase.from('client_users').insert([
            {
              client_company_id: compId,
              full_name: initialData?.fullName || 'Active Registration',
              mobile: cleanPhone,
              email: initialData?.email || `${cleanPhone}@neclclient.in`,
              status: 'INACTIVE',
            },
          ]);
        }
      } else if (role === 'VENDOR') {
        const { data: existingUser } = await supabase
          .from('vendor_users')
          .select('id, vendor_id')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle();

        if (!existingUser) {
          const compName = initialData?.companyName || 'Active Registration (Pending Details)';
          const { data: vComp } = await supabase
            .from('vendor_companies')
            .insert([
              {
                vendor_name: compName,
                phone: cleanPhone,
                status: 'INACTIVE',
                is_verified: false,
                is_profile_completed: false,
                address: 'Regional Freight Corridor Hub',
              },
            ])
            .select()
            .maybeSingle();

          const vId = vComp?.id || `ven-${cleanPhone}`;
          await supabase.from('vendor_users').insert([
            {
              vendor_id: vId,
              full_name: initialData?.fullName || 'Active Registration',
              mobile: cleanPhone,
              email: initialData?.email || `${cleanPhone}@neclvendor.in`,
              status: 'INACTIVE',
            },
          ]);
        }
      } else if (role === 'DRIVER') {
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('id, status')
          .or(`mobile.eq.${cleanPhone},phone.eq.${cleanPhone}`)
          .maybeSingle();

        if (!existingDriver) {
          await supabase.from('drivers').insert([
            {
              full_name: initialData?.fullName || 'Registration in progress',
              mobile: cleanPhone,
              licence_number: `DL-${cleanPhone.slice(-4)}-PENDING`,
              licence_expiry_date: '2028-12-31',
              status: 'INACTIVE',
            },
          ]);
        }
      }

      // Record in local registry
      const registry = await this.getLocalRegistry();
      const existingIdx = registry.findIndex((u) => u.mobile === cleanPhone);
      const draftRecord: RegisteredUserRecord = {
        mobile: cleanPhone,
        role,
        fullName: initialData?.fullName || 'Active Registration',
        email: initialData?.email,
        companyName: initialData?.companyName || (role === 'CLIENT' ? 'Client Enterprise' : role === 'VENDOR' ? 'Transport Firm' : 'Commercial Driver'),
        status: 'INACTIVE',
        registeredAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        registry[existingIdx] = { ...registry[existingIdx], ...draftRecord };
      } else {
        registry.unshift(draftRecord);
      }
      await this.saveLocalRegistry(registry);
      invalidateRoleCheckCache(cleanPhone);

      return { success: true, userId: `${role.toLowerCase()}-${cleanPhone}` };
    } catch (e) {
      console.warn('ensureInitialRegistrationDraft notice:', e);
      return { success: false, userId: '' };
    }
  },

  // ─── 0.8 Check Comprehensive Registration Completion Status ───────────────
  async checkRegistrationCompletion(
    role: MobileRole,
    mobile: string,
    userProfile?: any
  ): Promise<{
    isComplete: boolean;
    accountStatus: string;
    profileCompletionStatus: 'COMPLETE' | 'INCOMPLETE';
    missingFields: string[];
    nextScreen: ScreenId;
    resumedData?: any;
    message?: string;
  }> {
    const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);

    // Call backend API if available for atomic evaluation
    try {
      const apiRes = await callBackendApi<any>(`/auth/registration-status?mobile=${cleanPhone}&role=${role}`);
      if (apiRes && apiRes.success) {
        let fallbackScreen: ScreenId = role === 'CLIENT' ? 'CLIENT_DASHBOARD' : role === 'VENDOR' ? 'VENDOR_DASHBOARD' : 'DRIVER_DASHBOARD';
        if (!apiRes.isRegistrationComplete) {
          fallbackScreen = (apiRes.nextStep as ScreenId) || (role === 'CLIENT' ? 'CLIENT_BUSINESS_DETAILS' : role === 'VENDOR' ? 'VENDOR_REGISTRATION' : 'DRIVER_REGISTRATION');
        } else if (apiRes.accountStatus !== 'APPROVED' && apiRes.accountStatus !== 'ACTIVE') {
          fallbackScreen = role === 'CLIENT' ? 'REGISTRATION_STATUS' : role === 'VENDOR' ? 'VENDOR_VERIFICATION_STATUS' : 'DRIVER_VERIFICATION_STATUS';
        }

        return {
          isComplete: apiRes.isRegistrationComplete ?? true,
          accountStatus: apiRes.accountStatus || 'ACTIVE',
          profileCompletionStatus: apiRes.profileCompletionStatus || (apiRes.isRegistrationComplete ? 'COMPLETE' : 'INCOMPLETE'),
          missingFields: apiRes.missingFields || [],
          nextScreen: fallbackScreen,
          resumedData: apiRes.userProfile,
          message: apiRes.message,
        };
      }
    } catch { }

    if (role === 'CLIENT') {
      const { clientService } = require('./clientService');
      const statusRes = await clientService.getClientAccountStatus(cleanPhone, true);
      const isApproved = statusRes.status === 'APPROVED' || (statusRes as any).status === 'ACTIVE';

      if (isApproved) {
        return {
          isComplete: true,
          accountStatus: 'APPROVED',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'CLIENT_DASHBOARD',
        };
      }

      const resumed = await clientService.loadClientRegistrationData(cleanPhone);
      const missing: string[] = statusRes.incompleteFields || [];
      const isComplete = (!statusRes.incompleteFields || statusRes.incompleteFields.length === 0) && statusRes.status !== 'INACTIVE';

      if (isComplete) {
        return {
          isComplete: true,
          accountStatus: statusRes.status || 'PENDING_APPROVAL',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'REGISTRATION_STATUS',
          resumedData: resumed,
        };
      }

      // Determine next registration step to resume
      let nextScreen: ScreenId = 'CLIENT_PROFILE';
      if (!resumed?.profileData?.fullName) {
        nextScreen = 'CLIENT_PROFILE';
      } else if (!resumed?.businessDetails?.companyName || !resumed?.businessDetails?.pan || !resumed?.businessDetails?.pincode) {
        nextScreen = 'CLIENT_BUSINESS_DETAILS';
      } else if (!resumed?.documents || resumed.documents.length === 0) {
        nextScreen = 'CLIENT_DOC_UPLOAD';
      } else {
        nextScreen = 'CLIENT_REG_REVIEW';
      }

      return {
        isComplete: false,
        accountStatus: statusRes.status || 'INACTIVE',
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: missing.length > 0 ? missing : ['Business Details', 'KYC Documents'],
        nextScreen,
        resumedData: resumed,
        message: 'Registration incomplete. Please resume and complete missing profile details.',
      };
    }

    if (role === 'VENDOR') {
      const { vendorService } = require('./vendorService');
      const vId = userProfile?.vendorId || userProfile?.id;
      const statusRes = await vendorService.getVendorVerificationStatus(vId, cleanPhone);

      if (statusRes.status === 'APPROVED') {
        return {
          isComplete: true,
          accountStatus: 'APPROVED',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'VENDOR_DASHBOARD',
        };
      }

      const resumed = await vendorService.loadAuthenticatedVendorRegistration(vId, cleanPhone);
      const validation = vendorService.validateVendorRegistrationData(resumed, resumed?.documents);

      const missing: string[] = [];
      for (const step of validation.incompleteSteps) {
        missing.push(...step.missingFields);
      }

      const isComplete = validation.isAllComplete && statusRes.status !== 'INACTIVE';

      if (isComplete) {
        return {
          isComplete: true,
          accountStatus: statusRes.status || 'PENDING',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'VENDOR_VERIFICATION_STATUS',
          resumedData: resumed,
        };
      }

      // Determine the first incomplete step to resume
      const nextScreen: ScreenId = validation.firstIncompleteStep?.screenId || 'VENDOR_APPLICATION_REVIEW';

      return {
        isComplete: false,
        accountStatus: statusRes.status || 'INACTIVE',
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: missing.length > 0 ? missing : ['Vendor Profile Details'],
        nextScreen,
        resumedData: resumed,
        message: 'Vendor registration incomplete. Please resume and complete required onboarding information.',
      };
    }

    if (role === 'DRIVER') {
      const { driverService } = require('./driverService');
      const dId = userProfile?.driverId || userProfile?.id;
      const profile = await driverService.getDriverProfile(dId, cleanPhone);

      if (profile && profile.status === 'APPROVED') {
        return {
          isComplete: true,
          accountStatus: 'APPROVED',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'DRIVER_DASHBOARD',
        };
      }

      const resumed = await driverService.loadAuthenticatedDriverRegistration(dId, cleanPhone);
      const missing: string[] = [];
      if (!resumed?.fullName || resumed?.fullName === 'Registration in progress') {
        missing.push('Full Name');
      }
      if (!resumed?.licenceNumber || resumed.licenceNumber.includes('PENDING') || resumed.licenceNumber.startsWith(`DL-${cleanPhone}`)) {
        missing.push('Valid Driving Licence');
      }
      if (!resumed?.transporterId) {
        missing.push('Transporter Association');
      }
      if (!resumed?.documents || resumed.documents.length === 0) {
        missing.push('Licence / KYC Document');
      }

      const isComplete = missing.length === 0 && profile?.status !== 'INACTIVE';

      if (isComplete) {
        return {
          isComplete: true,
          accountStatus: profile?.status || 'PENDING',
          profileCompletionStatus: 'COMPLETE',
          missingFields: [],
          nextScreen: 'DRIVER_VERIFICATION_STATUS',
          resumedData: resumed,
        };
      }

      return {
        isComplete: false,
        accountStatus: profile?.status || 'INACTIVE',
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: missing,
        nextScreen: 'DRIVER_REGISTRATION',
        resumedData: resumed,
        message: 'Driver registration incomplete. Please resume and complete driving licence and documents.',
      };
    }

    return {
      isComplete: true,
      accountStatus: 'ACTIVE',
      profileCompletionStatus: 'COMPLETE',
      missingFields: [],
      nextScreen: 'LOGIN',
    };
  },

  // ─── 1. Check Existing Active Session ──────────────────────────────────────
  async getCurrentSession(): Promise<AuthSessionData | null> {
    return this.checkExistingSession();
  },

  async checkExistingSession(): Promise<AuthSessionData | null> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      const parsed: AuthSessionData = JSON.parse(stored);
      if (!parsed.mobile || !parsed.role) return null;

      // Verify that the user actually exists in the database
      const cleanPhone = parsed.mobile.replace(/[^0-9]/g, '').slice(-10);
      const reg = await this.checkMobileRegistration(cleanPhone, parsed.role);
      if (!reg.isRegistered || reg.status === 'DEACTIVATED') {
        // Stale or deleted user session -> wipe local session and cached data
        await this.clearSession();
        await this.resetAllLocalData();
        return null;
      }

      // Update session attributes without wiping pending/inactive sessions
      if (parsed.role === 'CLIENT') {
        if (reg.userProfile?.clientId) {
          parsed.userId = reg.userProfile.clientId;
        }
        if (reg.userProfile?.company) {
          parsed.companyName = reg.userProfile.company;
        }
      }
      parsed.accountStatus = reg.status;
      parsed.isRegistrationComplete = reg.isRegistrationComplete;

      return parsed;
    } catch {
      return null;
    }
  },

  // ─── 1.1 Complete Local Storage Reset ──────────────────────────────────────
  async resetAllLocalData(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('Failed to reset local data:', e);
    }
  },

  // ─── 2. Save Session to Storage ────────────────────────────────────────────
  async saveSession(session: AuthSessionData): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Failed to save session:', e);
    }
  },

  // ─── 3. Clear Session (Logout) ─────────────────────────────────────────────
  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }
  },

  getRoleLabel(role: MobileRole): string {
    switch (role) {
      case 'CLIENT':
        return 'Client';
      case 'VENDOR':
        return 'Vendor';
      case 'DRIVER':
        return 'Driver';
      default:
        return role;
    }
  },

  // ─── 3.5 Check Existing Role in Database for Role Change Detection ─────────
  async checkExistingRoleInDatabase(
    phoneNumber: string,
    currentRole: MobileRole
  ): Promise<{
    hasExistingDifferentRole: boolean;
    previousRole?: MobileRole;
    previousRoleLabel?: string;
    currentRoleLabel: string;
  }> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const currentLabel = this.getRoleLabel(currentRole);

    if (cleanPhone.length !== 10) {
      return {
        hasExistingDifferentRole: false,
        currentRoleLabel: currentLabel,
      };
    }

    try {
      // 1. Query Supabase database tables directly across all roles
      const [clientRes, vendorRes, driverRes] = await Promise.all([
        supabase
          .from('client_users')
          .select('id, status, mobile')
          .eq('mobile', cleanPhone)
          .maybeSingle(),
        supabase
          .from('vendor_users')
          .select('id, mobile')
          .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
          .maybeSingle(),
        supabase
          .from('drivers')
          .select('id, status, mobile, phone')
          .or(`mobile.eq.${cleanPhone},phone.eq.${cleanPhone}`)
          .maybeSingle(),
      ]);

      let previousRole: MobileRole | null = null;

      if (clientRes.data && clientRes.data.status !== 'DEACTIVATED') {
        previousRole = 'CLIENT';
      } else if (vendorRes.data) {
        previousRole = 'VENDOR';
      } else if (driverRes.data && driverRes.data.status !== 'DEACTIVATED') {
        previousRole = 'DRIVER';
      }

      // 2. Query local registry if database returned no match
      if (!previousRole) {
        const registry = await this.getLocalRegistry();
        const existing = registry.find(
          (u) => u.mobile === cleanPhone && u.status !== 'DEACTIVATED'
        );
        if (existing) {
          previousRole = existing.role;
        }
      }

      if (previousRole && previousRole !== currentRole) {
        return {
          hasExistingDifferentRole: true,
          previousRole,
          previousRoleLabel: this.getRoleLabel(previousRole),
          currentRoleLabel: currentLabel,
        };
      }
    } catch (e) {
      console.warn('checkExistingRoleInDatabase notice:', e);
    }

    return {
      hasExistingDifferentRole: false,
      currentRoleLabel: currentLabel,
    };
  },

  // ─── 4. Send Real OTP to Mobile Number ─────────────────────────────────────
  async sendOtp(
    phoneNumber: string,
    purpose: 'LOGIN' | 'REGISTRATION' | 'PASSWORD_RESET' = 'LOGIN',
    role?: MobileRole
  ): Promise<{
    success: boolean;
    message: string;
    expiresInSeconds: number;
    testCode?: string;
  }> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    // 1. Strict validation: Block login attempts for unregistered users
    if (purpose === 'LOGIN') {
      const regCheck = await this.checkMobileRegistration(cleanPhone, role);

      if (regCheck.isRegisteredOtherRole && regCheck.status !== 'DEACTIVATED') {
        const otherRole = regCheck.otherRole || 'another';
        throw new Error(
          `WRONG_ROLE: This mobile number is registered under the ${otherRole} role. Please select the correct role or complete the appropriate registration process.`
        );
      }

      if (!regCheck.isRegistered || regCheck.status === 'DEACTIVATED' || regCheck.status === 'NOT_REGISTERED') {
        throw new Error(
          'NOT_REGISTERED: You are not registered yet. Please register before logging in.'
        );
      }
    }

    // 2. Try Backend API dispatch first
    try {
      const apiRes = await callBackendApi<any>('/auth/send-otp', 'POST', {
        mobile: cleanPhone,
        role,
        purpose,
      });

      if (apiRes && apiRes.success) {
        return {
          success: true,
          message: apiRes.message || `OTP sent successfully to +91 ${cleanPhone}`,
          expiresInSeconds: apiRes.expiresInSeconds || 300,
          testCode: apiRes.testCode || '12345',
        };
      }
    } catch (apiErr: any) {
      if (apiErr?.status === 403 || apiErr?.data?.error === 'NOT_REGISTERED') {
        throw new Error('NOT_REGISTERED: You are not registered yet. Please register before logging in.');
      }
      if (apiErr?.status === 409 || apiErr?.data?.error === 'WRONG_ROLE') {
        throw new Error(
          apiErr.message ||
          'WRONG_ROLE: This mobile number is registered under another role. Please select the correct role.'
        );
      }
      console.warn('Backend API send-otp notice, falling back to direct operations:', apiErr?.message);
    }

    // 3. Fallback: Supabase direct OTP log
    const mockCode = process.env.EXPO_PUBLIC_MOCK_OTP_CODE || '12345';
    const isTestingMode = process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__);
    const generatedOtp = isTestingMode ? mockCode : Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      const { error: insertErr } = await supabase.from('otp_verifications').insert([
        {
          mobile: cleanPhone,
          phone_number: cleanPhone,
          country_code: '+91',
          otp_code: generatedOtp,
          purpose,
          attempts: 0,
          max_attempts: 3,
          is_verified: false,
          is_expired: false,
          expires_at: expiresAt,
        },
      ]);

      if (insertErr && !insertErr.message.includes('schema cache')) {
        console.warn('Supabase OTP log notice:', insertErr.message);
      }

      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: cleanPhone,
            user_type: 'MOBILE_AUTH',
            event_type: 'OTP_SENT',
            details: { phone: cleanPhone, purpose, role, timestamp: new Date().toISOString() },
          },
        ]);
      } catch { }

      return {
        success: true,
        message: `OTP sent successfully to +91 ${cleanPhone}`,
        expiresInSeconds: 300,
        testCode: generatedOtp,
      };
    } catch (err: any) {
      return {
        success: true,
        message: `OTP sent to +91 ${cleanPhone}`,
        expiresInSeconds: 300,
        testCode: generatedOtp,
      };
    }
  },

  // ─── 5. Verify OTP Code ───────────────────────────────────────────────────
  async verifyOtp(
    phoneNumber: string,
    enteredCode: string,
    requestedRole?: MobileRole,
    purpose: 'LOGIN' | 'REGISTRATION' = 'LOGIN'
  ): Promise<{
    success: boolean;
    isExistingUser: boolean;
    existingRole?: MobileRole;
    userProfile?: any;
    token?: string;
    accountStatus?: string;
    isRegistrationComplete?: boolean;
    profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
    missingFields?: string[];
    nextStep?: string;
    roleConflict?: boolean;
    previousRole?: MobileRole;
    notRegistered?: boolean;
  }> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const trimmedCode = enteredCode.trim();

    if (trimmedCode.length !== 5 && trimmedCode.length !== 6) {
      throw new Error('Please enter complete 5-digit verification code.');
    }

    // 1. Try Backend API verify-otp first
    try {
      const apiRes = await callBackendApi<any>('/auth/verify-otp', 'POST', {
        mobile: cleanPhone,
        role: requestedRole,
        code: trimmedCode,
        purpose,
      });

      if (apiRes && apiRes.success) {
        if (purpose === 'LOGIN') {
          const resolvedUserId = requestedRole === 'CLIENT'
            ? (apiRes.userProfile?.clientId || apiRes.userProfile?.id || `cli-${cleanPhone}`)
            : requestedRole === 'DRIVER'
              ? (apiRes.userProfile?.id || `drv-${cleanPhone}`)
              : (apiRes.userProfile?.vendorId || apiRes.userProfile?.id || `ven-${cleanPhone}`);

          await this.saveSession({
            userId: resolvedUserId,
            mobile: cleanPhone,
            role: requestedRole!,
            fullName: apiRes.userProfile?.fullName || apiRes.userProfile?.name || 'Authorized User',
            companyName: apiRes.userProfile?.companyName || apiRes.userProfile?.company,
            token: apiRes.token || 'sess-' + Date.now(),
            createdAt: new Date().toISOString(),
          });

          return {
            success: true,
            isExistingUser: true,
            existingRole: requestedRole,
            accountStatus: apiRes.accountStatus || 'ACTIVE',
            isRegistrationComplete: apiRes.isRegistrationComplete,
            profileCompletionStatus: apiRes.profileCompletionStatus,
            missingFields: apiRes.missingFields,
            nextStep: apiRes.nextStep,
            userProfile: apiRes.userProfile,
            token: apiRes.token,
          };
        } else {
          return {
            success: true,
            isExistingUser: apiRes.isExistingUser || false,
            existingRole: requestedRole,
            accountStatus: apiRes.accountStatus || 'NEW_USER',
            isRegistrationComplete: apiRes.isRegistrationComplete,
            profileCompletionStatus: apiRes.profileCompletionStatus,
            missingFields: apiRes.missingFields,
            nextStep: apiRes.nextStep,
            userProfile: null,
          };
        }
      }
    } catch (apiErr: any) {
      if (apiErr?.status === 403 || apiErr?.data?.error === 'NOT_REGISTERED') {
        throw new Error('NOT_REGISTERED: You are not registered yet. Please register before logging in.');
      }
      if (apiErr?.status === 409 || apiErr?.data?.error === 'WRONG_ROLE') {
        return {
          success: true,
          isExistingUser: false,
          existingRole: requestedRole,
          accountStatus: 'ROLE_CONFLICT',
          roleConflict: true,
          previousRole: apiErr.data?.registeredRole,
          userProfile: null,
        } as any;
      }
      console.warn('Backend verify-otp notice, falling back to local/Supabase:', apiErr?.message);
    }

    // 2. Fallback: Check against real Supabase otp_verifications table
    let isCodeValid = false;
    try {
      const { data: records, error } = await supabase
        .from('otp_verifications')
        .select('*')
        .or(`phone_number.eq.${cleanPhone},mobile.eq.${cleanPhone}`)
        .eq('is_verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && records && records.length > 0) {
        const latest = records[0];
        if (latest.otp_code === trimmedCode) {
          isCodeValid = true;
          await supabase
            .from('otp_verifications')
            .update({ is_verified: true, verified_at: new Date().toISOString() })
            .eq('id', latest.id);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase OTP check fallback notice:', dbErr);
    }

    // Direct Mock OTP 12345 check for testing
    const mockCode = process.env.EXPO_PUBLIC_MOCK_OTP_CODE || '12345';
    const isTestingMode = process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__);
    if (!isCodeValid && isTestingMode && (trimmedCode === '12345' || trimmedCode === mockCode)) {
      isCodeValid = true;
    }

    if (!isCodeValid) {
      throw new Error('Invalid or expired OTP code. Please enter valid code or tap Resend OTP.');
    }

    // 3. Fallback: Check cross-role registration (Supabase + local registry)
    const regCheck = await this.checkMobileRegistration(cleanPhone, requestedRole);
    let existingRole: MobileRole | undefined = regCheck.registeredRole || requestedRole;
    let userProfile = regCheck.userProfile;

    if (regCheck.isRegisteredOtherRole) {
      return {
        success: true,
        isExistingUser: false,
        existingRole: requestedRole,
        accountStatus: 'ROLE_CONFLICT',
        roleConflict: true,
        previousRole: regCheck.otherRole,
        userProfile: null,
      } as any;
    }

    if (purpose === 'LOGIN' && (!regCheck.isRegistered || regCheck.status === 'NOT_REGISTERED' || regCheck.status === 'DEACTIVATED')) {
      throw new Error('NOT_REGISTERED: You are not registered yet. Please register before logging in.');
    }

    if (regCheck.isRegistered && regCheck.status !== 'DEACTIVATED') {
      const resolvedUserId = existingRole === 'CLIENT'
        ? (userProfile?.clientId || userProfile?.companyId || userProfile?.id || `cli-${cleanPhone}`)
        : existingRole === 'DRIVER'
          ? (userProfile?.id || `drv-${cleanPhone}`)
          : (userProfile?.vendorId || `ven-${cleanPhone}`);

      const rawStatus = regCheck.status || 'INACTIVE';
      const accountStatus = rawStatus === 'APPROVED' || rawStatus === 'ACTIVE' ? 'APPROVED' : rawStatus;

      // Always save session for authenticated user regardless of whether approved, pending or inactive
      await this.saveSession({
        userId: resolvedUserId,
        mobile: cleanPhone,
        role: existingRole!,
        fullName: userProfile?.fullName || userProfile?.name || 'Authorized User',
        companyName: userProfile?.companyName || userProfile?.company || (existingRole === 'CLIENT' ? 'Client Enterprise' : 'Transport Firm'),
        token: 'sess-' + existingRole!.toLowerCase() + '-' + Date.now(),
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        isExistingUser: true,
        existingRole,
        accountStatus,
        isRegistrationComplete: regCheck.isRegistrationComplete,
        profileCompletionStatus: regCheck.profileCompletionStatus,
        missingFields: regCheck.missingFields,
        nextStep: regCheck.nextStep,
        userProfile: {
          ...userProfile,
          clientId: resolvedUserId,
          companyId: resolvedUserId,
          name: userProfile?.fullName || userProfile?.name || 'Authorized User',
          fullName: userProfile?.fullName || userProfile?.name || 'Authorized User',
          company: userProfile?.companyName || userProfile?.company || (existingRole === 'CLIENT' ? 'Client Enterprise' : 'Transport Firm'),
          companyName: userProfile?.companyName || userProfile?.company || (existingRole === 'CLIENT' ? 'Client Enterprise' : 'Transport Firm'),
          status: accountStatus,
        },
      } as any;
    }

    return {
      success: true,
      isExistingUser: false,
      existingRole: requestedRole,
      accountStatus: 'NEW_USER',
      userProfile: null,
    } as any;
  },

  // ─── 6. Register & Save Client Profile (In-Memory Draft) ───────────────────
  async saveClientProfile(data: ClientProfileFormData): Promise<{
    success: boolean;
    companyId: string;
    userId: string;
  }> {
    // Temporary form state remains in memory during registration wizard.
    // Permanent database records are persisted strictly upon final submission (Phase 6).
    const cleanPhone = data.mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    return {
      success: true,
      companyId: `temp-comp-${cleanPhone}`,
      userId: `temp-user-${cleanPhone}`,
    };
  },

  // ─── 7. Register & Save Driver Profile ────────────────────────────────────
  async saveDriverProfile(driverData: {
    fullName: string;
    licenceNumber: string;
    mobileNumber: string;
    truckType: string;
  }): Promise<{ success: boolean; driverId?: string }> {
    const cleanPhone = driverData.mobileNumber.replace(/[^0-9]/g, '').slice(-10);

    try {
      const { data, error } = await supabase
        .from('drivers')
        .insert([
          {
            primary_vendor_id: 'ba111111-1111-1111-1111-111111111111',
            full_name: driverData.fullName.trim(),
            mobile: cleanPhone,
            licence_number: driverData.licenceNumber.trim().toUpperCase(),
            licence_expiry_date: '2028-12-31',
            status: 'PENDING',
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Driver creation notice:', error.message);
      }

      await this.saveSession({
        userId: data?.id || 'drv-' + cleanPhone,
        mobile: cleanPhone,
        role: 'DRIVER',
        fullName: driverData.fullName.trim(),
        token: 'sess-driver-' + Date.now(),
        createdAt: new Date().toISOString(),
      });

      return { success: true, driverId: data?.id };
    } catch (err) {
      await this.saveSession({
        userId: 'drv-' + cleanPhone,
        mobile: cleanPhone,
        role: 'DRIVER',
        fullName: driverData.fullName.trim(),
        token: 'sess-driver-' + Date.now(),
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    }
  },

  // ─── 8. Register & Save Vendor Profile ────────────────────────────────────
  async saveVendorProfile(vendorData: {
    transporterName: string;
    gstin?: string;
    pan?: string;
    fleetSize: string;
    mobileNumber: string;
  }): Promise<{ success: boolean; vendorId?: string }> {
    const cleanPhone = vendorData.mobileNumber.replace(/[^0-9]/g, '').slice(-10);

    try {
      const { data, error } = await supabase
        .from('vendor_companies')
        .insert([
          {
            vendor_name: vendorData.transporterName.trim(),
            gstin: vendorData.gstin?.trim().toUpperCase() || null,
            pan: vendorData.pan?.trim().toUpperCase() || 'NOT_PROVIDED',
            address: 'North Eastern Regional Hub',
            status: 'PENDING',
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Vendor creation notice:', error.message);
      }

      await this.saveSession({
        userId: data?.id || 'ven-' + cleanPhone,
        mobile: cleanPhone,
        role: 'VENDOR',
        fullName: vendorData.transporterName.trim(),
        companyName: vendorData.transporterName.trim(),
        token: 'sess-vendor-' + Date.now(),
        createdAt: new Date().toISOString(),
      });

      return { success: true, vendorId: data?.id };
    } catch (err) {
      await this.saveSession({
        userId: 'ven-' + cleanPhone,
        mobile: cleanPhone,
        role: 'VENDOR',
        fullName: vendorData.transporterName.trim(),
        companyName: vendorData.transporterName.trim(),
        token: 'sess-vendor-' + Date.now(),
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    }
  },

  // ─── 9. Onboarding State Tracking ─────────────────────────────────────────
  async checkOnboardingCompleted(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem('@necl_onboarding_completed');
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setOnboardingCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem('@necl_onboarding_completed', 'true');
    } catch (e) {
      console.warn('Failed to save onboarding state:', e);
    }
  },

  // ─── 10. Notification Permission Tracking ──────────────────────────────────
  async checkNotificationPermission(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem('@necl_notif_permission');
      return val === 'granted';
    } catch {
      return false;
    }
  },

  async setNotificationPermission(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('@necl_notif_permission', granted ? 'granted' : 'denied');
    } catch (e) {
      console.warn('Failed to save notif permission state:', e);
    }
  },

  // ─── 11. User Profile Update ──────────────────────────────────────────────
  async updateUserProfile(
    userId: string,
    role: MobileRole,
    updates: {
      fullName: string;
      email?: string;
      companyName?: string;
      designation?: string;
      department?: string;
      address?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const current = await this.checkExistingSession();
      if (current) {
        current.fullName = updates.fullName;
        if (updates.companyName) current.companyName = updates.companyName;
        await this.saveSession(current);
      }

      // Persist to Supabase based on role
      if (role === 'CLIENT') {
        const cleanPhone = current?.mobile || '';
        await supabase
          .from('client_users')
          .update({
            full_name: updates.fullName,
            email: updates.email,
            designation: updates.designation,
            department: updates.department,
          })
          .eq('mobile', cleanPhone);
      } else if (role === 'VENDOR') {
        await supabase
          .from('vendor_companies')
          .update({
            vendor_name: updates.fullName,
            address: updates.address,
          })
          .eq('id', userId);
      } else if (role === 'DRIVER') {
        await supabase
          .from('drivers')
          .update({
            full_name: updates.fullName,
          })
          .eq('id', userId);
      }

      return { success: true, message: 'Profile updated successfully' };
    } catch (err: any) {
      return { success: true, message: 'Profile updated locally' };
    }
  },

  // ─── 12. Custom & Real Role-Based Notifications ───────────────────────────
  async getUserCustomNotifications(userKey?: string): Promise<any[]> {
    try {
      const cleanKey = (userKey || 'common').replace(/[^0-9a-zA-Z_-]/g, '');
      const storageKey = `@necl_user_custom_notifs_${cleanKey}`;
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('Failed to read custom notifications:', e);
    }
    return [];
  },

  async appendUserCustomNotification(item: any, userKey?: string): Promise<void> {
    try {
      const cleanKey = (userKey || 'common').replace(/[^0-9a-zA-Z_-]/g, '');
      const storageKey = `@necl_user_custom_notifs_${cleanKey}`;
      const existing = await this.getUserCustomNotifications(cleanKey);
      const filtered = existing.filter((n) => n.id !== item.id);
      const updated = [item, ...filtered].slice(0, 30);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to append custom notification:', e);
    }
  },

  async fetchRealNotifications(userId?: string, role?: MobileRole): Promise<any[]> {
    try {
      const session = await this.getCurrentSession();
      const effectiveUserId = userId || session?.userId;
      const effectiveRole: MobileRole = role || session?.role || 'CLIENT';
      const cleanPhone = (session?.mobile || effectiveUserId || 'common').replace(/[^0-9]/g, '').slice(-10);

      // 1. Fetch user-specific custom notifications (Welcome messages, direct alerts, FCM foreground saves)
      const customItems = await this.getUserCustomNotifications(cleanPhone);

      const items: any[] = [...customItems];

      // 2. Fetch role-specific operational database notifications
      if (effectiveRole === 'VENDOR') {
        const targetVendorId = effectiveUserId || session?.userId;
        try {
          // Vendor awarded trips & fleet assignments
          let tripsQuery = supabase
            .from('trips')
            .select('*, vehicles(registration_number), requirements(material_type, pickup_address, destination_address)')
            .order('created_at', { ascending: false })
            .limit(6);
          if (targetVendorId) {
            tripsQuery = tripsQuery.or(`vendor_id.eq.${targetVendorId},transporter_id.eq.${targetVendorId}`);
          }
          const { data: vTrips } = await tripsQuery;

          (vTrips || []).forEach((t: any) => {
            const hasDriver = !!t.driver_id;
            items.push({
              id: `v-trip-${t.id}`,
              category: 'shipment',
              title: hasDriver ? `Trip Awarded: ${t.trip_status || 'CONFIRMED'}` : 'Action Required: Assign Driver & Lorry',
              subtitle: `Lorry: ${t.vehicles?.registration_number || 'Pending'} | Route: ${t.requirements?.pickup_address || 'Origin'} → ${t.requirements?.destination_address || 'Dest'}`,
              time: t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Award',
              isRead: hasDriver,
              isImportant: !hasDriver,
              refId: t.booking_id || t.id,
              content: hasDriver
                ? `Trip #${t.id.slice(0, 8)} is confirmed with vehicle ${t.vehicles?.registration_number || 'Allocated'}. Telematics & tracking are active.`
                : `You have been awarded Booking #${t.booking_id || t.id.slice(0, 8)}. Please link a verified vehicle and driver to dispatch the load.`,
            });
          });

          // Open requirements available for vendor bidding
          const { data: openReqs } = await supabase
            .from('requirements')
            .select('*')
            .in('status', ['POSTED', 'OPEN_FOR_BIDDING', 'PENDING_PRICING'])
            .order('created_at', { ascending: false })
            .limit(4);

          (openReqs || []).forEach((r: any) => {
            items.push({
              id: `v-rfq-${r.id}`,
              category: 'booking',
              title: 'New Freight Requirement Available 📦',
              subtitle: `${r.pickup_address || 'Origin'} → ${r.destination_address || 'Dest'} | ${r.vehicle_type_required || 'Standard'}`,
              time: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Live RFQ',
              isRead: true,
              isImportant: false,
              refId: r.id,
              content: `A verified transport requirement for ${r.material_type || 'Cargo'} is open for quotation. Review specs and submit your commercial bid.`,
            });
          });
        } catch (vErr) {
          console.warn('Vendor notification fetch notice:', vErr);
        }
      } else if (effectiveRole === 'DRIVER') {
        const targetDriverId = effectiveUserId || session?.userId;
        try {
          // Driver assigned trips
          let driverTripsQuery = supabase
            .from('trips')
            .select('*, vehicles(registration_number)')
            .order('created_at', { ascending: false })
            .limit(6);
          if (targetDriverId) {
            driverTripsQuery = driverTripsQuery.eq('driver_id', targetDriverId);
          }
          const { data: dTrips } = await driverTripsQuery;

          (dTrips || []).forEach((t: any) => {
            const inProgress = t.trip_status === 'IN_TRANSIT' || t.trip_status === 'LOADING';
            items.push({
              id: `d-trip-${t.id}`,
              category: 'shipment',
              title: `Trip Assigned: ${t.trip_status || 'DISPATCHED'} 🚚`,
              subtitle: `Vehicle: ${t.vehicles?.registration_number || 'Your Lorry'} | Status: ${t.trip_status || 'ASSIGNED'}`,
              time: t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today',
              isRead: !inProgress,
              isImportant: inProgress,
              refId: t.id,
              content: `You are assigned to Trip #${t.id.slice(0, 8)}. Report to the loading bay on schedule and upload the stamped delivery challan/e-POD upon destination arrival.`,
            });
          });
        } catch (dErr) {
          console.warn('Driver notification fetch notice:', dErr);
        }
      } else {
        // CLIENT Role: Requirements, bookings, and live consignment trips
        let targetCompanyId = effectiveUserId;
        if (effectiveUserId && effectiveUserId.includes('-')) {
          const { data: userRec } = await supabase
            .from('client_users')
            .select('client_id, client_company_id')
            .eq('id', effectiveUserId)
            .maybeSingle();
          if (userRec?.client_id || userRec?.client_company_id) {
            targetCompanyId = userRec.client_id || userRec.client_company_id;
          }
        }

        let reqsQuery = supabase.from('requirements').select('*').order('created_at', { ascending: false }).limit(6);
        let boksQuery = supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(6);

        if (targetCompanyId) {
          reqsQuery = reqsQuery.or(`client_id.eq.${targetCompanyId},client_id.eq.${effectiveUserId}`);
          boksQuery = boksQuery.or(`client_id.eq.${targetCompanyId},client_id.eq.${effectiveUserId}`);
        }

        const [{ data: reqs }, { data: boks }] = await Promise.all([reqsQuery, boksQuery]);

        const bookingIds = (boks || []).map((b) => b.id);
        let trips: any[] = [];
        if (bookingIds.length > 0) {
          const { data: tripsData } = await supabase
            .from('trips')
            .select('*, vehicles(registration_number)')
            .in('booking_id', bookingIds)
            .order('created_at', { ascending: false })
            .limit(6);
          trips = tripsData || [];
        }

        (trips || []).forEach((t) => {
          const inTransit = t.trip_status === 'IN_TRANSIT';
          items.push({
            id: `trip-${t.id}`,
            category: 'shipment',
            title: `Trip ${t.trip_status === 'IN_TRANSIT' ? 'In Transit' : t.trip_status}`,
            subtitle: `Lorry: ${t.vehicles?.registration_number || 'Standard Fleet'} | Freight ₹${(t.vendor_rate || 0).toLocaleString('en-IN')}`,
            time: t.started_at ? new Date(t.started_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent Update',
            isRead: !inTransit,
            isImportant: inTransit,
            refId: t.booking_id || t.id,
            content: `Your shipment with vehicle ${t.vehicles?.registration_number || 'Assigned'} is currently progressing towards its destination with real-time GPS telematics active.`,
          });
        });

        (boks || []).forEach((b) => {
          const isPending = b.payment_status === 'PAYMENT_PENDING';
          items.push({
            id: `bok-${b.id}`,
            category: 'booking',
            title: `Booking: ${b.booking_status}`,
            subtitle: `Reference: ${b.booking_number || b.id.slice(0, 8)} | Payment: ${b.payment_status || 'CONFIRMED'}`,
            time: b.confirmed_at ? new Date(b.confirmed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today',
            isRead: !isPending,
            isImportant: isPending,
            refId: b.id,
            content: `Consignment booking ${b.booking_number || b.id} has been registered into the TRUCKS central brokerage system.`,
          });
        });

        (reqs || []).forEach((r) => {
          items.push({
            id: `req-${r.id}`,
            category: 'system',
            title: `Requirement: ${r.status}`,
            subtitle: `Route: ${r.pickup_address} → ${r.destination_address}`,
            time: r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Active',
            isRead: true,
            isImportant: false,
            refId: r.id,
            content: `Freight requirement for ${r.material_type || 'Cargo'} between ${r.pickup_address} and ${r.destination_address} is logged in TRUCKS dispatch.`,
          });
        });
      }

      // Deduplicate items by ID
      const seenIds = new Set<string>();
      return items.filter((item) => {
        if (!item?.id || seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
    } catch {
      return [];
    }
  },

  // ─── 13. Settings Persistence ─────────────────────────────────────────────
  async getSettings(): Promise<{
    pushTripUpdates: boolean;
    pushQuotations: boolean;
    pushSystemAlerts: boolean;
    biometricLogin: boolean;
    smsAlerts: boolean;
    darkMode: boolean;
    language: string;
  }> {
    const defaults = {
      pushTripUpdates: true,
      pushQuotations: true,
      pushSystemAlerts: true,
      biometricLogin: false,
      smsAlerts: true,
      darkMode: false,
      language: 'English',
    };
    try {
      const stored = await AsyncStorage.getItem('@necl_user_settings');
      if (stored) return { ...defaults, ...JSON.parse(stored) };
      return defaults;
    } catch {
      return defaults;
    }
  },

  async saveSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem('@necl_user_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  },

  // ─── 14. Support Ticket Submission ────────────────────────────────────────
  async submitSupportTicket(ticket: {
    name: string;
    phone: string;
    category: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; ticketRef: string }> {
    const refId = 'TRK-TKT-' + Math.floor(100000 + Math.random() * 900000);
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: ticket.phone,
          user_type: 'MOBILE_SUPPORT',
          event_type: 'SUPPORT_TICKET_SUBMITTED',
          details: {
            ticketRef: refId,
            category: ticket.category,
            subject: ticket.subject,
            message: ticket.message,
            submittedAt: new Date().toISOString(),
          },
        },
      ]);
    } catch (e) {
      console.warn('Support ticket log notice:', e);
    }
    return { success: true, ticketRef: refId };
  },

  // ─── 15. Push Notification Token Registration ─────────────────────────────
  async registerPushToken(token: string, userId?: string, role?: string): Promise<boolean> {
    try {
      const res = await callBackendApi('/notifications/register-token', 'POST', {
        pushToken: token,
        userId,
        role,
        platform: 'mobile',
      });
      return !!res?.success;
    } catch (e) {
      console.warn('Failed to register push token with TRUCKS backend:', e);
      return false;
    }
  },
};
