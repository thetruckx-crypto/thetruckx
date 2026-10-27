import React, { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, Eye, Plus, RefreshCw, Loader2,
  CheckCircle, Search, ChevronLeft, ChevronRight, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { useToast } from "../../context/ToastContext";

interface Booking {
  id: string;
  booking_reference: string;
  client_company_name: string;
  grand_total: number;
  amount_received: number;
  balance_due: number;
  payment_status: "PAYMENT_PENDING" | "PARTIALLY_PAID" | "PAID";
  completed_at: string;
  days_overdue?: number;
}

const ITEMS_PER_PAGE = 15;

export const PaymentsModule: React.FC = () => {
  const navigate = useNavigate();
  const appToast = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({ outstanding: 0, overdue: 0, partiallyPaid: 0, paidThisMonth: 0 });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAYMENT_PENDING" | "PARTIALLY_PAID">("ALL");
  const [page, setPage] = useState(1);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", date: new Date().toISOString().split("T")[0], mode: "NEFT", reference: "", notes: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchKpis = useCallback(async () => {
    try {
      const [pendRes, partRes] = await Promise.all([
        supabase.from("bookings").select("grand_total, amount_received").eq("payment_status", "PAYMENT_PENDING"),
        supabase.from("bookings").select("grand_total, amount_received").eq("payment_status", "PARTIALLY_PAID"),
      ]);
      const pendingTotal = (pendRes.data || []).reduce((s, b) => s + ((b.grand_total || 0) - (b.amount_received || 0)), 0);
      const partialTotal = (partRes.data || []).reduce((s, b) => s + ((b.grand_total || 0) - (b.amount_received || 0)), 0);
      setKpis({ outstanding: pendingTotal, overdue: 0, partiallyPaid: partialTotal, paidThisMonth: 0 });
    } catch {}
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("bookings")
        .select("*")
        .in("payment_status", statusFilter === "ALL" ? ["PAYMENT_PENDING", "PARTIALLY_PAID"] : [statusFilter])
        .order("created_at", { ascending: true });
      const { data } = await q;
      if (data) {
        setBookings(data.map(b => ({
          ...b,
          booking_reference: b.booking_reference || `BOK-${b.id.substring(0, 8)}`,
          client_company_name: b.client_company_name || "—",
          grand_total: b.grand_total || 0,
          amount_received: b.amount_received || 0,
          balance_due: (b.grand_total || 0) - (b.amount_received || 0),
        })));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchKpis(); fetchBookings(); }, [fetchKpis, fetchBookings]);

  const handleRecordPayment = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { appToast.error("Enter a valid payment amount"); return; }
    if (!paymentForm.date) { appToast.error("Payment date is required"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let insertError = null;
      try {
        const { error } = await supabase.from("payment_records").insert({
          booking_id: selectedBooking.id,
          amount_collected: amount,
          payment_date: paymentForm.date,
          payment_mode: paymentForm.mode,
          transaction_reference: paymentForm.reference || null,
          recorded_by: user?.id || "admin-system",
        });
        insertError = error;
      } catch (e: any) {
        insertError = e;
      }

      if (insertError && (insertError.message?.includes("column") || insertError.message?.includes("schema cache"))) {
        // Fallback for legacy column naming
        const { error: altErr } = await supabase.from("payment_records").insert({
          booking_id: selectedBooking.id,
          amount,
          payment_date: paymentForm.date,
          payment_mode: paymentForm.mode,
          reference_number: paymentForm.reference || null,
          notes: paymentForm.notes || null,
          recorded_by: user?.id,
        });
        if (altErr) throw altErr;
      } else if (insertError) {
        throw insertError;
      }
      const newReceived = selectedBooking.amount_received + amount;
      const newStatus = newReceived >= selectedBooking.grand_total ? "PAID" : "PARTIALLY_PAID";
      await supabase.from("bookings").update({ amount_received: newReceived, payment_status: newStatus }).eq("id", selectedBooking.id);
      appToast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      setPaymentForm({ amount: "", date: new Date().toISOString().split("T")[0], mode: "NEFT", reference: "", notes: "" });
      fetchKpis(); fetchBookings();
    } catch (err: any) { appToast.error(err.message || "Failed to record payment"); }
    finally { setSaving(false); }
  };

  const filtered = bookings.filter(b =>
    !search ||
    b.booking_reference?.toLowerCase().includes(search.toLowerCase()) ||
    b.client_company_name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="cli-dir-wrapper">
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Finance</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Client Payments</span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Client Payment Collection</h1>
          <p className="page-subtitle">Track outstanding invoices and record payment receipts</p>
        </div>
        <button
          className="btn-action-outline"
          onClick={() => { fetchKpis(); fetchBookings(); }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} /><span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle orange">
            <IndianRupee size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Outstanding</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(kpis.outstanding)}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle amber">
            <IndianRupee size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Partially Paid</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(kpis.partiallyPaid)}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle green">
            <CheckCircle size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Paid This Month</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(kpis.paidThisMonth)}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-avatar-squircle red">
            <IndianRupee size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-header-row">
              <span className="kpi-title">Overdue (&gt;30 days)</span>
            </div>
            <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(kpis.overdue)}</div>
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
            placeholder="Search by booking or client..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="status-tabs-group">
          {(["ALL", "PAYMENT_PENDING", "PARTIALLY_PAID"] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`status-tab-btn ${statusFilter === s ? "active" : ""}`}>
              {s === "ALL" ? "All Pending" : s === "PAYMENT_PENDING" ? "Unpaid" : "Partial"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <Loader2 size={36} color="#F05A22" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
          <p className="empty-state-text">Loading payment records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <IndianRupee size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
          <h4 className="empty-state-heading">No payment records found</h4>
          <p className="empty-state-text">{search ? "No records match your search" : "No pending payments — all accounts settled!"}</p>
        </div>
      ) : (
        <>
          <div className="client-table-card">
            <div className="table-wrapper">
              <table className="client-table">
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Client</th>
                    <th style={{ textAlign: "right" }}>Grand Total</th>
                    <th style={{ textAlign: "right" }}>Received</th>
                    <th style={{ textAlign: "right" }}>Balance Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(booking => (
                    <tr key={booking.id} className="client-data-row">
                      <td>
                        <span className="mono-code" style={{ color: "#F05A22", fontWeight: 700 }}>
                          {booking.booking_reference}
                        </span>
                      </td>
                      <td>
                        <span className="client-name-bold">{booking.client_company_name}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#172B4D", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(booking.grand_total)}
                      </td>
                      <td style={{ textAlign: "right", color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(booking.amount_received)}
                      </td>
                      <td style={{ textAlign: "right", color: "#F05A22", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(booking.balance_due)}
                      </td>
                      <td>
                        <span className={`status-badge-pastel ${booking.payment_status === "PAYMENT_PENDING" ? "inactive" : "pending"}`}>
                          {booking.payment_status === "PAYMENT_PENDING" ? "Unpaid" : "Partial"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            className="btn-icon-action"
                            onClick={() => navigate(`/admin/payments/${booking.id}/history`)}
                            title="Payment History"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowPaymentModal(true); }}
                            className="btn-create-orange"
                            style={{ padding: "6px 14px", fontSize: "12.5px" }}
                          >
                            <Plus size={13} />
                            <span>Record</span>
                          </button>
                        </div>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Summary */}
              <div style={{ padding: "14px 16px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid rgba(244,83,37,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>Booking</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>{selectedBooking.booking_reference}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>Grand Total</span>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>{fmt(selectedBooking.grand_total)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>Balance Due</span>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#F45325" }}>{fmt(selectedBooking.balance_due)}</span>
                </div>
              </div>

              <div>
                <label className="form-label">Amount (₹) *</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder={`Max: ${fmt(selectedBooking.balance_due)}`}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Payment Date *</label>
                <input
                  className="form-input"
                  type="date"
                  value={paymentForm.date}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Payment Mode *</label>
                <select className="form-select" value={paymentForm.mode} onChange={e => setPaymentForm(f => ({ ...f, mode: e.target.value }))}>
                  {["NEFT","RTGS","IMPS","CHEQUE","CASH","UPI"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">UTR / Reference Number</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. NEFT12345678"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Optional notes..."
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ padding: "9px 18px", background: "#FFFFFF", border: "1px solid rgba(244,83,37,0.25)", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
              >
                Cancel
              </button>
              <button className="btn-create-gold" onClick={handleRecordPayment} disabled={saving || !paymentForm.amount}>
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
