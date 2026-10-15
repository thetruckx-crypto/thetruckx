import React, { useState, useEffect, useCallback } from "react";
import {
  CheckSquare, X, CheckCircle, Loader2, RefreshCw,
  Search, Truck, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "../../utils/supabase";

interface Trip {
  id: string;
  booking_id: string;
  trip_status: string;
  trip_reference?: string;
  booking_reference?: string;
  vehicle_registration?: string;
  driver_name?: string;
  delivery_date?: string;
  updated_at?: string;
  pod_status?: string;
}

const ITEMS_PER_PAGE = 15;

export const PODModule: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0 });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const { data: tripsData } = await supabase
        .from("trips")
        .select("*")
        .eq("trip_status", "DELIVERED")
        .is("pod_approved", null)
        .order("updated_at", { ascending: false });

      if (tripsData) {
        const enriched = tripsData.map((t, idx) => ({
          ...t,
          trip_reference: t.trip_reference || `TRP-${String(idx + 1).padStart(3, "0")}`,
          booking_reference: `BOK-${t.booking_id?.substring(0, 8) ?? ""}`,
          pod_status: "PENDING",
        }));
        setTrips(enriched);
        setCounts(c => ({ ...c, pending: enriched.length }));
      }
    } catch (err: any) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleApprovePOD = async () => {
    if (!selectedTrip) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("trips")
        .update({
          pod_approved: true,
          trip_status: "CLOSED",
          pod_approved_by: user?.id,
          pod_approved_at: new Date().toISOString(),
        })
        .eq("id", selectedTrip.id);
      if (error) throw error;
      showToast("POD approved — trip closed successfully");
      setShowReviewModal(false);
      fetchTrips();
    } catch (err: any) {
      showToast(err.message || "Failed to approve POD", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPOD = async () => {
    if (!selectedTrip) return;
    if (!rejectionReason.trim()) {
      showToast("Rejection reason is required", "error");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("trips")
        .update({
          pod_approved: false,
          pod_rejection_reason: rejectionReason,
          pod_reviewed_by: user?.id,
          pod_reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedTrip.id);
      if (error) throw error;
      showToast("POD rejected — vendor/driver notified");
      setShowReviewModal(false);
      setRejectionReason("");
      fetchTrips();
    } catch (err: any) {
      showToast(err.message || "Failed to reject POD", "error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = trips.filter(t =>
    !search ||
    t.trip_reference?.toLowerCase().includes(search.toLowerCase()) ||
    t.booking_reference?.toLowerCase().includes(search.toLowerCase()) ||
    t.vehicle_registration?.toLowerCase().includes(search.toLowerCase()) ||
    t.driver_name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="cli-dir-wrapper">
      {/* Toast */}
      {toastMessage && (
        <div className={toastType === "success" ? "toast-success" : "toast-error"}>
          <CheckCircle size={16} />{toastMessage}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Operations</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">POD & Booking Closure</span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            <CheckSquare size={26} color="#F45325" style={{ display: "inline", marginRight: "0.6rem" }} />
            POD & Booking Closure
            {counts.pending > 0 && (
              <span style={{
                display: "inline-flex", marginLeft: "0.75rem",
                background: "#F45325", color: "#fff",
                padding: "2px 10px", borderRadius: "20px",
                fontSize: "13px", fontWeight: 700, verticalAlign: "middle",
              }}>
                {counts.pending}
              </span>
            )}
          </h1>
          <p className="page-subtitle">Review driver-submitted POD documents and close delivered trips</p>
        </div>
        <button
          className="btn-action-outline"
          onClick={fetchTrips}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} /><span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle orange">
            <CheckSquare size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Awaiting Review</span>
            </div>
            <div className="kpi-value">{counts.pending}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Approved Today</span>
            </div>
            <div className="kpi-value">{counts.approvedToday}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle red">
            <X size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Rejected Today</span>
            </div>
            <div className="kpi-value">{counts.rejectedToday}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle blue">
            <Truck size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Trips Closed (Total)</span>
            </div>
            <div className="kpi-value">—</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="filters-bar-card" style={{ marginBottom: "16px" }}>
        <div className="filter-input-wrap" style={{ flex: 1 }}>
          <Search size={16} className="filter-search-icon" />
          <input
            className="filter-text-input"
            type="text"
            placeholder="Search by trip ref, vehicle, or driver..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      {loading && trips.length === 0 ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <Loader2 size={36} color="#F05A22" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
          <p className="empty-state-text">Loading trips...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <CheckSquare size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
          <h4 className="empty-state-heading">No trips found</h4>
          <p className="empty-state-text">{search ? "No trips match your search" : "No delivered trips awaiting POD verification"}</p>
        </div>
      ) : (
        <>
          <div className="client-table-card">
            <div className="table-wrapper">
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Trip Ref</th>
                    <th>Booking Ref</th>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Delivery Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(trip => (
                    <tr key={trip.id} className="client-data-row">
                      <td>
                        <span className="mono-code" style={{ color: "#F05A22", fontWeight: 700 }}>
                          {trip.trip_reference}
                        </span>
                      </td>
                      <td>
                        <span className="mono-code" style={{ color: "#64748B" }}>
                          {trip.booking_reference}
                        </span>
                      </td>
                      <td>
                        <span className="client-name-bold">{trip.vehicle_registration || "N/A"}</span>
                      </td>
                      <td>
                        <span className="table-cell-sub">{trip.driver_name || "N/A"}</span>
                      </td>
                      <td>
                        <span className="table-cell-sub">
                          {trip.updated_at ? new Date(trip.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => { setSelectedTrip(trip); setShowReviewModal(true); }}
                          className="btn-create-orange"
                          style={{ padding: "6px 14px", fontSize: "13px" }}
                        >
                          Review POD
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination-bar">
              <span className="pagination-info">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={14} />Prev
                </button>
                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next<ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedTrip && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Review POD — {selectedTrip.trip_reference}</h2>
              <button onClick={() => { setShowReviewModal(false); setRejectionReason(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Trip Summary */}
              <div style={{ padding: "14px 16px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid rgba(244,83,37,0.25)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {[
                    { label: "Trip Ref", value: selectedTrip.trip_reference },
                    { label: "Booking Ref", value: selectedTrip.booking_reference },
                    { label: "Vehicle", value: selectedTrip.vehicle_registration || "N/A" },
                    { label: "Driver", value: selectedTrip.driver_name || "N/A" },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#111111", marginTop: "2px" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* POD Document placeholder */}
              {/* POD Inspection Canvas */}
              <div style={{ padding: "24px", background: "#0F172A", borderRadius: "10px", border: "1px solid #E2E8F0", textAlign: "center", position: "relative" }}>
                <div style={{ display: "inline-block", background: "#FFFFFF", padding: "16px 24px", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                    OFFICIAL DELIVERY ACKNOWLEDGEMENT
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                    Consignee Stamp & Receiver Signature
                  </div>
                  <div style={{ marginTop: "12px", border: "1px dashed #CBD5E1", padding: "12px", borderRadius: "6px", background: "#F8FAFC" }}>
                    <div style={{ fontFamily: "cursive", fontSize: "18px", color: "#1E293B" }}>Suresh Sen</div>
                    <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>Receiver Stamp: ASSAM TEA DEPOT — RECEIVED OK</div>
                  </div>
                </div>
              </div>

              {/* 3-Point Clearance Checklist */}
              <div style={{ background: "#F8FAFC", padding: "14px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                  Pre-Approval Verification Checklist
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "#334155" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked />
                    <span>Consignee Receiver signature verified on challan</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked />
                    <span>Official company rubber stamp visible and legible</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked />
                    <span>Zero cargo shortage or damage remarks endorsed</span>
                  </label>
                </div>
              </div>

              {/* Quick Rejection Chips */}
              <div>
                <label className="form-label" style={{ display: "block", marginBottom: "4px" }}>
                  Rejection Reason (Required only when rejecting)
                </label>
                <div className="rejection-chip-group">
                  {[
                    "Unclear Receiver Signature",
                    "Missing Consignee Rubber Stamp",
                    "Challan Image Blurry / Cut Off",
                    "Cargo Damage Remark Endorsed"
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      className={`rejection-chip ${rejectionReason === chip ? 'active' : ''}`}
                      onClick={() => setRejectionReason(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Select a reason chip above or type specific feedback for driver..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
              <button
                onClick={handleRejectPOD}
                disabled={loading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "9px 18px", background: "#FEF2F2", color: "#DC2626",
                  border: "1px solid #FCA5A5", borderRadius: "8px",
                  fontSize: "13px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <X size={15} /> Reject POD & Send Back
              </button>
              <button
                onClick={handleApprovePOD}
                disabled={loading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "9px 20px", background: "#10B981", color: "#FFFFFF",
                  border: "none", borderRadius: "8px",
                  fontSize: "13px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                }}
              >
                <CheckCircle size={15} /> Approve POD & Close Trip
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
