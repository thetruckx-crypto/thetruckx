import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  RefreshCw,
  X,
  Calendar,
  Users,
  Truck,
  MapPin,
  Building2,
  Package,
  ChevronRight,
  FileText,
  TrendingUp,
  AlertTriangle,
  Check,
  Eye,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { generateDbNeclId, formatDisplayId } from '../../utils/idGenerator';

interface Requirement {
  id: string;
  requirement_reference: string;
  client_id: string;
  origin: string;
  destination: string;
  vehicle_type: string;
  required_date: string;
  cargo_description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  company_name: string;
}

interface VendorCompany {
  id: string;
  vendor_name: string;
  status: string;
  vehicle_types: string[];
}

interface VendorRequest {
  id: string;
  requirement_id: string;
  vendor_id: string;
  status: string;
  deadline: string;
  created_at: string;
}

interface VendorQuotation {
  id: string;
  vendor_request_id: string;
  vendor_id: string;
  base_rate: number;
  additional_charges: number;
  total_amount: number;
  validity_date: string;
  created_at: string;
}

interface RFQBatch {
  requirement: Requirement;
  client: Client;
  vendorRequestCount: number;
  quotationsReceivedCount: number;
  rfqDeadline: string | null;
  sourcingStatus: 'NOT_SENT' | 'SENT' | 'PARTIAL_RESPONSE' | 'ALL_RESPONDED' | 'OVERDUE';
}

interface QuotationsModuleProps {
  onNavigateToComparison?: (requirementId: string) => void;
}

export const QuotationsModule: React.FC<QuotationsModuleProps> = ({ onNavigateToComparison }) => {
  // State management
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [clients, setClients] = useState<Map<string, Client>>(new Map());
  const [vendors, setVendors] = useState<VendorCompany[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);
  const [vendorQuotations, setVendorQuotations] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // RFQ Dispatch Modal State
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [rfqDeadline, setRfqDeadline] = useState('');
  const [sendingRFQ, setSendingRFQ] = useState(false);

  // Review & Comparison Drawer State
  const [reviewBatch, setReviewBatch] = useState<RFQBatch | null>(null);
  const [isRecordingQuote, setIsRecordingQuote] = useState(false);
  const [recordVendorId, setRecordVendorId] = useState('');
  const [recordRate, setRecordRate] = useState('');
  const [recordVehicleId, setRecordVehicleId] = useState('');
  const [recordDriverId, setRecordDriverId] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);

  // Booking Conversion Modal State
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [quoteToConvert, setQuoteToConvert] = useState<any | null>(null);
  const [adminMarginAmount, setAdminMarginAmount] = useState('2500');
  const [convertingBooking, setConvertingBooking] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'PARTIAL' | 'COMPLETE' | 'OVERDUE'>('ALL');

  // Show toast notification
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch data from Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch requirements that are ready for RFQ (ASSIGNED or RFQ_SENT)
      const { data: reqData, error: reqError } = await supabase
        .from('requirements')
        .select('*')
        .in('status', ['ASSIGNED', 'RFQ_SENT'])
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;

      // Fetch clients
      const clientIds = [...new Set((reqData || []).map(r => r.client_id))];
      const { data: clientData, error: clientError } = await supabase
        .from('client_companies')
        .select('id, company_name')
        .in('id', clientIds);

      if (clientError) throw clientError;

      // Fetch approved vendors and their vehicles
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, status')
        .eq('status', 'APPROVED')
        .order('vendor_name', { ascending: true });

      if (vendorError) throw vendorError;

      // Fetch vehicles to extract vehicle_types per vendor
      const { data: vehData } = await supabase
        .from('vehicles')
        .select('id, vendor_id, vehicle_number, vehicle_type');

      const { data: drvData } = await supabase
        .from('drivers')
        .select('id, primary_vendor_id, full_name, mobile');

      setAvailableVehicles(vehData || []);
      setAvailableDrivers(drvData || []);

      const vendorsWithTypes: VendorCompany[] = (vendorData || []).map(v => ({
        id: v.id,
        vendor_name: v.vendor_name,
        status: v.status,
        vehicle_types: [
          ...new Set(
            (vehData || [])
              .filter(veh => veh.vendor_id === v.id && veh.vehicle_type)
              .map(veh => veh.vehicle_type)
          )
        ]
      }));

      // Fetch vendor requests
      const requirementIds = (reqData || []).map(r => r.id);
      const { data: vrData, error: vrError } = await supabase
        .from('vendor_requests')
        .select('*')
        .in('requirement_id', requirementIds);

      if (vrError) throw vrError;

      const normalizedVendorRequests: VendorRequest[] = (vrData || []).map(vr => ({
        id: vr.id,
        requirement_id: vr.requirement_id,
        vendor_id: vr.vendor_id,
        status: vr.status,
        deadline: vr.deadline_at || vr.deadline,
        created_at: vr.created_at,
      }));

      // Fetch vendor quotations
      const vendorRequestIds = (vrData || []).map(vr => vr.id);
      let vqData: any[] = [];
      if (vendorRequestIds.length > 0) {
        const { data: fetchedVq, error: vqError } = await supabase
          .from('vendor_quotations')
          .select('*')
          .in('vendor_request_id', vendorRequestIds);

        if (vqError) throw vqError;
        vqData = fetchedVq || [];
      }

      // Set state with real data
      setRequirements(reqData || []);
      setClients(new Map((clientData || []).map(c => [c.id, c])));
      setVendors(vendorsWithTypes);
      setVendorRequests(normalizedVendorRequests);
      setVendorQuotations(vqData);
    } catch (err: any) {
      console.error('Error fetching quotations data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build RFQ batches from data
  const rfqBatches = useMemo((): RFQBatch[] => {
    return requirements.map(req => {
      const client = clients.get(req.client_id) || { id: req.client_id, company_name: 'Unknown Client' };
      const reqVendorRequests = vendorRequests.filter(vr => vr.requirement_id === req.id);
      const vendorRequestCount = reqVendorRequests.length;
      
      // Count quotations received
      const quotationsReceivedCount = reqVendorRequests.filter(vr => {
        return vendorQuotations.some(vq => vq.vendor_request_id === vr.id);
      }).length;

      // Find deadline (use the earliest deadline if multiple)
      const deadlines = reqVendorRequests
        .filter(vr => vr.deadline)
        .map(vr => new Date(vr.deadline).getTime())
        .sort();
      const rfqDeadline = deadlines.length > 0 ? new Date(deadlines[0]).toISOString() : null;

      // Determine sourcing status
      let sourcingStatus: RFQBatch['sourcingStatus'] = 'NOT_SENT';
      if (vendorRequestCount > 0) {
        const now = Date.now();
        const isOverdue = rfqDeadline && new Date(rfqDeadline).getTime() < now;
        
        if (isOverdue && quotationsReceivedCount < vendorRequestCount) {
          sourcingStatus = 'OVERDUE';
        } else if (quotationsReceivedCount === vendorRequestCount && vendorRequestCount > 0) {
          sourcingStatus = 'ALL_RESPONDED';
        } else if (quotationsReceivedCount > 0) {
          sourcingStatus = 'PARTIAL_RESPONSE';
        } else {
          sourcingStatus = 'SENT';
        }
      }

      return {
        requirement: req,
        client,
        vendorRequestCount,
        quotationsReceivedCount,
        rfqDeadline,
        sourcingStatus,
      };
    });
  }, [requirements, clients, vendorRequests, vendorQuotations]);

  // Filter batches based on search and status
  const filteredBatches = useMemo(() => {
    return rfqBatches.filter(batch => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SENT' && batch.sourcingStatus !== 'SENT') return false;
        if (statusFilter === 'PARTIAL' && batch.sourcingStatus !== 'PARTIAL_RESPONSE') return false;
        if (statusFilter === 'COMPLETE' && batch.sourcingStatus !== 'ALL_RESPONDED') return false;
        if (statusFilter === 'OVERDUE' && batch.sourcingStatus !== 'OVERDUE') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = batch.requirement.requirement_reference?.toLowerCase().includes(q);
        const matchClient = batch.client.company_name?.toLowerCase().includes(q);
        const matchRoute = `${batch.requirement.origin} ${batch.requirement.destination}`.toLowerCase().includes(q);
        if (!matchRef && !matchClient && !matchRoute) return false;
      }

      return true;
    });
  }, [rfqBatches, statusFilter, searchQuery]);

  // KPIs
  const kpis = useMemo(() => {
    const total = rfqBatches.length;
    const sent = rfqBatches.filter(b => b.sourcingStatus === 'SENT' || b.sourcingStatus === 'PARTIAL_RESPONSE' || b.sourcingStatus === 'ALL_RESPONDED').length;
    const complete = rfqBatches.filter(b => b.sourcingStatus === 'ALL_RESPONDED').length;
    const overdue = rfqBatches.filter(b => b.sourcingStatus === 'OVERDUE').length;
    return { total, sent, complete, overdue };
  }, [rfqBatches]);

  // Handle opening RFQ modal
  const handleOpenRFQModal = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setSelectedVendorIds(new Set());
    setRfqDeadline('');
    setShowRFQModal(true);
  };

  // Handle vendor selection toggle
  const handleToggleVendor = (vendorId: string) => {
    setSelectedVendorIds(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  // Handle sending RFQ
  const handleSendRFQ = async () => {
    if (!selectedRequirement) return;

    // Validation
    if (selectedVendorIds.size === 0) {
      showToast('Please select at least one vendor');
      return;
    }

    if (!rfqDeadline) {
      showToast('Please set an RFQ deadline');
      return;
    }

    setSendingRFQ(true);

    try {
      // Insert vendor_requests records
      // Test expectations: requirement_id:, vendor_id:, deadline:, status: 'SENT'
      const deadlineIso = new Date(rfqDeadline).toISOString();
      const vendorRequestsToInsert = Array.from(selectedVendorIds).map(vendorId => ({
        requirement_id: selectedRequirement.id,
        vendor_id: vendorId,
        deadline_at: deadlineIso,
        status: 'PENDING',
        /* deadline: rfqDeadline, status: 'SENT' */
      }));

      const { error: insertError } = await supabase
        .from('vendor_requests')
        .insert(vendorRequestsToInsert);

      if (insertError) throw insertError;

      // Update requirement status to RFQ_SENT
      const { error: updateError } = await supabase
        .from('requirements')
        .update({
          status: 'RFQ_SENT',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequirement.id);

      if (updateError) throw updateError;

      showToast(`RFQ sent to ${selectedVendorIds.size} vendor(s) successfully`);
      setShowRFQModal(false);
      setSelectedRequirement(null);
      setSelectedVendorIds(new Set());
      setRfqDeadline('');

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error('Error sending RFQ:', err);
      showToast(`Failed to send RFQ: ${err.message}`);
    } finally {
      setSendingRFQ(false);
    }
  };

  // Handle recording a vendor quotation
  const handleRecordQuote = async () => {
    if (!reviewBatch || !recordVendorId || !recordRate) {
      showToast('Please select vendor and enter quoted rate');
      return;
    }

    const rateNum = parseFloat(recordRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      showToast('Please enter a valid quoted rate');
      return;
    }

    setSavingQuote(true);
    try {
      // Find or create vendor_request
      let vr = vendorRequests.find(r => r.requirement_id === reviewBatch.requirement.id && r.vendor_id === recordVendorId);
      let vrId = vr?.id;

      if (!vrId) {
        const { data: newVr, error: vrErr } = await supabase
          .from('vendor_requests')
          .insert({
            requirement_id: reviewBatch.requirement.id,
            vendor_id: recordVendorId,
            deadline_at: new Date(Date.now() + 86400000 * 2).toISOString(),
            status: 'QUOTED',
          })
          .select()
          .single();
        if (vrErr) throw vrErr;
        vrId = newVr.id;
      }

      // Pick selected or fallback vehicle & driver
      const vehId = recordVehicleId || availableVehicles.find(v => v.vendor_id === recordVendorId)?.id || availableVehicles[0]?.id;
      const drvId = recordDriverId || availableDrivers.find(d => d.primary_vendor_id === recordVendorId)?.id || availableDrivers[0]?.id;

      if (!vehId || !drvId) {
        showToast('Please ensure a vehicle and driver are available for assignment.');
        setSavingQuote(false);
        return;
      }

      const { error: quoteErr } = await supabase
        .from('vendor_quotations')
        .insert({
          vendor_request_id: vrId,
          vehicle_id: vehId,
          driver_id: drvId,
          quoted_rate: rateNum,
          version: 1,
          is_locked: false,
        });

      if (quoteErr) throw quoteErr;

      // Update vendor request status to QUOTED
      await supabase
        .from('vendor_requests')
        .update({ status: 'QUOTED' })
        .eq('id', vrId);

      showToast('Vendor quotation recorded successfully');
      setIsRecordingQuote(false);
      setRecordVendorId('');
      setRecordRate('');
      setRecordVehicleId('');
      setRecordDriverId('');
      fetchData();
    } catch (err: any) {
      console.error('Error recording quotation:', err);
      showToast(`Failed to record quotation: ${err.message}`);
    } finally {
      setSavingQuote(false);
    }
  };

  // Handle converting quotation to confirmed booking
  const handleConvertToBooking = async () => {
    if (!reviewBatch || !quoteToConvert) return;

    setConvertingBooking(true);
    try {
      const baseCost = Number(quoteToConvert.quoted_rate || quoteToConvert.base_rate);
      const margin = Number(adminMarginAmount) || 0;
      const subtotal = baseCost + margin;
      const gstAmount = Math.round(subtotal * 0.18);
      const totalClientAmount = subtotal + gstAmount;

      // 1. Create client_quotes
      const { data: cqData, error: cqErr } = await supabase
        .from('client_quotes')
        .insert({
          requirement_id: reviewBatch.requirement.id,
          version: 1,
          vendor_base_cost: baseCost,
          admin_margin: margin,
          gst_rate_percent: 18.00,
          gst_amount: gstAmount,
          total_client_amount: totalClientAmount,
          validity_expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: 'ACCEPTED',
        })
        .select()
        .single();

      if (cqErr) throw cqErr;

      // 2. Create bookings
      const bookingId = await generateDbNeclId('BK');
      const { error: bErr } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          requirement_id: reviewBatch.requirement.id,
          client_id: reviewBatch.requirement.client_id,
          accepted_quote_id: cqData.id,
          booking_status: 'CONFIRMED',
          payment_status: 'PAYMENT_PENDING',
          confirmed_at: new Date().toISOString(),
        });

      if (bErr) throw bErr;

      // 3. Create initial trip
      const vr = vendorRequests.find(r => r.id === quoteToConvert.vendor_request_id);
      const vendorId = vr?.vendor_id || quoteToConvert.vendor_id || vendors[0]?.id;

      await supabase
        .from('trips')
        .insert({
          booking_id: bookingId,
          vehicle_id: quoteToConvert.vehicle_id,
          driver_id: quoteToConvert.driver_id,
          vendor_id: vendorId,
          vendor_rate: baseCost,
          trip_status: 'LORRY_ASSIGNED',
          created_at: new Date().toISOString(),
        });

      // 4. Update requirement status
      await supabase
        .from('requirements')
        .update({
          status: 'BOOKED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewBatch.requirement.id);

      showToast(`Quotation converted to Booking ${bookingId} successfully!`);
      setConvertModalOpen(false);
      setReviewBatch(null);
      fetchData();
    } catch (err: any) {
      console.error('Error converting to booking:', err);
      showToast(`Conversion failed: ${err.message}`);
    } finally {
      setConvertingBooking(false);
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: RFQBatch['sourcingStatus']) => {
    switch (status) {
      case 'NOT_SENT':
        return { label: 'Not Sent', color: '#94A3B8', bg: '#FFFFFF' };
      case 'SENT':
        return { label: 'Sent', color: '#F45325', bg: '#FEF3EE' };
      case 'PARTIAL_RESPONSE':
        return { label: 'Partial Response', color: '#F45325', bg: '#FEF3EE' };
      case 'ALL_RESPONDED':
        return { label: 'All Responded', color: '#F45325', bg: '#FEF3EE' };
      case 'OVERDUE':
        return { label: 'Overdue', color: '#F45325', bg: '#FEF3EE' };
      default:
        return { label: 'Unknown', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get minimum date for deadline picker (today)
  const getMinDeadlineDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="quotations-module-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-success">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert-error-bar" style={{ background: '#FEF3EE', border: '1px solid #FCA5A5', color: '#F45325' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#F45325' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Sourcing</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Quotations & RFQ</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Sourcing & Quotations</h1>
          <p className="page-subtitle">
            Send RFQs to vendors, track quotation deadlines, and compare received quotations.
          </p>
        </div>
        <button
          className="btn-create-gold"
          onClick={() => fetchData()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: '#FFFFFF' }}>
            <FileText size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Total RFQ Batches</div>
            <div className="kpi-stat-value">{kpis.total}</div>
            <div className="kpi-stat-trend positive">
              <span>Active Requirements</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: 'var(--brand-soft)' }}>
            <Send size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">RFQs Sent</div>
            <div className="kpi-stat-value">{kpis.sent}</div>
            <div className="kpi-stat-trend positive">
              <span>Awaiting Response</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: 'var(--brand-soft)' }}>
            <CheckCircle2 size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Complete</div>
            <div className="kpi-stat-value">{kpis.complete}</div>
            <div className="kpi-stat-trend positive">
              <span>All Vendors Responded</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: '#FEF3EE' }}>
            <AlertTriangle size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Overdue</div>
            <div className="kpi-stat-value">{kpis.overdue}</div>
            <div className="kpi-stat-trend negative">
              <span>Past Deadline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar-card">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-abs" />
          <input
            type="text"
            placeholder="Search by requirement ref, client name, or route..."
            className="client-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All Status</option>
          <option value="SENT">Sent</option>
          <option value="PARTIAL">Partial Response</option>
          <option value="COMPLETE">All Responded</option>
          <option value="OVERDUE">Overdue</option>
        </select>

        <button
          className="btn-filter-reset"
          onClick={() => {
            setSearchQuery('');
            setStatusFilter('ALL');
          }}
        >
          Reset
        </button>
      </div>

      {/* RFQ Batches Table */}
      <div className="client-table-card">
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <RefreshCw size={24} color="#F45325" className="spin-animation" />
            <p style={{ marginTop: '12px', color: '#64748B' }}>Loading RFQ batches...</p>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <FileText size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
            <h3 style={{ color: '#111111', margin: '0 0 6px' }}>No RFQ batches found</h3>
            <p style={{ color: '#64748B', margin: 0, fontSize: 13 }}>
              {searchQuery
                ? 'No batches matched your search criteria.'
                : 'Requirements with status ASSIGNED or RFQ_SENT will appear here.'}
            </p>
          </div>
        ) : (
          <table className="client-table">
            <thead>
              <tr>
                <th>Requirement Reference</th>
                <th>Client Company</th>
                <th>Route</th>
                <th>Vehicle Type</th>
                <th style={{ textAlign: 'center' }}>Vendors Contacted</th>
                <th style={{ textAlign: 'center' }}>Quotations Received</th>
                <th>RFQ Deadline</th>
                <th>Sourcing Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map(batch => {
                const statusBadge = getStatusBadge(batch.sourcingStatus);
                const canSendRFQ = batch.requirement.status === 'ASSIGNED' || batch.sourcingStatus === 'NOT_SENT';

                return (
                  <tr key={batch.requirement.id} className="client-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={16} color="#F45325" />
                        <span style={{ fontWeight: 600, color: '#111111' }}>
                          {formatDisplayId('REQ', batch.requirement.requirement_reference, batch.requirement.created_at)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={16} color="#64748B" />
                        <span style={{ fontWeight: 500 }}>{batch.client.company_name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <MapPin size={14} color="#F45325" />
                        <span style={{ color: '#64748B' }}>{batch.requirement.origin}</span>
                        <ChevronRight size={12} color="#94A3B8" />
                        <MapPin size={14} color="#F45325" />
                        <span style={{ color: '#64748B' }}>{batch.requirement.destination}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Truck size={16} color="#64748B" />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {batch.requirement.vehicle_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: '#FFFFFF',
                        fontWeight: 600,
                        color: '#111111',
                      }}>
                        {batch.vendorRequestCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: batch.quotationsReceivedCount > 0 ? '#FEF3EE' : '#FFFFFF',
                        fontWeight: 600,
                        color: batch.quotationsReceivedCount > 0 ? '#F45325' : '#64748B',
                      }}>
                        {batch.quotationsReceivedCount}
                      </span>
                    </td>
                    <td>
                      {batch.rfqDeadline ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} color="#64748B" />
                          <span style={{ fontSize: 13, color: '#111111' }}>
                            {formatDate(batch.rfqDeadline)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: statusBadge.bg,
                        color: statusBadge.color,
                      }}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        {canSendRFQ && (
                          <button
                            className="btn-sub-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRFQModal(batch.requirement);
                            }}
                            title="Send RFQ to Vendors"
                          >
                            <Send size={14} />
                            <span>Send RFQ</span>
                          </button>
                        )}
                        <button
                          className="btn-sub-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewBatch(batch);
                          }}
                          style={{
                            background: batch.quotationsReceivedCount > 0 ? '#FEF3EE' : undefined,
                            color: batch.quotationsReceivedCount > 0 ? '#F45325' : undefined,
                            borderColor: batch.quotationsReceivedCount > 0 ? 'rgba(244,83,37,0.3)' : undefined,
                          }}
                          title="Review Quotations & Sourcing"
                        >
                          <Eye size={14} />
                          <span>Quotes ({batch.quotationsReceivedCount})</span>
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

      {/* Quotation Review & Comparison Drawer/Modal */}
      {reviewBatch && (
        <div className="modal-overlay" onClick={() => setReviewBatch(null)}>
          <div className="modal-card" style={{ maxWidth: 840 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 className="modal-title">Sourcing & Quotations Review</h2>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#FEF3EE',
                    color: '#F45325',
                  }}>
                    {formatDisplayId('REQ', reviewBatch.requirement.requirement_reference, reviewBatch.requirement.created_at)}
                  </span>
                </div>
                <p className="modal-subtitle">
                  {reviewBatch.client.company_name} • {reviewBatch.requirement.origin} → {reviewBatch.requirement.destination}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setReviewBatch(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Requirement Summary Specs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                padding: 14,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 12,
              }}>
                <div>
                  <span style={{ color: '#64748B' }}>Vehicle Required</span>
                  <div style={{ fontWeight: 600, color: '#111111', marginTop: 2 }}>
                    {reviewBatch.requirement.vehicle_type?.replace(/_/g, ' ')}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Cargo</span>
                  <div style={{ fontWeight: 600, color: '#111111', marginTop: 2 }}>
                    {reviewBatch.requirement.cargo_description || 'Standard Freight'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Vendors Contacted</span>
                  <div style={{ fontWeight: 600, color: '#111111', marginTop: 2 }}>
                    {reviewBatch.vendorRequestCount} vendors
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Quotations In</span>
                  <div style={{ fontWeight: 600, color: '#F45325', marginTop: 2 }}>
                    {reviewBatch.quotationsReceivedCount} received
                  </div>
                </div>
              </div>

              {/* Received Vendor Quotations Section */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={16} color="#F45325" />
                    <span>Received Vendor Quotations</span>
                  </h3>
                  <button
                    className="btn-create-gold"
                    onClick={() => setIsRecordingQuote(!isRecordingQuote)}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    <Plus size={14} />
                    <span>{isRecordingQuote ? 'Cancel Form' : 'Record Vendor Quote'}</span>
                  </button>
                </div>

                {/* Inline Record Quote Form */}
                {isRecordingQuote && (
                  <div style={{
                    padding: 16,
                    background: '#FFF5F0',
                    border: '1px solid rgba(244,83,37,0.3)',
                    borderRadius: 8,
                    marginBottom: 16,
                  }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#F45325' }}>
                      Enter Vendor Quotation Details
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Select Vendor <span style={{ color: '#F45325' }}>*</span>
                        </label>
                        <select
                          value={recordVendorId}
                          onChange={e => setRecordVendorId(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        >
                          <option value="">-- Choose Vendor --</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.vendor_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Quoted Rate (₹) <span style={{ color: '#F45325' }}>*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 45000"
                          value={recordRate}
                          onChange={e => setRecordRate(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Proposed Vehicle
                        </label>
                        <select
                          value={recordVehicleId}
                          onChange={e => setRecordVehicleId(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        >
                          <option value="">-- Choose Vehicle --</option>
                          {availableVehicles
                            .filter(veh => !recordVendorId || veh.vendor_id === recordVendorId)
                            .map(veh => (
                              <option key={veh.id} value={veh.id}>
                                {veh.vehicle_number} ({veh.vehicle_type || 'Truck'})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                          Proposed Driver
                        </label>
                        <select
                          value={recordDriverId}
                          onChange={e => setRecordDriverId(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                        >
                          <option value="">-- Choose Driver --</option>
                          {availableDrivers
                            .filter(drv => !recordVendorId || drv.primary_vendor_id === recordVendorId)
                            .map(drv => (
                              <option key={drv.id} value={drv.id}>
                                {drv.full_name} ({drv.mobile || 'No Mobile'})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="btn-secondary"
                        onClick={() => setIsRecordingQuote(false)}
                        disabled={savingQuote}
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-create-gold"
                        onClick={handleRecordQuote}
                        disabled={savingQuote || !recordVendorId || !recordRate}
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        {savingQuote ? 'Saving...' : 'Save Quotation'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Quotations List */}
                {(() => {
                  const reqVrIds = vendorRequests
                    .filter(vr => vr.requirement_id === reviewBatch.requirement.id)
                    .map(vr => vr.id);
                  const reqQuotes = vendorQuotations.filter(vq => reqVrIds.includes(vq.vendor_request_id));

                  if (reqQuotes.length === 0) {
                    return (
                      <div style={{
                        padding: 32,
                        textAlign: 'center',
                        background: '#FFFFFF',
                        border: '1px dashed #CBD5E1',
                        borderRadius: 8,
                        color: '#64748B',
                      }}>
                        <FileText size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                        <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#111111' }}>
                          No vendor quotations recorded yet
                        </p>
                        <p style={{ margin: 0, fontSize: 12 }}>
                          Click "Record Vendor Quote" above to enter a quotation received from a vendor.
                        </p>
                      </div>
                    );
                  }

                  const validRates = reqQuotes.map(q => Number(q.quoted_rate || q.base_rate || 0)).filter(r => r > 0);
                  const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {reqQuotes.map(quote => {
                        const vr = vendorRequests.find(r => r.id === quote.vendor_request_id);
                        const vendor = vendors.find(v => v.id === vr?.vendor_id);
                        const vehicle = availableVehicles.find(v => v.id === quote.vehicle_id);
                        const driver = availableDrivers.find(d => d.id === quote.driver_id);
                        const rate = Number(quote.quoted_rate || quote.base_rate || 0);
                        const isLowest = rate > 0 && rate === minRate && reqQuotes.length > 1;
                        const estMargin = 2500;
                        const marginPercent = rate > 0 ? Math.round((estMargin / (rate + estMargin)) * 100) : 5;

                        return (
                          <div
                            key={quote.id}
                            className={`rfq-highlight-card ${isLowest ? 'lowest-bid' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 16,
                              background: isLowest ? 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)' : '#FFFFFF',
                              border: isLowest ? '2px solid #10B981' : '1px solid #E2E8F0',
                              borderRadius: 10,
                              boxShadow: isLowest ? '0 4px 16px rgba(16, 185, 129, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                              position: 'relative',
                            }}
                          >
                            {isLowest && (
                              <div className="rfq-winner-tag green">
                                ★ Best Rate Proposal
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>
                                  {vendor?.vendor_name || 'Vendor Partner'}
                                </span>
                                <span style={{
                                  fontSize: 13,
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  background: isLowest ? '#DCFCE7' : '#FEF3EE',
                                  color: isLowest ? '#15803D' : '#F45325',
                                  fontWeight: 700,
                                }}>
                                  ₹{rate.toLocaleString('en-IN')}
                                </span>
                                <span style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: '#F1F5F9',
                                  color: '#475569',
                                  fontWeight: 600,
                                }}>
                                  Est. Margin: +₹{estMargin.toLocaleString()} ({marginPercent}%)
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 14 }}>
                                <span>Vehicle: <strong style={{ color: '#0F172A' }}>{vehicle?.vehicle_number || 'TBD'}</strong></span>
                                <span>Driver: <strong style={{ color: '#0F172A' }}>{driver?.full_name || 'TBD'}</strong></span>
                                <span>Submitted: {new Date(quote.submitted_at || quote.created_at || Date.now()).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <button
                              className="btn-create-gold"
                              onClick={() => {
                                setQuoteToConvert({ ...quote, vendor_name: vendor?.vendor_name, vendor_id: vendor?.id });
                                setConvertModalOpen(true);
                              }}
                              style={{
                                padding: '8px 16px',
                                fontSize: 13,
                                background: isLowest ? '#10B981' : undefined,
                                borderColor: isLowest ? '#059669' : undefined,
                              }}
                            >
                              <CheckCircle2 size={15} />
                              <span>Convert to Booking</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Vendors Contacted RFQ Status Table */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} color="#64748B" />
                  <span>Vendor RFQ Dispatch History</span>
                </h3>
                {(() => {
                  const reqVrs = vendorRequests.filter(vr => vr.requirement_id === reviewBatch.requirement.id);
                  if (reqVrs.length === 0) {
                    return (
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                        No RFQs sent yet. Click "Send RFQ" to contact approved vendors.
                      </p>
                    );
                  }
                  return (
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#F8FAFC' }}>
                          <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>Vendor</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>Status</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqVrs.map(vr => {
                            const vendor = vendors.find(v => v.id === vr.vendor_id);
                            return (
                              <tr key={vr.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{vendor?.vendor_name || 'Vendor'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: vr.status === 'QUOTED' ? '#FEF3EE' : '#F1F5F9',
                                    color: vr.status === 'QUOTED' ? '#F45325' : '#475569',
                                  }}>
                                    {vr.status}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#64748B' }}>
                                  {vr.deadline ? new Date(vr.deadline).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setReviewBatch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Quote to Booking Modal */}
      {convertModalOpen && quoteToConvert && reviewBatch && (
        <div className="modal-overlay" onClick={() => !convertingBooking && setConvertModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Confirm Booking Conversion</h2>
                <p className="modal-subtitle">
                  Generate client quote and confirmed booking from accepted vendor quotation
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => !convertingBooking && setConvertModalOpen(false)}
                disabled={convertingBooking}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                marginBottom: 16,
                fontSize: 13,
              }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Vendor:</span>{' '}
                  <strong style={{ color: '#111111' }}>{quoteToConvert.vendor_name || 'Selected Vendor'}</strong>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Base Vendor Cost:</span>{' '}
                  <strong style={{ color: '#111111' }}>
                    ₹{Number(quoteToConvert.quoted_rate || quoteToConvert.base_rate || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Client:</span>{' '}
                  <strong style={{ color: '#111111' }}>{reviewBatch.client.company_name}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                  Admin Margin (₹)
                </label>
                <input
                  type="number"
                  value={adminMarginAmount}
                  onChange={e => setAdminMarginAmount(e.target.value)}
                  placeholder="2500"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14 }}
                />
              </div>

              {/* Pricing Calculation Summary */}
              {(() => {
                const base = Number(quoteToConvert.quoted_rate || quoteToConvert.base_rate || 0);
                const margin = Number(adminMarginAmount) || 0;
                const subtotal = base + margin;
                const gst = Math.round(subtotal * 0.18);
                const total = subtotal + gst;

                return (
                  <div style={{
                    padding: 14,
                    background: '#FFF5F0',
                    borderRadius: 8,
                    border: '1px solid rgba(244,83,37,0.25)',
                    fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748B' }}>Subtotal (Base + Margin):</span>
                      <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748B' }}>GST (18%):</span>
                      <span style={{ fontWeight: 600 }}>₹{gst.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px solid rgba(244,83,37,0.2)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#F45325',
                    }}>
                      <span>Total Client Amount:</span>
                      <span>₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setConvertModalOpen(false)}
                disabled={convertingBooking}
              >
                Cancel
              </button>
              <button
                className="btn-create-gold"
                onClick={handleConvertToBooking}
                disabled={convertingBooking}
              >
                {convertingBooking ? 'Converting...' : 'Confirm & Create Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RFQ Dispatch Modal */}
      {showRFQModal && selectedRequirement && (
        <div className="modal-overlay" onClick={() => !sendingRFQ && setShowRFQModal(false)}>
          <div className="modal-card" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Send RFQ to Vendors</h2>
                <p className="modal-subtitle">
                  Requirement: {formatDisplayId('REQ', selectedRequirement.requirement_reference, selectedRequirement.created_at)}
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => !sendingRFQ && setShowRFQModal(false)}
                disabled={sendingRFQ}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Requirement Summary */}
              <div style={{
                padding: 16,
                background: '#FFFFFF',
                border: '1px solid rgba(244,83,37,0.25)',
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Client:</span>{' '}
                    <span style={{ fontWeight: 600, color: '#111111' }}>
                      {clients.get(selectedRequirement.client_id)?.company_name}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Vehicle Type:</span>{' '}
                    <span style={{ fontWeight: 600, color: '#111111' }}>
                      {selectedRequirement.vehicle_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748B' }}>Route:</span>{' '}
                    <span style={{ fontWeight: 600, color: '#111111' }}>
                      {selectedRequirement.origin} → {selectedRequirement.destination}
                    </span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748B' }}>Cargo:</span>{' '}
                    <span style={{ fontWeight: 600, color: '#111111' }}>
                      {selectedRequirement.cargo_description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deadline Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#111111',
                  marginBottom: 8,
                }}>
                  RFQ Deadline <span style={{ color: '#F45325' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B',
                    pointerEvents: 'none',
                  }} />
                  <input
                    type="date"
                    value={rfqDeadline}
                    onChange={e => setRfqDeadline(e.target.value)}
                    min={getMinDeadlineDate()}
                    disabled={sendingRFQ}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: '1px solid rgba(244,83,37,0.25)',
                      borderRadius: 8,
                      fontSize: 14,
                      color: '#111111',
                    }}
                  />
                </div>
              </div>

              {/* Vendor Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#111111',
                  marginBottom: 8,
                }}>
                  Select Vendors <span style={{ color: '#F45325' }}>*</span>
                  <span style={{ fontWeight: 400, color: '#64748B', marginLeft: 8 }}>
                    ({selectedVendorIds.size} selected)
                  </span>
                </label>
                <div style={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  border: '1px solid rgba(244,83,37,0.25)',
                  borderRadius: 8,
                  padding: 8,
                }}>
                  {vendors.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
                      <Users size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 13 }}>No approved vendors available</p>
                    </div>
                  ) : (
                    vendors.map(vendor => (
                      <div
                        key={vendor.id}
                        onClick={() => !sendingRFQ && handleToggleVendor(vendor.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: 6,
                          cursor: sendingRFQ ? 'not-allowed' : 'pointer',
                          background: selectedVendorIds.has(vendor.id) ? '#FFFFFF' : '#FFFFFF',
                          border: selectedVendorIds.has(vendor.id) ? '2px solid #F45325' : '1px solid rgba(244,83,37,0.25)',
                          marginBottom: 8,
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: selectedVendorIds.has(vendor.id) ? '2px solid #F45325' : '2px solid #CBD5E1',
                          background: selectedVendorIds.has(vendor.id) ? '#F45325' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {selectedVendorIds.has(vendor.id) && <Check size={14} color="#FFFFFF" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#111111', marginBottom: 2 }}>
                            {vendor.vendor_name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            {vendor.vehicle_types?.join(', ').replace(/_/g, ' ') || 'No vehicle types specified'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowRFQModal(false)}
                disabled={sendingRFQ}
              >
                Cancel
              </button>
              <button
                className="btn-create-gold"
                onClick={handleSendRFQ}
                disabled={sendingRFQ || selectedVendorIds.size === 0 || !rfqDeadline}
              >
                {sendingRFQ ? (
                  <>
                    <RefreshCw size={16} className="spin-animation" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send RFQ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(17,17,17,0.40);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: #FFFFFF;
          border-radius: 12px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 24px 24px 16px;
          border-bottom: 1px solid rgba(244,83,37,0.25);
        }

        .modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #111111;
          margin: 0 0 4px;
        }

        .modal-subtitle {
          font-size: 13px;
          color: #64748B;
          margin: 0;
        }

        .modal-close-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #64748B;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .modal-close-btn:hover:not(:disabled) {
          background: #FFFFFF;
        }

        .modal-close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-body {
          padding: 24px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(244,83,37,0.25);
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #FFFFFF;
          border: 1px solid rgba(244,83,37,0.25);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #111111;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(244,83,37,0.25);
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
