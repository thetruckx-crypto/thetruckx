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
const VendorVehicleTieupApproval = React.lazy(() => import('./components/fleet/VendorVehicleTieupApproval').then(m => ({ default: m.VendorVehicleTieupApproval })));
const CreateSharedVehicle = React.lazy(() => import('./components/fleet/CreateSharedVehicle').then(m => ({ default: m.CreateSharedVehicle })));
const DriverVerificationQueue = React.lazy(() => import('./components/drivers/DriverVerificationQueue').then(m => ({ default: m.DriverVerificationQueue })));
const PricingModule = React.lazy(() => import('./components/pricing/PricingModule').then(m => ({ default: m.PricingModule })));
const RequirementsModule = React.lazy(() => import('./components/requirements/RequirementsModule').then(m => ({ default: m.RequirementsModule })));
const QuotationsModule = React.lazy(() => import('./components/quotations/QuotationsModule').then(m => ({ default: m.QuotationsModule })));
const BookingsModule = React.lazy(() => import('./components/bookings/BookingsModule').then(m => ({ default: m.BookingsModule })));
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
  RefreshCw,
  Lock,
  X,
  Shield,
  Sliders,
  FileText,
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

// ─── Vehicle Verification Route ───────────────────────────────────────────────
function VehicleVerificationRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState<string | null>(id || null);
  const [resolving, setResolving] = useState(!id);

  useEffect(() => {
    if (!id) {
      (async () => {
        try {
          const res = await getVehicles({}, { page: 1, pageSize: 1 });
          if (res.vehicles.length > 0) {
            setVehicleId(res.vehicles[0].id);
          } else {
            setVehicleId(null);
          }
        } catch {
          setVehicleId(null);
        } finally {
          setResolving(false);
        }
      })();
    } else {
      setVehicleId(id);
      setResolving(false);
    }
  }, [id]);

  if (resolving) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#F45325' }}>
        Loading vehicle verification record...
      </div>
    );
  }

  if (!vehicleId) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No vehicles currently registered in the database.</p>
        <button
          onClick={() => navigate('/admin/fleet')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#F45325',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Return to Fleet Directory
        </button>
      </div>
    );
  }

  return (
    <VehicleVerificationScreen
      vehicleId={vehicleId}
      onBack={() => navigate('/admin/fleet')}
      onNavigateToTieups={(_vehId) => navigate('/admin/fleet/tie-up-approval')}
    />
  );
}

// ─── Admin Shell (Sidebar + Topbar + Page Content) ────────────────────────────
function AdminShell() {
  const { adminProfile, signOut, switchRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active nav key from URL path: /admin/<key>/...
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeNavKey = pathSegments[1] === 'superadmin' && pathSegments[2]
    ? `superadmin/${pathSegments[2]}`
    : (pathSegments[1] || 'dashboard');

  // Sidebar responsive & collapse state
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);

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

  // Vendor sub-menu open state
  const [vendorSubOpen, setVendorSubOpen] = useState(activeNavKey === 'vendors');
  useEffect(() => {
    if (activeNavKey === 'vendors') setVendorSubOpen(true);
  }, [activeNavKey]);

  // Fleet sub-menu open state
  const [fleetSubOpen, setFleetSubOpen] = useState(activeNavKey === 'fleet');
  useEffect(() => {
    if (activeNavKey === 'fleet') setFleetSubOpen(true);
  }, [activeNavKey]);

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

  const isNav = (key: string) => activeNavKey === key;

  const operationsModules = [
    { key: 'requirements', label: 'Requirements', Icon: FileSpreadsheet },
    { key: 'quotations', label: 'Sourcing & RFQ', Icon: Layers },
    { key: 'pricing', label: 'Pricing & Quotes', Icon: Receipt },
    { key: 'bookings', label: 'Bookings', Icon: CalendarCheck },
    { key: 'documents', label: 'Pre-Trip & Docs', Icon: ShieldCheck },
    { key: 'tracking', label: 'Trip Tracking', Icon: Compass },
    { key: 'weighbridge', label: 'Weighbridge & Freight', Icon: Scale },
    { key: 'pod', label: 'POD & Closure', Icon: CheckSquare },
  ].filter(m => hasPermission(m.key, 'view'));

  const financeModules = [
    { key: 'payments', label: 'Client Payments', Icon: IndianRupee },
    { key: 'exceptions', label: 'Exceptions', Icon: AlertTriangle },
    { key: 'communications', label: 'Communications', Icon: MessageSquare },
  ].filter(m => hasPermission(m.key, 'view'));

  const superAdminModules = [
    { key: 'superadmin/users', label: 'Admin Users', path: '/admin/superadmin/users', Icon: Users },
    { key: 'superadmin/rbac', label: 'RBAC Roles', path: '/admin/superadmin/rbac', Icon: Shield },
    { key: 'superadmin/analytics', label: 'Commercial Analytics', path: '/admin/superadmin/analytics', Icon: BarChart3 },
    { key: 'superadmin/audit-logs', label: 'Audit Logs', path: '/admin/superadmin/audit-logs', Icon: FileText },
    { key: 'superadmin/system-parameters', label: 'System Parameters', path: '/admin/superadmin/system-parameters', Icon: Sliders },
  ];

  const sidebarWidth = isSmallScreen ? 264 : (desktopCollapsed ? 74 : 260);
  const placeholderModules: string[] = [];

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
          transition: 'left 0.3s cubic-bezier(0.16,1,0.3,1), width 0.3s cubic-bezier(0.16,1,0.3,1)',
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
          {/* Section: Overview */}
          {hasPermission('dashboard', 'view') && (
            <>
              <div className="nav-section-label">OVERVIEW</div>
              <div className={`nav-item ${isNav('dashboard') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/dashboard')} title="Dashboard">
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
                <ChevronRight size={14} className="nav-chevron" />
              </div>
            </>
          )}

          {/* Section: Partners */}
          {(hasPermission('clients', 'view') || hasPermission('vendors', 'view')) && (
            <div className="nav-section-label">PARTNERS</div>
          )}
          {hasPermission('clients', 'view') && (
            <div className={`nav-item ${isNav('clients') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/clients')} title="Clients">
              <Users size={18} />
              <span>Clients</span>
              {Boolean(navBadges.clients && navBadges.clients > 0) && (
                <span className="nav-badge-red">{navBadges.clients}</span>
              )}
              <ChevronRight size={14} className="nav-chevron" />
            </div>
          )}

          {/* Vendors */}
          {hasPermission('vendors', 'view') && (
            <>
              <div
                className={`nav-item ${isNav('vendors') ? 'active-orange' : ''}`}
                title="Vendors"
                onClick={() => {
                  if (isNav('vendors')) {
                    setVendorSubOpen(v => !v);
                  } else {
                    navTo('/admin/vendors');
                    setVendorSubOpen(true);
                  }
                }}
              >
                <Building2 size={18} />
                <span>Vendors</span>
                {Boolean(navBadges.vendors && navBadges.vendors > 0) && (
                  <span className="nav-badge-red">{navBadges.vendors}</span>
                )}
                <ChevronRight size={14} className={`nav-chevron ${isNav('vendors') && vendorSubOpen ? 'rotated' : ''}`} />
              </div>

              {/* Vendors sub-menu: retain only Vendor Directory */}
              {isNav('vendors') && vendorSubOpen && !desktopCollapsed && (
                <div className="sidebar-subnav-list">
                  <div
                    className={`subnav-item ${location.pathname === '/admin/vendors' && !location.search ? 'active-orange-text' : ''}`}
                    onClick={() => navTo('/admin/vendors')}
                  >
                    <span className="subnav-bullet">•</span><span>Vendor Directory</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: Fleet & Drivers */}
          {(hasPermission('fleet', 'view') || hasPermission('drivers', 'view')) && (
            <div className="nav-section-label">FLEET & DRIVERS</div>
          )}
          {hasPermission('fleet', 'view') && (
            <>
              <div
                className={`nav-item ${isNav('fleet') ? 'active-orange' : ''}`}
                title="Fleet & Vehicles"
                onClick={() => {
                  if (isNav('fleet')) {
                    setFleetSubOpen(v => !v);
                  } else {
                    navTo('/admin/fleet');
                    setFleetSubOpen(true);
                  }
                }}
              >
                <Truck size={18} />
                <span>Fleet & Vehicles</span>
                <ChevronRight size={14} className={`nav-chevron ${isNav('fleet') && fleetSubOpen ? 'rotated' : ''}`} />
              </div>

              {/* Fleet sub-menu */}
              {isNav('fleet') && fleetSubOpen && !desktopCollapsed && (
                <div className="sidebar-subnav-list">
                  {[
                    { path: '/admin/fleet', label: 'Vehicle Directory', match: location.pathname === '/admin/fleet' },
                  ].map(({ path, label, match }) => (
                    <div key={label} className={`subnav-item ${match ? 'active-orange-text' : ''}`} onClick={() => navTo(path)}>
                      <span className="subnav-bullet">•</span><span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Drivers */}
          {hasPermission('drivers', 'view') && (
            <div className={`nav-item ${isNav('drivers') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/drivers')} title="Drivers">
              <UserCheck size={18} />
              <span>Drivers</span>
              {Boolean(navBadges.drivers && navBadges.drivers > 0) && (
                <span className="nav-badge-red">{navBadges.drivers}</span>
              )}
              <ChevronRight size={14} className="nav-chevron" />
            </div>
          )}

          {/* Section: Operations */}
          {operationsModules.length > 0 && (
            <>
              <div className="nav-section-label">OPERATIONS</div>
              {operationsModules.map(({ key, label, Icon }) => {
                const count = navBadges[key] || 0;
                return (
                  <div key={key} className={`nav-item ${isNav(key) ? 'active-orange' : ''}`} onClick={() => navTo(`/admin/${key}`)} title={label}>
                    <Icon size={18} />
                    <span>{label}</span>
                    {count > 0 && (
                      <span className="nav-badge-red">{count}</span>
                    )}
                    <ChevronRight size={14} className="nav-chevron" />
                  </div>
                );
              })}
            </>
          )}

          {/* Section: Finance & Exceptions */}
          {financeModules.length > 0 && (
            <>
              <div className="sidebar-divider" />
              <div className="nav-section-label">FINANCE & EXCEPTIONS</div>
              {financeModules.map(({ key, label, Icon }) => {
                const count = navBadges[key] || 0;
                return (
                  <div key={key} className={`nav-item ${isNav(key) ? 'active-orange' : ''}`} onClick={() => navTo(`/admin/${key}`)} title={label}>
                    <Icon size={18} />
                    <span>{label}</span>
                    {count > 0 && (
                      <span className="nav-badge-red">{count}</span>
                    )}
                    <ChevronRight size={14} className="nav-chevron" />
                  </div>
                );
              })}
            </>
          )}

          {/* Section: Reports */}
          {hasPermission('reports', 'view') && (
            <>
              <div className="sidebar-divider" />
              <div className="nav-section-label">REPORTS</div>
              <div className={`nav-item ${isNav('reports') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/reports')} title="Reports & Analytics">
                <BarChart3 size={18} /><span>Reports & Analytics</span><ChevronRight size={14} className="nav-chevron" />
              </div>
            </>
          )}

          {/* Section: Settings */}
          {(hasPermission('settings', 'view') || adminProfile?.role === 'SUPER_ADMIN' || hasPermission('superadmin', 'view')) && (
            <>
              <div className="sidebar-divider" />
              <div className="nav-section-label">SETTINGS</div>
              {(adminProfile?.role === 'SUPER_ADMIN' || hasPermission('superadmin', 'view')) && (
                <div className={`nav-item ${isNav('superadmin/users') || isNav('users') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/superadmin/users')}>
                  <Users size={18} /><span>Users & Permissions</span><ChevronRight size={14} className="nav-chevron" />
                </div>
              )}
              {hasPermission('settings', 'view') && (
                <div className={`nav-item ${isNav('settings') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/settings')}>
                  <Settings size={18} /><span>System Settings</span><ChevronRight size={14} className="nav-chevron" />
                </div>
              )}
            </>
          )}

          {/* Section: Super Admin (Conditional) */}
          {adminProfile?.role === 'SUPER_ADMIN' && (
            <>
              <div className="sidebar-divider" />
              <div className="nav-section-label">SUPER ADMIN</div>
              {superAdminModules.map(({ key, label, path, Icon }) => (
                <div key={key} className={`nav-item ${isNav(key) ? 'active-orange' : ''}`} onClick={() => navTo(path)}>
                  <Icon size={18} />
                  <span>{label}</span>
                  <ChevronRight size={14} className="nav-chevron" />
                </div>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <main
        className="admin-main"
        style={!isSmallScreen ? {
          marginLeft: sidebarOpen ? `${sidebarWidth}px` : '0',
          transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
        } : { marginLeft: 0 }}
      >
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="topbar-menu-toggle"
              title="Toggle Navigation Sidebar"
              onClick={() => {
                if (isSmallScreen) {
                  setSidebarOpen(p => !p);
                } else {
                  setDesktopCollapsed(p => !p);
                }
              }}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
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
                  <button className="dropdown-menu-link" onClick={() => {
                    switchRole(adminProfile?.role === 'ADMIN' ? 'SUPER_ADMIN' : 'ADMIN');
                    setShowProfileDropdown(false);
                  }}>
                    <RefreshCw size={14} />
                    <span>Switch to {adminProfile?.role === 'ADMIN' ? 'Super Admin' : 'Admin'}</span>
                  </button>
                  <button className="dropdown-menu-link" onClick={() => {
                    setShowProfileDropdown(false);
                    navigate('/login');
                  }}>
                    <Lock size={14} />
                    <span>Lock / Test Login Screen</span>
                  </button>
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
                        requirement: '/admin/requirements', booking: '/admin/bookings',
                        client: '/admin/clients', vendor: '/admin/vendors',
                      };
                      if (map[action]) navigate(map[action]);
                    }}
                    onNavigateSection={(section) => navigate(`/admin/${section}`)}
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
                  <DriverVerificationQueue onAuditDriver={(_id) => {}} />
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

              {/* Bookings Module */}
              <Route path="bookings" element={
                <RequirePermission module="bookings">
                  <BookingsModule 
                    onNavigateToDetail={(id) => navigate(`/admin/bookings/${id}`)}
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

              {/* Settings Module */}
              <Route path="settings" element={
                <RequirePermission module="settings">
                  <SettingsModule />
                </RequirePermission>
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

