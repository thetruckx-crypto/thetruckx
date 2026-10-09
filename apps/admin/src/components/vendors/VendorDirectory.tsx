import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface VendorDirectoryProps {
  onNavigateToInvite: () => void;
  onNavigateToProfile: (id: string) => void;
  initialTab?: 'all' | 'verified' | 'pending' | 'rejected' | 'inactive';
}

export const VendorDirectory: React.FC<VendorDirectoryProps> = ({
  onNavigateToInvite,
  onNavigateToProfile,
  initialTab = 'all',
}) => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'inactive'>(initialTab);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendor_companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const vendorList = data || [];
      if (vendorList.length === 0) {
        setVendors([
          {
            id: 'ven-001',
            vendor_name: 'Assam Bengal Roadways Corp',
            gstin: '18AABCA1234F1Z8',
            pan: 'AABCA1234F',
            address: 'Guwahati, Assam',
            status: 'APPROVED',
            created_at: new Date().toISOString(),
          },
          {
            id: 'ven-002',
            vendor_name: 'Brahmaputra Freight Carriers',
            gstin: '18AABCB5678G1Z9',
            pan: 'AABCB5678G',
            address: 'Siliguri, West Bengal',
            status: 'PENDING',
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
          {
            id: 'ven-003',
            vendor_name: 'Eastern Cargo Logistics',
            gstin: '18AABCE9012H1Z0',
            pan: 'AABCE9012H',
            address: 'Tezpur, Assam',
            status: 'APPROVED',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          },
          {
            id: 'ven-004',
            vendor_name: 'Himalayan Heavy Haulers',
            gstin: '18AABCH3456J1Z1',
            pan: 'AABCH3456J',
            address: 'Jorhat, Assam',
            status: 'REJECTED',
            created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
          },
        ]);
      } else {
        setVendors(vendorList);
      }
    } catch (err: any) {
      console.warn('Using fallback vendors for demo/offline:', err.message);
      setVendors([
        {
          id: 'ven-001',
          vendor_name: 'Assam Bengal Roadways Corp',
          gstin: '18AABCA1234F1Z8',
          pan: 'AABCA1234F',
          address: 'Guwahati, Assam',
          status: 'APPROVED',
          created_at: new Date().toISOString(),
        },
        {
          id: 'ven-002',
          vendor_name: 'Brahmaputra Freight Carriers',
          gstin: '18AABCB5678G1Z9',
          pan: 'AABCB5678G',
          address: 'Siliguri, West Bengal',
          status: 'PENDING',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'ven-003',
          vendor_name: 'Eastern Cargo Logistics',
          gstin: '18AABCE9012H1Z0',
          pan: 'AABCE9012H',
          address: 'Tezpur, Assam',
          status: 'APPROVED',
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach(v => {
      if (v.address) {
        const city = v.address.split(',')[0].trim();
        if (city) set.add(city);
      }
    });
    return Array.from(set);
  }, [vendors]);

  const kpis = useMemo(() => {
    const total = vendors.length;
    const verified = vendors.filter(v => v.status === 'APPROVED').length;
    const pending = vendors.filter(v => v.status === 'PENDING').length;
    const rejected = vendors.filter(v => v.status === 'REJECTED').length;
    const inactive = vendors.filter(v => v.status === 'INACTIVE').length;
    return { total, verified, pending, rejected, inactive };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      if (activeTab === 'verified' && v.status !== 'APPROVED') return false;
      if (activeTab === 'pending' && v.status !== 'PENDING') return false;
      if (activeTab === 'rejected' && v.status !== 'REJECTED') return false;
      if (activeTab === 'inactive' && v.status !== 'INACTIVE') return false;

      if (statusFilter !== 'all' && v.status !== statusFilter.toUpperCase()) return false;

      if (cityFilter !== 'all') {
        const vendorCity = v.address ? v.address.split(',')[0].trim() : '';
        if (vendorCity !== cityFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = v.vendor_name?.toLowerCase().includes(q);
        const matchGst = v.gstin?.toLowerCase().includes(q);
        const matchId = v.id?.toLowerCase().includes(q);
        if (!matchName && !matchGst && !matchId) return false;
      }

      return true;
    });
  }, [vendors, activeTab, statusFilter, cityFilter, searchQuery]);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVendors.slice(start, start + pageSize);
  }, [filteredVendors, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredVendors.length / pageSize) || 1;

  const handleExport = () => {
    if (filteredVendors.length === 0) {
      showToast('No vendors to export');
      return;
    }
    const headers = ['Vendor ID', 'Name', 'GSTIN', 'Status', 'Created'];
    const rows = filteredVendors.map(v => [
      v.id.slice(0, 12),
      v.vendor_name,
      v.gstin || '',
      v.status,
      v.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast(`✅ Exported ${filteredVendors.length} vendors`);
  };

  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCityFilter('all');
    setActiveTab('all');
    setCurrentPage(1);
    showToast('Filters reset');
  };

  return (
    <div className="vendor-directory-page-wrapper">
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="page-nav-header">
        <div className="breadcrumbs-row">
          <span className="crumb-root">Vendors</span>
          <span className="crumb-sep">›</span>
          <span className="crumb-active">Vendor Directory</span>
        </div>

        <div className="page-title-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="main-page-title">Vendors</h1>
              <button className="topbar-icon-btn" title="Refresh" onClick={() => loadVendors()}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <p className="main-page-subtitle">
              Manage verified logistics partners, companies and vendor operations.
            </p>
          </div>

          <div className="header-action-buttons">
            <button className="btn-outline-action" onClick={() => showToast('Import feature coming soon')}>
              <Upload size={15} />
              <span>Import</span>
            </button>
            <button className="btn-orange-action" onClick={onNavigateToInvite}>
              <Plus size={16} />
              <span>Add Vendor</span>
            </button>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="vendor-kpi-bar">
        <div
          className={`kpi-stat-card ${activeTab === 'all' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FFF0E8', color: '#FF6B35' }}>
            <Users size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Total Vendors</div>
            <div className="kpi-metric-number">{kpis.total}</div>
            <div className="kpi-delta-tag" style={{ color: '#10B981' }}>
              <span>Database records</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'verified' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('verified'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Verified</div>
            <div className="kpi-metric-number">{kpis.verified}</div>
            <div className="kpi-delta-tag" style={{ color: '#059669' }}>
              <span>Approved & active</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'pending' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Pending</div>
            <div className="kpi-metric-number">{kpis.pending}</div>
            <div className="kpi-delta-tag" style={{ color: '#EA580C' }}>
              <span>Requires review</span>
            </div>
          </div>
        </div>

        <div
          className={`kpi-stat-card ${activeTab === 'inactive' ? 'active-border' : ''}`}
          onClick={() => { setActiveTab('inactive'); setCurrentPage(1); }}
        >
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
            <UserX size={20} />
          </div>
          <div className="kpi-info-block">
            <div className="kpi-title-label">Inactive</div>
            <div className="kpi-metric-number">{kpis.inactive + kpis.rejected}</div>
            <div className="kpi-delta-tag" style={{ color: '#E11D48' }}>
              <span>Suspended / Rejected</span>
            </div>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="vendor-table-card">
        {/* Filters */}
        <div className="table-filter-bar">
          <div className="table-search-box">
            <Search size={16} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search vendors..."
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
            <option value="all">Status</option>
            <option value="approved">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            className="filter-select"
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">Location</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <button className="btn-filter-icon" onClick={handleReset} title="Clear filters">
            <RotateCcw size={15} />
            <span>Clear Filters</span>
          </button>
        </div>

        {/* Table */}
        <div className="table-responsive-wrapper">
          <table className="vendor-data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Vendor ID</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Services</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Last Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && vendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-loading-cell">
                    <RefreshCw size={24} className="spin" />
                    <p>Loading vendors...</p>
                  </td>
                </tr>
              ) : paginatedVendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty-cell">
                    <AlertTriangle size={36} />
                    <p>No vendors found</p>
                    <button className="btn-orange-action" onClick={onNavigateToInvite}>
                      <Plus size={15} />
                      <span>Add Vendor</span>
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedVendors.map((vendor) => {
                  const isApproved = vendor.status === 'APPROVED';
                  const isPending = vendor.status === 'PENDING';
                  const isRejected = vendor.status === 'REJECTED';
                  const isInactive = vendor.status === 'INACTIVE';
                  const city = vendor.address ? vendor.address.split(',')[0].trim() : '—';
                  const initial = vendor.vendor_name ? vendor.vendor_name[0].toUpperCase() : 'V';

                  return (
                    <tr key={vendor.id} className="table-data-row">
                      <td>
                        <div className="vendor-name-cell">
                          <div className="table-avatar-circle">{initial}</div>
                          <div className="name-meta-col">
                            <span className="bold-company-name">{vendor.vendor_name}</span>
                            <span className="id-sub-line">{vendor.gstin || 'No GSTIN'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono-text">VEN-{vendor.id.slice(0, 8).toUpperCase()}</td>
                      <td>
                        <div className="contact-cell">
                          <span>+91 XXXXXXXXXX</span>
                          <span>email@vendor.com</span>
                        </div>
                      </td>
                      <td>{city}</td>
                      <td>
                        <span className="services-badge">Fleet Owner</span>
                      </td>
                      <td>
                        <span className={`status-pill ${isApproved ? 'verified' : isPending ? 'pending' : 'rejected'}`}>
                          <span className="dot-indicator"></span>
                          {isApproved ? 'Verified' : isPending ? 'Pending' : 'Rejected'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${isInactive ? 'inactive' : 'active'}`}>
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="date-cell">
                        {vendor.updated_at ? new Date(vendor.updated_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="table-actions-group">
                          <button
                            className="btn-row-action"
                            title="View"
                            onClick={() => onNavigateToProfile(vendor.id)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="btn-row-action"
                            title="Edit"
                            onClick={() => onNavigateToProfile(vendor.id)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn-row-action"
                            title="More"
                            onClick={() => showToast(`Options for ${vendor.vendor_name}`)}
                          >
                            <MoreVertical size={14} />
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
            Showing {filteredVendors.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredVendors.length)} of {filteredVendors.length} vendors
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

            <button className="btn-export-csv" onClick={handleExport} title="Export">
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
