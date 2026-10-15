import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Plus, Eye, Filter, X, ChevronLeft, ChevronRight, ChevronDown,
  Package, TruckIcon, Truck, Calendar, MapPin, Building2, RefreshCw,
  FileText, AlertCircle, CheckCircle, Clock, Send, XCircle,
  ArrowUpDown, Loader2, Download, RotateCcw, FileCheck
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { formatDisplayId } from "../../utils/idGenerator";

export interface Requirement {
  id: string;
  requirement_reference: string;
  client_id: string;
  origin: string;
  destination: string;
  vehicle_type: string;
  required_date: string;
  cargo_description: string;
  status: "DRAFT" | "UNDER_REVIEW" | "ASSIGNED" | "RFQ_SENT" | "QUOTED" | "BOOKED" | "CANCELLED" | "NEW_REQUIREMENT" | string;
  created_at: string;
  updated_at?: string;
  pickup_pincode?: string;
  destination_pincode?: string;
  required_capacity_mt?: number;
  material_type?: string;
  special_instructions?: string;
  client_company?: {
    company_name: string;
  };
}

interface RequirementsModuleProps {
  onNavigateToCreate?: () => void;
  onNavigateToDetail?: (requirementId: string) => void;
}

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NEW_REQUIREMENT: { bg: "#FEF3C7", text: "#B45309", border: "#FDE047" },
  DRAFT: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  UNDER_REVIEW: { bg: "#FEF3C7", text: "#B45309", border: "#FDE047" },
  ASSIGNED: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
  RFQ_SENT: { bg: "#EDE9FE", text: "#6D28D9", border: "#C4B5FD" },
  QUOTED: { bg: "#E0E7FF", text: "#4338CA", border: "#A5B4FC" },
  BOOKED: { bg: "#D1FAE5", text: "#047857", border: "#6EE7B7" },
  CANCELLED: { bg: "#FEE2E2", text: "#B91C1C", border: "#FCA5A5" }
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] || { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
}

function formatRequirementReference(id: string, createdAt: string): string {
  if (!id) return formatDisplayId("REQ", null, createdAt);
  if (id.startsWith("NECL-REQ-")) return id;
  return formatDisplayId("REQ", id, createdAt);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export const RequirementsModule: React.FC<RequirementsModuleProps> = ({
  onNavigateToCreate,
  onNavigateToDetail
}) => {
  // State management
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Requirement["status"] | "ALL">("ALL");
  const [page, setPage] = useState(1);

  // Status counts for tabs
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

  // Fetch status counts
  const fetchStatusCounts = useCallback(async () => {
    try {
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
        ALL: totalCount || 0
      };

      counts.forEach(({ status, count }) => {
        countsMap[status] = count;
      });

      setStatusCounts(countsMap);
    } catch (err: any) {
      console.error("Error fetching status counts:", err.message);
    }
  }, []);

  // Fetch requirements with filters
  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("requirements")
        .select(`
          *,
          client_company:client_companies!requirements_client_id_fkey(company_name)
        `)
        .order("created_at", { ascending: false });

      // Apply status filter
      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      // Apply search filter (case-insensitive) using real database columns
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(
          `pickup_address.ilike.%${q}%,destination_address.ilike.%${q}%,material_type.ilike.%${q}%,id.ilike.%${q}%`
        );
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transform the data to map database columns
      const transformedData: Requirement[] = (data || []).map((req: any) => ({
        ...req,
        requirement_reference: formatRequirementReference(req.id, req.created_at),
        origin: req.pickup_address || req.origin || "Origin",
        destination: req.destination_address || req.destination || "Destination",
        required_date: req.loading_datetime || req.required_date || req.created_at,
        cargo_description: req.material_type || req.cargo_description || "General Cargo",
        vehicle_type: req.vehicle_type || req.vehicle_type_required || "Standard",
        client_company: Array.isArray(req.client_company) 
          ? req.client_company[0] 
          : req.client_company
      }));

      setRequirements(transformedData);
    } catch (err: any) {
      console.error("Error fetching requirements:", err.message);
      setError("Failed to load requirements. Please try again.");
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Initial load and real-time subscription
  useEffect(() => {
    fetchStatusCounts();
    fetchRequirements();

    const channel = supabase
      .channel('requirements_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requirements' },
        (payload) => {
          console.log('[Requirements Realtime] requirements change detected:', payload.eventType);
          fetchStatusCounts();
          fetchRequirements();
        }
      )
      .subscribe((status) => {
        console.log('[Requirements Realtime] Channel status:', status);
      });

    const pollInterval = setInterval(() => {
      fetchStatusCounts();
      fetchRequirements();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchStatusCounts, fetchRequirements]);

  // Pagination
  const totalCount = requirements.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const paginatedRequirements = useMemo(() => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    return requirements.slice(from, from + ITEMS_PER_PAGE);
  }, [requirements, page]);

  // Handle refresh
  const handleRefresh = () => {
    fetchStatusCounts();
    fetchRequirements();
    setToastMessage("Requirements refreshed from database.");
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle status filter change
  const handleStatusFilterChange = (status: Requirement["status"] | "ALL") => {
    setStatusFilter(status);
    setPage(1);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPage(1);
  };

  // Handle status update
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedReq) return;
    setActionLoading(true);
    try {
      const { error: updErr } = await supabase
        .from('requirements')
        .update({ status: newStatus })
        .eq('id', selectedReq.id);
      if (updErr) throw updErr;
      setToastMessage(`Requirement status updated to ${newStatus}`);
      setSelectedReq(prev => prev ? { ...prev, status: newStatus } : null);
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      setError(err.message || "Failed to update requirement status");
    } finally {
      setActionLoading(false);
    }
  };

  // Direct Book requirement
  const handleDirectBook = async (req: Requirement) => {
    setActionLoading(true);
    try {
      const newBokId = `BOK-${Date.now().toString().slice(-8)}`;
      const { error: bokErr } = await supabase.from('bookings').insert([{
        id: newBokId,
        requirement_id: req.id,
        client_id: req.client_id,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }]);
      if (bokErr) throw bokErr;

      await supabase.from('requirements').update({ status: 'BOOKED' }).eq('id', req.id);
      setToastMessage(`Booking #${newBokId} created successfully!`);
      setSelectedReq(prev => prev ? { ...prev, status: 'BOOKED' } : null);
      fetchRequirements();
      fetchStatusCounts();
    } catch (err: any) {
      setError(err.message || "Failed to create booking");
    } finally {
      setActionLoading(false);
    }
  };

  // Render status badge safely
  const renderStatusBadge = (status: Requirement["status"]) => {
    const colors = getStatusStyle(status);
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 700,
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          textTransform: "uppercase",
          letterSpacing: "0.03em"
        }}
      >
        {status === "UNDER_REVIEW" && <Clock size={12} />}
        {status === "RFQ_SENT" && <Send size={12} />}
        {status === "QUOTED" && <FileText size={12} />}
        {status === "BOOKED" && <CheckCircle size={12} />}
        {status === "CANCELLED" && <XCircle size={12} />}
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="requirements-module-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: "#F45325",
            color: "#FFF",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600
          }}
        >
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: "var(--brand-soft)",
            border: "1px solid #FCA5A5",
            color: "#F45325",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#F45325",
              padding: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ marginBottom: "16px", fontSize: "13px", color: "#64748B" }}>
        <span style={{ cursor: "pointer" }}>Transport Requirements</span>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#111111", fontWeight: 600 }}>All Requirements</span>
      </div>

      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#111111", marginBottom: "8px" }}>
            Transport Requirements
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B" }}>
            View, create, and manage all client transport requirements through the fulfilment workflow.
          </p>
        </div>
        {onNavigateToCreate && (
          <button
            onClick={onNavigateToCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, #F45325 0%, #F45325 100%)",
              color: "#FFF",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255, 107, 53, 0.3)",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <Plus size={16} />
            <span>New Requirement</span>
          </button>
        )}
      </div>

      {/* Status Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          padding: "8px",
          background: "#FFF",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleStatusFilterChange(tab.key as any)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === tab.key ? "#F45325" : "transparent",
              color: statusFilter === tab.key ? "#FFF" : "#64748B",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s"
            }}
          >
            {tab.label} ({statusCounts[tab.key] || 0})
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          padding: "16px",
          background: "#FFF",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
        }}
      >
        {/* Search Input */}
        <div style={{ flex: 1, position: "relative" }}>
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
            placeholder="Search by reference ID, client, origin, or destination..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 40px",
              border: "1px solid rgba(244,83,37,0.25)",
              borderRadius: "8px",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#F45325")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(244,83,37,0.25)")}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94A3B8",
                padding: 0
              }}
            >
              <X size={16} />
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
            padding: "10px 16px",
            background: "#FFFFFF",
            border: "1px solid rgba(244,83,37,0.25)",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#475569",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={handleResetFilters}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 16px",
            background: "#FFF",
            border: "1px solid rgba(244,83,37,0.25)",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#64748B",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <X size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Requirements Table */}
      <div
        className="client-table-card"
        style={{
          background: "#FFF",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          overflowX: "auto",
          overflowY: "visible"
        }}
      >
        <table
          className="client-table"
          style={{
            width: "100%",
            minWidth: "1250px",
            borderCollapse: "collapse",
            fontSize: "14px"
          }}
        >
          <thead>
            <tr style={{ background: "#FFFFFF", borderBottom: "1px solid rgba(244,83,37,0.25)" }}>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Ref ID</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Client</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Route
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Vehicle Type
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Required Date
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Cargo
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "14px 16px",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  width: "100px"
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #FFFFFF" }}>
                  <td colSpan={8} style={{ padding: "16px" }}>
                    <div
                      style={{
                        height: "40px",
                        background: "#FFFFFF",
                        borderRadius: "6px",
                        animation: "pulse 1.5s ease-in-out infinite"
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : paginatedRequirements.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "60px 20px" }}>
                  <Package size={48} color="#CBD5E1" style={{ marginBottom: "16px" }} />
                  <h3 style={{ color: "#111111", margin: "0 0 8px", fontSize: "18px", fontWeight: 700 }}>
                    No requirements found
                  </h3>
                  <p style={{ color: "#64748B", margin: 0, fontSize: "14px" }}>
                    {searchQuery
                      ? "No requirements matched your search criteria."
                      : "Create your first transport requirement to begin."}
                  </p>
                  {!searchQuery && onNavigateToCreate && (
                    <button
                      onClick={onNavigateToCreate}
                      style={{
                        marginTop: "20px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "#F45325",
                        color: "#FFF",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      <Plus size={14} />
                      <span>Create Requirement</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedRequirements.map((req) => (
                <tr
                  key={req.id}
                  style={{
                    borderBottom: "1px solid #FFFFFF",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => {
                    setSelectedReq(req);
                    setIsDrawerOpen(true);
                    onNavigateToDetail?.(req.id);
                  }}
                >
                  {/* Ref ID */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: getStatusStyle(req.status).border
                        }}
                      />
                      <span style={{ fontWeight: 700, color: "#111111", fontFamily: "monospace" }}>
                        {formatRequirementReference(req.id, req.created_at)}
                      </span>
                    </div>
                  </td>

                  {/* Client */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: "#F45325",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFF",
                          fontWeight: 700,
                          fontSize: "12px"
                        }}
                      >
                        {req.client_company?.company_name?.substring(0, 2).toUpperCase() || "CL"}
                      </div>
                      <span style={{ fontWeight: 600, color: "#111111" }}>
                        {req.client_company?.company_name || "—"}
                      </span>
                    </div>
                  </td>

                  {/* Route */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                        <MapPin size={12} color="#F45325" />
                        <span style={{ color: "#111111", fontWeight: 600 }}>{req.origin}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                        <MapPin size={12} color="#F45325" />
                        <span style={{ color: "#64748B" }}>{req.destination}</span>
                      </div>
                    </div>
                  </td>

                  {/* Vehicle Type */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <TruckIcon size={14} color="#64748B" />
                      <span style={{ color: "#111111", fontWeight: 600 }}>{req.vehicle_type}</span>
                    </div>
                  </td>

                  {/* Required Date */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="#64748B" />
                      <span style={{ color: "#111111" }}>{formatDate(req.required_date)}</span>
                    </div>
                  </td>

                  {/* Cargo */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ color: "#64748B", fontSize: "13px" }}>
                      {truncateText(req.cargo_description, 30)}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: "14px 16px" }}>
                    {renderStatusBadge(req.status)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReq(req);
                        setIsDrawerOpen(true);
                        onNavigateToDetail?.(req.id);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        background: "#FFFFFF",
                        border: "1px solid rgba(244,83,37,0.25)",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#475569",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(244,83,37,0.25)";
                        e.currentTarget.style.borderColor = "#CBD5E1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#FFFFFF";
                        e.currentTarget.style.borderColor = "rgba(244,83,37,0.25)";
                      }}
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && paginatedRequirements.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderTop: "1px solid #FFFFFF",
              background: "#FAFAFA"
            }}
          >
            <div style={{ fontSize: "14px", color: "#64748B" }}>
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} requirements
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 12px",
                  background: page === 1 ? "#FFFFFF" : "#FFF",
                  border: "1px solid rgba(244,83,37,0.25)",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: page === 1 ? "#CBD5E1" : "#475569",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  transition: "all 0.2s"
                }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first page, last page, current page, and pages around current
                    return (
                      p === 1 ||
                      p === totalPages ||
                      (p >= page - 1 && p <= page + 1)
                    );
                  })
                  .map((p, idx, arr) => {
                    // Add ellipsis
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span
                            style={{
                              padding: "8px 12px",
                              color: "#111111",
                              fontSize: "14px"
                            }}
                          >
                            ...
                          </span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          style={{
                            padding: "8px 12px",
                            background: page === p ? "#F45325" : "#FFF",
                            border: `1px solid ${page === p ? "#F45325" : "rgba(244,83,37,0.25)"}`,
                            borderRadius: "6px",
                            fontSize: "14px",
                            fontWeight: 600,
                            color: page === p ? "#FFF" : "#475569",
                            cursor: "pointer",
                            minWidth: "40px",
                            transition: "all 0.2s"
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
                  padding: "8px 12px",
                  background: page === totalPages ? "#FFFFFF" : "#FFF",
                  border: "1px solid rgba(244,83,37,0.25)",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: page === totalPages ? "#CBD5E1" : "#475569",
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  transition: "all 0.2s"
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Requirement Details Drawer / Modal */}
      {isDrawerOpen && selectedReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 9999,
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              height: "100%",
              background: "#FFFFFF",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.25s ease-out",
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
                background: "#F8FAFC",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    {formatRequirementReference(selectedReq.id, selectedReq.created_at)}
                  </h2>
                  {renderStatusBadge(selectedReq.status)}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Created on {formatDate(selectedReq.created_at)} • Requirement ID: {selectedReq.id}
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  padding: "4px",
                  borderRadius: "6px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Client Info Card */}
              <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "8px" }}>
                  Consignor / Client
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "8px", background: "#F45325", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                      {selectedReq.client_company?.company_name || "Client Account"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>Client ID: {selectedReq.client_id}</div>
                  </div>
                </div>
              </div>

              {/* Route Card */}
              <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "12px" }}>
                  Route Details
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <MapPin size={18} color="#F45325" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>PICKUP ADDRESS</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{selectedReq.origin}</div>
                      {selectedReq.pickup_pincode && (
                        <div style={{ fontSize: "12px", color: "#94A3B8" }}>Pincode: {selectedReq.pickup_pincode}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ borderLeft: "2px dashed #CBD5E1", marginLeft: "8px", height: "16px" }} />
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <MapPin size={18} color="#1D4ED8" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>DELIVERY DESTINATION</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{selectedReq.destination}</div>
                      {selectedReq.destination_pincode && (
                        <div style={{ fontSize: "12px", color: "#94A3B8" }}>Pincode: {selectedReq.destination_pincode}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo & Vehicle Specs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Vehicle Type</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Truck size={15} color="#F45325" />
                    <span>{selectedReq.vehicle_type}</span>
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Capacity / Weight</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Package size={15} color="#1D4ED8" />
                    <span>{selectedReq.required_capacity_mt ? `${selectedReq.required_capacity_mt} MT` : "Standard Weight"}</span>
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Material / Cargo</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                    {selectedReq.cargo_description}
                  </div>
                </div>
                <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Loading Date</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={14} color="#64748B" />
                    <span>{formatDate(selectedReq.required_date)}</span>
                  </div>
                </div>
              </div>

              {/* Status Workflow Actions */}
              <div style={{ padding: "18px", background: "#FFF5F0", borderRadius: "10px", border: "1px solid rgba(244,83,37,0.3)" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "8px" }}>
                  Administrative Workflow Actions
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {selectedReq.status !== "UNDER_REVIEW" && selectedReq.status !== "BOOKED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("UNDER_REVIEW")}
                      style={{ padding: "8px 14px", background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE047", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Move to Under Review
                    </button>
                  )}
                  {selectedReq.status !== "ASSIGNED" && selectedReq.status !== "BOOKED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("ASSIGNED")}
                      style={{ padding: "8px 14px", background: "#DBEAFE", color: "#1D4ED8", border: "1px solid #93C5FD", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Assign for Sourcing
                    </button>
                  )}
                  {selectedReq.status !== "RFQ_SENT" && selectedReq.status !== "BOOKED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("RFQ_SENT")}
                      style={{ padding: "8px 14px", background: "#EDE9FE", color: "#6D28D9", border: "1px solid #C4B5FD", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Mark RFQ Sent
                    </button>
                  )}
                  {selectedReq.status !== "BOOKED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleDirectBook(selectedReq)}
                      style={{ padding: "8px 14px", background: "#D1FAE5", color: "#047857", border: "1px solid #6EE7B7", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Direct Confirm & Book
                    </button>
                  )}
                  {selectedReq.status !== "CANCELLED" && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("CANCELLED")}
                      style={{ padding: "8px 14px", background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Cancel Requirement
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#F8FAFC",
              }}
            >
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{ padding: "10px 18px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#64748B", cursor: "pointer" }}
              >
                Close Drawer
              </button>
              {selectedReq.status !== "BOOKED" && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleDirectBook(selectedReq)}
                  style={{ padding: "10px 20px", background: "#F45325", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <CheckCircle size={15} />
                  <span>{actionLoading ? "Processing..." : "Confirm Booking"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
