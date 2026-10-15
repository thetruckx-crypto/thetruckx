import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Search,
  Filter,
  RotateCcw,
  Download,
  Eye,
  X,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Check,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Truck,
  User,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface DocumentApprovalsProps {
  initialVendorId?: string;
  onNavigateToVendorProfile: (vendorId: string) => void;
}

export const VendorDocumentApprovals: React.FC<DocumentApprovalsProps> = ({
  initialVendorId,
  onNavigateToVendorProfile,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected document for review drawer (Right side)
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch documents
      let docQuery = supabase
        .from('documents')
        .select(`
          id,
          reference_id,
          document_type,
          file_url,
          verification_status,
          verified_by,
          rejection_reason,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (initialVendorId) {
        docQuery = docQuery.eq('reference_id', initialVendorId);
      }

      const { data: docData, error: docErr } = await docQuery;
      if (docErr) throw docErr;

      // 2. Fetch all vendors for metadata joining
      const { data: vendors } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, gstin, pan, status');

      const vendorMap = new Map<string, any>();
      (vendors || []).forEach((v) => vendorMap.set(v.id, v));

      const mapped = (docData || []).map((d) => {
        const v = vendorMap.get(d.reference_id);
        const vendorName = v?.vendor_name || 'Vendor Partner';
        const vendorIdDisplay = `VEN-${(d.reference_id || d.id).substring(0, 8).toUpperCase()}`;

        // Determine friendly document name and related entity
        let friendlyType = 'Business Registration';
        let relatedTo: 'Vendor' | 'Vehicle' | 'Driver' = 'Vendor';
        const rawType = (d.document_type || '').toUpperCase();

        if (rawType.includes('PAN')) {
          friendlyType = 'PAN Card';
          relatedTo = 'Vendor';
        } else if (rawType.includes('RC') || rawType.includes('VEHICLE')) {
          friendlyType = 'Vehicle RC';
          relatedTo = 'Vehicle';
        } else if (rawType.includes('INSURANCE')) {
          friendlyType = 'Insurance Certificate';
          relatedTo = 'Vehicle';
        } else if (rawType.includes('DL') || rawType.includes('DRIVER') || rawType.includes('LICENSE')) {
          friendlyType = 'Driver License';
          relatedTo = 'Driver';
        } else if (rawType.includes('FITNESS')) {
          friendlyType = 'Fitness Certificate';
          relatedTo = 'Vehicle';
        } else if (rawType.includes('GST') || rawType.includes('BUSINESS')) {
          friendlyType = 'Business Registration';
          relatedTo = 'Vendor';
        }

        const dateObj = new Date(d.created_at || Date.now());
        const dateStr = dateObj.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const timeStr = dateObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Expiry Date (calculated or 1 yr from uploaded)
        const expiryObj = new Date(dateObj);
        expiryObj.setFullYear(expiryObj.getFullYear() + 1);
        const expiryStr = expiryObj.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        let normStatus: 'Verified' | 'Pending' | 'Rejected' | 'Expired' = 'Pending';
        if (d.verification_status === 'VERIFIED' || d.verification_status === 'APPROVED') {
          normStatus = 'Verified';
        } else if (d.verification_status === 'REJECTED') {
          normStatus = 'Rejected';
        } else if (d.verification_status === 'EXPIRED') {
          normStatus = 'Expired';
        }

        return {
          id: d.id,
          referenceId: d.reference_id,
          documentType: friendlyType,
          fileName: `${friendlyType.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          fileUrl: d.file_url || null,
          vendorName,
          vendorIdDisplay,
          relatedTo,
          uploadedOn: `${dateStr} ${timeStr}`,
          uploadedDateOnly: dateStr,
          uploadedTimeOnly: timeStr,
          expiryDate: expiryStr,
          referenceNo: v?.gstin ? `GSTIN-${v.gstin}` : v?.pan ? `PAN-${v.pan}` : `REF-${d.id.substring(0, 10).toUpperCase()}`,
          status: normStatus,
          verifiedBy: d.verified_by || 'Rahul (Admin)',
          verifiedAt: (d as any).verified_at ? `${new Date((d as any).verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date((d as any).verified_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : null,
          rejectionReason: d.rejection_reason || null,
        };
      });

      setDocuments(mapped);

      // Auto-select first doc for review drawer if none selected
      setSelectedDoc((prev: any) => {
        if (!prev) return mapped[0] || null;
        const found = mapped.find((m) => m.id === prev.id);
        return found || mapped[0] || null;
      });
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      showToast('⚠️ Could not load documents from database.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [initialVendorId]);

  useEffect(() => {
    loadDocuments();

    const channel = supabase
      .channel('vendor_documents_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => loadDocuments()
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      loadDocuments();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadDocuments]);

  // Counts for KPI Cards and Tabs
  const kpis = useMemo(() => {
    const total = documents.length;
    const pending = documents.filter((d) => d.status === 'Pending').length;
    const approved = documents.filter((d) => d.status === 'Verified').length;
    const rejected = documents.filter((d) => d.status === 'Rejected').length;
    const expired = documents.filter((d) => d.status === 'Expired').length;
    return { total, pending, approved, rejected, expired };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      // Tab filter
      if (activeTab === 'pending' && d.status !== 'Pending') return false;
      if (activeTab === 'approved' && d.status !== 'Verified') return false;
      if (activeTab === 'rejected' && d.status !== 'Rejected') return false;
      if (activeTab === 'expired' && d.status !== 'Expired') return false;

      // Dropdown status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Pending' && d.status !== 'Pending') return false;
        if (statusFilter === 'Verified' && d.status !== 'Verified') return false;
        if (statusFilter === 'Rejected' && d.status !== 'Rejected') return false;
        if (statusFilter === 'Expired' && d.status !== 'Expired') return false;
      }

      // Doc Type filter
      if (docTypeFilter !== 'all' && d.documentType.toLowerCase() !== docTypeFilter.toLowerCase()) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = d.vendorName.toLowerCase().includes(q);
        const matchId = d.vendorIdDisplay.toLowerCase().includes(q);
        const matchDoc = d.documentType.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
        const matchRef = d.referenceNo.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDoc && !matchRef) return false;
      }

      return true;
    });
  }, [documents, activeTab, statusFilter, docTypeFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedDocuments.map((d) => d.id)));
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
    setDocTypeFilter('all');
    setStatusFilter('all');
    setVendorTypeFilter('all');
    setDateRangeFilter('');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const handleApproveDocument = async () => {
    if (!selectedDoc) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          verification_status: 'APPROVED',
          verified_by: 'Rahul (Admin)',
          rejection_reason: null,
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

      showToast(`✅ ${selectedDoc.documentType} approved successfully.`);
      setSelectedDoc({
        ...selectedDoc,
        status: 'Approved',
        verifiedBy: 'Rahul (Admin)',
        verifiedAt: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      });
      loadDocuments();
    } catch (err: any) {
      console.error('Failed to approve document:', err);
      showToast(`❌ Approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDoc) return;
    if (!remarks.trim()) {
      showToast('⚠️ Please enter verification remarks / rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          verification_status: 'REJECTED',
          verified_by: 'Rahul (Admin)',
          rejection_reason: remarks.trim(),
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

      showToast(`❌ ${selectedDoc.documentType} rejected.`);
      setSelectedDoc({
        ...selectedDoc,
        status: 'Rejected',
        rejectionReason: remarks.trim(),
      });
      loadDocuments();
    } catch (err: any) {
      console.error('Failed to reject document:', err);
      showToast(`❌ Rejection failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportReport = () => {
    if (filteredDocuments.length === 0) {
      showToast('⚠️ No documents to export.');
      return;
    }
    const headers = ['Document ID,Type,File Name,Vendor Name,Vendor ID,Related To,Uploaded On,Status,Reference No\n'];
    const rows = filteredDocuments.map(
      (d) =>
        `"${d.id}","${d.documentType}","${d.fileName}","${d.vendorName}","${d.vendorIdDisplay}","${d.relatedTo}","${d.uploadedOn}","${d.status}","${d.referenceNo}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_document_approvals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Exported document approvals report.');
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
            <span className="breadcrumb-current">Document Approvals</span>
          </div>
          <h1 className="client-directory-title">Vendor Document Approvals</h1>
          <p className="client-directory-desc">
            Review, verify and approve vendor documents submitted through the mobile app.
          </p>
        </div>

        <div className="client-header-actions">
          <button className="btn-create-orange" onClick={handleExportReport}>
            <Download size={16} strokeWidth={2.5} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 5 Equal-Width KPI Cards Matching Screenshot 4 */}
      <div className="client-kpi-bar" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* Total Documents */}
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
              <span className="kpi-title">Total Documents</span>
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
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.pending}
            </div>
          </div>
        </div>

        {/* Approved */}
        <div
          className={`kpi-stat-card ${activeTab === 'approved' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('approved');
            setCurrentPage(1);
          }}
        >
          <div className="kpi-avatar-squircle green">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Approved</span>
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.approved}
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
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.rejected}
            </div>
          </div>
        </div>

        {/* Expired */}
        <div
          className={`kpi-stat-card ${activeTab === 'expired' ? 'active-border' : ''}`}
          onClick={() => {
            setActiveTab('expired');
            setCurrentPage(1);
          }}
        >
          <div className="kpi-avatar-squircle red">
            <Calendar size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Expired</span>
            </div>
            <div className="kpi-value">
              {loading ? <div className="kpi-bar-skeleton" /> : kpis.expired}
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
            placeholder="Search by vendor name, vendor ID, document type, or reference..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button className="filter-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Document Type Dropdown */}
        <div className="filter-dropdown-wrap">
          <select
            className="filter-dropdown"
            value={docTypeFilter}
            onChange={(e) => {
              setDocTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Document Types</option>
            <option value="Business Registration">Business Registration</option>
            <option value="PAN Card">PAN Card</option>
            <option value="Vehicle RC">Vehicle RC</option>
            <option value="Insurance Certificate">Insurance Certificate</option>
            <option value="Driver License">Driver License</option>
            <option value="Fitness Certificate">Fitness Certificate</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Verification Status Dropdown */}
        <div className="filter-dropdown-wrap">
          <select
            className="filter-dropdown"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Verification Status</option>
            <option value="Pending">Pending Review</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
            <option value="Expired">Expired</option>
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Vendor Type Dropdown */}
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
          </select>
          <ChevronDown size={14} className="dropdown-arrow-icon" />
        </div>

        {/* Reset Button */}
        <button className="btn-filter-reset" onClick={handleResetFilters} title="Reset all filters">
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Sub-Bar: Tabs & Actions */}
      <div className="table-sub-bar">
        <div className="status-tabs-group">
          <button
            className={`status-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            All Documents ({kpis.total})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
          >
            Pending ({kpis.pending})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('approved');
              setCurrentPage(1);
            }}
          >
            Approved ({kpis.approved})
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
          <button
            className={`status-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('expired');
              setCurrentPage(1);
            }}
          >
            Expired ({kpis.expired})
          </button>
        </div>

        <div className="table-actions-group">
          <button className="btn-action-outline" onClick={handleExportReport}>
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Split Layout: Left Table + Right Document Review Drawer */}
      <div className="doc-approvals-split-layout">
        {/* Left Side: Document Table Surface Card */}
        <div className="client-table-card" style={{ margin: 0, minWidth: 0, width: '100%' }}>
          <div className="table-wrapper">
          {loading ? (
            <div className="empty-loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <p>Loading documents for verification...</p>
            </div>
          ) : paginatedDocuments.length === 0 ? (
            <div className="table-empty-state">
              <div className="empty-state-icon-box">
                <FileText size={32} />
              </div>
              <h4 className="empty-state-heading">No vendor documents found</h4>
              <p className="empty-state-text">
                Documents uploaded by vendors during registration will appear here for review.
              </p>
              <button
                onClick={loadDocuments}
                className="btn-create-orange"
                style={{ margin: '0 auto' }}
              >
                <RefreshCw size={14} />
                <span>Refresh Documents</span>
              </button>
            </div>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', paddingLeft: '16px' }}>
                    <input
                      type="checkbox"
                      className="custom-table-checkbox"
                      onChange={handleSelectAll}
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === paginatedDocuments.length
                      }
                    />
                  </th>
                  <th style={{ width: '38px' }}>#</th>
                  <th>Document Type ⇅</th>
                  <th>Vendor Name ⇅</th>
                  <th>Related To ⇅</th>
                  <th>Uploaded On ⇅</th>
                  <th>Status ⇅</th>
                  <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDocuments.map((doc, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <tr
                      key={doc.id}
                      className="client-data-row"
                      onClick={() => setSelectedDoc(doc)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(240, 90, 34, 0.06)' : undefined,
                        boxShadow: isSelected ? 'inset 3px 0 0 #F05A22' : undefined,
                      }}
                    >
                      <td style={{ paddingLeft: '16px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="custom-table-checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => handleToggleSelect(doc.id)}
                        />
                      </td>
                      <td>{rowNum}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#172B4D', fontSize: '13px' }}>
                              {doc.documentType}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {doc.fileName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div
                            style={{ fontWeight: 600, color: '#172B4D', fontSize: '13px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToVendorProfile(doc.referenceId);
                            }}
                          >
                            {doc.vendorName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                            {doc.vendorIdDisplay}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>
                          {doc.relatedTo}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ color: '#172B4D', fontSize: '12px', fontWeight: 600 }}>
                            {doc.uploadedDateOnly}
                          </div>
                          <div style={{ color: '#64748B', fontSize: '11px' }}>
                            {doc.uploadedTimeOnly}
                          </div>
                        </div>
                      </td>
                      <td>
                        {doc.status === 'Verified' && (
                          <span className="status-pill-green">Verified</span>
                        )}
                        {doc.status === 'Pending' && (
                          <span className="status-pill-amber">Pending</span>
                        )}
                        {doc.status === 'Rejected' && (
                          <span className="status-pill-red">Rejected</span>
                        )}
                        {doc.status === 'Expired' && (
                          <span className="status-pill-red">Expired</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                        <div className="row-actions-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="row-action-btn-circle"
                            title="Inspect in Review Drawer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoc(doc);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="row-action-btn-circle"
                            title="View Vendor Profile"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToVendorProfile(doc.referenceId);
                            }}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          </div>

          {/* Pagination */}
          <div className="client-pagination-bar">
            <div className="pagination-info">
              Showing{' '}
              {filteredDocuments.length === 0
                ? '0 to 0'
                : `${(currentPage - 1) * pageSize + 1} to ${Math.min(
                    currentPage * pageSize,
                    filteredDocuments.length
                  )}`}{' '}
              of {filteredDocuments.length} documents
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                &gt;
              </button>

              <select
                className="pagination-pagesize-select"
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

        {/* Right Side: Document Review Drawer Matching Screenshot 4 */}
        <div className="doc-review-drawer-card">
          <div className="doc-review-header">
            <h4 className="doc-review-title">Document Review</h4>
            {selectedDoc && (
              <button
                className="filter-clear-btn"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => setSelectedDoc(null)}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!selectedDoc ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#64748B' }}>
              <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px' }}>Select any document from the list to review details and approve/reject.</p>
            </div>
          ) : (
            <div>
              {/* Document Visual Box */}
              <div className="doc-preview-box">
                {/* Simulated Certificate Sheet */}
                <div className="doc-preview-sheet">
                  <div style={{ textAlign: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: '#334155', letterSpacing: '0.5px' }}>
                      GOVERNMENT OF INDIA
                    </div>
                    <div style={{ fontSize: '7px', color: '#64748B' }}>
                      {selectedDoc.documentType.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ margin: '6px 0', fontSize: '7.5px', color: '#475569', lineHeight: 1.4 }}>
                    <div><strong>Legal Name:</strong> {selectedDoc.vendorName}</div>
                    <div><strong>Ref No:</strong> {selectedDoc.referenceNo}</div>
                    <div><strong>Valid From:</strong> {selectedDoc.uploadedDateOnly}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '6.5px', color: '#94A3B8' }}>
                    Digitally Verified Record
                  </div>
                </div>

                <div className="doc-actions-dual-btn">
                  <button
                    type="button"
                    className="btn-table-action"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      if (selectedDoc.fileUrl) {
                        window.open(selectedDoc.fileUrl, '_blank');
                      } else {
                        showToast(`🔍 Previewing ${selectedDoc.fileName}`);
                      }
                    }}
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    className="btn-table-action"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      if (selectedDoc.fileUrl) {
                        const a = document.createElement('a');
                        a.href = selectedDoc.fileUrl;
                        a.download = selectedDoc.fileName;
                        a.click();
                      } else {
                        showToast(`⬇️ Download initiated for ${selectedDoc.fileName}`);
                      }
                    }}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Document Meta Info */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                    {selectedDoc.documentType}
                  </h5>
                  {selectedDoc.status === 'Verified' && <span className="status-pill-green">Verified</span>}
                  {selectedDoc.status === 'Pending' && <span className="status-pill-amber">Pending</span>}
                  {selectedDoc.status === 'Rejected' && <span className="status-pill-red">Rejected</span>}
                  {selectedDoc.status === 'Expired' && <span className="status-pill-red">Expired</span>}
                </div>

                <div className="doc-meta-detail-row">
                  <span className="doc-meta-label">Vendor:</span>
                  <span className="doc-meta-val">{selectedDoc.vendorName}</span>
                </div>
                <div className="doc-meta-detail-row">
                  <span className="doc-meta-label">Document Type:</span>
                  <span className="doc-meta-val">{selectedDoc.documentType}</span>
                </div>
                <div className="doc-meta-detail-row">
                  <span className="doc-meta-label">Uploaded On:</span>
                  <span className="doc-meta-val">{selectedDoc.uploadedOn}</span>
                </div>
                <div className="doc-meta-detail-row">
                  <span className="doc-meta-label">Expiry Date:</span>
                  <span className="doc-meta-val">{selectedDoc.expiryDate}</span>
                </div>
                <div className="doc-meta-detail-row">
                  <span className="doc-meta-label">Reference No:</span>
                  <span className="doc-meta-val" style={{ fontFamily: 'monospace' }}>
                    {selectedDoc.referenceNo}
                  </span>
                </div>
              </div>

              {/* Review History */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginBottom: '14px' }}>
                <h6 style={{ margin: '0 0 10px', fontSize: '12.5px', fontWeight: 700, color: '#172B4D' }}>
                  Review History
                </h6>

                {selectedDoc.status === 'Verified' && (
                  <div className="review-timeline-item">
                    <div className="timeline-dot green" />
                    <div>
                      <div style={{ fontWeight: 700, color: '#172B4D' }}>Approved</div>
                      <div style={{ color: '#64748B', fontSize: '11px' }}>
                        {selectedDoc.verifiedAt || 'Today'} &bull; {selectedDoc.verifiedBy}
                      </div>
                    </div>
                  </div>
                )}

                {selectedDoc.status === 'Rejected' && (
                  <div className="review-timeline-item">
                    <div className="timeline-dot" style={{ background: '#EF4444' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#EF4444' }}>Rejected</div>
                      <div style={{ color: '#64748B', fontSize: '11px' }}>
                        Reason: {selectedDoc.rejectionReason || 'Document details invalid'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="review-timeline-item">
                  <div className="timeline-dot gray" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#172B4D' }}>Submitted</div>
                    <div style={{ color: '#64748B', fontSize: '11px' }}>
                      {selectedDoc.uploadedOn} &bull; {selectedDoc.vendorName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Remarks */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <h6 style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#172B4D' }}>
                  Verification Remarks
                </h6>
                <textarea
                  className="review-remarks-textarea"
                  maxLength={500}
                  placeholder="Add remarks (optional)..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {remarks.length}/500
                </div>

                {/* Decision Buttons */}
                <div className="doc-decision-btn-row">
                  <button
                    type="button"
                    className="btn-doc-reject"
                    disabled={actionLoading}
                    onClick={handleRejectDocument}
                  >
                    <X size={15} />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    className="btn-doc-approve"
                    disabled={actionLoading}
                    onClick={handleApproveDocument}
                  >
                    <Check size={16} />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
