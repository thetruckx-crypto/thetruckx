import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  MoreVertical,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Truck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Users,
  ShieldCheck,
  Edit2,
  Ban,
  RotateCcw,
  Columns as ColumnsIcon,
  ExternalLink,
  Calendar,
  Check,
  Save,
  MessageSquare,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  ArrowRight,
  Lock,
  Copy,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Vehicle,
  VehicleFilters,
  PaginationParams,
  getVehicles,
  getVehicleStats,
  getVehicleTransporterCount,
  updateVehicle,
  approveVehicle,
  rejectVehicle,
  approveVehicleDocument,
  rejectVehicleDocument,
} from '../../services/vehicleService';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';
import { formatDisplayId } from '../../utils/idGenerator';

interface SharedVehicleMasterDirectoryProps {
  onNavigateToVerification: (vehicleId: string) => void;
  onNavigateToAddVehicle: () => void;
  onNavigateToVendorProfile?: (vendorId: string) => void;
  onNavigateToDriverProfile?: (driverId: string) => void;
}

// Helper to calculate avatar initials and consistent color
function getVendorAvatar(name?: string, id?: string) {
  const label = name || id || 'NE';
  const clean = label.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = clean.split(/\s+/);
  let initials = 'NE';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  } else if (parts[0]) {
    initials = parts[0].toUpperCase();
  }

  const palette = [
    '#1E293B', // dark slate/navy
    '#6B21A8', // purple
    '#047857', // emerald
    '#991B1B', // crimson
    '#1D4ED8', // blue
    '#C2410C', // orange-brown
    '#0F766E', // teal
    '#4338CA', // indigo
  ];
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = palette[Math.abs(hash) % palette.length];
  return { initials, bg };
}

// Helper to format date & time on a single line: e.g. "17 Oct 2026, 03:52 PM"
function formatSingleLineDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

const formatDateTime = formatSingleLineDateTime;

// Helper to format vehicle category nicely (clean underscores: 32FT_MXL -> 32FT MXL)
function formatVehicleCategory(cat?: string | null): string {
  if (!cat) return 'Standard Lorry';
  return cat.replace(/_/g, ' ').trim();
}

export const SharedVehicleMasterDirectory: React.FC<SharedVehicleMasterDirectoryProps> = ({
  onNavigateToVerification,
  onNavigateToAddVehicle,
  onNavigateToVendorProfile,
  onNavigateToDriverProfile,
}) => {
  const toast = useToast();

  // Vehicle data state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real Database Statistics
  const [stats, setStats] = useState({
    totalVehicles: 0,
    verifiedVehicles: 0,
    pendingVerification: 0,
    rejectedVehicles: 0,
    verifiedPercentage: 0,
    pendingPercentage: 0,
  });

  // Transporter & Vendor metadata cache
  const [transporterDetails, setTransporterDetails] = useState<
    Record<
      string,
      {
        vendorId?: string;
        vendorCode?: string;
        vendorName?: string;
        phone?: string;
        email?: string;
        ownership?: 'Owned' | 'Attached' | 'Both';
        count: number;
      }
    >
  >({});

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [bodyTypeFilter, setBodyTypeFilter] = useState('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [docStatusFilter, setDocStatusFilter] = useState('ALL');

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting State
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column Visibility State (Admin Customizable)
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    vendor: true,
    category: true,
    bodyType: true,
    ratedCapacity: true,
    minCapacity: true,
    ownership: true,
    documents: true,
    status: true,
    updatedAt: true,
  });

  // Handle column sort toggle
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Active Actions & Modals State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [fullViewVehicle, setFullViewVehicle] = useState<Vehicle | null>(null);

  // Floating Action Menu (aligned with VendorDirectory positioning to avoid container clipping)
  const [menuAnchor, setMenuAnchor] = useState<{
    vehicle: Vehicle;
    top?: number;
    bottom?: number;
    right: number;
    isDropup: boolean;
  } | null>(null);

  // Driver Assignment and Trips state per vehicle
  const [driverAssignments, setDriverAssignments] = useState<
    Record<
      string,
      {
        currentDriver: any | null;
        currentTrip: any | null;
        history: any[];
      }
    >
  >({});

  // View Driver Modal State
  const [viewingDriverModal, setViewingDriverModal] = useState<{
    driver: any;
    vehicle: Vehicle;
    trip?: any;
  } | null>(null);
  const [driverDocs, setDriverDocs] = useState<any[]>([]);
  const [loadingDriverDocs, setLoadingDriverDocs] = useState(false);

  // Assign / Change Driver Modal State
  const [assigningDriverVehicle, setAssigningDriverVehicle] = useState<Vehicle | null>(null);
  const [eligibleDrivers, setEligibleDrivers] = useState<any[]>([]);
  const [activeDriverTrips, setActiveDriverTrips] = useState<Record<string, any>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loadingEligibleDrivers, setLoadingEligibleDrivers] = useState(false);
  const [isSubmittingDriverAssignment, setIsSubmittingDriverAssignment] = useState(false);

  // Verification History Modal State
  const [viewingHistoryVehicle, setViewingHistoryVehicle] = useState<Vehicle | null>(null);

  // Vendor Details Modal State
  const [viewingVendorModal, setViewingVendorModal] = useState<{
    vendorMeta: any;
    vehicle: Vehicle;
  } | null>(null);

  // Edit Vehicle Modal
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState({
    category: 'Lorry',
    bodyType: 'Open Body',
    ratedCapacityMt: 20,
    minimumCapacityMt: 10,
    rcNumber: '',
    status: 'ACTIVE',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Reject Vehicle Modal
  const [rejectingVehicle, setRejectingVehicle] = useState<Vehicle | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Request Corrections Modal
  const [correctionVehicle, setCorrectionVehicle] = useState<Vehicle | null>(null);
  const [correctionFeedback, setCorrectionFeedback] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Verify Documents Modal
  const [verifyingVehicle, setVerifyingVehicle] = useState<Vehicle | null>(null);
  const [docStatuses, setDocStatuses] = useState({
    rc: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
    insurance: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
    fitness: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
    permit: 'PENDING' as 'PENDING' | 'APPROVED' | 'REJECTED',
  });
  const [isSavingDocs, setIsSavingDocs] = useState(false);

  // Fetch real stats from database
  const fetchStats = async () => {
    try {
      const statsData = await getVehicleStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch vehicles with filters and pagination
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

      // Priority: Specific status dropdown or KPI Tab
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Pending Review') filters.verificationStatus = 'PENDING_DOCS';
        else if (statusFilter === 'Verified') filters.verificationStatus = 'APPROVED';
        else if (statusFilter === 'Rejected') filters.verificationStatus = 'REJECTED';
        else if (statusFilter === 'Correction Required') filters.verificationStatus = 'PENDING_DOCS';
      } else {
        if (activeTab === 'VERIFIED') {
          filters.verificationStatus = 'APPROVED';
        } else if (activeTab === 'PENDING') {
          filters.verificationStatus = 'PENDING_DOCS';
        } else if (activeTab === 'REJECTED') {
          filters.verificationStatus = 'REJECTED';
        }
      }

      if (categoryFilter !== 'ALL') {
        filters.vehicleType = categoryFilter;
      }

      const pagination: PaginationParams = {
        page,
        pageSize: itemsPerPage,
        sortBy,
        sortOrder,
      };

      const response = await getVehicles(filters, pagination);

      // Apply client-side body type filter
      let filteredVehicles = response.vehicles;
      if (bodyTypeFilter !== 'ALL') {
        filteredVehicles = filteredVehicles.filter(
          (v) => (v.body_type || '').toLowerCase() === bodyTypeFilter.toLowerCase()
        );
      }

      // Apply client-side document compliance filter
      if (docStatusFilter !== 'ALL') {
        const today = new Date().toISOString().split('T')[0];
        if (docStatusFilter === 'ALL_VERIFIED') {
          filteredVehicles = filteredVehicles.filter(
            (v) =>
              v.rc_verification_status === 'APPROVED' &&
              v.insurance_verification_status === 'APPROVED' &&
              v.fitness_verification_status === 'APPROVED' &&
              v.permit_verification_status === 'APPROVED'
          );
        } else if (docStatusFilter === 'HAS_PENDING') {
          filteredVehicles = filteredVehicles.filter(
            (v) =>
              v.rc_verification_status === 'PENDING' ||
              v.insurance_verification_status === 'PENDING' ||
              v.fitness_verification_status === 'PENDING' ||
              v.permit_verification_status === 'PENDING'
          );
        } else if (docStatusFilter === 'EXPIRED_REJECTED') {
          filteredVehicles = filteredVehicles.filter(
            (v) =>
              v.rc_verification_status === 'REJECTED' ||
              v.insurance_verification_status === 'REJECTED' ||
              v.fitness_verification_status === 'REJECTED' ||
              v.permit_verification_status === 'REJECTED' ||
              (v.rc_expiry_date && v.rc_expiry_date < today) ||
              (v.insurance_expiry_date && v.insurance_expiry_date < today) ||
              (v.fitness_expiry_date && v.fitness_expiry_date < today) ||
              (v.permit_expiry_date && v.permit_expiry_date < today)
          );
        }
      }

      setVehicles(filteredVehicles);
      setTotal(response.total);
      setTotalPages(Math.max(1, Math.ceil(response.total / itemsPerPage)));

      // Fetch linked vendor and ownership details from database records
      const vehicleIds = filteredVehicles.map((v) => v.id);
      if (vehicleIds.length > 0) {
        try {
          const { data: links } = await supabase
            .from('vendor_vehicle_links')
            .select(
              'vehicle_id, vendor_id, status, vendor:vendor_companies(id, vendor_name, vendor_code, address, gstin, pan)'
            )
            .in('vehicle_id', vehicleIds);

          const detailsMap: Record<string, any> = {};
          const vendorIds: string[] = [];
          if (links) {
            for (const link of links) {
              const vId = link.vehicle_id;
              const vendorData: any = Array.isArray(link.vendor) ? link.vendor[0] : link.vendor;
              if (link.vendor_id && !vendorIds.includes(link.vendor_id)) {
                vendorIds.push(link.vendor_id);
              }
              if (!detailsMap[vId]) {
                const vendorCode =
                  vendorData?.vendor_code ||
                  formatDisplayId('VD', vendorData?.id || link.vendor_id);
                const vendorName = vendorData?.vendor_name || `Vendor ${vendorCode}`;
                detailsMap[vId] = {
                  vendorId: link.vendor_id,
                  vendorCode: vendorCode,
                  vendorName: vendorName,
                  address: vendorData?.address || '',
                  gstin: vendorData?.gstin || '',
                  pan: vendorData?.pan || '',
                  phone: '',
                  email: '',
                  ownership: 'Owned',
                  count: 1,
                };
              } else {
                detailsMap[vId].count += 1;
                detailsMap[vId].ownership = 'Both';
              }
            }
          }

          // Fetch vendor users for genuine phone and email contact
          if (vendorIds.length > 0) {
            const { data: vUsers } = await supabase
              .from('vendor_users')
              .select('vendor_id, full_name, mobile, email')
              .in('vendor_id', vendorIds);
            if (vUsers) {
              for (const u of vUsers) {
                for (const vId in detailsMap) {
                  if (detailsMap[vId].vendorId === u.vendor_id) {
                    if (!detailsMap[vId].phone && u.mobile) detailsMap[vId].phone = u.mobile;
                    if (!detailsMap[vId].email && u.email) detailsMap[vId].email = u.email;
                  }
                }
              }
            }
          }

          setTransporterDetails((prev) => ({ ...prev, ...detailsMap }));

          // Fetch associated driver and trip relationships from actual database records
          const { data: tripsData } = await supabase
            .from('trips')
            .select(`
              id, booking_id, vehicle_id, driver_id, vendor_id, trip_status, started_at, completed_at, created_at,
              driver:drivers(id, full_name, mobile, licence_number, licence_expiry_date, status, driver_code),
              booking:bookings(id, booking_reference, client_id)
            `)
            .in('vehicle_id', vehicleIds)
            .order('created_at', { ascending: false });

          const assignmentsMap: Record<
            string,
            { currentDriver: any | null; currentTrip: any | null; history: any[] }
          > = {};
          if (tripsData) {
            for (const t of tripsData) {
              const vId = t.vehicle_id;
              if (!assignmentsMap[vId]) {
                assignmentsMap[vId] = { currentDriver: null, currentTrip: null, history: [] };
              }
              assignmentsMap[vId].history.push(t);
              const driverObj = Array.isArray(t.driver) ? t.driver[0] : t.driver;
              if (
                !assignmentsMap[vId].currentTrip &&
                t.trip_status !== 'COMPLETED' &&
                t.trip_status !== 'CANCELLED' &&
                driverObj
              ) {
                assignmentsMap[vId].currentTrip = t;
                assignmentsMap[vId].currentDriver = driverObj;
              }
            }
          }

          // If no active trip, fall back to the most recent trip with an assigned driver
          for (const vId in assignmentsMap) {
            if (!assignmentsMap[vId].currentDriver && assignmentsMap[vId].history.length > 0) {
              const latestWithDriver = assignmentsMap[vId].history.find((h) => h.driver);
              if (latestWithDriver) {
                assignmentsMap[vId].currentDriver = Array.isArray(latestWithDriver.driver)
                  ? latestWithDriver.driver[0]
                  : latestWithDriver.driver;
                assignmentsMap[vId].currentTrip = latestWithDriver;
              }
            }
          }

          setDriverAssignments((prev) => ({ ...prev, ...assignmentsMap }));
        } catch (e) {
          console.warn('Transporter details fetch warning:', e);
        }
      }
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
    fetchVehicles();
  }, [page, itemsPerPage, activeTab, categoryFilter, bodyTypeFilter, ownershipFilter, statusFilter, docStatusFilter, sortBy, sortOrder]);

  // Close open dropdowns on outer click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.action-menu-container') &&
        !target.closest('.vehicle-action-menu-dropdown')
      ) {
        setOpenActionMenuId(null);
        setMenuAnchor(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Action Menu toggle with viewport-aware floating positioning
  const handleToggleActionMenu = (vehicle: Vehicle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor?.vehicle.id === vehicle.id) {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isDropup = spaceBelow < menuHeight + 20;

    setOpenActionMenuId(vehicle.id);
    setMenuAnchor({
      vehicle,
      top: isDropup ? undefined : rect.bottom + 6,
      bottom: isDropup ? window.innerHeight - rect.top + 6 : undefined,
      right: Math.max(16, window.innerWidth - rect.right),
      isDropup,
    });
  };

  // Open Driver Details Modal
  const handleOpenDriverDetails = async (vehicle: Vehicle, driver: any, trip?: any) => {
    setMenuAnchor(null);
    setOpenActionMenuId(null);
    setViewingDriverModal({ driver, vehicle, trip });
    setLoadingDriverDocs(true);
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('reference_id', driver.id);
      setDriverDocs(docs || []);
    } catch (e) {
      console.warn('Driver docs fetch error:', e);
      setDriverDocs([]);
    } finally {
      setLoadingDriverDocs(false);
    }
  };

  // Open Assign / Change Driver Modal
  const handleOpenAssignDriver = async (vehicle: Vehicle) => {
    setMenuAnchor(null);
    setOpenActionMenuId(null);

    // Compliance Check: Vehicle must be approved for operations
    if (vehicle.verification_status !== 'APPROVED' || !vehicle.eligible_for_operations) {
      toast.error(
        `Compliance Restriction: Vehicle ${vehicle.registration_number} is pending document verification (Status: ${vehicle.verification_status || 'PENDING'}). Only verified fleet vehicles can be dispatched.`
      );
      return;
    }

    setAssigningDriverVehicle(vehicle);
    setSelectedDriverId('');
    setLoadingEligibleDrivers(true);
    try {
      const vendorId = transporterDetails[vehicle.id]?.vendorId;
      let query = supabase
        .from('drivers')
        .select('*')
        .eq('verification_status', 'APPROVED')
        .eq('is_active', true);

      if (vendorId) {
        query = query.or(`primary_vendor_id.eq.${vendorId},primary_vendor_id.is.null`);
      }
      const { data: driversList } = await query.order('full_name', { ascending: true });
      setEligibleDrivers(driversList || []);

      // Fetch active trips to detect conflicts
      const { data: activeTrips } = await supabase
        .from('trips')
        .select('id, driver_id, vehicle_id, trip_status')
        .not('trip_status', 'in', '("COMPLETED","CANCELLED")');

      const tripConflictMap: Record<string, any> = {};
      if (activeTrips) {
        for (const tr of activeTrips) {
          if (tr.driver_id) {
            tripConflictMap[tr.driver_id] = tr;
          }
        }
      }
      setActiveDriverTrips(tripConflictMap);
    } catch (err: any) {
      console.error('Error loading eligible drivers:', err);
    } finally {
      setLoadingEligibleDrivers(false);
    }
  };

  // Confirm driver assignment
  const handleConfirmDriverAssignment = async () => {
    if (!assigningDriverVehicle || !selectedDriverId) {
      toast.error('Please select a driver to assign');
      return;
    }
    const chosenDriver = eligibleDrivers.find((d) => d.id === selectedDriverId);
    if (!chosenDriver) return;

    if (chosenDriver.verification_status !== 'APPROVED' || !chosenDriver.is_active) {
      toast.error(
        `Compliance Restriction: Driver ${chosenDriver.full_name} is not verified/active. Assignment blocked.`
      );
      return;
    }

    if (chosenDriver.licence_expiry_date) {
      const expiry = new Date(chosenDriver.licence_expiry_date);
      if (expiry < new Date()) {
        toast.error(
          `Compliance Alert: Driver ${chosenDriver.full_name} has an expired license (${chosenDriver.licence_expiry_date}). Assignment blocked.`
        );
        return;
      }
    }

    const conflict = activeDriverTrips[selectedDriverId];
    if (conflict && conflict.vehicle_id !== assigningDriverVehicle.id) {
      toast.error(
        `Conflicting Assignment: Driver ${chosenDriver.full_name} is already assigned to active Trip #${conflict.id} on another vehicle.`
      );
      return;
    }

    setIsSubmittingDriverAssignment(true);
    try {
      await ensureAdminSession();
      const currentAssign = driverAssignments[assigningDriverVehicle.id];
      const activeTrip = currentAssign?.currentTrip;

      if (activeTrip && activeTrip.id) {
        const { error: updErr } = await supabase
          .from('trips')
          .update({
            driver_id: selectedDriverId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeTrip.id);
        if (updErr) throw updErr;
      } else {
        const vendorId = transporterDetails[assigningDriverVehicle.id]?.vendorId;
        const { error: insErr } = await supabase.from('trips').insert([
          {
            vehicle_id: assigningDriverVehicle.id,
            driver_id: selectedDriverId,
            vendor_id: vendorId || null,
            trip_status: 'LORRY_ASSIGNED',
            created_at: new Date().toISOString(),
          },
        ]);
        if (insErr) throw insErr;
      }

      toast.success(
        `Driver ${chosenDriver.full_name} successfully assigned to ${assigningDriverVehicle.registration_number}`
      );
      setAssigningDriverVehicle(null);
      setSelectedDriverId('');
      fetchVehicles();
    } catch (err: any) {
      console.error('Driver assignment error:', err);
      toast.error(`Failed to assign driver: ${err.message}`);
    } finally {
      setIsSubmittingDriverAssignment(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchVehicles();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setBodyTypeFilter('ALL');
    setOwnershipFilter('ALL');
    setStatusFilter('ALL');
    setDocStatusFilter('ALL');
    setActiveTab('ALL');
    setPage(1);
  };

  const handleRefresh = () => {
    fetchStats();
    fetchVehicles(true);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (vehicles.length === 0) {
      toast.error('No vehicles to export');
      return;
    }
    const headers = [
      'Vendor ID',
      'Vendor Name',
      'Vehicle Number',
      'Category',
      'Body Type',
      'Rated Capacity (MT)',
      'Min Capacity (MT)',
      'Ownership',
      'RC Status',
      'Insurance Status',
      'Fitness Status',
      'Permit Status',
      'Verification Status',
      'Last Updated',
    ];
    const rows = vehicles.map((v) => {
      const vendorInfo = transporterDetails[v.id];
      const vendorId = vendorInfo?.vendorCode || formatDisplayId('VD', v.id, v.created_at);
      const vendorName = vendorInfo?.vendorName || 'NECL Fleet';
      const ownership = vendorInfo?.ownership || (v as any).ownership_type || 'Owned';
      return [
        `"${vendorId}"`,
        `"${vendorName}"`,
        `"${v.registration_number}"`,
        `"${v.vehicle_type}"`,
        `"${v.body_type || 'Open Body'}"`,
        `"${v.rated_capacity_mt} MT"`,
        `"${v.minimum_capacity_mt} MT"`,
        `"${ownership}"`,
        `"${v.rc_verification_status || 'PENDING'}"`,
        `"${v.insurance_verification_status || 'PENDING'}"`,
        `"${v.fitness_verification_status || 'PENDING'}"`,
        `"${v.permit_verification_status || 'PENDING'}"`,
        `"${v.verification_status}"`,
        `"${formatDateTime(v.updated_at || v.created_at)}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NECL_Vehicle_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Vehicle directory exported successfully');
  };

  // Action Handlers
  const handleOpenEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditForm({
      category: vehicle.vehicle_type || 'Lorry',
      bodyType: vehicle.body_type || 'Open Body',
      ratedCapacityMt: vehicle.rated_capacity_mt || 20,
      minimumCapacityMt: vehicle.minimum_capacity_mt || 10,
      rcNumber: vehicle.rc_number || vehicle.registration_number,
      status: vehicle.status || 'ACTIVE',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingVehicle) return;
    setIsSavingEdit(true);
    try {
      await updateVehicle(editingVehicle.id, {
        vehicle_type: editForm.category,
        body_type: editForm.bodyType,
        rated_capacity_mt: Number(editForm.ratedCapacityMt),
        minimum_capacity_mt: Number(editForm.minimumCapacityMt),
        rc_number: editForm.rcNumber,
        status: editForm.status as any,
      });

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicle.id
            ? {
                ...v,
                vehicle_type: editForm.category,
                body_type: editForm.bodyType,
                rated_capacity_mt: Number(editForm.ratedCapacityMt),
                minimum_capacity_mt: Number(editForm.minimumCapacityMt),
                rc_number: editForm.rcNumber,
                status: editForm.status as any,
              }
            : v
        )
      );

      if (fullViewVehicle?.id === editingVehicle.id) {
        setFullViewVehicle((prev) =>
          prev
            ? {
                ...prev,
                vehicle_type: editForm.category,
                body_type: editForm.bodyType,
                rated_capacity_mt: Number(editForm.ratedCapacityMt),
                minimum_capacity_mt: Number(editForm.minimumCapacityMt),
                rc_number: editForm.rcNumber,
                status: editForm.status as any,
              }
            : null
        );
      }

      toast.success(`Vehicle ${editingVehicle.registration_number} updated successfully`);
      setEditingVehicle(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update vehicle');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenVerifyDocs = (vehicle: Vehicle) => {
    setVerifyingVehicle(vehicle);
    setDocStatuses({
      rc: vehicle.rc_verification_status || 'PENDING',
      insurance: vehicle.insurance_verification_status || 'PENDING',
      fitness: vehicle.fitness_verification_status || 'PENDING',
      permit: vehicle.permit_verification_status || 'PENDING',
    });
  };

  const handleSaveDocStatuses = async () => {
    if (!verifyingVehicle) return;
    setIsSavingDocs(true);
    try {
      const allApproved =
        docStatuses.rc === 'APPROVED' &&
        docStatuses.insurance === 'APPROVED' &&
        docStatuses.fitness === 'APPROVED' &&
        docStatuses.permit === 'APPROVED';

      const hasRejection =
        docStatuses.rc === 'REJECTED' ||
        docStatuses.insurance === 'REJECTED' ||
        docStatuses.fitness === 'REJECTED' ||
        docStatuses.permit === 'REJECTED';

      const newOverallStatus = allApproved
        ? 'APPROVED'
        : hasRejection
        ? 'REJECTED'
        : 'PENDING_DOCS';

      const updates: any = {
        rc_verification_status: docStatuses.rc,
        insurance_verification_status: docStatuses.insurance,
        fitness_verification_status: docStatuses.fitness,
        permit_verification_status: docStatuses.permit,
        verification_status: newOverallStatus,
        eligible_for_operations: allApproved,
        verified_by: 'Rahul (Admin)',
        verified_at: allApproved ? new Date().toISOString() : null,
      };

      await supabase.from('vehicles').update(updates).eq('id', verifyingVehicle.id);

      setVehicles((prev) =>
        prev.map((v) => (v.id === verifyingVehicle.id ? { ...v, ...updates } : v))
      );

      if (fullViewVehicle?.id === verifyingVehicle.id) {
        setFullViewVehicle((prev) => (prev ? { ...prev, ...updates } : null));
      }

      toast.success(`Document verification statuses updated for ${verifyingVehicle.registration_number}`);
      setVerifyingVehicle(null);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update document statuses');
    } finally {
      setIsSavingDocs(false);
    }
  };

  const handleApproveVehicle = async (vehicle: Vehicle) => {
    try {
      await approveVehicle(vehicle.id, 'Rahul (Admin)');
      const updates = {
        verification_status: 'APPROVED' as const,
        eligible_for_operations: true,
        rc_verification_status: 'APPROVED' as const,
        insurance_verification_status: 'APPROVED' as const,
        fitness_verification_status: 'APPROVED' as const,
        permit_verification_status: 'APPROVED' as const,
      };

      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, ...updates } : v))
      );

      if (fullViewVehicle?.id === vehicle.id) {
        setFullViewVehicle((prev) => (prev ? { ...prev, ...updates } : null));
      }

      toast.success(`Vehicle ${vehicle.registration_number} approved and verified for operations`);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve vehicle');
    }
  };

  const handleOpenReject = (vehicle: Vehicle) => {
    setRejectingVehicle(vehicle);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingVehicle) return;
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setIsSubmittingReject(true);
    try {
      await rejectVehicle(rejectingVehicle.id, rejectionReason.trim(), 'Rahul (Admin)');
      const updates = {
        verification_status: 'REJECTED' as const,
        eligible_for_operations: false,
        rejection_reason: rejectionReason.trim(),
      };

      setVehicles((prev) =>
        prev.map((v) => (v.id === rejectingVehicle.id ? { ...v, ...updates } : v))
      );

      if (fullViewVehicle?.id === rejectingVehicle.id) {
        setFullViewVehicle((prev) => (prev ? { ...prev, ...updates } : null));
      }

      toast.success(`Vehicle ${rejectingVehicle.registration_number} marked as Rejected`);
      setRejectingVehicle(null);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject vehicle');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleOpenCorrection = (vehicle: Vehicle) => {
    setCorrectionVehicle(vehicle);
    setCorrectionFeedback('');
  };

  const handleConfirmCorrection = async () => {
    if (!correctionVehicle) return;
    if (!correctionFeedback.trim()) {
      toast.error('Please enter correction feedback for the vendor');
      return;
    }
    setIsSubmittingCorrection(true);
    try {
      const updates = {
        verification_status: 'PENDING_DOCS' as const,
        rejection_reason: `CORRECTION_REQUIRED: ${correctionFeedback.trim()}`,
        eligible_for_operations: false,
        verified_by: 'Rahul (Admin)',
      };

      await supabase.from('vehicles').update(updates).eq('id', correctionVehicle.id);

      setVehicles((prev) =>
        prev.map((v) => (v.id === correctionVehicle.id ? { ...v, ...updates } : v))
      );

      if (fullViewVehicle?.id === correctionVehicle.id) {
        setFullViewVehicle((prev) => (prev ? { ...prev, ...updates } : null));
      }

      toast.success(
        `Correction request recorded for ${correctionVehicle.registration_number}. Vendor notified.`
      );
      setCorrectionVehicle(null);
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request corrections');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Helper to render comprehensive document breakdown & micro-chips (RC, INS, FIT, PER)
  const renderDocumentSummary = (vehicle: Vehicle) => {
    const rc = vehicle.rc_verification_status || 'PENDING';
    const ins = vehicle.insurance_verification_status || 'PENDING';
    const fit = vehicle.fitness_verification_status || 'PENDING';
    const per = vehicle.permit_verification_status || 'PENDING';

    const docList = [
      { label: 'RC', name: 'Registration Certificate', status: rc, expiry: vehicle.rc_expiry_date },
      { label: 'INS', name: 'Vehicle Insurance', status: ins, expiry: vehicle.insurance_expiry_date },
      { label: 'FIT', name: 'Fitness Certificate', status: fit, expiry: vehicle.fitness_expiry_date },
      { label: 'PER', name: 'Transport Permit', status: per, expiry: vehicle.permit_expiry_date },
    ];

    const now = new Date().toISOString().split('T')[0];
    const verifiedCount = docList.filter((d) => d.status === 'APPROVED').length;
    const rejectedCount = docList.filter((d) => d.status === 'REJECTED').length;
    const expiredCount = docList.filter((d) => d.expiry && d.expiry < now).length;

    let pillClass = 'has-pending';
    let pillText = `${verifiedCount}/4 Verified`;
    if (verifiedCount === 4) {
      pillClass = 'all-verified';
      pillText = '4/4 Verified';
    } else if (rejectedCount > 0 || expiredCount > 0) {
      pillClass = 'has-rejected';
      pillText = expiredCount > 0 ? `${expiredCount} Expired` : `${rejectedCount} Rejected`;
    }

    return (
      <div
        className="doc-summary-badge-wrap cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setVerifyingVehicle(vehicle);
        }}
        title="Click to view & verify documents"
      >
        <div className={`doc-count-pill ${pillClass}`}>
          <span className="doc-count-text">{pillText}</span>
        </div>

        <div className="doc-chips-row">
          {docList.map((doc) => {
            const isExpired = doc.expiry && doc.expiry < now;
            let chipClass = 'chip-warn';
            if (isExpired || doc.status === 'REJECTED') {
              chipClass = 'chip-err';
            } else if (doc.status === 'APPROVED') {
              chipClass = 'chip-ok';
            }
            return (
              <span
                key={doc.label}
                className={`doc-chip ${chipClass}`}
                title={`${doc.name}: ${isExpired ? 'EXPIRED' : doc.status}`}
              >
                {doc.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper to render document status icon with mini badge
  const renderDocIcon = (
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
    tooltip: string
  ) => {
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';
    const isPending = !isApproved && !isRejected;

    return (
      <div className="doc-status-icon-wrap" title={tooltip}>
        <FileText size={14} />
        {isApproved && (
          <span className="mini-badge approved" title="Verified">
            <Check size={8} strokeWidth={3} />
          </span>
        )}
        {isPending && (
          <span className="mini-badge pending" title="Pending Verification">
            <Clock size={8} strokeWidth={3} />
          </span>
        )}
        {isRejected && (
          <span className="mini-badge rejected" title="Rejected">
            <X size={8} strokeWidth={3} />
          </span>
        )}
      </div>
    );
  };

  // Helper to render overall status pill badge
  const renderVerificationBadge = (vehicle: Vehicle) => {
    const isCorrection = vehicle.rejection_reason?.startsWith('CORRECTION_REQUIRED');

    if (isCorrection) {
      return (
        <span className="pill-badge orange" title="Corrections requested from vendor">
          <AlertTriangle size={12} />
          <span>Correction Required</span>
        </span>
      );
    }

    const now = new Date().toISOString().split('T')[0];
    const hasExpiredDoc = Boolean(
      (vehicle.insurance_expiry_date && vehicle.insurance_expiry_date < now) ||
      (vehicle.fitness_expiry_date && vehicle.fitness_expiry_date < now) ||
      (vehicle.permit_expiry_date && vehicle.permit_expiry_date < now)
    );

    if (hasExpiredDoc) {
      return (
        <span className="pill-badge red" title="One or more vehicle compliance documents have expired">
          <AlertCircle size={12} />
          <span>Expired Docs</span>
        </span>
      );
    }

    switch (vehicle.verification_status) {
      case 'APPROVED':
        return (
          <span className="pill-badge green" title="All vehicle verification checks passed">
            <CheckCircle size={12} />
            <span>Verified</span>
          </span>
        );
      case 'REJECTED':
      case 'BLOCKED':
        return (
          <span className="pill-badge red" title={vehicle.rejection_reason || 'Vehicle rejected'}>
            <XCircle size={12} />
            <span>Rejected</span>
          </span>
        );
      case 'PENDING_DOCS':
      default:
        return (
          <span className="pill-badge amber" title="Verification pending administrative review">
            <Clock size={12} />
            <span>Pending Review</span>
          </span>
        );
    }
  };

  // Helper to render ownership badge
  const renderOwnershipBadge = (ownership: 'Owned' | 'Attached' | 'Both') => {
    switch (ownership) {
      case 'Attached':
        return <span className="pill-badge purple">Attached</span>;
      case 'Both':
        return <span className="pill-badge amber">Both</span>;
      case 'Owned':
      default:
        return <span className="pill-badge blue">Owned</span>;
    }
  };

  return (
    <div className="cli-dir-wrapper" style={{ padding: '24px 32px' }}>
      {/* 1. Header Hero Banner */}
      <div className="directory-hero-banner">
        <div className="directory-hero-info">
          <div className="directory-hero-breadcrumbs">
            <span>Fleet & Vehicles</span>
            <ChevronRight size={13} />
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Vehicle Directory</span>
          </div>
          <h1 className="directory-hero-title">Vehicle Directory</h1>
          <p className="directory-hero-desc">
            Manage registered vehicles, vendor associations, vehicle specifications, documents, and verification status.
          </p>
        </div>

        <div className="directory-hero-actions flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="directory-btn-outline"
            style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)' }}
            title="Refresh records from database"
            aria-label="Refresh records"
            disabled={refreshing || loading}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="directory-btn-outline"
            style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)' }}
            title="Export filtered vehicle directory to CSV"
            aria-label="Export CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {onNavigateToAddVehicle && (
            <button
              className="directory-btn-orange"
              onClick={onNavigateToAddVehicle}
              id="btn-register-vehicle"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>+ Register Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Dashboard Summary KPI Cards (Clickable, connected to DB) */}
      <div className="directory-kpi-grid-4">
        {/* Total Vehicles */}
        <div
          className={`directory-kpi-card ${activeTab === 'ALL' ? 'active-kpi' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setStatusFilter('ALL');
            setPage(1);
          }}
          title="Filter by All Vehicles"
        >
          <div className="kpi-icon-squircle blue">
            <Truck size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Total Vehicles</span>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <div className="directory-kpi-value">{loading ? '...' : stats.totalVehicles}</div>
          </div>
        </div>

        {/* Verified Vehicles */}
        <div
          className={`directory-kpi-card ${activeTab === 'VERIFIED' ? 'active-kpi' : ''}`}
          onClick={() => {
            setActiveTab('VERIFIED');
            setStatusFilter('ALL');
            setPage(1);
          }}
          title="Filter by Verified Vehicles"
        >
          <div className="kpi-icon-squircle green">
            <CheckCircle size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Verified Vehicles</span>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <div className="directory-kpi-value">{loading ? '...' : stats.verifiedVehicles}</div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className={`directory-kpi-card ${activeTab === 'PENDING' ? 'active-kpi' : ''}`}
          onClick={() => {
            setActiveTab('PENDING');
            setStatusFilter('ALL');
            setPage(1);
          }}
          title="Filter by Pending Review"
        >
          <div className="kpi-icon-squircle amber">
            <Clock size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Pending Review</span>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <div className="directory-kpi-value">{loading ? '...' : stats.pendingVerification}</div>
          </div>
        </div>

        {/* Rejected Vehicles */}
        <div
          className={`directory-kpi-card ${activeTab === 'REJECTED' ? 'active-kpi' : ''}`}
          onClick={() => {
            setActiveTab('REJECTED');
            setStatusFilter('ALL');
            setPage(1);
          }}
          title="Filter by Rejected Vehicles"
        >
          <div className="kpi-icon-squircle red">
            <XCircle size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Rejected Vehicles</span>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <div className="directory-kpi-value">{loading ? '...' : stats.rejectedVehicles}</div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="directory-filter-card">
        {/* Search */}
        <div className="directory-search-box">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search vehicle number, vendor name, or vendor ID..."
            className="directory-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="directory-select-box">
          <Truck size={15} className="text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Categories</option>
            <option value="32FT_MXL">32FT MXL</option>
            <option value="40 FT High Bed Trailer">40 FT Trailer</option>
            <option value="Lorry">Lorry</option>
            <option value="Trailer">Trailer</option>
            <option value="Van">Van</option>
            <option value="Heavy Carrier">Heavy Carrier</option>
            <option value="10 Wheeler">10 Wheeler</option>
            <option value="12 Wheeler">12 Wheeler</option>
            <option value="14 Wheeler">14 Wheeler</option>
            <option value="Container">Container</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Body Type Filter */}
        <div className="directory-select-box">
          <FileText size={15} className="text-slate-400 shrink-0" />
          <select
            value={bodyTypeFilter}
            onChange={(e) => {
              setBodyTypeFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Body Types</option>
            <option value="Open Body">Open Body</option>
            <option value="Closed Body">Closed Body</option>
            <option value="Flatbed">Flatbed</option>
            <option value="Container">Container</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Ownership Filter */}
        <div className="directory-select-box">
          <Users size={15} className="text-slate-400 shrink-0" />
          <select
            value={ownershipFilter}
            onChange={(e) => {
              setOwnershipFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Ownership</option>
            <option value="Owned">Owned</option>
            <option value="Attached">Attached</option>
            <option value="Both">Both</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Verification Status Filter */}
        <div className="directory-select-box">
          <ShieldCheck size={15} className="text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Status</option>
            <option value="Verified">Verified</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Rejected">Rejected</option>
            <option value="Correction Required">Correction Required</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Document Status Filter */}
        <div className="directory-select-box">
          <FileText size={15} className="text-slate-400 shrink-0" />
          <select
            value={docStatusFilter}
            onChange={(e) => {
              setDocStatusFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Documents</option>
            <option value="ALL_VERIFIED">All Verified (4/4)</option>
            <option value="HAS_PENDING">Pending Documents</option>
            <option value="EXPIRED_REJECTED">Expired / Rejected</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Reset Button */}
        <button onClick={handleResetFilters} className="directory-btn-reset" title="Reset all filters">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        {/* Search Submit */}
        <button onClick={handleSearch} className="directory-btn-search">
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* 4. Tabs & Action Sub-bar */}
      <div className="directory-subbar relative">
        <div className="directory-tabs">
          <button
            onClick={() => {
              setActiveTab('ALL');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`directory-tab-btn ${activeTab === 'ALL' && statusFilter === 'ALL' ? 'active' : ''}`}
          >
            All Vehicles ({stats.totalVehicles})
          </button>
          <button
            onClick={() => {
              setActiveTab('VERIFIED');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`directory-tab-btn ${activeTab === 'VERIFIED' ? 'active' : ''}`}
          >
            Verified ({stats.verifiedVehicles})
          </button>
          <button
            onClick={() => {
              setActiveTab('PENDING');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`directory-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
          >
            Pending Review ({stats.pendingVerification})
          </button>
          <button
            onClick={() => {
              setActiveTab('REJECTED');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`directory-tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`}
          >
            Rejected ({stats.rejectedVehicles})
          </button>
        </div>

        <div className="directory-tab-actions flex items-center gap-2">
          {/* Total Record Indicator */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200">
            <span>Total:</span>
            <span className="font-bold text-slate-900">{total}</span>
          </div>

          <button onClick={handleExportCSV} className="directory-btn-outline" title="Export current list to CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {/* Column Visibility Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              className={`directory-btn-outline ${showColumnConfig ? 'bg-orange-50 border-[#F05A22] text-[#F05A22]' : ''}`}
              title="Configure visible columns"
              aria-label="Configure columns"
            >
              <ColumnsIcon size={14} />
              <span>Columns</span>
            </button>

            {/* Column Visibility Popover Dropdown */}
            {showColumnConfig && (
              <div
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800">Customize Columns</span>
                  <button
                    onClick={() =>
                      setVisibleColumns({
                        vendor: true,
                        category: true,
                        bodyType: true,
                        ratedCapacity: true,
                        minCapacity: true,
                        ownership: true,
                        documents: true,
                        status: true,
                        updatedAt: true,
                      })
                    }
                    className="text-[11px] text-[#F05A22] hover:underline font-semibold"
                  >
                    Reset All
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {[
                    { key: 'vendor', label: 'Vendor ID & Name' },
                    { key: 'category', label: 'Vehicle Category' },
                    { key: 'bodyType', label: 'Body Type' },
                    { key: 'ratedCapacity', label: 'Rated Capacity (MT)' },
                    { key: 'minCapacity', label: 'Minimum Capacity (MT)' },
                    { key: 'ownership', label: 'Ownership' },
                    { key: 'documents', label: 'Documents' },
                    { key: 'status', label: 'Verification Status' },
                    { key: 'updatedAt', label: 'Updated At' },
                  ].map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer select-none text-slate-700 font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={(visibleColumns as any)[col.key]}
                        onChange={(e) =>
                          setVisibleColumns({
                            ...visibleColumns,
                            [col.key]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#F05A22] focus:ring-[#F05A22]"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Vehicle Directory Table Card */}
      <div className="directory-table-card">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw size={36} className="text-[#F05A22] animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-semibold">Loading real vehicle records from database...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <XCircle size={36} className="text-rose-500 mx-auto mb-3" />
            <p className="text-rose-700 font-bold mb-1">Failed to load vehicles</p>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <button onClick={handleRefresh} className="directory-btn-search" style={{ margin: '0 auto' }}>
              Retry
            </button>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Truck size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No vehicles found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">
              {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || bodyTypeFilter !== 'ALL' || ownershipFilter !== 'ALL' || docStatusFilter !== 'ALL'
                ? 'No vehicle records matched your filter criteria. Try resetting filters.'
                : 'Vehicles registered by vendors will automatically appear here for verification and fleet management.'}
            </p>
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || bodyTypeFilter !== 'ALL' || ownershipFilter !== 'ALL' || docStatusFilter !== 'ALL' ? (
              <button onClick={handleResetFilters} className="directory-btn-reset" style={{ margin: '0 auto' }}>
                Clear Filters
              </button>
            ) : onNavigateToAddVehicle ? (
              <button onClick={onNavigateToAddVehicle} className="directory-btn-orange" style={{ margin: '0 auto' }}>
                <Plus size={16} />
                <span>+ Register Vehicle</span>
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Scrollable Table View */}
            <div className="directory-table-scroll-container hidden md:block">
              <table className="directory-table" style={{ minWidth: 1220 }}>
                <thead>
                  <tr>
                    {/* 1. Row # (Sticky Left 0) */}
                    <th className="sticky-col-row" style={{ width: 56, minWidth: 56, textAlign: 'center' }}>
                      #
                    </th>

                    {/* 2. Vehicle Number (Sticky Left 56) */}
                    <th
                      className="sticky-col-vehicle select-none cursor-pointer"
                      style={{ width: 170, minWidth: 170 }}
                      onClick={() => handleSort('registration_number')}
                      title="Sort by vehicle number"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Vehicle Number</span>
                        {sortBy === 'registration_number' ? (
                          sortOrder === 'asc' ? <ChevronUp size={13} className="text-[#F05A22]" /> : <ChevronDown size={13} className="text-[#F05A22]" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </div>
                    </th>

                    {/* 3. Vendor ID & Name */}
                    {visibleColumns.vendor && (
                      <th style={{ width: 230, minWidth: 230 }}>
                        <span>Vendor ID & Name</span>
                      </th>
                    )}

                    {/* 4. Vehicle Category */}
                    {visibleColumns.category && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 150, minWidth: 150 }}
                        onClick={() => handleSort('vehicle_type')}
                        title="Sort by category"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Category</span>
                          {sortBy === 'vehicle_type' ? (
                            sortOrder === 'asc' ? <ChevronUp size={13} className="text-[#F05A22]" /> : <ChevronDown size={13} className="text-[#F05A22]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* 5. Body Type */}
                    {visibleColumns.bodyType && (
                      <th style={{ width: 130, minWidth: 130 }}>Body Type</th>
                    )}

                    {/* 6. Rated Capacity */}
                    {visibleColumns.ratedCapacity && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 140, minWidth: 140, textAlign: 'right', paddingRight: '24px' }}
                        onClick={() => handleSort('rated_capacity_mt')}
                        title="Sort by rated capacity"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Rated Cap (MT)</span>
                          {sortBy === 'rated_capacity_mt' ? (
                            sortOrder === 'asc' ? <ChevronUp size={13} className="text-[#F05A22]" /> : <ChevronDown size={13} className="text-[#F05A22]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* 7. Minimum Capacity */}
                    {visibleColumns.minCapacity && (
                      <th style={{ width: 130, minWidth: 130, textAlign: 'right', paddingRight: '24px' }}>
                        Min Cap (MT)
                      </th>
                    )}

                    {/* 8. Ownership */}
                    {visibleColumns.ownership && (
                      <th style={{ width: 110, minWidth: 110 }}>Ownership</th>
                    )}

                    {/* 9. Documents */}
                    {visibleColumns.documents && (
                      <th style={{ width: 180, minWidth: 180 }}>Documents</th>
                    )}

                    {/* 10. Verification Status */}
                    {visibleColumns.status && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 170, minWidth: 170 }}
                        onClick={() => handleSort('verification_status')}
                        title="Sort by verification status"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Verification</span>
                          {sortBy === 'verification_status' ? (
                            sortOrder === 'asc' ? <ChevronUp size={13} className="text-[#F05A22]" /> : <ChevronDown size={13} className="text-[#F05A22]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* 11. Updated At */}
                    {visibleColumns.updatedAt && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 180, minWidth: 180 }}
                        onClick={() => handleSort('updated_at')}
                        title="Sort by last updated"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Updated At</span>
                          {sortBy === 'updated_at' ? (
                            sortOrder === 'asc' ? <ChevronUp size={13} className="text-[#F05A22]" /> : <ChevronDown size={13} className="text-[#F05A22]" />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-40" />
                          )}
                        </div>
                      </th>
                    )}

                    {/* 12. Actions (Sticky Right 0) */}
                    <th className="sticky-col-actions" style={{ width: 105, minWidth: 105, textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle, idx) => {
                    const rowNum = (page - 1) * itemsPerPage + idx + 1;
                    const vendorMeta = transporterDetails[vehicle.id];
                    const hasVendor = Boolean(vendorMeta && vendorMeta.vendorName);
                    const vendorName = hasVendor ? vendorMeta.vendorName : null;
                    const vendorCode = vendorMeta?.vendorCode || null;
                    const avatar = getVendorAvatar(vendorName || 'V', vendorCode || vehicle.id);
                    const ownership = vendorMeta?.ownership || (vehicle as any).ownership_type || 'Owned';
                    const isMenuOpen = menuAnchor?.vehicle.id === vehicle.id;

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => setFullViewVehicle(vehicle)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        {/* 1. Row # (Sticky Left 0) */}
                        <td className="sticky-col-row" style={{ textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                          {rowNum}
                        </td>

                        {/* 2. Vehicle Number (Sticky Left 56) */}
                        <td className="sticky-col-vehicle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="vehicle-plate-badge cursor-pointer"
                              onClick={() => setFullViewVehicle(vehicle)}
                              title="Click to view vehicle details"
                            >
                              <span className="plate-ind">IND</span>
                              <span className="plate-number">{vehicle.registration_number}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(vehicle.registration_number);
                                toast.success(`Vehicle number ${vehicle.registration_number} copied`);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              title="Copy vehicle number"
                              aria-label="Copy vehicle number"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>

                        {/* 3. Vendor ID & Name */}
                        {visibleColumns.vendor && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2.5">
                              <div
                                className="vendor-avatar-box"
                                style={{ backgroundColor: avatar.bg }}
                                title={vendorName || 'No Vendor'}
                              >
                                {avatar.initials}
                              </div>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                {hasVendor ? (
                                  <>
                                    {onNavigateToVendorProfile && vendorMeta.vendorId ? (
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToVendorProfile(vendorMeta.vendorId)}
                                        className="font-semibold text-slate-900 text-[13px] truncate max-w-[170px] hover:text-[#F05A22] hover:underline text-left block"
                                        title={`View vendor profile: ${vendorName}`}
                                      >
                                        {vendorName}
                                      </button>
                                    ) : (
                                      <div
                                        className="font-semibold text-slate-900 text-[13px] truncate max-w-[170px]"
                                        title={vendorName}
                                      >
                                        {vendorName}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="font-mono text-slate-500 text-[11px] truncate max-w-[125px]" title={vendorCode}>
                                        {vendorCode}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(vendorCode);
                                          toast.success('Vendor ID copied to clipboard');
                                        }}
                                        className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                                        title="Copy Vendor ID"
                                        aria-label="Copy Vendor ID"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-slate-400 italic text-[12.5px] truncate max-w-[170px]">
                                      Vendor name not provided
                                    </div>
                                    <div className="font-mono text-slate-400 text-[11px]">
                                      —
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 4. Vehicle Category */}
                        {visibleColumns.category && (
                          <td>
                            <div className="flex items-center gap-1.5">
                              <Truck size={15} className="text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-800 text-[13px]" title={vehicle.vehicle_type}>
                                {formatVehicleCategory(vehicle.vehicle_type)}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* 5. Body Type */}
                        {visibleColumns.bodyType && (
                          <td>
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[12px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                              {vehicle.body_type || 'Open Body'}
                            </span>
                          </td>
                        )}

                        {/* 6. Rated Capacity */}
                        {visibleColumns.ratedCapacity && (
                          <td className="font-mono font-bold text-slate-700 text-right pr-6 whitespace-nowrap">
                            {vehicle.rated_capacity_mt != null ? `${Number(vehicle.rated_capacity_mt).toFixed(1)} MT` : '—'}
                          </td>
                        )}

                        {/* 7. Minimum Capacity */}
                        {visibleColumns.minCapacity && (
                          <td className="font-mono text-slate-600 text-right pr-6 whitespace-nowrap">
                            {vehicle.minimum_capacity_mt != null ? `${Number(vehicle.minimum_capacity_mt).toFixed(1)} MT` : '—'}
                          </td>
                        )}

                        {/* 8. Ownership */}
                        {visibleColumns.ownership && (
                          <td>{renderOwnershipBadge(ownership)}</td>
                        )}

                        {/* 9. Documents */}
                        {visibleColumns.documents && (
                          <td>{renderDocumentSummary(vehicle)}</td>
                        )}

                        {/* 10. Verification Status */}
                        {visibleColumns.status && (
                          <td>{renderVerificationBadge(vehicle)}</td>
                        )}

                        {/* 11. Updated At (Single-line) */}
                        {visibleColumns.updatedAt && (
                          <td className="text-slate-600 text-[12px] whitespace-nowrap">
                            <span title={`Full timestamp: ${vehicle.updated_at || vehicle.created_at}`}>
                              {formatSingleLineDateTime(vehicle.updated_at || vehicle.created_at)}
                            </span>
                          </td>
                        )}

                        {/* 12. Actions (Sticky Right 0) */}
                        <td className="sticky-col-actions" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Primary Eye View Button */}
                            <button
                              onClick={() => setFullViewVehicle(vehicle)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="View Vehicle Details"
                              aria-label="View Vehicle Details"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Floating Actions Menu Toggle */}
                            <button
                              onClick={(e) => handleToggleActionMenu(vehicle, e)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isMenuOpen
                                  ? 'bg-orange-50 text-[#F05A22]'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                              }`}
                              title="More actions"
                              aria-label="Actions menu"
                              aria-expanded={isMenuOpen}
                            >
                              <MoreVertical size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based List (Shown on screens < 768px) */}
            <div className="block md:hidden divide-y divide-slate-100 p-2">
              {vehicles.map((vehicle) => {
                const vendorMeta = transporterDetails[vehicle.id];
                const hasVendor = Boolean(vendorMeta && vendorMeta.vendorName);
                const vendorName = hasVendor ? vendorMeta.vendorName : 'Vendor name not provided';
                const vendorCode = vendorMeta?.vendorCode || '—';
                const ownership = vendorMeta?.ownership || (vehicle as any).ownership_type || 'Owned';

                return (
                  <div
                    key={vehicle.id}
                    className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="vehicle-plate-badge">
                        <span className="plate-ind">IND</span>
                        <span className="plate-number">{vehicle.registration_number}</span>
                      </div>
                      <div>{renderVerificationBadge(vehicle)}</div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Vendor:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[180px]">{vendorName}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Vendor ID:</span>
                        <span className="font-mono text-slate-600">{vendorCode}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Category & Type:</span>
                        <span className="font-semibold text-slate-800">
                          {formatVehicleCategory(vehicle.vehicle_type)} • {vehicle.body_type || 'Open Body'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Rated Capacity:</span>
                        <span className="font-mono font-bold text-slate-700">
                          {vehicle.rated_capacity_mt != null ? `${Number(vehicle.rated_capacity_mt).toFixed(1)} MT` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Ownership:</span>
                        <span>{renderOwnershipBadge(ownership)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Documents:</span>
                        <div>{renderDocumentSummary(vehicle)}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Updated: {formatSingleLineDateTime(vehicle.updated_at || vehicle.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFullViewVehicle(vehicle)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-50 text-[#F05A22] hover:bg-orange-100"
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => handleToggleActionMenu(vehicle, e)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200"
                          title="More actions"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 6. Pagination Row */}
        {!loading && vehicles.length > 0 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div className="text-xs text-slate-500 font-medium">
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, total)} of {total} vehicles
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="First page"
              >
                First
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(6, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 6 && page > 3) {
                  pageNum = Math.min(totalPages, page - 3 + i);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      page === pageNum
                        ? 'bg-[#F05A22] text-white'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Last page"
              >
                Last
              </button>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="ml-2 text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 7. Dedicated Full View Drawer (Right-side slide-in) */}
      {fullViewVehicle && (
        <div className="detail-drawer-backdrop" onClick={() => setFullViewVehicle(null)}>
          <div className="detail-drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* Header (Fixed) */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50" style={{ flexShrink: 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#F05A22] flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Vehicle Full View</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {fullViewVehicle.registration_number} • {fullViewVehicle.vehicle_type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFullViewVehicle(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Overall Status Banner */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Verification Status</div>
                  <div className="mt-1">{renderVerificationBadge(fullViewVehicle)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Operational Status</div>
                  <span
                    className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded ${
                      fullViewVehicle.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {fullViewVehicle.status || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Vendor Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Vendor Information
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Vendor ID:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {transporterDetails[fullViewVehicle.id]?.vendorCode ||
                        formatDisplayId('VD', fullViewVehicle.id)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Company Name:</span>
                    <span className="font-bold text-slate-800">
                      {transporterDetails[fullViewVehicle.id]?.vendorName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Contact Phone:</span>
                    <span className="text-slate-700">
                      {transporterDetails[fullViewVehicle.id]?.phone || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Registered Email:</span>
                    <span className="text-slate-700">
                      {transporterDetails[fullViewVehicle.id]?.email || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle Specifications */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Vehicle Specifications
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Registration Number</div>
                    <div className="font-bold font-mono text-slate-900">
                      {fullViewVehicle.registration_number}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Category</div>
                    <div className="font-bold text-slate-900">{fullViewVehicle.vehicle_type}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Body Type</div>
                    <div className="font-bold text-slate-900">
                      {fullViewVehicle.body_type || 'Open Body'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Ownership</div>
                    <div className="font-bold text-slate-900">
                      {transporterDetails[fullViewVehicle.id]?.ownership || 'Owned'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Rated Capacity</div>
                    <div className="font-bold text-slate-900 font-mono">
                      {fullViewVehicle.rated_capacity_mt} MT
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Minimum Capacity</div>
                    <div className="font-bold text-slate-900 font-mono">
                      {fullViewVehicle.minimum_capacity_mt} MT
                    </div>
                  </div>
                </div>
              </div>

              {/* C. Associated Driver Information */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Associated Driver Information
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignDriver(fullViewVehicle)}
                    className="text-xs font-bold text-[#F05A22] hover:underline flex items-center gap-1"
                  >
                    <span>
                      {driverAssignments[fullViewVehicle.id]?.currentDriver
                        ? 'Change Driver'
                        : '+ Assign Driver'}
                    </span>
                  </button>
                </div>

                {driverAssignments[fullViewVehicle.id]?.currentDriver ? (
                  (() => {
                    const currDriver = driverAssignments[fullViewVehicle.id].currentDriver;
                    const currTrip = driverAssignments[fullViewVehicle.id].currentTrip;
                    const isDlExpired =
                      currDriver.licence_expiry_date &&
                      new Date(currDriver.licence_expiry_date) < new Date();
                    const driverDisplayId =
                      currDriver.driver_code || formatDisplayId('DR', currDriver.id);

                    return (
                      <div className="space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                {currDriver.full_name?.substring(0, 2).toUpperCase() || 'DR'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                  <span>{currDriver.full_name}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      currDriver.status === 'APPROVED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : currDriver.status === 'REJECTED'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {currDriver.status || 'VERIFIED'}
                                  </span>
                                </div>
                                <div className="text-slate-500 font-mono text-xs">
                                  {driverDisplayId}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToDriverProfile) {
                                  onNavigateToDriverProfile(currDriver.id);
                                } else {
                                  handleOpenDriverDetails(fullViewVehicle, currDriver, currTrip);
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                            >
                              <span>View Driver Profile</span>
                              <ExternalLink size={11} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                            <div>
                              <span className="text-slate-500">Mobile:</span>{' '}
                              <span className="font-semibold text-slate-800">
                                {currDriver.mobile || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">DL Number:</span>{' '}
                              <span className="font-mono font-bold text-slate-800">
                                {currDriver.licence_number || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">DL Expiry:</span>{' '}
                              <span
                                className={`font-semibold ${
                                  isDlExpired ? 'text-rose-600 font-bold' : 'text-slate-800'
                                }`}
                              >
                                {currDriver.licence_expiry_date || '—'}{' '}
                                {isDlExpired && '(Expired)'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Assignment:</span>{' '}
                              <span className="font-semibold text-emerald-700">
                                {currTrip?.id
                                  ? `Trip #${currTrip.id.substring(0, 8)}`
                                  : 'Assigned to Vehicle'}
                              </span>
                            </div>
                          </div>

                          {currTrip?.booking && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200 text-xs flex justify-between items-center text-slate-600">
                              <span>Active Booking Ref:</span>
                              <span className="font-mono font-bold text-slate-800">
                                {currTrip.booking.booking_reference || currTrip.booking.id}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Assignment History Subsection */}
                        {driverAssignments[fullViewVehicle.id]?.history?.length > 1 && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              Previous Driver Assignments
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {driverAssignments[fullViewVehicle.id].history
                                .slice(1)
                                .map((hItem, hIdx) => {
                                  const hDriver = Array.isArray(hItem.driver)
                                    ? hItem.driver[0]
                                    : hItem.driver;
                                  return (
                                    <div
                                      key={hItem.id || hIdx}
                                      className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <span className="font-semibold text-slate-800">
                                          {hDriver?.full_name ||
                                            'Driver ' + (hItem.driver_id || '—')}
                                        </span>
                                        <span className="text-slate-400 text-[11px] ml-2">
                                          {formatDateTime(hItem.created_at)}
                                        </span>
                                      </div>
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                                        {hItem.trip_status || 'ASSIGNED'}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-300 text-center">
                    <User size={24} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700 mb-1">
                      No Driver Currently Assigned
                    </p>
                    <p className="text-[11.5px] text-slate-500 mb-3">
                      Assign a verified driver from this vendor to enable trip dispatch.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignDriver(fullViewVehicle)}
                      className="px-3 py-1.5 rounded-lg bg-[#F05A22] text-white text-xs font-bold hover:bg-[#d84a16] transition-colors"
                    >
                      Assign Driver Now
                    </button>
                  </div>
                )}
              </div>

              {/* Documents & Verification Details */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Document Verification Details
                </h4>
                <div className="space-y-2">
                  {/* RC */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-slate-500" />
                        <span>Registration Certificate (RC)</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        No: {fullViewVehicle.rc_number || 'RC-' + fullViewVehicle.registration_number}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          fullViewVehicle.rc_verification_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fullViewVehicle.rc_verification_status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {fullViewVehicle.rc_verification_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Insurance */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-slate-500" />
                        <span>Insurance Certificate</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Policy: {fullViewVehicle.insurance_policy_number || 'Valid Policy'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          fullViewVehicle.insurance_verification_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fullViewVehicle.insurance_verification_status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {fullViewVehicle.insurance_verification_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Fitness */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-slate-500" />
                        <span>Fitness Certificate</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Status: Certified roadworthy
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          fullViewVehicle.fitness_verification_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fullViewVehicle.fitness_verification_status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {fullViewVehicle.fitness_verification_status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Permit */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-slate-500" />
                        <span>Commercial National/State Permit</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Valid for all-India freight transport
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          fullViewVehicle.permit_verification_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : fullViewVehicle.permit_verification_status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {fullViewVehicle.permit_verification_status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks or Feedback */}
              {fullViewVehicle.rejection_reason && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Admin Feedback & Remarks
                  </h4>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    {fullViewVehicle.rejection_reason}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Actions Footer (Fixed) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap" style={{ flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAssignDriver(fullViewVehicle)}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <User size={14} />
                  <span>Assign / Change Driver</span>
                </button>
                <button
                  onClick={() => handleOpenVerifyDocs(fullViewVehicle)}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} />
                  <span>Verify Documents</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenCorrection(fullViewVehicle)}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5"
                >
                  <MessageSquare size={14} />
                  <span>Request Corrections</span>
                </button>

                {fullViewVehicle.verification_status !== 'APPROVED' ? (
                  <button
                    onClick={() => handleApproveVehicle(fullViewVehicle)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle size={14} />
                    <span>Approve Vehicle</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenReject(fullViewVehicle)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <Ban size={14} />
                    <span>Reject</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg text-[#F05A22]">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Edit Vehicle Record</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {editingVehicle.registration_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVehicle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle Category
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                >
                  <option value="Lorry">Lorry</option>
                  <option value="Trailer">Trailer</option>
                  <option value="Van">Van</option>
                  <option value="Heavy Carrier">Heavy Carrier</option>
                  <option value="10 Wheeler">10 Wheeler</option>
                  <option value="12 Wheeler">12 Wheeler</option>
                  <option value="14 Wheeler">14 Wheeler</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Body Type</label>
                <select
                  value={editForm.bodyType}
                  onChange={(e) => setEditForm({ ...editForm, bodyType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                >
                  <option value="Open Body">Open Body</option>
                  <option value="Closed Body">Closed Body</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rated Capacity (MT)
                  </label>
                  <input
                    type="number"
                    value={editForm.ratedCapacityMt}
                    onChange={(e) =>
                      setEditForm({ ...editForm, ratedCapacityMt: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Capacity (MT)
                  </label>
                  <input
                    type="number"
                    value={editForm.minimumCapacityMt}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        minimumCapacityMt: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">RC Number</label>
                <input
                  type="text"
                  value={editForm.rcNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, rcNumber: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operational Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F05A22]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingVehicle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-[#F05A22] hover:bg-[#d94e1b] rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Verify Documents Modal */}
      {verifyingVehicle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-base">Verify Vehicle Documents</h3>
                  <p className="text-xs text-emerald-700 font-mono">
                    {verifyingVehicle.registration_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingVehicle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Review and update individual document verification statuses. Vehicle will become eligible for operations once all required documents are marked Approved.
              </p>

              {/* RC */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Registration Certificate (RC)</div>
                  <div className="text-[11px] text-slate-500">Document No: {verifyingVehicle.rc_number || verifyingVehicle.registration_number}</div>
                </div>
                <select
                  value={docStatuses.rc}
                  onChange={(e) => setDocStatuses({ ...docStatuses, rc: e.target.value as any })}
                  className="text-xs font-bold px-2.5 py-1.5 rounded border border-slate-300 outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {/* Insurance */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Vehicle Insurance</div>
                  <div className="text-[11px] text-slate-500">Policy: {verifyingVehicle.insurance_policy_number || 'Standard Cover'}</div>
                </div>
                <select
                  value={docStatuses.insurance}
                  onChange={(e) => setDocStatuses({ ...docStatuses, insurance: e.target.value as any })}
                  className="text-xs font-bold px-2.5 py-1.5 rounded border border-slate-300 outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {/* Fitness */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Fitness Certificate</div>
                  <div className="text-[11px] text-slate-500">RTO Vehicle Fitness Compliance</div>
                </div>
                <select
                  value={docStatuses.fitness}
                  onChange={(e) => setDocStatuses({ ...docStatuses, fitness: e.target.value as any })}
                  className="text-xs font-bold px-2.5 py-1.5 rounded border border-slate-300 outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              {/* Permit */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Commercial Permit</div>
                  <div className="text-[11px] text-slate-500">National / State Freight Transport Permit</div>
                </div>
                <select
                  value={docStatuses.permit}
                  onChange={(e) => setDocStatuses({ ...docStatuses, permit: e.target.value as any })}
                  className="text-xs font-bold px-2.5 py-1.5 rounded border border-slate-300 outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setVerifyingVehicle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDocStatuses}
                disabled={isSavingDocs}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle size={14} />
                <span>{isSavingDocs ? 'Updating...' : 'Save Document Statuses'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Reject Vehicle Modal */}
      {rejectingVehicle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-rose-900 text-base">Reject Vehicle</h3>
                  <p className="text-xs text-rose-600 font-mono">
                    {rejectingVehicle.registration_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectingVehicle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600">
                Please provide the mandatory rejection reason. This will be recorded in the database audit log and sent to the vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. RC document unreadable or expired; Fitness certificate missing..."
                rows={4}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectingVehicle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isSubmittingReject}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <Ban size={14} />
                <span>{isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Request Corrections Modal */}
      {correctionVehicle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950 text-base">Request Corrections</h3>
                  <p className="text-xs text-amber-700 font-mono">
                    {correctionVehicle.registration_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCorrectionVehicle(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600">
                Identify the exact fields or documents requiring correction. The vendor will see these instructions in the Vendor App to update and resubmit.
              </p>
              <textarea
                value={correctionFeedback}
                onChange={(e) => setCorrectionFeedback(e.target.value)}
                placeholder="e.g. Please re-upload a clear copy of the commercial fitness certificate and update the vehicle capacity..."
                rows={4}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setCorrectionVehicle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCorrection}
                disabled={isSubmittingCorrection}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <MessageSquare size={14} />
                <span>{isSubmittingCorrection ? 'Submitting...' : 'Send Correction Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Floating Action Menu (Viewport positioned, matching VendorDirectory) */}
      {menuAnchor && (() => {
        const vehicle = menuAnchor.vehicle;
        const assignment = driverAssignments[vehicle.id];
        const currentDriver = assignment?.currentDriver;
        const currentTrip = assignment?.currentTrip;
        const vendorMeta = transporterDetails[vehicle.id];
        const isApproved = vehicle.verification_status === 'APPROVED';
        const isRejected = vehicle.verification_status === 'REJECTED';

        return (
          <div
            className="vehicle-action-menu-dropdown"
            style={{
              position: 'fixed',
              top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
              bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
              right: `${menuAnchor.right}px`,
              zIndex: 9999,
              width: '240px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              boxShadow:
                '0 10px 25px -5px rgba(15, 23, 42, 0.20), 0 8px 10px -6px rgba(15, 23, 42, 0.10)',
              padding: '6px 0',
              textAlign: 'left',
            }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. View Vehicle — Full Details */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#0F172A',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setFullViewVehicle(vehicle);
              }}
            >
              <Eye size={14} color="#F05A22" />
              <span>View Vehicle — Full Details</span>
            </button>

            {/* 2. View Driver Details */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (currentDriver) {
                  handleOpenDriverDetails(vehicle, currentDriver, currentTrip);
                } else {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  handleOpenAssignDriver(vehicle);
                }
              }}
            >
              <User size={14} color="#3B82F6" />
              <span>{currentDriver ? 'View Driver Details' : 'Assign Driver Details'}</span>
            </button>

            {/* 3. Edit Vehicle Information */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                handleOpenEdit(vehicle);
              }}
            >
              <Edit2 size={14} color="#64748B" />
              <span>Edit Vehicle Information</span>
            </button>

            {/* 4. Verify Documents */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                handleOpenVerifyDocs(vehicle);
              }}
            >
              <ShieldCheck size={14} color="#059669" />
              <span>Verify Documents</span>
            </button>

            {/* Separator */}
            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

            {/* 5. Approve Vehicle */}
            {!isApproved && (
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 14px',
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  color: '#16A34A',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  handleApproveVehicle(vehicle);
                }}
              >
                <CheckCircle size={14} color="#16A34A" />
                <span>Approve Vehicle</span>
              </button>
            )}

            {/* 6. Reject Vehicle */}
            {!isRejected && (
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 14px',
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  color: '#DC2626',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  handleOpenReject(vehicle);
                }}
              >
                <Ban size={14} color="#DC2626" />
                <span>Reject Vehicle</span>
              </button>
            )}

            {/* 7. Request Corrections */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#D97706',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                handleOpenCorrection(vehicle);
              }}
            >
              <MessageSquare size={14} color="#D97706" />
              <span>Request Corrections</span>
            </button>

            {/* Separator */}
            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

            {/* 8. View Verification History */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#475569',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setViewingHistoryVehicle(vehicle);
              }}
            >
              <Clock size={14} color="#64748B" />
              <span>View Verification History</span>
            </button>

            {/* 9. View Vendor Details */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                color: '#475569',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                if (onNavigateToVendorProfile && vendorMeta?.vendorId) {
                  onNavigateToVendorProfile(vendorMeta.vendorId);
                } else {
                  setViewingVendorModal({ vendorMeta, vehicle });
                }
              }}
            >
              <Building2 size={14} color="#64748B" />
              <span>View Vendor Details</span>
            </button>
          </div>
        );
      })()}

      {/* 13. View Driver Details Modal */}
      {viewingDriverModal && (() => {
        const d = viewingDriverModal.driver;
        const veh = viewingDriverModal.vehicle;
        const trip = viewingDriverModal.trip;
        const isDlExpired = d.licence_expiry_date && new Date(d.licence_expiry_date) < new Date();
        const displayId = d.driver_code || formatDisplayId('DR', d.id);

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Driver Profile & Verification</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {d.full_name} • {displayId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDriverModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Verification Status & Active Assignment */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-slate-500 text-[11px]">Verification Status</div>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded font-bold ${
                        d.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {d.status || 'VERIFIED'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 text-[11px]">Assigned Vehicle</div>
                    <span className="font-mono font-bold text-slate-800">
                      {veh.registration_number}
                    </span>
                  </div>
                </div>

                {/* Driver Credentials */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Mobile Number</div>
                    <div className="font-bold text-slate-800">{d.mobile || '—'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Driving Licence</div>
                    <div className="font-bold font-mono text-slate-800">{d.licence_number || '—'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Licence Expiry</div>
                    <div
                      className={`font-semibold ${
                        isDlExpired ? 'text-rose-600 font-bold' : 'text-slate-800'
                      }`}
                    >
                      {d.licence_expiry_date || '—'} {isDlExpired && '(Expired)'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-slate-500 mb-0.5">Operational Status</div>
                    <div className="font-semibold text-emerald-700">
                      {trip?.id ? `On Trip #${trip.id.substring(0, 8)}` : 'Available on Vehicle'}
                    </div>
                  </div>
                </div>

                {/* Driver Documents & Verification Preview */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2 uppercase text-[11px] tracking-wider">
                    Driver Documents & KYC
                  </h4>
                  {loadingDriverDocs ? (
                    <div className="text-center py-4 text-slate-400">Loading documents...</div>
                  ) : driverDocs.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-center">
                      No standalone uploaded documents on file. Licence verified via transport authority records.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {driverDocs.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-slate-500" />
                            <div>
                              <div className="font-bold text-slate-800">
                                {doc.document_type || 'Document'}
                              </div>
                              <div className="text-slate-400 text-[10.5px]">
                                Uploaded {formatDateTime(doc.created_at)}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              doc.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {doc.status || 'VERIFIED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setViewingDriverModal(null);
                    handleOpenAssignDriver(veh);
                  }}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Change Driver
                </button>
                <button
                  onClick={() => setViewingDriverModal(null)}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 14. Assign / Change Driver Modal */}
      {assigningDriverVehicle && (() => {
        const veh = assigningDriverVehicle;
        const currentAssign = driverAssignments[veh.id];
        const currentDriver = currentAssign?.currentDriver;
        const vendorMeta = transporterDetails[veh.id];

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg text-[#F05A22]">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Assign / Change Driver</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Vehicle: {veh.registration_number} • {vendorMeta?.vendorName || 'Transporter'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAssigningDriverVehicle(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {currentDriver && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                    <div className="font-bold mb-0.5">Current Active Assignment:</div>
                    <div>
                      {currentDriver.full_name} ({currentDriver.licence_number || 'DL On File'})
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Verified Driver
                  </label>
                  {loadingEligibleDrivers ? (
                    <div className="text-center py-4 text-slate-400">Loading eligible drivers...</div>
                  ) : eligibleDrivers.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                      No verified drivers found for this vendor. Please ensure the vendor has registered drivers in the Drivers Directory.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {eligibleDrivers.map((d: any) => {
                        const isExpired =
                          d.licence_expiry_date && new Date(d.licence_expiry_date) < new Date();
                        const conflict = activeDriverTrips[d.id];
                        const isBusyOnOther = conflict && conflict.vehicle_id !== veh.id;
                        const isSelected = selectedDriverId === d.id;

                        return (
                          <div
                            key={d.id}
                            onClick={() => {
                              if (!isExpired && !isBusyOnOther) {
                                setSelectedDriverId(d.id);
                              }
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'border-[#F05A22] bg-orange-50/50'
                                : isExpired || isBusyOnOther
                                ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-900 text-[13px] flex items-center gap-2">
                                <span>{d.full_name}</span>
                                {d.driver_code && (
                                  <span className="font-mono text-[11px] text-slate-500 font-normal">
                                    {d.driver_code}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[11.5px] mt-0.5">
                                DL: {d.licence_number || '—'} • Expiry:{' '}
                                {d.licence_expiry_date || '—'}
                              </div>
                              {isExpired && (
                                <div className="text-rose-600 font-semibold text-[11px] mt-1">
                                  ⚠️ Licence Expired. Cannot assign.
                                </div>
                              )}
                              {isBusyOnOther && (
                                <div className="text-amber-700 font-semibold text-[11px] mt-1">
                                  ⚠️ Active on another trip/vehicle.
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {isSelected && <CheckCircle size={18} color="#F05A22" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningDriverVehicle(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedDriverId || isSubmittingDriverAssignment}
                  onClick={handleConfirmDriverAssignment}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#F05A22] hover:bg-[#d84a16] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm"
                >
                  {isSubmittingDriverAssignment ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 15. Verification History Modal */}
      {viewingHistoryVehicle && (() => {
        const veh = viewingHistoryVehicle;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Verification History</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {veh.registration_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingHistoryVehicle(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Current Status</span>
                    {renderVerificationBadge(veh)}
                  </div>
                  {veh.verified_at && (
                    <div className="flex justify-between text-slate-500">
                      <span>Verified At:</span>
                      <span className="font-semibold text-slate-700">
                        {formatDateTime(veh.verified_at)}
                      </span>
                    </div>
                  )}
                  {veh.verified_by && (
                    <div className="flex justify-between text-slate-500">
                      <span>Verified By:</span>
                      <span className="font-semibold text-slate-700">{veh.verified_by}</span>
                    </div>
                  )}
                  {veh.rejection_reason && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="text-rose-600 font-bold mb-0.5">Remarks / Feedback:</div>
                      <div className="text-slate-700">{veh.rejection_reason}</div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[11px] mb-1">Registration Record Created</div>
                  <div className="font-semibold text-slate-800">{formatDateTime(veh.created_at)}</div>
                  {veh.updated_at && (
                    <div className="text-slate-400 text-[11px] mt-1">
                      Last Updated: {formatDateTime(veh.updated_at)}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => setViewingHistoryVehicle(null)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 16. Vendor Details Modal */}
      {viewingVendorModal && (() => {
        const vm = viewingVendorModal.vendorMeta;
        const veh = viewingVendorModal.vehicle;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg text-[#F05A22]">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Associated Vendor Details</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {vm?.vendorCode || 'Vendor'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingVendorModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Company Name:</span>
                    <span className="font-bold text-slate-800">{vm?.vendorName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vendor ID:</span>
                    <span className="font-mono font-bold text-slate-800">{vm?.vendorCode || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact Phone:</span>
                    <span className="text-slate-800">{vm?.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact Email:</span>
                    <span className="text-slate-800">{vm?.email || '—'}</span>
                  </div>
                  {vm?.gstin && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">GSTIN:</span>
                      <span className="font-mono text-slate-800">{vm.gstin}</span>
                    </div>
                  )}
                  {vm?.pan && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">PAN:</span>
                      <span className="font-mono text-slate-800">{vm.pan}</span>
                    </div>
                  )}
                  {vm?.address && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Registered Address:</span>
                      <div className="text-slate-700 mt-0.5">{vm.address}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                {onNavigateToVendorProfile && vm?.vendorId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingVendorModal(null);
                      onNavigateToVendorProfile(vm.vendorId);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#F05A22] hover:bg-[#d84a16] rounded-lg flex items-center gap-1.5"
                  >
                    <span>Open Vendor Profile</span>
                    <ExternalLink size={12} />
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => setViewingVendorModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
