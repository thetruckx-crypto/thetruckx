import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, Plus, Eye, CheckCircle, Loader2,
  RefreshCw, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { useToast } from "../../context/ToastContext";
import { SkeletonTable } from "../common/Skeleton";

interface Exception {
  id: string;
  exception_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "RESOLVED";
  trip_id?: string;
  booking_id?: string;
  description: string;
  created_at: string;
  exception_reference?: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; color: string }> = {
  LOW:      { bg: "#FEF3EE", color: "#F45325" },
  MEDIUM:   { bg: "#FEF3EE", color: "#F45325" },
  HIGH:     { bg: "#FED7AA", color: "#F45325" },
  CRITICAL: { bg: "#FEF3EE", color: "#F45325" },
};

const ITEMS_PER_PAGE = 15;

export const ExceptionsModule: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ open: 0, high: 0, critical: 0, resolvedToday: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("ALL");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "DELAY", severity: "MEDIUM", tripId: "", bookingId: "", description: ""
  });

  const fetchCounts = useCallback(async () => {
    try {
      const [openRes, highRes, critRes] = await Promise.all([
        supabase.from("exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
        supabase.from("exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN").eq("severity", "HIGH"),
        supabase.from("exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN").eq("severity", "CRITICAL"),
      ]);
      setCounts({
        open: openRes.count ?? 0,
        high: highRes.count ?? 0,
        critical: critRes.count ?? 0,
        resolvedToday: 0,
      });
    } catch {}
  }, []);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("exceptions")
        .select("*")
        .eq("status", "OPEN")
        .order("created_at", { ascending: false });
      if (severityFilter !== "ALL") q = q.eq("severity", severityFilter);
      const { data } = await q;
      if (data) {
        setExceptions(data.map((e, i) => ({
          ...e,
          exception_reference: `EXC-${String(i + 1).padStart(4, "0")}`,
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [severityFilter]);

  useEffect(() => { fetchCounts(); fetchExceptions(); }, [fetchCounts, fetchExceptions]);

  const handleCreate = async () => {
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("exceptions").insert({
        exception_type: form.type,
        severity: form.severity,
        trip_id: form.tripId || null,
        booking_id: form.bookingId || null,
        description: form.description,
        reported_by: user?.id,
        status: "OPEN",
      });
      if (error) throw error;
      toast.success("Exception created successfully");
      setShowCreateModal(false);
      setForm({ type: "DELAY", severity: "MEDIUM", tripId: "", bookingId: "", description: "" });
      fetchCounts(); fetchExceptions();
    } catch (err: any) {
      toast.error(err.message || "Failed to create exception");
    } finally { setSaving(false); }
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Mark this exception as resolved?")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("exceptions").update({
        status: "RESOLVED",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      }).eq("id", id);
      toast.success("Exception marked as resolved");
      fetchCounts(); fetchExceptions();
    } catch (err: any) { toast.error(err.message || "Failed to resolve exception"); }
  };

  const filtered = exceptions.filter(e =>
    !search ||
    e.exception_type?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.exception_reference?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="cli-dir-wrapper">
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Operations</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Exceptions & Disruptions</span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Exceptions & Disruptions</h1>
          <p className="page-subtitle">Track and resolve operational exceptions in real time</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className="btn-action-outline"
            onClick={() => { fetchCounts(); fetchExceptions(); }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /><span>Refresh</span>
          </button>
          <button className="btn-create-orange" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /><span>Create Exception</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle orange">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Open Exceptions</span>
            </div>
            <div className="kpi-value">{counts.open}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle amber">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">High Severity</span>
            </div>
            <div className="kpi-value">{counts.high}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle red">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Critical</span>
            </div>
            <div className="kpi-value">{counts.critical}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Resolved Today</span>
            </div>
            <div className="kpi-value">{counts.resolvedToday}</div>
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
            placeholder="Search exceptions..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="status-tabs-group">
          {(["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(s => (
            <button
              key={s}
              onClick={() => { setSeverityFilter(s); setPage(1); }}
              className={`status-tab-btn ${severityFilter === s ? "active" : ""}`}
            >
              {s === "ALL" ? "All Severity" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <AlertTriangle size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
          <h4 className="empty-state-heading">No exceptions found</h4>
          <p className="empty-state-text">{search ? "No exceptions match your search" : "No open exceptions — operations running smoothly!"}</p>
        </div>
      ) : (
        <>
          <div className="client-table-card">
            <div className="table-wrapper">
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(exc => {
                    const sev = SEVERITY_STYLES[exc.severity] ?? SEVERITY_STYLES.MEDIUM;
                    return (
                      <tr
                        key={exc.id}
                        className="client-data-row"
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/admin/exceptions/${exc.id}`)}
                      >
                        <td>
                          <span className="mono-code" style={{ color: "#F05A22", fontWeight: 700 }}>
                            {exc.exception_reference}
                          </span>
                        </td>
                        <td>
                          <span className="client-name-bold">
                            {exc.exception_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span className="status-badge" style={{ background: sev.bg, color: sev.color }}>
                            {exc.severity}
                          </span>
                        </td>
                        <td>
                          <span className="table-cell-sub" style={{ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                            {exc.description}
                          </span>
                        </td>
                        <td>
                          <span className="table-cell-sub">
                            {new Date(exc.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn-icon-action"
                              onClick={() => navigate(`/admin/exceptions/${exc.id}`)}
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                          <button
                            onClick={e => handleResolve(exc.id, e)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "7px 12px", background: "var(--brand-soft)", color: "#F45325",
                              border: "1px solid #86EFAC", borderRadius: "8px",
                              fontSize: "12px", fontWeight: 600, cursor: "pointer"
                            }}
                          >
                            <CheckCircle size={13} />Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  <ChevronLeft size={15} />Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + Math.max(1, page - 2)).filter(n => n <= totalPages).map(n => (
                  <button key={n} className={`pagination-btn${page === n ? " currentPage" : ""}`} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next<ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <h2 className="modal-title">Create Exception</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "4px" }}
              >✕</button>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Exception Type *</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {["BREAKDOWN","DELAY","ROUTE_DEVIATION","CARGO_DAMAGE","ACCIDENT","DETENTION","DELIVERY_FAILURE","OTHER"].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Severity *</label>
                <select className="form-select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {["LOW","MEDIUM","HIGH","CRITICAL"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label">Trip ID (optional)</label>
                  <input className="form-input" placeholder="trip-uuid" value={form.tripId} onChange={e => setForm(f => ({ ...f, tripId: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Booking ID (optional)</label>
                  <input className="form-input" placeholder="booking-uuid" value={form.bookingId} onChange={e => setForm(f => ({ ...f, bookingId: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" rows={3} placeholder="Describe the exception in detail..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ padding: "9px 18px", background: "#FFFFFF", border: "1px solid rgba(244,83,37,0.25)", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
              >
                Cancel
              </button>
              <button className="btn-create-gold" onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create Exception"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
