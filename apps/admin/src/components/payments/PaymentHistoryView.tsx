import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  IndianRupee, Calendar, FileText, ArrowLeft, Download,
  Search, RefreshCw, CheckCircle2, Clock, AlertCircle,
  ExternalLink, Copy, Check, ChevronRight, Filter, Receipt
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, ensureAdminSession } from "../../utils/supabase";
import { formatDisplayId } from "../../utils/idGenerator";

interface PaymentRecord {
  id: string;
  booking_id: string;
  amount_collected: number;
  payment_date: string;
  payment_mode: string;
  transaction_reference: string;
  receipt_doc_url?: string | null;
  recorded_by?: string | null;
  created_at: string;
}

interface BookingDetails {
  id: string;
  booking_code?: string;
  grand_total?: number;
  total_amount?: number;
  amount_received?: number;
  payment_status?: string;
  confirmed_at?: string;
  created_at?: string;
  client_companies?: {
    id?: string;
    company_name?: string;
  };
}

export const PaymentHistoryView: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [bookingInfo, setBookingInfo] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const fetchPaymentHistory = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      await ensureAdminSession();

      const [bookingRes, paymentsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, client_companies(id, company_name)")
          .eq("id", bookingId)
          .single(),
        supabase
          .from("payment_records")
          .select("*")
          .eq("booking_id", bookingId)
          .order("payment_date", { ascending: false })
      ]);

      if (bookingRes.data) {
        setBookingInfo(bookingRes.data);
      }
      if (paymentsRes.data) {
        setPayments(paymentsRes.data);
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchPaymentHistory();
  }, [fetchPaymentHistory]);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  const grandTotal = Number(bookingInfo?.grand_total || bookingInfo?.total_amount || 0);
  const totalReceived = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount_collected) || 0), 0);
  }, [payments]);
  const balanceDue = Math.max(0, grandTotal - totalReceived);

  const paymentStatus = useMemo(() => {
    const raw = (bookingInfo?.payment_status || "").toUpperCase();
    if (raw === "PAID" || balanceDue === 0) return "PAID";
    if (raw === "PARTIALLY_PAID" || totalReceived > 0) return "PARTIALLY_PAID";
    return "PAYMENT_PENDING";
  }, [bookingInfo, balanceDue, totalReceived]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchSearch =
        !search ||
        (p.transaction_reference && p.transaction_reference.toLowerCase().includes(search.toLowerCase())) ||
        (p.id && p.id.toLowerCase().includes(search.toLowerCase())) ||
        (p.payment_mode && p.payment_mode.toLowerCase().includes(search.toLowerCase()));

      const matchMode = modeFilter === "ALL" || p.payment_mode?.toUpperCase() === modeFilter.toUpperCase();
      return matchSearch && matchMode;
    });
  }, [payments, search, modeFilter]);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleExportCSV = () => {
    if (payments.length === 0) return;
    const headers = ["Payment Date", "Payment ID", "Amount (INR)", "Payment Mode", "UTR Reference", "Receipt URL"];
    const rows = payments.map(p => [
      p.payment_date,
      p.id,
      p.amount_collected,
      p.payment_mode,
      p.transaction_reference,
      p.receipt_doc_url || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payment_history_${bookingInfo?.booking_code || bookingId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayRef = bookingInfo?.booking_code?.startsWith('TRUCKX-BK-')
    ? bookingInfo.booking_code
    : (bookingId ? formatDisplayId('BK', bookingId, bookingInfo?.created_at) : "TRUCKX-BK-00001");
  const clientName = bookingInfo?.client_companies?.company_name || "Enterprise Client";

  return (
    <div className="cli-dir-wrapper" style={{ minHeight: "100%", padding: "24px 32px", background: "#F8FAFC" }}>
      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        <span
          className="breadcrumb-link"
          onClick={() => navigate("/admin/payments")}
          style={{ cursor: "pointer", color: "#F45325", fontWeight: 600 }}
        >
          Payments & Billing
        </span>
        <ChevronRight size={14} color="#94A3B8" />
        <span style={{ color: "#475569", fontWeight: 500 }}>{displayRef}</span>
        <ChevronRight size={14} color="#94A3B8" />
        <span className="breadcrumb-current" style={{ color: "#0F172A", fontWeight: 600 }}>Payment History</span>
      </div>

      {/* Header Row */}
      <div className="page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 className="page-title" style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Payment & Ledger History
            </h1>
            <span style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "3px 10px",
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#334155"
            }}>
              {displayRef}
            </span>
            <span style={{
              background: paymentStatus === "PAID" ? "rgba(16, 185, 129, 0.12)" : paymentStatus === "PARTIALLY_PAID" ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: paymentStatus === "PAID" ? "#059669" : paymentStatus === "PARTIALLY_PAID" ? "#D97706" : "#DC2626",
              border: `1px solid ${paymentStatus === "PAID" ? "rgba(16, 185, 129, 0.3)" : paymentStatus === "PARTIALLY_PAID" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              borderRadius: "6px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase"
            }}>
              {paymentStatus === "PAID" ? "Fully Paid" : paymentStatus === "PARTIALLY_PAID" ? "Partially Paid" : "Payment Pending"}
            </span>
          </div>
          <p className="page-subtitle" style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            Client: <strong style={{ color: "#1E293B" }}>{clientName}</strong> · Complete transaction log and receipts
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={fetchPaymentHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#475569"
            }}
            title="Refresh payment records"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          {payments.length > 0 && (
            <button
              onClick={handleExportCSV}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 14px",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569"
              }}
              title="Download CSV Statement"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={() => navigate("/admin/payments")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              background: "#F45325",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Payments</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {/* Grand Total */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          padding: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", fontWeight: 600, marginBottom: "6px" }}>
              Total Invoice Amount
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
              {fmt(grandTotal)}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
              Agreed booking freight & charges
            </div>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
            <FileText size={20} />
          </div>
        </div>

        {/* Total Received */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          padding: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", fontWeight: 600, marginBottom: "6px" }}>
              Total Collected
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669", letterSpacing: "-0.02em" }}>
              {fmt(totalReceived)}
            </div>
            <div style={{ fontSize: "12px", color: "#059669", marginTop: "4px", fontWeight: 600 }}>
              {payments.length} payment transaction{payments.length === 1 ? "" : "s"} logged
            </div>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Balance Due */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          padding: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", fontWeight: 600, marginBottom: "6px" }}>
              Outstanding Balance
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: balanceDue > 0 ? "#DC2626" : "#059669", letterSpacing: "-0.02em" }}>
              {fmt(balanceDue)}
            </div>
            <div style={{ fontSize: "12px", color: balanceDue > 0 ? "#DC2626" : "#059669", marginTop: "4px", fontWeight: 600 }}>
              {balanceDue > 0 ? "Pending collection from client" : "All payments fully reconciled"}
            </div>
          </div>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            background: balanceDue > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: balanceDue > 0 ? "#DC2626" : "#059669"
          }}>
            {balanceDue > 0 ? <Clock size={20} /> : <CheckCircle2 size={20} />}
          </div>
        </div>
      </div>

      {/* Payment Records Section */}
      <div style={{ background: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {/* Table Controls & Filter Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Payment Records ({filteredPayments.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
              Audited transaction entries linked to this booking
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search UTR or Mode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: "36px",
                  paddingLeft: "34px",
                  paddingRight: "12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px"
                }}
              />
            </div>

            {/* Mode Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Filter size={15} color="#94A3B8" />
              <select
                value={modeFilter}
                onChange={e => setModeFilter(e.target.value)}
                style={{
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontWeight: 600
                }}
              >
                <option value="ALL">All Modes</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="UPI">UPI</option>
                <option value="CASH">CASH</option>
                <option value="CHEQUE">CHEQUE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#F45325" }} />
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B" }}>Loading payment history...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px", color: "#64748B" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#94A3B8" }}>
              <IndianRupee size={28} />
            </div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700, color: "#1E293B" }}>
              {payments.length === 0 ? "No Payments Recorded Yet" : "No Matching Payments Found"}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748B", maxWidth: "380px", marginInline: "auto" }}>
              {payments.length === 0
                ? "Payments recorded against this booking in the Client Payments tab will appear here with full audit details."
                : "Try clearing your search query or changing the payment mode filter."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table-standard" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Date</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>UTR / Reference</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mode</th>
                  <th style={{ padding: "12px 20px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount Collected</th>
                  <th style={{ padding: "12px 20px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Receipt / Doc</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(payment => {
                  const formattedDate = payment.payment_date
                    ? new Date(payment.payment_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })
                    : "-";

                  return (
                    <tr
                      key={payment.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <td style={{ padding: "14px 20px", fontSize: "13px", color: "#1E293B", fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Calendar size={14} color="#94A3B8" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#0F172A",
                            background: "#F1F5F9",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: "1px solid #E2E8F0"
                          }}>
                            {payment.transaction_reference || "NO-REF"}
                          </span>
                          {payment.transaction_reference && (
                            <button
                              onClick={() => handleCopyUtr(payment.transaction_reference)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: copiedUtr === payment.transaction_reference ? "#059669" : "#94A3B8",
                                padding: "2px"
                              }}
                              title="Copy Reference"
                            >
                              {copiedUtr === payment.transaction_reference ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: "#EFF6FF",
                          color: "#1D4ED8",
                          border: "1px solid #DBEAFE"
                        }}>
                          {payment.payment_mode || "NEFT"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <span style={{ fontSize: "15px", fontWeight: 800, color: "#059669", letterSpacing: "-0.01em" }}>
                          {fmt(Number(payment.amount_collected) || 0)}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px", textAlign: "center" }}>
                        {payment.receipt_doc_url ? (
                          <a
                            href={payment.receipt_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              color: "#2563EB",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none"
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>View Doc</span>
                          </a>
                        ) : (
                          <span style={{ color: "#CBD5E1", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};