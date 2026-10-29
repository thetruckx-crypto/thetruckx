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

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
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

    try {
      setSaving(true);
      await approveVendorVehicleTieup(reviewingTieup.id, 'Admin');
      showSuccess('Vendor-vehicle tie-up approved successfully');
      setShowApproveModal(false);
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

      {/* Review Drawer - Premium Enterprise UI/UX */}
      {reviewingTieup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => {
            setReviewingTieup(null);
            setAuthDocument(null);
          }}
        >
          <div
            style={{
              width: '580px',
              maxWidth: '100vw',
              height: '100vh',
              backgroundColor: '#FFFFFF',
              boxShadow: '-10px 0 35px rgba(15, 23, 42, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              animation: 'slideDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingReview ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                <RefreshCw size={36} className="text-[#F45325] animate-spin" />
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading tie-up details...</span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div>
                    <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Vendor–Vehicle Tie-up Review
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B', fontWeight: 600 }}>
                        TIE-#{reviewingTieup.id?.substring(0, 8).toUpperCase()}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: reviewingTieup.status === 'APPROVED' ? '#ECFDF5' : reviewingTieup.status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB',
                          color: reviewingTieup.status === 'APPROVED' ? '#059669' : reviewingTieup.status === 'REJECTED' ? '#DC2626' : '#D97706',
                          border: `1px solid ${reviewingTieup.status === 'APPROVED' ? '#A7F3D0' : reviewingTieup.status === 'REJECTED' ? '#FECACA' : '#FDE68A'}`
                        }}
                      >
                        {reviewingTieup.status === 'APPROVED' && <CheckCircle size={12} />}
                        {reviewingTieup.status === 'REJECTED' && <XCircle size={12} />}
                        {reviewingTieup.status === 'PENDING' && <Clock size={12} />}
                        <span>{reviewingTieup.status}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Close Drawer"
                    onClick={() => {
                      setReviewingTieup(null);
                      setAuthDocument(null);
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#0F172A'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Vendor Information */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={18} style={{ color: '#F45325' }} />
                        <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>Transporter Information</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: reviewingTieup.vendor?.status === 'APPROVED' ? '#ECFDF5' : '#FFFBEB',
                          color: reviewingTieup.vendor?.status === 'APPROVED' ? '#059669' : '#D97706',
                          border: `1px solid ${reviewingTieup.vendor?.status === 'APPROVED' ? '#A7F3D0' : '#FDE68A'}`
                        }}
                      >
                        {reviewingTieup.vendor?.status || 'PENDING'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Vendor Company</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          {reviewingTieup.vendor?.vendor_name || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Vendor Code</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vendor?.vendor_code || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>PAN Number</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vendor?.pan || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>GSTIN</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vendor?.gstin || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Hub / Location</div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vendor?.city ? `${reviewingTieup.vendor.city}, ${reviewingTieup.vendor.state || ''}` : '-'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToVendorProfile(reviewingTieup.vendor_id)}
                      style={{
                        width: '100%',
                        marginTop: '16px',
                        padding: '9px 14px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F172A',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      <ExternalLink size={14} />
                      <span>View Transporter Profile</span>
                    </button>
                  </div>

                  {/* Card 2: Vehicle Information */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} style={{ color: '#F45325' }} />
                        <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>Vehicle Information</span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: reviewingTieup.vehicle?.verification_status === 'APPROVED' ? '#ECFDF5' : reviewingTieup.vehicle?.verification_status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB',
                          color: reviewingTieup.vehicle?.verification_status === 'APPROVED' ? '#059669' : reviewingTieup.vehicle?.verification_status === 'REJECTED' ? '#DC2626' : '#D97706',
                          border: `1px solid ${reviewingTieup.vehicle?.verification_status === 'APPROVED' ? '#A7F3D0' : reviewingTieup.vehicle?.verification_status === 'REJECTED' ? '#FECACA' : '#FDE68A'}`
                        }}
                      >
                        {reviewingTieup.vehicle?.verification_status || 'PENDING'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Registration Number</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#0F172A', letterSpacing: '0.04em' }}>
                          {reviewingTieup.vehicle?.registration_number || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Vehicle Type</div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vehicle?.vehicle_type || '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Make & Model</div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vehicle?.make && reviewingTieup.vehicle?.model
                            ? `${reviewingTieup.vehicle.make} ${reviewingTieup.vehicle.model}`
                            : '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Rated Capacity</div>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>
                          {reviewingTieup.vehicle?.rated_capacity_mt ? `${reviewingTieup.vehicle.rated_capacity_mt} MT` : '-'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>Min Capacity</div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>
                          {reviewingTieup.vehicle?.minimum_capacity_mt ? `${reviewingTieup.vehicle.minimum_capacity_mt} MT` : '-'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToVehicleVerification(reviewingTieup.vehicle_id)}
                      style={{
                        width: '100%',
                        marginTop: '16px',
                        padding: '9px 14px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F172A',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      <ExternalLink size={14} />
                      <span>View Vehicle Details & Verification</span>
                    </button>
                  </div>

                  {/* Card 3: Tie-up Proof / Authorization Document */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <FileText size={18} style={{ color: '#F45325' }} />
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>Authorization Document</span>
                    </div>

                    {authDocument ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                          <span style={{ color: '#64748B' }}>Document Type</span>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>Tie-up Agreement Letter</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '12px' }}>
                          <span style={{ color: '#64748B' }}>Uploaded Timestamp</span>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatDateTime(authDocument.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewDocUrl(authDocument.file_url)}
                            style={{ flex: 1, padding: '8px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#0F172A', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            <Eye size={14} />
                            <span>Preview</span>
                          </button>
                          <a
                            href={authDocument.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flex: 1, padding: '8px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#0F172A', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ) : reviewingTieup.tie_up_proof_url ? (
                      <div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewDocUrl(reviewingTieup.tie_up_proof_url)}
                            style={{ flex: 1, padding: '8px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#0F172A', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            <Eye size={14} />
                            <span>Preview Document</span>
                          </button>
                          <a
                            href={reviewingTieup.tie_up_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flex: 1, padding: '8px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', color: '#0F172A', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', fontSize: '12.5px', color: '#64748B', textAlign: 'center' }}>
                        No physical tie-up letter attached with this request.
                      </div>
                    )}
                  </div>

                  {/* Card 4: Request Timeline */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <History size={18} style={{ color: '#F45325' }} />
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>Request Timeline</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Requested At:</span>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatDateTime(reviewingTieup.requested_at)}</span>
                      </div>
                      {reviewingTieup.approved_at && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Approved At:</span>
                            <span style={{ fontWeight: 600, color: '#059669' }}>{formatDateTime(reviewingTieup.approved_at)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Approved By:</span>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>{reviewingTieup.approved_by || 'Admin'}</span>
                          </div>
                        </>
                      )}
                      {reviewingTieup.rejected_at && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Rejected At:</span>
                            <span style={{ fontWeight: 600, color: '#DC2626' }}>{formatDateTime(reviewingTieup.rejected_at)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748B' }}>Rejected By:</span>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>{reviewingTieup.rejected_by || 'Admin'}</span>
                          </div>
                          {reviewingTieup.rejection_reason && (
                            <div style={{ marginTop: '6px', padding: '10px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', fontSize: '12px', lineHeight: 1.5 }}>
                              <strong>Rejection Reason:</strong> {reviewingTieup.rejection_reason}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pre-requisite Warnings (if PENDING) */}
                  {reviewingTieup.status === 'PENDING' && (
                    <>
                      {reviewingTieup.vehicle?.verification_status !== 'APPROVED' && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>Vehicle Verification Pending</div>
                            <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                              The vehicle must be verified and approved in Vehicle Master before this tie-up can be approved.
                            </div>
                          </div>
                        </div>
                      )}
                      {reviewingTieup.vendor?.status !== 'APPROVED' && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>Transporter Not Approved</div>
                            <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
                              The vendor must have approved KYC status before linking fleet vehicles.
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Fixed Footer Actions */}
                <div
                  style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                  }}
                >
                  {reviewingTieup.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowApproveModal(true)}
                        disabled={
                          saving ||
                          reviewingTieup.vehicle?.verification_status !== 'APPROVED' ||
                          reviewingTieup.vendor?.status !== 'APPROVED'
                        }
                        style={{
                          flex: 1,
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13.5px',
                          cursor: (saving || reviewingTieup.vehicle?.verification_status !== 'APPROVED' || reviewingTieup.vendor?.status !== 'APPROVED') ? 'not-allowed' : 'pointer',
                          opacity: (saving || reviewingTieup.vehicle?.verification_status !== 'APPROVED' || reviewingTieup.vendor?.status !== 'APPROVED') ? 0.5 : 1,
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <CheckCircle size={17} />
                        <span>{saving ? 'Approving...' : 'Approve Tie-up'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        disabled={saving}
                        style={{
                          flex: 1,
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13.5px',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <XCircle size={17} />
                        <span>Reject Tie-up</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingTieup(null);
                        setAuthDocument(null);
                      }}
                      style={{
                        width: '100%',
                        height: '42px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: '#0F172A',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Close Details
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Tie-up Approval */}
      {showApproveModal && reviewingTieup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '24px'
          }}
          onClick={() => setShowApproveModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Approve Vendor–Vehicle Tie-up
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Confirm linking this vehicle to the transporter in active fleet.
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '13px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Transporter:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{reviewingTieup.vendor?.vendor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Vehicle Reg:</span>
                <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0F172A' }}>{reviewingTieup.vehicle?.registration_number}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleApproveTieup}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
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

