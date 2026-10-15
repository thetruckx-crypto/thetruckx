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
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { DriverLicenceAudit } from './DriverLicenceAudit';
import { formatDisplayId } from '../../utils/idGenerator';

interface DriverVerificationQueueProps {
  onAuditDriver: (driverId: string) => void;
}

export const DriverVerificationQueue: React.FC<DriverVerificationQueueProps> = ({
  onAuditDriver,
}) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Driver Licence Audit Modal State
  const [selectedAuditDriver, setSelectedAuditDriver] = useState<any | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

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
      const [driversRes, vendorsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('vendor_companies')
          .select('id, vendor_name')
      ]);

      if (driversRes.error) throw driversRes.error;
      if (vendorsRes.error) throw vendorsRes.error;

      const fetchedDrivers = driversRes.data || [];
      setDrivers(fetchedDrivers);

      const fetchedVendors = vendorsRes.data || [];
      setVendors(fetchedVendors);
    } catch (err: any) {
      console.warn('Driver database query error:', err.message);
      setDrivers([]);
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

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.vendor_name || 'Unknown Vendor';
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

        <div className="client-header-actions">
          <button className="btn-create-orange" onClick={() => loadDrivers()}>
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
                <th>Licence Number ⇅</th>
                <th>Expiry Date ⇅</th>
                <th>Vendor ⇅</th>
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
                      <td>{driver.mobile}</td>
                      <td>
                        <span className="mono-code">{driver.licence_number}</span>
                      </td>
                      <td>
                        {driver.licence_expiry_date 
                          ? new Date(driver.licence_expiry_date).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td>
                        <span className="table-cell-sub">{getVendorName(driver.primary_vendor_id)}</span>
                      </td>
                      <td>
                        <span className={`status-badge-pastel ${
                          isApproved ? 'active' : isPending ? 'pending' : isRejected ? 'inactive' : 'draft'
                        }`}>
                          {isApproved ? 'Verified' : isPending ? 'Pending' : isRejected ? 'Rejected' : driver.status}
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
    </div>
  );
};

