import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Search,
  Filter,
  RotateCcw,
  Download,
  Plus,
  Eye,
  Edit,
  MoreVertical,
  X,
  RefreshCw,
  AlertTriangle,
  Upload,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Truck,
  FileText,
  Copy,
  Smartphone,
  Layers,
  Trash2,
  Bookmark,
  Save,
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDisplayId, generateDbNeclId } from '../../utils/idGenerator';
import { pincodeService } from '../../services/pincodeService';
import { EditVendorModal } from './EditVendorModal';
import { apiFetch } from '../../utils/api';
import { draftService, AdminRegistrationDraft } from '../../services/draftService';
import { optimizeFileForUpload } from '../../utils/fileCompressor';

export interface VendorCompany {
  id: string;
  vendor_code?: string | null;
  vendor_name: string;
  pan?: string | null;
  gstin?: string | null;
  address?: string | null;
  status: 'APPROVED' | 'PENDING' | 'PENDING_APPROVAL' | 'REJECTED' | 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';
  onboarding_source?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  vendor_type?: string;
  services?: string[];
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_designation?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface VendorUser {
  id: string;
  vendor_id: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  status?: string;
  created_at?: string;
}

interface VendorDirectoryProps {
  onNavigateToInvite: (draftId?: string) => void;
  onNavigateToProfile: (id: string) => void;
  initialTab?: 'all' | 'verified' | 'pending' | 'rejected' | 'inactive' | 'drafts';
}

const DEFAULT_INDIAN_LOCATIONS = [
  'Guwahati', 'Kolkata', 'Delhi', 'Mumbai', 'Hyderabad',
  'Bengaluru', 'Chennai', 'Dispur', 'Siliguri', 'Dibrugarh', 'Jorhat', 'Nagpur', 'Visakhapatnam'
];

const VENDOR_TYPES = [
  'Fleet Owner',
  'Transporter',
  'Broker / Agent',
  '3PL / Logistics Partner'
];

const SERVICES_OPTIONS = [
  'FTL',
  'PTL',
  'Container',
  'Project Cargo',
  'Cold Chain'
];

function getAvatarColor(name: string) {
  const colors = [
    '#F05A22', '#2563EB', '#16A34A', '#7C3AED',
    '#D97706', '#0891B2', '#E11D48', '#4F46E5'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  if (!name) return 'VN';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatVendorCode(id: string, createdAt?: string, vendorCode?: string | null) {
  if (vendorCode) return formatDisplayId('VD', vendorCode, createdAt);
  return formatDisplayId('VD', id, createdAt);
}

function formatLocationLines(city?: string, state?: string, pincode?: string, address?: string) {
  let line1 = '';
  let line2 = '';

  if (city && state) {
    line1 = `${city},`;
    line2 = pincode ? `${state} - ${pincode}` : state;
  } else if (address) {
    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      line1 = parts[0] + ',';
      line2 = parts.slice(1).join(', ');
    } else {
      line1 = address;
      line2 = state ? (pincode ? `${state} - ${pincode}` : state) : '';
    }
  } else {
    line1 = city ? `${city},` : 'Guwahati,';
    line2 = state ? `${state} - ${pincode || '781014'}` : 'Assam - 781014';
  }
  return { line1, line2 };
}

function formatLastActivity(dateStr?: string) {
  if (!dateStr) return { date: '—', time: '' };
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  } catch {
    return { date: '—', time: '' };
  }
}

export const VendorDirectory: React.FC<VendorDirectoryProps> = ({
  onNavigateToInvite,
  onNavigateToProfile,
  initialTab = 'all',
}) => {
  const { hasPermission, adminProfile } = useAuth();
  const canCreate = hasPermission('vendors', 'create');
  const canApprove = hasPermission('vendors', 'approve');
  const canReject = hasPermission('vendors', 'reject');
  const canExport = hasPermission('vendors', 'export');
  const canDelete = hasPermission('vendors', 'delete') || adminProfile?.role === 'SUPER_ADMIN' || adminProfile?.role === 'ADMIN';

  // Delete User state
  const [deletingVendor, setDeletingVendor] = useState<VendorCompany | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const handleConfirmDeleteVendor = async () => {
    if (!deletingVendor) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch('/admin/delete-user', {
        method: 'POST',
        body: JSON.stringify({
          companyId: deletingVendor.id,
          mobile: deletingVendor.contact_phone,
          role: 'VENDOR',
          reason: deleteReason || 'Deleted by Administrator from Vendor Directory',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete vendor account');
      }
      setVendors((prev) => prev.filter((v) => v.id !== deletingVendor.id));
      showToast(`Vendor "${deletingVendor.vendor_name}" and all associated data permanently deleted.`);
      setDeletingVendor(null);
      setDeleteReason('');
    } catch (err: any) {
      console.error('Delete vendor error:', err);
      alert(`Error deleting vendor: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Core Data
  const [vendors, setVendors] = useState<VendorCompany[]>([]);
  const [vendorUsers, setVendorUsers] = useState<VendorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Database Counts
  const [counts, setCounts] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    inactive: 0,
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'inactive' | 'drafts'>(initialTab);

  // Sorting
  const [sortField, setSortField] = useState<'vendor_name' | 'id' | 'location' | 'status' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Dropdown Menus & Modals
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top?: number;
    bottom?: number;
    right: number;
    isDropup: boolean;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showEditVendorModal, setShowEditVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorCompany | null>(null);

  const handleToggleActionMenu = (vendor: VendorCompany, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor?.id === vendor.id) {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isDropup = spaceBelow < menuHeight + 20;

    setOpenActionMenuId(vendor.id);
    setMenuAnchor({
      id: vendor.id,
      top: isDropup ? undefined : rect.bottom + 6,
      bottom: isDropup ? window.innerHeight - rect.top + 6 : undefined,
      right: Math.max(16, window.innerWidth - rect.right),
      isDropup,
    });
  };

  const handleCopyVendorId = (e: React.MouseEvent, idText: string) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(idText);
      setCopiedId(idText);
      showToast(`Copied Vendor ID: ${idText}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast(`Vendor ID: ${idText}`);
    }
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmStyle?: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
  } | null>(null);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    vendorId: true,
    vendorType: true,
    contactPerson: true,
    location: true,
    gstin: true,
    panNumber: true,
    services: true,
    verificationStatus: true,
    accountStatus: true,
    lastActivity: true,
  });

  const columnMenuRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Vendor Drafts State
  const [drafts, setDrafts] = useState<AdminRegistrationDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<AdminRegistrationDraft | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const data = await draftService.getDrafts('VENDOR');
      setDrafts(data);
    } catch (err: any) {
      console.warn('Failed to fetch vendor drafts:', err);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const handleDeleteDraft = async (draftId: string) => {
    setIsDeletingDraft(true);
    try {
      await draftService.deleteDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      showToast('Vendor draft deleted successfully.');
      setDraftToDelete(null);
    } catch (err: any) {
      console.error('Delete vendor draft failed:', err);
      showToast(err.message || 'Failed to delete vendor draft.');
    } finally {
      setIsDeletingDraft(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Click outside to close column dropdown & action menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnSettings(false);
      }
      if (menuAnchor && !(event.target as HTMLElement).closest('.action-menu-container') && !(event.target as HTMLElement).closest('.vendor-action-menu-dropdown')) {
        setOpenActionMenuId(null);
        setMenuAnchor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Fetch Vendors and Users from Supabase
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAdminSession();
      const { data: compData, error: compErr } = await supabase
        .from('vendor_companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (compErr) throw compErr;

      // Fetch primary contacts
      const { data: usersData, error: usersErr } = await supabase
        .from('vendor_users')
        .select('*');

      if (usersErr) {
        console.warn('vendor_users fetch warning:', usersErr.message);
      }

      const rawCompanies: any[] = compData || [];
      const rawUsers: VendorUser[] = usersData || [];

      // Link contacts and parse locations
      const enriched: VendorCompany[] = rawCompanies.map((c) => {
        const primaryUser = rawUsers.find((u) => u.vendor_id === c.id);
        const address = c.address || '';
        const parts = address.split(',').map((s: string) => s.trim()).filter(Boolean);
        let city = '';
        let state = '';
        if (parts.length >= 2) {
          city = parts[parts.length - 2];
          state = parts[parts.length - 1];
        } else if (parts.length === 1) {
          city = parts[0];
        }

        return {
          ...c,
          contact_name: primaryUser?.full_name || 'Primary Contact',
          contact_email: primaryUser?.email || '',
          contact_phone: primaryUser?.mobile || '',
          city: city || (address ? address.split(',')[0].trim() : '—'),
          state: state || '—',
          vendor_type: c.vendor_type || 'Fleet Owner',
          services: c.services || ['FTL', 'Container'],
        };
      });

      setVendors(enriched);
      setVendorUsers(rawUsers);

      // Exact database counts - separate verification status from account status
      const totalCount = enriched.length;
      const verifiedCount = enriched.filter((v) => v.status === 'APPROVED').length;
      const pendingCount = enriched.filter((v) => v.status === 'PENDING' || v.status === 'PENDING_APPROVAL').length;
      const inactiveCount = enriched.filter((v) => v.status === 'INACTIVE' || v.status === 'REJECTED' || v.status === 'SUSPENDED').length;

      setCounts({
        total: totalCount,
        verified: verifiedCount,
        pending: pendingCount,
        inactive: inactiveCount,
      });
    } catch (err: any) {
      console.warn('Vendor database query error:', err.message);
      setError(err.message || 'Failed to load vendor records');
      setVendors([]);
      setCounts({ total: 0, verified: 0, pending: 0, inactive: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();

    // Realtime channel
    const channel = supabase
      .channel('vendor_directory_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_companies' },
        (payload) => {
          console.log('[VendorDirectory Realtime] vendor_companies change:', payload.eventType);
          loadVendors();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_users' },
        (payload) => {
          console.log('[VendorDirectory Realtime] vendor_users change:', payload.eventType);
          loadVendors();
        }
      )
      .subscribe((status) => {
        console.log('[VendorDirectory Realtime] Channel status:', status);
      });

    // Periodic sync fallback
    const pollInterval = setInterval(() => {
      loadVendors();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadVendors]);

  // Dynamic Cities from loaded vendor addresses
  const cities = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.city) set.add(v.city);
    });
    DEFAULT_INDIAN_LOCATIONS.forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [vendors]);

  // Filtering Logic
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      // 1. Status Tabs
      if (activeTab === 'verified' && v.status !== 'APPROVED' && v.status !== 'ACTIVE') return false;
      if (activeTab === 'pending' && v.status !== 'PENDING' && v.status !== 'PENDING_APPROVAL') return false;
      if (activeTab === 'inactive' && v.status !== 'INACTIVE' && v.status !== 'REJECTED' && v.status !== 'SUSPENDED') return false;

      // 2. Account Status Filter Dropdown
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && v.status !== 'APPROVED' && v.status !== 'ACTIVE') return false;
        if (statusFilter === 'pending' && v.status !== 'PENDING' && v.status !== 'PENDING_APPROVAL') return false;
        if (statusFilter === 'inactive' && v.status !== 'INACTIVE') return false;
        if (statusFilter === 'rejected' && v.status !== 'REJECTED') return false;
      }

      // 3. Vendor Type Filter
      if (vendorTypeFilter !== 'all' && v.vendor_type?.toLowerCase() !== vendorTypeFilter.toLowerCase()) {
        return false;
      }

      // 4. Location Filter
      if (locationFilter !== 'all') {
        const matchesCity = v.city?.toLowerCase() === locationFilter.toLowerCase();
        const matchesAddress = v.address?.toLowerCase().includes(locationFilter.toLowerCase());
        if (!matchesCity && !matchesAddress) return false;
      }

      // 5. Service Filter
      if (serviceFilter !== 'all') {
        const hasService = v.services?.some((s) => s.toLowerCase() === serviceFilter.toLowerCase());
        if (!hasService) return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vendorCode = formatVendorCode(v.id, v.created_at, v.vendor_code).toLowerCase();
        const matchName = v.vendor_name?.toLowerCase().includes(q);
        const matchGst = v.gstin?.toLowerCase().includes(q);
        const matchPan = v.pan?.toLowerCase().includes(q);
        const matchContact = v.contact_name?.toLowerCase().includes(q);
        const matchPhone = v.contact_phone?.toLowerCase().includes(q);
        const matchLocation = v.address?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q);
        const matchCode = vendorCode.includes(q) || v.id.toLowerCase().includes(q);

        if (!matchName && !matchGst && !matchPan && !matchContact && !matchPhone && !matchLocation && !matchCode) {
          return false;
        }
      }

      return true;
    });
  }, [vendors, activeTab, statusFilter, vendorTypeFilter, locationFilter, serviceFilter, searchQuery]);

  // Sorting Logic
  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'location') {
        valA = a.city || a.address || '';
        valB = b.city || b.address || '';
      }

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB || '');
        return sortOrder === 'asc' ? comp : -comp;
      }

      return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });
  }, [filteredVendors, sortField, sortOrder]);

  // Pagination Slice
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVendors.slice(start, start + pageSize);
  }, [sortedVendors, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedVendors.length / pageSize) || 1;

  // Handle Sort Change (supports handleSort('vendor_name'), handleSort('id'), handleSort('location'), handleSort('status'), handleSort('created_at'))
  const handleSort = (field: 'vendor_name' | 'id' | 'location' | 'status' | 'created_at') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allCurrentPageIds = new Set(selectedRows);
      paginatedVendors.forEach((v) => allCurrentPageIds.add(v.id));
      setSelectedRows(allCurrentPageIds);
    } else {
      const updated = new Set(selectedRows);
      paginatedVendors.forEach((v) => updated.delete(v.id));
      setSelectedRows(updated);
    }
  };

  const handleSelectRow = (id: string) => {
    const updated = new Set(selectedRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRows(updated);
  };

  const isAllCurrentPageSelected = paginatedVendors.length > 0 && paginatedVendors.every((v) => selectedRows.has(v.id));

  // Reset Filters
  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setVendorTypeFilter('all');
    setLocationFilter('all');
    setServiceFilter('all');
    setActiveTab('all');
    setCurrentPage(1);
    setSelectedRows(new Set());
    showToast('Filters reset to default');
  };

  // Export to CSV
  const handleExport = (exportSelectedOnly: boolean = false) => {
    const targetVendors = exportSelectedOnly
      ? vendors.filter((v) => selectedRows.has(v.id))
      : filteredVendors;

    if (targetVendors.length === 0) {
      showToast('No vendor records to export');
      return;
    }

    const headers = [
      'Vendor ID',
      'Company Legal Name',
      'Vendor Type',
      'Primary Contact',
      'Mobile',
      'Email',
      'City',
      'State',
      'Address',
      'GSTIN',
      'PAN',
      'Services',
      'Verification Status',
      'Account Status',
      'Last Activity',
    ];

    const rows = targetVendors.map((v) => [
      `"${formatVendorCode(v.id, v.created_at, v.vendor_code)}"`,
      `"${(v.vendor_name || '').replace(/"/g, '""')}"`,
      `"${v.vendor_type || 'Fleet Owner'}"`,
      `"${(v.contact_name || '').replace(/"/g, '""')}"`,
      `"${v.contact_phone || ''}"`,
      `"${v.contact_email || ''}"`,
      `"${v.city || ''}"`,
      `"${v.state || ''}"`,
      `"${(v.address || '').replace(/"/g, '""')}"`,
      `"${v.gstin || '—'}"`,
      `"${v.pan || '—'}"`,
      `"${(v.services || []).join('; ')}"`,
      `"${v.status}"`,
      `"${v.status === 'INACTIVE' ? 'Inactive' : 'Active'}"`,
      `"${v.updated_at || v.created_at || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`✅ Exported ${targetVendors.length} vendor records to CSV`);
  };

  // Vendor Action: Verify / Approve
  const handleVerifyVendor = async (vendorId: string, vendorName: string) => {
    try {
      await ensureAdminSession();
      const { error: updateErr } = await supabase
        .from('vendor_companies')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId);

      if (updateErr) throw updateErr;

      showToast(`✅ Vendor "${vendorName}" successfully verified.`);
      loadVendors();
    } catch (err: any) {
      showToast(`❌ Failed to verify vendor: ${err.message}`);
    }
  };

  // Vendor Action: Reject
  const handleRejectVendor = async (vendorId: string, vendorName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reject Vendor Verification',
      message: `Are you sure you want to reject verification for "${vendorName}"?`,
      confirmText: 'Reject Verification',
      confirmStyle: 'danger',
      onConfirm: async () => {
        try {
          await ensureAdminSession();
          const { error: rejErr } = await supabase
            .from('vendor_companies')
            .update({
              status: 'REJECTED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorId);

          if (rejErr) throw rejErr;

          showToast(`Vendor "${vendorName}" marked as Rejected.`);
          loadVendors();
        } catch (err: any) {
          showToast(`❌ Error: ${err.message}`);
        }
      },
    });
  };

  // Vendor Action: Toggle Active / Inactive
  const handleToggleStatus = async (vendorId: string, vendorName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'INACTIVE' ? 'APPROVED' : 'INACTIVE';
    const actionLabel = newStatus === 'APPROVED' ? 'activate' : 'deactivate';

    setConfirmDialog({
      isOpen: true,
      title: `${newStatus === 'APPROVED' ? 'Activate' : 'Deactivate'} Vendor`,
      message: `Are you sure you want to ${actionLabel} "${vendorName}"?`,
      confirmText: newStatus === 'APPROVED' ? 'Activate' : 'Deactivate',
      confirmStyle: newStatus === 'APPROVED' ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await ensureAdminSession();
          const { error: toggleErr } = await supabase
            .from('vendor_companies')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorId);

          if (toggleErr) throw toggleErr;

          showToast(`Vendor "${vendorName}" is now ${newStatus === 'APPROVED' ? 'Active' : 'Inactive'}.`);
          loadVendors();
        } catch (err: any) {
          showToast(`❌ Error: ${err.message}`);
        }
      },
    });
  };

  // Bulk Actions
  const handleBulkActivate = () => {
    const count = selectedRows.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Activate Vendors',
      message: `Are you sure you want to activate ${count} selected vendor(s)?`,
      confirmText: 'Activate Selected',
      confirmStyle: 'success',
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedRows);
          const { error: bulkErr } = await supabase
            .from('vendor_companies')
            .update({
              status: 'APPROVED',
              updated_at: new Date().toISOString(),
            })
            .in('id', ids);

          if (bulkErr) throw bulkErr;

          showToast(`✅ Successfully activated ${count} vendors.`);
          setSelectedRows(new Set());
          loadVendors();
        } catch (err: any) {
          showToast(`❌ Failed bulk activation: ${err.message}`);
        }
      },
    });
  };

  const handleBulkDeactivate = () => {
    const count = selectedRows.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Deactivate Vendors',
      message: `Are you sure you want to deactivate ${count} selected vendor(s)?`,
      confirmText: 'Deactivate Selected',
      confirmStyle: 'danger',
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedRows);
          const { error: bulkErr } = await supabase
            .from('vendor_companies')
            .update({
              status: 'INACTIVE',
              updated_at: new Date().toISOString(),
            })
            .in('id', ids);

          if (bulkErr) throw bulkErr;

          showToast(`Deactivated ${count} vendors.`);
          setSelectedRows(new Set());
          loadVendors();
        } catch (err: any) {
          showToast(`❌ Failed bulk deactivation: ${err.message}`);
        }
      },
    });
  };

  // Active filters count for chips
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || vendorTypeFilter !== 'all' || locationFilter !== 'all' || serviceFilter !== 'all';

  return (
    <div className="vendor-directory-page-wrapper">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="operational-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="client-header-hero">
        <div className="client-header-truck-bg">
          <div className="client-header-truck-overlay" />
        </div>

        <div className="client-header-info">
          <div className="client-header-breadcrumbs">
            <span>Vendors</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Vendor Directory</span>
          </div>
          <h1 className="client-directory-title">Vendor Directory</h1>
          <p className="client-directory-desc">
            Manage logistics partners, fleet owners, transport companies, and vendor verification.
          </p>
        </div>

        <div className="client-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="header-partner-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2-2" />
              <path d="m9 14-2-2a1 1 0 0 1 0-1.4l4.3-4.3a1 1 0 0 1 1.4 0l2 2" />
            </svg>
            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>Reliable Partners</div>
              <div style={{ fontSize: '11px', color: '#CBD5E1' }}>Stronger Deliveries</div>
            </div>
          </div>

          <button
            id="btn-add-vendor"
            className="btn-create-orange"
            onClick={() => {
              if (onNavigateToInvite) {
                onNavigateToInvite();
              } else {
                setShowAddVendorModal(true);
              }
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>+ Add Vendor</span>
          </button>
        </div>
      </div>

      {/* 2. Four Equal-Width Summary KPI Cards (Clean, No Percentages or Sparklines) */}
      <div className="client-kpi-bar">
        {/* Total Vendors */}
        <div
          className={`kpi-stat-card ${activeTab === 'all' && statusFilter === 'all' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('all');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          title="Filter all vendor records"
        >
          <div className="kpi-avatar-squircle orange">
            <Users size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Vendors</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                {loading ? <div className="kpi-bar-skeleton" /> : counts.total}
              </div>
            </div>
            <div className="kpi-sub-text">All registered vendors</div>
          </div>
        </div>

        {/* Verified Vendors */}
        <div
          className={`kpi-stat-card ${activeTab === 'verified' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('verified');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          title="Filter verified vendors"
        >
          <div className="kpi-avatar-squircle green">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Verified Vendors</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                {loading ? <div className="kpi-bar-skeleton" /> : counts.verified}
              </div>
            </div>
            <div className="kpi-sub-text">Document verified</div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('pending');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          title="Filter pending verification"
        >
          <div className="kpi-avatar-squircle amber">
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Pending Review</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                {loading ? <div className="kpi-bar-skeleton" /> : counts.pending}
              </div>
            </div>
            <div className="kpi-sub-text">Awaiting verification</div>
          </div>
        </div>

        {/* Inactive Vendors */}
        <div
          className={`kpi-stat-card ${activeTab === 'inactive' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('inactive');
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          title="Filter inactive vendors"
        >
          <div className="kpi-avatar-squircle red">
            <UserX size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Inactive Vendors</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value-row">
              <div className="kpi-value">
                {loading ? <div className="kpi-bar-skeleton" /> : counts.inactive}
              </div>
            </div>
            <div className="kpi-sub-text">Currently inactive</div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Toolbar */}
      <div className="filters-bar-card">
        <div className="filter-input-wrap">
          <Search size={16} className="filter-search-icon" />
          <input
            id="vendor-search-input"
            type="text"
            placeholder="Search by Vendor ID, vendor name, GSTIN, contact person, phone number, location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setCurrentPage(1);
              }
            }}
            className="filter-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Account Status Filter */}
        <div className="filter-dropdown-wrap">
          <select
            id="filter-account-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Vendor Type Filter */}
        <div className="filter-dropdown-wrap">
          <select
            id="filter-vendor-type"
            value={vendorTypeFilter}
            onChange={(e) => {
              setVendorTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="all">All Vendor Types</option>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Location Filter */}
        <div className="filter-dropdown-wrap">
          <select
            id="filter-vendor-location"
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="all">All Locations</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Services Filter */}
        <div className="filter-dropdown-wrap">
          <select
            id="filter-vendor-services"
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-dropdown"
          >
            <option value="all">All Services</option>
            {SERVICES_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Reset Button */}
        <button id="btn-reset-filters" className="btn-filter-reset" onClick={handleReset} title="Reset all filters">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="active-filters-chips-bar">
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Active Filters:</span>
          {searchQuery && (
            <span className="filter-chip-tag">
              Search: "{searchQuery}"
              <button className="filter-chip-remove-btn" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="filter-chip-tag">
              Status: {statusFilter.toUpperCase()}
              <button className="filter-chip-remove-btn" onClick={() => setStatusFilter('all')}>
                <X size={12} />
              </button>
            </span>
          )}
          {vendorTypeFilter !== 'all' && (
            <span className="filter-chip-tag">
              Type: {vendorTypeFilter}
              <button className="filter-chip-remove-btn" onClick={() => setVendorTypeFilter('all')}>
                <X size={12} />
              </button>
            </span>
          )}
          {locationFilter !== 'all' && (
            <span className="filter-chip-tag">
              Location: {locationFilter}
              <button className="filter-chip-remove-btn" onClick={() => setLocationFilter('all')}>
                <X size={12} />
              </button>
            </span>
          )}
          {serviceFilter !== 'all' && (
            <span className="filter-chip-tag">
              Service: {serviceFilter}
              <button className="filter-chip-remove-btn" onClick={() => setServiceFilter('all')}>
                <X size={12} />
              </button>
            </span>
          )}
          <button className="filter-clear-all-action" onClick={handleReset}>
            Clear all
          </button>
        </div>
      )}

      {/* 4. Sub-bar: Status Tabs & Actions */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          <button
            className={`status-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            All Vendors ({counts.total})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'verified' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('verified');
              setCurrentPage(1);
            }}
          >
            Verified ({counts.verified})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
          >
            Pending Verification ({counts.pending})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'inactive' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('inactive');
              setCurrentPage(1);
            }}
          >
            Inactive ({counts.inactive})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('drafts');
              setCurrentPage(1);
              fetchDrafts();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Bookmark size={14} />
            <span>Drafts ({drafts.length})</span>
          </button>
        </div>

        <div className="table-actions-group" style={{ position: 'relative' }}>
          <button
            id="btn-export-vendors"
            className="btn-action-outline"
            onClick={() => handleExport(false)}
            title="Export filtered records to CSV"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          {/* Column Settings Toggle */}
          <div ref={columnMenuRef} style={{ position: 'relative' }}>
            <button
              id="btn-columns-menu"
              className="btn-action-outline"
              onClick={() => setShowColumnSettings((prev) => !prev)}
              title="Customize visible columns"
            >
              <Filter size={14} />
              <span>Columns</span>
            </button>

            {showColumnSettings && (
              <div className="column-visibility-dropdown" role="menu">
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Toggle Columns
                </div>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.vendorId}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, vendorId: e.target.checked })}
                  />
                  <span>Vendor ID & Company</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.vendorType}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, vendorType: e.target.checked })}
                  />
                  <span>Vendor Type</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.contactPerson}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, contactPerson: e.target.checked })}
                  />
                  <span>Contact Person</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.location}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, location: e.target.checked })}
                  />
                  <span>Location</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.gstin}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, gstin: e.target.checked })}
                  />
                  <span>GSTIN</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.panNumber}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, panNumber: e.target.checked })}
                  />
                  <span>PAN Number</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.services}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, services: e.target.checked })}
                  />
                  <span>Services</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.verificationStatus}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, verificationStatus: e.target.checked })}
                  />
                  <span>Verification Status</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.accountStatus}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, accountStatus: e.target.checked })}
                  />
                  <span>Account Status</span>
                </label>
                <label className="column-toggle-item">
                  <input
                    type="checkbox"
                    checked={visibleColumns.lastActivity}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, lastActivity: e.target.checked })}
                  />
                  <span>Last Activity</span>
                </label>

                <button
                  className="column-restore-defaults-btn"
                  onClick={() => {
                    setVisibleColumns({
                      vendorId: true,
                      vendorType: true,
                      contactPerson: true,
                      location: true,
                      gstin: true,
                      panNumber: true,
                      services: true,
                      verificationStatus: true,
                      accountStatus: true,
                      lastActivity: true,
                    });
                    showToast('Default columns restored');
                  }}
                >
                  Restore Defaults
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-action-outline btn-square-icon"
            title="Display density options"
            onClick={() => showToast('Display density: Standard enterprise view')}
          >
            <Layers size={14} />
          </button>
        </div>
      </div>

      {/* 5. Bulk Actions Floating Bar */}
      {selectedRows.size > 0 && (
        <div className="client-bulk-toolbar" role="region" aria-label="Bulk actions toolbar">
          <div className="client-bulk-toolbar-info">
            <span className="bulk-count-badge">{selectedRows.size} Selected</span>
            <span style={{ fontSize: '13px', color: '#CBD5E1' }}>
              Perform batch operations on selected logistics partners
            </span>
          </div>
          <div className="bulk-toolbar-actions">
            <button className="btn-bulk-export" onClick={() => handleExport(true)}>
              <Download size={13} />
              <span>Export Selected</span>
            </button>
            <button className="btn-bulk-approve" onClick={handleBulkActivate}>
              <CheckCircle2 size={13} />
              <span>Activate Selected</span>
            </button>
            <button className="btn-bulk-reject" onClick={handleBulkDeactivate}>
              <UserX size={13} />
              <span>Deactivate Selected</span>
            </button>
            <button className="btn-bulk-clear" onClick={() => setSelectedRows(new Set())}>
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 6. Vendor Data Table Card / Drafts Table Card */}
      {activeTab === 'drafts' ? (
        <div className="client-table-card" style={{ overflowX: 'auto' }}>
          <table className="client-table" id="vendor-drafts-table">
            <thead>
              <tr>
                <th style={{ minWidth: '220px', paddingLeft: '20px' }}>Draft Title & Business</th>
                <th style={{ minWidth: '160px' }}>Primary Contact</th>
                <th style={{ minWidth: '120px' }}>Fleet Vehicles</th>
                <th style={{ minWidth: '150px' }}>Current Step</th>
                <th style={{ minWidth: '150px' }}>Completion Progress</th>
                <th style={{ minWidth: '150px' }}>Last Saved</th>
                <th style={{ minWidth: '140px', textAlign: 'center', paddingRight: '20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {draftsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} style={{ padding: '20px' }}>
                      <div className="table-skeleton-cell" style={{ width: '100%', height: 26 }} />
                    </td>
                  </tr>
                ))
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '64px 20px' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: '#FFF1E8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      <Bookmark size={28} color="#F05A22" />
                    </div>
                    <h3 style={{ color: '#172B4D', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
                      No Saved Vendor Drafts Found
                    </h3>
                    <p
                      style={{
                        color: '#64748B',
                        margin: '0 0 20px',
                        fontSize: 13.5,
                        maxWidth: 440,
                        marginLeft: 'auto',
                        marginRight: 'auto',
                      }}
                    >
                      Partially entered vendor registrations and vehicle enrollments saved using "Save Draft" will appear here. You can resume them anytime.
                    </p>
                    <button className="btn-create-orange" onClick={() => onNavigateToInvite()}>
                      <Plus size={16} />
                      <span>Create Vendor Draft</span>
                    </button>
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => {
                  const contactName = draft.form_data?.contactName || draft.form_data?.contact_name || '—';
                  const contactMobile = draft.form_data?.mobile || draft.form_data?.contactPhone || '—';
                  const contactEmail = draft.form_data?.email || draft.form_data?.contactEmail || '—';
                  const vehCount = Array.isArray(draft.vehicle_details) ? draft.vehicle_details.length : 0;
                  const pct = draft.completion_percentage || 25;

                  return (
                    <tr key={draft.id} className="client-row">
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>
                          {draft.title || 'Untitled Vendor Draft'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          Draft ID: <span style={{ fontFamily: 'monospace' }}>{draft.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>{contactName}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{contactMobile} • {contactEmail}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            background: vehCount > 0 ? '#EFF6FF' : '#F1F5F9',
                            color: vehCount > 0 ? '#1D4ED8' : '#64748B',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {vehCount} Commercial Vehicle{vehCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            background: '#F1F5F9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {draft.step_progress || 'In Progress'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 9999, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: pct >= 80 ? '#10B981' : pct >= 40 ? '#F05A22' : '#F59E0B',
                                borderRadius: 9999,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', minWidth: 32 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12.5, color: '#64748B' }}>
                        {new Date(draft.updated_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => onNavigateToInvite(draft.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '6px 12px',
                              background: '#FFF1E8',
                              color: '#F05A22',
                              border: '1px solid #FFD8C7',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Resume draft and continue registration"
                          >
                            <FileText size={13} />
                            <span>Resume</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraftToDelete(draft)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '6px 8px',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                            title="Delete draft"
                          >
                            <Trash2 size={13} />
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
      ) : (
        <div className="client-table-card">
        <div className="table-wrapper vendor-table-scroll">
          <table className="client-table" id="vendor-directory-table">
            <thead>
              <tr>
                <th style={{ width: '44px', minWidth: '44px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="custom-table-checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleSelectAll}
                    title="Select all on current page"
                  />
                </th>
                {/* Vendor ID & Company */}
                {visibleColumns.vendorId && (
                  <th style={{ minWidth: 180 }}>
                    <button
                      type="button"
                      className={`th-sortable-button ${sortField === 'vendor_name' ? 'active-sort' : ''}`}
                      onClick={() => handleSort('vendor_name')}
                    >
                      <span>Vendor ID & Company</span>
                      {sortField === 'vendor_name' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ArrowUpDown size={12} color="#94A3B8" />
                      )}
                    </button>
                  </th>
                )}
                {visibleColumns.vendorType && <th style={{ minWidth: '120px' }}>Vendor Type</th>}
                {visibleColumns.contactPerson && <th style={{ minWidth: '160px' }}>Contact Person</th>}
                {visibleColumns.location && (
                  <th onClick={() => handleSort('location')} style={{ cursor: 'pointer', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Location</span>
                      {sortField === 'location' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ArrowUpDown size={13} style={{ color: '#94A3B8' }} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.gstin && <th style={{ minWidth: '170px' }}>GSTIN</th>}
                {visibleColumns.panNumber && <th style={{ minWidth: '140px' }}>PAN Number</th>}
                {visibleColumns.services && <th style={{ minWidth: '150px' }}>Services</th>}
                {visibleColumns.verificationStatus && (
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Verification</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ArrowUpDown size={13} style={{ color: '#94A3B8' }} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.accountStatus && <th style={{ minWidth: '120px' }}>Account Status</th>}
                {visibleColumns.lastActivity && (
                  <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Last Activity</span>
                      {sortField === 'created_at' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ArrowUpDown size={13} style={{ color: '#94A3B8' }} />
                      )}
                    </div>
                  </th>
                )}
                <th style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="table-skeleton-row">
                    <td style={{ textAlign: 'center' }}><div className="table-skeleton-cell" style={{ width: '16px', height: '16px', margin: '0 auto' }} /></td>
                    {visibleColumns.vendorId && (
                      <td>
                        <div className="client-name-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="client-avatar-squircle vendor-initial-avatar"
                            style={{ background: '#F1F5F9', borderRadius: 10, width: 36, height: 36 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div className="table-skeleton-cell" style={{ width: 120, height: 11 }} />
                            <div className="table-skeleton-cell" style={{ width: 70, height: 8 }} />
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.vendorType && <td><div className="table-skeleton-cell" style={{ width: '80px', height: '22px', borderRadius: '4px' }} /></td>}
                    {visibleColumns.contactPerson && (
                      <td>
                        <div className="table-skeleton-cell" style={{ width: '90px', height: '13px', marginBottom: '4px' }} />
                        <div className="table-skeleton-cell" style={{ width: '100px', height: '11px' }} />
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td>
                        <div className="table-skeleton-cell" style={{ width: '110px', height: '13px', marginBottom: '4px' }} />
                        <div className="table-skeleton-cell" style={{ width: '85px', height: '11px' }} />
                      </td>
                    )}
                    {visibleColumns.gstin && <td><div className="table-skeleton-cell" style={{ width: '120px', height: '20px', borderRadius: '4px' }} /></td>}
                    {visibleColumns.panNumber && <td><div className="table-skeleton-cell" style={{ width: '95px', height: '20px', borderRadius: '4px' }} /></td>}
                    {visibleColumns.services && <td><div className="table-skeleton-cell" style={{ width: '110px', height: '20px' }} /></td>}
                    {visibleColumns.verificationStatus && <td><div className="table-skeleton-cell" style={{ width: '90px', height: '22px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.accountStatus && <td><div className="table-skeleton-cell" style={{ width: '65px', height: '22px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.lastActivity && (
                      <td>
                        <div className="table-skeleton-cell" style={{ width: '80px', height: '13px', marginBottom: '4px' }} />
                        <div className="table-skeleton-cell" style={{ width: '60px', height: '11px' }} />
                      </td>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto' }} />
                    </td>
                  </tr>
                ))
              ) : paginatedVendors.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="table-empty-state">
                      <div className="empty-state-icon-box">
                        <Users size={32} />
                      </div>
                      <h4 className="empty-state-heading">No vendors found</h4>
                      <p className="empty-state-text">
                        {hasActiveFilters
                          ? 'No vendor records match your current filters.'
                          : 'Your vendor directory is empty. Add your first vendor to start managing your logistics partners.'}
                      </p>
                      {hasActiveFilters ? (
                        <button className="btn-filter-reset" onClick={handleReset} style={{ margin: '0 auto' }}>
                          <RotateCcw size={14} />
                          <span>Clear Filters</span>
                        </button>
                      ) : (
                        <button
                          className="btn-create-orange"
                          onClick={() => {
                            if (onNavigateToInvite) {
                              onNavigateToInvite();
                            } else {
                              setShowAddVendorModal(true);
                            }
                          }}
                          style={{ margin: '0 auto' }}
                        >
                          <Plus size={15} />
                          <span>+ Add Vendor</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVendors.map((vendor, rowIndex) => {
                  const isApproved = vendor.status === 'APPROVED';
                  const isPending = vendor.status === 'PENDING';
                  const isRejected = vendor.status === 'REJECTED';
                  const isInactive = vendor.status === 'INACTIVE';
                  const isSelected = selectedRows.has(vendor.id);
                  const vendorCode = formatVendorCode(vendor.id, vendor.created_at, vendor.vendor_code);
                  const avatarColor = getAvatarColor(vendor.vendor_name);
                  const initials = getInitials(vendor.vendor_name);

                  return (
                    <tr key={vendor.id} className={`client-data-row ${isSelected ? 'row-selected' : ''}`}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="custom-table-checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(vendor.id)}
                        />
                      </td>

                      {/* Vendor ID & Company Information */}
                      {visibleColumns.vendorId && (
                        <td>
                          <div className="client-name-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              className="client-avatar-squircle vendor-initial-avatar"
                              style={{
                                background: avatarColor,
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
                            >
                              {initials}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div
                                className="client-name-text"
                                onClick={() => onNavigateToProfile(vendor.id)}
                                style={{
                                  fontWeight: 600,
                                  color: '#0F172A',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: 180,
                                }}
                                title={vendor.vendor_name}
                              >
                                {vendor.vendor_name}
                              </div>
                              <div
                                className="client-id-text"
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  color: '#64748B',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <span>{vendorCode}</span>
                                <button
                                  type="button"
                                  className="vendor-id-copy-btn"
                                  onClick={(e) => handleCopyVendorId(e, vendorCode)}
                                  title={copiedId === vendorCode ? 'Copied!' : 'Copy Vendor ID'}
                                >
                                  {copiedId === vendorCode ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 3. Vendor Type */}
                      {visibleColumns.vendorType && (
                        <td>
                          <span
                            className={
                              vendor.vendor_type === 'Primary Contact'
                                ? 'vendor-type-pill-green'
                                : 'vendor-type-pill'
                            }
                          >
                            {vendor.vendor_type || 'Fleet Owner'}
                          </span>
                        </td>
                      )}

                      {/* 4. Contact Person */}
                      {visibleColumns.contactPerson && (
                        <td>
                          <div className="vendor-contact-cell">
                            <div className="vendor-contact-name">{vendor.contact_name}</div>
                            <div className="vendor-contact-phone">
                              {vendor.contact_phone ? `+91 ${vendor.contact_phone.replace(/\D/g, '').slice(-10)}` : '—'}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* 5. Location */}
                      {visibleColumns.location && (
                        <td>
                          {(() => {
                            const { line1, line2 } = formatLocationLines(vendor.city, vendor.state, vendor.pincode, vendor.address);
                            return (
                              <div className="vendor-location-cell">
                                <MapPin size={13} className="vendor-location-icon" />
                                <div>
                                  <div className="vendor-location-line1">{line1}</div>
                                  {line2 && <div className="vendor-location-line2">{line2}</div>}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* 6. GSTIN (Dedicated Column) */}
                      {visibleColumns.gstin && (
                        <td>
                          {vendor.gstin ? (
                            <span className="mono-code gstin-badge">{vendor.gstin.toUpperCase()}</span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                      )}

                      {/* 7. PAN Number (Dedicated Column) */}
                      {visibleColumns.panNumber && (
                        <td>
                          {vendor.pan ? (
                            <span className="mono-code pan-badge">{vendor.pan.toUpperCase()}</span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                      )}

                      {/* 8. Services */}
                      {visibleColumns.services && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {(vendor.services || ['FTL', 'Container']).slice(0, 2).map((srv) => (
                              <span key={srv} className="service-tag-pill">
                                {srv}
                              </span>
                            ))}
                            {(vendor.services || []).length > 2 && (
                              <span
                                className="service-tag-pill service-tag-pill-count"
                                title={(vendor.services || []).slice(2).join(', ')}
                              >
                                +{(vendor.services || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 9. Verification */}
                      {visibleColumns.verificationStatus && (
                        <td>
                          <span
                            className={
                              isApproved
                                ? 'status-pill-green'
                                : isPending
                                ? 'status-pill-amber'
                                : isRejected
                                ? 'status-pill-red'
                                : 'status-pill-blue'
                            }
                          >
                            {isApproved ? '✓ Verified' : isPending ? '⏳ Pending' : isRejected ? '✕ Rejected' : 'Under Review'}
                          </span>
                        </td>
                      )}

                      {/* 10. Account Status */}
                      {visibleColumns.accountStatus && (
                        <td>
                          <span className={isInactive || isRejected ? 'badge-account-inactive' : 'badge-account-active'}>
                            <span className={isInactive || isRejected ? 'status-dot-inactive' : 'status-dot-active'} />
                            {isInactive || isRejected ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                      )}

                      {/* 11. Last Activity */}
                      {visibleColumns.lastActivity && (
                        <td>
                          {(() => {
                            const { date, time } = formatLastActivity(vendor.updated_at || vendor.created_at);
                            return (
                              <div className="vendor-activity-cell">
                                <div className="vendor-activity-date">{date}</div>
                                {time && <div className="vendor-activity-time">{time}</div>}
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* 12. Actions (Explicit Full View + 3-Dot Actions Menu) */}
                      <td style={{ width: '90px', minWidth: '90px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="row-action-btn-circle"
                            title="Full View"
                            aria-label={`Full View for ${vendor.vendor_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToProfile(vendor.id);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <div className="action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`row-action-btn-circle ${menuAnchor?.id === vendor.id ? 'active' : ''}`}
                              onClick={(e) => handleToggleActionMenu(vendor, e)}
                              title="Actions menu"
                              aria-expanded={menuAnchor?.id === vendor.id}
                            >
                              <MoreVertical size={15} />
                            </button>
                          </div>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Pagination Footer */}
        <div className="pagination-row">
          <div className="pagination-info">
            {sortedVendors.length === 0 ? (
              'Showing 0 vendors'
            ) : (
              <>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedVendors.length)} of{' '}
                {sortedVendors.length} vendors
              </>
            )}
          </div>

          <div className="pagination-controls">
            <button
              className="page-nav-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              aria-label="Previous Page"
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
              aria-label="Next Page"
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
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>
      )}

      {/* 8. Add Vendor Modal (In-page Workflow) */}
      {showAddVendorModal && (
        <AddVendorModal
          onClose={() => setShowAddVendorModal(false)}
          onSuccess={(newVendorId) => {
            setShowAddVendorModal(false);
            showToast('✅ New vendor company registered successfully.');
            loadVendors();
          }}
        />
      )}

      {/* 9. Edit Vendor Modal */}
      {showEditVendorModal && editingVendor && (
        <EditVendorModal
          isOpen={true}
          vendor={editingVendor}
          primaryContact={vendorUsers.find((u) => u.vendor_id === editingVendor.id)}
          onClose={() => {
            setShowEditVendorModal(false);
            setEditingVendor(null);
          }}
          onSaved={() => {
            setShowEditVendorModal(false);
            setEditingVendor(null);
            showToast('✅ Vendor details updated successfully.');
            loadVendors();
          }}
        />
      )}

      {/* 10. Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="client-modal-overlay">
          <div className="client-modal-container" style={{ maxWidth: '440px' }}>
            <div className="client-modal-header">
              <h3 className="client-modal-title">{confirmDialog.title}</h3>
              <button className="client-modal-close" onClick={() => setConfirmDialog(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="client-modal-body">
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
                {confirmDialog.message}
              </p>
            </div>
            <div className="client-modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                className={`btn-primary ${confirmDialog.confirmStyle === 'danger' ? 'btn-danger' : ''}`}
                style={
                  confirmDialog.confirmStyle === 'danger'
                    ? { backgroundColor: '#DC2626' }
                    : confirmDialog.confirmStyle === 'success'
                    ? { backgroundColor: '#16A34A' }
                    : { backgroundColor: '#F05A22' }
                }
                onClick={() => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  cb();
                }}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Floating Action Menu (Decoupled from table container to prevent ANY clipping or vertical scrollbars) */}
      {menuAnchor && (() => {
        const activeVendor = vendors.find((v) => v.id === menuAnchor.id);
        if (!activeVendor) return null;
        const isApproved = activeVendor.status === 'APPROVED';
        const isInactive = activeVendor.status === 'INACTIVE';

        return (
          <div
            className="vendor-action-menu-dropdown"
            style={{
              position: 'fixed',
              top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
              bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
              right: `${menuAnchor.right}px`,
              zIndex: 9999,
              width: '215px',
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
                onNavigateToProfile(activeVendor.id);
              }}
            >
              <Eye size={14} color="#F05A22" />
              <span>View Vendor / Full View</span>
            </button>

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
                setEditingVendor(activeVendor);
                setShowEditVendorModal(true);
              }}
            >
              <Edit size={14} color="#64748B" />
              <span>Edit Vendor</span>
            </button>

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
                onNavigateToProfile(activeVendor.id);
              }}
            >
              <FileText size={14} color="#64748B" />
              <span>Review Documents</span>
            </button>

            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

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
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  handleVerifyVendor(activeVendor.id, activeVendor.vendor_name);
                }}
              >
                <ShieldCheck size={14} />
                <span>Verify Vendor</span>
              </button>
            )}

            {activeVendor.status !== 'REJECTED' && (
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
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  handleRejectVendor(activeVendor.id, activeVendor.vendor_name);
                }}
              >
                <ShieldAlert size={14} />
                <span>Reject Verification</span>
              </button>
            )}

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
                color: isInactive ? '#16A34A' : '#DC2626',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                handleToggleStatus(activeVendor.id, activeVendor.vendor_name, activeVendor.status);
              }}
            >
              {isInactive ? <CheckCircle2 size={14} /> : <UserX size={14} />}
              <span>{isInactive ? 'Activate Vendor' : 'Deactivate Vendor'}</span>
            </button>

            {canDelete && (
              <>
                <div style={{ height: '1px', background: '#E5E7EB', margin: '4px 0' }} />
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: '#DC2626',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setMenuAnchor(null);
                    setOpenActionMenuId(null);
                    setDeletingVendor(activeVendor);
                  }}
                >
                  <Trash2 size={14} color="#DC2626" />
                  <span>Delete User</span>
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Permanent Delete Vendor Confirmation Dialog */}
      {deletingVendor && (
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
          onClick={() => !deleteLoading && setDeletingVendor(null)}
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
                  Permanently Delete Vendor?
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
              You are about to permanently delete <strong>{deletingVendor.vendor_name}</strong> (
              {deletingVendor.contact_phone || 'No phone'}).
              <br />
              All linked driver associations, vehicle links, uploaded documents, quotations, and authentication credentials will be wiped from the system.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Reason for Deletion (Optional)
              </label>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate account requested by vendor, fraudulent profile..."
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
                onClick={() => setDeletingVendor(null)}
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
                onClick={handleConfirmDeleteVendor}
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

      {/* ── Vendor Draft Delete Confirmation Modal ── */}
      {draftToDelete && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog-card" role="dialog" aria-modal="true">
            <div className="modal-icon-circle-warning">
              <AlertTriangle size={28} color="#DC2626" />
            </div>
            <h3 className="modal-title">Delete Vendor Registration Draft?</h3>
            <p className="modal-desc">
              Are you sure you want to permanently delete the draft for <strong>"{draftToDelete.title}"</strong>? All saved vehicle details and registration inputs will be discarded and cannot be recovered.
            </p>
            <div className="modal-btn-row" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => setDraftToDelete(null)}
                disabled={isDeletingDraft}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-danger"
                onClick={() => handleDeleteDraft(draftToDelete.id)}
                disabled={isDeletingDraft}
              >
                {isDeletingDraft ? 'Deleting Draft...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Complete Add Vendor Modal Component ──────────────────────────────────────
interface AddVendorModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
}

interface AddModalVehicle {
  id: string;
  registrationNumber: string;
  category: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
  bodyType: 'Open Body' | 'Closed Body';
  capacity: string;
  capacityUnit: 'MT' | 'KG' | 'CBM';
  makeModel?: string;
  driverName?: string;
  driverPhone?: string;
  driverLicence?: string;
  rcFile?: File | null;
  cBookFile?: File | null;
  permitFile?: File | null;
  insuranceFile?: File | null;
  pucFile?: File | null;
  driverDlFile?: File | null;
}

const AddVendorModal: React.FC<AddVendorModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    vendorType: 'Fleet Owner',
    gstin: '',
    pan: '',
    contactName: '',
    designation: 'Manager',
    email: '',
    mobile: '',
    addressLine1: '',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '781001',
    fleetSize: '',
    accountStatus: 'PENDING',
    onboardingNotes: '',
  });

  const [selectedServices, setSelectedServices] = useState<string[]>(['FTL', 'Container']);
  const [vehicles, setVehicles] = useState<AddModalVehicle[]>([]);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null);

  const [vehicleForm, setVehicleForm] = useState<{
    registrationNumber: string;
    category: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
    bodyType: 'Open Body' | 'Closed Body';
    capacity: string;
    capacityUnit: 'MT' | 'KG' | 'CBM';
    makeModel: string;
    driverName: string;
    driverPhone: string;
    driverLicence: string;
    rcFile: File | null;
    cBookFile: File | null;
    permitFile: File | null;
    insuranceFile: File | null;
    pucFile: File | null;
    driverDlFile: File | null;
  }>({
    registrationNumber: '',
    category: 'Lorry',
    bodyType: 'Open Body',
    capacity: '15',
    capacityUnit: 'MT',
    makeModel: '',
    driverName: '',
    driverPhone: '',
    driverLicence: '',
    rcFile: null,
    cBookFile: null,
    permitFile: null,
    insuranceFile: null,
    pucFile: null,
    driverDlFile: null,
  });

  // Transporter KYC files
  const [panDocFile, setPanDocFile] = useState<File | null>(null);
  const [chequeDocFile, setChequeDocFile] = useState<File | null>(null);
  const [gstDocFile, setGstDocFile] = useState<File | null>(null);
  const [declarationDocFile, setDeclarationDocFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleService = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter((s) => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  const handlePincodeChange = async (pin: string) => {
    const clean = pin.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: clean }));
    if (clean.length === 6) {
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res && res.success && res.data) {
          setFormData((prev) => ({
            ...prev,
            pincode: clean,
            city: res.data?.city || prev.city,
            state: res.data?.state || prev.state,
          }));
        }
      } catch (e) {
        // network fallback
      }
    }
  };

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    const updates: any = { gstin: upper };
    if (upper.length >= 12) {
      const derivedPan = upper.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derivedPan) && !formData.pan) {
        updates.pan = derivedPan;
      }
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    setVehicleForm({
      registrationNumber: '',
      category: 'Lorry',
      bodyType: 'Open Body',
      capacity: '15',
      capacityUnit: 'MT',
      makeModel: '',
      driverName: '',
      driverPhone: '',
      driverLicence: '',
      rcFile: null,
      cBookFile: null,
      permitFile: null,
      insuranceFile: null,
      pucFile: null,
      driverDlFile: null,
    });
    setVehicleFormError(null);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: AddModalVehicle) => {
    setEditingVehicleId(veh.id);
    setVehicleForm({
      registrationNumber: veh.registrationNumber,
      category: veh.category,
      bodyType: veh.bodyType,
      capacity: veh.capacity,
      capacityUnit: veh.capacityUnit,
      makeModel: veh.makeModel || '',
      driverName: veh.driverName || '',
      driverPhone: veh.driverPhone || '',
      driverLicence: veh.driverLicence || '',
      rcFile: veh.rcFile || null,
      cBookFile: veh.cBookFile || null,
      permitFile: veh.permitFile || null,
      insuranceFile: veh.insuranceFile || null,
      pucFile: veh.pucFile || null,
      driverDlFile: veh.driverDlFile || null,
    });
    setVehicleFormError(null);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicleModal = () => {
    const cleanReg = vehicleForm.registrationNumber.trim().toUpperCase();
    if (!cleanReg) {
      setVehicleFormError('Vehicle registration number is required (e.g. AS-01-EC-9944).');
      return;
    }
    const capNum = parseFloat(vehicleForm.capacity);
    if (isNaN(capNum) || capNum <= 0) {
      setVehicleFormError('Rated capacity must be greater than zero.');
      return;
    }

    if (editingVehicleId) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicleId
            ? {
                ...v,
                registrationNumber: cleanReg,
                category: vehicleForm.category,
                bodyType: vehicleForm.bodyType,
                capacity: vehicleForm.capacity,
                capacityUnit: vehicleForm.capacityUnit,
                makeModel: vehicleForm.makeModel,
                driverName: vehicleForm.driverName,
                driverPhone: vehicleForm.driverPhone,
                driverLicence: vehicleForm.driverLicence,
                rcFile: vehicleForm.rcFile,
                cBookFile: vehicleForm.cBookFile,
                permitFile: vehicleForm.permitFile,
                insuranceFile: vehicleForm.insuranceFile,
                pucFile: vehicleForm.pucFile,
                driverDlFile: vehicleForm.driverDlFile,
              }
            : v
        )
      );
    } else {
      const newVeh: AddModalVehicle = {
        id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        registrationNumber: cleanReg,
        category: vehicleForm.category,
        bodyType: vehicleForm.bodyType,
        capacity: vehicleForm.capacity,
        capacityUnit: vehicleForm.capacityUnit,
        makeModel: vehicleForm.makeModel,
        driverName: vehicleForm.driverName,
        driverPhone: vehicleForm.driverPhone,
        driverLicence: vehicleForm.driverLicence,
        rcFile: vehicleForm.rcFile,
        cBookFile: vehicleForm.cBookFile,
        permitFile: vehicleForm.permitFile,
        insuranceFile: vehicleForm.insuranceFile,
        pucFile: vehicleForm.pucFile,
        driverDlFile: vehicleForm.driverDlFile,
      };
      setVehicles((prev) => [...prev, newVeh]);
      setFormData((prev) => ({ ...prev, fleetSize: String(vehicles.length + 1) }));
    }
    setIsVehicleModalOpen(false);
  };

  const handleRemoveVehicle = (id: string) => {
    const updated = vehicles.filter((v) => v.id !== id);
    setVehicles(updated);
    setFormData((prev) => ({ ...prev, fleetSize: String(Math.max(0, updated.length)) }));
  };

  const uploadDocFile = async (
    file: File,
    folder: string,
    entityId: string,
    docType: string,
    category: 'VENDOR' | 'VEHICLE' | 'DRIVER'
  ) => {
    const uploadReadyFile = await optimizeFileForUpload(file);
    const fileExt = uploadReadyFile.name.split('.').pop() || 'pdf';
    const filePath = `${folder}/${entityId}_${docType}_${Date.now()}.${fileExt}`;
    let publicUrl = '';
    try {
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadReadyFile, { upsert: true });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage
          .from('documents')
          .getPublicUrl(uploadData.path);
        publicUrl = pubData?.publicUrl || '';
      }
    } catch (e) {
      console.warn(`Storage upload note for ${docType}:`, e);
    }

    await supabase.from('documents').insert([
      {
        reference_id: entityId,
        category,
        document_type: docType,
        file_name: file.name,
        file_url: publicUrl || `https://storage.local/documents/${filePath}`,
        storage_path: filePath,
        status: 'PENDING_VERIFICATION',
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const validate = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      errs.businessName = 'Vendor / Company name is required.';
    }

    if (!formData.vendorType) {
      errs.vendorType = 'Vendor Type is required.';
    }

    if (formData.gstin.trim() && formData.gstin.trim().length !== 15) {
      errs.gstin = 'GSTIN must be exactly 15 characters if provided.';
    }

    if (formData.pan.trim() && formData.pan.trim().length !== 10) {
      errs.pan = 'PAN must be exactly 10 characters if provided.';
    }

    if (!formData.contactName.trim()) {
      errs.contactName = 'Contact Person Name is required.';
    }

    if (formData.email && formData.email.trim() && !formData.email.includes('@')) {
      errs.email = 'Valid Email Address format is required if provided.';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) {
      errs.mobile = '10-digit Indian Mobile Number is required.';
    }

    if (!formData.addressLine1.trim()) {
      errs.addressLine1 = 'Address is required.';
    }

    if (!formData.city.trim()) {
      errs.city = 'City is required.';
    }

    if (!formData.state.trim()) {
      errs.state = 'State is required.';
    }

    if (!formData.pincode.trim() || formData.pincode.replace(/\D/g, '').length !== 6) {
      errs.pincode = 'Valid 6-digit PIN code is required.';
    }

    // Server-side duplicate check for Mobile
    if (!errs.mobile) {
      try {
        const { data: existingUser } = await supabase
          .from('vendor_users')
          .select('id')
          .eq('mobile', cleanMobile)
          .maybeSingle();

        if (existingUser) {
          errs.mobile = 'A vendor contact with this mobile number is already registered.';
        }
      } catch (e) {
        // network timeout fallback
      }
    }

    // Server-side duplicate check for GSTIN
    if (formData.gstin.trim() && !errs.gstin) {
      try {
        const { data: existingGst } = await supabase
          .from('vendor_companies')
          .select('id')
          .eq('gstin', formData.gstin.trim().toUpperCase())
          .maybeSingle();

        if (existingGst) {
          errs.gstin = 'A vendor company with this GSTIN is already registered.';
        }
      } catch (e) {
        // network timeout fallback
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validate();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const fullAddress = `${formData.addressLine1.trim()}, ${formData.city.trim()}, ${formData.state.trim()} - ${formData.pincode.trim()}`;
      const cleanMobile = formData.mobile.replace(/\D/g, '');

      // 1. Generate atomic NECL Vendor ID
      const vendorCode = await generateDbNeclId('VD');

      // 2. Insert Vendor Company
      const fleetCount = vehicles.length > 0 ? vehicles.length : (formData.fleetSize ? parseInt(formData.fleetSize, 10) : 0);
      const { data: comp, error: compErr } = await supabase
        .from('vendor_companies')
        .insert([
          {
            vendor_code: vendorCode,
            vendor_name: formData.businessName.trim(),
            pan: formData.pan.trim().toUpperCase() || null,
            gstin: formData.gstin.trim().toUpperCase() || null,
            address: fullAddress,
            status: formData.accountStatus as any,
            onboarding_source: 'ADMIN_PORTAL',
            fleet_size: fleetCount,
          },
        ])
        .select()
        .single();

      if (compErr) throw compErr;

      // 3. Insert Primary Contact User
      const { error: userErr } = await supabase.from('vendor_users').insert([
        {
          vendor_id: comp.id,
          full_name: formData.contactName.trim(),
          email: formData.email?.trim() || null,
          mobile: cleanMobile,
          status: formData.accountStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING',
        },
      ]);

      if (userErr) throw userErr;

      // 4. Upload Transporter KYC Documents (Category: 'VENDOR', reference_id: comp.id)
      if (panDocFile) {
        await uploadDocFile(panDocFile, 'vendors/kyc', comp.id, 'PAN_CARD', 'VENDOR');
      }
      if (chequeDocFile) {
        await uploadDocFile(chequeDocFile, 'vendors/kyc', comp.id, 'BANK_CANCELLED_CHEQUE', 'VENDOR');
      }
      if (gstDocFile) {
        await uploadDocFile(gstDocFile, 'vendors/kyc', comp.id, 'GST_CERTIFICATE', 'VENDOR');
      }
      if (declarationDocFile) {
        await uploadDocFile(declarationDocFile, 'vendors/kyc', comp.id, 'TRANSPORT_DECLARATION', 'VENDOR');
      }

      // 5. Insert Fleet Vehicles and Vehicle-Specific Documents
      for (const veh of vehicles) {
        const capNum = parseFloat(veh.capacity) || 15;
        const capacityInMT = veh.capacityUnit === 'MT' ? capNum : veh.capacityUnit === 'KG' ? capNum / 1000 : capNum;

        // Insert vehicle record
        const { data: createdVeh, error: vehErr } = await supabase
          .from('vehicles')
          .insert([
            {
              registration_number: veh.registrationNumber.trim().toUpperCase(),
              vehicle_type: veh.category,
              body_type: veh.bodyType,
              rated_capacity_mt: capacityInMT,
              status: 'ACTIVE',
            },
          ])
          .select()
          .single();

        if (vehErr) {
          console.error('Error inserting vehicle:', vehErr);
          continue;
        }

        // Link vehicle to vendor
        await supabase.from('vendor_vehicle_links').insert([
          {
            vendor_id: comp.id,
            vehicle_id: createdVeh.id,
            status: 'ACTIVE',
          },
        ]);

        // If driver details are provided, register driver linked to this vendor & vehicle
        if (veh.driverName && veh.driverName.trim()) {
          const driverCode = await generateDbNeclId('DR');
          const cleanDriverPhone = (veh.driverPhone || '').replace(/\D/g, '') || cleanMobile;
          await supabase.from('drivers').insert([
            {
              driver_code: driverCode,
              full_name: veh.driverName.trim(),
              mobile: cleanDriverPhone,
              phone: cleanDriverPhone,
              licence_number: veh.driverLicence?.trim() || null,
              primary_vendor_id: comp.id,
              assigned_vehicle_id: createdVeh.id,
              status: 'ACTIVE',
            },
          ]);
        }

        // Upload Vehicle-Specific Documents (Category: 'VEHICLE', reference_id: createdVeh.id)
        if (veh.rcFile) {
          await uploadDocFile(veh.rcFile, 'vehicles/rc', createdVeh.id, 'REGISTRATION_CERTIFICATE', 'VEHICLE');
        }
        if (veh.cBookFile) {
          await uploadDocFile(veh.cBookFile, 'vehicles/cbook', createdVeh.id, 'FITNESS_CERTIFICATE', 'VEHICLE');
        }
        if (veh.permitFile) {
          await uploadDocFile(veh.permitFile, 'vehicles/permit', createdVeh.id, 'VEHICLE_PERMIT', 'VEHICLE');
        }
        if (veh.insuranceFile) {
          await uploadDocFile(veh.insuranceFile, 'vehicles/insurance', createdVeh.id, 'INSURANCE_CERTIFICATE', 'VEHICLE');
        }
        if (veh.pucFile) {
          await uploadDocFile(veh.pucFile, 'vehicles/puc', createdVeh.id, 'PUC_CERTIFICATE', 'VEHICLE');
        }
        if (veh.driverDlFile) {
          await uploadDocFile(veh.driverDlFile, 'vehicles/driver_dl', createdVeh.id, 'DRIVING_LICENCE', 'VEHICLE');
        }
      }

      // 6. Log Audit Log for Vendor Mobile Registration Modal review
      await supabase.from('auth_audit_log').insert({
        user_id: comp.id,
        event_type: 'VENDOR_REGISTRATION_SUBMITTED',
        details: {
          vendorName: formData.businessName,
          fleetStrength: `${vehicles.length} Commercial Vehicles`,
          totalFleetCount: vehicles.length,
          vehicleConfigs: vehicles.map((v) => ({
            id: v.id,
            registrationNumber: v.registrationNumber,
            vehicleType: v.category,
            bodyType: v.bodyType,
            capacity: parseFloat(v.capacity) || 15,
            capacityUnit: v.capacityUnit,
            count: 1,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            driverLicence: v.driverLicence,
          })),
        },
      });

      onSuccess(comp.id);
    } catch (err: any) {
      console.error('Add vendor error:', err);
      setErrors({ global: err.message || 'Database error occurred while creating vendor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="client-modal-overlay">
      <div className="client-modal-container" style={{ maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="client-modal-header">
          <div>
            <h3 className="client-modal-title">Register New Vendor</h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
              Onboard a verified logistics partner, transporter, or fleet owner with complete vehicle fleet.
            </p>
          </div>
          <button className="client-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="client-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {errors.global && (
              <div className="error-alert-box">
                <AlertTriangle size={16} />
                <span>{errors.global}</span>
              </div>
            )}

            {/* Section A: Company Information */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: '0 0 12px 0' }}>
                A. Company Information
              </h4>
              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label className="field-label-req">Company / Business Name *</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Brahmaputra Logistics Pvt Ltd"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  />
                  {errors.businessName && <div className="field-error-text">{errors.businessName}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">Vendor Type *</label>
                  <select
                    className="client-field-input"
                    value={formData.vendorType}
                    onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                  >
                    {VENDOR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    className="client-field-input"
                    placeholder="15-character GSTIN (e.g. 18AABCN1234F1Z5)"
                    value={formData.gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                  />
                  {errors.gstin && <div className="field-error-text">{errors.gstin}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt">PAN (Optional)</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="client-field-input"
                    placeholder="10-character PAN (e.g. AABCN1234F)"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  />
                  {errors.pan && <div className="field-error-text">{errors.pan}</div>}
                </div>
              </div>
            </div>

            {/* Section B: Contact Information */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: '0 0 12px 0' }}>
                B. Primary Contact Person
              </h4>
              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label className="field-label-req">Contact Person Name *</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                  {errors.contactName && <div className="field-error-text">{errors.contactName}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt">Designation</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Managing Partner / Fleet Manager"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">Primary Mobile Number *</label>
                  <div className="phone-input-group">
                    <span className="country-code-pill">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="client-field-input"
                      placeholder="9876543210"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  {errors.mobile && <div className="field-error-text">{errors.mobile}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-opt">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="client-field-input"
                    placeholder="vendor@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {errors.email && <div className="field-error-text">{errors.email}</div>}
                </div>
              </div>
            </div>

            {/* Section C: Business Address */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: '0 0 12px 0' }}>
                C. Business Address
              </h4>
              <div className="form-grid-2col">
                <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                  <label className="field-label-req">Address Line 1 *</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="Plot / Hub / Street address"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                  {errors.addressLine1 && <div className="field-error-text">{errors.addressLine1}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">PIN Code *</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="client-field-input"
                    placeholder="6-digit PIN"
                    value={formData.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                  />
                  {errors.pincode && <div className="field-error-text">{errors.pincode}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">City *</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Guwahati"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                  {errors.city && <div className="field-error-text">{errors.city}</div>}
                </div>

                <div className="form-field-group">
                  <label className="field-label-req">State *</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Assam"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                  {errors.state && <div className="field-error-text">{errors.state}</div>}
                </div>
              </div>
            </div>

            {/* Section D: Services and Fleet */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: 0 }}>
                  D. Services and Fleet
                </h4>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleOpenAddVehicle}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', color: '#F05A22', borderColor: '#F05A22' }}
                >
                  <Plus size={14} />
                  <span>+ Add Vehicle (Step 5)</span>
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="field-label-req">Services Provided</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {SERVICES_OPTIONS.map((srv) => {
                    const isSelected = selectedServices.includes(srv);
                    return (
                      <button
                        type="button"
                        key={srv}
                        className={`service-tag-pill ${isSelected ? 'selected' : ''}`}
                        style={{
                          cursor: 'pointer',
                          padding: '6px 12px',
                          border: isSelected ? '1px solid #F05A22' : '1px solid #CBD5E1',
                          background: isSelected ? 'rgba(240, 90, 34, 0.12)' : '#FFFFFF',
                          color: isSelected ? '#F05A22' : '#334155',
                          fontWeight: 600,
                          borderRadius: '6px',
                        }}
                        onClick={() => toggleService(srv)}
                      >
                        {isSelected && <Check size={12} style={{ marginRight: '4px' }} />}
                        {srv}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fleet Strength - Commercial Vehicles Table */}
              <div style={{ marginTop: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={16} color="#F05A22" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                      Fleet Strength ({vehicles.length} vehicles registered)
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    RC, Insurance, Permit, and driver linked per vehicle
                  </span>
                </div>

                {vehicles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 12px', color: '#64748B', fontSize: '13px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>No vehicles added yet.</p>
                    <button
                      type="button"
                      className="btn-create-orange"
                      onClick={handleOpenAddVehicle}
                      style={{ padding: '6px 14px', fontSize: '12px', margin: '0 auto' }}
                    >
                      <Plus size={14} />
                      <span>Add First Commercial Vehicle</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {vehicles.map((v, index) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '6px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                              #{index + 1} {v.registrationNumber}
                            </span>
                            <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {v.category}
                            </span>
                            <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                              {v.bodyType}
                            </span>
                            <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {v.capacity} {v.capacityUnit}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                            Driver: {v.driverName ? `${v.driverName} (${v.driverPhone || 'No phone'})` : 'Unassigned'} • Docs: {[v.rcFile && 'RC', v.insuranceFile && 'Insurance', v.permitFile && 'Permit', v.cBookFile && 'C-Book', v.pucFile && 'PUC'].filter(Boolean).join(', ') || 'No docs uploaded'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditVehicle(v)}
                            style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(v.id)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transporter Compliance Documents (KYC) */}
              <div style={{ marginTop: '16px', background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  Compliance KYC Documents (Transporter Level)
                </h5>
                <div className="form-grid-2col">
                  <div>
                    <label className="field-label-req">PAN Card (Mandatory) *</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setPanDocFile(e.target.files?.[0] || null)}
                      className="client-field-input"
                      style={{ fontSize: '12px', padding: '4px' }}
                    />
                    {panDocFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {panDocFile.name}</div>}
                  </div>
                  <div>
                    <label className="field-label-req">Cancelled Cheque (Mandatory) *</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setChequeDocFile(e.target.files?.[0] || null)}
                      className="client-field-input"
                      style={{ fontSize: '12px', padding: '4px' }}
                    />
                    {chequeDocFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {chequeDocFile.name}</div>}
                  </div>
                  <div>
                    <label className="field-label-opt">GST Certificate (Optional)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setGstDocFile(e.target.files?.[0] || null)}
                      className="client-field-input"
                      style={{ fontSize: '12px', padding: '4px' }}
                    />
                    {gstDocFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {gstDocFile.name}</div>}
                  </div>
                  <div>
                    <label className="field-label-opt">Transport Declaration (Optional)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setDeclarationDocFile(e.target.files?.[0] || null)}
                      className="client-field-input"
                      style={{ fontSize: '12px', padding: '4px' }}
                    />
                    {declarationDocFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {declarationDocFile.name}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Section E: Account Settings */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: '0 0 12px 0' }}>
                E. Account Settings
              </h4>
              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label className="field-label-req">Initial Verification Status</label>
                  <select
                    className="client-field-input"
                    value={formData.accountStatus}
                    onChange={(e) => setFormData({ ...formData, accountStatus: e.target.value })}
                  >
                    <option value="PENDING">Pending Review (Default)</option>
                    <option value="APPROVED">Verified & Approved</option>
                  </select>
                </div>
                <div className="form-field-group">
                  <label className="field-label-opt">Internal Onboarding Notes</label>
                  <input
                    type="text"
                    className="client-field-input"
                    placeholder="e.g. Referred by Kolkata Branch"
                    value={formData.onboardingNotes}
                    onChange={(e) => setFormData({ ...formData, onboardingNotes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="client-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create-orange"
              disabled={isSubmitting}
              style={{ minWidth: '160px', justifyContent: 'center' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin-animate" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Save Vendor</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ── Sub-Modal: Add / Edit Vehicle Form (Step 5) ── */}
        {isVehicleModalOpen && (
          <div className="client-modal-overlay" style={{ zIndex: 10001 }}>
            <div className="client-modal-container" style={{ maxWidth: '640px', maxHeight: '88vh', overflowY: 'auto' }}>
              <div className="client-modal-header">
                <h4 className="client-modal-title" style={{ fontSize: '15px' }}>
                  {editingVehicleId ? 'Edit Vehicle Details' : 'Add Commercial Vehicle (Step 5)'}
                </h4>
                <button className="client-modal-close" onClick={() => setIsVehicleModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="client-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {vehicleFormError && (
                  <div className="error-alert-box" style={{ padding: '8px 12px', fontSize: '13px' }}>
                    <AlertTriangle size={15} />
                    <span>{vehicleFormError}</span>
                  </div>
                )}

                <div className="form-grid-2col">
                  <div className="form-field-group">
                    <label className="field-label-req">Vehicle Registration Number *</label>
                    <input
                      type="text"
                      className="client-field-input"
                      placeholder="e.g. AS-01-EC-9944"
                      value={vehicleForm.registrationNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-field-group">
                    <label className="field-label-req">Vehicle Category *</label>
                    <select
                      className="client-field-input"
                      value={vehicleForm.category}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value as any })}
                    >
                      <option value="Lorry">Lorry</option>
                      <option value="Trailer">Trailer</option>
                      <option value="Van">Van</option>
                      <option value="Heavy Carrier">Heavy Carrier</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label className="field-label-req">Body Type *</label>
                    <select
                      className="client-field-input"
                      value={vehicleForm.bodyType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, bodyType: e.target.value as any })}
                    >
                      <option value="Open Body">Open Body</option>
                      <option value="Closed Body">Closed Body</option>
                    </select>
                  </div>

                  <div className="form-field-group">
                    <label className="field-label-req">Capacity & Unit *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        className="client-field-input"
                        placeholder="15"
                        value={vehicleForm.capacity}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <select
                        className="client-field-input"
                        value={vehicleForm.capacityUnit}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, capacityUnit: e.target.value as any })}
                        style={{ width: '90px' }}
                      >
                        <option value="MT">MT</option>
                        <option value="KG">KG</option>
                        <option value="CBM">CBM</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Driver Details */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Assigned Driver Information (Optional)
                  </h5>
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label-opt">Driver Full Name</label>
                      <input
                        type="text"
                        className="client-field-input"
                        placeholder="Driver Name"
                        value={vehicleForm.driverName}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label-opt">Driver Phone</label>
                      <input
                        type="tel"
                        maxLength={10}
                        className="client-field-input"
                        placeholder="10-digit mobile"
                        value={vehicleForm.driverPhone}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value.replace(/\D/g, '') })}
                      />
                    </div>
                    <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                      <label className="field-label-opt">Driver Licence Number</label>
                      <input
                        type="text"
                        className="client-field-input"
                        placeholder="DL Number"
                        value={vehicleForm.driverLicence}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, driverLicence: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle-Specific Documents */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Vehicle-Specific Documents
                  </h5>
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label-req">RC (Registration Certificate) *</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, rcFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.rcFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.rcFile.name}</span>}
                    </div>

                    <div className="form-field-group">
                      <label className="field-label-opt">Insurance Certificate</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.insuranceFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.insuranceFile.name}</span>}
                    </div>

                    <div className="form-field-group">
                      <label className="field-label-opt">C-Book / Fitness Certificate</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, cBookFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.cBookFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.cBookFile.name}</span>}
                    </div>

                    <div className="form-field-group">
                      <label className="field-label-opt">Vehicle Permit</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, permitFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.permitFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.permitFile.name}</span>}
                    </div>

                    <div className="form-field-group">
                      <label className="field-label-opt">PUC Certificate</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, pucFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.pucFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.pucFile.name}</span>}
                    </div>

                    <div className="form-field-group">
                      <label className="field-label-opt">Driver's Driving Licence (DL)</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setVehicleForm({ ...vehicleForm, driverDlFile: e.target.files?.[0] || null })}
                        className="client-field-input"
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                      {vehicleForm.driverDlFile && <span style={{ fontSize: '11px', color: '#16A34A' }}>✓ {vehicleForm.driverDlFile.name}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="client-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsVehicleModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-create-orange" onClick={handleSaveVehicleModal}>
                  Save Vehicle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
