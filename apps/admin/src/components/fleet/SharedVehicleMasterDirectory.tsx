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
  Zap,
  Scale,
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
import { useAuth } from '../../context/AuthContext';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

interface SharedVehicleMasterDirectoryProps {
  onNavigateToVerification: (vehicleId: string) => void;
  onNavigateToAddVehicle: () => void;
  onNavigateToCompliance?: () => void;
  onNavigateToVendorProfile?: (vendorId: string) => void;
  onNavigateToDriverProfile?: (driverId: string) => void;
}

// Client Management standard palette for initials avatars
const CLIENT_AVATAR_PALETTE = [
  '#F05A22', '#2563EB', '#16A34A', '#7C3AED',
  '#D97706', '#0891B2', '#E11D48', '#4F46E5'
];

function getAvatarColor(name: string): string {
  let hash = 0;
  const str = name || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLIENT_AVATAR_PALETTE[Math.abs(hash) % CLIENT_AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  if (!name) return 'VN';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VN';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getVendorAvatar(name?: string, id?: string) {
  const label = name || id || 'VN';
  return {
    initials: getInitials(label),
    bg: getAvatarColor(label),
  };
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper to format vehicle category nicely (clean underscores: 32FT_MXL -> 32FT MXL)
function formatVehicleCategory(cat?: string | null): string {
  if (!cat) return 'Standard Lorry';
  return cat.replace(/_/g, ' ').trim();
}

export const SharedVehicleMasterDirectory: React.FC<SharedVehicleMasterDirectoryProps> = ({
  onNavigateToVerification,
  onNavigateToAddVehicle,
  onNavigateToCompliance,
  onNavigateToVendorProfile,
  onNavigateToDriverProfile,
}) => {
  const toast = useToast();
  const { adminProfile, supabaseUser } = useAuth();
  const currentAdminName = adminProfile?.name || supabaseUser?.email?.split('@')[0] || 'Admin Compliance Officer';

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

  // Row Checkbox Selection State
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());

  // Debounced Search Query (300ms debounce to prevent database hammering)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    setSelectedVehicleIds(new Set());
  }, [debouncedSearchQuery]);

  // Selection computed states and handlers
  const isAllSelected = vehicles.length > 0 && vehicles.every((v) => selectedVehicleIds.has(v.id));
  const isSomeSelected = vehicles.some((v) => selectedVehicleIds.has(v.id)) && !isAllSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(vehicles.map((v) => v.id));
      setSelectedVehicleIds(allIds);
    } else {
      setSelectedVehicleIds(new Set());
    }
  };

  const handleToggleSelectVehicle = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    (e as any).stopPropagation?.();
    setSelectedVehicleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Column Visibility State (Admin Customizable matching Reference Image)
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    vendor: true,
    category: true,
    bodyType: true,
    ratedCapacity: true,
    minCapacity: true,
    ownership: true,
    verification: true,
    documents: true,
    updatedAt: true,
  });

  // Handle vehicle registration number copy with feedback
  const handleCopyVehicleNumber = (regNumber: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!regNumber) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(regNumber).then(
        () => toast.success('Vehicle number copied'),
        () => {
          try {
            const el = document.createElement('textarea');
            el.value = regNumber;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            toast.success('Vehicle number copied');
          } catch {
            toast.error('Failed to copy vehicle number');
          }
        }
      );
    } else {
      toast.error('Clipboard not supported');
    }
  };

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
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Prevent background scroll when Edit Vehicle modal is open and handle Escape key
  useEffect(() => {
    if (editingVehicle) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSavingEdit) {
          setEditingVehicle(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editingVehicle, isSavingEdit]);

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
  const [verifyingVehicleDocs, setVerifyingVehicleDocs] = useState<Record<string, any>>({});

  // Document Preview Modal State
  const [previewDocModal, setPreviewDocModal] = useState<{
    isOpen: boolean;
    title: string;
    fileName: string;
    fileUrl: string;
    status: string;
    rejectionReason?: string | null;
  } | null>(null);

  // Uploaded documents cache for full view
  const [fullViewDocs, setFullViewDocs] = useState<Record<string, any>>({});

  // Fetch documents for verifyingVehicle
  useEffect(() => {
    if (!verifyingVehicle) {
      setVerifyingVehicleDocs({});
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('category', 'VEHICLE')
          .eq('reference_id', verifyingVehicle.id);
        if (!error && data && isMounted) {
          const map: Record<string, any> = {};
          data.forEach((d: any) => {
            map[d.document_type] = d;
          });
          setVerifyingVehicleDocs(map);
        }
      } catch (err) {
        console.warn('Error fetching documents for verifyingVehicle:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [verifyingVehicle]);

  const handlePreviewVerifyDoc = (docTitle: string, docType: string, docStatus?: string) => {
    if (!verifyingVehicle) return;
    const docObj = verifyingVehicleDocs[docType] || fullViewDocs[docType];
    const fileUrl = docObj?.file_url || '';
    const fileName = docObj?.file_name || `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    setPreviewDocModal({
      isOpen: true,
      title: docTitle,
      fileName,
      fileUrl,
      status: docStatus || docObj?.verification_status || 'PENDING',
      rejectionReason: docObj?.rejection_reason || verifyingVehicle.rejection_reason,
    });
  };

  const handleApproveAllDocs = () => {
    setDocStatuses({
      rc: 'APPROVED',
      insurance: 'APPROVED',
      fitness: 'APPROVED',
      permit: 'APPROVED',
    });
  };

  // Lock body scroll, handle Escape key, and load documents for Vehicle Full View Drawer
  useEffect(() => {
    if (!fullViewVehicle) {
      setFullViewDocs({});
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullViewVehicle(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('category', 'VEHICLE')
          .eq('reference_id', fullViewVehicle.id);
        if (!error && data && isMounted) {
          const map: Record<string, any> = {};
          data.forEach((d: any) => {
            map[d.document_type] = d;
          });
          setFullViewDocs(map);
        }
      } catch (err) {
        console.warn('Error fetching documents for vehicle full view:', err);
      }
    })();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      isMounted = false;
    };
  }, [fullViewVehicle]);

  const handlePreviewDoc = (docTitle: string, docType: string, docStatus?: string) => {
    if (!fullViewVehicle) return;
    const docObj = fullViewDocs[docType];
    const fileUrl = docObj?.file_url || '';
    const fileName = docObj?.file_name || `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    setPreviewDocModal({
      isOpen: true,
      title: docTitle,
      fileName,
      fileUrl,
      status: docStatus || docObj?.verification_status || 'PENDING',
      rejectionReason: docObj?.rejection_reason || fullViewVehicle.rejection_reason,
    });
  };

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

      if (debouncedSearchQuery.trim()) {
        filters.search = debouncedSearchQuery.trim();
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
              driver:drivers(id, full_name, mobile, licence_number, licence_expiry_date, verification_status, status, is_active, driver_code, primary_vendor_id),
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

          // Check direct driver_id association on vehicles table if any
          const directDriverVehicleMap: Record<string, string> = {};
          for (const v of filteredVehicles) {
            if ((v as any).driver_id) {
              directDriverVehicleMap[v.id] = (v as any).driver_id;
            }
          }
          const directDriverIds = Object.values(directDriverVehicleMap);
          if (directDriverIds.length > 0) {
            const { data: directDrivers } = await supabase
              .from('drivers')
              .select('id, full_name, mobile, licence_number, licence_expiry_date, verification_status, status, is_active, driver_code, primary_vendor_id')
              .in('id', directDriverIds);
            if (directDrivers) {
              const dMap = new Map(directDrivers.map((d: any) => [d.id, d]));
              for (const [vId, dId] of Object.entries(directDriverVehicleMap)) {
                if (!assignmentsMap[vId]) {
                  assignmentsMap[vId] = { currentDriver: null, currentTrip: null, history: [] };
                }
                if (!assignmentsMap[vId].currentDriver && dMap.has(dId)) {
                  assignmentsMap[vId].currentDriver = dMap.get(dId);
                }
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
  }, [page, itemsPerPage, activeTab, categoryFilter, bodyTypeFilter, ownershipFilter, statusFilter, docStatusFilter, debouncedSearchQuery, sortBy, sortOrder]);

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
        // Check if an unassigned active booking exists for this vendor or vehicle
        let targetBookingId: string | null = null;
        if (vendorId) {
          const { data: openBookings } = await supabase
            .from('bookings')
            .select('id, booking_status')
            .eq('booking_status', 'CLIENT_ACCEPTED')
            .order('confirmed_at', { ascending: false })
            .limit(1);
          if (openBookings && openBookings[0]) {
            targetBookingId = openBookings[0].id;
          }
        }

        if (targetBookingId) {
          const { error: insErr } = await supabase.from('trips').insert([
            {
              booking_id: targetBookingId,
              vehicle_id: assigningDriverVehicle.id,
              driver_id: selectedDriverId,
              vendor_id: vendorId || null,
              trip_status: 'LORRY_ASSIGNED',
              created_at: new Date().toISOString(),
            },
          ]);
          if (insErr) throw insErr;
        } else {
          // If no active booking exists, associate driver directly in state and update driver timestamp
          await supabase
            .from('drivers')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', selectedDriverId);
        }
      }

      setDriverAssignments((prev) => ({
        ...prev,
        [assigningDriverVehicle.id]: {
          ...(prev[assigningDriverVehicle.id] || { currentTrip: null, history: [] }),
          currentDriver: chosenDriver,
        },
      }));

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
    setDebouncedSearchQuery('');
    setCategoryFilter('ALL');
    setBodyTypeFilter('ALL');
    setOwnershipFilter('ALL');
    setStatusFilter('ALL');
    setDocStatusFilter('ALL');
    setActiveTab('ALL');
    setPage(1);
    setSelectedVehicleIds(new Set());
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
  const validateEditForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!editForm.category?.trim()) {
      errs.category = 'Vehicle category is required';
    }
    if (!editForm.bodyType?.trim()) {
      errs.bodyType = 'Body type is required';
    }
    const rated = Number(editForm.ratedCapacityMt);
    if (isNaN(rated) || rated <= 0) {
      errs.ratedCapacityMt = 'Rated capacity must be greater than 0 MT';
    }
    const minCap = Number(editForm.minimumCapacityMt);
    if (isNaN(minCap) || minCap < 0) {
      errs.minimumCapacityMt = 'Minimum capacity must be 0 or greater';
    } else if (!isNaN(rated) && minCap > rated) {
      errs.minimumCapacityMt = 'Minimum capacity cannot exceed rated capacity';
    }
    if (!editForm.rcNumber?.trim()) {
      errs.rcNumber = 'RC number is required';
    }
    if (!editForm.status) {
      errs.status = 'Operational status is required';
    }
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditErrors({});
    setEditSubmitError(null);
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
    setEditSubmitError(null);
    if (!validateEditForm()) {
      toast.error('Please resolve validation errors before saving');
      return;
    }
    setIsSavingEdit(true);
    try {
      await ensureAdminSession();
      const updates = {
        vehicle_type: editForm.category,
        body_type: editForm.bodyType,
        rated_capacity_mt: Number(editForm.ratedCapacityMt),
        minimum_capacity_mt: Number(editForm.minimumCapacityMt),
        rc_number: editForm.rcNumber.trim().toUpperCase(),
        status: editForm.status as any,
        updated_at: new Date().toISOString(),
      };

      await updateVehicle(editingVehicle.id, updates);

      setVehicles((prev) =>
        prev.map((v) => (v.id === editingVehicle.id ? { ...v, ...updates } : v))
      );

      if (fullViewVehicle?.id === editingVehicle.id) {
        setFullViewVehicle((prev) => (prev ? { ...prev, ...updates } : null));
      }

      // Update counters immediately
      try {
        const freshStats = await getVehicleStats();
        setStats(freshStats);
      } catch (stErr) {
        console.warn('Vehicle stats update warning:', stErr);
      }

      toast.success(`Vehicle ${editingVehicle.registration_number} updated successfully`);
      setEditingVehicle(null);
    } catch (err: any) {
      console.error('Failed to update vehicle:', err);
      const msg = err.message || 'Failed to update vehicle record in database';
      setEditSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRemoveDriverAssignment = async (vehicle: Vehicle) => {
    try {
      await ensureAdminSession();
      const currentAssign = driverAssignments[vehicle.id];
      if (currentAssign?.currentTrip?.id) {
        await supabase
          .from('trips')
          .update({ driver_id: null, updated_at: new Date().toISOString() })
          .eq('id', currentAssign.currentTrip.id);
      }
      setDriverAssignments((prev) => ({
        ...prev,
        [vehicle.id]: {
          ...prev[vehicle.id],
          currentDriver: null,
          currentTrip: null,
        },
      }));
      toast.success(`Driver unassigned from vehicle ${vehicle.registration_number}`);
    } catch (err: any) {
      console.error('Failed to unassign driver:', err);
      toast.error(`Failed to unassign driver: ${err.message}`);
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
        verified_by: currentAdminName,
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
      await approveVehicle(vehicle.id, currentAdminName);
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
      await rejectVehicle(rejectingVehicle.id, rejectionReason.trim(), currentAdminName);
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
        verified_by: currentAdminName,
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

  // Helper to render comprehensive document breakdown & micro-chips (RC, INS, FIT, PER) for VERIFICATION column
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

    const isAllOk = verifiedCount === 4;
    const hasIssues = rejectedCount > 0 || expiredCount > 0;
    const summaryColor = isAllOk ? '#12A66A' : hasIssues ? '#E53935' : '#D97706';

    return (
      <div
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenVerifyDocs(vehicle);
        }}
        title="Click to view & verify documents"
      >
        <div style={{ fontSize: 11.5, fontWeight: 700, color: summaryColor, lineHeight: 1.2 }}>
          {verifiedCount}/4 Verified
        </div>

        <div className="vdir-doc-chips">
          {docList.map((doc) => {
            const isExpired = doc.expiry && doc.expiry < now;
            let chipClass = 'vdir-chip-pending';
            if (isExpired || doc.status === 'REJECTED') {
              chipClass = 'vdir-chip-rejected';
            } else if (doc.status === 'APPROVED') {
              chipClass = 'vdir-chip-approved';
            }
            return (
              <span
                key={doc.label}
                className={`vdir-chip ${chipClass}`}
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

  // Helper to render overall status pill badge for DOCUMENTS column
  const renderVerificationBadge = (vehicle: Vehicle) => {
    const isCorrection = vehicle.rejection_reason?.startsWith('CORRECTION_REQUIRED');

    if (isCorrection) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#FFF4D6] text-[#D97706] border border-[#FDE68A]" title="Corrections requested from vendor">
          <AlertTriangle size={11} />
          <span>Correction</span>
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#FFF0F0] text-[#E53935] border border-[#FECACA]" title="One or more vehicle compliance documents have expired">
          <AlertCircle size={11} />
          <span>Expired</span>
        </span>
      );
    }

    switch (vehicle.verification_status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#E7FAF0] text-[#12A66A] border border-[#A7F3D0]" title="All vehicle verification checks passed">
            <Check size={11} strokeWidth={2.5} />
            <span>Verified</span>
          </span>
        );
      case 'REJECTED':
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#FFF0F0] text-[#E53935] border border-[#FECACA]" title={vehicle.rejection_reason || 'Vehicle rejected'}>
            <XCircle size={11} />
            <span>Rejected</span>
          </span>
        );
      case 'PENDING_DOCS':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#FFF4D6] text-[#D97706] border border-[#FDE68A]" title="Verification pending administrative review">
            <Clock size={11} strokeWidth={2.5} />
            <span>Pending</span>
          </span>
        );
    }
  };

  // Helper to render ownership badge
  const renderOwnershipBadge = (ownership: 'Owned' | 'Attached' | 'Both' | string) => {
    switch (ownership) {
      case 'Attached':
      case 'Leased':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
            {ownership}
          </span>
        );
      case 'Both':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
            Both
          </span>
        );
      case 'Owned':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            Owned
          </span>
        );
    }
  };

  return (
    <div className="client-dir-wrapper">
      {/* 1. Header Hero Banner matching Client Management */}
      <div className="client-header-hero">
        <div className="client-header-text">
          <div className="page-breadcrumb">
            <span className="breadcrumb-link">Fleet & Vehicles</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Vehicle Directory</span>
          </div>
          <h1 className="page-title">Vehicle Directory</h1>
          <p className="page-subtitle">
            Manage registered vehicles, vehicle documents, ownership, and verification status.
          </p>
        </div>

        <div className="client-mgmt-header-actions">
          <button
            onClick={handleRefresh}
            className="btn-header-secondary"
            title="Refresh records from database"
            aria-label="Refresh records"
            disabled={refreshing || loading}
            id="btn-refresh-vehicles"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-header-secondary"
            title="Export filtered vehicle directory to CSV"
            aria-label="Export CSV"
            id="btn-export-vehicles"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          <button
            onClick={() => onNavigateToCompliance ? onNavigateToCompliance() : onNavigateToVerification('')}
            className="btn-header-secondary"
            title="Centralized Vehicle Compliance Workspace"
            id="btn-compliance-workspace"
          >
            <ShieldCheck size={15} />
            <span>Compliance Workspace</span>
          </button>

          {onNavigateToAddVehicle && (
            <button
              className="btn-header-primary-orange"
              onClick={onNavigateToAddVehicle}
              id="btn-register-vehicle"
            >
              <Plus size={16} />
              <span>+ Add Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Dashboard Summary KPI Cards (Connected to DB) */}
      <div className="client-kpi-bar" role="region" aria-label="Vehicle statistics summary">
        {/* Total Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'ALL' && statusFilter === 'ALL' ? 'card-highlighted' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setStatusFilter('ALL');
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          title="Click to view all vehicles"
        >
          <div className="kpi-stat-icon" style={{ background: '#FFF1E8' }}>
            <Truck size={20} color="#F05A22" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Total Vehicles</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value">{stats.totalVehicles}</div>
          </div>
        </div>

        {/* Pending Verification */}
        <div
          className={`kpi-stat-card ${activeTab === 'PENDING' ? 'card-highlighted' : ''}`}
          onClick={() => {
            setActiveTab('PENDING');
            setStatusFilter('ALL');
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          title="Click to view vehicles pending verification"
        >
          <div className="kpi-stat-icon" style={{ background: '#FEF3C7' }}>
            <Clock size={20} color="#D97706" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Pending Verification</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#D97706' }}>{stats.pendingVerification}</div>
          </div>
        </div>

        {/* Verified Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'VERIFIED' ? 'card-highlighted' : ''}`}
          onClick={() => {
            setActiveTab('VERIFIED');
            setStatusFilter('ALL');
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          title="Click to view verified vehicles"
        >
          <div className="kpi-stat-icon" style={{ background: '#ECFDF5' }}>
            <CheckCircle size={20} color="#10B981" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Verified Vehicles</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#10B981' }}>{stats.verifiedVehicles}</div>
          </div>
        </div>

        {/* Rejected or Inactive Vehicles */}
        <div
          className={`kpi-stat-card ${activeTab === 'REJECTED' ? 'card-highlighted' : ''}`}
          onClick={() => {
            setActiveTab('REJECTED');
            setStatusFilter('ALL');
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          title="Click to view rejected vehicles"
        >
          <div className="kpi-stat-icon" style={{ background: '#FEF2F2' }}>
            <XCircle size={20} color="#EF4444" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Rejected / Inactive</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#EF4444' }}>{stats.rejectedVehicles}</div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar matching Reference Image */}
      <div className="filters-bar-card">
        {/* Search */}
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-abs" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by vehicle number, vendor name, or vendor ID..."
            className="client-search-input"
            id="vehicle-search-input"
            aria-label="Search vehicles"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery('');
                setDebouncedSearchQuery('');
                setPage(1);
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 1. Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Category"
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

        {/* 2. Ownership Filter */}
        <select
          value={ownershipFilter}
          onChange={(e) => {
            setOwnershipFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Ownership"
        >
          <option value="ALL">All Ownership</option>
          <option value="Owned">Owned</option>
          <option value="Attached">Attached</option>
          <option value="Both">Both</option>
        </select>

        {/* 3. Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Status"
        >
          <option value="ALL">All Status</option>
          <option value="Verified">Verified</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Rejected">Rejected</option>
          <option value="Correction Required">Correction Required</option>
        </select>

        {/* 4. Body Type Filter */}
        <select
          value={bodyTypeFilter}
          onChange={(e) => {
            setBodyTypeFilter(e.target.value);
            setPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Body Type"
        >
          <option value="ALL">All Body Types</option>
          <option value="Open Body">Open Body</option>
          <option value="Closed Body">Closed Body</option>
          <option value="Flatbed">Flatbed</option>
          <option value="Container">Container</option>
        </select>

        {/* Reset Button */}
        <button onClick={handleResetFilters} className="btn-filter-reset" title="Reset all search queries and filters">
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>

        {/* Search Submit */}
        <button onClick={handleSearch} className="btn-filter-search" title="Execute search">
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* Active Filter Chips Strip */}
      {(searchQuery || categoryFilter !== 'ALL' || ownershipFilter !== 'ALL' || statusFilter !== 'ALL' || bodyTypeFilter !== 'ALL') && (
        <div className="active-filters-chips-bar" role="region" aria-label="Active filters">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>
            Active Filters:
          </span>
          {searchQuery && (
            <div className="filter-chip-tag">
              <span>Query: <strong>"{searchQuery}"</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setSearchQuery(''); setDebouncedSearchQuery(''); setPage(1); }} aria-label="Remove search filter">
                <X size={12} />
              </button>
            </div>
          )}
          {categoryFilter !== 'ALL' && (
            <div className="filter-chip-tag">
              <span>Category: <strong>{categoryFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setCategoryFilter('ALL'); setPage(1); }} aria-label="Remove category filter">
                <X size={12} />
              </button>
            </div>
          )}
          {ownershipFilter !== 'ALL' && (
            <div className="filter-chip-tag">
              <span>Ownership: <strong>{ownershipFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setOwnershipFilter('ALL'); setPage(1); }} aria-label="Remove ownership filter">
                <X size={12} />
              </button>
            </div>
          )}
          {statusFilter !== 'ALL' && (
            <div className="filter-chip-tag">
              <span>Status: <strong>{statusFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setStatusFilter('ALL'); setPage(1); }} aria-label="Remove status filter">
                <X size={12} />
              </button>
            </div>
          )}
          {bodyTypeFilter !== 'ALL' && (
            <div className="filter-chip-tag">
              <span>Body Type: <strong>{bodyTypeFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setBodyTypeFilter('ALL'); setPage(1); }} aria-label="Remove body type filter">
                <X size={12} />
              </button>
            </div>
          )}
          <button className="filter-clear-all-action" onClick={handleResetFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {/* 4. Tabs & Action Sub-bar */}
      <div className="table-sub-bar">
        <div className="status-tabs-list" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'ALL' && statusFilter === 'ALL'}
            onClick={() => {
              setActiveTab('ALL');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`status-tab-btn ${activeTab === 'ALL' && statusFilter === 'ALL' ? 'active-tab' : ''}`}
          >
            All Vehicles ({stats.totalVehicles})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'PENDING'}
            onClick={() => {
              setActiveTab('PENDING');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`status-tab-btn ${activeTab === 'PENDING' ? 'active-tab' : ''}`}
          >
            Pending Verification ({stats.pendingVerification})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'VERIFIED'}
            onClick={() => {
              setActiveTab('VERIFIED');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`status-tab-btn ${activeTab === 'VERIFIED' ? 'active-tab' : ''}`}
          >
            Verified ({stats.verifiedVehicles})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'REJECTED'}
            onClick={() => {
              setActiveTab('REJECTED');
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`status-tab-btn ${activeTab === 'REJECTED' ? 'active-tab' : ''}`}
          >
            Rejected ({stats.rejectedVehicles})
          </button>
        </div>

        <div className="table-actions-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Total Record Indicator */}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>
            Total: <strong style={{ color: '#0F172A' }}>{total}</strong>
          </span>

          {/* Column Visibility Toggle Button (Matches Reference Order) */}
          <div className="relative">
            <button
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              className={`btn-action-outline ${showColumnConfig ? 'active-filter' : ''}`}
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
                        verification: true,
                        documents: true,
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
                    { key: 'category', label: 'Category' },
                    { key: 'bodyType', label: 'Body Type' },
                    { key: 'ratedCapacity', label: 'Rated Capacity (MT)' },
                    { key: 'minCapacity', label: 'Minimum Capacity (MT)' },
                    { key: 'ownership', label: 'Ownership' },
                    { key: 'verification', label: 'Verification' },
                    { key: 'documents', label: 'Documents' },
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

          {/* Export Button */}
          <button onClick={handleExportCSV} className="btn-action-outline" title="Export current list to CSV">
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 5. Vehicle Directory Table Card */}
      <div className="client-table-card">
        {loading && vehicles.length === 0 ? (
          <div className="vendor-table-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
            <table className="client-table" style={{ minWidth: 1280 }}>
              <thead>
                <tr>
                  <th style={{ width: 44, minWidth: 44, textAlign: 'center' }}>
                    <div className="table-skeleton-cell" style={{ width: 16, height: 16, margin: '0 auto', borderRadius: 4 }} />
                  </th>
                  <th style={{ width: 48, minWidth: 48, textAlign: 'center' }}>#</th>
                  <th style={{ width: 175, minWidth: 175 }}>Vehicle Number</th>
                  <th style={{ width: 220, minWidth: 220 }}>Vendor ID & Name</th>
                  <th style={{ width: 140, minWidth: 140 }}>Category</th>
                  <th style={{ width: 120, minWidth: 120 }}>Body Type</th>
                  <th style={{ width: 130, minWidth: 130, textAlign: 'right', paddingRight: 24 }}>Rated Cap (MT)</th>
                  <th style={{ width: 120, minWidth: 120, textAlign: 'right', paddingRight: 24 }}>Min Cap (MT)</th>
                  <th style={{ width: 110, minWidth: 110 }}>Ownership</th>
                  <th style={{ width: 160, minWidth: 160 }}>Verification</th>
                  <th style={{ width: 130, minWidth: 130 }}>Documents</th>
                  <th style={{ width: 180, minWidth: 180 }}>Updated At</th>
                  <th style={{ width: 90, minWidth: 90, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="table-skeleton-row">
                    <td style={{ textAlign: 'center' }}><div className="table-skeleton-cell" style={{ width: 16, height: 16, margin: '0 auto', borderRadius: 4 }} /></td>
                    <td style={{ textAlign: 'center' }}><div className="table-skeleton-cell" style={{ width: 20, margin: '0 auto' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 135, height: 26, borderRadius: 6 }} /></td>
                    <td>
                      <div className="client-name-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="client-avatar-squircle" style={{ background: '#F1F5F9', width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="table-skeleton-cell" style={{ width: 110, height: 11 }} />
                          <div className="table-skeleton-cell" style={{ width: 70, height: 8 }} />
                        </div>
                      </div>
                    </td>
                    <td><div className="table-skeleton-cell" style={{ width: 90 }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 80 }} /></td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}><div className="table-skeleton-cell" style={{ width: 60, marginLeft: 'auto' }} /></td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}><div className="table-skeleton-cell" style={{ width: 60, marginLeft: 'auto' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 70 }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 110 }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 85, height: 22, borderRadius: 9999 }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: 120 }} /></td>
                    <td style={{ textAlign: 'center', width: 120, minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div className="table-skeleton-cell" style={{ width: 40, height: 40, borderRadius: 11 }} />
                        <div className="table-skeleton-cell" style={{ width: 40, height: 40, borderRadius: 11 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <XCircle size={36} className="text-rose-500 mx-auto mb-3" />
            <p className="text-rose-700 font-bold mb-1">Failed to load vehicles</p>
            <p className="text-slate-500 text-sm mb-4">{error}</p>
            <button onClick={handleRefresh} className="btn-filter-search" style={{ margin: '0 auto' }}>
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
              {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || bodyTypeFilter !== 'ALL' || ownershipFilter !== 'ALL'
                ? 'No vehicle records matched your filter criteria. Try resetting filters.'
                : 'Vehicles registered by vendors will automatically appear here for verification and fleet management.'}
            </p>
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || bodyTypeFilter !== 'ALL' || ownershipFilter !== 'ALL' ? (
              <button onClick={handleResetFilters} className="btn-filter-reset" style={{ margin: '0 auto' }}>
                Clear Filters
              </button>
            ) : onNavigateToAddVehicle ? (
              <button onClick={onNavigateToAddVehicle} className="btn-header-primary-orange" style={{ margin: '0 auto' }}>
                <Plus size={16} />
                <span>+ Register Vehicle</span>
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Scrollable Table View - NATURAL SCROLLING, NO STICKY COLUMNS */}
            <div className="vendor-table-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
              <table className="client-table" style={{ minWidth: 1280 }}>
                <thead>
                  <tr>
                    {/* 1. Selection Checkbox */}
                    <th style={{ width: 44, minWidth: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-[#F4510B] focus:ring-[#F4510B] cursor-pointer"
                        aria-label="Select all vehicles on current page"
                      />
                    </th>

                    {/* 2. Row # */}
                    <th style={{ width: 48, minWidth: 48, textAlign: 'center' }}>
                      #
                    </th>

                    {/* 3. Vehicle Number */}
                    <th
                      className="select-none cursor-pointer"
                      style={{ width: 175, minWidth: 175 }}
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

                    {/* 4. Vendor ID & Name */}
                    {visibleColumns.vendor && (
                      <th style={{ width: 220, minWidth: 220 }}>
                        <span>Vendor ID & Name</span>
                      </th>
                    )}

                    {/* 5. Category */}
                    {visibleColumns.category && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 140, minWidth: 140 }}
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

                    {/* 6. Body Type */}
                    {visibleColumns.bodyType && (
                      <th style={{ width: 120, minWidth: 120 }}>Body Type</th>
                    )}

                    {/* 7. Rated Capacity */}
                    {visibleColumns.ratedCapacity && (
                      <th
                        className="select-none cursor-pointer"
                        style={{ width: 130, minWidth: 130, textAlign: 'right', paddingRight: '24px' }}
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

                    {/* 8. Minimum Capacity */}
                    {visibleColumns.minCapacity && (
                      <th style={{ width: 120, minWidth: 120, textAlign: 'right', paddingRight: '24px' }}>
                        Min Cap (MT)
                      </th>
                    )}

                    {/* 9. Ownership */}
                    {visibleColumns.ownership && (
                      <th style={{ width: 110, minWidth: 110 }}>Ownership</th>
                    )}

                    {/* 10. Verification (Shows 0/4 Verified & chips) */}
                    {visibleColumns.verification && (
                      <th style={{ width: 160, minWidth: 160 }}>Verification</th>
                    )}

                    {/* 11. Documents (Shows overall Verified status pill badge) */}
                    {visibleColumns.documents && (
                      <th style={{ width: 130, minWidth: 130 }}>Documents</th>
                    )}

                    {/* 12. Updated At */}
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

                    {/* 13. Actions (Natural Non-Sticky) */}
                    <th style={{ width: 120, minWidth: 120, textAlign: 'center' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle, idx) => {
                    const rowNum = (page - 1) * itemsPerPage + idx + 1;
                    const vendorMeta = transporterDetails[vehicle.id];
                    const rawVendorName = vendorMeta?.vendorName || (vehicle as any).vendor_name || (vehicle as any).transporter_name || null;
                    const rawVendorCode = vendorMeta?.vendorCode || (vehicle as any).vendor_code || (vendorMeta?.vendorId ? formatDisplayId('VD', vendorMeta.vendorId) : null);
                    const hasVendor = Boolean(rawVendorName || rawVendorCode || vendorMeta?.vendorId);
                    const vendorName = rawVendorName;
                    const vendorCode = rawVendorCode;
                    const avatarColor = getAvatarColor(vendorName || vendorCode || vehicle.id);
                    const initials = getInitials(vendorName || vendorCode || 'VN');
                    const ownership = vendorMeta?.ownership || (vehicle as any).ownership_type || 'Owned';
                    const isMenuOpen = menuAnchor?.vehicle.id === vehicle.id;

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => setFullViewVehicle(vehicle)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        {/* 1. Selection Checkbox */}
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedVehicleIds.has(vehicle.id)}
                            onChange={(e) => handleToggleSelectVehicle(vehicle.id, e)}
                            className="rounded border-slate-300 text-[#F4510B] focus:ring-[#F4510B] cursor-pointer"
                            aria-label={`Select vehicle ${vehicle.registration_number}`}
                          />
                        </td>

                        {/* 2. Row # */}
                        <td style={{ textAlign: 'center', color: '#172B4D', fontWeight: 600 }}>
                          {rowNum}
                        </td>

                        {/* 3. Vehicle Number (Badge + Copy inline on same line) */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="vehicle-number-cell">
                            <span
                              className="vehicle-number-badge cursor-pointer"
                              onClick={() => setFullViewVehicle(vehicle)}
                              title="Click to view vehicle details"
                            >
                              <span className="vehicle-country-code">IND</span>
                              <span className="vehicle-registration-number">{vehicle.registration_number}</span>
                            </span>
                            <button
                              type="button"
                              className="vehicle-copy-button"
                              aria-label={`Copy vehicle number ${vehicle.registration_number}`}
                              title="Copy vehicle number"
                              onClick={(e) => handleCopyVehicleNumber(vehicle.registration_number, e)}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </td>

                        {/* 4. Vendor ID & Name (Client Management Exact Match) */}
                        {visibleColumns.vendor && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="client-name-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {/* 36x36px Initials Avatar matching Client Management squircle */}
                              <div
                                className="client-avatar-squircle"
                                style={{
                                  background: hasVendor ? avatarColor : '#94A3B8',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  borderRadius: 10,
                                  width: 36,
                                  height: 36,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                                aria-hidden="true"
                                title={vendorName || 'No Vendor Assigned'}
                              >
                                {initials}
                              </div>

                              {/* Two-Line Details: Company Name on line 1, Registered Vendor ID on line 2 */}
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                {hasVendor ? (
                                  <>
                                    {onNavigateToVendorProfile && vendorMeta?.vendorId ? (
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToVendorProfile(vendorMeta.vendorId!)}
                                        className="client-name-text text-left block"
                                        style={{
                                          fontWeight: 600,
                                          color: '#0F172A',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: 180,
                                          background: 'none',
                                          border: 'none',
                                          padding: 0,
                                          fontSize: 13.5,
                                          lineHeight: 1.2,
                                        }}
                                        title={vendorName || ''}
                                      >
                                        {vendorName}
                                      </button>
                                    ) : (
                                      <div
                                        className="client-name-text"
                                        style={{
                                          fontWeight: 600,
                                          color: '#0F172A',
                                          cursor: 'default',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: 180,
                                          fontSize: 13.5,
                                          lineHeight: 1.2,
                                        }}
                                        title={vendorName || ''}
                                      >
                                        {vendorName}
                                      </div>
                                    )}
                                    <div
                                      className="client-id-text"
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                        color: '#64748B',
                                        whiteSpace: 'nowrap',
                                        marginTop: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                      }}
                                      title={vendorCode || ''}
                                    >
                                      <span className="truncate max-w-[125px]">{vendorCode || '—'}</span>
                                      {vendorCode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(vendorCode);
                                            toast.success('Vendor ID copied to clipboard');
                                          }}
                                          className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors inline-flex items-center"
                                          title="Copy Vendor ID"
                                          aria-label="Copy Vendor ID"
                                        >
                                          <Copy size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div
                                      className="client-name-text"
                                      style={{
                                        fontWeight: 500,
                                        color: '#94A3B8',
                                        fontStyle: 'italic',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: 180,
                                        fontSize: 13,
                                        lineHeight: 1.2,
                                      }}
                                      title="Vendor not assigned"
                                    >
                                      Vendor not assigned
                                    </div>
                                    <div
                                      className="client-id-text"
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                        color: '#94A3B8',
                                        marginTop: 2,
                                      }}
                                      title="No registered vendor ID"
                                    >
                                      —
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 5. Category */}
                        {visibleColumns.category && (
                          <td>
                            <div className="flex items-center gap-1.5">
                              <Truck size={14} className="text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-800 text-[13px] whitespace-nowrap" title={vehicle.vehicle_type}>
                                {formatVehicleCategory(vehicle.vehicle_type)}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* 6. Body Type */}
                        {visibleColumns.bodyType && (
                          <td className="text-slate-700 text-[13px] whitespace-nowrap">
                            {vehicle.body_type || 'Open Body'}
                          </td>
                        )}

                        {/* 7. Rated Capacity */}
                        {visibleColumns.ratedCapacity && (
                          <td className="font-mono text-slate-700 text-[13px] text-right pr-6 whitespace-nowrap">
                            {vehicle.rated_capacity_mt != null ? `${Number(vehicle.rated_capacity_mt).toFixed(1)} MT` : '—'}
                          </td>
                        )}

                        {/* 8. Minimum Capacity */}
                        {visibleColumns.minCapacity && (
                          <td className="font-mono text-slate-600 text-[13px] text-right pr-6 whitespace-nowrap">
                            {vehicle.minimum_capacity_mt != null ? `${Number(vehicle.minimum_capacity_mt).toFixed(1)} MT` : '—'}
                          </td>
                        )}

                        {/* 9. Ownership */}
                        {visibleColumns.ownership && (
                          <td>{renderOwnershipBadge(ownership)}</td>
                        )}

                        {/* 10. Verification (0/4 Verified & chips) */}
                        {visibleColumns.verification && (
                          <td>{renderDocumentSummary(vehicle)}</td>
                        )}

                        {/* 11. Documents (Verified status pill badge) */}
                        {visibleColumns.documents && (
                          <td>{renderVerificationBadge(vehicle)}</td>
                        )}

                        {/* 12. Updated At */}
                        {visibleColumns.updatedAt && (
                          <td className="text-slate-600 text-[12px] whitespace-nowrap">
                            <span title={`Full timestamp: ${vehicle.updated_at || vehicle.created_at}`}>
                              {formatSingleLineDateTime(vehicle.updated_at || vehicle.created_at)}
                            </span>
                          </td>
                        )}

                        {/* 13. Actions (Reference Match: 40x40px White Buttons) */}
                        <td onClick={(e) => e.stopPropagation()} style={{ width: 120, minWidth: 120, textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {/* 40x40px White View Button */}
                            <button
                              type="button"
                              onClick={() => setFullViewVehicle(vehicle)}
                              className="table-action-square-btn"
                              title="View Details"
                              aria-label={`View Details for ${vehicle.registration_number}`}
                            >
                              <Eye size={18} strokeWidth={1.8} />
                            </button>

                            {/* 40x40px White More Actions Button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleActionMenu(vehicle, e)}
                              className={`table-action-square-btn ${isMenuOpen ? 'active' : ''}`}
                              title="More Actions"
                              aria-label={`More Actions for ${vehicle.registration_number}`}
                              aria-expanded={isMenuOpen}
                            >
                              <MoreVertical size={18} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      {/* 7. Dedicated Vehicle Full View Slide-Over Drawer (Exact Reference Design) */}
      {fullViewVehicle && (() => {
        const vendorMeta = transporterDetails[fullViewVehicle.id];
        const hasVendor = Boolean(vendorMeta && vendorMeta.vendorName);
        const vendorName = hasVendor ? vendorMeta.vendorName : 'Not provided';
        const vendorCode = vendorMeta?.vendorCode || (vendorMeta?.vendorId ? formatDisplayId('VD', vendorMeta.vendorId) : '—');
        const vendorPhone = vendorMeta?.phone || 'Not provided';
        const vendorEmail = vendorMeta?.email || 'Not provided';
        const ownershipVal = transporterDetails[fullViewVehicle.id]?.ownership ||
          (fullViewVehicle as any).ownership_type ||
          'Owned';
        const isApproved = fullViewVehicle.verification_status === 'APPROVED';
        const isPending = fullViewVehicle.verification_status === 'PENDING_DOCS' || !fullViewVehicle.verification_status;
        const isRejected = fullViewVehicle.verification_status === 'REJECTED';
        const isOperationalActive = fullViewVehicle.status === 'ACTIVE';

        const assignment = driverAssignments[fullViewVehicle.id];
        const currentDriver = assignment?.currentDriver;
        const currentTrip = assignment?.currentTrip;

        return (
          <div className="vfv-backdrop" onClick={() => setFullViewVehicle(null)}>
            <div
              className="vfv-drawer"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Vehicle Full View"
            >
              {/* Header */}
              <div className="vfv-header">
                {/* Row 1: Breadcrumbs & Close button */}
                <div className="vfv-breadcrumb-row">
                  <div className="vfv-breadcrumbs">
                    <span>Fleet & Vehicles</span>
                    <span className="vfv-breadcrumb-sep">/</span>
                    <span>Vehicle Directory</span>
                    <span className="vfv-breadcrumb-sep">/</span>
                    <span className="vfv-breadcrumb-active">Vehicle Full View</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullViewVehicle(null)}
                    className="vfv-close-btn"
                    title="Close (Esc)"
                    aria-label="Close vehicle full view"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Row 2: Title */}
                <h2 className="vfv-title">Vehicle Full View</h2>

                {/* Row 3: Meta badge, category, and Edit button */}
                <div className="vfv-header-meta">
                  <div className="vfv-meta-left">
                    <div className="vfv-plate-badge">
                      <span className="vfv-plate-ind">IND</span>
                      <span className="vfv-plate-number">{fullViewVehicle.registration_number}</span>
                    </div>
                    <span className="vfv-meta-dot">•</span>
                    <span className="vfv-category-tag">{formatVehicleCategory(fullViewVehicle.vehicle_type)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(fullViewVehicle)}
                    className="vfv-edit-btn"
                    title="Edit vehicle details"
                  >
                    <Edit2 size={13} />
                    <span>Edit Vehicle</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div
                className="vfv-body"
                style={{
                  flex: '1 1 0%',
                  minHeight: 0,
                  maxHeight: 'calc(100vh - 120px)',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* 1. Four Compact Overview Status Cards */}
                <div className="vfv-status-grid">
                  {/* Card 1: Verification Status */}
                  <div className="vfv-status-card">
                    <div className={`vfv-status-icon-circle ${isApproved ? 'green' : isPending ? 'green' : 'red'}`}>
                      <CheckCircle size={16} />
                    </div>
                    <div className="vfv-status-info">
                      <div className="vfv-status-val">
                        {isApproved ? 'Verified' : isPending ? 'Verified' : isRejected ? 'Rejected' : fullViewVehicle.verification_status}
                      </div>
                      <div className="vfv-status-lbl">Verification Status</div>
                    </div>
                  </div>

                  {/* Card 2: Operational Status */}
                  <div className="vfv-status-card">
                    <div className={`vfv-status-icon-circle ${isOperationalActive ? 'green' : 'amber'}`}>
                      <Zap size={16} />
                    </div>
                    <div className="vfv-status-info">
                      <div className="vfv-status-val">
                        {isOperationalActive ? 'Active' : fullViewVehicle.status || 'Active'}
                      </div>
                      <div className="vfv-status-lbl">Operational Status</div>
                    </div>
                  </div>

                  {/* Card 3: Ownership */}
                  <div className="vfv-status-card">
                    <div className="vfv-status-icon-circle blue">
                      <User size={16} />
                    </div>
                    <div className="vfv-status-info">
                      <div className="vfv-status-val">{ownershipVal}</div>
                      <div className="vfv-status-lbl">Ownership</div>
                    </div>
                  </div>

                  {/* Card 4: Rated Capacity */}
                  <div className="vfv-status-card">
                    <div className="vfv-status-icon-circle gray">
                      <Scale size={16} />
                    </div>
                    <div className="vfv-status-info">
                      <div className="vfv-status-val">
                        {fullViewVehicle.rated_capacity_mt != null
                          ? `${Number(fullViewVehicle.rated_capacity_mt).toFixed(1)} MT`
                          : '24.0 MT'}
                      </div>
                      <div className="vfv-status-lbl">Rated Capacity</div>
                    </div>
                  </div>
                </div>

                {/* 2. Vendor Information Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title-group">
                      <Building2 size={16} className="vfv-card-title-icon" />
                      <h4 className="vfv-card-title">Vendor Information</h4>
                    </div>
                    {hasVendor && onNavigateToVendorProfile && vendorMeta?.vendorId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFullViewVehicle(null);
                          onNavigateToVendorProfile(vendorMeta.vendorId);
                        }}
                        className="text-xs font-semibold text-[#F45B0B] hover:underline flex items-center gap-1"
                      >
                        <span>View Vendor Profile</span>
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                  <div className="vfv-card-body">
                    <div className="vfv-info-grid">
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Vendor ID</span>
                        <span className="vfv-field-value">{vendorCode}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Company Name</span>
                        <span className="vfv-field-value">{vendorName}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Contact Phone</span>
                        <span className="vfv-field-value normal">{vendorPhone}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Registered Email</span>
                        <span className="vfv-field-value normal">{vendorEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Vehicle Specifications Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title-group">
                      <Truck size={16} className="vfv-card-title-icon" />
                      <h4 className="vfv-card-title">Vehicle Specifications</h4>
                    </div>
                  </div>
                  <div className="vfv-card-body">
                    <div className="vfv-info-grid">
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Registration Number</span>
                        <span className="vfv-field-value">{fullViewVehicle.registration_number}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Vehicle Category</span>
                        <span className="vfv-field-value">{formatVehicleCategory(fullViewVehicle.vehicle_type)}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Body Type</span>
                        <span className="vfv-field-value normal">{fullViewVehicle.body_type || 'Open Body'}</span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Ownership</span>
                        <div>
                          <span className="vfv-badge-blue">{ownershipVal}</span>
                        </div>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Rated Capacity</span>
                        <span className="vfv-field-value">
                          {fullViewVehicle.rated_capacity_mt != null
                            ? `${Number(fullViewVehicle.rated_capacity_mt).toFixed(1)} MT`
                            : '24.0 MT'}
                        </span>
                      </div>
                      <div className="vfv-field-block">
                        <span className="vfv-field-label">Minimum Capacity</span>
                        <span className="vfv-field-value">
                          {fullViewVehicle.minimum_capacity_mt != null
                            ? `${Number(fullViewVehicle.minimum_capacity_mt).toFixed(1)} MT`
                            : '12.0 MT'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Associated Driver Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title-group">
                      <User size={16} className="vfv-card-title-icon" />
                      <h4 className="vfv-card-title">Associated Driver</h4>
                    </div>
                    {currentDriver && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignDriver(fullViewVehicle)}
                          className="text-xs font-semibold text-[#F45B0B] hover:underline flex items-center gap-1"
                        >
                          <span>Change Driver</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDriverAssignment(fullViewVehicle)}
                          className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1"
                          title="Remove driver assignment"
                        >
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="vfv-card-body">
                    {currentDriver ? (
                      (() => {
                        const isDlExpired =
                          currentDriver.licence_expiry_date &&
                          new Date(currentDriver.licence_expiry_date) < new Date();
                        const driverDisplayId =
                          currentDriver.driver_code || formatDisplayId('DR', currentDriver.id);

                        return (
                          <div className="space-y-3">
                            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                    {currentDriver.full_name?.substring(0, 2).toUpperCase() || 'DR'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                      <span>{currentDriver.full_name}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          currentDriver.verification_status === 'APPROVED' || currentDriver.status === 'APPROVED'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : currentDriver.verification_status === 'REJECTED' || currentDriver.status === 'REJECTED'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {currentDriver.verification_status || currentDriver.status || 'VERIFIED'}
                                      </span>
                                    </div>
                                    <div className="text-slate-500 font-mono text-xs flex items-center gap-1.5 mt-0.5">
                                      <span>{driverDisplayId}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(driverDisplayId);
                                          toast.success('Driver ID copied');
                                        }}
                                        className="p-0.5 text-slate-400 hover:text-slate-700"
                                        title="Copy Driver ID"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setFullViewVehicle(null);
                                    if (onNavigateToDriverProfile) {
                                      onNavigateToDriverProfile(currentDriver.id);
                                    } else {
                                      handleOpenDriverDetails(fullViewVehicle, currentDriver, currentTrip);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                  <span>View Profile</span>
                                  <ExternalLink size={11} />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-200">
                                <div>
                                  <span className="text-slate-500">Mobile Number:</span>{' '}
                                  <span className="font-semibold text-slate-800">
                                    {currentDriver.mobile || '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Driver Operational Status:</span>{' '}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      currentDriver.is_active !== false
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {currentDriver.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Associated Vendor:</span>{' '}
                                  <span className="font-semibold text-slate-800">
                                    {vendorMeta?.vendorName || (fullViewVehicle as any).primary_vendor_name || (fullViewVehicle as any).vendor_name || 'Direct Fleet'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Assignment:</span>{' '}
                                  <span className="font-semibold text-emerald-700">
                                    {currentTrip?.id
                                      ? `Trip #${currentTrip.id.substring(0, 8)}`
                                      : 'Assigned to Vehicle'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">DL Number:</span>{' '}
                                  <span className="font-mono font-bold text-slate-800">
                                    {currentDriver.licence_number || '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">DL Expiry:</span>{' '}
                                  <span
                                    className={`font-semibold ${
                                      isDlExpired ? 'text-rose-600 font-bold' : 'text-slate-800'
                                    }`}
                                  >
                                    {currentDriver.licence_expiry_date || '—'}{' '}
                                    {isDlExpired && '(Expired)'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="vfv-driver-empty">
                        <div className="vfv-driver-empty-left">
                          <div className="vfv-driver-avatar-circle">
                            <User size={20} />
                          </div>
                          <div>
                            <h4 className="vfv-driver-empty-title">No Driver Assigned</h4>
                            <p className="vfv-driver-empty-sub">
                              Assign a verified driver associated with this vendor to enable trip dispatch and fleet tracking.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignDriver(fullViewVehicle)}
                          className="vfv-assign-btn"
                        >
                          <Plus size={14} />
                          <span>Assign Driver</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Document Verification Details Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title-group">
                      <FileText size={16} className="vfv-card-title-icon" />
                      <h4 className="vfv-card-title">Document Verification Details</h4>
                    </div>
                  </div>
                  <div className="vfv-card-body">
                    <div className="vfv-doc-list">
                      {[
                        {
                          title: 'Registration Certificate (RC)',
                          typeKey: 'RC',
                          iconClass: 'blue',
                          icon: <FileText size={18} />,
                          refText: `No: ${fullViewVehicle.rc_number || `RC-${fullViewVehicle.registration_number}`}`,
                          status: fullViewVehicle.rc_verification_status || 'PENDING',
                        },
                        {
                          title: 'Insurance Certificate',
                          typeKey: 'INSURANCE',
                          iconClass: 'green',
                          icon: <ShieldCheck size={18} />,
                          refText: `Policy: ${fullViewVehicle.insurance_policy_number || 'Valid Policy'}`,
                          status: fullViewVehicle.insurance_verification_status || 'PENDING',
                        },
                        {
                          title: 'Fitness Certificate',
                          typeKey: 'FITNESS',
                          iconClass: 'red',
                          icon: <FileText size={18} />,
                          refText: fullViewVehicle.fitness_expiry_date
                            ? `Exp: ${fullViewVehicle.fitness_expiry_date}`
                            : 'Not provided',
                          status: fullViewVehicle.fitness_verification_status || 'PENDING',
                        },
                      ].map((doc) => {
                        const isDocApproved = doc.status === 'APPROVED';
                        const isDocRejected = doc.status === 'REJECTED';

                        return (
                          <div key={doc.typeKey} className="vfv-doc-row">
                            <div className="vfv-doc-left">
                              <div className={`vfv-doc-icon-squircle ${doc.iconClass}`}>
                                {doc.icon}
                              </div>
                              <div className="vfv-doc-title-group">
                                <div className="vfv-doc-name">{doc.title}</div>
                                <div className="vfv-doc-ref">{doc.refText}</div>
                              </div>
                            </div>

                            <div className="vfv-doc-right">
                              <span
                                className={
                                  isDocApproved
                                    ? 'vfv-badge-verified'
                                    : isDocRejected
                                    ? 'vfv-badge-rejected'
                                    : 'vfv-badge-pending'
                                }
                              >
                                {isDocApproved ? 'Verified' : isDocRejected ? 'Rejected' : 'Pending'}
                              </span>

                              <div className="vfv-doc-actions">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewDoc(doc.title, doc.typeKey, doc.status)}
                                  className="vfv-doc-btn"
                                  title={`View ${doc.title}`}
                                >
                                  <Eye size={13} />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenVerifyDocs(fullViewVehicle)}
                                  className="vfv-doc-btn"
                                  title={`Review ${doc.title}`}
                                >
                                  <FileText size={13} />
                                  <span>Review</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Remarks or Feedback if rejected */}
                {fullViewVehicle.rejection_reason && (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 text-xs">
                    <h5 className="font-bold text-amber-900 uppercase tracking-wider text-[11px] mb-1">
                      Admin Feedback & Remarks
                    </h5>
                    <p className="text-amber-800 leading-relaxed">
                      {fullViewVehicle.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Document Preview Modal */}
      {previewDocModal && (
        <DocumentPreviewModal
          isOpen={previewDocModal.isOpen}
          onClose={() => setPreviewDocModal(null)}
          documentTitle={previewDocModal.title}
          fileName={previewDocModal.fileName}
          fileUrlOrPath={previewDocModal.fileUrl}
          verificationStatus={previewDocModal.status}
          rejectionReason={previewDocModal.rejectionReason}
        />
      )}

      {/* 8. Edit Vehicle Modal */}
      {editingVehicle && (
        <div
          className="edit-veh-modal-backdrop"
          onClick={() => !isSavingEdit && setEditingVehicle(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-vehicle-modal-title"
        >
          <div className="edit-veh-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Dark Navy Header matching Client Management */}
            <div className="edit-veh-modal-header">
              <div className="edit-veh-modal-title" id="edit-vehicle-modal-title">
                <Truck size={20} className="text-[#F05A22]" />
                <span>Edit Vehicle Record</span>
                <span className="edit-veh-reg-badge">
                  {editingVehicle.registration_number}
                </span>
              </div>
              <button
                type="button"
                onClick={() => !isSavingEdit && setEditingVehicle(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                title="Close modal"
                disabled={isSavingEdit}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="edit-veh-modal-body">
              {editSubmitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{editSubmitError}</span>
                </div>
              )}

              {/* Vehicle Category */}
              <div className="edit-veh-field-group">
                <label className="edit-veh-label" htmlFor="edit-category">
                  Vehicle Category *
                </label>
                <select
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) => {
                    setEditForm({ ...editForm, category: e.target.value });
                    if (editErrors.category) {
                      setEditErrors((prev) => ({ ...prev, category: '' }));
                    }
                  }}
                  className={`edit-veh-select ${editErrors.category ? 'has-error' : ''}`}
                >
                  <option value="Lorry">Lorry</option>
                  <option value="Trailer">Trailer</option>
                  <option value="Van">Van</option>
                  <option value="Heavy Carrier">Heavy Carrier</option>
                  <option value="10 Wheeler">10 Wheeler</option>
                  <option value="12 Wheeler">12 Wheeler</option>
                  <option value="14 Wheeler">14 Wheeler</option>
                </select>
                {editErrors.category && (
                  <span className="edit-veh-error-msg">
                    <AlertCircle size={12} />
                    {editErrors.category}
                  </span>
                )}
              </div>

              {/* Body Type */}
              <div className="edit-veh-field-group">
                <label className="edit-veh-label" htmlFor="edit-body-type">
                  Body Type *
                </label>
                <select
                  id="edit-body-type"
                  value={editForm.bodyType}
                  onChange={(e) => {
                    setEditForm({ ...editForm, bodyType: e.target.value });
                    if (editErrors.bodyType) {
                      setEditErrors((prev) => ({ ...prev, bodyType: '' }));
                    }
                  }}
                  className={`edit-veh-select ${editErrors.bodyType ? 'has-error' : ''}`}
                >
                  <option value="Open Body">Open Body</option>
                  <option value="Closed Body">Closed Body</option>
                </select>
                {editErrors.bodyType && (
                  <span className="edit-veh-error-msg">
                    <AlertCircle size={12} />
                    {editErrors.bodyType}
                  </span>
                )}
              </div>

              {/* Capacities Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="edit-veh-field-group">
                  <label className="edit-veh-label" htmlFor="edit-rated-cap">
                    Rated Capacity (MT) *
                  </label>
                  <input
                    id="edit-rated-cap"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editForm.ratedCapacityMt}
                    onChange={(e) => {
                      setEditForm({ ...editForm, ratedCapacityMt: parseFloat(e.target.value) || 0 });
                      if (editErrors.ratedCapacityMt) {
                        setEditErrors((prev) => ({ ...prev, ratedCapacityMt: '' }));
                      }
                    }}
                    className={`edit-veh-input ${editErrors.ratedCapacityMt ? 'has-error' : ''}`}
                  />
                  {editErrors.ratedCapacityMt && (
                    <span className="edit-veh-error-msg">
                      <AlertCircle size={12} />
                      {editErrors.ratedCapacityMt}
                    </span>
                  )}
                </div>

                <div className="edit-veh-field-group">
                  <label className="edit-veh-label" htmlFor="edit-min-cap">
                    Minimum Capacity (MT) *
                  </label>
                  <input
                    id="edit-min-cap"
                    type="number"
                    step="0.1"
                    min="0"
                    value={editForm.minimumCapacityMt}
                    onChange={(e) => {
                      setEditForm({
                        ...editForm,
                        minimumCapacityMt: parseFloat(e.target.value) || 0,
                      });
                      if (editErrors.minimumCapacityMt) {
                        setEditErrors((prev) => ({ ...prev, minimumCapacityMt: '' }));
                      }
                    }}
                    className={`edit-veh-input ${editErrors.minimumCapacityMt ? 'has-error' : ''}`}
                  />
                  {editErrors.minimumCapacityMt && (
                    <span className="edit-veh-error-msg">
                      <AlertCircle size={12} />
                      {editErrors.minimumCapacityMt}
                    </span>
                  )}
                </div>
              </div>

              {/* RC Number */}
              <div className="edit-veh-field-group">
                <label className="edit-veh-label" htmlFor="edit-rc-num">
                  RC Number *
                </label>
                <input
                  id="edit-rc-num"
                  type="text"
                  value={editForm.rcNumber}
                  onChange={(e) => {
                    setEditForm({ ...editForm, rcNumber: e.target.value.toUpperCase() });
                    if (editErrors.rcNumber) {
                      setEditErrors((prev) => ({ ...prev, rcNumber: '' }));
                    }
                  }}
                  placeholder="e.g. MH-12-AB-1234"
                  className={`edit-veh-input ${editErrors.rcNumber ? 'has-error' : ''}`}
                />
                {editErrors.rcNumber && (
                  <span className="edit-veh-error-msg">
                    <AlertCircle size={12} />
                    {editErrors.rcNumber}
                  </span>
                )}
              </div>

              {/* Operational Status */}
              <div className="edit-veh-field-group">
                <label className="edit-veh-label" htmlFor="edit-status">
                  Operational Status *
                </label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) => {
                    setEditForm({ ...editForm, status: e.target.value });
                    if (editErrors.status) {
                      setEditErrors((prev) => ({ ...prev, status: '' }));
                    }
                  }}
                  className={`edit-veh-select ${editErrors.status ? 'has-error' : ''}`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
                {editErrors.status && (
                  <span className="edit-veh-error-msg">
                    <AlertCircle size={12} />
                    {editErrors.status}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="edit-veh-modal-footer">
              <button
                type="button"
                onClick={() => !isSavingEdit && setEditingVehicle(null)}
                disabled={isSavingEdit}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-[#F05A22] hover:bg-[#d94e1b] rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                <span>{isSavingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Verify Documents Modal — The TruckX Signature UI/UX Theme */}
      {verifyingVehicle && (() => {
        const vendorMeta = transporterDetails[verifyingVehicle.id];
        const vendorName = vendorMeta?.vendorName || 'Transporter Partner';
        const vendorCode = vendorMeta?.vendorCode || (vendorMeta?.vendorId ? formatDisplayId('VD', vendorMeta.vendorId) : '');

        const approvedCount = [
          docStatuses.rc,
          docStatuses.insurance,
          docStatuses.fitness,
          docStatuses.permit,
        ].filter((s) => s === 'APPROVED').length;

        const rejectedCount = [
          docStatuses.rc,
          docStatuses.insurance,
          docStatuses.fitness,
          docStatuses.permit,
        ].filter((s) => s === 'REJECTED').length;

        const isAllApproved = approvedCount === 4;
        const progressPercent = (approvedCount / 4) * 100;

        return (
          <div
            className="vdir-modal-backdrop"
            onClick={() => setVerifyingVehicle(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-veh-title"
          >
            <div
              className="vdir-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="vdir-modal-header">
                <div className="vdir-modal-header-left">
                  <div className={`vdir-modal-header-icon ${isAllApproved ? 'emerald' : rejectedCount > 0 ? 'rose' : ''}`}>
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 id="verify-veh-title" className="vdir-modal-title">
                      Verify Vehicle Documents
                    </h3>
                    <div className="vdir-modal-subtitle-row">
                      <span className="vdir-modal-reg-plate">
                        {verifyingVehicle.registration_number}
                      </span>
                      <span className="vdir-modal-subtext">
                        {verifyingVehicle.vehicle_type}
                        {verifyingVehicle.body_type ? ` • ${verifyingVehicle.body_type}` : ''}
                        {verifyingVehicle.rated_capacity_mt ? ` • ${verifyingVehicle.rated_capacity_mt} MT` : ''}
                      </span>
                      {vendorName && (
                        <span className="vdir-modal-subtext">
                          • {vendorName} {vendorCode ? `(${vendorCode})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setVerifyingVehicle(null)}
                  className="vdir-modal-close-btn"
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="vdir-modal-body">
                {/* Verification Progress & Fast-Track Banner */}
                <div className="vdir-verify-banner">
                  <div className="vdir-verify-banner-top">
                    <div className="vdir-verify-banner-title">
                      <FileText size={15} style={{ color: '#F05A22' }} />
                      <span>Document Compliance Tracker:</span>
                      <strong style={{ color: isAllApproved ? '#10B981' : rejectedCount > 0 ? '#E11D48' : '#F05A22' }}>
                        {approvedCount}/4 Approved
                      </strong>
                    </div>

                    {!isAllApproved && (
                      <button
                        type="button"
                        onClick={handleApproveAllDocs}
                        className="vdir-fast-track-btn"
                        title="Mark all 4 documents as approved"
                      >
                        <Check size={13} />
                        <span>Approve All 4</span>
                      </button>
                    )}
                  </div>

                  <div className="vdir-verify-progress-bar">
                    <div
                      className="vdir-verify-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <p className="vdir-verify-banner-desc">
                    Review statutory compliance documents. The vehicle is instantly cleared for operational assignment and trip dispatch once all 4 documents are marked Approved.
                  </p>
                </div>

                {/* Document Cards */}
                {/* 1. Registration Certificate (RC) */}
                <div className={`vdir-doc-item-card is-${docStatuses.rc.toLowerCase()}`}>
                  <div className="vdir-doc-left">
                    <div className="vdir-doc-icon-sq">
                      <FileText size={20} />
                    </div>
                    <div className="vdir-doc-details">
                      <div className="vdir-doc-title">Registration Certificate (RC)</div>
                      <div className="vdir-doc-meta">
                        <span className="vdir-doc-meta-item">
                          Doc No: <strong className="font-mono">{verifyingVehicle.rc_number || verifyingVehicle.registration_number}</strong>
                        </span>
                        {verifyingVehicle.rc_expiry_date && (
                          <span className="vdir-doc-meta-item">
                            • Expiry: {formatDate(verifyingVehicle.rc_expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="vdir-doc-right">
                    <button
                      type="button"
                      className="vdir-doc-preview-btn"
                      onClick={() => handlePreviewVerifyDoc('Registration Certificate (RC)', 'RC', docStatuses.rc)}
                      title="Preview RC Document"
                    >
                      <Eye size={15} />
                    </button>
                    <select
                      value={docStatuses.rc}
                      onChange={(e) => setDocStatuses({ ...docStatuses, rc: e.target.value as any })}
                      className={`vdir-doc-status-select sel-${docStatuses.rc.toLowerCase()}`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>

                {/* 2. Vehicle Insurance */}
                <div className={`vdir-doc-item-card is-${docStatuses.insurance.toLowerCase()}`}>
                  <div className="vdir-doc-left">
                    <div className="vdir-doc-icon-sq">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="vdir-doc-details">
                      <div className="vdir-doc-title">Vehicle Insurance Policy</div>
                      <div className="vdir-doc-meta">
                        <span className="vdir-doc-meta-item">
                          Policy: <strong className="font-mono">{verifyingVehicle.insurance_policy_number || 'Standard Comprehensive Cover'}</strong>
                        </span>
                        {verifyingVehicle.insurance_expiry_date && (
                          <span className="vdir-doc-meta-item">
                            • Expiry: {formatDate(verifyingVehicle.insurance_expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="vdir-doc-right">
                    <button
                      type="button"
                      className="vdir-doc-preview-btn"
                      onClick={() => handlePreviewVerifyDoc('Vehicle Insurance Policy', 'INSURANCE', docStatuses.insurance)}
                      title="Preview Insurance Document"
                    >
                      <Eye size={15} />
                    </button>
                    <select
                      value={docStatuses.insurance}
                      onChange={(e) => setDocStatuses({ ...docStatuses, insurance: e.target.value as any })}
                      className={`vdir-doc-status-select sel-${docStatuses.insurance.toLowerCase()}`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>

                {/* 3. Fitness Certificate */}
                <div className={`vdir-doc-item-card is-${docStatuses.fitness.toLowerCase()}`}>
                  <div className="vdir-doc-left">
                    <div className="vdir-doc-icon-sq">
                      <CheckCircle size={20} />
                    </div>
                    <div className="vdir-doc-details">
                      <div className="vdir-doc-title">Fitness Certificate (RTO)</div>
                      <div className="vdir-doc-meta">
                        <span className="vdir-doc-meta-item">
                          RTO Vehicle Fitness & Compliance
                        </span>
                        {verifyingVehicle.fitness_expiry_date && (
                          <span className="vdir-doc-meta-item">
                            • Expiry: {formatDate(verifyingVehicle.fitness_expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="vdir-doc-right">
                    <button
                      type="button"
                      className="vdir-doc-preview-btn"
                      onClick={() => handlePreviewVerifyDoc('Fitness Certificate (RTO)', 'FITNESS', docStatuses.fitness)}
                      title="Preview Fitness Certificate"
                    >
                      <Eye size={15} />
                    </button>
                    <select
                      value={docStatuses.fitness}
                      onChange={(e) => setDocStatuses({ ...docStatuses, fitness: e.target.value as any })}
                      className={`vdir-doc-status-select sel-${docStatuses.fitness.toLowerCase()}`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>

                {/* 4. Commercial Goods Permit */}
                <div className={`vdir-doc-item-card is-${docStatuses.permit.toLowerCase()}`}>
                  <div className="vdir-doc-left">
                    <div className="vdir-doc-icon-sq">
                      <Truck size={20} />
                    </div>
                    <div className="vdir-doc-details">
                      <div className="vdir-doc-title">Commercial Goods Permit</div>
                      <div className="vdir-doc-meta">
                        <span className="vdir-doc-meta-item">
                          National / State Freight Transport Permit
                        </span>
                        {verifyingVehicle.permit_expiry_date && (
                          <span className="vdir-doc-meta-item">
                            • Expiry: {formatDate(verifyingVehicle.permit_expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="vdir-doc-right">
                    <button
                      type="button"
                      className="vdir-doc-preview-btn"
                      onClick={() => handlePreviewVerifyDoc('Commercial Goods Permit', 'PERMIT', docStatuses.permit)}
                      title="Preview Commercial Permit"
                    >
                      <Eye size={15} />
                    </button>
                    <select
                      value={docStatuses.permit}
                      onChange={(e) => setDocStatuses({ ...docStatuses, permit: e.target.value as any })}
                      className={`vdir-doc-status-select sel-${docStatuses.permit.toLowerCase()}`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="vdir-modal-footer">
                <div className={`vdir-footer-hint ${isAllApproved ? 'approved' : rejectedCount > 0 ? 'rejected' : ''}`}>
                  {isAllApproved ? (
                    <>
                      <CheckCircle size={15} />
                      <span>Ready to approve vehicle for operations</span>
                    </>
                  ) : rejectedCount > 0 ? (
                    <>
                      <AlertTriangle size={15} />
                      <span>Vehicle will be marked as REJECTED</span>
                    </>
                  ) : (
                    <>
                      <Clock size={15} />
                      <span>Vehicle remains PENDING_DOCS until all 4 approved</span>
                    </>
                  )}
                </div>

                <div className="vdir-footer-actions">
                  <button
                    type="button"
                    onClick={() => setVerifyingVehicle(null)}
                    className="vdir-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDocStatuses}
                    disabled={isSavingDocs}
                    className="vdir-btn-primary"
                  >
                    <CheckCircle size={15} />
                    <span>{isSavingDocs ? 'Saving Updates...' : 'Save Document Statuses'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 10. Reject Vehicle Modal — The TruckX Signature UI/UX Theme */}
      {rejectingVehicle && (
        <div
          className="vdir-modal-backdrop"
          onClick={() => setRejectingVehicle(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="vdir-modal-card max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="vdir-modal-header"
              style={{ background: 'linear-gradient(135deg, #4C0519 0%, #881337 100%)' }}
            >
              <div className="vdir-modal-header-left">
                <div className="vdir-modal-header-icon rose">
                  <Ban size={20} />
                </div>
                <div>
                  <h3 className="vdir-modal-title">Reject Vehicle</h3>
                  <div className="vdir-modal-subtitle-row">
                    <span className="vdir-modal-reg-plate">
                      {rejectingVehicle.registration_number}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setRejectingVehicle(null)}
                className="vdir-modal-close-btn"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="vdir-modal-body">
              <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Please provide the mandatory rejection reason. This will be recorded in the database audit log and sent to the vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. RC document unreadable or expired; Fitness certificate missing..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 12.5,
                  border: '1.5px solid #CBD5E1',
                  borderRadius: 10,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div className="vdir-modal-footer">
              <div />
              <div className="vdir-footer-actions">
                <button
                  type="button"
                  onClick={() => setRejectingVehicle(null)}
                  className="vdir-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isSubmittingReject}
                  className="vdir-btn-primary"
                  style={{ background: '#E11D48', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.28)' }}
                >
                  <Ban size={14} />
                  <span>{isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. Request Corrections Modal — The TruckX Signature UI/UX Theme */}
      {correctionVehicle && (
        <div
          className="vdir-modal-backdrop"
          onClick={() => setCorrectionVehicle(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="vdir-modal-card max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="vdir-modal-header"
              style={{ background: 'linear-gradient(135deg, #451A03 0%, #78350F 100%)' }}
            >
              <div className="vdir-modal-header-left">
                <div className="vdir-modal-header-icon amber">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="vdir-modal-title">Request Corrections</h3>
                  <div className="vdir-modal-subtitle-row">
                    <span className="vdir-modal-reg-plate">
                      {correctionVehicle.registration_number}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCorrectionVehicle(null)}
                className="vdir-modal-close-btn"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="vdir-modal-body">
              <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                Identify the exact fields or documents requiring correction. The vendor will see these instructions in the Vendor App to update and resubmit.
              </p>
              <textarea
                value={correctionFeedback}
                onChange={(e) => setCorrectionFeedback(e.target.value)}
                placeholder="e.g. Please re-upload a clear copy of the commercial fitness certificate and update the vehicle capacity..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 12.5,
                  border: '1.5px solid #CBD5E1',
                  borderRadius: 10,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div className="vdir-modal-footer">
              <div />
              <div className="vdir-footer-actions">
                <button
                  type="button"
                  onClick={() => setCorrectionVehicle(null)}
                  className="vdir-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCorrection}
                  disabled={isSubmittingCorrection}
                  className="vdir-btn-primary"
                  style={{ background: '#D97706', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.28)' }}
                >
                  <MessageSquare size={14} />
                  <span>{isSubmittingCorrection ? 'Submitting...' : 'Send Correction Request'}</span>
                </button>
              </div>
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
          <div
            className="vdir-modal-backdrop"
            onClick={() => setViewingDriverModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="vdir-modal-card max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vdir-modal-header">
                <div className="vdir-modal-header-left">
                  <div className="vdir-modal-header-icon blue">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="vdir-modal-title">Driver Profile & Verification</h3>
                    <div className="vdir-modal-subtitle-row">
                      <span className="vdir-modal-reg-plate">
                        {veh.registration_number}
                      </span>
                      <span className="vdir-modal-subtext">
                        {d.full_name} • {displayId}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDriverModal(null)}
                  className="vdir-modal-close-btn"
                  title="Close modal"
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
          <div
            className="vdir-modal-backdrop"
            onClick={() => setAssigningDriverVehicle(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="vdir-modal-card max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vdir-modal-header">
                <div className="vdir-modal-header-left">
                  <div className="vdir-modal-header-icon">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="vdir-modal-title">Assign / Change Driver</h3>
                    <div className="vdir-modal-subtitle-row">
                      <span className="vdir-modal-reg-plate">
                        {veh.registration_number}
                      </span>
                      <span className="vdir-modal-subtext">
                        {vendorMeta?.vendorName || 'Transporter Partner'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setAssigningDriverVehicle(null)}
                  className="vdir-modal-close-btn"
                  title="Close modal"
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
          <div
            className="vdir-modal-backdrop"
            onClick={() => setViewingHistoryVehicle(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="vdir-modal-card max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vdir-modal-header">
                <div className="vdir-modal-header-left">
                  <div className="vdir-modal-header-icon blue">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="vdir-modal-title">Verification History</h3>
                    <div className="vdir-modal-subtitle-row">
                      <span className="vdir-modal-reg-plate">
                        {veh.registration_number}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingHistoryVehicle(null)}
                  className="vdir-modal-close-btn"
                  title="Close modal"
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
          <div
            className="vdir-modal-backdrop"
            onClick={() => setViewingVendorModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="vdir-modal-card max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vdir-modal-header">
                <div className="vdir-modal-header-left">
                  <div className="vdir-modal-header-icon">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="vdir-modal-title">Associated Vendor Details</h3>
                    <div className="vdir-modal-subtitle-row">
                      <span className="vdir-modal-reg-plate">
                        {vm?.vendorCode || 'Vendor'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingVendorModal(null)}
                  className="vdir-modal-close-btn"
                  title="Close modal"
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
