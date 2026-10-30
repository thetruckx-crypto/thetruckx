import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ToastContainer } from './components/common/ToastContainer';
import { setupForegroundNotificationListener } from './services/firebase';
import { BrandLogo } from './components/BrandLogo';
import { LoginScreen } from './components/LoginScreen';
import { TwoFactorScreen } from './components/TwoFactorScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { getVehicles } from './services/vehicleService';
import { HubNavigationHeader } from './components/common/HubNavigationHeader';

// Lazy-loaded route modules for fast initial page load and optimized chunking
const ClientDirectory = React.lazy(() => import('./components/clients/ClientDirectory').then(m => ({ default: m.ClientDirectory })));
const CreateClient = React.lazy(() => import('./components/clients/CreateClient').then(m => ({ default: m.CreateClient })));
const ClientProfile = React.lazy(() => import('./components/clients/ClientProfile').then(m => ({ default: m.ClientProfile })));
const VendorDirectory = React.lazy(() => import('./components/vendors/VendorDirectory').then(m => ({ default: m.VendorDirectory })));
const InviteVendor = React.lazy(() => import('./components/vendors/InviteVendor').then(m => ({ default: m.InviteVendor })));
const VendorProfile = React.lazy(() => import('./components/vendors/VendorProfile').then(m => ({ default: m.VendorProfile })));
const VendorVerificationRequests = React.lazy(() => import('./components/vendors/VendorVerificationRequests').then(m => ({ default: m.VendorVerificationRequests })));
const VendorDocumentApprovals = React.lazy(() => import('./components/vendors/VendorDocumentApprovals').then(m => ({ default: m.VendorDocumentApprovals })));
const SharedVehicleMasterDirectory = React.lazy(() => import('./components/fleet/SharedVehicleMasterDirectory').then(m => ({ default: m.SharedVehicleMasterDirectory })));
const VehicleVerificationScreen = React.lazy(() => import('./components/fleet/VehicleVerificationScreen').then(m => ({ default: m.VehicleVerificationScreen })));
const VehicleComplianceWorkspace = React.lazy(() => import('./components/fleet/VehicleComplianceWorkspace').then(m => ({ default: m.VehicleComplianceWorkspace })));
const VendorVehicleTieupApproval = React.lazy(() => import('./components/fleet/VendorVehicleTieupApproval').then(m => ({ default: m.VendorVehicleTieupApproval })));
const CreateSharedVehicle = React.lazy(() => import('./components/fleet/CreateSharedVehicle').then(m => ({ default: m.CreateSharedVehicle })));
const DriverVerificationQueue = React.lazy(() => import('./components/drivers/DriverVerificationQueue').then(m => ({ default: m.DriverVerificationQueue })));
const PricingModule = React.lazy(() => import('./components/pricing/PricingModule').then(m => ({ default: m.PricingModule })));
const RequirementsModule = React.lazy(() => import('./components/requirements/RequirementsModule').then(m => ({ default: m.RequirementsModule })));
const CreateRequirement = React.lazy(() => import('./components/requirements/CreateRequirement').then(m => ({ default: m.CreateRequirement })));
const QuotationsModule = React.lazy(() => import('./components/quotations/QuotationsModule').then(m => ({ default: m.QuotationsModule })));
const VendorQuotationsModule = React.lazy(() => import('./components/quotations/VendorQuotationsModule').then(m => ({ default: m.VendorQuotationsModule })));
const BookingsModule = React.lazy(() => import('./components/bookings/BookingsModule').then(m => ({ default: m.BookingsModule })));
const CreateBooking = React.lazy(() => import('./components/bookings/CreateBooking').then(m => ({ default: m.CreateBooking })));
const DocumentClearanceModule = React.lazy(() => import('./components/documents/DocumentClearanceModule').then(m => ({ default: m.DocumentClearanceModule })));
const TrackingModule = React.lazy(() => import('./components/tracking/TrackingModule').then(m => ({ default: m.TrackingModule })));
const TripDetailView = React.lazy(() => import('./components/tracking/TripDetailView').then(m => ({ default: m.TripDetailView })));
const WeighbridgeModule = React.lazy(() => import('./components/weighbridge/WeighbridgeModule').then(m => ({ default: m.WeighbridgeModule })));
const PODModule = React.lazy(() => import('./components/pod/PODModule').then(m => ({ default: m.PODModule })));
const PaymentsModule = React.lazy(() => import('./components/payments/PaymentsModule').then(m => ({ default: m.PaymentsModule })));
const PaymentHistoryView = React.lazy(() => import('./components/payments/PaymentHistoryView').then(m => ({ default: m.PaymentHistoryView })));
const ExceptionsModule = React.lazy(() => import('./components/exceptions/ExceptionsModule').then(m => ({ default: m.ExceptionsModule })));
const ExceptionDetailView = React.lazy(() => import('./components/exceptions/ExceptionDetailView').then(m => ({ default: m.ExceptionDetailView })));
const CommunicationsModule = React.lazy(() => import('./components/communications/CommunicationsModule').then(m => ({ default: m.CommunicationsModule })));
const ReportsModule = React.lazy(() => import('./components/reports/ReportsModule').then(m => ({ default: m.ReportsModule })));
const SettingsModule = React.lazy(() => import('./components/settings/SettingsModule').then(m => ({ default: m.SettingsModule })));
const AdminUserManagement = React.lazy(() => import('./components/superadmin/SuperAdminModules').then(m => ({ default: m.AdminUserManagement })));
const RBACManagement = React.lazy(() => import('./components/superadmin/SuperAdminModules').then(m => ({ default: m.RBACManagement })));
const CommercialAnalytics = React.lazy(() => import('./components/superadmin/SuperAdminModules').then(m => ({ default: m.CommercialAnalytics })));
const AuditLogs = React.lazy(() => import('./components/superadmin/SuperAdminModules').then(m => ({ default: m.AuditLogs })));
const SystemParameters = React.lazy(() => import('./components/superadmin/SuperAdminModules').then(m => ({ default: m.SystemParameters })));
import {
  Menu,
  Search,
  Bell,
  MessageSquare,
  Maximize2,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Users,
  Building2,
  Truck,
  UserCheck,
  FileSpreadsheet,
  Layers,
  Receipt,
  CalendarCheck,
  ShieldCheck,
  Compass,
  Scale,
  CheckSquare,
  IndianRupee,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
  Lock,
  X,
  Shield,
  Sliders,
  FileText,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { supabase } from './utils/supabase';

// ─── Full-Screen Auth Spinner ─────────────────────────────────────────────────
function AuthLoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#FFFFFF', gap: '1.25rem',
    }}>
      <BrandLogo theme="light" size="auth" />

      <div style={{
        width: 40, height: 40, border: '3px solid rgba(244,83,37,0.2)',
        borderTop: '3px solid #F45325', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'rgba(17,17,17,0.60)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
        Restoring session…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Protected Route Guard ────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authLoading, adminProfile } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthLoadingScreen />;
  if (!adminProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// ─── Module Permission Route Guard ───────────────────────────────────────────
function RequirePermission({
  module: mod,
  action = 'view',
  children,
}: {
  module: string;
  action?: string;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  if (!hasPermission(mod, action)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 2rem',
        textAlign: 'center',
        background: '#FFFFFF',
        borderRadius: '12px',
        margin: '2rem',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#EF4444',
          marginBottom: '1.5rem',
        }}>
          <Lock size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
          Access Restricted
        </h2>
        <p style={{ color: '#64748B', maxWidth: '480px', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          You do not have administrative authorization to access the <strong>{mod.toUpperCase()}</strong> module. Your permissions are strictly managed by the Super Administrator.
        </p>
        <button
          onClick={() => navigate('/admin/dashboard')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#F45325',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(244, 83, 37, 0.3)',
          }}
        >
          Return to Operations Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Super Admin Authority Guard ─────────────────────────────────────────────
function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { adminProfile } = useAuth();
  const navigate = useNavigate();

  if (adminProfile?.role !== 'SUPER_ADMIN') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 2rem',
        textAlign: 'center',
        background: '#FFFFFF',
        borderRadius: '12px',
        margin: '2rem',
        border: '1px solid #E2E8F0',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(244, 83, 37, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F45325',
          marginBottom: '1.5rem',
        }}>
          <Shield size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
          Super Administrator Authority Required
        </h2>
        <p style={{ color: '#64748B', maxWidth: '480px', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          This administrative domain is strictly restricted to Super Administrators. Regular Admin accounts cannot view or alter system roles, RBAC matrix, or administrative privileges.
        </p>
        <button
          onClick={() => navigate('/admin/dashboard')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { adminProfile, authLoading, loginAsAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';

  // If already authenticated, redirect away from login
  if (authLoading) return <AuthLoadingScreen />;
  if (adminProfile) return <Navigate to={from} replace />;

  const handleLoginSuccess = (user: { name: string; role: 'ADMIN' | 'SUPER_ADMIN'; email: string }) => {
    loginAsAdmin({
      id: user.email === 'admin.demo@necl.com' ? 'admin-demo' : 'admin-' + Date.now(),
      name: user.name,
      email: user.email,
      role: user.role,
      realRole: user.role,
      isActive: true,
      permissions: user.role === 'ADMIN' ? {
        clients: { enabled: true, actions: { view: true, create: true, edit: true } },
        vendors: { enabled: true, actions: { view: true, create: true } },
        fleet: { enabled: true, actions: { view: true, create: true } },
        drivers: { enabled: true, actions: { view: true, create: true } },
        quotations: { enabled: true, actions: { view: true, create: true } },
        bookings: { enabled: true, actions: { view: true, create: true } },
        tracking: { enabled: true, actions: { view: true } },
        documents: { enabled: true, actions: { view: true, verify: true } },
        weighbridge: { enabled: true, actions: { view: true, create: true } },
        pod: { enabled: true, actions: { view: true, verify: true, close: true } },
        payments: { enabled: true, actions: { view: true, create: true } },
        billing: { enabled: true, actions: { view: true } },
        exceptions: { enabled: true, actions: { view: true, create: true } },
        communications: { enabled: true, actions: { view: true, create: true } },
        reports: { enabled: true, actions: { view: true } },
        settings: { enabled: true, actions: { view: true } },
      } : undefined,
    });
    navigate(from, { replace: true });
  };

  const handleRequire2FA = (email: string) => {
    navigate('/login/2fa', { state: { email }, replace: false });
  };

  return (
    <div className="app-auth-wrapper">
      <LoginScreen onLoginSuccess={handleLoginSuccess} onRequire2FA={handleRequire2FA} />
    </div>
  );
}

// ─── 2FA Page ─────────────────────────────────────────────────────────────────
function TwoFactorPage() {
  const { loginAsAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as any)?.email ?? '';

  if (!email) return <Navigate to="/login" replace />;

  const handleVerifySuccess = (user: { name: string; role: 'SUPER_ADMIN'; email: string }) => {
    loginAsAdmin({
      id: user.email === 'superadmin.demo@necl.com' ? 'super-admin-demo' : 'super-admin-' + Date.now(),
      name: user.name,
      email: user.email,
      role: 'SUPER_ADMIN',
      realRole: 'SUPER_ADMIN',
      isActive: true,
    });
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="app-auth-wrapper">
      <TwoFactorScreen
        email={email}
        onVerifySuccess={handleVerifySuccess}
        onBackToLogin={() => navigate('/login', { replace: true })}
      />
    </div>
  );
}

// ─── Placeholder for unbuilt modules ─────────────────────────────────────────
function PlaceholderPage({ module: mod, onSearch }: { module: string; onSearch: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="submodule-placeholder-page">
      <div className="submodule-header-bar">
        <button className="btn-back-to-dashboard" onClick={() => navigate('/admin/dashboard')}>
          ← Back to Operations Dashboard
        </button>
        <div className="submodule-title">{mod.toUpperCase()} Operations Module</div>
      </div>
      <div className="submodule-card-body">
        <h3>Live Module: {mod}</h3>
        <p>Connected to backend services. Data created in Dashboard or Search is dynamically synced here.</p>
        <button className="btn-orange-action" onClick={onSearch}>
          Search in {mod} (Ctrl + K)
        </button>
      </div>
    </div>
  );
}

// ─── Client Profile Route ─────────────────────────────────────────────────────
function ClientProfileRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <ClientProfile clientId={id!} onBack={() => navigate('/admin/clients')} />;
}

// ─── Vendor Directory Route (reads ?tab= from URL) ────────────────────────────
function VendorDirectoryRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tab = (params.get('tab') ?? 'all') as 'all' | 'verified' | 'pending' | 'rejected' | 'inactive' | 'drafts';
  return (
    <VendorDirectory
      initialTab={tab}
      onNavigateToInvite={(draftId) => navigate(draftId ? `/admin/vendors/new?draftId=${draftId}` : '/admin/vendors/new')}
      onNavigateToProfile={(id) => navigate(`/admin/vendors/${id}`)}
    />
  );
}

// ─── Vendor Profile Route ─────────────────────────────────────────────────────
function VendorProfileRoute({ userRole, initialEdit = false }: { userRole: 'ADMIN' | 'SUPER_ADMIN'; initialEdit?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isEdit = initialEdit || searchParams.get('action') === 'edit' || searchParams.get('edit') === 'true';

  return (
    <VendorProfile
      vendorId={id!}
      onBack={() => navigate('/admin/vendors')}
      userRole={userRole}
      initialEdit={isEdit}
    />
  );
}

// ─── Vendor Verification Requests Route ────────────────────────────────────────
function VendorVerificationRequestsRoute() {
  const navigate = useNavigate();
  return (
    <VendorVerificationRequests
      onNavigateToDocumentApprovals={(vendorId) =>
        navigate(vendorId ? `/admin/vendors/document-approvals?vendorId=${vendorId}` : '/admin/vendors/document-approvals')
      }
      onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
    />
  );
}

// ─── Vendor Document Approvals Route ───────────────────────────────────────────
function VendorDocumentApprovalsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const vendorId = params.get('vendorId') || undefined;
  return (
    <VendorDocumentApprovals
      initialVendorId={vendorId}
      onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
    />
  );
}

// ─── Vehicle Verification & Compliance Route ─────────────────────────────────
function VehicleVerificationRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <VehicleComplianceWorkspace
        onNavigateToVehicleDirectory={() => navigate('/admin/fleet')}
        onNavigateToVerification={(vehId) => navigate(`/admin/fleet/verification/${vehId}`)}
        onNavigateToAddVehicle={() => navigate('/admin/fleet/new')}
      />
    );
  }

  return (
    <VehicleVerificationScreen
      vehicleId={id}
      onBack={() => navigate('/admin/fleet/compliance')}
      onNavigateToTieups={(_vehId) => navigate('/admin/fleet/tie-up-approval')}
    />
  );
}

// ─── Admin Shell (Sidebar + Topbar + Page Content) ────────────────────────────
function AdminShell() {
  const { adminProfile, signOut, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active nav key from URL path: /admin/<key>/...
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeNavKey = pathSegments[1] === 'superadmin' && pathSegments[2]
    ? `superadmin/${pathSegments[2]}`
    : (pathSegments[1] || 'dashboard');

  // Sidebar responsive & collapse state
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem('thetruckx_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);

  const toggleDesktopSidebar = () => {
    setDesktopCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('thetruckx_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < 1024;
      setIsSmallScreen(small);
      if (!small) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar on mobile after navigation
  useEffect(() => {
    if (isSmallScreen) setSidebarOpen(false);
  }, [location.pathname, isSmallScreen]);

  // Expandable/Collapsible navigation sections (A through H)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,
    client: false,
    vendor: false,
    operations: false,
    exceptions: false,
    reports: false,
    access: false,
    superadmin: false,
  });

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Automatically expand the section corresponding to the current URL route
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const mod = segments[1] || 'dashboard';
    const sub = segments[2] || '';
    const searchParams = new URLSearchParams(location.search);
    const queryTab = searchParams.get('tab');

    if (mod === 'dashboard') {
      setCollapsedSections(prev => ({ ...prev, overview: false }));
    } else if (['clients', 'requirements', 'pricing', 'bookings'].includes(mod) || (mod === 'payments' && queryTab !== 'vendor')) {
      setCollapsedSections(prev => ({ ...prev, client: false }));
    } else if (
      mod === 'vendors' ||
      mod === 'drivers' ||
      mod === 'fleet' ||
      mod === 'quotations' ||
      mod === 'vendor-quotations' ||
      (mod === 'payments' && queryTab === 'vendor')
    ) {
      setCollapsedSections(prev => ({ ...prev, vendor: false }));
    } else if (['documents', 'tracking', 'weighbridge', 'pod'].includes(mod)) {
      setCollapsedSections(prev => ({ ...prev, operations: false }));
    } else if (['exceptions', 'communications'].includes(mod)) {
      setCollapsedSections(prev => ({ ...prev, exceptions: false }));
    } else if (mod === 'reports' || (mod === 'superadmin' && sub === 'analytics')) {
      setCollapsedSections(prev => ({ ...prev, reports: false }));
    } else if (['settings'].includes(mod) || (mod === 'superadmin' && ['users', 'rbac', 'system-parameters'].includes(sub))) {
      setCollapsedSections(prev => ({ ...prev, access: false }));
    } else if (mod === 'superadmin' && ['audit-logs'].includes(sub)) {
      setCollapsedSections(prev => ({ ...prev, superadmin: false }));
    }
  }, [location.pathname, location.search]);

  // Modals/drawers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  // Supabase live check
  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.from('admin_users').select('id', { count: 'exact', head: true });
        setIsSupabaseReady(!error);
      } catch {
        setIsSupabaseReady(false);
      }
    })();
  }, []);

  // Dynamic badge counts for sidebar + topbar notification bell backed strictly by live database records
  const refreshBadges = useCallback(async () => {
    try {
      const [
        { count: reqCount },
        { count: quotCount },
        { count: bokCount },
        { count: docCount },
        { count: podCount },
        { count: payCount },
        { count: driverCount },
        { count: vendorCount },
        { count: clientCount },
        { count: exceptionCount },
        { count: chatCount },
      ] = await Promise.all([
        supabase.from('requirements').select('id', { count: 'exact', head: true }).in('status', ['UNDER_REVIEW', 'NEW_REQUIREMENT', 'PENDING']),
        supabase.from('vendor_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_status', 'PENDING_CONFIRMATION'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('verification_status', 'PENDING'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).in('document_type', ['POD', 'POD_LR']).eq('verification_status', 'PENDING'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).in('payment_status', ['PAYMENT_PENDING', 'PARTIALLY_PAID']),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).or('status.eq.PENDING,status.eq.PENDING_APPROVAL,verification_status.eq.PENDING'),
        supabase.from('vendor_companies').select('id', { count: 'exact', head: true }).or('status.eq.PENDING,status.eq.PENDING_APPROVAL'),
        supabase.from('client_companies').select('id', { count: 'exact', head: true }).or('status.eq.PENDING,status.eq.PENDING_APPROVAL'),
        supabase.from('exceptions').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_type', 'ADMIN'),
      ]);

      const counts: Record<string, number> = {
        requirements: reqCount || 0,
        quotations: quotCount || 0,
        bookings: bokCount || 0,
        documents: docCount || 0,
        pod: podCount || 0,
        payments: payCount || 0,
        drivers: driverCount || 0,
        vendors: vendorCount || 0,
        clients: clientCount || 0,
        exceptions: exceptionCount || 0,
        communications: chatCount || 0,
      };

      setNavBadges(counts);
      setUnreadChatCount(chatCount || 0);

      // Check localStorage read IDs for notifications
      let readIds = new Set<string>();
      try {
        const stored = localStorage.getItem('necl_read_notifications_v1');
        if (stored) readIds = new Set(JSON.parse(stored));
      } catch {}

      const totalPending =
        (counts.requirements || 0) +
        (counts.drivers || 0) +
        (counts.documents || 0) +
        (counts.vendors || 0) +
        (counts.clients || 0) +
        (counts.exceptions || 0);

      if (totalPending === 0) {
        setUnreadNotifCount(0);
      } else {
        const unread = Math.max(0, totalPending - Math.min(readIds.size, totalPending));
        setUnreadNotifCount(unread);
      }
    } catch {
      // In case of error or before session is ready, default to 0 to prevent displaying incorrect numbers
      setNavBadges({});
      setUnreadNotifCount(0);
      setUnreadChatCount(0);
    }
  }, []);

  useEffect(() => {
    refreshBadges();

    const onCustomRefresh = () => refreshBadges();
    window.addEventListener('necl:refresh-badges', onCustomRefresh);
    window.addEventListener('focus', onCustomRefresh);

    const interval = setInterval(refreshBadges, 25000);

    const channel = supabase
      .channel('admin_nav_badges_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_requests' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exceptions' }, () => refreshBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => refreshBadges())
      .subscribe();

    return () => {
      window.removeEventListener('necl:refresh-badges', onCustomRefresh);
      window.removeEventListener('focus', onCustomRefresh);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [refreshBadges]);

  useEffect(() => {
    refreshBadges();
  }, [location.pathname, refreshBadges]);

  // Firebase Cloud Messaging (FCM) Foreground Notification Listener
  const { info: showToastInfo } = useToast();
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    setupForegroundNotificationListener((payload) => {
      showToastInfo(payload.body, payload.title || 'Push Notification');
      refreshBadges();
    }).then((unsub) => {
      cleanupFn = unsub;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [showToastInfo, refreshBadges]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(p => !p);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotifOpen(false);
        setShowProfileDropdown(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    setShowProfileDropdown(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  const navTo = (path: string) => {
    navigate(path);
    if (isSmallScreen) setSidebarOpen(false);
  };

  const isNav = (key: string) => {
    const segments = location.pathname.split('/').filter(Boolean);
    const mod = segments[1] || 'dashboard';
    const sub = segments[2] || '';
    const searchParams = new URLSearchParams(location.search);
    const queryTab = searchParams.get('tab');

    switch (key) {
      case 'dashboard':
        return mod === 'dashboard';
      case 'clients':
        return mod === 'clients';
      case 'requirements':
        return mod === 'requirements';
      case 'client-quotations':
        return mod === 'pricing' || mod === 'client-quotations';
      case 'bookings':
        return mod === 'bookings';
      case 'client-payments':
        return mod === 'payments' && queryTab !== 'vendor';
      case 'vendors':
        return mod === 'vendors' && !sub;
      case 'vendor-verification':
        return mod === 'vendors' && sub === 'verification-requests';
      case 'sourcing-rfq':
        return (mod === 'quotations' && queryTab !== 'vendor-quotes') || mod === 'sourcing';
      case 'vendor-quotations':
        return mod === 'vendor-quotations' || (mod === 'quotations' && queryTab === 'vendor-quotes');
      case 'fleet':
        return mod === 'fleet' && sub !== 'tie-up-approval';
      case 'drivers':
        return mod === 'drivers';
      case 'fleet-assignment':
        return mod === 'fleet' && sub === 'tie-up-approval';
      case 'vendor-payments':
        return mod === 'payments' && queryTab === 'vendor';
      case 'documents':
        return mod === 'documents';
      case 'tracking':
        return mod === 'tracking';
      case 'weighbridge':
        return mod === 'weighbridge';
      case 'pod':
        return mod === 'pod';
      case 'exceptions':
        return mod === 'exceptions';
      case 'communications':
        return mod === 'communications';
      case 'notifications':
        return isNotifOpen;
      case 'reports':
        return mod === 'reports';
      case 'superadmin/analytics':
        return mod === 'superadmin' && sub === 'analytics';
      case 'superadmin/users':
        return mod === 'superadmin' && sub === 'users';
      case 'superadmin/rbac':
        return mod === 'superadmin' && sub === 'rbac';
      case 'settings':
        return mod === 'settings';
      case 'superadmin/system-parameters':
        return mod === 'superadmin' && sub === 'system-parameters';
      case 'superadmin/admin-users':
        return mod === 'superadmin' && sub === 'users';
      case 'superadmin/audit-logs':
        return mod === 'superadmin' && sub === 'audit-logs';
      default:
        return activeNavKey === key;
    }
  };

  const sidebarWidth = isSmallScreen ? 280 : (desktopCollapsed ? 84 : 280);
  const placeholderModules: string[] = [];

  const renderNavItem = (
    navKey: string,
    route: string,
    label: string,
    IconComponent: React.ComponentType<{ size?: string | number; className?: string }> | React.ComponentType<any>,
    badgeCount?: number
  ) => {
    const active = isNav(navKey);
    const handleClick = () => {
      if (navKey === 'notifications') {
        setIsNotifOpen(true);
      } else {
        navTo(route);
      }
    };

    return (
      <div
        key={navKey}
        className={`nav-item ${active ? 'active-orange' : ''}`}
        onClick={handleClick}
        title={desktopCollapsed && !isSmallScreen ? undefined : label}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <IconComponent size={18} />
        <span>{label}</span>
        {Boolean(badgeCount && badgeCount > 0) && (
          <span className="nav-badge-red">{badgeCount}</span>
        )}
        <ChevronRight size={14} className="nav-chevron" />
        {desktopCollapsed && !isSmallScreen && (
          <div className="nav-item-floating-tooltip">
            {label}
            {Boolean(badgeCount && badgeCount > 0) ? ` (${badgeCount})` : ''}
          </div>
        )}
      </div>
    );
  };

  const renderSectionHeader = (
    sectionKey: string,
    label: string,
    shortLetter: string
  ) => {
    if (desktopCollapsed && !isSmallScreen) {
      return (
        <div className="nav-collapsed-group-badge" title={`Group ${shortLetter}: ${label}`}>
          <span>{shortLetter}</span>
          <div className="nav-item-floating-tooltip">
            {label}
          </div>
        </div>
      );
    }
    return (
      <div
        className="nav-section-label clickable"
        onClick={() => toggleSection(sectionKey)}
        title={`Toggle ${label}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSection(sectionKey);
          }
        }}
        aria-expanded={!collapsedSections[sectionKey]}
      >
        <span>{label}</span>
        <ChevronDown
          size={13}
          className={`section-chevron ${collapsedSections[sectionKey] ? 'rotated' : ''}`}
        />
      </div>
    );
  };

  return (
    <div className="admin-shell">
      {/* Backdrop overlay when sidebar is open and covers content on mobile */}
      {sidebarOpen && isSmallScreen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.50)',
            zIndex: 199, backdropFilter: 'blur(3px)',
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`admin-sidebar ${desktopCollapsed && !isSmallScreen ? 'collapsed' : ''}`}
        style={{
          width: `${sidebarWidth}px`,
          left: isSmallScreen ? (sidebarOpen ? 0 : `-${sidebarWidth + 6}px`) : 0,
          transition: 'left 0.25s cubic-bezier(0.16,1,0.3,1), width 0.25s cubic-bezier(0.16,1,0.3,1)',
          zIndex: isSmallScreen ? 200 : 40,
          boxShadow: sidebarOpen && isSmallScreen ? '4px 0 32px rgba(23,43,77,0.25)' : 'none',
        }}
      >
        <div className="sidebar-header">
          <BrandLogo
            variant={desktopCollapsed && !isSmallScreen ? 'mark' : 'full'}
            theme="light"
            size={desktopCollapsed && !isSmallScreen ? 'sm' : 'sidebar'}
          />

          {isSmallScreen && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0.25rem' }}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {/* ══════════════════════════════════════════════════════════════════════════
              A. OVERVIEW
             ══════════════════════════════════════════════════════════════════════════ */}
          {hasPermission('dashboard', 'view') && (
            <div className="nav-section-group">
              {renderSectionHeader('overview', 'A. OVERVIEW', 'A')}
              {(!collapsedSections.overview || (desktopCollapsed && !isSmallScreen)) && (
                renderNavItem('dashboard', '/admin/dashboard', 'Dashboard', LayoutDashboard)
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              B. CLIENT MANAGEMENT
             ══════════════════════════════════════════════════════════════════════════ */}
          {(hasPermission('clients', 'view') ||
            hasPermission('requirements', 'view') ||
            hasPermission('pricing', 'view') ||
            hasPermission('bookings', 'view') ||
            hasPermission('payments', 'view')) && (
            <div className="nav-section-group">
              {renderSectionHeader('client', 'B. CLIENT MANAGEMENT', 'B')}
              {(!collapsedSections.client || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {hasPermission('clients', 'view') &&
                    renderNavItem('clients', '/admin/clients', 'Clients', Users, navBadges.clients)}
                  {hasPermission('requirements', 'view') &&
                    renderNavItem('requirements', '/admin/requirements', 'Client Requirements', FileSpreadsheet, navBadges.requirements)}
                  {(hasPermission('pricing', 'view') || hasPermission('quotations', 'view')) &&
                    renderNavItem('client-quotations', '/admin/pricing', 'Client Quotations', Receipt)}
                  {hasPermission('bookings', 'view') &&
                    renderNavItem('bookings', '/admin/bookings', 'Bookings', CalendarCheck, navBadges.bookings)}
                  {hasPermission('payments', 'view') &&
                    renderNavItem('client-payments', '/admin/payments?tab=client', 'Client Payments', IndianRupee, navBadges.payments)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              C. VENDOR MANAGEMENT
             ══════════════════════════════════════════════════════════════════════════ */}
          {(hasPermission('vendors', 'view') ||
            hasPermission('quotations', 'view') ||
            hasPermission('fleet', 'view') ||
            hasPermission('drivers', 'view') ||
            hasPermission('payments', 'view')) && (
            <div className="nav-section-group">
              {renderSectionHeader('vendor', 'C. VENDOR MANAGEMENT', 'C')}
              {(!collapsedSections.vendor || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {hasPermission('vendors', 'view') &&
                    renderNavItem('vendors', '/admin/vendors', 'Vendors', Building2, navBadges.vendors)}
                  {hasPermission('vendors', 'view') &&
                    renderNavItem('vendor-verification', '/admin/vendors/verification-requests', 'Vendor Verification', UserCheck, navBadges.vendors)}
                  {hasPermission('quotations', 'view') &&
                    renderNavItem('sourcing-rfq', '/admin/quotations?tab=rfq', 'Sourcing & RFQ', Layers, navBadges.quotations)}
                  {hasPermission('quotations', 'view') &&
                    renderNavItem('vendor-quotations', '/admin/vendor-quotations', 'Vendor Quotations', DollarSign)}
                  {hasPermission('fleet', 'view') &&
                    renderNavItem('fleet', '/admin/fleet', 'Fleet & Vehicles', Truck)}
                  {hasPermission('drivers', 'view') &&
                    renderNavItem('drivers', '/admin/drivers', 'Drivers', Users, navBadges.drivers)}
                  {hasPermission('fleet', 'view') &&
                    renderNavItem('fleet-assignment', '/admin/fleet/tie-up-approval', 'Vehicle & Driver Assignment', ShieldCheck)}
                  {hasPermission('payments', 'view') &&
                    renderNavItem('vendor-payments', '/admin/payments?tab=vendor', 'Vendor Payments & Settlements', IndianRupee)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              D. TRIP OPERATIONS
             ══════════════════════════════════════════════════════════════════════════ */}
          {(hasPermission('documents', 'view') ||
            hasPermission('tracking', 'view') ||
            hasPermission('weighbridge', 'view') ||
            hasPermission('pod', 'view')) && (
            <div className="nav-section-group">
              {renderSectionHeader('operations', 'D. TRIP OPERATIONS', 'D')}
              {(!collapsedSections.operations || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {hasPermission('documents', 'view') &&
                    renderNavItem('documents', '/admin/documents', 'Pre-Trip & Document Verification', ShieldCheck, navBadges.documents)}
                  {hasPermission('tracking', 'view') &&
                    renderNavItem('tracking', '/admin/tracking', 'Trip Tracking', Compass)}
                  {hasPermission('weighbridge', 'view') &&
                    renderNavItem('weighbridge', '/admin/weighbridge', 'Weighbridge & Freight Bills', Scale)}
                  {hasPermission('pod', 'view') &&
                    renderNavItem('pod', '/admin/pod', 'POD & Trip Closure', CheckSquare, navBadges.pod)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              E. EXCEPTIONS & COMMUNICATIONS
             ══════════════════════════════════════════════════════════════════════════ */}
          {(hasPermission('exceptions', 'view') || hasPermission('communications', 'view')) && (
            <div className="nav-section-group">
              {renderSectionHeader('exceptions', 'E. EXCEPTIONS & COMMUNICATIONS', 'E')}
              {(!collapsedSections.exceptions || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {hasPermission('exceptions', 'view') &&
                    renderNavItem('exceptions', '/admin/exceptions', 'Exceptions', AlertTriangle, navBadges.exceptions)}
                  {hasPermission('communications', 'view') &&
                    renderNavItem('communications', '/admin/communications', 'Communications', MessageSquare, unreadChatCount)}
                  {renderNavItem('notifications', '#notifications', 'Notifications', Bell, unreadNotifCount)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              F. REPORTS & ANALYTICS
             ══════════════════════════════════════════════════════════════════════════ */}
          {(hasPermission('reports', 'view') || adminProfile?.role === 'SUPER_ADMIN') && (
            <div className="nav-section-group">
              {renderSectionHeader('reports', 'F. REPORTS & ANALYTICS', 'F')}
              {(!collapsedSections.reports || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {hasPermission('reports', 'view') &&
                    renderNavItem('reports', '/admin/reports', 'Reports & Analytics', BarChart3)}
                  {(adminProfile?.role === 'SUPER_ADMIN' || hasPermission('reports', 'view')) &&
                    renderNavItem('superadmin/analytics', '/admin/superadmin/analytics', 'Commercial Analytics', TrendingUp)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              G. ACCESS & CONFIGURATION
             ══════════════════════════════════════════════════════════════════════════ */}
          {/* Section: Settings (Super Admin Only) */}
          {adminProfile?.role === 'SUPER_ADMIN' && (
            <div className="nav-section-group">
              {renderSectionHeader('access', 'G. ACCESS & CONFIGURATION', 'G')}
              {(!collapsedSections.access || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {renderNavItem('superadmin/users', '/admin/superadmin/users', 'Users & Permissions', Users)}
                  {renderNavItem('superadmin/rbac', '/admin/superadmin/rbac', 'RBAC Roles', Shield)}
                  {renderNavItem('settings', '/admin/settings', 'System Settings', Settings)}
                  {renderNavItem('superadmin/system-parameters', '/admin/superadmin/system-parameters', 'System Parameters', Sliders)}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════
              H. SUPER ADMIN
             ══════════════════════════════════════════════════════════════════════════ */}
          {adminProfile?.role === 'SUPER_ADMIN' && (
            <div className="nav-section-group">
              {renderSectionHeader('superadmin', 'H. SUPER ADMIN', 'H')}
              {(!collapsedSections.superadmin || (desktopCollapsed && !isSmallScreen)) && (
                <>
                  {renderNavItem('superadmin/admin-users', '/admin/superadmin/users', 'Admin Users', Users)}
                  {renderNavItem('superadmin/audit-logs', '/admin/superadmin/audit-logs', 'Audit Logs', FileText)}
                </>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <main
        className={`admin-main ${desktopCollapsed && !isSmallScreen ? 'collapsed' : ''}`}
        style={!isSmallScreen ? {
          marginLeft: sidebarOpen ? `${sidebarWidth}px` : '0',
          transition: 'margin-left 0.25s cubic-bezier(0.16,1,0.3,1)',
        } : { marginLeft: 0 }}
      >
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="topbar-menu-toggle"
              title={isSmallScreen ? "Toggle Navigation Sidebar" : (desktopCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar")}
              onClick={() => {
                if (isSmallScreen) {
                  setSidebarOpen(p => !p);
                } else {
                  toggleDesktopSidebar();
                }
              }}
              aria-label={isSmallScreen ? (sidebarOpen ? 'Close sidebar' : 'Open sidebar') : (desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            >
              <Menu size={20} />
            </button>
            <div className="topbar-search-box" onClick={() => setIsSearchOpen(true)}>
              <Search size={16} className="topbar-search-icon" />
              <span className="search-placeholder-text">Search clients, vendors, bookings, trucks, drivers...</span>
              <kbd className="topbar-search-kbd">Ctrl + K</kbd>
            </div>
            <button
              className="topbar-search-mobile-btn"
              title="Search"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search"
            >
              <Search size={17} />
            </button>
          </div>

          <div className="topbar-right">
            <button className="topbar-icon-btn" title="Notifications" onClick={() => setIsNotifOpen(true)}>
              <Bell size={19} />
              {unreadNotifCount > 0 && (
                <span className="badge-count-orange">{unreadNotifCount}</span>
              )}
            </button>

            <button className="topbar-icon-btn" title="Communications" onClick={() => navTo('/admin/communications')}>
              <MessageSquare size={19} />
              {unreadChatCount > 0 && (
                <span className="badge-count-orange">{unreadChatCount}</span>
              )}
            </button>

            <button
              className="topbar-icon-btn"
              title="Toggle Fullscreen"
              onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
                else document.exitFullscreen().catch(() => {});
              }}
            >
              <Maximize2 size={18} />
            </button>

            <div className="topbar-profile-container">
              <div className="topbar-user-pill" onClick={() => setShowProfileDropdown(p => !p)}>
                {adminProfile?.avatarUrl ? (
                  <img src={adminProfile.avatarUrl} alt={adminProfile.name} className="topbar-user-avatar" />
                ) : (
                  <div className="topbar-user-avatar">
                    {(adminProfile?.name ?? 'R').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="topbar-user-info">
                  <div className="user-name">{adminProfile?.name || 'Admin User'}</div>
                  <div className="user-role-title">{adminProfile?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</div>
                </div>
                <ChevronDown size={14} style={{ color: '#64748B', transform: showProfileDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
              </div>

              {showProfileDropdown && (
                <div className="profile-dropdown-card">
                  <div className="profile-dropdown-header">
                    <strong>{adminProfile?.name || 'Rahul'}</strong>
                    <span>{adminProfile?.email || 'admin@trucks.in'}</span>
                  </div>
                  <div className="dropdown-divider" />
                  <button className="dropdown-menu-link logout" onClick={handleLogout}>
                    <LogOut size={14} /><span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="dashboard-content-area">
          <HubNavigationHeader
            badges={{
              vendors: navBadges.vendors,
              requirements: navBadges.requirements,
              bookings: navBadges.bookings,
              drivers: navBadges.drivers,
              documents: navBadges.documents,
              pod: navBadges.pod,
              payments: navBadges.payments,
              exceptions: navBadges.exceptions,
              chats: unreadChatCount,
            }}
          />
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTop: '3px solid #F05A22', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', letterSpacing: '0.3px' }}>Loading module…</span>
            </div>
          }>
            <Routes>
              <Route path="dashboard" element={
                <RequirePermission module="dashboard">
                  <DashboardScreen
                    onOpenSearch={() => setIsSearchOpen(true)}
                    onOpenNotifications={() => setIsNotifOpen(true)}
                    onQuickAction={(action) => {
                      const map: Record<string, string> = {
                        requirement: '/admin/requirements/new',
                        booking: '/admin/bookings/new',
                        client: '/admin/clients/new',
                        vendor: '/admin/vendors/new',
                        fleet: '/admin/fleet',
                        driver: '/admin/drivers?action=create',
                        pricing: '/admin/pricing?action=create',
                        reports: '/admin/reports',
                      };
                      if (map[action]) navigate(map[action]);
                    }}
                    onNavigateSection={(section) => {
                      if (section.startsWith('/')) {
                        navigate(section);
                      } else {
                        navigate(`/admin/${section}`);
                      }
                    }}
                  />
                </RequirePermission>
              } />

              <Route path="clients" element={
                <RequirePermission module="clients">
                  <ClientDirectory
                    onNavigateToCreate={(draftId) => navigate(draftId ? `/admin/clients/new?draftId=${draftId}` : '/admin/clients/new')}
                    onNavigateToProfile={(id) => navigate(`/admin/clients/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="clients/new" element={
                <RequirePermission module="clients" action="create">
                  <CreateClient
                    onBack={() => navigate('/admin/clients')}
                    onCreated={(id) => navigate(`/admin/clients/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="clients/:id" element={
                <RequirePermission module="clients">
                  <ClientProfileRoute />
                </RequirePermission>
              } />

              <Route path="vendors" element={
                <RequirePermission module="vendors">
                  <VendorDirectoryRoute />
                </RequirePermission>
              } />
              <Route path="vendors/new" element={
                <RequirePermission module="vendors" action="create">
                  <InviteVendor
                    onBack={() => navigate('/admin/vendors')}
                    onInvited={(id) => navigate(`/admin/vendors/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="vendors/verification-requests" element={
                <RequirePermission module="vendors">
                  <VendorVerificationRequestsRoute />
                </RequirePermission>
              } />
              <Route path="vendors/document-approvals" element={
                <RequirePermission module="vendors">
                  <VendorDocumentApprovalsRoute />
                </RequirePermission>
              } />
              <Route path="vendors/:id" element={
                <RequirePermission module="vendors">
                  <VendorProfileRoute userRole={adminProfile?.role ?? 'ADMIN'} />
                </RequirePermission>
              } />
              <Route path="vendors/:id/edit" element={
                <RequirePermission module="vendors">
                  <VendorProfileRoute userRole={adminProfile?.role ?? 'ADMIN'} initialEdit={true} />
                </RequirePermission>
              } />

              {/* Fleet Routes */}
              <Route path="fleet" element={
                <RequirePermission module="fleet">
                  <SharedVehicleMasterDirectory
                    onNavigateToVerification={(id) => navigate(`/admin/fleet/verification/${id}`)}
                    onNavigateToAddVehicle={() => navigate('/admin/fleet/new')}
                    onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
                    onNavigateToDriverProfile={(_id) => navigate('/admin/drivers')}
                    onNavigateToCompliance={() => navigate('/admin/fleet/compliance')}
                  />
                </RequirePermission>
              } />
              <Route path="fleet/new" element={
                <RequirePermission module="fleet" action="create">
                  <CreateSharedVehicle
                    onBack={() => navigate('/admin/fleet')}
                    onCreated={(id) => navigate(`/admin/fleet/verification/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="fleet/verification" element={
                <RequirePermission module="fleet">
                  <VehicleVerificationRoute />
                </RequirePermission>
              } />
              <Route path="fleet/verification/:id" element={
                <RequirePermission module="fleet">
                  <VehicleVerificationRoute />
                </RequirePermission>
              } />
              <Route path="fleet/compliance" element={
                <RequirePermission module="fleet">
                  <VehicleVerificationRoute />
                </RequirePermission>
              } />
              <Route path="fleet/tie-up-approval" element={
                <RequirePermission module="fleet">
                  <VendorVehicleTieupApproval
                    onNavigateToVehicleDirectory={() => navigate('/admin/fleet')}
                    onNavigateToVehicleVerification={(id) => navigate(`/admin/fleet/verification/${id}`)}
                    onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
                  />
                </RequirePermission>
              } />

              {/* Driver Management Route */}
              <Route path="drivers" element={
                <RequirePermission module="drivers">
                  <DriverVerificationQueue
                    onAuditDriver={(_id) => {}}
                    onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
                    onNavigateToVehicleDirectory={() => navigate('/admin/fleet')}
                  />
                </RequirePermission>
              } />

              {/* Pricing & Quotes Module */}
              <Route path="pricing" element={
                <RequirePermission module="pricing">
                  <PricingModule onNavigateToRequirement={(id) => navigate(`/admin/requirements/${id}`)} />
                </RequirePermission>
              } />

              {/* Requirements Module */}
              <Route path="requirements" element={
                <RequirePermission module="requirements">
                  <RequirementsModule 
                    onNavigateToDetail={(id) => navigate(`/admin/requirements/${id}`)}
                    onNavigateToCreate={() => navigate(`/admin/requirements/new`)}
                  />
                </RequirePermission>
              } />
              <Route path="requirements/new" element={
                <RequirePermission module="requirements" action="create">
                  <CreateRequirement
                    onBack={() => navigate('/admin/requirements')}
                    onCreated={(id) => navigate(`/admin/requirements/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="requirements/:id" element={
                <RequirePermission module="requirements">
                  <RequirementsModule 
                    onNavigateToDetail={(id) => navigate(`/admin/requirements/${id}`)}
                    onNavigateToCreate={() => navigate(`/admin/requirements/new`)}
                  />
                </RequirePermission>
              } />

              {/* Quotations Module */}
              <Route path="quotations" element={
                <RequirePermission module="quotations">
                  <QuotationsModule 
                    onNavigateToComparison={(id) => navigate(`/admin/quotations/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="quotations/:id" element={
                <RequirePermission module="quotations">
                  <QuotationsModule 
                    onNavigateToComparison={(id) => navigate(`/admin/quotations/${id}`)}
                  />
                </RequirePermission>
              } />

              {/* Dedicated Vendor Quotations Module */}
              <Route path="vendor-quotations" element={
                <RequirePermission module="quotations">
                  <VendorQuotationsModule />
                </RequirePermission>
              } />

              {/* Sourcing & RFQ Alias */}
              <Route path="sourcing-rfq" element={
                <RequirePermission module="quotations">
                  <QuotationsModule 
                    onNavigateToComparison={(id) => navigate(`/admin/quotations/${id}`)}
                  />
                </RequirePermission>
              } />

              {/* Bookings Module */}
              <Route path="bookings" element={
                <RequirePermission module="bookings">
                  <BookingsModule 
                    onNavigateToDetail={(id) => navigate(`/admin/bookings/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="bookings/new" element={
                <RequirePermission module="bookings" action="create">
                  <CreateBooking
                    onBack={() => navigate('/admin/bookings')}
                    onCreated={(id) => navigate(`/admin/bookings/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="bookings/:id" element={
                <RequirePermission module="bookings">
                  <BookingsModule 
                    onNavigateToDetail={(id) => navigate(`/admin/bookings/${id}`)}
                  />
                </RequirePermission>
              } />

              {/* Documents Clearance Module */}
              <Route path="documents" element={
                <RequirePermission module="documents">
                  <DocumentClearanceModule 
                    onNavigateToTrip={(id) => navigate(`/admin/documents/${id}`)}
                  />
                </RequirePermission>
              } />
              <Route path="documents/:id" element={
                <RequirePermission module="documents">
                  <DocumentClearanceModule 
                    onNavigateToTrip={(id) => navigate(`/admin/documents/${id}`)}
                  />
                </RequirePermission>
              } />

              {/* Tracking Module */}
              <Route path="tracking" element={
                <RequirePermission module="tracking">
                  <TrackingModule onNavigateToTripDetail={(id) => navigate(`/admin/tracking/${id}`)} />
                </RequirePermission>
              } />
              <Route path="tracking/:tripId" element={
                <RequirePermission module="tracking">
                  <TripDetailView />
                </RequirePermission>
              } />

              {/* Weighbridge Module */}
              <Route path="weighbridge" element={
                <RequirePermission module="weighbridge">
                  <WeighbridgeModule />
                </RequirePermission>
              } />

              {/* POD Module */}
              <Route path="pod" element={
                <RequirePermission module="pod">
                  <PODModule />
                </RequirePermission>
              } />

              {/* Payments Module */}
              <Route path="payments" element={
                <RequirePermission module="payments">
                  <PaymentsModule />
                </RequirePermission>
              } />
              <Route path="payments/:bookingId/history" element={
                <RequirePermission module="payments">
                  <PaymentHistoryView />
                </RequirePermission>
              } />

              {/* Exceptions Module */}
              <Route path="exceptions" element={
                <RequirePermission module="exceptions">
                  <ExceptionsModule />
                </RequirePermission>
              } />
              <Route path="exceptions/:exceptionId" element={
                <RequirePermission module="exceptions">
                  <ExceptionDetailView />
                </RequirePermission>
              } />

              {/* Communications Module */}
              <Route path="communications" element={
                <RequirePermission module="communications">
                  <CommunicationsModule />
                </RequirePermission>
              } />

              {/* Reports Module */}
              <Route path="reports" element={
                <RequirePermission module="reports">
                  <ReportsModule />
                </RequirePermission>
              } />

              {/* Settings Module (Super Admin Only) */}
              <Route path="settings" element={
                <RequireSuperAdmin>
                  <SettingsModule />
                </RequireSuperAdmin>
              } />

              {/* Super Admin Routes */}
              <Route path="superadmin/users" element={<RequireSuperAdmin><AdminUserManagement /></RequireSuperAdmin>} />
              <Route path="superadmin/rbac" element={<RequireSuperAdmin><RBACManagement /></RequireSuperAdmin>} />
              <Route path="superadmin/analytics" element={<RequireSuperAdmin><CommercialAnalytics /></RequireSuperAdmin>} />
              <Route path="superadmin/audit-logs" element={<RequireSuperAdmin><AuditLogs /></RequireSuperAdmin>} />
              <Route path="superadmin/system-parameters" element={<RequireSuperAdmin><SystemParameters /></RequireSuperAdmin>} />

              {placeholderModules.map((mod) => (
                <Route key={mod} path={mod} element={
                  <PlaceholderPage module={mod} onSearch={() => setIsSearchOpen(true)} />
                } />
              ))}

              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAction={(action) => {
          setIsSearchOpen(false);
          const map: Record<string, string> = {
            'create_booking': '/admin/bookings', 'create-booking': '/admin/bookings',
            'add_client': '/admin/clients/new', 'add-client': '/admin/clients/new',
            'add_vendor': '/admin/vendors/new', 'add-vendor': '/admin/vendors/new',
            'add_vehicle': '/admin/fleet', 'add-vehicle': '/admin/fleet',
            'add_driver': '/admin/drivers', 'add-driver': '/admin/drivers',
          };
          if (map[action]) navigate(map[action]);
        }}
        onSelectEntity={(entity) => {
          setIsSearchOpen(false);
          if (entity.category === 'booking' || entity.category === 'vehicle') navigate('/admin/bookings');
          else if (entity.category === 'client') navigate(`/admin/clients/${entity.id.replace('cli-', '')}`);
          else if (entity.category === 'vendor') navigate(`/admin/vendors/${entity.id.replace('ven-', '')}`);
          else if (entity.category === 'driver') navigate('/admin/drivers');
          else if (entity.category === 'document') navigate('/admin/documents');
        }}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        unreadCount={unreadNotifCount}
        onUpdateUnreadCount={setUnreadNotifCount}
        onSelectNotification={(notif) => {
          setIsNotifOpen(false);
          const map: Record<string, string> = {
            requirement: '/admin/requirements',
            booking: '/admin/bookings', trip: '/admin/bookings',
            payment: '/admin/payments',
            chat: '/admin/communications',
            driver: '/admin/drivers',
            doc: '/admin/documents',
          };
          if (map[notif.category]) navigate(map[notif.category]);
        }}
      />
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ToastContainer />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/2fa" element={<TwoFactorPage />} />
            <Route
              path="/admin/*"
              element={
                <RequireAuth>
                  <AdminShell />
                </RequireAuth>
              }
            />
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

