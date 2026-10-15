import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Clock,
  ShieldCheck,
  XCircle,
  Search,
  Filter,
  RotateCcw,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  MoreVertical,
  Calendar,
  Building2,
  Phone,
  MapPin,
  Check,
  X
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface VendorVerificationRequestsProps {
  onNavigateToDocumentApprovals: (vendorId?: string) => void;
  onNavigateToVendorProfile: (vendorId: string) => void;
}

export const VendorVerificationRequests: React.FC<VendorVerificationRequestsProps> = ({
  onNavigateToDocumentApprovals,
  onNavigateToVendorProfile,
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'under_verification' | 'rejected'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch vendor companies with their contacts and documents
      // Only include onboarding/verification candidates (PENDING, REJECTED, or UNDER_VERIFICATION)
      const { data: companies, error: compErr } = await supabase
        .from('vendor_companies')
        .select(`
          id,
          vendor_name,
          pan,
          gstin,
          address,
          status,
          onboarding_source,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (compErr) throw compErr;

      if (!companies || companies.length === 0) {
        setRequests([]);
        return;
      }

      // Fetch primary contacts
      const companyIds = companies.map((c) => c.id);
      const { data: users, error: userErr } = await supabase
        .from('vendor_users')
        .select('vendor_id, full_name, mobile, email, designation')
        .in('vendor_id', companyIds);

      if (userErr) {
        console.warn('Could not fetch vendor_users:', userErr);
      }

      const usersByVendor: Record<string, any> = {};
      (users || []).forEach((u) => {
        if (!usersByVendor[u.vendor_id]) {
          usersByVendor[u.vendor_id] = u;
        }
      });

      // Map to verification request rows
      // A company is considered a verification request if it is PENDING, REJECTED, or has documents to verify
      const verificationRequests = companies
        .filter((c) => c.status === 'PENDING' || c.status === 'PENDING_APPROVAL' || c.status === 'REJECTED' || c.onboarding_source === 'MOBILE_APP' || c.onboarding_source === 'SELF_REGISTERED' || c.onboarding_source === 'INVITED')
        .map((c) => {
          const contact = usersByVendor[c.id];
          let normalizedStatus: 'Pending Review' | 'Under Verification' | 'Rejected' = 'Pending Review';
          if (c.status === 'REJECTED') {
            normalizedStatus = 'Rejected';
          } else if (c.status === 'APPROVED') {
            normalizedStatus = 'Under Verification';
          } else {
            normalizedStatus = 'Pending Review';
          }

          // Extract city/location from address
          let location = 'Hyderabad';
          if (c.address) {
            const parts = c.address.split(',');
            location = parts[0].trim();
          }

          return {
            id: c.id,
            vendorIdDisplay: `VEN-${c.id.substring(0, 8).toUpperCase()}`,
            vendorName: c.vendor_name || 'Unnamed Vendor',
            vendorType: 'Fleet Owner',
            contactPerson: contact?.full_name || 'Primary Contact',
            contactPhone: contact?.mobile ? `+91 ${contact.mobile}` : '+91 9876543210',
            contactEmail: contact?.email || '',
            location: location || 'All India',
            submittedOn: new Date(c.created_at || Date.now()).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            submittedTime: new Date(c.created_at || Date.now()).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: normalizedStatus,
            rawStatus: c.status,
            rawCompany: c,
          };
        });

      setRequests(verificationRequests);
    } catch (err: any) {
      console.error('Failed to load vendor verification requests:', err);
      showToast('⚠️ Could not load verification requests from database.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const channel = supabase
      .channel('vendor_verification_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {
        loadRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        loadRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  // Unique locations from data
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.location) set.add(r.location);
    });
    return Array.from(set);
  }, [requests]);

  // Counts for KPI Cards and Tabs
  const kpis = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'Pending Review').length;
    const underVerification = requests.filter((r) => r.status === 'Under Verification').length;
    const rejected = requests.filter((r) => r.status === 'Rejected').length;
    return { total, pending, underVerification, rejected };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === 'pending' && r.status !== 'Pending Review') return false;
      if (activeTab === 'under_verification' && r.status !== 'Under Verification') return false;
      if (activeTab === 'rejected' && r.status !== 'Rejected') return false;

      // Status dropdown filter
      if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

      // Location filter
      if (locationFilter !== 'all' && r.location.toLowerCase() !== locationFilter.toLowerCase()) return false;

      // Vendor Type filter
      if (vendorTypeFilter !== 'all' && r.vendorType.toLowerCase() !== vendorTypeFilter.toLowerCase()) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.vendorName.toLowerCase().includes(q);
        const matchId = r.vendorIdDisplay.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
        const matchContact = r.contactPerson.toLowerCase().includes(q) || r.contactPhone.includes(q);
        const matchLoc = r.location.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchContact && !matchLoc) return false;
      }

      return true;
    });
  }, [requests, activeTab, statusFilter, locationFilter, vendorTypeFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedRequests.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setLocationFilter('all');
    setVendorTypeFilter('all');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredRequests.length === 0) {
      showToast('⚠️ No verification requests to export.');
      return;
    }
    const headers = ['Vendor ID,Vendor Name,Type,Contact Person,Phone,Location,Submitted On,Status\n'];
    const rows = filteredRequests.map(
      (r) =>
        `"${r.vendorIdDisplay}","${r.vendorName}","${r.vendorType}","${r.contactPerson}","${r.contactPhone}","${r.location}","${r.submittedOn} ${r.submittedTime}","${r.status}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_verification_requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Exported verification requests CSV successfully.');
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Toast Alert */}
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
            <span>Vendors</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Vendor Verification Requests</span>
          </div>
          <h1 className="client-directory-title">Vendor Verification Requests</h1>
          <p className="client-directory-desc">
            Review and verify new vendor registrations submitted through the mobile app.
          </p>
        </div>
      </div>

      {/* 4 Equal-Width KPI Cards Matching Screenshot 1 */}
      <div className="client-kpi-bar">
        {/* Total Requests */}
        <div
          className={`kpi-stat-card ${activeTab === 'all' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('all');
            setCurrentPage(1);
          }}
        >
          <div className="kpi-avatar-squircle orange">
            <FileText size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Requests</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.total}
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('pending');
            setCurrentPage(1);
          }}
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

        {/* Under Verification */}
        <div
          className={`kpi-stat-card ${activeTab === 'under_verification' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('under_verification');
            setCurrentPage(1);
          }}
        >
          <div className="kpi-avatar-squircle blue">
            <ShieldCheck size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Under Verification</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.underVerification}
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div
          className={`kpi-stat-card ${activeTab === 'rejected' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('rejected');
            setCurrentPage(1);
          }}
        >
          <div className="kpi-avatar-squircle red">
            <XCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Rejected</span>
              <ChevronRight size={14} className="kpi-chevron" />
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.rejected}
            </div>
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
            placeholder="Search by vendor name, vendor ID, contact, or location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Status Dropdown */}
        <div className="filter-dropdown-wrap">
          <select
            className="filter-dropdown"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Under Verification">Under Verification</option>
            <option value="Rejected">Rejected</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Locations Dropdown */}
        <div className="filter-dropdown-wrap">
          <select
            className="filter-dropdown"
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Vendor Types Dropdown */}
        <div className="filter-dropdown-wrap">
          <select
            className="filter-dropdown"
            value={vendorTypeFilter}
            onChange={(e) => {
              setVendorTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Vendor Types</option>
            <option value="Fleet Owner">Fleet Owner</option>
            <option value="Broker / Aggregator">Broker / Aggregator</option>
            <option value="Fleet Operator">Fleet Operator</option>
            <option value="Independent Truck Owner">Independent Truck Owner</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Reset Button */}
        <button className="btn-filter-reset" onClick={handleResetFilters} title="Reset filters">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Sub-bar: Status Tabs & Actions */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          <button
            className={`status-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            All Requests ({kpis.total})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
          >
            Pending Review ({kpis.pending})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'under_verification' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('under_verification');
              setCurrentPage(1);
            }}
          >
            Under Verification ({kpis.underVerification})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rejected');
              setCurrentPage(1);
            }}
          >
            Rejected ({kpis.rejected})
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
        {loading ? (
          <div className="empty-loading-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <RefreshCw size={24} className="spin-icon" style={{ color: '#F05A22' }} />
            <p style={{ marginTop: '12px', color: '#64748B', fontSize: '13.5px', fontWeight: 600 }}>
              Loading vendor verification requests...
            </p>
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div
            style={{
              padding: '64px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '16px',
                background: '#FFF3E8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#F05A22',
              }}
            >
              <FileText size={36} strokeWidth={1.75} />
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px' }}>
              No vendor verification requests found
            </h3>

            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px', maxWidth: '440px' }}>
              New vendor registrations from the mobile app will appear here for your review.
            </p>

            <button
              onClick={loadRequests}
              style={{
                background: '#F05A22',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '13.5px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(240, 90, 34, 0.25)',
              }}
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="client-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="custom-table-checkbox"
                      onChange={handleSelectAll}
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === paginatedRequests.length
                      }
                    />
                  </th>
                  <th style={{ width: '42px' }}>#</th>
                  <th>Vendor ⇅</th>
                  <th>Vendor ID ⇅</th>
                  <th>Type ⇅</th>
                  <th>Contact Person ⇅</th>
                  <th>Location ⇅</th>
                  <th>Submitted On ⇅</th>
                  <th>Verification Status ⇅</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((req, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={req.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="custom-table-checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => handleToggleSelect(req.id)}
                        />
                      </td>
                      <td>{rowNum}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              background: '#FFF5F0',
                              color: '#F05A22',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '14px',
                              flexShrink: 0,
                            }}
                          >
                            {req.vendorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: '#172B4D',
                                fontSize: '13.5px',
                                cursor: 'pointer',
                              }}
                              onClick={() => onNavigateToVendorProfile(req.id)}
                            >
                              {req.vendorName}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                              PAN: {req.pan || 'N/A'} • GST: {req.gstin || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: '12.5px' }}>
                          {req.vendorIdDisplay}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            background: '#EFF6FF',
                            color: '#1E40AF',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                          }}
                        >
                          {req.vendorType}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}>
                            {req.contactPerson}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            {req.contactPhone}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '12.5px' }}>
                          <MapPin size={13} color="#F05A22" />
                          <span>{req.location}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div style={{ color: '#172B4D', fontSize: '12.5px', fontWeight: 600 }}>
                            {req.submittedOn}
                          </div>
                          <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                            {req.submittedTime}
                          </div>
                        </div>
                      </td>
                      <td>
                        {req.status === 'Pending Review' && (
                          <span
                            style={{
                              background: '#FFFBEB',
                              color: '#92400E',
                              border: '1px solid #FDE68A',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} />
                            Pending Review
                          </span>
                        )}
                        {req.status === 'Under Verification' && (
                          <span
                            style={{
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              border: '1px solid #BFDBFE',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6' }} />
                            Under Verification
                          </span>
                        )}
                        {req.status === 'Rejected' && (
                          <span
                            style={{
                              background: '#FEF2F2',
                              color: '#991B1B',
                              border: '1px solid #FECACA',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            title="Review Documents"
                            style={{
                              background: '#FFF1E8',
                              color: '#F05A22',
                              border: '1px solid #FFD9C6',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onClick={() => onNavigateToDocumentApprovals(req.id)}
                          >
                            <span>Review</span>
                            <ArrowRight size={13} />
                          </button>
                          <button
                            title="View Profile"
                            style={{
                              background: '#FFFFFF',
                              color: '#64748B',
                              border: '1px solid #CBD5E1',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onClick={() => onNavigateToVendorProfile(req.id)}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        <div className="pagination-row">
          <div className="pagination-info">
            Showing {filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredRequests.length)} of {filteredRequests.length} requests
          </div>

          <div className="pagination-controls">
            <button
              className="page-nav-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
