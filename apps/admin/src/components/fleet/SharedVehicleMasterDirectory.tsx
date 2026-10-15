import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  Filter,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Truck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  Vehicle,
  VehicleFilters,
  PaginationParams,
  getVehicles,
  getVehicleStats,
  getVehicleTransporterCount,
} from '../../services/vehicleService';
import { formatDisplayId } from '../../utils/idGenerator';

interface SharedVehicleMasterDirectoryProps {
  onNavigateToVerification: (vehicleId: string) => void;
  onNavigateToAddVehicle: () => void;
}

// Helper function to get expiry status with semantic colors
function getExpiryStatus(expiryDate: string | null): {
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_DATE';
  color: string;
  label: string;
} {
  if (!expiryDate) {
    return { status: 'NO_DATE', color: 'doc-expiry-pill nodate', label: 'No Date' };
  }

  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: 'EXPIRED', color: 'doc-expiry-pill expired', label: 'Expired' };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'EXPIRING_SOON', color: 'doc-expiry-pill expiring', label: `${daysUntilExpiry}d left` };
  } else {
    return { status: 'VALID', color: 'doc-expiry-pill valid', label: 'Valid' };
  }
}

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const SharedVehicleMasterDirectory: React.FC<SharedVehicleMasterDirectoryProps> = ({
  onNavigateToVerification,
  onNavigateToAddVehicle,
}) => {
  // State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalVehicles: 0,
    verifiedVehicles: 0,
    pendingVerification: 0,
    rejectedVehicles: 0,
    verifiedPercentage: 0,
    pendingPercentage: 0,
  });

  // Transporter counts (cached)
  const [transporterCounts, setTransporterCounts] = useState<Record<string, number>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED'>('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('ALL');
  const [expiryWarningFilter, setExpiryWarningFilter] = useState<'ALL' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const statsData = await getVehicleStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch vehicles
  const fetchVehicles = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const filters: VehicleFilters = {};

      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      if (activeTab === 'VERIFIED') {
        filters.verificationStatus = 'APPROVED';
      } else if (activeTab === 'PENDING') {
        filters.verificationStatus = 'PENDING_DOCS';
      } else if (activeTab === 'REJECTED') {
        filters.verificationStatus = 'REJECTED';
      }

      if (vehicleTypeFilter !== 'ALL') {
        filters.vehicleType = vehicleTypeFilter;
      }

      if (expiryWarningFilter !== 'ALL') {
        filters.expiryWarning = expiryWarningFilter;
      }

      const pagination: PaginationParams = {
        page,
        pageSize: itemsPerPage,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      const response = await getVehicles(filters, pagination);

      setVehicles(response.vehicles);
      setTotal(response.total);
      setTotalPages(response.totalPages);

      const counts: Record<string, number> = {};
      for (const vehicle of response.vehicles) {
        const count = await getVehicleTransporterCount(vehicle.id);
        counts[vehicle.id] = count;
      }
      setTransporterCounts(counts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicles');
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchVehicles();
    }
  }, [page, itemsPerPage, activeTab, vehicleTypeFilter, expiryWarningFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchVehicles();
  };

  const handleRefresh = () => {
    setPage(1);
    fetchStats();
    fetchVehicles(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setVehicleTypeFilter('ALL');
    setExpiryWarningFilter('ALL');
    setActiveTab('ALL');
    setPage(1);
  };

  const handleVehicleClick = (vehicleId: string) => {
    onNavigateToVerification(vehicleId);
  };

  const getOverallDocStatus = (vehicle: Vehicle): {
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'MIXED';
    label: string;
    color: string;
  } => {
    const statuses = [
      vehicle.rc_verification_status,
      vehicle.insurance_verification_status,
      vehicle.fitness_verification_status,
      vehicle.permit_verification_status,
    ];

    const approved = statuses.filter(s => s === 'APPROVED').length;
    const pending = statuses.filter(s => s === 'PENDING').length;
    const rejected = statuses.filter(s => s === 'REJECTED').length;

    if (approved === 4) {
      return { status: 'APPROVED', label: 'All Verified', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
    } else if (rejected > 0) {
      return { status: 'REJECTED', label: `${rejected} Rejected`, color: 'text-rose-700 bg-rose-50 border border-rose-200' };
    } else if (pending > 0) {
      return { status: 'PENDING', label: `${pending} Pending`, color: 'text-amber-700 bg-amber-50 border border-amber-200' };
    } else {
      return { status: 'MIXED', label: 'Mixed', color: 'text-slate-600 bg-slate-100 border border-slate-200' };
    }
  };

  const handleExportCSV = () => {
    if (vehicles.length === 0) return;
    const headers = ['Vehicle ID', 'Registration Number', 'Vehicle Type', 'Make', 'Model', 'Rated Capacity', 'RC Expiry', 'Insurance Expiry'];
    const rows = vehicles.map(v => [
      formatDisplayId('VH', (v as any).vehicle_code || v.id, v.created_at),
      v.registration_number,
      v.vehicle_type,
      v.make || '',
      v.model || '',
      v.rated_capacity_mt,
      v.rc_expiry_date || '',
      v.insurance_expiry_date || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicles_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Header Banner */}
      <div className="client-header-hero">
        <div className="client-header-truck-bg">
          <div className="client-header-truck-overlay" />
        </div>

        <div className="client-header-info">
          <div className="client-header-breadcrumbs">
            <span>Fleet & Vehicles</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Shared Vehicle Master</span>
          </div>
          <h1 className="client-directory-title">Shared Vehicle Master Directory</h1>
          <p className="client-directory-desc">
            Manage all registered and shared vehicles across vendors. Track verification status, capacity and availability.
          </p>
        </div>

        <div className="client-header-actions">
          <button className="btn-create-orange" onClick={onNavigateToAddVehicle}>
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Shared Vehicle</span>
          </button>
        </div>
      </div>

      {/* 4 Equal-Width KPI Cards */}
      <div className="client-kpi-bar">
        {/* Total Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'ALL' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('ALL'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle orange">
            <Truck size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Vehicles</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : stats.totalVehicles}
            </div>
          </div>
        </div>

        {/* Verified Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'VERIFIED' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('VERIFIED'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Verified Vehicles</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : stats.verifiedVehicles}
            </div>
          </div>
        </div>

        {/* Pending Verification */}
        <div
          className={`kpi-stat-card ${activeTab === 'PENDING' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('PENDING'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle amber">
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Pending Verification</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : stats.pendingVerification}
            </div>
          </div>
        </div>

        {/* Rejected Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'REJECTED' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('REJECTED'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle red">
            <XCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Rejected Vehicles</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : stats.rejectedVehicles}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar Card */}
      <div className="filters-bar-card">
        <div className="filter-input-wrap">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by vehicle no, make, model..."
            className="filter-input"
          />
        </div>

        <div className="filter-dropdown-wrap">
          <select
            value={vehicleTypeFilter}
            onChange={(e) => {
              setVehicleTypeFilter(e.target.value);
              setPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="ALL">All Vehicle Types</option>
            <option value="10 Wheeler">10 Wheeler</option>
            <option value="12 Wheeler">12 Wheeler</option>
            <option value="14 Wheeler">14 Wheeler</option>
            <option value="16 Wheeler">16 Wheeler</option>
            <option value="18 Wheeler">18 Wheeler</option>
            <option value="20 Wheeler">20 Wheeler</option>
            <option value="22 Wheeler">22 Wheeler</option>
            <option value="Trailer">Trailer</option>
            <option value="Container">Container</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        <div className="filter-dropdown-wrap">
          <select
            value={expiryWarningFilter}
            onChange={(e) => {
              setExpiryWarningFilter(e.target.value as any);
              setPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="ALL">All Expiry Status</option>
            <option value="EXPIRING_SOON">Expiring in 30 Days</option>
            <option value="EXPIRED">Expired Documents</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        <button onClick={handleResetFilters} className="btn-filter-reset" title="Reset filters">
          <X size={14} />
          <span>Reset</span>
        </button>

        <button onClick={handleSearch} className="btn-filter-search">
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* Sub-bar: Status Tabs & Actions */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          {(['ALL', 'VERIFIED', 'PENDING', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`status-tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'ALL' && 'All Vehicles'}
              {tab === 'VERIFIED' && 'Verified'}
              {tab === 'PENDING' && 'Pending'}
              {tab === 'REJECTED' && 'Rejected'}
            </button>
          ))}
        </div>

        <div className="table-actions-group">
          <button className="btn-action-outline" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Vehicles Table Card */}
      <div className="client-table-card">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw size={36} className="text-[#F05A22] spin mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Loading vehicle records...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <XCircle size={36} className="text-rose-500 mx-auto mb-3" />
            <p className="text-rose-700 font-bold mb-1">Failed to load vehicles</p>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <button onClick={handleRefresh} className="btn-filter-reset">
              Retry
            </button>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-state-icon-box">
              <Truck size={32} />
            </div>
            <h4 className="empty-state-heading">No vehicles found</h4>
            <p className="empty-state-text">
              {searchQuery || vehicleTypeFilter !== 'ALL' || expiryWarningFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Add your first shared vehicle to get started'}
            </p>
            {!searchQuery && vehicleTypeFilter === 'ALL' && expiryWarningFilter === 'ALL' && (
              <button onClick={onNavigateToAddVehicle} className="btn-create-orange" style={{ margin: '0 auto' }}>
                <Plus size={15} />
                <span>Add Shared Vehicle</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="client-table" style={{ minWidth: '1080px' }}>
                <thead>
                  <tr>
                    <th>Vehicle No. ⇅</th>
                    <th>Type & Body ⇅</th>
                    <th>Rated Capacity ⇅</th>
                    <th>Min Capacity ⇅</th>
                    <th>Linked Transporters ⇅</th>
                    <th>RC Status ⇅</th>
                    <th>Insurance ⇅</th>
                    <th>Fitness ⇅</th>
                    <th>Permit ⇅</th>
                    <th>Overall Status ⇅</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle, idx) => {
                    const rcStatus = getExpiryStatus(vehicle.rc_expiry_date);
                    const insuranceStatus = getExpiryStatus(vehicle.insurance_expiry_date);
                    const fitnessStatus = getExpiryStatus(vehicle.fitness_expiry_date);
                    const permitStatus = getExpiryStatus(vehicle.permit_expiry_date);
                    const overallStatus = getOverallDocStatus(vehicle);
                    const transporterCount = transporterCounts[vehicle.id] || 0;
                    const colorThemes = ['peach', 'purple', 'orange', 'blue', 'teal', 'red'];
                    const theme = colorThemes[idx % colorThemes.length];

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => handleVehicleClick(vehicle.id)}
                        className="client-data-row"
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="client-info-cell">
                            <div className={`client-avatar-squircle ${theme}`}>
                              <Truck size={16} />
                            </div>
                            <div>
                              <div className="client-name-bold font-mono">
                                {vehicle.registration_number}
                              </div>
                              <div className="client-id-sub font-mono">
                                {formatDisplayId('VH', (vehicle as any).vehicle_code || vehicle.id, vehicle.created_at)}
                                {vehicle.make && vehicle.model ? ` • ${vehicle.make} ${vehicle.model}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold text-slate-800">{vehicle.vehicle_type}</div>
                          {vehicle.body_type && (
                            <div className="table-cell-sub">{vehicle.body_type}</div>
                          )}
                        </td>
                        <td>
                          <span className="mono-code">{vehicle.rated_capacity_mt} MT</span>
                        </td>
                        <td>
                          <span className="mono-code">{vehicle.minimum_capacity_mt} MT</span>
                        </td>
                        <td>
                          <div className="transporter-linked-badge">
                            <Users size={13} className="transporter-icon" />
                            <span>{transporterCount} linked</span>
                          </div>
                        </td>
                        <td>
                          <span className={rcStatus.color}>{rcStatus.label}</span>
                        </td>
                        <td>
                          <span className={insuranceStatus.color}>{insuranceStatus.label}</span>
                        </td>
                        <td>
                          <span className={fitnessStatus.color}>{fitnessStatus.label}</span>
                        </td>
                        <td>
                          <span className={permitStatus.color}>{permitStatus.label}</span>
                        </td>
                        <td>
                          <span className={`status-badge-pastel ${
                            overallStatus.status === 'APPROVED' ? 'active' : overallStatus.status === 'PENDING' ? 'pending' : 'inactive'
                          }`}>
                            {overallStatus.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVehicleClick(vehicle.id);
                            }}
                            className="row-action-btn-circle"
                            title="Inspect Vehicle Record"
                            style={{ marginLeft: 'auto' }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-row">
              <div className="pagination-info">
                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} vehicles
              </div>
              <div className="pagination-controls">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="page-nav-btn"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`page-num-btn ${page === pageNum ? 'active' : ''}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="page-nav-btn"
                >
                  <ChevronRight size={14} />
                </button>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setPage(1);
                  }}
                  className="page-size-select ml-2"
                >
                  <option value="10">10 / page</option>
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
