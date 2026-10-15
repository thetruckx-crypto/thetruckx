import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Truck,
  Building2,
  User,
  FileText,
  Calendar,
  Info,
  ExternalLink,
  Shield,
  History,
  RotateCcw,
} from 'lucide-react';
import {
  getVendorVehicleTieupRequests,
  getTieupRequestById,
  approveVendorVehicleTieup,
  rejectVendorVehicleTieup,
  getTieupStats,
  getTieupAuthorizationDocument,
} from '../../services/vehicleService';
import { supabase } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';

interface VendorVehicleTieupApprovalProps {
  onNavigateToVehicleDirectory: () => void;
  onNavigateToVehicleVerification: (vehicleId: string) => void;
  onNavigateToVendorProfile: (vendorId: string) => void;
}

const ITEMS_PER_PAGE = 10;

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper to format datetime
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const VendorVehicleTieupApproval: React.FC<VendorVehicleTieupApprovalProps> = ({
  onNavigateToVehicleDirectory,
  onNavigateToVehicleVerification,
  onNavigateToVendorProfile,
}) => {
  const toast = useToast();
  // State
  const [tieupRequests, setTieupRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    pendingApproval: 0,
    approvedTieups: 0,
    rejectedTieups: 0,
    totalTieups: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Pagination
  const [page, setPage] = useState(1);

  // Review drawer
  const [reviewingTieup, setReviewingTieup] = useState<any | null>(null);
  const [authDocument, setAuthDocument] = useState<any | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Success toast
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Document preview modal
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const statsData = await getTieupStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch tie-up requests
  const fetchTieupRequests = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const status = activeTab === 'ALL' ? undefined : activeTab;
      const data = await getVendorVehicleTieupRequests(status as any);

      // Apply search filter
      let filtered = data;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = data.filter(
          (req: any) =>
            req.vehicle?.registration_number?.toLowerCase().includes(query) ||
            req.vendor?.vendor_name?.toLowerCase().includes(query)
        );
      }

      setTieupRequests(filtered);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tie-up requests');
      console.error('Error fetching tie-up requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load & Realtime sync
  useEffect(() => {
    fetchStats();
    fetchTieupRequests();

    const channel = supabase
      .channel('vendor_vehicle_tieup_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_vehicle_links' },
        () => {
          fetchStats();
          fetchTieupRequests();
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchStats();
      fetchTieupRequests();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  // Refetch when tab changes
  useEffect(() => {
    if (!loading) {
      fetchTieupRequests();
    }
  }, [activeTab]);

  // Handle search
  const handleSearch = () => {
    setPage(1);
    fetchTieupRequests();
  };

  // Handle refresh
  const handleRefresh = () => {
    setPage(1);
    fetchStats();
    fetchTieupRequests(true);
  };

  // Handle review tie-up
  const handleReviewTieup = async (tieupId: string) => {
    try {
      setLoadingReview(true);
      const tieupData = await getTieupRequestById(tieupId);
      const authDoc = await getTieupAuthorizationDocument(tieupId);
      setReviewingTieup(tieupData);
      setAuthDocument(authDoc);
    } catch (err: any) {
      toast.error(`Failed to load tie-up details: ${err.message}`);
    } finally {
      setLoadingReview(false);
    }
  };

  // Show success message
  const showSuccess = (message: string) => {
    toast.success(message);
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle approve tie-up
  const handleApproveTieup = async () => {
    if (!reviewingTieup) return;

    // Validation checks
    if (reviewingTieup.vehicle?.verification_status !== 'APPROVED') {
      toast.warning('Vehicle must be approved before approving the tie-up');
      return;
    }

    if (reviewingTieup.vendor?.status !== 'APPROVED') {
      toast.warning('Vendor must be approved before approving the tie-up');
      return;
    }

    if (!window.confirm('Are you sure you want to approve this vendor-vehicle tie-up?')) {
      return;
    }

    try {
      setSaving(true);
      await approveVendorVehicleTieup(reviewingTieup.id, 'Admin');
      showSuccess('Vendor-vehicle tie-up approved successfully');
      setReviewingTieup(null);
      setAuthDocument(null);
      await fetchStats();
      await fetchTieupRequests();
    } catch (err: any) {
      toast.error(`Failed to approve tie-up: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject tie-up
  const handleRejectTieup = async () => {
    if (!reviewingTieup || !rejectionReason.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVendorVehicleTieup(reviewingTieup.id, rejectionReason, 'Admin');
      showSuccess('Vendor-vehicle tie-up rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setReviewingTieup(null);
      setAuthDocument(null);
      await fetchStats();
      await fetchTieupRequests();
    } catch (err: any) {
      toast.error(`Failed to reject tie-up: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Paginate requests
  const paginatedRequests = tieupRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(tieupRequests.length / ITEMS_PER_PAGE);

  return (
    <div className="cli-dir-wrapper">
      {/* Toast Alert */}
      {successMessage && (
        <div className="toast-success">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="client-header-hero">
        <div className="client-header-truck-bg">
          <div className="client-header-truck-overlay" />
        </div>

        <div className="client-header-info">
          <div className="client-header-breadcrumbs">
            <span style={{ cursor: 'pointer' }} onClick={onNavigateToVehicleDirectory}>Fleet & Vehicles</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Vendor–Vehicle Tie-up Approval</span>
          </div>
          <h1 className="client-directory-title">Vendor–Vehicle Tie-up Approvals</h1>
          <p className="client-directory-desc">
            Review, verify and approve vehicles linked by vendors for transport and brokerage operations.
          </p>
        </div>

        <div className="client-header-actions">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-action-outline"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateToVehicleDirectory}
            className="btn-create-orange"
          >
            <Truck size={16} strokeWidth={2.5} />
            <span>Vehicle Directory</span>
          </button>
        </div>
      </div>

      {/* 4 Equal-Width Pastel KPI Cards */}
      <div className="client-kpi-bar">
        {/* Pending Approval */}
        <div
          className={`kpi-stat-card ${activeTab === 'PENDING' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('PENDING'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle amber">
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Pending Approval</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">{loading ? '—' : stats.pendingApproval}</div>
          </div>
        </div>

        {/* Approved Tie-ups */}
        <div
          className={`kpi-stat-card ${activeTab === 'APPROVED' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('APPROVED'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Approved Tie-ups</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">{loading ? '—' : stats.approvedTieups}</div>
          </div>
        </div>

        {/* Rejected Tie-ups */}
        <div
          className={`kpi-stat-card ${activeTab === 'REJECTED' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('REJECTED'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle red">
            <XCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Rejected Tie-ups</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">{loading ? '—' : stats.rejectedTieups}</div>
          </div>
        </div>

        {/* Total Tie-ups */}
        <div
          className={`kpi-stat-card ${activeTab === 'ALL' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('ALL'); setPage(1); }}
        >
          <div className="kpi-avatar-squircle orange">
            <Shield size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Tie-ups</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">{loading ? '—' : stats.totalTieups}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar Card */}
      <div className="filters-bar-card">
        <div className="filter-input-wrap">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            className="filter-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by vendor name, vehicle registration number..."
          />
          {searchQuery && (
            <button
              className="filter-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button onClick={handleSearch} className="btn-filter-search">
          <Search size={14} />
          <span>Search</span>
        </button>

        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setPage(1);
            }}
            className="btn-filter-reset"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Sub-bar: Status Tabs & Actions */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`status-tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'ALL' && `All Requests (${stats.totalTieups})`}
              {tab === 'PENDING' && `Pending (${stats.pendingApproval})`}
              {tab === 'APPROVED' && `Approved (${stats.approvedTieups})`}
              {tab === 'REJECTED' && `Rejected (${stats.rejectedTieups})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="client-table-card">
        <div className="table-wrapper">
          {loading && !refreshing ? (
            <div className="empty-loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <p>Loading tie-up requests...</p>
            </div>
          ) : error ? (
            <div className="table-empty-state">
              <div className="empty-state-icon-box" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                <AlertTriangle size={32} />
              </div>
              <h4 className="empty-state-heading">Failed to load tie-up requests</h4>
              <p className="empty-state-text">{error}</p>
              <button onClick={handleRefresh} className="btn-filter-reset" style={{ margin: '0 auto' }}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : tieupRequests.length === 0 ? (
            <div className="table-empty-state">
              <div className="empty-state-icon-box">
                <Truck size={32} />
              </div>
              <h4 className="empty-state-heading">No tie-up requests found</h4>
              <p className="empty-state-text">
                {searchQuery ? 'Try adjusting your search query.' : 'Tie-up requests will appear here when vendors link vehicles to operations.'}
              </p>
            </div>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Vehicle Registration ⇅</th>
                  <th>Vehicle Type ⇅</th>
                  <th>Capacity (MT) ⇅</th>
                  <th>Vendor Partner ⇅</th>
                  <th>Request Date ⇅</th>
                  <th>Tie-up Status ⇅</th>
                  <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="client-data-row"
                    onClick={() => handleReviewTieup(request.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="client-info-cell">
                        <div className="kpi-avatar-squircle orange" style={{ width: '34px', height: '34px' }}>
                          <Truck size={16} />
                        </div>
                        <div>
                          <div className="client-name-bold" style={{ fontFamily: 'monospace' }}>
                            {request.vehicle?.registration_number || '—'}
                          </div>
                          <div className="client-id-sub">
                            {request.vehicle?.make ? `${request.vehicle.make} ${request.vehicle.model || ''}` : 'Commercial Vehicle'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="vendor-type-pill">{request.vehicle?.vehicle_type || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#172B4D' }}>
                        {request.vehicle?.rated_capacity_mt || '—'} MT
                      </span>
                    </td>
                    <td>
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        onClick={(e) => {
                          if (request.vendor?.id) {
                            e.stopPropagation();
                            onNavigateToVendorProfile(request.vendor.id);
                          }
                        }}
                      >
                        <Building2 size={15} color="#F05A22" />
                        <span style={{ fontWeight: 600, color: '#172B4D', textDecoration: 'underline' }}>
                          {request.vendor?.vendor_name || '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                        {formatDate(request.requested_at)}
                      </span>
                    </td>
                    <td>
                      {request.status === 'APPROVED' && (
                        <span className="status-pill-green">✓ Approved</span>
                      )}
                      {request.status === 'PENDING' && (
                        <span className="status-pill-amber">⏳ Pending</span>
                      )}
                      {request.status === 'REJECTED' && (
                        <span className="status-pill-red">✕ Rejected</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                      <div className="row-actions-group" style={{ justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewTieup(request.id);
                          }}
                          className="row-action-btn-circle"
                          title="Review Tie-up Request"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="client-pagination-bar">
            <div className="pagination-info">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(page * ITEMS_PER_PAGE, tieupRequests.length)} of {tieupRequests.length} requests
            </div>
            <div className="pagination-controls">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                &lt;
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Drawer */}
      {reviewingTieup && (
        <div
          className="drawer-overlay"
          onClick={() => {
            setReviewingTieup(null);
            setAuthDocument(null);
          }}
        >
          <div
            className="tieup-review-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingReview ? (
              <div className="flex items-center justify-center h-full" style={{ padding: '80px', textAlign: 'center' }}>
                <RefreshCw size={32} className="text-[#F45325] animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="tieup-drawer-header">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-[#111111]">Review Vendor–Vehicle Tie-up</h2>
                    <button
                      onClick={() => {
                        setReviewingTieup(null);
                        setAuthDocument(null);
                      }}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <X size={20} className="text-[rgba(17,17,17,0.60)]" />
                    </button>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border ${
                      reviewingTieup.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : reviewingTieup.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {reviewingTieup.status === 'APPROVED' && <CheckCircle size={16} />}
                    {reviewingTieup.status === 'REJECTED' && <XCircle size={16} />}
                    {reviewingTieup.status === 'PENDING' && <Clock size={16} />}
                    {reviewingTieup.status}
                  </div>
                </div>

                {/* Content */}
                <div className="tieup-drawer-content">
                  {/* Vendor Details */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Building2 size={20} className="text-[#F45325]" />
                      Vendor Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vendor Name</span>
                        <span className="text-slate-900 font-semibold">
                          {reviewingTieup.vendor?.vendor_name || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">PAN</span>
                        <span className="text-slate-800 font-mono text-sm">{reviewingTieup.vendor?.pan || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">GSTIN</span>
                        <span className="text-slate-800 font-mono text-sm">{reviewingTieup.vendor?.gstin || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vendor Status</span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            reviewingTieup.vendor?.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {reviewingTieup.vendor?.status || '-'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigateToVendorProfile(reviewingTieup.vendor_id)}
                        className="w-full mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        <span>View Vendor Profile</span>
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Details */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Truck size={20} className="text-[#F45325]" />
                      Vehicle Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Registration Number</span>
                        <span className="text-slate-900 font-bold font-mono">
                          {reviewingTieup.vehicle?.registration_number || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vehicle Type</span>
                        <span className="text-slate-800 font-medium">{reviewingTieup.vehicle?.vehicle_type || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Make & Model</span>
                        <span className="text-slate-800 font-medium">
                          {reviewingTieup.vehicle?.make && reviewingTieup.vehicle?.model
                            ? `${reviewingTieup.vehicle.make} ${reviewingTieup.vehicle.model}`
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Rated Capacity</span>
                        <span className="text-slate-800 font-semibold">{reviewingTieup.vehicle?.rated_capacity_mt || '-'} MT</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Minimum Capacity</span>
                        <span className="text-slate-800 font-semibold">
                          {reviewingTieup.vehicle?.minimum_capacity_mt || '-'} MT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Vehicle Status</span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            reviewingTieup.vehicle?.verification_status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : reviewingTieup.vehicle?.verification_status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {reviewingTieup.vehicle?.verification_status || '-'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigateToVehicleVerification(reviewingTieup.vehicle_id)}
                        className="w-full mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        <span>View Vehicle Details</span>
                      </button>
                    </div>
                  </div>

                  {/* Authorization Document */}
                  {authDocument && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[#111111] mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-[#F45325]" />
                        Authorization Document
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[rgba(17,17,17,0.60)]">Document Type</span>
                          <span className="text-[#111111]">Tie-up Authorization</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[rgba(17,17,17,0.60)]">Uploaded</span>
                          <span className="text-[#111111]">{formatDateTime(authDocument.created_at)}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setPreviewDocUrl(authDocument.file_url)}
                            className="flex-1 px-4 py-2 bg-white text-[#111111] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye size={16} />
                            <span>View</span>
                          </button>
                          <a
                            href={authDocument.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2 bg-white text-[#111111] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {reviewingTieup.tie_up_proof_url && !authDocument && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[#111111] mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-[#F45325]" />
                        Tie-up Proof
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewDocUrl(reviewingTieup.tie_up_proof_url)}
                          className="flex-1 px-4 py-2 bg-white text-[#111111] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye size={16} />
                          <span>View Document</span>
                        </button>
                        <a
                          href={reviewingTieup.tie_up_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-white text-[#111111] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Request Details */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[#111111] mb-4 flex items-center gap-2">
                      <History size={20} className="text-[#F45325]" />
                      Request Timeline
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[rgba(17,17,17,0.60)]">Requested At</span>
                        <span className="text-[#111111]">{formatDateTime(reviewingTieup.requested_at)}</span>
                      </div>
                      {reviewingTieup.approved_at && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[rgba(17,17,17,0.60)]">Approved At</span>
                            <span className="text-[#111111]">{formatDateTime(reviewingTieup.approved_at)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[rgba(17,17,17,0.60)]">Approved By</span>
                            <span className="text-[#111111]">{reviewingTieup.approved_by || '-'}</span>
                          </div>
                        </>
                      )}
                      {reviewingTieup.rejected_at && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[rgba(17,17,17,0.60)]">Rejected At</span>
                            <span className="text-[#111111]">{formatDateTime(reviewingTieup.rejected_at)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[rgba(17,17,17,0.60)]">Rejected By</span>
                            <span className="text-[#111111]">{reviewingTieup.rejected_by || '-'}</span>
                          </div>
                          {reviewingTieup.rejection_reason && (
                            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                              <p className="text-sm text-rose-700">
                                <span className="font-semibold">Rejection Reason:</span> {reviewingTieup.rejection_reason}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Validation Messages */}
                  {reviewingTieup.status === 'PENDING' && (
                    <div className="space-y-3">
                      {reviewingTieup.vehicle?.verification_status !== 'APPROVED' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-800 font-semibold mb-1">Vehicle Not Approved</p>
                            <p className="text-sm text-amber-700">
                              The vehicle must be verified and approved before this tie-up can be approved.
                            </p>
                          </div>
                        </div>
                      )}
                      {reviewingTieup.vendor?.status !== 'APPROVED' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-800 font-semibold mb-1">Vendor Not Approved</p>
                            <p className="text-sm text-amber-700">
                              The vendor must be approved before this tie-up can be approved.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {reviewingTieup.status === 'PENDING' && (
                  <div className="tieup-drawer-footer">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleApproveTieup}
                        disabled={
                          saving ||
                          reviewingTieup.vehicle?.verification_status !== 'APPROVED' ||
                          reviewingTieup.vendor?.status !== 'APPROVED'
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <CheckCircle size={20} />
                        <span>{saving ? 'Approving...' : 'Approve Transporter Link'}</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50 font-medium"
                      >
                        <XCircle size={20} />
                        <span>Reject Tie-up</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocUrl && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-6"
          onClick={() => setPreviewDocUrl(null)}
        >
          <div
            className="bg-white border border-slate-200 shadow-2xl rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Document Preview</h3>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                <iframe src={previewDocUrl} className="w-full h-full" title="Document Preview" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-6">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Reject Tie-up Request</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Please provide a reason for rejecting this vendor-vehicle tie-up request. This will be visible to the
                vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none text-sm"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectTieup}
                  disabled={saving || !rejectionReason.trim()}
                  className="flex-1 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

