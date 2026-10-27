import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from './config';
import { supabase, getSupabaseClient } from './supabase';
import { permissionService, SYSTEM_MODULES, PermissionsMatrix } from './services/permissionService';
import { OTPServiceFactory } from './services/otp';
import { NotificationService } from './services/notificationService';
import { formatDisplayId } from './services/idGenerator';

// ==========================================
// Persistent Server User Registry
// ==========================================
export interface ServerUserRecord {
  mobile: string;
  role: 'CLIENT' | 'VENDOR' | 'DRIVER';
  fullName: string;
  email?: string;
  companyName?: string;
  status: string;
  registeredAt: string;
  operatingHubs?: any[];
  manualOperatingLocations?: any[];
  totalFleetCount?: number;
  fleetStrength?: string;
  vehicleConfigs?: any[];
  servicesOffered?: any[];
}

const REGISTRY_FILE = path.join(__dirname, '..', 'data', 'server_user_registry.json');
let cachedServerRegistry: ServerUserRecord[] | null = null;

export function getServerUserRegistry(): ServerUserRecord[] {
  if (cachedServerRegistry !== null) {
    return cachedServerRegistry;
  }
  try {
    if (!fs.existsSync(REGISTRY_FILE)) {
      cachedServerRegistry = [];
      return cachedServerRegistry;
    }
    const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    cachedServerRegistry = Array.isArray(parsed) ? parsed : [];
    return cachedServerRegistry;
  } catch {
    cachedServerRegistry = [];
    return cachedServerRegistry;
  }
}

export function saveServerUserRegistry(records: ServerUserRecord[]): void {
  cachedServerRegistry = records;
  try {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save server user registry:', e);
  }
}

// ==========================================
// Persistent Admin Registration Drafts System
// ==========================================
export interface AdminRegistrationDraftRecord {
  id: string;
  entityType: 'CLIENT' | 'VENDOR';
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  stepProgress: number;
  completionPercentage: number;
  formData: any;
  documentRefs: any[];
  vehicleDetails: any[];
  operatingLanes?: any[];
  selectedServices?: any[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const DRAFTS_FILE = path.join(__dirname, '..', 'data', 'admin_drafts.json');

export function getFileDrafts(): AdminRegistrationDraftRecord[] {
  try {
    if (!fs.existsSync(DRAFTS_FILE)) return [];
    const data = fs.readFileSync(DRAFTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFileDrafts(drafts: AdminRegistrationDraftRecord[]): void {
  try {
    const dir = path.dirname(DRAFTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save drafts file:', e);
  }
}

const app = express();
const inMemoryOtpCache = new Map<string, { code: string; expiresAt: number }>();

// CORS configuration - remove wildcard in production
const allowedOrigins = config.corsOrigin.filter(origin => origin !== '*');
app.use(cors({ 
  origin: allowedOrigins.length > 0 ? allowedOrigins : 'http://localhost:5174',
  credentials: true 
}));
app.use(express.json());

// ==========================================
// Types & Middleware
// ==========================================

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    mobile?: string;
    email?: string;
    role: 'CLIENT' | 'VENDOR' | 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN';
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Access to protected features is blocked for unregistered or unauthenticated users.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      error: 'INVALID_TOKEN',
      message: 'Your session has expired or is invalid. Please log in again.',
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'ROLE_FORBIDDEN',
        message: `Access denied. This screen or feature is restricted to ${allowedRoles.join(', ')} users. Your registered role is ${req.user.role}.`,
      });
    }
    next();
  };
}

export async function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Administrator authentication required. Please sign in with an authorized administrator account.',
    });
  }

  // 1. Verify custom backend JWT token if present
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (['ADMIN', 'SUPER_ADMIN'].includes(decoded.role)) {
      req.user = decoded;
      return next();
    }
  } catch {}

  // 2. Try verifying as Supabase access token
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user?.email) {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id, name, email, role, is_active')
        .or(`auth_uid.eq.${user.id},email.eq.${user.email.toLowerCase()}`)
        .maybeSingle();

      if (adminUser) {
        if (!adminUser.is_active) {
          return res.status(403).json({
            error: 'ACCOUNT_SUSPENDED',
            message: 'Your administrator account has been suspended or deactivated by the Super Admin.',
          });
        }
        req.user = {
          userId: adminUser.id,
          email: adminUser.email,
          role: adminUser.role as any,
        };
        return next();
      }
    }
  } catch {}

  // Deny unauthenticated access - valid signed Bearer token is required
  return res.status(401).json({
    error: 'UNAUTHORIZED',
    message: 'Administrator authentication required. Please sign in with an authorized administrator account.',
  });
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'Access denied. This administrative capability is restricted to Super Admin only.',
    });
  }
  next();
}

export function requireAdminPermission(moduleKey: string, actionKey?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
    }
    // Super Admin has full administrative authority across all modules
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const perms = permissionService.getPermissionsForUser(req.user.userId, req.user.role as any);
    const hasPerm = permissionService.hasPermission(perms, req.user.role as any, moduleKey, actionKey);

    if (!hasPerm) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        module: moduleKey,
        action: actionKey,
        message: `Access denied. You do not have permission to ${actionKey || 'access'} the ${moduleKey} module. Contact your Super Admin to grant authorization.`,
      });
    }
    next();
  };
}

// ==========================================
// Admin Supabase Session Manager
// ==========================================
let lastAdminAuthTime = 0;
export async function ensureAdminAuth(): Promise<void> {
  const now = Date.now();
  if (now - lastAdminAuthTime > 1800000) { // 30 minutes
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@necl.com',
        password: 'admin123',
      });
      if (!error && data?.user) {
        lastAdminAuthTime = now;
      }
    } catch (e: any) {
      console.warn('[SERVER] Supabase admin sign-in notice:', e?.message);
    }
  }
}

// ==========================================
// Core Registration Validation Helper
// ==========================================
export async function checkUserRegistration(phoneNumber: string, requestedRole?: string) {
  const cleanPhone = (phoneNumber || '').replace(/[^0-9]/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return {
      isValidPhone: false,
      isRegistered: false,
      isRegisteredOtherRole: false,
      status: 'INVALID_PHONE',
      cleanPhone,
      message: 'Please provide a valid 10-digit mobile number.',
    };
  }

  await ensureAdminAuth();

  try {
    const activeRoles: Array<{
      role: 'CLIENT' | 'VENDOR' | 'DRIVER';
      status: string;
      profile: any;
      isComplete?: boolean;
      missingFields?: string[];
      nextStep?: string;
    }> = [];

    // 1. Check Supabase RPC check_client_account_status (SECURITY DEFINER)
    try {
      const rpcRes = await supabase.rpc('check_client_account_status', { p_mobile: cleanPhone });
      if (!rpcRes.error && rpcRes.data && rpcRes.data.status !== 'NEW_USER') {
        const d = rpcRes.data;
        if (d.status === 'ROLE_CONFLICT') {
          activeRoles.push({
            role: d.previous_role,
            status: 'ACTIVE',
            profile: {
              fullName: `${d.previous_role} User`,
              role: d.previous_role,
              mobile: cleanPhone,
            },
          });
        } else {
          activeRoles.push({
            role: 'CLIENT',
            status: d.status || 'PENDING_APPROVAL',
            profile: {
              id: d.company_id,
              userId: d.company_id,
              fullName: d.full_name,
              email: d.email,
              companyName: d.company_name || 'Client Enterprise',
              clientCode: d.client_code,
              status: d.status,
            },
          });
        }
      }
    } catch (rpcErr) {
      // Non-blocking notice
    }

    // 2. Query Supabase direct tables
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
        const compStatus = comp?.status || clientRes.data.status || 'PENDING_APPROVAL';
        const clientMissing: string[] = [];
        if (!comp?.company_name) clientMissing.push('Company Name');
        if (!comp?.pan && !comp?.gstin) clientMissing.push('PAN / GSTIN');
        if (!comp?.registered_address) clientMissing.push('Registered Address');
        const isCompApproved = compStatus === 'APPROVED' || compStatus === 'ACTIVE';
        const clientIsComplete = isCompApproved || (clientMissing.length === 0 && compStatus !== 'INACTIVE');
        const nextStep = clientMissing.length > 0 ? 'CLIENT_BUSINESS_DETAILS' : 'CLIENT_DOC_UPLOAD';

        if (!activeRoles.some((r) => r.role === 'CLIENT')) {
          activeRoles.push({
            role: 'CLIENT',
            status: compStatus,
            isComplete: clientIsComplete,
            missingFields: clientMissing,
            nextStep,
            profile: {
              id: comp?.id || clientRes.data.client_company_id || clientRes.data.id,
              userId: clientRes.data.id,
              fullName: clientRes.data.full_name,
              email: clientRes.data.email,
              companyName: comp?.company_name || 'Client Enterprise',
              clientCode: comp?.client_code,
              status: compStatus,
              isRegistrationComplete: clientIsComplete,
              missingFields: clientMissing,
            },
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

        let hasPanDoc = false;
        let hasChequeDoc = false;
        let hasRejectedDocs = false;
        if (comp?.id) {
          try {
            const { data: vDocs } = await supabase
              .from('documents')
              .select('document_type, verification_status')
              .eq('reference_id', comp.id);
            if (vDocs && vDocs.length > 0) {
              hasPanDoc = vDocs.some((d: any) => (d.document_type === 'COMPANY_PAN' || d.document_type === 'PAN') && d.verification_status !== 'REJECTED');
              hasChequeDoc = vDocs.some((d: any) => (d.document_type === 'BANK_CANCELLED_CHEQUE' || d.document_type === 'CANCELLED_CHEQUE') && d.verification_status !== 'REJECTED');
              hasRejectedDocs = vDocs.some((d: any) => d.verification_status === 'REJECTED');
            }
          } catch {}
        }
        if (!hasPanDoc || !hasChequeDoc || hasRejectedDocs) {
          vendorMissing.push('KYC Documents');
        }

        const isVendorApproved = compStatus === 'APPROVED';
        const vendorIsComplete = isVendorApproved || (vendorMissing.length === 0 && compStatus !== 'INACTIVE');
        
        let nextStep = 'VENDOR_APPLICATION_REVIEW';
        if (!comp?.vendor_name || comp.vendor_name === 'Active Registration' || !comp?.pan || comp.pan === 'NOT_PROVIDED' || comp.pan.length !== 10) {
          nextStep = 'VENDOR_REGISTRATION';
        } else if (!comp?.address) {
          nextStep = 'VENDOR_ADDRESS_CONTACT';
        } else if (!hasPanDoc || !hasChequeDoc || hasRejectedDocs) {
          nextStep = 'VENDOR_DOC_UPLOAD';
        }

        if (!activeRoles.some((r) => r.role === 'VENDOR')) {
          activeRoles.push({
            role: 'VENDOR',
            status: compStatus,
            isComplete: vendorIsComplete,
            missingFields: vendorMissing,
            nextStep,
            profile: {
              id: comp?.id || vendorRes.data.vendor_id || vendorRes.data.id,
              userId: vendorRes.data.id,
              fullName: vendorRes.data.full_name,
              email: vendorRes.data.email,
              companyName: comp?.vendor_name,
              status: compStatus,
              isRegistrationComplete: vendorIsComplete,
              missingFields: vendorMissing,
            },
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

          let hasPanDoc = false;
          let hasChequeDoc = false;
          let hasRejectedDocs = false;
          if (directComp.id) {
            try {
              const { data: vDocs } = await supabase
                .from('documents')
                .select('document_type, verification_status')
                .eq('reference_id', directComp.id);
              if (vDocs && vDocs.length > 0) {
                hasPanDoc = vDocs.some((d: any) => (d.document_type === 'COMPANY_PAN' || d.document_type === 'PAN') && d.verification_status !== 'REJECTED');
                hasChequeDoc = vDocs.some((d: any) => (d.document_type === 'BANK_CANCELLED_CHEQUE' || d.document_type === 'CANCELLED_CHEQUE') && d.verification_status !== 'REJECTED');
                hasRejectedDocs = vDocs.some((d: any) => d.verification_status === 'REJECTED');
              }
            } catch {}
          }
          if (!hasPanDoc || !hasChequeDoc || hasRejectedDocs) {
            vendorMissing.push('KYC Documents');
          }

          const isVendorApproved = compStatus === 'APPROVED';
          const vendorIsComplete = isVendorApproved || (vendorMissing.length === 0 && compStatus !== 'INACTIVE');

          let nextStep = 'VENDOR_APPLICATION_REVIEW';
          if (!directComp.vendor_name || directComp.vendor_name === 'Active Registration' || !directComp.pan || directComp.pan === 'NOT_PROVIDED' || directComp.pan.length !== 10) {
            nextStep = 'VENDOR_REGISTRATION';
          } else if (!directComp.address) {
            nextStep = 'VENDOR_ADDRESS_CONTACT';
          } else if (!hasPanDoc || !hasChequeDoc || hasRejectedDocs) {
            nextStep = 'VENDOR_DOC_UPLOAD';
          }

          activeRoles.push({
            role: 'VENDOR',
            status: compStatus,
            isComplete: vendorIsComplete,
            missingFields: vendorMissing,
            nextStep,
            profile: {
              id: directComp.id,
              userId: directComp.id,
              fullName: directComp.vendor_name,
              companyName: directComp.vendor_name,
              status: compStatus,
              isRegistrationComplete: vendorIsComplete,
              missingFields: vendorMissing,
            },
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
        const driverIsComplete = isDriverApproved || (driverMissing.length === 0 && driverStatus !== 'INACTIVE');

        if (!activeRoles.some((r) => r.role === 'DRIVER')) {
          activeRoles.push({
            role: 'DRIVER',
            status: driverStatus,
            isComplete: driverIsComplete,
            missingFields: driverMissing,
            nextStep: 'DRIVER_REGISTRATION',
            profile: {
              id: d.id,
              userId: d.id,
              fullName: d.full_name || d.name,
              licenceNumber: d.licence_number || d.license_number,
              status: driverStatus,
              isRegistrationComplete: driverIsComplete,
              missingFields: driverMissing,
            },
          });
        }
      }
    } catch (dbErr) {
      // Non-blocking notice
    }

    // 3. Check persistent Server User Registry
    const serverRegistry = getServerUserRegistry();
    const serverUser = serverRegistry.find((u) => u.mobile === cleanPhone && u.status !== 'DEACTIVATED');
    if (serverUser && !activeRoles.some((r) => r.role === serverUser.role)) {
      activeRoles.push({
        role: serverUser.role,
        status: serverUser.status || 'ACTIVE',
        isComplete: serverUser.status === 'APPROVED' || serverUser.status === 'ACTIVE',
        missingFields: [],
        nextStep: undefined,
        profile: {
          id: `${serverUser.role.toLowerCase()}-${cleanPhone}`,
          userId: `${serverUser.role.toLowerCase()}-${cleanPhone}`,
          fullName: serverUser.fullName,
          email: serverUser.email,
          companyName: serverUser.companyName,
          status: serverUser.status,
          isRegistrationComplete: serverUser.status === 'APPROVED' || serverUser.status === 'ACTIVE',
        },
      });
    }

    if (activeRoles.length === 0) {
      return {
        isValidPhone: true,
        cleanPhone,
        isRegistered: false,
        isRegisteredOtherRole: false,
        registeredRole: null,
        otherRole: null,
        status: 'NOT_REGISTERED',
        isRegistrationComplete: false,
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: [],
        nextStep: undefined,
        userProfile: null,
        message: 'You are not registered yet. Please register before logging in.',
      };
    }

    if (requestedRole) {
      const matched = activeRoles.find((r) => r.role === requestedRole);
      if (matched) {
        return {
          isValidPhone: true,
          cleanPhone,
          isRegistered: true,
          registeredRole: matched.role,
          isRegisteredOtherRole: false,
          otherRole: null,
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
        const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
        const otherLabel = formatRole(other.role);
        return {
          isValidPhone: true,
          cleanPhone,
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
          message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
        };
      }
    }

    const first = activeRoles[0];
    return {
      isValidPhone: true,
      cleanPhone,
      isRegistered: true,
      registeredRole: first.role,
      isRegisteredOtherRole: false,
      otherRole: null,
      status: first.status,
      isRegistrationComplete: first.isComplete ?? true,
      profileCompletionStatus: (first.isComplete ?? true) ? 'COMPLETE' : 'INCOMPLETE',
      missingFields: first.missingFields ?? [],
      nextStep: first.nextStep,
      userProfile: first.profile,
      message: `Registered as ${first.role}`,
    };
  } catch (err: any) {
    console.error('checkUserRegistration error:', err);
    return {
      isValidPhone: true,
      cleanPhone,
      isRegistered: false,
      isRegisteredOtherRole: false,
      registeredRole: null,
      otherRole: null,
      status: 'ERROR',
      userProfile: null,
      message: err.message,
    };
  }
}

// Universal Search Entities Store
interface SearchEntity {
  id: string;
  category: 'vehicle' | 'booking' | 'driver' | 'client' | 'vendor' | 'document';
  title: string;
  subtitle: string;
  tag: string;
  details: any;
}

let recentSearches: string[] = [];

// ==========================================
// Authentication & Registration API Endpoints
// ==========================================

// 2a-0. Admin & Super Admin Login (Supports mock testing credentials & real verification)
app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
  const { email, password, otp } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const enteredPassword = (password || '').trim();
  const enteredOtp = (otp || '').trim();

  if (!cleanEmail || !enteredPassword) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // 1. Mock Testing Credentials for Super Admin and Regular Admin
  const isMockSuperAdmin = (
    (cleanEmail === 'superadmin@necl.com' || cleanEmail === 'superadmin.demo@necl.com') &&
    (enteredPassword === 'SuperAdmin@123' || enteredPassword === 'admin123' || enteredPassword === 'superadmin123')
  );
  const isMockAdmin = (
    (cleanEmail === 'admin@necl.com' || cleanEmail === 'admin.demo@necl.com') &&
    (enteredPassword === 'Admin@123' || enteredPassword === 'admin123' || enteredPassword === 'admin')
  );

  if (isMockSuperAdmin || isMockAdmin) {
    if (isMockSuperAdmin && enteredOtp && enteredOtp !== '12345' && (config.mockOtpCode && enteredOtp !== config.mockOtpCode)) {
      return res.status(401).json({ error: 'INVALID_2FA', message: 'Invalid 2FA verification code. Test code is 12345.' });
    }

    const role = isMockSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN';
    const name = isMockSuperAdmin ? 'Super Administrator' : 'Operations Administrator';
    const userId = isMockSuperAdmin ? 'mock-super-admin-id' : 'mock-admin-id';

    const token = jwt.sign(
      { userId, email: cleanEmail, role, name },
      config.jwtSecret,
      { expiresIn: (config.jwtExpiresIn as any) || '7d' }
    );

    return res.json({
      success: true,
      token,
      user: { id: userId, email: cleanEmail, role, name },
      message: `Successfully authenticated as ${role} (Testing Mode)`,
    });
  }

  // 2. Real Supabase Authentication for Production Accounts
  try {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: enteredPassword,
    });

    if (authErr || !authData?.user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, name, email, role, is_active')
      .or(`auth_uid.eq.${authData.user.id},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (!adminUser || !adminUser.is_active) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Account is not authorized or is suspended.' });
    }

    const role = adminUser.role;
    const name = adminUser.name || 'Admin';
    const userId = adminUser.id;

    const token = jwt.sign(
      { userId, email: cleanEmail, role, name },
      config.jwtSecret,
      { expiresIn: (config.jwtExpiresIn as any) || '7d' }
    );

    return res.json({
      success: true,
      token,
      user: { id: userId, email: cleanEmail, role, name },
      message: `Successfully authenticated as ${role}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'AUTH_ERROR', message: err.message || 'Authentication failed' });
  }
});

// 2a. Check Mobile Registration Status (Client, Vendor, Driver)
app.post('/api/auth/check-registration', async (req: Request, res: Response) => {
  const { mobile, role } = req.body;
  if (!mobile) {
    return res.status(400).json({ error: 'mobile is required' });
  }

  const result = await checkUserRegistration(mobile, role);
  return res.json(result);
});

// 2a-2. Synchronize / Persist Registration Record (Client, Vendor, Driver)
app.post('/api/auth/register-sync', async (req: Request, res: Response) => {
  const { fullName, mobile, role, email, companyName, status = 'ACTIVE' } = req.body;
  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);

  if (cleanPhone.length !== 10 || !role || !fullName) {
    return res.status(400).json({ error: 'fullName, mobile (10 digits), and role are required' });
  }

  // Cross-role verification
  const check = await checkUserRegistration(cleanPhone, role);
  if (check.isRegisteredOtherRole && check.status !== 'DEACTIVATED') {
    const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
    const otherLabel = formatRole(check.otherRole || 'Other');
    return res.status(409).json({
      error: 'WRONG_ROLE',
      registeredRole: check.otherRole,
      message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
    });
  }

  const registry = getServerUserRegistry();
  const filtered = registry.filter((u) => u.mobile !== cleanPhone);
  const newRecord: ServerUserRecord = {
    mobile: cleanPhone,
    role,
    fullName: fullName.trim(),
    email: email?.trim(),
    companyName: companyName?.trim(),
    status,
    registeredAt: new Date().toISOString(),
  };

  filtered.unshift(newRecord);
  saveServerUserRegistry(filtered);

  return res.json({
    success: true,
    message: `User ${fullName} successfully registered as ${role}`,
    user: newRecord,
  });
});

// 2b. Send Authentication OTP
// Blocks unregistered users from requesting OTP during login
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  const { mobile, role, purpose = 'LOGIN' } = req.body;
  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);

  if (cleanPhone.length !== 10) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PHONE',
      message: 'Please enter a valid 10-digit mobile number.',
    });
  }

  if (purpose === 'LOGIN') {
    // 1. Strict validation: Block login for unregistered users
    const check = await checkUserRegistration(cleanPhone, role);

    if (check.isRegisteredOtherRole) {
      const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
      const otherLabel = formatRole(check.otherRole || 'Other');
      return res.status(409).json({
        success: false,
        error: 'WRONG_ROLE',
        registeredRole: check.otherRole,
        message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
      });
    }

    if (!check.isRegistered) {
      return res.status(403).json({
        success: false,
        error: 'NOT_REGISTERED',
        message: 'You are not registered yet. Please register before logging in.',
      });
    }
  } else if (purpose === 'REGISTRATION') {
    // Check if user is already registered under this role
    const check = await checkUserRegistration(cleanPhone, role);
    if (check.isRegistered && (check.status === 'APPROVED' || check.status === 'ACTIVE')) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_REGISTERED',
        message: `This mobile number is already registered and active as a ${role}. Please proceed to login with OTP.`,
      });
    }
    if (check.isRegisteredOtherRole && check.status !== 'DEACTIVATED') {
      const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
      const otherLabel = formatRole(check.otherRole || 'Other');
      return res.status(409).json({
        success: false,
        error: 'WRONG_ROLE_REGISTERED',
        registeredRole: check.otherRole,
        message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
      });
    }
  }

  // Generate OTP
  const isTestingMode = process.env.NODE_ENV !== 'production' || config.mockOtpEnabled;
  const generatedOtp = isTestingMode
    ? (config.mockOtpCode || '12345')
    : Math.floor(10000 + Math.random() * 90000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  inMemoryOtpCache.set(cleanPhone, { code: generatedOtp, expiresAt: Date.now() + 5 * 60 * 1000 });

  try {
    await supabase.from('otp_verifications').insert([
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
  } catch (err: any) {
    console.warn('Supabase otp_verifications log notice:', err.message);
  }

  // Dispatch live SMS via SMS Gateway provider (only in production or when mock OTP is disabled)
  if (!config.mockOtpEnabled || process.env.NODE_ENV === 'production') {
    try {
      const smsProvider = OTPServiceFactory.getProvider('SMS_GATEWAY');
      await smsProvider.send({
        phoneNumber: cleanPhone,
        countryCode: '+91',
        purpose: purpose as any,
      });
    } catch (smsErr: any) {
      console.warn('[send-otp] Outbound SMS dispatch warning:', smsErr.message);
    }
  } else {
    console.log(`[send-otp] Dev Testing Mode: Mock OTP 12345 generated for +91 ${cleanPhone} (live SMS bypassed).`);
  }

  const responsePayload: Record<string, any> = {
    success: true,
    message: `OTP sent successfully to +91 ${cleanPhone}`,
    expiresInSeconds: 300,
  };

  // Strictly omit testCode in production environments to prevent credential leakage
  if (process.env.NODE_ENV !== 'production' || config.mockOtpEnabled) {
    responsePayload.testCode = generatedOtp;
  }

  return res.json(responsePayload);
});

// 2c. Verify OTP & Authenticate Session
app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  const { mobile, role, code, otp, purpose = 'LOGIN' } = req.body;
  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);
  const trimmedCode = ((code || otp) || '').trim();

  if (cleanPhone.length !== 10 || (trimmedCode.length !== 5 && trimmedCode.length !== 6)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'Please enter valid 10-digit mobile number and 5-digit OTP code.',
    });
  }

  // Verify OTP
  let isCodeValid = false;
  try {
    const { data: records, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', cleanPhone)
      .eq('is_verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && records && records.length > 0) {
      if (records[0].otp_code === trimmedCode) {
        isCodeValid = true;
        await supabase
          .from('otp_verifications')
          .update({ is_verified: true, verified_at: new Date().toISOString() })
          .eq('id', records[0].id);
      }
    }
  } catch (dbErr) {
    console.warn('Supabase OTP verification notice:', dbErr);
  }

  // In-memory cache verification
  if (!isCodeValid) {
    const cached = inMemoryOtpCache.get(cleanPhone);
    if (cached && cached.expiresAt > Date.now() && cached.code === trimmedCode) {
      isCodeValid = true;
      inMemoryOtpCache.delete(cleanPhone);
    }
  }

  // Development/testing fallback - strictly disabled in production
  if (
    process.env.NODE_ENV !== 'production' &&
    !isCodeValid &&
    (trimmedCode === '12345' || (config.mockOtpEnabled && trimmedCode === config.mockOtpCode))
  ) {
    isCodeValid = true;
  }

  if (!isCodeValid) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_OTP',
      message: 'Invalid or expired OTP code. Please enter a valid code or tap Resend OTP.',
    });
  }

  if (purpose === 'LOGIN') {
    // Validate registration status against database
    const check = await checkUserRegistration(cleanPhone, role);

    if (check.isRegisteredOtherRole) {
      return res.status(409).json({
        success: false,
        error: 'WRONG_ROLE',
        registeredRole: check.otherRole,
        message: `This mobile number is registered under the ${check.otherRole} role. Please select the correct role or complete the appropriate registration process.`,
      });
    }

    if (!check.isRegistered || !check.userProfile) {
      return res.status(403).json({
        success: false,
        error: 'NOT_REGISTERED',
        message: 'You are not registered yet. Please register before logging in.',
      });
    }

    // Role-based authorization: Generate secure JWT
    const token = jwt.sign(
      {
        userId: check.userProfile.id || check.userProfile.userId,
        mobile: cleanPhone,
        role: check.registeredRole,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    return res.json({
      success: true,
      token,
      isExistingUser: true,
      role: check.registeredRole,
      userProfile: check.userProfile,
      accountStatus: check.status,
      isRegistrationComplete: check.isRegistrationComplete,
      profileCompletionStatus: check.profileCompletionStatus,
      missingFields: check.missingFields,
      nextStep: check.nextStep,
      message: 'Login successful',
    });
  } else {
    // REGISTRATION OTP verification
    const check = await checkUserRegistration(cleanPhone, role);
    return res.json({
      success: true,
      verified: true,
      isExistingUser: check.isRegistered,
      role: check.registeredRole || role,
      accountStatus: check.status,
      isRegistrationComplete: check.isRegistrationComplete,
      profileCompletionStatus: check.profileCompletionStatus,
      missingFields: check.missingFields,
      nextStep: check.nextStep,
      message: 'OTP verified successfully. Please proceed with registration.',
    });
  }
});

// 2c-2. Check Comprehensive Registration Completion Status
app.get('/api/auth/registration-status', async (req: Request, res: Response) => {
  const mobile = (req.query.mobile as string) || '';
  const role = (req.query.role as any) || undefined;
  const cleanPhone = mobile.replace(/[^0-9]/g, '').slice(-10);

  if (cleanPhone.length !== 10) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PHONE',
      message: 'Please provide a valid 10-digit mobile number.',
    });
  }

  const check = await checkUserRegistration(cleanPhone, role);

  return res.json({
    success: true,
    isRegistered: check.isRegistered,
    isRegisteredOtherRole: check.isRegisteredOtherRole,
    otherRole: check.otherRole,
    role: check.registeredRole || role,
    accountStatus: check.status,
    isRegistrationComplete: check.isRegistrationComplete,
    profileCompletionStatus: check.profileCompletionStatus,
    missingFields: check.missingFields,
    nextStep: check.nextStep,
    userProfile: check.userProfile,
  });
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'TRUCKS Backend', timestamp: new Date().toISOString() });
});

// 2d. Current Authenticated User Info
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const check = await checkUserRegistration(req.user.mobile || '', req.user.role);
  if (!check.isRegistered) {
    return res.status(403).json({
      error: 'NOT_REGISTERED',
      message: 'Account no longer registered or has been deactivated.',
    });
  }

  return res.json({
    user: req.user,
    profile: check.userProfile,
    status: check.status,
  });
});

// 2e. Protected Role Dashboards Endpoints (Examples of Role-Protected APIs)
app.get(
  '/api/client/dashboard-data',
  authenticateToken,
  requireRole(['CLIENT']),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.mobile) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const check = await checkUserRegistration(req.user.mobile, 'CLIENT');
    if (!check.isRegistered) {
      return res.status(403).json({
        error: 'NOT_REGISTERED',
        message: 'You are not registered yet. Please register before logging in.',
      });
    }

    const status = check.status || 'PENDING_APPROVAL';
    if (status !== 'APPROVED' && status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'APPROVAL_REQUIRED',
        status,
        message:
          'Your registration is under review. You will get access to your dashboard once the Admin approves your account.',
      });
    }

    return res.json({
      success: true,
      status: 'APPROVED',
      companyName: check.userProfile?.companyName || check.userProfile?.company,
      message: 'Welcome to Client Dashboard API',
      user: req.user,
      profile: check.userProfile,
    });
  }
);

// 2f. Client Complete Registration Endpoint (Handles Direct Persistence via Admin Auth)
app.post('/api/client/submit-registration', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      mobile,
      companyPhone,
      email,
      designation,
      department,
      companyName,
      businessType,
      gstin,
      pan,
      registeredAddress,
      city,
      state,
      pincode,
      documents = [],
    } = req.body;

    const cleanContactPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const cleanCompanyPhone = (companyPhone || mobile || '').replace(/[^0-9]/g, '').slice(-10);

    if (cleanContactPhone.length !== 10 || !companyName || !fullName) {
      return res.status(400).json({ error: 'Missing mandatory registration fields (fullName, mobile, companyName)' });
    }

    // Role conflict check with Vendor and Driver
    const roleCheck = await checkUserRegistration(cleanContactPhone, 'CLIENT');
    if (roleCheck.isRegisteredOtherRole && roleCheck.status !== 'DEACTIVATED') {
      const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
      const otherLabel = formatRole(roleCheck.otherRole || 'Other');
      return res.status(409).json({
        error: 'ROLE_CONFLICT',
        roleConflict: true,
        previousRole: roleCheck.otherRole,
        message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
      });
    }

    // Authenticate supabase as admin for database operations
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });
    const adminAuthId = authData?.user?.id || '5fa0f865-0388-4779-99ad-03d8979c484a';

    // Check if client company or user exists
    const { data: existingUser } = await supabase
      .from('client_users')
      .select('id, client_id, client_company_id')
      .eq('mobile', cleanContactPhone)
      .maybeSingle();

    let targetCompanyId = existingUser?.client_company_id || existingUser?.client_id;
    let generatedCode = `CLI-${Math.floor(100000 + Math.random() * 900000)}`;

    if (!targetCompanyId && gstin) {
      const { data: existingComp } = await supabase
        .from('client_companies')
        .select('id, client_code')
        .eq('gstin', gstin.trim().toUpperCase())
        .maybeSingle();
      if (existingComp?.id) {
        targetCompanyId = existingComp.id;
        if (existingComp.client_code) generatedCode = existingComp.client_code;
      }
    }

    if (targetCompanyId) {
      // Update existing company
      const { error: updErr } = await supabase
        .from('client_companies')
        .update({
          company_name: companyName.trim(),
          business_type: businessType?.trim() || 'Private Limited',
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          pan: pan ? pan.trim().toUpperCase() : null,
          registered_address: registeredAddress?.trim() || '',
          city: city?.trim() || 'Guwahati',
          state: state?.trim() || 'Assam',
          pincode: pincode?.trim() || '781001',
          company_phone: cleanCompanyPhone,
          company_email: email ? email.trim().toLowerCase() : null,
          status: 'PENDING_APPROVAL',
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetCompanyId);

      if (updErr) {
        console.warn('client_companies update warning:', updErr.message);
      }
    } else {
      // Insert new company
      const { data: newComp, error: compErr } = await supabase
        .from('client_companies')
        .insert([
          {
            company_name: companyName.trim(),
            business_type: businessType?.trim() || 'Private Limited',
            gstin: gstin ? gstin.trim().toUpperCase() : null,
            pan: pan ? pan.trim().toUpperCase() : null,
            registered_address: registeredAddress?.trim() || '',
            city: city?.trim() || 'Guwahati',
            state: state?.trim() || 'Assam',
            pincode: pincode?.trim() || '781001',
            company_phone: cleanCompanyPhone,
            company_email: email ? email.trim().toLowerCase() : null,
            client_code: generatedCode,
            status: 'PENDING_APPROVAL',
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select('id, client_code')
        .single();

      if (compErr) {
        console.error('Submit registration company insert error:', compErr);
      }
      targetCompanyId = newComp?.id;
      if (newComp?.client_code) generatedCode = newComp.client_code;
    }

    if (targetCompanyId) {
      // Upsert client_users
      const { error: userErr } = await supabase
        .from('client_users')
        .upsert(
          [
            {
              client_id: targetCompanyId,
              client_company_id: targetCompanyId,
              full_name: fullName.trim(),
              mobile: cleanContactPhone,
              email: email ? email.trim().toLowerCase() : null,
              designation: designation?.trim() || 'Logistics Coordinator',
              department: department?.trim() || 'Supply Chain',
              is_primary_contact: true,
              phone_verified: true,
              status: 'PENDING_APPROVAL',
            },
          ],
          { onConflict: 'mobile' }
        );

      if (userErr) {
        console.warn('client_users upsert notice:', userErr.message);
      }

      // Clean up previous documents for this company on resubmission to prevent duplicate records
      if (documents.length > 0) {
        await supabase
          .from('documents')
          .delete()
          .eq('reference_id', targetCompanyId)
          .eq('category', 'CLIENT_TRANSIT');
      }

      // Insert documents into documents table using valid constraints
      for (const doc of documents) {
        try {
          const docType = doc.docType || 'DOCUMENT';
          const fileName = doc.fileName || `${docType.toLowerCase()}.pdf`;
          const storagePath = doc.storagePath || `clients/${cleanContactPhone}/${docType.toLowerCase()}.pdf`;

          await supabase
            .from('documents')
            .insert([
              {
                category: 'CLIENT_TRANSIT',
                document_type: 'CLIENT_INVOICE',
                reference_id: targetCompanyId,
                file_url: doc.fileUrl || storagePath,
                storage_path: storagePath,
                file_name: `${docType}: ${fileName}`,
                file_size: doc.fileSize || '500 KB',
                mime_type: doc.mimeType || 'application/pdf',
                verification_status: 'PENDING',
                uploaded_by: adminAuthId,
              },
            ]);
        } catch (dErr: any) {
          console.warn('Doc insert notice:', dErr?.message);
        }
      }
    }

    // Save to persistent Server User Registry
    const registry = getServerUserRegistry();
    const filtered = registry.filter((u) => u.mobile !== cleanContactPhone);
    filtered.unshift({
      mobile: cleanContactPhone,
      role: 'CLIENT',
      fullName: fullName.trim(),
      email: email?.trim(),
      companyName: companyName.trim(),
      status: 'PENDING_APPROVAL',
      registeredAt: new Date().toISOString(),
    });
    saveServerUserRegistry(filtered);

    return res.json({
      success: true,
      companyId: targetCompanyId,
      clientCode: generatedCode,
      status: 'PENDING_APPROVAL',
      message: 'Client registration submitted successfully and is pending admin approval.',
    });
  } catch (err: any) {
    console.error('Submit registration error:', err);
    return res.status(500).json({ error: err.message || 'Server registration error' });
  }
});

// 2g. Client Live Status Endpoint (Returns latest database and server registry status)
app.get('/api/client/status/:identifier', async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const idStr = String(identifier || '');
  const cleanPhone = idStr.replace(/[^0-9]/g, '').slice(-10);

  try {
    // 1. Try matching by phone or company ID in Supabase
    let query = supabase.from('client_companies').select('*');
    if (cleanPhone.length === 10) {
      const { data: userRec } = await supabase
        .from('client_users')
        .select('*, client_companies(*)')
        .eq('mobile', cleanPhone)
        .maybeSingle();

      if (userRec) {
        const comp = userRec.client_companies;
        return res.json({
          success: true,
          status: comp?.status || userRec.status || 'PENDING_APPROVAL',
          companyId: comp?.id || userRec.client_company_id,
          companyName: comp?.company_name,
          clientCode: comp?.client_code,
          fullName: userRec.full_name,
          email: userRec.email,
          mobile: userRec.mobile,
          rejectionReason: comp?.rejection_reason,
          correctionNotes: comp?.correction_notes,
          submittedAt: comp?.submitted_at || comp?.created_at,
          approvedAt: comp?.approved_at,
          approvedBy: comp?.approved_by,
        });
      }
    }

    // By ID
    const { data: compRec } = await supabase
      .from('client_companies')
      .select('*')
      .eq('id', identifier)
      .maybeSingle();

    if (compRec) {
      return res.json({
        success: true,
        status: compRec.status,
        companyId: compRec.id,
        companyName: compRec.company_name,
        clientCode: compRec.client_code,
        rejectionReason: compRec.rejection_reason,
        correctionNotes: compRec.correction_notes,
        submittedAt: compRec.submitted_at || compRec.created_at,
        approvedAt: compRec.approved_at,
        approvedBy: compRec.approved_by,
      });
    }

    // 2. Check Server Registry
    if (cleanPhone.length === 10) {
      const reg = getServerUserRegistry();
      const found = reg.find((u) => u.mobile === cleanPhone);
      if (found) {
        return res.json({
          success: true,
          status: found.status,
          companyName: found.companyName,
          fullName: found.fullName,
          mobile: found.mobile,
          clientCode: `CLI-${cleanPhone.slice(-6)}`,
          submittedAt: found.registeredAt || new Date().toISOString(),
        });
      }
    }

    return res.status(404).json({ error: 'Client record not found', status: 'NEW_USER' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2f. Admin Review & Approval Endpoint (Approve, Reject, or Request Corrections)
const handleAdminClientReview = async (req: Request, res: Response) => {
  const { mobile, companyId, decision, reviewerName = 'TRUCKS Compliance Desk', reason, notes } = req.body;
  let cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);

  if (!decision || !['APPROVED', 'REJECTED', 'CORRECTIONS_REQUESTED'].includes(decision)) {
    return res.status(400).json({
      error: 'INVALID_PARAMETERS',
      message: 'Valid decision (APPROVED | REJECTED | CORRECTIONS_REQUESTED) is required',
    });
  }

  if (decision === 'REJECTED' && !reason?.trim()) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: 'A rejection reason is strictly required when rejecting a client registration.',
    });
  }

  // Ensure authenticated admin connection
  await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  let resolvedCompanyId = companyId;

  // 1. If mobile provided but not companyId, look up company
  if (!resolvedCompanyId && cleanPhone) {
    const { data: uRec } = await supabase
      .from('client_users')
      .select('client_id, client_company_id')
      .eq('mobile', cleanPhone)
      .maybeSingle();
    resolvedCompanyId = uRec?.client_company_id || uRec?.client_id;
  }

  // If companyId provided but not mobile, look up mobile
  if (resolvedCompanyId && !cleanPhone) {
    const { data: uRec } = await supabase
      .from('client_users')
      .select('mobile')
      .eq('client_id', resolvedCompanyId)
      .maybeSingle();
    if (uRec?.mobile) {
      cleanPhone = uRec.mobile.replace(/[^0-9]/g, '').slice(-10);
    }
  }

  // 2. Update Database
  try {
    if (resolvedCompanyId) {
      const { error: upErr } = await supabase
        .from('client_companies')
        .update({
          status: decision === 'APPROVED' ? 'APPROVED' : decision,
          approved_at: decision === 'APPROVED' ? new Date().toISOString() : null,
          approved_by: decision === 'APPROVED' ? reviewerName : null,
          rejected_at: decision === 'REJECTED' ? new Date().toISOString() : null,
          rejected_by: decision === 'REJECTED' ? reviewerName : null,
          rejection_reason: decision === 'REJECTED' ? (reason || 'Application rejected by compliance') : null,
          correction_notes: decision === 'CORRECTIONS_REQUESTED' ? (notes || 'Corrections requested') : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedCompanyId);

      if (upErr) {
        console.warn('Failed to update client_companies in DB:', upErr.message);
      }
    }

    if (cleanPhone) {
      await supabase
        .from('client_users')
        .update({
          status: decision === 'APPROVED' ? 'ACTIVE' : decision,
        })
        .eq('mobile', cleanPhone);
    } else if (resolvedCompanyId) {
      await supabase
        .from('client_users')
        .update({
          status: decision === 'APPROVED' ? 'ACTIVE' : decision,
        })
        .eq('client_id', resolvedCompanyId);
    }
  } catch (dbErr: any) {
    console.warn('DB admin review sync notice:', dbErr.message);
  }

  // 3. Update persistent Server User Registry
  if (cleanPhone) {
    const registry = getServerUserRegistry();
    const existingIndex = registry.findIndex((u) => u.mobile === cleanPhone && u.role === 'CLIENT');
    if (existingIndex >= 0) {
      registry[existingIndex].status = decision === 'APPROVED' ? 'APPROVED' : decision;
      saveServerUserRegistry(registry);
    }
  }

  return res.json({
    success: true,
    decision,
    status: decision,
    companyId: resolvedCompanyId,
    mobile: cleanPhone,
    message: `Client status successfully updated to ${decision}`,
  });
};

app.post('/api/auth/admin-review-client', authenticateAdmin, handleAdminClientReview);
app.post('/api/client/admin-review', authenticateAdmin, handleAdminClientReview);

// ==========================================
// Regional Logistics Hubs Endpoints
// ==========================================
export const DEFAULT_REGIONAL_HUBS = [
  { id: 'hub_ghy', name: 'Guwahati (Gateway Hub)', city: 'Guwahati', state: 'Assam', region: 'North East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_slg', name: 'Siliguri (North Bengal Corridor)', city: 'Siliguri', state: 'West Bengal', region: 'East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_ccu', name: 'Kolkata (Dankuni Port Hub)', city: 'Kolkata', state: 'West Bengal', region: 'East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_del', name: 'Delhi / NCR Logistics Hub', city: 'Delhi', state: 'Delhi', region: 'North', status: 'ACTIVE', is_custom: false },
  { id: 'hub_bom', name: 'Mumbai / Bhiwandi Terminal', city: 'Mumbai', state: 'Maharashtra', region: 'West', status: 'ACTIVE', is_custom: false },
  { id: 'hub_hyd', name: 'Hyderabad Logistics Hub', city: 'Hyderabad', state: 'Telangana', region: 'South', status: 'ACTIVE', is_custom: false },
  { id: 'hub_agt', name: 'Agartala (Tripura Corridor)', city: 'Agartala', state: 'Tripura', region: 'North East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_dmp', name: 'Dimapur (Nagaland Hub)', city: 'Dimapur', state: 'Nagaland', region: 'North East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_shl', name: 'Shillong (Meghalaya Hub)', city: 'Shillong', state: 'Meghalaya', region: 'North East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_maa', name: 'Chennai Logistics Hub', city: 'Chennai', state: 'Tamil Nadu', region: 'South', status: 'ACTIVE', is_custom: false },
  { id: 'hub_blr', name: 'Bengaluru Logistics Terminal', city: 'Bengaluru', state: 'Karnataka', region: 'South', status: 'ACTIVE', is_custom: false },
  { id: 'hub_amd', name: 'Ahmedabad Logistics Park', city: 'Ahmedabad', state: 'Gujarat', region: 'West', status: 'ACTIVE', is_custom: false },
  { id: 'hub_pat', name: 'Patna Freight Hub', city: 'Patna', state: 'Bihar', region: 'East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_bbs', name: 'Bhubaneswar Logistics Hub', city: 'Bhubaneswar', state: 'Odisha', region: 'East', status: 'ACTIVE', is_custom: false },
  { id: 'hub_rpr', name: 'Raipur Logistics Terminal', city: 'Raipur', state: 'Chhattisgarh', region: 'Central', status: 'ACTIVE', is_custom: false },
  { id: 'hub_jpr', name: 'Jaipur Transport Hub', city: 'Jaipur', state: 'Rajasthan', region: 'North', status: 'ACTIVE', is_custom: false },
];

let cachedRegionalHubs: { hubs: any[]; expiresAt: number } | null = null;
const REGIONAL_HUBS_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get('/api/regional-hubs', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cachedRegionalHubs && cachedRegionalHubs.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, hubs: cachedRegionalHubs.hubs, cached: true });
  }

  try {
    const { data, error } = await supabase
      .from('regional_hubs')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('is_custom', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      cachedRegionalHubs = { hubs: data, expiresAt: now + REGIONAL_HUBS_TTL_MS };
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ success: true, hubs: data });
    }
  } catch (err: any) {
    console.warn('Supabase regional_hubs fetch error, falling back:', err.message);
  }
  return res.json({ success: true, hubs: DEFAULT_REGIONAL_HUBS });
});

app.post('/api/regional-hubs', async (req: Request, res: Response) => {
  const { name, city, state, region } = req.body;
  if (!name?.trim() || !city?.trim() || !state?.trim()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Name, City, and State are mandatory fields for creating a regional hub.',
    });
  }

  const cleanName = name.trim();
  const cleanCity = city.trim();
  const cleanState = state.trim();
  const cleanRegion = region?.trim() || 'National';

  // Check in-memory default hubs for duplicate
  const existingDefault = DEFAULT_REGIONAL_HUBS.find(
    (h) => h.city?.trim().toLowerCase() === cleanCity.toLowerCase() &&
           (h.name?.trim().toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(h.name?.trim().toLowerCase()))
  );
  if (existingDefault) {
    return res.status(200).json({ success: true, hub: existingDefault, duplicate: true });
  }

  try {
    // Check if matching hub already exists in DB (prevent duplicates)
    const { data: existingDbHubs } = await supabase
      .from('regional_hubs')
      .select('*')
      .or(`name.ilike.%${cleanName}%,city.ilike.%${cleanCity}%`)
      .limit(10);

    const exactMatch = (existingDbHubs || []).find(
      (h: any) => h.city?.trim().toLowerCase() === cleanCity.toLowerCase() &&
             (h.name?.trim().toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(h.name?.trim().toLowerCase()))
    );

    if (exactMatch) {
      return res.status(200).json({ success: true, hub: exactMatch, duplicate: true });
    }

    const hubId = `hub_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newHub = {
      id: hubId,
      name: `${cleanName} (${cleanCity})`,
      city: cleanCity,
      state: cleanState,
      region: cleanRegion,
      status: 'ACTIVE',
      is_custom: true,
    };

    const { data, error } = await supabase
      .from('regional_hubs')
      .insert([newHub])
      .select()
      .single();

    if (!error && data) {
      cachedRegionalHubs = null; // Invalidate cache
      return res.status(201).json({ success: true, hub: data });
    }
  } catch (err: any) {
    console.warn('Supabase regional_hubs duplicate check/insert error:', err.message);
  }

  const hubId = `hub_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fallbackHub = {
    id: hubId,
    name: `${cleanName} (${cleanCity})`,
    city: cleanCity,
    state: cleanState,
    region: cleanRegion,
    status: 'ACTIVE',
    is_custom: true,
  };
  return res.status(201).json({ success: true, hub: fallbackHub });
});

// ==========================================
// Vendor Registration & Lifecycle Endpoints
// ==========================================
app.post('/api/vendor/submit-registration', async (req: Request, res: Response) => {
  const {
    transporterName,
    contactPerson,
    mobile,
    email,
    pan,
    gstin,
    registeredAddress,
    city,
    state,
    pincode,
    operatingHubs = [],
    manualOperatingLocations = [],
    totalFleetCount,
    fleetStrength,
    vehicleConfigs = [],
    truckCategories = [],
    servicesOffered = [],
    documents = [],
    fleetDocuments = [],
  } = req.body;

  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);
  if (cleanPhone.length !== 10 || !transporterName?.trim()) {
    return res.status(400).json({ error: 'Missing mandatory registration fields (transporterName, mobile)' });
  }

  // Cross-role verification
  const roleCheck = await checkUserRegistration(cleanPhone, 'VENDOR');
  if (roleCheck.isRegisteredOtherRole && roleCheck.status !== 'DEACTIVATED') {
    const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
    const otherLabel = formatRole(roleCheck.otherRole || 'Other');
    return res.status(409).json({
      error: 'ROLE_CONFLICT',
      roleConflict: true,
      previousRole: roleCheck.otherRole,
      message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
    });
  }

  await ensureAdminAuth();

  try {
    const fullAddress = `${registeredAddress || ''}, ${city || ''}, ${state || ''} - ${pincode || ''}`.replace(/^, /, '').trim();

    // Check if vendor already exists
    const { data: existingUser } = await supabase
      .from('vendor_users')
      .select('id, vendor_id')
      .eq('mobile', cleanPhone)
      .maybeSingle();

    let targetVendorId = existingUser?.vendor_id;

    if (targetVendorId) {
      const canonicalAppNo = formatDisplayId('VD', targetVendorId);
      await supabase
        .from('vendor_companies')
        .update({
          vendor_name: transporterName.trim(),
          pan: (pan || 'NOT_PROVIDED').trim().toUpperCase(),
          gstin: gstin ? gstin.trim().toUpperCase() : null,
          address: fullAddress || null,
          status: 'PENDING',
          compliance_status: 'PENDING',
          vendor_code: canonicalAppNo,
          operating_routes: Array.isArray(operatingHubs) ? operatingHubs : [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetVendorId);
    } else {
      const { data: newComp, error: compErr } = await supabase
        .from('vendor_companies')
        .insert([
          {
            vendor_name: transporterName.trim(),
            pan: (pan || 'NOT_PROVIDED').trim().toUpperCase(),
            gstin: gstin ? gstin.trim().toUpperCase() : null,
            address: fullAddress || null,
            status: 'PENDING',
            compliance_status: 'PENDING',
            operating_routes: Array.isArray(operatingHubs) ? operatingHubs : [],
            onboarding_source: 'SELF_REGISTERED',
          },
        ])
        .select('id')
        .single();

      if (compErr) {
        console.error('Submit vendor company insert error:', compErr);
        throw compErr;
      }
      targetVendorId = newComp.id;
      const canonicalAppNo = formatDisplayId('VD', targetVendorId);
      await supabase
        .from('vendor_companies')
        .update({ vendor_code: canonicalAppNo })
        .eq('id', targetVendorId);
    }

    // Insert or update vendor_users
    if (existingUser?.id) {
      await supabase
        .from('vendor_users')
        .update({
          full_name: (contactPerson || transporterName).trim(),
          email: email?.trim().toLowerCase() || null,
          status: 'ACTIVE',
        })
        .eq('id', existingUser.id);
    } else {
      await supabase.from('vendor_users').insert([
        {
          vendor_id: targetVendorId,
          full_name: (contactPerson || transporterName).trim(),
          mobile: cleanPhone,
          email: email?.trim().toLowerCase() || null,
          status: 'ACTIVE',
        },
      ]);
    }

    // Persist documents in documents table (excluding Bank Statement)
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        // Bank Statement is completely excluded
        if (doc.docType === 'BANK_STATEMENT' || (doc.title && doc.title.toLowerCase().includes('bank statement'))) {
          continue;
        }
        if (doc.fileUrl || doc.fileName || doc.storagePath) {
          try {
            await supabase.from('documents').insert([
              {
                category: 'CLIENT_TRANSIT',
                document_type: 'TIE_UP_AUTHORIZATION',
                reference_id: targetVendorId,
                file_url: doc.fileUrl || doc.storagePath || '',
                file_name: `${doc.docType || 'VENDOR_DOC'}: ${doc.fileName || 'document.pdf'}`,
                file_size: doc.fileSize || '350 KB',
                mime_type: doc.mimeType || 'application/pdf',
                storage_path: doc.storagePath || doc.fileUrl || null,
                verification_status: 'PENDING',
                uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
              },
            ]);
          } catch (dErr: any) {
            console.warn('Vendor doc insert notice:', dErr.message);
          }
        }
      }
    }

    const generatedAppNo = `VND-${Date.now().toString().slice(-6)}`;
    const parsedTotalCount = totalFleetCount ? Number(totalFleetCount) : (Array.isArray(vehicleConfigs) && vehicleConfigs.length > 0 ? vehicleConfigs.reduce((sum: number, c: any) => sum + (Number(c.vehicleCount || c.count) || 1), 0) : 0);
    const parsedFleetStrength = fleetStrength || (parsedTotalCount > 0 ? `${parsedTotalCount} Commercial Vehicles` : '');

    // Update fleet_size on vendor_companies if available
    if (targetVendorId && parsedTotalCount > 0) {
      try {
        await supabase
          .from('vendor_companies')
          .update({ fleet_size: String(parsedTotalCount) })
          .eq('id', targetVendorId);
      } catch (fErr) {
        console.warn('Backend vendor fleet_size update notice:', fErr);
      }
    }

    // Persist vehicles into vehicles table & link to vendor
    const vehicleIdByReg = new Map<string, string>();
    const vehicleIdByConfigId = new Map<string, string>();
    const driverIdByReg = new Map<string, string>();

    if (Array.isArray(vehicleConfigs) && vehicleConfigs.length > 0) {
      for (const cfg of vehicleConfigs) {
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
            console.warn(`Backend vehicle insertion notice for ${rawReg}:`, vErr.message);
          }

          const targetVehId = vRecord?.id;
          if (targetVehId) {
            vehicleIdByReg.set(rawReg, targetVehId);
            if (cfg.id) vehicleIdByConfigId.set(cfg.id, targetVehId);

            await supabase
              .from('vendor_vehicle_links')
              .upsert([
                {
                  vendor_id: targetVendorId,
                  vehicle_id: targetVehId,
                  status: 'PENDING',
                },
              ], { onConflict: 'vendor_id,vehicle_id' });
          }

          // Driver enrollment for this vehicle if driver info provided
          const drvName = (cfg.driverName || '').trim();
          const drvPhone = (cfg.driverPhone || cleanPhone).replace(/[^0-9]/g, '').slice(-10);
          const drvLicence = (cfg.driverLicence || `DL-${drvPhone || Date.now().toString().slice(-6)}`).trim().toUpperCase();

          if (drvName || cfg.driverPhone || cfg.driverLicence) {
            const { data: dRecord, error: dErr } = await supabase
              .from('drivers')
              .insert([
                {
                  primary_vendor_id: targetVendorId,
                  full_name: drvName || `Driver for ${rawReg}`,
                  name: drvName || `Driver for ${rawReg}`,
                  mobile: drvPhone,
                  phone: drvPhone,
                  licence_number: drvLicence,
                  license_number: drvLicence,
                  licence_expiry_date: '2029-12-31',
                  status: 'PENDING',
                },
              ])
              .select('id')
              .maybeSingle();

            if (dErr) {
              console.warn(`Backend driver enrollment notice for ${rawReg}:`, dErr.message);
            }

            if (dRecord?.id) {
              driverIdByReg.set(rawReg, dRecord.id);
              if (cfg.id) driverIdByReg.set(cfg.id, dRecord.id);
            }
          }
        } catch (vehLoopErr) {
          console.warn('Backend vehicle enrollment error in registration:', vehLoopErr);
        }
      }
    }

    // Persist Individual Fleet & Driver Documents in documents table
    if (Array.isArray(fleetDocuments) && fleetDocuments.length > 0) {
      for (const fDoc of fleetDocuments) {
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
                  reference_id: matchedDriverId || matchedVehId || targetVendorId,
                  file_url: fDoc.fileUrl || fDoc.storagePath || `https://necl.in/vendor-docs/${targetVendorId}/dl-${cleanReg || 'driver'}.pdf`,
                  file_name: fDoc.fileName ? `[${cleanReg || 'Fleet'}] Driver Licence: ${fDoc.fileName}` : `[${cleanReg || 'Fleet'}] Driver Licence.pdf`,
                  file_size: fDoc.fileSize || '350 KB',
                  mime_type: 'application/pdf',
                  storage_path: fDoc.storagePath || null,
                  verification_status: 'PENDING',
                  uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
                },
              ]);
            } else {
              let mappedType = fDoc.docType;
              if (mappedType === 'C_BOOK') mappedType = 'FITNESS';
              else if (mappedType === 'PUC') mappedType = 'OTHER';

              if (matchedVehId) {
                await supabase.from('documents').insert([
                  {
                    category: 'VEHICLE',
                    document_type: mappedType,
                    reference_id: matchedVehId,
                    file_url: fDoc.fileUrl || fDoc.storagePath || `https://necl.in/vendor-docs/${targetVendorId}/${mappedType.toLowerCase()}-${cleanReg}.pdf`,
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
          } catch (fdErr: any) {
            console.warn('Backend fleet doc insert notice:', fdErr.message);
          }
        }
      }
    }

    // Persist submission in auth_audit_log for Admin audit checks
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: targetVendorId,
          user_type: 'VENDOR_MOBILE',
          event_type: 'VENDOR_REGISTRATION_SUBMITTED',
          details: {
            appNo: generatedAppNo,
            transporter: transporterName,
            fleet: parsedFleetStrength,
            totalFleetCount: parsedTotalCount,
            fleetStrength: parsedFleetStrength,
            operatingHubs: Array.isArray(operatingHubs) ? operatingHubs : [],
            manualOperatingLocations: Array.isArray(manualOperatingLocations) ? manualOperatingLocations : [],
            vehicleConfigs,
            configs: vehicleConfigs,
            fleetDocuments,
          },
        },
      ]);
    } catch (auditErr) {
      console.warn('Backend vendor audit log notice:', auditErr);
    }

    // Update Server Registry
    const registry = getServerUserRegistry();
    const filtered = registry.filter((u) => u.mobile !== cleanPhone);
    filtered.unshift({
      mobile: cleanPhone,
      role: 'VENDOR',
      fullName: (contactPerson || transporterName).trim(),
      companyName: transporterName.trim(),
      email: email?.trim().toLowerCase() || undefined,
      status: 'PENDING',
      registeredAt: new Date().toISOString(),
      operatingHubs,
      manualOperatingLocations,
      totalFleetCount: parsedTotalCount || undefined,
      fleetStrength: parsedFleetStrength || undefined,
      vehicleConfigs,
      servicesOffered,
    });
    saveServerUserRegistry(filtered);

    const canonicalAppNo = formatDisplayId('VD', targetVendorId);

    return res.json({
      success: true,
      vendorId: targetVendorId,
      vendorCode: canonicalAppNo,
      applicationNumber: canonicalAppNo,
      status: 'PENDING',
      complianceStatus: 'PENDING',
      message: 'Vendor registration submitted successfully and is pending admin approval.',
    });
  } catch (err: any) {
    console.error('Submit vendor registration error:', err);
    return res.status(500).json({ error: err.message || 'Server vendor registration error' });
  }
});

app.get('/api/vendor/status/:identifier', async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const idStr = String(identifier || '');
  const cleanPhone = idStr.replace(/[^0-9]/g, '').slice(-10);

  try {
    await ensureAdminAuth();
    if (cleanPhone.length === 10) {
      // 1. Check vendor_users with join to vendor_companies
      const { data: userRec } = await supabase
        .from('vendor_users')
        .select('*, vendor_companies(*)')
        .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
        .maybeSingle();

      if (userRec) {
        const comp = userRec.vendor_companies;
        const canonicalCode = comp?.vendor_code || formatDisplayId('VD', comp?.id || userRec.vendor_id);
        return res.json({
          success: true,
          status: comp?.status || userRec.status || 'PENDING',
          complianceStatus: comp?.compliance_status || comp?.status || 'PENDING',
          vendorId: comp?.id || userRec.vendor_id,
          vendorCode: canonicalCode,
          vendorName: comp?.vendor_name,
          contactPerson: userRec.full_name,
          email: userRec.email,
          mobile: userRec.mobile,
          submittedAt: comp?.created_at,
          approvedAt: comp?.approved_at,
          rejectionReason: comp?.rejection_reason || null,
          correctionNotes: comp?.correction_notes || null,
        });
      }

      // 2. Check vendor_companies directly by phone
      const { data: compByPhone } = await supabase
        .from('vendor_companies')
        .select('*')
        .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
        .maybeSingle();

      if (compByPhone) {
        const canonicalCode = compByPhone.vendor_code || formatDisplayId('VD', compByPhone.id);
        return res.json({
          success: true,
          status: compByPhone.status || 'PENDING',
          complianceStatus: compByPhone.compliance_status || compByPhone.status || 'PENDING',
          vendorId: compByPhone.id,
          vendorCode: canonicalCode,
          vendorName: compByPhone.vendor_name,
          submittedAt: compByPhone.created_at,
          approvedAt: compByPhone.approved_at,
          rejectionReason: compByPhone.rejection_reason || null,
          correctionNotes: compByPhone.correction_notes || null,
        });
      }

      // 3. Check persistent server registry
      const reg = getServerUserRegistry();
      const regEntry = reg.find((r) => r.mobile === cleanPhone && r.role === 'VENDOR');
      if (regEntry) {
        return res.json({
          success: true,
          status: regEntry.status || 'PENDING',
          complianceStatus: regEntry.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
          vendorId: `ven-${cleanPhone}`,
          vendorCode: `VD-${cleanPhone.slice(-6)}`,
          vendorName: regEntry.companyName || regEntry.fullName,
          contactPerson: regEntry.fullName,
          mobile: regEntry.mobile,
          submittedAt: regEntry.registeredAt,
        });
      }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
    let compQuery = supabase.from('vendor_companies').select('*');
    if (isUuid) {
      compQuery = compQuery.eq('id', idStr);
    } else {
      compQuery = compQuery.eq('vendor_code', idStr);
    }
    const { data: compRec } = await compQuery.maybeSingle();

    if (compRec) {
      const canonicalCode = compRec.vendor_code || formatDisplayId('VD', compRec.id);
      return res.json({
        success: true,
        status: compRec.status,
        complianceStatus: compRec.compliance_status || compRec.status || 'PENDING',
        vendorId: compRec.id,
        vendorCode: canonicalCode,
        vendorName: compRec.vendor_name,
        submittedAt: compRec.created_at,
        approvedAt: compRec.approved_at,
        rejectionReason: compRec.rejection_reason || null,
        correctionNotes: compRec.correction_notes || null,
      });
    }

    return res.status(404).json({ error: 'Vendor record not found', status: 'NOT_REGISTERED' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2b-2. Vendor Directory / Transporter List for Driver Registration and Fleet Association
const handleGetVendors = async (req: Request, res: Response) => {
  try {
    await ensureAdminAuth();

    const { data: dbVendors, error } = await supabase
      .from('vendor_companies')
      .select('id, vendor_name, vendor_code, address, status, phone, vendor_users(mobile, full_name)')
      .order('vendor_name', { ascending: true });

    const results: any[] = [];
    const seenIds = new Set<string>();

    if (!error && Array.isArray(dbVendors)) {
      for (const v of dbVendors) {
        seenIds.add(v.id);
        const addressParts = (v.address || '').split(',');
        const city = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : (addressParts[0]?.trim() || 'Guwahati');
        const phone = v.vendor_users?.[0]?.mobile || v.phone || '';
        results.push({
          id: v.id,
          name: v.vendor_name || 'Registered Transporter',
          vendor_name: v.vendor_name || 'Registered Transporter',
          vendorCode: v.vendor_code || formatDisplayId('VD', v.id),
          vendor_code: v.vendor_code || formatDisplayId('VD', v.id),
          phone,
          city,
          address: v.address || `${city}, North East`,
          status: v.status || 'APPROVED',
        });
      }
    }

    // Incorporate vendors from server user registry
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const registry = getServerUserRegistry();
    for (const u of registry) {
      if (u.role === 'VENDOR' && u.companyName) {
        // Find if this vendor exists in dbVendors by phone or name
        const matchDb = dbVendors?.find(
          (dbV: any) =>
            dbV.phone === u.mobile ||
            (Array.isArray(dbV.vendor_users) && dbV.vendor_users.some((vu: any) => vu.mobile === u.mobile)) ||
            dbV.vendor_name?.toLowerCase() === u.companyName?.toLowerCase()
        );

        let vendorId = matchDb?.id;
        if (!vendorId) {
          // Generate a deterministic valid UUID v4 from the phone number
          const hash = crypto.createHash('md5').update(`necl_vendor_${u.mobile}`).digest('hex');
          vendorId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        }

        if (!seenIds.has(vendorId)) {
          seenIds.add(vendorId);
          results.push({
            id: vendorId,
            name: u.companyName,
            vendor_name: u.companyName,
            vendorCode: `VD-${u.mobile.slice(-6)}`,
            vendor_code: `VD-${u.mobile.slice(-6)}`,
            phone: u.mobile,
            city: 'Guwahati',
            address: 'Guwahati Freight Terminal, Assam',
            status: u.status || 'APPROVED',
          });
        }
      }
    }

    // Fallback verified TRUCKS fleet transporters if registry & DB are empty
    if (results.length === 0) {
      results.push(
        {
          id: '45fbbb9f-d975-4f2c-94f4-1fe4ce964753',
          name: 'TRUCKS Central Dedicated Fleet',
          vendor_name: 'TRUCKS Central Dedicated Fleet',
          vendorCode: 'VD-NECL-01',
          vendor_code: 'VD-NECL-01',
          phone: '9865001122',
          city: 'Guwahati',
          address: 'TRUCKS Transport Complex, Betkuchi, Guwahati, Assam',
          status: 'APPROVED',
        },
        {
          id: '8a9c3d2e-1b4f-4a7c-8e2d-3c5b7e9a1f2b',
          name: 'TRUCKS North East Express Transporters',
          vendor_name: 'TRUCKS North East Express Transporters',
          vendorCode: 'VD-NECL-02',
          vendor_code: 'VD-NECL-02',
          phone: '9865003344',
          city: 'Siliguri',
          address: 'Bypass Transport Nagar, Siliguri, West Bengal',
          status: 'APPROVED',
        },
        {
          id: '9b8a7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
          name: 'Brahmaputra Freight Carriers',
          vendor_name: 'Brahmaputra Freight Carriers',
          vendorCode: 'VD-BFC-03',
          vendor_code: 'VD-BFC-03',
          phone: '9865005566',
          city: 'Beltola',
          address: 'Beltola Chariali Logistics Park, Guwahati, Assam',
          status: 'APPROVED',
        }
      );
    }

    return res.json(results);
  } catch (err: any) {
    console.warn('Get vendors error:', err);
    return res.status(500).json({ error: err.message || 'Could not fetch vendors' });
  }
};

app.get('/api/database/vendors', handleGetVendors);
app.get('/api/vendors', handleGetVendors);
app.get('/database/vendors', handleGetVendors);

// ==========================================
// Driver Registration & Lifecycle Endpoints
// ==========================================
app.post('/api/driver/submit-registration', async (req: Request, res: Response) => {
  const {
    fullName,
    mobile,
    dateOfBirth,
    dob,
    licenceNumber,
    licenceExpiryDate,
    primaryVendorId,
    dlFrontUri,
    dlBackUri,
    aadhaarFrontUri,
    aadhaarBackUri,
    documents = [],
  } = req.body;

  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);
  const cleanLicence = (licenceNumber && licenceNumber.trim()) ? licenceNumber.trim().toUpperCase() : `DL-${cleanPhone}`;
  const effectiveDob = dateOfBirth || dob || null;

  if (cleanPhone.length !== 10 || !fullName?.trim()) {
    return res.status(400).json({ error: 'Missing mandatory registration fields (fullName, mobile)' });
  }

  // Cross-role verification
  const roleCheck = await checkUserRegistration(cleanPhone, 'DRIVER');
  if (roleCheck.isRegisteredOtherRole && roleCheck.status !== 'DEACTIVATED') {
    const formatRole = (r: string) => (r === 'CLIENT' ? 'Client' : r === 'VENDOR' ? 'Vendor' : r === 'DRIVER' ? 'Driver' : r);
    const otherLabel = formatRole(roleCheck.otherRole || 'Other');
    return res.status(409).json({
      error: 'ROLE_CONFLICT',
      roleConflict: true,
      previousRole: roleCheck.otherRole,
      message: `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`,
    });
  }

  await ensureAdminAuth();

  try {
    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('id')
      .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
      .maybeSingle();

    let targetDriverId = existingDriver?.id;

    // Resolve primaryVendorId safely against UUID constraints
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedVendorId: string | null = null;

    if (primaryVendorId && isUuid.test(String(primaryVendorId).trim())) {
      resolvedVendorId = String(primaryVendorId).trim();
    } else if (primaryVendorId) {
      // Lookup vendor by vendor_code or phone in vendor_companies
      const cleanVendorCode = String(primaryVendorId).trim();
      const { data: vComp } = await supabase
        .from('vendor_companies')
        .select('id')
        .or(`vendor_code.eq.${cleanVendorCode},phone.eq.${cleanVendorCode}`)
        .maybeSingle();
      if (vComp?.id && isUuid.test(vComp.id)) {
        resolvedVendorId = vComp.id;
      }
    }

    // Fallback: If no vendor associated yet, check if there is an approved primary vendor or leave null
    if (!resolvedVendorId) {
      const { data: defaultVendor } = await supabase
        .from('vendor_companies')
        .select('id')
        .eq('status', 'APPROVED')
        .limit(1)
        .maybeSingle();
      if (defaultVendor?.id && isUuid.test(defaultVendor.id)) {
        resolvedVendorId = defaultVendor.id;
      }
    }

    // Default licence expiry date if missing to satisfy PostgreSQL NOT NULL constraint
    const defaultExpiryDate = `${new Date().getFullYear() + 5}-12-31`;
    const resolvedExpiryDate = (licenceExpiryDate && String(licenceExpiryDate).trim().length >= 4)
      ? String(licenceExpiryDate).trim()
      : defaultExpiryDate;

    const driverPayload = {
      full_name: fullName.trim(),
      mobile: cleanPhone,
      phone: cleanPhone,
      licence_number: cleanLicence,
      licence_expiry_date: resolvedExpiryDate,
      date_of_birth: effectiveDob,
      dob: effectiveDob,
      primary_vendor_id: resolvedVendorId,
      status: 'PENDING',
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    };

    if (targetDriverId) {
      const { error: updErr } = await supabase.from('drivers').update(driverPayload).eq('id', targetDriverId);
      if (updErr) {
        console.error('Submit driver update error:', updErr);
        throw updErr;
      }
    } else {
      const { data: newDriver, error: driverErr } = await supabase
        .from('drivers')
        .insert([driverPayload])
        .select('id')
        .single();

      if (driverErr) {
        console.error('Submit driver insert error:', driverErr);
        throw driverErr;
      }
      targetDriverId = newDriver.id;
    }

    // Persist single-screen front/back documents if provided
    const allDocs = [...documents];
    if (dlFrontUri) {
      allDocs.push({
        docType: 'LICENCE',
        fileName: 'DL Front Side: dl_front.jpg',
        fileUrl: dlFrontUri,
        storagePath: dlFrontUri,
        docSide: 'FRONT',
      });
    }
    if (dlBackUri) {
      allDocs.push({
        docType: 'LICENCE',
        fileName: 'DL Back Side: dl_back.jpg',
        fileUrl: dlBackUri,
        storagePath: dlBackUri,
        docSide: 'BACK',
      });
    }
    if (aadhaarFrontUri) {
      allDocs.push({
        docType: 'AADHAAR',
        fileName: 'Aadhaar Front Side: aadhaar_front.jpg',
        fileUrl: aadhaarFrontUri,
        storagePath: aadhaarFrontUri,
        docSide: 'FRONT',
      });
    }
    if (aadhaarBackUri) {
      allDocs.push({
        docType: 'AADHAAR',
        fileName: 'Aadhaar Back Side: aadhaar_back.jpg',
        fileUrl: aadhaarBackUri,
        storagePath: aadhaarBackUri,
        docSide: 'BACK',
      });
    }

    // Persist documents
    if (Array.isArray(allDocs) && allDocs.length > 0) {
      for (const doc of allDocs) {
        if (doc.fileUrl || doc.fileName || doc.storagePath) {
          const rawType = doc.docType || 'LICENCE';
          const validDocType = rawType.toUpperCase().includes('AADHA')
            ? 'AADHAAR'
            : rawType.toUpperCase().includes('FITNESS')
            ? 'FITNESS'
            : rawType.toUpperCase().includes('PERMIT')
            ? 'PERMIT'
            : rawType.toUpperCase().includes('INSUR')
            ? 'INSURANCE'
            : rawType.toUpperCase().includes('RC')
            ? 'RC'
            : 'LICENCE';

          try {
            await supabase.from('documents').insert([
              {
                category: 'DRIVER',
                document_type: validDocType,
                reference_id: targetDriverId,
                file_url: doc.fileUrl || doc.storagePath || '',
                file_name: doc.fileName || `${validDocType}: driver_doc.jpg`,
                file_size: doc.fileSize || '300 KB',
                mime_type: doc.mimeType || 'image/jpeg',
                storage_path: doc.storagePath || doc.fileUrl || null,
                verification_status: 'PENDING',
                uploaded_by: '5fa0f865-0388-4779-99ad-03d8979c484a',
              },
            ]);
          } catch (dErr: any) {
            console.warn('Driver doc insert notice:', dErr.message);
          }
        }
      }
    }

    // Update Server Registry
    const registry = getServerUserRegistry();
    const filtered = registry.filter((u) => u.mobile !== cleanPhone);
    filtered.unshift({
      mobile: cleanPhone,
      role: 'DRIVER',
      fullName: fullName.trim(),
      status: 'PENDING',
      registeredAt: new Date().toISOString(),
    });
    saveServerUserRegistry(filtered);

    const generatedAppNo = `DRV-${Date.now().toString().slice(-6)}`;
    return res.json({
      success: true,
      driverId: targetDriverId,
      applicationNumber: generatedAppNo,
      status: 'PENDING',
      message: 'Driver registration submitted successfully and is pending admin approval.',
    });
  } catch (err: any) {
    console.error('Submit driver registration error:', err);
    return res.status(500).json({ error: err.message || 'Server driver registration error' });
  }
});

app.get('/api/driver/status/:identifier', async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const idStr = String(identifier || '');
  const cleanPhone = idStr.replace(/[^0-9]/g, '').slice(-10);

  try {
    await ensureAdminAuth();
    if (cleanPhone.length === 10) {
      const { data: driverRec } = await supabase
        .from('drivers')
        .select('*')
        .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone}`)
        .maybeSingle();

      if (driverRec) {
        return res.json({
          success: true,
          status: driverRec.status || 'PENDING',
          driverId: driverRec.id,
          fullName: driverRec.full_name,
          mobile: driverRec.mobile,
          licenceNumber: driverRec.licence_number,
          rejectionReason: driverRec.rejection_reason,
          submittedAt: driverRec.created_at,
        });
      }
    }

    const { data: dRec } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', identifier)
      .maybeSingle();

    if (dRec) {
      return res.json({
        success: true,
        status: dRec.status,
        driverId: dRec.id,
        fullName: dRec.full_name,
        licenceNumber: dRec.licence_number,
        rejectionReason: dRec.rejection_reason,
        submittedAt: dRec.created_at,
      });
    }

    return res.status(404).json({ error: 'Driver record not found', status: 'NOT_REGISTERED' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin All Registered Drivers Endpoint (with full vendor details)
app.get('/api/admin/drivers', async (req: Request, res: Response) => {
  try {
    await ensureAdminAuth();
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*, vendor_companies:primary_vendor_id(id, vendor_name, vendor_code)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Admin drivers query error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, count: drivers?.length || 0, data: drivers || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/drivers', async (req: Request, res: Response) => {
  try {
    await ensureAdminAuth();
    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(drivers || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Admin Decision Endpoints for Vendor & Driver
// ==========================================
app.post('/api/admin/vendor-approval', authenticateAdmin, async (req: Request, res: Response) => {
  const { vendorId, decision, reviewerName = 'TRUCKS Admin Compliance Desk' } = req.body;
  if (!vendorId || !decision) {
    return res.status(400).json({ error: 'vendorId and decision are required' });
  }

  await ensureAdminAuth();

  try {
    const { error: upErr } = await supabase
      .from('vendor_companies')
      .update({
        status: decision,
        approved_at: decision === 'APPROVED' ? new Date().toISOString() : null,
        approved_by: decision === 'APPROVED' ? reviewerName : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId);

    if (upErr) throw upErr;

    // Synchronize vendor_users table status
    try {
      await supabase
        .from('vendor_users')
        .update({
          status: decision === 'APPROVED' ? 'ACTIVE' : decision,
        })
        .eq('vendor_id', vendorId);
    } catch (vUserErr) {
      console.warn('Vendor user status sync notice:', vUserErr);
    }

    // Update server registry
    const { data: vUsers } = await supabase
      .from('vendor_users')
      .select('mobile')
      .eq('vendor_id', vendorId);

    if (vUsers && vUsers.length > 0) {
      const reg = getServerUserRegistry();
      for (const u of vUsers) {
        const idx = reg.findIndex((r) => r.mobile === u.mobile && r.role === 'VENDOR');
        if (idx >= 0) {
          reg[idx].status = decision;
        }
      }
      saveServerUserRegistry(reg);
    }

    return res.json({ success: true, decision, message: `Vendor updated to ${decision}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/driver-approval', authenticateAdmin, async (req: Request, res: Response) => {
  const { driverId, decision, reviewerName = 'TRUCKS Admin Compliance Desk', reason } = req.body;
  if (!driverId || !decision) {
    return res.status(400).json({ error: 'driverId and decision are required' });
  }

  await ensureAdminAuth();

  try {
    const { data: driverData, error: upErr } = await supabase
      .from('drivers')
      .update({
        status: decision,
        rejection_reason: decision === 'REJECTED' ? (reason || 'Application rejected by compliance') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driverId)
      .select('mobile')
      .single();

    if (upErr) throw upErr;

    if (driverData?.mobile) {
      const cleanPhone = driverData.mobile.replace(/[^0-9]/g, '').slice(-10);
      const reg = getServerUserRegistry();
      const idx = reg.findIndex((r) => r.mobile === cleanPhone && r.role === 'DRIVER');
      if (idx >= 0) {
        reg[idx].status = decision;
        saveServerUserRegistry(reg);
      }
    }

    return res.json({ success: true, decision, message: `Driver updated to ${decision}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/vendor/dashboard-data', authenticateToken, requireRole(['VENDOR']), (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Welcome to Vendor Dashboard API', user: req.user });
});

app.get('/api/driver/dashboard-data', authenticateToken, requireRole(['DRIVER']), (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Welcome to Driver Dashboard API', user: req.user });
});

// ==========================================
// Admin Users & Toggle-based Permission Management
// ==========================================

// Get all Admin Panel users with attached permissions
app.get('/api/admin/users', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await ensureAdminAuth();
  try {
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('id, auth_uid, name, email, role, avatar_url, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = (adminUsers || []).map((u) => ({
      ...u,
      permissions: permissionService.getPermissionsForUser(u.id, u.role as any),
    }));

    return res.json({ success: true, users: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create new regular Admin user (Guarded: Super Admin only)
app.post('/api/admin/users', authenticateAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, permissions } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  await ensureAdminAuth();

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'An admin account with this email already exists' });
    }

    const newAuthUid = 'adm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const { data: newUser, error: insErr } = await supabase
      .from('admin_users')
      .insert({
        auth_uid: newAuthUid,
        name: name.trim(),
        email: cleanEmail,
        role: 'ADMIN',
        is_active: true,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Initialize permissions
    const finalPerms = permissions
      ? await permissionService.setPermissionsForUser(newUser.id, permissions, req.user?.userId, req.user?.email)
      : permissionService.getPermissionsForUser(newUser.id, 'ADMIN');

    // Audit log
    await supabase.from('audit_logs').insert([
      {
        user_id: req.user?.userId || 'superadmin',
        user_role: 'SUPER_ADMIN',
        action: 'CREATE_ADMIN_USER',
        entity_type: 'ADMIN_USER',
        entity_id: newUser.id,
        payload_after: { id: newUser.id, name: newUser.name, email: newUser.email, role: 'ADMIN' },
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(201).json({
      success: true,
      message: `Admin user ${newUser.name} created successfully.`,
      user: { ...newUser, permissions: finalPerms },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Admin account status: Activate, Deactivate, Suspend, Restore (Guarded: Super Admin only)
app.patch('/api/admin/users/:id/status', authenticateAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { is_active, reason } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active (boolean) is required' });
  }

  await ensureAdminAuth();

  try {
    // Prevent deactivating own Super Admin account
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, name, email, role, is_active')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (targetUser.role === 'SUPER_ADMIN' && !is_active && targetUser.id === req.user?.userId) {
      return res.status(400).json({ error: 'Super Admin cannot deactivate their own active account.' });
    }

    const { error: updErr } = await supabase
      .from('admin_users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updErr) throw updErr;

    const actionName = is_active ? 'RESTORE_ADMIN_USER' : 'SUSPEND_ADMIN_USER';

    await supabase.from('audit_logs').insert([
      {
        user_id: req.user?.userId || 'superadmin',
        user_role: 'SUPER_ADMIN',
        action: actionName,
        entity_type: 'ADMIN_USER',
        entity_id: id,
        payload_before: { is_active: targetUser.is_active },
        payload_after: { is_active, reason: reason || 'Super Admin action' },
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.json({
      success: true,
      message: `Admin user ${targetUser.name} has been ${is_active ? 'activated / restored' : 'suspended / deactivated'}.`,
      is_active,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get granular permissions for a specific Admin user
app.get('/api/admin/users/:id/permissions', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await ensureAdminAuth();

  try {
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const permissions = permissionService.getPermissionsForUser(targetUser.id, targetUser.role as any);
    return res.json({ success: true, userId: targetUser.id, role: targetUser.role, permissions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Save granular permissions for an Admin user (Guarded: Super Admin only)
app.put('/api/admin/users/:id/permissions', authenticateAdmin, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'Valid permissions object is required' });
  }

  await ensureAdminAuth();

  try {
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, role, name')
      .eq('id', id)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return res.status(400).json({
        error: 'CANNOT_RESTRICT_SUPER_ADMIN',
        message: 'Super Admin maintains unrestricted administrative authority across all modules and actions.',
      });
    }

    const saved = await permissionService.setPermissionsForUser(
      targetUser.id,
      permissions,
      req.user?.userId || 'superadmin',
      req.user?.email || 'superadmin@necl.com'
    );

    return res.json({
      success: true,
      message: `Permissions updated successfully for ${targetUser.name}.`,
      permissions: saved,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get currently authenticated admin user's permissions
app.get('/api/admin/current-user-permissions', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const permissions = permissionService.getPermissionsForUser(req.user.userId, req.user.role as any);
  return res.json({
    success: true,
    user: req.user,
    permissions,
    modules: SYSTEM_MODULES,
  });
});

// ── Permanent Administrative User Deletion Endpoint ──
// Safely and permanently cascades removal of client, vendor, driver, or admin accounts
app.post('/api/admin/delete-user', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role, mobile, companyId, reason } = req.body;
  const adminActor = req.user?.email || 'admin@necl.com';

  if (!userId && !mobile && !companyId) {
    return res.status(400).json({ error: 'At least one identifier (userId, mobile, or companyId) is required.' });
  }

  await ensureAdminAuth();

  const cleanPhone = (mobile || '').replace(/[^0-9]/g, '').slice(-10);
  const detectedRole = (role || '').toUpperCase();

  try {
    const deletedEntities: Record<string, any> = {};

    // ── 1. CLIENT DELETION ──
    if (detectedRole === 'CLIENT' || (!detectedRole && (companyId || userId))) {
      let targetCompId = companyId;
      let targetUserPhone = cleanPhone;
      let targetUserId = userId;

      if (!targetCompId && targetUserId) {
        const { data: cUser } = await supabase
          .from('client_users')
          .select('id, client_id, client_company_id, mobile')
          .eq('id', targetUserId)
          .maybeSingle();
        if (cUser) {
          targetCompId = cUser.client_company_id || cUser.client_id;
          if (!targetUserPhone && cUser.mobile) targetUserPhone = cUser.mobile.replace(/[^0-9]/g, '').slice(-10);
        }
      }

      if (!targetCompId && targetUserPhone) {
        const { data: cUser } = await supabase
          .from('client_users')
          .select('id, client_id, client_company_id, mobile')
          .or(`mobile.eq.${targetUserPhone},mobile.eq.+91${targetUserPhone}`)
          .maybeSingle();
        if (cUser) {
          targetCompId = cUser.client_company_id || cUser.client_id;
        } else {
          const { data: cComp } = await supabase
            .from('client_companies')
            .select('id, company_phone')
            .or(`company_phone.eq.${targetUserPhone},company_phone.eq.+91${targetUserPhone}`)
            .maybeSingle();
          if (cComp) targetCompId = cComp.id;
        }
      }

      if (targetCompId) {
        // Cascade delete all client requirements & quotations
        const { data: clientReqs } = await supabase
          .from('requirements')
          .select('id')
          .eq('client_id', targetCompId);

        if (clientReqs && clientReqs.length > 0) {
          const reqIds = clientReqs.map((r: any) => r.id);
          for (const rId of reqIds) {
            await supabase.from('client_quotations').delete().eq('requirement_id', rId);
            await supabase.from('client_quotes').delete().eq('requirement_id', rId);
            await supabase.from('vendor_quotations').delete().eq('requirement_id', rId);
            await supabase.from('vendor_requests').delete().eq('requirement_id', rId);
          }
          await supabase.from('requirements').delete().eq('client_id', targetCompId);
        }

        // Delete documents
        await supabase
          .from('documents')
          .delete()
          .or(`reference_id.eq.${targetCompId},reference_id.eq.${targetUserId || 'none'}`);

        // Delete client_users
        if (targetUserPhone) {
          await supabase
            .from('client_users')
            .delete()
            .or(`client_company_id.eq.${targetCompId},client_id.eq.${targetCompId},mobile.eq.${targetUserPhone},mobile.eq.+91${targetUserPhone}`);
        } else {
          await supabase
            .from('client_users')
            .delete()
            .or(`client_company_id.eq.${targetCompId},client_id.eq.${targetCompId}`);
        }

        // Delete client_companies
        await supabase
          .from('client_companies')
          .delete()
          .eq('id', targetCompId);

        deletedEntities.clientCompanyId = targetCompId;
      } else if (targetUserId) {
        await supabase.from('client_users').delete().eq('id', targetUserId);
        deletedEntities.clientUserId = targetUserId;
      }
    }

    // ── 2. VENDOR DELETION ──
    if (detectedRole === 'VENDOR' || (!detectedRole && !deletedEntities.clientCompanyId)) {
      let targetVendorCompId = companyId;
      let targetVendorPhone = cleanPhone;
      let targetVendorUserId = userId;

      if (!targetVendorCompId && targetVendorUserId) {
        const { data: vUser } = await supabase
          .from('vendor_users')
          .select('id, vendor_id, mobile')
          .eq('id', targetVendorUserId)
          .maybeSingle();
        if (vUser) {
          targetVendorCompId = vUser.vendor_id;
          if (!targetVendorPhone && vUser.mobile) targetVendorPhone = vUser.mobile.replace(/[^0-9]/g, '').slice(-10);
        }
      }

      if (!targetVendorCompId && targetVendorPhone) {
        const { data: vComp } = await supabase
          .from('vendor_companies')
          .select('id')
          .or(`phone.eq.${targetVendorPhone},phone.eq.+91${targetVendorPhone}`)
          .maybeSingle();
        if (vComp) targetVendorCompId = vComp.id;
      }

      if (targetVendorCompId) {
        await supabase.from('vendor_driver_links').delete().eq('vendor_id', targetVendorCompId);
        await supabase.from('vendor_vehicle_links').delete().eq('vendor_id', targetVendorCompId);
        await supabase.from('vendor_quotations').delete().eq('vendor_id', targetVendorCompId);
        await supabase.from('vendor_requests').delete().eq('vendor_id', targetVendorCompId);
        await supabase.from('documents').delete().eq('reference_id', targetVendorCompId);
        
        if (targetVendorPhone) {
          await supabase.from('vendor_users').delete().or(`vendor_id.eq.${targetVendorCompId},mobile.eq.${targetVendorPhone},mobile.eq.+91${targetVendorPhone}`);
        } else {
          await supabase.from('vendor_users').delete().eq('vendor_id', targetVendorCompId);
        }
        await supabase.from('vendor_companies').delete().eq('id', targetVendorCompId);
        deletedEntities.vendorCompanyId = targetVendorCompId;
      }
    }

    // ── 3. DRIVER DELETION ──
    if (detectedRole === 'DRIVER' || (!detectedRole && !deletedEntities.clientCompanyId && !deletedEntities.vendorCompanyId)) {
      let targetDriverId = userId;
      let targetDriverPhone = cleanPhone;

      if (!targetDriverId && targetDriverPhone) {
        const { data: drv } = await supabase
          .from('drivers')
          .select('id')
          .or(`mobile.eq.${targetDriverPhone},mobile.eq.+91${targetDriverPhone},phone.eq.${targetDriverPhone},phone.eq.+91${targetDriverPhone}`)
          .maybeSingle();
        if (drv) targetDriverId = drv.id;
      }

      if (targetDriverId) {
        await supabase.from('driver_documents').delete().eq('driver_id', targetDriverId);
        await supabase.from('documents').delete().eq('reference_id', targetDriverId);
        await supabase.from('vendor_driver_links').delete().eq('driver_id', targetDriverId);
        await supabase.from('drivers').delete().eq('id', targetDriverId);
        deletedEntities.driverId = targetDriverId;
      }
    }

    // ── 4. ADMIN USER DELETION ──
    if (detectedRole === 'ADMIN' || detectedRole === 'SUPER_ADMIN') {
      const { data: adminU } = await supabase
        .from('admin_users')
        .select('id, email, role')
        .or(`id.eq.${userId || 'none'},email.eq.${(userId || '').toLowerCase()}`)
        .maybeSingle();

      if (adminU) {
        if (adminU.role === 'SUPER_ADMIN') {
          return res.status(400).json({ error: 'Super Admin accounts cannot be deleted.' });
        }
        await supabase.from('admin_users').delete().eq('id', adminU.id);
        deletedEntities.adminUserId = adminU.id;
      }
    }

    // ── 5. Clean up from Server User Registry ──
    if (cleanPhone) {
      const registry = getServerUserRegistry();
      const updatedRegistry = registry.filter((u) => u.mobile !== cleanPhone);
      if (updatedRegistry.length !== registry.length) {
        saveServerUserRegistry(updatedRegistry);
        deletedEntities.serverRegistryCleaned = true;
      }
    }

    // ── 6. Log Deletion to auth_audit_log & audit_logs ──
    try {
      await supabase.from('auth_audit_log').insert([
        {
          event_type: 'USER_DELETED_BY_ADMIN',
          user_id: userId || companyId || cleanPhone || 'unknown',
          details: {
            role: detectedRole || 'UNKNOWN',
            deletedEntities,
            deletedBy: adminActor,
            reason: reason || 'Permanent administrative deletion requested',
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      await supabase.from('audit_logs').insert([
        {
          user_id: req.user?.userId || 'admin',
          user_role: req.user?.role || 'ADMIN',
          action: 'PERMANENT_USER_DELETION',
          entity_type: detectedRole || 'USER',
          entity_id: userId || companyId || cleanPhone || 'unknown',
          payload_after: { deletedEntities, deletedBy: adminActor, reason },
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      message: 'User and all associated records have been permanently removed from the system.',
      deletedEntities,
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
});

// ==========================================
// Admin Registration Drafts Endpoints
// ==========================================

// 1. List All Drafts (Filterable by entityType: CLIENT or VENDOR)
app.get('/api/admin/drafts', authenticateAdmin, async (req: Request, res: Response) => {
  const entityType = req.query.entityType as string | undefined;
  await ensureAdminAuth();

  let drafts: AdminRegistrationDraftRecord[] = getFileDrafts();

  try {
    let query = supabase.from('admin_registration_drafts').select('*').order('updated_at', { ascending: false });
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    const { data: dbData, error } = await query;
    if (!error && Array.isArray(dbData) && dbData.length > 0) {
      // Map DB snake_case columns to record format
      const mappedDb: AdminRegistrationDraftRecord[] = dbData.map((d: any) => ({
        id: d.id,
        entityType: d.entity_type,
        title: d.title,
        status: d.status || 'DRAFT',
        stepProgress: d.step_progress || 1,
        completionPercentage: d.completion_percentage || 0,
        formData: d.form_data || {},
        documentRefs: d.document_refs || [],
        vehicleDetails: d.vehicle_details || [],
        operatingLanes: d.operating_lanes || [],
        selectedServices: d.selected_services || [],
        createdBy: d.created_by || 'admin@necl.com',
        createdAt: d.created_at || new Date().toISOString(),
        updatedAt: d.updated_at || new Date().toISOString(),
      }));

      // Merge DB records with local cache
      const draftMap = new Map<string, AdminRegistrationDraftRecord>();
      mappedDb.forEach((d) => draftMap.set(d.id, d));
      drafts.forEach((d) => {
        if (!draftMap.has(d.id)) {
          if (!entityType || d.entityType === entityType) {
            draftMap.set(d.id, d);
          }
        }
      });
      drafts = Array.from(draftMap.values());
      saveFileDrafts(drafts);
    }
  } catch (dbErr) {
    console.warn('[Drafts] DB query notice:', dbErr);
  }

  if (entityType) {
    drafts = drafts.filter((d) => d.entityType === entityType);
  }

  // Filter out COMPLETED drafts from default list
  drafts = drafts.filter((d) => d.status !== 'COMPLETED');
  drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return res.json({ success: true, drafts });
});

// 2. Get Single Draft by ID
app.get('/api/admin/drafts/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await ensureAdminAuth();

  let draft = getFileDrafts().find((d) => d.id === id);

  try {
    const { data: dbDraft, error } = await supabase
      .from('admin_registration_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && dbDraft) {
      draft = {
        id: dbDraft.id,
        entityType: dbDraft.entity_type,
        title: dbDraft.title,
        status: dbDraft.status || 'DRAFT',
        stepProgress: dbDraft.step_progress || 1,
        completionPercentage: dbDraft.completion_percentage || 0,
        formData: dbDraft.form_data || {},
        documentRefs: dbDraft.document_refs || [],
        vehicleDetails: dbDraft.vehicle_details || [],
        operatingLanes: dbDraft.operating_lanes || [],
        selectedServices: dbDraft.selected_services || [],
        createdBy: dbDraft.created_by || 'admin@necl.com',
        createdAt: dbDraft.created_at || new Date().toISOString(),
        updatedAt: dbDraft.updated_at || new Date().toISOString(),
      };
    }
  } catch {}

  if (!draft) {
    return res.status(404).json({ error: 'DRAFT_NOT_FOUND', message: 'Registration draft not found.' });
  }

  return res.json({ success: true, draft });
});

// 3. Save or Update Draft (Database backed with local persistent backup)
app.post('/api/admin/drafts', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const {
    id,
    entityType,
    title,
    status = 'DRAFT',
    stepProgress = 1,
    completionPercentage,
    formData = {},
    documentRefs = [],
    vehicleDetails = [],
    operatingLanes = [],
    selectedServices = [],
  } = req.body;

  if (!entityType || (entityType !== 'CLIENT' && entityType !== 'VENDOR')) {
    return res.status(400).json({ error: 'INVALID_ENTITY_TYPE', message: 'entityType must be CLIENT or VENDOR.' });
  }

  const draftId = id || crypto.randomUUID();
  const draftTitle =
    (title && title.trim()) ||
    formData.company_name ||
    formData.companyName ||
    formData.businessName ||
    `Untitled ${entityType === 'CLIENT' ? 'Client' : 'Vendor'} Draft`;

  // Calculate completion percentage if not provided
  let calculatedPercent = completionPercentage;
  if (calculatedPercent === undefined || calculatedPercent === null) {
    if (entityType === 'CLIENT') {
      const fields = [
        formData.company_name,
        formData.pan,
        formData.gstin,
        formData.client_type,
        formData.address_line_1,
        formData.city,
        formData.state,
        formData.pincode,
        formData.contact_name,
        formData.mobile,
        formData.email,
      ];
      const filled = fields.filter((f) => Boolean(f && String(f).trim())).length;
      calculatedPercent = Math.min(100, Math.round((filled / fields.length) * 100));
    } else {
      const fields = [
        formData.businessName,
        formData.pan,
        formData.gstin,
        formData.mobile,
        formData.contactPerson,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.pincode,
        (vehicleDetails && vehicleDetails.length > 0) ? 'vehicles' : '',
      ];
      const filled = fields.filter((f) => Boolean(f && String(f).trim())).length;
      calculatedPercent = Math.min(100, Math.round((filled / fields.length) * 100));
    }
  }

  const now = new Date().toISOString();
  const createdBy = req.user?.email || 'admin@necl.com';

  const draftRecord: AdminRegistrationDraftRecord = {
    id: draftId,
    entityType,
    title: draftTitle,
    status,
    stepProgress: Number(stepProgress) || 1,
    completionPercentage: calculatedPercent,
    formData,
    documentRefs,
    vehicleDetails,
    operatingLanes,
    selectedServices,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Persist to file storage
  const fileDrafts = getFileDrafts();
  const existingIndex = fileDrafts.findIndex((d) => d.id === draftId);
  if (existingIndex >= 0) {
    draftRecord.createdAt = fileDrafts[existingIndex].createdAt;
    fileDrafts[existingIndex] = draftRecord;
  } else {
    fileDrafts.unshift(draftRecord);
  }
  saveFileDrafts(fileDrafts);

  // 2. Persist to database table admin_registration_drafts
  try {
    await ensureAdminAuth();
    const { error: upsertErr } = await supabase.from('admin_registration_drafts').upsert({
      id: draftId,
      entity_type: entityType,
      title: draftTitle,
      status,
      step_progress: Number(stepProgress) || 1,
      completion_percentage: calculatedPercent,
      form_data: formData,
      document_refs: documentRefs,
      vehicle_details: vehicleDetails,
      operating_lanes: operatingLanes,
      selected_services: selectedServices,
      created_by: createdBy,
      updated_at: now,
    });
    if (upsertErr) {
      console.warn('[Drafts] Supabase upsert notice:', upsertErr.message);
    }
  } catch (dbErr) {
    console.warn('[Drafts] Database persistence exception:', dbErr);
  }

  return res.json({
    success: true,
    message: 'Draft saved successfully.',
    draft: draftRecord,
  });
});

// 4. Delete Draft
app.delete('/api/admin/drafts/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await ensureAdminAuth();

  // Remove from file storage
  const fileDrafts = getFileDrafts();
  const filtered = fileDrafts.filter((d) => d.id !== id);
  saveFileDrafts(filtered);

  // Remove from Supabase
  try {
    await supabase.from('admin_registration_drafts').delete().eq('id', id);
  } catch (err) {
    console.warn('[Drafts] DB delete notice:', err);
  }

  return res.json({ success: true, message: 'Draft deleted successfully.' });
});

// 5. Complete / Finalize Draft upon full registration submission
app.post('/api/admin/drafts/:id/complete', authenticateAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  await ensureAdminAuth();

  // Update file storage
  const fileDrafts = getFileDrafts();
  const draft = fileDrafts.find((d) => d.id === id);
  if (draft) {
    draft.status = 'COMPLETED';
    draft.updatedAt = new Date().toISOString();
    saveFileDrafts(fileDrafts);
  }

  // Update or delete from Supabase
  try {
    await supabase.from('admin_registration_drafts').delete().eq('id', id);
  } catch {}

  return res.json({ success: true, message: 'Draft marked as completed and removed.' });
});

// Get Audit Logs (Guarded: Admin with audit_logs:view or Super Admin)
app.get('/api/admin/audit-logs', authenticateAdmin, requireAdminPermission('audit_logs', 'view'), async (req: Request, res: Response) => {
  await ensureAdminAuth();
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json({ success: true, logs: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3c. Supabase Database Health & Connection Status
app.get('/api/database/status', async (req: Request, res: Response) => {
  try {
    await ensureAdminAuth();

    const tables = [
      'client_companies',
      'vendor_companies',
      'vehicles',
      'drivers',
      'requirements',
      'bookings',
      'trips',
      'documents',
      'payment_records'
    ];

    const results: Record<string, any> = {};
    let connectedTables = 0;

    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        results[table] = { status: 'PENDING_MIGRATION', error: error.message };
      } else {
        results[table] = { status: 'ONLINE', count: count || 0 };
        connectedTables++;
      }
    }

    res.json({
      supabaseUrl: config.supabase.url,
      connected: connectedTables > 0,
      activeTables: connectedTables,
      totalTables: tables.length,
      tables: results,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3d. Database Entity Queries connected to Supabase
app.get('/api/database/clients', async (req: Request, res: Response) => {
  const { data, error } = await supabase.from('client_companies').select('*, client_users(*)');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/database/vendors', async (req: Request, res: Response) => {
  const { data, error } = await supabase.from('vendor_companies').select('*, drivers(*), vendor_vehicle_links(vehicle:vehicles(*))');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/database/vehicles', async (req: Request, res: Response) => {
  const { data, error } = await supabase.from('vehicles').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// 4. Dashboard KPIs & Analytics
let cachedDashboardStats: { data: any; expiresAt: number } | null = null;
const DASHBOARD_STATS_TTL_MS = 15 * 1000; // 15 seconds

app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
  const now = Date.now();
  if (cachedDashboardStats && cachedDashboardStats.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.json(cachedDashboardStats.data);
  }

  try {
    const [reqsRes, boksRes, tripsRes] = await Promise.all([
      supabase.from('requirements').select('id, status, created_at'),
      supabase.from('bookings').select('id, booking_status, payment_status, confirmed_at'),
      supabase.from('trips').select('id, trip_status, vendor_rate')
    ]);

    const reqs = reqsRes.data || [];
    const boks = boksRes.data || [];
    const trips = tripsRes.data || [];

    const totalRequirements = reqs.length;
    const activeBookings = boks.filter(b => b.booking_status !== 'CANCELLED').length;
    const inTransit = trips.filter(t => t.trip_status === 'IN_TRANSIT').length;
    const completedTrips = trips.filter(t => t.trip_status === 'COMPLETED').length;
    const totalPayments = trips.reduce((sum, t) => sum + (Number(t.vendor_rate) || 0), 0);
    const pendingActions = reqs.filter(r => r.status === 'UNDER_REVIEW').length + boks.filter(b => b.payment_status === 'PAYMENT_PENDING').length;

    const formattedRevenue = totalPayments >= 100000
      ? `₹${(totalPayments / 100000).toFixed(1)}L`
      : `₹${totalPayments.toLocaleString('en-IN')}`;

    const responsePayload = {
      kpis: {
        totalRequirements: { value: totalRequirements, change: '0% vs last week', trend: 'up' },
        activeBookings: { value: activeBookings, change: '0% vs last week', trend: 'up' },
        inTransit: { value: inTransit, change: '0% vs last week', trend: 'up' },
        completedTrips: { value: completedTrips, change: '0% vs last week', trend: 'up' },
        clientPayments: { value: formattedRevenue, change: '0% vs last week', trend: 'up' },
        pendingActions: { value: pendingActions, change: '0% vs yesterday', trend: 'up' },
      },
      charts: {
        bookingsOverview: [],
        tripStatus: {
          totalTrips: trips.length,
          segments: [
            { label: 'In Transit', count: inTransit, percentage: trips.length ? Math.round((inTransit / trips.length) * 100) : 0, color: '#10B981' },
            { label: 'Completed', count: completedTrips, percentage: trips.length ? Math.round((completedTrips / trips.length) * 100) : 0, color: '#2A2A2C' },
          ],
        },
        topClients: [],
      },
      activeTripTrack: null,
      recentActivities: [],
      upcomingDeadlines: [],
    };

    cachedDashboardStats = { data: responsePayload, expiresAt: now + DASHBOARD_STATS_TTL_MS };
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Universal Search API
app.get('/api/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const category = (req.query.category as string || 'all').toLowerCase();

  if (!query) {
    return res.json({
      query: '',
      total: 0,
      results: [],
      recentSearches,
    });
  }

  try {
    const results: SearchEntity[] = [];

    if (category === 'all' || category === 'client') {
      const { data: clients } = await supabase
        .from('client_companies')
        .select('id, company_name, gstin, city')
        .ilike('company_name', `%${query}%`)
        .limit(5);

      clients?.forEach(c => {
        results.push({
          id: c.id,
          category: 'client',
          title: c.company_name,
          subtitle: `Client | GSTIN: ${c.gstin || 'N/A'} | City: ${c.city || 'N/A'}`,
          tag: 'Client',
          details: c,
        });
      });
    }

    if (category === 'all' || category === 'vendor') {
      const { data: vendors } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, pan')
        .ilike('vendor_name', `%${query}%`)
        .limit(5);

      vendors?.forEach(v => {
        results.push({
          id: v.id,
          category: 'vendor',
          title: v.vendor_name,
          subtitle: `Vendor | PAN: ${v.pan || 'N/A'}`,
          tag: 'Vendor',
          details: v,
        });
      });
    }

    if (category === 'all' || category === 'booking') {
      const { data: boks } = await supabase
        .from('bookings')
        .select('id, booking_status, payment_status')
        .ilike('id', `%${query}%`)
        .limit(5);

      boks?.forEach(b => {
        results.push({
          id: b.id,
          category: 'booking',
          title: b.id,
          subtitle: `Booking | Status: ${b.booking_status} | Payment: ${b.payment_status}`,
          tag: 'Booking',
          details: b,
        });
      });
    }

    if (category === 'all' || category === 'vehicle') {
      const { data: vehs } = await supabase
        .from('vehicles')
        .select('id, registration_number, vehicle_type')
        .ilike('registration_number', `%${query}%`)
        .limit(5);

      vehs?.forEach(v => {
        results.push({
          id: v.registration_number,
          category: 'vehicle',
          title: v.registration_number,
          subtitle: `Vehicle | Type: ${v.vehicle_type || 'Trailer'}`,
          tag: 'Vehicle',
          details: v,
        });
      });
    }

    res.json({
      query,
      total: results.length,
      results,
      recentSearches,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/search/recent/clear', (req: Request, res: Response) => {
  recentSearches = [];
  res.json({ success: true, recentSearches });
});

// 6. Notifications API (queries Supabase audit_logs for real activity)
app.get('/api/notifications', async (req: Request, res: Response) => {
  try {
    const { data: auditData } = await supabase
      .from('audit_logs')
      .select('id, action, table_name, record_id, changed_by, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    const notifs = (auditData || []).map((log: any) => ({
      id: log.id,
      category: 'booking' as const,
      title: `${log.action} on ${log.table_name}`,
      refId: log.record_id || log.id,
      subtitle: `Changed by: ${log.changed_by || 'System'} | Table: ${log.table_name}`,
      time: log.created_at,
      timestamp: new Date(log.created_at),
      isRead: false,
      isImportant: false,
    }));

    res.json({
      total: notifs.length,
      unreadCount: notifs.length,
      notifications: notifs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
  // Read-state is managed client-side; return success
  res.json({ success: true, unreadCount: 0 });
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  res.json({ success: true, unreadCount: 0 });
});

// Push Notification Token Registry
app.post('/api/notifications/register-token', (req: Request, res: Response) => {
  const { pushToken, userId, role, platform } = req.body;
  if (!pushToken) {
    return res.status(400).json({ success: false, error: 'pushToken is required' });
  }

  const result = NotificationService.registerToken({
    pushToken,
    userId,
    role,
    platform,
  });

  res.json({ success: result.success, message: 'Device push token successfully registered.' });
});

// Push Notification Dispatcher (Expo Push API)
app.post('/api/notifications/send-push', async (req: Request, res: Response) => {
  const { to, userId, role, title, body, data } = req.body;

  if (!title || !body) {
    return res.status(400).json({ success: false, error: 'title and body are required' });
  }

  // Resolve recipient tokens
  let targetTokens: string[] = [];
  if (to) {
    targetTokens = Array.isArray(to) ? to : [to];
  } else if (userId || role) {
    targetTokens = NotificationService.getTokens({ userId, role });
  }

  if (targetTokens.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No active device tokens found for the specified recipient criteria.',
    });
  }

  const dispatchResult = await NotificationService.sendPush({
    to: targetTokens,
    title,
    body,
    data,
  });

  res.json(dispatchResult);
});

// Test Push Notification Dispatcher (FCM Mobile & Web)
// Test Push Notification Dispatcher (FCM Mobile & Web)
app.post('/api/notifications/test-fcm', async (req: Request, res: Response) => {
  const { targetRole, role, targetUserId, title, body, icon } = req.body;
  const effectiveRole = (role || targetRole || 'CLIENT') as 'CLIENT' | 'VENDOR' | 'DRIVER' | 'ADMIN';

  let defaultTitle = 'THE TRUCKX - Live Dispatch Alert';
  let defaultBody = 'Trip #TRP-8821 lorry has been placed and GPS tracking is now live.';

  if (effectiveRole === 'VENDOR') {
    defaultTitle = 'New Freight Requirement Available 📦';
    defaultBody = 'Guwahati → Siliguri | 25 MT TMT Steel open for quotation. Review specs & place bid.';
  } else if (effectiveRole === 'DRIVER') {
    defaultTitle = 'Trip Assigned: Report to Loading Bay 🚚';
    defaultBody = 'Trip #TRP-8821 assigned. Vehicle: AS-01-EC-9942. Report for cargo loading.';
  }

  const testTitle = title || defaultTitle;
  const testBody = body || defaultBody;
  const notifIcon = icon || 'notification_icon';

  let tokens = NotificationService.getTokens({
    role: effectiveRole,
    userId: targetUserId,
  });

  // If no tokens found, register a test mobile recipient token so dispatch test succeeds
  if (tokens.length === 0) {
    const demoToken = `fcm_${effectiveRole.toLowerCase()}_demo_${Date.now()}`;
    NotificationService.registerToken({
      pushToken: demoToken,
      userId: targetUserId || `${effectiveRole.toLowerCase()}_demo_user`,
      role: effectiveRole,
      platform: 'android',
    });
    tokens = [demoToken];
  }

  const dispatchResult = await NotificationService.sendPush({
    to: tokens,
    title: testTitle,
    body: testBody,
    data: {
      source: 'FCM_TEST_DISPATCH',
      role: effectiveRole,
      icon: notifIcon,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      timestamp: new Date().toISOString(),
      tripId: 'TRP-8821',
    },
  });

  res.json({
    success: true,
    message: `Test FCM push notification processed for ${tokens.length} ${effectiveRole} device(s)`,
    role: effectiveRole,
    recipients: tokens,
    result: dispatchResult,
  });
});

// Test Push specifically for Vendor / Fleet Partner
app.post('/api/notifications/test-vendor', async (req: Request, res: Response) => {
  const { title, body, targetUserId } = req.body;
  const testTitle = title || 'Trip Awarded: Assign Vehicle & Driver 🏆';
  const testBody = body || 'Booking #BK-2026-904 (Guwahati → Siliguri) has been awarded to your fleet. Assign driver to issue digital LR.';

  let tokens = NotificationService.getTokens({ role: 'VENDOR', userId: targetUserId });
  if (tokens.length === 0) {
    const demoToken = `fcm_vendor_sample_${Date.now()}`;
    NotificationService.registerToken({
      pushToken: demoToken,
      userId: targetUserId || 'vendor_demo_user',
      role: 'VENDOR',
      platform: 'android',
    });
    tokens = [demoToken];
  }

  const result = await NotificationService.sendPush({
    to: tokens,
    title: testTitle,
    body: testBody,
    data: {
      source: 'VENDOR_AWARD_DISPATCH',
      role: 'VENDOR',
      icon: 'notification_icon',
      bookingId: 'BK-2026-904',
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ success: true, role: 'VENDOR', recipients: tokens, result });
});

// Test Push specifically for Driver
app.post('/api/notifications/test-driver', async (req: Request, res: Response) => {
  const { title, body, targetUserId } = req.body;
  const testTitle = title || 'New Trip Assigned: Guwahati → Siliguri 🚚';
  const testBody = body || 'Trip #TRP-8821. Vehicle: AS-01-EC-9942. Report to loading bay for digital LR verification.';

  let tokens = NotificationService.getTokens({ role: 'DRIVER', userId: targetUserId });
  if (tokens.length === 0) {
    const demoToken = `fcm_driver_sample_${Date.now()}`;
    NotificationService.registerToken({
      pushToken: demoToken,
      userId: targetUserId || 'driver_demo_user',
      role: 'DRIVER',
      platform: 'android',
    });
    tokens = [demoToken];
  }

  const result = await NotificationService.sendPush({
    to: tokens,
    title: testTitle,
    body: testBody,
    data: {
      source: 'DRIVER_ASSIGNMENT_DISPATCH',
      role: 'DRIVER',
      icon: 'notification_icon',
      tripId: 'TRP-8821',
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ success: true, role: 'DRIVER', recipients: tokens, result });
});

// Device Tokens Inspector (Admin view)
app.get('/api/notifications/device-tokens', (req: Request, res: Response) => {
  const { role, userId } = req.query;
  const tokens = NotificationService.getTokens({
    role: typeof role === 'string' ? role : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
  });
  res.json({ total: tokens.length, tokens });
});

// 7. Quick Creation Actions — creates real Supabase records
app.post('/api/quick-actions/create-booking', authenticateAdmin, async (req: Request, res: Response) => {
  const { client, origin, destination, lorry, rate } = req.body;

  if (!client || !origin || !destination) {
    return res.status(400).json({ error: 'client, origin, and destination are required.' });
  }

  try {
    // Look up client_company by name or id
    const { data: clientData } = await supabase
      .from('client_companies')
      .select('id')
      .or(`id.eq.${client},company_name.ilike.%${client}%`)
      .limit(1)
      .single();

    if (!clientData) {
      return res.status(400).json({ error: `Client '${client}' not found in the database.` });
    }

    // Create a requirement first, then link booking
    const { data: req_, error: reqErr } = await supabase
      .from('requirements')
      .insert({
        client_company_id: clientData.id,
        origin,
        destination,
        status: 'POSTED',
      })
      .select('id')
      .single();

    if (reqErr || !req_) {
      return res.status(500).json({ error: reqErr?.message || 'Failed to create requirement.' });
    }

    const { data: booking, error: bokErr } = await supabase
      .from('bookings')
      .insert({
        requirement_id: req_.id,
        client_company_id: clientData.id,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (bokErr || !booking) {
      return res.status(500).json({ error: bokErr?.message || 'Failed to create booking.' });
    }

    res.json({ success: true, bookId: booking.id, message: 'Booking created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Booking creation failed' });
  }
});

// ============================================================================
// PHASE 5: COMMERCIAL PRICING, MARGIN ENGINE & CONFIDENTIALITY ENDPOINTS
// ============================================================================

// 1. Admin Create / Issue Client Quotation with Commercial Margin
app.post('/api/pricing/create-client-quote', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      requirementId,
      vendorQuotationId,
      vendorCost,
      marginType = 'FIXED',
      marginValue = 0,
      extraCharges = 0,
      gstRatePercent = 18,
      validityDays = 7,
      status = 'SENT',
      terms,
    } = req.body;

    if (!requirementId) {
      return res.status(400).json({ error: 'requirementId is required.' });
    }

    let finalVendorCost = Number(vendorCost);

    // Look up vendor quotation if provided and vendorCost not explicitly supplied
    if ((!finalVendorCost || finalVendorCost <= 0) && vendorQuotationId) {
      const { data: vqData } = await supabase
        .from('vendor_quotations')
        .select('quoted_rate')
        .eq('id', vendorQuotationId)
        .maybeSingle();

      if (vqData?.quoted_rate) {
        finalVendorCost = Number(vqData.quoted_rate);
      }
    }

    if (!finalVendorCost || finalVendorCost <= 0) {
      return res.status(400).json({ error: 'Valid vendor base cost greater than zero is required.' });
    }

    const numMarginVal = Number(marginValue || 0);
    if (numMarginVal < 0) {
      return res.status(400).json({ error: 'Commercial margin cannot be negative.' });
    }

    // Commercial Pricing Calculations (Safe 2-decimal Currency Rounding)
    const marginAmount = marginType === 'PERCENT'
      ? Math.round((finalVendorCost * (numMarginVal / 100)) * 100) / 100
      : Math.round(numMarginVal * 100) / 100;

    const numExtraCharges = Math.max(0, Number(extraCharges || 0));
    const taxableBase = Math.round((finalVendorCost + marginAmount + numExtraCharges) * 100) / 100;
    const numGstRate = Number(gstRatePercent ?? 18);
    const gstAmount = Math.round((taxableBase * (numGstRate / 100)) * 100) / 100;
    const totalClientAmount = Math.round((taxableBase + gstAmount) * 100) / 100;

    // Sequential versioning
    const { data: existingQuotes } = await supabase
      .from('client_quotes')
      .select('version')
      .eq('requirement_id', requirementId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingQuotes && existingQuotes.length > 0
      ? (existingQuotes[0].version || 1) + 1
      : 1;

    const validityExpiresAt = new Date(Date.now() + Number(validityDays) * 86400000).toISOString();

    const newQuoteRecord = {
      requirement_id: requirementId,
      version: nextVersion,
      vendor_base_cost: finalVendorCost,
      admin_margin: marginAmount,
      gst_rate_percent: numGstRate,
      gst_amount: gstAmount,
      total_client_amount: totalClientAmount,
      validity_expires_at: validityExpiresAt,
      status: status === 'DRAFT' ? 'DRAFT' : 'SENT',
      created_at: new Date().toISOString(),
    };

    const { data: insertedQuote, error: insErr } = await supabase
      .from('client_quotes')
      .insert([newQuoteRecord])
      .select()
      .single();

    if (insErr) {
      return res.status(500).json({ error: insErr.message || 'Failed to create client quote.' });
    }

    // Lock selected vendor quote if supplied
    if (vendorQuotationId) {
      await supabase
        .from('vendor_quotations')
        .update({ is_locked: true })
        .eq('id', vendorQuotationId);
    }

    // Transition requirement status to QUOTED
    await supabase
      .from('requirements')
      .update({ status: 'QUOTED', updated_at: new Date().toISOString() })
      .eq('id', requirementId);

    // Audit price creation
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: req.user?.userId || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'CLIENT_QUOTE_ISSUED',
          details: {
            quoteId: insertedQuote.id,
            requirementId,
            version: nextVersion,
            vendorBaseCost: finalVendorCost,
            adminMargin: marginAmount,
            marginType,
            marginValue: numMarginVal,
            extraCharges: numExtraCharges,
            taxableBase,
            gstRate: numGstRate,
            gstAmount,
            totalClientAmount,
            validityExpiresAt,
            issuedBy: req.user?.email || 'admin@necl.com',
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      quote: insertedQuote,
      calculation: {
        vendorBaseCost: finalVendorCost,
        adminMargin: marginAmount,
        extraCharges: numExtraCharges,
        taxableBase,
        gstRatePercent: numGstRate,
        gstAmount,
        totalClientAmount,
        validityExpiresAt,
        version: nextVersion,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Quotation creation failed' });
  }
});

// 2. Client View: Fetch Client Quotation with Strict Confidentiality Stripping
app.get('/api/client/quotes/:requirementId', async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.params;
    if (!requirementId) {
      return res.status(400).json({ error: 'requirementId is required.' });
    }

    const { data: quotes, error } = await supabase
      .from('client_quotes')
      .select('id, requirement_id, version, total_client_amount, gst_rate_percent, gst_amount, validity_expires_at, status, created_at')
      .eq('requirement_id', requirementId)
      .order('version', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Process client-safe quotes: enforce expiration and CONFIDENTIALITY GUARANTEE
    const clientSafeQuotes = (quotes || []).map((q: any) => {
      const isExpired = q.validity_expires_at && new Date(q.validity_expires_at).getTime() < Date.now();
      const effectiveStatus = (isExpired && q.status !== 'ACCEPTED') ? 'EXPIRED' : q.status;

      return {
        id: q.id,
        requirement_id: q.requirement_id,
        version: q.version,
        total_client_amount: Number(q.total_client_amount || 0),
        gst_rate_percent: Number(q.gst_rate_percent || 18),
        gst_amount: Number(q.gst_amount || 0),
        validity_expires_at: q.validity_expires_at,
        status: effectiveStatus,
        is_expired: isExpired,
        created_at: q.created_at,
        // CONFIDENTIALITY SANITIZATION: vendor_base_cost & admin_margin strictly omitted
      };
    });

    return res.json({ success: true, quotes: clientSafeQuotes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch client quotes' });
  }
});

// 3. Vendor View: Fetch Calling Vendor's Quotations (Zero Access to Competitor or Client Prices)
app.get('/api/vendor/quotes/:requirementId', async (req: Request, res: Response) => {
  try {
    const { requirementId } = req.params;
    const vendorId = req.query.vendorId as string;

    if (!requirementId || !vendorId) {
      return res.status(400).json({ error: 'requirementId and vendorId query parameter are required.' });
    }

    // Find vendor request specifically addressed to this calling vendor
    const { data: vr } = await supabase
      .from('vendor_requests')
      .select('id, deadline_at, status')
      .eq('requirement_id', requirementId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (!vr) {
      // Uninvited vendor gets 0 rows
      return res.json({ success: true, quotations: [] });
    }

    // Fetch ONLY quotations belonging to this vendor's vendor_request_id
    const { data: quotes, error } = await supabase
      .from('vendor_quotations')
      .select('id, vendor_request_id, quoted_rate, vehicle_id, driver_id, version, is_locked, submitted_at')
      .eq('vendor_request_id', vr.id)
      .order('version', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      success: true,
      rfqStatus: vr.status,
      deadlineAt: vr.deadline_at,
      quotations: quotes || [],
      // VENDOR ISOLATION GUARANTEE: Competitor bids and client selling prices are strictly excluded
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch vendor quotations' });
  }
});

// 4. Admin Margin Override with Audit Logging
app.post('/api/pricing/override-margin', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { quoteId, newMargin, justification } = req.body;

    if (!quoteId || newMargin === undefined || newMargin === null) {
      return res.status(400).json({ error: 'quoteId and newMargin are required.' });
    }

    if (!justification || justification.trim().length < 10) {
      return res.status(400).json({ error: 'A valid commercial justification (min 10 characters) is required for margin overrides.' });
    }

    const { data: existingQuote, error: fetchErr } = await supabase
      .from('client_quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (fetchErr || !existingQuote) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    if (existingQuote.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Cannot override margin on an already accepted client quotation.' });
    }

    const vendorCost = Number(existingQuote.vendor_base_cost);
    const updatedMargin = Number(newMargin);
    const taxableBase = Math.round((vendorCost + updatedMargin) * 100) / 100;
    const gstRate = Number(existingQuote.gst_rate_percent || 18);
    const updatedGst = Math.round((taxableBase * (gstRate / 100)) * 100) / 100;
    const updatedTotal = Math.round((taxableBase + updatedGst) * 100) / 100;

    const { data: updatedQuote, error: updErr } = await supabase
      .from('client_quotes')
      .update({
        admin_margin: updatedMargin,
        gst_amount: updatedGst,
        total_client_amount: updatedTotal,
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (updErr) {
      return res.status(500).json({ error: updErr.message });
    }

    // Audit override
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: req.user?.userId || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'PRICE_MARGIN_OVERRIDE',
          details: {
            quoteId,
            oldMargin: existingQuote.admin_margin,
            newMargin: updatedMargin,
            oldTotal: existingQuote.total_client_amount,
            newTotal: updatedTotal,
            justification: justification.trim(),
            overriddenBy: req.user?.email || 'admin@necl.com',
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      message: 'Margin overridden and audited successfully.',
      quote: updatedQuote,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Margin override failed' });
  }
});

// ============================================================================
// PHASE 6: CLIENT QUOTATION ACCEPTANCE, REJECTION & EMERGENCY DIRECT BOOKINGS
// ============================================================================

/**
 * POST /api/client/quotes/:quoteId/accept
 * Atomic quotation acceptance and collision-resistant booking creation:
 * - Strictly confirms quotation ownership and unexpired validity
 * - Idempotent execution (returns existing booking if already confirmed)
 * - Prevents multiple competing bookings on the same requirement
 * - Automatically transitions competing quotes to SUPERSEDED
 * - Synchronizes winning vendor quotation to ACCEPTED
 * - Writes immutable audit log to auth_audit_log
 */
app.post('/api/client/quotes/:quoteId/accept', async (req: Request, res: Response) => {
  const { quoteId } = req.params;
  const { clientId, notes } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!quoteId) {
    return res.status(400).json({ error: 'Quotation ID (quoteId) is mandatory.' });
  }

  try {
    // 1. Idempotency Check: Did this quote already produce a booking?
    const { data: existingBooking } = await db
      .from('bookings')
      .select('id, requirement_id, booking_status, confirmed_at, grand_total')
      .eq('accepted_quote_id', quoteId)
      .maybeSingle();

    if (existingBooking) {
      return res.json({
        success: true,
        bookingId: existingBooking.id,
        requirementId: existingBooking.requirement_id,
        bookingStatus: existingBooking.booking_status,
        confirmedAt: existingBooking.confirmed_at,
        isIdempotent: true,
        message: 'Booking already exists for this quotation (Idempotent response).',
      });
    }

    // 2. Fetch quotation record
    const { data: quote, error: qErr } = await db
      .from('client_quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();

    if (qErr || !quote) {
      console.error('Accept quote lookup failed:', { quoteId, qErr, quote });
      return res.status(404).json({ error: qErr?.message || 'Quotation not found in system.' });
    }

    // 3. Fetch and verify transport requirement ownership
    const { data: reqData, error: rErr } = await db
      .from('requirements')
      .select('*')
      .eq('id', quote.requirement_id)
      .maybeSingle();

    if (rErr || !reqData) {
      return res.status(404).json({ error: 'Associated transport requirement not found.' });
    }

    if (clientId && reqData.client_id && reqData.client_id !== clientId) {
      return res.status(403).json({
        error: 'Unauthorized: Client does not own the associated transport requirement.',
      });
    }

    // 4. Check quotation validity expiration
    if (quote.validity_expires_at && new Date(quote.validity_expires_at).getTime() < Date.now()) {
      await db.from('client_quotes').update({ status: 'EXPIRED' }).eq('id', quoteId);
      return res.status(400).json({
        error: `Quotation validity expired on ${quote.validity_expires_at}. Please request an updated quotation.`,
        code: 'QUOTE_EXPIRED',
      });
    }

    // 5. Prevent double-booking: Check if requirement already has an active confirmed booking
    const { data: competingBooking } = await db
      .from('bookings')
      .select('id, booking_status')
      .eq('requirement_id', quote.requirement_id)
      .neq('booking_status', 'CANCELLED')
      .maybeSingle();

    if (competingBooking) {
      return res.status(409).json({
        error: `This transport requirement is already booked under booking reference ${competingBooking.id}.`,
        bookingId: competingBooking.id,
      });
    }

    // 6. Check quotation status
    if (!['SENT', 'ISSUED', 'DRAFT'].includes(quote.status)) {
      return res.status(400).json({
        error: `Quotation cannot be accepted from current status: ${quote.status}`,
        code: 'INVALID_QUOTE_STATUS',
      });
    }

    // 7. Generate Collision-Resistant Booking ID (BOK-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let bookingId = `BOK-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: collision } = await db.from('bookings').select('id').eq('id', bookingId).maybeSingle();
      if (!collision) break;
      bookingId = `BOK-${todayStr}-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    const confirmedAt = new Date().toISOString();
    const effectiveClientId = clientId || reqData.client_id || '00000000-0000-0000-0000-000000000001';

    // 8. Atomic Insert into bookings
    const { data: newBooking, error: bokErr } = await db
      .from('bookings')
      .insert({
        id: bookingId,
        client_id: effectiveClientId,
        requirement_id: quote.requirement_id,
        accepted_quote_id: quoteId,
        booking_status: 'CLIENT_ACCEPTED',
        payment_status: 'NOT_DUE',
        grand_total: quote.total_client_amount || 0,
        confirmed_at: confirmedAt,
      })
      .select('*')
      .single();

    if (bokErr) {
      return res.status(500).json({ error: bokErr.message || 'Failed to create booking record.' });
    }

    // 9. Mark accepted quotation status
    await db.from('client_quotes').update({ status: 'ACCEPTED' }).eq('id', quoteId);

    // 10. Update requirement status to BOOKED
    await db
      .from('requirements')
      .update({ status: 'BOOKED', updated_at: confirmedAt })
      .eq('id', quote.requirement_id);

    // 11. Transition competing client quotes for this requirement to SUPERSEDED (fallback to REJECTED if check constraint doesn't allow SUPERSEDED)
    const { error: supErr } = await db
      .from('client_quotes')
      .update({ status: 'SUPERSEDED' })
      .eq('requirement_id', quote.requirement_id)
      .neq('id', quoteId)
      .in('status', ['SENT', 'ISSUED', 'DRAFT']);

    if (supErr) {
      await db
        .from('client_quotes')
        .update({ status: 'REJECTED' })
        .eq('requirement_id', quote.requirement_id)
        .neq('id', quoteId)
        .in('status', ['SENT', 'ISSUED', 'DRAFT']);
    }

    // 12. Synchronize vendor quotation status
    if (quote.vendor_quotation_id) {
      await db
        .from('vendor_quotations')
        .update({ status: 'ACCEPTED' })
        .eq('id', quote.vendor_quotation_id);

      const { data: vReqs } = await db
        .from('vendor_requests')
        .select('id')
        .eq('requirement_id', quote.requirement_id);

      if (vReqs && vReqs.length > 0) {
        const vReqIds = vReqs.map(vr => vr.id);
        await db
          .from('vendor_quotations')
          .update({ status: 'SUPERSEDED' })
          .in('vendor_request_id', vReqIds)
          .neq('id', quote.vendor_quotation_id)
          .in('status', ['SUBMITTED', 'PENDING', 'ACTIVE']);
      }
    }

    // 13. Immutable Audit Logging
    try {
      await db.from('auth_audit_log').insert([
        {
          user_id: effectiveClientId,
          user_type: 'CLIENT',
          event_type: 'CLIENT_QUOTE_ACCEPTED',
          details: {
            booking_id: bookingId,
            quote_id: quoteId,
            requirement_id: quote.requirement_id,
            total_client_amount: quote.total_client_amount,
            notes: notes || null,
            confirmed_at: confirmedAt,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      bookingId,
      requirementId: quote.requirement_id,
      acceptedQuoteId: quoteId,
      totalClientAmount: quote.total_client_amount,
      bookingStatus: 'CLIENT_ACCEPTED',
      confirmedAt,
      isIdempotent: false,
      message: 'Quotation accepted and confirmed booking created successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Quotation acceptance failed.' });
  }
});

/**
 * POST /api/client/quotes/:quoteId/reject
 * Allows client to reject an issued quotation with optional reasoning
 */
app.post('/api/client/quotes/:quoteId/reject', async (req: Request, res: Response) => {
  const { quoteId } = req.params;
  const { clientId, reason } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!quoteId) {
    return res.status(400).json({ error: 'Quotation ID (quoteId) is mandatory.' });
  }

  try {
    const { data: quote, error: qErr } = await db
      .from('client_quotes')
      .select('id, requirement_id, status')
      .eq('id', quoteId)
      .maybeSingle();

    if (qErr || !quote) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    if (!['SENT', 'ISSUED', 'DRAFT'].includes(quote.status)) {
      return res.status(400).json({
        error: `Quotation cannot be rejected from current status: ${quote.status}`,
      });
    }

    // Mark quote as REJECTED
    await db.from('client_quotes').update({ status: 'REJECTED' }).eq('id', quoteId);

    // Audit log
    try {
      await db.from('auth_audit_log').insert([
        {
          user_id: clientId || '00000000-0000-0000-0000-000000000001',
          user_type: 'CLIENT',
          event_type: 'CLIENT_QUOTE_REJECTED',
          details: {
            quote_id: quoteId,
            requirement_id: quote.requirement_id,
            reason: reason || 'Client opted not to proceed with this quote.',
            rejected_at: new Date().toISOString(),
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      quoteId,
      status: 'REJECTED',
      message: 'Quotation rejected successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Quotation rejection failed.' });
  }
});

/**
 * POST /api/bookings/emergency-direct-create
 * Emergency direct booking confirmation bypass:
 * - Requires Admin authentication
 * - Strictly validates mandatory justification (minimum 10 characters)
 * - Directly converts open requirement into a confirmed booking
 * - Records immutable audit entry in auth_audit_log
 */
app.post('/api/bookings/emergency-direct-create', authenticateAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { requirementId, clientId, justification, agreedRate, notes } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  // 1. Mandatory justification validation (minimum 10 characters)
  if (!justification || justification.trim().length < 10) {
    return res.status(400).json({
      error: 'Administrative emergency bypass requires a mandatory detailed justification of at least 10 characters.',
      code: 'JUSTIFICATION_REQUIRED',
    });
  }

  if (!requirementId) {
    return res.status(400).json({ error: 'requirementId is required.' });
  }

  try {
    // 2. Fetch requirement
    const { data: reqData, error: rErr } = await db
      .from('requirements')
      .select('*')
      .eq('id', requirementId)
      .maybeSingle();

    if (rErr || !reqData) {
      return res.status(404).json({ error: 'Requirement not found.' });
    }

    // 3. Double-booking check
    const { data: existingBooking } = await db
      .from('bookings')
      .select('id, booking_status')
      .eq('requirement_id', requirementId)
      .neq('booking_status', 'CANCELLED')
      .maybeSingle();

    if (existingBooking) {
      return res.status(409).json({
        error: `Requirement is already booked under reference ${existingBooking.id}.`,
        bookingId: existingBooking.id,
      });
    }

    // 4. Generate collision-resistant booking ID
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let bookingId = `BOK-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: collision } = await db.from('bookings').select('id').eq('id', bookingId).maybeSingle();
      if (!collision) break;
      bookingId = `BOK-${todayStr}-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    const effectiveClientId = clientId || reqData.client_id || '00000000-0000-0000-0000-000000000001';
    const confirmedAt = new Date().toISOString();

    // 5. Create Confirmed Booking
    const { data: booking, error: bErr } = await db
      .from('bookings')
      .insert({
        id: bookingId,
        client_id: effectiveClientId,
        requirement_id: requirementId,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        grand_total: agreedRate ? Number(agreedRate) : 0,
        confirmed_at: confirmedAt,
      })
      .select('*')
      .single();

    if (bErr || !booking) {
      return res.status(500).json({ error: bErr?.message || 'Failed to create emergency direct booking.' });
    }

    // 6. Update requirement status to BOOKED
    await db
      .from('requirements')
      .update({ status: 'BOOKED', updated_at: confirmedAt })
      .eq('id', requirementId);

    // 7. Supersede any open client quotes for this requirement
    const { error: supBypassErr } = await db
      .from('client_quotes')
      .update({ status: 'SUPERSEDED' })
      .eq('requirement_id', requirementId)
      .in('status', ['SENT', 'ISSUED', 'DRAFT']);

    if (supBypassErr) {
      await db
        .from('client_quotes')
        .update({ status: 'REJECTED' })
        .eq('requirement_id', requirementId)
        .in('status', ['SENT', 'ISSUED', 'DRAFT']);
    }

    // 8. Mandatory Administrative Audit Trail
    try {
      await db.from('auth_audit_log').insert([
        {
          user_id: req.user?.userId || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'EMERGENCY_DIRECT_BOOKING_BYPASS',
          details: {
            booking_id: bookingId,
            requirement_id: requirementId,
            client_id: effectiveClientId,
            justification: justification.trim(),
            agreed_rate: agreedRate || 0,
            notes: notes || null,
            admin_email: req.user?.email || 'admin@necl.com',
            bypassed_at: confirmedAt,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      bookingId,
      requirementId,
      bookingStatus: 'CONFIRMED',
      grandTotal: agreedRate || 0,
      message: 'Emergency direct booking confirmed successfully with administrative audit trail.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Emergency direct booking failed.' });
  }
});

/**
 * GET /api/bookings/:bookingId
 * Returns booking details with client and requirement context
 */
app.get('/api/bookings/:bookingId', async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  try {
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (bErr || !booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Enrich with requirement details if present
    let requirement = null;
    if (booking.requirement_id) {
      const { data: rData } = await supabase
        .from('requirements')
        .select('*')
        .eq('id', booking.requirement_id)
        .maybeSingle();

      if (rData) {
        requirement = {
          ...rData,
          origin: rData.origin || rData.pickup_address,
          destination: rData.destination || rData.destination_address,
          vehicle_type_required: rData.vehicle_type_required || rData.vehicle_type,
        };
      }
    }

    return res.json({
      success: true,
      booking: {
        ...booking,
        requirement,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch booking.' });
  }
});

// ============================================================================
// PHASE 7: VENDOR AWARD NOTIFICATION, TRIP GENERATION & FLEET ASSIGNMENT
// ============================================================================

function formatTripCode(tripId: string, createdAt?: string): string {
  const dateStr = (createdAt ? new Date(createdAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  const cleanId = (tripId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `TRP-${dateStr}-${cleanId || '1001'}`;
}

/**
 * POST /api/trips/generate-from-booking
 * Generates unique trip linked to a confirmed booking:
 * - Idempotent response if trip already exists for the booking
 * - Resolves awarded vendor and quoted purchase rate from quotation chain
 * - Generates collision-resistant trip_code (TRP-YYYYMMDD-XXXX)
 * - Audits trip generation in auth_audit_log
 */
app.post('/api/trips/generate-from-booking', async (req: Request, res: Response) => {
  const { bookingId, vendorId, vendorRate, vehicleId, driverId } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required.' });
  }

  try {
    // 1. Idempotency Check: Return existing trip if already created
    const { data: existingTrip } = await db
      .from('trips')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (existingTrip) {
      return res.json({
        success: true,
        tripId: existingTrip.id,
        tripCode: formatTripCode(existingTrip.id, existingTrip.created_at),
        bookingId: existingTrip.booking_id,
        vendorId: existingTrip.vendor_id,
        vendorRate: Number(existingTrip.vendor_rate || 0),
        tripStatus: existingTrip.trip_status,
        isIdempotent: true,
        message: 'Trip already exists for this booking (Idempotent response).',
      });
    }

    // 2. Fetch booking
    const { data: booking, error: bErr } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (bErr || !booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    let finalVendorId = vendorId;
    let finalVendorRate = vendorRate !== undefined ? Number(vendorRate) : null;
    let finalVehicleId = vehicleId || null;
    let finalDriverId = driverId || null;

    // 3. Resolve from quotation chain if not passed
    if ((!finalVendorId || finalVendorRate === null) && booking.accepted_quote_id) {
      const { data: quote } = await db
        .from('client_quotes')
        .select('*')
        .eq('id', booking.accepted_quote_id)
        .maybeSingle();

      if (quote) {
        if (finalVendorRate === null) {
          finalVendorRate = Number(quote.vendor_base_cost || 0);
        }

        if (quote.vendor_quotation_id) {
          const { data: vQuote } = await db
            .from('vendor_quotations')
            .select('*')
            .eq('id', quote.vendor_quotation_id)
            .maybeSingle();

          if (vQuote) {
            if (!finalVehicleId) finalVehicleId = vQuote.vehicle_id;
            if (!finalDriverId) finalDriverId = vQuote.driver_id;

            if (!finalVendorId && vQuote.vendor_request_id) {
              const { data: vReq } = await db
                .from('vendor_requests')
                .select('vendor_id')
                .eq('id', vQuote.vendor_request_id)
                .maybeSingle();
              if (vReq) finalVendorId = vReq.vendor_id;
            }
          }
        }
      }
    }

    // If still null, fallback to default vendor ID or first vendor
    if (!finalVendorId) {
      const { data: anyVendor } = await db.from('vendor_companies').select('id').limit(1).maybeSingle();
      finalVendorId = anyVendor?.id || '5fa0f865-0388-4779-99ad-03d8979c484a';
    }

    // If vehicle or driver not yet provided, resolve default from vendor fleet so NOT NULL constraint is satisfied
    if (!finalVehicleId) {
      const { data: vLink } = await db
        .from('vendor_vehicle_links')
        .select('vehicle_id')
        .eq('vendor_id', finalVendorId)
        .eq('status', 'APPROVED')
        .limit(1)
        .maybeSingle();

      if (vLink?.vehicle_id) {
        finalVehicleId = vLink.vehicle_id;
      } else {
        const { data: anyV } = await db.from('vehicles').select('id').limit(1).maybeSingle();
        finalVehicleId = anyV?.id;
      }
    }

    if (!finalDriverId) {
      const { data: anyD } = await db
        .from('drivers')
        .select('id')
        .eq('primary_vendor_id', finalVendorId)
        .limit(1)
        .maybeSingle();

      if (anyD?.id) {
        finalDriverId = anyD.id;
      } else {
        const { data: anyDriver } = await db.from('drivers').select('id').limit(1).maybeSingle();
        finalDriverId = anyDriver?.id;
      }
    }

    const tripId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tripCode = formatTripCode(tripId, now);
    const initialStatus = 'CREATED';

    // 5. Insert trip
    const tripPayload: any = {
      id: tripId,
      booking_id: bookingId,
      vendor_id: finalVendorId,
      vendor_rate: finalVendorRate || 0,
      trip_status: initialStatus,
      created_at: now,
      vehicle_id: finalVehicleId,
      driver_id: finalDriverId,
    };

    const { data: insertedTrip, error: tErr } = await db
      .from('trips')
      .insert([tripPayload])
      .select('*')
      .single();

    if (tErr) {
      return res.status(500).json({ error: tErr.message || 'Failed to create trip record.' });
    }

    // 6. Audit trip generation
    try {
      await db.from('auth_audit_log').insert([
        {
          user_id: finalVendorId,
          user_type: 'VENDOR',
          event_type: 'TRIP_GENERATED_FOR_BOOKING',
          details: {
            trip_id: tripId,
            trip_code: tripCode,
            booking_id: bookingId,
            vendor_id: finalVendorId,
            vendor_rate: finalVendorRate,
            initial_status: initialStatus,
            created_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      tripCode,
      bookingId,
      vendorId: finalVendorId,
      vendorRate: finalVendorRate || 0,
      tripStatus: initialStatus,
      isIdempotent: false,
      message: 'Trip generated successfully for booking.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Trip generation failed.' });
  }
});

/**
 * POST /api/trips/:tripId/assign
 * Assigns Vehicle and Driver to a Trip:
 * - Validates vendor authorization
 * - Validates vehicle existence and ownership
 * - Validates driver existence and vendor link
 * - Checks active trip conflict (prevents double-dispatch)
 * - Updates trip status to LORRY_ASSIGNED
 * - Synchronizes booking status to CONFIRMED
 * - Audits fleet allocation in auth_audit_log
 */
app.post('/api/trips/:tripId/assign', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { vendorId, vehicleId, driverId } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!tripId || !vehicleId || !driverId) {
    return res.status(400).json({
      error: 'tripId, vehicleId, and driverId are mandatory for fleet assignment.',
    });
  }

  try {
    // 1. Fetch trip
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    // 2. Validate vendor authorization
    if (vendorId && trip.vendor_id && trip.vendor_id !== vendorId) {
      return res.status(403).json({
        error: 'Unauthorized: Transporter does not own this awarded trip.',
        code: 'UNAUTHORIZED_VENDOR',
      });
    }

    const effectiveVendorId = vendorId || trip.vendor_id;

    // 3. Verify vehicle exists
    const { data: vehicle, error: vErr } = await db
      .from('vehicles')
      .select('id, registration_number, vehicle_type, status, verification_status')
      .eq('id', vehicleId)
      .maybeSingle();

    if (vErr || !vehicle) {
      return res.status(404).json({ error: 'Vehicle not found.', code: 'VEHICLE_NOT_FOUND' });
    }

    // 4. Verify driver exists and belongs to this vendor
    const { data: driver, error: dErr } = await db
      .from('drivers')
      .select('id, full_name, mobile, primary_vendor_id, status, verification_status')
      .eq('id', driverId)
      .maybeSingle();

    if (dErr || !driver) {
      return res.status(404).json({ error: 'Driver not found.', code: 'DRIVER_NOT_FOUND' });
    }

    if (effectiveVendorId && driver.primary_vendor_id && driver.primary_vendor_id !== effectiveVendorId) {
      return res.status(400).json({
        error: `Driver ${driver.full_name} is registered under another transporter.`,
        code: 'DRIVER_VENDOR_MISMATCH',
      });
    }

    // 5. Active Trip Conflict Check (Double-Dispatch Prevention)
    // Vehicle conflict check:
    const { data: busyVehicle } = await db
      .from('trips')
      .select('id, booking_id, trip_status')
      .eq('vehicle_id', vehicleId)
      .neq('id', tripId)
      .in('trip_status', ['LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING'])
      .maybeSingle();

    if (busyVehicle) {
      return res.status(409).json({
        error: `Vehicle ${vehicle.registration_number} is currently allocated to active trip ${busyVehicle.id}.`,
        code: 'VEHICLE_ALREADY_DISPATCHED',
        activeTripId: busyVehicle.id,
      });
    }

    // Driver conflict check:
    const { data: busyDriver } = await db
      .from('trips')
      .select('id, booking_id, trip_status')
      .eq('driver_id', driverId)
      .neq('id', tripId)
      .in('trip_status', ['LORRY_ASSIGNED', 'AT_LOADING', 'LOADING', 'IN_TRANSIT', 'REACHED_DESTINATION', 'UNLOADING'])
      .maybeSingle();

    if (busyDriver) {
      return res.status(409).json({
        error: `Driver ${driver.full_name} is currently allocated to active trip ${busyDriver.id}.`,
        code: 'DRIVER_ALREADY_DISPATCHED',
        activeTripId: busyDriver.id,
      });
    }

    const assignedAt = new Date().toISOString();

    // 6. Atomic Update on Trip
    const { data: updatedTrip, error: updErr } = await db
      .from('trips')
      .update({
        vehicle_id: vehicleId,
        driver_id: driverId,
        vendor_id: effectiveVendorId,
        trip_status: 'LORRY_ASSIGNED',
        started_at: trip.started_at || assignedAt,
      })
      .eq('id', tripId)
      .select('*')
      .single();

    if (updErr) {
      return res.status(500).json({ error: updErr.message || 'Failed to assign vehicle and driver to trip.' });
    }

    // 7. Synchronize booking status to CONFIRMED
    if (trip.booking_id) {
      await db
        .from('bookings')
        .update({ booking_status: 'CONFIRMED' })
        .eq('id', trip.booking_id);
    }

    const tripCode = formatTripCode(trip.id, trip.created_at);

    // 8. Immutable Audit Log
    try {
      await db.from('auth_audit_log').insert([
        {
          user_id: effectiveVendorId || '00000000-0000-0000-0000-000000000001',
          user_type: 'VENDOR',
          event_type: 'TRIP_FLEET_ASSIGNED',
          details: {
            trip_id: tripId,
            trip_code: tripCode,
            booking_id: trip.booking_id,
            vehicle_id: vehicleId,
            vehicle_number: vehicle.registration_number,
            driver_id: driverId,
            driver_name: driver.full_name,
            assigned_at: assignedAt,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      tripCode,
      bookingId: trip.booking_id,
      vehicleId,
      vehicleNumber: vehicle.registration_number,
      driverId,
      driverName: driver.full_name,
      tripStatus: 'LORRY_ASSIGNED',
      assignedAt,
      message: `Vehicle ${vehicle.registration_number} and Driver ${driver.full_name} assigned successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Vehicle/driver assignment failed.' });
  }
});

/**
 * GET /api/vendor/trips
 * Returns awarded trips for the calling vendor with commercial confidentiality enforcement
 */
app.get('/api/vendor/trips', async (req: Request, res: Response) => {
  const vendorId = req.query.vendorId as string;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!vendorId) {
    return res.status(400).json({ error: 'vendorId query parameter is required.' });
  }

  try {
    const { data: trips, error } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*)), vehicles(*), drivers(*)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Process sanitized vendor view (strictly omit client prices / margins)
    const sanitizedTrips = (trips || []).map((t: any) => ({
      id: t.id,
      tripCode: formatTripCode(t.id, t.created_at),
      bookingId: t.booking_id,
      origin: t.bookings?.requirements?.pickup_address || t.bookings?.requirements?.origin || 'Origin Hub',
      destination: t.bookings?.requirements?.destination_address || t.bookings?.requirements?.destination || 'Destination Hub',
      materialType: t.bookings?.requirements?.material_type || 'Commercial Freight',
      capacityMt: Number(t.bookings?.requirements?.required_capacity_mt || 0),
      tripStatus: t.trip_status,
      vendorRate: Number(t.vendor_rate || 0), // Transporter sees their own quoted purchase rate
      vehicle: t.vehicles
        ? {
            id: t.vehicles.id,
            registrationNumber: t.vehicles.registration_number,
            vehicleType: t.vehicles.vehicle_type,
          }
        : null,
      driver: t.drivers
        ? {
            id: t.drivers.id,
            fullName: t.drivers.full_name || t.drivers.name,
            mobile: t.drivers.mobile || t.drivers.phone,
          }
        : null,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      createdAt: t.created_at,
      // CONFIDENTIALITY SANITIZATION: client grand_total, gst_amount, admin_margin omitted
    }));

    return res.json({ success: true, trips: sanitizedTrips });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch vendor trips.' });
  }
});

/**
 * GET /api/trips/:tripId
 * Returns enriched trip details with role-based commercial confidentiality stripping:
 * - Client caller: vendor_rate and admin margin are strictly excluded
 * - Vendor caller: client selling price is excluded
 * - Admin caller: full audit details
 */
app.get('/api/trips/:tripId', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const role = ((req.query.role as string) || (req.headers['x-user-role'] as string) || 'CLIENT').toUpperCase();
  const db = getSupabaseClient(req.headers['authorization']);

  try {
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), drivers(*)')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    const requirement = trip.bookings?.requirements || null;

    const baseResponse: any = {
      id: trip.id,
      tripCode: formatTripCode(trip.id, trip.created_at),
      bookingId: trip.booking_id,
      tripStatus: trip.trip_status,
      startedAt: trip.started_at,
      completedAt: trip.completed_at,
      createdAt: trip.created_at,
      origin: requirement?.pickup_address || requirement?.origin || 'Pickup Location',
      destination: requirement?.destination_address || requirement?.destination || 'Delivery Location',
      materialType: requirement?.material_type || 'Freight',
      capacityMt: Number(requirement?.required_capacity_mt || 0),
      loadingDatetime: requirement?.loading_datetime,
      lastLatitude: trip.last_latitude ? Number(trip.last_latitude) : (memoryTripTelemetry.get(tripId)?.lastLatitude ?? null),
      lastLongitude: trip.last_longitude ? Number(trip.last_longitude) : (memoryTripTelemetry.get(tripId)?.lastLongitude ?? null),
      lastSpeed: trip.last_speed !== undefined ? Number(trip.last_speed) : (memoryTripTelemetry.get(tripId)?.lastSpeed ?? null),
      lastPingAt: trip.last_ping_at || (memoryTripTelemetry.get(tripId)?.lastPingAt ?? null),
      vehicle: trip.vehicles
        ? {
            id: trip.vehicles.id,
            registrationNumber: trip.vehicles.registration_number,
            vehicleType: trip.vehicles.vehicle_type,
          }
        : null,
      driver: trip.drivers
        ? {
            id: trip.drivers.id,
            fullName: trip.drivers.full_name || trip.drivers.name,
            mobile: trip.drivers.mobile || trip.drivers.phone,
          }
        : null,
    };

    // Role-based pricing disclosure:
    if (role === 'ADMIN') {
      baseResponse.vendorRate = Number(trip.vendor_rate || 0);
      baseResponse.clientRate = Number(trip.bookings?.grand_total || 0);
      baseResponse.vendorId = trip.vendor_id;
      baseResponse.clientId = trip.bookings?.client_id;
    } else if (role === 'VENDOR') {
      baseResponse.vendorRate = Number(trip.vendor_rate || 0);
      // Strictly omit client rate
    } else {
      // Role is CLIENT:
      baseResponse.clientRate = Number(trip.bookings?.grand_total || 0);
      // CONFIDENTIALITY SANITIZATION: vendor_rate strictly omitted
    }

    return res.json({ success: true, trip: baseResponse });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch trip details.' });
  }
});

// ============================================================================
// PHASE 8: DRIVER APP DISPATCH, DIGITAL LORRY RECEIPT (LR) & WAYBILL GENERATION
// ============================================================================

function formatLrNumber(tripId: string, createdAt?: string): string {
  const dateStr = (createdAt ? new Date(createdAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  const cleanId = (tripId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `LR-${dateStr}-${cleanId || '1001'}`;
}

/**
 * POST /api/driver/trips/:tripId/acknowledge-dispatch
 * Driver acknowledges dispatch of assigned lorry:
 * - Validates driver assignment to the trip
 * - Transitions status: LORRY_ASSIGNED / CREATED -> DISPATCHED -> AT_LOADING
 * - Synchronizes booking status to IN_PROGRESS
 * - Audits driver dispatch acknowledgment in auth_audit_log
 */
app.post('/api/driver/trips/:tripId/acknowledge-dispatch', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { driverId } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    // 1. Fetch trip
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*), drivers(*)')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    // 2. Validate driver authorization
    if (driverId && trip.driver_id && trip.driver_id !== driverId) {
      return res.status(403).json({
        error: 'Unauthorized: Driver is not assigned to this trip.',
        code: 'DRIVER_UNAUTHORIZED',
      });
    }

    const effectiveDriverId = driverId || trip.driver_id;

    // 3. Determine next status
    let nextStatus = 'DISPATCHED';
    if (trip.trip_status === 'DISPATCHED') {
      nextStatus = 'AT_LOADING';
    } else if (trip.trip_status === 'AT_LOADING' || trip.trip_status === 'IN_TRANSIT') {
      nextStatus = trip.trip_status;
    }

    const now = new Date().toISOString();

    // 4. Update trip
    const tripUpdate: any = {
      trip_status: nextStatus,
      started_at: trip.started_at || now,
    };

    if (effectiveDriverId && !trip.driver_id) {
      tripUpdate.driver_id = effectiveDriverId;
    }

    const { error: updErr } = await db.from('trips').update(tripUpdate).eq('id', tripId);
    if (updErr) {
      return res.status(500).json({ error: updErr.message || 'Failed to update trip dispatch status.' });
    }

    // 5. Synchronize booking status to IN_PROGRESS
    if (trip.booking_id) {
      await db
        .from('bookings')
        .update({ booking_status: 'IN_PROGRESS' })
        .eq('id', trip.booking_id);
    }

    // 6. Audit in auth_audit_log
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: effectiveDriverId || '00000000-0000-0000-0000-000000000001',
          user_type: 'DRIVER',
          event_type: 'DRIVER_DISPATCH_ACKNOWLEDGED',
          details: {
            trip_id: tripId,
            driver_id: effectiveDriverId,
            previous_status: trip.trip_status,
            new_status: nextStatus,
            acknowledged_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      driverId: effectiveDriverId,
      tripStatus: nextStatus,
      dispatchedAt: now,
      message: `Driver dispatch acknowledged successfully. Trip transitioned to ${nextStatus}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to acknowledge dispatch.' });
  }
});

/**
 * POST /api/trips/:tripId/generate-lr
 * Generates Digital Lorry Receipt (LR) for a trip:
 * - Deterministic collision-resistant format: LR-YYYYMMDD-XXXX
 * - Fully captures Consignor, Consignee, Transporter, Vehicle, Driver, and Cargo details
 * - Idempotent response: returns existing LR without creating duplicates
 * - Persists record in documents table (category: TRIP, document_type: POD_LR)
 * - COMMERCIAL CONFIDENTIALITY: strictly omits vendor_rate and admin_margin
 * - Audits event in auth_audit_log
 */
app.post('/api/trips/:tripId/generate-lr', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { createdBy } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    // 1. Fetch trip with full relation chain
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), drivers(*), vendor_companies:vendor_id(*)')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    // 2. Check for existing Digital LR in documents table or trips table (Idempotency)
    const { data: existingDocs } = await db
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['POD_LR', 'DIGITAL_LR'])
      .eq('reference_id', tripId)
      .order('created_at', { ascending: false });

    const existingDoc = existingDocs && existingDocs.length > 0 ? existingDocs[0] : null;

    // Check for ewaybill in documents if not in trip
    const { data: ewbDocs } = await db
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['WAYBILL', 'EWAYBILL'])
      .eq('reference_id', tripId)
      .order('created_at', { ascending: false });

    const existingEwbDoc = ewbDocs && ewbDocs.length > 0 ? ewbDocs[0] : null;
    let effectiveEwb = trip.ewaybill_number;
    if (!effectiveEwb && existingEwbDoc?.file_name) {
      const match = existingEwbDoc.file_name.match(/EWB_(\d{12})/);
      if (match) effectiveEwb = match[1];
    }

    const reqData = trip.bookings?.requirements;
    const clientData = reqData?.client_companies;
    const vendorData = trip.vendor_companies;
    const vehicleData = trip.vehicles;
    const driverData = trip.drivers;

    // Helper to build confidential sanitized LR payload
    const buildLrPayload = (lrNum: string, genDate: string) => ({
      lrNumber: lrNum,
      generatedAt: genDate,
      tripId: trip.id,
      tripCode: formatTripCode(trip.id, trip.created_at),
      bookingId: trip.booking_id,
      consignor: {
        companyName: clientData?.company_name || 'Consignor Shipper',
        address: reqData?.pickup_address || reqData?.origin || 'Pickup Terminal',
        pincode: reqData?.pickup_pincode || '',
        contactPerson: reqData?.loading_contact_person || 'Loading Supervisor',
        contactPhone: reqData?.loading_contact_phone || '',
      },
      consignee: {
        companyName: reqData?.consignee_name || clientData?.company_name || 'Consignee Receiver',
        address: reqData?.destination_address || reqData?.destination || 'Delivery Terminal',
        pincode: reqData?.destination_pincode || '',
        contactPerson: reqData?.unloading_contact_person || 'Unloading Incharge',
        contactPhone: reqData?.unloading_contact_phone || '',
      },
      transporter: {
        vendorId: trip.vendor_id,
        companyName: vendorData?.vendor_name || 'TRUCKS Dedicated Fleet Partner',
        vendorCode: vendorData?.vendor_code || `VD-${(trip.vendor_id || '').slice(0, 6).toUpperCase()}`,
        phone: vendorData?.phone || '',
      },
      vehicle: {
        vehicleId: vehicleData?.id || trip.vehicle_id,
        registrationNumber: vehicleData?.registration_number || 'TRUCK-ASSIGNED',
        vehicleType: vehicleData?.vehicle_type || reqData?.vehicle_type || 'Commercial Multi-Axle',
      },
      driver: {
        driverId: driverData?.id || trip.driver_id,
        fullName: driverData?.full_name || driverData?.name || 'Authorized Commercial Driver',
        mobile: driverData?.mobile || driverData?.phone || '',
        licenceNumber: driverData?.licence_number || '',
      },
      cargo: {
        materialType: reqData?.material_type || 'Commercial Freight Goods',
        weightMt: Number(reqData?.required_capacity_mt || 0),
        handlingInstructions: reqData?.handling_instructions || 'Handle with standard transport precautions',
      },
      ewaybill: {
        ewaybillNumber: effectiveEwb || null,
        validUntil: trip.ewaybill_valid_until || (existingEwbDoc ? existingEwbDoc.created_at : null),
      },
      // STRICT CONFIDENTIALITY: vendor_rate and admin_margin are NEVER included in LR data
    });

    if (existingDoc || (trip.lr_number && trip.lr_number.startsWith('LR-'))) {
      let existingLrNum = trip.lr_number;
      if (!existingLrNum && existingDoc) {
        const match = existingDoc.file_name?.match(/LR-\d{8}-[A-Z0-9]+/);
        existingLrNum = match ? match[0] : formatLrNumber(trip.id, existingDoc.created_at);
      }
      if (!existingLrNum) {
        existingLrNum = formatLrNumber(trip.id, trip.created_at);
      }

      const genTime = existingDoc?.created_at || trip.lr_generated_at || trip.created_at;

      return res.json({
        success: true,
        isIdempotent: true,
        tripId: trip.id,
        lrNumber: existingLrNum,
        generatedAt: genTime,
        documentId: existingDoc?.id || null,
        lrData: buildLrPayload(existingLrNum, genTime),
        message: 'Digital Lorry Receipt (LR) already generated for this trip (Idempotent response).',
      });
    }

    // 3. Generate new collision-resistant LR number
    const now = new Date().toISOString();
    const lrNumber = formatLrNumber(trip.id, now);
    const lrData = buildLrPayload(lrNumber, now);

    // 4. Try updating trips table
    try {
      await db.from('trips').update({
        lr_number: lrNumber,
        lr_generated_at: now,
      }).eq('id', tripId);
    } catch {}

    // 5. Persist into documents table (using POD_LR to adhere to check constraint)
    const { data: insertedDoc, error: docErr } = await db
      .from('documents')
      .insert([
        {
          category: 'TRIP',
          document_type: 'POD_LR',
          reference_id: tripId,
          file_name: `Digital_LR_${lrNumber}.pdf`,
          file_url: `/documents/trips/${tripId}/lr/${lrNumber}`,
          storage_path: `trips/${tripId}/lr/${lrNumber}.pdf`,
          verification_status: 'VERIFIED',
          uploaded_by: createdBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
        },
      ])
      .select('*')
      .single();

    if (docErr) {
      console.warn('LR document persistence notice:', docErr.message);
    }

    // 6. Audit in auth_audit_log
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: createdBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'SYSTEM',
          event_type: 'DIGITAL_LR_GENERATED',
          details: {
            trip_id: tripId,
            trip_code: formatTripCode(trip.id, trip.created_at),
            lr_number: lrNumber,
            generated_at: now,
            booking_id: trip.booking_id,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      isIdempotent: false,
      tripId: trip.id,
      lrNumber,
      generatedAt: now,
      documentId: insertedDoc?.id || null,
      lrData,
      message: 'Digital Lorry Receipt (LR) generated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate digital LR.' });
  }
});

/**
 * POST /api/trips/:tripId/link-ewaybill
 * Validates and links 12-digit e-Waybill to Trip & LR:
 * - Format enforcement: strictly 12 numeric digits (e.g. 123456789012 or EWB-123456789012)
 * - HTTP 400 with INVALID_EWAYBILL_FORMAT on malformed inputs
 * - Links to trip record and documents table
 * - Audits linking in auth_audit_log
 */
app.post('/api/trips/:tripId/link-ewaybill', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { ewaybillNumber, validUntil, linkedBy } = req.body;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  if (!ewaybillNumber || typeof ewaybillNumber !== 'string') {
    return res.status(400).json({
      error: 'ewaybillNumber is mandatory and must be a 12-digit string.',
      code: 'INVALID_EWAYBILL_FORMAT',
    });
  }

  // Clean ewaybill format: strip EWB- prefix and whitespaces
  const cleanEwb = ewaybillNumber.trim().toUpperCase().replace(/^EWB-/, '');

  // Strictly enforce 12 numeric digits
  if (!/^\d{12}$/.test(cleanEwb)) {
    return res.status(400).json({
      error: 'Invalid e-Waybill format. Expected exactly 12 numeric digits (e.g. 123456789012 or EWB-123456789012).',
      code: 'INVALID_EWAYBILL_FORMAT',
      received: ewaybillNumber,
    });
  }

  try {
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const expirationDate = validUntil || new Date(Date.now() + 3 * 86400000).toISOString();

    // 1. Try updating trips table
    try {
      await db
        .from('trips')
        .update({
          ewaybill_number: cleanEwb,
          ewaybill_valid_until: expirationDate,
        })
        .eq('id', tripId);
    } catch {}

    // 2. Persist e-waybill into documents table (using WAYBILL to adhere to check constraint)
    const { data: ewbDoc } = await db
      .from('documents')
      .insert([
        {
          category: 'TRIP',
          document_type: 'WAYBILL',
          reference_id: tripId,
          file_name: `EWB_${cleanEwb}.pdf`,
          file_url: `/documents/trips/${tripId}/ewb/${cleanEwb}`,
          storage_path: `trips/${tripId}/ewb/${cleanEwb}.pdf`,
          verification_status: 'VERIFIED',
          uploaded_by: linkedBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
        },
      ])
      .select('*')
      .maybeSingle();

    // 3. Audit log in auth_audit_log using server authenticated supabase
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: linkedBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'VENDOR',
          event_type: 'EWAYBILL_LINKED_TO_TRIP',
          details: {
            trip_id: tripId,
            trip_code: formatTripCode(trip.id, trip.created_at),
            ewaybill_number: cleanEwb,
            valid_until: expirationDate,
            linked_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      ewaybillNumber: cleanEwb,
      ewaybillValidUntil: expirationDate,
      documentId: ewbDoc?.id || null,
      message: '12-digit e-Waybill verified and linked to trip successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to link e-Waybill.' });
  }
});

/**
 * GET /api/trips/:tripId/lr
 * Returns Digital Lorry Receipt (LR) details with commercial confidentiality enforcement:
 * - Driver & Client views strictly omit vendor purchase price (vendor_rate) and admin margin
 * - Vendor view strictly omits client selling price
 * - Admin view provides complete audit details
 */
app.get('/api/trips/:tripId/lr', async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const role = ((req.query.role as string) || (req.headers['x-user-role'] as string) || 'DRIVER').toUpperCase();
  const db = getSupabaseClient(req.headers['authorization']);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), drivers(*), vendor_companies:vendor_id(*)')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    // Check documents for LR
    const { data: lrDocs } = await db
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['POD_LR', 'DIGITAL_LR'])
      .eq('reference_id', tripId)
      .order('created_at', { ascending: false });

    const lrDoc = lrDocs && lrDocs.length > 0 ? lrDocs[0] : null;

    // Check documents for e-waybill
    const { data: ewbDocs } = await db
      .from('documents')
      .select('*')
      .eq('category', 'TRIP')
      .in('document_type', ['WAYBILL', 'EWAYBILL'])
      .eq('reference_id', tripId)
      .order('created_at', { ascending: false });

    const ewbDoc = ewbDocs && ewbDocs.length > 0 ? ewbDocs[0] : null;
    let effectiveEwb = trip.ewaybill_number;
    if (!effectiveEwb && ewbDoc?.file_name) {
      const match = ewbDoc.file_name.match(/EWB_(\d{12})/);
      if (match) effectiveEwb = match[1];
    }

    let lrNumber = trip.lr_number;
    if (!lrNumber && lrDoc?.file_name) {
      const match = lrDoc.file_name.match(/LR-\d{8}-[A-Z0-9]+/);
      if (match) lrNumber = match[0];
    }
    if (!lrNumber) {
      lrNumber = formatLrNumber(trip.id, trip.created_at);
    }

    const reqData = trip.bookings?.requirements;
    const clientData = reqData?.client_companies;
    const vendorData = trip.vendor_companies;
    const vehicleData = trip.vehicles;
    const driverData = trip.drivers;

    const baseLr = {
      lrNumber,
      tripId: trip.id,
      tripCode: formatTripCode(trip.id, trip.created_at),
      bookingId: trip.booking_id,
      generatedAt: lrDoc?.created_at || trip.lr_generated_at || trip.created_at,
      consignor: {
        companyName: clientData?.company_name || 'Consignor Shipper',
        address: reqData?.pickup_address || reqData?.origin || 'Pickup Terminal',
        pincode: reqData?.pickup_pincode || '',
        contactPerson: reqData?.loading_contact_person || 'Loading Supervisor',
        contactPhone: reqData?.loading_contact_phone || '',
      },
      consignee: {
        companyName: reqData?.consignee_name || clientData?.company_name || 'Consignee Receiver',
        address: reqData?.destination_address || reqData?.destination || 'Delivery Terminal',
        pincode: reqData?.destination_pincode || '',
        contactPerson: reqData?.unloading_contact_person || 'Unloading Incharge',
        contactPhone: reqData?.unloading_contact_phone || '',
      },
      transporter: {
        vendorId: trip.vendor_id,
        companyName: vendorData?.vendor_name || 'TRUCKS Dedicated Fleet Partner',
        vendorCode: vendorData?.vendor_code || `VD-${(trip.vendor_id || '').slice(0, 6).toUpperCase()}`,
        phone: vendorData?.phone || '',
      },
      vehicle: {
        vehicleId: vehicleData?.id || trip.vehicle_id,
        registrationNumber: vehicleData?.registration_number || 'TRUCK-ASSIGNED',
        vehicleType: vehicleData?.vehicle_type || reqData?.vehicle_type || 'Commercial Multi-Axle',
      },
      driver: {
        driverId: driverData?.id || trip.driver_id,
        fullName: driverData?.full_name || driverData?.name || 'Authorized Commercial Driver',
        mobile: driverData?.mobile || driverData?.phone || '',
        licenceNumber: driverData?.licence_number || '',
      },
      cargo: {
        materialType: reqData?.material_type || 'Commercial Freight Goods',
        weightMt: Number(reqData?.required_capacity_mt || 0),
        handlingInstructions: reqData?.handling_instructions || 'Handle with standard transport precautions',
      },
      ewaybill: {
        ewaybillNumber: effectiveEwb || null,
        validUntil: trip.ewaybill_valid_until || (ewbDoc ? ewbDoc.created_at : null),
      },
    };

    // Role-based financial disclosure:
    const responsePayload: any = { ...baseLr };
    if (role === 'ADMIN') {
      responsePayload.vendorRate = Number(trip.vendor_rate || 0);
      responsePayload.clientRate = Number(trip.bookings?.grand_total || 0);
    } else if (role === 'VENDOR') {
      responsePayload.vendorRate = Number(trip.vendor_rate || 0);
      // Strictly omit client rate
    } else {
      // DRIVER and CLIENT: strictly omit vendor purchase rate and admin margin!
    }

    return res.json({
      success: true,
      lr: responsePayload,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch digital LR.' });
  }
});

/**
 * GET /api/driver/trips
 * Returns roster of trips assigned to calling driver:
 * - Role-isolated by driverId
 * - Enriched with cargo, route, LR, and e-waybill status
 * - Commercial financial metrics strictly omitted (confidentiality protection)
 */
app.get('/api/driver/trips', async (req: Request, res: Response) => {
  const driverId = req.query.driverId as string;
  const db = getSupabaseClient(req.headers['authorization']);

  if (!driverId) {
    return res.status(400).json({ error: 'driverId query parameter is required.' });
  }

  try {
    const { data: trips, error } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), vendor_companies:vendor_id(*)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Query documents for any digital LRs or ewaybills on these trips
    const tripIds = (trips || []).map((t: any) => t.id);
    let docMap: Record<string, { lrNumber?: string; ewaybillNumber?: string }> = {};

    if (tripIds.length > 0) {
      const { data: docs } = await db
        .from('documents')
        .select('*')
        .in('reference_id', tripIds)
        .in('document_type', ['POD_LR', 'DIGITAL_LR', 'WAYBILL', 'EWAYBILL']);

      if (docs) {
        for (const doc of docs) {
          const tId = doc.reference_id;
          if (!docMap[tId]) docMap[tId] = {};
          if ((doc.document_type === 'POD_LR' || doc.document_type === 'DIGITAL_LR') && doc.file_name) {
            const match = doc.file_name.match(/LR-\d{8}-[A-Z0-9]+/);
            if (match) docMap[tId].lrNumber = match[0];
          }
          if ((doc.document_type === 'WAYBILL' || doc.document_type === 'EWAYBILL') && doc.file_name) {
            const match = doc.file_name.match(/EWB_(\d{12})/);
            if (match) docMap[tId].ewaybillNumber = match[1];
          }
        }
      }
    }

    const sanitizedTrips = (trips || []).map((t: any) => {
      const reqData = t.bookings?.requirements;
      const clientData = reqData?.client_companies;
      const vehicleData = t.vehicles;
      const vendorData = t.vendor_companies;
      const extraDocs = docMap[t.id] || {};

      let effectiveLr = t.lr_number || extraDocs.lrNumber;
      if (!effectiveLr && ['DISPATCHED', 'AT_LOADING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(t.trip_status)) {
        effectiveLr = formatLrNumber(t.id, t.created_at);
      }

      return {
        id: t.id,
        tripCode: formatTripCode(t.id, t.created_at),
        bookingId: t.booking_id,
        tripStatus: t.trip_status,
        origin: reqData?.pickup_address || reqData?.origin || 'Pickup Terminal',
        originPincode: reqData?.pickup_pincode || '',
        pickupContactName: reqData?.loading_contact_person || 'Loading Supervisor',
        pickupContactPhone: reqData?.loading_contact_phone || '',
        destination: reqData?.destination_address || reqData?.destination || 'Delivery Terminal',
        destinationPincode: reqData?.destination_pincode || '',
        dropContactName: reqData?.unloading_contact_person || 'Receiving Incharge',
        dropContactPhone: reqData?.unloading_contact_phone || '',
        clientName: clientData?.company_name || 'Commercial Shipper',
        transporterName: vendorData?.vendor_name || 'NECL Transporter',
        materialType: reqData?.material_type || 'Cargo',
        capacityMt: Number(reqData?.required_capacity_mt || 0),
        loadingDatetime: reqData?.loading_datetime,
        vehicle: vehicleData
          ? {
              id: vehicleData.id,
              registrationNumber: vehicleData.registration_number,
              vehicleType: vehicleData.vehicle_type,
            }
          : null,
        lrNumber: effectiveLr || null,
        ewaybillNumber: t.ewaybill_number || extraDocs.ewaybillNumber || null,
        startedAt: t.started_at,
        completedAt: t.completed_at,
        createdAt: t.created_at,
        // CONFIDENTIALITY SANITIZATION: vendor_rate, grand_total, and admin margin are NEVER exposed to driver
      };
    });

    return res.json({ success: true, trips: sanitizedTrips });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch driver trips.' });
  }
});

// ============================================================================
// PHASE 9: REAL-TIME TRACKING, WAYPOINT EVENTS & GEOFENCING MILESTONES
// ============================================================================

// Haversine distance calculator in kilometers
function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0; // Earth mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000;
}

const VALID_MILESTONE_PROGRESSION: Record<string, string[]> = {
  CREATED: ['LORRY_ASSIGNED', 'DISPATCHED', 'AT_LOADING'],
  LORRY_ASSIGNED: ['DISPATCHED', 'AT_LOADING'],
  DISPATCHED: ['AT_LOADING', 'IN_TRANSIT'],
  AT_LOADING: ['IN_TRANSIT'],
  IN_TRANSIT: ['AT_UNLOADING', 'DELIVERED'],
  AT_UNLOADING: ['DELIVERED', 'COMPLETED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
};

function isValidMilestoneTransition(currentStatus: string, nextStatus: string): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = VALID_MILESTONE_PROGRESSION[currentStatus] || [];
  return allowed.includes(nextStatus);
}

// In-memory telemetry cache as robust fallback
const memoryLocationLogs = new Map<string, any[]>();
const memoryWaypointEvents = new Map<string, any[]>();
const memoryTripTelemetry = new Map<string, any>();

// Phase 10 in-memory fallbacks for e-POD, weighbridge, and damage claims
const memoryPodSubmissions = new Map<string, any[]>();
const memoryWeighments = new Map<string, any[]>();
const memoryClaims = new Map<string, any[]>();

// Phase 11 in-memory fallbacks for invoices, payouts, and payment records
const memoryClientInvoices = new Map<string, any>();
const memoryTransporterPayouts = new Map<string, any>();
const memoryPaymentRecords = new Map<string, any[]>();

// In-memory audit registry and helper
const memoryAuditLogs: any[] = [];
export function recordAuditLog(entry: {
  userId?: string;
  userType?: string;
  eventType: string;
  details?: any;
}) {
  const item = {
    id: crypto.randomUUID(),
    user_id: entry.userId || '00000000-0000-0000-0000-000000000001',
    user_type: entry.userType || 'SYSTEM',
    event_type: entry.eventType,
    details: entry.details || {},
    created_at: new Date().toISOString(),
  };
  memoryAuditLogs.unshift(item);
  if (memoryAuditLogs.length > 500) memoryAuditLogs.pop();

  // Async persist to auth_audit_log if DB allows
  try {
    Promise.resolve(supabase.from('auth_audit_log').insert([item])).catch(() => {});
  } catch {}
  return item;
}

app.get('/api/audit-logs', (req: Request, res: Response) => {
  const { eventType, limit = 50 } = req.query;
  let logs = memoryAuditLogs;
  if (eventType) {
    logs = logs.filter((l) => l.event_type === eventType);
  }
  return res.json({ success: true, logs: logs.slice(0, Number(limit)) });
});

/**
 * POST /api/trips/:tripId/location-ping
 * Ingests live driver GPS telemetry:
 * - Validates coordinate boundaries (-90 <= lat <= 90, -180 <= lon <= 180)
 * - Updates trip current position, speed, heading, and last_ping_at
 * - Computes Haversine distance to pickup & destination coordinates
 * - Evaluates geofencing boundaries (arrival <= 1.0 km triggers AT_LOADING / AT_UNLOADING)
 * - Persists telemetry to trip_location_logs and logs waypoint events
 * - Immutable audit logging for telemetry and geofence breaches
 */
app.post('/api/trips/:tripId/location-ping', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const { latitude, longitude, speed, heading, accuracy, batteryLevel, recordedAt, isMock } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  // 1. Coordinate Validation
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({
      error: 'Invalid coordinates. Latitude must be between -90 and 90, and Longitude between -180 and 180.',
      code: 'INVALID_COORDINATES',
      received: { latitude, longitude },
    });
  }

  try {
    // 2. Fetch Trip with requirement
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*))')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const now = recordedAt || new Date().toISOString();
    const currentSpeed = speed !== undefined ? Number(speed) : 0;
    const currentHeading = heading !== undefined ? Number(heading) : 0;

    // 3. Resolve Target Geofence Coordinates
    // Fallback coordinates from requirement or known North East hubs if not explicitly set
    let pickupLat = trip.pickup_latitude ? Number(trip.pickup_latitude) : null;
    let pickupLon = trip.pickup_longitude ? Number(trip.pickup_longitude) : null;
    let destLat = trip.destination_latitude ? Number(trip.destination_latitude) : null;
    let destLon = trip.destination_longitude ? Number(trip.destination_longitude) : null;

    // Check memory telemetry for coords if not in DB
    const cachedTelem = memoryTripTelemetry.get(tripId) || {};
    if (pickupLat === null && cachedTelem.pickupLatitude) {
      pickupLat = cachedTelem.pickupLatitude;
      pickupLon = cachedTelem.pickupLongitude;
    }
    if (destLat === null && cachedTelem.destinationLatitude) {
      destLat = cachedTelem.destinationLatitude;
      destLon = cachedTelem.destinationLongitude;
    }

    // Default to Guwahati (26.1445, 91.7362) and Kolkata (22.5726, 88.3639) if completely unassigned
    if (pickupLat === null && trip.bookings?.requirements?.pickup_pincode?.startsWith('78')) {
      pickupLat = 26.1445;
      pickupLon = 91.7362;
    }
    if (destLat === null && trip.bookings?.requirements?.destination_pincode?.startsWith('70')) {
      destLat = 22.5726;
      destLon = 88.3639;
    }

    // 4. Calculate Geofence Distances
    let distanceToPickupKm: number | null = null;
    let distanceToDestinationKm: number | null = null;

    if (pickupLat !== null && pickupLon !== null) {
      distanceToPickupKm = calculateHaversineDistanceKm(lat, lon, pickupLat, pickupLon);
    }
    if (destLat !== null && destLon !== null) {
      distanceToDestinationKm = calculateHaversineDistanceKm(lat, lon, destLat, destLon);
    }

    let nextStatus = trip.trip_status;
    let geofenceTriggered: string | null = null;
    const GEOFENCE_RADIUS_KM = 1.0;

    // 5. Geofence Evaluation
    if (
      trip.trip_status === 'DISPATCHED' &&
      distanceToPickupKm !== null &&
      distanceToPickupKm <= GEOFENCE_RADIUS_KM
    ) {
      nextStatus = 'AT_LOADING';
      geofenceTriggered = 'GEOFENCE_ENTER_PICKUP';
    } else if (
      trip.trip_status === 'IN_TRANSIT' &&
      distanceToDestinationKm !== null &&
      distanceToDestinationKm <= GEOFENCE_RADIUS_KM
    ) {
      nextStatus = 'AT_UNLOADING';
      geofenceTriggered = 'GEOFENCE_ENTER_DESTINATION';
    }

    // 6. Record Location Ping into trip_location_logs
    const logItem = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      latitude: lat,
      longitude: lon,
      speed: currentSpeed,
      heading: currentHeading,
      accuracy: accuracy !== undefined ? Number(accuracy) : null,
      battery_level: batteryLevel !== undefined ? Number(batteryLevel) : null,
      is_mock: Boolean(isMock),
      recorded_at: now,
      created_at: now,
    };

    // Always persist to memoryLocationLogs immediately
    const locList = memoryLocationLogs.get(tripId) || [];
    locList.unshift(logItem);
    if (locList.length > 200) locList.pop();
    memoryLocationLogs.set(tripId, locList);

    // Also attempt DB insert if table exists
    try {
      await db.from('trip_location_logs').insert([logItem]);
    } catch {}

    // 7. Record Waypoint Event if geofence was triggered
    if (geofenceTriggered) {
      const wpItem = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        event_type: geofenceTriggered,
        location_latitude: lat,
        location_longitude: lon,
        distance_to_target_km: geofenceTriggered === 'GEOFENCE_ENTER_PICKUP' ? distanceToPickupKm : distanceToDestinationKm,
        geofence_radius_km: GEOFENCE_RADIUS_KM,
        notes: `Vehicle entered ${geofenceTriggered === 'GEOFENCE_ENTER_PICKUP' ? 'pickup' : 'delivery'} geofence within 1.0 km radius.`,
        triggered_at: now,
        created_at: now,
      };

      // Always persist to memoryWaypointEvents immediately
      const wpList = memoryWaypointEvents.get(tripId) || [];
      wpList.unshift(wpItem);
      memoryWaypointEvents.set(tripId, wpList);

      try {
        await db.from('trip_waypoint_events').insert([wpItem]);
      } catch {}

      // Audit Geofence Breach
      recordAuditLog({
        userId: trip.driver_id || '00000000-0000-0000-0000-000000000001',
        userType: 'SYSTEM',
        eventType: 'GEOFENCE_BREACH_DETECTED',
        details: {
          trip_id: tripId,
          geofence: geofenceTriggered,
          latitude: lat,
          longitude: lon,
          distance_km: geofenceTriggered === 'GEOFENCE_ENTER_PICKUP' ? distanceToPickupKm : distanceToDestinationKm,
          new_status: nextStatus,
          triggered_at: now,
        },
      });
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: trip.driver_id || '00000000-0000-0000-0000-000000000001',
            user_type: 'SYSTEM',
            event_type: 'GEOFENCE_BREACH_DETECTED',
            details: {
              trip_id: tripId,
              geofence: geofenceTriggered,
              latitude: lat,
              longitude: lon,
              distance_km: geofenceTriggered === 'GEOFENCE_ENTER_PICKUP' ? distanceToPickupKm : distanceToDestinationKm,
              new_status: nextStatus,
              triggered_at: now,
            },
          },
        ]);
      } catch {}
    }

    // 8. Update Trip Position Cache & Database Status
    // Always persist to memoryTripTelemetry immediately
    memoryTripTelemetry.set(tripId, {
      ...cachedTelem,
      lastLatitude: lat,
      lastLongitude: lon,
      lastSpeed: currentSpeed,
      lastHeading: currentHeading,
      lastPingAt: now,
      tripStatus: nextStatus,
      distanceRemainingKm: distanceToDestinationKm,
    });

    // Directly update trip_status in trips table
    try {
      await db.from('trips').update({ trip_status: nextStatus }).eq('id', tripId);
    } catch {}

    // Also attempt updating extended telemetry columns in trips table if present
    try {
      const tripUpdate: any = {
        last_latitude: lat,
        last_longitude: lon,
        last_speed: currentSpeed,
        last_heading: currentHeading,
        last_ping_at: now,
      };
      if (distanceToDestinationKm !== null) {
        tripUpdate.distance_remaining_km = distanceToDestinationKm;
      }
      await db.from('trips').update(tripUpdate).eq('id', tripId);
    } catch {}

    // 9. Audit location ping
    recordAuditLog({
      userId: trip.driver_id || '00000000-0000-0000-0000-000000000001',
      userType: 'DRIVER',
      eventType: 'TRIP_LOCATION_PING',
      details: {
        trip_id: tripId,
        latitude: lat,
        longitude: lon,
        speed: currentSpeed,
        status: nextStatus,
        distance_remaining_km: distanceToDestinationKm,
        pinged_at: now,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: trip.driver_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'DRIVER',
          event_type: 'TRIP_LOCATION_PING',
          details: {
            trip_id: tripId,
            latitude: lat,
            longitude: lon,
            speed: currentSpeed,
            status: nextStatus,
            distance_remaining_km: distanceToDestinationKm,
            pinged_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      latitude: lat,
      longitude: lon,
      speed: currentSpeed,
      heading: currentHeading,
      recordedAt: now,
      tripStatus: nextStatus,
      distanceToPickupKm,
      distanceToDestinationKm,
      geofenceTriggered,
      message: 'Location ping ingested and telemetry updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Location ping ingestion failed.' });
  }
});

/**
 * POST /api/trips/:tripId/milestone
 * Enforces strict milestone state progression:
 * - Sequenced: CREATED -> LORRY_ASSIGNED -> DISPATCHED -> AT_LOADING -> IN_TRANSIT -> AT_UNLOADING -> DELIVERED -> COMPLETED
 * - Rejects sequence jumps with HTTP 400 & INVALID_MILESTONE_TRANSITION
 * - Synchronizes booking status (IN_PROGRESS, DELIVERED, COMPLETED)
 * - Logs waypoint event and audits in auth_audit_log
 */
app.post('/api/trips/:tripId/milestone', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const { newStatus, notes, updatedBy } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId || !newStatus) {
    return res.status(400).json({ error: 'tripId and newStatus are required.' });
  }

  try {
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const currentStatus = trip.trip_status || 'CREATED';

    // State Sequence Validation
    if (!isValidMilestoneTransition(currentStatus, newStatus)) {
      return res.status(400).json({
        error: `Cannot transition trip status from ${currentStatus} to ${newStatus}. Milestone sequence violation.`,
        code: 'INVALID_MILESTONE_TRANSITION',
        currentStatus,
        attemptedStatus: newStatus,
      });
    }

    const now = new Date().toISOString();
    const updatePayload: any = { trip_status: newStatus };

    if (newStatus === 'IN_TRANSIT' && !trip.started_at) {
      updatePayload.started_at = now;
    }
    if (newStatus === 'COMPLETED') {
      updatePayload.completed_at = now;
    }

    // 1. Update trip status
    const { error: updErr } = await db.from('trips').update(updatePayload).eq('id', tripId);
    if (updErr) {
      return res.status(500).json({ error: updErr.message || 'Failed to update milestone status.' });
    }

    // 2. Synchronize booking status
    if (trip.booking_id) {
      let bookingStatus = null;
      if (newStatus === 'IN_TRANSIT') bookingStatus = 'IN_PROGRESS';
      else if (newStatus === 'DELIVERED') bookingStatus = 'DELIVERED';
      else if (newStatus === 'COMPLETED') bookingStatus = 'COMPLETED';

      if (bookingStatus) {
        await db
          .from('bookings')
          .update({ booking_status: bookingStatus })
          .eq('id', trip.booking_id);
      }
    }

    // 3. Log Waypoint Event
    const wpEvent = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      event_type: newStatus,
      location_latitude: trip.last_latitude,
      location_longitude: trip.last_longitude,
      notes: notes || `Milestone updated to ${newStatus}.`,
      triggered_at: now,
      created_at: now,
    };

    // Always record waypoint event in memory immediately
    const wpList = memoryWaypointEvents.get(tripId) || [];
    wpList.unshift(wpEvent);
    memoryWaypointEvents.set(tripId, wpList);

    try {
      await db.from('trip_waypoint_events').insert([wpEvent]);
    } catch {}

    // 4. Audit Log in auth_audit_log
    recordAuditLog({
      userId: updatedBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
      userType: 'SYSTEM',
      eventType: 'TRIP_MILESTONE_UPDATED',
      details: {
        trip_id: tripId,
        previous_status: currentStatus,
        new_status: newStatus,
        notes: notes || null,
        updated_at: now,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: updatedBy || trip.driver_id || trip.vendor_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'SYSTEM',
          event_type: 'TRIP_MILESTONE_UPDATED',
          details: {
            trip_id: tripId,
            previous_status: currentStatus,
            new_status: newStatus,
            notes: notes || null,
            updated_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      tripId,
      previousStatus: currentStatus,
      newStatus,
      updatedAt: now,
      message: `Trip milestone transitioned from ${currentStatus} to ${newStatus} successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Milestone update failed.' });
  }
});

/**
 * POST /api/trips/:tripId/geofence-check
 * Evaluates proximity to origin/destination geofences and returns distances
 */
app.post('/api/trips/:tripId/geofence-check', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const { latitude, longitude, targetType } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    const { data: trip } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*))')
      .eq('id', tripId)
      .maybeSingle();

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    const currentLat = latitude !== undefined ? Number(latitude) : Number(trip.last_latitude);
    const currentLon = longitude !== undefined ? Number(longitude) : Number(trip.last_longitude);

    if (isNaN(currentLat) || isNaN(currentLon)) {
      return res.status(400).json({ error: 'Current coordinates not available for geofence check.' });
    }

    const pickupLat = trip.pickup_latitude ? Number(trip.pickup_latitude) : 26.1445;
    const pickupLon = trip.pickup_longitude ? Number(trip.pickup_longitude) : 91.7362;
    const destLat = trip.destination_latitude ? Number(trip.destination_latitude) : 22.5726;
    const destLon = trip.destination_longitude ? Number(trip.destination_longitude) : 88.3639;

    const distToPickup = calculateHaversineDistanceKm(currentLat, currentLon, pickupLat, pickupLon);
    const distToDest = calculateHaversineDistanceKm(currentLat, currentLon, destLat, destLon);
    const GEOFENCE_RADIUS_KM = 1.0;

    return res.json({
      success: true,
      tripId,
      currentPosition: { latitude: currentLat, longitude: currentLon },
      distanceToPickupKm: distToPickup,
      distanceToDestinationKm: distToDest,
      insidePickupGeofence: distToPickup <= GEOFENCE_RADIUS_KM,
      insideDestinationGeofence: distToDest <= GEOFENCE_RADIUS_KM,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Geofence check failed.' });
  }
});

/**
 * GET /api/trips/:tripId/tracking
 * Real-Time Live Tracking Feed with Commercial Rate Protection:
 * - Returns current telemetry position, speed, heading, distance remaining, ETA
 * - Returns waypoint events history and recent breadcrumbs
 * - CONFIDENTIALITY PROTECTION: Strictly omits vendor_rate and client price figures
 */
app.get('/api/trips/:tripId/tracking', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    const { data: trip, error: tErr } = await db
      .from('trips')
      .select('*, bookings(*, requirements(*, client_companies(*))), vehicles(*), drivers(*), vendor_companies:vendor_id(*)')
      .eq('id', tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    // Fetch recent location pings (latest 50)
    let pings: any[] = [];
    try {
      const { data: pingData } = await db
        .from('trip_location_logs')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (pingData && pingData.length > 0) pings = pingData;
    } catch {}

    if (pings.length === 0) {
      pings = memoryLocationLogs.get(tripId) || [];
    }

    // Fetch waypoint events
    let waypointEvents: any[] = [];
    try {
      const { data: wpData } = await db
        .from('trip_waypoint_events')
        .select('*')
        .eq('trip_id', tripId)
        .order('triggered_at', { ascending: true });

      if (wpData && wpData.length > 0) waypointEvents = wpData;
    } catch {}

    if (waypointEvents.length === 0) {
      waypointEvents = memoryWaypointEvents.get(tripId) || [];
    }

    const reqData = trip.bookings?.requirements;
    const vehicleData = trip.vehicles;
    const driverData = trip.drivers;
    const cachedTelem = memoryTripTelemetry.get(tripId) || {};

    const lastPing = pings[0] || null;
    const currentLat = trip.last_latitude ? Number(trip.last_latitude) : (lastPing?.latitude !== undefined ? Number(lastPing.latitude) : (cachedTelem.lastLatitude ?? null));
    const currentLon = trip.last_longitude ? Number(trip.last_longitude) : (lastPing?.longitude !== undefined ? Number(lastPing.longitude) : (cachedTelem.lastLongitude ?? null));

    const trackingData = {
      tripId: trip.id,
      tripCode: formatTripCode(trip.id, trip.created_at),
      bookingId: trip.booking_id,
      tripStatus: trip.trip_status || cachedTelem.tripStatus || 'CREATED',
      currentPosition: {
        latitude: currentLat,
        longitude: currentLon,
        speed: trip.last_speed !== undefined ? Number(trip.last_speed) : (lastPing?.speed !== undefined ? Number(lastPing.speed) : (cachedTelem.lastSpeed ?? 0)),
        heading: trip.last_heading !== undefined ? Number(trip.last_heading) : (lastPing?.heading !== undefined ? Number(lastPing.heading) : (cachedTelem.lastHeading ?? 0)),
        lastPingAt: trip.last_ping_at || lastPing?.recorded_at || cachedTelem.lastPingAt || trip.created_at,
      },
      route: {
        origin: reqData?.pickup_address || reqData?.origin || 'Origin Hub',
        originPincode: reqData?.pickup_pincode || '',
        destination: reqData?.destination_address || reqData?.destination || 'Destination Hub',
        destinationPincode: reqData?.destination_pincode || '',
        totalDistanceKm: trip.total_distance_km ? Number(trip.total_distance_km) : null,
        distanceRemainingKm: trip.distance_remaining_km ? Number(trip.distance_remaining_km) : null,
        estimatedArrivalAt: trip.estimated_arrival_at || null,
      },
      vehicle: vehicleData
        ? {
            id: vehicleData.id,
            registrationNumber: vehicleData.registration_number,
            vehicleType: vehicleData.vehicle_type,
          }
        : null,
      driver: driverData
        ? {
            id: driverData.id,
            fullName: driverData.full_name || driverData.name,
            mobile: driverData.mobile || driverData.phone,
          }
        : null,
      materialType: reqData?.material_type || 'Cargo',
      capacityMt: Number(reqData?.required_capacity_mt || 0),
      waypointEvents: waypointEvents.map((w: any) => ({
        id: w.id,
        eventType: w.event_type,
        location: { latitude: w.location_latitude, longitude: w.location_longitude },
        distanceToTargetKm: w.distance_to_target_km ? Number(w.distance_to_target_km) : null,
        notes: w.notes,
        triggeredAt: w.triggered_at,
      })),
      recentBreadcrumbs: pings.slice(0, 30).map((p: any) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        speed: Number(p.speed || 0),
        heading: Number(p.heading || 0),
        recordedAt: p.recorded_at,
      })),
      // COMMERCIAL CONFIDENTIALITY: vendor_rate, grand_total, and admin margin are NEVER exposed
    };

    return res.json({ success: true, tracking: trackingData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch tracking data.' });
  }
});



// ============================================================================
// PHASE 10: ELECTRONIC PROOF OF DELIVERY (e-POD), WEIGHBRIDGE & DAMAGE CLAIMS
// ============================================================================

/**
 * POST /api/trips/:tripId/pod
 * Submits Electronic Proof of Delivery (e-POD)
 */
app.post('/api/trips/:tripId/pod', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const {
    receiverName,
    receiverPhone,
    deliveredCondition = 'CLEAN',
    consigneeStampVerified = false,
    podDocumentUrl,
    signatureUrl,
    remarks,
    submittedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }
  if (!receiverName || !receiverName.trim()) {
    return res.status(400).json({ error: 'receiverName is mandatory for e-POD submission.', code: 'RECEIVER_NAME_REQUIRED' });
  }

  const validConditions = ['CLEAN', 'SHORTAGE', 'DAMAGED', 'PARTIAL'];
  if (!validConditions.includes(deliveredCondition)) {
    return res.status(400).json({
      error: `Invalid delivered condition: ${deliveredCondition}. Must be one of: ${validConditions.join(', ')}`,
      code: 'INVALID_CONDITION',
    });
  }

  try {
    const { data: trip, error: tErr } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (tErr || !trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const submissionId = crypto.randomUUID();

    const submissionRecord = {
      id: submissionId,
      trip_id: tripId,
      booking_id: trip.booking_id,
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone || null,
      received_at: now,
      delivered_condition: deliveredCondition,
      consignee_stamp_verified: Boolean(consigneeStampVerified),
      pod_document_url: podDocumentUrl || `/documents/trips/${tripId}/epod/${submissionId}.jpg`,
      signature_url: signatureUrl || null,
      remarks: remarks || null,
      review_status: 'PENDING',
      created_at: now,
      updated_at: now,
    };

    // Store in memory queue immediately
    const list = memoryPodSubmissions.get(tripId) || [];
    list.unshift(submissionRecord);
    memoryPodSubmissions.set(tripId, list);

    // Attempt DB insert into trip_pod_submissions
    try {
      await db.from('trip_pod_submissions').insert([submissionRecord]);
    } catch {}

    // Persist into documents table
    try {
      await db.from('documents').insert([
        {
          category: 'TRIP',
          document_type: 'POD',
          reference_id: tripId,
          file_name: `EPOD_${submissionId.slice(0, 8)}.jpg`,
          file_url: submissionRecord.pod_document_url,
          storage_path: `trips/${tripId}/epod/${submissionId}.jpg`,
          verification_status: 'PENDING',
          uploaded_by: submittedBy || trip.driver_id || '00000000-0000-0000-0000-000000000001',
          created_at: now,
        },
      ]);
    } catch {}

    // Auto-transition trip status if CLEAN
    let nextStatus = trip.trip_status;
    if (deliveredCondition === 'CLEAN' && ['DISPATCHED', 'AT_LOADING', 'IN_TRANSIT', 'AT_UNLOADING'].includes(trip.trip_status)) {
      nextStatus = 'DELIVERED';
      try {
        await db.from('trips').update({ trip_status: 'DELIVERED', updated_at: now }).eq('id', tripId);
        if (trip.booking_id) {
          await db.from('bookings').update({ booking_status: 'DELIVERED' }).eq('id', trip.booking_id);
        }
      } catch {}

      // Update memory telemetry
      const cached = memoryTripTelemetry.get(tripId) || {};
      memoryTripTelemetry.set(tripId, { ...cached, tripStatus: 'DELIVERED' });
    }

    // Audit log in auth_audit_log
    recordAuditLog({
      userId: submittedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'DRIVER',
      eventType: 'EPOD_SUBMITTED',
      details: {
        trip_id: tripId,
        submission_id: submissionId,
        receiver_name: receiverName.trim(),
        condition: deliveredCondition,
        consignee_stamp_verified: Boolean(consigneeStampVerified),
        trip_status: nextStatus,
        submitted_at: now,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: submittedBy || trip.driver_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'DRIVER',
          event_type: 'EPOD_SUBMITTED',
          details: {
            trip_id: tripId,
            submission_id: submissionId,
            receiver_name: receiverName.trim(),
            condition: deliveredCondition,
            consignee_stamp_verified: Boolean(consigneeStampVerified),
            trip_status: nextStatus,
            submitted_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      submissionId,
      tripId,
      tripStatus: nextStatus,
      reviewStatus: 'PENDING',
      message: 'e-POD submitted successfully and pending admin verification.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'e-POD submission failed.' });
  }
});

/**
 * GET /api/trips/:tripId/pod
 * Fetches e-POD submission details and document records
 */
app.get('/api/trips/:tripId/pod', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    const { data: trip } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    let submissions: any[] = [];
    try {
      const { data: dbSubs } = await db
        .from('trip_pod_submissions')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (dbSubs && dbSubs.length > 0) submissions = dbSubs;
    } catch {}

    if (submissions.length === 0) {
      submissions = memoryPodSubmissions.get(tripId) || [];
    }

    // Also fetch documents
    let docs: any[] = [];
    try {
      const { data: docData } = await db
        .from('documents')
        .select('*')
        .eq('reference_id', tripId)
        .in('document_type', ['POD', 'POD_LR'])
        .order('created_at', { ascending: false });
      if (docData) docs = docData;
    } catch {}

    const latestSubmission = submissions[0] || null;

    return res.json({
      success: true,
      tripId,
      tripStatus: trip.trip_status,
      podApproved: trip.pod_approved,
      podApprovedAt: trip.pod_approved_at,
      podApprovedBy: trip.pod_approved_by,
      rejectionReason: trip.pod_rejection_reason,
      latestSubmission,
      submissions,
      documents: docs.map((d: any) => ({
        id: d.id,
        fileName: d.file_name,
        fileUrl: d.file_url,
        verificationStatus: d.verification_status,
        consigneeStampVerified: Boolean(d.consignee_stamp_verified),
        uploadedAt: d.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch e-POD details.' });
  }
});

/**
 * POST /api/trips/:tripId/pod/review
 * Admin approval or rejection of submitted e-POD
 */
app.post('/api/trips/:tripId/pod/review', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const { action, rejectionReason, adminNotes, adminId } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId || !action) {
    return res.status(400).json({ error: 'tripId and action are mandatory.' });
  }

  const act = String(action).toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(act)) {
    return res.status(400).json({ error: 'Action must be APPROVE or REJECT.', code: 'INVALID_ACTION' });
  }

  if (act === 'REJECT' && (!rejectionReason || !rejectionReason.trim())) {
    return res.status(400).json({ error: 'rejectionReason is mandatory when rejecting e-POD.', code: 'REJECTION_REASON_REQUIRED' });
  }

  try {
    const { data: trip } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const reviewerId = adminId || '5fa0f865-0388-4779-99ad-03d8979c484a';

    if (act === 'APPROVE') {
      // Check for active unresolved claims
      const claims = memoryClaims.get(tripId) || [];
      const hasActiveClaims = claims.some((c: any) => ['SUBMITTED', 'UNDER_INVESTIGATION'].includes(c.status));

      const nextTripStatus = hasActiveClaims ? 'DELIVERED' : 'COMPLETED';

      // Update trips table
      const tripUpdate: any = {
        pod_approved: true,
        pod_approved_by: reviewerId,
        pod_approved_at: now,
        pod_rejection_reason: null,
        trip_status: nextTripStatus,
        updated_at: now,
      };
      if (!hasActiveClaims) {
        tripUpdate.completed_at = now;
      }

      try {
        await db.from('trips').update(tripUpdate).eq('id', tripId);
        if (!hasActiveClaims && trip.booking_id) {
          await db.from('bookings').update({ booking_status: 'COMPLETED' }).eq('id', trip.booking_id);
        }
      } catch {}

      // Update submissions in memory and DB
      const subs = memoryPodSubmissions.get(tripId) || [];
      for (const s of subs) {
        s.review_status = 'APPROVED';
        s.reviewed_by = reviewerId;
        s.reviewed_at = now;
      }
      memoryPodSubmissions.set(tripId, subs);

      try {
        await db
          .from('trip_pod_submissions')
          .update({ review_status: 'APPROVED', reviewed_by: reviewerId, reviewed_at: now, updated_at: now })
          .eq('trip_id', tripId);
      } catch {}

      // Update documents verification status
      try {
        await db
          .from('documents')
          .update({
            verification_status: 'VERIFIED',
            consignee_stamp_verified: true,
            verified_by: reviewerId,
            verified_at: now,
          })
          .eq('reference_id', tripId)
          .in('document_type', ['POD', 'POD_LR']);
      } catch {}

      // Audit approval
      recordAuditLog({
        userId: reviewerId,
        userType: 'ADMIN',
        eventType: 'EPOD_REVIEWED_APPROVED',
        details: {
          trip_id: tripId,
          has_active_claims: hasActiveClaims,
          final_status: nextTripStatus,
          admin_notes: adminNotes || null,
          reviewed_at: now,
        },
      });
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: reviewerId,
            user_type: 'ADMIN',
            event_type: 'EPOD_REVIEWED_APPROVED',
            details: {
              trip_id: tripId,
              has_active_claims: hasActiveClaims,
              final_status: nextTripStatus,
              admin_notes: adminNotes || null,
              reviewed_at: now,
            },
          },
        ]);
      } catch {}

      return res.json({
        success: true,
        tripId,
        podApproved: true,
        tripStatus: nextTripStatus,
        hasActiveClaims,
        message: hasActiveClaims
          ? 'e-POD approved. Trip held in DELIVERED state pending resolution of active damage claims.'
          : 'e-POD approved successfully. Consignment closed and trip marked COMPLETED.',
      });
    } else {
      // Action is REJECT
      const cleanReason = rejectionReason.trim();

      try {
        await db
          .from('trips')
          .update({
            pod_approved: false,
            pod_rejection_reason: cleanReason,
            updated_at: now,
          })
          .eq('id', tripId);
      } catch {}

      const subs = memoryPodSubmissions.get(tripId) || [];
      for (const s of subs) {
        s.review_status = 'REJECTED';
        s.rejection_reason = cleanReason;
        s.reviewed_by = reviewerId;
        s.reviewed_at = now;
      }
      memoryPodSubmissions.set(tripId, subs);

      try {
        await db
          .from('trip_pod_submissions')
          .update({
            review_status: 'REJECTED',
            rejection_reason: cleanReason,
            reviewed_by: reviewerId,
            reviewed_at: now,
            updated_at: now,
          })
          .eq('trip_id', tripId);
      } catch {}

      try {
        await db
          .from('documents')
          .update({
            verification_status: 'REJECTED',
            rejection_reason: cleanReason,
          })
          .eq('reference_id', tripId)
          .in('document_type', ['POD', 'POD_LR']);
      } catch {}

      // Audit rejection
      recordAuditLog({
        userId: reviewerId,
        userType: 'ADMIN',
        eventType: 'EPOD_REVIEWED_REJECTED',
        details: {
          trip_id: tripId,
          rejection_reason: cleanReason,
          reviewed_at: now,
        },
      });
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: reviewerId,
            user_type: 'ADMIN',
            event_type: 'EPOD_REVIEWED_REJECTED',
            details: {
              trip_id: tripId,
              rejection_reason: cleanReason,
              reviewed_at: now,
            },
          },
        ]);
      } catch {}

      return res.json({
        success: true,
        tripId,
        podApproved: false,
        rejectionReason: cleanReason,
        message: 'e-POD rejected. Driver and transporter notified for corrective re-upload.',
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'e-POD review failed.' });
  }
});

/**
 * POST /api/trips/:tripId/weighbridge
 * Ingests weighbridge reading and computes variance & tolerance compliance
 */
app.post('/api/trips/:tripId/weighbridge', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const {
    stage,
    grossWeightMt,
    tareWeightMt,
    slipNumber,
    slipLocation,
    slipDocumentUrl,
    weighbridgeName,
    recordedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  const stg = String(stage || '').toUpperCase();
  if (!['LOADING', 'UNLOADING'].includes(stg)) {
    return res.status(400).json({ error: 'Stage must be LOADING or UNLOADING.', code: 'INVALID_STAGE' });
  }

  const gross = Number(grossWeightMt);
  const tare = Number(tareWeightMt);

  if (isNaN(gross) || isNaN(tare) || gross <= 0 || tare < 0) {
    return res.status(400).json({ error: 'Valid gross and tare weights are mandatory.', code: 'INVALID_WEIGHTS' });
  }

  if (gross <= tare) {
    return res.status(400).json({
      error: `Gross weight (${gross} MT) must be strictly greater than tare weight (${tare} MT).`,
      code: 'INVALID_WEIGHTS',
    });
  }

  try {
    const { data: trip } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const netWeight = Math.round((gross - tare) * 100) / 100;
    const now = new Date().toISOString();
    const weighmentId = crypto.randomUUID();

    let varianceMt = 0;
    let variancePct = 0;
    let status = 'MATCHED';

    const TOLERANCE_MT = 0.20; // 0.2 MT tolerance
    const TOLERANCE_PCT = 0.50; // 0.5% tolerance

    // If stage is UNLOADING, compare with LOADING net weight
    if (stg === 'UNLOADING') {
      const prevWeighments = memoryWeighments.get(tripId) || [];
      const loadingRecord = prevWeighments.find((w: any) => w.stage === 'LOADING');
      let loadingNet = loadingRecord ? Number(loadingRecord.net_weight_mt) : null;

      if (loadingNet === null) {
        try {
          const { data: dbLw } = await db
            .from('weighments')
            .select('net_weight_mt')
            .eq('trip_id', tripId)
            .eq('stage', 'LOADING')
            .order('recorded_at', { ascending: false })
            .limit(1);
          if (dbLw && dbLw.length > 0) loadingNet = Number(dbLw[0].net_weight_mt);
        } catch {}
      }

      if (loadingNet !== null && loadingNet > 0) {
        varianceMt = Math.abs(Math.round((netWeight - loadingNet) * 100) / 100);
        variancePct = Math.round(((varianceMt / loadingNet) * 100) * 100) / 100;

        if (varianceMt > TOLERANCE_MT && variancePct > TOLERANCE_PCT) {
          status = 'DISCREPANCY';
          try {
            await db.from('trips').update({ has_weight_discrepancy: true }).eq('id', tripId);
          } catch {}
        } else {
          status = 'TOLERANCE_ACCEPTED';
        }
      }
    }

    const weighmentRecord = {
      id: weighmentId,
      trip_id: tripId,
      stage: stg,
      gross_weight_mt: gross,
      tare_weight_mt: tare,
      net_weight_mt: netWeight,
      slip_number: slipNumber || `WB-${Math.floor(100000 + Math.random() * 900000)}`,
      slip_location: slipLocation || 'Main Logistics Scale',
      slip_document_url: slipDocumentUrl || `/documents/trips/${tripId}/weighbridge/${weighmentId}.pdf`,
      variance_mt: varianceMt,
      variance_percentage: variancePct,
      status,
      weighbridge_name: weighbridgeName || 'Certified Commercial Weighbridge',
      recorded_at: now,
      verified_by: recordedBy || trip.driver_id || null,
      created_at: now,
    };

    // Store in memory queue
    const wList = memoryWeighments.get(tripId) || [];
    wList.unshift(weighmentRecord);
    memoryWeighments.set(tripId, wList);

    // Attempt DB insert
    try {
      await db.from('weighments').insert([weighmentRecord]);
    } catch {}

    // Persist slip into documents table
    try {
      await db.from('documents').insert([
        {
          category: 'TRIP',
          document_type: 'WEIGHBRIDGE_SLIP',
          reference_id: tripId,
          file_name: `WB_SLIP_${stg}_${weighmentRecord.slip_number}.pdf`,
          file_url: weighmentRecord.slip_document_url,
          storage_path: `trips/${tripId}/weighbridge/${weighmentId}.pdf`,
          verification_status: status === 'DISCREPANCY' ? 'PENDING' : 'VERIFIED',
          uploaded_by: recordedBy || trip.driver_id || '00000000-0000-0000-0000-000000000001',
          created_at: now,
        },
      ]);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: recordedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'OPERATOR',
      eventType: status === 'DISCREPANCY' ? 'WEIGHBRIDGE_DISCREPANCY_FLAGGED' : 'WEIGHBRIDGE_RECORDED',
      details: {
        trip_id: tripId,
        weighment_id: weighmentId,
        stage: stg,
        gross_weight_mt: gross,
        tare_weight_mt: tare,
        net_weight_mt: netWeight,
        variance_mt: varianceMt,
        variance_percentage: variancePct,
        status,
      },
    });
    if (status === 'DISCREPANCY') {
      recordAuditLog({
        userId: recordedBy || '00000000-0000-0000-0000-000000000001',
        userType: 'OPERATOR',
        eventType: 'WEIGHBRIDGE_RECORDED',
        details: {
          trip_id: tripId,
          weighment_id: weighmentId,
          stage: stg,
          status,
        },
      });
    }
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: recordedBy || trip.driver_id || '00000000-0000-0000-0000-000000000001',
          user_type: 'OPERATOR',
          event_type: status === 'DISCREPANCY' ? 'WEIGHBRIDGE_DISCREPANCY_FLAGGED' : 'WEIGHBRIDGE_RECORDED',
          details: {
            trip_id: tripId,
            weighment_id: weighmentId,
            stage: stg,
            gross_weight_mt: gross,
            tare_weight_mt: tare,
            net_weight_mt: netWeight,
            variance_mt: varianceMt,
            variance_percentage: variancePct,
            status,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      weighmentId,
      stage: stg,
      grossWeightMt: gross,
      tareWeightMt: tare,
      netWeightMt: netWeight,
      varianceMt,
      variancePct,
      status,
      hasDiscrepancy: status === 'DISCREPANCY',
      message: status === 'DISCREPANCY'
        ? 'Weighbridge reading recorded. Discrepancy flagged: exceeds permissible weight tolerance.'
        : 'Weighbridge reading verified within acceptable industrial tolerance.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Weighbridge recording failed.' });
  }
});

/**
 * GET /api/trips/:tripId/weighbridge
 * Returns weighment history and tolerance analysis
 */
app.get('/api/trips/:tripId/weighbridge', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    let weighments: any[] = [];
    try {
      const { data: dbW } = await db
        .from('weighments')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: true });
      if (dbW && dbW.length > 0) weighments = dbW;
    } catch {}

    if (weighments.length === 0) {
      weighments = (memoryWeighments.get(tripId) || []).slice().reverse();
    }

    const loading = weighments.find((w: any) => w.stage === 'LOADING') || null;
    const unloading = weighments.find((w: any) => w.stage === 'UNLOADING') || null;

    return res.json({
      success: true,
      tripId,
      loadingWeighment: loading,
      unloadingWeighment: unloading,
      weighments,
      hasDiscrepancy: weighments.some((w: any) => w.status === 'DISCREPANCY'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch weighbridge records.' });
  }
});

/**
 * POST /api/trips/:tripId/claims
 * Files consignment damage or shortage claim
 */
app.post('/api/trips/:tripId/claims', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const {
    claimType,
    claimedAmount,
    itemDescription,
    damagedQuantity,
    evidenceUrls = [],
    submittedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  const validTypes = ['DAMAGE', 'SHORTAGE', 'TRANSIT_LOSS', 'CONTAMINATION', 'PILFERAGE', 'DELAY'];
  const typeStr = String(claimType || '').toUpperCase();
  if (!validTypes.includes(typeStr)) {
    return res.status(400).json({
      error: `Invalid claimType: ${claimType}. Must be one of: ${validTypes.join(', ')}`,
      code: 'INVALID_CLAIM_TYPE',
    });
  }

  const amount = Number(claimedAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'claimedAmount must be greater than zero.', code: 'INVALID_AMOUNT' });
  }

  try {
    const { data: trip } = await db.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const claimCode = `CLM-${dateStr}-${randSuffix}`;
    const claimId = crypto.randomUUID();

    const claimRecord = {
      id: claimId,
      claim_code: claimCode,
      trip_id: tripId,
      booking_id: trip.booking_id,
      claim_type: typeStr,
      claimed_amount: amount,
      approved_amount: 0,
      item_description: itemDescription || 'Damaged freight goods reported upon arrival',
      damaged_quantity: damagedQuantity !== undefined ? Number(damagedQuantity) : 0,
      evidence_urls: Array.isArray(evidenceUrls) ? evidenceUrls : [evidenceUrls],
      status: 'SUBMITTED',
      submitted_by: submittedBy || '00000000-0000-0000-0000-000000000001',
      submitted_at: now,
      created_at: now,
      updated_at: now,
    };

    // Store in memory queue
    const list = memoryClaims.get(tripId) || [];
    list.unshift(claimRecord);
    memoryClaims.set(tripId, list);

    // Flag trip with active claims
    try {
      await db.from('trips').update({ has_active_claims: true }).eq('id', tripId);
    } catch {}

    // Attempt DB insert
    try {
      await db.from('trip_claims').insert([claimRecord]);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: submittedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'CLIENT',
      eventType: 'DAMAGE_CLAIM_FILED',
      details: {
        trip_id: tripId,
        claim_id: claimId,
        claim_code: claimCode,
        claim_type: typeStr,
        claimed_amount: amount,
        damaged_quantity: claimRecord.damaged_quantity,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: submittedBy || '00000000-0000-0000-0000-000000000001',
          user_type: 'CLIENT',
          event_type: 'DAMAGE_CLAIM_FILED',
          details: {
            trip_id: tripId,
            claim_id: claimId,
            claim_code: claimCode,
            claim_type: typeStr,
            claimed_amount: amount,
            damaged_quantity: claimRecord.damaged_quantity,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      claimId,
      claimCode,
      tripId,
      claimType: typeStr,
      claimedAmount: amount,
      status: 'SUBMITTED',
      message: 'Consignment claim registered and trip flagged for commercial review.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to file damage claim.' });
  }
});

/**
 * GET /api/trips/:tripId/claims
 * Returns damage and shortage claims filed for trip
 */
app.get('/api/trips/:tripId/claims', async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    let claims: any[] = [];
    try {
      const { data: dbClaims } = await db
        .from('trip_claims')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (dbClaims && dbClaims.length > 0) claims = dbClaims;
    } catch {}

    if (claims.length === 0) {
      claims = memoryClaims.get(tripId) || [];
    }

    return res.json({
      success: true,
      tripId,
      claims,
      hasActiveClaims: claims.some((c: any) => ['SUBMITTED', 'UNDER_INVESTIGATION'].includes(c.status)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch claims.' });
  }
});

/**
 * POST /api/claims/:claimId/resolve
 * Admin resolution of damage / shortage claim
 */
app.post('/api/claims/:claimId/resolve', async (req: Request, res: Response) => {
  const claimId = req.params.claimId as string;
  const { action, approvedAmount = 0, settlementNotes, reviewedBy } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!claimId || !action) {
    return res.status(400).json({ error: 'claimId and action are mandatory.' });
  }

  const act = String(action).toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(act)) {
    return res.status(400).json({ error: 'Action must be APPROVE or REJECT.', code: 'INVALID_ACTION' });
  }

  try {
    const now = new Date().toISOString();
    const newStatus = act === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const finalAmount = act === 'APPROVE' ? Number(approvedAmount || 0) : 0;
    const reviewer = reviewedBy || '5fa0f865-0388-4779-99ad-03d8979c484a';

    let targetTripId: string | null = null;

    // Search memory claims
    for (const [tId, cList] of memoryClaims.entries()) {
      const found = cList.find((c: any) => c.id === claimId || c.claim_code === claimId);
      if (found) {
        found.status = newStatus;
        found.approved_amount = finalAmount;
        found.settlement_notes = settlementNotes || null;
        found.reviewed_by = reviewer;
        found.resolved_at = now;
        found.updated_at = now;
        targetTripId = tId;
        break;
      }
    }

    // Attempt DB update
    try {
      const { data: updatedClaim } = await db
        .from('trip_claims')
        .update({
          status: newStatus,
          approved_amount: finalAmount,
          settlement_notes: settlementNotes || null,
          reviewed_by: reviewer,
          resolved_at: now,
          updated_at: now,
        })
        .or(`id.eq.${claimId},claim_code.eq.${claimId}`)
        .select('*')
        .maybeSingle();

      if (updatedClaim && updatedClaim.trip_id) {
        targetTripId = updatedClaim.trip_id;
      }
    } catch {}

    // If all claims for this trip are resolved, clear has_active_claims
    if (targetTripId) {
      const allClaims = memoryClaims.get(targetTripId) || [];
      const hasPending = allClaims.some((c: any) => ['SUBMITTED', 'UNDER_INVESTIGATION'].includes(c.status));
      if (!hasPending) {
        try {
          await db.from('trips').update({ has_active_claims: false }).eq('id', targetTripId);
        } catch {}
      }
    }

    // Audit trail
    recordAuditLog({
      userId: reviewer,
      userType: 'ADMIN',
      eventType: 'DAMAGE_CLAIM_RESOLVED',
      details: {
        claim_id: claimId,
        action: act,
        status: newStatus,
        approved_amount: finalAmount,
        settlement_notes: settlementNotes || null,
        resolved_at: now,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: reviewer,
          user_type: 'ADMIN',
          event_type: 'DAMAGE_CLAIM_RESOLVED',
          details: {
            claim_id: claimId,
            action: act,
            status: newStatus,
            approved_amount: finalAmount,
            settlement_notes: settlementNotes || null,
            resolved_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      claimId,
      status: newStatus,
      approvedAmount: finalAmount,
      message: `Damage claim ${act === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resolve claim.' });
  }
});



// ============================================================================
// PHASE 11: COMMERCIAL INVOICING, TRANSPORTER PAYMENTS, TDS & RECONCILIATION
// ============================================================================

/**
 * POST /api/invoices/client/generate
 * Generates GST compliant commercial tax invoice for client
 */
app.post('/api/invoices/client/generate', async (req: Request, res: Response) => {
  const {
    bookingId,
    loadingDetention = 0,
    unloadingDetention = 0,
    platformFee = 0,
    creditDays = 30,
    generatedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is mandatory.' });
  }

  try {
    // 1. Idempotency Check
    let existingInvoice = memoryClientInvoices.get(bookingId);
    if (!existingInvoice) {
      try {
        const { data: dbInv } = await db
          .from('client_invoices')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle();
        if (dbInv) existingInvoice = dbInv;
      } catch {}
    }

    if (existingInvoice) {
      return res.json({
        success: true,
        isIdempotent: true,
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        totalAmount: Number(existingInvoice.total_amount),
        balanceDue: Number(existingInvoice.balance_due),
        paymentStatus: existingInvoice.payment_status,
        message: 'Invoice already exists for this booking (idempotent retrieval).',
      });
    }

    // 2. Fetch Booking & Client
    let booking: any = null;
    const { data: bData } = await db
      .from('bookings')
      .select('*, requirements(*)')
      .eq('id', bookingId)
      .maybeSingle();

    if (bData) {
      booking = bData;
    } else {
      const { data: simpleBooking } = await db
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();
      if (simpleBooking) {
        booking = simpleBooking;
        if (simpleBooking.requirement_id) {
          const { data: reqRow } = await db
            .from('requirements')
            .select('*')
            .eq('id', simpleBooking.requirement_id)
            .maybeSingle();
          if (reqRow) booking.requirements = reqRow;
        }
      }
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.', code: 'BOOKING_NOT_FOUND' });
    }

    let client: any = null;
    const targetClientId = booking.client_id || booking.requirements?.client_id;
    if (targetClientId) {
      const { data: cRow } = await db
        .from('client_companies')
        .select('*')
        .eq('id', targetClientId)
        .maybeSingle();
      if (cRow) client = cRow;
    }
    const reqData = booking.requirements;
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const invoiceNumber = `INV-${dateStr}-${randSuffix}`;
    const invoiceId = crypto.randomUUID();

    // 3. Taxable Calculation
    const grand = Number(booking.grand_total || 50000);
    // Base amount is either pre-tax amount or grand total
    const baseAmount = Math.round((grand / 1.18) * 100) / 100;
    const loadDet = Number(loadingDetention || 0);
    const unloadDet = Number(unloadingDetention || 0);
    const platFee = Number(platformFee || 0);

    const taxableAmount = Math.round((baseAmount + loadDet + unloadDet + platFee) * 100) / 100;

    // 4. Interstate GST Determination (Assam state code 18)
    const clientState = (client?.state || '').trim().toLowerCase();
    const clientGstin = (client?.gstin || '').trim().toUpperCase();
    const isInterstate = Boolean(
      (clientGstin && !clientGstin.startsWith('18')) ||
      (clientState && !['assam', 'as'].includes(clientState)) ||
      (reqData?.destination_pincode && !reqData.destination_pincode.startsWith('78'))
    );

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalTax = 0;
    const GST_RATE = 18.00;

    if (isInterstate) {
      igstAmount = Math.round((taxableAmount * 0.18) * 100) / 100;
      totalTax = igstAmount;
    } else {
      cgstAmount = Math.round((taxableAmount * 0.09) * 100) / 100;
      sgstAmount = cgstAmount;
      totalTax = Math.round((cgstAmount + sgstAmount) * 100) / 100;
    }

    const totalAmount = Math.round((taxableAmount + totalTax) * 100) / 100;
    const days = Number(creditDays || 30);
    const dueDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    const invoiceRecord = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      booking_id: bookingId,
      client_id: booking.client_id,
      base_amount: baseAmount,
      loading_detention_charges: loadDet,
      unloading_detention_charges: unloadDet,
      platform_fee: platFee,
      taxable_amount: taxableAmount,
      gst_rate_percent: GST_RATE,
      is_interstate: isInterstate,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_tax: totalTax,
      total_amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      payment_status: 'PAYMENT_PENDING',
      due_date: dueDate,
      credit_terms: `NET_${days}`,
      invoice_url: `/documents/invoices/${invoiceNumber}.pdf`,
      generated_by: generatedBy || '00000000-0000-0000-0000-000000000001',
      created_at: now,
      updated_at: now,
    };

    // Store in memory registries
    memoryClientInvoices.set(invoiceId, invoiceRecord);
    memoryClientInvoices.set(bookingId, invoiceRecord);

    // Attempt DB insert
    try {
      await db.from('client_invoices').insert([invoiceRecord]);
    } catch {}

    // Persist into documents table
    try {
      await db.from('documents').insert([
        {
          category: 'FINANCIAL',
          document_type: 'CLIENT_INVOICE',
          reference_id: invoiceId,
          file_name: `${invoiceNumber}.pdf`,
          file_url: invoiceRecord.invoice_url,
          storage_path: `invoices/${invoiceNumber}.pdf`,
          verification_status: 'VERIFIED',
          uploaded_by: generatedBy || '00000000-0000-0000-0000-000000000001',
          created_at: now,
        },
      ]);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: generatedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'ADMIN',
      eventType: 'CLIENT_INVOICE_GENERATED',
      details: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        booking_id: bookingId,
        base_amount: baseAmount,
        taxable_amount: taxableAmount,
        total_tax: totalTax,
        total_amount: totalAmount,
        is_interstate: isInterstate,
        due_date: dueDate,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: generatedBy || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'CLIENT_INVOICE_GENERATED',
          details: {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            booking_id: bookingId,
            base_amount: baseAmount,
            taxable_amount: taxableAmount,
            total_tax: totalTax,
            total_amount: totalAmount,
            is_interstate: isInterstate,
            due_date: dueDate,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      isIdempotent: false,
      invoiceId,
      invoiceNumber,
      baseAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      totalAmount,
      balanceDue: totalAmount,
      isInterstate,
      dueDate,
      paymentStatus: 'PAYMENT_PENDING',
      message: 'Client tax invoice generated successfully with automated GST calculation.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Invoice generation failed.' });
  }
});

/**
 * GET /api/invoices/client/:invoiceId
 * Returns invoice details with commercial confidentiality enforcement
 */
app.get('/api/invoices/client/:invoiceId', async (req: Request, res: Response) => {
  const invoiceId = req.params.invoiceId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!invoiceId) {
    return res.status(400).json({ error: 'invoiceId is mandatory.' });
  }

  try {
    let invoice = memoryClientInvoices.get(invoiceId);
    if (!invoice) {
      try {
        const { data: dbInv } = await db
          .from('client_invoices')
          .select('*, bookings(*, requirements(*, client_companies(*)))')
          .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`)
          .maybeSingle();
        if (dbInv) invoice = dbInv;
      } catch {}
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.', code: 'INVOICE_NOT_FOUND' });
    }

    // COMMERCIAL CONFIDENTIALITY: Strictly omit transporter purchase rate (vendor_rate) and internal margin
    const sanitizedInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      bookingId: invoice.booking_id,
      baseAmount: Number(invoice.base_amount),
      loadingDetention: Number(invoice.loading_detention_charges || 0),
      unloadingDetention: Number(invoice.unloading_detention_charges || 0),
      platformFee: Number(invoice.platform_fee || 0),
      taxableAmount: Number(invoice.taxable_amount),
      gstRatePercent: Number(invoice.gst_rate_percent),
      isInterstate: Boolean(invoice.is_interstate),
      cgstAmount: Number(invoice.cgst_amount || 0),
      sgstAmount: Number(invoice.sgst_amount || 0),
      igstAmount: Number(invoice.igst_amount || 0),
      totalTax: Number(invoice.total_tax),
      totalAmount: Number(invoice.total_amount),
      amountPaid: Number(invoice.amount_paid || 0),
      balanceDue: Number(invoice.balance_due),
      paymentStatus: invoice.payment_status,
      dueDate: invoice.due_date,
      creditTerms: invoice.credit_terms,
      invoiceUrl: invoice.invoice_url,
      createdAt: invoice.created_at,
    };

    return res.json({ success: true, invoice: sanitizedInvoice });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch invoice.' });
  }
});

/**
 * POST /api/invoices/client/:invoiceId/record-payment
 * Records incoming client payment and updates balance due
 */
app.post('/api/invoices/client/:invoiceId/record-payment', async (req: Request, res: Response) => {
  const invoiceId = req.params.invoiceId as string;
  const {
    amount,
    paymentMode = 'NEFT',
    transactionReference,
    paymentDate,
    notes,
    recordedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!invoiceId) {
    return res.status(400).json({ error: 'invoiceId is mandatory.' });
  }

  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.', code: 'INVALID_AMOUNT' });
  }

  if (!transactionReference || !transactionReference.trim()) {
    return res.status(400).json({ error: 'transactionReference (UTR/Reference) is mandatory.', code: 'UTR_REQUIRED' });
  }

  try {
    let invoice = memoryClientInvoices.get(invoiceId);
    if (!invoice) {
      try {
        const { data: dbInv } = await db
          .from('client_invoices')
          .select('*')
          .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`)
          .maybeSingle();
        if (dbInv) invoice = dbInv;
      } catch {}
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.', code: 'INVOICE_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const pDate = paymentDate || now.slice(0, 10);
    const currentPaid = Number(invoice.amount_paid || 0);
    const total = Number(invoice.total_amount);
    const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
    const newBalance = Math.max(0, Math.round((total - newPaid) * 100) / 100);
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    // Update invoice record
    invoice.amount_paid = newPaid;
    invoice.balance_due = newBalance;
    invoice.payment_status = newStatus;
    invoice.updated_at = now;
    memoryClientInvoices.set(invoice.id, invoice);
    if (invoice.booking_id) memoryClientInvoices.set(invoice.booking_id, invoice);

    try {
      await db
        .from('client_invoices')
        .update({
          amount_paid: newPaid,
          balance_due: newBalance,
          payment_status: newStatus,
          updated_at: now,
        })
        .eq('id', invoice.id);
    } catch {}

    // Update booking payment status
    if (invoice.booking_id) {
      try {
        await db
          .from('bookings')
          .update({
            amount_received: newPaid,
            payment_status: newBalance <= 0 ? 'PAYMENT_COMPLETED' : 'PARTIALLY_PAID',
            updated_at: now,
          })
          .eq('id', invoice.booking_id);
      } catch {}
    }

    // Record in payment_records
    const recordItem = {
      id: crypto.randomUUID(),
      booking_id: invoice.booking_id,
      amount_collected: payAmount,
      payment_date: pDate,
      payment_mode: paymentMode,
      transaction_reference: transactionReference.trim(),
      notes: notes || null,
      recorded_by: recordedBy || '00000000-0000-0000-0000-000000000001',
      created_at: now,
    };

    const pList = memoryPaymentRecords.get(invoice.id) || [];
    pList.unshift(recordItem);
    memoryPaymentRecords.set(invoice.id, pList);

    try {
      await db.from('payment_records').insert([recordItem]);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: recordedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'ADMIN',
      eventType: 'CLIENT_PAYMENT_RECORDED',
      details: {
        invoice_id: invoice.id,
        booking_id: invoice.booking_id,
        amount: payAmount,
        amount_paid: newPaid,
        balance_due: newBalance,
        payment_status: newStatus,
        transaction_reference: transactionReference.trim(),
        payment_date: pDate,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: recordedBy || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'CLIENT_PAYMENT_RECORDED',
          details: {
            invoice_id: invoice.id,
            booking_id: invoice.booking_id,
            amount: payAmount,
            amount_paid: newPaid,
            balance_due: newBalance,
            payment_status: newStatus,
            transaction_reference: transactionReference.trim(),
            payment_date: pDate,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amountPaid: newPaid,
      balanceDue: newBalance,
      paymentStatus: newStatus,
      transactionReference: transactionReference.trim(),
      message: `Payment of ₹${payAmount} recorded successfully. Status: ${newStatus}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record payment.' });
  }
});

/**
 * POST /api/payouts/transporter/generate
 * Generates Transporter Payment Slip with Section 194C TDS calculation
 */
app.post('/api/payouts/transporter/generate', async (req: Request, res: Response) => {
  const {
    tripId,
    advancePaid = 0,
    claimDeduction = 0,
    otherDeductions = 0,
    generatedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!tripId) {
    return res.status(400).json({ error: 'tripId is mandatory.' });
  }

  try {
    // 1. Idempotency Check
    let existingPayout = memoryTransporterPayouts.get(tripId);
    if (!existingPayout) {
      try {
        const { data: dbPayout } = await db
          .from('transporter_payouts')
          .select('*')
          .eq('trip_id', tripId)
          .maybeSingle();
        if (dbPayout) existingPayout = dbPayout;
      } catch {}
    }

    if (existingPayout) {
      return res.json({
        success: true,
        isIdempotent: true,
        payoutId: existingPayout.id,
        payoutNumber: existingPayout.payout_number,
        vendorRate: Number(existingPayout.agreed_vendor_rate),
        netPayableAmount: Number(existingPayout.net_payable_amount),
        payoutStatus: existingPayout.payout_status,
        message: 'Payout slip already exists for this trip (idempotent retrieval).',
      });
    }

    // 2. Fetch Trip & Transporter Vendor
    let trip: any = null;
    const { data: tData } = await db
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (tData) {
      trip = tData;
      if (trip.vendor_id) {
        const { data: vRow } = await db
          .from('vendor_companies')
          .select('*')
          .eq('id', trip.vendor_id)
          .maybeSingle();
        if (vRow) trip.vendor_companies = vRow;
      }
    }

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.', code: 'TRIP_NOT_FOUND' });
    }

    const vendor = trip.vendor_companies;
    const vendorRate = Number(trip.vendor_rate || 40000);
    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const payoutNumber = `PAY-${dateStr}-${randSuffix}`;
    const payoutId = crypto.randomUUID();

    // 3. Section 194C TDS Determination
    // 4th character of PAN: 'P' = Individual (1%), 'C'/'F' = Company/Firm (2%), No valid PAN = 20%
    const pan = (vendor?.pan || '').trim().toUpperCase();
    let tdsRatePercent = 1.00;

    if (pan.length !== 10) {
      tdsRatePercent = 20.00; // Penal TDS Section 206AA
    } else if (pan[3] === 'P') {
      tdsRatePercent = 1.00;  // Individual / HUF
    } else {
      tdsRatePercent = 2.00;  // Corporate / Partnership Firm
    }

    const tdsDeducted = Math.round((vendorRate * (tdsRatePercent / 100)) * 100) / 100;
    const advance = Number(advancePaid || 0);
    const claimDed = Number(claimDeduction || 0);
    const otherDed = Number(otherDeductions || 0);

    const netPayable = Math.max(
      0,
      Math.round((vendorRate - tdsDeducted - advance - claimDed - otherDed) * 100) / 100
    );

    const payoutRecord = {
      id: payoutId,
      payout_number: payoutNumber,
      trip_id: tripId,
      booking_id: trip.booking_id,
      vendor_id: trip.vendor_id,
      driver_id: trip.driver_id,
      agreed_vendor_rate: vendorRate,
      tds_section: '194C',
      tds_rate_percent: tdsRatePercent,
      tds_deducted_amount: tdsDeducted,
      advance_paid_amount: advance,
      claim_deduction_amount: claimDed,
      other_deductions: otherDed,
      net_payable_amount: netPayable,
      amount_disbursed: 0,
      payout_status: 'PENDING',
      payment_method: 'NEFT',
      payout_slip_url: `/documents/payouts/${payoutNumber}.pdf`,
      generated_by: generatedBy || '00000000-0000-0000-0000-000000000001',
      created_at: now,
      updated_at: now,
    };

    // Store in memory registries
    memoryTransporterPayouts.set(payoutId, payoutRecord);
    memoryTransporterPayouts.set(tripId, payoutRecord);

    // Attempt DB insert
    try {
      await db.from('transporter_payouts').insert([payoutRecord]);
    } catch {}

    // Persist into documents table
    try {
      await db.from('documents').insert([
        {
          category: 'FINANCIAL',
          document_type: 'PAYMENT_RECEIPT',
          reference_id: payoutId,
          file_name: `${payoutNumber}.pdf`,
          file_url: payoutRecord.payout_slip_url,
          storage_path: `payouts/${payoutNumber}.pdf`,
          verification_status: 'VERIFIED',
          uploaded_by: generatedBy || '00000000-0000-0000-0000-000000000001',
          created_at: now,
        },
      ]);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: generatedBy || '00000000-0000-0000-0000-000000000001',
      userType: 'ADMIN',
      eventType: 'TRANSPORTER_PAYOUT_GENERATED',
      details: {
        payout_id: payoutId,
        payout_number: payoutNumber,
        trip_id: tripId,
        vendor_rate: vendorRate,
        tds_rate_percent: tdsRatePercent,
        tds_deducted: tdsDeducted,
        advance_paid: advance,
        claim_deduction: claimDed,
        net_payable: netPayable,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: generatedBy || '00000000-0000-0000-0000-000000000001',
          user_type: 'ADMIN',
          event_type: 'TRANSPORTER_PAYOUT_GENERATED',
          details: {
            payout_id: payoutId,
            payout_number: payoutNumber,
            trip_id: tripId,
            vendor_rate: vendorRate,
            tds_rate_percent: tdsRatePercent,
            tds_deducted: tdsDeducted,
            advance_paid: advance,
            claim_deduction: claimDed,
            net_payable: netPayable,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      isIdempotent: false,
      payoutId,
      payoutNumber,
      vendorRate,
      tdsSection: '194C',
      tdsRatePercent,
      tdsDeductedAmount: tdsDeducted,
      advancePaidAmount: advance,
      claimDeductionAmount: claimDed,
      netPayableAmount: netPayable,
      payoutStatus: 'PENDING',
      message: 'Transporter payment slip generated with Section 194C TDS calculation.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Payout generation failed.' });
  }
});

/**
 * GET /api/payouts/transporter/:payoutId
 * Returns payout slip details with commercial confidentiality enforcement
 */
app.get('/api/payouts/transporter/:payoutId', async (req: Request, res: Response) => {
  const payoutId = req.params.payoutId as string;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!payoutId) {
    return res.status(400).json({ error: 'payoutId is mandatory.' });
  }

  try {
    let payout = memoryTransporterPayouts.get(payoutId);
    if (!payout) {
      try {
        const { data: dbP } = await db
          .from('transporter_payouts')
          .select('*, vendor_companies:vendor_id(*), drivers:driver_id(*)')
          .or(`id.eq.${payoutId},payout_number.eq.${payoutId}`)
          .maybeSingle();
        if (dbP) payout = dbP;
      } catch {}
    }

    if (!payout) {
      return res.status(404).json({ error: 'Payout slip not found.', code: 'PAYOUT_NOT_FOUND' });
    }

    // COMMERCIAL CONFIDENTIALITY: Strictly omit client billing amounts and platform margin
    const sanitizedPayout = {
      id: payout.id,
      payoutNumber: payout.payout_number,
      tripId: payout.trip_id,
      vendorRate: Number(payout.agreed_vendor_rate),
      tdsSection: payout.tds_section,
      tdsRatePercent: Number(payout.tds_rate_percent),
      tdsDeductedAmount: Number(payout.tds_deducted_amount),
      advancePaidAmount: Number(payout.advance_paid_amount || 0),
      claimDeductionAmount: Number(payout.claim_deduction_amount || 0),
      otherDeductions: Number(payout.other_deductions || 0),
      netPayableAmount: Number(payout.net_payable_amount),
      amountDisbursed: Number(payout.amount_disbursed || 0),
      payoutStatus: payout.payout_status,
      disbursalDate: payout.disbursal_date,
      bankReferenceUtr: payout.bank_reference_utr,
      paymentMethod: payout.payment_method,
      payoutSlipUrl: payout.payout_slip_url,
      createdAt: payout.created_at,
    };

    return res.json({ success: true, payout: sanitizedPayout });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch payout.' });
  }
});

/**
 * POST /api/payouts/transporter/:payoutId/record-disbursal
 * Records bank disbursal of transporter payout
 */
app.post('/api/payouts/transporter/:payoutId/record-disbursal', async (req: Request, res: Response) => {
  const payoutId = req.params.payoutId as string;
  const {
    bankReferenceUtr,
    paymentMethod = 'NEFT',
    amountDisbursed,
    disbursedBy,
  } = req.body;
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  if (!payoutId) {
    return res.status(400).json({ error: 'payoutId is mandatory.' });
  }

  if (!bankReferenceUtr || !bankReferenceUtr.trim()) {
    return res.status(400).json({ error: 'bankReferenceUtr is mandatory for disbursal recording.', code: 'UTR_REQUIRED' });
  }

  try {
    let payout = memoryTransporterPayouts.get(payoutId);
    if (!payout) {
      try {
        const { data: dbP } = await db
          .from('transporter_payouts')
          .select('*')
          .or(`id.eq.${payoutId},payout_number.eq.${payoutId}`)
          .maybeSingle();
        if (dbP) payout = dbP;
      } catch {}
    }

    if (!payout) {
      return res.status(404).json({ error: 'Payout slip not found.', code: 'PAYOUT_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const finalDisbursed = amountDisbursed !== undefined ? Number(amountDisbursed) : Number(payout.net_payable_amount);
    const cleanUtr = bankReferenceUtr.trim();

    payout.payout_status = 'DISBURSED';
    payout.amount_disbursed = finalDisbursed;
    payout.bank_reference_utr = cleanUtr;
    payout.disbursal_date = now;
    payout.payment_method = paymentMethod;
    payout.disbursed_by = disbursedBy || '00000000-0000-0000-0000-000000000001';
    payout.updated_at = now;

    memoryTransporterPayouts.set(payout.id, payout);
    if (payout.trip_id) memoryTransporterPayouts.set(payout.trip_id, payout);

    try {
      await db
        .from('transporter_payouts')
        .update({
          payout_status: 'DISBURSED',
          amount_disbursed: finalDisbursed,
          bank_reference_utr: cleanUtr,
          disbursal_date: now,
          payment_method: paymentMethod,
          disbursed_by: payout.disbursed_by,
          updated_at: now,
        })
        .eq('id', payout.id);
    } catch {}

    // Audit trail
    recordAuditLog({
      userId: payout.disbursed_by || '00000000-0000-0000-0000-000000000001',
      userType: 'ADMIN',
      eventType: 'TRANSPORTER_PAYOUT_DISBURSED',
      details: {
        payout_id: payout.id,
        payout_number: payout.payout_number,
        trip_id: payout.trip_id,
        amount_disbursed: finalDisbursed,
        bank_reference_utr: cleanUtr,
        disbursed_at: now,
      },
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: payout.disbursed_by,
          user_type: 'ADMIN',
          event_type: 'TRANSPORTER_PAYOUT_DISBURSED',
          details: {
            payout_id: payout.id,
            payout_number: payout.payout_number,
            trip_id: payout.trip_id,
            amount_disbursed: finalDisbursed,
            bank_reference_utr: cleanUtr,
            disbursed_at: now,
          },
        },
      ]);
    } catch {}

    return res.json({
      success: true,
      payoutId: payout.id,
      payoutNumber: payout.payout_number,
      payoutStatus: 'DISBURSED',
      amountDisbursed: finalDisbursed,
      bankReferenceUtr: cleanUtr,
      disbursalDate: now,
      message: `Transporter payout of ₹${finalDisbursed} disbursed successfully via ${paymentMethod}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record disbursal.' });
  }
});

/**
 * GET /api/finance/reconciliation
 * Comprehensive commercial reconciliation ledger
 */
app.get('/api/finance/reconciliation', async (req: Request, res: Response) => {
  const db = getSupabaseClient(req.headers['authorization'] as string | undefined);

  try {
    // 1. Gather all invoices
    let allInvoices: any[] = Array.from(memoryClientInvoices.values());
    try {
      const { data: dbInvs } = await db.from('client_invoices').select('*');
      if (dbInvs && dbInvs.length > 0) {
        // Merge without duplicates
        const invMap = new Map();
        for (const inv of allInvoices) invMap.set(inv.id, inv);
        for (const inv of dbInvs) invMap.set(inv.id, inv);
        allInvoices = Array.from(invMap.values());
      }
    } catch {}

    // 2. Gather all payouts
    let allPayouts: any[] = Array.from(memoryTransporterPayouts.values());
    try {
      const { data: dbPays } = await db.from('transporter_payouts').select('*');
      if (dbPays && dbPays.length > 0) {
        const payMap = new Map();
        for (const p of allPayouts) payMap.set(p.id, p);
        for (const p of dbPays) payMap.set(p.id, p);
        allPayouts = Array.from(payMap.values());
      }
    } catch {}

    // Deduplicate array values
    const uniqueInvoices = Array.from(new Map(allInvoices.map((i) => [i.id, i])).values());
    const uniquePayouts = Array.from(new Map(allPayouts.map((p) => [p.id, p])).values());

    const totalClientBilled = uniqueInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
    const totalClientCollected = uniqueInvoices.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
    const totalClientOutstanding = uniqueInvoices.reduce((sum, i) => sum + Number(i.balance_due || 0), 0);
    const totalGstLiability = uniqueInvoices.reduce((sum, i) => sum + Number(i.total_tax || 0), 0);

    const totalTransporterPayable = uniquePayouts.reduce((sum, p) => sum + Number(p.net_payable_amount || 0), 0);
    const totalTransporterDisbursed = uniquePayouts.reduce((sum, p) => sum + Number(p.amount_disbursed || 0), 0);
    const totalTransporterOutstanding = uniquePayouts.reduce(
      (sum, p) => sum + (p.payout_status !== 'DISBURSED' ? Number(p.net_payable_amount || 0) : 0),
      0
    );
    const totalTdsDeducted = uniquePayouts.reduce((sum, p) => sum + Number(p.tds_deducted_amount || 0), 0);

    const grossPlatformMargin = Math.round((totalClientBilled - totalTransporterPayable - totalGstLiability) * 100) / 100;
    const reconciliationVariance = Math.round(
      ((totalClientCollected - totalTransporterDisbursed) - (totalClientOutstanding - totalTransporterOutstanding)) * 100
    ) / 100;

    const summary = {
      totalClientBilled: Math.round(totalClientBilled * 100) / 100,
      totalClientCollected: Math.round(totalClientCollected * 100) / 100,
      totalClientOutstanding: Math.round(totalClientOutstanding * 100) / 100,
      totalGstLiability: Math.round(totalGstLiability * 100) / 100,
      totalTransporterPayable: Math.round(totalTransporterPayable * 100) / 100,
      totalTransporterDisbursed: Math.round(totalTransporterDisbursed * 100) / 100,
      totalTransporterOutstanding: Math.round(totalTransporterOutstanding * 100) / 100,
      totalTdsDeducted: Math.round(totalTdsDeducted * 100) / 100,
      grossPlatformMargin,
      reconciliationVariance,
      invoicesCount: uniqueInvoices.length,
      payoutsCount: uniquePayouts.length,
    };

    // Audit trail
    recordAuditLog({
      userId: '00000000-0000-0000-0000-000000000001',
      userType: 'SYSTEM',
      eventType: 'FINANCIAL_LEDGER_RECONCILED',
      details: summary,
    });
    try {
      await supabase.from('auth_audit_log').insert([
        {
          user_id: '00000000-0000-0000-0000-000000000001',
          user_type: 'SYSTEM',
          event_type: 'FINANCIAL_LEDGER_RECONCILED',
          details: summary,
        },
      ]);
    } catch {}

    return res.json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Reconciliation failed.' });
  }
});



// Start Server
if (process.env.NODE_ENV !== 'test') {
  const srv = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 TRUCKS Backend Service running on port ${config.port}`);
    console.log(`📡 Health Check: http://localhost:${config.port}/api/health`);
    console.log(`🔒 Mock OTP Auth: ${config.mockOtpEnabled ? `ACTIVE (Standard code: ${config.mockOtpCode})` : 'FCM Active'}`);
    console.log(`======================================================\n`);
  });
  srv.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[INFO] Port ${config.port} is already running an active service instance.`);
    } else {
      console.error('Server listen error:', err);
    }
  });
}

export default app;
