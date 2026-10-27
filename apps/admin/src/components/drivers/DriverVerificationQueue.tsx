import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { DriverLicenceAudit } from './DriverLicenceAudit';
import { formatDisplayId, generateDbNeclId } from '../../utils/idGenerator';
import { optimizeFileForUpload } from '../../utils/fileCompressor';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface DriverVerificationQueueProps {
  onAuditDriver: (driverId: string) => void;
}

export const DriverVerificationQueue: React.FC<DriverVerificationQueueProps> = ({
  onAuditDriver,
}) => {
  const { hasPermission, adminProfile } = useAuth();
  const canDelete = hasPermission('drivers', 'delete') || adminProfile?.role === 'SUPER_ADMIN' || adminProfile?.role === 'ADMIN';

  const [drivers, setDrivers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Driver State
  const [deletingDriver, setDeletingDriver] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

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
      setToastMessage(`Driver "${deletingDriver.full_name || deletingDriver.name}" and all associated data permanently deleted.`);
      setTimeout(() => setToastMessage(null), 4000);
      setDeletingDriver(null);
      setDeleteReason('');
    } catch (err: any) {
      console.error('Delete driver error:', err);
      alert(`Error deleting driver: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Driver Licence Audit Modal State
  const [selectedAuditDriver, setSelectedAuditDriver] = useState<any | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Create Driver Account Modal State (Email NOT required / removed)
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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('pending');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      await ensureAdminSession();

      const [driversRes, vendorsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*, vendor_companies:primary_vendor_id(id, vendor_name, vendor_code)')
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_companies')
          .select('id, vendor_name')
      ]);

      let fetchedDrivers = driversRes.data || [];
      if (driversRes.error || fetchedDrivers.length === 0) {
        try {
          const apiRes = await apiFetch('/admin/drivers');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.data && Array.isArray(json.data)) {
              fetchedDrivers = json.data;
            }
          }
        } catch {}
      }

      setDrivers(fetchedDrivers);

      const fetchedVendors = vendorsRes.data || [];
      setVendors(fetchedVendors);
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
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();

    const channel = supabase
      .channel('driver_verification_queue_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          console.log('[DriverQueue Realtime] drivers change detected:', payload.eventType);
          loadDrivers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          console.log('[DriverQueue Realtime] documents change detected:', payload.eventType);
          loadDrivers();
        }
      )
      .subscribe((status) => {
        console.log('[DriverQueue Realtime] Channel status:', status);
      });

    const pollInterval = setInterval(() => {
      loadDrivers();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadDrivers]);

  // Load vehicles linked to selected vendor for optional vehicle assignment
  useEffect(() => {
    if (!createFormData.primaryVendorId) {
      setVendorVehicles([]);
      setSelectedVehicleId('');
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const { data: vLinks } = await supabase
          .from('vendor_vehicle_links')
          .select('vehicle_id, vehicle:vehicles(*)')
          .eq('vendor_id', createFormData.primaryVendorId);
        if (isMounted) {
          const vehs = (vLinks || []).map((l: any) => l.vehicle).filter(Boolean);
          setVendorVehicles(vehs);
        }
      } catch (err) {
        console.warn('Could not load vehicles for vendor:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [createFormData.primaryVendorId]);

  const kpis = useMemo(() => {
    const total = drivers.length;
    const pending = drivers.filter(d => d.status === 'PENDING' || d.status === 'PENDING_APPROVAL').length;
    const approved = drivers.filter(d => d.status === 'APPROVED').length;
    const rejected = drivers.filter(d => d.status === 'REJECTED').length;
    
    const today = new Date();
    const expired = drivers.filter(d => {
      if (!d.licence_expiry_date) return false;
      const expiry = new Date(d.licence_expiry_date);
      return expiry < today;
    }).length;

    return { total, pending, approved, rejected, expired };
  }, [drivers]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      // Tab filter
      if (activeTab === 'pending' && d.status !== 'PENDING' && d.status !== 'PENDING_APPROVAL') return false;
      if (activeTab === 'approved' && d.status !== 'APPROVED') return false;
      if (activeTab === 'rejected' && d.status !== 'REJECTED') return false;
      if (activeTab === 'expired') {
        const today = new Date();
        const expiry = d.licence_expiry_date ? new Date(d.licence_expiry_date) : null;
        if (!expiry || expiry >= today) return false;
      }

      // Status dropdown
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && d.status !== 'PENDING' && d.status !== 'PENDING_APPROVAL') return false;
        else if (statusFilter !== 'pending' && d.status !== statusFilter.toUpperCase()) return false;
      }

      // Vendor filter
      if (vendorFilter !== 'all' && d.primary_vendor_id !== vendorFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const driverCode = formatDisplayId('DR', d.driver_code || d.id, d.created_at).toLowerCase();
        const matchName = d.full_name?.toLowerCase().includes(q);
        const matchMobile = d.mobile?.toLowerCase().includes(q);
        const matchLicence = d.licence_number?.toLowerCase().includes(q);
        const matchId = d.id?.toLowerCase().includes(q) || driverCode.includes(q);
        if (!matchName && !matchMobile && !matchLicence && !matchId) return false;
      }

      return true;
    });
  }, [drivers, activeTab, statusFilter, vendorFilter, searchQuery]);

  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDrivers.slice(start, start + pageSize);
  }, [filteredDrivers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredDrivers.length / pageSize) || 1;

  const getVendorName = (vendorId: string, driver?: any) => {
    if (driver?.vendor_companies?.vendor_name) {
      return driver.vendor_companies.vendor_name;
    }
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.vendor_name || (vendorId ? 'Verified Transporter' : 'Independent / Unattached');
  };

  const getLicenceStatus = (driver: any) => {
    if (!driver.licence_expiry_date) return { label: 'No Expiry', color: 'gray' };
    
    const today = new Date();
    const expiry = new Date(driver.licence_expiry_date);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysLeft < 0) return { label: 'Expired', color: 'red' };
    if (daysLeft < 7) return { label: `${daysLeft} days left`, color: 'red' };
    if (daysLeft < 30) return { label: `${daysLeft} days left`, color: 'amber' };
    return { label: 'Valid', color: 'green' };
  };

  const handleExport = () => {
    if (filteredDrivers.length === 0) {
      showToast('No drivers to export');
      return;
    }
    const headers = ['Driver ID', 'Name', 'Mobile', 'Licence Number', 'Expiry Date', 'Status', 'Vendor'];
    const rows = filteredDrivers.map(d => [
      formatDisplayId('DR', d.driver_code || d.id, d.created_at),
      d.full_name,
      d.mobile,
      d.licence_number,
      d.licence_expiry_date || '',
      d.status,
      getVendorName(d.primary_vendor_id),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast(`✅ Exported ${filteredDrivers.length} drivers`);
  };

  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setVendorFilter('all');
    setActiveTab('pending');
    setCurrentPage(1);
    showToast('Filters reset');
  };

  const handleCreateDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!createFormData.fullName.trim()) {
      errs.fullName = 'Full Name is required.';
    }

    const cleanMobile = createFormData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) {
      errs.mobile = '10-digit mobile number is required.';
    }

    if (!createFormData.dateOfBirth.trim()) {
      errs.dateOfBirth = 'Date of Birth is required.';
    }

    if (!createFormData.licenceNumber.trim()) {
      errs.licenceNumber = 'Driving Licence Number is required.';
    }

    if (!createFormData.primaryVendorId) {
      errs.primaryVendorId = 'Connected Vendor selection is required.';
    }

    // Server-side check for duplicate mobile
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
      } catch (e) {
        // network timeout fallback
      }
    }

    const ageInfo = calculateAge(createFormData.dateOfBirth);
    if (ageInfo.age !== null && ageInfo.age < 18) {
      errs.dateOfBirth = 'Driver must be at least 18 years old.';
    }

    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreatingDriver(true);
    try {
      const driverCode = await generateDbNeclId('DR');
      const { data, error } = await supabase.from('drivers').insert([
        {
          driver_code: driverCode,
          full_name: createFormData.fullName.trim(),
          mobile: cleanMobile,
          phone: cleanMobile,
          date_of_birth: createFormData.dateOfBirth,
          dob: createFormData.dateOfBirth,
          licence_number: createFormData.licenceNumber.trim().toUpperCase(),
          primary_vendor_id: createFormData.primaryVendorId,
          status: createFormData.status,
        },
      ]).select().single();

      if (error) throw error;

      if (data?.id) {
        const driverId = data.id;

        // If vehicle selected, associate driver to vehicle
        if (selectedVehicleId) {
          try {
            await supabase
              .from('vehicles')
              .update({ assigned_driver_id: driverId })
              .eq('id', selectedVehicleId);
          } catch (vehErr) {
            console.warn('Vehicle driver association notice:', vehErr);
          }
        }

        // Upload and insert documents if attached
        const docConfigs: Array<{ file: File | null | undefined; type: string; side: 'FRONT' | 'BACK'; label: string }> = [
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
              if (!upErr && upData) {
                publicUrl = storagePath;
              }
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

      showToast(`✅ Driver account created successfully (${createFormData.fullName})!`);
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
      loadDrivers();
    } catch (err: any) {
      setCreateErrors({ global: err.message || 'Failed to create driver account.' });
    } finally {
      setIsCreatingDriver(false);
    }
  };

  return (
    <div className="driver-verification-page-wrapper">
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="client-header-hero">
        <div className="client-header-truck-bg">
          <div className="client-header-truck-overlay" />
        </div>

        <div className="client-header-info">
          <div className="client-header-breadcrumbs">
            <span>Drivers</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Verification Queue</span>
          </div>
          <h1 className="client-directory-title">Driver Verification Queue</h1>
          <p className="client-directory-desc">
            Review and audit driver licence documents, identity credentials and regulatory compliance.
          </p>
        </div>

        <div className="client-header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            id="btn-create-driver"
            className="btn-create-orange"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={15} />
            <span>+ Create Driver Account</span>
          </button>
          <button
            className="btn-create-orange"
            style={{ background: '#FFFFFF', color: '#172B4D', border: '1px solid #CBD5E1' }}
            onClick={() => loadDrivers()}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* 4 Equal-Width KPI Cards */}
      <div className="client-kpi-bar">
        {/* Pending Review */}
        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
        >
          <div className="kpi-avatar-squircle orange">
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Pending Review</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.pending}
            </div>
          </div>
        </div>

        {/* Verified Drivers */}
        <div
          className={`kpi-stat-card ${activeTab === 'approved' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
        >
          <div className="kpi-avatar-squircle green">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Verified Drivers</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.approved}
            </div>
          </div>
        </div>

        {/* Rejected Drivers */}
        <div
          className={`kpi-stat-card ${activeTab === 'rejected' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
        >
          <div className="kpi-avatar-squircle red">
            <XCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Rejected Drivers</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.rejected}
            </div>
          </div>
        </div>

        {/* Expired Licence */}
        <div
          className={`kpi-stat-card ${activeTab === 'expired' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('expired'); setCurrentPage(1); }}
        >
          <div className="kpi-avatar-squircle amber">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Expired Licence</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.expired}
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
            placeholder="Search by driver name, mobile, licence..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="filter-input"
          />
        </div>

        <div className="filter-dropdown-wrap">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="filter-dropdown"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        <div className="filter-dropdown-wrap">
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
            className="filter-dropdown"
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.vendor_name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        <button className="btn-filter-reset" onClick={handleReset} title="Reset filters">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        <button className="btn-filter-search" onClick={() => setCurrentPage(1)}>
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* Sub-bar: Status Tabs & Export */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          <button
            className={`status-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
          >
            Pending Review
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
          >
            Verified
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
          >
            Rejected
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => { setActiveTab('expired'); setCurrentPage(1); }}
          >
            Expired Licence
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          >
            All Drivers
          </button>
        </div>

        <div className="table-actions-group">
          <button className="btn-action-outline" onClick={handleExport}>
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="client-table-card">
        <div className="table-wrapper">
          <table className="client-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" className="custom-table-checkbox" />
                </th>
                <th>Driver Name ⇅</th>
                <th>Driver ID ⇅</th>
                <th>Mobile ⇅</th>
                <th>Date of Birth ⇅</th>
                <th>Vendor ⇅</th>
                <th>Submission Date ⇅</th>
                <th>Status ⇅</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                        <div className="table-skeleton-cell" style={{ width: `${120 + (i % 3) * 30}px`, height: '14px' }} />
                      </div>
                    </td>
                    <td><div className="table-skeleton-cell" style={{ width: '80px', height: '12px' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: '100px', height: '12px' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: '120px', height: '12px' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: '85px', height: '12px' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: '90px', height: '12px' }} /></td>
                    <td><div className="table-skeleton-cell" style={{ width: '60px', height: '22px', borderRadius: '12px' }} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                        <div className="table-skeleton-cell" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty-state">
                      <div className="empty-state-icon-box">
                        <Users size={32} />
                      </div>
                      <h4 className="empty-state-heading">No drivers found</h4>
                      <p className="empty-state-text">
                        {searchQuery || statusFilter !== 'all' || vendorFilter !== 'all'
                          ? 'No driver records match the selected filter criteria. Try resetting filters.'
                          : 'No drivers found in the database.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver, idx) => {
                  const isPending = driver.status === 'PENDING' || driver.status === 'PENDING_APPROVAL';
                  const isApproved = driver.status === 'APPROVED';
                  const isRejected = driver.status === 'REJECTED';
                  const licenceStatus = getLicenceStatus(driver);
                  const colorThemes = ['peach', 'purple', 'orange', 'blue', 'teal', 'red'];
                  const theme = colorThemes[idx % colorThemes.length];

                  return (
                    <tr key={driver.id} className="client-data-row">
                      <td>
                        <input type="checkbox" className="custom-table-checkbox" />
                      </td>
                      <td>
                        <div className="client-info-cell">
                          <div className={`client-avatar-squircle ${theme}`}>
                            <Users size={16} />
                          </div>
                          <div>
                            <div className="client-name-bold">{driver.full_name}</div>
                            <div className="client-id-sub">{formatDisplayId('DR', driver.driver_code || driver.id, driver.created_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="mono-code">{formatDisplayId('DR', driver.driver_code || driver.id, driver.created_at)}</span>
                      </td>
                      <td>{driver.mobile || driver.phone}</td>
                      <td>
                        {driver.date_of_birth || driver.dob
                          ? new Date(driver.date_of_birth || driver.dob).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td>
                        <span className="table-cell-sub">{getVendorName(driver.primary_vendor_id, driver)}</span>
                      </td>
                      <td>
                        {driver.created_at
                          ? new Date(driver.created_at).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td>
                        <span className={`status-badge-pastel ${
                          isApproved ? 'active' : isPending ? 'pending' : isRejected ? 'inactive' : 'draft'
                        }`}>
                          {isApproved ? 'Approved' : isPending ? 'Pending Approval' : isRejected ? 'Rejected' : driver.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions-group">
                          <button
                            className="row-action-btn-circle"
                            title="Audit Licence & Documents"
                            onClick={() => {
                              setSelectedAuditDriver(driver);
                              setIsAuditModalOpen(true);
                              onAuditDriver(driver.id);
                            }}
                          >
                            <FileCheck size={14} />
                          </button>
                          <button
                            className="row-action-btn-circle"
                            title="View Driver Details"
                            onClick={() => {
                              setSelectedAuditDriver(driver);
                              setIsAuditModalOpen(true);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          {canDelete && (
                            <button
                              className="row-action-btn-circle"
                              title="Delete Driver"
                              style={{ color: '#DC2626' }}
                              onClick={() => setDeletingDriver(driver)}
                            >
                              <Trash2 size={14} />
                            </button>
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

        {/* Pagination */}
        <div className="pagination-row">
          <div className="pagination-info">
            Showing {filteredDrivers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredDrivers.length)} of {filteredDrivers.length} drivers
          </div>

          <div className="pagination-controls">
            <button
              className="page-nav-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
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
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            >
              ›
            </button>

            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Driver Licence Audit Modal */}
      {isAuditModalOpen && selectedAuditDriver && (
        <DriverLicenceAudit
          driver={selectedAuditDriver}
          vendorName={getVendorName(selectedAuditDriver.primary_vendor_id)}
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setSelectedAuditDriver(null);
          }}
          onVerificationComplete={(updated) => {
            setDrivers((prev) =>
              prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
            );
            showToast(`Driver ${updated.full_name} status updated to ${updated.status}`);
          }}
        />
      )}

      {/* Create Driver Account Modal (No Email Address Field) */}
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
                        {v.vendor_name}
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

                {/* KYC Identity & Licence Documents */}
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

      {/* Permanent Delete Driver Confirmation Dialog */}
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

