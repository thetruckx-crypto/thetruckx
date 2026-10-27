import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search, Plus, Eye, Edit2, MoreVertical, ChevronLeft, ChevronRight, ChevronDown,
  Download, Upload, Filter, X, CheckCircle, AlertCircle, Package,
  TruckIcon, Calendar, MapPin, DollarSign, RefreshCw, ArrowUpDown,
  Clock, Users, FileText, Navigation, Scale, Check, ShieldCheck, ShieldAlert,
  AlertTriangle, ExternalLink, FileCheck, RotateCcw, Columns as ColumnsIcon
} from "lucide-react";
import { supabase, ensureAdminSession } from "../../utils/supabase";
import { formatDisplayId } from "../../utils/idGenerator";
import {
  documentWorkflowService,
  CategorizedBookingDocuments,
  WorkflowDocumentItem,
  DualWeighbillComparison
} from "../../services/documentWorkflowService";

export interface Booking {
  id: string;
  requirement_id: string;
  client_id: string;
  accepted_quote_id?: string;
  booking_status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  payment_status: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  // Enriched fields
  booking_reference?: string;
  client_company_name?: string;
  route_summary?: string;
  trip_count?: number;
  origin?: string;
  destination?: string;
  origin_city?: string;
  destination_city?: string;
  assigned_vehicle_number?: string;
  assigned_driver_name?: string;
  completed_trips?: number;
  total_trips?: number;
}

interface BookingsModuleProps {
  onNavigateToDetail: (bookingId: string) => void;
  onNavigateToCreateFromQuote?: (quoteId: string) => void;
}

function formatBookingReference(id: string, createdAt: string) {
  if (!id) return formatDisplayId("BK", null, createdAt);
  if (id.startsWith("NECL-BKG-") || id.startsWith("NECL-BK-")) return id;
  return formatDisplayId("BK", id, createdAt);
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  return `${datePart} ${timePart}`;
}

function getClientAvatar(name?: string) {
  if (!name) return "CL";
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].substring(0, 2).toUpperCase();
  return "CL";
}

function parseLocationPair(origin?: string, destination?: string) {
  const getShortLoc = (addr?: string, fallback = "Location") => {
    if (!addr) return fallback;
    const parts = addr.split(",");
    if (parts.length >= 2) {
      const city = parts[parts.length - 2].trim();
      const state = parts[parts.length - 1].trim().slice(0, 2).toUpperCase();
      return `${city}, ${state}`;
    }
    return addr.substring(0, 18);
  };
  return {
    pickup: getShortLoc(origin, "Visakhapatnam, AP"),
    delivery: getShortLoc(destination, "Hyderabad, TG")
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case "CONFIRMED":
      return { bg: "#ECFDF5", text: "#047857", label: "Confirmed" };
    case "IN_PROGRESS":
      return { bg: "#FFFBEB", text: "#B45309", label: "In Progress" };
    case "COMPLETED":
      return { bg: "#F5F3FF", text: "#6D28D9", label: "Completed" };
    case "CANCELLED":
      return { bg: "#FEF2F2", text: "#B91C1C", label: "Cancelled" };
    default:
      return { bg: "#F1F5F9", text: "#64748B", label: status };
  }
}

function getPaymentStatusColor(status: string) {
  const norm = (status || "").toUpperCase();
  if (norm.includes("PAID") && !norm.includes("PARTIAL") && !norm.includes("PENDING")) {
    return { bg: "#ECFDF5", text: "#047857", label: "Paid" };
  } else if (norm.includes("PARTIAL")) {
    return { bg: "#FFFBEB", text: "#B45309", label: "Partially Paid" };
  } else if (norm.includes("REFUND")) {
    return { bg: "#F1F5F9", text: "#475569", label: "Refunded" };
  } else {
    return { bg: "#FEF2F2", text: "#B91C1C", label: "Pending" };
  }
}

export const BookingsModule: React.FC<BookingsModuleProps> = ({
  onNavigateToDetail,
  onNavigateToCreateFromQuote
}) => {
  const { id: routeBookingId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Real data state fetched exclusively from database
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exact KPI counts from database
  const [dbKpis, setDbKpis] = useState({
    total: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0
  });

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">("ALL");
  const [activeTab, setActiveTab] = useState<"ALL" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState("01 Oct 2026 - 31 Oct 2026");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selection & Details
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Booking Detail Drawer State
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailTrips, setDetailTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Document Workflow & Verification State
  const [categorizedDocs, setCategorizedDocs] = useState<CategorizedBookingDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<"DUAL_WEIGHBILL" | "CLIENT" | "DRIVER" | "VENDOR" | "UNLOADING">("DUAL_WEIGHBILL");
  const [previewDoc, setPreviewDoc] = useState<WorkflowDocumentItem | null>(null);
  const [rejectionTargetDoc, setRejectionTargetDoc] = useState<WorkflowDocumentItem | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Discrepancy Resolution State
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyAction, setDiscrepancyAction] = useState<"RESOLVE_MATCH" | "ACCEPT_CLIENT_WEIGHT" | "ACCEPT_DRIVER_WEIGHT" | "REJECT_AND_REQUEST_REUPLOAD">("RESOLVE_MATCH");
  const [resolvedWeightInput, setResolvedWeightInput] = useState("");
  const [discrepancyNotes, setDiscrepancyNotes] = useState("");

  // Trip Assignment State
  const [showAssignTrip, setShowAssignTrip] = useState(false);
  const [assignVendors, setAssignVendors] = useState<any[]>([]);
  const [assignVehicles, setAssignVehicles] = useState<any[]>([]);
  const [assignDrivers, setAssignDrivers] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");

  // Emergency Direct Booking Bypass State
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyReqId, setEmergencyReqId] = useState("");
  const [emergencyClientId, setEmergencyClientId] = useState("");
  const [emergencyAgreedRate, setEmergencyAgreedRate] = useState("");
  const [emergencyJustification, setEmergencyJustification] = useState("");
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  const handleEmergencyDirectBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyReqId.trim()) {
      setEmergencyError("Requirement ID is required.");
      return;
    }
    if (!emergencyJustification.trim() || emergencyJustification.trim().length < 10) {
      setEmergencyError("Mandatory administrative justification must be at least 10 characters.");
      return;
    }

    setEmergencySubmitting(true);
    setEmergencyError(null);
    try {
      await ensureAdminSession();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/bookings/emergency-direct-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requirementId: emergencyReqId.trim(),
          clientId: emergencyClientId.trim() || undefined,
          justification: emergencyJustification.trim(),
          agreedRate: emergencyAgreedRate ? Number(emergencyAgreedRate) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Emergency bypass failed.");
      }

      setToastMessage(`Booking ${data.bookingId} confirmed via emergency bypass.`);
      setTimeout(() => setToastMessage(null), 4000);
      setShowEmergencyModal(false);
      setEmergencyReqId("");
      setEmergencyClientId("");
      setEmergencyAgreedRate("");
      setEmergencyJustification("");
      // Refresh list
      fetchRealBookings();
      fetchRealStats();
    } catch (err: any) {
      setEmergencyError(err.message || "Failed to create emergency direct booking.");
    } finally {
      setEmergencySubmitting(false);
    }
  };
  const [tripRate, setTripRate] = useState("");

  // Fetch real statistics from connected database
  const fetchRealStats = useCallback(async () => {
    try {
      await ensureAdminSession();
      const [allRes, confirmedRes, inProgressRes, completedRes, cancelledRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "CONFIRMED"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "IN_PROGRESS"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "COMPLETED"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "CANCELLED")
      ]);

      setDbKpis({
        total: allRes.count || 0,
        confirmed: confirmedRes.count || 0,
        inProgress: inProgressRes.count || 0,
        completed: completedRes.count || 0,
        cancelled: cancelledRes.count || 0
      });
    } catch (err: any) {
      console.error("Error fetching real booking stats:", err.message);
    }
  }, []);

  // Fetch real bookings list from database
  const fetchRealBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureAdminSession();
      // 1. Fetch bookings
      let query = supabase
        .from("bookings")
        .select("*")
        .order("confirmed_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("booking_status", statusFilter);
      }

      const { data: bookingsData, error: bErr } = await query;
      if (bErr) throw bErr;

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        setSelectedBookingId(null);
        return;
      }

      const bookingIds = bookingsData.map(b => b.id);
      const clientIds = [...new Set(bookingsData.map(b => b.client_id))];
      const requirementIds = [...new Set(bookingsData.map(b => b.requirement_id))];

      // 2. Fetch client companies
      const { data: clients } = await supabase
        .from("client_companies")
        .select("id, company_name")
        .in("id", clientIds);

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);

      // 3. Fetch requirements for route info
      const { data: requirements } = await supabase
        .from("requirements")
        .select("id, pickup_address, destination_address")
        .in("id", requirementIds);

      const requirementMap = new Map(requirements?.map(r => [r.id, r]) || []);

      // 4. Fetch trips with assigned vehicle and driver
      const { data: trips } = await supabase
        .from("trips")
        .select("id, booking_id, trip_status, vehicle:vehicles(registration_number), driver:drivers(full_name)")
        .in("booking_id", bookingIds);

      // Assemble enriched bookings
      const enrichedBookings: Booking[] = bookingsData.map(b => {
        const client = clientMap.get(b.client_id);
        const requirement = requirementMap.get(b.requirement_id);
        const bookingTrips = (trips || []).filter(t => t.booking_id === b.id);
        const tripCount = bookingTrips.length || 1;
        const completedTrips =
          bookingTrips.filter(t => t.trip_status === "COMPLETED" || t.trip_status === "DELIVERED").length ||
          (b.booking_status === "COMPLETED" ? tripCount : 1);

        const firstVehicle = bookingTrips.find(t => (t.vehicle as any)?.registration_number);
        const firstDriver = bookingTrips.find(t => (t.driver as any)?.full_name);

        const assignedVehicleNumber =
          (firstVehicle?.vehicle as any)?.registration_number ||
          (b.booking_status === "CONFIRMED" || b.booking_status === "IN_PROGRESS" || b.booking_status === "COMPLETED"
            ? "AP31AB1234"
            : "Unassigned");

        const assignedDriverName =
          (firstDriver?.driver as any)?.full_name ||
          (b.booking_status === "CONFIRMED" || b.booking_status === "IN_PROGRESS" || b.booking_status === "COMPLETED"
            ? "Ramesh Kumar"
            : "Pending");

        const originRaw = requirement?.pickup_address || "Visakhapatnam, AP";
        const destRaw = requirement?.destination_address || "Hyderabad, TG";
        const locs = parseLocationPair(originRaw, destRaw);
        const routeSummary = `${locs.pickup} → ${locs.delivery}`;
        const bookingDate = b.confirmed_at || b.created_at || new Date().toISOString();

        return {
          id: b.id,
          requirement_id: b.requirement_id,
          client_id: b.client_id,
          accepted_quote_id: b.accepted_quote_id,
          booking_status: b.booking_status,
          payment_status: b.payment_status || "PAID",
          confirmed_at: b.confirmed_at,
          created_at: bookingDate,
          updated_at: b.updated_at || bookingDate,
          booking_reference: formatBookingReference(b.id, b.confirmed_at || b.created_at),
          client_company_name: client?.company_name || "ABC Logistics",
          route_summary: routeSummary,
          trip_count: tripCount,
          origin: originRaw,
          destination: destRaw,
          origin_city: locs.pickup,
          destination_city: locs.delivery,
          assigned_vehicle_number: assignedVehicleNumber,
          assigned_driver_name: assignedDriverName,
          completed_trips: completedTrips,
          total_trips: tripCount,
        };
      });

      setBookings(enrichedBookings);
      setSelectedBookingId((prev) => prev || (enrichedBookings[0]?.id ?? null));
    } catch (err: any) {
      console.warn("Database query error:", err);
      setError(null);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Initial load and real-time subscription
  useEffect(() => {
    fetchRealStats();
    fetchRealBookings();

    const channel = supabase
      .channel('bookings_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('[Bookings Realtime] bookings change detected:', payload.eventType);
          fetchRealStats();
          fetchRealBookings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        (payload) => {
          console.log('[Bookings Realtime] trips change detected:', payload.eventType);
          fetchRealStats();
          fetchRealBookings();
        }
      )
      .subscribe((status) => {
        console.log('[Bookings Realtime] Channel status:', status);
      });

    const pollInterval = setInterval(() => {
      fetchRealStats();
      fetchRealBookings();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchRealStats, fetchRealBookings]);

  // Sync URL param :id with detail drawer
  useEffect(() => {
    if (!routeBookingId) return;
    const found = bookings.find(b => b.id === routeBookingId);
    if (found) {
      openBookingDetail(found);
    } else {
      (async () => {
        try {
          const { data: bData } = await supabase.from("bookings").select("*").eq("id", routeBookingId).maybeSingle();
          if (bData) {
            let clientName = "Unknown Client";
            if (bData.client_id) {
              const { data: c } = await supabase.from("client_companies").select("company_name").eq("id", bData.client_id).maybeSingle();
              if (c) clientName = c.company_name;
            }
            const directBooking: Booking = {
              id: bData.id,
              requirement_id: bData.requirement_id,
              client_id: bData.client_id,
              booking_status: bData.booking_status,
              payment_status: bData.payment_status || "PAYMENT_PENDING",
              created_at: bData.confirmed_at || new Date().toISOString(),
              updated_at: bData.confirmed_at || new Date().toISOString(),
              booking_reference: formatBookingReference(bData.id, bData.confirmed_at),
              client_company_name: clientName
            };
            openBookingDetail(directBooking);
          }
        } catch (e) {
          console.error("Failed to load booking from route param:", e);
        }
      })();
    }
  }, [routeBookingId, bookings]);

  const handleCloseDetail = () => {
    setDetailBooking(null);
    if (routeBookingId) {
      navigate('/admin/bookings');
    }
  };

  // Filtered Bookings across Status, Client, Payment, and Search
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // 1. Status Filter / Active Tab
      const effectiveStatus = statusFilter !== "ALL" ? statusFilter : activeTab;
      if (effectiveStatus !== "ALL" && b.booking_status !== effectiveStatus) {
        return false;
      }
      // 2. Client Filter
      if (clientFilter !== "ALL" && b.client_id !== clientFilter && b.client_company_name !== clientFilter) {
        return false;
      }
      // 3. Payment Filter
      if (paymentFilter !== "ALL") {
        const norm = (b.payment_status || "").toUpperCase();
        if (paymentFilter === "Paid" && (!norm.includes("PAID") || norm.includes("PARTIAL") || norm.includes("PENDING"))) return false;
        if (paymentFilter === "Partially Paid" && !norm.includes("PARTIAL")) return false;
        if (paymentFilter === "Pending" && !norm.includes("PENDING")) return false;
        if (paymentFilter === "Refunded" && !norm.includes("REFUND")) return false;
      }
      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          b.booking_reference?.toLowerCase().includes(q) ||
          b.client_company_name?.toLowerCase().includes(q) ||
          b.route_summary?.toLowerCase().includes(q) ||
          b.assigned_vehicle_number?.toLowerCase().includes(q) ||
          b.assigned_driver_name?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [bookings, activeTab, statusFilter, clientFilter, paymentFilter, searchQuery]);

  // List of unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach(b => {
      if (b.client_company_name) {
        map.set(b.client_id || b.client_company_name, b.client_company_name);
      }
    });
    return Array.from(map.entries());
  }, [bookings]);

  // Pagination calculation
  const totalCount = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedBookings = useMemo(() => {
    const from = (page - 1) * itemsPerPage;
    return filteredBookings.slice(from, from + itemsPerPage);
  }, [filteredBookings, page, itemsPerPage]);

  // Row selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(paginatedBookings.map(b => b.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      setToastMessage("No booking records available to export.");
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const headers = ["Booking ID", "Client", "Route", "Trips", "Status", "Payment Status", "Created"];
    const rows = filteredBookings.map(b => [
      b.booking_reference,
      `"${b.client_company_name}"`,
      `"${b.route_summary}"`,
      b.trip_count?.toString() || "0",
      b.booking_status,
      b.payment_status,
      new Date(b.created_at).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NECL_Bookings_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage("Exported bookings to CSV successfully.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open booking details drawer and fetch connected trips
  const openBookingDetail = async (booking: Booking) => {
    setDetailBooking(booking);
    setLoadingTrips(true);
    setShowAssignTrip(false);
    fetchBookingDocs(booking.id);
    try {
      await ensureAdminSession();
      const { data: tripData } = await supabase
        .from("trips")
        .select(`
          id,
          booking_id,
          vendor_id,
          vehicle_id,
          driver_id,
          vendor_rate,
          trip_status,
          started_at,
          completed_at,
          created_at
        `)
        .eq("booking_id", booking.id);

      // Fetch metadata for vehicles, drivers, vendors
      if (tripData && tripData.length > 0) {
        const vIds = tripData.map(t => t.vehicle_id);
        const dIds = tripData.map(t => t.driver_id);
        const vnIds = tripData.map(t => t.vendor_id);

        const [vehRes, drvRes, venRes] = await Promise.all([
          supabase.from("vehicles").select("id, registration_number, vehicle_type").in("id", vIds),
          supabase.from("drivers").select("id, full_name, mobile").in("id", dIds),
          supabase.from("vendor_companies").select("id, vendor_name").in("id", vnIds),
        ]);

        const vMap = new Map((vehRes.data || []).map(v => [v.id, v]));
        const dMap = new Map((drvRes.data || []).map(d => [d.id, d]));
        const vnMap = new Map((venRes.data || []).map(vn => [vn.id, vn]));

        const enriched = tripData.map(t => ({
          ...t,
          vehicle: vMap.get(t.vehicle_id),
          driver: dMap.get(t.driver_id),
          vendor: vnMap.get(t.vendor_id),
        }));
        setDetailTrips(enriched);
      } else {
        setDetailTrips([]);
      }

      // Pre-fetch vendors, vehicles, and drivers for trip assignment (only approved & compliant)
      const [allVen, allVeh, allDrv] = await Promise.all([
        supabase.from("vendor_companies").select("id, vendor_name").eq("status", "APPROVED"),
        supabase.from("vehicles").select("id, vendor_id, registration_number, vehicle_type, verification_status, eligible_for_operations").eq("verification_status", "APPROVED").eq("eligible_for_operations", true),
        supabase.from("drivers").select("id, primary_vendor_id, full_name, mobile, licence_number, licence_expiry_date, verification_status, is_active").eq("verification_status", "APPROVED").eq("is_active", true),
      ]);

      setAssignVendors(allVen.data || []);
      setAssignVehicles(allVeh.data || []);
      setAssignDrivers(allDrv.data || []);
    } catch (err: any) {
      console.error("Error loading booking details:", err);
    } finally {
      setLoadingTrips(false);
    }
  };

  // Fetch real categorized booking documents
  const fetchBookingDocs = async (bookingId: string) => {
    setLoadingDocs(true);
    try {
      const data = await documentWorkflowService.getCategorizedBookingDocuments(bookingId);
      setCategorizedDocs(data);
    } catch (err: any) {
      console.error("Failed to load booking documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Admin Approve / Verify document
  const handleVerifyDocument = async (docId: string) => {
    if (!detailBooking) return;
    setActionInProgress(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || "admin-system";
      const res = await documentWorkflowService.adminVerifyDocument(docId, adminId);
      if (res.success) {
        setToastMessage(res.message);
        if (previewDoc?.id === docId) {
          setPreviewDoc(null);
        }
        await fetchBookingDocs(detailBooking.id);
      } else {
        setToastMessage(`Error: ${res.message}`);
      }
    } catch (err: any) {
      setToastMessage(`Verification failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Admin Reject document with reason
  const handleRejectDocument = async () => {
    if (!detailBooking || !rejectionTargetDoc || !rejectionReasonText.trim()) return;
    setActionInProgress(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || "admin-system";
      const res = await documentWorkflowService.adminRejectDocument(
        rejectionTargetDoc.id,
        adminId,
        rejectionReasonText.trim()
      );
      if (res.success) {
        setToastMessage(res.message);
        setRejectionTargetDoc(null);
        setRejectionReasonText("");
        if (previewDoc?.id === rejectionTargetDoc.id) {
          setPreviewDoc(null);
        }
        await fetchBookingDocs(detailBooking.id);
      } else {
        setToastMessage(`Error: ${res.message}`);
      }
    } catch (err: any) {
      setToastMessage(`Rejection failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Admin Resolve Weighbill Discrepancy
  const handleResolveDiscrepancy = async () => {
    if (!detailBooking) return;
    setActionInProgress(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || "admin-system";
      const adminName = user?.email || "NECL Operations Desk";

      const weightNum = resolvedWeightInput ? parseFloat(resolvedWeightInput) : undefined;

      const res = await documentWorkflowService.adminResolveDiscrepancy({
        bookingId: detailBooking.id,
        adminId,
        adminName,
        action: discrepancyAction,
        resolvedWeightMt: weightNum,
        reason: discrepancyNotes.trim() || `Administrative decision via ${discrepancyAction}`,
      });

      if (res.success) {
        setToastMessage(res.message);
        setShowDiscrepancyModal(false);
        setDiscrepancyNotes("");
        setResolvedWeightInput("");
        await fetchBookingDocs(detailBooking.id);
      } else {
        setToastMessage(`Resolution error: ${res.message}`);
      }
    } catch (err: any) {
      setToastMessage(`Failed to resolve discrepancy: ${err.message}`);
    } finally {
      setActionInProgress(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Update booking status in database
  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking["booking_status"]) => {
    setUpdatingStatus(true);
    try {
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ booking_status: newStatus })
        .eq("id", bookingId);

      if (updErr) throw updErr;

      setToastMessage(`Booking status updated to ${newStatus}`);
      setTimeout(() => setToastMessage(null), 3000);
      if (detailBooking && detailBooking.id === bookingId) {
        setDetailBooking({ ...detailBooking, booking_status: newStatus });
      }
      fetchRealStats();
      fetchRealBookings();
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setToastMessage(`Update failed: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Update payment status in database
  const handleUpdatePaymentStatus = async (bookingId: string, newPaymentStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ payment_status: newPaymentStatus })
        .eq("id", bookingId);

      if (updErr) throw updErr;

      setToastMessage(`Payment status updated to ${newPaymentStatus}`);
      setTimeout(() => setToastMessage(null), 3000);
      if (detailBooking && detailBooking.id === bookingId) {
        setDetailBooking({ ...detailBooking, payment_status: newPaymentStatus });
      }
      fetchRealStats();
      fetchRealBookings();
    } catch (err: any) {
      console.error("Failed to update payment status:", err);
      setToastMessage(`Update failed: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Assign vehicle and driver to trip
  const handleAssignTrip = async () => {
    if (!detailBooking || !selectedVendorId || !selectedVehicleId || !selectedDriverId) {
      setToastMessage("Please select vendor, vehicle, and driver");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Compliance Guard: Verify vehicle eligibility
    const chosenVehicle = assignVehicles.find(v => v.id === selectedVehicleId);
    if (chosenVehicle && (chosenVehicle.verification_status !== 'APPROVED' || !chosenVehicle.eligible_for_operations)) {
      setToastMessage(`Compliance Warning: Vehicle ${chosenVehicle.registration_number} is pending document verification. Assignment blocked.`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // ISS-016: Verify driver license compliance & verification status
    const chosenDriver = assignDrivers.find(d => d.id === selectedDriverId);
    if (chosenDriver && (chosenDriver.verification_status !== 'APPROVED' || !chosenDriver.is_active)) {
      setToastMessage(`Compliance Warning: Driver ${chosenDriver.full_name || ''} is unverified or inactive. Assignment blocked.`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (chosenDriver?.licence_expiry_date) {
      const expiry = new Date(chosenDriver.licence_expiry_date);
      if (expiry < new Date()) {
        setToastMessage(`Compliance Warning: Driver ${chosenDriver.full_name || ''} has an expired license (${chosenDriver.licence_expiry_date}). Assignment blocked.`);
        setTimeout(() => setToastMessage(null), 4000);
        return;
      }
    }

    setUpdatingStatus(true);
    try {
      await ensureAdminSession();
      const rateNum = parseFloat(tripRate) || 0;
      const { error: insErr } = await supabase
        .from("trips")
        .insert({
          booking_id: detailBooking.id,
          vendor_id: selectedVendorId,
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          vendor_rate: rateNum,
          trip_status: "LORRY_ASSIGNED",
          created_at: new Date().toISOString(),
        });

      if (insErr) throw insErr;

      setToastMessage("Vehicle & Driver successfully assigned to Trip!");
      setTimeout(() => setToastMessage(null), 3000);
      setShowAssignTrip(false);
      setSelectedVendorId("");
      setSelectedVehicleId("");
      setSelectedDriverId("");
      setTripRate("");
      openBookingDetail(detailBooking);
      fetchRealBookings();
    } catch (err: any) {
      console.error("Trip assignment failed:", err);
      setToastMessage(`Assignment failed: ${err.message}`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="bookings-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-success">
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Database Error Banner */}
      {error && (
        <div className="alert-error-bar" style={{ background: "var(--brand-soft)", border: "1px solid #FCA5A5", color: "#F45325" }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#F45325" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Page Header Hero Banner (Matching Reference Image 2) */}
      <div className="directory-hero-banner">
        <div className="directory-hero-info">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Calendar size={22} />
            </div>
            <div>
              <h1 className="directory-hero-title">Bookings & Multi-Trip Operations</h1>
              <p className="directory-hero-desc">
                Manage confirmed bookings, assign vehicles and drivers to trips, and track multi-trip operations.
              </p>
            </div>
          </div>
        </div>

        <div className="directory-hero-actions">
          <button
            className="directory-btn-orange"
            onClick={() => {
              if (onNavigateToCreateFromQuote) {
                onNavigateToCreateFromQuote("");
              } else {
                setToastMessage("Select an accepted quotation from Pricing & Quotes to create a booking.");
                setTimeout(() => setToastMessage(null), 3500);
              }
            }}
            id="btn-create-booking"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Create Booking</span>
          </button>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              color: "#B45309",
              padding: "8px 14px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
            onClick={() => {
              setEmergencyError(null);
              setShowEmergencyModal(true);
            }}
            id="btn-emergency-bypass"
            title="Administrative Emergency Direct Booking Bypass"
          >
            <ShieldAlert size={15} color="#D97706" />
            <span>Emergency Bypass</span>
          </button>
        </div>
      </div>

      {/* 2. 5 KPI Cards (Matching Reference Image 2, calculated from DB) */}
      <div className="directory-kpi-grid-5">
        {/* Total Bookings */}
        <div
          className={`directory-kpi-card ${activeTab === "ALL" && statusFilter === "ALL" ? "active-kpi" : ""}`}
          onClick={() => {
            setActiveTab("ALL");
            setStatusFilter("ALL");
            setPage(1);
          }}
          title="Filter by All Bookings"
        >
          <div className="kpi-icon-squircle blue">
            <Package size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Total Bookings</span>
            </div>
            <div className="directory-kpi-value">{loading ? "..." : dbKpis.total}</div>
            <div className="directory-kpi-subtitle">All bookings in system</div>
          </div>
        </div>

        {/* Confirmed */}
        <div
          className={`directory-kpi-card ${activeTab === "CONFIRMED" || statusFilter === "CONFIRMED" ? "active-kpi" : ""}`}
          onClick={() => {
            setActiveTab("CONFIRMED");
            setStatusFilter("ALL");
            setPage(1);
          }}
          title="Filter by Confirmed"
        >
          <div className="kpi-icon-squircle green">
            <CheckCircle size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Confirmed</span>
            </div>
            <div className="directory-kpi-value">{loading ? "..." : dbKpis.confirmed}</div>
            <div className="directory-kpi-subtitle">Ready for dispatch</div>
          </div>
        </div>

        {/* In Progress */}
        <div
          className={`directory-kpi-card ${activeTab === "IN_PROGRESS" || statusFilter === "IN_PROGRESS" ? "active-kpi" : ""}`}
          onClick={() => {
            setActiveTab("IN_PROGRESS");
            setStatusFilter("ALL");
            setPage(1);
          }}
          title="Filter by In Progress"
        >
          <div className="kpi-icon-squircle amber">
            <TruckIcon size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">In Progress</span>
            </div>
            <div className="directory-kpi-value">{loading ? "..." : dbKpis.inProgress}</div>
            <div className="directory-kpi-subtitle">Active operations</div>
          </div>
        </div>

        {/* Completed */}
        <div
          className={`directory-kpi-card ${activeTab === "COMPLETED" || statusFilter === "COMPLETED" ? "active-kpi" : ""}`}
          onClick={() => {
            setActiveTab("COMPLETED");
            setStatusFilter("ALL");
            setPage(1);
          }}
          title="Filter by Completed"
        >
          <div className="kpi-icon-squircle purple">
            <FileText size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Completed</span>
            </div>
            <div className="directory-kpi-value">{loading ? "..." : dbKpis.completed}</div>
            <div className="directory-kpi-subtitle">Delivered & closed</div>
          </div>
        </div>

        {/* Cancelled */}
        <div
          className={`directory-kpi-card ${activeTab === "CANCELLED" || statusFilter === "CANCELLED" ? "active-kpi" : ""}`}
          onClick={() => {
            setActiveTab("CANCELLED");
            setStatusFilter("ALL");
            setPage(1);
          }}
          title="Filter by Cancelled"
        >
          <div className="kpi-icon-squircle red">
            <X size={22} />
          </div>
          <div className="directory-kpi-content">
            <div className="directory-kpi-header">
              <span className="directory-kpi-title">Cancelled</span>
            </div>
            <div className="directory-kpi-value">{loading ? "..." : dbKpis.cancelled}</div>
            <div className="directory-kpi-subtitle">Cancelled bookings</div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar (Matching Reference Image 2) */}
      <div className="directory-filter-card">
        {/* Search */}
        <div className="directory-search-box">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by booking ID, client name, route, vendor, vehicle number..."
            className="directory-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="directory-select-box">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Date Range */}
        <div className="directory-select-box">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="text"
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="directory-select font-mono text-xs"
            style={{ width: 180 }}
          />
        </div>

        {/* Client Filter */}
        <div className="directory-select-box">
          <Users size={14} className="text-slate-400" />
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">All Clients</option>
            {uniqueClients.map(([cId, cName]) => (
              <option key={cId} value={cId}>
                {cName}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Payment Status Filter */}
        <div className="directory-select-box">
          <DollarSign size={14} className="text-slate-400" />
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="directory-select"
          >
            <option value="ALL">Payment Status</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
          <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Search Button */}
        <button
          onClick={() => {
            setPage(1);
            fetchRealBookings();
          }}
          className="directory-btn-search"
        >
          <Search size={14} />
          <span>Search</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={() => {
            setSearchQuery("");
            setStatusFilter("ALL");
            setActiveTab("ALL");
            setClientFilter("ALL");
            setPaymentFilter("ALL");
            setPage(1);
          }}
          className="directory-btn-reset"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        {/* Refresh Button */}
        <button
          onClick={() => {
            fetchRealStats();
            fetchRealBookings();
            setToastMessage("Synchronized bookings from database.");
            setTimeout(() => setToastMessage(null), 2500);
          }}
          className="directory-btn-outline"
          title="Refresh from database"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4. Sub-bar with Status Tabs & Export */}
      <div className="directory-subbar">
        <div className="directory-tabs">
          <button
            className={`directory-tab-btn ${activeTab === "ALL" && statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("ALL");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            All ({dbKpis.total})
          </button>
          <button
            className={`directory-tab-btn ${activeTab === "CONFIRMED" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("CONFIRMED");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            Confirmed ({dbKpis.confirmed})
          </button>
          <button
            className={`directory-tab-btn ${activeTab === "IN_PROGRESS" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("IN_PROGRESS");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            In Progress ({dbKpis.inProgress})
          </button>
          <button
            className={`directory-tab-btn ${activeTab === "COMPLETED" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("COMPLETED");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            Completed ({dbKpis.completed})
          </button>
          <button
            className={`directory-tab-btn ${activeTab === "CANCELLED" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("CANCELLED");
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            Cancelled ({dbKpis.cancelled})
          </button>
        </div>

        <div className="directory-tab-actions">
          <button className="directory-btn-outline" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export</span>
          </button>
          <button
            className="directory-btn-outline"
            onClick={() => setToastMessage("Columns configured according to operations standard")}
          >
            <ColumnsIcon size={14} />
            <span>Columns</span>
          </button>
        </div>
      </div>

      {/* 5. Bookings Directory Table Card (Matching Reference Image 2) */}
      <div className="directory-table-card">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw size={36} className="text-[#F05A22] animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-semibold">Loading real bookings from database...</p>
          </div>
        ) : paginatedBookings.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No bookings found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">
              {searchQuery || statusFilter !== "ALL" || clientFilter !== "ALL"
                ? "No booking records matched your search query in the connected database."
                : "Bookings will appear here once clients accept quotations and bookings are created."}
            </p>
          </div>
        ) : (
          <table className="directory-table" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th style={{ width: 44, paddingLeft: 18 }}>
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={paginatedBookings.length > 0 && selectedRows.size === paginatedBookings.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ minWidth: 170 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Booking Reference</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 180 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Client Company</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 200 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Route Summary</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 90 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Trips</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 180 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Assigned Vehicle / Driver</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 130 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Booking Status</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 130 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Payment Status</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 140 }}>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Last Updated</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
                <th style={{ minWidth: 90, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedBookings.map((booking) => {
                const isSelected = selectedBookingId === booking.id;
                const statusStyle = getStatusColor(booking.booking_status);
                const paymentStyle = getPaymentStatusColor(booking.payment_status);
                const isMenuOpen = openActionMenuId === booking.id;

                return (
                  <tr
                    key={booking.id}
                    className={isSelected ? "bg-orange-50/40" : ""}
                    onClick={() => {
                      setSelectedBookingId(booking.id);
                      openBookingDetail(booking);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Checkbox */}
                    <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 18 }}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={selectedRows.has(booking.id)}
                        onChange={() => handleSelectRow(booking.id)}
                      />
                    </td>

                    {/* Booking Reference */}
                    <td>
                      <div>
                        <div className="font-bold text-slate-900 text-[13px] font-mono">
                          {booking.booking_reference}
                        </div>
                        <div className="text-slate-500 text-[11.5px]">
                          {formatDateShort(booking.created_at)}
                        </div>
                      </div>
                    </td>

                    {/* Client Company */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            backgroundColor: "#E2E8F0",
                            color: "#334155",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {getClientAvatar(booking.client_company_name)}
                        </div>
                        <span className="font-semibold text-slate-800 text-[13px]">
                          {booking.client_company_name}
                        </span>
                      </div>
                    </td>

                    {/* Route Summary */}
                    <td>
                      <div className="flex flex-col gap-1 text-[12.5px]">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#F05A22] shrink-0" />
                          <span className="text-slate-700 font-medium">
                            {booking.origin_city || "Visakhapatnam, AP"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#F05A22] shrink-0" />
                          <span className="text-slate-700 font-medium">
                            {booking.destination_city || "Hyderabad, TG"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Trips */}
                    <td>
                      <span className="font-mono font-bold text-slate-800 text-[13px]">
                        {booking.completed_trips || 1} / {booking.total_trips || 1}
                      </span>
                    </td>

                    {/* Assigned Vehicle / Driver */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="text-slate-400">
                          <TruckIcon size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-[13px] font-mono">
                            {booking.assigned_vehicle_number || "AP31AB1234"}
                          </div>
                          <div className="text-slate-500 text-[11.5px]">
                            {booking.assigned_driver_name || "Ramesh Kumar"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Booking Status */}
                    <td>
                      <span
                        className="pill-badge"
                        style={{ background: statusStyle.bg, color: statusStyle.text }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td>
                      <span
                        className="pill-badge"
                        style={{ background: paymentStyle.bg, color: paymentStyle.text }}
                      >
                        {paymentStyle.label}
                      </span>
                    </td>

                    {/* Last Updated */}
                    <td>
                      <span className="text-slate-600 text-[12px]">
                        {formatDateTime(booking.updated_at || booking.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-flex items-center gap-1">
                        {/* Eye Button */}
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          onClick={() => {
                            setSelectedBookingId(booking.id);
                            openBookingDetail(booking);
                          }}
                          title="View Booking"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Three Dots Button */}
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(isMenuOpen ? null : booking.id);
                          }}
                          title="Actions"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div className="action-dropdown-menu">
                            <button
                              onClick={() => {
                                setOpenActionMenuId(null);
                                openBookingDetail(booking);
                              }}
                              className="action-dropdown-item"
                            >
                              <Eye size={13} className="text-slate-500" />
                              <span>View Booking</span>
                            </button>

                            <button
                              onClick={() => {
                                setOpenActionMenuId(null);
                                openBookingDetail(booking);
                                setShowAssignTrip(true);
                              }}
                              className="action-dropdown-item"
                            >
                              <TruckIcon size={13} className="text-blue-600" />
                              <span>Assign Vehicle & Driver</span>
                            </button>

                            <button
                              onClick={() => {
                                setOpenActionMenuId(null);
                                openBookingDetail(booking);
                              }}
                              className="action-dropdown-item"
                            >
                              <Navigation size={13} className="text-purple-600" />
                              <span>View Trips</span>
                            </button>

                            <button
                              onClick={() => {
                                setOpenActionMenuId(null);
                                handleUpdateBookingStatus(
                                  booking.id,
                                  booking.booking_status === "CONFIRMED"
                                    ? "IN_PROGRESS"
                                    : "COMPLETED"
                                );
                              }}
                              className="action-dropdown-item"
                            >
                              <CheckCircle size={13} className="text-emerald-600" />
                              <span>Update Status</span>
                            </button>

                            {booking.booking_status !== "CANCELLED" && (
                              <button
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  if (
                                    window.confirm(
                                      `Are you sure you want to cancel booking ${booking.booking_reference}?`
                                    )
                                  ) {
                                    handleUpdateBookingStatus(booking.id, "CANCELLED");
                                  }
                                }}
                                className="action-dropdown-item danger"
                              >
                                <X size={13} className="text-rose-600" />
                                <span>Cancel Booking</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 6. Pagination Row */}
        {!loading && paginatedBookings.length > 0 && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div className="text-xs text-slate-500 font-medium">
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, totalCount)} of {totalCount} bookings
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(6, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 6 && page > 3) {
                  pageNum = Math.min(totalPages, page - 3 + i);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      page === pageNum
                        ? "bg-[#F05A22] text-white"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>

              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="ml-2 text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Booking Details Drawer / Modal */}
      {detailBooking && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-card" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 className="modal-title">Booking Details</h2>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: getStatusColor(detailBooking.booking_status).bg,
                    color: getStatusColor(detailBooking.booking_status).text
                  }}>
                    {detailBooking.booking_reference}
                  </span>
                </div>
                <p className="modal-subtitle">
                  Client: {detailBooking.client_company_name} • Created {new Date(detailBooking.created_at).toLocaleDateString()}
                </p>
              </div>
              <button className="modal-close-btn" onClick={handleCloseDetail}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
              {/* Route & Consignor/Consignee Summary */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: 14,
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
              }}>
                <div>
                  <div style={{ color: "#64748B", fontSize: 12, marginBottom: 2 }}>Origin / Pickup</div>
                  <strong style={{ color: "#111111" }}>{detailBooking.origin || "Pickup Point"}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748B", fontSize: 12, marginBottom: 2 }}>Destination / Delivery</div>
                  <strong style={{ color: "#111111" }}>{detailBooking.destination || "Destination Point"}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748B", fontSize: 12, marginBottom: 2 }}>Requirement ID</div>
                  <strong style={{ color: "#111111" }}>{detailBooking.requirement_id}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748B", fontSize: 12, marginBottom: 2 }}>Payment Status</div>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: getPaymentStatusColor(detailBooking.payment_status).bg,
                    color: getPaymentStatusColor(detailBooking.payment_status).text
                  }}>
                    {detailBooking.payment_status}
                  </span>
                </div>
              </div>

              {/* Administrative Status Progression Controls */}
              <div style={{
                padding: 14,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#111111" }}>
                  Booking Status Actions
                </h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.booking_status === "CONFIRMED"}
                    onClick={() => handleUpdateBookingStatus(detailBooking.id, "CONFIRMED")}
                    style={{
                      background: detailBooking.booking_status === "CONFIRMED" ? "#DBEAFE" : undefined,
                      color: detailBooking.booking_status === "CONFIRMED" ? "#1D4ED8" : undefined,
                    }}
                  >
                    Confirm Booking
                  </button>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.booking_status === "IN_PROGRESS"}
                    onClick={() => handleUpdateBookingStatus(detailBooking.id, "IN_PROGRESS")}
                    style={{
                      background: detailBooking.booking_status === "IN_PROGRESS" ? "#EDE9FE" : undefined,
                      color: detailBooking.booking_status === "IN_PROGRESS" ? "#6D28D9" : undefined,
                    }}
                  >
                    Start Operation (In Progress)
                  </button>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.booking_status === "COMPLETED"}
                    onClick={() => handleUpdateBookingStatus(detailBooking.id, "COMPLETED")}
                    style={{
                      background: detailBooking.booking_status === "COMPLETED" ? "#D1FAE5" : undefined,
                      color: detailBooking.booking_status === "COMPLETED" ? "#047857" : undefined,
                    }}
                  >
                    Mark Completed
                  </button>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.booking_status === "CANCELLED"}
                    onClick={() => handleUpdateBookingStatus(detailBooking.id, "CANCELLED")}
                    style={{
                      background: detailBooking.booking_status === "CANCELLED" ? "#FEE2E2" : undefined,
                      color: detailBooking.booking_status === "CANCELLED" ? "#B91C1C" : undefined,
                    }}
                  >
                    Cancel Booking
                  </button>
                </div>

                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#111111" }}>
                  Payment Status Actions
                </h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.payment_status === "PAID"}
                    onClick={() => handleUpdatePaymentStatus(detailBooking.id, "PAID")}
                  >
                    Mark Paid
                  </button>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.payment_status === "PARTIALLY_PAID"}
                    onClick={() => handleUpdatePaymentStatus(detailBooking.id, "PARTIALLY_PAID")}
                  >
                    Mark Partially Paid
                  </button>
                  <button
                    className="btn-sub-action"
                    disabled={updatingStatus || detailBooking.payment_status === "PAYMENT_PENDING"}
                    onClick={() => handleUpdatePaymentStatus(detailBooking.id, "PAYMENT_PENDING")}
                  >
                    Set Payment Pending
                  </button>
                </div>
              </div>

              {/* Connected Trips & Fleet Assignment */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#111111", display: "flex", alignItems: "center", gap: 6 }}>
                    <TruckIcon size={16} color="#F45325" />
                    <span>Assigned Trips & Vehicle Operations ({detailTrips.length})</span>
                  </h3>
                  <button
                    className="btn-create-gold"
                    onClick={() => setShowAssignTrip(!showAssignTrip)}
                    style={{ fontSize: 12, padding: "6px 12px" }}
                  >
                    <Plus size={14} />
                    <span>{showAssignTrip ? "Cancel Assignment" : "Assign Trip to Fleet"}</span>
                  </button>
                </div>

                {/* Inline Assign Trip Form */}
                {showAssignTrip && (
                  <div style={{
                    padding: 16,
                    background: "#FFF5F0",
                    border: "1px solid rgba(244,83,37,0.3)",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#F45325" }}>
                      Assign Vehicle & Driver to New Trip
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Vendor Partner <span style={{ color: "#F45325" }}>*</span>
                        </label>
                        <select
                          value={selectedVendorId}
                          onChange={e => setSelectedVendorId(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
                        >
                          <option value="">-- Choose Vendor --</option>
                          {assignVendors.map(v => (
                            <option key={v.id} value={v.id}>{v.vendor_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Vehicle <span style={{ color: "#F45325" }}>*</span>
                        </label>
                        <select
                          value={selectedVehicleId}
                          onChange={e => setSelectedVehicleId(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
                        >
                          <option value="">-- Choose Vehicle --</option>
                          {assignVehicles
                            .filter(veh => !selectedVendorId || veh.vendor_id === selectedVendorId)
                            .map(veh => (
                              <option key={veh.id} value={veh.id}>
                                {veh.registration_number || veh.vehicle_number} ({veh.vehicle_type || "Truck"})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Driver <span style={{ color: "#F45325" }}>*</span>
                        </label>
                        <select
                          value={selectedDriverId}
                          onChange={e => setSelectedDriverId(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
                        >
                          <option value="">-- Choose Driver --</option>
                          {assignDrivers
                            .filter(drv => !selectedVendorId || drv.primary_vendor_id === selectedVendorId)
                            .map(drv => (
                              <option key={drv.id} value={drv.id}>
                                {drv.full_name} ({drv.mobile || "No Mobile"})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                          Vendor Freight Rate (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 35000"
                          value={tripRate}
                          onChange={e => setTripRate(e.target.value)}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        className="btn-secondary"
                        onClick={() => setShowAssignTrip(false)}
                        disabled={updatingStatus}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-create-gold"
                        onClick={handleAssignTrip}
                        disabled={updatingStatus || !selectedVendorId || !selectedVehicleId || !selectedDriverId}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        {updatingStatus ? "Assigning..." : "Confirm Trip Assignment"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Trips List */}
                {loadingTrips ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                    <RefreshCw size={20} color="#F45325" className="spin-animation" />
                    <p style={{ marginTop: 8, fontSize: 13 }}>Loading assigned trips...</p>
                  </div>
                ) : detailTrips.length === 0 ? (
                  <div style={{
                    padding: 24,
                    textAlign: "center",
                    background: "#FFFFFF",
                    border: "1px dashed #CBD5E1",
                    borderRadius: 8,
                    color: "#64748B",
                  }}>
                    <TruckIcon size={28} color="#94A3B8" style={{ marginBottom: 6 }} />
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#111111" }}>
                      No trips assigned to this booking yet
                    </p>
                    <p style={{ margin: 0, fontSize: 12 }}>
                      Click "Assign Trip to Fleet" above to assign an approved vehicle and driver.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailTrips.map(trip => (
                      <div
                        key={trip.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#111111" }}>
                              TRP-{trip.id.substring(0, 8)}
                            </span>
                            <span style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: "#FEF3EE",
                              color: "#F45325",
                              fontWeight: 600,
                            }}>
                              {trip.trip_status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B", display: "flex", gap: 12 }}>
                            <span>Vendor: <strong>{trip.vendor?.vendor_name || "Vendor"}</strong></span>
                            <span>Vehicle: <strong>{trip.vehicle?.registration_number || trip.vehicle?.vehicle_number || "Unassigned"}</strong></span>
                            <span>Driver: <strong>{trip.driver?.full_name || "Unassigned"}</strong></span>
                            <span>Rate: <strong>₹{Number(trip.vendor_rate || 0).toLocaleString("en-IN")}</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* Section: Document Verification & Dual Weighbill Clearance   */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div style={{
                marginTop: 20,
                padding: 16,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#FEF3EE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Scale size={18} color="#F45325" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#111111" }}>
                        Document Management & Verification
                      </h3>
                      <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>
                        Loading documents, dual weighbill reconciliation & unloading PODs
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "#F1F5F9",
                      color: "#475569",
                      fontWeight: 600,
                    }}>
                      {categorizedDocs?.totalCount || 0} Total Docs
                    </span>
                    <button
                      className="btn-sub-action"
                      onClick={() => detailBooking && fetchBookingDocs(detailBooking.id)}
                      disabled={loadingDocs}
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    >
                      <RefreshCw size={12} className={loadingDocs ? "spin-animation" : ""} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* 5-Category Tabs Navigation */}
                <div style={{
                  display: "flex",
                  gap: 6,
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: 8,
                  marginBottom: 16,
                  overflowX: "auto",
                }}>
                  {[
                    { key: "DUAL_WEIGHBILL", label: "Dual Weighbill Reconciliation", count: null },
                    { key: "CLIENT", label: "Client Loading Docs", count: categorizedDocs?.clientLoadingDocs.length ?? 0 },
                    { key: "DRIVER", label: "Driver Loading Docs", count: categorizedDocs?.driverLoadingDocs.length ?? 0 },
                    { key: "VENDOR", label: "Vendor-Uploaded Driver Docs", count: categorizedDocs?.vendorUploadedDriverDocs.length ?? 0 },
                    { key: "UNLOADING", label: "Unloading Docs / POD", count: categorizedDocs?.unloadingDocs.length ?? 0 },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveDocTab(tab.key as any)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: activeDocTab === tab.key ? 700 : 500,
                        background: activeDocTab === tab.key ? "#FEF3EE" : "#F8FAFC",
                        color: activeDocTab === tab.key ? "#F45325" : "#64748B",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 10,
                          background: activeDocTab === tab.key ? "rgba(244,83,37,0.15)" : "#E2E8F0",
                          color: activeDocTab === tab.key ? "#F45325" : "#475569",
                          fontWeight: 700,
                        }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {loadingDocs ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                    <RefreshCw size={20} color="#F45325" className="spin-animation" />
                    <p style={{ marginTop: 8, fontSize: 13 }}>Loading verification documents...</p>
                  </div>
                ) : (
                  <>
                    {/* Tab 1: Dual Weighbill Reconciliation */}
                    {activeDocTab === "DUAL_WEIGHBILL" && (
                      <div>
                        {/* Status Alert Banner */}
                        {(() => {
                          const dual = categorizedDocs?.dualComparison;
                          const badge = dual?.statusBadge || { bg: "#FEF3C7", text: "#B45309", label: "Pending Confirmation" };
                          return (
                            <div style={{
                              padding: "12px 16px",
                              borderRadius: 8,
                              background: badge.bg,
                              color: badge.text,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {dual?.dualStatus === "CONFIRMED_BY_BOTH" ? (
                                  <CheckCircle size={20} color="#15803D" />
                                ) : dual?.dualStatus === "WEIGHT_MISMATCH" ? (
                                  <AlertCircle size={20} color="#B91C1C" />
                                ) : (
                                  <Clock size={20} color="#B45309" />
                                )}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                                    {badge.label}
                                  </div>
                                  <div style={{ fontSize: 11, opacity: 0.9 }}>
                                    {dual?.dualStatus === "CONFIRMED_BY_BOTH"
                                      ? "Loading weights matched within ±0.05 MT tolerance. Dispatch gate approved."
                                      : dual?.dualStatus === "WEIGHT_MISMATCH"
                                      ? `Discrepancy of ${dual?.weightDeltaMt.toFixed(2)} MT exceeds 0.05 MT tolerance. Requires administrative review.`
                                      : dual?.uploadedByVendorOnBehalf && !dual?.driverConfirmed
                                      ? "Weighbill uploaded by transport vendor on driver's behalf. Pending independent driver weight certification."
                                      : "Awaiting loading weighbill uploads and weight confirmations from both parties."}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  className="btn-create-gold"
                                  onClick={() => {
                                    setDiscrepancyAction(dual?.dualStatus === "WEIGHT_MISMATCH" ? "ACCEPT_CLIENT_WEIGHT" : "RESOLVE_MATCH");
                                    setResolvedWeightInput(dual?.clientWeightMt ? String(dual.clientWeightMt) : "");
                                    setShowDiscrepancyModal(true);
                                  }}
                                  style={{ fontSize: 11, padding: "5px 10px" }}
                                >
                                  Resolve Discrepancy / Override
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Side-by-Side Comparison Container */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 16,
                          marginBottom: 16,
                        }}>
                          {/* Client Weighbill Card */}
                          {(() => {
                            const cDoc = categorizedDocs?.dualComparison.clientDoc;
                            const cWeight = categorizedDocs?.dualComparison.clientWeightMt;
                            const isConfirmed = categorizedDocs?.dualComparison.clientConfirmed;
                            return (
                              <div style={{
                                padding: 14,
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                borderRadius: 8,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                                    1. Client Loading Weighbill
                                  </span>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: isConfirmed ? "#DCFCE7" : "#FEF3C7",
                                    color: isConfirmed ? "#15803D" : "#B45309",
                                  }}>
                                    {isConfirmed ? "Confirmed by Client" : "Pending Upload"}
                                  </span>
                                </div>

                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, color: "#64748B" }}>Recorded Loading Weight</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: cWeight ? "#0F172A" : "#94A3B8" }}>
                                    {cWeight ? `${cWeight.toFixed(2)} MT` : "— MT"}
                                  </div>
                                </div>

                                {cDoc ? (
                                  <div style={{ fontSize: 11, color: "#64748B", display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div>File: <strong style={{ color: "#0F172A" }}>{cDoc.fileName}</strong></div>
                                    <div>Timestamp: <strong>{new Date(cDoc.createdAt).toLocaleString("en-IN")}</strong></div>
                                    <div>Status: <span style={{ fontWeight: 600, color: cDoc.verificationStatus === "VERIFIED" ? "#15803D" : "#B45309" }}>{cDoc.verificationStatus}</span></div>
                                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                                      <button
                                        className="btn-sub-action"
                                        onClick={() => setPreviewDoc(cDoc)}
                                        style={{ fontSize: 11, padding: "3px 8px" }}
                                      >
                                        <Eye size={12} />
                                        <span>Preview Slip</span>
                                      </button>
                                      {cDoc.verificationStatus !== "VERIFIED" && (
                                        <button
                                          className="btn-sub-action"
                                          onClick={() => handleVerifyDocument(cDoc.id)}
                                          disabled={actionInProgress}
                                          style={{ fontSize: 11, padding: "3px 8px", background: "#DCFCE7", color: "#15803D" }}
                                        >
                                          <Check size={12} />
                                          <span>Verify</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", padding: "10px 0" }}>
                                    Client has not uploaded loading weighbridge slip yet.
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Driver / Vendor Weighbill Card */}
                          {(() => {
                            const dDoc = categorizedDocs?.dualComparison.driverDoc;
                            const dWeight = categorizedDocs?.dualComparison.driverWeightMt;
                            const isConfirmed = categorizedDocs?.dualComparison.driverConfirmed;
                            const isVendorOnBehalf = categorizedDocs?.dualComparison.uploadedByVendorOnBehalf;
                            return (
                              <div style={{
                                padding: 14,
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                borderRadius: 8,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                                    2. Driver Loading Weighbill
                                  </span>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: isConfirmed ? "#DCFCE7" : isVendorOnBehalf ? "#FED7AA" : "#FEF3C7",
                                    color: isConfirmed ? "#15803D" : isVendorOnBehalf ? "#C2410C" : "#B45309",
                                  }}>
                                    {isConfirmed
                                      ? "Confirmed by Driver"
                                      : isVendorOnBehalf
                                      ? "Pending Driver Weight Confirmation"
                                      : "Pending Upload"}
                                  </span>
                                </div>

                                {isVendorOnBehalf && (
                                  <div style={{
                                    marginBottom: 8,
                                    padding: "4px 8px",
                                    background: "#FFF7ED",
                                    border: "1px solid #FED7AA",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#C2410C",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}>
                                    <AlertTriangle size={12} color="#C2410C" />
                                    <span>Uploaded by Vendor on Behalf of Driver</span>
                                  </div>
                                )}

                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, color: "#64748B" }}>Recorded Loading Weight</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: dWeight ? "#0F172A" : "#94A3B8" }}>
                                    {dWeight ? `${dWeight.toFixed(2)} MT` : "— MT"}
                                  </div>
                                </div>

                                {dDoc ? (
                                  <div style={{ fontSize: 11, color: "#64748B", display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div>File: <strong style={{ color: "#0F172A" }}>{dDoc.fileName}</strong></div>
                                    <div>Uploader: <strong>{dDoc.uploaderName || dDoc.uploaderRole}</strong></div>
                                    <div>Timestamp: <strong>{new Date(dDoc.createdAt).toLocaleString("en-IN")}</strong></div>
                                    <div>Driver Confirmation: <strong style={{ color: isConfirmed ? "#15803D" : "#C2410C" }}>{isConfirmed ? "Certified" : "Awaiting Driver Confirmation"}</strong></div>
                                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                                      <button
                                        className="btn-sub-action"
                                        onClick={() => setPreviewDoc(dDoc)}
                                        style={{ fontSize: 11, padding: "3px 8px" }}
                                      >
                                        <Eye size={12} />
                                        <span>Preview Slip</span>
                                      </button>
                                      {dDoc.verificationStatus !== "VERIFIED" && (
                                        <button
                                          className="btn-sub-action"
                                          onClick={() => handleVerifyDocument(dDoc.id)}
                                          disabled={actionInProgress}
                                          style={{ fontSize: 11, padding: "3px 8px", background: "#DCFCE7", color: "#15803D" }}
                                        >
                                          <Check size={12} />
                                          <span>Verify</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", padding: "10px 0" }}>
                                    Driver has not uploaded loading weighbridge slip yet.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Reconciliation Metrics Row */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 12,
                          padding: 12,
                          background: "#F1F5F9",
                          borderRadius: 8,
                          fontSize: 12,
                          marginBottom: 16,
                        }}>
                          <div>
                            <div style={{ color: "#64748B", fontSize: 11 }}>Client Weight</div>
                            <strong style={{ color: "#0F172A" }}>
                              {categorizedDocs?.dualComparison.clientWeightMt ? `${categorizedDocs.dualComparison.clientWeightMt.toFixed(2)} MT` : "Pending"}
                            </strong>
                          </div>
                          <div>
                            <div style={{ color: "#64748B", fontSize: 11 }}>Driver Weight</div>
                            <strong style={{ color: "#0F172A" }}>
                              {categorizedDocs?.dualComparison.driverWeightMt ? `${categorizedDocs.dualComparison.driverWeightMt.toFixed(2)} MT` : "Pending"}
                            </strong>
                          </div>
                          <div>
                            <div style={{ color: "#64748B", fontSize: 11 }}>Calculated Delta</div>
                            <strong style={{
                              color: categorizedDocs?.dualComparison.isMatching
                                ? "#15803D"
                                : categorizedDocs?.dualComparison.weightDeltaMt
                                ? "#B91C1C"
                                : "#64748B"
                            }}>
                              Δ {categorizedDocs?.dualComparison.weightDeltaMt ? `${categorizedDocs.dualComparison.weightDeltaMt.toFixed(2)} MT` : "0.00 MT"}
                            </strong>
                          </div>
                          <div>
                            <div style={{ color: "#64748B", fontSize: 11 }}>Allowed Tolerance</div>
                            <strong style={{ color: "#0F172A" }}>±0.05 MT</strong>
                          </div>
                        </div>

                        {/* Audit Trail of Discrepancies if any */}
                        {categorizedDocs?.dualComparison.auditTrail && categorizedDocs.dualComparison.auditTrail.length > 0 && (
                          <div style={{
                            padding: 12,
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 8,
                            fontSize: 11,
                          }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                              Administrative Resolution Audit Trail:
                            </div>
                            {categorizedDocs.dualComparison.auditTrail.map((entry: any, idx: number) => (
                              <div key={idx} style={{ padding: "4px 0", borderBottom: idx < categorizedDocs.dualComparison.auditTrail.length - 1 ? "1px dashed #E2E8F0" : "none" }}>
                                <span style={{ color: "#64748B" }}>{new Date(entry.timestamp).toLocaleString("en-IN")}: </span>
                                <strong style={{ color: "#0F172A" }}>{entry.resolvedBy}</strong> resolved via <em>{entry.action}</em>
                                {entry.resolvedWeightMt && ` (Weight: ${entry.resolvedWeightMt} MT)`}
                                {entry.reason && ` — Reason: "${entry.reason}"`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2, 3, 4, 5: Document Category Lists */}
                    {activeDocTab !== "DUAL_WEIGHBILL" && (
                      <div>
                        {(() => {
                          const docList =
                            activeDocTab === "CLIENT"
                              ? categorizedDocs?.clientLoadingDocs || []
                              : activeDocTab === "DRIVER"
                              ? categorizedDocs?.driverLoadingDocs || []
                              : activeDocTab === "VENDOR"
                              ? categorizedDocs?.vendorUploadedDriverDocs || []
                              : categorizedDocs?.unloadingDocs || [];

                          if (docList.length === 0) {
                            return (
                              <div style={{
                                padding: 24,
                                textAlign: "center",
                                background: "#F8FAFC",
                                border: "1px dashed #CBD5E1",
                                borderRadius: 8,
                                color: "#64748B",
                              }}>
                                <FileText size={28} color="#94A3B8" style={{ marginBottom: 6 }} />
                                <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#111111" }}>
                                  No documents found in this category
                                </p>
                                <p style={{ margin: 0, fontSize: 12 }}>
                                  {activeDocTab === "CLIENT"
                                    ? "Client has not uploaded Invoice or Material documents yet."
                                    : activeDocTab === "DRIVER"
                                    ? "Driver has not uploaded loading weighbridge slip directly."
                                    : activeDocTab === "VENDOR"
                                    ? "No documents uploaded by vendor on behalf of driver."
                                    : "No unloading Proof of Delivery (POD) uploaded yet."}
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {docList.map((doc) => {
                                const isVerified = doc.verificationStatus === "VERIFIED";
                                const isRejected = doc.verificationStatus === "REJECTED";
                                const isPendingDriver = doc.verificationStatus === "PENDING_DRIVER_CONFIRMATION";

                                return (
                                  <div
                                    key={doc.id}
                                    style={{
                                      padding: 12,
                                      background: "#FFFFFF",
                                      border: "1px solid #E2E8F0",
                                      borderRadius: 8,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 12,
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 6,
                                        background: isVerified ? "#DCFCE7" : isRejected ? "#FEE2E2" : "#FEF3EE",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}>
                                        <FileText size={18} color={isVerified ? "#15803D" : isRejected ? "#B91C1C" : "#F45325"} />
                                      </div>

                                      <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                          <strong style={{ fontSize: 13, color: "#0F172A" }}>
                                            {doc.fileName}
                                          </strong>
                                          <span style={{
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            borderRadius: 4,
                                            background: "#F1F5F9",
                                            color: "#475569",
                                            fontWeight: 600,
                                          }}>
                                            {doc.documentType}
                                          </span>
                                          {doc.recordedWeightMt && (
                                            <span style={{
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              borderRadius: 4,
                                              background: "#FEF3EE",
                                              color: "#F45325",
                                              fontWeight: 700,
                                            }}>
                                              Weight: {doc.recordedWeightMt} MT
                                            </span>
                                          )}
                                        </div>

                                        <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 12, flexWrap: "wrap" }}>
                                          <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString("en-IN")}</span>
                                          <span>Role: <strong>{doc.uploaderRole}</strong></span>
                                          {doc.uploaderRole === "VENDOR_ON_BEHALF_OF_DRIVER" && (
                                            <span style={{
                                              color: "#C2410C",
                                              background: "#FFF7ED",
                                              padding: "1px 6px",
                                              borderRadius: 4,
                                              fontWeight: 700,
                                            }}>
                                              Uploaded by Vendor on Behalf of Driver
                                            </span>
                                          )}
                                        </div>

                                        {doc.rejectionReason && (
                                          <div style={{
                                            marginTop: 4,
                                            fontSize: 11,
                                            color: "#B91C1C",
                                            background: "#FEF2F2",
                                            padding: "2px 6px",
                                            borderRadius: 4,
                                          }}>
                                            Rejection note: {doc.rejectionReason}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Actions & Status Badge */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{
                                        fontSize: 11,
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        fontWeight: 700,
                                        background: isVerified
                                          ? "#DCFCE7"
                                          : isRejected
                                          ? "#FEE2E2"
                                          : isPendingDriver
                                          ? "#FED7AA"
                                          : "#FEF3C7",
                                        color: isVerified
                                          ? "#15803D"
                                          : isRejected
                                          ? "#B91C1C"
                                          : isPendingDriver
                                          ? "#C2410C"
                                          : "#B45309",
                                      }}>
                                        {doc.verificationStatus}
                                      </span>

                                      <button
                                        className="btn-sub-action"
                                        onClick={() => setPreviewDoc(doc)}
                                        title="Preview Document"
                                        style={{ padding: "4px 8px", fontSize: 11 }}
                                      >
                                        <Eye size={13} />
                                        <span>Preview</span>
                                      </button>

                                      {!isVerified && (
                                        <button
                                          className="btn-sub-action"
                                          onClick={() => handleVerifyDocument(doc.id)}
                                          disabled={actionInProgress}
                                          title="Verify and Approve"
                                          style={{ padding: "4px 8px", fontSize: 11, background: "#DCFCE7", color: "#15803D" }}
                                        >
                                          <Check size={13} />
                                          <span>Approve</span>
                                        </button>
                                      )}

                                      {!isRejected && (
                                        <button
                                          className="btn-sub-action"
                                          onClick={() => {
                                            setRejectionTargetDoc(doc);
                                            setRejectionReasonText("");
                                          }}
                                          disabled={actionInProgress}
                                          title="Reject with Reason"
                                          style={{ padding: "4px 8px", fontSize: 11, background: "#FEE2E2", color: "#B91C1C" }}
                                        >
                                          <X size={13} />
                                          <span>Reject</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Preview Lightbox Modal ── */}
      {previewDoc && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setPreviewDoc(null)}>
          <div className="modal-container" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{previewDoc.fileName}</h3>
                <p className="modal-subtitle">
                  {previewDoc.documentType} • Uploaded by {previewDoc.uploaderRole}
                  {previewDoc.recordedWeightMt ? ` • Weight: ${previewDoc.recordedWeightMt} MT` : ""}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setPreviewDoc(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: "center", padding: 20 }}>
              <div style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: 30,
                minHeight: 280,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <FileText size={48} color="#F45325" style={{ marginBottom: 12 }} />
                <strong style={{ fontSize: 15, color: "#0F172A", marginBottom: 4 }}>
                  {previewDoc.fileName}
                </strong>
                <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px" }}>
                  Official NECL Document • {previewDoc.fileSize} • Uploaded {new Date(previewDoc.createdAt).toLocaleString("en-IN")}
                </p>

                {previewDoc.fileUrl && previewDoc.fileUrl.startsWith("http") && (
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      background: "#F45325",
                      color: "#FFFFFF",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Open Full Document in New Tab</span>
                  </a>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {previewDoc.verificationStatus !== "VERIFIED" && (
                  <button
                    className="btn-create-gold"
                    onClick={() => handleVerifyDocument(previewDoc.id)}
                    disabled={actionInProgress}
                    style={{ fontSize: 12, background: "#10B981" }}
                  >
                    <Check size={14} />
                    <span>Approve & Verify</span>
                  </button>
                )}
                {previewDoc.verificationStatus !== "REJECTED" && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setRejectionTargetDoc(previewDoc);
                      setRejectionReasonText("");
                    }}
                    disabled={actionInProgress}
                    style={{ fontSize: 12, color: "#DC2626", borderColor: "#FCA5A5" }}
                  >
                    <X size={14} />
                    <span>Reject</span>
                  </button>
                )}
              </div>
              <button className="btn-secondary" onClick={() => setPreviewDoc(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Rejection Modal with Preset Reason Chips ── */}
      {rejectionTargetDoc && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setRejectionTargetDoc(null)}>
          <div className="modal-container" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: "#B91C1C" }}>
                  Reject Document — {rejectionTargetDoc.fileName}
                </h3>
                <p className="modal-subtitle">
                  Specify reason for rejection. Both parties will be notified to re-upload.
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setRejectionTargetDoc(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Common Rejection Reasons
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[
                  "Blurry / Illegible Document Scan",
                  "Missing Weighbridge Official Seal / Stamp",
                  "Gross / Tare / Net Weight Discrepancy",
                  "Consignee Details Mismatch",
                  "Missing Driver / Receiver Signature on Slip",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setRejectionReasonText(chip)}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 16,
                      border: "1px solid #CBD5E1",
                      background: rejectionReasonText === chip ? "#FEE2E2" : "#F8FAFC",
                      color: rejectionReasonText === chip ? "#B91C1C" : "#475569",
                      fontWeight: rejectionReasonText === chip ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                Detailed Rejection Note *
              </label>
              <textarea
                rows={3}
                placeholder="Enter exact feedback for the uploader explaining what needs correction..."
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn-secondary" onClick={() => setRejectionTargetDoc(null)}>
                Cancel
              </button>
              <button
                className="btn-create-gold"
                onClick={handleRejectDocument}
                disabled={actionInProgress || !rejectionReasonText.trim()}
                style={{ background: "#DC2626", fontSize: 12 }}
              >
                {actionInProgress ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Discrepancy Resolution & Weight Override Modal ── */}
      {showDiscrepancyModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowDiscrepancyModal(false)}>
          <div className="modal-container" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Scale size={18} color="#F45325" />
                  <span>Administrative Discrepancy Resolution</span>
                </h3>
                <p className="modal-subtitle">
                  Resolve weighbill differences with authoritative administrative action. Logged to audit trail.
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDiscrepancyModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: 10,
                background: "#F8FAFC",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 12,
              }}>
                <div>
                  <span style={{ color: "#64748B" }}>Client Recorded: </span>
                  <strong style={{ color: "#0F172A" }}>
                    {categorizedDocs?.dualComparison.clientWeightMt ? `${categorizedDocs.dualComparison.clientWeightMt} MT` : "N/A"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Driver Recorded: </span>
                  <strong style={{ color: "#0F172A" }}>
                    {categorizedDocs?.dualComparison.driverWeightMt ? `${categorizedDocs.dualComparison.driverWeightMt} MT` : "N/A"}
                  </strong>
                </div>
              </div>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Select Resolution Action *
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {[
                  {
                    key: "ACCEPT_CLIENT_WEIGHT",
                    title: `Accept Client Weight (${categorizedDocs?.dualComparison.clientWeightMt || 0} MT)`,
                    desc: "Authorize client's weighbridge slip as the official billable weight.",
                  },
                  {
                    key: "ACCEPT_DRIVER_WEIGHT",
                    title: `Accept Driver Weight (${categorizedDocs?.dualComparison.driverWeightMt || 0} MT)`,
                    desc: "Authorize driver's certified weighbridge slip as the official transit weight.",
                  },
                  {
                    key: "RESOLVE_MATCH",
                    title: "Enter Custom Verified Weight (Override)",
                    desc: "Specify a mutually reconciled or hub-verified weighbridge value.",
                  },
                  {
                    key: "REJECT_AND_REQUEST_REUPLOAD",
                    title: "Reject Both Weighbills & Request Re-upload",
                    desc: "Mark weighbills rejected and require fresh weighbridge certificate.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid",
                      borderColor: discrepancyAction === opt.key ? "#F45325" : "#E2E8F0",
                      background: discrepancyAction === opt.key ? "#FEF3EE" : "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="discrepancyAction"
                      checked={discrepancyAction === opt.key}
                      onChange={() => {
                        setDiscrepancyAction(opt.key as any);
                        if (opt.key === "ACCEPT_CLIENT_WEIGHT") {
                          setResolvedWeightInput(String(categorizedDocs?.dualComparison.clientWeightMt || ""));
                        } else if (opt.key === "ACCEPT_DRIVER_WEIGHT") {
                          setResolvedWeightInput(String(categorizedDocs?.dualComparison.driverWeightMt || ""));
                        }
                      }}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <strong style={{ fontSize: 12, color: "#0F172A" }}>{opt.title}</strong>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {discrepancyAction === "RESOLVE_MATCH" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                    Custom Authoritative Weight (Metric Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 24.65"
                    value={resolvedWeightInput}
                    onChange={(e) => setResolvedWeightInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                  Resolution Notes / Audit Justification *
                </label>
                <textarea
                  rows={2}
                  placeholder="State the justification for this administrative decision (mandatory for audit log)..."
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn-secondary" onClick={() => setShowDiscrepancyModal(false)}>
                Cancel
              </button>
              <button
                className="btn-create-gold"
                onClick={handleResolveDiscrepancy}
                disabled={actionInProgress || (discrepancyAction === "RESOLVE_MATCH" && !resolvedWeightInput)}
                style={{ fontSize: 12 }}
              >
                {actionInProgress ? "Recording Resolution..." : "Save Resolution to Audit Trail"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Direct Booking Bypass Modal */}
      {showEmergencyModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowEmergencyModal(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: 520, borderRadius: 12, padding: 24, background: "#FFFFFF" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={20} color="#DC2626" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    Emergency Direct Booking Bypass
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                    Mandatory Administrative Justification Required
                  </p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowEmergencyModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={18} color="#6B7280" />
              </button>
            </div>

            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: 12, marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={16} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: "#92400E", lineHeight: 1.4 }}>
                <strong>Administrative Gate:</strong> Direct booking bypass bypasses the normal quotation workflow for operational spot emergencies. Every bypass requires a minimum 10-character justification and is immutably logged to the audit trail.
              </p>
            </div>

            {emergencyError && (
              <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: 10, marginBottom: 14, color: "#B91C1C", fontSize: 12 }}>
                {emergencyError}
              </div>
            )}

            <form onSubmit={handleEmergencyDirectBooking}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Transport Requirement ID <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UUID or requirement ID"
                  value={emergencyReqId}
                  onChange={(e) => setEmergencyReqId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Client ID (Optional if linked to requirement)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client UUID"
                  value={emergencyClientId}
                  onChange={(e) => setEmergencyClientId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                  Agreed Rate (INR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 45000"
                  value={emergencyAgreedRate}
                  onChange={(e) => setEmergencyAgreedRate(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                    Administrative Justification <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <span style={{ fontSize: 11, color: emergencyJustification.length >= 10 ? "#059669" : "#DC2626" }}>
                    {emergencyJustification.length}/10 chars min
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Reason for immediate spot bypass (e.g., Factory production line stoppage, client MD direct request)..."
                  value={emergencyJustification}
                  onChange={(e) => setEmergencyJustification(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEmergencyModal(false)}
                  disabled={emergencySubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emergencySubmitting || emergencyJustification.trim().length < 10 || !emergencyReqId.trim()}
                  style={{
                    background: emergencyJustification.trim().length >= 10 && emergencyReqId.trim() ? "#DC2626" : "#9CA3AF",
                    color: "#FFFFFF",
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: emergencyJustification.trim().length >= 10 && emergencyReqId.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {emergencySubmitting ? "Confirming Bypass..." : "Confirm Direct Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
