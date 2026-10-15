import React, { useState, useEffect } from "react";
import { IndianRupee, Calendar, FileText, ArrowLeft, Download } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string;
  notes: string;
  recorded_by: string;
  created_at: string;
}

export const PaymentHistoryView: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingId) fetchPaymentHistory();
  }, [bookingId]);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    try {
      const [bookingRes, paymentsRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("id", bookingId).single(),
        supabase.from("payment_records").select("*").eq("booking_id", bookingId).order("payment_date", { ascending: false })
      ]);

      if (bookingRes.data) setBookingInfo(bookingRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="cli-dir-wrapper">
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => navigate("/admin/payments")} style={{ cursor: "pointer" }}>
          Payments
        </span>
        <span className="breadcrumb-sep">�</span>
        <span className="breadcrumb-current">Payment History</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Payment History</h1>
          <p className="page-subtitle">BOK-{bookingId?.substring(0, 8)}</p>
        </div>
        <button onClick={() => navigate("/admin/payments")} className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {bookingInfo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="content-card">
            <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.25rem" }}>Grand Total</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>?{bookingInfo.grand_total?.toLocaleString()}</div>
          </div>
          <div className="content-card">
            <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.25rem" }}>Total Received</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#F45325" }}>?{totalReceived.toLocaleString()}</div>
          </div>
          <div className="content-card">
            <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.25rem" }}>Balance Due</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#F45325" }}>
              ?{((bookingInfo.grand_total || 0) - totalReceived).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="content-card">
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", marginBottom: "1.5rem" }}>
          Payment Records ({payments.length})
        </h2>

        {payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>
            <IndianRupee size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
            <p>No payments recorded yet</p>
          </div>
        ) : (
          <table className="data-table-standard">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 600, color: "#F45325" }}>?{payment.amount.toLocaleString()}</td>
                  <td><span className="status-badge">{payment.payment_mode}</span></td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{payment.reference_number || "-"}</td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {payment.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};