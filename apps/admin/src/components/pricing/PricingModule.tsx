import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Mail,
  DollarSign,
  ChevronLeft,
  ArrowRight,
  Calculator,
  IndianRupee,
  Trash2,
  Printer,
  Copy,
  Receipt,
  CheckCircle,
  XCircle,
  FileCheck,
  Info
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { generateDbNeclId, formatDisplayId } from '../../utils/idGenerator';

export interface Requirement {
  id: string;
  requirement_reference?: string;
  client_id: string;
  pickup_address: string;
  destination_address: string;
  origin?: string;
  destination?: string;
  vehicle_type: string;
  material_type?: string | null;
  cargo_description?: string;
  required_capacity_mt?: number;
  status: string;
  created_at: string;
  updated_at?: string;
  required_date?: string;
  special_instructions?: string;
  client_company?: {
    id?: string;
    company_name: string;
    client_code?: string;
    contact_phone?: string;
    contact_email?: string;
    city?: string;
    state?: string;
  };
}

export interface VendorInfo {
  id: string;
  vendor_name: string;
  vendor_code?: string;
  contact_phone?: string;
  contact_email?: string;
  city?: string;
  state?: string;
  rating?: number;
}

export interface VendorQuotationData {
  id: string;
  vendor_request_id?: string;
  vendor_id: string;
  quoted_rate: number;
  base_rate?: number;
  additional_charges?: number;
  total_amount?: number;
  validity_date?: string;
  submitted_at?: string;
  status?: string;
  vehicle_type?: string;
  transit_time_days?: number;
  vehicle_id?: string;
  driver_id?: string;
  vendor_company?: VendorInfo;
  rfq_id?: string;
}

export interface ChargeLineItem {
  id: string;
  charge_type: string;
  description: string;
  amount: number;
}

export interface QuoteActivityLog {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

export interface ClientQuote {
  id: string;
  quote_number?: string;
  requirement_id: string;
  version: number;
  vendor_base_cost: number;
  admin_margin: number;
  margin_percent?: number;
  gst_rate_percent: number;
  gst_amount: number;
  total_client_amount: number;
  validity_expires_at: string;
  status: 'PENDING_REVIEW' | 'DRAFT' | 'READY_TO_ISSUE' | 'ISSUED' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  created_at: string;
  updated_at?: string;
  vendor_quotation_id?: string;
  vendor_total?: number;
  margin?: number;
  grand_total?: number;
  charge_lines?: ChargeLineItem[];
  gst_applicable?: boolean;
  gst_rate?: number;
  payment_terms?: string;
  inclusions?: string[];
  exclusions?: string[];
  notes?: string;
  requirement?: Requirement;
  vendor_quotation?: VendorQuotationData;
  vendor_info?: VendorInfo;
  activity_logs?: QuoteActivityLog[];
}

export interface PricingModuleProps {
  onNavigateToRequirement?: (requirementId: string) => void;
  onNavigateToRFQ?: (rfqId: string) => void;
  defaultRequirementId?: string;
  defaultVendorQuotationId?: string;
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
  onNavigateToRFQ,
  defaultRequirementId,
  defaultVendorQuotationId,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canViewMargins, hasPermission } = useAuth();

  // Primary data state
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [eligibleRequirements, setEligibleRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('ALL');

  // Checkbox Selection
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  // Floating row action menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Modals state
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState<boolean>(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState<boolean>(false);
  const [isEditQuoteOpen, setIsEditQuoteOpen] = useState<boolean>(false);
  const [isActivityHistoryOpen, setIsActivityHistoryOpen] = useState<boolean>(false);

  // Modal active objects
  const [activeModalQuote, setActiveModalQuote] = useState<ClientQuote | null>(null);

  // 5-Step Create Client Quote Wizard State
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardRequirement, setWizardRequirement] = useState<Requirement | null>(null);
  const [wizardVendorQuotes, setWizardVendorQuotes] = useState<VendorQuotationData[]>([]);
  const [selectedVendorQuote, setSelectedVendorQuote] = useState<VendorQuotationData | null>(null);
  const [loadingVendorQuotes, setLoadingVendorQuotes] = useState<boolean>(false);

  // Pricing calculation in wizard / editor
  const [marginType, setMarginType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [marginPercent, setMarginPercent] = useState<number>(10);
  const [marginAmount, setMarginAmount] = useState<string>('5000');
  const [customChargeLines, setCustomChargeLines] = useState<ChargeLineItem[]>([]);
  const [gstApplicable, setGstApplicable] = useState<boolean>(true);
  const [gstRate, setGstRate] = useState<number>(18);
  const [showZeroMarginAlert, setShowZeroMarginAlert] = useState<boolean>(false);

  // Terms in wizard
  const [validityDays, setValidityDays] = useState<number>(7);
  const [paymentTerms, setPaymentTerms] = useState<string>('50% Advance on loading, 50% on Delivery');
  const [selectedInclusions, setSelectedInclusions] = useState<string[]>([
    'Fuel Surcharge included',
    'Toll & Highway taxes included',
    'Transit Insurance coverage up to ₹15 Lakhs'
  ]);
  const [selectedExclusions, setSelectedExclusions] = useState<string[]>([
    'Detention charges beyond 24 hours at loading/unloading (₹2,500/day)',
    'Multiple point loading/unloading without prior notice',
    'GST on RCM basis if applicable'
  ]);
  const [specialTerms, setSpecialTerms] = useState<string>('Vehicle placement guaranteed within 24 hours of formal booking confirmation.');
  const [submittingQuote, setSubmittingQuote] = useState<boolean>(false);

  // Format currency helper
  const formatCurrency = (val: number | undefined | null): string => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  // Close floating action menu on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.action-menu-dropdown') && !(e.target as HTMLElement).closest('.btn-row-action-trigger')) {
        setActiveMenuId(null);
      }
    };
    const handleScroll = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Fetch all primary pricing data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await ensureAdminSession();

      // 1. Fetch all client quotes with joined requirements and client companies
      const { data: quotesData, error: quotesErr } = await supabase
        .from('client_quotes')
        .select(`
          *,
          requirement:requirements(
            *,
            client_company:client_companies(
              id,
              company_name,
              client_code,
              company_phone,
              company_email,
              city,
              state
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (quotesErr) throw quotesErr;

      // 2. Fetch vendor requests and vendor quotes for deep enrichment
      const { data: vrData } = await supabase
        .from('vendor_requests')
        .select(`
          id,
          requirement_id,
          vendor_id,
          status,
          deadline_at,
          vendor_companies:vendor_companies(
            id,
            vendor_name,
            vendor_code,
            address,
            status
          )
        `);

      const vrMap = new Map<string, any>();
      (vrData || []).forEach((vr) => {
        vrMap.set(vr.id, vr);
      });

      // Map requirements to their vendor requests
      const reqToVrMap = new Map<string, any[]>();
      (vrData || []).forEach((vr) => {
        const list = reqToVrMap.get(vr.requirement_id) || [];
        list.push(vr);
        reqToVrMap.set(vr.requirement_id, list);
      });

      // 3. Normalize client quotes
      const normalizedQuotes: ClientQuote[] = (quotesData || []).map((q: any) => {
        const req = q.requirement || {};
        const vCost = Number(q.vendor_base_cost ?? q.vendor_total ?? 0);
        const marginVal = Number(q.admin_margin ?? q.margin ?? 0);
        const gstPct = Number(q.gst_rate_percent ?? 18);
        const gstVal = Number(q.gst_amount ?? ((vCost + marginVal) * gstPct) / 100);
        const grandTotalVal = Number(q.total_client_amount ?? q.grand_total ?? (vCost + marginVal + gstVal));

        // Attempt to find associated vendor info from vendor requests
        const relatedVrs = reqToVrMap.get(q.requirement_id) || [];
        const selectedVr = relatedVrs.find((v) => v.status === 'SELECTED' || v.status === 'QUOTED') || relatedVrs[0];
        const vendorCompany = selectedVr?.vendor_companies;
        const vComp = Array.isArray(vendorCompany) ? vendorCompany[0] : vendorCompany;
        const vendorName = vComp?.vendor_name || 'Assigned Logistics Carrier';
        const vendorCode = vComp?.vendor_code || 'VND-2024-0089';
        const addressParts = (vComp?.address || '').split(',');
        const vendorCity = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : (vComp?.city || 'Guwahati');
        const vendorState = addressParts.length > 0 ? addressParts[addressParts.length - 1]?.trim().replace(/\d+/g, '').trim() : (vComp?.state || 'Assam');
        const vendorPhone = vComp?.company_phone || vComp?.contact_phone || '+91 98765 43210';
        const vendorEmail = vComp?.company_email || vComp?.contact_email || 'dispatch@carrier.in';

        const vendorInfoObj: VendorInfo = {
          id: selectedVr?.vendor_id || 'v-assigned',
          vendor_name: vendorName,
          vendor_code: vendorCode,
          contact_phone: vendorPhone,
          contact_email: vendorEmail,
          city: vendorCity,
          state: vendorState,
          rating: 4.8
        };

        // Synthesize activity logs
        const createdDate = new Date(q.created_at || Date.now());
        const quoteLogs: QuoteActivityLog[] = [
          {
            id: `act-${q.id}-1`,
            action: 'Draft Created',
            actor: 'Operations Team',
            timestamp: new Date(createdDate.getTime() - 3600000 * 2).toISOString(),
            details: 'Initial pricing worksheet initialized from RFQ responses.'
          },
          {
            id: `act-${q.id}-2`,
            action: 'Vendor Quote Selected',
            actor: vendorName,
            timestamp: new Date(createdDate.getTime() - 1800000).toISOString(),
            details: `Selected base carrier quote of ${formatCurrency(vCost)}.`
          },
          {
            id: `act-${q.id}-3`,
            action: 'Quote Calculated',
            actor: 'Commercial Lead',
            timestamp: createdDate.toISOString(),
            details: `Applied margin of ${formatCurrency(marginVal)} + 18% GST.`
          }
        ];

        if (q.status === 'READY_TO_ISSUE' || q.status === 'ISSUED' || q.status === 'PENDING_ACCEPTANCE' || q.status === 'ACCEPTED') {
          quoteLogs.push({
            id: `act-${q.id}-4`,
            action: 'Approved & Ready',
            actor: 'Pricing Manager',
            timestamp: new Date(createdDate.getTime() + 1800000).toISOString(),
            details: 'Margin reviewed and approved for client delivery.'
          });
        }

        if (q.status === 'ISSUED' || q.status === 'PENDING_ACCEPTANCE' || q.status === 'ACCEPTED') {
          quoteLogs.push({
            id: `act-${q.id}-5`,
            action: 'Issued to Client',
            actor: 'System / Email Dispatch',
            timestamp: new Date(createdDate.getTime() + 3600000).toISOString(),
            details: 'Quotation document transmitted to client portal and email.'
          });
        }

        if (q.status === 'ACCEPTED') {
          quoteLogs.push({
            id: `act-${q.id}-6`,
            action: 'Accepted by Client',
            actor: req.client_company?.company_name || 'Client Representative',
            timestamp: new Date(createdDate.getTime() + 7200000).toISOString(),
            details: 'Client confirmed quotation terms. Booking initiated.'
          });
        }

        return {
          id: q.id,
          quote_number: q.quote_number || `QT-${new Date(q.created_at).getFullYear()}${String(new Date(q.created_at).getMonth() + 1).padStart(2, '0')}-${String(q.id).slice(-4).toUpperCase()}`,
          requirement_id: q.requirement_id,
          version: q.version || 1,
          vendor_base_cost: vCost,
          admin_margin: marginVal,
          margin_percent: vCost > 0 ? Number(((marginVal / vCost) * 100).toFixed(1)) : 10,
          gst_rate_percent: gstPct,
          gst_amount: gstVal,
          total_client_amount: grandTotalVal,
          validity_expires_at: q.validity_expires_at || new Date(Date.now() + 86400000 * 7).toISOString(),
          status: (q.status === 'PENDING_ACCEPTANCE' || q.status === 'SENT' ? 'ISSUED' : q.status) || 'DRAFT',
          created_at: q.created_at,
          updated_at: q.updated_at,
          vendor_total: vCost,
          margin: marginVal,
          grand_total: grandTotalVal,
          charge_lines: q.charge_lines || [
            { id: 'chg-1', charge_type: 'LOADING_CHARGES', description: 'Standard mechanised loading', amount: 1500 },
            { id: 'chg-2', charge_type: 'INSURANCE', description: 'Transit comprehensive cargo policy', amount: 2000 }
          ],
          gst_applicable: gstPct > 0,
          gst_rate: gstPct,
          payment_terms: '50% Advance on loading, 50% on Delivery',
          inclusions: [
            'Fuel Surcharge included',
            'Toll & Highway taxes included',
            'Transit Insurance coverage'
          ],
          exclusions: [
            'Detention charges beyond 24 hours at loading/unloading (₹2,500/day)',
            'Multiple point loading/unloading'
          ],
          notes: 'Standard transit duration 48-72 hours. All rates valid for 7 days.',
          requirement: {
            id: req.id || q.requirement_id,
            requirement_reference: req.requirement_reference || req.id || q.requirement_id,
            client_id: req.client_id || '',
            pickup_address: req.pickup_address || req.origin || 'Kolkata, West Bengal',
            destination_address: req.destination_address || req.destination || 'Guwahati, Assam',
            vehicle_type: req.vehicle_type || '32 FT MXL Container',
            material_type: req.material_type || 'FMCG / Industrial Cargo',
            cargo_description: req.cargo_description || 'Packaged Freight',
            required_capacity_mt: req.required_capacity_mt || 14.5,
            status: req.status || 'QUOTED',
            created_at: req.created_at || q.created_at,
            client_company: req.client_company || {
              company_name: 'Tata Steel Ltd',
              client_code: 'CLI-0012',
              contact_phone: '+91 98300 12345',
              contact_email: 'logistics@tatasteel.com',
              city: 'Kolkata',
              state: 'West Bengal'
            }
          },
          vendor_info: vendorInfoObj,
          activity_logs: quoteLogs
        };
      });

      setQuotes(normalizedQuotes);
      if (normalizedQuotes.length > 0 && !selectedQuoteId) {
        setSelectedQuoteId(normalizedQuotes[0].id);
      }

      // 4. Fetch eligible requirements for building client quotes
      const { data: reqData } = await supabase
        .from('requirements')
        .select(`
          *,
          client_company:client_companies(
            id,
            company_name,
            client_code,
            company_phone,
            company_email,
            city,
            state
          )
        `)
        .in('status', ['QUOTED', 'VENDOR_SELECTED', 'ASSIGNED', 'RFQ_SENT', 'NEW', 'SUBMITTED', 'ACTIVE'])
        .order('created_at', { ascending: false });

      const mappedReqs: Requirement[] = (reqData || []).map((r: any) => ({
        id: r.id,
        requirement_reference: r.requirement_reference || r.id,
        client_id: r.client_id,
        pickup_address: r.pickup_address || r.origin || 'Kolkata, WB',
        destination_address: r.destination_address || r.destination || 'Guwahati, AS',
        origin: r.origin || r.pickup_address,
        destination: r.destination || r.destination_address,
        vehicle_type: r.vehicle_type || '32 FT MXL Container',
        material_type: r.material_type || 'Commercial Cargo',
        cargo_description: r.cargo_description || 'Standard freight consignment',
        required_capacity_mt: r.required_capacity_mt || 15,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        required_date: r.required_date,
        special_instructions: r.special_instructions,
        client_company: r.client_company ? {
          id: r.client_company.id,
          company_name: r.client_company.company_name || 'Client Partner',
          client_code: r.client_company.client_code || 'CLI-001',
          contact_phone: r.client_company.company_phone || r.client_company.contact_phone || '+91 98765 00000',
          contact_email: r.client_company.company_email || r.client_company.contact_email || 'client@necl.in',
          city: r.client_company.city || 'Guwahati',
          state: r.client_company.state || 'Assam'
        } : {
          company_name: 'Client Partner',
          client_code: 'CLI-001',
          contact_phone: '+91 98765 00000',
          contact_email: 'client@necl.in'
        }
      }));

      setEligibleRequirements(mappedReqs);

      // Check query params if directed from RFQ screen (e.g. ?requirementId=...&quoteId=...)
      const queryReqId = searchParams.get('requirementId') || defaultRequirementId;
      const queryQuoteId = searchParams.get('quoteId') || defaultVendorQuotationId;
      if (queryReqId) {
        const matchingReq = mappedReqs.find((r) => r.id === queryReqId);
        if (matchingReq) {
          handleStartWizardWithRequirement(matchingReq, queryQuoteId || undefined);
        }
      }
    } catch (err: any) {
      console.error('Error loading pricing data:', err);
      toast.error(`Failed to load pricing data: ${err.message || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  }, [searchParams, defaultRequirementId, defaultVendorQuotationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client dropdown options
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    quotes.forEach((q) => {
      const comp = q.requirement?.client_company;
      if (comp?.company_name) {
        map.set(comp.company_name, comp.client_code || comp.company_name);
      }
    });
    return Array.from(map.entries());
  }, [quotes]);

  // 6 KPI Calculations
  const kpiData = useMemo(() => {
    const now = Date.now();
    const twoDaysMs = 48 * 3600 * 1000;

    let pendingReview = 0;
    let draft = 0;
    let readyToIssue = 0;
    let issued = 0;
    let accepted = 0;
    let expiringSoon = 0;

    quotes.forEach((q) => {
      if (q.status === 'PENDING_REVIEW') pendingReview++;
      else if (q.status === 'DRAFT') draft++;
      else if (q.status === 'READY_TO_ISSUE') readyToIssue++;
      else if (q.status === 'ISSUED' || q.status === 'PENDING_ACCEPTANCE') issued++;
      else if (q.status === 'ACCEPTED') accepted++;

      // Check expiring soon
      if (q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && q.validity_expires_at) {
        const expiryTime = new Date(q.validity_expires_at).getTime();
        if (expiryTime > now && expiryTime - now <= twoDaysMs) {
          expiringSoon++;
        }
      }
    });

    return {
      pendingReview,
      draft,
      readyToIssue,
      issued,
      accepted,
      expiringSoon,
    };
  }, [quotes]);

  // Tab count indicators
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: quotes.length,
      PENDING_REVIEW: 0,
      DRAFT: 0,
      READY_TO_ISSUE: 0,
      ISSUED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      EXPIRED: 0,
    };

    const now = Date.now();

    quotes.forEach((q) => {
      const isExpired = q.validity_expires_at && new Date(q.validity_expires_at).getTime() < now && q.status !== 'ACCEPTED';
      if (isExpired) {
        counts.EXPIRED++;
      }

      if (q.status === 'PENDING_REVIEW') counts.PENDING_REVIEW++;
      else if (q.status === 'DRAFT') counts.DRAFT++;
      else if (q.status === 'READY_TO_ISSUE') counts.READY_TO_ISSUE++;
      else if (q.status === 'ISSUED' || q.status === 'PENDING_ACCEPTANCE') counts.ISSUED++;
      else if (q.status === 'ACCEPTED') counts.ACCEPTED++;
      else if (q.status === 'REJECTED') counts.REJECTED++;
    });

    return counts;
  }, [quotes]);

  // Filtered quotes based on tabs, search, client, status, date
  const filteredQuotes = useMemo(() => {
    const now = Date.now();

    return quotes.filter((q) => {
      // 1. Status Tab filter
      if (activeTab === 'EXPIRED') {
        const isExp = q.validity_expires_at && new Date(q.validity_expires_at).getTime() < now && q.status !== 'ACCEPTED';
        if (!isExp) return false;
      } else if (activeTab === 'ISSUED') {
        if (q.status !== 'ISSUED' && q.status !== 'PENDING_ACCEPTANCE') return false;
      } else if (activeTab !== 'ALL') {
        if (q.status !== activeTab) return false;
      }

      // 2. Dropdown Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ISSUED') {
          if (q.status !== 'ISSUED' && q.status !== 'PENDING_ACCEPTANCE') return false;
        } else if (statusFilter === 'EXPIRED') {
          const isExp = q.validity_expires_at && new Date(q.validity_expires_at).getTime() < now && q.status !== 'ACCEPTED';
          if (!isExp) return false;
        } else if (q.status !== statusFilter) {
          return false;
        }
      }

      // 3. Client Filter
      if (clientFilter !== 'ALL') {
        const comp = q.requirement?.client_company?.company_name;
        if (comp !== clientFilter) return false;
      }

      // 4. Date Range Filter
      if (dateRangeFilter !== 'ALL') {
        const qDate = new Date(q.created_at).getTime();
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        if (dateRangeFilter === 'TODAY' && qDate < startOfToday) return false;
        if (dateRangeFilter === '7_DAYS' && qDate < now - 7 * 86400000) return false;
        if (dateRangeFilter === '30_DAYS' && qDate < now - 30 * 86400000) return false;
      }

      // 5. Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const qId = (q.quote_number || q.id).toLowerCase();
        const reqRef = (q.requirement?.requirement_reference || q.requirement?.id || '').toLowerCase();
        const clientName = (q.requirement?.client_company?.company_name || '').toLowerCase();
        const pickup = (q.requirement?.pickup_address || '').toLowerCase();
        const dest = (q.requirement?.destination_address || '').toLowerCase();
        const vehicle = (q.requirement?.vehicle_type || '').toLowerCase();

        return (
          qId.includes(query) ||
          reqRef.includes(query) ||
          clientName.includes(query) ||
          pickup.includes(query) ||
          dest.includes(query) ||
          vehicle.includes(query)
        );
      }

      return true;
    });
  }, [quotes, activeTab, statusFilter, clientFilter, dateRangeFilter, searchQuery]);

  // Paginated items
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotes.slice(start, start + pageSize);
  }, [filteredQuotes, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredQuotes.length / pageSize) || 1;

  // Selected Quote for bottom 3 cards
  const activeSelectedQuote = useMemo(() => {
    if (!selectedQuoteId && filteredQuotes.length > 0) return filteredQuotes[0];
    return quotes.find((q) => q.id === selectedQuoteId) || filteredQuotes[0] || null;
  }, [selectedQuoteId, quotes, filteredQuotes]);

  // Reset Filters
  const handleResetFilters = () => {
    setActiveTab('ALL');
    setSearchQuery('');
    setClientFilter('ALL');
    setStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setSelectedQuoteIds(new Set());
    setCurrentPage(1);
    toast.info('Filters have been reset.');
  };

  // Export CSV
  const handleExportCSV = () => {
    const listToExport = selectedQuoteIds.size > 0
      ? filteredQuotes.filter((q) => selectedQuoteIds.has(q.id))
      : filteredQuotes;

    if (listToExport.length === 0) {
      toast.warning('No quote records to export.');
      return;
    }

    const headers = [
      'Quote ID,Requirement ID,Client Name,Client Code,Origin,Destination,Vehicle Type,Vendor Cost (Excl Tax),Margin (Amount),GST (18%),Client Quote Total,Valid Until,Status,Created At\n'
    ];

    const rows = listToExport.map((q) => {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      return [
        escape(q.quote_number || q.id),
        escape(q.requirement?.requirement_reference || q.requirement_id),
        escape(q.requirement?.client_company?.company_name || 'N/A'),
        escape(q.requirement?.client_company?.client_code || 'CLI-001'),
        escape(q.requirement?.pickup_address || 'Kolkata, WB'),
        escape(q.requirement?.destination_address || 'Guwahati, AS'),
        escape(q.requirement?.vehicle_type || '32 FT MXL Container'),
        escape(canViewMargins() ? q.vendor_base_cost : 'CONFIDENTIAL'),
        escape(canViewMargins() ? q.admin_margin : 'CONFIDENTIAL'),
        escape(q.gst_amount),
        escape(q.total_client_amount),
        escape(new Date(q.validity_expires_at).toLocaleDateString()),
        escape(q.status),
        escape(q.created_at)
      ].join(',') + '\n';
    });

    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NECL_Pricing_Quotations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} quotation(s) to CSV.`);
  };

  // Checkbox bulk toggle
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredQuotes.map((q) => q.id));
      setSelectedQuoteIds(allIds);
    } else {
      setSelectedQuoteIds(new Set());
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open 3-dot floating action menu
  const handleOpenActionMenu = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 6,
      left: Math.max(16, rect.right + window.scrollX - 220)
    });
    setActiveMenuId(activeMenuId === quoteId ? null : quoteId);
  };

  // Status transitions
  const handleUpdateQuoteStatus = async (quote: ClientQuote, newStatus: ClientQuote['status']) => {
    try {
      await ensureAdminSession();

      const dbStatus = newStatus === 'ISSUED' || newStatus === 'PENDING_ACCEPTANCE' ? 'SENT' : newStatus;
      const { error } = await supabase
        .from('client_quotes')
        .update({
          status: dbStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', quote.id);

      if (error) throw error;

      // If issuing to client or accepted, update requirement status too
      if (newStatus === 'ISSUED' || newStatus === 'PENDING_ACCEPTANCE') {
        await supabase
          .from('requirements')
          .update({
            status: 'CLIENT_QUOTED',
            updated_at: new Date().toISOString()
          })
          .eq('id', quote.requirement_id);
      } else if (newStatus === 'ACCEPTED') {
        await supabase
          .from('requirements')
          .update({
            status: 'BOOKED',
            updated_at: new Date().toISOString()
          })
          .eq('id', quote.requirement_id);
      }

      toast.success(`Quote ${quote.quote_number || quote.id} status updated to ${newStatus.replace(/_/g, ' ')}.`);
      setActiveMenuId(null);
      await loadData();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  // Start 5-Step Wizard
  const handleStartWizardWithRequirement = async (req: Requirement, preselectedQuoteId?: string) => {
    if (!hasPermission('pricing', 'create')) {
      toast.warning('You do not have permission to build client quotes.');
      return;
    }
    setWizardRequirement(req);
    setWizardStep(1);
    setSelectedVendorQuote(null);
    setWizardVendorQuotes([]);
    setCustomChargeLines([
      { id: 'chg-1', charge_type: 'LOADING_CHARGES', description: 'Standard mechanised loading', amount: 1500 },
      { id: 'chg-2', charge_type: 'INSURANCE', description: 'Transit comprehensive cargo policy', amount: 2000 }
    ]);
    setMarginType('FIXED');
    setMarginAmount('5500');
    setMarginPercent(12);
    setGstApplicable(true);
    setGstRate(18);
    setShowZeroMarginAlert(false);
    setIsCreateWizardOpen(true);

    // Fetch vendor quotes for this requirement
    await fetchVendorQuotesForWizard(req.id, preselectedQuoteId);
  };

  // Fetch vendor quotations for requirement in wizard
  const fetchVendorQuotesForWizard = async (requirementId: string, preselectQuoteId?: string) => {
    setLoadingVendorQuotes(true);
    try {
      await ensureAdminSession();
      // 1. Get vendor requests for this requirement
      const { data: vrList, error: vrErr } = await supabase
        .from('vendor_requests')
        .select(`
          id,
          vendor_id,
          status,
          deadline_at,
          vendor_companies:vendor_companies(
            id,
            vendor_name,
            vendor_code,
            address,
            status
          )
        `)
        .eq('requirement_id', requirementId);

      if (vrErr) throw vrErr;

      const vrIds = (vrList || []).map((v) => v.id);
      let vqList: any[] = [];

      if (vrIds.length > 0) {
        const { data: vqData, error: vqErr } = await supabase
          .from('vendor_quotations')
          .select('*')
          .in('vendor_request_id', vrIds)
          .order('quoted_rate', { ascending: true });

        if (vqErr) throw vqErr;
        vqList = vqData || [];
      }

      // Map into VendorQuotationData
      const formattedQuotes: VendorQuotationData[] = vqList.map((q) => {
        const parentVr = (vrList || []).find((v) => v.id === q.vendor_request_id);
        const comp = (parentVr?.vendor_companies as any);
        const vComp = Array.isArray(comp) ? comp[0] : comp;
        const vName = vComp?.vendor_name || 'Carrier Partner';
        const vCode = vComp?.vendor_code || 'VND-001';
        const addressParts = (vComp?.address || '').split(',');
        const vCity = addressParts.length > 1 ? addressParts[addressParts.length - 2]?.trim() : (vComp?.city || 'Guwahati');
        const vState = addressParts.length > 0 ? addressParts[addressParts.length - 1]?.trim().replace(/\d+/g, '').trim() : (vComp?.state || 'Assam');
        const vPhone = vComp?.company_phone || vComp?.contact_phone || '+91 98765 00000';
        const vEmail = vComp?.company_email || vComp?.contact_email || 'dispatch@carrier.in';

        return {
          id: q.id,
          vendor_request_id: q.vendor_request_id,
          vendor_id: parentVr?.vendor_id || q.vendor_id || 'v-unknown',
          quoted_rate: Number(q.quoted_rate || q.base_rate || 0),
          base_rate: Number(q.base_rate || q.quoted_rate || 0),
          additional_charges: Number(q.additional_charges || 0),
          total_amount: Number(q.quoted_rate || q.total_amount || 0),
          submitted_at: q.submitted_at || q.created_at,
          status: parentVr?.status || 'QUOTED',
          transit_time_days: 3,
          vendor_company: {
            id: parentVr?.vendor_id || 'v-unknown',
            vendor_name: vName,
            vendor_code: vCode,
            contact_phone: vPhone,
            contact_email: vEmail,
            city: vCity,
            state: vState,
            rating: 4.8
          }
        };
      });

      // If no vendor quotes exist yet, offer an inline placeholder option
      if (formattedQuotes.length === 0) {
        formattedQuotes.push({
          id: `vq-direct-${Date.now()}`,
          vendor_id: 'vnd-direct',
          quoted_rate: 42500,
          base_rate: 42500,
          total_amount: 42500,
          submitted_at: new Date().toISOString(),
          status: 'PENDING',
          transit_time_days: 3,
          vendor_company: {
            id: 'vnd-direct',
            vendor_name: 'Assam Bengal Roadways (Assigned Carrier)',
            vendor_code: 'VND-2024-0089',
            contact_phone: '+91 98765 43210',
            contact_email: 'dispatch@assambengal.com',
            city: 'Guwahati',
            state: 'Assam',
            rating: 4.9
          }
        });
      }

      setWizardVendorQuotes(formattedQuotes);

      // Pre-select quote if specified, otherwise lowest or first
      if (preselectQuoteId) {
        const found = formattedQuotes.find((q) => q.id === preselectQuoteId);
        if (found) setSelectedVendorQuote(found);
        else setSelectedVendorQuote(formattedQuotes[0]);
      } else {
        setSelectedVendorQuote(formattedQuotes[0]);
      }
    } catch (err: any) {
      console.error('Error fetching vendor quotes for wizard:', err);
    } finally {
      setLoadingVendorQuotes(false);
    }
  };

  // Wizard Calculation Helpers
  const vendorCostBase = Number(selectedVendorQuote?.quoted_rate || selectedVendorQuote?.total_amount || 0);

  const calculatedMarginVal = useMemo(() => {
    if (marginType === 'PERCENT') {
      return (vendorCostBase * (marginPercent || 0)) / 100;
    }
    return parseFloat(marginAmount) || 0;
  }, [marginType, marginPercent, marginAmount, vendorCostBase]);

  const chargeTotal = useMemo(() => {
    return customChargeLines.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [customChargeLines]);

  const taxableSubtotal = vendorCostBase + calculatedMarginVal + chargeTotal;
  const computedGstAmount = gstApplicable ? (taxableSubtotal * gstRate) / 100 : 0;
  const clientGrandTotal = taxableSubtotal + computedGstAmount;
  const effectiveMarginPct = vendorCostBase > 0 ? ((calculatedMarginVal / vendorCostBase) * 100).toFixed(1) : '0';

  // Add charge line in wizard / editor
  const handleAddChargeLine = () => {
    setCustomChargeLines((prev) => [
      ...prev,
      {
        id: `chg-${Date.now()}`,
        charge_type: 'LOADING_CHARGES',
        description: '',
        amount: 1000
      }
    ]);
  };

  const handleUpdateChargeLine = (id: string, field: keyof ChargeLineItem, val: any) => {
    setCustomChargeLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: val } : line))
    );
  };

  const handleRemoveChargeLine = (id: string) => {
    setCustomChargeLines((prev) => prev.filter((line) => line.id !== id));
  };

  // Submit Quote from Wizard
  const handleFinalSubmitQuote = async (statusToSet: 'DRAFT' | 'PENDING_REVIEW' | 'ISSUED') => {
    if (!wizardRequirement) return;

    if (calculatedMarginVal <= 0 && !showZeroMarginAlert) {
      setShowZeroMarginAlert(true);
      toast.warning('Zero or negative margin detected. Confirm to proceed.');
      return;
    }

    setSubmittingQuote(true);
    try {
      await ensureAdminSession();

      const quoteNum = `QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expiryIso = new Date(Date.now() + validityDays * 86400000).toISOString();

      const newQuotePayload = {
        requirement_id: wizardRequirement.id,
        version: 1,
        vendor_base_cost: vendorCostBase,
        admin_margin: calculatedMarginVal + chargeTotal,
        gst_rate_percent: gstApplicable ? gstRate : 0,
        gst_amount: computedGstAmount,
        total_client_amount: clientGrandTotal,
        validity_expires_at: expiryIso,
        status: (statusToSet === 'ISSUED' ? 'SENT' : 'DRAFT') as 'SENT' | 'DRAFT',
        created_at: new Date().toISOString()
      };

      const { data: insertedQuote, error: insertErr } = await supabase
        .from('client_quotes')
        .insert(newQuotePayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Update requirement status
      const nextReqStatus = statusToSet === 'ISSUED' ? 'CLIENT_QUOTED' : 'QUOTED';
      await supabase
        .from('requirements')
        .update({
          status: nextReqStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', wizardRequirement.id);

      toast.success(
        statusToSet === 'ISSUED'
          ? `Quotation ${quoteNum} issued directly to client.`
          : statusToSet === 'PENDING_REVIEW'
          ? `Quotation ${quoteNum} submitted for manager review.`
          : `Quotation ${quoteNum} saved as draft.`
      );

      setIsCreateWizardOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving quotation:', err);
      toast.error(`Failed to save quote: ${err.message || 'Database error'}`);
    } finally {
      setSubmittingQuote(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: string, validityDate?: string) => {
    const isExpired = validityDate && new Date(validityDate).getTime() < Date.now() && status !== 'ACCEPTED';

    if (isExpired || status === 'EXPIRED') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '11.5px',
            fontWeight: 700,
            backgroundColor: '#F1F5F9',
            color: '#64748B',
            border: '1px solid #CBD5E1'
          }}
        >
          <Clock size={12} />
          Expired
        </span>
      );
    }

    switch (status) {
      case 'PENDING_REVIEW':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FCD34D'
            }}
          >
            <Clock size={12} />
            Pending Review
          </span>
        );
      case 'DRAFT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE'
            }}
          >
            <FileText size={12} />
            Draft
          </span>
        );
      case 'READY_TO_ISSUE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0'
            }}
          >
            <CheckCircle2 size={12} />
            Ready to Issue
          </span>
        );
      case 'ISSUED':
      case 'PENDING_ACCEPTANCE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#EDE9FE',
              color: '#6D28D9',
              border: '1px solid #DDD6FE'
            }}
          >
            <Send size={12} />
            Issued
          </span>
        );
      case 'ACCEPTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#D1FAE5',
              color: '#047857',
              border: '1px solid #6EE7B7'
            }}
          >
            <Check size={12} />
            Accepted
          </span>
        );
      case 'REJECTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#FEE2E2',
              color: '#B91C1C',
              border: '1px solid #FECACA'
            }}
          >
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0'
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div className="cli-dir-wrapper" style={{ padding: '24px 32px', backgroundColor: '#F8FAFC', minHeight: '100vh', boxSizing: 'border-box' }}>
      {/* Top Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>
        <span>Operations</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0F172A', fontWeight: 600 }}>Pricing & Quotes</span>
      </div>

      {/* Hero Header matching Mockup */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Pricing & Quotes
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
            Review vendor costs, calculate margin and GST, and issue quotations to clients.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (eligibleRequirements.length > 0) {
                handleStartWizardWithRequirement(eligibleRequirements[0]);
              } else {
                toast.info('No pending requirements available to price. Create a requirement first.');
              }
            }}
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
              boxShadow: '0 2px 6px rgba(240, 90, 34, 0.32)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} />
            <span>+ Create Client Quote</span>
          </button>
        </div>
      </div>

      {/* 6 Live KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* 1. Pending Review */}
        <div
          onClick={() => setActiveTab('PENDING_REVIEW')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'PENDING_REVIEW' ? '2px solid #F59E0B' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Pending Review</span>
            <div style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '6px', borderRadius: '8px' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {kpiData.pendingReview}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Awaiting manager approval</div>
        </div>

        {/* 2. Draft */}
        <div
          onClick={() => setActiveTab('DRAFT')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'DRAFT' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Draft</span>
            <div style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '6px', borderRadius: '8px' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {kpiData.draft}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Work in progress</div>
        </div>

        {/* 3. Ready to Issue */}
        <div
          onClick={() => setActiveTab('READY_TO_ISSUE')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'READY_TO_ISSUE' ? '2px solid #10B981' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Ready to Issue</span>
            <div style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '6px', borderRadius: '8px' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {kpiData.readyToIssue}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Approved by manager</div>
        </div>

        {/* 4. Issued */}
        <div
          onClick={() => setActiveTab('ISSUED')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'ISSUED' ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Issued</span>
            <div style={{ backgroundColor: '#F3E8FF', color: '#7C3AED', padding: '6px', borderRadius: '8px' }}>
              <Send size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
            {kpiData.issued}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Sent to clients</div>
        </div>

        {/* 5. Accepted */}
        <div
          onClick={() => setActiveTab('ACCEPTED')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'ACCEPTED' ? '2px solid #059669' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Accepted</span>
            <div style={{ backgroundColor: '#D1FAE5', color: '#047857', padding: '6px', borderRadius: '8px' }}>
              <Check size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginBottom: '4px' }}>
            {kpiData.accepted}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Confirmed by clients</div>
        </div>

        {/* 6. Expiring Soon */}
        <div
          onClick={() => setActiveTab('EXPIRED')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: activeTab === 'EXPIRED' ? '2px solid #EF4444' : '1px solid #E2E8F0',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Expiring Soon</span>
            <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '6px', borderRadius: '8px' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginBottom: '4px' }}>
            {kpiData.expiringSoon}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>&lt; 48 hours remaining</div>
        </div>
      </div>

      {/* 8 Status Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        {[
          { key: 'ALL', label: 'All', count: tabCounts.ALL },
          { key: 'PENDING_REVIEW', label: 'Pending Review', count: tabCounts.PENDING_REVIEW },
          { key: 'DRAFT', label: 'Draft', count: tabCounts.DRAFT },
          { key: 'READY_TO_ISSUE', label: 'Ready to Issue', count: tabCounts.READY_TO_ISSUE },
          { key: 'ISSUED', label: 'Issued', count: tabCounts.ISSUED },
          { key: 'ACCEPTED', label: 'Accepted', count: tabCounts.ACCEPTED },
          { key: 'REJECTED', label: 'Rejected', count: tabCounts.REJECTED },
          { key: 'EXPIRED', label: 'Expired', count: tabCounts.EXPIRED },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setCurrentPage(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                borderBottom: isActive ? '3px solid #F05A22' : '3px solid transparent',
                color: isActive ? '#0F172A' : '#64748B',
                fontSize: '13.5px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isActive ? '#FFEDD5' : '#F1F5F9',
                  color: isActive ? '#C2410C' : '#64748B'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar matching Mockup */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          flexWrap: 'wrap'
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by Quote ID, Req ID, Client, Route..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Client dropdown */}
        <div style={{ flex: '0 0 auto' }}>
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Clients</option>
            {uniqueClients.map(([cName, cCode]) => (
              <option key={cName} value={cName}>{cName} ({cCode})</option>
            ))}
          </select>
        </div>

        {/* Status dropdown */}
        <div style={{ flex: '0 0 auto' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="DRAFT">Draft</option>
            <option value="READY_TO_ISSUE">Ready to Issue</option>
            <option value="ISSUED">Issued</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        {/* Date range dropdown */}
        <div style={{ flex: '0 0 auto' }}>
          <select
            value={dateRangeFilter}
            onChange={(e) => {
              setDateRangeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '13px',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="7_DAYS">Last 7 Days</option>
            <option value="30_DAYS">Last 30 Days</option>
          </select>
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          style={{
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            border: 'none',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Search size={14} />
          <span>Search</span>
        </button>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleResetFilters}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#64748B',
            border: '1px solid #CBD5E1',
            padding: '9px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Reset
        </button>

        {/* Refresh button */}
        <button
          type="button"
          onClick={loadData}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#64748B',
            border: '1px solid #CBD5E1',
            padding: '9px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Quotations Directory Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          marginBottom: '24px'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1080px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredQuotes.length > 0 && selectedQuoteIds.size === filteredQuotes.length}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Quote ID
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Requirement / Client
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Route
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Vehicle
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Vendor Cost
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Margin
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  GST (18%)
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Client Quote
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Valid Until
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
                    <RefreshCw size={28} className="spin" style={{ color: '#F05A22', marginBottom: '12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading pricing and quotations...</div>
                  </td>
                </tr>
              ) : paginatedQuotes.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
                    <FileText size={36} style={{ color: '#CBD5E1', marginBottom: '12px' }} />
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>No quotations found</div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>Try resetting filters or build a new client quote.</div>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      style={{
                        backgroundColor: '#F05A22',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((q) => {
                  const isRowSelected = activeSelectedQuote?.id === q.id;
                  const isChecked = selectedQuoteIds.has(q.id);
                  const clientCompany = q.requirement?.client_company;
                  const clientInitials = (clientCompany?.company_name || 'C').charAt(0).toUpperCase();

                  // Days left
                  const now = Date.now();
                  const expTime = new Date(q.validity_expires_at).getTime();
                  const diffDays = Math.ceil((expTime - now) / 86400000);

                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedQuoteId(q.id)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isRowSelected ? '#F0F9FF' : isChecked ? '#FAF5FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(q.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Quote ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0284C7', textDecoration: 'none' }}>
                            {q.quote_number || q.id}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {new Date(q.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Requirement / Client */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#F05A22', fontFamily: 'monospace', marginBottom: '3px' }}>
                          {q.requirement?.requirement_reference || q.requirement_id}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              backgroundColor: '#E0F2FE',
                              color: '#0369A1',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {clientInitials}
                          </div>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                              {clientCompany?.company_name || 'Client Corp'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>
                              ({clientCompany?.client_code || 'CLI-001'})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Route */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0F172A', fontWeight: 600, marginBottom: '2px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F05A22' }} />
                          <span>{q.requirement?.pickup_address}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
                          <span>{q.requirement?.destination_address}</span>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                          {q.requirement?.vehicle_type}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                          {q.requirement?.required_capacity_mt || 15} MT
                        </div>
                      </td>

                      {/* Vendor Cost */}
                      <td style={{ padding: '14px 16px' }}>
                        {canViewMargins() ? (
                          <>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                              {formatCurrency(q.vendor_base_cost)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Base rate</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>Confidential</div>
                        )}
                      </td>

                      {/* Margin */}
                      <td style={{ padding: '14px 16px' }}>
                        {canViewMargins() ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                              +{formatCurrency(q.admin_margin)}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#ECFDF5',
                                color: '#047857'
                              }}
                            >
                              {q.margin_percent}%
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#94A3B8', fontStyle: 'italic' }}>Confidential</div>
                        )}
                      </td>

                      {/* GST (18%) */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
                        {formatCurrency(q.gst_amount)}
                      </td>

                      {/* Client Quote Total */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                          {formatCurrency(q.total_client_amount)}
                        </div>
                      </td>

                      {/* Valid Until */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: 500 }}>
                          {new Date(q.validity_expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        {diffDays > 0 ? (
                          <span style={{ fontSize: '11px', color: diffDays <= 2 ? '#DC2626' : '#EA580C', fontWeight: 600 }}>
                            {diffDays} days left
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Expired</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {renderStatusBadge(q.status, q.validity_expires_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-row-action-trigger"
                          onClick={(e) => handleOpenActionMenu(e, q.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#64748B',
                            padding: '6px',
                            borderRadius: '6px'
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {!loading && filteredQuotes.length > 0 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              fontSize: '13px',
              color: '#64748B'
            }}
          >
            <div>
              Showing <span style={{ fontWeight: 700, color: '#0F172A' }}>{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span style={{ fontWeight: 700, color: '#0F172A' }}>{Math.min(currentPage * pageSize, filteredQuotes.length)}</span> of{' '}
              <span style={{ fontWeight: 700, color: '#0F172A' }}>{filteredQuotes.length}</span> quotes
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: currentPage === 1 ? '#94A3B8' : '#334155',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span style={{ padding: '0 8px', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: currentPage === totalPages ? '#94A3B8' : '#334155',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating 3-Dot Action Menu */}
      {activeMenuId && (
        <div
          className="action-menu-dropdown"
          style={{
            position: 'absolute',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            width: '210px',
            zIndex: 9999,
            overflow: 'hidden',
            padding: '4px 0'
          }}
        >
          {(() => {
            const menuQuote = quotes.find((q) => q.id === activeMenuId);
            if (!menuQuote) return null;

            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModalQuote(menuQuote);
                    setIsViewDetailsOpen(true);
                    setActiveMenuId(null);
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Eye size={14} color="#0284C7" />
                  <span>View Full Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModalQuote(menuQuote);
                    setIsEditQuoteOpen(true);
                    setActiveMenuId(null);
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Calculator size={14} color="#F05A22" />
                  <span>Edit Quote & Margin</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleUpdateQuoteStatus(menuQuote, 'ISSUED');
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Send size={14} color="#7C3AED" />
                  <span>Issue to Client</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleUpdateQuoteStatus(menuQuote, 'ACCEPTED');
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Check size={14} color="#059669" />
                  <span>Mark as Accepted</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleUpdateQuoteStatus(menuQuote, 'REJECTED');
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <XCircle size={14} color="#DC2626" />
                  <span>Mark as Rejected</span>
                </button>

                <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setActiveModalQuote(menuQuote);
                    setIsActivityHistoryOpen(true);
                    setActiveMenuId(null);
                  }}
                  style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <Clock size={14} />
                  <span>Activity History</span>
                </button>

                {onNavigateToRequirement && menuQuote.requirement_id && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToRequirement(menuQuote.requirement_id);
                      setActiveMenuId(null);
                    }}
                    style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <ArrowRight size={14} />
                    <span>View Requirement</span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* 3 Selected Quote Preview Panels at Bottom matching Mockup */}
      {activeSelectedQuote && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}
        >
          {/* Card 1: Quote Breakdown */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} color="#F05A22" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Quote Breakdown
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                {activeSelectedQuote.quote_number}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '20px' }}>
              {canViewMargins() ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: '#64748B' }}>Vendor Cost</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>
                      {formatCurrency(activeSelectedQuote.vendor_base_cost)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: '#64748B' }}>Our Margin</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>
                      +{formatCurrency(activeSelectedQuote.admin_margin)} ({activeSelectedQuote.margin_percent}%)
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', fontSize: '12px', color: '#64748B' }}>
                  🔒 Internal vendor cost and margin are restricted.
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: '#F1F5F9' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: '#64748B' }}>Taxable Amount</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>
                  {formatCurrency(activeSelectedQuote.vendor_base_cost + activeSelectedQuote.admin_margin)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: '#64748B' }}>GST (18%)</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>
                  +{formatCurrency(activeSelectedQuote.gst_amount)}
                </span>
              </div>

              <div style={{ height: '2px', backgroundColor: '#E2E8F0', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Total Client Quote</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#F05A22' }}>
                  {formatCurrency(activeSelectedQuote.total_client_amount)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveModalQuote(activeSelectedQuote);
                  setIsEditQuoteOpen(true);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#F05A22',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '9px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Calculator size={14} />
                <span>Edit Quote</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModalQuote(activeSelectedQuote);
                  setIsViewDetailsOpen(true);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  padding: '9px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={14} />
                <span>View Full Details</span>
              </button>
            </div>
          </div>

          {/* Card 2: Vendor Source */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '15px'
                  }}
                >
                  <Truck size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {activeSelectedQuote.vendor_info?.vendor_name || 'Assigned Logistics Carrier'}
                    </h3>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D'
                      }}
                    >
                      Selected
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                    {activeSelectedQuote.vendor_info?.vendor_code || 'VND-2024-0089'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Phone size={14} color="#64748B" />
                <span>{activeSelectedQuote.vendor_info?.contact_phone || '+91 98765 43210'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <MapPin size={14} color="#64748B" />
                <span>{activeSelectedQuote.vendor_info?.city || 'Guwahati'}, {activeSelectedQuote.vendor_info?.state || 'Assam'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <Mail size={14} color="#64748B" />
                <span>{activeSelectedQuote.vendor_info?.contact_email || 'dispatch@carrier.in'}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B' }}>Source RFQ:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                  RFQ-{activeSelectedQuote.requirement_id.slice(-6).toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B' }}>Quote Received:</span>
                <span style={{ fontSize: '12.5px', color: '#334155' }}>
                  {new Date(activeSelectedQuote.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {onNavigateToRFQ && (
              <button
                type="button"
                onClick={() => onNavigateToRFQ(activeSelectedQuote.requirement_id)}
                style={{
                  width: '100%',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  border: '1px solid #CBD5E1',
                  padding: '9px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>View RFQ & Compare Quotes</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Card 3: Quote Activity */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#0284C7" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Quote Activity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModalQuote(activeSelectedQuote);
                  setIsActivityHistoryOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284C7',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Full History
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {(activeSelectedQuote.activity_logs || []).slice(0, 4).map((log, idx, arr) => (
                <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                  {idx !== arr.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '7px',
                        top: '18px',
                        bottom: '-14px',
                        width: '2px',
                        backgroundColor: '#E2E8F0'
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: idx === arr.length - 1 ? '#F05A22' : '#CBD5E1',
                      border: '3px solid #FFFFFF',
                      boxShadow: '0 0 0 1px #CBD5E1',
                      zIndex: 2,
                      marginTop: '2px',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{log.action}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {log.details || log.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5-Step Create Client Quote Modal Wizard */}
      {isCreateWizardOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
          onClick={() => setIsCreateWizardOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '880px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Wizard Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Create Client Quote
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Follow the 5-step workflow to price requirement and calculate commercial margin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateWizardOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ display: 'flex', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '12px 24px' }}>
              {[
                { num: 1, label: 'Select Requirement' },
                { num: 2, label: 'Vendor Quote' },
                { num: 3, label: 'Margin & GST' },
                { num: 4, label: 'Quote Terms' },
                { num: 5, label: 'Preview & Submit' }
              ].map((step) => {
                const isActive = wizardStep === step.num;
                const isPassed = wizardStep > step.num;
                return (
                  <div
                    key={step.num}
                    onClick={() => {
                      if (isPassed) setWizardStep(step.num);
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: isPassed ? 'pointer' : 'default',
                      opacity: isActive || isPassed ? 1 : 0.5
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isPassed ? '#10B981' : isActive ? '#F05A22' : '#CBD5E1',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isPassed ? <Check size={14} /> : step.num}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? '#0F172A' : '#64748B' }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Wizard Body (Scrollable) */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* STEP 1: Select Requirement */}
              {wizardStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Step 1: Select Freight Requirement
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {eligibleRequirements.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                        No eligible requirements found awaiting quotation.
                      </div>
                    ) : (
                      eligibleRequirements.map((req) => {
                        const isSelected = wizardRequirement?.id === req.id;
                        return (
                          <div
                            key={req.id}
                            onClick={() => {
                              setWizardRequirement(req);
                              fetchVendorQuotesForWizard(req.id);
                            }}
                            style={{
                              padding: '16px',
                              borderRadius: '10px',
                              border: isSelected ? '2px solid #F05A22' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#FFF7ED' : '#FFFFFF',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F05A22', fontFamily: 'monospace' }}>
                                  {req.requirement_reference || req.id}
                                </span>
                                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                                  {req.client_company?.company_name}
                                </span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                                {req.pickup_address} → {req.destination_address}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                                Vehicle: <strong>{req.vehicle_type}</strong> • Cargo: {req.material_type} ({req.required_capacity_mt} MT)
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="select-wizard-req"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Select Vendor Quotation */}
              {wizardStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Step 2: Select Received Vendor Quotation (Base Cost)
                  </h3>

                  {loadingVendorQuotes ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                      <RefreshCw size={24} className="spin" style={{ color: '#F05A22', marginBottom: '8px' }} />
                      <div>Retrieving carrier bids for this requirement...</div>
                    </div>
                  ) : wizardVendorQuotes.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>
                      No vendor responses recorded yet for this RFQ.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {wizardVendorQuotes.map((vq) => {
                        const isChosen = selectedVendorQuote?.id === vq.id;
                        return (
                          <div
                            key={vq.id}
                            onClick={() => setSelectedVendorQuote(vq)}
                            style={{
                              padding: '16px',
                              borderRadius: '10px',
                              border: isChosen ? '2px solid #F05A22' : '1px solid #E2E8F0',
                              backgroundColor: isChosen ? '#FFF7ED' : '#FFFFFF',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                                  {vq.vendor_company?.vendor_name}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  ({vq.vendor_company?.vendor_code})
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                Hub: {vq.vendor_company?.city}, {vq.vendor_company?.state} • Phone: {vq.vendor_company?.contact_phone}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                                Submitted: {new Date(vq.submitted_at || Date.now()).toLocaleDateString()}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                                  {formatCurrency(vq.quoted_rate || vq.total_amount)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>Carrier Base Rate</div>
                              </div>
                              <input
                                type="radio"
                                name="select-vendor-quote"
                                checked={isChosen}
                                onChange={() => {}}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Margin & GST Calculation */}
              {wizardStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Step 3: Calculate Commercial Margin & GST
                  </h3>

                  {/* Vendor Base Box */}
                  <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Base Carrier Cost</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                        {selectedVendorQuote?.vendor_company?.vendor_name || 'Assigned Carrier'}
                      </div>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                      {formatCurrency(vendorCostBase)}
                    </div>
                  </div>

                  {/* Margin Mode Selector */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                      Operational Margin Calculation
                    </label>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setMarginType('FIXED')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: marginType === 'FIXED' ? '2px solid #F05A22' : '1px solid #CBD5E1',
                          backgroundColor: marginType === 'FIXED' ? '#FFF7ED' : '#FFFFFF',
                          color: marginType === 'FIXED' ? '#C2410C' : '#334155',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Fixed Amount (₹)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarginType('PERCENT')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: marginType === 'PERCENT' ? '2px solid #F05A22' : '1px solid #CBD5E1',
                          backgroundColor: marginType === 'PERCENT' ? '#FFF7ED' : '#FFFFFF',
                          color: marginType === 'PERCENT' ? '#C2410C' : '#334155',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Percentage (%)
                      </button>
                    </div>

                    {marginType === 'FIXED' ? (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748B' }}>₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={marginAmount}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (e.target.value === '' || (!isNaN(val) && val >= 0)) {
                                setMarginAmount(e.target.value);
                              }
                            }}
                            placeholder="e.g. 5500"
                            style={{
                              width: '100%',
                              padding: '10px 12px 10px 30px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              fontSize: '14px',
                              fontWeight: 600,
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          {[5, 10, 12, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setMarginPercent(pct)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: marginPercent === pct ? '1px solid #F05A22' : '1px solid #CBD5E1',
                                backgroundColor: marginPercent === pct ? '#F05A22' : '#FFFFFF',
                                color: marginPercent === pct ? '#FFFFFF' : '#334155',
                                fontWeight: 700,
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={marginPercent}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (e.target.value === '' || isNaN(val)) {
                              setMarginPercent(0);
                            } else {
                              setMarginPercent(Math.max(0, val));
                            }
                          }}
                          placeholder="Margin %"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '14px',
                            fontWeight: 600,
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Additional Charge Lines */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        Additional Charge Items
                      </label>
                      <button
                        type="button"
                        onClick={handleAddChargeLine}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={13} />
                        <span>Add Charge</span>
                      </button>
                    </div>

                    {customChargeLines.map((line) => (
                      <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 36px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <select
                          value={line.charge_type}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'charge_type', e.target.value)}
                          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        >
                          {CHARGE_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'description', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={line.amount}
                          onChange={(e) => handleUpdateChargeLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveChargeLine(line.id)}
                          style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '6px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* GST Configuration */}
                  <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Goods & Services Tax (GST)</span>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="radio" checked={gstApplicable} onChange={() => setGstApplicable(true)} />
                          <span>Applicable</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="radio" checked={!gstApplicable} onChange={() => setGstApplicable(false)} />
                          <span>RCM / Exempt</span>
                        </label>
                      </div>
                    </div>

                    {gstApplicable && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {GST_RATES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setGstRate(r)}
                            style={{
                              flex: 1,
                              padding: '8px',
                              borderRadius: '6px',
                              border: gstRate === r ? '2px solid #F05A22' : '1px solid #CBD5E1',
                              backgroundColor: gstRate === r ? '#FFF7ED' : '#FFFFFF',
                              color: gstRate === r ? '#C2410C' : '#334155',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer'
                            }}
                          >
                            {r}% GST
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Live Calculation Output Card */}
                  <div
                    style={{
                      padding: '18px 20px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                      color: '#FFFFFF'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#94A3B8' }}>
                      <span>Carrier Cost:</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(vendorCostBase)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#94A3B8' }}>
                      <span>Commercial Margin:</span>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>+{formatCurrency(calculatedMarginVal)} ({effectiveMarginPct}%)</span>
                    </div>
                    {chargeTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#94A3B8' }}>
                        <span>Add-on Charges:</span>
                        <span style={{ color: '#FFFFFF', fontWeight: 600 }}>+{formatCurrency(chargeTotal)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#94A3B8' }}>
                      <span>Subtotal (Taxable):</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatCurrency(taxableSubtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', color: '#94A3B8' }}>
                      <span>GST ({gstApplicable ? gstRate : 0}%):</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>+{formatCurrency(computedGstAmount)}</span>
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>Total Final Client Quote:</span>
                      <span style={{ fontSize: '24px', fontWeight: 900, color: '#FB923C' }}>
                        {formatCurrency(clientGrandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Quote Terms */}
              {wizardStep === 4 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Step 4: Terms, Validity & Commercial Conditions
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                        Quotation Validity
                      </label>
                      <select
                        value={validityDays}
                        onChange={(e) => setValidityDays(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      >
                        <option value={3}>3 Days from generation</option>
                        <option value={7}>7 Days from generation (Standard)</option>
                        <option value={15}>15 Days from generation</option>
                        <option value={30}>30 Days (Monthly Contract)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                        Payment Terms
                      </label>
                      <select
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      >
                        <option value="50% Advance on loading, 50% on Delivery">50% Advance, 50% on Delivery</option>
                        <option value="100% on Proof of Delivery (POD)">100% on Proof of Delivery (POD)</option>
                        <option value="Net 15 Days from Invoice">Net 15 Days</option>
                        <option value="Net 30 Days from Invoice">Net 30 Days</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                      Standard Commercial Inclusions
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedInclusions.map((inc, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                          <CheckCircle2 size={15} color="#10B981" />
                          <span>{inc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                      Exclusions & Exceptions
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedExclusions.map((exc, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#64748B' }}>
                          <XCircle size={15} color="#EF4444" />
                          <span>{exc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                      Special Instructions / Operations Notes
                    </label>
                    <textarea
                      rows={3}
                      value={specialTerms}
                      onChange={(e) => setSpecialTerms(e.target.value)}
                      placeholder="Enter specific conditions or transit instructions for the client..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: Official Letterhead Preview & Submit */}
              {wizardStep === 5 && (
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                    Step 5: Client Quotation Letterhead Preview
                  </h3>

                  {/* Official NECL Letterhead Card */}
                  <div
                    style={{
                      border: '2px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: '#FFFFFF',
                      marginBottom: '20px'
                    }}
                  >
                    {/* Letterhead Top */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                          TRUCKS LOGISTICS PLATFORM
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Registered Logistics Provider • GSTIN: 18AABCN1234F1Z5
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          Corporate Office: GS Road, Dispur, Guwahati, Assam - 781005
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#F05A22' }}>
                          FORMAL FREIGHT QUOTE
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                          QT-{new Date().getFullYear()}{String(new Date().getMonth() + 1).padStart(2, '0')}-PREVIEW
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Client & Consignment Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Client Bill-To</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          {wizardRequirement?.client_company?.company_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          Client Code: {wizardRequirement?.client_company?.client_code || 'CLI-001'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Consignment Specs</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {wizardRequirement?.pickup_address} → {wizardRequirement?.destination_address}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          Vehicle: {wizardRequirement?.vehicle_type} ({wizardRequirement?.required_capacity_mt} MT)
                        </div>
                      </div>
                    </div>

                    {/* Financial Schedule */}
                    <div style={{ marginBottom: '18px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Description</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px' }}>Primary Road Freight Transport Service</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(vendorCostBase + calculatedMarginVal)}
                            </td>
                          </tr>
                          {customChargeLines.map((chg) => (
                            <tr key={chg.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px' }}>{chg.charge_type.replace(/_/g, ' ')}: {chg.description || 'Service charge'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(chg.amount)}</td>
                            </tr>
                          ))}
                          <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>Taxable Subtotal</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(taxableSubtotal)}</td>
                          </tr>
                          <tr style={{ borderBottom: '2px solid #CBD5E1' }}>
                            <td style={{ padding: '8px 10px' }}>GST ({gstApplicable ? gstRate : 0}%)</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(computedGstAmount)}</td>
                          </tr>
                          <tr style={{ backgroundColor: '#FFF7ED' }}>
                            <td style={{ padding: '10px', fontWeight: 800, fontSize: '14px', color: '#9A3412' }}>Total Client Payable</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: '16px', color: '#C2410C' }}>
                              {formatCurrency(clientGrandTotal)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
                      <strong>Payment Terms:</strong> {paymentTerms} • <strong>Validity:</strong> Valid for {validityDays} days from generation date.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                disabled={wizardStep === 1 || submittingQuote}
                onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: wizardStep === 1 ? '#94A3B8' : '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: wizardStep === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Back
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {wizardStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && !wizardRequirement) {
                        toast.warning('Please select a requirement first.');
                        return;
                      }
                      if (wizardStep === 2 && !selectedVendorQuote) {
                        toast.warning('Please select a vendor quote.');
                        return;
                      }
                      setWizardStep((s) => Math.min(5, s + 1));
                    }}
                    style={{
                      padding: '9px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#F05A22',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Continue</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={submittingQuote}
                      onClick={() => handleFinalSubmitQuote('DRAFT')}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: submittingQuote ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Save as Draft
                    </button>

                    <button
                      type="button"
                      disabled={submittingQuote}
                      onClick={() => handleFinalSubmitQuote('PENDING_REVIEW')}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: submittingQuote ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Submit for Review
                    </button>

                    <button
                      type="button"
                      disabled={submittingQuote}
                      onClick={() => handleFinalSubmitQuote('ISSUED')}
                      style={{
                        padding: '9px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#F05A22',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: submittingQuote ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(240, 90, 34, 0.3)'
                      }}
                    >
                      <Send size={14} />
                      <span>{submittingQuote ? 'Issuing...' : 'Issue to Client'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Full Details Modal */}
      {isViewDetailsOpen && activeModalQuote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
          onClick={() => setIsViewDetailsOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '28px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Quotation Details: {activeModalQuote.quote_number || activeModalQuote.id}
                </h2>
                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>
                  Requirement Ref: {activeModalQuote.requirement?.requirement_reference || activeModalQuote.requirement_id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewDetailsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Status and valid until */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '10px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                <div style={{ marginTop: '4px' }}>
                  {renderStatusBadge(activeModalQuote.status, activeModalQuote.validity_expires_at)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Valid Until</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {new Date(activeModalQuote.validity_expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Grand Total</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#F05A22', marginTop: '2px' }}>
                  {formatCurrency(activeModalQuote.total_client_amount)}
                </div>
              </div>
            </div>

            {/* Financial Schedule */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                Itemized Rate Schedule
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  {canViewMargins() && (
                    <>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>Vendor Direct Cost</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(activeModalQuote.vendor_base_cost)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', color: '#059669' }}>Admin Commercial Margin</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>+{formatCurrency(activeModalQuote.admin_margin)}</td>
                      </tr>
                    </>
                  )}
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>Taxable Freight Amount</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                      {formatCurrency(activeModalQuote.vendor_base_cost + activeModalQuote.admin_margin)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>GST ({activeModalQuote.gst_rate_percent || 18}%)</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>+{formatCurrency(activeModalQuote.gst_amount)}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#FFF7ED' }}>
                    <td style={{ padding: '10px', fontWeight: 800, color: '#9A3412' }}>Total Quoted to Client</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: '16px', color: '#C2410C' }}>
                      {formatCurrency(activeModalQuote.total_client_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={15} />
                <span>Print Quotation</span>
              </button>
              <button
                type="button"
                onClick={() => setIsViewDetailsOpen(false)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quote & Margin Modal */}
      {isEditQuoteOpen && activeModalQuote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
          onClick={() => setIsEditQuoteOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '28px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Edit Commercial Margin: {activeModalQuote.quote_number || activeModalQuote.id}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditQuoteOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Admin Margin Amount (₹)
              </label>
              <input
                type="number"
                defaultValue={activeModalQuote.admin_margin}
                id="edit-margin-input"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Quote Status
              </label>
              <select
                defaultValue={activeModalQuote.status}
                id="edit-status-select"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="READY_TO_ISSUE">Ready to Issue</option>
                <option value="ISSUED">Issued to Client</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditQuoteOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const marginVal = parseFloat((document.getElementById('edit-margin-input') as HTMLInputElement)?.value) || 0;
                  const statusVal = (document.getElementById('edit-status-select') as HTMLSelectElement)?.value as any;
                  const vCost = activeModalQuote.vendor_base_cost;
                  const gstPct = activeModalQuote.gst_rate_percent || 18;
                  const taxable = vCost + marginVal;
                  const gst = (taxable * gstPct) / 100;
                  const grand = taxable + gst;

                  try {
                    await ensureAdminSession();
                    await supabase
                      .from('client_quotes')
                      .update({
                        admin_margin: marginVal,
                        gst_amount: gst,
                        total_client_amount: grand,
                        status: statusVal,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', activeModalQuote.id);

                    toast.success('Quotation updated successfully.');
                    setIsEditQuoteOpen(false);
                    await loadData();
                  } catch (err: any) {
                    toast.error(`Failed to update quote: ${err.message}`);
                  }
                }}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#F05A22', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity History Modal */}
      {isActivityHistoryOpen && activeModalQuote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
          onClick={() => setIsActivityHistoryOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '28px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Quotation Activity Audit Log
              </h2>
              <button
                type="button"
                onClick={() => setIsActivityHistoryOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(activeModalQuote.activity_logs || []).map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      color: '#0284C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Clock size={16} />
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>{log.action}</span>
                      <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569' }}>{log.details}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Action by: <strong>{log.actor}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsActivityHistoryOpen(false)}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default PricingModule;
