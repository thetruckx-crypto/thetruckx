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
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { DriverLicenceAudit } from './DriverLicenceAudit';

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
      if (fetchedDrivers.length === 0) {
        setDrivers([
          {
            id: 'drv-001',
            full_name: 'Rajesh Kumar',
            mobile: '+91 98765 43210',
            licence_number: 'DL-0420220019284',
            licence_expiry_date: '2028-09-15',
            status: 'PENDING',
            primary_vendor_id: 'ven-1',
            address: 'Guwahati Logistics Hub, Assam',
            created_at: new Date().toISOString(),
          },
          {
            id: 'drv-002',
            full_name: 'Harjit Singh',
            mobile: '+91 98123 45678',
            licence_number: 'PB-1020210082914',
            licence_expiry_date: '2029-04-20',
            status: 'APPROVED',
            primary_vendor_id: 'ven-2',
            address: 'Siliguri Commercial Bypass, WB',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
          {
            id: 'drv-003',
            full_name: 'Suresh Mondal',
            mobile: '+91 97456 78901',
            licence_number: 'AS-0120200049210',
            licence_expiry_date: '2024-01-10',
            status: 'REJECTED',
            rejection_reason: 'Licence expired past grace period; renewal required.',
            primary_vendor_id: 'ven-1',
            address: 'Dispur, Guwahati',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          },
          {
            id: 'drv-004',
            full_name: 'Bikramjit Roy',
            mobile: '+91 99345 67890',
            licence_number: 'WB-0220230019821',
            licence_expiry_date: '2030-11-28',
            status: 'PENDING',
            primary_vendor_id: 'ven-3',
            address: 'Jorhat Industrial Sector, Assam',
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setDrivers(fetchedDrivers);
      }

      const fetchedVendors = vendorsRes.data || [];
      if (fetchedVendors.length === 0) {
        setVendors([
          { id: 'ven-1', vendor_name: 'Assam Bengal Roadways' },
          { id: 'ven-2', vendor_name: 'Brahmaputra Freight Carriers' },
          { id: 'ven-3', vendor_name: 'Eastern Cargo Logistics' },
        ]);
      } else {
        setVendors(fetchedVendors);
      }
    } catch (err: any) {
      console.warn('Using demo drivers dataset:', err.message);
      setDrivers([
        {
          id: 'drv-001',
          full_name: 'Rajesh Kumar',
          mobile: '+91 98765 43210',
          licence_number: 'DL-0420220019284',
          licence_expiry_date: '2028-09-15',
          status: 'PENDING',
          primary_vendor_id: 'ven-1',
          address: 'Guwahati Logistics Hub, Assam',
          created_at: new Date().toISOString(),
        },
        {
          id: 'drv-002',
          full_name: 'Harjit Singh',
          mobile: '+91 98123 45678',
          licence_number: 'PB-1020210082914',
          licence_expiry_date: '2029-04-20',
          status: 'APPROVED',
          primary_vendor_id: 'ven-2',
          address: 'Siliguri Commercial Bypass, WB',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        }
      ]);
      setVendors([
        { id: 'ven-1', vendor_name: 'Assam Bengal Roadways' },
        { id: 'ven-2', vendor_name: 'Brahmaputra Freight Carriers' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const kpis = useMemo(() => {
    const total = drivers.length;
    const pending = drivers.filter(d => d.status === 'PENDING').length;
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
      if (activeTab === 'pending' && d.status !== 'PENDING') return false;
      if (activeTab === 'approved' && d.status !== 'APPROVED') return false;
      if (activeTab === 'rejected' && d.status !== 'REJECTED') return false;
      if (activeTab === 'expired') {
        const today = new Date();
        const expiry = d.licence_expiry_date ? new Date(d.licence_expiry_date) : null;
        if (!expiry || expiry >= today) return false;
      }

      // Status dropdown
      if (statusFilter !== 'all' && d.status !== statusFilter.toUpperCase()) return false;

      // Vendor filter
      if (vendorFilter !== 'all' && d.primary_vendor_id !== vendorFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.full_name?.toLowerCase().includes(q);
        const matchMobile = d.mobile?.toLowerCase().includes(q);
        const matchLicence = d.licence_number?.toLowerCase().includes(q);
        const matchId = d.id?.toLowerCase().includes(q);
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
      d.id.slice(0, 12),
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

      {/* Header */}
      <header className="page-nav-header">
        <div className="breadcrumbs-row">
          <span className="crumb-root">Drivers</span>
          <span className="crumb-sep">›</span>
          <span className="crumb-active">Verification Queue</span>
        </div>

        <div className="page-title-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="main-page-title">Driver Verification Queue</h1>
              <button className="topbar-icon-btn" title="Refresh" onClick={() => loadDrivers()}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <p className="main-page-subtitle">
              Review and approve driver licence documents and identity verification.
            </p>
          </div>

          <div className="header-action-buttons">
            <button className="btn-outline-action" onClick={handleExport}>
              <Download size={15} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="driver-kpi-bar">
        <div
          className={`kpi-stat-card ${activeTab === 'all' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
            <Users size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Total Drivers</div>
            <div className="kpi-metric-number">{kpis.total}</div>
            <div className="kpi-delta-tag" style={{ color: '#10B981' }}>
              <span>All registered</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FFF0E8', color: '#E85D26' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Pending Review</div>
            <div className="kpi-metric-number">{kpis.pending}</div>
            <div className="kpi-delta-tag" style={{ color: '#E85D26' }}>
              <span>Requires verification</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'approved' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Verified</div>
            <div className="kpi-metric-number">{kpis.approved}</div>
            <div className="kpi-delta-tag" style={{ color: '#16A34A' }}>
              <span>Approved drivers</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'rejected' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('rejected'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            <XCircle size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Rejected</div>
            <div className="kpi-metric-number">{kpis.rejected}</div>
            <div className="kpi-delta-tag" style={{ color: '#DC2626' }}>
              <span>Failed verification</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'expired' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('expired'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Expired Licence</div>
            <div className="kpi-metric-number">{kpis.expired}</div>
            <div className="kpi-delta-tag" style={{ color: '#E11D48' }}>
              <span>Requires renewal</span>
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="driver-table-card">
        {/* Filters */}
        <div className="table-filter-bar">
          <div className="table-search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by name, mobile, licence..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="table-search-input"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Verified</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            className="filter-select"
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.vendor_name}</option>
            ))}
          </select>

          <button className="btn-filter-icon" onClick={handleReset} title="Clear filters">
            <RotateCcw size={15} />
            <span>Clear Filters</span>
          </button>
        </div>

        {/* Table */}
        <div className="table-responsive-wrapper">
          <table className="driver-data-table">
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Driver ID</th>
                <th>Mobile</th>
                <th>Licence Number</th>
                <th>Expiry Date</th>
                <th>Vendor</th>
                <th>Verification Status</th>
                <th>Licence Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && drivers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-loading-cell">
                    <RefreshCw size={24} className="spin" />
                    <p>Loading drivers...</p>
                  </td>
                </tr>
              ) : paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty-cell">
                    <AlertTriangle size={36} />
                    <p>No drivers found</p>
                    <p style={{ fontSize: '13px', color: '#64748B', marginTop: '8px' }}>
                      {activeTab === 'pending' 
                        ? 'No drivers pending verification at this time'
                        : 'Try adjusting your filters'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver) => {
                  const isPending = driver.status === 'PENDING';
                  const isApproved = driver.status === 'APPROVED';
                  const isRejected = driver.status === 'REJECTED';
                  const licenceStatus = getLicenceStatus(driver);
                  const initial = driver.full_name ? driver.full_name[0].toUpperCase() : 'D';

                  return (
                    <tr key={driver.id} className="table-data-row">
                      <td>
                        <div className="driver-name-cell">
                          <div className="table-avatar-circle">{initial}</div>
                          <div className="name-meta-col">
                            <span className="bold-driver-name">{driver.full_name}</span>
                            <span className="id-sub-line">{driver.mobile}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono-text">DRV-{driver.id.slice(0, 8).toUpperCase()}</td>
                      <td className="mobile-cell">{driver.mobile}</td>
                      <td className="mono-text">{driver.licence_number}</td>
                      <td className="date-cell">
                        {driver.licence_expiry_date 
                          ? new Date(driver.licence_expiry_date).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td className="vendor-cell">{getVendorName(driver.primary_vendor_id)}</td>
                      <td>
                        <span className={`status-pill ${isApproved ? 'verified' : isPending ? 'pending' : 'rejected'}`}>
                          <span className="dot-indicator"></span>
                          {isApproved ? 'Verified' : isPending ? 'Pending' : 'Rejected'}
                        </span>
                      </td>
                      <td>
                        <span className={`licence-status-badge ${licenceStatus.color}`}>
                          {licenceStatus.label}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-group">
                          <button
                            className="btn-row-action primary"
                            title="Audit Licence & Documents"
                            onClick={() => {
                              setSelectedAuditDriver(driver);
                              setIsAuditModalOpen(true);
                              onAuditDriver(driver.id);
                            }}
                          >
                            <FileCheck size={15} />
                          </button>
                          <button
                            className="btn-row-action"
                            title="View Details"
                            onClick={() => {
                              setSelectedAuditDriver(driver);
                              setIsAuditModalOpen(true);
                            }}
                          >
                            <Eye size={15} />
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
        <div className="table-pagination-footer">
          <div className="pagination-info">
            Showing {filteredDrivers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredDrivers.length)} of {filteredDrivers.length} drivers
          </div>

          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              );
            })}
            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            >
              ›
            </button>

            <select
              className="page-size-selector"
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

