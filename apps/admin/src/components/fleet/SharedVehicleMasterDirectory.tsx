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

interface SharedVehicleMasterDirectoryProps {
  onNavigateToVerification: (vehicleId: string) => void;
  onNavigateToAddVehicle: () => void;
}

const ITEMS_PER_PAGE = 10;

// Helper function to get expiry status
function getExpiryStatus(expiryDate: string | null): {
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_DATE';
  color: string;
  label: string;
} {
  if (!expiryDate) {
    return { status: 'NO_DATE', color: 'text-gray-400', label: 'No Date' };
  }

  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: 'EXPIRED', color: 'text-red-600', label: 'Expired' };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'EXPIRING_SOON', color: 'text-amber-600', label: `${daysUntilExpiry}d left` };
  } else {
    return { status: 'VALID', color: 'text-emerald-600', label: 'Valid' };
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

  // Selected vehicle drawer
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

      // Apply search
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      // Apply verification status filter based on active tab
      if (activeTab === 'VERIFIED') {
        filters.verificationStatus = 'APPROVED';
      } else if (activeTab === 'PENDING') {
        filters.verificationStatus = 'PENDING_DOCS';
      } else if (activeTab === 'REJECTED') {
        filters.verificationStatus = 'REJECTED';
      }

      // Apply vehicle type filter
      if (vehicleTypeFilter !== 'ALL') {
        filters.vehicleType = vehicleTypeFilter;
      }

      // Apply expiry warning filter
      if (expiryWarningFilter !== 'ALL') {
        filters.expiryWarning = expiryWarningFilter;
      }

      const pagination: PaginationParams = {
        page,
        pageSize: ITEMS_PER_PAGE,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      const response = await getVehicles(filters, pagination);

      setVehicles(response.vehicles);
      setTotal(response.total);
      setTotalPages(response.totalPages);

      // Fetch transporter counts for each vehicle
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

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchVehicles();
  }, []);

  // Refetch when filters or pagination changes
  useEffect(() => {
    if (!loading) {
      fetchVehicles();
    }
  }, [page, activeTab, vehicleTypeFilter, expiryWarningFilter]);

  // Handle search
  const handleSearch = () => {
    setPage(1);
    fetchVehicles();
  };

  // Handle refresh
  const handleRefresh = () => {
    setPage(1);
    fetchStats();
    fetchVehicles(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setVehicleTypeFilter('ALL');
    setExpiryWarningFilter('ALL');
    setActiveTab('ALL');
    setPage(1);
  };

  // Handle vehicle click
  const handleVehicleClick = (vehicleId: string) => {
    onNavigateToVerification(vehicleId);
  };

  // Get overall document status
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
      return { status: 'APPROVED', label: 'All Verified', color: 'text-emerald-600 bg-emerald-50' };
    } else if (rejected > 0) {
      return { status: 'REJECTED', label: `${rejected} Rejected`, color: 'text-red-600 bg-red-50' };
    } else if (pending > 0) {
      return { status: 'PENDING', label: `${pending} Pending`, color: 'text-amber-600 bg-amber-50' };
    } else {
      return { status: 'MIXED', label: 'Mixed', color: 'text-gray-600 bg-gray-50' };
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0E]">
      {/* Header */}
      <div className="border-b border-[#2A2A2C]">
        <div className="px-8 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <span>Fleet & Vehicles</span>
            <ChevronDown size={14} className="rotate-[-90deg]" />
            <span className="text-[#FF6B35]">Shared Vehicle Master</span>
          </div>

          {/* Title & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-[#F8F8F8] mb-2">
                Shared Vehicle Master Directory
              </h1>
              <p className="text-gray-400">
                Manage all registered and shared vehicles across vendors. Track verification status, capacity and availability.
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
                onClick={onNavigateToAddVehicle}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-[#0D0D0E] rounded-lg hover:bg-[#FFF0E8] transition-colors font-medium"
              >
                <Plus size={18} />
                <span>Add Shared Vehicle</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Total Vehicles */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-[#2A2A2C] rounded-lg">
                <Truck size={24} className="text-[#FF6B35]" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">
              {stats.totalVehicles}
            </div>
            <div className="text-sm text-gray-400">Total Vehicles</div>
          </div>

          {/* Verified Vehicles */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <CheckCircle size={24} className="text-emerald-500" />
              </div>
              <div className="flex items-center gap-1 text-emerald-500 text-sm">
                <TrendingUp size={16} />
                <span>{stats.verifiedPercentage}%</span>
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">
              {stats.verifiedVehicles}
            </div>
            <div className="text-sm text-gray-400">Verified Vehicles</div>
          </div>

          {/* Pending Verification */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Clock size={24} className="text-amber-500" />
              </div>
              <div className="flex items-center gap-1 text-amber-500 text-sm">
                <span>{stats.pendingPercentage}%</span>
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">
              {stats.pendingVerification}
            </div>
            <div className="text-sm text-gray-400">Pending Verification</div>
          </div>

          {/* Rejected Vehicles */}
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <XCircle size={24} className="text-red-500" />
              </div>
            </div>
            <div className="text-3xl font-semibold text-[#F8F8F8] mb-1">
              {stats.rejectedVehicles}
            </div>
            <div className="text-sm text-gray-400">Rejected Vehicles</div>
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
              placeholder="Search by vehicle no, vendor name, vehicle type..."
              className="w-full pl-12 pr-4 py-3 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] placeholder-gray-500 focus:outline-none focus:border-[#FF6B35]"
            />
          </div>

          {/* Vehicle Type Filter */}
          <select
            value={vehicleTypeFilter}
            onChange={(e) => {
              setVehicleTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-3 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] focus:outline-none focus:border-[#FF6B35] min-w-[180px]"
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

          {/* Expiry Warning Filter */}
          <select
            value={expiryWarningFilter}
            onChange={(e) => {
              setExpiryWarningFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-4 py-3 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] focus:outline-none focus:border-[#FF6B35] min-w-[200px]"
          >
            <option value="ALL">All Document Status</option>
            <option value="EXPIRING_SOON">Expiring Soon (30 days)</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] hover:bg-[#2A2A2C] transition-colors flex items-center gap-2"
          >
            <Filter size={18} />
            <span>More Filters</span>
          </button>

          {/* Reset Filters */}
          {(searchQuery || vehicleTypeFilter !== 'ALL' || expiryWarningFilter !== 'ALL' || activeTab !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center gap-2"
            >
              <X size={18} />
              <span>Reset</span>
            </button>
          )}

          {/* Export */}
          <button className="px-4 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors flex items-center gap-2">
            <Download size={18} />
            <span>Export</span>
          </button>
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
            <span className="font-medium">All ({stats.totalVehicles})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('VERIFIED');
              setPage(1);
            }}
            className={`px-1 py-4 border-b-2 transition-colors ${
              activeTab === 'VERIFIED'
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-400 hover:text-[#F8F8F8]'
            }`}
          >
            <span className="font-medium">Verified ({stats.verifiedVehicles})</span>
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
            <span className="font-medium">Pending ({stats.pendingVerification})</span>
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
            <span className="font-medium">Rejected ({stats.rejectedVehicles})</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        {loading && !refreshing ? (
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-12 text-center">
            <RefreshCw size={32} className="text-[#FF6B35] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading vehicles...</p>
          </div>
        ) : error ? (
          <div className="bg-[#1A1A1C] border border-red-500/20 rounded-xl p-12 text-center">
            <XCircle size={32} className="text-red-500 mx-auto mb-4" />
            <p className="text-red-400 mb-2">Failed to load vehicles</p>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-12 text-center">
            <Truck size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-[#F8F8F8] text-lg mb-2">No vehicles found</p>
            <p className="text-gray-400 mb-6">
              {searchQuery || vehicleTypeFilter !== 'ALL' || expiryWarningFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Add your first shared vehicle to get started'}
            </p>
            {!searchQuery && vehicleTypeFilter === 'ALL' && expiryWarningFilter === 'ALL' && (
              <button
                onClick={onNavigateToAddVehicle}
                className="px-6 py-2.5 bg-[#FF6B35] text-[#0D0D0E] rounded-lg hover:bg-[#FFF0E8] transition-colors font-medium"
              >
                Add Shared Vehicle
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl overflow-x-auto">
              <table className="w-full" style={{ minWidth: '1080px' }}>
                <thead className="bg-[#0D0D0E] border-b border-[#2A2A2C]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Vehicle No.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Vehicle Type & Body
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Rated Capacity (MT)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Min Capacity (MT)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Linked Transporters
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      RC Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Insurance Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Fitness Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Permit Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Overall Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2C]">
                  {vehicles.map((vehicle) => {
                    const rcStatus = getExpiryStatus(vehicle.rc_expiry_date);
                    const insuranceStatus = getExpiryStatus(vehicle.insurance_expiry_date);
                    const fitnessStatus = getExpiryStatus(vehicle.fitness_expiry_date);
                    const permitStatus = getExpiryStatus(vehicle.permit_expiry_date);
                    const overallStatus = getOverallDocStatus(vehicle);
                    const transporterCount = transporterCounts[vehicle.id] || 0;

                    return (
                      <tr
                        key={vehicle.id}
                        className="hover:bg-[#2A2A2C]/30 transition-colors cursor-pointer"
                        onClick={() => handleVehicleClick(vehicle.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2A2A2C] rounded-lg flex items-center justify-center">
                              <Truck size={20} className="text-[#FF6B35]" />
                            </div>
                            <div>
                              <div className="text-[#F8F8F8] font-medium">{vehicle.registration_number}</div>
                              {vehicle.make && vehicle.model && (
                                <div className="text-xs text-gray-400">{vehicle.make} {vehicle.model}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[#F8F8F8]">{vehicle.vehicle_type}</div>
                          {vehicle.body_type && (
                            <div className="text-xs text-gray-400">{vehicle.body_type}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-[#F8F8F8]">
                          {vehicle.rated_capacity_mt} MT
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-[#F8F8F8]">
                          {vehicle.minimum_capacity_mt} MT
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-gray-400" />
                            <span className="text-[#F8F8F8]">{transporterCount}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {vehicle.rc_verification_status === 'APPROVED' && (
                              <CheckCircle size={16} className="text-emerald-500" />
                            )}
                            {vehicle.rc_verification_status === 'PENDING' && (
                              <Clock size={16} className="text-amber-500" />
                            )}
                            {vehicle.rc_verification_status === 'REJECTED' && (
                              <XCircle size={16} className="text-red-500" />
                            )}
                            <span className={rcStatus.color}>{rcStatus.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {vehicle.insurance_verification_status === 'APPROVED' && (
                              <CheckCircle size={16} className="text-emerald-500" />
                            )}
                            {vehicle.insurance_verification_status === 'PENDING' && (
                              <Clock size={16} className="text-amber-500" />
                            )}
                            {vehicle.insurance_verification_status === 'REJECTED' && (
                              <XCircle size={16} className="text-red-500" />
                            )}
                            <span className={insuranceStatus.color}>{insuranceStatus.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {vehicle.fitness_verification_status === 'APPROVED' && (
                              <CheckCircle size={16} className="text-emerald-500" />
                            )}
                            {vehicle.fitness_verification_status === 'PENDING' && (
                              <Clock size={16} className="text-amber-500" />
                            )}
                            {vehicle.fitness_verification_status === 'REJECTED' && (
                              <XCircle size={16} className="text-red-500" />
                            )}
                            <span className={fitnessStatus.color}>{fitnessStatus.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {vehicle.permit_verification_status === 'APPROVED' && (
                              <CheckCircle size={16} className="text-emerald-500" />
                            )}
                            {vehicle.permit_verification_status === 'PENDING' && (
                              <Clock size={16} className="text-amber-500" />
                            )}
                            {vehicle.permit_verification_status === 'REJECTED' && (
                              <XCircle size={16} className="text-red-500" />
                            )}
                            <span className={permitStatus.color}>{permitStatus.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${overallStatus.color}`}>
                            {overallStatus.status === 'APPROVED' && <CheckCircle size={14} />}
                            {overallStatus.status === 'PENDING' && <Clock size={14} />}
                            {overallStatus.status === 'REJECTED' && <XCircle size={14} />}
                            {overallStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVehicleClick(vehicle.id);
                            }}
                            className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors group"
                            title="Inspect Vehicle Vault"
                          >
                            <Eye size={18} className="text-gray-400 group-hover:text-[#FF6B35]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-400">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, total)} of {total} vehicles
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
              <select
                value={ITEMS_PER_PAGE}
                className="px-3 py-1.5 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] text-sm focus:outline-none focus:border-[#FF6B35]"
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

