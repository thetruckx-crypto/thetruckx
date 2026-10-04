import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Truck,
  IndianRupee,
  CheckCircle2,
  Inbox,
  Plus,
  ChevronDown,
  ArrowRight,
  RefreshCw,
  Play,
  Clock,
  X,
  User,
  MapPin,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
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
  statusColor: 'green' | 'blue' | 'yellow' | 'red';
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
  onOpenSearch,
  onOpenNotifications,
  onQuickAction,
  onNavigateSection,
}) => {
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });

  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // KPIs
  const [kpis, setKpis] = useState({
    totalRequirements: 0,
    activeBookings: 0,
    inTransit: 0,
    completedTrips: 0,
    clientPayments: '₹0',
    pendingActions: 0,
  });

  // Data Lists
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
      // Convert dates to IST format for querying
      const startIST = new Date(startDate.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();
      const endIST = new Date(endDate.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();

      // Fetch all data
      const [reqsRes, booksRes, tripsRes, clientsRes, driversRes] = await Promise.all([
        supabase.from('requirements').select('*, client_companies(company_name)').gte('created_at', startIST).lte('created_at', endIST),
        supabase.from('bookings').select('*, client_companies(company_name)').gte('confirmed_at', startIST).lte('confirmed_at', endIST),
        supabase.from('trips').select('*, vehicles(registration_number, vehicle_type), bookings!inner(*, requirements!inner(*))').gte('created_at', startIST).lte('created_at', endIST),
        supabase.from('client_companies').select('*'),
        supabase.from('drivers').select('*'),
      ]);

      const requirements = reqsRes.data || [];
      const bookings = booksRes.data || [];
      const trips = tripsRes.data || [];
      const clients = clientsRes.data || [];
      const drivers = driversRes.data || [];

      setAvailableClients(clients);
      if (clients.length > 0 && !modalForm.clientId) {
        setModalForm(prev => ({ ...prev, clientId: clients[0].id, clientName: clients[0].company_name }));
      }

      // Calculate KPIs
      const totalReqs = requirements.length;
      const activeBoks = bookings.filter(b => b.booking_status !== 'CANCELLED').length;
      const inTransitTrips = trips.filter(t => t.trip_status === 'IN_TRANSIT').length;
      const completedTripsCount = trips.filter(t => t.trip_status === 'COMPLETED').length;

      const totalRevenue = trips.reduce((sum, t) => sum + (Number(t.vendor_rate) || 0), 0);
      const formattedRevenue = totalRevenue >= 100000
        ? `₹${(totalRevenue / 100000).toFixed(1)}L`
        : `₹${totalRevenue.toLocaleString('en-IN')}`;

      const pendingReqs = requirements.filter(r => r.status === 'UNDER_REVIEW').length;
      const pendingBoks = bookings.filter(b => b.payment_status === 'PAYMENT_PENDING').length;

      setKpis({
        totalRequirements: totalReqs,
        activeBookings: activeBoks,
        inTransit: inTransitTrips,
        completedTrips: completedTripsCount,
        clientPayments: formattedRevenue,
        pendingActions: pendingReqs + pendingBoks,
      });

      // Build Active Trips List
      const tripsList: TripItem[] = trips
        .filter(t => ['IN_TRANSIT', 'AT_LOADING', 'AT_UNLOADING'].includes(t.trip_status))
        .slice(0, 5)
        .map((t: any) => {
          const booking = t.bookings;
          const requirement = booking?.requirements;
          const origin = requirement?.pickup_address?.split(',')[0] || 'Origin';
          const dest = requirement?.destination_address?.split(',')[0] || 'Destination';
          
          const statusMap: Record<string, { label: string; color: 'green' | 'blue' | 'yellow' | 'red' }> = {
            IN_TRANSIT: { label: 'In Transit', color: 'green' },
            AT_LOADING: { label: 'Loading', color: 'yellow' },
            AT_UNLOADING: { label: 'Unloading', color: 'blue' },
          };

          const statusInfo = statusMap[t.trip_status] || { label: t.trip_status, color: 'blue' };
          const progress = t.trip_status === 'IN_TRANSIT' ? 68 : t.trip_status === 'AT_LOADING' ? 32 : 85;
          
          const startedTime = t.started_at ? new Date(t.started_at) : new Date();
          const minutesAgo = Math.floor((Date.now() - startedTime.getTime()) / 60000);

          return {
            id: t.id,
            tripNumber: t.id.substring(0, 12).toUpperCase(),
            route: `${origin} → ${dest}`,
            vehicle: t.vehicles?.registration_number || 'N/A',
            driver: 'Assigned Driver',
            status: statusInfo.label,
            statusColor: statusInfo.color,
            progress,
            eta: '6:45 PM',
            updatedAt: minutesAgo < 60 ? `${minutesAgo} min ago` : `${Math.floor(minutesAgo / 60)}h ago`,
          };
        });

      setActiveTrips(tripsList);

      // Build Recent Activities
      const activities: ActivityItem[] = [];
      
      bookings.slice(0, 3).forEach(b => {
        const time = b.confirmed_at ? new Date(b.confirmed_at) : new Date();
        activities.push({
          id: `bok-${b.id}`,
          icon: 'booking',
          iconColor: 'blue',
          title: `Booking #${b.id.substring(0, 12)} confirmed`,
          subtitle: `Client: ${(b as any).client_companies?.company_name || 'N/A'}`,
          timestamp: time.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          nav: 'bookings',
        });
      });

      trips.slice(0, 2).forEach(t => {
        const time = t.started_at ? new Date(t.started_at) : new Date();
        activities.push({
          id: `trip-${t.id}`,
          icon: 'vehicle',
          iconColor: 'green',
          title: `Trip started - ${t.vehicles?.registration_number || 'Vehicle'}`,
          subtitle: `Status: ${t.trip_status}`,
          timestamp: time.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          nav: 'bookings',
        });
      });

      setRecentActivities(activities.slice(0, 6));

      // Build Upcoming Deadlines
      const deadlines: DeadlineItem[] = [];

      requirements.forEach(r => {
        if (r.loading_datetime) {
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
        if (d.licence_expiry_date) {
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

      setUpcomingDeadlines(deadlines.slice(0, 5));

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      showToast('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, modalForm.clientId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleDateChange = (newStart: Date, newEnd: Date) => {
    newEnd.setHours(23, 59, 59, 999);
    setStartDate(newStart);
    setEndDate(newEnd);
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
          assigned_admin_id: 'USR-ADM-002',
          pickup_address: modalForm.origin,
          destination_address: modalForm.destination,
          vehicle_type: modalForm.truckType,
          material_type: 'General Cargo',
          required_capacity_mt: 30,
          status: 'UNDER_REVIEW',
          loading_datetime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        }]);
        if (error) throw error;
        showToast(`✅ Requirement ${newReqId} created`);
      } else if (activeModal === 'booking') {
        const newBokId = `BOK-${Date.now().toString().slice(-8)}`;
        const { data: firstReq } = await supabase.from('requirements').select('id').limit(1).maybeSingle();
        if (!firstReq) throw new Error('Create a requirement first');
        
        const { error } = await supabase.from('bookings').insert([{
          id: newBokId,
          requirement_id: firstReq.id,
          client_id: modalForm.clientId || availableClients[0]?.id,
          booking_status: 'CLIENT_ACCEPTED',
          payment_status: 'PAYMENT_PENDING',
          confirmed_at: new Date().toISOString(),
        }]);
        if (error) throw error;
        showToast(`✅ Booking ${newBokId} created`);
      } else if (activeModal === 'client') {
        const { error } = await supabase.from('client_companies').insert([{
          company_name: modalForm.name.trim(),
          city: modalForm.city.trim() || 'Hyderabad',
          status: 'ACTIVE',
        }]);
        if (error) throw error;
        showToast(`✅ Client "${modalForm.name}" registered`);
      } else if (activeModal === 'vendor') {
        const { error } = await supabase.from('vendor_companies').insert([{
          vendor_name: modalForm.name.trim(),
          address: modalForm.city.trim() || 'Hyderabad',
          status: 'APPROVED',
          onboarding_source: 'SELF_REGISTERED',
        }]);
        if (error) throw error;
        showToast(`✅ Vendor "${modalForm.name}" registered`);
      }

      await loadDashboardData();
      setActiveModal(null);
    } catch (err: any) {
      showToast(`❌ Error: ${err.message}`);
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

      {/* Header */}
      <header className="dashboard-content-header">
        <div className="header-greeting-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="dashboard-heading">Dashboard</h1>
            <button
              className="topbar-icon-btn"
              title="Refresh Dashboard Data"
              onClick={() => loadDashboardData()}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="dashboard-subheading">
            <span className="welcome-name">Welcome back, Pavani 👋</span>
            <span className="welcome-desc">Live synchronized logistics operations fetched directly from database.</span>
          </div>
        </div>

        <div className="header-actions-block">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleDateChange} />

          <div className="create-new-dropdown-container">
            <button
              className="btn-create-new-gold"
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
      </header>

      {/* KPI Cards */}
      <section className="kpi-cards-grid">
        <div className="kpi-pastel-card pastel-yellow" onClick={() => onNavigateSection('requirements')}>
          <div className="kpi-icon-wrap yellow">
            <FileText size={20} />
          </div>
          <div className="kpi-label">Total Requirements</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.totalRequirements}</span>
          </div>
          <div className="kpi-trend positive">
            <span className="trend-arrow">Database</span>
            <span className="trend-period">live count</span>
          </div>
        </div>

        <div className="kpi-pastel-card pastel-blue-tint" onClick={() => onNavigateSection('bookings')}>
          <div className="kpi-icon-wrap navy">
            <Truck size={20} />
          </div>
          <div className="kpi-label">Active Bookings</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.activeBookings}</span>
          </div>
          <div className="kpi-trend positive">
            <span className="trend-arrow">Database</span>
            <span className="trend-period">live count</span>
          </div>
        </div>

        <div className="kpi-pastel-card pastel-mint" onClick={() => onNavigateSection('bookings')}>
          <div className="kpi-icon-wrap mint">
            <Truck size={20} />
          </div>
          <div className="kpi-label">In Transit</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.inTransit}</span>
          </div>
          <div className="kpi-trend positive">
            <span className="trend-arrow">Database</span>
            <span className="trend-period">live count</span>
          </div>
        </div>

        <div className="kpi-pastel-card pastel-sky" onClick={() => onNavigateSection('bookings')}>
          <div className="kpi-icon-wrap sky">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-label">Completed Trips</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.completedTrips}</span>
          </div>
          <div className="kpi-trend positive">
            <span className="trend-arrow">Database</span>
            <span className="trend-period">live count</span>
          </div>
        </div>

        <div className="kpi-pastel-card pastel-amber" onClick={() => onNavigateSection('payments')}>
          <div className="kpi-icon-wrap amber">
            <IndianRupee size={20} />
          </div>
          <div className="kpi-label">Client Payments</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.clientPayments}</span>
          </div>
          <div className="kpi-trend positive">
            <span className="trend-arrow">Revenue</span>
            <span className="trend-period">sum of freight</span>
          </div>
        </div>

        <div className="kpi-pastel-card pastel-rose" onClick={() => onNavigateSection('requirements')}>
          <div className="kpi-icon-wrap rose">
            <Inbox size={20} />
          </div>
          <div className="kpi-label">Pending Actions</div>
          <div className="kpi-value-row">
            <span className="kpi-number">{loading ? '...' : kpis.pendingActions}</span>
          </div>
          <div className="kpi-trend alert">
            <span className="trend-arrow-red">{kpis.pendingActions > 0 ? 'Requires action' : 'All clear'}</span>
            <span className="trend-period">in queue</span>
          </div>
        </div>
      </section>

      {/* Three Column Main Content */}
      <section className="dashboard-grid-row-middle">
        {/* Active Trips - Line Based List */}
        <div className="dashboard-card active-trips-card">
          <div className="card-header-bar">
            <h3 className="card-title">Active Trips</h3>
            <button className="view-all-link" onClick={() => onNavigateSection('bookings')}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="trips-line-list">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
            ) : activeTrips.length === 0 ? (
              <div className="empty-state">
                <Truck size={32} className="empty-icon" />
                <p>No active trips for selected date range</p>
              </div>
            ) : (
              activeTrips.map((trip) => (
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
                    <span className="trip-detail">
                      <Truck size={14} /> {trip.vehicle}
                    </span>
                    <span className="trip-detail">
                      <User size={14} /> {trip.driver}
                    </span>
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
              ))
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="dashboard-card recent-activities-card">
          <div className="card-header-bar">
            <h3 className="card-title">Recent Activities</h3>
            <button className="view-all-link" onClick={() => onNavigateSection('requirements')}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="activities-line-list">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="empty-state">
                <Clock size={32} className="empty-icon" />
                <p>No recent activities for selected date range</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
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
              ))
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="dashboard-card deadlines-card">
          <div className="card-header-bar">
            <h3 className="card-title">Upcoming Deadlines</h3>
            <button className="view-all-link" onClick={() => onNavigateSection('requirements')}>
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="deadlines-line-list">
            {loading ? (
              <div className="loading-skeleton">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={32} className="empty-icon" />
                <p>No operational deadlines for selected period</p>
              </div>
            ) : (
              upcomingDeadlines.map((deadline) => (
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
              ))
            )}
          </div>
        </div>
      </section>

      {/* Create Modal */}
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
