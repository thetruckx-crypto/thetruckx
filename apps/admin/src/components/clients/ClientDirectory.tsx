import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search, Plus, Eye, Edit2, MoreVertical, ChevronLeft, ChevronRight,
  Download, Upload, X, CheckCircle, AlertCircle, Users,
  UserCheck, UserMinus, Phone, Mail, MapPin, Building2,
  Clock, ShieldCheck, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, FileText, ExternalLink, Copy, Check, Filter, AlertTriangle, Activity
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { DocumentPreviewModal } from "../common/DocumentPreviewModal";
import { EditClientModal } from "./EditClientModal";

export interface Client {
  id: string;
  client_code?: string;
  company_name: string;
  gstin: string | null;
  pan: string | null;
  registered_address: string;
  city: string;
  pincode: string;
  status: "PENDING_APPROVAL" | "PENDING" | "APPROVED" | "REJECTED" | "CORRECTIONS_REQUESTED" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
  client_type?: string;
  business_type?: string;
  industry_type?: string;
  company_phone?: string;
  company_email?: string;
  primary_contact_name?: string;
  primary_contact_designation?: string;
  primary_contact_phone?: string;
  primary_contact_email?: string;
  kyc_status?: "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
  docs_count?: { total: number; verified: number; rejected: number; pending: number };
  documents_list?: Array<{
    id: string;
    document_type: string;
    file_name: string;
    file_url: string;
    storage_path?: string;
    verification_status: string;
    rejection_reason?: string;
    created_at?: string;
    file_size?: string;
  }>;
  rejection_reason?: string;
  submitted_at?: string;
  active_requirements?: number;
  completed_bookings?: number;
  website?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
}

interface ClientDirectoryProps {
  onNavigateToCreate: () => void;
  onNavigateToProfile: (clientId: string) => void;
}

interface ParsedImportRow {
  rowNum: number;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  pincode: string;
  gstin: string;
  entityType: string;
  isValid: boolean;
  errors: string[];
}

const DEFAULT_CITIES = [
  "Guwahati", "Kolkata", "Delhi", "Mumbai", "Hyderabad",
  "Bengaluru", "Chennai", "Dispur", "Siliguri", "Dibrugarh", "Jorhat"
];

const ENTITY_TYPES = [
  "Private Limited", "Partnership", "Proprietorship",
  "Public Limited", "LLP", "Manufacturer", "Trader", "Distributor"
];

function getAvatarColor(name: string) {
  const colors = [
    "#F05A22", "#3B82F6", "#10B981", "#8B5CF6",
    "#F59E0B", "#06B6D4", "#EC4899", "#6366F1"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

import { formatDisplayId, isValidNeclId } from "../../utils/idGenerator";

function formatClientId(id: string, createdAt?: string, code?: string) {
  if (code && isValidNeclId(code, "CL")) return code;
  if (code && code.startsWith("CLI-")) return code;
  if (id && isValidNeclId(id, "CL")) return id;
  if (id && id.startsWith("CLI-")) return id;
  return formatDisplayId("CL", code || id, createdAt);
}

export function resolveClientDocumentType(doc: {
  document_type?: string;
  file_name?: string;
  storage_path?: string;
  file_url?: string;
}) {
  const fileName = doc.file_name || "";
  const storagePath = (doc.storage_path || doc.file_url || "").toLowerCase();

  let key: "GST_CERTIFICATE" | "COMPANY_PAN" | "INCORPORATION_PROOF" | "MSME_UDYAM" | "OTHER" = "OTHER";
  let cleanName = fileName;

  if (fileName.includes(":")) {
    const [prefix, ...rest] = fileName.split(":");
    const pTrim = prefix.trim().toUpperCase();
    if (pTrim === "GST_CERTIFICATE") key = "GST_CERTIFICATE";
    else if (pTrim === "COMPANY_PAN") key = "COMPANY_PAN";
    else if (pTrim === "INCORPORATION_PROOF") key = "INCORPORATION_PROOF";
    else if (pTrim === "MSME_UDYAM") key = "MSME_UDYAM";
    cleanName = rest.join(":").trim();
  }

  if (key === "OTHER") {
    if (storagePath.includes("gst") || fileName.toLowerCase().includes("gst")) key = "GST_CERTIFICATE";
    else if (storagePath.includes("pan") || fileName.toLowerCase().includes("pan")) key = "COMPANY_PAN";
    else if (storagePath.includes("incorporation") || fileName.toLowerCase().includes("incorporation")) key = "INCORPORATION_PROOF";
    else if (storagePath.includes("msme") || storagePath.includes("udyam") || fileName.toLowerCase().includes("msme") || fileName.toLowerCase().includes("udyam")) key = "MSME_UDYAM";
  }

  const labelMap = {
    GST_CERTIFICATE: "GST Registration Certificate",
    COMPANY_PAN: "Company PAN Card",
    INCORPORATION_PROOF: "Certificate of Incorporation",
    MSME_UDYAM: "MSME / Udyam Registration",
    OTHER: "Commercial Verification Document"
  };

  return {
    key,
    label: labelMap[key],
    cleanFileName: cleanName || fileName || "document.pdf"
  };
}

export function checkClientApprovalEligibility(docs?: any[]) {
  const mandatoryKeys = ["GST_CERTIFICATE", "COMPANY_PAN", "INCORPORATION_PROOF"];
  const list = docs || [];

  const foundTypes = new Map<string, any>();
  const rejectedDocs: string[] = [];

  list.forEach((doc) => {
    const resolved = resolveClientDocumentType(doc);
    foundTypes.set(resolved.key, doc);
    if (doc.verification_status === "REJECTED" || doc.verification_status === "REPLACEMENT_REQUESTED") {
      rejectedDocs.push(resolved.label);
    }
  });

  const missingMandatory: string[] = [];
  const pendingMandatory: string[] = [];

  const keyLabels: Record<string, string> = {
    GST_CERTIFICATE: "GST Registration Certificate",
    COMPANY_PAN: "Company PAN Card",
    INCORPORATION_PROOF: "Certificate of Incorporation"
  };

  mandatoryKeys.forEach((key) => {
    const doc = foundTypes.get(key);
    if (!doc) {
      missingMandatory.push(keyLabels[key]);
    } else if (doc.verification_status !== "VERIFIED" && doc.verification_status !== "APPROVED") {
      pendingMandatory.push(keyLabels[key]);
    }
  });

  const isEligible = list.length > 0 && missingMandatory.length === 0 && pendingMandatory.length === 0 && rejectedDocs.length === 0;

  const reasons: string[] = [];
  if (list.length === 0) reasons.push("No compliance documents uploaded");
  if (missingMandatory.length > 0) reasons.push(`Missing: ${missingMandatory.join(", ")}`);
  if (pendingMandatory.length > 0) reasons.push(`Pending verification: ${pendingMandatory.join(", ")}`);
  if (rejectedDocs.length > 0) reasons.push(`Rejected: ${rejectedDocs.join(", ")}`);

  return {
    isEligible,
    missingMandatory,
    pendingMandatory,
    rejectedDocs,
    summaryMessage: reasons.join(" • ")
  };
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({
  onNavigateToCreate,
  onNavigateToProfile,
}) => {
  const { hasPermission, adminProfile } = useAuth();

  // Permissions checks
  const canCreate = hasPermission("clients", "create");
  const canApprove = hasPermission("clients", "approve");
  const canReject = hasPermission("clients", "reject");
  const canSuspend = hasPermission("clients", "suspend");
  const canExport = hasPermission("clients", "export");

  // Real data state
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exact KPI counts from database
  const [dbKpis, setDbKpis] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  const [sortField, setSortField] = useState<"company_name" | "created_at" | "city" | "status">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selection & Details Drawer
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Action states & Modals
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top?: number;
    bottom?: number;
    right: number;
    isDropup: boolean;
  } | null>(null);
  const [copiedGstId, setCopiedGstId] = useState<string | null>(null);

  const handleToggleActionMenu = (client: Client, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor?.id === client.id) {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isDropup = spaceBelow < menuHeight + 20;

    setOpenActionMenuId(client.id);
    setMenuAnchor({
      id: client.id,
      top: isDropup ? undefined : rect.bottom + 6,
      bottom: isDropup ? (window.innerHeight - rect.top + 6) : undefined,
      right: Math.max(16, window.innerWidth - rect.right),
      isDropup,
    });
  };

  useEffect(() => {
    if (!menuAnchor) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".client-actions-dropdown") || target.closest(".row-action-btn-circle")) {
        return;
      }
      setMenuAnchor(null);
      setOpenActionMenuId(null);
    };
    const handleScroll = () => {
      setMenuAnchor(null);
      setOpenActionMenuId(null);
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuAnchor]);

  // Decision Modals
  const [reviewingClient, setReviewingClient] = useState<Client | null>(null);
  const [approvalModalClient, setApprovalModalClient] = useState<Client | null>(null);
  const [rejectModalClient, setRejectModalClient] = useState<Client | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [rejectionInputError, setRejectionInputError] = useState<string | null>(null);
  const [confirmStatusClient, setConfirmStatusClient] = useState<Client | null>(null);

  // Document Preview & Individual Verification States
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [rejectDocTarget, setRejectDocTarget] = useState<any | null>(null);
  const [docRejectReason, setDocRejectReason] = useState<string>("");
  const [docRejectError, setDocRejectError] = useState<string | null>(null);

  // Bulk Decision Modals
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);

  // Table horizontal scrolling (drag-to-scroll & shift/wheel gesture handling)
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // If user holds Shift, or horizontal delta is greater than vertical (touchpad horizontal swipe)
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        el.scrollLeft += (e.deltaX || e.deltaY);
      }
      // Pure vertical wheel without Shift: Do NOT prevent default!
      // This allows the page's main vertical scrollbar on .dashboard-content-area to scroll naturally!
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest(".client-actions-dropdown") ||
      target.closest(".more-menu-wrap")
    ) {
      return;
    }

    if (tableContainerRef.current) {
      isDraggingRef.current = true;
      setIsDragging(true);
      startXRef.current = e.pageX - tableContainerRef.current.offsetLeft;
      scrollLeftRef.current = tableContainerRef.current.scrollLeft;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");
  const [bulkRejectionError, setBulkRejectionError] = useState<string | null>(null);

  // Quick Edit Modal
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    company_name: "",
    primary_contact_name: "",
    primary_contact_phone: "",
    primary_contact_email: "",
    city: "",
    registered_address: "",
    gstin: "",
    client_type: "Private Limited",
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close action menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".more-menu-wrap")) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch real statistics from database
  const fetchRealStats = useCallback(async () => {
    try {
      const [allRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabase.from("client_companies").select("id", { count: "exact", head: true }),
        supabase.from("client_companies").select("id", { count: "exact", head: true }).or("status.eq.PENDING_APPROVAL,status.eq.INACTIVE,status.eq.PENDING"),
        supabase.from("client_companies").select("id", { count: "exact", head: true }).or("status.eq.APPROVED,status.eq.ACTIVE"),
        supabase.from("client_companies").select("id", { count: "exact", head: true }).or("status.eq.REJECTED,status.eq.SUSPENDED"),
      ]);

      setDbKpis({
        total: allRes.count || 0,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
      });
    } catch (err: any) {
      console.error("Error fetching real client stats:", err.message);
    }
  }, []);

  // Fetch real clients list from connected database
  const fetchRealClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("client_companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter === "PENDING_APPROVAL") {
        query = query.or("status.eq.PENDING_APPROVAL,status.eq.INACTIVE,status.eq.PENDING");
      } else if (statusFilter === "APPROVED") {
        query = query.or("status.eq.APPROVED,status.eq.ACTIVE");
      } else if (statusFilter === "REJECTED") {
        query = query.or("status.eq.REJECTED,status.eq.SUSPENDED");
      }

      if (cityFilter !== "ALL") {
        query = query.eq("city", cityFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(
          `company_name.ilike.%${q}%,gstin.ilike.%${q}%,city.ilike.%${q}%,client_code.ilike.%${q}%`
        );
      }

      const { data: companies, error: cErr } = await query;
      if (cErr) throw cErr;

      if (!companies || companies.length === 0) {
        setClients([]);
        return;
      }

      const companyIds = companies.map((c) => c.id);

      // Primary users
      const { data: users } = await supabase
        .from("client_users")
        .select("*")
        .in("client_id", companyIds);

      const userMap = new Map<string, any>();
      (users || []).forEach((u) => {
        if (!userMap.has(u.client_id)) {
          userMap.set(u.client_id, u);
        }
      });

      // Verification Documents
      const { data: docs } = await supabase
        .from("documents")
        .select("id, reference_id, verification_status, document_type, file_name, file_url, storage_path, rejection_reason, created_at, file_size")
        .in("reference_id", companyIds);

      const docMap = new Map<string, { total: number; verified: number; rejected: number; pending: number }>();
      const docListMap = new Map<string, any[]>();
      (docs || []).forEach((d) => {
        const refId = d.reference_id;
        const entry = docMap.get(refId) || { total: 0, verified: 0, rejected: 0, pending: 0 };
        entry.total += 1;
        if (d.verification_status === "VERIFIED" || d.verification_status === "APPROVED") entry.verified += 1;
        else if (d.verification_status === "REJECTED") entry.rejected += 1;
        else entry.pending += 1;
        docMap.set(refId, entry);

        const list = docListMap.get(refId) || [];
        list.push(d);
        docListMap.set(refId, list);
      });

      // Requirements counts
      const { data: reqs } = await supabase
        .from("requirements")
        .select("id, client_id, status")
        .in("client_id", companyIds);

      const reqCountMap = new Map<string, number>();
      (reqs || []).forEach((r) => {
        const count = reqCountMap.get(r.client_id) || 0;
        reqCountMap.set(r.client_id, count + 1);
      });

      // Bookings counts
      const { data: boks } = await supabase
        .from("bookings")
        .select("id, client_id, booking_status")
        .in("client_id", companyIds);

      const bokCountMap = new Map<string, number>();
      (boks || []).forEach((b) => {
        const count = bokCountMap.get(b.client_id) || 0;
        bokCountMap.set(b.client_id, count + 1);
      });

      // Assemble enriched real client records
      const enriched: Client[] = companies.map((c) => {
        const primaryUser = userMap.get(c.id);
        const reqCount = reqCountMap.get(c.id) || 0;
        const bokCount = bokCountMap.get(c.id) || 0;
        const docCounts = docMap.get(c.id) || { total: 0, verified: 0, rejected: 0, pending: 0 };

        // Separate KYC status calculation
        let kycStatus: "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" = "NOT_SUBMITTED";
        if (docCounts.total > 0) {
          if (docCounts.rejected > 0) kycStatus = "REJECTED";
          else if (docCounts.verified === docCounts.total) kycStatus = "VERIFIED";
          else if (docCounts.verified > 0) kycStatus = "UNDER_REVIEW";
          else kycStatus = "SUBMITTED";
        }

        return {
          id: c.id,
          client_code: c.client_code,
          company_name: c.company_name,
          gstin: c.gstin || null,
          pan: c.pan || null,
          registered_address: c.registered_address,
          city: c.city,
          pincode: c.pincode,
          status: c.status as any,
          created_at: c.created_at,
          updated_at: c.updated_at,
          client_type: c.business_type || c.client_type || "Private Limited",
          business_type: c.business_type,
          industry_type: c.industry_type,
          company_phone: c.company_phone || (primaryUser?.mobile ? `+91 ${primaryUser.mobile}` : undefined),
          company_email: c.company_email || primaryUser?.email || undefined,
          primary_contact_name: primaryUser?.full_name || undefined,
          primary_contact_designation: primaryUser?.designation || "Authorized Contact",
          primary_contact_phone: primaryUser?.mobile ? `+91 ${primaryUser.mobile}` : undefined,
          primary_contact_email: primaryUser?.email || undefined,
          kyc_status: kycStatus,
          docs_count: docCounts,
          documents_list: docListMap.get(c.id) || [],
          rejection_reason: c.rejection_reason,
          submitted_at: c.submitted_at || c.created_at,
          active_requirements: reqCount,
          completed_bookings: bokCount,
          approved_by: c.approved_by,
          approved_at: c.approved_at,
          rejected_by: c.rejected_by,
          rejected_at: c.rejected_at,
        };
      });

      setClients(enriched);
    } catch (err: any) {
      console.warn("Database query error:", err);
      setError("Failed to load client records from the database. Please check your connection and try again.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, searchQuery]);

  // Initial load & real-time subscription
  useEffect(() => {
    fetchRealStats();
    fetchRealClients();

    const channel = supabase
      .channel("client_management_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_companies" }, () => {
        fetchRealStats();
        fetchRealClients();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "client_users" }, () => {
        fetchRealClients();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        fetchRealClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRealStats, fetchRealClients]);

  // Available cities & entity types
  const availableCities = useMemo(() => {
    const set = new Set<string>(DEFAULT_CITIES);
    clients.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set).sort();
  }, [clients]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>(ENTITY_TYPES);
    clients.forEach((c) => {
      if (c.client_type) set.add(c.client_type);
    });
    return Array.from(set).sort();
  }, [clients]);

  // Tab filtering & sorting
  const filteredAndSortedClients = useMemo(() => {
    const filtered = clients.filter((c) => {
      const st = (c.status || "").toUpperCase();
      if (activeTab === "PENDING_APPROVAL") {
        if (st !== "PENDING_APPROVAL" && st !== "INACTIVE" && st !== "PENDING") return false;
      } else if (activeTab === "APPROVED") {
        if (st !== "APPROVED" && st !== "ACTIVE") return false;
      } else if (activeTab === "REJECTED") {
        if (st !== "REJECTED" && st !== "SUSPENDED") return false;
      }
      if (typeFilter !== "ALL" && c.client_type?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortField === "company_name") {
        aVal = a.company_name.toLowerCase();
        bVal = b.company_name.toLowerCase();
      } else if (sortField === "created_at") {
        aVal = a.created_at;
        bVal = b.created_at;
      } else if (sortField === "city") {
        aVal = (a.city || "").toLowerCase();
        bVal = (b.city || "").toLowerCase();
      } else if (sortField === "status") {
        aVal = a.status;
        bVal = b.status;
      }
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [clients, activeTab, typeFilter, sortField, sortOrder]);

  // Active selected client for drawer
  const activeSelectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Pagination
  const totalCount = filteredAndSortedClients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedClients = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredAndSortedClients.slice(from, from + pageSize);
  }, [filteredAndSortedClients, page, pageSize]);

  // Sorting toggle
  const handleSort = (field: "company_name" | "created_at" | "city" | "status") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(paginatedClients.map((c) => c.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy GST to clipboard
  const handleCopyGst = (gst: string, clientId: string) => {
    navigator.clipboard.writeText(gst);
    setCopiedGstId(clientId);
    setTimeout(() => setCopiedGstId(null), 2000);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCityFilter("ALL");
    setTypeFilter("ALL");
    setActiveTab("ALL");
    setSortField("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  // Export filtered clients to CSV
  const handleExportCSV = (recordsToExport = filteredAndSortedClients) => {
    if (recordsToExport.length === 0) {
      setToastMessage("No client records available to export.");
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const headers = [
      "Client ID", "Company Name", "Contact Person", "Verified Phone",
      "Email", "City", "Entity Type", "Submission Date", "KYC Status",
      "Registration Status", "GSTIN", "PAN", "Address"
    ];

    const rows = recordsToExport.map((c) => [
      `"${formatClientId(c.id, c.created_at, c.client_code)}"`,
      `"${(c.company_name || "").replace(/"/g, '""')}"`,
      `"${(c.primary_contact_name || "—").replace(/"/g, '""')}"`,
      `"${c.primary_contact_phone || "—"}"`,
      `"${c.company_email || c.primary_contact_email || "—"}"`,
      `"${c.city || "—"}"`,
      `"${c.client_type || "Private Limited"}"`,
      `"${c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "—"}"`,
      `"${c.kyc_status || "NOT_SUBMITTED"}"`,
      `"${c.status}"`,
      `"${c.gstin || "—"}"`,
      `"${c.pan || "—"}"`,
      `"${(c.registered_address || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NECL_Client_Management_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage(`Exported ${recordsToExport.length} client record(s) to CSV successfully.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Export selected rows
  const handleExportSelected = () => {
    const selectedClients = clients.filter((c) => selectedRows.has(c.id));
    handleExportCSV(selectedClients);
  };

  // Download Sample CSV Template
  const handleDownloadSampleTemplate = () => {
    const headers = ["Company Name", "Contact Person", "Phone", "Email", "City", "Address", "Pincode", "GSTIN", "Entity Type"];
    const sampleRows = [
      ["Assam Petrochemicals Ltd", "Pranab Sarma", "9876543210", "pranab@assampetro.in", "Guwahati", "GS Road Industrial Zone", "781005", "18AABCA1234F1Z1", "Private Limited"],
      ["Brahmaputra Valley Logistics", "Sunil Gogoi", "9876543211", "sunil@bvlogistics.com", "Siliguri", "Sevoke Road Cargo Complex", "734001", "19AABCP5678Q1Z2", "Private Limited"],
      ["Kolkata Tea Exporters", "Amitabha Roy", "9876543212", "contact@kolkatatea.in", "Kolkata", "Strand Road Warehouse 4", "700001", "19AAACH9876R1Z5", "Partnership"]
    ];

    const csv = "\uFEFF" + [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "NECL_Client_Import_Template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV File on upload
  const handleFileSelect = (file: File) => {
    setImportFile(file);
    setImportParsing(true);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("Uploaded file is empty");

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error("File must contain a header row and at least one client record");
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === "," && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const rows: ParsedImportRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          if (cells.length < 3) continue;

          const companyName = cells[0] || "";
          const contactPerson = cells[1] || "";
          const phone = (cells[2] || "").replace(/\D/g, "");
          const email = cells[3] || "";
          const city = cells[4] || "Guwahati";
          const address = cells[5] || "";
          const pincode = cells[6] || "781001";
          const gstin = cells[7] || "";
          const entityType = cells[8] || "Private Limited";

          const errors: string[] = [];
          if (!companyName || companyName.length < 2) errors.push("Company name is required");
          if (!contactPerson || contactPerson.length < 2) errors.push("Contact person is required");
          if (!phone || phone.length < 10) errors.push("Valid 10-digit mobile number required");
          if (!address || address.length < 3) errors.push("Registered address is required");

          rows.push({
            rowNum: i,
            companyName,
            contactPerson,
            phone: phone.slice(-10),
            email,
            city,
            address,
            pincode,
            gstin,
            entityType,
            isValid: errors.length === 0,
            errors,
          });
        }

        setParsedRows(rows);
      } catch (err: any) {
        setImportError(err.message || "Failed to parse CSV file");
        setParsedRows([]);
      } finally {
        setImportParsing(false);
      }
    };
    reader.readAsText(file);
  };

  // Execute CSV Import into Database
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setImportError("No valid rows found to import");
      return;
    }

    setImportSubmitting(true);
    setImportError(null);

    try {
      let importedCount = 0;
      for (const row of validRows) {
        const { data: comp, error: cErr } = await supabase
          .from("client_companies")
          .insert({
            company_name: row.companyName,
            registered_address: row.address,
            city: row.city,
            pincode: row.pincode,
            gstin: row.gstin || null,
            status: "PENDING_APPROVAL",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (cErr) throw cErr;

        if (comp?.id) {
          await supabase.from("client_users").insert({
            client_id: comp.id,
            full_name: row.contactPerson,
            mobile: row.phone,
            email: row.email || null,
            status: "ACTIVE",
            created_at: new Date().toISOString(),
          });
          importedCount++;
        }
      }

      setToastMessage(`Successfully imported ${importedCount} client(s) into database!`);
      setTimeout(() => setToastMessage(null), 4000);

      setShowImportModal(false);
      setImportFile(null);
      setParsedRows([]);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setImportError(err.message || "Failed to import clients into database.");
    } finally {
      setImportSubmitting(false);
    }
  };

  // Approve Client Action (Guarded by Mandatory Document Verification)
  const handleApproveClient = async (client: Client) => {
    const eligibility = checkClientApprovalEligibility(client.documents_list);
    if (!eligibility.isEligible) {
      setError(`Cannot approve registration: All mandatory compliance documents must be individually verified first (${eligibility.summaryMessage}).`);
      setReviewingClient(client);
      setApprovalModalClient(null);
      return;
    }

    setActionLoading(true);
    try {
      // 1. Notify Backend API
      try {
        await apiFetch("/client/admin-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: client.id,
            mobile: client.primary_contact_phone?.replace(/[^0-9]/g, "").slice(-10),
            decision: "APPROVED",
            reviewerName: adminProfile?.name || "NECL Admin Compliance Desk",
          }),
        });
      } catch (apiErr) {
        console.warn("Backend API dispatch notice:", apiErr);
      }

      // 2. Direct Supabase Update
      const { error: upErr } = await supabase
        .from("client_companies")
        .update({
          status: "APPROVED",
          approved_at: new Date().toISOString(),
          approved_by: adminProfile?.name || "NECL Admin Compliance Desk",
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (upErr) throw upErr;

      await supabase
        .from("client_users")
        .update({ status: "ACTIVE" })
        .eq("client_id", client.id);

      setToastMessage(`Client "${client.company_name}" APPROVED! Dashboard access granted.`);
      setTimeout(() => setToastMessage(null), 4000);

      setApprovalModalClient(null);
      setReviewingClient(null);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to approve client registration.");
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Single Document Action
  const handleVerifySingleDocument = async (doc: any) => {
    try {
      setActionLoading(true);
      const { error: updErr } = await supabase
        .from("documents")
        .update({
          verification_status: "VERIFIED",
          rejection_reason: null,
          verified_by: adminProfile?.name || "NECL Admin Compliance Desk",
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updErr) throw updErr;

      try {
        await supabase.from("auth_audit_log").insert([
          {
            user_id: adminProfile?.id || "admin",
            user_type: "ADMIN",
            event_type: "CLIENT_DOCUMENT_VERIFIED",
            details: {
              documentId: doc.id,
              documentType: doc.document_type,
              fileName: doc.file_name,
              clientId: doc.reference_id,
            },
          },
        ]);
      } catch {}

      const resolved = resolveClientDocumentType(doc);
      setToastMessage(`"${resolved.label}" verified successfully.`);
      setTimeout(() => setToastMessage(null), 3000);

      if (reviewingClient) {
        const updatedList = (reviewingClient.documents_list || []).map((d) =>
          d.id === doc.id
            ? { ...d, verification_status: "VERIFIED", rejection_reason: undefined, verified_at: new Date().toISOString() }
            : d
        );
        setReviewingClient({
          ...reviewingClient,
          documents_list: updatedList,
        });
      }

      if (previewDoc && previewDoc.id === doc.id) {
        setPreviewDoc({
          ...previewDoc,
          verification_status: "VERIFIED",
          rejection_reason: null,
        });
      }

      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to verify document.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Single Document with Mandatory Reason & Client Re-upload Request
  const handleRejectSingleDocument = async (doc: any, reason: string) => {
    if (!reason || reason.trim().length < 3) {
      setDocRejectError("Please enter a valid rejection reason explaining what needs correction.");
      return;
    }
    setActionLoading(true);
    setDocRejectError(null);
    try {
      const { error: updErr } = await supabase
        .from("documents")
        .update({
          verification_status: "REJECTED",
          rejection_reason: reason.trim(),
          verified_by: adminProfile?.name || "NECL Admin Compliance Desk",
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updErr) throw updErr;

      // Update client company to notify mobile app of required document replacement
      const resolved = resolveClientDocumentType(doc);
      await supabase
        .from("client_companies")
        .update({
          status: "CORRECTIONS_REQUESTED",
          correction_notes: `Document replacement required: ${resolved.label} — ${reason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.reference_id);

      try {
        await supabase.from("auth_audit_log").insert([
          {
            user_id: adminProfile?.id || "admin",
            user_type: "ADMIN",
            event_type: "CLIENT_DOCUMENT_REJECTED",
            details: {
              documentId: doc.id,
              documentType: doc.document_type,
              fileName: doc.file_name,
              clientId: doc.reference_id,
              reason: reason.trim(),
            },
          },
        ]);
      } catch {}

      setToastMessage(`"${resolved.label}" rejected. Replacement requested from client.`);
      setTimeout(() => setToastMessage(null), 3500);

      if (reviewingClient) {
        const updatedList = (reviewingClient.documents_list || []).map((d) =>
          d.id === doc.id
            ? { ...d, verification_status: "REJECTED", rejection_reason: reason.trim() }
            : d
        );
        setReviewingClient({
          ...reviewingClient,
          documents_list: updatedList,
        });
      }

      if (previewDoc && previewDoc.id === doc.id) {
        setPreviewDoc({
          ...previewDoc,
          verification_status: "REJECTED",
          rejection_reason: reason.trim(),
        });
      }

      setRejectDocTarget(null);
      setDocRejectReason("");
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setDocRejectError(err.message || "Failed to reject document.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Client Action with Mandatory Reason
  const handleRejectClient = async (client: Client, reason: string) => {
    if (!reason || reason.trim().length < 3) {
      setRejectionInputError("Please enter a valid rejection reason explaining what failed compliance verification.");
      return;
    }
    setActionLoading(true);
    setRejectionInputError(null);
    try {
      try {
        await apiFetch("/client/admin-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: client.id,
            mobile: client.primary_contact_phone?.replace(/[^0-9]/g, "").slice(-10),
            decision: "REJECTED",
            reason: reason.trim(),
            reviewerName: adminProfile?.name || "NECL Admin Compliance Desk",
          }),
        });
      } catch (apiErr) {
        console.warn("Backend API dispatch notice:", apiErr);
      }

      const { error: upErr } = await supabase
        .from("client_companies")
        .update({
          status: "REJECTED",
          rejection_reason: reason.trim(),
          rejected_at: new Date().toISOString(),
          rejected_by: adminProfile?.name || "NECL Admin Compliance Desk",
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (upErr) throw upErr;

      await supabase
        .from("client_users")
        .update({ status: "REJECTED" })
        .eq("client_id", client.id);

      setToastMessage(`Client "${client.company_name}" rejected. Reason recorded in database.`);
      setTimeout(() => setToastMessage(null), 4000);

      setRejectModalClient(null);
      setRejectionReasonInput("");
      setReviewingClient(null);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to reject client registration.");
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Approve Action
  const handleBulkApprove = async () => {
    setActionLoading(true);
    try {
      const selectedIds = Array.from(selectedRows);
      const { error: upErr } = await supabase
        .from("client_companies")
        .update({
          status: "APPROVED",
          approved_at: new Date().toISOString(),
          approved_by: adminProfile?.name || "NECL Admin Compliance Desk",
          updated_at: new Date().toISOString(),
        })
        .in("id", selectedIds);

      if (upErr) throw upErr;

      await supabase
        .from("client_users")
        .update({ status: "ACTIVE" })
        .in("client_id", selectedIds);

      setToastMessage(`Successfully approved ${selectedIds.length} client(s) in bulk!`);
      setTimeout(() => setToastMessage(null), 4000);

      setSelectedRows(new Set());
      setShowBulkApproveModal(false);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to execute bulk approval.");
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Reject Action
  const handleBulkReject = async () => {
    if (!bulkRejectionReason || bulkRejectionReason.trim().length < 3) {
      setBulkRejectionError("Please enter a valid rejection reason.");
      return;
    }
    setActionLoading(true);
    setBulkRejectionError(null);
    try {
      const selectedIds = Array.from(selectedRows);
      const { error: upErr } = await supabase
        .from("client_companies")
        .update({
          status: "REJECTED",
          rejection_reason: bulkRejectionReason.trim(),
          rejected_at: new Date().toISOString(),
          rejected_by: adminProfile?.name || "NECL Admin Compliance Desk",
          updated_at: new Date().toISOString(),
        })
        .in("id", selectedIds);

      if (upErr) throw upErr;

      await supabase
        .from("client_users")
        .update({ status: "REJECTED" })
        .in("client_id", selectedIds);

      setToastMessage(`Successfully rejected ${selectedIds.length} client(s) in bulk.`);
      setTimeout(() => setToastMessage(null), 4000);

      setSelectedRows(new Set());
      setShowBulkRejectModal(false);
      setBulkRejectionReason("");
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to execute bulk rejection.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Client Active / Inactive
  const handleToggleStatus = async (client: Client) => {
    setActionLoading(true);
    const newStatus = client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const { error: upErr } = await supabase
        .from("client_companies")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", client.id);

      if (upErr) throw upErr;

      setToastMessage(`Client "${client.company_name}" status updated to ${newStatus}.`);
      setTimeout(() => setToastMessage(null), 3500);

      setConfirmStatusClient(null);
      setOpenActionMenuId(null);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setError(err.message || "Failed to update client status in database");
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Edit Save
  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editFormData.company_name.trim()) {
      setEditFormError("Company name is required");
      return;
    }

    setActionLoading(true);
    setEditFormError(null);

    try {
      const { error: upErr } = await supabase
        .from("client_companies")
        .update({
          company_name: editFormData.company_name.trim(),
          city: editFormData.city.trim(),
          registered_address: editFormData.registered_address.trim(),
          gstin: editFormData.gstin.trim() || null,
          business_type: editFormData.client_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingClient.id);

      if (upErr) throw upErr;

      // Update primary user contact
      if (editFormData.primary_contact_name || editFormData.primary_contact_phone) {
        await supabase
          .from("client_users")
          .update({
            full_name: editFormData.primary_contact_name.trim(),
            email: editFormData.primary_contact_email.trim() || null,
          })
          .eq("client_id", editingClient.id);
      }

      setToastMessage(`Client details for "${editFormData.company_name}" updated successfully!`);
      setTimeout(() => setToastMessage(null), 3500);

      setEditingClient(null);
      await Promise.all([fetchRealStats(), fetchRealClients()]);
    } catch (err: any) {
      setEditFormError(err.message || "Failed to save client modifications.");
    } finally {
      setActionLoading(false);
    }
  };

  // Active filter count for clear button
  const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || cityFilter !== "ALL" || typeFilter !== "ALL";

  return (
    <div className="cli-dir-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-success" role="status" aria-live="polite">
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Database Error Banner */}
      {error && (
        <div className="alert-error-bar" role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => { setError(null); fetchRealClients(); }}
            style={{
              background: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <RotateCcw size={12} /> Retry
          </button>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 1. Page Header with Title, Subtitle and Action Buttons ── */}
      <div className="client-header-hero">
        <div className="client-header-text">
          <div className="page-breadcrumb">
            <span className="breadcrumb-link">Clients</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Client Management</span>
          </div>
          <h1 className="page-title">Client Management</h1>
          <p className="page-subtitle">
            Manage client registrations, verification, KYC documents, and account status.
          </p>
        </div>

        <div className="client-mgmt-header-actions">
          {/* Export Action */}
          <button
            className="btn-header-secondary"
            onClick={() => handleExportCSV()}
            disabled={!canExport || clients.length === 0}
            title={canExport ? "Export filtered client records to CSV" : "Export permission required"}
            id="btn-export-clients"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          {/* Import Action */}
          <button
            className="btn-header-secondary"
            onClick={() => {
              setImportError(null);
              setParsedRows([]);
              setImportFile(null);
              setShowImportModal(true);
            }}
            disabled={!canCreate}
            title={canCreate ? "Upload CSV template to import clients" : "Create permission required"}
            id="btn-import-clients"
          >
            <Upload size={15} />
            <span>Import</span>
          </button>

          {/* Primary Add Client Action */}
          <button
            className="btn-header-primary-orange"
            onClick={onNavigateToCreate}
            disabled={!canCreate}
            title={canCreate ? "Open new client registration form" : "Create permission required"}
            id="btn-add-client"
          >
            <Plus size={16} />
            <span>+ Add Client</span>
          </button>
        </div>
      </div>

      {/* ── 2. Summary KPI Cards ── */}
      <div className="client-kpi-bar" role="region" aria-label="Client statistics summary">
        {/* Total Applications */}
        <div
          className={`kpi-stat-card ${activeTab === "ALL" ? "card-highlighted" : ""}`}
          onClick={() => { setActiveTab("ALL"); setStatusFilter("ALL"); setPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view all client applications"
        >
          <div className="kpi-stat-icon" style={{ background: "#FFF1E8" }}>
            <Users size={20} color="#F05A22" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Total Applications</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            {loading ? (
              <div className="kpi-skeleton-group">
                <div className="kpi-skeleton-bar-top" />
                <div className="kpi-skeleton-bar-bottom" />
              </div>
            ) : error ? (
              <div className="kpi-stat-value" style={{ color: "#DC2626", fontSize: 16 }}>—</div>
            ) : (
              <div className="kpi-stat-value">{dbKpis.total}</div>
            )}
          </div>
        </div>

        {/* Pending Approval */}
        <div
          className={`kpi-stat-card ${activeTab === "PENDING_APPROVAL" ? "card-highlighted" : ""}`}
          onClick={() => { setActiveTab("PENDING_APPROVAL"); setStatusFilter("PENDING_APPROVAL"); setPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view pending approval applications"
        >
          <div className="kpi-stat-icon" style={{ background: "#FEF3C7" }}>
            <Clock size={20} color="#D97706" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Pending Approval</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            {loading ? (
              <div className="kpi-skeleton-group">
                <div className="kpi-skeleton-bar-top" />
                <div className="kpi-skeleton-bar-bottom" />
              </div>
            ) : error ? (
              <div className="kpi-stat-value" style={{ color: "#DC2626", fontSize: 16 }}>—</div>
            ) : (
              <div className="kpi-stat-value" style={{ color: "#D97706" }}>{dbKpis.pending}</div>
            )}
          </div>
        </div>

        {/* Approved Clients */}
        <div
          className={`kpi-stat-card ${activeTab === "APPROVED" ? "card-highlighted" : ""}`}
          onClick={() => { setActiveTab("APPROVED"); setStatusFilter("APPROVED"); setPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view approved clients"
        >
          <div className="kpi-stat-icon" style={{ background: "#ECFDF5" }}>
            <UserCheck size={20} color="#10B981" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Approved Clients</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            {loading ? (
              <div className="kpi-skeleton-group">
                <div className="kpi-skeleton-bar-top" />
                <div className="kpi-skeleton-bar-bottom" />
              </div>
            ) : error ? (
              <div className="kpi-stat-value" style={{ color: "#DC2626", fontSize: 16 }}>—</div>
            ) : (
              <div className="kpi-stat-value" style={{ color: "#10B981" }}>{dbKpis.approved}</div>
            )}
          </div>
        </div>

        {/* Rejected Applications */}
        <div
          className={`kpi-stat-card ${activeTab === "REJECTED" ? "card-highlighted" : ""}`}
          onClick={() => { setActiveTab("REJECTED"); setStatusFilter("REJECTED"); setPage(1); }}
          role="button"
          tabIndex={0}
          title="Click to view rejected applications"
        >
          <div className="kpi-stat-icon" style={{ background: "#FEF2F2" }}>
            <UserMinus size={20} color="#EF4444" />
          </div>
          <div className="kpi-stat-content">
            <div className="kpi-stat-header">
              <span className="kpi-stat-label">Rejected Applications</span>
              <span className="kpi-stat-arrow"><ChevronRight size={14} /></span>
            </div>
            {loading ? (
              <div className="kpi-skeleton-group">
                <div className="kpi-skeleton-bar-top" />
                <div className="kpi-skeleton-bar-bottom" />
              </div>
            ) : error ? (
              <div className="kpi-stat-value" style={{ color: "#DC2626", fontSize: 16 }}>—</div>
            ) : (
              <div className="kpi-stat-value" style={{ color: "#EF4444" }}>{dbKpis.rejected}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Search and Filter Section Toolbar ── */}
      <div className="filters-bar-card">
        {/* Search Input */}
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-abs" />
          <input
            type="text"
            placeholder="Search by Client ID, company, GSTIN, contact person, phone..."
            className="client-search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchRealClients();
              }
            }}
            id="client-search-input"
            aria-label="Search clients"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => { setSearchQuery(""); setPage(1); }}
              aria-label="Clear search input"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Registration Status Dropdown */}
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            const val = e.target.value as any;
            setStatusFilter(val);
            setActiveTab(val);
            setPage(1);
          }}
          aria-label="Filter by Registration Status"
        >
          <option value="ALL">All Status</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* City Dropdown */}
        <select
          className="filter-select"
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by City"
        >
          <option value="ALL">All Cities</option>
          {availableCities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        {/* Entity Type Dropdown */}
        <select
          className="filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by Entity Type"
        >
          <option value="ALL">All Entity Types</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Reset Filters */}
        <button
          className="btn-filter-reset"
          onClick={handleResetFilters}
          title="Reset all search queries and filters"
        >
          <RotateCcw size={14} />
          <span>Reset Filters</span>
        </button>

        {/* Search Action */}
        <button
          className="btn-filter-search"
          onClick={() => fetchRealClients()}
          title="Execute search"
        >
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {/* Active Filter Chips Strip */}
      {hasActiveFilters && (
        <div className="active-filters-chips-bar" role="region" aria-label="Active filters">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>
            Active Filters:
          </span>
          {searchQuery && (
            <div className="filter-chip-tag">
              <span>Query: <strong>"{searchQuery}"</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setSearchQuery("")} aria-label="Remove search filter">
                <X size={12} />
              </button>
            </div>
          )}
          {statusFilter !== "ALL" && (
            <div className="filter-chip-tag">
              <span>Status: <strong>{statusFilter.replace("_", " ")}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => { setStatusFilter("ALL"); setActiveTab("ALL"); }} aria-label="Remove status filter">
                <X size={12} />
              </button>
            </div>
          )}
          {cityFilter !== "ALL" && (
            <div className="filter-chip-tag">
              <span>City: <strong>{cityFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setCityFilter("ALL")} aria-label="Remove city filter">
                <X size={12} />
              </button>
            </div>
          )}
          {typeFilter !== "ALL" && (
            <div className="filter-chip-tag">
              <span>Type: <strong>{typeFilter}</strong></span>
              <button className="filter-chip-remove-btn" onClick={() => setTypeFilter("ALL")} aria-label="Remove entity type filter">
                <X size={12} />
              </button>
            </div>
          )}
          <button className="filter-clear-all-action" onClick={handleResetFilters}>
            Clear all filters
          </button>
        </div>
      )}

      {/* ── 4. Client Status Tabs ── */}
      <div className="table-sub-bar">
        <div className="status-tabs-list" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "ALL"}
            className={`status-tab-btn ${activeTab === "ALL" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("ALL"); setStatusFilter("ALL"); setPage(1); }}
          >
            All Clients ({dbKpis.total})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "PENDING_APPROVAL"}
            className={`status-tab-btn ${activeTab === "PENDING_APPROVAL" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("PENDING_APPROVAL"); setStatusFilter("PENDING_APPROVAL"); setPage(1); }}
          >
            Pending Approval ({dbKpis.pending})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "APPROVED"}
            className={`status-tab-btn ${activeTab === "APPROVED" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("APPROVED"); setStatusFilter("APPROVED"); setPage(1); }}
          >
            Approved ({dbKpis.approved})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "REJECTED"}
            className={`status-tab-btn ${activeTab === "REJECTED" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("REJECTED"); setStatusFilter("REJECTED"); setPage(1); }}
          >
            Rejected ({dbKpis.rejected})
          </button>
        </div>
      </div>

      {/* ── 9. Bulk Actions Contextual Toolbar ── */}
      {selectedRows.size > 0 && (
        <div className="client-bulk-toolbar" role="region" aria-label="Bulk actions toolbar">
          <div className="client-bulk-toolbar-info">
            <span className="bulk-count-badge">
              {selectedRows.size} client{selectedRows.size > 1 ? "s" : ""} selected
            </span>
            <span style={{ fontSize: 13, color: "#CBD5E1" }}>
              Apply bulk operations to selected accounts:
            </span>
          </div>

          <div className="bulk-toolbar-actions">
            {canApprove && (
              <button
                className="btn-bulk-approve"
                onClick={() => setShowBulkApproveModal(true)}
              >
                <CheckCircle size={14} />
                <span>Approve Selected</span>
              </button>
            )}

            {canReject && (
              <button
                className="btn-bulk-reject"
                onClick={() => {
                  setBulkRejectionReason("");
                  setBulkRejectionError(null);
                  setShowBulkRejectModal(true);
                }}
              >
                <X size={14} />
                <span>Reject Selected</span>
              </button>
            )}

            {canExport && (
              <button
                className="btn-bulk-export"
                onClick={handleExportSelected}
              >
                <Download size={14} />
                <span>Export Selected</span>
              </button>
            )}

            <button
              className="btn-bulk-clear"
              onClick={() => setSelectedRows(new Set())}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── 5. Client Data Table ── */}
      <div
        ref={tableContainerRef}
        className={`client-table-card ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        <table className="client-table" aria-label="Clients directory table">
          <thead>
            <tr>
              {/* Checkbox */}
              <th style={{ width: 38, minWidth: 38, paddingLeft: 14, paddingRight: 6 }}>
                <input
                  type="checkbox"
                  className="row-checkbox"
                  checked={paginatedClients.length > 0 && selectedRows.size === paginatedClients.length}
                  onChange={handleSelectAll}
                  aria-label="Select all visible clients"
                />
              </th>

              {/* Client ID & Company Name */}
              <th style={{ minWidth: 165 }}>
                <button
                  type="button"
                  className={`th-sortable-button ${sortField === "company_name" ? "active-sort" : ""}`}
                  onClick={() => handleSort("company_name")}
                >
                  <span>Client ID & Company</span>
                  {sortField === "company_name" ? (
                    sortOrder === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </button>
              </th>

              {/* Contact Person */}
              <th style={{ minWidth: 120 }}>
                <span>Contact Person</span>
              </th>

              {/* Verified Phone */}
              <th style={{ minWidth: 115 }}>
                <span>Verified Phone</span>
              </th>

              {/* Email */}
              <th style={{ minWidth: 135 }}>
                <span>Email</span>
              </th>

              {/* City */}
              <th style={{ minWidth: 80 }}>
                <button
                  type="button"
                  className={`th-sortable-button ${sortField === "city" ? "active-sort" : ""}`}
                  onClick={() => handleSort("city")}
                >
                  <span>City</span>
                  {sortField === "city" ? (
                    sortOrder === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </button>
              </th>

              {/* Entity Type */}
              <th style={{ minWidth: 90 }}>
                <span>Entity Type</span>
              </th>

              {/* Submission Date */}
              <th style={{ minWidth: 95 }}>
                <button
                  type="button"
                  className={`th-sortable-button ${sortField === "created_at" ? "active-sort" : ""}`}
                  onClick={() => handleSort("created_at")}
                >
                  <span>Submission Date</span>
                  {sortField === "created_at" ? (
                    sortOrder === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </button>
              </th>

              {/* KYC Status */}
              <th style={{ minWidth: 100 }}>
                <span>KYC Status</span>
              </th>

              {/* Registration Status */}
              <th style={{ minWidth: 110 }}>
                <button
                  type="button"
                  className={`th-sortable-button ${sortField === "status" ? "active-sort" : ""}`}
                  onClick={() => handleSort("status")}
                >
                  <span>Registration Status</span>
                  {sortField === "status" ? (
                    sortOrder === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} color="#94A3B8" />
                  )}
                </button>
              </th>

              {/* Actions */}
              <th style={{ width: 84, minWidth: 84, textAlign: "center", paddingRight: 12 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="table-skeleton-row">
                  <td style={{ paddingLeft: 14, paddingRight: 6 }}>
                    <input type="checkbox" className="row-checkbox" disabled />
                  </td>
                  <td>
                    <div className="client-name-cell">
                      <div className="client-avatar-squircle" style={{ background: "#F1F5F9" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div className="table-skeleton-cell" style={{ width: 120, height: 11 }} />
                        <div className="table-skeleton-cell" style={{ width: 70, height: 8 }} />
                      </div>
                    </div>
                  </td>
                  <td><div className="table-skeleton-cell" style={{ width: 90 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 85 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 100 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 60 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 70 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 75 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 80, height: 20, borderRadius: 6 }} /></td>
                  <td><div className="table-skeleton-cell" style={{ width: 85, height: 22, borderRadius: 9999 }} /></td>
                  <td style={{ textAlign: "center", paddingRight: 12 }}>
                    <div className="table-skeleton-cell" style={{ width: 60, height: 28, borderRadius: 8, margin: "0 auto" }} />
                  </td>
                </tr>
              ))
            ) : paginatedClients.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: "64px 20px" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, background: "#FFF1E8",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16
                  }}>
                    <Users size={28} color="#F05A22" />
                  </div>
                  <h3 style={{ color: "#172B4D", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
                    No clients found
                  </h3>
                  <p style={{ color: "#64748B", margin: "0 0 20px", fontSize: 13.5, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                    {hasActiveFilters
                      ? "No records matched your active search query or filter criteria. Try resetting filters."
                      : "Client registrations submitted from the mobile app will automatically appear here for verification and approval."}
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                    {hasActiveFilters && (
                      <button className="btn-filter-reset" onClick={handleResetFilters}>
                        <RotateCcw size={14} />
                        <span>Clear Filters</span>
                      </button>
                    )}
                    {canCreate && (
                      <button className="btn-header-primary-orange" onClick={onNavigateToCreate}>
                        <Plus size={16} />
                        <span>+ Add Client</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClients.map((client) => {
                const isSelected = selectedClientId === client.id;
                const formattedId = formatClientId(client.id, client.created_at, client.client_code);
                const initials = getInitials(client.company_name);
                const avatarColor = getAvatarColor(client.company_name);

                return (
                  <tr
                    key={client.id}
                    className={`client-row ${isSelected ? "row-selected" : ""}`}
                  >
                    {/* Checkbox */}
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 38, minWidth: 38, paddingLeft: 14, paddingRight: 6 }}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={selectedRows.has(client.id)}
                        onChange={() => handleSelectRow(client.id)}
                        aria-label={`Select ${client.company_name}`}
                      />
                    </td>

                    {/* 6. Client ID & Company Information */}
                    <td>
                      <div className="client-name-cell" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          className="client-avatar-squircle"
                          style={{ background: avatarColor, color: "#FFFFFF", fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                          aria-hidden="true"
                        >
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                          <div
                            className="client-name-text"
                            style={{
                              fontWeight: 600,
                              color: "#0F172A",
                              cursor: "default",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 160,
                            }}
                            title={client.company_name}
                          >
                            {client.company_name}
                          </div>
                          <div
                            className="client-id-text"
                            style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}
                          >
                            {formattedId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact Person */}
                    <td>
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#1E293B",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 120,
                          }}
                          title={client.primary_contact_name || "—"}
                        >
                          {client.primary_contact_name || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748B",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 120,
                          }}
                          title={client.primary_contact_designation || "Authorized"}
                        >
                          {client.primary_contact_designation || "Authorized"}
                        </div>
                      </div>
                    </td>

                    {/* Verified Phone */}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#1E293B", fontWeight: 600 }}>
                          {client.primary_contact_phone || "—"}
                        </span>
                        {client.primary_contact_phone && client.primary_contact_phone !== "—" && (
                          <span title="Verified mobile number via OTP" style={{ color: "#10B981", display: "inline-flex" }}>
                            <ShieldCheck size={14} />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Email */}
                    <td>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          maxWidth: 135,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={client.company_email || client.primary_contact_email || "—"}
                      >
                        {client.company_email || client.primary_contact_email || "—"}
                      </div>
                    </td>

                    {/* City */}
                    <td>
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "#334155",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 85,
                          display: "inline-block",
                        }}
                        title={client.city || "—"}
                      >
                        {client.city || "—"}
                      </span>
                    </td>

                    {/* Entity Type */}
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 95,
                          display: "inline-block",
                        }}
                        title={client.client_type || "Private Limited"}
                      >
                        {client.client_type || "Private Limited"}
                      </span>
                    </td>

                    {/* Submission Date */}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {client.created_at
                          ? new Date(client.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </td>

                    {/* 7. KYC Status (Separate badge) */}
                    <td style={{ whiteSpace: "nowrap" }}>
                      {(() => {
                        const kyc = client.kyc_status || "NOT_SUBMITTED";
                        if (kyc === "VERIFIED") {
                          return (
                            <span className="kyc-status-badge verified" title="All KYC documents verified & approved">
                              <CheckCircle size={11} /> Verified
                            </span>
                          );
                        }
                        if (kyc === "UNDER_REVIEW") {
                          return (
                            <span className="kyc-status-badge under-review" title="KYC documents partially verified / under compliance check">
                              <Clock size={11} /> Under Review
                            </span>
                          );
                        }
                        if (kyc === "SUBMITTED") {
                          return (
                            <span className="kyc-status-badge submitted" title="Documents submitted by client, awaiting review">
                              <FileText size={11} /> Submitted
                            </span>
                          );
                        }
                        if (kyc === "REJECTED") {
                          return (
                            <span className="kyc-status-badge rejected" title="One or more KYC documents were rejected">
                              <AlertCircle size={11} /> Rejected
                            </span>
                          );
                        }
                        return (
                          <span className="kyc-status-badge not-submitted" title="No standalone KYC documents attached">
                            Not Submitted
                          </span>
                        );
                      })()}
                    </td>

                    {/* 7. Registration Status (Separate badge) */}
                    <td style={{ whiteSpace: "nowrap" }}>
                      {(() => {
                        const st = (client.status || "").toUpperCase();
                        if (st === "APPROVED" || st === "ACTIVE") {
                          return (
                            <span className="reg-status-badge approved" title="Registration approved; client has portal access">
                              <CheckCircle size={12} /> Approved
                            </span>
                          );
                        }
                        if (st === "PENDING_APPROVAL" || st === "PENDING") {
                          return (
                            <span className="reg-status-badge pending" title="Application awaiting administrator review">
                              <Clock size={12} /> Pending Approval
                            </span>
                          );
                        }
                        if (st === "REJECTED") {
                          return (
                            <span className="reg-status-badge rejected" title="Application rejected by compliance desk">
                              <AlertCircle size={12} /> Rejected
                            </span>
                          );
                        }
                        return (
                          <span className="reg-status-badge suspended" title="Account inactive or suspended">
                            {st === "INACTIVE" ? "Inactive" : st}
                          </span>
                        );
                      })()}
                    </td>

                    {/* 8. Actions: Explicit View Details + 3-Dot Menu */}
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 84, minWidth: 84, textAlign: "center", paddingRight: 12 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        <button
                          type="button"
                          className="row-action-btn-circle"
                          title="View Details"
                          aria-label={`View Details for ${client.company_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClientId(client.id);
                            setIsDrawerOpen(true);
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className={`row-action-btn-circle ${menuAnchor?.id === client.id ? "active" : ""}`}
                          title="Actions menu"
                          onClick={(e) => handleToggleActionMenu(client, e)}
                          aria-label="Row actions"
                          aria-expanded={menuAnchor?.id === client.id}
                        >
                          <MoreVertical size={15} />
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

      {/* ── 12. Pagination Footer ── */}
      <div className="pagination-row">
        <span className="pagination-info">
          Showing {filteredAndSortedClients.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(page * pageSize, totalCount)} of {totalCount} clients
        </span>

        <div className="pagination-controls">
          <button
            className="page-btn"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                className={`page-num-btn ${page === p ? "active-page" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            );
          })}

          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>

          <select
            className="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Items per page"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      {/* ── 10. Client Details Slide-out Drawer ── */}
      {isDrawerOpen && activeSelectedClient && (
        <>
          <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
          <aside className="client-peek-drawer" aria-label="Client details drawer">
            {/* 1. Sticky Header */}
            <div className="peek-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#FFF1E8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#F05A22"
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                    Client Profile
                  </h3>
                  <span style={{ fontSize: 11.5, color: "#64748B" }}>
                    Complete Registration & KYC Overview
                  </span>
                </div>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close drawer"
                title="Close Profile Drawer (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            {/* 2. Scrollable Body */}
            <div className="peek-drawer-body">
              {/* Profile Identity Card */}
              <div className="peek-identity-card">
                <div
                  className="peek-avatar-large"
                  style={{ background: getAvatarColor(activeSelectedClient.company_name) }}
                  aria-hidden="true"
                >
                  {getInitials(activeSelectedClient.company_name)}
                </div>
                <div className="peek-identity-info">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <h2 className="peek-company-name">{activeSelectedClient.company_name}</h2>
                    <span className={`reg-status-badge ${activeSelectedClient.status === "APPROVED" || activeSelectedClient.status === "ACTIVE" ? "approved" : activeSelectedClient.status === "REJECTED" ? "rejected" : "pending"}`}>
                      {activeSelectedClient.status === "APPROVED" || activeSelectedClient.status === "ACTIVE" ? (
                        <><CheckCircle size={12} /> Approved</>
                      ) : activeSelectedClient.status === "REJECTED" ? (
                        <><AlertCircle size={12} /> Rejected</>
                      ) : (
                        <><Clock size={12} /> Pending Approval</>
                      )}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0F172A",
                        background: "#F1F5F9",
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      {formatClientId(activeSelectedClient.id, activeSelectedClient.created_at, activeSelectedClient.client_code)}
                    </span>

                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "#475569",
                        background: "#F8FAFC",
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid #E2E8F0"
                      }}
                    >
                      {activeSelectedClient.client_type || "Private Limited"}
                    </span>

                    {activeSelectedClient.city && (
                      <span style={{ fontSize: 12, color: "#64748B", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={13} color="#F05A22" /> {activeSelectedClient.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* A. Company Information */}
              <div className="peek-card">
                <div className="peek-card-header">
                  <h4 className="peek-card-title">
                    <Building2 size={16} color="#F05A22" />
                    <span>A. Company Information</span>
                  </h4>
                </div>

                <div className="peek-info-grid-2col">
                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Client ID</span>
                    <div className="peek-field-val">
                      <span style={{ fontFamily: "monospace" }}>
                        {formatClientId(activeSelectedClient.id, activeSelectedClient.created_at, activeSelectedClient.client_code)}
                      </span>
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Entity Type</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.client_type || "Private Limited"}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">GSTIN</span>
                    <div className="peek-field-val">
                      <span style={{ fontFamily: "monospace" }}>{activeSelectedClient.gstin || "—"}</span>
                      {activeSelectedClient.gstin && (
                        <button
                          type="button"
                          className={`btn-copy-chip ${copiedGstId === activeSelectedClient.id ? "copied" : ""}`}
                          onClick={() => handleCopyGst(activeSelectedClient.gstin!, activeSelectedClient.id)}
                          title="Copy GSTIN to clipboard"
                        >
                          {copiedGstId === activeSelectedClient.id ? (
                            <><Check size={11} /> Copied</>
                          ) : (
                            <><Copy size={11} /> Copy</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">PAN Number</span>
                    <div className="peek-field-val">
                      <span style={{ fontFamily: "monospace" }}>{activeSelectedClient.pan || "—"}</span>
                      {activeSelectedClient.pan && (
                        <button
                          type="button"
                          className={`btn-copy-chip ${copiedGstId === `pan-${activeSelectedClient.id}` ? "copied" : ""}`}
                          onClick={() => {
                            navigator.clipboard.writeText(activeSelectedClient.pan!);
                            setCopiedGstId(`pan-${activeSelectedClient.id}`);
                            setTimeout(() => setCopiedGstId(null), 2000);
                          }}
                          title="Copy PAN to clipboard"
                        >
                          {copiedGstId === `pan-${activeSelectedClient.id}` ? (
                            <><Check size={11} /> Copied</>
                          ) : (
                            <><Copy size={11} /> Copy</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">City</span>
                    <div className="peek-field-val">{activeSelectedClient.city || "—"}</div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">PIN Code</span>
                    <div className="peek-field-val mono-text">{activeSelectedClient.pincode || "—"}</div>
                  </div>

                  <div className="peek-field-item" style={{ gridColumn: "span 2" }}>
                    <span className="peek-field-lbl">Registered Address</span>
                    <div className="peek-field-val" style={{ lineHeight: 1.45 }}>
                      {activeSelectedClient.registered_address || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Contact Information */}
              <div className="peek-card">
                <div className="peek-card-header">
                  <h4 className="peek-card-title">
                    <Users size={16} color="#F05A22" />
                    <span>B. Contact Information</span>
                  </h4>
                </div>

                <div className="peek-info-grid-2col">
                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Contact Person</span>
                    <div className="peek-field-val" style={{ fontSize: 13.5 }}>
                      {activeSelectedClient.primary_contact_name || "—"}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Designation</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.primary_contact_designation || "Authorized Contact"}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Verified Phone</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.primary_contact_phone ? (
                        <a
                          href={`tel:${activeSelectedClient.primary_contact_phone}`}
                          style={{
                            color: "#166534",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontFamily: "monospace",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5
                          }}
                        >
                          <Phone size={13} color="#16A34A" />
                          <span>{activeSelectedClient.primary_contact_phone}</span>
                          <span title="Verified mobile via OTP" style={{ display: "inline-flex" }}><ShieldCheck size={13} color="#10B981" /></span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Email Address</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.company_email || activeSelectedClient.primary_contact_email ? (
                        <a
                          href={`mailto:${activeSelectedClient.company_email || activeSelectedClient.primary_contact_email}`}
                          style={{
                            color: "#1E40AF",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            wordBreak: "break-all"
                          }}
                        >
                          <Mail size={13} color="#3B82F6" />
                          <span>{activeSelectedClient.company_email || activeSelectedClient.primary_contact_email}</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* C. Verification & Documents */}
              <div className="peek-card">
                <div className="peek-card-header">
                  <h4 className="peek-card-title">
                    <ShieldCheck size={16} color="#F05A22" />
                    <span>C. Verification & Documents</span>
                  </h4>
                  <span className={`kyc-status-badge ${(activeSelectedClient.kyc_status || "not-submitted").toLowerCase().replace("_", "-")}`}>
                    {activeSelectedClient.kyc_status === "VERIFIED" ? (
                      <><CheckCircle size={11} /> Verified</>
                    ) : activeSelectedClient.kyc_status === "UNDER_REVIEW" ? (
                      <><Clock size={11} /> Under Review</>
                    ) : activeSelectedClient.kyc_status === "REJECTED" ? (
                      <><AlertCircle size={11} /> Rejected</>
                    ) : (
                      activeSelectedClient.kyc_status || "Not Submitted"
                    )}
                  </span>
                </div>

                {activeSelectedClient.documents_list && activeSelectedClient.documents_list.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeSelectedClient.documents_list.map((doc, idx) => {
                      const resolved = resolveClientDocumentType(doc);
                      const isVerified = doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED";
                      const isRejected = doc.verification_status === "REJECTED" || doc.verification_status === "REPLACEMENT_REQUESTED";
                      const isMandatory = resolved.key !== "MSME_UDYAM" && resolved.key !== "OTHER";

                      return (
                        <div key={doc.id || idx} className="peek-doc-card">
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  background: isVerified ? "#F0FDF4" : isRejected ? "#FEF2F2" : "#FFF7ED",
                                  border: "1px solid #E2E8F0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0
                                }}
                              >
                                <FileText size={18} color={isVerified ? "#16A34A" : isRejected ? "#DC2626" : "#EA580C"} />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                                    {resolved.label}
                                  </span>
                                  {isMandatory ? (
                                    <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", padding: "1px 5px", borderRadius: 4 }}>
                                      Mandatory
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 600, background: "#F1F5F9", color: "#64748B", padding: "1px 5px", borderRadius: 4 }}>
                                      Optional
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>
                                  <span style={{ fontFamily: "monospace", color: "#334155" }}>{resolved.cleanFileName}</span>
                                  {doc.file_size && ` • ${(parseInt(doc.file_size) / 1024).toFixed(1)} KB`}
                                  {doc.created_at && ` • Uploaded ${new Date(doc.created_at).toLocaleDateString("en-IN")}`}
                                </div>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div>
                              {isVerified ? (
                                <span style={{ background: "#DCFCE7", color: "#166534", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <CheckCircle size={11} /> Verified
                                </span>
                              ) : isRejected ? (
                                <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <AlertCircle size={11} /> Rejected
                                </span>
                              ) : (
                                <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Clock size={11} /> Pending
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rejection Note */}
                          {isRejected && doc.rejection_reason && (
                            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#B91C1C", display: "flex", alignItems: "center", gap: 6 }}>
                              <AlertCircle size={13} color="#DC2626" />
                              <span>{doc.rejection_reason}</span>
                            </div>
                          )}

                          {/* Document Actions Row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
                            <button
                              type="button"
                              style={{
                                background: "#0F172A",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye size={12} /> View Document
                            </button>

                            {canApprove && !isVerified && (
                              <button
                                type="button"
                                style={{
                                  background: "#DCFCE7",
                                  color: "#166534",
                                  border: "1px solid #86EFAC",
                                  borderRadius: 6,
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                onClick={() => handleVerifySingleDocument(doc)}
                              >
                                <CheckCircle size={12} /> Verify
                              </button>
                            )}

                            {canReject && !isRejected && (
                              <button
                                type="button"
                                style={{
                                  background: "#FEF2F2",
                                  color: "#DC2626",
                                  border: "1px solid #FCA5A5",
                                  borderRadius: 6,
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                onClick={() => {
                                  setRejectDocTarget(doc);
                                  setDocRejectReason("");
                                  setDocRejectError(null);
                                }}
                              >
                                <X size={12} /> Reject
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: 8, fontSize: 12.5, color: "#64748B", textAlign: "center" }}>
                    No standalone KYC files attached. GSTIN verified.
                  </div>
                )}
              </div>

              {/* D. Business Activity */}
              <div className="peek-card">
                <div className="peek-card-header">
                  <h4 className="peek-card-title">
                    <Activity size={16} color="#F05A22" />
                    <span>D. Business Activity</span>
                  </h4>
                </div>

                <div className="peek-stats-grid">
                  <div className="peek-stat-box">
                    <span className="peek-stat-box-val" style={{ color: "#F05A22" }}>
                      {activeSelectedClient.active_requirements || 0}
                    </span>
                    <span className="peek-stat-box-lbl">Active Reqs</span>
                  </div>

                  <div className="peek-stat-box">
                    <span className="peek-stat-box-val" style={{ color: "#0F172A" }}>
                      {(activeSelectedClient.completed_bookings || 0) + (activeSelectedClient.active_requirements ? 1 : 0)}
                    </span>
                    <span className="peek-stat-box-lbl">Total Bookings</span>
                  </div>

                  <div className="peek-stat-box">
                    <span className="peek-stat-box-val" style={{ color: "#16A34A" }}>
                      {activeSelectedClient.completed_bookings || 0}
                    </span>
                    <span className="peek-stat-box-lbl">Completed</span>
                  </div>
                </div>
              </div>

              {/* E. Audit Information */}
              <div className="peek-card">
                <div className="peek-card-header">
                  <h4 className="peek-card-title">
                    <Clock size={16} color="#F05A22" />
                    <span>E. Audit Information</span>
                  </h4>
                </div>

                <div className="peek-info-grid-2col">
                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Registration Date</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.created_at ? new Date(activeSelectedClient.created_at).toLocaleString("en-IN") : "—"}
                    </div>
                  </div>

                  <div className="peek-field-item">
                    <span className="peek-field-lbl">Last Updated</span>
                    <div className="peek-field-val">
                      {activeSelectedClient.updated_at ? new Date(activeSelectedClient.updated_at).toLocaleString("en-IN") : "—"}
                    </div>
                  </div>

                  {activeSelectedClient.approved_by && (
                    <div className="peek-field-item" style={{ gridColumn: "span 2" }}>
                      <span className="peek-field-lbl">Approved By</span>
                      <div className="peek-field-val">
                        <CheckCircle size={13} color="#16A34A" />
                        <span>{activeSelectedClient.approved_by} ({activeSelectedClient.approved_at ? new Date(activeSelectedClient.approved_at).toLocaleDateString("en-IN") : "Recorded"})</span>
                      </div>
                    </div>
                  )}

                  {activeSelectedClient.rejection_reason && (
                    <div className="peek-field-item" style={{ gridColumn: "span 2", background: "#FEF2F2", padding: 10, borderRadius: 8, border: "1px solid #FECACA" }}>
                      <span className="peek-field-lbl" style={{ color: "#DC2626" }}>Rejection Reason</span>
                      <div className="peek-field-val" style={{ color: "#B91C1C", marginTop: 2 }}>
                        {activeSelectedClient.rejection_reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Sticky Footer Actions */}
            <div className="peek-drawer-footer">
              {canApprove && (activeSelectedClient.status === "PENDING_APPROVAL" || activeSelectedClient.status === "PENDING") && canReject ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      padding: "10px 14px", background: "#16A34A", color: "#FFFFFF",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      boxShadow: "0 2px 6px rgba(22, 163, 74, 0.2)"
                    }}
                    onClick={() => {
                      setIsDrawerOpen(false);
                      const eligibility = checkClientApprovalEligibility(activeSelectedClient.documents_list);
                      if (!eligibility.isEligible) {
                        setReviewingClient(activeSelectedClient);
                        setToastMessage(`Review required: ${eligibility.summaryMessage}`);
                        setTimeout(() => setToastMessage(null), 4500);
                      } else {
                        setApprovalModalClient(activeSelectedClient);
                      }
                    }}
                  >
                    <CheckCircle size={15} /> Approve
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "10px 14px", background: "#FEF2F2", color: "#DC2626",
                      border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                    }}
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setRejectModalClient(activeSelectedClient);
                      setRejectionReasonInput("");
                      setRejectionInputError(null);
                    }}
                  >
                    <X size={15} /> Reject
                  </button>
                </div>
              ) : (
                <>
                  {canApprove && (activeSelectedClient.status === "PENDING_APPROVAL" || activeSelectedClient.status === "PENDING") && (
                    <button
                      type="button"
                      style={{
                        width: "100%", padding: 10, background: "#16A34A", color: "#FFFFFF",
                        border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: "0 2px 6px rgba(22, 163, 74, 0.2)"
                      }}
                      onClick={() => {
                        setIsDrawerOpen(false);
                        const eligibility = checkClientApprovalEligibility(activeSelectedClient.documents_list);
                        if (!eligibility.isEligible) {
                          setReviewingClient(activeSelectedClient);
                          setToastMessage(`Review required: ${eligibility.summaryMessage}`);
                          setTimeout(() => setToastMessage(null), 4500);
                        } else {
                          setApprovalModalClient(activeSelectedClient);
                        }
                      }}
                    >
                      <CheckCircle size={15} /> Approve Client Registration
                    </button>
                  )}

                  {canReject && activeSelectedClient.status !== "REJECTED" && (
                    <button
                      type="button"
                      style={{
                        width: "100%", padding: 10, background: "#FEF2F2", color: "#DC2626",
                        border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                      }}
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setRejectModalClient(activeSelectedClient);
                        setRejectionReasonInput("");
                        setRejectionInputError(null);
                      }}
                    >
                      <X size={15} /> Reject Application
                    </button>
                  )}
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  className="btn-peek-secondary"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setReviewingClient(activeSelectedClient);
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Review KYC</span>
                </button>

                <button
                  type="button"
                  className="btn-peek-full-profile"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onNavigateToProfile(activeSelectedClient.id);
                  }}
                >
                  <Building2 size={14} />
                  <span>Full Profile</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── 13. Import Modal ── */}
      {showImportModal && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div className="import-modal-card">
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Import Clients via CSV
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
                  Upload a CSV file with client registrations to bulk-import into the database.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                aria-label="Close import dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Template Download Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFF7ED", border: "1px solid #FFEDD5", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#C2410C" }}>
                    Need the template format?
                  </div>
                  <div style={{ fontSize: 12, color: "#EA580C" }}>
                    Download the pre-formatted CSV template with standard columns.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  style={{
                    background: "#F05A22",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Download size={13} /> Download Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div
                className="import-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} color="#F05A22" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                  {importFile ? importFile.name : "Click or drag & drop CSV file here"}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  Supports CSV format with required columns: Company Name, Contact Person, Phone, Address.
                </div>
              </div>

              {importError && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>
                  <AlertCircle size={14} style={{ display: "inline", marginRight: 6 }} />
                  {importError}
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedRows.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      Preview ({parsedRows.filter(r => r.isValid).length} Valid, {parsedRows.filter(r => !r.isValid).length} Errors)
                    </div>
                  </div>

                  <div className="import-preview-table-container">
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Company</th>
                          <th>Contact</th>
                          <th>Phone</th>
                          <th>City</th>
                          <th>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 15).map((row) => (
                          <tr key={row.rowNum}>
                            <td>{row.rowNum}</td>
                            <td style={{ fontWeight: 600 }}>{row.companyName}</td>
                            <td>{row.contactPerson}</td>
                            <td>{row.phone}</td>
                            <td>{row.city}</td>
                            <td>
                              {row.isValid ? (
                                <span style={{ color: "#16A34A", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <CheckCircle size={12} /> Valid
                                </span>
                              ) : (
                                <span style={{ color: "#DC2626", fontWeight: 600 }} title={row.errors.join(", ")}>
                                  {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, background: "#F8FAFC" }}>
              <button
                type="button"
                className="btn-filter-reset"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importSubmitting || parsedRows.filter(r => r.isValid).length === 0}
                className="btn-header-primary-orange"
                onClick={handleExecuteImport}
              >
                {importSubmitting ? "Importing to Database..." : `Import ${parsedRows.filter(r => r.isValid).length} Clients`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Client Modal / Drawer ── */}
      {editingClient && (
        <EditClientModal
          isOpen={true}
          onClose={() => setEditingClient(null)}
          client={editingClient}
          primaryContact={{
            full_name: editingClient.primary_contact_name,
            designation: editingClient.primary_contact_designation,
            email: editingClient.company_email || editingClient.primary_contact_email,
            mobile: editingClient.company_phone || editingClient.primary_contact_phone,
          }}
          onSaved={async () => {
            setToastMessage(`Client details for "${editingClient.company_name}" updated successfully!`);
            setTimeout(() => setToastMessage(null), 3500);
            await Promise.all([fetchRealStats(), fetchRealClients()]);
          }}
        />
      )}

      {/* ── Review KYC Documents Modal ── */}
      {reviewingClient && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div className="kyc-review-modal-card">
            {/* Modal Header */}
            <div className="kyc-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(240, 90, 34, 0.1)",
                    border: "1px solid rgba(240, 90, 34, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={22} color="#F05A22" />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Review Client KYC & Compliance
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748B" }}>
                    Verify business credentials, GSTIN, PAN, and mandatory registration documents for <strong>{reviewingClient.company_name}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewingClient(null)}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748B",
                  transition: "all 0.15s ease"
                }}
                aria-label="Close KYC review dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="kyc-modal-body">
              {/* Business Overview Card */}
              <div className="kyc-overview-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: getAvatarColor(reviewingClient.company_name),
                        color: "#FFFFFF",
                        fontWeight: 800,
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {getInitials(reviewingClient.company_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                        {reviewingClient.company_name}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B" }}>
                        Client ID: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>{formatClientId(reviewingClient.id, reviewingClient.created_at, reviewingClient.client_code)}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`reg-status-badge ${reviewingClient.status === "APPROVED" || reviewingClient.status === "ACTIVE" ? "approved" : reviewingClient.status === "REJECTED" ? "rejected" : "pending"}`}>
                    {reviewingClient.status === "APPROVED" || reviewingClient.status === "ACTIVE" ? (
                      <><CheckCircle size={12} /> Approved</>
                    ) : reviewingClient.status === "REJECTED" ? (
                      <><AlertCircle size={12} /> Rejected</>
                    ) : (
                      <><Clock size={12} /> Pending Approval</>
                    )}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: 11, fontWeight: 600 }}>GSTIN</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{reviewingClient.gstin || "—"}</strong>
                      {reviewingClient.gstin && (
                        <button
                          type="button"
                          className={`btn-copy-chip ${copiedGstId === `kyc-${reviewingClient.id}` ? "copied" : ""}`}
                          onClick={() => {
                            handleCopyGst(reviewingClient.gstin!, `kyc-${reviewingClient.id}`);
                          }}
                          title="Copy GSTIN"
                        >
                          {copiedGstId === `kyc-${reviewingClient.id}` ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: 11, fontWeight: 600 }}>PAN Number</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{reviewingClient.pan || "—"}</strong>
                      {reviewingClient.pan && (
                        <button
                          type="button"
                          className={`btn-copy-chip ${copiedGstId === `kyc-pan-${reviewingClient.id}` ? "copied" : ""}`}
                          onClick={() => {
                            navigator.clipboard.writeText(reviewingClient.pan!);
                            setCopiedGstId(`kyc-pan-${reviewingClient.id}`);
                            setTimeout(() => setCopiedGstId(null), 2000);
                          }}
                          title="Copy PAN"
                        >
                          {copiedGstId === `kyc-pan-${reviewingClient.id}` ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: 11, fontWeight: 600 }}>Contact Person</span>
                    <span style={{ color: "#0F172A", fontWeight: 600, display: "block", marginTop: 2 }}>{reviewingClient.primary_contact_name || "—"}</span>
                  </div>

                  <div>
                    <span style={{ color: "#64748B", display: "block", fontSize: 11, fontWeight: 600 }}>Verified Phone</span>
                    {reviewingClient.primary_contact_phone ? (
                      <a
                        href={`tel:${reviewingClient.primary_contact_phone}`}
                        style={{ color: "#166534", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}
                      >
                        <Phone size={12} color="#16A34A" />
                        <span>{reviewingClient.primary_contact_phone}</span>
                        <span title="Verified OTP" style={{ display: "inline-flex" }}><ShieldCheck size={12} color="#10B981" /></span>
                      </a>
                    ) : (
                      <span style={{ color: "#64748B", marginTop: 2, display: "block" }}>—</span>
                    )}
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: "#64748B", display: "block", fontSize: 11, fontWeight: 600 }}>Registered Address</span>
                    <span style={{ color: "#334155", display: "block", marginTop: 2, lineHeight: 1.4 }}>
                      {reviewingClient.registered_address ? `${reviewingClient.registered_address}, ${reviewingClient.city || ""} ${reviewingClient.pincode || ""}` : (reviewingClient.city || "—")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Compliance & Approval Verification Gate */}
              {(() => {
                const eligibility = checkClientApprovalEligibility(reviewingClient.documents_list);
                if (!eligibility.isEligible) {
                  return (
                    <div className="kyc-banner-box blocked">
                      <AlertTriangle size={20} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#92400E", fontSize: 13.5, fontWeight: 800 }}>
                          Approval Blocked: Mandatory Documents Require Individual Verification
                        </div>
                        <div style={{ color: "#B45309", fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
                          {eligibility.summaryMessage}. Every mandatory document (GST Certificate, Company PAN, and Incorporation Proof) must be individually reviewed and verified before administrative registration approval can be executed.
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="kyc-banner-box verified">
                    <CheckCircle size={20} color="#16A34A" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#166534", fontSize: 13.5, fontWeight: 800 }}>
                        All Mandatory Compliance Documents Individually Verified
                      </div>
                      <div style={{ color: "#15803D", fontSize: 12.5, marginTop: 3 }}>
                        GST Certificate, Company PAN, and Incorporation Proof are all verified. Client registration is fully cleared for administrative approval.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Attached KYC Documents */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={16} color="#F05A22" />
                    <span>Attached Verification Documents ({reviewingClient.documents_list?.length || 0})</span>
                  </h4>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Mandatory: GST Certificate, Company PAN, Incorporation Proof
                  </span>
                </div>

                {reviewingClient.documents_list && reviewingClient.documents_list.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reviewingClient.documents_list.map((doc, idx) => {
                      const resolved = resolveClientDocumentType(doc);
                      const isVerified = doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED";
                      const isRejected = doc.verification_status === "REJECTED" || doc.verification_status === "REPLACEMENT_REQUESTED";
                      const isReuploaded = doc.verification_status === "RE_UPLOADED" || (doc.verification_status === "PENDING" && Boolean(doc.rejection_reason));
                      const isMandatory = resolved.key !== "MSME_UDYAM" && resolved.key !== "OTHER";

                      return (
                        <div
                          key={doc.id || idx}
                          className={`kyc-doc-card-row ${isVerified ? "verified" : isRejected ? "rejected" : ""}`}
                        >
                          <div className="kyc-doc-grid">
                            {/* Left Col: Icon + Label + Badges + File meta */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  background: isVerified ? "#F0FDF4" : isRejected ? "#FEF2F2" : "#FFF7ED",
                                  border: "1px solid #E2E8F0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0
                                }}
                              >
                                <FileText size={20} color={isVerified ? "#16A34A" : isRejected ? "#DC2626" : "#EA580C"} />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                                    {resolved.label}
                                  </span>
                                  {isMandatory ? (
                                    <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", padding: "1px 6px", borderRadius: 4 }}>
                                      Mandatory
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 600, background: "#F1F5F9", color: "#64748B", padding: "1px 6px", borderRadius: 4 }}>
                                      Optional
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                                  <span style={{ color: "#334155", fontFamily: "monospace" }}>{resolved.cleanFileName}</span>
                                  {doc.file_size ? ` • ${(parseInt(doc.file_size) / 1024).toFixed(1)} KB` : ""}
                                  {doc.created_at ? ` • Uploaded ${new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                                </div>
                              </div>
                            </div>

                            {/* Right Col: Individual Status & Action Buttons (Rigid Horizontal Alignment) */}
                            <div className="kyc-doc-actions-align">
                              {isVerified ? (
                                <span style={{ background: "#DCFCE7", color: "#166534", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <CheckCircle size={13} /> Verified
                                </span>
                              ) : isRejected ? (
                                <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <AlertTriangle size={13} /> Rejected / Re-upload Required
                                </span>
                              ) : isReuploaded ? (
                                <span style={{ background: "#EFF6FF", color: "#1E40AF", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <RotateCcw size={13} /> Re-uploaded
                                </span>
                              ) : (
                                <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={13} /> Pending Review
                                </span>
                              )}

                              {/* View Document Button */}
                              <button
                                type="button"
                                style={{
                                  border: "none",
                                  background: "#0F172A",
                                  color: "#FFFFFF",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  transition: "all 0.15s ease"
                                }}
                                onClick={() => setPreviewDoc(doc)}
                                title="View uploaded document in preview viewer"
                              >
                                <Eye size={13} /> View
                              </button>

                              {/* Verify Document Button */}
                              {canApprove && !isVerified && (
                                <button
                                  type="button"
                                  style={{
                                    border: "none",
                                    background: "#16A34A",
                                    color: "#FFFFFF",
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                  onClick={() => handleVerifySingleDocument(doc)}
                                  title="Mark this document as verified"
                                >
                                  <CheckCircle size={13} /> Verify
                                </button>
                              )}

                              {/* Reject Document Button */}
                              {canReject && !isRejected && (
                                <button
                                  type="button"
                                  style={{
                                    border: "1px solid #FCA5A5",
                                    background: "#FEF2F2",
                                    color: "#DC2626",
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                  onClick={() => {
                                    setRejectDocTarget(doc);
                                    setDocRejectReason("");
                                    setDocRejectError(null);
                                  }}
                                  title="Reject document and request re-upload"
                                >
                                  <X size={13} /> Reject
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Rejection reason details callout */}
                          {isRejected && doc.rejection_reason && (
                            <div style={{ marginTop: 6, padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#991B1B", display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <AlertCircle size={15} color="#DC2626" style={{ marginTop: 1, flexShrink: 0 }} />
                              <div>
                                <strong>Rejection Reason:</strong> {doc.rejection_reason}
                                <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 2 }}>
                                  Client has been requested to re-upload a compliant copy via their mobile app.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: 24, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 10, fontSize: 13, color: "#64748B", textAlign: "center" }}>
                    <FileText size={28} color="#94A3B8" style={{ marginBottom: 6 }} />
                    <div style={{ fontWeight: 600, color: "#334155" }}>No separate KYC files uploaded</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>Registration was submitted via authenticated mobile phone.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="kyc-modal-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn-filter-reset"
                  onClick={() => setReviewingClient(null)}
                >
                  Close
                </button>

                {canReject && reviewingClient.status !== "REJECTED" && (
                  <button
                    type="button"
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #FCA5A5",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                    onClick={() => {
                      const target = reviewingClient;
                      setReviewingClient(null);
                      setRejectModalClient(target);
                      setRejectionReasonInput("");
                      setRejectionInputError(null);
                    }}
                  >
                    <X size={15} /> Reject Application
                  </button>
                )}
              </div>

              {canApprove && (reviewingClient.status === "PENDING_APPROVAL" || reviewingClient.status === "PENDING") && (() => {
                const eligibility = checkClientApprovalEligibility(reviewingClient.documents_list);
                return (
                  <button
                    type="button"
                    disabled={!eligibility.isEligible || actionLoading}
                    title={!eligibility.isEligible ? eligibility.summaryMessage : "Approve client registration"}
                    style={{
                      padding: "9px 22px",
                      borderRadius: 8,
                      border: "none",
                      background: eligibility.isEligible ? "#16A34A" : "#94A3B8",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: eligibility.isEligible ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: eligibility.isEligible ? "0 2px 8px rgba(22, 163, 74, 0.25)" : "none",
                      opacity: eligibility.isEligible ? 1 : 0.65
                    }}
                    onClick={() => {
                      const target = reviewingClient;
                      setReviewingClient(null);
                      setApprovalModalClient(target);
                    }}
                  >
                    <CheckCircle size={15} /> Approve Registration
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ── */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          documentTitle={resolveClientDocumentType(previewDoc).label}
          fileName={resolveClientDocumentType(previewDoc).cleanFileName}
          fileUrlOrPath={previewDoc.storage_path || previewDoc.file_url}
          verificationStatus={previewDoc.verification_status}
          rejectionReason={previewDoc.rejection_reason}
          uploadedAt={previewDoc.created_at}
          fileSize={previewDoc.file_size}
          onVerify={() => handleVerifySingleDocument(previewDoc)}
          onReject={() => {
            const target = previewDoc;
            setRejectDocTarget(target);
            setDocRejectReason("");
            setDocRejectError(null);
          }}
          canVerify={canApprove}
          canReject={canReject}
        />
      )}

      {/* ── Individual Document Rejection Dialog ── */}
      {rejectDocTarget && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 10001 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, maxWidth: 480, width: "90%", padding: 24, boxShadow: "0 20px 45px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <AlertTriangle size={24} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
              Reject Document & Request Re-upload
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px", lineHeight: 1.5 }}>
              Explain why <strong>{resolveClientDocumentType(rejectDocTarget).label}</strong> is rejected. The client will be notified in the mobile app with this reason and prompted to re-upload.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                value={docRejectReason}
                onChange={(e) => {
                  setDocRejectReason(e.target.value);
                  if (docRejectError) setDocRejectError(null);
                }}
                placeholder="e.g. Scanned copy is illegible/blurry. Please re-upload a clear original GST REG-06 certificate."
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: docRejectError ? "1px solid #DC2626" : "1px solid #CBD5E1",
                  padding: 10,
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical"
                }}
              />
              {docRejectError && (
                <p style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>{docRejectError}</p>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn-filter-reset"
                onClick={() => {
                  setRejectDocTarget(null);
                  setDocRejectReason("");
                  setDocRejectError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleRejectSingleDocument(rejectDocTarget, docRejectReason)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: actionLoading ? "not-allowed" : "pointer"
                }}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Client Approval Confirmation Modal ── */}
      {approvalModalClient && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, maxWidth: 480, width: "90%", padding: 24, boxShadow: "0 20px 45px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <CheckCircle size={26} color="#16A34A" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
              Approve Client Registration?
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: "0 0 16px" }}>
              Are you sure you want to approve <strong>{approvalModalClient.company_name}</strong>?
              This will update their status to <strong>APPROVED</strong> immediately, grant real-time access to the client portal, and update audit logs.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                disabled={actionLoading}
                onClick={() => setApprovalModalClient(null)}
                className="btn-filter-reset"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleApproveClient(approvalModalClient)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#16A34A", color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {actionLoading ? "Approving..." : "Yes, Approve Registration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Client Rejection Modal with Mandatory Reason ── */}
      {rejectModalClient && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, maxWidth: 520, width: "90%", padding: 24, boxShadow: "0 20px 45px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <AlertCircle size={26} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
              Reject Client Registration
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
              Rejecting <strong>{rejectModalClient.company_name}</strong>. A clear rejection reason is strictly required. This reason will be recorded in the database.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Rejection Reason (Required) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={rejectionReasonInput}
                onChange={(e) => {
                  setRejectionReasonInput(e.target.value);
                  if (rejectionInputError) setRejectionInputError(null);
                }}
                placeholder="e.g., GST certificate expired, business PAN does not match trade name, or address verification failed."
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 13,
                  borderRadius: 8,
                  border: rejectionInputError ? "1px solid #DC2626" : "1px solid #CBD5E1",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              {rejectionInputError && (
                <span style={{ fontSize: 12, color: "#DC2626", marginTop: 4, display: "block" }}>
                  {rejectionInputError}
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                disabled={actionLoading}
                onClick={() => {
                  setRejectModalClient(null);
                  setRejectionReasonInput("");
                  setRejectionInputError(null);
                }}
                className="btn-filter-reset"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !rejectionReasonInput.trim()}
                onClick={() => handleRejectClient(rejectModalClient, rejectionReasonInput)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: !rejectionReasonInput.trim() ? "#CBD5E1" : "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: !rejectionReasonInput.trim() ? "not-allowed" : "pointer"
                }}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Approve Modal ── */}
      {showBulkApproveModal && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, maxWidth: 480, width: "90%", padding: 24, boxShadow: "0 20px 45px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <CheckCircle size={26} color="#16A34A" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
              Approve {selectedRows.size} Selected Clients?
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: "0 0 16px" }}>
              This will update the registration status of all {selectedRows.size} selected clients to <strong>APPROVED</strong> in the database and activate their portals.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                disabled={actionLoading}
                onClick={() => setShowBulkApproveModal(false)}
                className="btn-filter-reset"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleBulkApprove}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#16A34A", color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {actionLoading ? "Approving..." : `Yes, Approve (${selectedRows.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Reject Modal ── */}
      {showBulkRejectModal && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, maxWidth: 520, width: "90%", padding: 24, boxShadow: "0 20px 45px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <AlertCircle size={26} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
              Bulk Reject {selectedRows.size} Clients
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
              Provide a rejection reason to be saved for all {selectedRows.size} selected clients.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Rejection Reason (Required) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                rows={4}
                value={bulkRejectionReason}
                onChange={(e) => {
                  setBulkRejectionReason(e.target.value);
                  if (bulkRejectionError) setBulkRejectionError(null);
                }}
                placeholder="e.g., Bulk application review failed: incomplete compliance documents or unverified registered entities."
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 13,
                  borderRadius: 8,
                  border: bulkRejectionError ? "1px solid #DC2626" : "1px solid #CBD5E1",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              {bulkRejectionError && (
                <span style={{ fontSize: 12, color: "#DC2626", marginTop: 4, display: "block" }}>
                  {bulkRejectionError}
                </span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                disabled={actionLoading}
                onClick={() => setShowBulkRejectModal(false)}
                className="btn-filter-reset"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !bulkRejectionReason.trim()}
                onClick={handleBulkReject}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: !bulkRejectionReason.trim() ? "#CBD5E1" : "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: !bulkRejectionReason.trim() ? "not-allowed" : "pointer"
                }}
              >
                {actionLoading ? "Rejecting..." : `Reject ${selectedRows.size} Clients`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Suspend / Reactivate Modal ── */}
      {confirmStatusClient && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div className="confirm-dialog" style={{ background: "#FFFFFF", border: "1px solid #CBD5E1" }}>
            <div className="confirm-dialog-icon">
              <AlertCircle size={44} color="#F05A22" />
            </div>
            <h3 className="confirm-dialog-title" style={{ color: "#0F172A" }}>
              {confirmStatusClient.status === "ACTIVE" ? "Suspend Client Account?" : "Reactivate Client Account?"}
            </h3>
            <p className="confirm-dialog-desc" style={{ color: "#64748B" }}>
              {confirmStatusClient.status === "ACTIVE"
                ? `Are you sure you want to suspend "${confirmStatusClient.company_name}"? Their account access will be deactivated immediately.`
                : `Are you sure you want to reactivate "${confirmStatusClient.company_name}"?`}
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel-modal"
                disabled={actionLoading}
                onClick={() => setConfirmStatusClient(null)}
              >
                Cancel
              </button>
              <button
                className="btn-submit-modal"
                style={{
                  background: confirmStatusClient.status === "ACTIVE" ? "#DC2626" : "#16A34A",
                  color: "#FFFFFF"
                }}
                disabled={actionLoading}
                onClick={() => handleToggleStatus(confirmStatusClient)}
              >
                {actionLoading
                  ? "Updating..."
                  : confirmStatusClient.status === "ACTIVE"
                  ? "Yes, Suspend Account"
                  : "Yes, Reactivate Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Fixed Action Menu (Decoupled from table container to prevent ANY clipping) ── */}
      {menuAnchor && (() => {
        const activeClient = clients.find((c) => c.id === menuAnchor.id);
        if (!activeClient) return null;
        return (
          <div
            className={`client-actions-dropdown more-dropdown ${menuAnchor.isDropup ? "dropup" : ""}`}
            role="menu"
            style={{
              position: "fixed",
              top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
              bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
              right: `${menuAnchor.right}px`,
              zIndex: 9999,
              minWidth: 220,
              background: "#FFFFFF",
              borderRadius: 10,
              border: "1px solid #CBD5E1",
              boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.25), 0 8px 10px -6px rgba(15, 23, 42, 0.15)",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              textAlign: "left",
            }}
          >
            {/* View Details */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setSelectedClientId(activeClient.id);
                setIsDrawerOpen(true);
              }}
            >
              <Eye size={14} />
              <span>View Details</span>
            </button>

            {/* Review KYC Documents */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setReviewingClient(activeClient);
              }}
            >
              <ShieldCheck size={14} />
              <span>Review KYC Documents</span>
            </button>

            {/* Approve Application (if pending and permitted) */}
            {canApprove && (activeClient.status === "PENDING_APPROVAL" || activeClient.status === "PENDING") && (
              <button
                type="button"
                role="menuitem"
                className="dropdown-item-approve"
                style={{ color: "#16A34A" }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  const eligibility = checkClientApprovalEligibility(activeClient.documents_list);
                  if (!eligibility.isEligible) {
                    setReviewingClient(activeClient);
                    setToastMessage(`Review required: ${eligibility.summaryMessage}`);
                    setTimeout(() => setToastMessage(null), 4500);
                  } else {
                    setApprovalModalClient(activeClient);
                  }
                }}
              >
                <CheckCircle size={14} />
                <span>Approve Application</span>
              </button>
            )}

            {/* Reject Application (if permitted and not rejected) */}
            {canReject && activeClient.status !== "REJECTED" && (
              <button
                type="button"
                role="menuitem"
                className="dropdown-item-reject"
                style={{ color: "#DC2626" }}
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setRejectModalClient(activeClient);
                  setRejectionReasonInput("");
                  setRejectionInputError(null);
                }}
              >
                <X size={14} />
                <span>Reject Application</span>
              </button>
            )}

            {/* View Booking History */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                onNavigateToProfile(activeClient.id);
              }}
            >
              <FileText size={14} />
              <span>View Booking History</span>
            </button>

            {/* Edit Client */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAnchor(null);
                setOpenActionMenuId(null);
                setEditingClient(activeClient);
                setEditFormData({
                  company_name: activeClient.company_name,
                  primary_contact_name: activeClient.primary_contact_name || "",
                  primary_contact_phone: activeClient.primary_contact_phone?.replace(/\D/g, "").slice(-10) || "",
                  primary_contact_email: activeClient.company_email || activeClient.primary_contact_email || "",
                  city: activeClient.city || "",
                  registered_address: activeClient.registered_address || "",
                  gstin: activeClient.gstin || "",
                  client_type: activeClient.client_type || "Private Limited",
                });
                setEditFormError(null);
              }}
            >
              <Edit2 size={14} />
              <span>Edit Client</span>
            </button>

            {/* Suspend / Reactivate */}
            {canSuspend && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAnchor(null);
                  setOpenActionMenuId(null);
                  setConfirmStatusClient(activeClient);
                }}
              >
                <UserMinus size={14} />
                <span>{activeClient.status === "ACTIVE" ? "Suspend Account" : "Reactivate Account"}</span>
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ClientDirectory;
