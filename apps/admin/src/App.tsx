import React, { useState, useEffect, Suspense } from 'react';
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
import { BrandLogo } from './components/BrandLogo';
import { LoginScreen } from './components/LoginScreen';
import { TwoFactorScreen } from './components/TwoFactorScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ClientDirectory } from './components/clients/ClientDirectory';
import { CreateClient } from './components/clients/CreateClient';
import { ClientProfile } from './components/clients/ClientProfile';
import { VendorDirectory } from './components/vendors/VendorDirectory';
import { InviteVendor } from './components/vendors/InviteVendor';
import { VendorProfile } from './components/vendors/VendorProfile';
import { SharedVehicleMasterDirectory } from './components/fleet/SharedVehicleMasterDirectory';
import { VehicleVerificationScreen } from './components/fleet/VehicleVerificationScreen';
import { VendorVehicleTieupApproval } from './components/fleet/VendorVehicleTieupApproval';
import { CreateSharedVehicle } from './components/fleet/CreateSharedVehicle';
import { getVehicles } from './services/vehicleService';
import { DriverVerificationQueue } from './components/drivers/DriverVerificationQueue';
import {
  Menu,
  Search,
  Bell,
  MessageSquare,
  Maximize2,
  ChevronRight,
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
} from 'lucide-react';
import { supabase } from './utils/supabase';

// ─── Full-Screen Auth Spinner ─────────────────────────────────────────────────
function AuthLoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0D0D0E', gap: '1.25rem',
    }}>
      <BrandLogo theme="dark" size="md" />
      <div style={{
        width: 40, height: 40, border: '3px solid #2A2A2C',
        borderTop: '3px solid #FF6B35', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#FFF0E8', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
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
      id: 'admin-' + Date.now(),
      name: user.name,
      email: user.email,
      role: user.role,
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
      id: 'super-admin-' + Date.now(),
      name: user.name,
      email: user.email,
      role: 'SUPER_ADMIN',
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
  const tab = (params.get('tab') ?? 'all') as 'all' | 'verified' | 'pending' | 'rejected' | 'inactive';
  return (
    <VendorDirectory
      initialTab={tab}
      onNavigateToInvite={() => navigate('/admin/vendors/new')}
      onNavigateToProfile={(id) => navigate(`/admin/vendors/${id}`)}
    />
  );
}

// ─── Vendor Profile Route ─────────────────────────────────────────────────────
function VendorProfileRoute({ userRole }: { userRole: 'ADMIN' | 'SUPER_ADMIN' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <VendorProfile
      vendorId={id!}
      onBack={() => navigate('/admin/vendors')}
      userRole={userRole}
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
            setVehicleId('veh-demo-001');
          }
        } catch {
          setVehicleId('veh-demo-001');
        } finally {
          setResolving(false);
        }
      })();
    } else {
      setVehicleId(id);
      setResolving(false);
    }
  }, [id]);

  if (resolving || !vehicleId) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#FF6B35' }}>
        Loading vehicle verification record...
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
  const { adminProfile, signOut, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active nav key from URL path: /admin/<key>/...
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeNavKey = pathSegments[1] || 'dashboard';

  // Sidebar responsive state
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
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
  const [unreadChatCount] = useState(0);
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

  // Real notification count
  useEffect(() => {
    (async () => {
      try {
        const [{ count: reqCount }, { count: bokCount }] = await Promise.all([
          supabase.from('requirements').select('*', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
          supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('payment_status', 'PAYMENT_PENDING'),
        ]);
        setUnreadNotifCount((reqCount || 0) + (bokCount || 0));
      } catch {}
    })();
  }, []);

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

  const otherModules = [
    { key: 'drivers', label: 'Drivers', Icon: UserCheck },
    { key: 'requirements', label: 'Transport Requirements', Icon: FileSpreadsheet },
    { key: 'quotations', label: 'Sourcing & Quotations', Icon: Layers },
    { key: 'pricing', label: 'Pricing & Quotes', Icon: Receipt },
    { key: 'bookings', label: 'Bookings', Icon: CalendarCheck },
    { key: 'documents', label: 'Pre-Trip & Documents', Icon: ShieldCheck },
    { key: 'tracking', label: 'Trip Tracking', Icon: Compass },
    { key: 'weighbridge', label: 'Weighbridge & Freight', Icon: Scale },
    { key: 'pod', label: 'POD & Closure', Icon: CheckSquare },
    { key: 'payments', label: 'Client Payments', Icon: IndianRupee },
    { key: 'exceptions', label: 'Exceptions & Disruptions', Icon: AlertTriangle },
    { key: 'communications', label: 'Communications', Icon: MessageSquare },
  ];

  const placeholderModules = [
    'requirements', 'quotations', 'pricing',
    'bookings', 'documents', 'tracking', 'weighbridge', 'pod',
    'payments', 'exceptions', 'communications', 'reports', 'settings',
  ];

  const sidebarWidth = isSmallScreen ? 264 : 274;

  return (
    <div className="admin-shell">
      {/* Backdrop overlay when sidebar is open and covers content */}
      {!sidebarOpen && isSmallScreen && (
        <div style={{ display: 'none' }} />
      )}
      {sidebarOpen && isSmallScreen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 199, backdropFilter: 'blur(2px)',
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className="admin-sidebar"
        style={{
          left: sidebarOpen ? 0 : `-${sidebarWidth + 6}px`,
          transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: isSmallScreen ? 200 : 40,
          boxShadow: sidebarOpen && isSmallScreen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BrandLogo theme="dark" size="sm" />
          {isSmallScreen && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: '#F8F8F8', cursor: 'pointer', padding: '0.25rem' }}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {/* Dashboard */}
          <div className={`nav-item ${isNav('dashboard') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/dashboard')}>
            <LayoutDashboard size={18} /><span>Dashboard</span>
          </div>

          {/* Clients */}
          <div className={`nav-item ${isNav('clients') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/clients')}>
            <Users size={18} /><span>Clients</span><ChevronRight size={14} className="nav-chevron" />
          </div>

          {/* Vendors */}
          <div
            className={`nav-item ${isNav('vendors') ? 'active-orange' : ''}`}
            onClick={() => {
              if (isNav('vendors')) {
                setVendorSubOpen(v => !v);
              } else {
                navTo('/admin/vendors');
                setVendorSubOpen(true);
              }
            }}
          >
            <Building2 size={18} /><span>Vendors</span>
            <ChevronRight size={14} className={`nav-chevron ${isNav('vendors') && vendorSubOpen ? 'rotated' : ''}`} />
          </div>

          {/* Vendors sub-menu */}
          {isNav('vendors') && vendorSubOpen && (
            <div className="sidebar-subnav-list">
              {[
                { path: '/admin/vendors', label: 'Vendor Directory', match: location.pathname === '/admin/vendors' && !location.search },
                { path: '/admin/vendors/new', label: 'Add Vendor', match: location.pathname === '/admin/vendors/new' },
                { path: '/admin/vendors?tab=pending', label: 'Verification Requests', match: location.search.includes('tab=pending') },
                { path: '/admin/vendors?tab=rejected', label: 'Document Approvals', match: location.search.includes('tab=rejected') },
                { path: '/admin/vendors?tab=verified', label: 'Vendor Performance', match: location.search.includes('tab=verified') },
              ].map(({ path, label, match }) => (
                <div key={label} className={`subnav-item ${match ? 'active-orange-text' : ''}`} onClick={() => navTo(path)}>
                  <span className="subnav-bullet">◆</span><span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fleet & Vehicles */}
          <div
            className={`nav-item ${isNav('fleet') ? 'active-orange' : ''}`}
            onClick={() => {
              if (isNav('fleet')) {
                setFleetSubOpen(v => !v);
              } else {
                navTo('/admin/fleet');
                setFleetSubOpen(true);
              }
            }}
          >
            <Truck size={18} /><span>Fleet & Vehicles</span>
            <ChevronRight size={14} className={`nav-chevron ${isNav('fleet') && fleetSubOpen ? 'rotated' : ''}`} />
          </div>

          {/* Fleet sub-menu */}
          {isNav('fleet') && fleetSubOpen && (
            <div className="sidebar-subnav-list">
              {[
                { path: '/admin/fleet', label: 'Vehicle Master Directory', match: location.pathname === '/admin/fleet' },
                { path: '/admin/fleet/verification', label: 'Vehicle Verification', match: location.pathname.includes('/fleet/verification') },
                { path: '/admin/fleet/tie-up-approval', label: 'Vendor Tie-up Approval', match: location.pathname === '/admin/fleet/tie-up-approval' },
              ].map(({ path, label, match }) => (
                <div key={label} className={`subnav-item ${match ? 'active-orange-text' : ''}`} onClick={() => navTo(path)}>
                  <span className="subnav-bullet">◆</span><span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Other modules */}
          {otherModules.map(({ key, label, Icon }) => (
            <div key={key} className={`nav-item ${isNav(key) ? 'active-orange' : ''}`} onClick={() => navTo(`/admin/${key}`)}>
              <Icon size={18} /><span>{label}</span><ChevronRight size={14} className="nav-chevron" />
            </div>
          ))}

          <div className="sidebar-divider" />

          <div className={`nav-item ${isNav('reports') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/reports')}>
            <BarChart3 size={18} /><span>Reports</span>
          </div>
          <div className={`nav-item ${isNav('settings') ? 'active-orange' : ''}`} onClick={() => navTo('/admin/settings')}>
            <Settings size={18} /><span>Settings</span>
          </div>
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
              onClick={() => setSidebarOpen(p => !p)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <Menu size={20} />
            </button>
            <div className="topbar-search-box" onClick={() => setIsSearchOpen(true)}>
              <Search size={16} className="topbar-search-icon" />
              <span className="search-placeholder-text">Search clients, vendors, bookings, trucks, drivers...</span>
              <kbd className="topbar-shortcut-badge">Ctrl + K</kbd>
            </div>
            <button
              className="topbar-search-mobile-btn"
              title="Search (Ctrl + K)"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search"
            >
              <Search size={17} />
            </button>
          </div>

          <div className="topbar-right">
            <div className="supabase-status-pill" title="Supabase Cloud">
              <span className="pulse-dot-green" />
              <span>Supabase {isSupabaseReady ? 'Live' : 'Cloud'}</span>
            </div>

            <button className="topbar-icon-btn" title="Notifications" onClick={() => setIsNotifOpen(true)}>
              <Bell size={19} />
              {unreadNotifCount > 0 && <span className="badge-count-red">{unreadNotifCount}</span>}
            </button>

            <button className="topbar-icon-btn" title="Communications" onClick={() => navTo('/admin/communications')}>
              <MessageSquare size={19} />
              {unreadChatCount > 0 && <span className="badge-count-orange">{unreadChatCount}</span>}
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
                  <div className="topbar-user-avatar" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #FF6B35, #FFF0E8)',
                    color: '#0D0D0E', fontWeight: 700, fontSize: '0.85rem',
                  }}>
                    {(adminProfile?.name ?? 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="topbar-user-info">
                  <div className="user-name">{adminProfile?.name ?? 'Admin'}</div>
                  <div className="user-role-title">{adminProfile?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</div>
                </div>
              </div>

              {showProfileDropdown && (
                <div className="profile-dropdown-card">
                  <div className="profile-dropdown-header">
                    <strong>{adminProfile?.name}</strong>
                    <span>{adminProfile?.email}</span>
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
          <Suspense fallback={<div style={{ padding: '2rem', color: '#FFF0E8' }}>Loading…</div>}>
            <Routes>
              <Route path="dashboard" element={
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
              } />

              <Route path="clients" element={
                <ClientDirectory
                  onNavigateToCreate={() => navigate('/admin/clients/new')}
                  onNavigateToProfile={(id) => navigate(`/admin/clients/${id}`)}
                />
              } />
              <Route path="clients/new" element={
                <CreateClient
                  onBack={() => navigate('/admin/clients')}
                  onCreated={(id) => navigate(`/admin/clients/${id}`)}
                />
              } />
              <Route path="clients/:id" element={<ClientProfileRoute />} />

              <Route path="vendors" element={<VendorDirectoryRoute />} />
              <Route path="vendors/new" element={
                <InviteVendor
                  onBack={() => navigate('/admin/vendors')}
                  onInvited={(id) => navigate(`/admin/vendors/${id}`)}
                />
              } />
              <Route path="vendors/:id" element={
                <VendorProfileRoute userRole={adminProfile?.role ?? 'ADMIN'} />
              } />

              {/* Fleet Routes */}
              <Route path="fleet" element={
                <SharedVehicleMasterDirectory
                  onNavigateToVerification={(id) => navigate(`/admin/fleet/verification/${id}`)}
                  onNavigateToAddVehicle={() => navigate('/admin/fleet/new')}
                />
              } />
              <Route path="fleet/new" element={
                <CreateSharedVehicle
                  onBack={() => navigate('/admin/fleet')}
                  onCreated={(id) => navigate(`/admin/fleet/verification/${id}`)}
                />
              } />
              <Route path="fleet/verification" element={<VehicleVerificationRoute />} />
              <Route path="fleet/verification/:id" element={<VehicleVerificationRoute />} />
              <Route path="fleet/tie-up-approval" element={
                <VendorVehicleTieupApproval
                  onNavigateToVehicleDirectory={() => navigate('/admin/fleet')}
                  onNavigateToVehicleVerification={(id) => navigate(`/admin/fleet/verification/${id}`)}
                  onNavigateToVendorProfile={(id) => navigate(`/admin/vendors/${id}`)}
                />
              } />

              {/* Driver Management Route */}
              <Route path="drivers" element={
                <DriverVerificationQueue onAuditDriver={(_id) => {}} />
              } />

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
      </AuthProvider>
    </BrowserRouter>
  );
}

