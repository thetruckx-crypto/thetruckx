import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Truck,
  IndianRupee,
  CheckCircle2,
  Inbox,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Clock,
  X,
  User,
  Zap,
  Link2,
  Users,
  Building2,
  Compass,
  BarChart3,
  Receipt,
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { DateRangePicker } from './DateRangePicker';

interface DashboardScreenProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onQuickAction: (actionType: string) => void;
  onNavigateSection: (section: string) => void;
}

interface TripItem {
  id: string;
  tripNumber: string;
  route: string;
  vehicle: string;
  driver: string;
  status: string;
  statusColor: 'green' | 'blue' | 'orange' | 'red';
  progress: number;
  eta: string;
  updatedAt: string;
}

interface ActivityItem {
  id: string;
  icon: 'booking' | 'payment' | 'vehicle' | 'driver';
  iconColor: 'blue' | 'green' | 'gold' | 'navy';
  title: string;
  subtitle: string;
  timestamp: string;
  nav: string;
}

interface DeadlineItem {
  id: string;
  title: string;
  reference: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  nav: string;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenSearch: _onOpenSearch,
  onOpenNotifications: _onOpenNotifications,
  onQuickAction: _onQuickAction,
  onNavigateSection,
}) => {
  const { adminProfile } = useAuth();
  const adminName = adminProfile?.name || 'Administrator';

  const [startDate, setStartDate] = useState<Date>(() => new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });
  const [dateFilterLabel, setDateFilterLabel] = useState<string>('All Time');

  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const createDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreateDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateDropdown]);

  // Real Database KPIs matching specifications
  const [kpis, setKpis] = useState({
    totalClients: 0,
    totalVendors: 0,
    totalDrivers: 0,
    totalBookings: 0,
    pendingApprovals: 0,
    activeTrips: 0,
    completedBookings: 0,
    clientPayments: '₹0',
    totalRequirements: 0,
  });

  // Real Data Lists
  const [activeTrips, setActiveTrips] = useState<TripItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlineItem[]>([]);

  // Modal State
  const [activeModal, setActiveModal] = useState<null | 'requirement' | 'booking' | 'client' | 'vendor'>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [modalForm, setModalForm] = useState({
    clientId: '',
    clientName: '',
    origin: '',
    destination: '',
    vehicleNo: '',
    freight: '',
    truckType: '',
    name: '',
    contact: '',
    city: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      await ensureAdminSession();

      const isAllTime = startDate.getFullYear() <= 2020;
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // Fetch real database records with lightweight column projections
      let reqsQuery = supabase.from('requirements').select('id, status, loading_datetime, client_companies(company_name)');
      let booksQuery = supabase.from('bookings').select('id, booking_status, payment_status, confirmed_at, created_at, client_companies(company_name)');
      let tripsQuery = supabase.from('trips').select('id, trip_status, vendor_rate, started_at, created_at, vehicles(registration_number, vehicle_type), drivers(full_name), bookings(id, requirements(pickup_address, destination_address))');

      if (!isAllTime) {
        reqsQuery = reqsQuery.gte('created_at', startIso).lte('created_at', endIso);
        booksQuery = booksQuery.gte('confirmed_at', startIso).lte('confirmed_at', endIso);
        tripsQuery = tripsQuery.gte('created_at', startIso).lte('created_at', endIso);
      }

      const [reqsRes, booksRes, tripsRes, clientsRes, vendorsRes, driversRes, docsRes] = await Promise.all([
        reqsQuery,
        booksQuery,
        tripsQuery,
        supabase.from('client_companies').select('id, company_name'),
        supabase.from('vendor_companies').select('id, status'),
        supabase.from('drivers').select('id, status, full_name, licence_expiry_date'),
        supabase.from('documents').select('id, verification_status'),
      ]);

      const requirements = reqsRes.data || [];
      const bookings = booksRes.data || [];
      const trips = tripsRes.data || [];
      const clients = clientsRes.data || [];
      const vendors = vendorsRes.data || [];
      const drivers = driversRes.data || [];
      const docs = docsRes.data || [];

      setAvailableClients(clients);
      if (clients.length > 0 && !modalForm.clientId) {
        setModalForm(prev => ({ ...prev, clientId: clients[0].id, clientName: clients[0].company_name }));
      }

      // Calculate actual KPIs directly from records
      const totalClientsCount = clients.length;
      const totalVendorsCount = vendors.length;
      const totalDriversCount = drivers.length;
      const totalBookingsCount = bookings.length;
      const activeTripsCount = trips.filter(t => ['IN_TRANSIT', 'AT_LOADING', 'AT_UNLOADING', 'LORRY_ASSIGNED'].includes(t.trip_status)).length;
      const completedCount = bookings.filter(b => b.booking_status === 'COMPLETED').length + trips.filter(t => t.trip_status === 'COMPLETED').length;

      const totalRevenue = trips.reduce((sum, t) => sum + (Number(t.vendor_rate) || 0), 0);
      const formattedRevenue = totalRevenue >= 100000
        ? `₹${(totalRevenue / 100000).toFixed(1)}L`
        : `₹${totalRevenue.toLocaleString('en-IN')}`;

      const pendingVendors = vendors.filter(v => v.status === 'PENDING').length;
      const pendingDrivers = drivers.filter(d => d.status === 'PENDING').length;
      const pendingDocs = docs.filter(d => d.verification_status === 'PENDING').length;
      const pendingReqs = requirements.filter(r => r.status === 'UNDER_REVIEW' || r.status === 'NEW_REQUIREMENT').length;
      const pendingBoks = bookings.filter(b => b.payment_status === 'PAYMENT_PENDING' || b.booking_status === 'CLIENT_ACCEPTED').length;

      const totalPendingApprovals = pendingVendors + pendingDrivers + pendingDocs + pendingReqs + pendingBoks;

      setKpis({
        totalClients: totalClientsCount,
        totalVendors: totalVendorsCount,
        totalDrivers: totalDriversCount,
        totalBookings: totalBookingsCount,
        pendingApprovals: totalPendingApprovals,
        activeTrips: activeTripsCount,
        completedBookings: completedCount,
        clientPayments: formattedRevenue,
        totalRequirements: requirements.length,
      });

      // Build real active trips
      const tripsList: TripItem[] = trips
        .filter(t => ['IN_TRANSIT', 'AT_LOADING', 'AT_UNLOADING', 'LORRY_ASSIGNED'].includes(t.trip_status))
        .slice(0, 5)
        .map((t: any) => {
          const booking = t.bookings;
          const requirement = booking?.requirements;
          const origin = requirement?.pickup_address?.split(',')[0] || 'Origin';
          const dest = requirement?.destination_address?.split(',')[0] || 'Destination';

          const statusMap: Record<string, { label: string; color: 'green' | 'blue' | 'orange' | 'red' }> = {
            IN_TRANSIT: { label: 'In Transit', color: 'green' },
            AT_LOADING: { label: 'Loading', color: 'orange' },
            AT_UNLOADING: { label: 'Unloading', color: 'blue' },
            LORRY_ASSIGNED: { label: 'Lorry Assigned', color: 'orange' },
          };

          const statusInfo = statusMap[t.trip_status] || { label: t.trip_status, color: 'blue' };
          const progress = t.trip_status === 'IN_TRANSIT' ? 68 : t.trip_status === 'AT_LOADING' ? 32 : t.trip_status === 'LORRY_ASSIGNED' ? 15 : 85;
          const startedTime = t.started_at ? new Date(t.started_at) : new Date(t.created_at || Date.now());
          const minutesAgo = Math.floor((Date.now() - startedTime.getTime()) / 60000);

          return {
            id: t.id,
            tripNumber: t.id.substring(0, 12).toUpperCase(),
            route: `${origin} → ${dest}`,
            vehicle: t.vehicles?.registration_number || 'N/A',
            driver: t.drivers?.full_name || 'N/A',
            status: statusInfo.label,
            statusColor: statusInfo.color,
            progress,
            eta: 'Tracking Active',
            updatedAt: minutesAgo < 60 ? `${Math.max(1, minutesAgo)} min ago` : `${Math.floor(minutesAgo / 60)}h ago`,
          };
        });

      setActiveTrips(tripsList);

      // Build real activities
      const activities: ActivityItem[] = [];
      bookings.slice(0, 4).forEach(b => {
        const time = b.confirmed_at ? new Date(b.confirmed_at) : new Date(b.created_at || Date.now());
        activities.push({
          id: `bok-${b.id}`,
          icon: 'booking',
          iconColor: 'blue',
          title: `Booking #${b.id.substring(0, 12)} (${b.booking_status})`,
          subtitle: `Client: ${(b as any).client_companies?.company_name || 'Client'}`,
          timestamp: time.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          nav: 'bookings',
        });
      });

      trips.slice(0, 3).forEach(t => {
        const time = t.started_at ? new Date(t.started_at) : new Date(t.created_at || Date.now());
        const vehicleReg = (t as any).vehicles?.registration_number || (t as any).vehicles?.[0]?.registration_number || 'Vehicle';
        activities.push({
          id: `trip-${t.id}`,
          icon: 'vehicle',
          iconColor: 'green',
          title: `Trip ${t.trip_status} - ${vehicleReg}`,
          subtitle: `Rate: ₹${(Number(t.vendor_rate) || 0).toLocaleString('en-IN')}`,
          timestamp: time.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          nav: 'tracking',
        });
      });

      setRecentActivities(activities);

      // Build real deadlines and pending actions
      const deadlines: DeadlineItem[] = [];
      requirements.forEach(r => {
        if (r.status === 'UNDER_REVIEW' || r.status === 'NEW_REQUIREMENT') {
          deadlines.push({
            id: `req-${r.id}`,
            title: 'Requirement Review Pending',
            reference: `Req #${r.id.substring(0, 12)}`,
            dueDate: 'Immediate',
            priority: 'high',
            nav: 'requirements',
          });
        } else if (r.loading_datetime) {
          const loadDate = new Date(r.loading_datetime);
          const hoursUntil = (loadDate.getTime() - Date.now()) / (1000 * 3600);
          if (hoursUntil > 0 && hoursUntil < 72) {
            deadlines.push({
              id: `req-${r.id}`,
              title: 'Loading Scheduled',
              reference: `Req #${r.id.substring(0, 12)}`,
              dueDate: loadDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              priority: hoursUntil < 24 ? 'high' : 'medium',
              nav: 'requirements',
            });
          }
        }
      });

      drivers.forEach(d => {
        if (d.status === 'PENDING') {
          deadlines.push({
            id: `drv-p-${d.id}`,
            title: 'Driver Licence Approval',
            reference: d.full_name || 'Driver',
            dueDate: 'Action Required',
            priority: 'high',
            nav: 'drivers',
          });
        } else if (d.licence_expiry_date) {
          const expDate = new Date(d.licence_expiry_date);
          const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
          if (daysLeft > 0 && daysLeft < 30) {
            deadlines.push({
              id: `drv-${d.id}`,
              title: 'Driver License Expiry',
              reference: d.full_name || 'Driver',
              dueDate: `${daysLeft} days`,
              priority: daysLeft < 7 ? 'high' : 'medium',
              nav: 'drivers',
            });
          }
        }
      });

      setUpcomingDeadlines(deadlines);

    } catch (err) {
      console.warn('Dashboard data fetch notification:', err);
      setActiveTrips([]);
      setRecentActivities([]);
      setUpcomingDeadlines([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadDashboardData();

    const channel = supabase
      .channel('admin_dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies' }, () => {
        console.log('[Dashboard Realtime] client_companies changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {
        console.log('[Dashboard Realtime] vendor_companies changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        console.log('[Dashboard Realtime] drivers changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => {
        console.log('[Dashboard Realtime] requirements changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        console.log('[Dashboard Realtime] bookings changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        console.log('[Dashboard Realtime] trips changed');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        console.log('[Dashboard Realtime] documents changed');
        loadDashboardData();
      })
      .subscribe((status) => {
        console.log('[Dashboard Realtime] Channel status:', status);
      });

    const pollInterval = setInterval(() => {
      loadDashboardData();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadDashboardData]);

  const handleDateChange = (newStart: Date, newEnd: Date, label?: string) => {
    newEnd.setHours(23, 59, 59, 999);
    setStartDate(newStart);
    setEndDate(newEnd);
    if (label) {
      setDateFilterLabel(label);
    }
  };

  const handleOpenCreateModal = (type: 'requirement' | 'booking' | 'client' | 'vendor') => {
    setShowCreateDropdown(false);
    setActiveModal(type);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingModal(true);

    try {
      if (activeModal === 'requirement') {
        const newReqId = `REQ-${Date.now().toString().slice(-8)}`;
        const { error } = await supabase.from('requirements').insert([{
          id: newReqId,
          client_id: modalForm.clientId || availableClients[0]?.id,
          pickup_address: modalForm.origin,
          destination_address: modalForm.destination,
          pickup_pincode: '500001',
          destination_pincode: '530001',
          vehicle_type: modalForm.truckType || '32 Feet Container',
          material_type: 'General Cargo',
          required_capacity_mt: 20,
          loading_datetime: new Date(Date.now() + 86400000).toISOString(),
          status: 'UNDER_REVIEW',
          created_at: new Date().toISOString(),
        }]);

        if (error) throw error;
        showToast(`Requirement #${newReqId} created successfully`);
      } else if (activeModal === 'booking') {
        const newBokId = `BOK-${Date.now().toString().slice(-8)}`;
        const { error } = await supabase.from('bookings').insert([{
          id: newBokId,
          client_id: modalForm.clientId || availableClients[0]?.id,
          booking_status: 'CONFIRMED',
          payment_status: 'PAYMENT_PENDING',
          confirmed_at: new Date().toISOString(),
        }]);

        if (error) throw error;
        showToast(`Booking #${newBokId} created successfully`);
      } else if (activeModal === 'client') {
        const newCliId = `CLI-${Date.now().toString().slice(-8)}`;
        const { error } = await supabase.from('client_companies').insert([{
          id: newCliId,
          company_name: modalForm.name,
          city: modalForm.city,
          status: 'PENDING',
          created_at: new Date().toISOString(),
        }]);

        if (error) throw error;
        showToast(`Client "${modalForm.name}" registered successfully`);
      } else if (activeModal === 'vendor') {
        const newVenId = `VEN-${Date.now().toString().slice(-8)}`;
        const { error } = await supabase.from('vendor_companies').insert([{
          id: newVenId,
          vendor_name: modalForm.name,
          address: modalForm.city,
          status: 'PENDING',
          onboarding_source: 'ADMIN',
          created_at: new Date().toISOString(),
        }]);

        if (error) throw error;
        showToast(`Vendor "${modalForm.name}" registered successfully`);
      }

      setActiveModal(null);
      setModalForm({
        clientId: availableClients[0]?.id || '',
        clientName: '',
        origin: '',
        destination: '',
        vehicleNo: '',
        freight: '',
        truckType: '',
        name: '',
        contact: '',
        city: '',
      });
      loadDashboardData();
    } catch (err: any) {
      console.error('Modal submission failed:', err);
      showToast(`Error: ${err.message || 'Action could not be completed'}`);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  return (
    <div className="dashboard-page-wrapper">
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Dashboard Hero Banner ── */}
      <section className="dashboard-hero-card">
        <div className="dashboard-hero-bg">
          <div className="dashboard-hero-wave-glow" />
          <div className="dashboard-hero-ambient-glow" />
        </div>

        <div className="dashboard-hero-content">
          <h1 className="dashboard-hero-title">Dashboard</h1>
          <h2 className="dashboard-hero-welcome">Welcome back, {adminName} 👋</h2>
          <p className="dashboard-hero-desc">
            Your logistics operations at a glance. Manage, monitor and move with confidence.
          </p>
        </div>

        <div className="dashboard-hero-actions">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            activeLabel={dateFilterLabel}
          />

          <div className="create-new-dropdown-container" ref={createDropdownRef}>
            <button
              className="btn-create-new-orange"
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create New</span>
              <ChevronDown size={14} className={`dropdown-arrow ${showCreateDropdown ? 'open' : ''}`} />
            </button>

            {showCreateDropdown && (
              <div className="create-dropdown-menu">
                <button className="dropdown-item" onClick={() => handleOpenCreateModal('requirement')}>
                  <FileText size={16} className="item-icon gold" />
                  <div>
                    <div className="item-title">New Transport Requirement</div>
                    <div className="item-desc">Create RFQ for bidding</div>
                  </div>
                </button>
                <button className="dropdown-item" onClick={() => handleOpenCreateModal('booking')}>
                  <Truck size={16} className="item-icon blue" />
                  <div>
                    <div className="item-title">Confirm Booking</div>
                    <div className="item-desc">Allocate truck and driver</div>
                  </div>
                </button>
                <button className="dropdown-item" onClick={() => handleOpenCreateModal('client')}>
                  <Plus size={16} className="item-icon green" />
                  <div>
                    <div className="item-title">Add Client Account</div>
                    <div className="item-desc">Register new consignor</div>
                  </div>
                </button>
                <button className="dropdown-item" onClick={() => handleOpenCreateModal('vendor')}>
                  <Plus size={16} className="item-icon amber" />
                  <div>
                    <div className="item-title">Add Vendor Account</div>
                    <div className="item-desc">Register fleet provider</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── KPI Metric Cards Grid ── */}
      <section className="kpi-cards-grid">
        {/* 1: Total Clients */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('clients')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-blue">
              <Users size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Total Clients</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.totalClients}
            </div>
          </div>
          <div className="kpi-card-curve-decor blue" />
        </div>

        {/* 2: Total Vendors */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('vendors')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-orange">
              <Building2 size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Total Vendors</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.totalVendors}
            </div>
          </div>
          <div className="kpi-card-curve-decor orange" />
        </div>

        {/* 3: Total Drivers */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('drivers')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-green">
              <User size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Total Drivers</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.totalDrivers}
            </div>
          </div>
          <div className="kpi-card-curve-decor green" />
        </div>

        {/* 4: Total Bookings */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('bookings')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-sky">
              <Truck size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Total Bookings</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.totalBookings}
            </div>
          </div>
          <div className="kpi-card-curve-decor sky" />
        </div>

        {/* 5: Pending Approvals */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('requirements')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-rose">
              <Inbox size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Pending Approvals</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.pendingApprovals}
            </div>
          </div>
          <div className="kpi-card-curve-decor rose" />
        </div>

        {/* 6: Active Trips */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('tracking')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-amber">
              <Compass size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Active Trips</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.activeTrips}
            </div>
          </div>
          <div className="kpi-card-curve-decor amber" />
        </div>

        {/* 7: Completed Bookings */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('bookings')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-green">
              <CheckCircle2 size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Completed Bookings</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.completedBookings}
            </div>
          </div>
          <div className="kpi-card-curve-decor green" />
        </div>

        {/* 8: Revenue & Payments */}
        <div className="kpi-metric-card" onClick={() => onNavigateSection('payments')}>
          <div className="kpi-card-top">
            <div className="kpi-icon-square icon-blue">
              <IndianRupee size={20} />
            </div>
            <div className="kpi-arrow-circle">
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="kpi-card-bottom">
            <div className="kpi-card-label">Revenue / Payments</div>
            <div className="kpi-card-value">
              {loading ? <div className="kpi-skeleton-pill" /> : kpis.clientPayments}
            </div>
          </div>
          <div className="kpi-card-curve-decor blue" />
        </div>
      </section>

      {/* ── 3 Main Aligned Panels ── */}
      <section className="dashboard-grid-row-middle">
        {/* Panel 1: Active Trips */}
        <div className="dashboard-panel-card">
          <div className="panel-header-bar">
            <div className="panel-header-left">
              <Truck size={18} className="panel-header-icon orange" />
              <h3 className="panel-title">Active Trips</h3>
            </div>
            <button className="panel-view-all-link" onClick={() => onNavigateSection('bookings')}>
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel-content-body">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            ) : activeTrips.length === 0 ? (
              <div className="panel-empty-state">
                <div className="empty-state-art">
                  <div className="empty-art-circle orange-soft">
                    <Truck size={34} className="empty-truck-icon" />
                  </div>
                </div>
                <h4 className="empty-state-title">No active trips to display</h4>
                <p className="empty-state-subtitle">
                  Trips assigned and in transit will appear here with real-time status, route progress and ETA.
                </p>
                <button className="empty-state-action-btn" onClick={() => onNavigateSection('bookings')}>
                  View All Trips →
                </button>
              </div>
            ) : (
              <div className="trips-line-list">
                {activeTrips.map((trip) => (
                  <div key={trip.id} className="trip-line-item" onClick={() => onNavigateSection('bookings')}>
                    <div className="trip-header-row">
                      <span className="trip-number">TRIP #{trip.tripNumber}</span>
                      <span className={`trip-status status-${trip.statusColor}`}>
                        <span className="status-dot"></span>
                        {trip.status}
                      </span>
                    </div>
                    <div className="trip-route">{trip.route}</div>
                    <div className="trip-details-row">
                      <span className="trip-detail"><Truck size={14} /> {trip.vehicle}</span>
                      <span className="trip-detail"><User size={14} /> {trip.driver}</span>
                    </div>
                    <div className="trip-progress-row">
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${trip.progress}%` }}></div>
                      </div>
                      <span className="progress-text">{trip.progress}%</span>
                    </div>
                    <div className="trip-meta-row">
                      <span className="trip-eta">ETA {trip.eta}</span>
                      <span className="trip-updated">Updated {trip.updatedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Recent Activities */}
        <div className="dashboard-panel-card">
          <div className="panel-header-bar">
            <div className="panel-header-left">
              <FileText size={18} className="panel-header-icon navy" />
              <h3 className="panel-title">Recent Activities</h3>
            </div>
            <button className="panel-view-all-link" onClick={() => onNavigateSection('requirements')}>
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel-content-body">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="panel-empty-state">
                <div className="empty-state-art">
                  <div className="empty-art-circle orange-soft">
                    <FileText size={34} className="empty-doc-icon" />
                  </div>
                </div>
                <h4 className="empty-state-title">No recent activities</h4>
                <p className="empty-state-subtitle">
                  System activities, bookings, payments and important updates will appear here.
                </p>
                <button className="empty-state-action-btn" onClick={() => onNavigateSection('requirements')}>
                  View All Activities →
                </button>
              </div>
            ) : (
              <div className="activities-line-list">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="activity-line-item" onClick={() => onNavigateSection(activity.nav)}>
                    <div className={`activity-icon icon-${activity.iconColor}`}>
                      {activity.icon === 'booking' && <FileText size={16} />}
                      {activity.icon === 'payment' && <IndianRupee size={16} />}
                      {activity.icon === 'vehicle' && <Truck size={16} />}
                      {activity.icon === 'driver' && <User size={16} />}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">{activity.title}</div>
                      <div className="activity-subtitle">{activity.subtitle}</div>
                      <div className="activity-time">{activity.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Upcoming Deadlines */}
        <div className="dashboard-panel-card">
          <div className="panel-header-bar">
            <div className="panel-header-left">
              <Clock size={18} className="panel-header-icon orange" />
              <h3 className="panel-title">Upcoming Deadlines</h3>
            </div>
            <button className="panel-view-all-link" onClick={() => onNavigateSection('requirements')}>
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel-content-body">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="panel-empty-state">
                <div className="empty-state-art">
                  <div className="empty-art-circle orange-soft">
                    <Clock size={34} className="empty-clock-icon" />
                  </div>
                </div>
                <h4 className="empty-state-title">No upcoming deadlines</h4>
                <p className="empty-state-subtitle">
                  Document renewals, compliance deadlines and important actions will be shown here.
                </p>
                <button className="empty-state-action-btn" onClick={() => onNavigateSection('requirements')}>
                  View All Deadlines →
                </button>
              </div>
            ) : (
              <div className="deadlines-line-list">
                {upcomingDeadlines.map((deadline) => (
                  <div key={deadline.id} className="deadline-line-item" onClick={() => onNavigateSection(deadline.nav)}>
                    <div className={`deadline-icon priority-${deadline.priority}`}>
                      <Clock size={16} />
                    </div>
                    <div className="deadline-content">
                      <div className="deadline-title">{deadline.title}</div>
                      <div className="deadline-reference">{deadline.reference}</div>
                    </div>
                    <div className="deadline-due-info">
                      <span className={`deadline-due priority-${deadline.priority}`}>Due {deadline.dueDate}</span>
                      <span className={`deadline-priority priority-${deadline.priority}`}>
                        {deadline.priority === 'high' ? '● Urgent' : deadline.priority === 'medium' ? '● Upcoming' : '● Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Bottom Row: Quick Actions & Useful Links ── */}
      <section className="dashboard-bottom-row">
        {/* Quick Actions Panel */}
        <div className="dashboard-panel-card quick-actions-panel">
          <div className="panel-header-bar clean">
            <div className="panel-header-left">
              <Zap size={18} className="panel-header-icon orange" />
              <h3 className="panel-title">Quick Actions</h3>
            </div>
          </div>
          <div className="quick-actions-grid">
            <button className="action-tile-btn peach" onClick={() => handleOpenCreateModal('requirement')}>
              <div className="action-tile-icon peach">
                <FileText size={18} />
              </div>
              <span className="action-tile-label">Create Requirement</span>
            </button>

            <button className="action-tile-btn blue" onClick={() => handleOpenCreateModal('booking')}>
              <div className="action-tile-icon blue">
                <Truck size={18} />
              </div>
              <span className="action-tile-label">Add Booking</span>
            </button>

            <button className="action-tile-btn mint" onClick={() => onNavigateSection('fleet')}>
              <div className="action-tile-icon mint">
                <Truck size={18} />
              </div>
              <span className="action-tile-label">Manage Fleet</span>
            </button>

            <button className="action-tile-btn purple" onClick={() => onNavigateSection('drivers')}>
              <div className="action-tile-icon purple">
                <User size={18} />
              </div>
              <span className="action-tile-label">Add Driver</span>
            </button>

            <button className="action-tile-btn peach" onClick={() => onNavigateSection('pricing')}>
              <div className="action-tile-icon peach">
                <Receipt size={18} />
              </div>
              <span className="action-tile-label">Create Quote</span>
            </button>

            <button className="action-tile-btn sky" onClick={() => onNavigateSection('reports')}>
              <div className="action-tile-icon sky">
                <BarChart3 size={18} />
              </div>
              <span className="action-tile-label">Generate Report</span>
            </button>
          </div>
        </div>

        {/* Useful Links Panel */}
        <div className="dashboard-panel-card useful-links-panel">
          <div className="panel-header-bar clean">
            <div className="panel-header-left">
              <Link2 size={18} className="panel-header-icon orange" />
              <h3 className="panel-title">Useful Links</h3>
            </div>
          </div>
          <div className="useful-links-grid">
            <button className="useful-link-tile blue" onClick={() => onNavigateSection('clients')}>
              <div className="useful-link-icon blue">
                <Users size={18} />
              </div>
              <span className="useful-link-label">Client Management</span>
            </button>

            <button className="useful-link-tile orange" onClick={() => onNavigateSection('vendors')}>
              <div className="useful-link-icon orange">
                <Building2 size={18} />
              </div>
              <span className="useful-link-label">Vendor Management</span>
            </button>

            <button className="useful-link-tile sky" onClick={() => onNavigateSection('tracking')}>
              <div className="useful-link-icon sky">
                <Compass size={18} />
              </div>
              <span className="useful-link-label">Trip Tracking</span>
            </button>

            <button className="useful-link-tile purple" onClick={() => onNavigateSection('reports')}>
              <div className="useful-link-icon purple">
                <BarChart3 size={18} />
              </div>
              <span className="useful-link-label">Reports & Analytics</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Create Modal ── */}
      {activeModal && (
        <div className="create-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="create-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">
                  {activeModal === 'requirement' && 'New Transport Requirement'}
                  {activeModal === 'booking' && 'Confirm New Booking'}
                  {activeModal === 'client' && 'Register Client Account'}
                  {activeModal === 'vendor' && 'Register Vendor Fleet'}
                </h3>
                <p className="create-modal-subtitle">
                  {activeModal === 'requirement' && 'Create RFQ quotation request'}
                  {activeModal === 'booking' && 'Allocate vehicle and driver'}
                  {activeModal === 'client' && 'Add new enterprise shipper'}
                  {activeModal === 'vendor' && 'Add new fleet provider'}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="create-modal-body">
                {activeModal === 'requirement' && (
                  <>
                    <div className="form-group-grid">
                      <div className="form-field-group">
                        <label className="form-field-label">Client</label>
                        <select
                          className="form-field-input"
                          value={modalForm.clientId}
                          onChange={(e) => setModalForm({ ...modalForm, clientId: e.target.value })}
                        >
                          {availableClients.map(c => (
                            <option key={c.id} value={c.id}>{c.company_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field-group">
                        <label className="form-field-label">Truck Type</label>
                        <input
                          type="text"
                          required
                          value={modalForm.truckType}
                          onChange={(e) => setModalForm({ ...modalForm, truckType: e.target.value })}
                          className="form-field-input"
                          placeholder="e.g. 32 Feet Container"
                        />
                      </div>
                    </div>
                    <div className="form-group-grid">
                      <div className="form-field-group">
                        <label className="form-field-label">Origin</label>
                        <input
                          type="text"
                          required
                          value={modalForm.origin}
                          onChange={(e) => setModalForm({ ...modalForm, origin: e.target.value })}
                          className="form-field-input"
                          placeholder="e.g. Hyderabad"
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="form-field-label">Destination</label>
                        <input
                          type="text"
                          required
                          value={modalForm.destination}
                          onChange={(e) => setModalForm({ ...modalForm, destination: e.target.value })}
                          className="form-field-input"
                          placeholder="e.g. Visakhapatnam"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeModal === 'booking' && (
                  <>
                    <div className="form-group-grid">
                      <div className="form-field-group">
                        <label className="form-field-label">Client</label>
                        <select
                          className="form-field-input"
                          value={modalForm.clientId}
                          onChange={(e) => setModalForm({ ...modalForm, clientId: e.target.value })}
                        >
                          {availableClients.map(c => (
                            <option key={c.id} value={c.id}>{c.company_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field-group">
                        <label className="form-field-label">Vehicle Registration</label>
                        <input
                          type="text"
                          required
                          value={modalForm.vehicleNo}
                          onChange={(e) => setModalForm({ ...modalForm, vehicleNo: e.target.value })}
                          className="form-field-input"
                        />
                      </div>
                    </div>
                  </>
                )}

                {(activeModal === 'client' || activeModal === 'vendor') && (
                  <>
                    <div className="form-group-grid">
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {activeModal === 'client' ? 'Company Name' : 'Fleet Name'}
                        </label>
                        <input
                          type="text"
                          required
                          value={modalForm.name}
                          onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                          className="form-field-input"
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="form-field-label">City</label>
                        <input
                          type="text"
                          required
                          value={modalForm.city}
                          onChange={(e) => setModalForm({ ...modalForm, city: e.target.value })}
                          className="form-field-input"
                          placeholder="e.g. Hyderabad"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="create-modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingModal} className="btn-submit-modal">
                  <Plus size={15} />
                  <span>{isSubmittingModal ? 'Saving...' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
