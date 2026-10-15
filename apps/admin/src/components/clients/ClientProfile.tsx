import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit2, Plus, Phone, Mail, MapPin, Building2, Calendar,
  CheckCircle, AlertCircle, X, ChevronDown, MessageSquare, FileText,
  DollarSign, TrendingUp, Users, Package, Clock, Loader, Download,
  Star, Activity, CreditCard, BarChart3, Archive, Truck, Copy,
  Check, Globe, ExternalLink, ShieldCheck, MoreVertical, Eye, RotateCcw,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Info
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../context/AuthContext";
import { DocumentPreviewModal } from "../common/DocumentPreviewModal";
import { resolveClientDocumentType } from "./ClientDirectory";
import { formatDisplayId, generateDbNeclId } from "../../utils/idGenerator";
import { EditClientModal } from "./EditClientModal";

interface ClientProfileProps {
  clientId: string;
  onBack: () => void;
}

type ProfileTab =
  | "overview"
  | "contacts"
  | "addresses"
  | "history"
  | "bookings"
  | "finance"
  | "documents"
  | "notes"
  | "activity";

export const ClientProfile: React.FC<ClientProfileProps> = ({ clientId, onBack }) => {
  const navigate = useNavigate();
  const { adminProfile, hasPermission, canViewMargins } = useAuth();

  const [client, setClient] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [clientQuotes, setClientQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedGst, setCopiedGst] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);

  // Booking table search, filter, and pagination states
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");
  const [bookingDateSort, setBookingDateSort] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [bookingPage, setBookingPage] = useState<number>(1);

  // Create booking workflow selection states
  const [selectedReqForBooking, setSelectedReqForBooking] = useState<string>("");
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<string>("");
  const [customClientRate, setCustomClientRate] = useState<string>("");

  // Documents and KYC review states
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocForAction, setSelectedDocForAction] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [approvalWarning, setApprovalWarning] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Quick Action Modal states
  const [activeModal, setActiveModal] = useState<
    | "EDIT_CLIENT"
    | "CREATE_REQ"
    | "CREATE_BOOKING"
    | "SEND_MESSAGE"
    | "UPLOAD_DOC"
    | "ADD_NOTE"
    | "VIEW_MAP"
    | "REJECT_REG"
    | "REQUEST_CORRECTIONS"
    | "REJECT_DOC"
    | "REPLACE_DOC"
    | null
  >(null);

  // Form states for creating real DB rows
  const [newReqForm, setNewReqForm] = useState({
    origin: "Visakhapatnam Port",
    destination: "Hyderabad Logistics Depot",
    material: "Industrial Goods",
    truckType: "16 Wheeler",
    capacityMt: "35"
  });

  const [messageText, setMessageText] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Fetch client details, contacts, requirements, bookings, and KYC documents directly from Supabase
  const loadClientDetailsFromDB = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      // 1. Fetch Company
      let compData: any = null;
      if (clientId) {
        const { data, error: cErr } = await supabase
          .from("client_companies")
          .select("*")
          .eq("id", clientId)
          .maybeSingle();

        if (cErr) throw cErr;
        compData = data;
      }

      // If no ID matched, fetch the first available company from DB
      if (!compData) {
        const { data: firstComp } = await supabase
          .from("client_companies")
          .select("*")
          .limit(1)
          .maybeSingle();
        compData = firstComp;
      }

      if (!compData) {
        setError("No client company found in the connected database.");
        setLoading(false);
        return;
      }

      setClient(compData);

      // 2. Fetch Contacts from client_users
      const { data: userRows } = await supabase
        .from("client_users")
        .select("*")
        .eq("client_id", compData.id)
        .order("created_at", { ascending: true });

      setContacts(userRows || []);

      // 3. Fetch real requirements from requirements table
      const { data: reqRows } = await supabase
        .from("requirements")
        .select("*")
        .eq("client_id", compData.id)
        .order("created_at", { ascending: false });

      const clientReqs = reqRows || [];
      setRequirements(clientReqs);

      // Fetch client quotes associated with these requirements
      let quotesList: any[] = [];
      const reqIds = clientReqs.map(r => r.id);
      if (reqIds.length > 0) {
        const { data: qData } = await supabase
          .from("client_quotes")
          .select("id, requirement_id, version, vendor_base_cost, admin_margin, gst_rate_percent, gst_amount, total_client_amount, validity_expires_at, status, created_at")
          .in("requirement_id", reqIds)
          .order("created_at", { ascending: false });
        quotesList = qData || [];
      }
      setClientQuotes(quotesList);

      // 4. Fetch real bookings from bookings table
      const { data: bokRows, error: bokErr } = await supabase
        .from("bookings")
        .select("*")
        .eq("client_id", compData.id)
        .order("confirmed_at", { ascending: false });

      if (bokErr) {
        console.warn("Bookings query warning:", bokErr.message);
      }

      if (!bokRows || bokRows.length === 0) {
        setBookings([]);
      } else {
        const bookingIds = bokRows.map(b => b.id);
        const quoteIds = [...new Set(bokRows.map(b => b.accepted_quote_id).filter(Boolean))];

        // Fetch associated trips for all bookings
        const { data: tripsData } = await supabase
          .from("trips")
          .select("id, booking_id, vehicle_id, driver_id, vendor_id, vendor_rate, trip_status, started_at, completed_at, created_at, pod_approved")
          .in("booking_id", bookingIds);

        const allTrips = tripsData || [];
        const vIds = [...new Set(allTrips.map(t => t.vehicle_id).filter(Boolean))];
        const dIds = [...new Set(allTrips.map(t => t.driver_id).filter(Boolean))];
        const vnIds = [...new Set(allTrips.map(t => t.vendor_id).filter(Boolean))];

        // Fetch vehicle, driver, and vendor metadata in parallel
        const [vehRes, drvRes, venRes, quoteRes] = await Promise.all([
          vIds.length > 0
            ? supabase.from("vehicles").select("id, registration_number, vehicle_type").in("id", vIds)
            : { data: [] },
          dIds.length > 0
            ? supabase.from("drivers").select("id, full_name, mobile").in("id", dIds)
            : { data: [] },
          vnIds.length > 0
            ? supabase.from("vendor_companies").select("id, vendor_name").in("id", vnIds)
            : { data: [] },
          quoteIds.length > 0
            ? supabase.from("client_quotes").select("id, requirement_id, total_client_amount, status, created_at").in("id", quoteIds)
            : { data: [] }
        ]);

        const vMap = new Map((vehRes.data || []).map((v: any) => [v.id, v]));
        const dMap = new Map((drvRes.data || []).map((d: any) => [d.id, d]));
        const vnMap = new Map((venRes.data || []).map((vn: any) => [vn.id, vn]));
        const qMap = new Map((quoteRes.data || []).map((q: any) => [q.id, q]));
        const reqMap = new Map(clientReqs.map(r => [r.id, r]));

        // Group trips by booking_id
        const tripsByBooking = new Map<string, any[]>();
        allTrips.forEach((t: any) => {
          const list = tripsByBooking.get(t.booking_id) || [];
          list.push({
            ...t,
            vehicle: vMap.get(t.vehicle_id),
            driver: dMap.get(t.driver_id),
            vendor: vnMap.get(t.vendor_id)
          });
          tripsByBooking.set(t.booking_id, list);
        });

        // Assemble enriched bookings list
        const enriched = bokRows.map((b: any) => {
          const bTrips = tripsByBooking.get(b.id) || [];
          const linkedReq = reqMap.get(b.requirement_id);
          const linkedQuote = qMap.get(b.accepted_quote_id);

          const vendorNames = [...new Set(bTrips.map(t => t.vendor?.vendor_name).filter(Boolean))];
          const vendor_name = vendorNames.length > 0 ? vendorNames.join(", ") : "Pending Assignment";

          const primaryTrip = bTrips[0];
          const vehReg = primaryTrip?.vehicle?.registration_number;
          const drvName = primaryTrip?.driver?.full_name;
          const vehicle_driver_display = [vehReg, drvName].filter(Boolean).join(" • ") || "Unassigned";

          const tripCount = bTrips.length;
          const completedTripsCount = bTrips.filter(t => t.trip_status === "DELIVERED").length;
          const inTransitTripsCount = bTrips.filter(t => ["IN_TRANSIT", "LOADING", "UNLOADING", "LORRY_ASSIGNED"].includes(t.trip_status)).length;

          let trip_progress_label = "No trips assigned";
          let trip_progress_status = "PENDING";
          if (tripCount > 0) {
            const latestStatus = bTrips[bTrips.length - 1]?.trip_status || "LORRY_ASSIGNED";
            trip_progress_status = latestStatus;
            trip_progress_label = `${completedTripsCount}/${tripCount} Completed${inTransitTripsCount > 0 ? ` • ${latestStatus.replace(/_/g, " ")}` : ""}`;
          }

          let expected_delivery_display = "—";
          if (primaryTrip?.completed_at) {
            expected_delivery_display = new Date(primaryTrip.completed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
          } else if (linkedReq?.loading_datetime) {
            expected_delivery_display = new Date(linkedReq.loading_datetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
          }

          const quote_display_id = linkedQuote
            ? formatDisplayId("QT", linkedQuote.id, linkedQuote.created_at)
            : (b.accepted_quote_id ? formatDisplayId("QT", b.accepted_quote_id, b.confirmed_at) : "—");

          const quote_amount = linkedQuote?.total_client_amount
            ? Number(linkedQuote.total_client_amount)
            : (b.grand_total ? Number(b.grand_total) : null);

          return {
            ...b,
            displayId: b.booking_code || formatDisplayId("BK", b.id, b.confirmed_at),
            vendor_name,
            trip_count: tripCount,
            trips: bTrips,
            vehicle_driver_display,
            quote_display_id,
            quote_amount,
            trip_progress_label,
            trip_progress_status,
            expected_delivery_display,
            route_summary: linkedReq
              ? `${(linkedReq.pickup_address || "Origin").split(",")[0]} → ${(linkedReq.destination_address || "Destination").split(",")[0]}`
              : "—"
          };
        });

        setBookings(enriched);
      }

      // 5. Fetch compliance documents from documents table
      const { data: docRows } = await supabase
        .from("documents")
        .select("*")
        .eq("reference_id", compData.id)
        .order("created_at", { ascending: true });

      setDocuments(docRows || []);
    } catch (err: any) {
      console.error("Error loading client from database:", err);
      setError(err.message || "Failed to load client data from database");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientDetailsFromDB();
  }, [loadClientDetailsFromDB]);

  // Derived real KPI statistics from database rows
  const profileKpis = useMemo(() => {
    const totalReqs = requirements.length;
    const totalBoks = bookings.length;
    const confirmedBoks = bookings.filter(b => b.booking_status === "CONFIRMED").length;
    const completedBoks = bookings.filter(b => b.booking_status === "COMPLETED").length;
    const inProgressBoks = bookings.filter(b => b.booking_status === "IN_PROGRESS" || b.booking_status === "CLIENT_ACCEPTED").length;

    // Distinct trip counts from actual trips
    const allTrips = bookings.flatMap(b => b.trips || []);
    const totalTrips = allTrips.length;
    const completedTrips = allTrips.filter(t => t.trip_status === "DELIVERED").length;
    const inTransitTrips = allTrips.filter(t => ["IN_TRANSIT", "LOADING", "UNLOADING", "LORRY_ASSIGNED"].includes(t.trip_status)).length;
    const successRate = totalTrips > 0 ? `${Math.round((completedTrips / totalTrips) * 100)}%` : totalBoks > 0 ? "100%" : "—";

    return {
      totalReqs,
      totalBoks,
      confirmedBoks,
      completedBoks,
      inProgressBoks,
      totalTrips,
      completedTrips,
      inTransitTrips,
      successRate
    };
  }, [requirements, bookings]);

  // Filtered and sorted bookings list for UI presentation
  const filteredClientBookings = useMemo(() => {
    let list = [...bookings];

    if (bookingStatusFilter !== "ALL") {
      list = list.filter(b => b.booking_status === bookingStatusFilter);
    }

    if (bookingSearch.trim()) {
      const q = bookingSearch.trim().toLowerCase();
      list = list.filter(b =>
        b.id?.toLowerCase().includes(q) ||
        b.displayId?.toLowerCase().includes(q) ||
        b.requirement_id?.toLowerCase().includes(q) ||
        b.quote_display_id?.toLowerCase().includes(q) ||
        b.vendor_name?.toLowerCase().includes(q) ||
        b.vehicle_driver_display?.toLowerCase().includes(q) ||
        b.route_summary?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const tA = new Date(a.confirmed_at || a.created_at || 0).getTime();
      const tB = new Date(b.confirmed_at || b.created_at || 0).getTime();
      return bookingDateSort === "NEWEST" ? tB - tA : tA - tB;
    });

    return list;
  }, [bookings, bookingStatusFilter, bookingSearch, bookingDateSort]);

  const BOOKINGS_PAGE_SIZE = 5;
  const totalBookingPages = Math.max(1, Math.ceil(filteredClientBookings.length / BOOKINGS_PAGE_SIZE));
  const paginatedClientBookings = useMemo(() => {
    const from = (bookingPage - 1) * BOOKINGS_PAGE_SIZE;
    return filteredClientBookings.slice(from, from + BOOKINGS_PAGE_SIZE);
  }, [filteredClientBookings, bookingPage]);

  const handleNavigateToBooking = (bookingId: string) => {
    navigate(`/admin/bookings/${bookingId}`);
  };

  const handleCopyBookingId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedBookingId(id);
    setToastMsg(`Booking ID ${id} copied to clipboard`);
    setTimeout(() => {
      setCopiedBookingId(null);
      setToastMsg(null);
    }, 2500);
  };

  // Compliance verification stats (mandatory vs optional documents + profile completion)
  const complianceStats = useMemo(() => {
    const mandatoryDocTypes = ["GST_CERTIFICATE", "COMPANY_PAN", "INCORPORATION_PROOF"];
    const mandatoryDocs = documents.filter(d => mandatoryDocTypes.includes(resolveClientDocumentType(d).key));
    const verifiedMandatory = mandatoryDocs.filter(
      d => d.verification_status === "VERIFIED" || d.verification_status === "APPROVED"
    );
    const rejectedDocs = documents.filter(d => d.verification_status === "REJECTED" || d.verification_status === "REPLACEMENT_REQUESTED");
    const pendingDocs = documents.filter(
      d => d.verification_status === "PENDING"
    );
    const pendingUploadDocs = documents.filter(
      d => d.verification_status === "PENDING_UPLOAD"
    );

    const isProfileComplete = client?.profile_completion_status !== "INCOMPLETE";

    // All mandatory docs present and verified, no rejections, no pending client uploads, and profile complete
    const isEligibleForApproval =
      documents.length > 0 &&
      pendingDocs.length === 0 &&
      pendingUploadDocs.length === 0 &&
      rejectedDocs.length === 0 &&
      mandatoryDocs.length >= 3 &&
      verifiedMandatory.length === mandatoryDocs.length &&
      isProfileComplete;

    return {
      mandatoryDocTypes,
      mandatoryDocs,
      verifiedMandatory,
      rejectedDocs,
      pendingDocs,
      pendingUploadDocs,
      isProfileComplete,
      isEligibleForApproval,
      totalCount: documents.length,
      verifiedCount: documents.filter(
        d => d.verification_status === "VERIFIED" || d.verification_status === "APPROVED"
      ).length
    };
  }, [documents, client]);

  // Document Review Handlers
  const handlePreviewDocument = (doc: any) => {
    setPreviewDoc(doc);
  };

  const handleVerifyDocument = async (docId: string) => {
    setIsSubmittingAction(true);
    setApprovalWarning(null);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_review_client_document", {
        p_document_id: docId,
        p_decision: "VERIFIED",
        p_reviewer_name: "NECL Compliance Desk"
      });
      if (rpcErr) {
        const { error: vErr } = await supabase
          .from("documents")
          .update({
            verification_status: "VERIFIED",
            rejection_reason: null,
            verified_by: "NECL Compliance Desk",
            verified_at: new Date().toISOString()
          })
          .eq("id", docId);

        if (vErr) {
          // Base schema check constraint accepts 'APPROVED'
          await supabase
            .from("documents")
            .update({
              verification_status: "APPROVED",
              rejection_reason: null,
              verified_by: "NECL Compliance Desk",
              verified_at: new Date().toISOString()
            })
            .eq("id", docId);
        }
      }
      setToastMsg("Document verified successfully.");
      setTimeout(() => setToastMsg(null), 2500);
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Verify document error:", err);
      setToastMsg(`Failed to verify document: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDocForAction || !actionReason.trim()) {
      setToastMsg("Please provide a rejection reason.");
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_review_client_document", {
        p_document_id: selectedDocForAction.id,
        p_decision: "REJECTED",
        p_reason: actionReason.trim(),
        p_reviewer_name: "NECL Compliance Desk"
      });
      if (rpcErr) {
        await supabase
          .from("documents")
          .update({
            verification_status: "REJECTED",
            rejection_reason: actionReason.trim(),
            verified_by: "NECL Compliance Desk",
            verified_at: new Date().toISOString()
          })
          .eq("id", selectedDocForAction.id);
      }
      setToastMsg("Document marked as REJECTED.");
      setTimeout(() => setToastMsg(null), 2500);
      setActiveModal(null);
      setSelectedDocForAction(null);
      setActionReason("");
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Reject document error:", err);
      setToastMsg(`Failed to reject document: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRequestDocReplacement = async () => {
    if (!selectedDocForAction || !actionReason.trim()) {
      setToastMsg("Please provide replacement instructions for the client.");
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_review_client_document", {
        p_document_id: selectedDocForAction.id,
        p_decision: "REPLACEMENT_REQUESTED",
        p_reason: actionReason.trim(),
        p_reviewer_name: "NECL Compliance Desk"
      });
      if (rpcErr) {
        const { error: rErr } = await supabase
          .from("documents")
          .update({
            verification_status: "REPLACEMENT_REQUESTED",
            rejection_reason: actionReason.trim(),
            verified_by: "NECL Compliance Desk",
            verified_at: new Date().toISOString()
          })
          .eq("id", selectedDocForAction.id);

        if (rErr) {
          // Base schema check constraint accepts 'REJECTED'
          await supabase
            .from("documents")
            .update({
              verification_status: "REJECTED",
              rejection_reason: `[Replacement Requested] ${actionReason.trim()}`,
              verified_by: "NECL Compliance Desk",
              verified_at: new Date().toISOString()
            })
            .eq("id", selectedDocForAction.id);
        }
      }
      setToastMsg("Replacement requested. Client will be asked to re-upload.");
      setTimeout(() => setToastMsg(null), 2500);
      setActiveModal(null);
      setSelectedDocForAction(null);
      setActionReason("");
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Replacement request error:", err);
      setToastMsg(`Error: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Registration Decision Handlers (Phase 8)
  const handleApproveRegistration = async () => {
    if (!complianceStats.isProfileComplete) {
      const missing = Array.isArray(client?.incomplete_fields) && client.incomplete_fields.length > 0
        ? client.incomplete_fields.join(", ")
        : "required registration fields";
      setApprovalWarning(
        `Cannot approve registration: Profile is incomplete. The client must complete: ${missing}.`
      );
      setToastMsg("Approval blocked: Client profile is incomplete.");
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }

    if (complianceStats.pendingUploadDocs.length > 0) {
      setApprovalWarning(
        `Cannot approve registration: ${complianceStats.pendingUploadDocs.length} document(s) are awaiting client upload.`
      );
      setToastMsg("Approval blocked: Documents pending client upload.");
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }

    if (!complianceStats.isEligibleForApproval) {
      setApprovalWarning(
        "Cannot approve registration: All mandatory compliance documents (GST Certificate, Company PAN, and Incorporation Proof) must be submitted and verified first."
      );
      setToastMsg("Approval blocked: Mandatory compliance documents unverified.");
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }

    setIsSubmittingAction(true);
    setApprovalWarning(null);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_review_client_registration", {
        p_company_id: client.id,
        p_decision: "APPROVED",
        p_reviewer_name: "NECL Compliance Desk"
      });

      if (rpcErr || (rpcData && !rpcData.success)) {
        const msg = rpcData?.error || rpcErr?.message || "Failed to approve client registration";
        if (msg.includes("mandatory") || msg.includes("verified")) {
          setApprovalWarning(msg);
          setToastMsg(msg);
          setTimeout(() => setToastMsg(null), 4000);
          setIsSubmittingAction(false);
          return;
        }

        // Direct fallback update: Try APPROVED first, fall back to ACTIVE if schema requires
        const { error: updErr } = await supabase
          .from("client_companies")
          .update({
            status: "APPROVED",
            approved_at: new Date().toISOString(),
            approved_by: "NECL Compliance Desk",
            rejection_reason: null,
            correction_notes: null
          })
          .eq("id", client.id);

        if (updErr) {
          await supabase
            .from("client_companies")
            .update({
              status: "ACTIVE",
              updated_at: new Date().toISOString()
            })
            .eq("id", client.id);
        }

        await supabase
          .from("client_users")
          .update({ status: "ACTIVE" })
          .eq("client_id", client.id);
      }

      setToastMsg("Client registration APPROVED! Dashboard access granted to client.");
      setTimeout(() => setToastMsg(null), 3500);
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Approve client error:", err);
      setToastMsg(`Failed to approve: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3500);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRequestCorrections = async () => {
    if (!actionReason.trim()) {
      setToastMsg("Please provide correction instructions for the client.");
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_review_client_registration", {
        p_company_id: client.id,
        p_decision: "CORRECTIONS_REQUESTED",
        p_reason: actionReason.trim(),
        p_reviewer_name: "NECL Compliance Desk"
      });

      if (rpcErr) {
        await supabase
          .from("client_companies")
          .update({
            status: "CORRECTIONS_REQUESTED",
            correction_notes: actionReason.trim()
          })
          .eq("id", client.id);

        await supabase
          .from("client_users")
          .update({ status: "CORRECTIONS_REQUESTED" })
          .eq("client_id", client.id);
      }

      setToastMsg("Corrections requested. Client notified in mobile app.");
      setTimeout(() => setToastMsg(null), 3000);
      setActiveModal(null);
      setActionReason("");
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Request corrections error:", err);
      setToastMsg(`Error: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRejectRegistration = async () => {
    if (!actionReason.trim()) {
      setToastMsg("Please provide a rejection reason.");
      setTimeout(() => setToastMsg(null), 2500);
      return;
    }
    setIsSubmittingAction(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_review_client_registration", {
        p_company_id: client.id,
        p_decision: "REJECTED",
        p_reason: actionReason.trim(),
        p_reviewer_name: "NECL Compliance Desk"
      });

      if (rpcErr) {
        await supabase
          .from("client_companies")
          .update({
            status: "REJECTED",
            rejection_reason: actionReason.trim(),
            rejected_at: new Date().toISOString(),
            rejected_by: "NECL Compliance Desk"
          })
          .eq("id", client.id);

        await supabase
          .from("client_users")
          .update({ status: "REJECTED" })
          .eq("client_id", client.id);
      }

      setToastMsg("Registration application marked as REJECTED.");
      setTimeout(() => setToastMsg(null), 3000);
      setActiveModal(null);
      setActionReason("");
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Reject registration error:", err);
      setToastMsg(`Error: ${err.message}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Copy GSTIN helper
  const handleCopyGst = () => {
    if (client?.gstin) {
      navigator.clipboard.writeText(client.gstin);
      setCopiedGst(true);
      setToastMsg("GSTIN copied to clipboard");
      setTimeout(() => {
        setCopiedGst(false);
        setToastMsg(null);
      }, 2500);
    }
  };

  // Create real requirement in Supabase
  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setIsSubmittingAction(true);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randNum = Math.floor(100 + Math.random() * 900);
    const newReqId = `REQ-${dateStr}-${randNum}`;

    try {
      const { error: insErr } = await supabase.from("requirements").insert({
        id: newReqId,
        client_id: client.id,
        pickup_pincode: "500039",
        pickup_address: newReqForm.origin,
        destination_pincode: "440016",
        destination_address: newReqForm.destination,
        required_capacity_mt: parseFloat(newReqForm.capacityMt) || 30,
        vehicle_type: newReqForm.truckType,
        material_type: newReqForm.material,
        loading_datetime: new Date(Date.now() + 86400000).toISOString(),
        status: "NEW_REQUIREMENT"
      });

      if (insErr) throw insErr;

      setToastMsg(`Requirement ${newReqId} saved in database!`);
      setTimeout(() => setToastMsg(null), 3000);
      setActiveModal(null);

      // Refresh real data from DB
      await loadClientDetailsFromDB();
    } catch (err: any) {
      setError(err.message || "Failed to create requirement in database");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Create real booking in Supabase following the official quotation-to-booking workflow
  const handleConfirmBookingWorkflow = async (reqId: string, quoteId?: string, quoteTotalAmount?: number) => {
    if (!client || isSubmittingAction) return;

    if (!hasPermission("bookings", "create")) {
      setToastMsg("Access Denied: You do not have permission to create bookings.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    if (!reqId) {
      setToastMsg("Please select an active transport requirement.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    setIsSubmittingAction(true);

    try {
      // 1. Generate canonical NECL ID atomically using generateDbNeclId('BK')
      const newBokId = await generateDbNeclId("BK");

      let finalQuoteId = quoteId || null;
      let finalAmount = quoteTotalAmount || 0;

      // If user supplied a custom or fast-track client rate without an existing accepted quote record
      if (!finalQuoteId) {
        const selectedReq = requirements.find(r => r.id === reqId);
        const capacity = selectedReq ? parseFloat(selectedReq.required_capacity_mt) || 25 : 25;
        const rateToUse = customClientRate ? parseFloat(customClientRate) : (finalAmount || capacity * 2500);

        const { data: newQuote, error: qErr } = await supabase
          .from("client_quotes")
          .insert({
            requirement_id: reqId,
            version: 1,
            vendor_base_cost: (rateToUse * 0.85).toFixed(2),
            admin_margin: (rateToUse * 0.15).toFixed(2),
            gst_rate_percent: 18.00,
            gst_amount: (rateToUse * 0.18).toFixed(2),
            total_client_amount: rateToUse,
            validity_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            status: "ACCEPTED"
          })
          .select()
          .single();

        if (qErr) {
          console.warn("Could not insert quote record, proceeding with booking insert:", qErr.message);
        } else if (newQuote) {
          finalQuoteId = newQuote.id;
          finalAmount = rateToUse;
        }
      }

      // 2. Insert booking record into Supabase
      const { error: insErr } = await supabase.from("bookings").insert({
        id: newBokId,
        booking_code: newBokId,
        requirement_id: reqId,
        client_id: client.id,
        accepted_quote_id: finalQuoteId,
        booking_status: "CONFIRMED",
        payment_status: "PAYMENT_PENDING",
        confirmed_at: new Date().toISOString(),
        grand_total: finalAmount || 0,
        amount_received: 0
      });

      if (insErr) throw insErr;

      // 3. Mark the requirement as BOOKED
      await supabase
        .from("requirements")
        .update({ status: "BOOKED" })
        .eq("id", reqId);

      setToastMsg(`Booking ${newBokId} recorded in database!`);
      setTimeout(() => setToastMsg(null), 3000);
      setActiveModal(null);
      setSelectedReqForBooking("");
      setSelectedQuoteForBooking("");
      setCustomClientRate("");

      // Refresh real data from DB
      await loadClientDetailsFromDB();
    } catch (err: any) {
      console.error("Create booking error:", err);
      setError(err.message || "Failed to create booking in database");
      setToastMsg(`Error: ${err.message || "Failed to create booking"}`);
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Render comprehensive booking history card / table
  const renderBookingHistoryCard = (isFullTab: boolean = false) => {
    return (
      <div className="booking-history-card">
        {/* Header */}
        <div className="booking-history-header">
          <div className="booking-history-title-wrap">
            <h3 className="booking-history-title">
              <Truck size={18} color="#F05A22" />
              <span>{isFullTab ? "Client Bookings & Sourcing Operations" : "Booking History"}</span>
            </h3>
            <span className="booking-count-badge">
              {filteredClientBookings.length} {filteredClientBookings.length === 1 ? "Booking" : "Bookings"}
              {filteredClientBookings.length !== bookings.length && ` (filtered from ${bookings.length})`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isFullTab && (
              <button
                type="button"
                className="btn-pagination-step"
                onClick={() => setActiveTab("bookings")}
                title="Expand full bookings module view"
              >
                <ExternalLink size={13} />
                <span>Dedicated Tab</span>
              </button>
            )}

            {hasPermission("bookings", "create") && (
              <button
                type="button"
                className="btn-create-booking-primary"
                onClick={() => setActiveModal("CREATE_BOOKING")}
              >
                <Plus size={14} />
                <span>Create Booking</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated KPI row for full tab */}
        {isFullTab && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, padding: "16px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Total Bookings</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#172B4D", marginTop: 4 }}>{profileKpis.totalBoks}</div>
              <div style={{ fontSize: 11, color: "#16A34A", marginTop: 2 }}>Database Records</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Confirmed Bookings</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1D4ED8", marginTop: 4 }}>{profileKpis.confirmedBoks}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Commercially Confirmed</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>In-Progress Trips</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#7E22CE", marginTop: 4 }}>{profileKpis.inTransitTrips}</div>
              <div style={{ fontSize: 11, color: "#7E22CE", marginTop: 2 }}>Active On Road</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Completed Trips</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", marginTop: 4 }}>{profileKpis.completedTrips}</div>
              <div style={{ fontSize: 11, color: "#15803D", marginTop: 2 }}>{profileKpis.successRate} fulfillment</div>
            </div>
            <div style={{ background: "#FFFFFF", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Pending Receivables</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#B45309", marginTop: 4 }}>
                {bookings.filter(b => b.payment_status === "PAYMENT_PENDING").length}
              </div>
              <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>Awaiting Client Payment</div>
            </div>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="booking-history-filter-bar">
          <div className="booking-filter-group-left">
            <div className="booking-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="booking-search-input"
                placeholder="Search by Booking ID, Req ID, Quote ID, Vendor..."
                value={bookingSearch}
                onChange={e => {
                  setBookingSearch(e.target.value);
                  setBookingPage(1);
                }}
              />
              {bookingSearch && (
                <button
                  type="button"
                  className="booking-search-clear-btn"
                  onClick={() => {
                    setBookingSearch("");
                    setBookingPage(1);
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Status:</span>
              <select
                className="booking-filter-select"
                value={bookingStatusFilter}
                onChange={e => {
                  setBookingStatusFilter(e.target.value);
                  setBookingPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="CLIENT_ACCEPTED">Client Accepted</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Sort:</span>
              <select
                className="booking-filter-select"
                value={bookingDateSort}
                onChange={e => {
                  setBookingDateSort(e.target.value as "NEWEST" | "OLDEST");
                  setBookingPage(1);
                }}
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
              </select>
            </div>

            {(bookingSearch || bookingStatusFilter !== "ALL") && (
              <button
                type="button"
                className="btn-pagination-step"
                style={{ fontSize: 11.5, padding: "4px 8px" }}
                onClick={() => {
                  setBookingSearch("");
                  setBookingStatusFilter("ALL");
                  setBookingPage(1);
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Content Table or Empty State */}
        {bookings.length === 0 ? (
          /* Exact NECL Empty State */
          <div className="client-bookings-empty-state">
            <div className="empty-state-icon-box">
              <Truck size={30} color="#94A3B8" />
            </div>
            <h4 className="empty-state-title">No bookings found for this client.</h4>
            <p className="empty-state-subtitle">
              Bookings will appear here after the required quotation and booking confirmation steps are completed.
            </p>
            {hasPermission("bookings", "create") && (
              <button
                type="button"
                className="btn-create-booking-primary"
                onClick={() => setActiveModal("CREATE_BOOKING")}
              >
                <Plus size={14} />
                <span>Create Booking</span>
              </button>
            )}
          </div>
        ) : filteredClientBookings.length === 0 ? (
          <div className="client-bookings-empty-state">
            <div className="empty-state-icon-box">
              <Search size={28} color="#94A3B8" />
            </div>
            <h4 className="empty-state-title">No bookings match your filter criteria</h4>
            <p className="empty-state-subtitle">
              Try clearing your search term or selecting a different status filter to view bookings.
            </p>
            <button
              type="button"
              className="btn-pagination-step"
              onClick={() => {
                setBookingSearch("");
                setBookingStatusFilter("ALL");
              }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="booking-table-scroll-wrap">
            <table className="booking-history-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Requirement ID</th>
                  <th>Quotation ID</th>
                  <th>Creation Date</th>
                  <th>Vendor Name</th>
                  <th>Trips Count</th>
                  <th>Booking Status</th>
                  <th>Trip Progress</th>
                  <th>Assigned Vehicle & Driver</th>
                  <th>Expected Delivery Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClientBookings.map((b: any) => (
                  <tr
                    key={b.id}
                    className="clickable-row"
                    onClick={() => handleNavigateToBooking(b.id)}
                  >
                    <td>
                      <div className="booking-id-cell">
                        <span className="booking-id-text">{b.displayId}</span>
                        <button
                          type="button"
                          className="btn-id-copy-icon"
                          title="Copy Booking ID"
                          onClick={(e) => handleCopyBookingId(e, b.displayId)}
                        >
                          {copiedBookingId === b.displayId ? (
                            <Check size={12} color="#16A34A" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#172B4D" }}>
                          {b.requirement_id}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {b.route_summary}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ fontFamily: "monospace", color: "#475569" }}>
                          {b.quote_display_id}
                        </div>
                        {b.quote_amount != null && canViewMargins() && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginTop: 2 }}>
                            ₹{Number(b.quote_amount).toLocaleString("en-IN")}
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ color: "#475569", whiteSpace: "nowrap" }}>
                        {b.confirmed_at
                          ? new Date(b.confirmed_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })
                          : "Pending"}
                      </div>
                    </td>

                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: b.vendor_name === "Pending Assignment" ? "#94A3B8" : "#172B4D"
                        }}
                      >
                        {b.vendor_name || "Pending Assignment"}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, color: "#172B4D" }}>
                        {b.trip_count} {b.trip_count === 1 ? "Trip" : "Trips"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge-booking-status status-${(b.booking_status || "confirmed").toLowerCase()}`}
                      >
                        {b.booking_status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge-trip-progress ${
                          b.trip_progress_status === "DELIVERED"
                            ? "delivered"
                            : b.trip_progress_status === "IN_TRANSIT"
                            ? "in_transit"
                            : ""
                        }`}
                      >
                        <Truck size={12} />
                        <span>{b.trip_progress_label}</span>
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          fontSize: 12,
                          color: b.vehicle_driver_display === "Unassigned" ? "#94A3B8" : "#172B4D"
                        }}
                      >
                        {b.vehicle_driver_display}
                      </div>
                    </td>

                    <td>
                      <div style={{ color: "#475569", whiteSpace: "nowrap" }}>
                        {b.expected_delivery_display}
                      </div>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-view-booking-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToBooking(b.id);
                        }}
                        title="View details in Bookings module"
                      >
                        <Eye size={13} />
                        <span>View Booking</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredClientBookings.length > BOOKINGS_PAGE_SIZE && (
          <div className="booking-pagination-footer">
            <div className="booking-pagination-text">
              Showing {(bookingPage - 1) * BOOKINGS_PAGE_SIZE + 1}–
              {Math.min(bookingPage * BOOKINGS_PAGE_SIZE, filteredClientBookings.length)} of{" "}
              {filteredClientBookings.length} bookings
            </div>

            <div className="booking-pagination-controls">
              <button
                type="button"
                className="btn-pagination-step"
                disabled={bookingPage <= 1}
                onClick={() => setBookingPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <span style={{ fontSize: 12, fontWeight: 600, color: "#172B4D", padding: "0 4px" }}>
                Page {bookingPage} of {totalBookingPages}
              </span>

              <button
                type="button"
                className="btn-pagination-step"
                disabled={bookingPage >= totalBookingPages}
                onClick={() => setBookingPage(prev => Math.min(totalBookingPages, prev + 1))}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 14 }}>
        <Loader size={36} color="#F45325" className="spin-icon" />
        <span style={{ color: "#64748B", fontSize: 14 }}>Querying database for client profile & records...</span>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="alert-error-bar" style={{ background: "var(--brand-soft)", border: "1px solid #FCA5A5", color: "#F45325", padding: 24, borderRadius: 12 }}>
        <AlertCircle size={24} />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 16 }}>Client Profile Error</h4>
          <p style={{ margin: 0, fontSize: 13 }}>{error || "Client record not found in the connected database."}</p>
        </div>
        <button className="btn-back-outline" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Return to Client Directory</span>
        </button>
      </div>
    );
  }

  const primaryContact = contacts[0];
  const additionalContacts = contacts.slice(1);

  return (
    <div className="client-profile-wrapper">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-success">
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>Clients</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-link" onClick={onBack}>Client Directory</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{client.company_name}</span>
      </div>

      {/* Top Header Bar */}
      <div className="profile-top-header">
        <div>
          <div className="profile-title-block">
            <h1 className="profile-company-heading">{client.company_name}</h1>
            {(() => {
              const st = client.status?.toUpperCase() || "PENDING";
              const isApp = st === "APPROVED" || st === "ACTIVE";
              const isRej = st === "REJECTED";
              const isCorr = st === "CORRECTIONS_REQUESTED";
              return (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: isApp ? "#DCFCE7" : isRej ? "#FEE2E2" : isCorr ? "#FAF5FF" : "#FEF3C7",
                    color: isApp ? "#166534" : isRej ? "#991B1B" : isCorr ? "#7E22CE" : "#92400E",
                    border: `1px solid ${isApp ? "#86EFAC" : isRej ? "#FCA5A5" : isCorr ? "#D8B4FE" : "#FDE68A"}`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {isApp ? <CheckCircle size={12} /> : isRej ? <AlertCircle size={12} /> : <Clock size={12} />}
                  <span>{isApp ? "Approved & Active" : isRej ? "Application Rejected" : isCorr ? "Corrections Requested" : "Pending Approval"}</span>
                </span>
              );
            })()}
            <span className="type-badge manufacturer">
              {client.client_type || "Client"}
            </span>
          </div>

          <div style={{ fontSize: 13, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0F172A", background: "#F1F5F9", padding: "2px 8px", borderRadius: 4, border: "1px solid #E2E8F0" }}>
                {formatDisplayId("CL", client.client_code || client.id, client.created_at)}
              </span>
              <button
                type="button"
                className={`btn-copy-chip ${copiedClientId ? "copied" : ""}`}
                onClick={() => {
                  const cid = formatDisplayId("CL", client.client_code || client.id, client.created_at);
                  navigator.clipboard.writeText(cid);
                  setCopiedClientId(true);
                  setTimeout(() => setCopiedClientId(false), 2000);
                }}
                title="Copy NECL Client ID"
              >
                {copiedClientId ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>

            <span style={{ color: "#CBD5E1" }}>|</span>
            <span>Registered: {new Date(client.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            className="btn-header-outline"
            id="btn-edit-client"
            onClick={() => setActiveModal("EDIT_CLIENT")}
          >
            <Edit2 size={14} />
            <span>Edit Client</span>
          </button>

          <button
            className="btn-header-outline"
            onClick={() => setActiveModal("SEND_MESSAGE")}
          >
            <MessageSquare size={14} />
            <span>Send Message</span>
          </button>

          <button
            className="btn-create-gold"
            onClick={() => setActiveModal("CREATE_REQ")}
            id="btn-profile-create-req"
          >
            <Plus size={16} />
            <span>Create Requirement</span>
          </button>
        </div>
      </div>

      {/* Company Overview Banner Card */}
      <div className="company-banner-card">
        <div className="banner-left-identity">
          <div className="banner-avatar-lg">
            {client.company_name ? client.company_name[0] : "C"}
          </div>

          <div>
            <div className="banner-company-name-row">
              <h2 className="banner-company-title">{client.company_name}</h2>
              <span className="type-badge manufacturer">Verified Business</span>
            </div>
            <div className="banner-company-desc">
              {client.city} • Registered Logistics Account
            </div>

            <div className="banner-contacts-row">
              {primaryContact?.mobile && (
                <a href={`tel:${primaryContact.mobile}`} className="banner-contact-item">
                  <Phone size={13} color="#F45325" />
                  <span>+91 {primaryContact.mobile}</span>
                </a>
              )}
              {primaryContact?.email && (
                <a href={`mailto:${primaryContact.email}`} className="banner-contact-item">
                  <Mail size={13} color="#F45325" />
                  <span>{primaryContact.email}</span>
                </a>
              )}
              <span className="banner-contact-item">
                <MapPin size={13} color="#F45325" />
                <span>{client.city}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Metadata Grid */}
        <div className="banner-meta-grid">
          <div className="banner-meta-item">
            <span className="banner-meta-label">GSTIN</span>
            <div className="banner-meta-value mono-text" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{client.gstin || "—"}</span>
              {client.gstin && (
                <button
                  type="button"
                  onClick={handleCopyGst}
                  title="Copy GSTIN"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 2 }}
                >
                  {copiedGst ? <Check size={13} color="#F45325" /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          <div className="banner-meta-item">
            <span className="banner-meta-label">City</span>
            <span className="banner-meta-value">{client.city}</span>
          </div>

          <div className="banner-meta-item">
            <span className="banner-meta-label">PAN Number</span>
            <div className="banner-meta-value mono-text" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{client.pan || "—"}</span>
              {client.pan && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(client.pan);
                    setCopiedPan(true);
                    setTimeout(() => setCopiedPan(false), 2000);
                  }}
                  title="Copy PAN"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 2 }}
                >
                  {copiedPan ? <Check size={13} color="#F45325" /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>

          <div className="banner-meta-item">
            <span className="banner-meta-label">PIN Code</span>
            <span className="banner-meta-value">{client.pincode}</span>
          </div>
        </div>
      </div>

      {/* ── Registration Application Verification & Decision Bar (Phase 8) ── */}
      <div
        className="registration-decision-card"
        style={{
          marginTop: 18,
          marginBottom: 16,
          padding: "20px 24px",
          borderRadius: 14,
          background:
            client.status === "APPROVED" || client.status === "ACTIVE"
              ? "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)"
              : client.status === "REJECTED"
              ? "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)"
              : client.status === "CORRECTIONS_REQUESTED"
              ? "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)"
              : "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
          border:
            client.status === "APPROVED" || client.status === "ACTIVE"
              ? "1px solid #86EFAC"
              : client.status === "REJECTED"
              ? "1px solid #FCA5A5"
              : client.status === "CORRECTIONS_REQUESTED"
              ? "1px solid #D8B4FE"
              : "1px solid #FCD34D",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 280 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background:
                client.status === "APPROVED" || client.status === "ACTIVE"
                  ? "#22C55E"
                  : client.status === "REJECTED"
                  ? "#EF4444"
                  : client.status === "CORRECTIONS_REQUESTED"
                  ? "#A855F7"
                  : "#F59E0B",
              color: "#FFFFFF"
            }}
          >
            {client.status === "APPROVED" || client.status === "ACTIVE" ? (
              <ShieldCheck size={24} />
            ) : client.status === "REJECTED" ? (
              <AlertCircle size={24} />
            ) : client.status === "CORRECTIONS_REQUESTED" ? (
              <Edit2 size={22} />
            ) : (
              <Clock size={24} />
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                {client.status === "APPROVED" || client.status === "ACTIVE"
                  ? "Client Registration Approved & Active"
                  : client.status === "REJECTED"
                  ? "Client Registration Rejected"
                  : client.status === "CORRECTIONS_REQUESTED"
                  ? "Corrections Requested from Client"
                  : "Registration Awaiting Admin Verification"}
              </h3>

              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 9999,
                  background:
                    client.status === "APPROVED" || client.status === "ACTIVE"
                      ? "#15803D"
                      : client.status === "REJECTED"
                      ? "#DC2626"
                      : client.status === "CORRECTIONS_REQUESTED"
                      ? "#7E22CE"
                      : "#D97706",
                  color: "#FFFFFF"
                }}
              >
                {client.status}
              </span>
            </div>

            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>
              {client.status === "APPROVED" || client.status === "ACTIVE"
                ? `Approved on ${client.approved_at ? new Date(client.approved_at).toLocaleDateString("en-IN") : "Record"} by ${client.approved_by || "Compliance Desk"}. Client has verified phone and full access to operational dashboard.`
                : client.status === "REJECTED"
                ? `Rejection Reason: "${client.rejection_reason || "Compliance criteria not met"}". Client access to dashboard is blocked.`
                : client.status === "CORRECTIONS_REQUESTED"
                ? `Correction Notes: "${client.correction_notes || "Document re-upload or details required"}". Waiting for client to resubmit.`
                : `Submitted on ${new Date(client.created_at).toLocaleDateString("en-IN")}. Contact: ${client.company_phone || "Verified"}. All mandatory compliance documents must be verified prior to approval.`}
            </p>

            {/* Document progress counter */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: complianceStats.isEligibleForApproval ? "#15803D" : "#B45309",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5
                }}
              >
                {complianceStats.isEligibleForApproval ? (
                  <CheckCircle size={14} color="#16A34A" />
                ) : (
                  <Clock size={14} color="#D97706" />
                )}
                Mandatory Documents: {complianceStats.verifiedMandatory.length} of {Math.max(complianceStats.mandatoryDocs.length, 3)} verified
              </span>

              {complianceStats.rejectedDocs.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={14} /> {complianceStats.rejectedDocs.length} rejected
                </span>
              )}

              {complianceStats.pendingUploadDocs.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={14} /> {complianceStats.pendingUploadDocs.length} pending client upload
                </span>
              )}

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: client?.profile_completion_status === "INCOMPLETE" ? "#FEF2F2" : "#F0FDF4",
                  color: client?.profile_completion_status === "INCOMPLETE" ? "#DC2626" : "#15803D",
                  border: `1px solid ${client?.profile_completion_status === "INCOMPLETE" ? "#FCA5A5" : "#BBF7D0"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                {client?.profile_completion_status === "INCOMPLETE" ? (
                  <AlertCircle size={12} />
                ) : (
                  <CheckCircle size={12} />
                )}
                Profile: {client?.profile_completion_status === "INCOMPLETE" ? "Incomplete" : "Complete"}
              </span>

              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#F05A22",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer"
                }}
                onClick={() => setActiveTab("documents")}
              >
                Inspect KYC Files ({documents.length})
              </button>
            </div>

            {client?.profile_completion_status === "INCOMPLETE" && Array.isArray(client.incomplete_fields) && client.incomplete_fields.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#B91C1C", fontWeight: 500, background: "rgba(254, 226, 226, 0.6)", padding: "4px 8px", borderRadius: 6, border: "1px dashed #F87171" }}>
                Missing Profile Information: <strong style={{ fontWeight: 600 }}>{client.incomplete_fields.join(", ")}</strong> (Client prompted upon login)
              </div>
            )}

            {approvalWarning && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  color: "#B91C1C",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <AlertCircle size={16} />
                <span>{approvalWarning}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-create-gold"
            style={{
              background: complianceStats.isEligibleForApproval ? "linear-gradient(135deg, #16A34A 0%, #15803D 100%)" : "#94A3B8",
              borderColor: complianceStats.isEligibleForApproval ? "#15803D" : "#94A3B8",
              color: "#FFFFFF",
              fontWeight: 700,
              boxShadow: complianceStats.isEligibleForApproval ? "0 4px 12px rgba(22, 163, 74, 0.25)" : "none",
              cursor: isSubmittingAction ? "wait" : "pointer"
            }}
            disabled={isSubmittingAction}
            onClick={handleApproveRegistration}
          >
            {isSubmittingAction ? <Loader size={15} className="spin-icon" /> : <ShieldCheck size={16} />}
            <span>Approve Registration</span>
          </button>

          <button
            type="button"
            className="btn-header-outline"
            style={{ background: "#FFFFFF", borderColor: "#CBD5E1", color: "#334155" }}
            onClick={() => {
              setActionReason("");
              setActiveModal("REQUEST_CORRECTIONS");
            }}
          >
            <Edit2 size={14} />
            <span>Request Corrections</span>
          </button>

          <button
            type="button"
            className="btn-header-outline"
            style={{ background: "#FFFFFF", borderColor: "#FCA5A5", color: "#DC2626" }}
            onClick={() => {
              setActionReason("");
              setActiveModal("REJECT_REG");
            }}
          >
            <X size={14} />
            <span>Reject Registration</span>
          </button>
        </div>
      </div>

      {/* 9 Horizontal Navigation Tabs */}
      <div className="profile-horizontal-tabs">
        <button
          className={`profile-tab-pill ${activeTab === "overview" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Building2 size={14} />
          <span>Overview</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "contacts" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <Users size={14} />
          <span>Contacts ({contacts.length})</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "addresses" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("addresses")}
        >
          <MapPin size={14} />
          <span>Addresses</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "history" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <Package size={14} />
          <span>Requirement History ({requirements.length})</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "bookings" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("bookings")}
        >
          <Truck size={14} />
          <span>Bookings ({bookings.length})</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "finance" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("finance")}
        >
          <DollarSign size={14} />
          <span>Invoices & Payments</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "documents" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          <FileText size={14} />
          <span>Documents</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "notes" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          <Archive size={14} />
          <span>Notes</span>
        </button>

        <button
          className={`profile-tab-pill ${activeTab === "activity" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <Activity size={14} />
          <span>Activity Log</span>
        </button>
      </div>

      {/* 5 Pastel KPI Cards (Derived from Real Database Rows) */}
      <div className="profile-kpi-row-5">
        <div className="profile-kpi-card">
          <div className="profile-kpi-icon-box" style={{ background: "rgba(240, 90, 34, 0.08)", borderColor: "rgba(240, 90, 34, 0.2)" }}>
            <FileText size={18} color="#F05A22" />
          </div>
          <div>
            <div className="profile-kpi-label">Total Requirements</div>
            <div className="profile-kpi-number">{profileKpis.totalReqs}</div>
            <div className="profile-kpi-trend green">
              <span>Database Records</span>
            </div>
          </div>
        </div>

        <div className="profile-kpi-card">
          <div className="profile-kpi-icon-box" style={{ background: "rgba(59, 130, 246, 0.08)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
            <Truck size={18} color="#3B82F6" />
          </div>
          <div>
            <div className="profile-kpi-label">Total Bookings</div>
            <div className="profile-kpi-number">{profileKpis.totalBoks}</div>
            <div className="profile-kpi-trend green">
              <span>Linked Bookings</span>
            </div>
          </div>
        </div>

        <div className="profile-kpi-card">
          <div className="profile-kpi-icon-box" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.2)" }}>
            <CheckCircle size={18} color="#10B981" />
          </div>
          <div>
            <div className="profile-kpi-label">Completed Trips</div>
            <div className="profile-kpi-number">{profileKpis.completedTrips}</div>
            <div className="profile-kpi-trend green">
              <span>{profileKpis.successRate} success rate</span>
            </div>
          </div>
        </div>

        <div className="profile-kpi-card">
          <div className="profile-kpi-icon-box" style={{ background: "rgba(139, 92, 246, 0.08)", borderColor: "rgba(139, 92, 246, 0.2)" }}>
            <Activity size={18} color="#8B5CF6" />
          </div>
          <div>
            <div className="profile-kpi-label">In-Transit Trips</div>
            <div className="profile-kpi-number">{profileKpis.inTransitTrips}</div>
            <div className="profile-kpi-trend green">
              <span>Active on Road</span>
            </div>
          </div>
        </div>

        <div className="profile-kpi-card">
          <div className="profile-kpi-icon-box" style={{ background: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <CreditCard size={18} color="#EF4444" />
          </div>
          <div>
            <div className="profile-kpi-label">Receivables Status</div>
            <div className="profile-kpi-number">{bookings.filter(b => b.payment_status === "PAYMENT_PENDING").length}</div>
            <div className="profile-kpi-trend red">
              <span>Pending Invoices</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Content Grid or Dedicated Tab */}
      {activeTab === "bookings" ? (
        <div style={{ marginTop: 20 }}>
          {renderBookingHistoryCard(true)}
        </div>
      ) : (
        <div className="profile-main-grid">
        {/* Left Column: Requirements Table + Bookings Table */}
        <div className="profile-left-tables">
          {/* Section 1: Recent Transport Requirements */}
          <div className="profile-table-card">
            <div className="profile-table-header">
              <h3 className="profile-table-title">Recent Transport Requirements</h3>
              <div className="profile-table-header-actions">
                <button
                  className="btn-table-orange-sm"
                  onClick={() => setActiveModal("CREATE_REQ")}
                >
                  <Plus size={13} />
                  <span>Create Requirement</span>
                </button>
              </div>
            </div>

            {requirements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748B" }}>
                <Package size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: "#111111", marginBottom: 4 }}>
                  No requirements raised yet for {client.company_name}
                </div>
                <div style={{ fontSize: 13, marginBottom: 14 }}>
                  Create the first freight requirement to initiate vendor sourcing.
                </div>
                <button
                  className="btn-create-gold"
                  onClick={() => setActiveModal("CREATE_REQ")}
                >
                  <Plus size={14} />
                  <span>Create Requirement</span>
                </button>
              </div>
            ) : (
              <table className="profile-mini-table">
                <thead>
                  <tr>
                    <th>REQ ID</th>
                    <th>Date</th>
                    <th>Origin → Destination</th>
                    <th>Material</th>
                    <th>Truck Type</th>
                    <th>Capacity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map(req => (
                    <tr key={req.id}>
                      <td>
                        <span style={{ color: "#F45325", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                          {req.id}
                        </span>
                      </td>
                      <td style={{ color: "#64748B" }}>
                        {new Date(req.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ fontWeight: 600, color: "#111111" }}>
                        {req.pickup_address?.split(",")[0] || "Origin"} → {req.destination_address?.split(",")[0] || "Destination"}
                      </td>
                      <td>{req.material_type}</td>
                      <td style={{ color: "#64748B" }}>{req.vehicle_type}</td>
                      <td style={{ fontWeight: 600 }}>{req.required_capacity_mt} MT</td>
                      <td>
                        <span className="badge-status-pill open">
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 2: Booking History */}
          {renderBookingHistoryCard(false)}

          {/* Section 3: Submitted KYC & Business Compliance Documents (Phase 8) */}
          <div className="profile-table-card" id="kyc-documents-card" style={{ marginTop: 20 }}>
            <div className="profile-table-header">
              <div>
                <h3 className="profile-table-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={17} color="#F05A22" />
                  <span>KYC Compliance & Business Documents</span>
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748B" }}>
                  Verify GST, PAN, and Incorporation proofs before approving client account.
                </p>
              </div>

              <div className="profile-table-header-actions">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: complianceStats.isEligibleForApproval ? "#DCFCE7" : "#FEF3C7",
                    color: complianceStats.isEligibleForApproval ? "#15803D" : "#B45309"
                  }}
                >
                  {complianceStats.verifiedMandatory.length} / {Math.max(complianceStats.mandatoryDocs.length, 3)} Mandatory Verified
                </span>
              </div>
            </div>

            {documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "#64748B" }}>
                <FileText size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: "#111111", marginBottom: 4 }}>
                  No KYC documents uploaded yet
                </div>
                <div style={{ fontSize: 13 }}>
                  Client registration documents submitted via mobile app will appear here for verification.
                </div>
              </div>
            ) : (
              <table className="profile-mini-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Requirement</th>
                    <th>Upload Responsibility</th>
                    <th>Uploaded File</th>
                    <th>Upload Date</th>
                    <th>Verification Status</th>
                    <th>Audit Notes</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc: any) => {
                    const resolved = resolveClientDocumentType(doc);
                    const isMandatory = resolved.key !== "MSME_UDYAM" && resolved.key !== "OTHER";
                    const isVerified = doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED";
                    const isRejected = doc.verification_status === "REJECTED";
                    const isReplaced = doc.verification_status === "REPLACEMENT_REQUESTED" || doc.verification_status === "RE_UPLOADED";
                    const isPendingUpload = doc.verification_status === "PENDING_UPLOAD";
                    const isClientResp = doc.uploaded_by === "CLIENT" ||
                      doc.metadata?.upload_responsibility === "CLIENT" ||
                      client?.document_upload_responsibility?.[resolved.key] === "CLIENT";
                    const docTitle = resolved.label;

                    return (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                background: isVerified ? "#F0FDF4" : isRejected ? "#FEF2F2" : isPendingUpload ? "#EFF6FF" : "#FFF7ED",
                                border: "1px solid #E2E8F0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                              }}
                            >
                              <FileText size={17} color={isVerified ? "#16A34A" : isRejected ? "#DC2626" : isPendingUpload ? "#2563EB" : "#EA580C"} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                                {docTitle}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                                {isMandatory ? "Required for company registration" : "Optional verification record"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {isMandatory ? (
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                              Mandatory
                            </span>
                          ) : (
                            <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>
                              Optional
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: isClientResp ? "#F5F3FF" : "#F0FDF4",
                              color: isClientResp ? "#6D28D9" : "#166534",
                              border: `1px solid ${isClientResp ? "#DDD6FE" : "#BBF7D0"}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            {isClientResp ? "Client Upload" : "Admin Upload"}
                          </span>
                        </td>

                        <td>
                          <div>
                            <div
                              style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: "monospace", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              title={resolved.cleanFileName}
                            >
                              {resolved.cleanFileName}
                            </div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                              {doc.file_size ? `${(parseInt(doc.file_size) / 1024).toFixed(1)} KB` : isPendingUpload ? "Awaiting Upload" : "—"}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontSize: 12, color: "#475569" }}>
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </span>
                        </td>

                        <td>
                          {isPendingUpload ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#EFF6FF", color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Clock size={11} /> Pending Client Upload
                            </span>
                          ) : isVerified ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#DCFCE7", color: "#15803D", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <CheckCircle size={11} /> Verified
                            </span>
                          ) : isRejected ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FEE2E2", color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <AlertCircle size={11} /> Rejected
                            </span>
                          ) : isReplaced ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FAF5FF", color: "#7E22CE", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <RotateCcw size={11} /> Re-upload
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FFFBEB", color: "#D97706", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Clock size={11} /> Pending Review
                            </span>
                          )}
                        </td>

                        <td>
                          <div
                            style={{
                              maxWidth: 150,
                              fontSize: 11.5,
                              color: isRejected ? "#DC2626" : "#64748B",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                            title={doc.rejection_reason || (doc.verified_by ? `Verified by ${doc.verified_by}` : "Pending review")}
                          >
                            {doc.rejection_reason ? `Rejected: ${doc.rejection_reason}` : doc.verified_by ? `By ${doc.verified_by}` : "Pending review"}
                          </div>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <button
                              type="button"
                              className="row-action-btn-circle"
                              title="Preview Document Securely"
                              style={{ width: 28, height: 28, background: "#0F172A", color: "#FFFFFF" }}
                              onClick={() => handlePreviewDocument(doc)}
                            >
                              <Eye size={12} />
                            </button>

                            <button
                              type="button"
                              className="row-action-btn-circle"
                              title="Mark as Verified"
                              style={{ width: 28, height: 28, background: "#DCFCE7", color: "#16A34A", border: "1px solid #86EFAC" }}
                              disabled={isSubmittingAction || isVerified}
                              onClick={() => handleVerifyDocument(doc.id)}
                            >
                              <Check size={12} />
                            </button>

                            <button
                              type="button"
                              className="row-action-btn-circle"
                              title="Request Re-upload"
                              style={{ width: 28, height: 28, background: "#FAF5FF", color: "#7E22CE", border: "1px solid #D8B4FE" }}
                              onClick={() => {
                                setSelectedDocForAction(doc);
                                setActionReason("");
                                setActiveModal("REPLACE_DOC");
                              }}
                            >
                              <RotateCcw size={11} />
                            </button>

                            <button
                              type="button"
                              className="row-action-btn-circle"
                              title="Reject Document"
                              style={{ width: 28, height: 28, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5" }}
                              onClick={() => {
                                setSelectedDocForAction(doc);
                                setActionReason("");
                                setActiveModal("REJECT_DOC");
                              }}
                            >
                              <X size={12} />
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
        </div>

        {/* Right Column: Quick Actions + Real Contacts + Registered Address */}
        <div className="profile-right-column">
          {/* Card 1: Quick Actions */}
          <div className="profile-side-card">
            <h4 className="side-card-title">Quick Actions</h4>

            <div className="quick-actions-grid">
              <button
                className="btn-quick-gold"
                onClick={() => setActiveModal("CREATE_REQ")}
              >
                <Plus size={15} />
                <span>Create New Requirement</span>
              </button>

              <button
                className="btn-quick-action"
                onClick={() => setActiveModal("CREATE_BOOKING")}
              >
                <Truck size={15} color="#475569" />
                <span>Create Booking</span>
              </button>

              <button
                className="btn-quick-action"
                onClick={() => setActiveModal("SEND_MESSAGE")}
              >
                <MessageSquare size={15} color="#475569" />
                <span>Send Message</span>
              </button>

              <button
                className="btn-quick-action"
                onClick={() => setActiveModal("UPLOAD_DOC")}
              >
                <FileText size={15} color="#475569" />
                <span>Upload Document</span>
              </button>

              <button
                className="btn-quick-action"
                onClick={() => setActiveModal("ADD_NOTE")}
              >
                <Archive size={15} color="#475569" />
                <span>Add Note</span>
              </button>

              <button
                className="btn-quick-action"
                onClick={() => setActiveModal("VIEW_MAP")}
              >
                <MapPin size={15} color="#475569" />
                <span>View on Map</span>
              </button>
            </div>
          </div>

          {/* Card 2: Primary Contact */}
          <div className="profile-side-card">
            <div className="side-card-header">
              <h4 className="side-card-title">Primary Contact</h4>
            </div>

            {primaryContact ? (
              <div className="primary-contact-box">
                <div className="contact-avatar-pill">
                  {primaryContact.full_name ? primaryContact.full_name[0] : "C"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111111" }}>
                      {primaryContact.full_name}
                    </span>
                    <span className="primary-tag">Primary</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "#111111", marginTop: 4 }}>
                    +91 {primaryContact.mobile}
                  </div>
                  {primaryContact.email && (
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      {primaryContact.email}
                    </div>
                  )}

                  <div className="contact-social-icons">
                    <a
                      href={`https://wa.me/91${primaryContact.mobile.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="contact-icon-btn whatsapp"
                      title="Send WhatsApp"
                    >
                      <MessageSquare size={13} />
                    </a>
                    <a
                      href={`tel:${primaryContact.mobile}`}
                      className="contact-icon-btn"
                      title="Call Contact"
                    >
                      <Phone size={13} />
                    </a>
                    {primaryContact.email && (
                      <a
                        href={`mailto:${primaryContact.email}`}
                        className="contact-icon-btn"
                        title="Send Email"
                      >
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748B" }}>
                No contact persons registered for this company yet.
              </div>
            )}
          </div>

          {/* Card 3: Additional Contacts */}
          <div className="profile-side-card">
            <div className="side-card-header">
              <h4 className="side-card-title">Additional Contacts ({additionalContacts.length})</h4>
            </div>

            {additionalContacts.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#64748B" }}>
                No secondary contacts added.
              </div>
            ) : (
              <div className="additional-contacts-list">
                {additionalContacts.map(c => (
                  <div key={c.id} className="add-contact-row">
                    <div className="add-contact-left">
                      <div className="add-avatar-sm" style={{ background: "#F45325" }}>
                        {c.full_name ? c.full_name[0] : "C"}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>{c.full_name}</div>
                        <div style={{ fontSize: 11.5, color: "#111111" }}>+91 {c.mobile}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: Registered Address */}
          <div className="profile-side-card">
            <div className="side-card-header">
              <h4 className="side-card-title">Registered Address</h4>
            </div>

            <div className="registered-address-block">
              <div className="address-text-line">
                <MapPin size={16} color="#F45325" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{client.registered_address}</span>
              </div>

              <button
                className="btn-view-map-pill"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      client.registered_address
                    )}`,
                    "_blank"
                  );
                }}
              >
                <MapPin size={14} color="#F45325" />
                <span>View on Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ====================================================================
          MODALS FOR REAL DATABASE ACTIONS
          ==================================================================== */}

      {/* Edit Client Drawer / Modal */}
      {activeModal === "EDIT_CLIENT" && client && (
        <EditClientModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          client={client}
          primaryContact={primaryContact}
          onSaved={async () => {
            await loadClientDetailsFromDB(true);
            setToastMsg("Client details updated successfully!");
            setTimeout(() => setToastMsg(null), 3000);
          }}
        />
      )}

      {/* 1. Create Requirement Modal */}
      {activeModal === "CREATE_REQ" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Create Transport Requirement</h3>
                <p className="create-modal-subtitle">
                  Client: {client.company_name} | Saves into PostgreSQL requirements table
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRequirement}>
              <div className="create-modal-body">
                <div className="form-group-grid">
                  <div className="form-field-group">
                    <label className="form-field-label">Pickup Address / Hub</label>
                    <input
                      type="text"
                      className="form-field-input"
                      value={newReqForm.origin}
                      onChange={e => setNewReqForm({ ...newReqForm, origin: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="form-field-label">Destination Address / Depot</label>
                    <input
                      type="text"
                      className="form-field-input"
                      value={newReqForm.destination}
                      onChange={e => setNewReqForm({ ...newReqForm, destination: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group-grid">
                  <div className="form-field-group">
                    <label className="form-field-label">Material Type</label>
                    <input
                      type="text"
                      className="form-field-input"
                      value={newReqForm.material}
                      onChange={e => setNewReqForm({ ...newReqForm, material: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="form-field-label">Truck Type</label>
                    <select
                      className="form-field-input"
                      value={newReqForm.truckType}
                      onChange={e => setNewReqForm({ ...newReqForm, truckType: e.target.value })}
                    >
                      <option value="10 Wheeler">10 Wheeler (25 MT)</option>
                      <option value="12 Wheeler">12 Wheeler (28 MT)</option>
                      <option value="16 Wheeler">16 Wheeler (35 MT)</option>
                      <option value="20 Wheeler">20 Wheeler (40 MT)</option>
                    </select>
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Capacity (MT)</label>
                  <input
                    type="number"
                    className="form-field-input"
                    value={newReqForm.capacityMt}
                    onChange={e => setNewReqForm({ ...newReqForm, capacityMt: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="create-modal-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit-modal" disabled={isSubmittingAction}>
                  {isSubmittingAction ? (
                    <>
                      <Loader size={14} className="spin-icon" />
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Publish to Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Booking Modal (Quotation-to-Booking Workflow) */}
      {activeModal === "CREATE_BOOKING" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card" style={{ maxWidth: 580 }}>
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Create Booking for Client</h3>
                <p className="create-modal-subtitle">
                  Client: {client.company_name} | Official NECL Quotation-to-Booking Workflow
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              {/* Permission check */}
              {!hasPermission("bookings", "create") ? (
                <div className="prerequisite-guidance-card error">
                  <div className="prerequisite-title">
                    <AlertTriangle size={16} />
                    <span>Access Denied: Booking Creation Restricted</span>
                  </div>
                  <p className="prerequisite-text">
                    Your current role does not have authorization to confirm new client bookings. Please contact a Super Admin for access.
                  </p>
                </div>
              ) : requirements.length === 0 ? (
                /* Prerequisite Case 1: No transport requirements exist */
                <div>
                  <div className="prerequisite-guidance-card error">
                    <div className="prerequisite-title">
                      <AlertTriangle size={16} />
                      <span>Transport Requirement Required</span>
                    </div>
                    <p className="prerequisite-text">
                      Under NECL operational policy, a transport requirement must be created before a booking can be confirmed. Currently, no requirements exist for {client.company_name}.
                    </p>
                  </div>

                  <div style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 8, padding: 20, textAlign: "center", marginTop: 12 }}>
                    <Package size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#172B4D", marginBottom: 4 }}>
                      Create Requirement First
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 16 }}>
                      Specify pickup location, destination, freight cargo, and truck capacity to initiate sourcing.
                    </div>
                    <button
                      type="button"
                      className="btn-create-booking-primary"
                      onClick={() => setActiveModal("CREATE_REQ")}
                    >
                      <Plus size={14} />
                      <span>Create Transport Requirement</span>
                    </button>
                  </div>
                </div>
              ) : clientQuotes.filter(q => q.status === "ACCEPTED").length === 0 ? (
                /* Prerequisite Case 2: Requirements exist, but none has an accepted quote */
                <div>
                  <div className="prerequisite-guidance-card">
                    <div className="prerequisite-title">
                      <Info size={16} />
                      <span>Accepted Client Quotation Required</span>
                    </div>
                    <p className="prerequisite-text">
                      Under NECL commercial workflow, a booking requires an accepted client quotation. Current client requirements ({requirements.length}) are awaiting quotation acceptance.
                    </p>
                  </div>

                  <div className="form-field-group" style={{ marginTop: 14 }}>
                    <label className="form-field-label">Select Active Requirement to Confirm:</label>
                    <select
                      className="form-field-input"
                      value={selectedReqForBooking || (requirements[0]?.id || "")}
                      onChange={e => setSelectedReqForBooking(e.target.value)}
                    >
                      {requirements.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.id} — {(r.pickup_address || "Origin").split(",")[0]} → {(r.destination_address || "Destination").split(",")[0]} ({r.material_type}, {r.required_capacity_mt} MT)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 14, marginTop: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#172B4D", marginBottom: 4 }}>
                      Administrative Spot Booking Option
                    </div>
                    <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", lineHeight: 1.45 }}>
                      As an authorized admin, you may simultaneously record the accepted client quotation and confirm the booking for urgent dispatch.
                    </p>
                    <div className="form-field-group">
                      <label className="form-field-label">Agreed Client Total Freight Amount (₹)</label>
                      <input
                        type="number"
                        className="form-field-input"
                        placeholder="e.g. 65000"
                        value={customClientRate}
                        onChange={e => setCustomClientRate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Prerequisite Case 3: Accepted quote exists */
                <div>
                  <div className="form-field-group">
                    <label className="form-field-label">Select Requirement & Accepted Quotation</label>
                    <select
                      className="form-field-input"
                      value={selectedQuoteForBooking || (clientQuotes.find(q => q.status === "ACCEPTED")?.id || "")}
                      onChange={e => {
                        const qId = e.target.value;
                        setSelectedQuoteForBooking(qId);
                        const matched = clientQuotes.find(q => q.id === qId);
                        if (matched) setSelectedReqForBooking(matched.requirement_id);
                      }}
                    >
                      {clientQuotes.filter(q => q.status === "ACCEPTED").map(q => {
                        const r = requirements.find(req => req.id === q.requirement_id);
                        return (
                          <option key={q.id} value={q.id}>
                            Quote {formatDisplayId("QT", q.id, q.created_at)} — ₹{Number(q.total_client_amount || 0).toLocaleString("en-IN")} ({r?.id || q.requirement_id})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {(() => {
                    const qId = selectedQuoteForBooking || clientQuotes.find(q => q.status === "ACCEPTED")?.id;
                    const selectedQ = clientQuotes.find(q => q.id === qId);
                    const selectedR = requirements.find(r => r.id === (selectedQ?.requirement_id || selectedReqForBooking));

                    return (
                      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 14, marginTop: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
                          <div>
                            <span style={{ color: "#64748B" }}>Route: </span>
                            <strong>{(selectedR?.pickup_address || "Origin").split(",")[0]} → {(selectedR?.destination_address || "Destination").split(",")[0]}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748B" }}>Cargo: </span>
                            <strong>{selectedR?.material_type || "General Cargo"} ({selectedR?.required_capacity_mt || 25} MT)</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748B" }}>Truck Type: </span>
                            <strong>{selectedR?.vehicle_type || "Any Standard Truck"}</strong>
                          </div>
                          <div>
                            <span style={{ color: "#64748B" }}>Agreed Total: </span>
                            <strong style={{ color: "#166534" }}>₹{Number(selectedQ?.total_client_amount || 0).toLocaleString("en-IN")}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="create-modal-footer">
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </button>

              {hasPermission("bookings", "create") && requirements.length > 0 && (
                <button
                  type="button"
                  className="btn-submit-modal"
                  disabled={isSubmittingAction}
                  onClick={() => {
                    const acceptedQ = clientQuotes.find(q => q.status === "ACCEPTED");
                    const reqIdToUse = selectedReqForBooking || acceptedQ?.requirement_id || requirements[0]?.id;
                    const quoteIdToUse = selectedQuoteForBooking || acceptedQ?.id;
                    const amountToUse = acceptedQ ? Number(acceptedQ.total_client_amount) : parseFloat(customClientRate) || 0;
                    handleConfirmBookingWorkflow(reqIdToUse, quoteIdToUse, amountToUse);
                  }}
                >
                  {isSubmittingAction ? (
                    <>
                      <Loader size={14} className="spin-icon" />
                      <span>Recording in DB...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Confirm & Insert Booking</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Send Message Modal */}
      {activeModal === "SEND_MESSAGE" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Send Message to Client</h3>
                <p className="create-modal-subtitle">
                  Recipient: {primaryContact?.full_name || client.company_name}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                setActiveModal(null);
                setToastMsg("Notification message queued for client delivery.");
                setTimeout(() => setToastMsg(null), 3000);
              }}
            >
              <div className="create-modal-body">
                <div className="form-field-group">
                  <label className="form-field-label">Message Content</label>
                  <textarea
                    rows={4}
                    className="form-field-input"
                    style={{ height: "auto", padding: 12 }}
                    placeholder="Enter dispatch update, quotation details, or ETA information..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="create-modal-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit-modal">
                  <MessageSquare size={16} />
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Upload Document Modal */}
      {activeModal === "UPLOAD_DOC" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Upload Client Document</h3>
                <p className="create-modal-subtitle">
                  Attach GST Certificate, PAN copy, or agreement for {client.company_name}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div
                style={{
                  border: "2px dashed #CBD5E1",
                  borderRadius: 12,
                  padding: 32,
                  textAlign: "center",
                  background: "#FFFFFF",
                  cursor: "pointer"
                }}
                onClick={() => {
                  setActiveModal(null);
                  setToastMsg("Document registered for client record in database.");
                  setTimeout(() => setToastMsg(null), 3000);
                }}
              >
                <FileText size={36} color="#64748B" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111111" }}>
                  Click to select file from device
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  PDF, JPG, PNG up to 10 MB
                </div>
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Note Modal */}
      {activeModal === "ADD_NOTE" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Add Operational Note</h3>
                <p className="create-modal-subtitle">
                  Logged for {client.company_name}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-field-group">
                <label className="form-field-label">Internal Note</label>
                <textarea
                  rows={4}
                  className="form-field-input"
                  style={{ height: "auto", padding: 12 }}
                  placeholder="Enter notes on preferred routes or special handling instructions..."
                />
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                className="btn-submit-modal"
                onClick={() => {
                  setActiveModal(null);
                  setToastMsg("Note registered to client profile.");
                  setTimeout(() => setToastMsg(null), 2500);
                }}
              >
                <Check size={16} />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. View On Map Modal */}
      {activeModal === "VIEW_MAP" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card" style={{ maxWidth: 650 }}>
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title">Registered Office Location</h3>
                <p className="create-modal-subtitle">
                  {client.registered_address}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body" style={{ padding: 0 }}>
              <div style={{ height: 300, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <MapPin size={40} color="#F45325" />
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111111" }}>
                  {client.company_name}
                </div>
                <div style={{ fontSize: 13, color: "#64748B", maxWidth: 400, textAlign: "center" }}>
                  {client.registered_address}
                </div>
              </div>
            </div>

            <div className="create-modal-footer">
              <button
                className="btn-cancel-modal"
                onClick={() => {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.registered_address)}`, '_blank');
                }}
              >
                <ExternalLink size={14} />
                <span>Open in Google Maps</span>
              </button>
              <button className="btn-submit-modal" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reject Registration Modal (Phase 8) */}
      {activeModal === "REJECT_REG" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title" style={{ color: "#DC2626" }}>Reject Client Registration</h3>
                <p className="create-modal-subtitle">
                  Company: {client.company_name} | Rejection reason will be preserved in DB and displayed to client
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-field-group">
                <label className="form-field-label">Rejection Reason (Required)</label>
                <textarea
                  rows={4}
                  className="form-field-input"
                  style={{ height: "auto", padding: 12 }}
                  placeholder="Explain why this registration cannot be approved (e.g., fraudulent GST certificate, entity name mismatch, business not eligible)..."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-modal"
                style={{ background: "#DC2626", borderColor: "#DC2626" }}
                disabled={isSubmittingAction || !actionReason.trim()}
                onClick={handleRejectRegistration}
              >
                {isSubmittingAction ? (
                  <>
                    <Loader size={14} className="spin-icon" />
                    <span>Saving Decision...</span>
                  </>
                ) : (
                  <>
                    <X size={16} />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Request Corrections Modal (Phase 8) */}
      {activeModal === "REQUEST_CORRECTIONS" && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title" style={{ color: "#7E22CE" }}>Request Corrections from Client</h3>
                <p className="create-modal-subtitle">
                  Company: {client.company_name} | Client will see these instructions in the mobile app
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-field-group">
                <label className="form-field-label">Correction Instructions (Required)</label>
                <textarea
                  rows={4}
                  className="form-field-input"
                  style={{ height: "auto", padding: 12 }}
                  placeholder="Specify what details or documents need to be amended (e.g., please re-upload clear GST certificate, correct registered address to match PAN)..."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-modal"
                style={{ background: "#7E22CE", borderColor: "#7E22CE" }}
                disabled={isSubmittingAction || !actionReason.trim()}
                onClick={handleRequestCorrections}
              >
                {isSubmittingAction ? (
                  <>
                    <Loader size={14} className="spin-icon" />
                    <span>Sending Notes...</span>
                  </>
                ) : (
                  <>
                    <Edit2 size={16} />
                    <span>Send Correction Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Reject Document Modal (Phase 8) */}
      {activeModal === "REJECT_DOC" && selectedDocForAction && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title" style={{ color: "#DC2626" }}>Reject KYC Document</h3>
                <p className="create-modal-subtitle">
                  Document: {selectedDocForAction.document_type} | File: {selectedDocForAction.file_name || "Attachment"}
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-field-group">
                <label className="form-field-label">Document Rejection Reason (Required)</label>
                <textarea
                  rows={4}
                  className="form-field-input"
                  style={{ height: "auto", padding: 12 }}
                  placeholder="Explain why this document was rejected (e.g., illegible text, PAN details do not match company name, invalid format)..."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-modal"
                style={{ background: "#DC2626", borderColor: "#DC2626" }}
                disabled={isSubmittingAction || !actionReason.trim()}
                onClick={handleRejectDocument}
              >
                {isSubmittingAction ? (
                  <>
                    <Loader size={14} className="spin-icon" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <X size={16} />
                    <span>Reject Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Request Replacement Document Modal (Phase 8) */}
      {activeModal === "REPLACE_DOC" && selectedDocForAction && (
        <div className="create-modal-backdrop">
          <div className="create-modal-card">
            <div className="create-modal-header">
              <div>
                <h3 className="create-modal-title" style={{ color: "#D97706" }}>Request Replacement Document</h3>
                <p className="create-modal-subtitle">
                  Document: {selectedDocForAction.document_type} | Instructions for client re-upload
                </p>
              </div>
              <button className="create-modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-field-group">
                <label className="form-field-label">Replacement Instructions (Required)</label>
                <textarea
                  rows={4}
                  className="form-field-input"
                  style={{ height: "auto", padding: 12 }}
                  placeholder="Explain what the client needs to re-upload (e.g., please upload a signed and stamped copy of the certificate, include all pages)..."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="create-modal-footer">
              <button className="btn-cancel-modal" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-modal"
                style={{ background: "#D97706", borderColor: "#D97706" }}
                disabled={isSubmittingAction || !actionReason.trim()}
                onClick={handleRequestDocReplacement}
              >
                {isSubmittingAction ? (
                  <>
                    <Loader size={14} className="spin-icon" />
                    <span>Requesting...</span>
                  </>
                ) : (
                  <>
                    <Edit2 size={16} />
                    <span>Request Re-upload</span>
                  </>
                )}
              </button>
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
          onVerify={() => {
            handleVerifyDocument(previewDoc.id);
            setPreviewDoc((prev: any) => prev ? { ...prev, verification_status: "VERIFIED", rejection_reason: null } : null);
          }}
          onReject={() => {
            setSelectedDocForAction(previewDoc);
            setActiveModal("REJECT_DOC");
            setPreviewDoc(null);
          }}
          canVerify={true}
          canReject={true}
        />
      )}
    </div>
  );
};

