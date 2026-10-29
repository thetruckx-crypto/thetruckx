import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ArrowRight,
  Truck,
  User,
  Calendar,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ShieldCheck,
  Phone,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';

export interface VendorQuoteItem {
  id: string;
  quoted_rate: number;
  version: number;
  is_locked: boolean;
  submitted_at: string;
  vehicle_id?: string;
  driver_id?: string;
  vendor_request_id?: string;

  // Requirement Data
  requirement_id: string;
  requirement_code: string;
  pickup_address: string;
  destination_address: string;
  vehicle_type_required: string;
  required_capacity_mt?: number;
  client_company_name: string;

  // Transporter / Vendor Data
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  vendor_address: string;
  vendor_status: string;

  // Quoted Fleet & Driver
  vehicle_registration?: string;
  vehicle_type?: string;
  rated_capacity_mt?: number;
  driver_name?: string;
  driver_mobile?: string;
  driver_licence?: string;

  // Request & Quote Status
  request_status: string; // 'QUOTED' | 'SELECTED' | 'REJECTED' | 'EXPIRED'
}

const ITEMS_PER_PAGE = 12;

export const VendorQuotationsModule: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [quotes, setQuotes] = useState<VendorQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUOTED' | 'SELECTED' | 'LOCKED'>('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Selected Quote for Details Modal
  const [selectedQuote, setSelectedQuote] = useState<VendorQuoteItem | null>(null);

  // Fetch Vendor Quotations from database
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      await ensureAdminSession();

      const { data, error } = await supabase
        .from('vendor_quotations')
        .select(`
          id,
          quoted_rate,
          version,
          is_locked,
          submitted_at,
          vehicle_id,
          driver_id,
          vendor_request_id,
          vendor_requests(
            id,
            requirement_id,
            vendor_id,
            status,
            deadline_at,
            vendor_companies(
              id,
              vendor_name,
              vendor_code,
              address,
              status
            ),
            requirements(
              id,
              requirement_code,
              pickup_address,
              destination_address,
              vehicle_type,
              required_capacity_mt,
              client_id,
              client_companies(
                id,
                company_name
              )
            )
          ),
          vehicles(
            id,
            registration_number,
            vehicle_type,
            rated_capacity_mt
          ),
          drivers(
            id,
            full_name,
            mobile,
            licence_number
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching vendor quotations:', error);
        toast.error('Failed to load vendor quotations: ' + error.message);
        return;
      }

      if (data) {
        const mapped: VendorQuoteItem[] = data.map((item: any) => {
          const vr = item.vendor_requests || {};
          const req = vr.requirements || {};
          const vComp = vr.vendor_companies || {};
          const cComp = req.client_companies || {};
          const veh = item.vehicles || {};
          const drv = item.drivers || {};

          return {
            id: item.id,
            quoted_rate: Number(item.quoted_rate || 0),
            version: Number(item.version || 1),
            is_locked: Boolean(item.is_locked),
            submitted_at: item.submitted_at || new Date().toISOString(),
            vehicle_id: item.vehicle_id,
            driver_id: item.driver_id,
            vendor_request_id: item.vendor_request_id,

            requirement_id: req.id || vr.requirement_id || '',
            requirement_code: req.requirement_code || req.id || 'REQ-0000',
            pickup_address: req.pickup_address || 'Origin Hub',
            destination_address: req.destination_address || 'Destination Hub',
            vehicle_type_required: req.vehicle_type || 'Commercial Vehicle',
            required_capacity_mt: req.required_capacity_mt,
            client_company_name: cComp.company_name || 'Enterprise Client',

            vendor_id: vComp.id || vr.vendor_id || '',
            vendor_name: vComp.vendor_name || 'Transporter Partner',
            vendor_code: vComp.vendor_code || 'VND-000',
            vendor_address: vComp.address || '',
            vendor_status: vComp.status || 'APPROVED',

            vehicle_registration: veh.registration_number,
            vehicle_type: veh.vehicle_type,
            rated_capacity_mt: veh.rated_capacity_mt,

            driver_name: drv.full_name,
            driver_mobile: drv.mobile,
            driver_licence: drv.licence_number,

            request_status: vr.status || 'QUOTED',
          };
        });

        setQuotes(mapped);
      }
    } catch (err: any) {
      console.error('Unexpected error loading vendor quotes:', err);
      toast.error('Error loading vendor quotes: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Unique vendors list for filter dropdown
  const uniqueVendors = useMemo(() => {
    const map = new Map<string, string>();
    quotes.forEach(q => {
      if (q.vendor_id && q.vendor_name) {
        map.set(q.vendor_id, q.vendor_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [quotes]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = quotes.length;
    const underReview = quotes.filter(q => q.request_status === 'QUOTED' || q.request_status === 'SENT').length;
    const awarded = quotes.filter(q => q.request_status === 'SELECTED' || q.request_status === 'ACCEPTED').length;
    const totalRate = quotes.reduce((acc, q) => acc + q.quoted_rate, 0);
    const avgRate = total > 0 ? Math.round(totalRate / total) : 0;
    return { total, underReview, awarded, avgRate };
  }, [quotes]);

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      // 1. Search filter
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        q.id.toLowerCase().includes(term) ||
        q.requirement_code.toLowerCase().includes(term) ||
        q.vendor_name.toLowerCase().includes(term) ||
        q.vendor_code.toLowerCase().includes(term) ||
        (q.vehicle_registration && q.vehicle_registration.toLowerCase().includes(term)) ||
        (q.driver_name && q.driver_name.toLowerCase().includes(term)) ||
        q.pickup_address.toLowerCase().includes(term) ||
        q.destination_address.toLowerCase().includes(term);

      // 2. Status filter
      let matchStatus = true;
      if (statusFilter === 'QUOTED') {
        matchStatus = q.request_status === 'QUOTED' || q.request_status === 'SENT';
      } else if (statusFilter === 'SELECTED') {
        matchStatus = q.request_status === 'SELECTED' || q.request_status === 'ACCEPTED';
      } else if (statusFilter === 'LOCKED') {
        matchStatus = q.is_locked === true;
      }

      // 3. Vendor filter
      const matchVendor = vendorFilter === 'ALL' || q.vendor_id === vendorFilter;

      return matchSearch && matchStatus && matchVendor;
    });
  }, [quotes, search, statusFilter, vendorFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE));
  const paginatedQuotes = useMemo(() => {
    return filteredQuotes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredQuotes, page]);

  // Currency Formatter
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Date Formatter
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Forward Quote to Client Pricing Wizard
  const handleForwardToPricing = (quote: VendorQuoteItem) => {
    navigate(`/admin/pricing?requirementId=${quote.requirement_id}&quoteId=${quote.id}`);
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => navigate('/admin/vendors')} style={{ cursor: 'pointer' }}>
          Vendor Management
        </span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Vendor Quotations Directory</span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Vendor Quotations Directory</h1>
          <p className="page-subtitle">
            Transporter-submitted bids, agreed freight rates, allocated vehicles &amp; driver credentials
          </p>
        </div>
        <button className="btn-action-outline" onClick={fetchQuotes}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Module Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        <button
          onClick={() => navigate('/admin/quotations?tab=rfq')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#475569',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={16} />
          <span>Sourcing &amp; RFQ Management</span>
        </button>

        <button
          onClick={() => navigate('/admin/vendor-quotations')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1px solid #F05A22',
            background: '#FFF7ED',
            color: '#F05A22',
            transition: 'all 0.15s ease',
          }}
        >
          <DollarSign size={16} />
          <span>Vendor Submitted Quotations</span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '10px',
            background: '#F05A22',
            color: '#FFFFFF',
          }}>
            {quotes.length}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle orange">
            <DollarSign size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Quotes Received</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.total}</div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle amber">
            <Clock size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Under Review</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.underReview}</div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle green">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Awarded / Selected</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{kpis.awarded}</div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle blue" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Truck size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Average Quoted Rate</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(kpis.avgRate)}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="filters-bar-card" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div className="filter-input-wrap" style={{ flex: 1, minWidth: '260px' }}>
          <Search size={16} className="filter-search-icon" />
          <input
            className="filter-text-input"
            type="text"
            placeholder="Search by quote, requirement code, transporter, lorry reg, or driver..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="status-tabs-group">
          {(['ALL', 'QUOTED', 'SELECTED', 'LOCKED'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`status-tab-btn ${statusFilter === s ? 'active' : ''}`}
            >
              {s === 'ALL'
                ? 'All Quotes'
                : s === 'QUOTED'
                ? 'Under Review'
                : s === 'SELECTED'
                ? 'Awarded'
                : 'Locked'}
            </button>
          ))}
        </div>

        {/* Vendor Dropdown Filter */}
        {uniqueVendors.length > 1 && (
          <select
            value={vendorFilter}
            onChange={e => { setVendorFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              color: '#334155',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Transporters</option>
            {uniqueVendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Quotes Table */}
      {loading ? (
        <div className="table-empty-state" style={{ padding: '3rem' }}>
          <div style={{ color: '#F05A22', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>
            <RefreshCw size={36} />
          </div>
          <p className="empty-state-text">Loading vendor quotations from database...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="table-empty-state" style={{ padding: '3rem' }}>
          <DollarSign size={44} style={{ color: '#94A3B8', marginBottom: '12px' }} />
          <h4 className="empty-state-heading">No vendor quotations found</h4>
          <p className="empty-state-text">
            {search ? 'No quotes match your search criteria.' : 'No vendor bids have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="client-table-card">
          <div className="table-wrapper">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Quote Ref</th>
                  <th>Requirement &amp; Route</th>
                  <th>Transporter / Vendor</th>
                  <th style={{ textAlign: 'right' }}>Quoted Cost</th>
                  <th>Allocated Lorry</th>
                  <th>Assigned Driver</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotes.map(quote => (
                  <tr key={quote.id} className="client-data-row">
                    {/* Quote Ref */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="mono-code" style={{ color: '#F05A22', fontWeight: 700 }}>
                          VQT-{quote.id.substring(0, 8).toUpperCase()}
                        </span>
                        {quote.version > 1 && (
                          <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            v{quote.version}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Requirement & Route */}
                    <td>
                      <div>
                        <div
                          onClick={() => navigate(`/admin/requirements`)}
                          style={{ fontWeight: 700, color: '#1E293B', fontSize: '13px', cursor: 'pointer' }}
                          title="Click to view requirement"
                        >
                          {quote.requirement_code}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {quote.pickup_address.split(',')[0]}
                          </span>
                          <span>→</span>
                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {quote.destination_address.split(',')[0]}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Transporter */}
                    <td>
                      <div>
                        <span className="client-name-bold">{quote.vendor_name}</span>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                          {quote.vendor_code}
                        </div>
                      </div>
                    </td>

                    {/* Quoted Cost */}
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '14.5px', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(quote.quoted_rate)}
                    </td>

                    {/* Allocated Lorry */}
                    <td>
                      {quote.vehicle_registration ? (
                        <div>
                          <span style={{ fontWeight: 700, color: '#2563EB', fontFamily: 'monospace', fontSize: '12.5px' }}>
                            {quote.vehicle_registration}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {quote.vehicle_type || 'Lorry'} {quote.rated_capacity_mt ? `• ${quote.rated_capacity_mt} MT` : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>Pending placement</span>
                      )}
                    </td>

                    {/* Assigned Driver */}
                    <td>
                      {quote.driver_name ? (
                        <div>
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                            {quote.driver_name}
                          </span>
                          {quote.driver_mobile && (
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                              {quote.driver_mobile}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>Pending placement</span>
                      )}
                    </td>

                    {/* Submission Date */}
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {fmtDate(quote.submitted_at)}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-badge-pastel ${
                        quote.request_status === 'SELECTED' || quote.request_status === 'ACCEPTED'
                          ? 'active'
                          : quote.request_status === 'QUOTED' || quote.request_status === 'SENT'
                          ? 'pending'
                          : 'inactive'
                      }`}>
                        {quote.request_status === 'SELECTED' || quote.request_status === 'ACCEPTED'
                          ? 'Awarded'
                          : quote.request_status === 'QUOTED' || quote.request_status === 'SENT'
                          ? 'Under Review'
                          : 'Archived'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn-icon-action"
                          onClick={() => setSelectedQuote(quote)}
                          title="View Quotation Details"
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          onClick={() => handleForwardToPricing(quote)}
                          className="btn-create-orange"
                          style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
                          title="Add margin and create client quote"
                        >
                          <span>Award &amp; Quote</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="pagination-bar" style={{ marginTop: '16px' }}>
          <span className="pagination-info">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredQuotes.length)} of {filteredQuotes.length}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={15} />Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + Math.max(1, page - 2)).filter(n => n <= totalPages).map(n => (
              <button key={n} className={`pagination-btn${page === n ? ' currentPage' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next<ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Quote Details Slide-Over / Modal */}
      {selectedQuote && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Vendor Quotation Details</h2>
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                  VQT-{selectedQuote.id.substring(0, 8).toUpperCase()} • Submitted {fmtDate(selectedQuote.submitted_at)}
                </span>
              </div>
              <button onClick={() => setSelectedQuote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Financial Highlight Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: '#FFFFFF',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>
                    Transporter Quoted Rate
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#FB923C', marginTop: '2px' }}>
                    {fmt(selectedQuote.quoted_rate)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                    Strictly internal purchase cost • Confidential from client
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge-pastel ${
                    selectedQuote.request_status === 'SELECTED' ? 'active' : 'pending'
                  }`}>
                    {selectedQuote.request_status === 'SELECTED' ? 'Awarded' : 'Under Review'}
                  </span>
                </div>
              </div>

              {/* Requirement Context */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Requirement &amp; Client Overview
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Requirement Code:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{selectedQuote.requirement_code}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Client Name:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{selectedQuote.client_company_name}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Transit Route:</span>
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} color="#F05A22" />
                      <span>{selectedQuote.pickup_address}</span>
                      <span>→</span>
                      <span>{selectedQuote.destination_address}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transporter Profile */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Transporter Information
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Vendor Name:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{selectedQuote.vendor_name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Vendor Code:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px', fontFamily: 'monospace' }}>{selectedQuote.vendor_code}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Registered Address:</span>
                    <div style={{ fontSize: '12.5px', color: '#334155' }}>{selectedQuote.vendor_address || 'Registered on NECL Portal'}</div>
                  </div>
                </div>
              </div>

              {/* Vehicle & Driver Placement */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Allocated Fleet &amp; Driver Placement
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Allocated Vehicle:</span>
                    <div style={{ fontWeight: 700, color: '#2563EB', fontFamily: 'monospace', fontSize: '13px' }}>
                      {selectedQuote.vehicle_registration || 'Not assigned yet'}
                    </div>
                    {selectedQuote.vehicle_type && (
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                        {selectedQuote.vehicle_type} ({selectedQuote.rated_capacity_mt || '--'} MT)
                      </div>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#64748B' }}>Assigned Driver:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                      {selectedQuote.driver_name || 'Not assigned yet'}
                    </div>
                    {selectedQuote.driver_mobile && (
                      <div style={{ fontSize: '11.5px', color: '#64748B', fontFamily: 'monospace' }}>
                        Mobile: {selectedQuote.driver_mobile}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setSelectedQuote(null)}
                style={{ padding: '9px 18px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Close
              </button>

              <button
                className="btn-create-orange"
                onClick={() => {
                  const q = selectedQuote;
                  setSelectedQuote(null);
                  handleForwardToPricing(q);
                }}
                style={{ padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Award &amp; Proceed to Client Pricing</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
