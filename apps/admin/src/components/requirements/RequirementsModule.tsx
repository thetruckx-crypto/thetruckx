import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Plus, Eye, Filter, X, ChevronLeft, ChevronRight, ChevronDown,
  Package, TruckIcon, Truck, Calendar, MapPin, Building2, RefreshCw,
  FileText, AlertCircle, CheckCircle, Clock, Send, XCircle,
  ArrowUpDown, Loader2, Download, RotateCcw, FileCheck, Edit3, Trash2,
  Copy, Check, User, Phone, Mail, ShieldAlert, ArrowUp, ArrowDown,
  Users, AlertTriangle, ShieldCheck, CheckSquare, Square, DollarSign, ExternalLink,
  MoreVertical
} from "lucide-react";
import { supabase, ensureAdminSession } from "../../utils/supabase";
import { formatDisplayId } from "../../utils/idGenerator";

export interface VendorOptionItem {
  id: string;
  vendor_code?: string;
  vendor_name: string;
  pan?: string;
  gstin?: string;
  address?: string;
  status: string;
}

export interface SourcingDataState {
  vendorRequests: any[];
  vendorQuotes: any[];
  clientQuotes: any[];
  booking: any | null;
}

export interface Requirement {
  id: string; // Exact Requirement ID stored in database (e.g. REQ-YYYYMMDD-XXXX)
  requirement_reference: string;
  client_id: string;
  pickup_address: string;
  pickup_pincode?: string;
  pickup_city?: string;
  destination_address: string;
  destination_pincode?: string;
  destination_city?: string;
  origin?: string;
  destination?: string;
  vehicle_type: string;
  vehicle_type_required?: string;
  required_capacity_mt?: number;
  material_type?: string;
  cargo_description?: string;
  loading_datetime?: string;
  required_date?: string;
  special_instructions?: string;
  vehicle_groups?: any[];
  total_vehicles_count?: number;
  total_requirement_entries_count?: number;
  budget_scope?: string;
  target_budget?: string;
  total_cargo_weight?: number;
  total_quantity?: number;
  unit_count?: number;
  package_type?: string;
  package_mode?: string;
  package_description?: string;
  is_hazardous?: boolean;
  hazardous_material_name?: string;
  hazard_class?: string;
  un_number?: string;
  packing_group?: string;
  safety_handling_instructions?: string;
  required_precautions?: string;
  emergency_contact?: string;
  emergency_instructions?: string;
  additional_hazardous_info?: string;
  loading_point_weight_declared?: number;
  loading_point_quantity_declared?: number;
  loading_point_verified_weight?: number;
  loading_point_verified_quantity?: number;
  is_measurement_verified?: boolean;
  status: "DRAFT" | "UNDER_REVIEW" | "ASSIGNED" | "RFQ_SENT" | "QUOTED" | "BOOKED" | "CANCELLED" | "NEW_REQUIREMENT" | "CORRECTIONS_REQUESTED" | string;
  correction_notes?: string;
  created_at: string;
  updated_at?: string;
  client_company?: {
    id?: string;
    client_code?: string;
    company_name: string;
    registered_address?: string;
    city?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
  };
}

export interface ClientContactUser {
  id: string;
  full_name: string;
  mobile: string;
  email?: string;
}

export interface RequirementDocument {
  id: string;
  document_type: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  is_verified?: boolean;
  uploaded_at?: string;
}

export interface RequirementHistoryEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "CREATED" | "REVIEW" | "SOURCING" | "QUOTATION" | "BOOKING" | "STATUS_CHANGE";
  badgeColor?: string;
}

interface RequirementsModuleProps {
  onNavigateToCreate?: () => void;
  onNavigateToDetail?: (requirementId: string) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  NEW_REQUIREMENT: { bg: "#FEF3C7", text: "#B45309", border: "#FDE047", label: "New Requirement" },
  DRAFT: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", label: "Draft" },
  UNDER_REVIEW: { bg: "#FFF1E8", text: "#EA580C", border: "#FED7AA", label: "Under Review" },
  ASSIGNED: { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE", label: "Assigned" },
  RFQ_SENT: { bg: "#E0F2FE", text: "#0284C7", border: "#BAE6FD", label: "RFQ Sent" },
  QUOTED: { bg: "#EDE9FE", text: "#7C3AED", border: "#DDD6FE", label: "Quoted" },
  BOOKED: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0", label: "Booked" },
  CANCELLED: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA", label: "Cancelled" }
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] || { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", label: status.replace(/_/g, " ") };
}

/**
 * Format requirement reference ID
 * Uses the exact stored ID as the single source of truth without mutating characters.
 */
export function formatRequirementReference(id?: string | null, createdAt?: string | null): string {
  if (!id) return "—";
  const trimmed = String(id).trim();
  if (trimmed.startsWith("REQ-") || trimmed.startsWith("NECL-REQ-")) return trimmed;
  if (!createdAt) return trimmed;

  // Compatibility fallback for legacy numeric tests
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return trimmed;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const numPart = trimmed.replace(/\D/g, "").substring(0, 6) || "000001";
  return `REQ-${year}${month}-${numPart.padStart(6, "0")}`;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function formatCreatedDate(dateStr?: string | null): { date: string; time: string } {
  if (!dateStr) return { date: "—", time: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: "—", time: "" };
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  return { date, time };
}

export function truncateText(text?: string | null, maxLength: number = 30): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

type SortField = "id" | "client_name" | "required_date" | "created_at" | "status";
type SortOrder = "asc" | "desc";

export const RequirementsModule: React.FC<RequirementsModuleProps> = ({
  onNavigateToCreate,
  onNavigateToDetail
}) => {
  // Main Data States
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Distinct Filter Option Lists
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<string[]>([]);

  // Status Counts
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    ALL: 0,
    DRAFT: 0,
    UNDER_REVIEW: 0,
    ASSIGNED: 0,
    RFQ_SENT: 0,
    QUOTED: 0,
    BOOKED: 0,
    CANCELLED: 0
  });

  // Drawer / Details State
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<"requirement" | "sourcing" | "client" | "route" | "documents" | "history">("requirement");
  const [clientContactUser, setClientContactUser] = useState<ClientContactUser | null>(null);
  const [reqDocuments, setReqDocuments] = useState<RequirementDocument[]>([]);
  const [reqHistory, setReqHistory] = useState<RequirementHistoryEvent[]>([]);
  const [sourcingData, setSourcingData] = useState<SourcingDataState>({
    vendorRequests: [],
    vendorQuotes: [],
    clientQuotes: [],
    booking: null
  });
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Sourcing Modal State
  const [sourcingReq, setSourcingReq] = useState<Requirement | null>(null);
  const [availableVendors, setAvailableVendors] = useState<VendorOptionItem[]>([]);
  const [selectedVendorIdsForSourcing, setSelectedVendorIdsForSourcing] = useState<Set<string>>(new Set());
  const [alreadyDispatchedVendorIds, setAlreadyDispatchedVendorIds] = useState<Set<string>>(new Set());
  const [sourcingDeadline, setSourcingDeadline] = useState<string>("");
  const [sourcingLoading, setSourcingLoading] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Corrections Request Modal State
  const [correctionsModalReq, setCorrectionsModalReq] = useState<Requirement | null>(null);
  const [correctionNotesInput, setCorrectionNotesInput] = useState<string>("");

  // Emergency Direct Booking Modal State (Separately authorized exception)
  const [emergencyBookingReq, setEmergencyBookingReq] = useState<Requirement | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyAcknowledged, setEmergencyAcknowledged] = useState(false);

  // Action / Mutation States
  const [actionLoading, setActionLoading] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [editFormData, setEditFormData] = useState({
    vehicle_type: "",
    required_capacity_mt: 1,
    weight_unit: "MT" as "MT" | "kg",
    display_weight: 1,
    loading_datetime: "",
    special_instructions: ""
  });
  const [cancellingReq, setCancellingReq] = useState<Requirement | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Floating Actions Menu State
  const [reqMenuAnchor, setReqMenuAnchor] = useState<{
    req: Requirement;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  // Vendor Responses and Status History Modals
  const [vendorResponsesModalReq, setVendorResponsesModalReq] = useState<Requirement | null>(null);
  const [statusHistoryModalReq, setStatusHistoryModalReq] = useState<Requirement | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalResponses, setModalResponses] = useState<any[]>([]);
  const [modalHistory, setModalHistory] = useState<RequirementHistoryEvent[]>([]);

  // Copy helper
  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setToastMessage(`Requirement ID ${id} copied to clipboard!`);
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 2500);
  };

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    try {
      await ensureAdminSession();
      const { count: totalCount } = await supabase
        .from("requirements")
        .select("id", { count: "exact", head: true });

      const statuses = [
        "DRAFT", "UNDER_REVIEW", "ASSIGNED", "RFQ_SENT", "QUOTED", "BOOKED", "CANCELLED", "NEW_REQUIREMENT"
      ];

      const counts = await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from("requirements")
            .select("id", { count: "exact", head: true })
            .eq("status", status);
          return { status, count: count || 0 };
        })
      );

      const countsMap: Record<string, number> = {
        ALL: totalCount || 0,
        DRAFT: 0,
        UNDER_REVIEW: 0,
        ASSIGNED: 0,
        RFQ_SENT: 0,
        QUOTED: 0,
        BOOKED: 0,
        CANCELLED: 0
      };

      counts.forEach(({ status, count }) => {
        if (status === "NEW_REQUIREMENT" || status === "UNDER_REVIEW") {
          countsMap.UNDER_REVIEW = (countsMap.UNDER_REVIEW || 0) + count;
        } else if (countsMap[status] !== undefined) {
          countsMap[status] = count;
        }
      });

      setStatusCounts(countsMap);
      window.dispatchEvent(new CustomEvent('necl:refresh-badges'));
    } catch (err: any) {
      console.error("Error fetching status counts:", err?.message);
    }
  }, []);

  // Fetch all requirements from database
  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureAdminSession();
      const { data, error: fetchError } = await supabase
        .from("requirements")
        .select(`
          *,
          client_companies (
            id,
            client_code,
            company_name,
            registered_address,
            city,
            pincode,
            gstin,
            pan
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: Requirement[] = (data || []).map((req: any) => {
        const comp = Array.isArray(req.client_companies)
          ? req.client_companies[0]
          : req.client_companies || req.client_company;

        return {
          ...req,
          id: req.id, // Preserved exact ID from database
          requirement_reference: req.id, // Stored ID is single source of truth
          origin: req.pickup_address || req.origin || "Origin",
          destination: req.destination_address || req.destination || "Destination",
          required_date: req.loading_datetime || req.required_date || req.created_at,
          cargo_description: req.material_type || req.cargo_description || "General Cargo",
          vehicle_type: req.vehicle_type || req.vehicle_type_required || "Standard",
          client_company: comp
        };
      });

      setRequirements(transformedData);

      // Extract distinct clients and vehicle types for filters
      const clientsMap = new Map<string, string>();
      const vehicleSet = new Set<string>();

      transformedData.forEach((r) => {
        if (r.client_id && r.client_company?.company_name) {
          clientsMap.set(r.client_id, r.client_company.company_name);
        } else if (r.client_id) {
          clientsMap.set(r.client_id, `Client (${r.client_id.slice(0, 8)})`);
        }
        if (r.vehicle_type) {
          vehicleSet.add(r.vehicle_type);
        }
      });

      setClientOptions(
        Array.from(clientsMap.entries()).map(([id, name]) => ({ id, name }))
      );
      setVehicleTypeOptions(Array.from(vehicleSet));
    } catch (err: any) {
      console.error("Error fetching requirements:", err?.message);
      setError("Failed to load transport requirements from database. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time synchronization & Auto-refresh
  useEffect(() => {
    fetchStatusCounts();
    fetchRequirements();

    const channel = supabase
      .channel("transport_requirements_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requirements" },
        () => {
          fetchStatusCounts();
          fetchRequirements();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchStatusCounts();
      fetchRequirements();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchStatusCounts, fetchRequirements]);

  // Fetch Details: Client User Contact, Documents, History
  const fetchRequirementDetailData = async (req: Requirement) => {
    setDetailsLoading(true);
    setClientContactUser(null);
    setReqDocuments([]);
    setReqHistory([]);

    try {
      // 1. Fetch Client User Contact
      if (req.client_id) {
        const { data: users } = await supabase
          .from("client_users")
          .select("id, full_name, mobile, email")
          .eq("client_id", req.client_id)
          .limit(1);

        if (users && users.length > 0) {
          setClientContactUser(users[0]);
        }
      }

      // 2. Fetch Attached Documents
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("requirement_id", req.id);

      if (docs && docs.length > 0) {
        setReqDocuments(
          docs.map((d: any) => ({
            id: d.id,
            document_type: d.document_type || "Requirement Document",
            file_name: d.file_name || d.name || "document.pdf",
            file_url: d.file_url || d.storage_path,
            file_size: d.file_size,
            is_verified: d.is_verified,
            uploaded_at: d.created_at || d.uploaded_at
          }))
        );
      }

      // 3. Aggregate History from real database tables
      const historyList: RequirementHistoryEvent[] = [];

      // A. Created Event
      historyList.push({
        id: `hist-create-${req.id}`,
        title: "Requirement Submitted",
        description: `Client requirement posted for route ${req.pickup_address} → ${req.destination_address} (${req.vehicle_type}, ${req.required_capacity_mt || 1} MT)`,
        timestamp: req.created_at,
        type: "CREATED",
        badgeColor: "#10B981"
      });

      // B. Sourcing & RFQs
      const { data: vrList } = await supabase
        .from("vendor_requests")
        .select(`
          id,
          vendor_id,
          status,
          deadline_at,
          created_at,
          vendor_companies (
            id,
            vendor_code,
            vendor_name,
            pan,
            gstin,
            address
          )
        `)
        .eq("requirement_id", req.id)
        .order("created_at", { ascending: true });

      let vqList: any[] = [];
      if (vrList && vrList.length > 0) {
        const vrIds = vrList.map((vr: any) => vr.id);
        const { data: vqData } = await supabase
          .from("vendor_quotations")
          .select("*")
          .in("vendor_request_id", vrIds);
        vqList = vqData || [];

        vrList.forEach((vr: any) => {
          const vName = (vr.vendor_companies as any)?.vendor_name || "Vendor";
          historyList.push({
            id: `hist-vr-${vr.id}`,
            title: `RFQ Dispatched to ${vName}`,
            description: `Sourcing request status: ${vr.status}. Submission deadline: ${formatDate(vr.deadline_at)}`,
            timestamp: vr.created_at,
            type: "SOURCING",
            badgeColor: "#6D28D9"
          });
        });
      }

      // C. Client Quotations
      const { data: cqList } = await supabase
        .from("client_quotes")
        .select("id, requirement_id, version, vendor_base_cost, admin_margin, gst_amount, total_client_amount, status, created_at")
        .eq("requirement_id", req.id)
        .order("created_at", { ascending: true });

      if (cqList && cqList.length > 0) {
        cqList.forEach((cq: any) => {
          historyList.push({
            id: `hist-cq-${cq.id}`,
            title: `Client Quotation Generated (₹${Number(cq.total_client_amount || 0).toLocaleString("en-IN")})`,
            description: `Quotation status: ${cq.status}`,
            timestamp: cq.created_at,
            type: "QUOTATION",
            badgeColor: "#4338CA"
          });
        });
      }

      // D. Bookings (live table has confirmed_at, not created_at)
      const { data: bkList } = await supabase
        .from("bookings")
        .select("id, requirement_id, client_id, accepted_quote_id, booking_status, payment_status, confirmed_at")
        .eq("requirement_id", req.id)
        .order("confirmed_at", { ascending: true });

      if (bkList && bkList.length > 0) {
        bkList.forEach((bk: any) => {
          historyList.push({
            id: `hist-bk-${bk.id}`,
            title: `Booking Confirmed #${bk.id}`,
            description: `Status: ${bk.booking_status} | Payment: ${bk.payment_status}`,
            timestamp: bk.confirmed_at,
            type: "BOOKING",
            badgeColor: "#059669"
          });
        });
      }

      // Populate sourcing data state for Drawer
      setSourcingData({
        vendorRequests: vrList || [],
        vendorQuotes: vqList,
        clientQuotes: cqList || [],
        booking: bkList && bkList.length > 0 ? bkList[0] : null
      });

      // E. Auth Audit Logs
      const { data: logs } = await supabase
        .from("auth_audit_log")
        .select("id, event_type, details, created_at")
        .or(`details->>requirementId.eq.${req.id},details->>requirement_id.eq.${req.id}`)
        .order("created_at", { ascending: true });

      if (logs && logs.length > 0) {
        logs.forEach((l: any) => {
          historyList.push({
            id: `hist-log-${l.id}`,
            title: l.event_type.replace(/_/g, " "),
            description: JSON.stringify(l.details || {}),
            timestamp: l.created_at,
            type: "STATUS_CHANGE",
            badgeColor: "#F45325"
          });
        });
      }

      // Sort by timestamp descending
      historyList.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setReqHistory(historyList);
    } catch (err: any) {
      console.error("Error fetching requirement detail extras:", err?.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Details Drawer
  const handleOpenDetail = (req: Requirement) => {
    setSelectedReq(req);
    setIsDrawerOpen(true);
    setDrawerActiveTab("requirement");
    fetchRequirementDetailData(req);
    onNavigateToDetail?.(req.id);
  };

  // Toggle Three-Dot Floating Actions Menu
  const handleToggleReqActionMenu = (req: Requirement, e: React.MouseEvent) => {
    e.stopPropagation();
    if (reqMenuAnchor && reqMenuAnchor.req.id === req.id) {
      setReqMenuAnchor(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 260;
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      setReqMenuAnchor({
        req,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    } else {
      setReqMenuAnchor({
        req,
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  };

  // Close actions menu on click or scroll outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (reqMenuAnchor) {
        setReqMenuAnchor(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside, true);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside, true);
    };
  }, [reqMenuAnchor]);

  // Open Vendor Responses Modal
  const handleOpenVendorResponses = async (req: Requirement) => {
    setVendorResponsesModalReq(req);
    setModalLoading(true);
    try {
      await ensureAdminSession();
      const { data: vrList } = await supabase
        .from("vendor_requests")
        .select(`
          id,
          requirement_id,
          vendor_id,
          status,
          deadline_at,
          created_at,
          vendor_companies (
            id,
            vendor_code,
            vendor_name,
            pan,
            gstin,
            address
          )
        `)
        .eq("requirement_id", req.id)
        .order("created_at", { ascending: true });

      let combined: any[] = [];
      if (vrList && vrList.length > 0) {
        const vrIds = vrList.map((vr: any) => vr.id);
        const { data: vqData } = await supabase
          .from("vendor_quotations")
          .select("*")
          .in("vendor_request_id", vrIds);

        combined = vrList.map((vr: any) => {
          const quotes = (vqData || []).filter((q: any) => q.vendor_request_id === vr.id);
          const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;
          return {
            ...vr,
            latestQuote
          };
        });
      }
      setModalResponses(combined);
    } catch (err: any) {
      console.error("Error loading vendor responses:", err?.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Open Status History Modal
  const handleOpenStatusHistory = async (req: Requirement) => {
    setStatusHistoryModalReq(req);
    setModalLoading(true);
    try {
      await ensureAdminSession();
      const historyList: RequirementHistoryEvent[] = [];

      historyList.push({
        id: `hist-created-${req.id}`,
        title: "Requirement Registered in System",
        description: `Client ${req.client_company?.company_name || req.client_id} created freight request from ${req.origin} to ${req.destination}`,
        timestamp: req.created_at,
        type: "CREATED",
        badgeColor: "#10B981"
      });

      const { data: vrList } = await supabase
        .from("vendor_requests")
        .select(`
          id,
          status,
          deadline_at,
          created_at,
          vendor_companies (vendor_name)
        `)
        .eq("requirement_id", req.id)
        .order("created_at", { ascending: true });

      if (vrList) {
        vrList.forEach((vr: any) => {
          const vName = (vr.vendor_companies as any)?.vendor_name || "Vendor";
          historyList.push({
            id: `hist-vr-${vr.id}`,
            title: `RFQ Dispatched to ${vName}`,
            description: `Sourcing request status: ${vr.status}. Submission deadline: ${formatDate(vr.deadline_at)}`,
            timestamp: vr.created_at,
            type: "SOURCING",
            badgeColor: "#6D28D9"
          });
        });
      }

      const { data: cqList } = await supabase
        .from("client_quotes")
        .select("id, total_client_amount, status, created_at")
        .eq("requirement_id", req.id)
        .order("created_at", { ascending: true });

      if (cqList) {
        cqList.forEach((cq: any) => {
          historyList.push({
            id: `hist-cq-${cq.id}`,
            title: `Client Quotation Generated (₹${Number(cq.total_client_amount || 0).toLocaleString("en-IN")})`,
            description: `Quotation status: ${cq.status}`,
            timestamp: cq.created_at,
            type: "QUOTATION",
            badgeColor: "#4338CA"
          });
        });
      }

      const { data: bkList } = await supabase
        .from("bookings")
        .select("id, booking_status, payment_status, confirmed_at")
        .eq("requirement_id", req.id)
        .order("confirmed_at", { ascending: true });

      if (bkList) {
        bkList.forEach((bk: any) => {
          historyList.push({
            id: `hist-bk-${bk.id}`,
            title: `Booking Confirmed #${bk.id}`,
            description: `Status: ${bk.booking_status} | Payment: ${bk.payment_status}`,
            timestamp: bk.confirmed_at,
            type: "BOOKING",
            badgeColor: "#059669"
          });
        });
      }

      historyList.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setModalHistory(historyList);
    } catch (err: any) {
      console.error("Error loading status history:", err?.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Filter & Search Logic
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      // 1. Status Tab Filter
      if (statusTab !== "ALL") {
        if (statusTab === "UNDER_REVIEW") {
          if (req.status !== "UNDER_REVIEW" && req.status !== "NEW_REQUIREMENT") {
            return false;
          }
        } else if (req.status !== statusTab) {
          return false;
        }
      }

      // 2. Client Dropdown Filter
      if (clientFilter !== "ALL" && req.client_id !== clientFilter) {
        return false;
      }

      // 3. Vehicle Type Filter
      if (vehicleTypeFilter !== "ALL" && req.vehicle_type !== vehicleTypeFilter) {
        return false;
      }

      // 4. Date Range Filters (on created_at)
      if (startDateFilter) {
        const start = new Date(startDateFilter).getTime();
        const created = new Date(req.created_at).getTime();
        if (created < start) return false;
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter).setHours(23, 59, 59, 999);
        const created = new Date(req.created_at).getTime();
        if (created > end) return false;
      }

      // 5. Search Query Filter across required fields:
      // Requirement ID, Client ID, Client name, Pickup location, Delivery location, Cargo description, Vehicle type
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchId = req.id.toLowerCase().includes(q);
        const matchClientCode = req.client_company?.client_code?.toLowerCase().includes(q);
        const matchClientId = req.client_id?.toLowerCase().includes(q);
        const matchClientName = req.client_company?.company_name?.toLowerCase().includes(q);
        const matchPickup = (req.pickup_address || req.origin || "").toLowerCase().includes(q) || (req.pickup_pincode || "").includes(q);
        const matchDelivery = (req.destination_address || req.destination || "").toLowerCase().includes(q) || (req.destination_pincode || "").includes(q);
        const matchCargo = (req.cargo_description || req.material_type || "").toLowerCase().includes(q);
        const matchVehicle = (req.vehicle_type || "").toLowerCase().includes(q);

        if (
          !matchId &&
          !matchClientCode &&
          !matchClientId &&
          !matchClientName &&
          !matchPickup &&
          !matchDelivery &&
          !matchCargo &&
          !matchVehicle
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    requirements,
    statusTab,
    clientFilter,
    vehicleTypeFilter,
    startDateFilter,
    endDateFilter,
    searchQuery
  ]);

  // Sorting
  const sortedRequirements = useMemo(() => {
    return [...filteredRequirements].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "id":
          valA = a.id;
          valB = b.id;
          break;
        case "client_name":
          valA = a.client_company?.company_name || "";
          valB = b.client_company?.company_name || "";
          break;
        case "required_date":
          valA = new Date(a.required_date || a.loading_datetime || a.created_at).getTime();
          valB = new Date(b.required_date || b.loading_datetime || b.created_at).getTime();
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "created_at":
        default:
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRequirements, sortField, sortOrder]);

  // Pagination
  const totalCount = sortedRequirements.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedRequirements = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedRequirements.slice(from, from + pageSize);
  }, [sortedRequirements, page, pageSize]);

  // Handle Sort Change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedRequirements.map((r) => r.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAllSelected =
    paginatedRequirements.length > 0 &&
    paginatedRequirements.every((r) => selectedIds.has(r.id));

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusTab("ALL");
    setClientFilter("ALL");
    setVehicleTypeFilter("ALL");
    setStartDateFilter("");
    setEndDateFilter("");
    setPage(1);
    setSelectedIds(new Set());
    setToastMessage("All filters reset successfully.");
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Refresh
  const handleRefresh = () => {
    fetchStatusCounts();
    fetchRequirements();
    setToastMessage("Transport requirements updated from database.");
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const rowsToExport =
      selectedIds.size > 0
        ? sortedRequirements.filter((r) => selectedIds.has(r.id))
        : sortedRequirements;

    if (rowsToExport.length === 0) {
      setError("No requirements available to export.");
      return;
    }

    const headers = [
      "S.No.",
      "Requirement ID",
      "Client ID",
      "Client Name",
      "Transport Type",
      "Cargo Summary",
      "Quantity MT",
      "Special Instructions",
      "Pickup Address",
      "Pickup Pincode",
      "Delivery Address",
      "Delivery Pincode",
      "Vehicle Type",
      "Required Pickup Date",
      "Status",
      "Created Date"
    ];

    const escapeCsv = (str?: string | number | null) => {
      if (str === undefined || str === null) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const csvLines = [headers.join(",")];

    rowsToExport.forEach((r, idx) => {
      const line = [
        idx + 1,
        escapeCsv(r.id),
        escapeCsv(r.client_company?.client_code || r.client_id),
        escapeCsv(r.client_company?.company_name || "—"),
        escapeCsv("FTL Standard"),
        escapeCsv(r.material_type || r.cargo_description || "General Cargo"),
        escapeCsv(r.required_capacity_mt || 1),
        escapeCsv(r.special_instructions || "—"),
        escapeCsv(r.pickup_address),
        escapeCsv(r.pickup_pincode || "—"),
        escapeCsv(r.destination_address),
        escapeCsv(r.destination_pincode || "—"),
        escapeCsv(r.vehicle_type),
        escapeCsv(formatDate(r.required_date)),
        escapeCsv(r.status),
        escapeCsv(formatDateTime(r.created_at))
      ];
      csvLines.push(line.join(","));
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.href = url;
    link.setAttribute("download", `TRUCKS_Transport_Requirements_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage(`Exported ${rowsToExport.length} requirement(s) to CSV!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Status Change Workflow Action
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedReq) return;
    setActionLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("requirements")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedReq.id);

      if (updErr) throw updErr;

      setToastMessage(`Requirement ${selectedReq.id} updated to ${newStatus}`);
      setSelectedReq((prev) => (prev ? { ...prev, status: newStatus } : null));
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      setError(err?.message || "Failed to update requirement status");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch Approved Vendors for Sourcing
  const fetchAvailableVendors = async () => {
    setLoadingVendors(true);
    try {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("vendor_companies")
        .select("id, vendor_code, vendor_name, pan, gstin, address, status")
        .eq("status", "APPROVED")
        .order("vendor_name", { ascending: true });

      if (error) throw error;
      setAvailableVendors(data || []);
    } catch (err: any) {
      console.error("Error fetching vendors for sourcing:", err?.message);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Open Sourcing Dispatch Modal
  const handleOpenSourcingModal = async (req: Requirement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSourcingReq(req);
    setSelectedVendorIdsForSourcing(new Set());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    setSourcingDeadline(tomorrow.toISOString().slice(0, 16));

    try {
      const { data: existingVRs } = await supabase
        .from("vendor_requests")
        .select("vendor_id")
        .eq("requirement_id", req.id);
      const dispatched = new Set((existingVRs || []).map((v: any) => v.vendor_id));
      setAlreadyDispatchedVendorIds(dispatched);
    } catch {
      setAlreadyDispatchedVendorIds(new Set());
    }

    fetchAvailableVendors();
  };

  // Toggle vendor selection for sourcing (skips already invited vendors)
  const handleToggleVendorForSourcing = (vendorId: string) => {
    if (alreadyDispatchedVendorIds.has(vendorId)) return;
    setSelectedVendorIdsForSourcing((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  // Select / Deselect all eligible uninvited vendors for sourcing
  const handleSelectAllVendorsForSourcing = () => {
    const uninvited = availableVendors.filter((v) => !alreadyDispatchedVendorIds.has(v.id));
    if (selectedVendorIdsForSourcing.size === uninvited.length) {
      setSelectedVendorIdsForSourcing(new Set());
    } else {
      setSelectedVendorIdsForSourcing(new Set(uninvited.map((v) => v.id)));
    }
  };

  // Dispatch Sourcing to Selected Vendors
  const handleDispatchSourcing = async () => {
    if (!sourcingReq || selectedVendorIdsForSourcing.size === 0) {
      setError("Please select at least one approved vendor for sourcing.");
      return;
    }
    setSourcingLoading(true);
    try {
      await ensureAdminSession();
      const deadlineDate = sourcingDeadline
        ? new Date(sourcingDeadline).toISOString()
        : new Date(Date.now() + 86400000).toISOString();

      // Check existing vendor requests to strictly prevent duplicate RFQ rows
      const { data: existingVRs } = await supabase
        .from("vendor_requests")
        .select("vendor_id")
        .eq("requirement_id", sourcingReq.id);
      const alreadyDispatched = new Set((existingVRs || []).map((v: any) => v.vendor_id));

      const newVendorIds = Array.from(selectedVendorIdsForSourcing).filter(
        (vId) => !alreadyDispatched.has(vId)
      );

      if (newVendorIds.length === 0) {
        setError("All selected vendors have already received an RFQ for this requirement.");
        setSourcingLoading(false);
        return;
      }

      const inserts = newVendorIds.map((vendorId) => ({
        requirement_id: sourcingReq.id,
        vendor_id: vendorId,
        deadline_at: deadlineDate,
        status: "PENDING"
      }));

      const { error: insErr } = await supabase
        .from("vendor_requests")
        .insert(inserts);

      if (insErr) throw insErr;

      // Update requirement status to RFQ_SENT
      const { error: reqErr } = await supabase
        .from("requirements")
        .update({
          status: "RFQ_SENT",
          updated_at: new Date().toISOString()
        })
        .eq("id", sourcingReq.id);

      if (reqErr) throw reqErr;

      setToastMessage(`Sourcing RFQ dispatched to ${newVendorIds.length} vendor(s) for Requirement ${sourcingReq.id}!`);
      setSourcingReq(null);
      setSelectedVendorIdsForSourcing(new Set());
      if (selectedReq && selectedReq.id === sourcingReq.id) {
        setSelectedReq({ ...selectedReq, status: "RFQ_SENT" });
        fetchRequirementDetailData({ ...selectedReq, status: "RFQ_SENT" });
      }
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      console.error("Error dispatching sourcing:", err);
      setError(err?.message || "Failed to dispatch RFQ to selected vendors.");
    } finally {
      setSourcingLoading(false);
    }
  };

  // Open Corrections Request Modal
  const handleOpenCorrectionsModal = (req: Requirement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCorrectionsModalReq(req);
    setCorrectionNotesInput(req.correction_notes || "");
  };

  // Confirm Requesting Corrections from Client
  const handleConfirmRequestCorrections = async () => {
    if (!correctionsModalReq) return;
    if (!correctionNotesInput.trim()) {
      setError("Please specify the revision or correction details required from the enterprise client.");
      return;
    }
    setActionLoading(true);
    try {
      await ensureAdminSession();
      let { error: updErr } = await supabase
        .from("requirements")
        .update({
          status: "CORRECTIONS_REQUESTED",
          correction_notes: correctionNotesInput.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", correctionsModalReq.id);

      if (updErr && (updErr.message?.includes("correction_notes") || (updErr as any).code === "PGRST204")) {
        const fallbackRes = await supabase
          .from("requirements")
          .update({
            status: "CORRECTIONS_REQUESTED",
            special_instructions: `[CORRECTIONS REQUESTED]: ${correctionNotesInput.trim()}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", correctionsModalReq.id);
        updErr = fallbackRes.error;
      }

      if (updErr) throw updErr;

      setToastMessage(`Revisions requested for Requirement ${correctionsModalReq.id}. Client notified.`);
      setCorrectionsModalReq(null);
      setCorrectionNotesInput("");
      if (selectedReq && selectedReq.id === correctionsModalReq.id) {
        setSelectedReq({
          ...selectedReq,
          status: "CORRECTIONS_REQUESTED",
          correction_notes: correctionNotesInput.trim()
        });
      }
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      setError(err?.message || "Failed to request corrections for requirement.");
    } finally {
      setActionLoading(false);
    }
  };

  // Emergency Direct Booking Handlers (Separately authorized exception process)
  const handleOpenEmergencyBooking = (req: Requirement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEmergencyBookingReq(req);
    setEmergencyReason("");
    setEmergencyAcknowledged(false);
  };

  const handleConfirmEmergencyBooking = async () => {
    if (!emergencyBookingReq) return;
    if (!emergencyReason.trim()) {
      setError("An explicit administrative justification is required for emergency direct booking.");
      return;
    }
    if (!emergencyAcknowledged) {
      setError("Please acknowledge that this direct booking bypasses the normal vendor sourcing and quotation acceptance process.");
      return;
    }
    setActionLoading(true);
    try {
      await ensureAdminSession();
      const newBokId = `BOK-${Date.now().toString().slice(-8)}`;

      // Live bookings table schema: id, requirement_id, client_id, accepted_quote_id, booking_status, payment_status, confirmed_at
      const { error: bokErr } = await supabase.from("bookings").insert([
        {
          id: newBokId,
          requirement_id: emergencyBookingReq.id,
          client_id: emergencyBookingReq.client_id,
          booking_status: "CONFIRMED",
          payment_status: "PAYMENT_PENDING",
          confirmed_at: new Date().toISOString()
        }
      ]);
      if (bokErr) throw bokErr;

      await supabase
        .from("requirements")
        .update({
          status: "BOOKED",
          special_instructions: `${emergencyBookingReq.special_instructions ? emergencyBookingReq.special_instructions + " | " : ""}[DIRECT BOOKING EXCEPTION]: ${emergencyReason.trim()}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", emergencyBookingReq.id);

      setToastMessage(`Emergency Booking #${newBokId} confirmed for Requirement ${emergencyBookingReq.id}!`);
      setEmergencyBookingReq(null);
      if (selectedReq && selectedReq.id === emergencyBookingReq.id) {
        setSelectedReq({ ...selectedReq, status: "BOOKED" });
        fetchRequirementDetailData({ ...selectedReq, status: "BOOKED" });
      }
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      console.error("Emergency booking failed:", err);
      setError(err?.message || "Failed to confirm direct booking");
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Action Handlers with Dual Unit (MT / kg) Support
  const handleOpenEdit = (req: Requirement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cap = req.required_capacity_mt || 1;
    // Auto-detect if small quantity (e.g. 0.03 MT was submitted as 30 kg)
    const isSmallKg = cap < 0.5;
    const initialUnit: "MT" | "kg" = isSmallKg ? "kg" : "MT";
    const initialDisplayVal = isSmallKg ? Math.round(cap * 1000 * 100) / 100 : cap;

    setEditingReq(req);
    setEditFormData({
      vehicle_type: req.vehicle_type || "",
      required_capacity_mt: cap,
      weight_unit: initialUnit,
      display_weight: initialDisplayVal,
      loading_datetime: req.loading_datetime ? req.loading_datetime.slice(0, 10) : "",
      special_instructions: req.special_instructions || ""
    });
  };

  const handleUnitToggle = (newUnit: "MT" | "kg") => {
    if (newUnit === editFormData.weight_unit) return;
    const currentMt = editFormData.required_capacity_mt;
    if (newUnit === "kg") {
      setEditFormData({
        ...editFormData,
        weight_unit: "kg",
        display_weight: Math.round(currentMt * 1000 * 100) / 100
      });
    } else {
      setEditFormData({
        ...editFormData,
        weight_unit: "MT",
        display_weight: Math.round(currentMt * 1000) / 1000
      });
    }
  };

  const handleDisplayWeightChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const normalizedMt = editFormData.weight_unit === "kg" ? val / 1000 : val;
    setEditFormData({
      ...editFormData,
      display_weight: val,
      required_capacity_mt: normalizedMt
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReq) return;
    if (editFormData.required_capacity_mt <= 0) {
      setError("Consignment weight/capacity must be greater than zero.");
      return;
    }
    setActionLoading(true);
    try {
      await ensureAdminSession();
      const { error: updErr } = await supabase
        .from("requirements")
        .update({
          vehicle_type: editFormData.vehicle_type,
          required_capacity_mt: editFormData.required_capacity_mt,
          loading_datetime: editFormData.loading_datetime
            ? new Date(editFormData.loading_datetime).toISOString()
            : editingReq.loading_datetime,
          special_instructions: editFormData.special_instructions || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingReq.id);

      if (updErr) throw updErr;

      setToastMessage(`Requirement ${editingReq.id} updated successfully (${editFormData.required_capacity_mt} MT / ${editFormData.required_capacity_mt * 1000} kg).`);
      setEditingReq(null);
      fetchRequirements();
    } catch (err: any) {
      setError(err?.message || "Failed to update requirement");
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Requirement Handlers
  const handleOpenCancel = (req: Requirement, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCancellingReq(req);
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!cancellingReq) return;
    setActionLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("requirements")
        .update({
          status: "CANCELLED",
          special_instructions: cancelReason
            ? `${cancellingReq.special_instructions ? cancellingReq.special_instructions + " | " : ""}Cancellation Reason: ${cancelReason}`
            : cancellingReq.special_instructions,
          updated_at: new Date().toISOString()
        })
        .eq("id", cancellingReq.id);

      if (updErr) throw updErr;

      setToastMessage(`Requirement ${cancellingReq.id} has been cancelled.`);
      setCancellingReq(null);
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel requirement");
    } finally {
      setActionLoading(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: Requirement["status"]) => {
    const colors = getStatusStyle(status);
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 700,
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap"
        }}
      >
        {status === "UNDER_REVIEW" && <Clock size={11} />}
        {status === "NEW_REQUIREMENT" && <Clock size={11} />}
        {status === "RFQ_SENT" && <Send size={11} />}
        {status === "QUOTED" && <FileText size={11} />}
        {status === "BOOKED" && <CheckCircle size={11} />}
        {status === "CANCELLED" && <XCircle size={11} />}
        <span>{colors.label}</span>
      </span>
    );
  };

  return (
    <div className="requirements-module-wrapper" style={{ padding: "4px 0" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: "#1E293B",
            color: "#FFF",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600,
            borderLeft: "4px solid #F45325"
          }}
        >
          <CheckCircle size={16} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#B91C1C",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <AlertCircle size={16} />
          <span style={{ flex: 1, fontSize: "14px" }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#B91C1C",
              padding: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Transport Requirements Hero Banner (Deep Navy + Truck Visual) ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0B192C 0%, #0F172A 60%, #1E293B 100%)",
          borderRadius: "14px",
          padding: "24px 28px",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 20px rgba(11, 25, 44, 0.25)"
        }}
      >
        {/* Background ambient glow and truck visual on right */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "55%",
            backgroundImage: 'url("/dashboard-hero-truck.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center right",
            maskImage: "linear-gradient(to right, transparent, black 35%)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 35%)",
            opacity: 0.85,
            pointerEvents: "none"
          }}
        />

        {/* Content on left */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "16px", maxWidth: "60%" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              backdropFilter: "blur(6px)"
            }}
          >
            <Package size={26} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
              Transport Requirements
            </h1>
            <p style={{ fontSize: "13.5px", color: "#94A3B8", margin: 0 }}>
              Review client freight requirements, manage vendor sourcing and track quotation progress.
            </p>
          </div>
        </div>

        {/* Actions on right */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleExportCSV}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#FFFFFF",
              color: "#0F172A",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <Download size={15} color="#0F172A" />
            <span>Export CSV</span>
          </button>

          {onNavigateToCreate && (
            <button
              onClick={onNavigateToCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#F05A22",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(240, 90, 34, 0.4)",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#D84A15";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#F05A22";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Requirement</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 4 KPI Summary Cards (Mockup Grid) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "16px",
          marginBottom: "20px"
        }}
      >
        {[
          {
            id: "total",
            title: "Total Requirements",
            value: statusCounts.ALL || requirements.length,
            icon: <FileText size={22} color="#2563EB" />,
            iconBg: "#EFF6FF",
            filterTab: "ALL"
          },
          {
            id: "review",
            title: "Under Review",
            value: (statusCounts.UNDER_REVIEW || 0) + (statusCounts.NEW_REQUIREMENT || 0),
            icon: <Clock size={22} color="#EA580C" />,
            iconBg: "#FFF7ED",
            filterTab: "UNDER_REVIEW"
          },
          {
            id: "sourcing",
            title: "Awaiting Vendor Responses",
            value: (statusCounts.RFQ_SENT || 0) + (statusCounts.ASSIGNED || 0),
            icon: <Users size={22} color="#4F46E5" />,
            iconBg: "#EEF2FF",
            filterTab: "RFQ_SENT"
          },
          {
            id: "booked",
            title: "Booked",
            value: statusCounts.BOOKED || 0,
            icon: <CheckCircle size={22} color="#16A34A" />,
            iconBg: "#F0FDF4",
            filterTab: "BOOKED"
          }
        ].map((kpi) => (
          <div
            key={kpi.id}
            onClick={() => {
              setStatusTab(kpi.filterTab);
              setPage(1);
            }}
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#CBD5E1";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E2E8F0";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: kpi.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                {kpi.icon}
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "2px" }}>
                  {kpi.title}
                </div>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
                  {kpi.value}
                </div>
              </div>
            </div>
            <ChevronRight size={18} color="#94A3B8" />
          </div>
        ))}
      </div>

      {/* ── Status Tabs (Mockup Style with Count in Tab) ── */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          padding: "6px",
          background: "#FFFFFF",
          borderRadius: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          border: "1px solid #E2E8F0",
          overflowX: "auto"
        }}
      >
        {[
          { key: "ALL", label: "All" },
          { key: "DRAFT", label: "Draft" },
          { key: "UNDER_REVIEW", label: "Under Review" },
          { key: "ASSIGNED", label: "Assigned" },
          { key: "RFQ_SENT", label: "RFQ Sent" },
          { key: "QUOTED", label: "Quoted" },
          { key: "BOOKED", label: "Booked" },
          { key: "CANCELLED", label: "Cancelled" }
        ].map((tab) => {
          const isActive = statusTab === tab.key;
          const count = tab.key === "ALL"
            ? (statusCounts.ALL || requirements.length)
            : (statusCounts[tab.key] || 0);
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusTab(tab.key);
                setPage(1);
              }}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                border: isActive ? "none" : "1px solid #E2E8F0",
                background: isActive ? "#F05A22" : "#FFFFFF",
                color: isActive ? "#FFFFFF" : "#475569",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: isActive ? "0 2px 6px rgba(240,90,34,0.3)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  background: isActive ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                  color: isActive ? "#FFFFFF" : "#475569",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 800
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Bar (Matching Mockup Two-Row Layout) ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "18px",
          padding: "16px",
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}
      >
        {/* Top Row: Search Input + Refresh & Reset */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ flex: 1, minWidth: "280px", position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94A3B8"
              }}
            />
            <input
              type="text"
              placeholder="Search by Requirement ID, Client ID, Client name, Pickup, Delivery, Cargo, Vehicle..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "9px 12px 9px 38px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "13.5px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#F45325")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#CBD5E1")}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94A3B8",
                  padding: "4px"
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={13} color="#64748B" />
            <span>Refresh</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#64748B",
              cursor: "pointer"
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>

        {/* Bottom Row: Client, Vehicle Category, Date Range */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Client Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B" }}>Client:</span>
            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "7px 12px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "12.5px",
                color: "#1E293B",
                background: "#FFFFFF",
                outline: "none"
              }}
            >
              <option value="ALL">All Registered Clients</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B" }}>Vehicle Category:</span>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => {
                setVehicleTypeFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "7px 12px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "12.5px",
                color: "#1E293B",
                background: "#FFFFFF",
                outline: "none"
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="Lorry">Lorry</option>
              <option value="Trailer">Trailer</option>
              <option value="Van">Van</option>
              <option value="Heavy Carrier">Heavy Carrier</option>
              {vehicleTypeOptions
                .filter((v) => !["lorry", "trailer", "van", "heavy carrier"].includes(v.toLowerCase()))
                .map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>
          </div>

          {/* Date Range: From / To */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B" }}>From:</span>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Calendar size={13} color="#94A3B8" style={{ position: "absolute", left: "8px", pointerEvents: "none" }} />
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "6px 8px 6px 26px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#1E293B",
                  background: "#FFFFFF"
                }}
              />
            </div>

            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B" }}>To:</span>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Calendar size={13} color="#94A3B8" style={{ position: "absolute", left: "8px", pointerEvents: "none" }} />
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "6px 8px 6px 26px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#1E293B",
                  background: "#FFFFFF"
                }}
              />
            </div>
          </div>

          {/* Page Size Selector */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "#64748B" }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "6px 8px",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#1E293B",
                background: "#FFFFFF"
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Strip if Rows Selected */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: "10px 14px",
              background: "#FFF7ED",
              border: "1px solid #FDBA74",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "13px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, color: "#C2410C" }}>
                {selectedIds.size} requirement(s) selected
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleExportCSV}
                style={{
                  padding: "6px 12px",
                  background: "#FFFFFF",
                  border: "1px solid #F97316",
                  color: "#C2410C",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Export Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: "6px 10px",
                  background: "transparent",
                  border: "none",
                  color: "#64748B",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transport Requirements Table (All 14 Required Columns in Order) */}
      <div
        className="client-table-card"
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          overflowX: "auto"
        }}
      >
        <table
          className="client-table"
          style={{
            width: "100%",
            minWidth: "1550px",
            borderCollapse: "collapse",
            fontSize: "13px"
          }}
        >
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {/* 1. Checkbox */}
              <th style={{ padding: "12px 14px", width: "40px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  style={{ cursor: "pointer", width: 15, height: 15 }}
                />
              </th>

              {/* 2. S.No. */}
              <th style={{ padding: "12px 10px", width: "50px", textAlign: "center", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                S.No.
              </th>

              {/* 3. Requirement ID */}
              <th
                onClick={() => handleSort("id")}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  color: "#64748B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>Requirement ID</span>
                  {sortField === "id" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} color="#F45325" /> : <ArrowDown size={12} color="#F45325" />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </div>
              </th>

              {/* 4. Client ID */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Client ID
              </th>

              {/* 5. Client Name */}
              <th
                onClick={() => handleSort("client_name")}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  color: "#64748B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>Client Name</span>
                  {sortField === "client_name" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} color="#F45325" /> : <ArrowDown size={12} color="#F45325" />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </div>
              </th>

              {/* 6. Requirement Details */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Requirement Details
              </th>

              {/* 7. Pickup Location */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Pickup Location
              </th>

              {/* 8. Delivery Location */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Delivery Location
              </th>

              {/* 9. Vehicle Category */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Vehicle Category
              </th>

              {/* 10. Cargo Details */}
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase" }}>
                Cargo Details
              </th>

              {/* 11. Required Pickup Date */}
              <th
                onClick={() => handleSort("required_date")}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  color: "#64748B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>Required Pickup</span>
                  {sortField === "required_date" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} color="#F45325" /> : <ArrowDown size={12} color="#F45325" />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </div>
              </th>

              {/* 12. Status */}
              <th
                onClick={() => handleSort("status")}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  color: "#64748B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>Status</span>
                  {sortField === "status" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} color="#F45325" /> : <ArrowDown size={12} color="#F45325" />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </div>
              </th>

              {/* 13. Created Date */}
              <th
                onClick={() => handleSort("created_at")}
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  color: "#64748B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span>Created Date</span>
                  {sortField === "created_at" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} color="#F45325" /> : <ArrowDown size={12} color="#F45325" />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </div>
              </th>

              {/* 14. Actions */}
              <th style={{ padding: "12px 14px", textAlign: "center", color: "#64748B", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase", width: "70px" }}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td colSpan={14} style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        height: "36px",
                        background: "#F8FAFC",
                        borderRadius: "6px",
                        animation: "pulse 1.5s ease-in-out infinite"
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : paginatedRequirements.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: "center", padding: "60px 20px" }}>
                  <Package size={44} color="#CBD5E1" style={{ marginBottom: "14px" }} />
                  <h3 style={{ color: "#0F172A", margin: "0 0 6px", fontSize: "17px", fontWeight: 700 }}>
                    No transport requirements found
                  </h3>
                  <p style={{ color: "#64748B", margin: 0, fontSize: "13.5px" }}>
                    {searchQuery || clientFilter !== "ALL" || vehicleTypeFilter !== "ALL" || statusTab !== "ALL"
                      ? "No records matched your active search or filter criteria. Try resetting filters."
                      : "No client transport requirements recorded in the system yet."}
                  </p>
                  {(searchQuery || clientFilter !== "ALL" || vehicleTypeFilter !== "ALL" || statusTab !== "ALL") && (
                    <button
                      onClick={handleResetFilters}
                      style={{
                        marginTop: "16px",
                        padding: "8px 16px",
                        background: "#F45325",
                        color: "#FFF",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Reset All Filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedRequirements.map((req, idx) => {
                const isSelected = selectedIds.has(req.id);
                const isEditable = req.status === "DRAFT" || req.status === "NEW_REQUIREMENT" || req.status === "UNDER_REVIEW";
                const isCancellable = req.status !== "BOOKED" && req.status !== "CANCELLED";

                return (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenDetail(req)}
                    style={{
                      borderBottom: "1px solid #F1F5F9",
                      background: isSelected ? "#FFF7ED" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#F8FAFC";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* 1. Checkbox */}
                    <td
                      style={{ padding: "12px 14px", textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(req.id, e.target.checked)}
                        style={{ cursor: "pointer", width: 15, height: 15 }}
                      />
                    </td>

                    {/* 2. S.No. */}
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#64748B", fontWeight: 600 }}>
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* 3. Requirement ID (Exact ID, Character for Character) */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          title={req.id}
                          style={{
                            fontWeight: 800,
                            color: "#0F172A",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            fontSize: "12.5px"
                          }}
                        >
                          {req.id}
                        </span>
                        <button
                          onClick={(e) => handleCopyId(req.id, e)}
                          title="Copy Requirement ID"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px",
                            cursor: "pointer",
                            color: copiedId === req.id ? "#10B981" : "#94A3B8"
                          }}
                        >
                          {copiedId === req.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>

                    {/* 4. Client ID */}
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        title={req.client_company?.client_code || req.client_id}
                        style={{
                          fontSize: "12px",
                          color: "#475569",
                          fontWeight: 600,
                          fontFamily: "monospace"
                        }}
                      >
                        {req.client_company?.client_code || truncateText(req.client_id, 14)}
                      </span>
                    </td>

                    {/* 5. Client Name */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            background: "#F45325",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 800,
                            flexShrink: 0
                          }}
                        >
                          {req.client_company?.company_name?.substring(0, 2).toUpperCase() || "CL"}
                        </div>
                        <span style={{ fontWeight: 700, color: "#0F172A" }}>
                          {req.client_company?.company_name || "—"}
                        </span>
                      </div>
                    </td>

                    {/* 6. Requirement Details */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>
                          FTL Standard • {req.required_capacity_mt || 1} MT
                        </div>
                        {req.special_instructions && (
                          <div
                            title={req.special_instructions}
                            style={{ fontSize: "11.5px", color: "#64748B", fontStyle: "italic" }}
                          >
                            {truncateText(req.special_instructions, 26)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 7. Pickup Location */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={13} color="#F05A22" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#0F172A", fontSize: "13px" }}>
                          {req.pickup_city || truncateText(req.pickup_address, 22)}
                        </span>
                      </div>
                    </td>

                    {/* 8. Delivery Location */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={13} color="#2563EB" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "#0F172A", fontSize: "13px" }}>
                          {req.destination_city || truncateText(req.destination_address, 22)}
                        </span>
                      </div>
                    </td>

                    {/* 9. Vehicle Category */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 500, color: "#334155", fontSize: "13px" }}>
                        {req.vehicle_type}
                      </span>
                    </td>

                    {/* 10. Cargo Details */}
                    <td style={{ padding: "12px 14px" }}>
                      <div title={req.cargo_description || req.material_type} style={{ color: "#334155", fontWeight: 500, fontSize: "13px" }}>
                        {truncateText(req.cargo_description || req.material_type, 24)}
                      </div>
                    </td>

                    {/* 11. Required Pickup Date */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <Calendar size={13} color="#64748B" />
                        <span style={{ color: "#0F172A", fontWeight: 600, fontSize: "12.5px" }}>
                          {formatDate(req.required_date)}
                        </span>
                      </div>
                    </td>

                    {/* 12. Status */}
                    <td style={{ padding: "12px 14px" }}>
                      {renderStatusBadge(req.status)}
                    </td>

                    {/* 13. Created Date (Date on line 1, Time on line 2) */}
                    <td style={{ padding: "12px 14px" }}>
                      {(() => {
                        const { date, time } = formatCreatedDate(req.created_at);
                        return (
                          <div>
                            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#0F172A" }}>
                              {date}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>
                              {time}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 14. Actions (Three-Dot Menu) */}
                    <td
                      style={{ padding: "12px 14px", textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleToggleReqActionMenu(req, e)}
                        title="Actions"
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          border: "1px solid #BFDBFE",
                          background: reqMenuAnchor?.req.id === req.id ? "#DBEAFE" : "#EFF6FF",
                          color: "#2563EB",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          if (reqMenuAnchor?.req.id !== req.id) {
                            e.currentTarget.style.background = "#DBEAFE";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (reqMenuAnchor?.req.id !== req.id) {
                            e.currentTarget.style.background = "#EFF6FF";
                          }
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

        {/* Pagination & Footer Controls */}
        {!loading && paginatedRequirements.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div style={{ fontSize: "13px", color: "#64748B" }}>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} records
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  background: page === 1 ? "#F1F5F9" : "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: page === 1 ? "#94A3B8" : "#334155",
                  cursor: page === 1 ? "not-allowed" : "pointer"
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span style={{ padding: "6px 8px", color: "#94A3B8", fontSize: "12px" }}>
                            ...
                          </span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          style={{
                            padding: "6px 11px",
                            background: page === p ? "#F45325" : "#FFFFFF",
                            border: `1px solid ${page === p ? "#F45325" : "#CBD5E1"}`,
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: page === p ? "#FFFFFF" : "#334155",
                            cursor: "pointer",
                            minWidth: "34px"
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  background: page === totalPages ? "#F1F5F9" : "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: page === totalPages ? "#94A3B8" : "#334155",
                  cursor: page === totalPages ? "not-allowed" : "pointer"
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. VIEW REQUIREMENT DETAILS DRAWER (Organized into Sections A, B, C, D, E) */}
      {/* ========================================================================= */}
      {isDrawerOpen && selectedReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 9999
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              height: "100%",
              background: "#FFFFFF",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.22s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#0F172A",
                      margin: 0,
                      fontFamily: "monospace"
                    }}
                  >
                    {selectedReq.id}
                  </h2>
                  <button
                    onClick={(e) => handleCopyId(selectedReq.id, e)}
                    title="Copy Requirement ID"
                    style={{
                      background: "none",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: copiedId === selectedReq.id ? "#10B981" : "#64748B"
                    }}
                  >
                    {copiedId === selectedReq.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  {renderStatusBadge(selectedReq.status)}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Submitted on {formatDateTime(selectedReq.created_at)} • Client: {selectedReq.client_company?.company_name || selectedReq.client_id}
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  padding: "6px",
                  borderRadius: "6px"
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs for the 5 Sections */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #E2E8F0",
                background: "#FFFFFF",
                padding: "0 20px",
                overflowX: "auto"
              }}
            >
              {[
                { key: "requirement", label: "Requirement Info" },
                { key: "sourcing", label: `Sourcing & Quotes (${sourcingData.vendorRequests.length})` },
                { key: "client", label: "Client Info" },
                { key: "route", label: "Pickup & Delivery" },
                { key: "documents", label: `Documents (${reqDocuments.length})` },
                { key: "history", label: "Workflow History" }
              ].map((tab) => {
                const isActive = drawerActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setDrawerActiveTab(tab.key as any)}
                    style={{
                      padding: "12px 14px",
                      border: "none",
                      borderBottom: isActive ? "3px solid #F45325" : "3px solid transparent",
                      background: "transparent",
                      color: isActive ? "#F45325" : "#64748B",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {detailsLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                  <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                  <p style={{ fontSize: "13.5px" }}>Loading requirement details...</p>
                </div>
              ) : (
                <>
                  {/* ======================================================== */}
                  {/* SECTION B: REQUIREMENT INFORMATION                      */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "requirement" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div
                        style={{
                          padding: "16px",
                          background: "#F8FAFC",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: "12px" }}>
                          Core Specifications
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Requirement ID</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>
                              {selectedReq.id}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Transport Type</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              Full Truck Load (FTL)
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Cargo Description</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              {selectedReq.cargo_description || selectedReq.material_type || "General Cargo"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Quantity & Weight</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              {selectedReq.required_capacity_mt || 1} MT
                              {(selectedReq.required_capacity_mt || 1) < 0.5 && (
                                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 400, marginLeft: "4px" }}>
                                  ({Math.round((selectedReq.required_capacity_mt || 1) * 1000)} kg)
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Vehicle Specification</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              {selectedReq.vehicle_type}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Required Vehicles</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              1 Dedicated Vehicle
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Required Pickup Date</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              {formatDate(selectedReq.required_date)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Loading Datetime</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                              {formatDateTime(selectedReq.loading_datetime || selectedReq.required_date)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Configured Vehicle Requirements (Multi-Vehicle Synchronization) */}
                      {selectedReq.vehicle_groups && selectedReq.vehicle_groups.length > 0 && (
                        <div
                          style={{
                            padding: "16px",
                            background: "#FFFFFF",
                            borderRadius: "10px",
                            border: "1px solid #E2E8F0"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <Truck size={17} color="#FF6B00" />
                              <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                Configured Vehicle Requirements
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", background: "#F1F5F9", color: "#475569", borderRadius: "6px" }}>
                                {selectedReq.vehicle_groups.length} {selectedReq.vehicle_groups.length === 1 ? 'Entry' : 'Entries'}
                              </span>
                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", background: "#FFF3E8", color: "#FF6B00", borderRadius: "6px", border: "1px solid #FED7AA" }}>
                                {selectedReq.total_vehicles_count || selectedReq.vehicle_groups.reduce((acc: number, g: any) => acc + (Number(g.quantity) || 1), 0)} Vehicles Total
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {selectedReq.vehicle_groups.map((vg: any, idx: number) => (
                              <div
                                key={vg.id || idx}
                                style={{
                                  border: "1px solid #EAECF0",
                                  borderRadius: "8px",
                                  padding: "12px",
                                  background: "#F8FAFC"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ width: "22px", height: "22px", borderRadius: "11px", background: "#FF6B00", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800 }}>
                                      {idx + 1}
                                    </span>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                                      {vg.quantity || 1}x {vg.vehicleType || vg.vehicleTypeName || "Lorry"} ({vg.vehicleBodyType || "Open Body"})
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#FF6B00", background: "#FFF3E8", padding: "2px 8px", borderRadius: "4px" }}>
                                    {vg.capacityMt || vg.payloadMt || 16} MT
                                  </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", fontSize: "11.5px" }}>
                                  <div>
                                    <span style={{ color: "#64748B" }}>Dimensions: </span>
                                    <strong style={{ color: "#0F172A" }}>
                                      {vg.requiresDimensions && (vg.dimensionsLength || vg.dimensions)
                                        ? (vg.dimensions || `${vg.dimensionsLength}x${vg.dimensionsWidth}x${vg.dimensionsHeight} ft`)
                                        : "Standard"}
                                    </strong>
                                  </div>
                                  <div>
                                    <span style={{ color: "#64748B" }}>Handling: </span>
                                    <strong style={{ color: "#0F172A" }}>
                                      {vg.handlingRequirement || vg.handlingRequirements?.[0] || "Normal Loading"}
                                    </strong>
                                  </div>
                                  <div>
                                    <span style={{ color: "#64748B" }}>Dispatch: </span>
                                    <strong style={{ color: "#0F172A" }}>
                                      {vg.dispatchRequirement || "Standard Dispatch"}
                                    </strong>
                                  </div>
                                  {vg.vehicleBudget && (
                                    <div>
                                      <span style={{ color: "#64748B" }}>Target Budget: </span>
                                      <strong style={{ color: "#16A34A" }}>₹{vg.vehicleBudget}</strong>
                                    </div>
                                  )}
                                </div>

                                {(vg.instructions || vg.customHandlingRequirement || vg.customDispatchRequirement) && (
                                  <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #E2E8F0", fontSize: "11.5px", color: "#475569" }}>
                                    {vg.instructions && <div><em>Notes:</em> {vg.instructions}</div>}
                                    {vg.customHandlingRequirement && <div><em>Custom Handling:</em> {vg.customHandlingRequirement}</div>}
                                    {vg.customDispatchRequirement && <div><em>Custom Dispatch:</em> {vg.customDispatchRequirement}</div>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Special Instructions */}
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#FFFFFF",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                          Special Instructions & Handling
                        </div>
                        <p style={{ fontSize: "13.5px", color: "#334155", margin: 0, lineHeight: 1.5 }}>
                          {selectedReq.special_instructions || "No special handling instructions provided by consignor."}
                        </p>
                      </div>

                      {/* Loading-Point Cargo Details: Declared vs Verified */}
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#FFFFFF",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                            Loading-Point Cargo Details
                          </div>
                          {selectedReq.is_measurement_verified ? (
                            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", background: "#ECFDF5", color: "#16A34A", borderRadius: "4px", border: "1px solid #A7F3D0" }}>
                              Verified at Terminal
                            </span>
                          ) : (
                            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", background: "#FFF7ED", color: "#C2410C", borderRadius: "4px", border: "1px solid #FED7AA" }}>
                              Consignor Declared
                            </span>
                          )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                          <div style={{ background: "#F8FAFC", padding: "10px", borderRadius: "8px", border: "1px solid #EAECF0" }}>
                            <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "2px" }}>Consignor Declared</div>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>
                              {selectedReq.total_cargo_weight || selectedReq.loading_point_weight_declared || selectedReq.required_capacity_mt || 1} MT
                            </div>
                            <div style={{ fontSize: "11px", color: "#475569" }}>
                              Quantity: {selectedReq.total_quantity || selectedReq.loading_point_quantity_declared || selectedReq.unit_count || 'As declared'} units
                            </div>
                          </div>

                          <div style={{ background: selectedReq.is_measurement_verified ? "#F0FDF4" : "#F8FAFC", padding: "10px", borderRadius: "8px", border: "1px solid #EAECF0" }}>
                            <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "2px" }}>Terminal Verified</div>
                            <div style={{ fontWeight: 700, color: selectedReq.is_measurement_verified ? "#16A34A" : "#64748B" }}>
                              {selectedReq.loading_point_verified_weight ? `${selectedReq.loading_point_verified_weight} MT` : 'Pending Terminal Weighing'}
                            </div>
                            <div style={{ fontSize: "11px", color: "#475569" }}>
                              {selectedReq.loading_point_verified_quantity ? `Quantity: ${selectedReq.loading_point_verified_quantity} units` : 'Not yet verified'}
                            </div>
                          </div>
                        </div>

                        {/* Optional Package Details if provided */}
                        {(selectedReq.package_type || selectedReq.package_mode || selectedReq.package_description) && (
                          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed #E2E8F0", fontSize: "12px", color: "#334155" }}>
                            <span style={{ fontWeight: 700 }}>Package Details: </span>
                            {selectedReq.package_type && <span>Type: {selectedReq.package_type} • </span>}
                            {selectedReq.package_mode && <span>Mode: {selectedReq.package_mode} • </span>}
                            {selectedReq.package_description && <span>Notes: {selectedReq.package_description}</span>}
                          </div>
                        )}

                        {/* Hazardous Details if declared */}
                        {selectedReq.is_hazardous && (
                          <div style={{ marginTop: "10px", padding: "10px", background: "#FEF2F2", borderRadius: "8px", border: "1px solid #FECACA", fontSize: "12px" }}>
                            <div style={{ fontWeight: 800, color: "#DC2626", marginBottom: "4px" }}>
                              ⚠️ Regulated Hazardous (Hazchem) Cargo
                            </div>
                            <div style={{ color: "#7F1D1D" }}>
                              <strong>Material:</strong> {selectedReq.hazardous_material_name || "Hazardous Goods"}
                              {selectedReq.hazard_class && <span> • <strong>Class:</strong> {selectedReq.hazard_class}</span>}
                              {selectedReq.un_number && <span> • <strong>UN:</strong> {selectedReq.un_number}</span>}
                              {selectedReq.packing_group && <span> • <strong>PG:</strong> {selectedReq.packing_group}</span>}
                            </div>
                            {selectedReq.emergency_contact && (
                              <div style={{ marginTop: "4px", color: "#991B1B", fontSize: "11px" }}>
                                <strong>Emergency Contact:</strong> {selectedReq.emergency_contact}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sourcing Actions Strip */}
                      <div
                        style={{
                          padding: "16px",
                          background: "#FFF7ED",
                          borderRadius: "10px",
                          border: "1px solid #FED7AA"
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#9A3412", marginBottom: "10px" }}>
                          Permitted Workflow Actions
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {selectedReq.status === "NEW_REQUIREMENT" && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleUpdateStatus("UNDER_REVIEW")}
                              style={{
                                padding: "8px 14px",
                                background: "#FEF3C7",
                                color: "#B45309",
                                border: "1px solid #FDE047",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              Move to Under Review
                            </button>
                          )}
                          {(selectedReq.status === "NEW_REQUIREMENT" || selectedReq.status === "UNDER_REVIEW") && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleOpenCorrectionsModal(selectedReq)}
                              style={{
                                padding: "8px 14px",
                                background: "#FEF2F2",
                                color: "#B91C1C",
                                border: "1px solid #FECACA",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <Edit3 size={13} />
                              <span>Request Client Corrections</span>
                            </button>
                          )}
                          {selectedReq.status === "CORRECTIONS_REQUESTED" && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleUpdateStatus("UNDER_REVIEW")}
                              style={{
                                padding: "8px 14px",
                                background: "#ECFDF5",
                                color: "#047857",
                                border: "1px solid #A7F3D0",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <CheckCircle size={13} />
                              <span>Accept Revisions & Move to Under Review</span>
                            </button>
                          )}
                          {selectedReq.status !== "BOOKED" && selectedReq.status !== "CANCELLED" && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleOpenSourcingModal(selectedReq)}
                              style={{
                                padding: "8px 14px",
                                background: "#DBEAFE",
                                color: "#1D4ED8",
                                border: "1px solid #93C5FD",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <Send size={13} />
                              <span>Assign for Sourcing (Standard Flow)</span>
                            </button>
                          )}
                          {selectedReq.status !== "BOOKED" && selectedReq.status !== "CANCELLED" && (
                            <button
                              disabled={actionLoading}
                              onClick={() => handleOpenEmergencyBooking(selectedReq)}
                              style={{
                                padding: "8px 14px",
                                background: "#FFF1F2",
                                color: "#BE123C",
                                border: "1px solid #FECDD3",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <AlertTriangle size={13} />
                              <span>Direct Booking (Exception Only)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SOURCING & QUOTATIONS WORKFLOW TRACEABILITY TAB         */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "sourcing" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {/* Top Sourcing Status Banner */}
                      <div
                        style={{
                          padding: "16px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                            Sourcing Status
                          </span>
                          {renderStatusBadge(selectedReq.status)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", textAlign: "center" }}>
                          <div style={{ padding: "10px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                              {sourcingData.vendorRequests.length}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Vendors Assigned</div>
                          </div>
                          <div style={{ padding: "10px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: "#047857" }}>
                              {sourcingData.vendorQuotes.length}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Quotes Received</div>
                          </div>
                          <div style={{ padding: "10px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: sourcingData.booking ? "#059669" : "#D97706" }}>
                              {sourcingData.booking ? "Booked" : sourcingData.clientQuotes.length > 0 ? "Quoted" : "Sourcing"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Deal Stage</div>
                          </div>
                        </div>

                        {selectedReq.status !== "BOOKED" && selectedReq.status !== "CANCELLED" && (
                          <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => handleOpenSourcingModal(selectedReq)}
                              style={{
                                padding: "7px 12px",
                                background: "#F45325",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <Plus size={13} />
                              <span>Assign Vendors for RFQ</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Assigned Vendors List */}
                      <div
                        style={{
                          padding: "16px",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px"
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", marginBottom: "12px" }}>
                          Assigned Sourcing Vendors & Feasibility
                        </div>

                        {sourcingData.vendorRequests.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "24px 12px", color: "#64748B", fontSize: "13px" }}>
                            No vendors assigned for sourcing yet. Click &ldquo;Assign Vendors for RFQ&rdquo; to invite eligible vendors.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {sourcingData.vendorRequests.map((vr) => {
                              const vendor = vr.vendor_companies || {};
                              const vQuotes = sourcingData.vendorQuotes.filter((q) => q.vendor_request_id === vr.id);
                              const latestQuote = vQuotes.length > 0 ? vQuotes[vQuotes.length - 1] : null;

                              return (
                                <div
                                  key={vr.id}
                                  style={{
                                    padding: "12px 14px",
                                    border: "1px solid #E2E8F0",
                                    borderRadius: "8px",
                                    background: vr.status === "SELECTED" ? "#F0FDF4" : "#F8FAFC"
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                                        {vendor.vendor_name || `Vendor #${vr.vendor_id?.slice(0, 8)}`}
                                      </div>
                                      <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                                        Code: {vendor.vendor_code || "—"} • PAN: {vendor.pan || "—"} • GST: {vendor.gstin || "—"}
                                      </div>
                                    </div>
                                    <span
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        background: vr.status === "QUOTED" ? "#DBEAFE" : vr.status === "SELECTED" ? "#D1FAE5" : "#FEF3C7",
                                        color: vr.status === "QUOTED" ? "#1D4ED8" : vr.status === "SELECTED" ? "#047857" : "#B45309",
                                        border: "1px solid rgba(0,0,0,0.06)"
                                      }}
                                    >
                                      {vr.status}
                                    </span>
                                  </div>

                                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569" }}>
                                    <div>
                                      <span>Deadline: </span>
                                      <strong>{formatDate(vr.deadline_at)}</strong>
                                    </div>
                                    {latestQuote ? (
                                      <div style={{ color: "#047857", fontWeight: 700 }}>
                                        Quote: ₹{Number(latestQuote.quoted_rate).toLocaleString("en-IN")}
                                        <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 400, marginLeft: "4px" }}>
                                          (v{latestQuote.version || 1})
                                        </span>
                                      </div>
                                    ) : (
                                      <div style={{ color: "#94A3B8", fontStyle: "italic" }}>
                                        Awaiting vendor quotation
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Client Quotation Section */}
                      <div
                        style={{
                          padding: "16px",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px"
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", marginBottom: "12px" }}>
                          TRUCKS Client Quotation
                        </div>

                        {sourcingData.clientQuotes.length === 0 ? (
                          <div style={{ fontSize: "13px", color: "#64748B" }}>
                            No separate TRUCKS client quotation generated yet. Once preferred vendor quote is selected, generate client quote via Pricing module.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {sourcingData.clientQuotes.map((cq) => (
                              <div
                                key={cq.id}
                                style={{
                                  padding: "12px 14px",
                                  background: "#F8FAFC",
                                  borderRadius: "8px",
                                  border: "1px solid #CBD5E1",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                                    Client Selling Total: ₹{Number(cq.total_client_amount || 0).toLocaleString("en-IN")}
                                  </div>
                                  <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                                    Vendor Cost: ₹{Number(cq.vendor_base_cost || 0).toLocaleString("en-IN")} • Margin: ₹{Number(cq.admin_margin || 0).toLocaleString("en-IN")} • GST: ₹{Number(cq.gst_amount || 0).toLocaleString("en-IN")}
                                  </div>
                                </div>
                                <span
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    background: cq.status === "ACCEPTED" ? "#D1FAE5" : cq.status === "REJECTED" ? "#FEE2E2" : "#FEF3C7",
                                    color: cq.status === "ACCEPTED" ? "#047857" : cq.status === "REJECTED" ? "#B91C1C" : "#B45309"
                                  }}
                                >
                                  {cq.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Confirmed Booking Reference */}
                      {sourcingData.booking && (
                        <div
                          style={{
                            padding: "16px",
                            background: "#ECFDF5",
                            border: "1px solid #A7F3D0",
                            borderRadius: "10px"
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: 800, color: "#065F46", textTransform: "uppercase", marginBottom: "8px" }}>
                            Confirmed Booking Reference
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                            <div>
                              <span style={{ color: "#047857" }}>Booking ID: </span>
                              <strong style={{ fontFamily: "monospace", color: "#0F172A" }}>{sourcingData.booking.id}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#047857" }}>Status: </span>
                              <strong>{sourcingData.booking.booking_status}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#047857" }}>Payment: </span>
                              <strong>{sourcingData.booking.payment_status}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#047857" }}>Confirmed Date: </span>
                              <strong>{formatDateTime(sourcingData.booking.confirmed_at)}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SECTION A: CLIENT INFORMATION                           */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "client" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div
                        style={{
                          padding: "16px",
                          background: "#F8FAFC",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "10px",
                              background: "#F45325",
                              color: "#FFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "16px"
                            }}
                          >
                            <Building2 size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                              {selectedReq.client_company?.company_name || "Client Account"}
                            </div>
                            <div style={{ fontSize: "12.5px", color: "#64748B", fontFamily: "monospace" }}>
                              Client ID: {selectedReq.client_company?.client_code || selectedReq.client_id}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "14px" }}>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Contact Person</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <User size={13} color="#F45325" />
                              <span>{clientContactUser?.full_name || "Designated Transport Manager"}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Phone / Mobile</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <Phone size={13} color="#10B981" />
                              <span>{clientContactUser?.mobile || "—"}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Email Address</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <Mail size={13} color="#3B82F6" />
                              <span>{clientContactUser?.email || "—"}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>GSTIN</div>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                              {selectedReq.client_company?.gstin || "—"}
                            </div>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: "11.5px", color: "#64748B" }}>Registered Billing Address</div>
                            <div style={{ fontSize: "13.5px", color: "#0F172A", marginTop: "2px" }}>
                              {selectedReq.client_company?.registered_address || "—"}
                              {selectedReq.client_company?.city && `, ${selectedReq.client_company.city}`}
                              {selectedReq.client_company?.pincode && ` - ${selectedReq.client_company.pincode}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SECTION C: PICKUP AND DELIVERY INFORMATION              */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "route" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div
                        style={{
                          padding: "18px",
                          background: "#FFFFFF",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: "16px" }}>
                          Full Route & Terminal Locations
                        </div>

                        {/* Pickup */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                          <MapPin size={20} color="#F45325" style={{ flexShrink: 0, marginTop: "2px" }} />
                          <div>
                            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#F45325", textTransform: "uppercase" }}>
                              Consignor Pickup Location
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                              {selectedReq.pickup_address}
                            </div>
                            {selectedReq.pickup_pincode && (
                              <div style={{ fontSize: "12.5px", color: "#64748B", marginTop: "2px" }}>
                                Postal PIN Code: {selectedReq.pickup_pincode}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ borderLeft: "2px dashed #CBD5E1", marginLeft: "10px", height: "24px" }} />

                        {/* Delivery */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "16px" }}>
                          <MapPin size={20} color="#1D4ED8" style={{ flexShrink: 0, marginTop: "2px" }} />
                          <div>
                            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>
                              Consignee Delivery Location
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
                              {selectedReq.destination_address}
                            </div>
                            {selectedReq.destination_pincode && (
                              <div style={{ fontSize: "12.5px", color: "#64748B", marginTop: "2px" }}>
                                Postal PIN Code: {selectedReq.destination_pincode}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#F8FAFC",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0"
                        }}
                      >
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                          Loading & Unloading Instructions
                        </div>
                        <div style={{ fontSize: "13px", color: "#334155" }}>
                          Standard TRUCKS consignor dock protocol. Weighment verification mandatory prior to freight dispatch.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SECTION D: DOCUMENTS                                     */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "documents" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {reqDocuments.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
                          <FileText size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                          <h4 style={{ margin: "0 0 4px", fontSize: "15px", color: "#0F172A", fontWeight: 700 }}>
                            No Documents Attached
                          </h4>
                          <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                            No cargo invoices, e-Way bills, or declarations uploaded for this requirement yet.
                          </p>
                        </div>
                      ) : (
                        reqDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              padding: "14px 16px",
                              background: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <FileCheck size={20} color="#F45325" />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0F172A" }}>
                                  {doc.document_type}
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748B" }}>
                                  {doc.file_name} • {doc.is_verified ? "Verified" : "Pending Verification"}
                                </div>
                              </div>
                            </div>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "6px 12px",
                                  background: "#F1F5F9",
                                  color: "#1E293B",
                                  borderRadius: "6px",
                                  textDecoration: "none",
                                  fontSize: "12px",
                                  fontWeight: 600
                                }}
                              >
                                View File
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* SECTION E: REQUIREMENT WORKFLOW HISTORY                  */}
                  {/* ======================================================== */}
                  {drawerActiveTab === "history" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {reqHistory.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                          No recorded history events found in audit registry.
                        </div>
                      ) : (
                        <div style={{ position: "relative", paddingLeft: "20px" }}>
                          {/* Continuous line */}
                          <div
                            style={{
                              position: "absolute",
                              left: "6px",
                              top: "10px",
                              bottom: "10px",
                              width: "2px",
                              background: "#E2E8F0"
                            }}
                          />
                          {reqHistory.map((h, i) => (
                            <div key={h.id || i} style={{ position: "relative", marginBottom: "18px" }}>
                              {/* Dot */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-18px",
                                  top: "4px",
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  background: h.badgeColor || "#F45325",
                                  border: "2px solid #FFFFFF",
                                  boxShadow: "0 0 0 1px #CBD5E1"
                                }}
                              />
                              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                                {h.title}
                              </div>
                              <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                                {h.description}
                              </div>
                              <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "3px" }}>
                                {formatDateTime(h.timestamp)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC"
              }}
            >
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  padding: "9px 18px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#64748B",
                  cursor: "pointer"
                }}
              >
                Close
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {selectedReq.status !== "BOOKED" && selectedReq.status !== "CANCELLED" && (
                  <button
                    onClick={(e) => handleOpenEmergencyBooking(selectedReq, e)}
                    style={{
                      padding: "8px 14px",
                      background: "#FFF1F2",
                      border: "1px solid #FECDD3",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#BE123C",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    title="Separately authorized exception: bypasses vendor quotation and client acceptance"
                  >
                    <AlertTriangle size={13} />
                    <span>Direct Booking (Exception)</span>
                  </button>
                )}

                {selectedReq.status !== "BOOKED" && selectedReq.status !== "CANCELLED" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleOpenSourcingModal(selectedReq)}
                    style={{
                      padding: "9px 18px",
                      background: "#F45325",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Send size={14} />
                    <span>Assign for Sourcing</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. EDIT REQUIREMENT MODAL (With MT / kg Dual Unit Support & Validation)   */}
      {/* ========================================================================= */}
      {editingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
          onClick={() => setEditingReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                  Edit Requirement {editingReq.id}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748B" }}>
                  Preserves original client-submitted specifications and validates units
                </span>
              </div>
              <button
                onClick={() => setEditingReq(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Vehicle Type Required
                </label>
                <input
                  type="text"
                  value={editFormData.vehicle_type}
                  onChange={(e) => setEditFormData({ ...editFormData, vehicle_type: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13.5px" }}
                />
              </div>

              {/* Capacity with MT / kg Unit Toggle */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                    Consignment Quantity & Capacity
                  </label>
                  <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: "6px", padding: "2px" }}>
                    <button
                      type="button"
                      onClick={() => handleUnitToggle("MT")}
                      style={{
                        padding: "3px 8px",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: editFormData.weight_unit === "MT" ? "#F45325" : "transparent",
                        color: editFormData.weight_unit === "MT" ? "#FFFFFF" : "#64748B"
                      }}
                    >
                      MT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitToggle("kg")}
                      style={{
                        padding: "3px 8px",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: editFormData.weight_unit === "kg" ? "#F45325" : "transparent",
                        color: editFormData.weight_unit === "kg" ? "#FFFFFF" : "#64748B"
                      }}
                    >
                      kg
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    step={editFormData.weight_unit === "kg" ? "1" : "0.01"}
                    value={editFormData.display_weight}
                    onChange={(e) => handleDisplayWeightChange(e.target.value)}
                    style={{ flex: 1, padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13.5px" }}
                  />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155", minWidth: "30px" }}>
                    {editFormData.weight_unit}
                  </span>
                </div>

                <div style={{ marginTop: "5px", padding: "6px 10px", background: "#F8FAFC", borderRadius: "6px", fontSize: "11.5px", color: "#64748B" }}>
                  Normalized Database Value: <strong>{editFormData.required_capacity_mt} MT</strong> ({Math.round(editFormData.required_capacity_mt * 1000)} kg)
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Required Pickup Date
                </label>
                <input
                  type="date"
                  value={editFormData.loading_datetime}
                  onChange={(e) => setEditFormData({ ...editFormData, loading_datetime: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13.5px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={editFormData.special_instructions}
                  onChange={(e) => setEditFormData({ ...editFormData, special_instructions: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13.5px", resize: "none" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setEditingReq(null)}
                style={{ padding: "8px 16px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontWeight: 600, color: "#64748B", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleSaveEdit}
                style={{ padding: "8px 18px", background: "#F45325", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. ASSIGN FOR SOURCING MODAL (Multi-Vendor Selection & Quotation Dispatch) */}
      {/* ========================================================================= */}
      {sourcingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
          onClick={() => setSourcingReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "640px",
              maxHeight: "90vh",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  Assign Vendors for Sourcing
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                  Requirement <strong style={{ fontFamily: "monospace", color: "#0F172A" }}>{sourcingReq.id}</strong> • Route: {sourcingReq.pickup_address} → {sourcingReq.destination_address}
                </p>
              </div>
              <button
                onClick={() => setSourcingReq(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sourcing Summary Card */}
            <div
              style={{
                padding: "12px 14px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                marginBottom: "16px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                fontSize: "12px"
              }}
            >
              <div>
                <span style={{ color: "#64748B" }}>Cargo: </span>
                <strong>{sourcingReq.cargo_description || sourcingReq.material_type || "General Cargo"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Capacity: </span>
                <strong>{sourcingReq.required_capacity_mt || 1} MT</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Vehicle Required: </span>
                <strong>{sourcingReq.vehicle_type}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Required Pickup: </span>
                <strong>{formatDate(sourcingReq.required_date)}</strong>
              </div>
            </div>

            {/* Deadline Date & Time Picker */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                Quotation Submission Deadline:
              </label>
              <input
                type="datetime-local"
                value={sourcingDeadline}
                onChange={(e) => setSourcingDeadline(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </div>

            {/* Vendor Selection List */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                Select Eligible Approved Vendors ({selectedVendorIdsForSourcing.size} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAllVendorsForSourcing}
                style={{
                  background: "none",
                  border: "none",
                  color: "#F45325",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {selectedVendorIdsForSourcing.size === availableVendors.length ? "Deselect All" : "Select All Approved"}
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                maxHeight: "260px"
              }}
            >
              {loadingVendors ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "13px" }}>Loading approved vendors...</p>
                </div>
              ) : availableVendors.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  No approved vendors found in directory. Please verify vendor approvals.
                </div>
              ) : (
                availableVendors.map((vendor) => {
                  const isAlreadyInvited = alreadyDispatchedVendorIds.has(vendor.id);
                  const isChecked = selectedVendorIdsForSourcing.has(vendor.id);
                  return (
                    <div
                      key={vendor.id}
                      onClick={() => !isAlreadyInvited && handleToggleVendorForSourcing(vendor.id)}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid #F1F5F9",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: isAlreadyInvited ? "not-allowed" : "pointer",
                        background: isAlreadyInvited ? "#F8FAFC" : isChecked ? "#FEF3EE" : "#FFFFFF",
                        opacity: isAlreadyInvited ? 0.75 : 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isAlreadyInvited}
                        onChange={() => !isAlreadyInvited && handleToggleVendorForSourcing(vendor.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: isAlreadyInvited ? "not-allowed" : "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: isAlreadyInvited ? "#64748B" : "#0F172A" }}>
                          {vendor.vendor_name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                          Code: {vendor.vendor_code || "—"} • PAN: {vendor.pan || "—"} • {vendor.address || "India"}
                        </div>
                      </div>
                      {isAlreadyInvited ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#E2E8F0",
                            color: "#475569"
                          }}
                        >
                          ALREADY INVITED
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#D1FAE5",
                            color: "#047857"
                          }}
                        >
                          VERIFIED
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setSourcingReq(null)}
                style={{
                  padding: "8px 16px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#64748B",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                disabled={sourcingLoading || selectedVendorIdsForSourcing.size === 0}
                onClick={handleDispatchSourcing}
                style={{
                  padding: "8px 20px",
                  background: selectedVendorIdsForSourcing.size === 0 ? "#CBD5E1" : "#F45325",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: selectedVendorIdsForSourcing.size === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Send size={13} />
                <span>{sourcingLoading ? "Dispatching..." : `Dispatch RFQ to ${selectedVendorIdsForSourcing.size} Vendor(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7b. CLIENT CORRECTIONS REQUEST MODAL                                      */}
      {/* ========================================================================= */}
      {correctionsModalReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
          onClick={() => setCorrectionsModalReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#991B1B" }}>
                  Request Client Revisions
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                  Requirement <strong>{correctionsModalReq.id}</strong> • {correctionsModalReq.origin} → {correctionsModalReq.destination}
                </p>
              </div>
              <button
                onClick={() => setCorrectionsModalReq(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                Specific Correction Details / Requested Clarifications:
              </label>
              <textarea
                value={correctionNotesInput}
                onChange={(e) => setCorrectionNotesInput(e.target.value)}
                placeholder="e.g. Please clarify exact packaging details and specify whether loading crane is available at Beltola warehouse..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              <p style={{ fontSize: "11.5px", color: "#64748B", margin: "4px 0 0" }}>
                The client will be notified in their mobile app to review and update these specific requirement details.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setCorrectionsModalReq(null)}
                style={{
                  padding: "8px 16px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#64748B",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !correctionNotesInput.trim()}
                onClick={handleConfirmRequestCorrections}
                style={{
                  padding: "8px 20px",
                  background: !correctionNotesInput.trim() ? "#CBD5E1" : "#DC2626",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: !correctionNotesInput.trim() ? "not-allowed" : "pointer"
                }}
              >
                {actionLoading ? "Saving..." : "Send Revision Request to Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. EMERGENCY DIRECT BOOKING EXCEPTION MODAL                              */}
      {/* ========================================================================= */}
      {emergencyBookingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
          onClick={() => setEmergencyBookingReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <ShieldAlert size={26} color="#BE123C" />
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#BE123C" }}>
                  Direct Booking Exception Process
                </h3>
                <span style={{ fontSize: "11.5px", color: "#64748B" }}>
                  Administrative Authorization Required
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                background: "#FFF1F2",
                border: "1px solid #FECDD3",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "12.5px",
                color: "#9F1239",
                lineHeight: 1.5
              }}
            >
              <strong>Policy Notice:</strong> Sourcing is the normal workflow. Direct confirmation must not bypass vendor quotations and client acceptance except for pre-contracted rate agreements or emergency dispatches.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Authorization Justification / Reason: <span style={{ color: "#BE123C" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the commercial or operational reason (e.g. Existing annual master contract #MC-2026, emergency replacement vehicle dispatched)..."
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "6px",
                    fontSize: "13px",
                    resize: "none"
                  }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#334155",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={emergencyAcknowledged}
                  onChange={(e) => setEmergencyAcknowledged(e.target.checked)}
                  style={{ marginTop: "2px" }}
                />
                <span>
                  I confirm that this direct booking is authorized under TRUCKS emergency exceptions and logs an audit record.
                </span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setEmergencyBookingReq(null)}
                style={{
                  padding: "8px 16px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#64748B",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !emergencyReason.trim() || !emergencyAcknowledged}
                onClick={handleConfirmEmergencyBooking}
                style={{
                  padding: "8px 18px",
                  background: (!emergencyReason.trim() || !emergencyAcknowledged) ? "#CBD5E1" : "#BE123C",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: (!emergencyReason.trim() || !emergencyAcknowledged) ? "not-allowed" : "pointer"
                }}
              >
                {actionLoading ? "Confirming..." : "Confirm Emergency Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CANCEL REQUIREMENT CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {cancellingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
          onClick={() => setCancellingReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <ShieldAlert size={24} color="#B91C1C" />
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                Cancel Transport Requirement?
              </h3>
            </div>
            <p style={{ fontSize: "13.5px", color: "#64748B", margin: "0 0 14px", lineHeight: 1.5 }}>
              Are you sure you want to cancel Requirement{" "}
              <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{cancellingReq.id}</strong>?
              This action will notify the client and close ongoing sourcing activity.
            </p>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                Reason for Cancellation (optional):
              </label>
              <input
                type="text"
                placeholder="e.g., Client requested cancellation, route unavailable..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13.5px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setCancellingReq(null)}
                style={{ padding: "8px 16px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", fontWeight: 600, color: "#64748B", cursor: "pointer" }}
              >
                Never Mind
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmCancel}
                style={{ padding: "8px 18px", background: "#B91C1C", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Actions Menu (Fixed Position to avoid table clipping) ── */}
      {reqMenuAnchor && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: reqMenuAnchor.top !== undefined ? `${reqMenuAnchor.top}px` : undefined,
            bottom: reqMenuAnchor.bottom !== undefined ? `${reqMenuAnchor.bottom}px` : undefined,
            right: `${reqMenuAnchor.right}px`,
            zIndex: 9999,
            width: "215px",
            background: "#FFFFFF",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
            border: "1px solid #E2E8F0",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}
        >
          {/* 1. View Full Details */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenDetail(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Eye size={14} color="#64748B" />
            <span>View Full Details</span>
          </button>

          {/* 2. Edit Requirement */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenEdit(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Edit3 size={14} color="#64748B" />
            <span>Edit Requirement</span>
          </button>

          {/* 3. Assign to Vendors */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenSourcingModal(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Users size={14} color="#64748B" />
            <span>Assign to Vendors</span>
          </button>

          {/* 4. View Vendor Responses */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenVendorResponses(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <FileText size={14} color="#64748B" />
            <span>View Vendor Responses</span>
          </button>

          {/* 5. View Status History */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenStatusHistory(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Clock size={14} color="#64748B" />
            <span>View Status History</span>
          </button>

          {/* Divider */}
          <div style={{ height: "1px", background: "#F1F5F9", margin: "4px 0" }} />

          {/* 6. Cancel Requirement */}
          <button
            onClick={() => {
              const r = reqMenuAnchor.req;
              setReqMenuAnchor(null);
              handleOpenCancel(r);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#EF4444",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Trash2 size={14} color="#EF4444" />
            <span>Cancel Requirement</span>
          </button>
        </div>
      )}

      {/* ── Vendor Responses Modal ── */}
      {vendorResponsesModalReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 10000
          }}
          onClick={() => setVendorResponsesModalReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "85vh",
              background: "#FFFFFF",
              borderRadius: "14px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                  Vendor Sourcing Responses & Quotations
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                  Requirement <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{vendorResponsesModalReq.id}</strong> • Route: {vendorResponsesModalReq.pickup_address} → {vendorResponsesModalReq.destination_address}
                </p>
              </div>
              <button
                onClick={() => setVendorResponsesModalReq(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {modalLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", color: "#64748B", gap: "10px" }}>
                  <Loader2 className="animate-spin" size={28} color="#F45325" />
                  <span>Loading vendor responses...</span>
                </div>
              ) : modalResponses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <Package size={44} color="#CBD5E1" style={{ marginBottom: "12px" }} />
                  <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                    No vendor responses recorded yet
                  </h4>
                  <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748B" }}>
                    No RFQs have been dispatched to vendors for this requirement yet, or vendors are still preparing their quotations.
                  </p>
                  <button
                    onClick={() => {
                      const r = vendorResponsesModalReq;
                      setVendorResponsesModalReq(null);
                      handleOpenSourcingModal(r);
                    }}
                    style={{
                      padding: "9px 18px",
                      background: "#F05A22",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    + Assign Vendors for Sourcing
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Summary Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11.5px", color: "#64748B", fontWeight: 600 }}>Total RFQs Dispatched</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>{modalResponses.length}</div>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE" }}>
                      <div style={{ fontSize: "11.5px", color: "#1D4ED8", fontWeight: 600 }}>Quotes Received</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#1D4ED8", marginTop: "2px" }}>
                        {modalResponses.filter((r) => r.latestQuote).length}
                      </div>
                    </div>
                    <div style={{ padding: "12px 14px", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
                      <div style={{ fontSize: "11.5px", color: "#15803D", fontWeight: 600 }}>Lowest Quote Rate</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#15803D", marginTop: "2px" }}>
                        {(() => {
                          const rates = modalResponses
                            .map((r) => r.latestQuote?.quoted_rate)
                            .filter((rate) => rate && Number(rate) > 0);
                          return rates.length > 0 ? `₹${Math.min(...rates).toLocaleString("en-IN")}` : "—";
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Vendors Table */}
                  <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B", fontSize: "11.5px" }}>
                          <th style={{ padding: "10px 14px", fontWeight: 700 }}>Vendor</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700 }}>Status</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700 }}>Deadline</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700 }}>Quoted Rate</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalResponses.map((vr) => {
                          const v = vr.vendor_companies || {};
                          const q = vr.latestQuote;
                          return (
                            <tr key={vr.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "12px 14px" }}>
                                <div style={{ fontWeight: 700, color: "#0F172A" }}>{v.vendor_name || "Vendor"}</div>
                                <div style={{ fontSize: "11px", color: "#64748B" }}>Code: {v.vendor_code || "—"} • GST: {v.gstin || "—"}</div>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    background: vr.status === "QUOTED" ? "#DBEAFE" : vr.status === "SELECTED" ? "#DCFCE7" : "#FEF3C7",
                                    color: vr.status === "QUOTED" ? "#1D4ED8" : vr.status === "SELECTED" ? "#15803D" : "#B45309"
                                  }}
                                >
                                  {vr.status}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#475569" }}>
                                {formatDate(vr.deadline_at)}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                {q ? (
                                  <div>
                                    <span style={{ fontWeight: 800, color: "#047857", fontSize: "13.5px" }}>
                                      ₹{Number(q.quoted_rate).toLocaleString("en-IN")}
                                    </span>
                                    <span style={{ fontSize: "11px", color: "#64748B", marginLeft: "4px" }}>
                                      (v{q.version || 1})
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Awaiting quotation</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                {q ? (
                                  <button
                                    onClick={() => {
                                      const r = vendorResponsesModalReq;
                                      setVendorResponsesModalReq(null);
                                      handleOpenDetail(r);
                                    }}
                                    style={{
                                      padding: "5px 10px",
                                      background: "#F05A22",
                                      color: "#FFFFFF",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "11.5px",
                                      fontWeight: 700,
                                      cursor: "pointer"
                                    }}
                                  >
                                    Review & Accept
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "11.5px", color: "#94A3B8" }}>Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC"
              }}
            >
              <button
                onClick={() => {
                  const r = vendorResponsesModalReq;
                  setVendorResponsesModalReq(null);
                  handleOpenSourcingModal(r);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer"
                }}
              >
                <Plus size={14} />
                <span>Dispatch Additional RFQ</span>
              </button>

              <button
                onClick={() => setVendorResponsesModalReq(null)}
                style={{
                  padding: "8px 18px",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status History Modal ── */}
      {statusHistoryModalReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 10000
          }}
          onClick={() => setStatusHistoryModalReq(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "640px",
              maxHeight: "85vh",
              background: "#FFFFFF",
              borderRadius: "14px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                  Requirement Status & Audit History
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                  Requirement <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{statusHistoryModalReq.id}</strong> • Current Status: <strong>{statusHistoryModalReq.status}</strong>
                </p>
              </div>
              <button
                onClick={() => setStatusHistoryModalReq(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Timeline */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {modalLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", color: "#64748B", gap: "10px" }}>
                  <Loader2 className="animate-spin" size={28} color="#F45325" />
                  <span>Loading audit timeline...</span>
                </div>
              ) : modalHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748B", fontSize: "13px" }}>
                  No historical status transitions recorded yet for this requirement.
                </div>
              ) : (
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                  {/* Timeline vertical bar */}
                  <div
                    style={{
                      position: "absolute",
                      left: "7px",
                      top: "10px",
                      bottom: "10px",
                      width: "2px",
                      background: "#E2E8F0"
                    }}
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {modalHistory.map((item) => (
                      <div key={item.id} style={{ position: "relative" }}>
                        {/* Dot */}
                        <div
                          style={{
                            position: "absolute",
                            left: "-24px",
                            top: "4px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: item.badgeColor || "#2563EB",
                            border: "3px solid #FFFFFF",
                            boxShadow: "0 0 0 1px #CBD5E1"
                          }}
                        />

                        {/* Event Content */}
                        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "13px" }}>
                              {item.title}
                            </div>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10.5px",
                                fontWeight: 700,
                                background: "#FFFFFF",
                                color: item.badgeColor || "#2563EB",
                                border: "1px solid #E2E8F0",
                                flexShrink: 0
                              }}
                            >
                              {item.type}
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px", lineHeight: 1.4 }}>
                            {item.description}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>
                            <Clock size={11} />
                            <span>{formatDateTime(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "flex-end",
                background: "#F8FAFC"
              }}
            >
              <button
                onClick={() => setStatusHistoryModalReq(null)}
                style={{
                  padding: "8px 18px",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
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
