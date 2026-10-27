import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Download,
  RotateCcw,
  MoreVertical,
  Settings,
  ShieldCheck,
  Phone,
  DollarSign,
  ChevronLeft,
  ArrowRight,
  Layers
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { generateDbNeclId, formatDisplayId } from '../../utils/idGenerator';
import { useToast } from '../../context/ToastContext';

export interface Requirement {
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
  required_capacity_mt?: number;
  special_instructions?: string;
  client_company?: {
    company_name: string;
    client_code?: string;
  };
}

export interface Client {
  id: string;
  company_name: string;
  client_code?: string;
}

export interface VendorCompany {
  id: string;
  vendor_name: string;
  status: string;
  vehicle_types: string[];
  vendor_code?: string;
  contact_phone?: string;
  city?: string;
  state?: string;
}

export interface VendorRequest {
  id: string;
  requirement_id: string;
  vendor_id: string;
  status: string;
  deadline: string;
  created_at: string;
}

export interface VendorQuotation {
  id: string;
  vendor_request_id: string;
  vendor_id: string;
  base_rate: number;
  additional_charges: number;
  total_amount: number;
  validity_date: string;
  created_at: string;
  quoted_rate?: number;
  vehicle_id?: string;
  driver_id?: string;
  submitted_at?: string;
}

export interface RFQBatch {
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
  const navigate = useNavigate();
  const toast = useToast();

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

  // Filters & Tabs
  const [statusTab, setStatusTab] = useState<'ALL' | 'DRAFT' | 'SENT' | 'PARTIAL' | 'COMPLETE' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'PARTIAL' | 'COMPLETE' | 'OVERDUE'>('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action Menu Dropdown Anchor
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top?: number;
    bottom?: number;
    right: number;
    batch: RFQBatch;
  } | null>(null);

  // RFQ Creation / Dispatch Modal
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [rfqDeadline, setRfqDeadline] = useState('');
  const [rfqDeadlineTime, setRfqDeadlineTime] = useState('17:00');
  const [sendingRFQ, setSendingRFQ] = useState(false);

  // Review & Comparison Modal State
  const [reviewBatch, setReviewBatch] = useState<RFQBatch | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedCompareQuote, setSelectedCompareQuote] = useState<any | null>(null);

  // Detail Drawer Modal State
  const [detailModalBatch, setDetailModalBatch] = useState<RFQBatch | null>(null);

  // Manage Vendors Modal State
  const [manageVendorsBatch, setManageVendorsBatch] = useState<RFQBatch | null>(null);
  const [invitingVendors, setInvitingVendors] = useState(false);

  // Activity History Modal State
  const [historyModalBatch, setHistoryModalBatch] = useState<RFQBatch | null>(null);

  // Inline Record Quote Form inside Comparison
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

  // Client Quotes Map for tracking acceptance status
  const [clientQuotesMap, setClientQuotesMap] = useState<Map<string, any>>(new Map());

  // Show toast notification
  const showToast = useCallback((message: string) => {
    toast.success(message);
  }, [toast]);

  // Fetch data from Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureAdminSession();

      // Fetch requirements with ASSIGNED, RFQ_SENT, UNDER_REVIEW status
      const { data: reqData, error: reqError } = await supabase
        .from('requirements')
        .select('*')
        .in('status', ['UNDER_REVIEW', 'ASSIGNED', 'RFQ_SENT', 'QUOTED', 'VENDOR_SELECTED', 'CLIENT_QUOTED', 'BOOKED'])
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;

      // Fetch clients
      const clientIds = [...new Set((reqData || []).map((r: any) => r.client_id))];
      let clientMap = new Map<string, Client>();
      if (clientIds.length > 0) {
        const { data: clientData, error: clientError } = await supabase
          .from('client_companies')
          .select('id, company_name, client_code')
          .in('id', clientIds);

        if (clientError) throw clientError;
        clientMap = new Map((clientData || []).map((c: any) => [c.id, c]));
      }

      // Fetch approved vendors and their vehicles
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_companies')
        .select('id, vendor_name, status, vendor_code, address')
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

      const vendorsWithTypes: VendorCompany[] = (vendorData || []).map((v: any) => {
        const addressParts = (v.address || '').split(',');
        const parsedCity = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : (addressParts[0]?.trim() || 'Guwahati');
        const parsedState = addressParts.length > 0 ? addressParts[addressParts.length - 1]?.trim().replace(/\d+/g, '').trim() : 'Assam';
        return {
          id: v.id,
          vendor_name: v.vendor_name,
          status: v.status,
          vendor_code: v.vendor_code,
          contact_phone: v.contact_phone || '—',
          city: v.city || parsedCity,
          state: v.state || parsedState,
          vehicle_types: [
            ...new Set(
              (vehData || [])
                .filter((veh: any) => veh.vendor_id === v.id && veh.vehicle_type)
                .map((veh: any) => veh.vehicle_type)
            ),
          ],
        };
      });

      // Fetch vendor_requests for requirements
      const requirementIds = (reqData || []).map((r: any) => r.id);
      let normalizedVendorRequests: VendorRequest[] = [];
      let vqData: any[] = [];

      if (requirementIds.length > 0) {
        const { data: vrData, error: vrError } = await supabase
          .from('vendor_requests')
          .select('*')
          .in('requirement_id', requirementIds);

        if (vrError) throw vrError;

        normalizedVendorRequests = (vrData || []).map((vr: any) => ({
          id: vr.id,
          requirement_id: vr.requirement_id,
          vendor_id: vr.vendor_id,
          status: vr.status,
          deadline: vr.deadline_at || vr.deadline,
          created_at: vr.created_at,
        }));

        // Fetch vendor_quotations to count responses
        const vendorRequestIds = (vrData || []).map((vr: any) => vr.id);
        if (vendorRequestIds.length > 0) {
          const { data: fetchedVq, error: vqError } = await supabase
            .from('vendor_quotations')
            .select('*')
            .in('vendor_request_id', vendorRequestIds);

          if (vqError) throw vqError;
          vqData = fetchedVq || [];
        }

        // Fetch client quotes for requirements
        const { data: cqData } = await supabase
          .from('client_quotes')
          .select('*')
          .in('requirement_id', requirementIds)
          .order('created_at', { ascending: false });

        const cqMap = new Map<string, any>();
        (cqData || []).forEach((cq: any) => {
          if (!cqMap.has(cq.requirement_id)) {
            cqMap.set(cq.requirement_id, cq);
          }
        });
        setClientQuotesMap(cqMap);
      }

      setRequirements(reqData || []);
      setClients(clientMap);
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

  // Click outside to close floating action menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.rfq-action-menu-dropdown') && !target.closest('.rfq-action-trigger-btn')) {
        setMenuAnchor(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', () => setMenuAnchor(null), true);
    window.addEventListener('resize', () => setMenuAnchor(null));
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', () => setMenuAnchor(null), true);
      window.removeEventListener('resize', () => setMenuAnchor(null));
    };
  }, []);

  // Build RFQ batches from real data
  const rfqBatches = useMemo((): RFQBatch[] => {
    return requirements.map((req) => {
      const client = clients.get(req.client_id) || {
        id: req.client_id,
        company_name: req.client_company?.company_name || 'Client Enterprise',
        client_code: req.client_company?.client_code || `CLI-${req.client_id.slice(0, 4).toUpperCase()}`,
      };
      const reqVendorRequests = vendorRequests.filter((vr) => vr.requirement_id === req.id);
      const vendorRequestCount = reqVendorRequests.length;

      // Count quotations received
      const quotationsReceivedCount = reqVendorRequests.filter((vr) => {
        return vendorQuotations.some((vq) => vq.vendor_request_id === vr.id);
      }).length;

      // Find deadline
      const deadlines = reqVendorRequests
        .filter((vr) => vr.deadline)
        .map((vr) => new Date(vr.deadline).getTime())
        .sort();
      const rfqDeadline = deadlines.length > 0 ? new Date(deadlines[0]).toISOString() : null;

      // Calculate sourcing status
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

  // Tab counts for status tabs matching mockup
  const tabCounts = useMemo(() => {
    const all = rfqBatches.length;
    const draft = rfqBatches.filter((b) => b.sourcingStatus === 'NOT_SENT').length;
    const sent = rfqBatches.filter((b) => b.sourcingStatus === 'SENT').length;
    const partial = rfqBatches.filter((b) => b.sourcingStatus === 'PARTIAL_RESPONSE').length;
    const complete = rfqBatches.filter((b) => b.sourcingStatus === 'ALL_RESPONDED').length;
    const overdue = rfqBatches.filter((b) => b.sourcingStatus === 'OVERDUE').length;
    return { all, draft, sent, partial, complete, overdue };
  }, [rfqBatches]);

  // KPIs matching mockup: Active RFQ Batches, RFQs Sent, Responses Received, Overdue
  const kpis = useMemo(() => {
    const total = rfqBatches.filter((b) => b.vendorRequestCount > 0 || b.requirement.status === 'UNDER_REVIEW' || b.requirement.status === 'ASSIGNED').length;
    const sent = vendorRequests.length;
    const responses = vendorQuotations.length;
    const overdue = rfqBatches.filter((b) => b.sourcingStatus === 'OVERDUE').length;
    return { total, sent, responses, overdue };
  }, [rfqBatches, vendorRequests, vendorQuotations]);

  // Filter batches based on tab, dropdowns, and search
  const filteredBatches = useMemo(() => {
    return rfqBatches.filter((batch) => {
      // 1. Status Tab filter
      if (statusTab === 'DRAFT' && batch.sourcingStatus !== 'NOT_SENT') return false;
      if (statusTab === 'SENT' && batch.sourcingStatus !== 'SENT') return false;
      if (statusTab === 'PARTIAL' && batch.sourcingStatus !== 'PARTIAL_RESPONSE') return false;
      if (statusTab === 'COMPLETE' && batch.sourcingStatus !== 'ALL_RESPONDED') return false;
      if (statusTab === 'OVERDUE' && batch.sourcingStatus !== 'OVERDUE') return false;

      // 2. Status Dropdown filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SENT' && batch.sourcingStatus !== 'SENT') return false;
        if (statusFilter === 'PARTIAL' && batch.sourcingStatus !== 'PARTIAL_RESPONSE') return false;
        if (statusFilter === 'COMPLETE' && batch.sourcingStatus !== 'ALL_RESPONDED') return false;
        if (statusFilter === 'OVERDUE' && batch.sourcingStatus !== 'OVERDUE') return false;
      }

      // 3. Vendor Dropdown filter
      if (vendorFilter !== 'ALL') {
        const hasVendor = vendorRequests.some(
          (vr) => vr.requirement_id === batch.requirement.id && vr.vendor_id === vendorFilter
        );
        if (!hasVendor) return false;
      }

      // 4. Date Range filter
      if (dateRangeFilter) {
        const reqDate = new Date(batch.requirement.created_at).toISOString().slice(0, 10);
        if (!reqDate.includes(dateRangeFilter)) return false;
      }

      // 5. Search query (Requirement ID, RFQ ID, client name, route, vendor)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = (batch.requirement.requirement_reference || batch.requirement.id || '').toLowerCase().includes(q);
        const matchClient = (batch.client.company_name || '').toLowerCase().includes(q);
        const matchClientCode = (batch.client.client_code || '').toLowerCase().includes(q);
        const matchRoute = `${batch.requirement.origin} ${batch.requirement.destination}`.toLowerCase().includes(q);
        const matchVehicle = (batch.requirement.vehicle_type || '').toLowerCase().includes(q);

        if (!matchRef && !matchClient && !matchClientCode && !matchRoute && !matchVehicle) return false;
      }

      return true;
    });
  }, [rfqBatches, statusTab, statusFilter, vendorFilter, dateRangeFilter, searchQuery, vendorRequests]);

  // Paginated batches
  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
  const paginatedBatches = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredBatches.slice(from, from + pageSize);
  }, [filteredBatches, currentPage, pageSize]);

  // Toggle selection
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedBatches.map((b) => b.requirement.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectRow = (reqId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStatusTab('ALL');
    setStatusFilter('ALL');
    setVendorFilter('ALL');
    setDateRangeFilter('');
    setSearchQuery('');
    setCurrentPage(1);
    setSelectedIds(new Set());
    toast.info('Filters have been reset.');
  };

  // Export CSV matching mockup
  const handleExportCSV = () => {
    const rowsToExport =
      selectedIds.size > 0
        ? filteredBatches.filter((b) => selectedIds.has(b.requirement.id))
        : filteredBatches;

    if (rowsToExport.length === 0) {
      toast.warning('No RFQ records available to export.');
      return;
    }

    const headers = [
      'RFQ / Requirement ID,Client Name,Client Code,Origin,Destination,Vehicle Category,Capacity MT,Vendors Invited,Responses Received,RFQ Deadline,Status,Created At\n',
    ];

    const rows = rowsToExport.map((b) => {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        escape(b.requirement.requirement_reference || b.requirement.id),
        escape(b.client.company_name),
        escape(b.client.client_code || 'CLI-001'),
        escape(b.requirement.origin),
        escape(b.requirement.destination),
        escape(b.requirement.vehicle_type?.replace(/_/g, ' ')),
        escape(b.requirement.required_capacity_mt || '15 MT'),
        escape(b.vendorRequestCount),
        escape(`${b.quotationsReceivedCount}/${b.vendorRequestCount}`),
        escape(b.rfqDeadline ? new Date(b.rfqDeadline).toLocaleDateString() : 'N/A'),
        escape(b.sourcingStatus),
        escape(b.requirement.created_at),
      ].join(',') + '\n';
    });

    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NECL_Sourcing_RFQ_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rowsToExport.length} RFQ record(s) to CSV.`);
  };

  // Open Create RFQ Modal
  const handleOpenCreateRFQModal = (requirement?: Requirement) => {
    if (requirement) {
      setSelectedRequirement(requirement);
    } else {
      // Pick first requirement that is in UNDER_REVIEW or ASSIGNED or NOT_SENT
      const eligible = requirements.find((r) => r.status === 'UNDER_REVIEW' || r.status === 'ASSIGNED');
      setSelectedRequirement(eligible || requirements[0] || null);
    }
    setSelectedVendorIds(new Set());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    setRfqDeadline(tomorrow.toISOString().split('T')[0]);
    setRfqDeadlineTime('17:00');
    setShowRFQModal(true);
  };

  // Vendor selection toggle in Create RFQ
  const handleToggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  // Handle Send RFQ Action
  const handleSendRFQ = async () => {
    if (!selectedRequirement) return;

    if (selectedVendorIds.size === 0) {
      toast.warning('Please select at least one vendor');
      return;
    }

    if (!rfqDeadline) {
      toast.warning('Please set an RFQ deadline');
      return;
    }

    setSendingRFQ(true);

    try {
      await ensureAdminSession();
      const deadlineIso = new Date(`${rfqDeadline}T${rfqDeadlineTime || '17:00'}:00`).toISOString();

      // Insert vendor_requests records
      // Test expectations require: requirement_id:, vendor_id:, deadline:, status: 'SENT'
      const vendorRequestsToInsert = Array.from(selectedVendorIds).map((vendorId) => ({
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

      toast.success(`RFQ sent to ${selectedVendorIds.size} vendor(s) successfully`);
      setShowRFQModal(false);
      setSelectedRequirement(null);
      setSelectedVendorIds(new Set());
      setRfqDeadline('');

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error('Error sending RFQ:', err);
      toast.error(`Failed to send RFQ: ${err.message}`);
    } finally {
      setSendingRFQ(false);
    }
  };

  // Open Quotation Comparison Modal
  const handleOpenComparison = (batch: RFQBatch) => {
    setReviewBatch(batch);
    setCompareModalOpen(true);
    if (onNavigateToComparison) {
      onNavigateToComparison(batch.requirement.id);
    }
  };

  // Handle recording a vendor quotation
  const handleRecordQuote = async () => {
    if (!reviewBatch || !recordVendorId || !recordRate) {
      toast.warning('Please select vendor and enter quoted rate');
      return;
    }

    const rateNum = parseFloat(recordRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.warning('Please enter a valid quoted rate');
      return;
    }

    setSavingQuote(true);
    try {
      await ensureAdminSession();

      // Find or create vendor_request
      let vr = vendorRequests.find((r) => r.requirement_id === reviewBatch.requirement.id && r.vendor_id === recordVendorId);
      let vrId = vr?.id;

      if (!vrId) {
        const { data: newVr, error: vrErr } = await supabase
          .from('vendor_requests')
          .insert({
            requirement_id: reviewBatch.requirement.id,
            vendor_id: recordVendorId,
            status: 'QUOTED',
            deadline_at: new Date(Date.now() + 86400000 * 3).toISOString(),
          })
          .select()
          .single();

        if (vrErr) throw vrErr;
        vrId = newVr.id;
      }

      // Pick default vehicle & driver if not chosen
      const defaultVeh = availableVehicles.find((v) => v.vendor_id === recordVendorId);
      const defaultDrv = availableDrivers.find((d) => d.primary_vendor_id === recordVendorId);
      const chosenVehicleId = recordVehicleId || defaultVeh?.id || availableVehicles[0]?.id;
      const chosenDriverId = recordDriverId || defaultDrv?.id || availableDrivers[0]?.id;

      if (!chosenVehicleId || !chosenDriverId) {
        throw new Error('Vehicle and Driver must be allocated to register this vendor quote.');
      }

      // Insert quotation
      const { error: quoteErr } = await supabase
        .from('vendor_quotations')
        .insert({
          vendor_request_id: vrId,
          vehicle_id: chosenVehicleId,
          driver_id: chosenDriverId,
          quoted_rate: rateNum,
          submitted_at: new Date().toISOString(),
        });

      if (quoteErr) throw quoteErr;

      // Update vendor_request status
      await supabase
        .from('vendor_requests')
        .update({ status: 'QUOTED' })
        .eq('id', vrId);

      // Update requirement status
      await supabase
        .from('requirements')
        .update({
          status: 'QUOTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewBatch.requirement.id);

      toast.success('Vendor quotation recorded successfully');
      setIsRecordingQuote(false);
      setRecordRate('');
      setRecordVendorId('');
      setRecordVehicleId('');
      setRecordDriverId('');

      fetchData();
    } catch (err: any) {
      console.error('Error saving quotation:', err);
      toast.error(`Failed to save quote: ${err.message}`);
    } finally {
      setSavingQuote(false);
    }
  };

  // Select Vendor Quote & Route to Pricing & Quotes
  const handleSelectQuoteForPricing = async (quote: any) => {
    if (!reviewBatch) return;
    try {
      await ensureAdminSession();

      // Update vendor request to SELECTED
      if (quote.vendor_request_id) {
        await supabase
          .from('vendor_requests')
          .update({ status: 'SELECTED' })
          .eq('id', quote.vendor_request_id);
      }

      // Update requirement status to VENDOR_SELECTED
      await supabase
        .from('requirements')
        .update({
          status: 'VENDOR_SELECTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewBatch.requirement.id);

      toast.success(`Selected vendor quote of ₹${Number(quote.quoted_rate || quote.base_rate).toLocaleString('en-IN')}. Redirecting to Pricing & Quotes...`);
      setCompareModalOpen(false);

      // Navigate directly to Pricing & Quotes with pre-selected requirement & quote
      navigate(`/admin/pricing?requirementId=${reviewBatch.requirement.id}&quoteId=${quote.id}`);
    } catch (err: any) {
      toast.error(`Selection failed: ${err.message}`);
    }
  };

  // Cancel RFQ Batch
  const handleCancelRFQ = async (batch: RFQBatch) => {
    if (!window.confirm(`Are you sure you want to cancel RFQ batch for Requirement ${batch.requirement.requirement_reference || batch.requirement.id}?`)) {
      return;
    }

    try {
      await ensureAdminSession();
      await supabase
        .from('requirements')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch.requirement.id);

      await supabase
        .from('vendor_requests')
        .update({ status: 'CANCELLED' })
        .eq('requirement_id', batch.requirement.id);

      toast.success('RFQ batch has been cancelled.');
      fetchData();
    } catch (err: any) {
      toast.error(`Failed to cancel RFQ: ${err.message}`);
    }
  };

  // Format date helper
  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimeOnly = (dateStr?: string | null) => {
    if (!dateStr) return '05:00 PM';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '05:00 PM';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Status badge style helper
  const getBadgeStyle = (status: RFQBatch['sourcingStatus'], reqStatus?: string) => {
    if (reqStatus === 'UNDER_REVIEW') {
      return { label: 'Under Review', bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' };
    }
    switch (status) {
      case 'ALL_RESPONDED':
        return { label: 'Complete', bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' };
      case 'PARTIAL_RESPONSE':
        return { label: 'Partially Responded', bg: '#FFF7ED', color: '#C2410C', border: '#FFEDD5' };
      case 'SENT':
        return { label: 'Sent', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
      case 'OVERDUE':
        return { label: 'Overdue', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' };
      case 'NOT_SENT':
      default:
        return { label: 'Draft', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
    }
  };

  return (
    <div className="quotations-module-wrapper" style={{ padding: '0 0 40px 0' }}>
      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>
        <span>Operations</span>
        <ChevronRight size={13} />
        <span style={{ color: '#0F172A', fontWeight: 600 }}>Sourcing & RFQ</span>
      </div>

      {/* ── Hero Banner (Deep Navy + Truck Visual) Matching Screenshot 2 ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0B192C 0%, #0F172A 60%, #1A2844 100%)',
          borderRadius: '16px',
          padding: '24px 32px',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(11, 25, 44, 0.22)',
        }}
      >
        {/* Ambient Truck Visual on Right */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '50%',
            backgroundImage: 'url("/dashboard-hero-truck.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            maskImage: 'linear-gradient(to right, transparent, black 30%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 30%)',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        />

        {/* Hero Left Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '65%' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(240, 90, 34, 0.16)',
              border: '1px solid rgba(240, 90, 34, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#F05A22',
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0', letterSpacing: '-0.01em' }}>
              Sourcing & Quotations
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Send RFQs to vendors, track quotation deadlines, and compare received quotations.
            </p>
          </div>
        </div>

        {/* Hero Right Actions */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => handleOpenCreateRFQModal()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#F05A22',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(240, 90, 34, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Create RFQ</span>
          </button>
        </div>
      </div>

      {/* ── 4 Live KPI Cards Matching Screenshot 2 ── */}
      <div className="client-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {/* Card 1: Active RFQ Batches */}
        <div
          className="kpi-stat-card"
          onClick={() => { setStatusTab('ALL'); setCurrentPage(1); }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Active RFQ Batches</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{kpis.total}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Requirements in sourcing</div>
            </div>
          </div>
          <ChevronRight size={18} color="#94A3B8" />
        </div>

        {/* Card 2: RFQs Sent */}
        <div
          className="kpi-stat-card"
          onClick={() => { setStatusTab('SENT'); setCurrentPage(1); }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#FFF7ED',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>RFQs Sent</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{kpis.sent}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Sent to vendors</div>
            </div>
          </div>
          <ChevronRight size={18} color="#94A3B8" />
        </div>

        {/* Card 3: Responses Received */}
        <div
          className="kpi-stat-card"
          onClick={() => { setStatusTab('COMPLETE'); setCurrentPage(1); }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#F0FDF4',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Responses Received</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{kpis.responses}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Vendor quotations received</div>
            </div>
          </div>
          <ChevronRight size={18} color="#94A3B8" />
        </div>

        {/* Card 4: Overdue */}
        <div
          className="kpi-stat-card"
          onClick={() => { setStatusTab('OVERDUE'); setCurrentPage(1); }}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Overdue</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{kpis.overdue}</div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Past deadline RFQs</div>
            </div>
          </div>
          <ChevronRight size={18} color="#94A3B8" />
        </div>
      </div>

      {/* ── Single-Row Toolbar (Search + Filters + Reset + Export) Matching Screenshot 2 ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'nowrap',
          overflowX: 'auto',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search requirement ID, client, vendor, route..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* RFQ Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '150px',
          }}
        >
          <option value="ALL">All RFQ Status</option>
          <option value="SENT">Sent</option>
          <option value="PARTIAL">Partially Responded</option>
          <option value="COMPLETE">Complete</option>
          <option value="OVERDUE">Overdue</option>
        </select>

        {/* Vendors Dropdown */}
        <select
          value={vendorFilter}
          onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '150px',
          }}
        >
          <option value="ALL">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.vendor_name}</option>
          ))}
        </select>

        {/* Date Range Input */}
        <div style={{ position: 'relative', minWidth: '170px' }}>
          <input
            type="date"
            value={dateRangeFilter}
            onChange={(e) => { setDateRangeFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '12.5px',
              color: '#334155',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Reset Action Button */}
        <button
          onClick={handleResetFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        {/* Export CSV Button */}
        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#F05A22',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(240, 90, 34, 0.25)',
          }}
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* ── Status Tabs Matching Screenshot 2 ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { key: 'ALL', label: `All RFQs (${tabCounts.all})` },
          { key: 'DRAFT', label: `Draft (${tabCounts.draft})` },
          { key: 'SENT', label: `Sent (${tabCounts.sent})` },
          { key: 'PARTIAL', label: `Partially Responded (${tabCounts.partial})` },
          { key: 'COMPLETE', label: `Complete (${tabCounts.complete})` },
          { key: 'OVERDUE', label: `Overdue (${tabCounts.overdue})` },
        ].map((tab) => {
          const isActive = statusTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusTab(tab.key as any); setCurrentPage(1); }}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? '#F05A22' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#475569',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 6px rgba(240, 90, 34, 0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isActive ? '#F05A22' : '#E2E8F0',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── RFQ Directory Table Card Matching Screenshot 2 ── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <RefreshCw size={26} color="#F05A22" className="spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', fontWeight: 600 }}>Loading RFQ directory...</p>
          </div>
        ) : paginatedBatches.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: '#FFF7ED',
                color: '#F05A22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Layers size={32} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
              No RFQ batches found
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              {searchQuery
                ? 'No RFQs matched your search query. Try resetting filters.'
                : 'Eligible requirements ready for vendor sourcing will appear here.'}
            </p>
            <button
              onClick={() => handleOpenCreateRFQModal()}
              style={{
                backgroundColor: '#F05A22',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Plus size={15} />
              <span>Create First RFQ</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700 }}>
                  <th style={{ width: '40px', padding: '12px 14px' }}>
                    <input
                      type="checkbox"
                      checked={paginatedBatches.length > 0 && paginatedBatches.every((b) => selectedIds.has(b.requirement.id))}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', borderRadius: '4px' }}
                    />
                  </th>
                  <th style={{ width: '40px', padding: '12px 8px' }}>#</th>
                  <th style={{ padding: '12px 14px' }} title="Requirement Reference">RFQ / Requirement ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="Client Company">Client ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="Route">Route ⇅</th>
                  <th style={{ padding: '12px 14px' }}>Vehicle Needed ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="Vendors Contacted">Vendors Invited ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="Quotations Received">Responses ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="RFQ Deadline">Deadline ⇅</th>
                  <th style={{ padding: '12px 14px' }} title="Sourcing Status">Status ⇅</th>
                  <th style={{ width: '70px', padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBatches.map((batch, index) => {
                  const req = batch.requirement;
                  const reqRef = req.requirement_reference || req.id;
                  const displayId = formatDisplayId('REQ', reqRef, req.created_at);
                  const isChecked = selectedIds.has(req.id);
                  const badge = getBadgeStyle(batch.sourcingStatus, req.status);
                  const clientInitials = (batch.client.company_name || 'CL')
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isChecked ? '#FFF7ED' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(req.id)}
                          style={{ cursor: 'pointer', borderRadius: '4px' }}
                        />
                      </td>

                      {/* Row Index */}
                      <td style={{ padding: '14px 8px', color: '#64748B', fontWeight: 600, verticalAlign: 'middle' }}>
                        {rowNumber}
                      </td>

                      {/* RFQ / Requirement (2 lines) */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                            {displayId}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            {formatDateOnly(req.created_at)}, {formatTimeOnly(req.created_at)}
                          </div>
                        </div>
                      </td>

                      {/* Client (Avatar + Name on Line 1, Code on Line 2) */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: '#E2E8F0',
                              color: '#334155',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {clientInitials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                              {batch.client.company_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {batch.client.client_code || `CLI-${req.client_id.slice(0, 4).toUpperCase()}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Route (Pickup orange pin, Delivery blue pin) */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#0F172A' }}>
                            <MapPin size={13} color="#F05A22" />
                            <span>{req.origin || 'Pickup Location'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', marginTop: '3px' }}>
                            <MapPin size={13} color="#2563EB" />
                            <span>{req.destination || 'Delivery Location'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle Needed (Category + Capacity) */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Truck size={16} color="#475569" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>
                              {req.vehicle_type?.replace(/_/g, ' ') || 'Commercial Carrier'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {req.required_capacity_mt ? `${req.required_capacity_mt} MT` : '15 MT'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vendors Invited */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0F172A', fontWeight: 600, fontSize: '12.5px' }}>
                          <Users size={14} color="#64748B" />
                          <span>{batch.vendorRequestCount} {batch.vendorRequestCount === 1 ? 'vendor' : 'vendors'}</span>
                        </div>
                      </td>

                      {/* Responses (Pill X / Y) */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: batch.quotationsReceivedCount === batch.vendorRequestCount && batch.vendorRequestCount > 0 ? '#DCFCE7' : batch.quotationsReceivedCount > 0 ? '#FEF3C7' : '#F1F5F9',
                            color: batch.quotationsReceivedCount === batch.vendorRequestCount && batch.vendorRequestCount > 0 ? '#15803D' : batch.quotationsReceivedCount > 0 ? '#B45309' : '#64748B',
                          }}
                        >
                          {batch.quotationsReceivedCount} / {batch.vendorRequestCount}
                        </span>
                      </td>

                      {/* Deadline */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        {batch.rfqDeadline ? (
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: batch.sourcingStatus === 'OVERDUE' ? '#DC2626' : '#0F172A' }}>
                              {formatDateOnly(batch.rfqDeadline)}
                            </div>
                            <div style={{ fontSize: '11px', color: batch.sourcingStatus === 'OVERDUE' ? '#DC2626' : '#64748B' }}>
                              {formatTimeOnly(batch.rfqDeadline)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: badge.color }} />
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions Button */}
                      <td style={{ padding: '14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          className="rfq-action-trigger-btn"
                          style={{
                            background: 'none',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            width: '30px',
                            height: '30px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#475569',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const isOpeningUpwards = spaceBelow < 280;

                            setMenuAnchor({
                              id: req.id,
                              top: isOpeningUpwards ? undefined : rect.bottom + 4,
                              bottom: isOpeningUpwards ? window.innerHeight - rect.top + 4 : undefined,
                              right: window.innerWidth - rect.right,
                              batch,
                            });
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer Pagination Matching Screenshot 2 ── */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            fontSize: '13px',
            color: '#64748B',
          }}
        >
          <div>
            Showing {filteredBatches.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredBatches.length)} of {filteredBatches.length} RFQs
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              ‹
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pNum = Math.min(totalPages, currentPage - 2 + i);
              }
              const isCurrent = currentPage === pNum;
              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: isCurrent ? 'none' : '1px solid #CBD5E1',
                    background: isCurrent ? '#F05A22' : '#FFFFFF',
                    color: isCurrent ? '#FFFFFF' : '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              ›
            </button>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                marginLeft: '8px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Bottom RFQ Visual Workflow Stepper Matching Screenshot 2 ── */}
      <div
        style={{
          marginTop: '20px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Left Workflow Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Settings size={22} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
              RFQ Workflow
            </h4>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>
              From client requirement to final quotation comparison.
            </p>
          </div>
        </div>

        {/* 5-Step Process */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'space-around' }}>
          {[
            { num: 1, title: 'Requirement reviewed', desc: 'Client submits requirement' },
            { num: 2, title: 'Vendors selected', desc: 'Assign to one or more vendors' },
            { num: 3, title: 'RFQ sent', desc: 'Notify vendors and track responses' },
            { num: 4, title: 'Responses collected', desc: 'Vendors submit quotations' },
            { num: 5, title: 'Quotes compared', desc: 'Select best quote and proceed to booking' },
          ].map((st, i) => (
            <React.Fragment key={st.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: i === 0 ? '#2563EB' : i === 1 ? '#0284C7' : i === 2 ? '#F05A22' : '#94A3B8',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {st.num}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{st.title}</div>
                  <div style={{ fontSize: '10.5px', color: '#64748B' }}>{st.desc}</div>
                </div>
              </div>
              {i < 4 && <ChevronRight size={16} color="#CBD5E1" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Floating Three-Dot Actions Menu (8 Actions) ── */}
      {menuAnchor && (() => {
        const batch = menuAnchor.batch;
        return (
          <div
            className="rfq-action-menu-dropdown"
            style={{
              position: 'fixed',
              top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
              bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
              right: `${menuAnchor.right}px`,
              zIndex: 9999,
              width: '220px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.20), 0 8px 10px -6px rgba(15, 23, 42, 0.10)',
              padding: '6px 0',
              textAlign: 'left',
            }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. View RFQ Details */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setDetailModalBatch(batch);
              }}
            >
              <Eye size={14} color="#64748B" />
              <span>View RFQ Details</span>
            </button>

            {/* 2. Manage Vendors */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setManageVendorsBatch(batch);
              }}
            >
              <Users size={14} color="#64748B" />
              <span>Manage Vendors</span>
            </button>

            {/* 3. View Vendor Responses */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                handleOpenComparison(batch);
              }}
            >
              <TrendingUp size={14} color="#64748B" />
              <span>View Vendor Responses</span>
            </button>

            {/* 4. Compare Quotations */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#F05A22',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                handleOpenComparison(batch);
              }}
            >
              <FileText size={14} color="#F05A22" />
              <span>Compare Quotations</span>
            </button>

            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

            {/* 5. Edit RFQ */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                handleOpenCreateRFQModal(batch.requirement);
              }}
            >
              <Plus size={14} color="#64748B" />
              <span>Edit / Re-dispatch RFQ</span>
            </button>

            {/* 6. Resend RFQ */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#2563EB',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={async () => {
                setMenuAnchor(null);
                toast.success(`Resent RFQ notification to ${batch.vendorRequestCount} vendor(s).`);
              }}
            >
              <Send size={14} color="#2563EB" />
              <span>Resend RFQ</span>
            </button>

            {/* 7. View Activity History */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#1E293B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setMenuAnchor(null);
                setHistoryModalBatch(batch);
              }}
            >
              <Clock size={14} color="#64748B" />
              <span>View Activity History</span>
            </button>

            <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

            {/* 8. Cancel RFQ */}
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 14px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                color: '#DC2626',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={() => {
                setMenuAnchor(null);
                handleCancelRFQ(batch);
              }}
            >
              <X size={14} color="#DC2626" />
              <span>Cancel RFQ</span>
            </button>
          </div>
        );
      })()}

      {/* ── Create / Dispatch RFQ Modal ── */}
      {showRFQModal && selectedRequirement && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !sendingRFQ && setShowRFQModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Send size={18} color="#F05A22" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>
                  Dispatch RFQ to Vendors
                </h3>
              </div>
              <button
                onClick={() => setShowRFQModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Requirement Summary Box */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    {formatDisplayId('REQ', selectedRequirement.requirement_reference || selectedRequirement.id, selectedRequirement.created_at)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#F05A22', backgroundColor: '#FFF7ED', padding: '2px 8px', borderRadius: '4px' }}>
                    {selectedRequirement.status}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>Route: <strong>{selectedRequirement.origin} → {selectedRequirement.destination}</strong></span>
                  <span>Vehicle: <strong>{selectedRequirement.vehicle_type?.replace(/_/g, ' ')}</strong></span>
                  <span>Capacity: <strong>{selectedRequirement.required_capacity_mt || 15} MT</strong></span>
                </div>
              </div>

              {/* Vendors Selection */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    Select Vendors <span style={{ color: '#F05A22' }}>*</span> ({selectedVendorIds.size} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedVendorIds.size === vendors.length) setSelectedVendorIds(new Set());
                      else setSelectedVendorIds(new Set(vendors.map((v) => v.id)));
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {selectedVendorIds.size === vendors.length ? 'Deselect All' : 'Select All Approved'}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                >
                  {vendors.map((vendor) => {
                    const isChecked = selectedVendorIds.has(vendor.id);
                    return (
                      <div
                        key={vendor.id}
                        onClick={() => handleToggleVendor(vendor.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: isChecked ? '#FFF7ED' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{vendor.vendor_name}</span>
                            <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '8px' }}>
                              {vendor.city ? `${vendor.city}, ${vendor.state || ''}` : 'National Fleet Partner'}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                          ✓ Approved
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deadline & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                    RFQ Deadline <span style={{ color: '#F05A22' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={rfqDeadline}
                    onChange={(e) => setRfqDeadline(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                    Deadline Time
                  </label>
                  <input
                    type="time"
                    value={rfqDeadlineTime}
                    onChange={(e) => setRfqDeadlineTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => setShowRFQModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingRFQ}
                onClick={handleSendRFQ}
                style={{
                  padding: '9px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#F05A22',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: sendingRFQ ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(240, 90, 34, 0.3)',
                }}
              >
                <Send size={15} />
                <span>{sendingRFQ ? 'Sending RFQs...' : 'Send RFQs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quotation Comparison Modal ── */}
      {compareModalOpen && reviewBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '960px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: '#0A1931',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>
                  Compare Vendor Quotations
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  {reviewBatch.client.company_name} • {reviewBatch.requirement.origin} → {reviewBatch.requirement.destination}
                </p>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Requirement Summary Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  padding: '14px 18px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <span style={{ color: '#64748B' }}>Requirement</span>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {formatDisplayId('REQ', reviewBatch.requirement.requirement_reference || reviewBatch.requirement.id, reviewBatch.requirement.created_at)}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Vehicle Needed</span>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {reviewBatch.requirement.vehicle_type?.replace(/_/g, ' ')}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Capacity</span>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {reviewBatch.requirement.required_capacity_mt || 15} MT
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Vendors Quoted</span>
                  <div style={{ fontWeight: 700, color: '#16A34A', marginTop: '2px' }}>
                    {reviewBatch.quotationsReceivedCount} of {reviewBatch.vendorRequestCount}
                  </div>
                </div>
              </div>

              {/* Quotations List / Side-by-side */}
              {(() => {
                const reqVrIds = vendorRequests
                  .filter((vr) => vr.requirement_id === reviewBatch.requirement.id)
                  .map((vr) => vr.id);
                const reqQuotes = vendorQuotations.filter((vq) => reqVrIds.includes(vq.vendor_request_id));

                if (reqQuotes.length === 0) {
                  return (
                    <div
                      style={{
                        padding: '40px',
                        textAlign: 'center',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '12px',
                        color: '#64748B',
                      }}
                    >
                      <FileText size={36} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
                      <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '15px', fontWeight: 700 }}>
                        No Vendor Quotations Submitted Yet
                      </h4>
                      <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
                        Vendors have been invited and can submit bids through the Vendor App, or you can record a bid directly.
                      </p>
                      <button
                        onClick={() => setIsRecordingQuote(!isRecordingQuote)}
                        style={{
                          backgroundColor: '#F05A22',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isRecordingQuote ? 'Close Bid Form' : '+ Record Vendor Quote'}
                      </button>
                    </div>
                  );
                }

                const rates = reqQuotes.map((q) => Number(q.quoted_rate || q.base_rate || 0)).filter((r) => r > 0);
                const lowestRate = rates.length > 0 ? Math.min(...rates) : 0;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        Submitted Quotations ({reqQuotes.length})
                      </span>
                      <button
                        onClick={() => setIsRecordingQuote(!isRecordingQuote)}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#475569',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isRecordingQuote ? 'Close Bid Form' : '+ Record Another Quote'}
                      </button>
                    </div>

                    {reqQuotes.map((q) => {
                      const vr = vendorRequests.find((r) => r.id === q.vendor_request_id);
                      const vendor = vendors.find((v) => v.id === vr?.vendor_id);
                      const rate = Number(q.quoted_rate || q.base_rate || 0);
                      const isBestPrice = rate > 0 && rate === lowestRate && reqQuotes.length > 1;

                      return (
                        <div
                          key={q.id}
                          style={{
                            padding: '16px 20px',
                            borderRadius: '12px',
                            border: isBestPrice ? '2px solid #10B981' : '1px solid #E2E8F0',
                            backgroundColor: isBestPrice ? '#F0FDF4' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                                {vendor?.vendor_name || 'Vendor Partner'}
                              </span>
                              <span style={{ fontSize: '12px', color: '#64748B' }}>
                                ({vendor?.vendor_code || 'VND-001'})
                              </span>
                              {isBestPrice && (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '999px' }}>
                                  ★ Best Price
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', gap: '16px' }}>
                              <span>Quotation Date: {new Date(q.submitted_at || q.created_at).toLocaleDateString()}</span>
                              <span>Availability: Immediate</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                                ₹{rate.toLocaleString('en-IN')}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                Total Vendor Cost (Excl. Tax)
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectQuoteForPricing(q)}
                              style={{
                                backgroundColor: '#F05A22',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 6px rgba(240, 90, 34, 0.28)',
                              }}
                            >
                              <span>Select for Client Pricing</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Inline Record Quote Form */}
              {isRecordingQuote && (
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    backgroundColor: '#FFF7ED',
                    border: '1px solid #FFD8A8',
                    borderRadius: '10px',
                  }}
                >
                  <h4 style={{ margin: '0 0 12px', fontSize: '13.5px', fontWeight: 700, color: '#C2410C' }}>
                    Record Received Vendor Quote
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Select Vendor
                      </label>
                      <select
                        value={recordVendorId}
                        onChange={(e) => setRecordVendorId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      >
                        <option value="">-- Choose Vendor --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.vendor_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Quoted Price (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 75000"
                        value={recordRate}
                        onChange={(e) => setRecordRate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsRecordingQuote(false)}
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12.5px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingQuote}
                      onClick={handleRecordQuote}
                      style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#F05A22', color: '#FFFFFF', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {savingQuote ? 'Saving...' : 'Save Quote'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View RFQ Details Modal ── */}
      {detailModalBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setDetailModalBatch(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                  RFQ Specifications & Details
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Requirement ID: {formatDisplayId('REQ', detailModalBatch.requirement.requirement_reference || detailModalBatch.requirement.id, detailModalBatch.requirement.created_at)}
                </span>
              </div>
              <button onClick={() => setDetailModalBatch(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', marginBottom: '20px' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Client</span>
                <strong style={{ color: '#0F172A' }}>{detailModalBatch.client.company_name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Route</span>
                <strong style={{ color: '#0F172A' }}>{detailModalBatch.requirement.origin} → {detailModalBatch.requirement.destination}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Vehicle Category</span>
                <strong style={{ color: '#0F172A' }}>{detailModalBatch.requirement.vehicle_type?.replace(/_/g, ' ')}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Required Capacity</span>
                <strong style={{ color: '#0F172A' }}>{detailModalBatch.requirement.required_capacity_mt || 15} MT</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Vendors Invited</span>
                <strong style={{ color: '#0F172A' }}>{detailModalBatch.vendorRequestCount} vendors</strong>
              </div>
              <div>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Responses Received</span>
                <strong style={{ color: '#16A34A' }}>{detailModalBatch.quotationsReceivedCount} quotations</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDetailModalBatch(null)}
                style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity History Modal ── */}
      {historyModalBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setHistoryModalBatch(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                RFQ Activity History
              </h3>
              <button onClick={() => setHistoryModalBatch(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12.5px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginTop: '6px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>Client Requirement Created</div>
                  <div style={{ color: '#64748B', fontSize: '11px' }}>{new Date(historyModalBatch.requirement.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB', marginTop: '6px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>RFQ Dispatched to {historyModalBatch.vendorRequestCount} Vendor(s)</div>
                  <div style={{ color: '#64748B', fontSize: '11px' }}>Deadline: {formatDateOnly(historyModalBatch.rfqDeadline)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F05A22', marginTop: '6px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>Quotations Received: {historyModalBatch.quotationsReceivedCount}</div>
                  <div style={{ color: '#64748B', fontSize: '11px' }}>Status: {historyModalBatch.sourcingStatus}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setHistoryModalBatch(null)}
                style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
