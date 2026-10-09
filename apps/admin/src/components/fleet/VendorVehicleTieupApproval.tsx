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
} from 'lucide-react';
import {
  getVendorVehicleTieupRequests,
  getTieupRequestById,
  approveVendorVehicleTieup,
  rejectVendorVehicleTieup,
  getTieupStats,
  getTieupAuthorizationDocument,
} from '../../services/vehicleService';

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

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchTieupRequests();
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
      alert(`Failed to load tie-up details: ${err.message}`);
    } finally {
      setLoadingReview(false);
    }
  };

  // Show success message
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle approve tie-up
  const handleApproveTieup = async () => {
    if (!reviewingTieup) return;

    // Validation checks
    if (reviewingTieup.vehicle?.verification_status !== 'APPROVED') {
      alert('Vehicle must be approved before approving the tie-up');
      return;
    }

    if (reviewingTieup.vendor?.status !== 'APPROVED') {
      alert('Vendor must be approved before approving the tie-up');
      return;
    }

    if (!window.confirm('Are you sure you want to approve this vendor-vehicle tie-up?')) {
      return;
    }

    try {
      setSaving(true);
      await approveVendorVehicleTieup(reviewingTieup.id, 'Admin'); // TODO: Get actual admin ID
      showSuccess('Vendor-vehicle tie-up approved successfully');
      setReviewingTieup(null);
      setAuthDocument(null);
      await fetchStats();
      await fetchTieupRequests();
    } catch (err: any) {
      alert(`Failed to approve tie-up: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject tie-up
  const handleRejectTieup = async () => {
    if (!reviewingTieup || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVendorVehicleTieup(reviewingTieup.id, rejectionReason, 'Admin'); // TODO: Get actual admin ID
      showSuccess('Vendor-vehicle tie-up rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setReviewingTieup(null);
      setAuthDocument(null);
      await fetchStats();
      await fetchTieupRequests();
    } catch (err: any) {
      alert(`Failed to reject tie-up: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Paginate requests
  const paginatedRequests = tieupRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(tieupRequests.length / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#0D0D0E]">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#2A2A2C]">
        <div className="px-8 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <button onClick={onNavigateToVehicleDirectory} className="hover:text-[#FF6B35]">
              Fleet & Vehicles
            </button>
            <ChevronDown size={14} className="rotate-[-90deg]" />
            <span className="text-[#FF6B35]">Vendor–Vehicle Tie-up Approval</span>
          </div>

          {/* Title & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-[#F8F8F8] mb-2">Vendor–Vehicle Tie-up Approval</h1>
              <p className="text-gray-400">
                Review and approve vehicles linked by vendors for operations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                <span className="font-medium">Refresh</span>
              </button>
              <button
                onClick={onNavigateToVehicleDirectory}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-[#0D0D0E] rounded-lg hover:bg-[#FFF0E8] transition-colors font-medium"
              >
                <Truck size={18} />
                <span>Vehicle Directory</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Pending Approval */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Clock size={24} className="text-amber-500" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">{stats.pendingApproval}</div>
            <div className="text-sm text-gray-400">Pending Approval</div>
          </div>

          {/* Approved Tie-ups */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <CheckCircle size={24} className="text-emerald-500" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">{stats.approvedTieups}</div>
            <div className="text-sm text-gray-400">Approved Tie-ups</div>
          </div>

          {/* Rejected Tie-ups */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <XCircle size={24} className="text-red-500" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">{stats.rejectedTieups}</div>
            <div className="text-sm text-gray-400">Rejected Tie-ups</div>
          </div>

          {/* Total Tie-ups */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-[#2A2A2C] rounded-lg">
                <Shield size={24} className="text-[#FF6B35]" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">{stats.totalTieups}</div>
            <div className="text-sm text-gray-400">Total Tie-ups</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-8 py-4 border-b border-[#2A2A2C]">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by vendor name, vehicle no..."
              className="w-full pl-12 pr-4 py-3 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] placeholder-gray-500 focus:outline-none focus:border-[#FF6B35]"
            />
          </div>

          {/* Reset Search */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="px-4 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center gap-2"
            >
              <X size={18} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-[#2A2A2C] overflow-x-auto">
        <div className="flex items-center gap-6 whitespace-nowrap">
          <button
            onClick={() => {
              setActiveTab('ALL');
              setPage(1);
            }}
            className={`px-1 py-4 border-b-2 transition-colors ${
              activeTab === 'ALL'
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-400 hover:text-[#F8F8F8]'
            }`}
          >
            <span className="font-medium">All Requests ({stats.totalTieups})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('PENDING');
              setPage(1);
            }}
            className={`px-1 py-4 border-b-2 transition-colors ${
              activeTab === 'PENDING'
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-400 hover:text-[#F8F8F8]'
            }`}
          >
            <span className="font-medium">Pending ({stats.pendingApproval})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('APPROVED');
              setPage(1);
            }}
            className={`px-1 py-4 border-b-2 transition-colors ${
              activeTab === 'APPROVED'
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-400 hover:text-[#F8F8F8]'
            }`}
          >
            <span className="font-medium">Approved ({stats.approvedTieups})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('REJECTED');
              setPage(1);
            }}
            className={`px-1 py-4 border-b-2 transition-colors ${
              activeTab === 'REJECTED'
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-400 hover:text-[#F8F8F8]'
            }`}
          >
            <span className="font-medium">Rejected ({stats.rejectedTieups})</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        {loading && !refreshing ? (
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-12 text-center">
            <RefreshCw size={32} className="text-[#FF6B35] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading tie-up requests...</p>
          </div>
        ) : error ? (
          <div className="bg-[#1A1A1C] border border-red-500/20 rounded-xl p-12 text-center">
            <XCircle size={32} className="text-red-500 mx-auto mb-4" />
            <p className="text-red-400 mb-2">Failed to load tie-up requests</p>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : tieupRequests.length === 0 ? (
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-12 text-center">
            <Shield size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-[#F8F8F8] text-lg mb-2">No tie-up requests found</p>
            <p className="text-gray-400">
              {searchQuery ? 'Try adjusting your search' : 'Tie-up requests will appear here when vendors link vehicles'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl overflow-x-auto">
              <table className="w-full" style={{ minWidth: '960px' }}>
                <thead className="bg-[#0D0D0E] border-b border-[#2A2A2C]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Vehicle No.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Vehicle Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Capacity (MT)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Vendor Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Request Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2C]">
                  {paginatedRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-[#2A2A2C]/30 transition-colors cursor-pointer"
                      onClick={() => handleReviewTieup(request.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#2A2A2C] rounded-lg flex items-center justify-center">
                            <Truck size={20} className="text-[#FF6B35]" />
                          </div>
                          <div>
                            <div className="text-[#F8F8F8] font-medium">
                              {request.vehicle?.registration_number || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#F8F8F8]">
                        {request.vehicle?.vehicle_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#F8F8F8]">
                        {request.vehicle?.rated_capacity_mt || '-'} MT
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-gray-400" />
                          <span className="text-[#F8F8F8]">{request.vendor?.vendor_name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                        {formatDate(request.requested_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            request.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : request.status === 'REJECTED'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {request.status === 'APPROVED' && <CheckCircle size={14} />}
                          {request.status === 'REJECTED' && <XCircle size={14} />}
                          {request.status === 'PENDING' && <Clock size={14} />}
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReviewTieup(request.id);
                          }}
                          className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors group"
                          title="Review Tie-up"
                        >
                          <Eye size={18} className="text-gray-400 group-hover:text-[#FF6B35]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-400">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(page * ITEMS_PER_PAGE, tieupRequests.length)} of {tieupRequests.length} requests
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] hover:bg-[#2A2A2C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-1">
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
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-[#FF6B35] text-[#0D0D0E]'
                              : 'bg-[#1A1A1C] border border-[#2A2A2C] text-[#F8F8F8] hover:bg-[#2A2A2C]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] hover:bg-[#2A2A2C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Drawer */}
      {reviewingTieup && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-end z-50"
          onClick={() => {
            setReviewingTieup(null);
            setAuthDocument(null);
          }}
        >
          <div
            className="bg-[#1A1A1C] w-full max-w-2xl h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingReview ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw size={32} className="text-[#FF6B35] animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-[#1A1A1C] border-b border-[#2A2A2C] px-8 py-6 z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-[#F8F8F8]">Review Vendor–Vehicle Tie-up</h2>
                    <button
                      onClick={() => {
                        setReviewingTieup(null);
                        setAuthDocument(null);
                      }}
                      className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
                    >
                      <X size={20} className="text-gray-400" />
                    </button>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                      reviewingTieup.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : reviewingTieup.status === 'REJECTED'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    {reviewingTieup.status === 'APPROVED' && <CheckCircle size={16} />}
                    {reviewingTieup.status === 'REJECTED' && <XCircle size={16} />}
                    {reviewingTieup.status === 'PENDING' && <Clock size={16} />}
                    {reviewingTieup.status}
                  </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-6">
                  {/* Vendor Details */}
                  <div className="bg-[#0D0D0E] border border-[#2A2A2C] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4 flex items-center gap-2">
                      <Building2 size={20} className="text-[#FF6B35]" />
                      Vendor Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Vendor Name</span>
                        <span className="text-[#F8F8F8] font-medium">
                          {reviewingTieup.vendor?.vendor_name || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">PAN</span>
                        <span className="text-[#F8F8F8]">{reviewingTieup.vendor?.pan || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">GSTIN</span>
                        <span className="text-[#F8F8F8]">{reviewingTieup.vendor?.gstin || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Vendor Status</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            reviewingTieup.vendor?.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {reviewingTieup.vendor?.status || '-'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigateToVendorProfile(reviewingTieup.vendor_id)}
                        className="w-full mt-3 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        <span>View Vendor Profile</span>
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Details */}
                  <div className="bg-[#0D0D0E] border border-[#2A2A2C] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4 flex items-center gap-2">
                      <Truck size={20} className="text-[#FF6B35]" />
                      Vehicle Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Registration Number</span>
                        <span className="text-[#F8F8F8] font-medium">
                          {reviewingTieup.vehicle?.registration_number || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Vehicle Type</span>
                        <span className="text-[#F8F8F8]">{reviewingTieup.vehicle?.vehicle_type || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Make & Model</span>
                        <span className="text-[#F8F8F8]">
                          {reviewingTieup.vehicle?.make && reviewingTieup.vehicle?.model
                            ? `${reviewingTieup.vehicle.make} ${reviewingTieup.vehicle.model}`
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Rated Capacity</span>
                        <span className="text-[#F8F8F8]">{reviewingTieup.vehicle?.rated_capacity_mt || '-'} MT</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Minimum Capacity</span>
                        <span className="text-[#F8F8F8]">
                          {reviewingTieup.vehicle?.minimum_capacity_mt || '-'} MT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Vehicle Status</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            reviewingTieup.vehicle?.verification_status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : reviewingTieup.vehicle?.verification_status === 'REJECTED'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {reviewingTieup.vehicle?.verification_status || '-'}
                        </span>
                      </div>
                      <button
                        onClick={() => onNavigateToVehicleVerification(reviewingTieup.vehicle_id)}
                        className="w-full mt-3 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        <span>View Vehicle Details</span>
                      </button>
                    </div>
                  </div>

                  {/* Authorization Document */}
                  {authDocument && (
                    <div className="bg-[#0D0D0E] border border-[#2A2A2C] rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-[#FF6B35]" />
                        Authorization Document
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Document Type</span>
                          <span className="text-[#F8F8F8]">Tie-up Authorization</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Uploaded</span>
                          <span className="text-[#F8F8F8]">{formatDateTime(authDocument.created_at)}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setPreviewDocUrl(authDocument.file_url)}
                            className="flex-1 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye size={16} />
                            <span>View</span>
                          </button>
                          <a
                            href={authDocument.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                          >
                            <Download size={16} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {reviewingTieup.tie_up_proof_url && !authDocument && (
                    <div className="bg-[#0D0D0E] border border-[#2A2A2C] rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-[#FF6B35]" />
                        Tie-up Proof
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewDocUrl(reviewingTieup.tie_up_proof_url)}
                          className="flex-1 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye size={16} />
                          <span>View Document</span>
                        </button>
                        <a
                          href={reviewingTieup.tie_up_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2"
                        >
                          <Download size={16} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Request Details */}
                  <div className="bg-[#0D0D0E] border border-[#2A2A2C] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4 flex items-center gap-2">
                      <History size={20} className="text-[#FF6B35]" />
                      Request Timeline
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Requested At</span>
                        <span className="text-[#F8F8F8]">{formatDateTime(reviewingTieup.requested_at)}</span>
                      </div>
                      {reviewingTieup.approved_at && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Approved At</span>
                            <span className="text-[#F8F8F8]">{formatDateTime(reviewingTieup.approved_at)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Approved By</span>
                            <span className="text-[#F8F8F8]">{reviewingTieup.approved_by || '-'}</span>
                          </div>
                        </>
                      )}
                      {reviewingTieup.rejected_at && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Rejected At</span>
                            <span className="text-[#F8F8F8]">{formatDateTime(reviewingTieup.rejected_at)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Rejected By</span>
                            <span className="text-[#F8F8F8]">{reviewingTieup.rejected_by || '-'}</span>
                          </div>
                          {reviewingTieup.rejection_reason && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                              <p className="text-sm text-red-400">
                                <span className="font-medium">Rejection Reason:</span> {reviewingTieup.rejection_reason}
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
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-500 font-medium mb-1">Vehicle Not Approved</p>
                            <p className="text-sm text-gray-400">
                              The vehicle must be verified and approved before this tie-up can be approved.
                            </p>
                          </div>
                        </div>
                      )}
                      {reviewingTieup.vendor?.status !== 'APPROVED' && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-500 font-medium mb-1">Vendor Not Approved</p>
                            <p className="text-sm text-gray-400">
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
                  <div className="sticky bottom-0 bg-[#1A1A1C] border-t border-[#2A2A2C] px-8 py-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleApproveTieup}
                        disabled={
                          saving ||
                          reviewingTieup.vehicle?.verification_status !== 'APPROVED' ||
                          reviewingTieup.vendor?.status !== 'APPROVED'
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <CheckCircle size={20} />
                        <span>{saving ? 'Approving...' : 'Approve Transporter Link'}</span>
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
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
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-6"
          onClick={() => setPreviewDocUrl(null)}
        >
          <div
            className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#2A2A2C]">
              <h3 className="text-xl font-semibold text-[#F8F8F8]">Document Preview</h3>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-[#0D0D0E] rounded-lg overflow-hidden">
                <iframe src={previewDocUrl} className="w-full h-full" title="Document Preview" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-6">
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-[#2A2A2C]">
              <h3 className="text-xl font-semibold text-[#F8F8F8]">Reject Tie-up Request</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-400 mb-4">
                Please provide a reason for rejecting this vendor-vehicle tie-up request. This will be visible to the
                vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-[#0D0D0E] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] resize-none"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectTieup}
                  disabled={saving || !rejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="px-6 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors font-medium"
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

