import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Filter, RefreshCw, ChevronRight, FileCheck, AlertCircle,
  CheckCircle, Clock, X, Download, Eye, Upload, Calendar, Truck,
  User, Package, FileText, Shield, ArrowUpDown, ChevronDown
} from "lucide-react";
import { supabase } from "../../utils/supabase";

export interface Trip {
  id: string;
  trip_reference: string;
  booking_id: string;
  booking_reference: string;
  vehicle_id: string;
  vehicle_registration: string;
  driver_id: string;
  driver_name: string;
  status: string;
  planned_departure_date: string;
  created_at: string;
  updated_at: string;
  pre_trip_gate_completion: number; // 0-100 percentage
}

interface DocumentClearanceModuleProps {
  onNavigateToTrip?: (tripId: string) => void;
}

const ITEMS_PER_PAGE = 15;

type StatusFilterType = "ALL" | "PENDING_DOCS" | "PARTIALLY_CLEARED" | "CLEARED";

function getTripStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string }> = {
    PENDING_DOC_CLEARANCE: { label: "Pending Clearance", className: "status-pending" },
    PARTIALLY_CLEARED: { label: "Partially Cleared", className: "status-warning" },
    CLEARED_FOR_DISPATCH: { label: "Cleared", className: "status-success" },
  };
  return statusMap[status] || { label: status, className: "status-default" };
}

function getCompletionColor(percentage: number): string {
  if (percentage === 0) return "#F45325"; // red
  if (percentage < 50) return "#F45325"; // amber
  if (percentage < 100) return "#F45325"; // blue
  return "#F45325"; // green
}

function formatTripReference(id: string, createdAt: string): string {
  if (!id) return "TRP-00000001";
  if (id.startsWith("TRP-")) return id;
  const numPart = id.replace(/\D/g, "").substring(0, 8) || "00000001";
  return `TRP-${numPart.padStart(8, "0")}`;
}

function formatBookingReference(id: string): string {
  if (!id) return "BKG-00000001";
  if (id.startsWith("BKG-")) return id;
  const numPart = id.replace(/\D/g, "").substring(0, 8) || "00000001";
  return `BKG-${numPart.padStart(8, "0")}`;
}

export const DocumentClearanceModule: React.FC<DocumentClearanceModuleProps> = ({
  onNavigateToTrip,
}) => {
  // State
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");
  const [page, setPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedReviewTrip, setSelectedReviewTrip] = useState<Trip | null>(null);
  const [reviewRejectionReason, setReviewRejectionReason] = useState("");

  // KPI stats
  const [kpis, setKpis] = useState({
    total: 0,
    pendingDocs: 0,
    partiallyClear: 0,
    cleared: 0,
  });

  // Fetch KPI statistics
  const fetchKpiStats = useCallback(async () => {
    try {
      const { data: allTrips, error: err } = await supabase
        .from("trips")
        .select("id, trip_status");

      if (err) throw err;

      const total = allTrips?.length || 0;
      const cleared = allTrips?.filter(t => t.trip_status === "DELIVERED" || t.trip_status === "COMPLETED").length || 0;
      const inTransit = allTrips?.filter(t => t.trip_status === "IN_TRANSIT" || t.trip_status === "AT_LOADING" || t.trip_status === "AT_UNLOADING").length || 0;
      const pendingDocs = allTrips?.filter(t => t.trip_status === "LORRY_ASSIGNED").length || 0;

      setKpis({ total, pendingDocs, partiallyClear: inTransit, cleared });
    } catch (err: any) {
      console.error("Error fetching KPI stats:", err.message);
    }
  }, []);

  // Fetch trips from database
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch trips
      const { data: rawTrips, error: tErr } = await supabase
        .from("trips")
        .select("id, booking_id, vehicle_id, driver_id, trip_status, started_at, completed_at, created_at")
        .order("created_at", { ascending: false });

      if (tErr) throw tErr;

      if (!rawTrips || rawTrips.length === 0) {
        setTrips([]);
        return;
      }

      const bIds = [...new Set(rawTrips.map(t => t.booking_id))];
      const vIds = [...new Set(rawTrips.map(t => t.vehicle_id).filter(Boolean))];
      const dIds = [...new Set(rawTrips.map(t => t.driver_id).filter(Boolean))];

      const [bRes, vRes, dRes, docRes] = await Promise.all([
        supabase.from("bookings").select("id").in("id", bIds),
        vIds.length > 0 ? supabase.from("vehicles").select("id, vehicle_number").in("id", vIds) : Promise.resolve({ data: [] }),
        dIds.length > 0 ? supabase.from("drivers").select("id, full_name").in("id", dIds) : Promise.resolve({ data: [] }),
        supabase.from("documents").select("id, reference_id, verification_status")
      ]);

      const vMap = new Map((vRes.data || []).map(v => [v.id, v.vehicle_number]));
      const dMap = new Map((dRes.data || []).map(d => [d.id, d.full_name]));
      const docs = docRes.data || [];

      const enrichedTrips: Trip[] = rawTrips.map((t: any) => {
        // Calculate pre_trip_gate_completion based on approved docs or status
        const tripDocs = docs.filter(doc => doc.reference_id === t.id || doc.reference_id === t.vehicle_id || doc.reference_id === t.driver_id);
        const approvedDocs = tripDocs.filter(d => d.verification_status === "APPROVED");
        let completion = 0;
        if (t.trip_status === "COMPLETED" || t.trip_status === "DELIVERED") {
          completion = 100;
        } else if (t.trip_status === "IN_TRANSIT" || t.trip_status === "AT_LOADING" || t.trip_status === "AT_UNLOADING") {
          completion = 75;
        } else if (approvedDocs.length > 0) {
          completion = 50;
        } else {
          completion = 0;
        }

        const isCleared = completion === 100 || t.trip_status === "DELIVERED" || t.trip_status === "COMPLETED";

        return {
          id: t.id,
          trip_reference: formatTripReference(t.id, t.created_at),
          booking_id: t.booking_id,
          booking_reference: formatBookingReference(t.booking_id),
          vehicle_id: t.vehicle_id,
          vehicle_registration: vMap.get(t.vehicle_id) || "—",
          driver_id: t.driver_id,
          driver_name: dMap.get(t.driver_id) || "—",
          status: isCleared ? "CLEARED_FOR_DISPATCH" : "PENDING_DOC_CLEARANCE",
          planned_departure_date: t.started_at || t.created_at,
          created_at: t.created_at,
          updated_at: t.created_at,
          pre_trip_gate_completion: completion,
        };
      });

      // Apply search filter
      let filtered = enrichedTrips;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(t =>
          t.trip_reference.toLowerCase().includes(q) ||
          t.booking_reference.toLowerCase().includes(q) ||
          t.vehicle_registration.toLowerCase().includes(q) ||
          t.driver_name.toLowerCase().includes(q)
        );
      }

      setTrips(filtered);
    } catch (err: any) {
      console.error("Database query error:", err);
      setError(null);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Initial load
  useEffect(() => {
    fetchKpiStats();
    fetchTrips();
  }, [fetchKpiStats, fetchTrips]);

  // Filter trips based on status filter
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (statusFilter === "PENDING_DOCS") {
        return trip.status === "PENDING_DOC_CLEARANCE" && trip.pre_trip_gate_completion === 0;
      }
      if (statusFilter === "PARTIALLY_CLEARED") {
        return (
          trip.status === "PENDING_DOC_CLEARANCE" &&
          trip.pre_trip_gate_completion > 0 &&
          trip.pre_trip_gate_completion < 100
        );
      }
      if (statusFilter === "CLEARED") {
        return trip.status === "CLEARED_FOR_DISPATCH" || trip.pre_trip_gate_completion === 100;
      }
      return true; // ALL
    });
  }, [trips, statusFilter]);

  // Pagination
  const totalCount = filteredTrips.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const paginatedTrips = useMemo(() => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    return filteredTrips.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredTrips, page]);

  // Handle refresh
  const handleRefresh = () => {
    fetchKpiStats();
    fetchTrips();
    setToastMessage("Refreshed document clearance queue from database.");
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Handle trip click
  const handleTripClick = (tripId: string) => {
    const foundTrip = trips.find(t => t.id === tripId);
    if (foundTrip) {
      setSelectedReviewTrip(foundTrip);
      setReviewRejectionReason("");
    } else if (onNavigateToTrip) {
      onNavigateToTrip(tripId);
    }
  };

  // Handle export
  const handleExportCSV = () => {
    if (filteredTrips.length === 0) {
      setToastMessage("No trips available to export.");
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const headers = [
      "Trip Reference",
      "Booking Reference",
      "Vehicle Registration",
      "Driver Name",
      "Status",
      "Completion %",
      "Planned Departure",
    ];

    const rows = filteredTrips.map((t) => [
      t.trip_reference,
      t.booking_reference,
      t.vehicle_registration,
      t.driver_name,
      getTripStatusBadge(t.status).label,
      `${t.pre_trip_gate_completion}%`,
      new Date(t.planned_departure_date).toLocaleDateString("en-IN"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `NECL_Document_Clearance_Export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage("Exported document clearance queue to CSV successfully.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="doc-clearance-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-success">
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          className="alert-error-bar"
          style={{
            background: "var(--brand-soft)",
            border: "1px solid #FCA5A5",
            color: "#F45325",
            padding: "12px 16px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#F45325",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => {}}>
          Documents
        </span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Pre-Trip Document Clearance</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Pre-Trip Document Clearance</h1>
          <p className="page-subtitle">
            Review and approve mandatory documents before trip dispatch. All six document categories must be approved before clearance.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        {/* Total Trips */}
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "#FFFFFF" }}>
            <FileCheck size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Total Trips in Queue</div>
            <div className="kpi-stat-value">{kpis.total}</div>
            <div className="kpi-stat-trend positive">
              <span>Awaiting Clearance</span>
            </div>
          </div>
        </div>

        {/* Pending Docs */}
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <Clock size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Pending Documents</div>
            <div className="kpi-stat-value">{kpis.pendingDocs}</div>
            <div className="kpi-stat-trend negative">
              <span>0% Complete</span>
            </div>
          </div>
        </div>

        {/* Partially Cleared */}
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <AlertCircle size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Partially Cleared</div>
            <div className="kpi-stat-value">{kpis.partiallyClear}</div>
            <div className="kpi-stat-trend positive">
              <span>In Progress</span>
            </div>
          </div>
        </div>

        {/* Cleared */}
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <CheckCircle size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Cleared for Dispatch</div>
            <div className="kpi-stat-value">{kpis.cleared}</div>
            <div className="kpi-stat-trend positive">
              <span>100% Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filters-bar-card">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-abs" />
          <input
            type="text"
            placeholder="Search by trip, booking, vehicle, or driver..."
            className="client-search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            id="doc-clearance-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilterType);
            setPage(1);
          }}
        >
          <option value="ALL">All Status</option>
          <option value="PENDING_DOCS">Pending Documents</option>
          <option value="PARTIALLY_CLEARED">Partially Cleared</option>
          <option value="CLEARED">Cleared</option>
        </select>

        {/* Refresh */}
        <button
          className="btn-filter-more"
          onClick={handleRefresh}
          title="Refresh from Database"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>

        {/* Reset */}
        <button
          className="btn-filter-reset"
          onClick={() => {
            setSearchQuery("");
            setStatusFilter("ALL");
            setPage(1);
          }}
        >
          Reset
        </button>
      </div>

      {/* Status Tabs */}
      <div className="table-sub-bar">
        <div className="status-tabs-list">
          <button
            className={`status-tab-btn ${statusFilter === "ALL" ? "active-tab" : ""}`}
            onClick={() => {
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            All ({kpis.total})
          </button>
          <button
            className={`status-tab-btn ${statusFilter === "PENDING_DOCS" ? "active-tab" : ""}`}
            onClick={() => {
              setStatusFilter("PENDING_DOCS");
              setPage(1);
            }}
          >
            Pending Docs ({kpis.pendingDocs})
          </button>
          <button
            className={`status-tab-btn ${statusFilter === "PARTIALLY_CLEARED" ? "active-tab" : ""}`}
            onClick={() => {
              setStatusFilter("PARTIALLY_CLEARED");
              setPage(1);
            }}
          >
            Partially Cleared ({kpis.partiallyClear})
          </button>
          <button
            className={`status-tab-btn ${statusFilter === "CLEARED" ? "active-tab" : ""}`}
            onClick={() => {
              setStatusFilter("CLEARED");
              setPage(1);
            }}
          >
            Cleared ({kpis.cleared})
          </button>
        </div>

        <div className="sub-bar-actions">
          <button className="btn-sub-action" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="client-table-card">
        <table className="client-table">
          <thead>
            <tr>
              <th>
                <div className="th-sortable">
                  <span>Trip Reference</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Booking Reference</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Vehicle</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Driver</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Planned Departure</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Pre-Trip Gate Completion</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Status</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th style={{ width: 110, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} style={{ padding: "16px 20px" }}>
                    <div style={{ height: 28, background: "#FFFFFF", borderRadius: 6 }} />
                  </td>
                </tr>
              ))
            ) : paginatedTrips.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <FileCheck size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
                  <h3 style={{ color: "#111111", margin: "0 0 6px" }}>
                    No trips found in document clearance queue
                  </h3>
                  <p style={{ color: "#64748B", margin: 0, fontSize: 13 }}>
                    {searchQuery
                      ? "No trips matched your search query."
                      : "All trips have been cleared or no trips are pending clearance."}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedTrips.map((trip) => {
                const statusBadge = getTripStatusBadge(trip.status);
                const completionColor = getCompletionColor(trip.pre_trip_gate_completion);

                return (
                  <tr
                    key={trip.id}
                    className="client-row"
                    onClick={() => handleTripClick(trip.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Trip Reference */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "6px",
                            background: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Package size={16} color="#F45325" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#111111" }}>
                            {trip.trip_reference}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Booking Reference */}
                    <td>
                      <span className="mono-text">{trip.booking_reference}</span>
                    </td>

                    {/* Vehicle */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Truck size={14} color="#64748B" />
                        <span style={{ fontWeight: 500 }}>{trip.vehicle_registration}</span>
                      </div>
                    </td>

                    {/* Driver */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} color="#64748B" />
                        <span>{trip.driver_name}</span>
                      </div>
                    </td>

                    {/* Planned Departure */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={14} color="#64748B" />
                        <span>
                          {new Date(trip.planned_departure_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Completion Percentage */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            background: "rgba(244,83,37,0.25)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${trip.pre_trip_gate_completion}%`,
                              height: "100%",
                              background: completionColor,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: completionColor,
                            minWidth: "40px",
                            textAlign: "right",
                          }}
                        >
                          {trip.pre_trip_gate_completion}%
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`type-badge ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                      <button
                        className="btn-icon-action"
                        onClick={() => handleTripClick(trip.id)}
                        title="Review Documents"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} trips
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-current">
                Page {page} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-App Document Review Lightbox Modal */}
      {selectedReviewTrip && (
        <div className="doc-lightbox-overlay" onClick={() => setSelectedReviewTrip(null)}>
          <div className="doc-lightbox-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-lightbox-header">
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Pre-Trip Document Audit — {selectedReviewTrip.trip_reference}
                </h2>
                <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "2px" }}>
                  Vehicle: <strong style={{ color: "#0F172A" }}>{selectedReviewTrip.vehicle_registration}</strong> • Driver: <strong style={{ color: "#0F172A" }}>{selectedReviewTrip.driver_name}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedReviewTrip(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 4 Compliance Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {[
                  { title: "Vehicle Registration (RC)", status: "APPROVED", date: "Valid till Nov 2027", code: selectedReviewTrip.vehicle_registration },
                  { title: "Commercial Insurance", status: "APPROVED", date: "Valid till Aug 2027", code: "HDFC ERGO Commercial" },
                  { title: "Driver Commercial DL", status: "APPROVED", date: "Valid till Mar 2029", code: `${selectedReviewTrip.driver_name} (HGV)` },
                  { title: "E-Way Bill & Cargo Invoice", status: "PENDING_VERIFY", date: "Expires in 72 hrs", code: selectedReviewTrip.booking_reference }
                ].map((doc, idx) => (
                  <div key={idx} style={{
                    padding: "14px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#F8FAFC",
                    display: "flex", flexDirection: "column", gap: "4px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>{doc.title}</span>
                      <span style={{
                        fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                        background: doc.status === "APPROVED" ? "#DCFCE7" : "#FEF3C7",
                        color: doc.status === "APPROVED" ? "#15803D" : "#92400E"
                      }}>
                        {doc.status === "APPROVED" ? "VERIFIED" : "CHECK REQUIRED"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748B" }}>Ref: {doc.code}</div>
                    <div style={{ fontSize: "11px", color: "#10B981", fontWeight: 600 }}>{doc.date}</div>
                  </div>
                ))}
              </div>

              {/* Quick Rejection Chips */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "4px" }}>
                  Flag Issue or Rejection Reason
                </label>
                <div className="rejection-chip-group">
                  {[
                    "Blurry Document Photo",
                    "Expired Commercial Insurance",
                    "Chassis / Reg Number Mismatch",
                    "Missing Driver Signature on Challan"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={`rejection-chip ${reviewRejectionReason === chip ? 'active' : ''}`}
                      onClick={() => setReviewRejectionReason(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Select a reason chip above or type specific correction remarks..."
                  value={reviewRejectionReason}
                  onChange={(e) => setReviewRejectionReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div className="doc-lightbox-footer">
              <button
                onClick={() => {
                  if (!reviewRejectionReason.trim()) {
                    setToastMessage("Please select or enter a rejection reason first.");
                    setTimeout(() => setToastMessage(null), 2500);
                    return;
                  }
                  setToastMessage(`Trip ${selectedReviewTrip.trip_reference} flagged: ${reviewRejectionReason}`);
                  setSelectedReviewTrip(null);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                style={{
                  padding: "9px 18px", background: "#FEF2F2", color: "#DC2626",
                  border: "1px solid #FCA5A5", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer"
                }}
              >
                Reject Documents & Request Re-upload
              </button>

              <button
                onClick={() => {
                  setToastMessage(`Trip ${selectedReviewTrip.trip_reference} cleared for dispatch! Gate pass generated.`);
                  setSelectedReviewTrip(null);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                style={{
                  padding: "9px 20px", background: "#10B981", color: "#FFFFFF",
                  border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                }}
              >
                ✓ Clear All Documents & Issue Gate Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Styles for Status Badges */}
      <style>{`
        .status-pending {
          background: #FEF3EE;
          color: #F45325;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-warning {
          background: #FED7AA;
          color: #9A3412;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-success {
          background: #DCFCE7;
          color: #166534;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-default {
          background: #FFFFFF;
          color: #475569;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};
