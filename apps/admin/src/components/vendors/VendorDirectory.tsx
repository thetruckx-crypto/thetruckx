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
  FileText
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatDisplayId, generateDbNeclId } from '../../utils/idGenerator';

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
  onNavigateToInvite: () => void;
  onNavigateToProfile: (id: string) => void;
  initialTab?: 'all' | 'verified' | 'pending' | 'rejected' | 'inactive';
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

export const VendorDirectory: React.FC<VendorDirectoryProps> = ({
  onNavigateToInvite,
  onNavigateToProfile,
  initialTab = 'all',
}) => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('vendors', 'create');
  const canApprove = hasPermission('vendors', 'approve');
  const canReject = hasPermission('vendors', 'reject');
  const canExport = hasPermission('vendors', 'export');

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
  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'inactive'>(initialTab);

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
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showEditVendorModal, setShowEditVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorCompany | null>(null);
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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Click outside to close column dropdown & action menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnSettings(false);
      }
      if (openActionMenuId && !(event.target as HTMLElement).closest('.action-menu-container')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionMenuId]);

  // Fetch Vendors and Users from Supabase
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
          city: city || 'Guwahati',
          state: state || 'Assam',
          vendor_type: c.vendor_type || 'Fleet Owner',
          services: c.services || ['FTL', 'Container'],
        };
      });

      setVendors(enriched);
      setVendorUsers(rawUsers);

      // Exact database counts
      const totalCount = enriched.length;
      const verifiedCount = enriched.filter((v) => v.status === 'APPROVED' || v.status === 'ACTIVE').length;
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

  // Handle Sort Change
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
      'GSTIN',
      'PAN',
      'Primary Contact',
      'Mobile',
      'Email',
      'City',
      'State',
      'Address',
      'Services',
      'Verification Status',
      'Created At',
    ];

    const rows = targetVendors.map((v) => [
      `"${formatVendorCode(v.id, v.created_at, v.vendor_code)}"`,
      `"${(v.vendor_name || '').replace(/"/g, '""')}"`,
      `"${v.vendor_type || 'Fleet Owner'}"`,
      `"${v.gstin || ''}"`,
      `"${v.pan || ''}"`,
      `"${(v.contact_name || '').replace(/"/g, '""')}"`,
      `"${v.contact_phone || ''}"`,
      `"${v.contact_email || ''}"`,
      `"${v.city || ''}"`,
      `"${v.state || ''}"`,
      `"${(v.address || '').replace(/"/g, '""')}"`,
      `"${(v.services || []).join('; ')}"`,
      `"${v.status}"`,
      `"${v.created_at}"`,
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

        <div className="client-header-actions">
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

      {/* 2. Four Equal-Width Summary KPI Cards */}
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
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : counts.total}
            </div>
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
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : counts.verified}
            </div>
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
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : counts.pending}
            </div>
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
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : counts.inactive}
            </div>
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
            placeholder="Search by vendor name, vendor ID, GSTIN, contact person, phone number, location..."
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
                  <span>Vendor ID</span>
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

      {/* 6. Vendor Data Table Card */}
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
                <th onClick={() => handleSort('vendor_name')} style={{ cursor: 'pointer', minWidth: '250px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Vendor</span>
                    {sortField === 'vendor_name' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                    ) : (
                      <ArrowUpDown size={13} style={{ color: '#94A3B8' }} />
                    )}
                  </div>
                </th>
                {visibleColumns.vendorId && (
                  <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', minWidth: '175px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Vendor ID</span>
                      {sortField === 'id' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ArrowUpDown size={13} style={{ color: '#94A3B8' }} />
                      )}
                    </div>
                  </th>
                )}
                {visibleColumns.vendorType && <th style={{ minWidth: '130px' }}>Vendor Type</th>}
                {visibleColumns.contactPerson && <th style={{ minWidth: '180px' }}>Contact Person</th>}
                {visibleColumns.location && (
                  <th onClick={() => handleSort('location')} style={{ cursor: 'pointer', minWidth: '190px' }}>
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
                {visibleColumns.services && <th style={{ minWidth: '150px' }}>Services</th>}
                {visibleColumns.verificationStatus && (
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', minWidth: '140px' }}>
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
                {visibleColumns.accountStatus && <th style={{ minWidth: '130px' }}>Account Status</th>}
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
                <th style={{ width: '80px', minWidth: '80px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="table-skeleton-row">
                    <td><div className="table-skeleton-cell" style={{ width: '16px', height: '16px' }} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`client-avatar-squircle ${['peach', 'purple', 'orange', 'blue', 'teal', 'red'][i % 6]}`} />
                        <div className="table-skeleton-cell" style={{ width: `${130 + (i % 3) * 30}px`, height: '14px' }} />
                      </div>
                    </td>
                    {visibleColumns.vendorId && <td><div className="table-skeleton-cell" style={{ width: '90px', height: '12px' }} /></td>}
                    {visibleColumns.vendorType && <td><div className="table-skeleton-cell" style={{ width: '75px', height: '18px', borderRadius: '4px' }} /></td>}
                    {visibleColumns.contactPerson && <td><div className="table-skeleton-cell" style={{ width: '110px', height: '12px' }} /></td>}
                    {visibleColumns.location && <td><div className="table-skeleton-cell" style={{ width: '80px', height: '12px' }} /></td>}
                    {visibleColumns.services && <td><div className="table-skeleton-cell" style={{ width: '95px', height: '12px' }} /></td>}
                    {visibleColumns.verificationStatus && <td><div className="table-skeleton-cell" style={{ width: '90px', height: '20px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.accountStatus && <td><div className="table-skeleton-cell" style={{ width: '60px', height: '20px', borderRadius: '12px' }} /></td>}
                    {visibleColumns.lastActivity && <td><div className="table-skeleton-cell" style={{ width: '100px', height: '12px' }} /></td>}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedVendors.length === 0 ? (
                <tr>
                  <td colSpan={11}>
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
                  const subIdentifier = vendor.gstin
                    ? `GSTIN: ${vendor.gstin}`
                    : vendor.pan
                    ? `PAN: ${vendor.pan}`
                    : 'Registered Partner';

                  const lastActivityDate = vendor.updated_at
                    ? new Date(vendor.updated_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr key={vendor.id} className={`client-data-row ${isSelected ? 'row-selected' : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          className="custom-table-checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(vendor.id)}
                        />
                      </td>

                      {/* Vendor Name & Avatar */}
                      <td>
                        <div className="client-info-cell">
                          <div className="vendor-initial-avatar" style={{ backgroundColor: avatarColor }}>
                            {initials}
                          </div>
                          <div>
                            <div
                              className="client-name-bold"
                              style={{ cursor: 'pointer' }}
                              onClick={() => onNavigateToProfile(vendor.id)}
                              title="Click to view vendor details"
                            >
                              {vendor.vendor_name}
                            </div>
                            <div className="client-id-sub">{subIdentifier}</div>
                          </div>
                        </div>
                      </td>

                      {/* Vendor ID */}
                      {visibleColumns.vendorId && (
                        <td>
                          <span className="mono-code">{vendorCode}</span>
                        </td>
                      )}

                      {/* Vendor Type */}
                      {visibleColumns.vendorType && (
                        <td>
                          <span className="vendor-type-pill">{vendor.vendor_type || 'Fleet Owner'}</span>
                        </td>
                      )}

                      {/* Contact Person */}
                      {visibleColumns.contactPerson && (
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}>
                              {vendor.contact_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              {vendor.contact_phone ? `+91 ${vendor.contact_phone.replace(/\D/g, '').slice(-10)}` : '—'}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Location */}
                      {visibleColumns.location && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#172B4D' }}>
                            <MapPin size={13} style={{ color: '#F05A22', flexShrink: 0 }} />
                            <span>{vendor.city ? `${vendor.city}, ${vendor.state || 'IN'}` : vendor.address || '—'}</span>
                          </div>
                        </td>
                      )}

                      {/* Services */}
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
                                className="service-tag-pill"
                                style={{ background: '#E2E8F0', color: '#475569', fontWeight: 700 }}
                                title={(vendor.services || []).slice(2).join(', ')}
                              >
                                +{(vendor.services || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Verification Status */}
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

                      {/* Account Status */}
                      {visibleColumns.accountStatus && (
                        <td>
                          <span className={isInactive || isRejected ? 'badge-account-inactive' : 'badge-account-active'}>
                            <span className={isInactive || isRejected ? 'status-dot-inactive' : 'status-dot-active'} />
                            {isInactive || isRejected ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                      )}

                      {/* Last Activity */}
                      {visibleColumns.lastActivity && (
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#64748B' }}>{lastActivityDate}</span>
                        </td>
                      )}

                      {/* Actions: Compact 3-Dot Menu */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            className="row-action-btn-circle"
                            onClick={() => setOpenActionMenuId(openActionMenuId === vendor.id ? null : vendor.id)}
                            title="Actions menu"
                            aria-expanded={openActionMenuId === vendor.id}
                          >
                            <MoreVertical size={15} />
                          </button>

                          {openActionMenuId === vendor.id && (
                            <div
                              className="vendor-action-menu-dropdown"
                              style={{
                                position: 'absolute',
                                right: 0,
                                ...(paginatedVendors.length > 2 && rowIndex >= paginatedVendors.length - 2
                                  ? { bottom: 'calc(100% + 4px)' }
                                  : { top: 'calc(100% + 4px)' }),
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
                                zIndex: 60,
                                width: '180px',
                                padding: '6px 0',
                                textAlign: 'left',
                              }}
                              role="menu"
                            >
                              <button
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
                                  setOpenActionMenuId(null);
                                  onNavigateToProfile(vendor.id);
                                }}
                              >
                                <Eye size={14} color="#64748B" />
                                <span>View Vendor</span>
                              </button>

                              <button
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
                                  setOpenActionMenuId(null);
                                  setEditingVendor(vendor);
                                  setShowEditVendorModal(true);
                                }}
                              >
                                <Edit size={14} color="#64748B" />
                                <span>Edit Vendor</span>
                              </button>

                              <button
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
                                  setOpenActionMenuId(null);
                                  onNavigateToProfile(vendor.id);
                                }}
                              >
                                <FileText size={14} color="#64748B" />
                                <span>Review Documents</span>
                              </button>

                              <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                              {!isApproved && (
                                <button
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
                                    setOpenActionMenuId(null);
                                    handleVerifyVendor(vendor.id, vendor.vendor_name);
                                  }}
                                >
                                  <ShieldCheck size={14} />
                                  <span>Verify Vendor</span>
                                </button>
                              )}

                              {vendor.status !== 'REJECTED' && (
                                <button
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
                                    setOpenActionMenuId(null);
                                    handleRejectVendor(vendor.id, vendor.vendor_name);
                                  }}
                                >
                                  <ShieldAlert size={14} />
                                  <span>Reject Verification</span>
                                </button>
                              )}

                              <button
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
                                  setOpenActionMenuId(null);
                                  handleToggleStatus(vendor.id, vendor.vendor_name, vendor.status);
                                }}
                              >
                                {isInactive ? <CheckCircle2 size={14} /> : <UserX size={14} />}
                                <span>{isInactive ? 'Activate Vendor' : 'Deactivate Vendor'}</span>
                              </button>
                            </div>
                          )}
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
          vendor={editingVendor}
          onClose={() => {
            setShowEditVendorModal(false);
            setEditingVendor(null);
          }}
          onSuccess={() => {
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
    </div>
  );
};

// ─── Complete Add Vendor Modal Component ──────────────────────────────────────
interface AddVendorModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
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
    fleetSize: '10',
    accountStatus: 'PENDING',
    onboardingNotes: '',
  });

  const [selectedServices, setSelectedServices] = useState<string[]>(['FTL', 'Container']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleService = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter((s) => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
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

    if (!formData.email.trim() || !formData.email.includes('@')) {
      errs.email = 'Valid Email Address is required.';
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

      // 1. Generate atomic NECL Vendor ID
      const vendorCode = await generateDbNeclId('VD');

      // 2. Insert Vendor Company
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
          },
        ])
        .select()
        .single();

      if (compErr) throw compErr;

      // 2. Insert Primary Contact User
      const { error: userErr } = await supabase.from('vendor_users').insert([
        {
          vendor_id: comp.id,
          full_name: formData.contactName.trim(),
          email: formData.email.trim(),
          mobile: formData.mobile.replace(/\D/g, ''),
          status: formData.accountStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING',
        },
      ]);

      if (userErr) throw userErr;

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
      <div className="client-modal-container" style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="client-modal-header">
          <div>
            <h3 className="client-modal-title">Register New Vendor</h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
              Onboard a verified logistics partner, transporter, or fleet owner.
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
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
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
                  <label className="field-label-req">Official Email Address *</label>
                  <input
                    type="email"
                    className="client-field-input"
                    placeholder="contact@company.com"
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

                <div className="form-field-group">
                  <label className="field-label-req">PIN Code *</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="client-field-input"
                    placeholder="6-digit PIN"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                  />
                  {errors.pincode && <div className="field-error-text">{errors.pincode}</div>}
                </div>
              </div>
            </div>

            {/* Section D: Services and Fleet */}
            <div className="create-section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D', margin: '0 0 12px 0' }}>
                D. Services and Fleet
              </h4>
              <div style={{ marginBottom: '12px' }}>
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

              <div className="form-field-group">
                <label className="field-label-opt">Approximate Fleet Size (Vehicles)</label>
                <input
                  type="number"
                  className="client-field-input"
                  placeholder="e.g. 15"
                  value={formData.fleetSize}
                  onChange={(e) => setFormData({ ...formData, fleetSize: e.target.value })}
                />
              </div>
            </div>

            {/* Section E & F: Account Settings */}
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
      </div>
    </div>
  );
};

// ─── Edit Vendor Modal Component ──────────────────────────────────────────────
interface EditVendorModalProps {
  vendor: VendorCompany;
  onClose: () => void;
  onSuccess: () => void;
}

const EditVendorModal: React.FC<EditVendorModalProps> = ({ vendor, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    vendorName: vendor.vendor_name || '',
    vendorType: vendor.vendor_type || 'Fleet Owner',
    gstin: vendor.gstin || '',
    pan: vendor.pan || '',
    address: vendor.address || '',
    status: vendor.status || 'PENDING',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorName.trim()) {
      setError('Vendor name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from('vendor_companies')
        .update({
          vendor_name: formData.vendorName.trim(),
          gstin: formData.gstin.trim().toUpperCase() || null,
          pan: formData.pan.trim().toUpperCase() || null,
          address: formData.address.trim(),
          status: formData.status as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (updErr) throw updErr;

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="client-modal-overlay">
      <div className="client-modal-container" style={{ maxWidth: '580px' }}>
        <div className="client-modal-header">
          <h3 className="client-modal-title">Edit Vendor: {vendor.vendor_name}</h3>
          <button className="client-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="client-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div className="error-alert-box">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-field-group">
              <label className="field-label-req">Vendor / Company Legal Name *</label>
              <input
                type="text"
                className="client-field-input"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              />
            </div>

            <div className="form-grid-2col">
              <div className="form-field-group">
                <label className="field-label-opt">GSTIN</label>
                <input
                  type="text"
                  maxLength={15}
                  className="client-field-input"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="form-field-group">
                <label className="field-label-opt">PAN</label>
                <input
                  type="text"
                  maxLength={10}
                  className="client-field-input"
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label-req">Address</label>
              <input
                type="text"
                className="client-field-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-field-group">
              <label className="field-label-req">Verification Status</label>
              <select
                className="client-field-input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="APPROVED">APPROVED (Verified)</option>
                <option value="PENDING">PENDING (Under Review)</option>
                <option value="REJECTED">REJECTED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div className="client-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-create-orange" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
