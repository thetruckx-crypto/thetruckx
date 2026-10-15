import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt,
  IndianRupee,
  Plus,
  Eye,
  Edit2,
  Search,
  Filter,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Calculator,
  FileText,
  ChevronRight,
  ChevronLeft,
  Download,
  RefreshCw,
  Trash2,
  Save,
  Send,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';

interface Requirement {
  id: string;
  client_id: string;
  pickup_address: string;
  destination_address: string;
  vehicle_type: string;
  material_type: string | null;
  required_capacity_mt: number;
  status: string;
  created_at: string;
  client_company?: {
    company_name: string;
  };
}

interface VendorQuotation {
  id: string;
  requirement_id: string;
  vendor_id: string;
  base_rate: number;
  additional_charges: number;
  total_amount: number;
  validity_date: string;
  status: string;
  vendor_company?: {
    vendor_name: string;
  };
}

interface ClientQuote {
  id: string;
  requirement_id: string;
  vendor_quotation_id: string;
  vendor_total: number;
  margin: number;
  charge_lines: ChargeLineItem[];
  gst_applicable: boolean;
  gst_rate: number;
  gst_amount: number;
  grand_total: number;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  updated_at: string;
  requirement?: Requirement;
}

interface ChargeLineItem {
  id: string;
  charge_type: string;
  description: string;
  amount: number;
}

interface PricingModuleProps {
  onNavigateToRequirement?: (requirementId: string) => void;
}

const CHARGE_TYPES = [
  'LOADING_CHARGES',
  'UNLOADING_CHARGES',
  'DETENTION',
  'TOLL',
  'PARKING',
  'PERMIT',
  'INSURANCE',
  'OTHER',
];

const GST_RATES = [5, 12, 18];

export const PricingModule: React.FC<PricingModuleProps> = ({
  onNavigateToRequirement,
}) => {
  const { canViewMargins, hasPermission } = useAuth();

  // Main lists
  const [quotedRequirements, setQuotedRequirements] = useState<Requirement[]>([]);
  const [issuedQuotes, setIssuedQuotes] = useState<ClientQuote[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'pending' | 'issued'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Margin Builder Modal
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [selectedVendorQuotation, setSelectedVendorQuotation] = useState<VendorQuotation | null>(null);
  const [margin, setMargin] = useState<string>('');
  const [chargeLines, setChargeLines] = useState<ChargeLineItem[]>([]);
  const [gstApplicable, setGstApplicable] = useState(true);
  const [gstRate, setGstRate] = useState(18);
  const [showZeroMarginWarning, setShowZeroMarginWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load requirements in QUOTED status without an issued client quote
      const { data: reqData, error: reqError } = await supabase
        .from('requirements')
        .select(`
          *,
          client_company:client_companies(company_name)
        `)
        .eq('status', 'QUOTED')
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;

      // Filter out requirements that already have a pending or accepted client quote
      const { data: existingQuotes, error: quotesCheckError } = await supabase
        .from('client_quotes')
        .select('requirement_id')
        .in('status', ['PENDING_ACCEPTANCE', 'ACCEPTED']);

      if (quotesCheckError) throw quotesCheckError;

      const quotedReqIds = new Set((existingQuotes || []).map(q => q.requirement_id));
      const availableReqs = (reqData || []).filter(req => !quotedReqIds.has(req.id));

      setQuotedRequirements(availableReqs);

      // Load all issued client quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('client_quotes')
        .select(`
          *,
          requirement:requirements(
            id,
            client_id,
            pickup_address,
            destination_address,
            vehicle_type,
            material_type,
            client_company:client_companies(company_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      setIssuedQuotes(quotesData || []);
    } catch (err: any) {
      console.error('Error loading pricing data:', err);
      setQuotedRequirements([]);
      setIssuedQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open margin builder
  const handleOpenBuilder = async (requirement: Requirement) => {
    if (!hasPermission('pricing', 'create')) {
      showToast('You do not have permission to build client quotes. Contact Super Admin.');
      return;
    }
    if (!canViewMargins()) {
      showToast('Viewing or calculating internal commercial margins requires explicit authorization.');
      return;
    }
    setSelectedRequirement(requirement);

    // Load the selected vendor quotation for this requirement
    try {
      const { data, error } = await supabase
        .from('vendor_quotations')
        .select(`
          *,
          vendor_company:vendor_companies(vendor_name)
        `)
        .eq('requirement_id', requirement.id)
        .eq('status', 'SELECTED')
        .single();

      if (error) throw error;

      setSelectedVendorQuotation(data);
      setMargin('');
      setChargeLines([]);
      setGstApplicable(true);
      setGstRate(18);
      setIsBuilderOpen(true);
    } catch (err: any) {
      console.error('Error loading vendor quotation:', err);
      showToast('No approved vendor quotation found for this requirement');
      setSelectedVendorQuotation(null);
    }
  };

  // Add charge line
  const handleAddChargeLine = () => {
    setChargeLines([
      ...chargeLines,
      {
        id: `charge-${Date.now()}`,
        charge_type: 'LOADING_CHARGES',
        description: '',
        amount: 0,
      },
    ]);
  };

  // Update charge line
  const handleUpdateChargeLine = (id: string, field: keyof ChargeLineItem, value: any) => {
    setChargeLines(
      chargeLines.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  // Remove charge line
  const handleRemoveChargeLine = (id: string) => {
    setChargeLines(chargeLines.filter((line) => line.id !== id));
  };

  // Calculate pricing
  const vendorTotal = selectedVendorQuotation?.total_amount || 0;
  const marginAmount = parseFloat(margin) || 0;
  const chargeTotal = chargeLines.reduce((sum, line) => sum + line.amount, 0);
  const subtotal = vendorTotal + marginAmount + chargeTotal;
  const gstAmount = gstApplicable ? (subtotal * gstRate) / 100 : 0;
  const grandTotal = subtotal + gstAmount;

  // Submit quote
  const handleSubmitQuote = async () => {
    if (!selectedRequirement || !selectedVendorQuotation) return;

    // Check for zero margin warning
    if (marginAmount === 0 && !showZeroMarginWarning) {
      setShowZeroMarginWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('client_quotes')
        .insert({
          requirement_id: selectedRequirement.id,
          vendor_quotation_id: selectedVendorQuotation.id,
          vendor_total: vendorTotal,
          margin: marginAmount,
          charge_lines: chargeLines,
          gst_applicable: gstApplicable,
          gst_rate: gstRate,
          gst_amount: gstAmount,
          grand_total: grandTotal,
          status: 'PENDING_ACCEPTANCE',
        })
        .select()
        .single();

      if (error) throw error;

      showToast('Client quote issued successfully');
      setIsBuilderOpen(false);
      setShowZeroMarginWarning(false);
      await loadData();
    } catch (err: any) {
      console.error('Error issuing quote:', err);
      showToast('Error issuing quote');
    } finally {
      setSubmitting(false);
    }
  };

  // View quote details
  const [viewingQuote, setViewingQuote] = useState<ClientQuote | null>(null);

  // Filtered data
  const filteredRequirements = useMemo(() => {
    return quotedRequirements.filter((req) => {
      const matchesSearch =
        searchQuery === '' ||
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.client_company?.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.pickup_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.destination_address.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [quotedRequirements, searchQuery]);

  const filteredQuotes = useMemo(() => {
    return issuedQuotes.filter((quote) => {
      const matchesSearch =
        searchQuery === '' ||
        quote.requirement?.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.requirement?.client_company?.company_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || quote.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [issuedQuotes, searchQuery, statusFilter]);

  const paginatedItems = useMemo(() => {
    const items = activeTab === 'pending' ? filteredRequirements : filteredQuotes;
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [activeTab, filteredRequirements, filteredQuotes, currentPage, pageSize]);

  const totalPages = Math.ceil(
    (activeTab === 'pending' ? filteredRequirements.length : filteredQuotes.length) / pageSize
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; border: string; icon: any }> = {
      PENDING_ACCEPTANCE: { bg: '#FEF3C7', text: '#B45309', border: '#FDE047', icon: Clock },
      ACCEPTED: { bg: '#D1FAE5', text: '#047857', border: '#A7F3D0', icon: CheckCircle2 },
      REJECTED: { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA', icon: XCircle },
    };

    const style = styles[status] || styles.PENDING_ACCEPTANCE;
    const Icon = style.icon;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: style.bg,
          color: style.text,
        }}
      >
        <Icon size={12} />
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Header */}
      <div className="client-header-info" style={{ marginBottom: '20px' }}>
        <div className="client-header-breadcrumbs">
          <span>Operations</span>
          <ChevronRight size={13} className="breadcrumb-chevron" />
          <span className="breadcrumb-current">Pricing & Quotes</span>
        </div>
        <h1 className="client-directory-title">Pricing & Quotes</h1>
        <p className="client-directory-desc">
          Build client quotes with margin calculations, GST computation, and issue quotes directly to clients.
        </p>
      </div>

      {/* Tabs */}
      <div className="table-sub-bar" style={{ marginBottom: '16px' }}>
        <div className="status-tabs-group">
          <button
            className={`status-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
          >
            Pending Quotes ({filteredRequirements.length})
          </button>
          <button
            className={`status-tab-btn ${activeTab === 'issued' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('issued');
              setCurrentPage(1);
            }}
          >
            Issued Quotes ({filteredQuotes.length})
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filters-bar-card" style={{ marginBottom: '16px' }}>
        <div className="filter-input-wrap" style={{ flex: 1 }}>
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            placeholder="Search by requirement ID, client, or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-text-input"
          />
        </div>

        {activeTab === 'issued' && (
          <div className="filter-dropdown-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select-input"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_ACCEPTANCE">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        )}

        <button onClick={loadData} className="btn-action-outline">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="table-empty-state" style={{ padding: '3rem' }}>
          <RefreshCw size={32} className="spin" style={{ color: '#F05A22', marginBottom: '12px' }} />
          <p className="empty-state-text">Loading pricing data...</p>
        </div>
      )}

      {/* Pending Requirements List */}
      {!loading && activeTab === 'pending' && (
        <div className="client-table-card">
          <div className="table-wrapper">
            {paginatedItems.length === 0 ? (
              <div className="table-empty-state">
                <Receipt size={40} style={{ color: '#94A3B8', marginBottom: '12px' }} />
                <h4 className="empty-state-heading">No pending requirements</h4>
                <p className="empty-state-text">No quoted requirements pending client quote</p>
              </div>
            ) : (
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Requirement ID</th>
                    <th>Client</th>
                    <th>Route</th>
                    <th>Vehicle Type</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((req: any) => (
                    <tr key={req.id} className="client-data-row">
                      <td>
                        <span className="mono-code" style={{ color: '#F05A22', fontWeight: 600 }}>{req.id}</span>
                      </td>
                      <td>
                        <span className="client-name-bold">{req.client_company?.company_name || 'N/A'}</span>
                      </td>
                      <td>
                        <span className="table-cell-sub">{req.pickup_address} → {req.destination_address}</span>
                      </td>
                      <td>
                        <span className="status-badge-pastel default">{req.vehicle_type}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {hasPermission('pricing', 'create') && canViewMargins() ? (
                          <button
                            onClick={() => handleOpenBuilder(req)}
                            className="btn-create-orange"
                            style={{ padding: '6px 14px', fontSize: '13px' }}
                          >
                            <Calculator size={14} />
                            <span>Build Quote</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>Restricted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Issued Quotes List */}
      {!loading && activeTab === 'issued' && (
        <div className="client-table-card">
          <div className="table-wrapper">
            {paginatedItems.length === 0 ? (
              <div className="table-empty-state">
                <FileText size={40} style={{ color: '#94A3B8', marginBottom: '12px' }} />
                <h4 className="empty-state-heading">No issued quotes</h4>
                <p className="empty-state-text">No issued quotes found for this selection</p>
              </div>
            ) : (
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Requirement ID</th>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Issued On</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((quote: any) => (
                    <tr key={quote.id} className="client-data-row">
                      <td>
                        <span className="mono-code" style={{ color: '#F05A22', fontWeight: 600 }}>
                          {quote.requirement?.id || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className="client-name-bold">
                          {quote.requirement?.client_company?.company_name || 'N/A'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#172B4D', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(quote.grand_total)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{getStatusBadge(quote.status)}</td>
                      <td>
                        <span className="table-cell-sub">
                          {new Date(quote.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setViewingQuote(quote)}
                          className="btn-action-outline"
                          style={{ padding: '6px 12px', fontSize: '12.5px' }}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="pagination-row" style={{ marginTop: '16px' }}>
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          <div className="pagination-buttons">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="pagination-nav-btn"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="pagination-nav-btn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Margin Builder Modal */}
      {isBuilderOpen && selectedRequirement && selectedVendorQuotation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
          onClick={() => {
            if (!submitting) {
              setIsBuilderOpen(false);
              setShowZeroMarginWarning(false);
            }
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Margin Builder
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {selectedRequirement.id} • {selectedRequirement.client_company?.company_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBuilderOpen(false);
                  setShowZeroMarginWarning(false);
                }}
                disabled={submitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {/* Vendor Quote Summary */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.75rem' }}>
                  Finalized Vendor Quote
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p style={{ color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Vendor</p>
                    <p style={{ color: '#0F172A', fontWeight: 600 }}>
                      {selectedVendorQuotation.vendor_company?.vendor_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Base Rate</p>
                    <p style={{ color: '#0F172A', fontWeight: 600 }}>
                      {formatCurrency(selectedVendorQuotation.base_rate)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Additional Charges
                    </p>
                    <p style={{ color: '#0F172A', fontWeight: 600 }}>
                      {formatCurrency(selectedVendorQuotation.additional_charges)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Vendor Total</p>
                    <p style={{ color: '#F45325', fontWeight: 700, fontSize: '1.125rem' }}>
                      {formatCurrency(selectedVendorQuotation.total_amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Margin Input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#0F172A', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Margin Amount (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <IndianRupee
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748B',
                    }}
                  />
                  <input
                    type="number"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                    placeholder="Enter margin in rupees"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 3rem',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      color: '#0F172A',
                      fontSize: '1rem',
                    }}
                  />
                </div>
                {marginAmount === 0 && margin !== '' && (
                  <p style={{ color: '#EA580C', fontSize: '0.875rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={14} />
                    Zero margin detected. A warning will be shown before submission.
                  </p>
                )}
              </div>

              {/* Real-time Client Price Calculation */}
              <div
                style={{
                  background: '#FFF7ED',
                  border: '1px solid #FFEDD5',
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9A3412', fontSize: '0.95rem', fontWeight: 500 }}>Client Price (before charges & GST)</span>
                  <span style={{ color: '#EA580C', fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatCurrency(vendorTotal + marginAmount)}
                  </span>
                </div>
              </div>

              {/* Charge Lines */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ color: '#0F172A', fontWeight: 600 }}>Additional Charges</label>
                  <button
                    onClick={handleAddChargeLine}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      color: '#334155',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <Plus size={14} />
                    Add Charge
                  </button>
                </div>

                {chargeLines.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          Type
                        </label>
                        <select
                          value={line.charge_type}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'charge_type', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            color: '#0F172A',
                            fontSize: '0.875rem',
                          }}
                        >
                          {CHARGE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          Description
                        </label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'description', e.target.value)}
                          placeholder="Enter description"
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            color: '#0F172A',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#64748B', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={line.amount}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            color: '#0F172A',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveChargeLine(line.id)}
                        style={{
                          padding: '0.5rem',
                          background: '#FFFFFF',
                          border: '1px solid #FEE2E2',
                          borderRadius: '6px',
                          color: '#EF4444',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* GST Configuration */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#0F172A', fontWeight: 600, marginBottom: '0.75rem' }}>
                  GST Configuration
                </label>
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={gstApplicable}
                        onChange={() => setGstApplicable(true)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: '#0F172A', fontWeight: 500 }}>GST Applicable</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={!gstApplicable}
                        onChange={() => setGstApplicable(false)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: '#0F172A', fontWeight: 500 }}>No GST</span>
                    </label>
                  </div>

                  {gstApplicable && (
                    <div>
                      <label style={{ display: 'block', color: '#64748B', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        GST Rate
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {GST_RATES.map((rate) => (
                          <button
                            key={rate}
                            onClick={() => setGstRate(rate)}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: gstRate === rate ? '#F45325' : '#FFFFFF',
                              border: `1px solid ${gstRate === rate ? '#F45325' : '#CBD5E1'}`,
                              borderRadius: '6px',
                              color: gstRate === rate ? '#FFFFFF' : '#334155',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: gstRate === rate ? '0 1px 3px rgba(244, 83, 37, 0.25)' : 'none',
                            }}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Final Quote Summary */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #F45325 0%, #EA580C 100%)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(244, 83, 37, 0.25)',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '1rem' }}>
                  Quote Summary
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>Vendor Total</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(vendorTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>Margin</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(marginAmount)}</span>
                  </div>
                  {chargeLines.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>Additional Charges</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(chargeTotal)}</span>
                    </div>
                  )}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.25)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>Subtotal</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {gstApplicable && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>GST ({gstRate}%)</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(gstAmount)}</span>
                    </div>
                  )}
                  <div style={{ height: '2px', background: 'rgba(255, 255, 255, 0.4)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#FFFFFF', fontSize: '1.125rem', fontWeight: 700 }}>Grand Total</span>
                    <span style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800 }}>
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Zero Margin Warning */}
              {showZeroMarginWarning && (
                <div
                  style={{
                    background: '#FFF7ED',
                    border: '1px solid #FDBA74',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <AlertTriangle size={20} color="#EA580C" />
                    <div>
                      <h4 style={{ color: '#9A3412', fontWeight: 700, marginBottom: '0.25rem' }}>
                        Zero Margin Detected
                      </h4>
                      <p style={{ color: '#7C2D12', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                        This quote has zero margin. Are you sure you want to proceed with this quote?
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={() => setShowZeroMarginWarning(false)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            color: '#475569',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                          }}
                        >
                          Go Back
                        </button>
                        <button
                          onClick={handleSubmitQuote}
                          disabled={submitting}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#F45325',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.6 : 1,
                          }}
                        >
                          {submitting ? 'Issuing...' : 'Proceed Anyway'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setIsBuilderOpen(false);
                    setShowZeroMarginWarning(false);
                  }}
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitQuote}
                  disabled={submitting || margin === ''}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: margin === '' || submitting ? '#94A3B8' : '#F45325',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: margin === '' || submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 1px 3px rgba(244, 83, 37, 0.25)',
                  }}
                >
                  <Send size={16} />
                  {submitting ? 'Issuing Quote...' : 'Issue Quote to Client'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Quote Details Modal */}
      {viewingQuote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
          onClick={() => setViewingQuote(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Quote Details
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {viewingQuote.requirement?.id} • Issued on{' '}
                  {new Date(viewingQuote.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setViewingQuote(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {/* Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#64748B', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Status
                </label>
                {getStatusBadge(viewingQuote.status)}
              </div>

              {/* Quote Breakdown */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '1.5rem',
                }}
              >
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>
                  Quote Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {canViewMargins() ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Vendor Total</span>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>
                          {formatCurrency(viewingQuote.vendor_total)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Margin</span>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>
                          {formatCurrency(viewingQuote.margin)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '0.6rem 0.85rem', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '0.8rem', color: '#64748B' }}>
                      🔒 Internal vendor costs and commercial margins are restricted to authorized personnel.
                    </div>
                  )}

                  {viewingQuote.charge_lines && viewingQuote.charge_lines.length > 0 && (
                    <>
                      <div style={{ height: '1px', background: '#E2E8F0' }} />
                      <p style={{ color: '#475569', fontSize: '0.875rem', fontWeight: 600 }}>
                        Additional Charges:
                      </p>
                      {viewingQuote.charge_lines.map((line) => (
                        <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem' }}>
                          <span style={{ color: '#64748B', fontSize: '0.875rem' }}>
                            {line.charge_type.replace(/_/g, ' ')} - {line.description}
                          </span>
                          <span style={{ color: '#0F172A', fontSize: '0.875rem', fontWeight: 500 }}>
                            {formatCurrency(line.amount)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  <div style={{ height: '1px', background: '#E2E8F0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Subtotal</span>
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>
                      {formatCurrency(
                        viewingQuote.vendor_total +
                          viewingQuote.margin +
                          (viewingQuote.charge_lines || []).reduce((sum, line) => sum + line.amount, 0)
                      )}
                    </span>
                  </div>

                  {viewingQuote.gst_applicable && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>GST ({viewingQuote.gst_rate}%)</span>
                      <span style={{ color: '#0F172A', fontWeight: 600 }}>
                        {formatCurrency(viewingQuote.gst_amount)}
                      </span>
                    </div>
                  )}

                  <div style={{ height: '2px', background: '#F45325' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#0F172A', fontSize: '1.125rem', fontWeight: 700 }}>Grand Total</span>
                    <span style={{ color: '#F45325', fontSize: '1.5rem', fontWeight: 800 }}>
                      {formatCurrency(viewingQuote.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            border: '1px solid #334155',
            zIndex: 2000,
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
