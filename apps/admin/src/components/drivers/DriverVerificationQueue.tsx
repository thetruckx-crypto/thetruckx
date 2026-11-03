import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  RotateCcw,
  Download,
  Eye,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  X,
  Shield,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Truck,
  Edit2,
  SlidersHorizontal,
  Columns as ColumnsIcon,
  Check,
  Zap,
  AlertCircle,
  Calendar,
  Building2,
  Phone,
  ArrowUpDown,
  ExternalLink,
  User,
  ShieldCheck,
  ShieldAlert,
  MoreVertical,
  Activity,
  Layers,
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { DriverLicenceAudit } from './DriverLicenceAudit';
import { DriverDetailsDrawer } from './DriverDetailsDrawer';
import { formatDisplayId, generateDbTruckxId, generateDbNeclId } from '../../utils/idGenerator';
import { optimizeFileForUpload } from '../../utils/fileCompressor';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface DriverVerificationQueueProps {
  onAuditDriver?: (driverId: string) => void;
  onNavigateToVendorProfile?: (vendorId: string) => void;
  onNavigateToVehicleDirectory?: () => void;
}

// Client Management standard palette for initials avatars
const AVATAR_PALETTE = [
  '#F05A22', '#2563EB', '#16A34A', '#7C3AED',
  '#D97706', '#0891B2', '#E11D48', '#4F46E5'
];

function getAvatarColor(name: string): string {
  let hash = 0;
  const str = name || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  if (!name) return 'DR';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const DriverVerificationQueue: React.FC<DriverVerificationQueueProps> = ({
  onAuditDriver,
  onNavigateToVendorProfile,
  onNavigateToVehicleDirectory,
}) => {
  const { hasPermission, adminProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const canDelete = hasPermission('drivers', 'delete');
  const canEdit = hasPermission('drivers', 'edit');
  const canApprove = hasPermission('drivers', 'approve');

  // Core Data State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [vendorVehicleLinks, setVendorVehicleLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selection state
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [vehicleAssignmentFilter, setVehicleAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [transportStatusFilter, setTransportStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('pending');

  // Sorting
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column preferences
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    serialNo: true,
    driverName: true,
    mobile: true,
    dob: true,
    vendor: true,
    vehicle: true,
    transportStatus: true,
    licenceStatus: true,
    verificationStatus: true,
    submissionDate: true,
  });

  // Modal & Drawer State
  const [selectedDrawerDriver, setSelectedDrawerDriver] = useState<any | null>(null);
  const [selectedAuditDriver, setSelectedAuditDriver] = useState<any | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Assign Vehicle Modal State
  const [assigningVehicleDriver, setAssigningVehicleDriver] = useState<any | null>(null);
  const [selectedVehicleToAssign, setSelectedVehicleToAssign] = useState<string>('');
  const [isAssigningVehicle, setIsAssigningVehicle] = useState(false);

  // Transport Status Modal State
  const [statusUpdatingDriver, setStatusUpdatingDriver] = useState<any | null>(null);
  const [selectedTransportStatus, setSelectedTransportStatus] = useState<string>('AVAILABLE');
  const [transportStatusNote, setTransportStatusNote] = useState<string>('');
  const [isUpdatingTransportStatus, setIsUpdatingTransportStatus] = useState(false);

  // Edit Driver Modal State
  const [editingDriver, setEditingDriver] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    mobile: '',
    dateOfBirth: '',
    licenceNumber: '',
    licenceExpiryDate: '',
    primaryVendorId: '',
    address: '',
    city: '',
    state: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Create Driver Account Modal State (Email NOT required)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    fullName: '',
    mobile: '',
    dateOfBirth: '',
    licenceNumber: '',
    primaryVendorId: '',
    status: 'PENDING',
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [vendorVehicles, setVendorVehicles] = useState<any[]>([]);
  const [driverDocFiles, setDriverDocFiles] = useState<{
    dlFront?: File | null;
    dlBack?: File | null;
    aadhaarFront?: File | null;
    aadhaarBack?: File | null;
  }>({});
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreatingDriver, setIsCreatingDriver] = useState(false);

  // Automatically open Add Driver modal if navigated with ?action=create or ?new=true
  useEffect(() => {
    if (searchParams.get('action') === 'create' || searchParams.get('new') === 'true') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  // Delete Driver State
  const [deletingDriver, setDeletingDriver] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Three-Dot Floating Action Menu State
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top?: number;
    bottom?: number;
    right: number;
    isDropup: boolean;
  } | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Approve Driver Modal State
  const [approvingDriver, setApprovingDriver] = useState<any | null>(null);
  const [isApprovingDriver, setIsApprovingDriver] = useState(false);

  // Reject Driver Modal State
  const [rejectingDriver, setRejectingDriver] = useState<any | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [rejectionReasonError, setRejectionReasonError] = useState('');
  const [isRejectingDriver, setIsRejectingDriver] = useState(false);

  const handleToggleActionMenu = (driver: any, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor?.id === driver.id) {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isDropup = spaceBelow < menuHeight + 20;

    setOpenActionMenuId(driver.id);
    setMenuAnchor({
      id: driver.id,
      top: isDropup ? undefined : rect.bottom + 6,
      bottom: isDropup ? window.innerHeight - rect.top + 6 : undefined,
      right: Math.max(16, window.innerWidth - rect.right),
      isDropup,
    });
  };

  // Close floating action menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuAnchor && !(event.target as HTMLElement).closest('.driver-action-menu-container') && !(event.target as HTMLElement).closest('.driver-action-menu-dropdown')) {
        setOpenActionMenuId(null);
        setMenuAnchor(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAnchor(null);
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuAnchor]);

  // Close floating action menu on window scroll or resize to prevent dislocation
  useEffect(() => {
    if (!menuAnchor) return;
    const handleClose = () => {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
    };
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [menuAnchor]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const calculateAge = (dobString: string): { age: number | null; isEligible: boolean; text: string } => {
    if (!dobString) return { age: null, isEligible: false, text: '' };
    try {
      const birth = new Date(dobString);
      if (isNaN(birth.getTime())) return { age: null, isEligible: false, text: '' };
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return {
        age,
        isEligible: age >= 18,
        text: age >= 18 ? `${age} yrs (Eligible)` : `${age} yrs (Underage - min 18 required)`,
      };
    } catch {
      return { age: null, isEligible: false, text: '' };
    }
  };

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      await ensureAdminSession();

      const [driversRes, vendorsRes, tripsRes, vehiclesRes, linksRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*, vendor_companies:primary_vendor_id(id, vendor_name, vendor_code)')
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_companies')
          .select('id, vendor_name, vendor_code, status, address')
          .order('vendor_name', { ascending: true }),
        supabase
          .from('trips')
          .select('id, booking_id, vehicle_id, driver_id, vendor_id, trip_status, started_at, completed_at, created_at, vehicle:vehicles(id, registration_number, vehicle_type, body_type, rated_capacity_mt, status, verification_status)')
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number, vehicle_type, body_type, rated_capacity_mt, status, verification_status'),
        supabase
          .from('vendor_vehicle_links')
          .select('vendor_id, vehicle_id'),
      ]);

      const rawDrivers = driversRes.data || [];
      const vendorsData = vendorsRes.data || [];
      const vendorLookup = new Map(vendorsData.map((v: any) => [v.id, v]));

      let fetchedDrivers = rawDrivers.map((d: any) => ({
        ...d,
        vendor_companies: d.vendor_companies || (d.primary_vendor_id ? vendorLookup.get(d.primary_vendor_id) || null : null),
      }));

      // If drivers query failed, try API fallback
      if (driversRes.error || fetchedDrivers.length === 0) {
        if (driversRes.error) {
          console.warn('[DriverQueue] Supabase driver query notice:', driversRes.error.message);
        }

        // Always attempt API fallback to ensure freshly registered drivers are visible
        // even when Supabase RLS restricts direct reads for the current session.
        try {
          const apiRes = await apiFetch('/admin/drivers');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.data && Array.isArray(json.data) && json.data.length > 0) {
              fetchedDrivers = json.data;
            }
          }
        } catch { /* non-blocking */ }
      } else {
        // Even when Supabase returned results, reconcile with backend to pick up any
        // drivers created via server endpoints
        try {
          const apiRes = await apiFetch('/admin/drivers');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.data && Array.isArray(json.data) && json.data.length > fetchedDrivers.length) {
              fetchedDrivers = json.data;
            }
          }
        } catch { /* non-blocking */ }
      }

      setDrivers(fetchedDrivers);
      setVendors(vendorsRes.data || []);
      setTrips(tripsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setVendorVehicleLinks(linksRes.data || []);

      if (isRefresh) {
        showToast('✅ Driver verification queue updated');
      }
    } catch (err: any) {
      console.warn('Driver database query error:', err.message);
      try {
        const apiRes = await apiFetch('/admin/drivers');
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.data && Array.isArray(json.data)) {
            setDrivers(json.data);
          }
        }
      } catch {
        setDrivers([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Realtime PostgreSQL change subscriptions
    const channel = supabase
      .channel('driver_verification_queue_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          console.log('[DriverQueue Realtime] drivers change detected:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        (payload) => {
          console.log('[DriverQueue Realtime] trips change detected:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          console.log('[DriverQueue Realtime] documents change detected:', payload.eventType);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('[DriverQueue Realtime] Channel status:', status);
      });

    const pollInterval = setInterval(() => {
      loadData();
    }, 12000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadData]);

  // Load vehicles linked to selected vendor for create modal
  useEffect(() => {
    if (!createFormData.primaryVendorId) {
      setVendorVehicles([]);
      setSelectedVehicleId('');
      return;
    }
    const linkedVehicleIds = vendorVehicleLinks
      .filter((l) => l.vendor_id === createFormData.primaryVendorId)
      .map((l) => l.vehicle_id);

    const filteredVehs = vehicles.filter((v) => linkedVehicleIds.includes(v.id));
    setVendorVehicles(filteredVehs);
  }, [createFormData.primaryVendorId, vendorVehicleLinks, vehicles]);

  // ─── Entity Relationship Resolvers ─────────────────────────────────────────

  const getVendorInfo = useCallback(
    (driver: any) => {
      if (driver?.vendor_companies?.vendor_name) {
        return {
          name: driver.vendor_companies.vendor_name,
          code: driver.vendor_companies.vendor_code || (driver.primary_vendor_id ? `VD-${driver.primary_vendor_id.slice(0, 6).toUpperCase()}` : '—'),
          details: driver.vendor_companies,
          isAssigned: true,
        };
      }
      if (driver?.primary_vendor_id) {
        const found = vendors.find((v) => v.id === driver.primary_vendor_id);
        if (found) {
          return {
            name: found.vendor_name,
            code: found.vendor_code || `VD-${found.id.slice(0, 6).toUpperCase()}`,
            details: found,
            isAssigned: true,
          };
        }
        return {
          name: 'Verified Transporter',
          code: `VD-${driver.primary_vendor_id.slice(0, 6).toUpperCase()}`,
          details: null,
          isAssigned: true,
        };
      }
      return {
        name: 'Not Assigned',
        code: '—',
        details: null,
        isAssigned: false,
      };
    },
    [vendors]
  );

  const getDriverVehicleAssignment = useCallback(
    (driverId: string) => {
      const driverTrips = trips.filter((t) => t.driver_id === driverId);
      // Active trip first
      const activeTrip = driverTrips.find(
        (t) => t.trip_status !== 'COMPLETED' && t.trip_status !== 'CANCELLED'
      );
      if (activeTrip) {
        const veh = activeTrip.vehicle || vehicles.find((v) => v.id === activeTrip.vehicle_id);
        return { vehicle: veh, trip: activeTrip, isActive: true };
      }
      // Fallback to latest trip
      if (driverTrips.length > 0) {
        const latest = driverTrips[0];
        const veh = latest.vehicle || vehicles.find((v) => v.id === latest.vehicle_id);
        return { vehicle: veh, trip: latest, isActive: false };
      }
      return { vehicle: null, trip: null, isActive: false };
    },
    [trips, vehicles]
  );

  const getDriverTransportStatus = useCallback((driver: any, activeTrip: any) => {
    if (driver.is_active === false) {
      return {
        key: 'INACTIVE',
        label: 'Inactive',
        badgeClass: 'inactive',
      };
    }
    if (activeTrip) {
      if (['DISPATCHED', 'IN_TRANSIT', 'AT_LOADING'].includes(activeTrip.trip_status)) {
        return {
          key: 'ON_TRIP',
          label: 'On Trip',
          badgeClass: 'ontrip',
        };
      }
      if (activeTrip.trip_status === 'LORRY_ASSIGNED') {
        return {
          key: 'ASSIGNED_TO_TRIP',
          label: 'Assigned to Trip',
          badgeClass: 'assigned',
        };
      }
    }
    if (driver.rejection_reason?.startsWith('STATUS:')) {
      const statusKey = driver.rejection_reason.replace('STATUS:', '');
      if (statusKey === 'NOT_TAKING_TRANSPORT') {
        return {
          key: 'NOT_TAKING_TRANSPORT',
          label: 'Not Taking Transport',
          badgeClass: 'not-taking',
        };
      }
      if (statusKey === 'TEMP_UNAVAILABLE') {
        return {
          key: 'TEMP_UNAVAILABLE',
          label: 'Temporarily Unavailable',
          badgeClass: 'temp-unavail',
        };
      }
    }
    return {
      key: 'AVAILABLE',
      label: 'Available for Transport',
      badgeClass: 'available',
    };
  }, []);

  const getLicenceStatus = (driver: any): { label: string; color: string; status: 'VALID' | 'EXPIRED' | 'EXPIRING_SOON' | 'NONE' } => {
    if (!driver.licence_expiry_date) return { label: 'No Expiry', color: 'gray', status: 'NONE' };

    const today = new Date();
    const expiry = new Date(driver.licence_expiry_date);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysLeft < 0) return { label: 'Expired', color: 'red', status: 'EXPIRED' };
    if (daysLeft <= 30) return { label: `${daysLeft} days left`, color: 'amber', status: 'EXPIRING_SOON' };
    return { label: 'Valid', color: 'green', status: 'VALID' };
  };

  // ─── KPI Calculations ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = drivers.length;
    const pending = drivers.filter(
      (d) =>
        d.status === 'PENDING' ||
        d.status === 'PENDING_APPROVAL' ||
        d.status === 'SUBMITTED' ||
        d.status === 'UNDER_REVIEW' ||
        d.verification_status === 'PENDING' ||
        (d.status === 'INACTIVE' && d.verification_status !== 'APPROVED' && d.verification_status !== 'REJECTED')
    ).length;
    const approved = drivers.filter((d) => d.status === 'APPROVED' || d.verification_status === 'APPROVED').length;
    const rejected = drivers.filter((d) => d.status === 'REJECTED' || d.verification_status === 'REJECTED').length;

    const today = new Date();
    const expired = drivers.filter((d) => {
      if (!d.licence_expiry_date) return false;
      const expiry = new Date(d.licence_expiry_date);
      return expiry < today;
    }).length;

    return { total, pending, approved, rejected, expired };
  }, [drivers]);

  // ─── Workflow Progress Counts ──────────────────────────────────────────────
  const workflowStats = useMemo(() => {
    const registered = drivers.length;
    let assignedVehCount = 0;
    let readyTransportCount = 0;

    drivers.forEach((d) => {
      const assignment = getDriverVehicleAssignment(d.id);
      if (assignment.vehicle) assignedVehCount++;
      const tStatus = getDriverTransportStatus(d, assignment.trip);
      if ((d.status === 'APPROVED' || d.verification_status === 'APPROVED') && tStatus.key === 'AVAILABLE') readyTransportCount++;
    });

    return {
      registered,
      assignedVehCount,
      readyTransportCount,
    };
  }, [drivers, getDriverVehicleAssignment, getDriverTransportStatus]);

  // ─── Filtering & Search ────────────────────────────────────────────────────
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      // 1. Status Tab Filter
      if (activeTab === 'pending') {
        const isPending =
          d.status === 'PENDING' ||
          d.status === 'PENDING_APPROVAL' ||
          d.status === 'SUBMITTED' ||
          d.status === 'UNDER_REVIEW' ||
          d.verification_status === 'PENDING' ||
          (d.status === 'INACTIVE' && d.verification_status !== 'APPROVED' && d.verification_status !== 'REJECTED');
        if (!isPending) return false;
      }
      if (activeTab === 'approved' && d.status !== 'APPROVED' && d.verification_status !== 'APPROVED') return false;
      if (activeTab === 'rejected' && d.status !== 'REJECTED' && d.verification_status !== 'REJECTED') return false;
      if (activeTab === 'expired') {
        const today = new Date();
        const expiry = d.licence_expiry_date ? new Date(d.licence_expiry_date) : null;
        if (!expiry || expiry >= today) return false;
      }

      // 2. Status Dropdown Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          const isPending =
            d.status === 'PENDING' ||
            d.status === 'PENDING_APPROVAL' ||
            d.status === 'SUBMITTED' ||
            d.status === 'UNDER_REVIEW' ||
            d.verification_status === 'PENDING' ||
            (d.status === 'INACTIVE' && d.verification_status !== 'APPROVED' && d.verification_status !== 'REJECTED');
          if (!isPending) return false;
        } else if (statusFilter === 'approved') {
          if (d.status !== 'APPROVED' && d.verification_status !== 'APPROVED') return false;
        } else if (statusFilter === 'rejected') {
          if (d.status !== 'REJECTED' && d.verification_status !== 'REJECTED') return false;
        } else if (d.status !== statusFilter.toUpperCase() && d.verification_status !== statusFilter.toUpperCase()) {
          return false;
        }
      }

      // 3. Vendor Dropdown Filter
      if (vendorFilter !== 'all' && d.primary_vendor_id !== vendorFilter) return false;

      // 4. Vehicle Assignment Filter
      const vehAssign = getDriverVehicleAssignment(d.id);
      if (vehicleAssignmentFilter === 'assigned' && !vehAssign.vehicle) return false;
      if (vehicleAssignmentFilter === 'unassigned' && vehAssign.vehicle) return false;

      // 5. Transport Status Filter
      if (transportStatusFilter !== 'all') {
        const tStatus = getDriverTransportStatus(d, vehAssign.trip);
        if (tStatus.key !== transportStatusFilter) return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const driverCode = formatDisplayId('DR', d.driver_code || d.id, d.created_at).toLowerCase();
        const matchName = d.full_name?.toLowerCase().includes(q);
        const matchMobile = (d.mobile || d.phone)?.toLowerCase().includes(q);
        const matchLicence = d.licence_number?.toLowerCase().includes(q);
        const matchId = d.id?.toLowerCase().includes(q) || driverCode.includes(q);

        const vInfo = getVendorInfo(d);
        const matchVendor = vInfo.name.toLowerCase().includes(q) || vInfo.code.toLowerCase().includes(q);

        const vehReg = vehAssign.vehicle?.registration_number?.toLowerCase() || '';
        const matchVehicle = vehReg.includes(q);

        if (!matchName && !matchMobile && !matchLicence && !matchId && !matchVendor && !matchVehicle) {
          return false;
        }
      }

      return true;
    });
  }, [
    drivers,
    activeTab,
    statusFilter,
    vendorFilter,
    vehicleAssignmentFilter,
    transportStatusFilter,
    searchQuery,
    getDriverVehicleAssignment,
    getDriverTransportStatus,
    getVendorInfo,
  ]);

  // ─── Sorting ───────────────────────────────────────────────────────────────
  const sortedDrivers = useMemo(() => {
    return [...filteredDrivers].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'name':
          valA = a.full_name?.toLowerCase() || '';
          valB = b.full_name?.toLowerCase() || '';
          break;
        case 'mobile':
          valA = a.mobile || a.phone || '';
          valB = b.mobile || b.phone || '';
          break;
        case 'dob':
          valA = a.date_of_birth || a.dob || '';
          valB = b.date_of_birth || b.dob || '';
          break;
        case 'vendor':
          valA = getVendorInfo(a).name.toLowerCase();
          valB = getVendorInfo(b).name.toLowerCase();
          break;
        case 'vehicle':
          valA = getDriverVehicleAssignment(a.id).vehicle?.registration_number || '';
          valB = getDriverVehicleAssignment(b.id).vehicle?.registration_number || '';
          break;
        case 'licence':
          valA = a.licence_expiry_date || '';
          valB = b.licence_expiry_date || '';
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'createdAt':
        default:
          valA = a.created_at || '';
          valB = b.created_at || '';
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDrivers, sortField, sortOrder, getVendorInfo, getDriverVehicleAssignment]);

  // ─── Pagination ────────────────────────────────────────────────────────────
  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDrivers.slice(start, start + pageSize);
  }, [sortedDrivers, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedDrivers.length / pageSize) || 1;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // ─── Actions & Handlers ────────────────────────────────────────────────────

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedDriverIds.size === paginatedDrivers.length) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(paginatedDrivers.map((d) => d.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selected driver for Important Actions Bar
  const activeSelectedDriver = useMemo(() => {
    if (selectedDriverIds.size === 1) {
      const singleId = Array.from(selectedDriverIds)[0];
      return drivers.find((d) => d.id === singleId) || null;
    }
    return null;
  }, [selectedDriverIds, drivers]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setVendorFilter('all');
    setVehicleAssignmentFilter('all');
    setTransportStatusFilter('all');
    setActiveTab('pending');
    setCurrentPage(1);
    setSelectedDriverIds(new Set());
    showToast('Filters reset to default');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (sortedDrivers.length === 0) {
      showToast('No driver records to export');
      return;
    }

    const headers = [
      'Driver ID',
      'Full Name',
      'Mobile Number',
      'Date of Birth',
      'Age',
      'Connected Vendor',
      'Vendor Code',
      'Assigned Vehicle',
      'Vehicle Category',
      'Transport Status',
      'Driving Licence Number',
      'Licence Expiry Date',
      'Licence Validity',
      'Verification Status',
      'Registered Date',
    ];

    const rows = sortedDrivers.map((d) => {
      const vInfo = getVendorInfo(d);
      const vehInfo = getDriverVehicleAssignment(d.id);
      const tStatus = getDriverTransportStatus(d, vehInfo.trip);
      const licStatus = getLicenceStatus(d);
      const ageInfo = calculateAge(d.date_of_birth || d.dob);

      return [
        `"${formatDisplayId('DR', d.driver_code || d.id, d.created_at)}"`,
        `"${d.full_name || ''}"`,
        `"${d.mobile || d.phone || ''}"`,
        `"${d.date_of_birth || d.dob || ''}"`,
        `"${ageInfo.age || ''}"`,
        `"${vInfo.name}"`,
        `"${vInfo.code}"`,
        `"${vehInfo.vehicle?.registration_number || 'Not Assigned'}"`,
        `"${vehInfo.vehicle?.vehicle_type || ''}"`,
        `"${tStatus.label}"`,
        `"${d.licence_number || ''}"`,
        `"${d.licence_expiry_date || ''}"`,
        `"${licStatus.label}"`,
        `"${d.status || 'PENDING'}"`,
        `"${d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : ''}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `drivers_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✅ Exported ${sortedDrivers.length} driver records`);
  };

  // Direct Driver Approval
  const handleApproveDriver = async (driver: any) => {
    try {
      await ensureAdminSession();
      const { error } = await supabase
        .from('drivers')
        .update({
          status: 'APPROVED',
          verification_status: 'APPROVED',
          is_active: true,
          verified_at: new Date().toISOString(),
          verified_by: adminProfile?.name || 'Administrator',
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);

      if (error) throw error;

      // Sync user registry and trigger instant push notification via server endpoint
      try {
        await apiFetch('/admin/driver-approval', {
          method: 'POST',
          body: JSON.stringify({
            driverId: driver.id,
            decision: 'APPROVED',
            reviewerName: adminProfile?.name || 'Administrator',
          }),
        });
      } catch (syncErr) {
        console.warn('Driver approval server sync warning:', syncErr);
      }

      showToast(`✅ Driver "${driver.full_name}" verified & approved!`);
      loadData();
      if (selectedDrawerDriver?.id === driver.id) {
        setSelectedDrawerDriver((prev: any) => ({ ...prev, status: 'APPROVED', verification_status: 'APPROVED' }));
      }
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  // Direct Driver Rejection
  const handleRejectDriver = async (driver: any, reason: string) => {
    try {
      await ensureAdminSession();
      const { error } = await supabase
        .from('drivers')
        .update({
          status: 'REJECTED',
          verification_status: 'REJECTED',
          rejection_reason: reason,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);

      if (error) throw error;

      // Sync user registry and trigger instant push notification via server endpoint
      try {
        await apiFetch('/admin/driver-approval', {
          method: 'POST',
          body: JSON.stringify({
            driverId: driver.id,
            decision: 'REJECTED',
            reviewerName: adminProfile?.name || 'Administrator',
            reason,
          }),
        });
      } catch (syncErr) {
        console.warn('Driver rejection server sync warning:', syncErr);
      }

      showToast(`Driver "${driver.full_name}" rejected`);
      loadData();
      if (selectedDrawerDriver?.id === driver.id) {
        setSelectedDrawerDriver((prev: any) => ({ ...prev, status: 'REJECTED', rejection_reason: reason }));
      }
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // Assign Vehicle Submit
  const handleConfirmAssignVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningVehicleDriver) return;

    if (!selectedVehicleToAssign) {
      alert('Please select an eligible fleet vehicle.');
      return;
    }

    setIsAssigningVehicle(true);
    try {
      await ensureAdminSession();

      // Check active assignment
      const currentAssign = getDriverVehicleAssignment(assigningVehicleDriver.id);
      if (currentAssign.trip && currentAssign.isActive) {
        const { error: updErr } = await supabase
          .from('trips')
          .update({
            vehicle_id: selectedVehicleToAssign,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentAssign.trip.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('trips').insert([
          {
            vehicle_id: selectedVehicleToAssign,
            driver_id: assigningVehicleDriver.id,
            vendor_id: assigningVehicleDriver.primary_vendor_id || null,
            trip_status: 'LORRY_ASSIGNED',
            created_at: new Date().toISOString(),
          },
        ]);
        if (insErr) throw insErr;
      }

      showToast(`✅ Vehicle assigned to ${assigningVehicleDriver.full_name}!`);
      setAssigningVehicleDriver(null);
      setSelectedVehicleToAssign('');
      loadData();
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setIsAssigningVehicle(false);
    }
  };

  // Remove Vehicle Assignment
  const handleRemoveVehicleAssignment = async (driver: any) => {
    if (!driver) return;
    const currentAssign = getDriverVehicleAssignment(driver.id);
    if (!currentAssign.vehicle) return;

    if (currentAssign.trip && ['DISPATCHED', 'IN_TRANSIT', 'AT_LOADING'].includes(currentAssign.trip.trip_status)) {
      alert(`Cannot unassign vehicle: Driver is currently in active trip #${currentAssign.trip.id.slice(0, 8)} (${currentAssign.trip.trip_status}).`);
      return;
    }

    if (!confirm(`Are you sure you want to remove the vehicle assignment for ${driver.full_name}?`)) {
      return;
    }

    try {
      await ensureAdminSession();
      if (currentAssign.trip) {
        await supabase
          .from('trips')
          .update({ trip_status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', currentAssign.trip.id);
      }
      showToast(`Vehicle assignment removed for ${driver.full_name}`);
      setAssigningVehicleDriver(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to remove assignment: ${err.message}`);
    }
  };

  // Transport Status Submit
  const handleConfirmTransportStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdatingDriver) return;

    setIsUpdatingTransportStatus(true);
    try {
      await ensureAdminSession();

      const isSettingActive = selectedTransportStatus !== 'INACTIVE';
      let statusPayload: any = {
        is_active: isSettingActive,
        updated_at: new Date().toISOString(),
      };

      if (['NOT_TAKING_TRANSPORT', 'TEMP_UNAVAILABLE'].includes(selectedTransportStatus)) {
        statusPayload.rejection_reason = `STATUS:${selectedTransportStatus}`;
      } else if (selectedTransportStatus === 'AVAILABLE' && statusUpdatingDriver.rejection_reason?.startsWith('STATUS:')) {
        statusPayload.rejection_reason = null;
      }

      const { error } = await supabase
        .from('drivers')
        .update(statusPayload)
        .eq('id', statusUpdatingDriver.id);

      if (error) throw error;

      showToast(`✅ Transport availability updated for ${statusUpdatingDriver.full_name}`);
      setStatusUpdatingDriver(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to update transport status: ${err.message}`);
    } finally {
      setIsUpdatingTransportStatus(false);
    }
  };

  // Edit Driver Submit
  const handleConfirmEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    const errs: Record<string, string> = {};
    if (!editFormData.fullName.trim()) errs.fullName = 'Full Name is required.';
    const cleanMobile = editFormData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) errs.mobile = '10-digit mobile number required.';
    if (!editFormData.licenceNumber.trim()) errs.licenceNumber = 'Licence number is required.';

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await ensureAdminSession();
      const { error } = await supabase
        .from('drivers')
        .update({
          full_name: editFormData.fullName.trim(),
          mobile: cleanMobile,
          phone: cleanMobile,
          date_of_birth: editFormData.dateOfBirth || null,
          dob: editFormData.dateOfBirth || null,
          licence_number: editFormData.licenceNumber.trim().toUpperCase(),
          licence_expiry_date: editFormData.licenceExpiryDate || null,
          primary_vendor_id: editFormData.primaryVendorId || null,
          address: editFormData.address.trim() || null,
          city: editFormData.city.trim() || null,
          state: editFormData.state.trim() || null,
          emergency_contact_name: editFormData.emergencyContactName.trim() || null,
          emergency_contact_phone: editFormData.emergencyContactPhone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDriver.id);

      if (error) throw error;

      showToast(`✅ Driver "${editFormData.fullName}" updated successfully!`);
      setEditingDriver(null);
      loadData();
    } catch (err: any) {
      setEditErrors({ global: err.message || 'Failed to update driver.' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Create Driver Submit (No Email Field)
  const handleCreateDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!createFormData.fullName.trim()) errs.fullName = 'Full Name is required.';
    const cleanMobile = createFormData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) errs.mobile = '10-digit mobile number is required.';
    if (!createFormData.dateOfBirth.trim()) errs.dateOfBirth = 'Date of Birth is required.';
    if (!createFormData.licenceNumber.trim()) errs.licenceNumber = 'Driving Licence Number is required.';
    if (!createFormData.primaryVendorId) errs.primaryVendorId = 'Connected Vendor selection is required.';

    const ageInfo = calculateAge(createFormData.dateOfBirth);
    if (ageInfo.age !== null && ageInfo.age < 18) {
      errs.dateOfBirth = 'Driver must be at least 18 years old.';
    }

    // Check duplicate mobile
    if (!errs.mobile) {
      try {
        const { data: existing } = await supabase
          .from('drivers')
          .select('id')
          .or(`mobile.eq.${cleanMobile},mobile.eq.+91${cleanMobile}`)
          .maybeSingle();

        if (existing) {
          errs.mobile = 'A driver with this mobile number is already registered.';
        }
      } catch {}
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreatingDriver(true);
    try {
      const driverCode = await generateDbTruckxId('DR');
      const accountId = await generateDbTruckxId('AC');
      const { data, error } = await supabase
        .from('drivers')
        .insert([
          {
            driver_code: driverCode,
            account_id: accountId,
            full_name: createFormData.fullName.trim(),
            mobile: cleanMobile,
            phone: cleanMobile,
            date_of_birth: createFormData.dateOfBirth,
            dob: createFormData.dateOfBirth,
            licence_number: createFormData.licenceNumber.trim().toUpperCase(),
            primary_vendor_id: createFormData.primaryVendorId,
            status: createFormData.status,
            verification_status: createFormData.status,
            is_active: createFormData.status === 'APPROVED',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data?.id) {
        const driverId = data.id;

        // If vehicle selected, associate via trip
        if (selectedVehicleId) {
          try {
            await supabase.from('trips').insert([
              {
                vehicle_id: selectedVehicleId,
                driver_id: driverId,
                vendor_id: createFormData.primaryVendorId,
                trip_status: 'LORRY_ASSIGNED',
                created_at: new Date().toISOString(),
              },
            ]);
          } catch (vehErr) {
            console.warn('Vehicle driver association notice:', vehErr);
          }
        }

        // Upload and insert documents if attached
        const docConfigs = [
          { file: driverDocFiles.dlFront, type: 'LICENCE', side: 'FRONT', label: 'Driving Licence — Front Side' },
          { file: driverDocFiles.dlBack, type: 'LICENCE', side: 'BACK', label: 'Driving Licence — Back Side' },
          { file: driverDocFiles.aadhaarFront, type: 'AADHAAR', side: 'FRONT', label: 'Aadhaar Card — Front Side' },
          { file: driverDocFiles.aadhaarBack, type: 'AADHAAR', side: 'BACK', label: 'Aadhaar Card — Back Side' },
        ];

        for (const doc of docConfigs) {
          if (!doc.file) continue;
          try {
            const ext = doc.file.name.split('.').pop() || 'jpg';
            const cleanName = doc.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `drivers/${driverId}/${doc.type.toLowerCase()}_${doc.side.toLowerCase()}_${Date.now()}.${ext}`;

            let publicUrl = storagePath;
            try {
              const uploadReadyFile = await optimizeFileForUpload(doc.file);
              const { data: upData, error: upErr } = await supabase.storage
                .from('client-documents')
                .upload(storagePath, uploadReadyFile, { upsert: true });
              if (!upErr && upData) publicUrl = storagePath;
            } catch (storErr) {
              console.warn('Storage upload notice for driver doc:', storErr);
            }

            await supabase.from('documents').insert([
              {
                category: 'DRIVER',
                document_type: doc.type,
                doc_side: doc.side,
                reference_id: driverId,
                file_name: `${doc.label}: ${cleanName}`,
                file_url: publicUrl,
                storage_path: storagePath,
                file_size: `${Math.round(doc.file.size / 1024)} KB`,
                mime_type: doc.file.type || 'image/jpeg',
                verification_status: 'PENDING',
                uploaded_by: 'Admin Desk',
              },
            ]);
          } catch (docErr) {
            console.warn('Driver document insert notice:', docErr);
          }
        }
      }

      showToast(`✅ Driver account created (${createFormData.fullName})!`);
      setIsCreateModalOpen(false);
      setCreateFormData({
        fullName: '',
        mobile: '',
        dateOfBirth: '',
        licenceNumber: '',
        primaryVendorId: '',
        status: 'PENDING',
      });
      setSelectedVehicleId('');
      setDriverDocFiles({});
      loadData();
    } catch (err: any) {
      setCreateErrors({ global: err.message || 'Failed to create driver account.' });
    } finally {
      setIsCreatingDriver(false);
    }
  };

  // Permanent Delete Driver
  const handleConfirmDeleteDriver = async () => {
    if (!deletingDriver) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch('/admin/delete-user', {
        method: 'POST',
        body: JSON.stringify({
          driverId: deletingDriver.id,
          mobile: deletingDriver.mobile_number || deletingDriver.mobile,
          role: 'DRIVER',
          reason: deleteReason || 'Deleted by Administrator from Driver Queue',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete driver account');
      }
      setDrivers((prev) => prev.filter((d) => d.id !== deletingDriver.id));
      showToast(`Driver "${deletingDriver.full_name || deletingDriver.name}" permanently deleted.`);
      setDeletingDriver(null);
      setDeleteReason('');
      if (selectedDrawerDriver?.id === deletingDriver.id) {
        setSelectedDrawerDriver(null);
      }
    } catch (err: any) {
      console.error('Delete driver error:', err);
      alert(`Error deleting driver: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="driver-verification-page-wrapper">
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Banner matching Client Management */}
      <div className="client-header-hero">
        <div className="client-header-text">
          <div className="page-breadcrumb">
            <span className="breadcrumb-link">Drivers</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Driver Verification Queue</span>
          </div>
          <h1 className="page-title">Driver Verification Queue</h1>
          <p className="page-subtitle">
            Review commercial driver identity documents, driving licences, transporter fleet assignments, and compliance statuses.
          </p>
        </div>

        <div className="client-mgmt-header-actions">
          <button
            className="btn-header-secondary"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            title="Refresh driver verification queue"
            id="btn-refresh-drivers"
          >
            <RefreshCw size={15} className={loading || refreshing ? 'animate-spin' : ''} />
            <span>Refresh Queue</span>
          </button>

          <button
            className="btn-header-secondary"
            onClick={handleExportCSV}
            title="Export drivers to CSV"
            id="btn-export-drivers"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          <button
            id="btn-create-driver"
            className="btn-header-primary-orange"
            onClick={() => setIsCreateModalOpen(true)}
            title="Create driver account"
          >
            <Plus size={16} />
            <span>+ Create Driver Account</span>
          </button>
        </div>
      </div>

      {/* 2. 5 Summary KPI Cards (Connected to Real DB Counts) */}
      <div className="client-kpi-bar" role="region" aria-label="Driver statistics summary">
        {/* Total Drivers */}
        <div
          className={`kpi-stat-card ${activeTab === 'all' ? 'card-highlighted' : ''}`}
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view all drivers"
        >
          <div className="kpi-stat-icon" style={{ background: '#FFF1E8' }}>
            <Users size={20} color="#F05A22" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Total Drivers</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value">{kpis.total}</div>
          </div>
        </div>

        {/* Pending Approval */}
        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'card-highlighted' : ''}`}
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view drivers pending approval"
        >
          <div className="kpi-stat-icon" style={{ background: '#FEF3C7' }}>
            <Clock size={20} color="#D97706" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Pending Approval</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#D97706' }}>{kpis.pending}</div>
          </div>
        </div>

        {/* Verified Drivers */}
        <div
          className={`kpi-stat-card ${activeTab === 'approved' ? 'card-highlighted' : ''}`}
          onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view verified drivers"
        >
          <div className="kpi-stat-icon" style={{ background: '#ECFDF5' }}>
            <CheckCircle2 size={20} color="#10B981" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Verified Drivers</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#10B981' }}>{kpis.approved}</div>
          </div>
        </div>

        {/* Rejected Drivers */}
        <div
          className={`kpi-stat-card ${activeTab === 'rejected' ? 'card-highlighted' : ''}`}
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view rejected drivers"
        >
          <div className="kpi-stat-icon" style={{ background: '#FEF2F2' }}>
            <XCircle size={20} color="#EF4444" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Rejected Drivers</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#EF4444' }}>{kpis.rejected}</div>
          </div>
        </div>

        {/* Expired Licences */}
        <div
          className={`kpi-stat-card ${activeTab === 'expired' ? 'card-highlighted' : ''}`}
          onClick={() => { setActiveTab('expired'); setCurrentPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view expired licence drivers"
        >
          <div className="kpi-stat-icon" style={{ background: '#FFFBEB' }}>
            <AlertTriangle size={20} color="#D97706" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Expired Licences</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            <div className="kpi-stat-value" style={{ color: '#D97706' }}>{kpis.expired}</div>
          </div>
        </div>
      </div>

      {/* 3. Task 19: 5-Step Operational Lifecycle Workflow Progress Panel */}
      <div className="driver-workflow-card" role="region" aria-label="Driver onboarding workflow stages">
        <div className="driver-workflow-header">
          <div className="driver-workflow-title">
            <Layers size={15} color="#F05A22" />
            <span>Driver Onboarding & Dispatch Lifecycle</span>
          </div>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            Active Roster: <strong style={{ color: '#0F172A' }}>{drivers.length} Drivers</strong>
          </span>
        </div>

        <div className="driver-workflow-steps">
          {/* Step 1: Registration */}
          <div
            className={`driver-workflow-step ${workflowStats.registered > 0 ? 'step-completed' : ''}`}
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            title="Account registered in system"
          >
            <div className="driver-workflow-step-num">1</div>
            <div className="driver-workflow-step-content">
              <div className="driver-workflow-step-name">Registration</div>
              <div className="driver-workflow-step-sub">{workflowStats.registered} Registered</div>
            </div>
          </div>

          {/* Step 2: Document Review */}
          <div
            className={`driver-workflow-step ${kpis.pending > 0 ? 'step-active' : 'step-completed'}`}
            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
            title="Inspect driving licences and KYC"
          >
            <div className="driver-workflow-step-num">2</div>
            <div className="driver-workflow-step-content">
              <div className="driver-workflow-step-name">Document Review</div>
              <div className="driver-workflow-step-sub">{kpis.pending} Under Review</div>
            </div>
          </div>

          {/* Step 3: Assign Vehicle */}
          <div
            className="driver-workflow-step"
            onClick={() => { setVehicleAssignmentFilter('assigned'); setCurrentPage(1); }}
            title="Link driver to verified transporter fleet"
          >
            <div className="driver-workflow-step-num">3</div>
            <div className="driver-workflow-step-content">
              <div className="driver-workflow-step-name">Assign Vehicle</div>
              <div className="driver-workflow-step-sub">{workflowStats.assignedVehCount} Assigned</div>
            </div>
          </div>

          {/* Step 4: Approve Driver */}
          <div
            className={`driver-workflow-step ${kpis.approved > 0 ? 'step-completed' : ''}`}
            onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
            title="Official administrator clearance"
          >
            <div className="driver-workflow-step-num">4</div>
            <div className="driver-workflow-step-content">
              <div className="driver-workflow-step-name">Approve Driver</div>
              <div className="driver-workflow-step-sub">{kpis.approved} Verified</div>
            </div>
          </div>

          {/* Step 5: Ready for Transport */}
          <div
            className="driver-workflow-step"
            onClick={() => { setTransportStatusFilter('AVAILABLE'); setCurrentPage(1); }}
            title="Ready for commercial dispatch allocation"
          >
            <div className="driver-workflow-step-num">5</div>
            <div className="driver-workflow-step-content">
              <div className="driver-workflow-step-name">Ready for Transport</div>
              <div className="driver-workflow-step-sub">{workflowStats.readyTransportCount} Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Task 20: Important Actions Panel (Active When Driver Selected) */}
      {activeSelectedDriver && (
        <div className="driver-selected-actions-card">
          <div className="driver-actions-info">
            <div className="driver-actions-avatar">
              {getInitials(activeSelectedDriver.full_name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{activeSelectedDriver.full_name}</strong>
                <span style={{ fontSize: 12, opacity: 0.8, fontFamily: 'monospace' }}>
                  ({formatDisplayId('DR', activeSelectedDriver.driver_code || activeSelectedDriver.id, activeSelectedDriver.created_at)})
                </span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.15)' }}>
                  Vendor: {getVendorInfo(activeSelectedDriver).name}
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                Vehicle: {getDriverVehicleAssignment(activeSelectedDriver.id).vehicle?.registration_number || 'Unassigned'} •
                Licence: {activeSelectedDriver.licence_number || '—'}
              </div>
            </div>
          </div>

          <div className="driver-actions-btns">
            <button
              type="button"
              className="btn-action-panel-secondary"
              onClick={() => setSelectedDrawerDriver(activeSelectedDriver)}
              title="Open full view drawer"
            >
              <Eye size={13} />
              <span>View Details</span>
            </button>

            <button
              type="button"
              className="btn-action-panel-secondary"
              onClick={() => {
                setSelectedAuditDriver(activeSelectedDriver);
                setIsAuditModalOpen(true);
              }}
              title="Audit licence documents"
            >
              <FileCheck size={13} />
              <span>Audit Docs</span>
            </button>

            {canEdit && (
              <button
                type="button"
                className="btn-action-panel-secondary"
                onClick={() => {
                  setEditingDriver(activeSelectedDriver);
                  setEditFormData({
                    fullName: activeSelectedDriver.full_name || '',
                    mobile: activeSelectedDriver.mobile || activeSelectedDriver.phone || '',
                    dateOfBirth: activeSelectedDriver.date_of_birth || activeSelectedDriver.dob || '',
                    licenceNumber: activeSelectedDriver.licence_number || '',
                    licenceExpiryDate: activeSelectedDriver.licence_expiry_date || '',
                    primaryVendorId: activeSelectedDriver.primary_vendor_id || '',
                    address: activeSelectedDriver.address || '',
                    city: activeSelectedDriver.city || '',
                    state: activeSelectedDriver.state || '',
                    emergencyContactName: activeSelectedDriver.emergency_contact_name || '',
                    emergencyContactPhone: activeSelectedDriver.emergency_contact_phone || '',
                  });
                }}
                title="Edit driver particulars"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              className="btn-action-panel-primary"
              onClick={() => {
                setAssigningVehicleDriver(activeSelectedDriver);
                const curr = getDriverVehicleAssignment(activeSelectedDriver.id);
                setSelectedVehicleToAssign(curr.vehicle?.id || '');
              }}
              title="Assign or reassign fleet vehicle"
            >
              <Truck size={13} />
              <span>Assign Vehicle</span>
            </button>

            <button
              type="button"
              className="btn-action-panel-secondary"
              onClick={() => {
                setStatusUpdatingDriver(activeSelectedDriver);
                const vehAssign = getDriverVehicleAssignment(activeSelectedDriver.id);
                const tStatus = getDriverTransportStatus(activeSelectedDriver, vehAssign.trip);
                setSelectedTransportStatus(tStatus.key);
              }}
              title="Update availability for transport"
            >
              <SlidersHorizontal size={13} />
              <span>Transport Status</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDriverIds(new Set())}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 5. Filters Bar Card matching Reference Design */}
      <div className="filters-bar-card">
        {/* Search */}
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-abs" />
          <input
            type="text"
            placeholder="Search by driver name, mobile, licence, vendor, vehicle..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="client-search-input"
            aria-label="Search drivers"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Status"
        >
          <option value="all">All Verification Status</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Verified (Approved)</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Vendor Dropdown */}
        <select
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Vendor"
        >
          <option value="all">All Transporters / Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vendor_name} {v.vendor_code ? `(${v.vendor_code})` : ''}
            </option>
          ))}
        </select>

        {/* Vehicle Assignment Dropdown */}
        <select
          value={vehicleAssignmentFilter}
          onChange={(e) => {
            setVehicleAssignmentFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Vehicle Assignment"
        >
          <option value="all">All Vehicle States</option>
          <option value="assigned">Assigned to Vehicle</option>
          <option value="unassigned">Unassigned / No Vehicle</option>
        </select>

        {/* Transport Status Dropdown */}
        <select
          value={transportStatusFilter}
          onChange={(e) => {
            setTransportStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
          aria-label="Filter by Transport Status"
        >
          <option value="all">All Transport Statuses</option>
          <option value="AVAILABLE">Available for Transport</option>
          <option value="ON_TRIP">On Trip</option>
          <option value="ASSIGNED_TO_TRIP">Assigned to Trip</option>
          <option value="NOT_TAKING_TRANSPORT">Not Taking Transport</option>
          <option value="TEMP_UNAVAILABLE">Temporarily Unavailable</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        {/* Reset */}
        <button className="btn-filter-reset" onClick={handleResetFilters} title="Reset filters">
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>

        {/* Search button */}
        <button className="btn-filter-search" onClick={() => setCurrentPage(1)} title="Execute search">
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* Active Filter Chips Strip */}
      {(searchQuery ||
        statusFilter !== 'all' ||
        vendorFilter !== 'all' ||
        vehicleAssignmentFilter !== 'all' ||
        transportStatusFilter !== 'all') && (
        <div className="active-filters-chips-bar" role="region" aria-label="Active filters">
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginRight: 4 }}>
            Active Filters:
          </span>
          {searchQuery && (
            <div className="filter-chip-tag">
              <span>Query: <strong>"{searchQuery}"</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            </div>
          )}
          {statusFilter !== 'all' && (
            <div className="filter-chip-tag">
              <span>Status: <strong>{statusFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setStatusFilter('all')}>
                <X size={12} />
              </button>
            </div>
          )}
          {vendorFilter !== 'all' && (
            <div className="filter-chip-tag">
              <span>Vendor: <strong>{vendors.find((v) => v.id === vendorFilter)?.vendor_name || vendorFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setVendorFilter('all')}>
                <X size={12} />
              </button>
            </div>
          )}
          {vehicleAssignmentFilter !== 'all' && (
            <div className="filter-chip-tag">
              <span>Vehicle: <strong>{vehicleAssignmentFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setVehicleAssignmentFilter('all')}>
                <X size={12} />
              </button>
            </div>
          )}
          {transportStatusFilter !== 'all' && (
            <div className="filter-chip-tag">
              <span>Transport: <strong>{transportStatusFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setTransportStatusFilter('all')}>
                <X size={12} />
              </button>
            </div>
          )}
          <button className="filter-clear-all-action" onClick={handleResetFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {/* 6. Sub-bar: Status Tabs, Column Preferences & Export */}
      <div className="table-sub-bar">
        <div className="status-tabs-list" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'pending'}
            className={`status-tab-btn ${activeTab === 'pending' ? 'active-tab' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
          >
            Pending Review ({kpis.pending})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'approved'}
            className={`status-tab-btn ${activeTab === 'approved' ? 'active-tab' : ''}`}
            onClick={() => {
              setActiveTab('approved');
              setCurrentPage(1);
            }}
          >
            Verified ({kpis.approved})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'rejected'}
            className={`status-tab-btn ${activeTab === 'rejected' ? 'active-tab' : ''}`}
            onClick={() => {
              setActiveTab('rejected');
              setCurrentPage(1);
            }}
          >
            Rejected ({kpis.rejected})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'expired'}
            className={`status-tab-btn ${activeTab === 'expired' ? 'active-tab' : ''}`}
            onClick={() => {
              setActiveTab('expired');
              setCurrentPage(1);
            }}
          >
            Expired Licence ({kpis.expired})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`status-tab-btn ${activeTab === 'all' ? 'active-tab' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            All Drivers ({kpis.total})
          </button>
        </div>

        <div className="table-actions-group" style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>
            Total: <strong style={{ color: '#0F172A' }}>{sortedDrivers.length}</strong>
          </span>

          {/* Column Visibility Menu */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-action-outline ${showColumnConfig ? 'active-filter' : ''}`}
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              title="Customize visible columns"
            >
              <ColumnsIcon size={14} />
              <span>Columns</span>
            </button>

            {showColumnConfig && (
              <div className="columns-popover-menu" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #E2E8F0', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>Customize Columns</span>
                  <button
                    onClick={() =>
                      setVisibleColumns({
                        serialNo: true,
                        driverName: true,
                        mobile: true,
                        dob: true,
                        vendor: true,
                        vehicle: true,
                        transportStatus: true,
                        licenceStatus: true,
                        verificationStatus: true,
                        submissionDate: true,
                      })
                    }
                    style={{ background: 'none', border: 'none', color: '#F05A22', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Reset All
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'serialNo', label: '# (Serial No)' },
                    { key: 'driverName', label: 'Driver Name & ID' },
                    { key: 'mobile', label: 'Mobile Number' },
                    { key: 'dob', label: 'Date of Birth & Age' },
                    { key: 'vendor', label: 'Connected Vendor' },
                    { key: 'vehicle', label: 'Assigned Vehicle' },
                    { key: 'transportStatus', label: 'Transport Status' },
                    { key: 'licenceStatus', label: 'Licence Status' },
                    { key: 'verificationStatus', label: 'Verification Status' },
                    { key: 'submissionDate', label: 'Submission Date' },
                  ].map((col) => (
                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="btn-action-outline" onClick={handleExportCSV} title="Export to CSV">
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 7. Task 7: Professional Redesigned Driver Table */}
      <div className="client-table-card">
        <div className="vendor-table-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }}>
          <table className="client-table" style={{ minWidth: 1350 }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="custom-table-checkbox"
                    checked={paginatedDrivers.length > 0 && selectedDriverIds.size === paginatedDrivers.length}
                    onChange={handleToggleSelectAll}
                    aria-label="Select all drivers"
                  />
                </th>
                {visibleColumns.serialNo && <th style={{ width: '50px' }}>#</th>}
                {visibleColumns.driverName && (
                  <th style={{ minWidth: 190, cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Driver Name ⇅
                  </th>
                )}
                {visibleColumns.mobile && (
                  <th style={{ minWidth: 120, cursor: 'pointer' }} onClick={() => handleSort('mobile')}>
                    Mobile ⇅
                  </th>
                )}
                {visibleColumns.dob && (
                  <th style={{ minWidth: 130, cursor: 'pointer' }} onClick={() => handleSort('dob')}>
                    Date of Birth ⇅
                  </th>
                )}
                {visibleColumns.vendor && (
                  <th style={{ minWidth: 160, cursor: 'pointer' }} onClick={() => handleSort('vendor')}>
                    Vendor ⇅
                  </th>
                )}
                {visibleColumns.vehicle && (
                  <th style={{ minWidth: 140, cursor: 'pointer' }} onClick={() => handleSort('vehicle')}>
                    Assigned Vehicle ⇅
                  </th>
                )}
                {visibleColumns.transportStatus && (
                  <th style={{ minWidth: 140 }}>Transport Status ⇅</th>
                )}
                {visibleColumns.licenceStatus && (
                  <th style={{ minWidth: 130, cursor: 'pointer' }} onClick={() => handleSort('licence')}>
                    Licence Status ⇅
                  </th>
                )}
                {visibleColumns.verificationStatus && (
                  <th style={{ minWidth: 140, cursor: 'pointer' }} onClick={() => handleSort('status')}>
                    Verification Status ⇅
                  </th>
                )}
                {visibleColumns.submissionDate && (
                  <th style={{ minWidth: 120, cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                    Submission Date ⇅
                  </th>
                )}
                <th style={{ width: 130, minWidth: 130, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && drivers.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="table-skeleton-row">
                    <td><div className="table-skeleton-cell" style={{ width: '16px', height: '16px' }} /></td>
                    {visibleColumns.serialNo && <td><div className="table-skeleton-cell" style={{ width: '20px', height: '12px' }} /></td>}
                    {visibleColumns.driverName && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className={`client-avatar-squircle ${['peach', 'purple', 'orange', 'blue', 'teal', 'red'][i % 6]}`} />
                          <div className="table-skeleton-cell" style={{ width: `${120 + (i % 3) * 30}px`, height: '14px' }} />
                        </div>
                      </td>
                    )}
                    {visibleColumns.mobile && <td><div className="table-skeleton-cell" style={{ width: '100px', height: '12px' }} /></td>}
                    {visibleColumns.dob && <td><div className="table-skeleton-cell" style={{ width: '90px', height: '12px' }} /></td>}
                    {visibleColumns.vendor && <td><div className="table-skeleton-cell" style={{ width: '110px', height: '12px' }} /></td>}
                    {visibleColumns.vehicle && <td><div className="table-skeleton-cell" style={{ width: '95px', height: '12px' }} /></td>}
                    {visibleColumns.transportStatus && <td><div className="table-skeleton-cell" style={{ width: '85px', height: '22px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.licenceStatus && <td><div className="table-skeleton-cell" style={{ width: '75px', height: '22px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.verificationStatus && <td><div className="table-skeleton-cell" style={{ width: '85px', height: '22px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.submissionDate && <td><div className="table-skeleton-cell" style={{ width: '80px', height: '12px' }} /></td>}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="table-empty-state">
                      <div className="empty-state-icon-box">
                        <Users size={32} />
                      </div>
                      <h4 className="empty-state-heading">No drivers found</h4>
                      <p className="empty-state-text">
                        {searchQuery || statusFilter !== 'all' || vendorFilter !== 'all' || vehicleAssignmentFilter !== 'all' || transportStatusFilter !== 'all'
                          ? 'No driver records match the selected filter criteria. Try resetting filters.'
                          : 'No drivers found in the database. Click "+ Create Driver Account" above to register a commercial driver.'}
                      </p>
                      <button
                        type="button"
                        className="btn-filter-reset"
                        style={{ marginTop: 12 }}
                        onClick={handleResetFilters}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver, idx) => {
                  const isDriverApproved = driver.status === 'APPROVED';
                  const isDriverPending = driver.status === 'PENDING' || driver.status === 'PENDING_APPROVAL';
                  const isDriverRejected = driver.status === 'REJECTED';
                  const licenceStatus = getLicenceStatus(driver);
                  const vendorInfo = getVendorInfo(driver);
                  const vehAssign = getDriverVehicleAssignment(driver.id);
                  const transportStatus = getDriverTransportStatus(driver, vehAssign.trip);
                  const ageInfo = calculateAge(driver.date_of_birth || driver.dob);
                  const isSelected = selectedDriverIds.has(driver.id);
                  const serialIndex = (currentPage - 1) * pageSize + idx + 1;
                  const displayId = formatDisplayId('DR', driver.driver_code || driver.id, driver.created_at);

                  return (
                    <tr
                      key={driver.id}
                      className={`client-data-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => handleToggleSelectOne(driver.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="custom-table-checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(driver.id)}
                        />
                      </td>

                      {visibleColumns.serialNo && (
                        <td style={{ color: '#64748B', fontWeight: 600 }}>{serialIndex}</td>
                      )}

                      {visibleColumns.driverName && (
                        <td>
                          <div className="client-info-cell">
                            <div
                              className="client-avatar-squircle"
                              style={{ background: getAvatarColor(driver.full_name || driver.name || 'DR'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                            >
                              {getInitials(driver.full_name || driver.name)}
                            </div>
                            <div>
                              <div className="client-name-bold">{driver.full_name || driver.name}</div>
                              <div className="client-id-sub">{displayId}</div>
                            </div>
                          </div>
                        </td>
                      )}

                      {visibleColumns.mobile && (
                        <td style={{ fontFamily: 'monospace' }}>
                          {driver.mobile || driver.phone || '—'}
                        </td>
                      )}

                      {visibleColumns.dob && (
                        <td>
                          <div>
                            {driver.date_of_birth || driver.dob
                              ? new Date(driver.date_of_birth || driver.dob).toLocaleDateString('en-IN')
                              : '—'}
                          </div>
                          {ageInfo.age !== null && (
                            <div style={{ fontSize: 11, color: ageInfo.isEligible ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                              {ageInfo.text}
                            </div>
                          )}
                        </td>
                      )}

                      {visibleColumns.vendor && (
                        <td>
                          {vendorInfo.isAssigned ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#0F172A' }}>{vendorInfo.name}</div>
                              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                                {vendorInfo.code}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 600, background: '#FEF2F2', padding: '2px 8px', borderRadius: 4, border: '1px solid #FECACA' }}>
                              Not Assigned
                            </span>
                          )}
                        </td>
                      )}

                      {visibleColumns.vehicle && (
                        <td>
                          {vehAssign.vehicle ? (
                            <div>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', background: '#F8FAFC', padding: '2px 6px', borderRadius: 4, border: '1px solid #CBD5E1' }}>
                                {vehAssign.vehicle.registration_number}
                              </span>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                {vehAssign.vehicle.vehicle_type || 'Lorry'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
                              Not Assigned
                            </span>
                          )}
                        </td>
                      )}

                      {visibleColumns.transportStatus && (
                        <td>
                          <span className={`transport-badge ${transportStatus.badgeClass}`}>
                            {transportStatus.label}
                          </span>
                        </td>
                      )}

                      {visibleColumns.licenceStatus && (
                        <td>
                          <span
                            className={`status-badge-pastel ${
                              licenceStatus.status === 'VALID'
                                ? 'active'
                                : licenceStatus.status === 'EXPIRED'
                                ? 'inactive'
                                : 'pending'
                            }`}
                          >
                            {licenceStatus.label}
                          </span>
                        </td>
                      )}

                      {visibleColumns.verificationStatus && (
                        <td>
                          <span
                            className={`status-badge-pastel ${
                              isDriverApproved ? 'active' : isDriverPending ? 'pending' : isDriverRejected ? 'inactive' : 'draft'
                            }`}
                          >
                            {isDriverApproved ? 'Approved' : isDriverPending ? 'Pending Approval' : isDriverRejected ? 'Rejected' : driver.status}
                          </span>
                        </td>
                      )}

                      {visibleColumns.submissionDate && (
                        <td>
                          {driver.created_at
                            ? new Date(driver.created_at).toLocaleDateString('en-IN')
                            : '—'}
                        </td>
                      )}

                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="driver-action-menu-container" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={`row-action-btn-circle ${menuAnchor?.id === driver.id ? 'active' : ''}`}
                            id={`btn-driver-actions-${driver.id}`}
                            onClick={(e) => handleToggleActionMenu(driver, e)}
                            title="More actions"
                            aria-label={`Actions for driver ${driver.full_name || driver.name}`}
                            aria-expanded={menuAnchor?.id === driver.id}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              border: menuAnchor?.id === driver.id ? '1px solid #F05A22' : '1px solid #CBD5E1',
                              background: menuAnchor?.id === driver.id ? '#FFF5F0' : '#FFFFFF',
                              color: menuAnchor?.id === driver.id ? '#F05A22' : '#334155',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 8. Pagination Row */}
        <div className="pagination-row">
          <div className="pagination-info">
            Showing {sortedDrivers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, sortedDrivers.length)} of {sortedDrivers.length} drivers
          </div>

          <div className="pagination-controls">
            <button
              className="page-nav-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              aria-label="Previous page"
            >
              ‹
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pNum;
              if (totalPages <= 5) {
                pNum = i + 1;
              } else if (currentPage <= 3) {
                pNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pNum = totalPages - 4 + i;
              } else {
                pNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pNum}
                  className={`page-num-btn ${currentPage === pNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pNum)}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              className="page-nav-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              aria-label="Next page"
            >
              ›
            </button>

            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* 9. Task 13: View Driver Details Full-View Side Drawer */}
      {selectedDrawerDriver && (
        <DriverDetailsDrawer
          isOpen={Boolean(selectedDrawerDriver)}
          driver={selectedDrawerDriver}
          vendorName={getVendorInfo(selectedDrawerDriver).name}
          vendorDetails={getVendorInfo(selectedDrawerDriver).details}
          assignedVehicle={getDriverVehicleAssignment(selectedDrawerDriver.id).vehicle}
          activeTrip={getDriverVehicleAssignment(selectedDrawerDriver.id).trip}
          onClose={() => setSelectedDrawerDriver(null)}
          onEditDriver={(d) => {
            setEditingDriver(d);
            setEditFormData({
              fullName: d.full_name || '',
              mobile: d.mobile || d.phone || '',
              dateOfBirth: d.date_of_birth || d.dob || '',
              licenceNumber: d.licence_number || '',
              licenceExpiryDate: d.licence_expiry_date || '',
              primaryVendorId: d.primary_vendor_id || '',
              address: d.address || '',
              city: d.city || '',
              state: d.state || '',
              emergencyContactName: d.emergency_contact_name || '',
              emergencyContactPhone: d.emergency_contact_phone || '',
            });
          }}
          onAssignVehicle={(d) => {
            setAssigningVehicleDriver(d);
            const curr = getDriverVehicleAssignment(d.id);
            setSelectedVehicleToAssign(curr.vehicle?.id || '');
          }}
          onUpdateTransportStatus={(d) => {
            setStatusUpdatingDriver(d);
            const vehAssign = getDriverVehicleAssignment(d.id);
            const tStatus = getDriverTransportStatus(d, vehAssign.trip);
            setSelectedTransportStatus(tStatus.key);
          }}
          onApproveDriver={handleApproveDriver}
          onRejectDriver={handleRejectDriver}
          onRefreshData={loadData}
          onNavigateToVendorProfile={onNavigateToVendorProfile}
        />
      )}

      {/* 10. Driver Licence Audit Modal */}
      {isAuditModalOpen && selectedAuditDriver && (
        <DriverLicenceAudit
          driver={selectedAuditDriver}
          vendorName={getVendorInfo(selectedAuditDriver).name}
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setSelectedAuditDriver(null);
          }}
          onVerificationComplete={(updated) => {
            setDrivers((prev) =>
              prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
            );
            loadData();
            showToast(`Driver ${updated.full_name} status updated to ${updated.status}`);
          }}
        />
      )}

      {/* Driver Floating Three-Dot Action Menu */}
      {menuAnchor && (() => {
        const driver = drivers.find((d) => d.id === menuAnchor.id);
        if (!driver) return null;

        const isDriverApproved = driver.status === 'APPROVED' || driver.verification_status === 'APPROVED';
        const isDriverRejected = driver.status === 'REJECTED' || driver.verification_status === 'REJECTED';

        return (
          <div
            className="driver-action-menu-dropdown"
            style={{
              position: 'fixed',
              top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
              bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
              right: `${menuAnchor.right}px`,
              zIndex: 99999,
              width: '235px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.20), 0 8px 10px -6px rgba(15, 23, 42, 0.10)',
              padding: '6px 0',
              textAlign: 'left',
            }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. View Driver Details */}
            <button
              type="button"
              className="driver-menu-item"
              id={`btn-view-driver-details-${driver.id}`}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setSelectedDrawerDriver(driver);
              }}
            >
              <Eye size={15} color="#0284C7" />
              <span>View Driver Details</span>
            </button>

            {/* 2. View Documents */}
            <button
              type="button"
              className="driver-menu-item"
              id={`btn-audit-driver-${driver.id}`}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setSelectedAuditDriver(driver);
                setIsAuditModalOpen(true);
                if (onAuditDriver) onAuditDriver(driver.id);
              }}
            >
              <FileCheck size={15} color="#F05A22" />
              <span>View Documents</span>
            </button>

            {/* 3. Verify / Approve Driver (Only when not approved) */}
            {canApprove && !isDriverApproved && (
              <button
                type="button"
                className="driver-menu-item"
                id={`btn-approve-driver-${driver.id}`}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setApprovingDriver(driver);
                }}
              >
                <ShieldCheck size={15} color="#16A34A" />
                <span style={{ color: '#16A34A', fontWeight: 600 }}>Verify / Approve Driver</span>
              </button>
            )}

            {/* 4. Reject Verification (Only when not rejected) */}
            {canApprove && !isDriverRejected && (
              <button
                type="button"
                className="driver-menu-item"
                id={`btn-reject-driver-${driver.id}`}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setRejectingDriver(driver);
                  setRejectionReasonText('');
                  setRejectionReasonError('');
                }}
              >
                <ShieldAlert size={15} color="#DC2626" />
                <span style={{ color: '#DC2626' }}>Reject Verification</span>
              </button>
            )}

            {/* 5. Assign / Change Vehicle */}
            <button
              type="button"
              className="driver-menu-item"
              id={`btn-assign-vehicle-${driver.id}`}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setAssigningVehicleDriver(driver);
                const curr = getDriverVehicleAssignment(driver.id);
                setSelectedVehicleToAssign(curr.vehicle?.id || '');
              }}
            >
              <Truck size={15} color="#475569" />
              <span>Assign / Change Vehicle</span>
            </button>

            {/* 6. Update Transport Availability */}
            <button
              type="button"
              className="driver-menu-item"
              id={`btn-transport-status-${driver.id}`}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setStatusUpdatingDriver(driver);
                const vehAssign = getDriverVehicleAssignment(driver.id);
                const tStatus = getDriverTransportStatus(driver, vehAssign.trip);
                setSelectedTransportStatus(tStatus.key);
              }}
            >
              <SlidersHorizontal size={15} color="#475569" />
              <span>Update Availability</span>
            </button>

            {/* 7. Edit Driver Details */}
            {canEdit && (
              <button
                type="button"
                className="driver-menu-item"
                id={`btn-edit-driver-${driver.id}`}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setEditingDriver(driver);
                  setEditFormData({
                    fullName: driver.full_name || '',
                    mobile: driver.mobile || driver.phone || '',
                    dateOfBirth: driver.date_of_birth || driver.dob || '',
                    licenceNumber: driver.licence_number || '',
                    licenceExpiryDate: driver.licence_expiry_date || '',
                    primaryVendorId: driver.primary_vendor_id || '',
                    address: driver.address || '',
                    city: driver.city || '',
                    state: driver.state || '',
                    emergencyContactName: driver.emergency_contact_name || '',
                    emergencyContactPhone: driver.emergency_contact_phone || '',
                  });
                }}
              >
                <Edit2 size={15} color="#475569" />
                <span>Edit Driver Details</span>
              </button>
            )}

            {/* Divider before destructive action */}
            {canDelete && <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />}

            {/* 8. Delete Driver */}
            {canDelete && (
              <button
                type="button"
                className="driver-menu-item danger"
                id={`btn-delete-driver-${driver.id}`}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setDeletingDriver(driver);
                }}
              >
                <Trash2 size={15} color="#DC2626" />
                <span style={{ color: '#DC2626' }}>Delete Driver</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Approve Driver Confirmation Modal */}
      {approvingDriver && (
        <div className="client-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="client-modal-container" style={{ maxWidth: '480px' }}>
            <div className="client-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={20} color="#16A34A" />
                </div>
                <div>
                  <h3 className="client-modal-title">Approve Driver Verification</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Grant active commercial status for dispatch allocations
                  </p>
                </div>
              </div>
              <button className="client-modal-close" onClick={() => setApprovingDriver(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: getAvatarColor(approvingDriver.full_name || 'DR'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {getInitials(approvingDriver.full_name)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{approvingDriver.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                      {formatDisplayId('DR', approvingDriver.driver_code || approvingDriver.id, approvingDriver.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Licence No: </span>
                    <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{approvingDriver.licence_number || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Connected Vendor: </span>
                    <strong style={{ color: '#0F172A' }}>{getVendorInfo(approvingDriver).name}</strong>
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                Are you sure you want to verify and approve this commercial driver? This will verify their driving credentials, grant active status on THE TRUCKX network, and allow transport allocations.
              </p>
            </div>

            <div className="client-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setApprovingDriver(null)}
                disabled={isApprovingDriver}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                disabled={isApprovingDriver}
                onClick={async () => {
                  setIsApprovingDriver(true);
                  try {
                    await handleApproveDriver(approvingDriver);
                    setApprovingDriver(null);
                  } finally {
                    setIsApprovingDriver(false);
                  }
                }}
                style={{ background: '#16A34A', borderColor: '#16A34A' }}
              >
                {isApprovingDriver ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Driver Verification Modal */}
      {rejectingDriver && (
        <div className="client-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="client-modal-container" style={{ maxWidth: '480px' }}>
            <div className="client-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldAlert size={20} color="#DC2626" />
                </div>
                <div>
                  <h3 className="client-modal-title">Reject Driver Verification</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Provide a clear reason for the rejection
                  </p>
                </div>
              </div>
              <button className="client-modal-close" onClick={() => setRejectingDriver(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: getAvatarColor(rejectingDriver.full_name || 'DR'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {getInitials(rejectingDriver.full_name)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{rejectingDriver.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                      {formatDisplayId('DR', rejectingDriver.driver_code || rejectingDriver.id, rejectingDriver.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-field-group">
                <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  Rejection Reason <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  className="client-field-input"
                  placeholder="Please specify why this driver verification is rejected (e.g., Expired licence copy, illegible Aadhaar card, invalid commercial endorsement)..."
                  value={rejectionReasonText}
                  onChange={(e) => {
                    setRejectionReasonText(e.target.value);
                    if (e.target.value.trim()) setRejectionReasonError('');
                  }}
                  style={{ borderColor: rejectionReasonError ? '#DC2626' : undefined }}
                />
                {rejectionReasonError && (
                  <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
                    {rejectionReasonError}
                  </div>
                )}
              </div>
            </div>

            <div className="client-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setRejectingDriver(null)}
                disabled={isRejectingDriver}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                disabled={isRejectingDriver}
                onClick={async () => {
                  if (!rejectionReasonText.trim()) {
                    setRejectionReasonError('Please provide a reason before rejecting the driver.');
                    return;
                  }
                  setIsRejectingDriver(true);
                  try {
                    await handleRejectDriver(rejectingDriver, rejectionReasonText.trim());
                    setRejectingDriver(null);
                  } finally {
                    setIsRejectingDriver(false);
                  }
                }}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
              >
                {isRejectingDriver ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Tasks 10 & 11: Assign / Change / Remove Vehicle Modal */}
      {assigningVehicleDriver && (
        <div className="client-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="client-modal-container" style={{ maxWidth: '540px' }}>
            <div className="client-modal-header">
              <div>
                <h3 className="client-modal-title">Assign / Change Vehicle</h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Assign an eligible verified fleet vehicle to driver {assigningVehicleDriver.full_name}.
                </p>
              </div>
              <button
                className="client-modal-close"
                onClick={() => setAssigningVehicleDriver(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignVehicle}>
              <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Driver & Vendor Summary Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Driver:</span>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>{assigningVehicleDriver.full_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Connected Vendor:</span>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>{getVendorInfo(assigningVehicleDriver).name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Current Assignment:</span>
                    <strong style={{ fontSize: 13, color: '#0F172A', fontFamily: 'monospace' }}>
                      {getDriverVehicleAssignment(assigningVehicleDriver.id).vehicle?.registration_number || 'None (Unassigned)'}
                    </strong>
                  </div>
                </div>

                {/* Eligible Vehicles Dropdown */}
                <div className="form-field-group">
                  <label className="field-label-req">Select Eligible Fleet Vehicle *</label>
                  <select
                    required
                    className="client-field-input"
                    value={selectedVehicleToAssign}
                    onChange={(e) => setSelectedVehicleToAssign(e.target.value)}
                  >
                    <option value="">-- Choose Vehicle from Fleet --</option>
                    {(() => {
                      const vendorLinks = vendorVehicleLinks.filter(
                        (l) => l.vendor_id === assigningVehicleDriver.primary_vendor_id
                      );
                      const vendorVehIds = vendorLinks.map((l) => l.vehicle_id);
                      const eligibleList = vehicles.filter((v) => vendorVehIds.includes(v.id) || v.id === selectedVehicleToAssign);

                      if (eligibleList.length === 0) {
                        return <option disabled value="">No fleet vehicles registered for this vendor</option>;
                      }

                      return eligibleList.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration_number} ({v.vehicle_type || 'Lorry'} - {v.body_type || 'Open'} - {v.rated_capacity_mt || 'Standard'} MT)
                        </option>
                      ));
                    })()}
                  </select>
                  {vendorVehicleLinks.filter((l) => l.vendor_id === assigningVehicleDriver.primary_vendor_id).length === 0 && (
                    <span style={{ fontSize: '11.5px', color: '#D97706', marginTop: 4 }}>
                      ⚠️ No fleet vehicles linked to this transporter. Register vehicles under this vendor first.
                    </span>
                  )}
                </div>

                {/* Remove vehicle button if currently assigned */}
                {getDriverVehicleAssignment(assigningVehicleDriver.id).vehicle && (
                  <div style={{ paddingTop: 6, borderTop: '1px dashed #CBD5E1' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicleAssignment(assigningVehicleDriver)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#DC2626',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove current vehicle assignment (Set as Unassigned)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="client-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setAssigningVehicleDriver(null)}
                  disabled={isAssigningVehicle}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isAssigningVehicle || !selectedVehicleToAssign}
                >
                  {isAssigningVehicle ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. Task 12: Transport Status Management Modal */}
      {statusUpdatingDriver && (
        <div className="client-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="client-modal-container" style={{ maxWidth: '480px' }}>
            <div className="client-modal-header">
              <div>
                <h3 className="client-modal-title">Update Transport Availability</h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Manage dispatch readiness status for {statusUpdatingDriver.full_name}.
                </p>
              </div>
              <button
                className="client-modal-close"
                onClick={() => setStatusUpdatingDriver(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmTransportStatus}>
              <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'AVAILABLE', label: 'Available for Transport', desc: 'Driver is healthy, certified, and ready for dispatch.' },
                    { key: 'NOT_TAKING_TRANSPORT', label: 'Not Taking Up for Transport', desc: 'Driver has requested temporary leave or is off duty.' },
                    { key: 'TEMP_UNAVAILABLE', label: 'Temporarily Unavailable', desc: 'Medical check, licence renewal, or vehicle maintenance.' },
                    { key: 'INACTIVE', label: 'Inactive / Suspended', desc: 'Disable driver profile from transport dispatch roster.' },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: selectedTransportStatus === opt.key ? '1px solid #F05A22' : '1px solid #E2E8F0',
                        background: selectedTransportStatus === opt.key ? '#FFF8F5' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="transportStatus"
                        value={opt.key}
                        checked={selectedTransportStatus === opt.key}
                        onChange={(e) => setSelectedTransportStatus(e.target.value)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{opt.label}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Status Notes / Reason (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className="client-field-input"
                    placeholder="e.g. Leave request until 5 Nov, awaiting fitness certificate..."
                    value={transportStatusNote}
                    onChange={(e) => setTransportStatusNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="client-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setStatusUpdatingDriver(null)}
                  disabled={isUpdatingTransportStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isUpdatingTransportStatus}
                >
                  {isUpdatingTransportStatus ? 'Updating...' : 'Save Availability'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 13. Task 14: Edit Driver Particulars Modal */}
      {editingDriver && (
        <div className="client-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="client-modal-container" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="client-modal-header">
              <div>
                <h3 className="client-modal-title">Edit Driver Profile</h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Update profile particulars and connected vendor for {editingDriver.full_name}.
                </p>
              </div>
              <button
                className="client-modal-close"
                onClick={() => setEditingDriver(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmEditDriver}>
              <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {editErrors.global && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#B91C1C', fontSize: '13px' }}>
                    {editErrors.global}
                  </div>
                )}

                <div className="form-field-group">
                  <label className="field-label-req">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="client-field-input"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  />
                  {editErrors.fullName && <div className="field-error-text">{editErrors.fullName}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">Mobile Number *</label>
                  <div className="phone-input-group">
                    <span className="country-code-pill">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      className="client-field-input"
                      value={editFormData.mobile}
                      onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  {editErrors.mobile && <div className="field-error-text">{editErrors.mobile}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-field-group">
                    <label className="field-label-req">Date of Birth</label>
                    <input
                      type="date"
                      className="client-field-input"
                      value={editFormData.dateOfBirth}
                      onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="field-label-req">DL Number *</label>
                    <input
                      type="text"
                      required
                      className="client-field-input"
                      value={editFormData.licenceNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, licenceNumber: e.target.value.toUpperCase() })}
                    />
                    {editErrors.licenceNumber && <div className="field-error-text">{editErrors.licenceNumber}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-field-group">
                    <label className="field-label-req">Licence Expiry Date</label>
                    <input
                      type="date"
                      className="client-field-input"
                      value={editFormData.licenceExpiryDate}
                      onChange={(e) => setEditFormData({ ...editFormData, licenceExpiryDate: e.target.value })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="field-label-req">Connected Transporter</label>
                    <select
                      className="client-field-input"
                      value={editFormData.primaryVendorId}
                      onChange={(e) => setEditFormData({ ...editFormData, primaryVendorId: e.target.value })}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendor_name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    Residential Address
                  </label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="House/Plot, Street, Area"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-field-group">
                    <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>City</label>
                    <input
                      type="text"
                      className="client-field-input"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>State</label>
                    <input
                      type="text"
                      className="client-field-input"
                      value={editFormData.state}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-field-group">
                    <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Emergency Contact Name</label>
                    <input
                      type="text"
                      className="client-field-input"
                      placeholder="e.g. S. Barman (Brother)"
                      value={editFormData.emergencyContactName}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label-opt" style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Emergency Phone</label>
                    <input
                      type="tel"
                      className="client-field-input"
                      placeholder="9876543210"
                      value={editFormData.emergencyContactPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="client-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setEditingDriver(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 14. Task 15: Create Driver Account Modal (No Email Address Field) */}
      {isCreateModalOpen && (
        <div className="client-modal-overlay">
          <div className="client-modal-container" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="client-modal-header">
              <div>
                <h3 className="client-modal-title">Create Driver Account</h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Register a verified commercial driver and assign connected vendor association.
                </p>
              </div>
              <button
                className="client-modal-close"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateErrors({});
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDriverSubmit}>
              <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {createErrors.global && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#B91C1C', fontSize: '13px' }}>
                    {createErrors.global}
                  </div>
                )}

                {/* Full Name */}
                <div className="form-field-group">
                  <label className="field-label-req">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    className="client-field-input"
                    placeholder="e.g. Gurpreet Singh"
                    value={createFormData.fullName}
                    onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                  />
                  {createErrors.fullName && <div className="field-error-text">{createErrors.fullName}</div>}
                </div>

                {/* Mobile Number */}
                <div className="form-field-group">
                  <label className="field-label-req">Mobile Phone Number *</label>
                  <div className="phone-input-group">
                    <span className="country-code-pill">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      className="client-field-input"
                      placeholder="9876543210"
                      value={createFormData.mobile}
                      onChange={(e) => setCreateFormData({ ...createFormData, mobile: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  {createErrors.mobile && <div className="field-error-text">{createErrors.mobile}</div>}
                </div>

                {/* Date of Birth */}
                <div className="form-field-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="field-label-req" style={{ margin: 0 }}>Date of Birth *</label>
                    {createFormData.dateOfBirth && (() => {
                      const aInfo = calculateAge(createFormData.dateOfBirth);
                      return aInfo.text ? (
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: aInfo.isEligible ? '#DCFCE7' : '#FEE2E2',
                          color: aInfo.isEligible ? '#166534' : '#991B1B',
                          border: aInfo.isEligible ? '1px solid #BBF7D0' : '1px solid #FECACA',
                        }}>
                          {aInfo.text}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <input
                    type="date"
                    required
                    className="client-field-input"
                    value={createFormData.dateOfBirth}
                    onChange={(e) => setCreateFormData({ ...createFormData, dateOfBirth: e.target.value })}
                  />
                  {createErrors.dateOfBirth && <div className="field-error-text">{createErrors.dateOfBirth}</div>}
                </div>

                {/* Driving Licence Number */}
                <div className="form-field-group">
                  <label className="field-label-req">Driving Licence (DL) Number *</label>
                  <input
                    type="text"
                    required
                    className="client-field-input"
                    placeholder="e.g. DL-0420220019284"
                    value={createFormData.licenceNumber}
                    onChange={(e) => setCreateFormData({ ...createFormData, licenceNumber: e.target.value.toUpperCase() })}
                  />
                  {createErrors.licenceNumber && <div className="field-error-text">{createErrors.licenceNumber}</div>}
                </div>

                {/* Connected Vendor */}
                <div className="form-field-group">
                  <label className="field-label-req">Connected Fleet Vendor *</label>
                  <select
                    required
                    className="client-field-input"
                    value={createFormData.primaryVendorId}
                    onChange={(e) => setCreateFormData({ ...createFormData, primaryVendorId: e.target.value })}
                  >
                    <option value="">-- Choose Connected Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendor_name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                      </option>
                    ))}
                  </select>
                  {createErrors.primaryVendorId && <div className="field-error-text">{createErrors.primaryVendorId}</div>}
                </div>

                {/* Optional Vehicle Assignment */}
                {createFormData.primaryVendorId && (
                  <div className="form-field-group">
                    <label className="field-label-opt" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Assign Vehicle (Optional)
                    </label>
                    <select
                      className="client-field-input"
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                    >
                      <option value="">-- No vehicle assigned (Unassigned) --</option>
                      {vendorVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration_number} ({v.vehicle_type || 'Vehicle'}{v.body_type ? ` - ${v.body_type}` : ''}{v.rated_capacity_mt ? ` - ${v.rated_capacity_mt} MT` : ''})
                        </option>
                      ))}
                    </select>
                    {vendorVehicles.length === 0 && (
                      <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        No fleet vehicles registered for this vendor yet.
                      </span>
                    )}
                  </div>
                )}

                {/* Document Uploads */}
                <div style={{ marginTop: '6px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                    Document Uploads (DL & Aadhaar Card)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* DL Front */}
                    <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                        DL — Front Side
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        style={{ fontSize: '11px', width: '100%' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setDriverDocFiles((prev) => ({ ...prev, dlFront: file }));
                        }}
                      />
                      {driverDocFiles.dlFront && (
                        <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 500 }}>
                          ✓ {driverDocFiles.dlFront.name}
                        </div>
                      )}
                    </div>

                    {/* DL Back */}
                    <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                        DL — Back Side
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        style={{ fontSize: '11px', width: '100%' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setDriverDocFiles((prev) => ({ ...prev, dlBack: file }));
                        }}
                      />
                      {driverDocFiles.dlBack && (
                        <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 500 }}>
                          ✓ {driverDocFiles.dlBack.name}
                        </div>
                      )}
                    </div>

                    {/* Aadhaar Front */}
                    <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                        Aadhaar — Front Side
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        style={{ fontSize: '11px', width: '100%' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setDriverDocFiles((prev) => ({ ...prev, aadhaarFront: file }));
                        }}
                      />
                      {driverDocFiles.aadhaarFront && (
                        <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 500 }}>
                          ✓ {driverDocFiles.aadhaarFront.name}
                        </div>
                      )}
                    </div>

                    {/* Aadhaar Back */}
                    <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', marginBottom: '6px' }}>
                        Aadhaar — Back Side
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        style={{ fontSize: '11px', width: '100%' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setDriverDocFiles((prev) => ({ ...prev, aadhaarBack: file }));
                        }}
                      />
                      {driverDocFiles.aadhaarBack && (
                        <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 500 }}>
                          ✓ {driverDocFiles.aadhaarBack.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="form-field-group">
                  <label className="field-label-req">Initial Account Status</label>
                  <select
                    className="client-field-input"
                    value={createFormData.status}
                    onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value })}
                  >
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved (Active)</option>
                  </select>
                </div>
              </div>

              <div className="client-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateErrors({});
                  }}
                  disabled={isCreatingDriver}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isCreatingDriver}
                >
                  {isCreatingDriver ? 'Creating...' : 'Create Driver Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 15. Permanent Delete Driver Confirmation Dialog */}
      {deletingDriver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => !deleteLoading && setDeletingDriver(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                  Permanently Delete Driver?
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#991B1B',
                lineHeight: 1.5,
              }}
            >
              You are about to permanently delete driver <strong>{deletingDriver.full_name || deletingDriver.name}</strong> (
              {deletingDriver.mobile_number || deletingDriver.mobile || 'No phone'}).
              <br />
              All licence records, vendor links, uploaded documents, trip records, and mobile authentication credentials will be wiped from the database.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Reason for Deletion (Optional)
              </label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate account, requested by driver..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeletingDriver(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  background: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteDriver}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#fff',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
