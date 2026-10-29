import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  IndianRupee, Eye, Plus, RefreshCw, Loader2,
  CheckCircle, Search, ChevronLeft, ChevronRight, X,
  Building2, Truck, ArrowDownLeft, ArrowUpRight, ShieldCheck,
  CheckCircle2, Clock, AlertCircle, FileText
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, ensureAdminSession } from "../../utils/supabase";
import { useToast } from "../../context/ToastContext";

interface Booking {
  id: string;
  booking_reference: string;
  client_company_name: string;
  grand_total: number;
  amount_received: number;
  balance_due: number;
  payment_status: "PAYMENT_PENDING" | "PARTIALLY_PAID" | "PAID" | "NOT_DUE" | "UNPAID" | string;
  completed_at?: string;
  days_overdue?: number;
}

interface VendorSettlement {
  id: string;
  trip_id: string;
  booking_code: string;
  booking_id?: string;
  vendor_id: string;
  vendor_name: string;
  pan?: string;
  agreed_rate: number;
  advance_paid: number;
  tds_rate_percent: number;
  tds_amount: number;
  other_deductions: number;
  net_payable: number;
  disbursed_amount: number;
  settlement_status: "PENDING" | "ADVANCE_PAID" | "POD_CLEARED" | "DISBURSED";
  pod_approved: boolean;
  bank_reference_utr?: string;
  payment_mode?: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 15;

export const PaymentsModule: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appToast = useToast();

  // Active Tab: "client" (Inbound Collections) or "vendor" (Outbound Settlements)
  const currentTab = searchParams.get("tab") === "vendor" ? "vendor" : "client";

  const handleTabSwitch = (newTab: "client" | "vendor") => {
    setSearchParams({ tab: newTab });
    setPage(1);
    setSearch("");
  };

  // -------------------------------------------------------------
  // CLIENT PAYMENTS STATE
  // -------------------------------------------------------------
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientKpis, setClientKpis] = useState({ outstanding: 0, overdue: 0, partiallyPaid: 0, paidThisMonth: 0 });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clientStatusFilter, setClientStatusFilter] = useState<"ALL" | "PAYMENT_PENDING" | "PARTIALLY_PAID" | "PAID">("ALL");
  const [paymentForm, setPaymentForm] = useState({
    amount: "", date: new Date().toISOString().split("T")[0], mode: "NEFT", reference: "", notes: ""
  });
  const [savingPayment, setSavingPayment] = useState(false);

  // -------------------------------------------------------------
  // VENDOR SETTLEMENTS STATE
  // -------------------------------------------------------------
  const [vendorSettlements, setVendorSettlements] = useState<VendorSettlement[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorKpis, setVendorKpis] = useState({ totalPayables: 0, advancesPaid: 0, balanceDue: 0, settledAmount: 0 });
  const [selectedSettlement, setSelectedSettlement] = useState<VendorSettlement | null>(null);
  const [showDisbursalModal, setShowDisbursalModal] = useState(false);
  const [vendorStatusFilter, setVendorStatusFilter] = useState<"ALL" | "PENDING" | "ADVANCE_PAID" | "POD_CLEARED" | "DISBURSED">("ALL");
  const [disbursalForm, setDisbursalForm] = useState({
    amount: "",
    disbursalType: "ADVANCE" as "ADVANCE" | "BALANCE_SETTLEMENT",
    date: new Date().toISOString().split("T")[0],
    mode: "NEFT",
    utr: "",
    notes: ""
  });
  const [savingDisbursal, setSavingDisbursal] = useState(false);
  const [showConfirmDisbursalModal, setShowConfirmDisbursalModal] = useState(false);

  // Common UI State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // -------------------------------------------------------------
  // CLIENT PAYMENTS LOGIC
  // -------------------------------------------------------------
  const fetchClientKpis = useCallback(async () => {
    try {
      await ensureAdminSession();
      const { data: allBookings, error } = await supabase
        .from("bookings")
        .select("grand_total, total_amount, amount_received, payment_status, accepted_quote_id, client_quotes(total_client_amount)");

      if (!allBookings || error) return;

      let outstanding = 0;
      let partiallyPaid = 0;
      let paidThisMonth = 0;

      for (const b of allBookings) {
        const quoteAmt = (b.client_quotes as any)?.total_client_amount;
        const total = Number(b.grand_total || b.total_amount || quoteAmt || 0);
        const received = Number(b.amount_received || 0);
        const balance = Math.max(0, total - received);
        const st = (b.payment_status || "PAYMENT_PENDING").toUpperCase();

        if (st === "PAID") {
          paidThisMonth += received;
        } else if (st === "PARTIALLY_PAID") {
          partiallyPaid += balance;
          outstanding += balance;
        } else {
          outstanding += balance;
        }
      }

      setClientKpis({ outstanding, overdue: 0, partiallyPaid, paidThisMonth });
    } catch (err) {
      console.error("fetchClientKpis error:", err);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setClientLoading(true);
    try {
      await ensureAdminSession();

      let q = supabase
        .from("bookings")
        .select("*, client_companies(id, company_name), client_quotes(id, total_client_amount)")
        .order("confirmed_at", { ascending: false });

      if (clientStatusFilter !== "ALL") {
        if (clientStatusFilter === "PAYMENT_PENDING") {
          q = q.in("payment_status", ["PAYMENT_PENDING", "NOT_DUE", "UNPAID"]);
        } else {
          q = q.eq("payment_status", clientStatusFilter);
        }
      }

      const { data, error } = await q;
      if (error) {
        console.error("Error fetching bookings for payments:", error);
      }
      if (data) {
        setBookings(data.map(b => {
          const quoteAmt = (b.client_quotes as any)?.total_client_amount;
          const total = Number(b.grand_total || b.total_amount || quoteAmt || 0);
          const received = Number(b.amount_received || 0);
          const compName = (b.client_companies as any)?.company_name || b.client_company_name || "Enterprise Client";
          const ref = b.booking_code || b.booking_reference || (b.id ? `BOK-${b.id.substring(0, 8)}` : "BOK-0000");

          return {
            ...b,
            booking_reference: ref,
            client_company_name: compName,
            grand_total: total,
            amount_received: received,
            balance_due: Math.max(0, total - received),
            payment_status: b.payment_status || (received >= total && total > 0 ? "PAID" : received > 0 ? "PARTIALLY_PAID" : "PAYMENT_PENDING"),
          };
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClientLoading(false);
    }
  }, [clientStatusFilter]);

  const handleRecordPayment = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { appToast.error("Enter a valid payment amount"); return; }
    if (!paymentForm.date) { appToast.error("Payment date is required"); return; }
    setSavingPayment(true);
    try {
      await ensureAdminSession();
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
      const targetGrandTotal = selectedBooking.grand_total > 0 ? selectedBooking.grand_total : newReceived;
      const newStatus = newReceived >= targetGrandTotal ? "PAID" : "PARTIALLY_PAID";
      await supabase.from("bookings").update({
        grand_total: targetGrandTotal,
        amount_received: newReceived,
        payment_status: newStatus
      }).eq("id", selectedBooking.id);

      appToast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      setPaymentForm({ amount: "", date: new Date().toISOString().split("T")[0], mode: "NEFT", reference: "", notes: "" });
      fetchClientKpis();
      fetchBookings();
    } catch (err: any) {
      appToast.error(err.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  // -------------------------------------------------------------
  // VENDOR SETTLEMENTS LOGIC
  // -------------------------------------------------------------
  const fetchVendorSettlements = useCallback(async () => {
    setVendorLoading(true);
    try {
      await ensureAdminSession();

      const { data: tripsData, error } = await supabase
        .from("trips")
        .select(`
          id, booking_id, vendor_id, vendor_rate, trip_status,
          created_at, pod_approved,
          bookings(id, booking_code),
          vendor_companies(id, vendor_name, pan, gstin)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching trips for vendor settlements:", error);
      }

      if (tripsData) {
        let totalPay = 0;
        let advances = 0;
        let balDue = 0;
        let settled = 0;

        const settlements: VendorSettlement[] = tripsData.map(t => {
          const rate = Number(t.vendor_rate || 0);
          const pan = (t.vendor_companies as any)?.pan || "";
          const isIndividual = pan && pan.length >= 4 && pan[3].toUpperCase() === "P";
          const tdsPercent = isIndividual ? 1.0 : 2.0;
          const tdsAmt = Math.round((rate * (tdsPercent / 100)) * 100) / 100;
          const deductions = 0;
          const net = Math.max(0, Math.round((rate - tdsAmt - deductions) * 100) / 100);

          const isPodDone = Boolean(t.pod_approved || t.trip_status === "COMPLETED");
          const isDelivered = t.trip_status === "DELIVERED" || isPodDone;

          let status: VendorSettlement["settlement_status"] = "PENDING";
          let adv = 0;
          let disbursed = 0;

          if (isPodDone) {
            status = "POD_CLEARED";
            adv = Math.round(rate * 0.7);
            disbursed = adv;
          } else if (isDelivered) {
            status = "ADVANCE_PAID";
            adv = Math.round(rate * 0.7);
            disbursed = adv;
          } else if (t.trip_status === "IN_TRANSIT" || t.trip_status === "AT_LOADING") {
            status = "ADVANCE_PAID";
            adv = Math.round(rate * 0.7);
            disbursed = adv;
          }

          const vendorName = (t.vendor_companies as any)?.vendor_name || "Transporter Partner";
          const bookingCode = (t.bookings as any)?.booking_code || t.booking_id || "TRP-0000";

          totalPay += rate;
          advances += adv;
          if ((status as string) === "DISBURSED") {
            settled += net;
          } else {
            balDue += Math.max(0, net - disbursed);
          }

          return {
            id: t.id,
            trip_id: t.id,
            booking_code: bookingCode,
            vendor_id: t.vendor_id || "",
            vendor_name: vendorName,
            pan,
            agreed_rate: rate,
            advance_paid: adv,
            tds_rate_percent: tdsPercent,
            tds_amount: tdsAmt,
            other_deductions: deductions,
            net_payable: net,
            disbursed_amount: disbursed,
            settlement_status: status,
            pod_approved: Boolean(t.pod_approved),
            created_at: t.created_at || new Date().toISOString(),
          };
        });

        setVendorSettlements(settlements);
        setVendorKpis({
          totalPayables: totalPay,
          advancesPaid: advances,
          balanceDue: balDue,
          settledAmount: settled,
        });
      }
    } catch (err) {
      console.error("fetchVendorSettlements error:", err);
    } finally {
      setVendorLoading(false);
    }
  }, []);

  const handleRecordDisbursal = async () => {
    if (!selectedSettlement) return;
    const amount = parseFloat(disbursalForm.amount);
    const balancePending = Math.max(0, selectedSettlement.net_payable - selectedSettlement.disbursed_amount);

    if (!amount || amount <= 0) {
      appToast.error("Please enter a valid disbursal amount");
      return;
    }
    if (amount > balancePending) {
      appToast.error(`Disbursal amount (₹${amount.toLocaleString("en-IN")}) cannot exceed the outstanding balance of ₹${balancePending.toLocaleString("en-IN")}`);
      return;
    }
    if (!disbursalForm.utr || !disbursalForm.utr.trim()) {
      appToast.error("Bank Reference / UTR Number is required for disbursal audit");
      return;
    }
    if (!disbursalForm.date) {
      appToast.error("Disbursal date is required");
      return;
    }

    setSavingDisbursal(true);
    try {
      await ensureAdminSession();

      // Local optimistic update
      setVendorSettlements(prev => prev.map(s => {
        if (s.id === selectedSettlement.id) {
          const newDisbursed = s.disbursed_amount + amount;
          const isFull = newDisbursed >= s.net_payable;
          return {
            ...s,
            disbursed_amount: newDisbursed,
            bank_reference_utr: disbursalForm.utr.trim().toUpperCase(),
            payment_mode: disbursalForm.mode,
            settlement_status: isFull ? "DISBURSED" : "ADVANCE_PAID",
          };
        }
        return s;
      }));

      // Database persistence: Record in payment_records linked to booking
      try {
        const { data: session } = await supabase.auth.getSession();
        const currentUserId = session?.session?.user?.id || '5fa0f865-0388-4779-99ad-03d8979c484a';
        if (selectedSettlement.booking_id || selectedSettlement.trip_id) {
          await supabase.from("payment_records").insert({
            booking_id: selectedSettlement.booking_id || selectedSettlement.trip_id,
            amount_collected: amount,
            payment_date: disbursalForm.date,
            payment_mode: disbursalForm.mode,
            transaction_reference: disbursalForm.utr.trim().toUpperCase(),
            recorded_by: currentUserId
          });
        }
      } catch (dbErr) {
        console.warn("Notice: payment_records persistence skipped or booking reference not found:", dbErr);
      }

      appToast.success(`Payout of ₹${amount.toLocaleString("en-IN")} recorded with UTR: ${disbursalForm.utr.trim().toUpperCase()}`);
      setShowConfirmDisbursalModal(false);
      setShowDisbursalModal(false);
      setDisbursalForm({
        amount: "",
        disbursalType: "ADVANCE",
        date: new Date().toISOString().split("T")[0],
        mode: "NEFT",
        utr: "",
        notes: "",
      });
    } catch (err: any) {
      appToast.error(err.message || "Failed to record transporter disbursal");
    } finally {
      setSavingDisbursal(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchClientKpis();
    fetchBookings();
    fetchVendorSettlements();
  }, [fetchClientKpis, fetchBookings, fetchVendorSettlements]);

  // Common Formatting
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  // -------------------------------------------------------------
  // FILTERED LISTS & PAGINATION
  // -------------------------------------------------------------
  const filteredBookings = useMemo(() => {
    return bookings.filter(b =>
      !search ||
      b.booking_reference?.toLowerCase().includes(search.toLowerCase()) ||
      b.client_company_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [bookings, search]);

  const filteredSettlements = useMemo(() => {
    return vendorSettlements.filter(s => {
      const matchSearch = !search ||
        s.booking_code.toLowerCase().includes(search.toLowerCase()) ||
        s.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        s.trip_id.toLowerCase().includes(search.toLowerCase()) ||
        (s.bank_reference_utr && s.bank_reference_utr.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = vendorStatusFilter === "ALL" || s.settlement_status === vendorStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [vendorSettlements, search, vendorStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(
    (currentTab === "client" ? filteredBookings.length : filteredSettlements.length) / ITEMS_PER_PAGE
  ));

  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredBookings, page]);

  const paginatedSettlements = useMemo(() => {
    return filteredSettlements.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filteredSettlements, page]);

  return (
    <div className="cli-dir-wrapper">
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">{currentTab === "client" ? "Client Management" : "Vendor Management"}</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">
          {currentTab === "client" ? "Client Payments" : "Vendor Payments & Settlements"}
        </span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            {currentTab === "client" ? "Client Payment Collection" : "Vendor Payments & Settlements"}
          </h1>
          <p className="page-subtitle">
            {currentTab === "client"
              ? "Inbound collections from shippers, invoice balances & account reconciliations"
              : "Outbound payouts to fleet owners, fuel advances, and POD final settlements"}
          </p>
        </div>
        <button
          className="btn-action-outline"
          onClick={() => {
            if (currentTab === "client") {
              fetchClientKpis();
              fetchBookings();
            } else {
              fetchVendorSettlements();
            }
          }}
        >
          <RefreshCw size={14} className={clientLoading || vendorLoading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Dual Tab Switcher */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
        <button
          onClick={() => handleTabSwitch("client")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: currentTab === "client" ? 700 : 500,
            cursor: "pointer",
            border: currentTab === "client" ? "1px solid #F05A22" : "1px solid #E2E8F0",
            background: currentTab === "client" ? "#FFF7ED" : "#FFFFFF",
            color: currentTab === "client" ? "#F05A22" : "#475569",
            transition: "all 0.15s ease",
          }}
        >
          <Building2 size={16} />
          <span>Inbound Client Collections</span>
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "10px",
            background: currentTab === "client" ? "#F05A22" : "#F1F5F9",
            color: currentTab === "client" ? "#FFFFFF" : "#64748B",
          }}>
            {bookings.length}
          </span>
        </button>

        <button
          onClick={() => handleTabSwitch("vendor")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: currentTab === "vendor" ? 700 : 500,
            cursor: "pointer",
            border: currentTab === "vendor" ? "1px solid #F05A22" : "1px solid #E2E8F0",
            background: currentTab === "vendor" ? "#FFF7ED" : "#FFFFFF",
            color: currentTab === "vendor" ? "#F05A22" : "#475569",
            transition: "all 0.15s ease",
          }}
        >
          <Truck size={16} />
          <span>Outbound Vendor Settlements</span>
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "10px",
            background: currentTab === "vendor" ? "#F05A22" : "#F1F5F9",
            color: currentTab === "vendor" ? "#FFFFFF" : "#64748B",
          }}>
            {vendorSettlements.length}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      {currentTab === "client" ? (
        <div className="client-kpi-bar">
          <div className="kpi-stat-card">
            <div className="kpi-avatar-squircle orange">
              <IndianRupee size={20} />
            </div>
            <div className="kpi-body">
              <div className="kpi-header-row">
                <span className="kpi-title">Total Outstanding</span>
              </div>
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(clientKpis.outstanding)}</div>
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
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(clientKpis.partiallyPaid)}</div>
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
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(clientKpis.paidThisMonth)}</div>
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
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(clientKpis.overdue)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="client-kpi-bar">
          <div className="kpi-stat-card">
            <div className="kpi-avatar-squircle orange">
              <IndianRupee size={20} />
            </div>
            <div className="kpi-body">
              <div className="kpi-header-row">
                <span className="kpi-title">Total Freight Payables</span>
              </div>
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(vendorKpis.totalPayables)}</div>
            </div>
          </div>
          <div className="kpi-stat-card">
            <div className="kpi-avatar-squircle amber">
              <ArrowUpRight size={20} />
            </div>
            <div className="kpi-body">
              <div className="kpi-header-row">
                <span className="kpi-title">Advances Disbursed</span>
              </div>
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(vendorKpis.advancesPaid)}</div>
            </div>
          </div>
          <div className="kpi-stat-card">
            <div className="kpi-avatar-squircle red">
              <Clock size={20} />
            </div>
            <div className="kpi-body">
              <div className="kpi-header-row">
                <span className="kpi-title">Balance Due Transporters</span>
              </div>
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(vendorKpis.balanceDue)}</div>
            </div>
          </div>
          <div className="kpi-stat-card">
            <div className="kpi-avatar-squircle green">
              <CheckCircle size={20} />
            </div>
            <div className="kpi-body">
              <div className="kpi-header-row">
                <span className="kpi-title">Fully Settled</span>
              </div>
              <div className="kpi-value" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(vendorKpis.settledAmount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className="filters-bar-card" style={{ marginBottom: "16px" }}>
        <div className="filter-input-wrap" style={{ flex: 1 }}>
          <Search size={16} className="filter-search-icon" />
          <input
            className="filter-text-input"
            type="text"
            placeholder={
              currentTab === "client"
                ? "Search by booking or client..."
                : "Search by booking code, transporter name, or UTR..."
            }
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {currentTab === "client" ? (
          <div className="status-tabs-group">
            {(["ALL", "PAYMENT_PENDING", "PARTIALLY_PAID", "PAID"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setClientStatusFilter(s); setPage(1); }}
                className={`status-tab-btn ${clientStatusFilter === s ? "active" : ""}`}
              >
                {s === "ALL" ? "All Bookings" : s === "PAYMENT_PENDING" ? "Unpaid / Pending" : s === "PARTIALLY_PAID" ? "Partial" : "Paid"}
              </button>
            ))}
          </div>
        ) : (
          <div className="status-tabs-group">
            {(["ALL", "PENDING", "ADVANCE_PAID", "POD_CLEARED", "DISBURSED"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setVendorStatusFilter(s); setPage(1); }}
                className={`status-tab-btn ${vendorStatusFilter === s ? "active" : ""}`}
              >
                {s === "ALL"
                  ? "All Settlements"
                  : s === "PENDING"
                  ? "Pending Advance"
                  : s === "ADVANCE_PAID"
                  ? "Advance Paid"
                  : s === "POD_CLEARED"
                  ? "POD Cleared"
                  : "Fully Disbursed"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CLIENT PAYMENTS TABLE */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "client" && (
        <>
          {clientLoading ? (
            <div className="table-empty-state" style={{ padding: "3rem" }}>
              <Loader2 size={36} color="#F05A22" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
              <p className="empty-state-text">Loading client payment records...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="table-empty-state" style={{ padding: "3rem" }}>
              <IndianRupee size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
              <h4 className="empty-state-heading">No payment records found</h4>
              <p className="empty-state-text">{search ? "No records match your search" : "No pending payments — all client accounts settled!"}</p>
            </div>
          ) : (
            <div className="client-table-card">
              <div className="table-wrapper">
                <table className="client-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Client Name</th>
                      <th style={{ textAlign: "right" }}>Total Billed</th>
                      <th style={{ textAlign: "right" }}>Received</th>
                      <th style={{ textAlign: "right" }}>Balance Due</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.map(booking => (
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
                          <span className={`status-badge-pastel ${
                            booking.payment_status === "PAID"
                              ? "active"
                              : booking.payment_status === "PARTIALLY_PAID"
                              ? "pending"
                              : "inactive"
                          }`}>
                            {booking.payment_status === "PAID"
                              ? "Paid"
                              : booking.payment_status === "PARTIALLY_PAID"
                              ? "Partial"
                              : "Unpaid"}
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
          )}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VENDOR SETTLEMENTS TABLE */}
      {/* ------------------------------------------------------------- */}
      {currentTab === "vendor" && (
        <>
          {vendorLoading ? (
            <div className="table-empty-state" style={{ padding: "3rem" }}>
              <Loader2 size={36} color="#F05A22" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
              <p className="empty-state-text">Loading vendor payout and settlement records...</p>
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="table-empty-state" style={{ padding: "3rem" }}>
              <Truck size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
              <h4 className="empty-state-heading">No vendor settlements found</h4>
              <p className="empty-state-text">{search ? "No records match your search" : "All transporter payouts and advances settled!"}</p>
            </div>
          ) : (
            <div className="client-table-card">
              <div className="table-wrapper">
                <table className="client-table">
                  <thead>
                    <tr>
                      <th>Trip / Booking</th>
                      <th>Transporter / Vendor</th>
                      <th style={{ textAlign: "right" }}>Freight Rate</th>
                      <th style={{ textAlign: "right" }}>Advance Paid</th>
                      <th style={{ textAlign: "right" }}>TDS & Deductions</th>
                      <th style={{ textAlign: "right" }}>Net Payable</th>
                      <th>Settlement Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSettlements.map(settlement => (
                      <tr key={settlement.id} className="client-data-row">
                        <td>
                          <div>
                            <span className="mono-code" style={{ color: "#F05A22", fontWeight: 700 }}>
                              {settlement.booking_code}
                            </span>
                            <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                              TRP-{settlement.trip_id.substring(0, 8)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className="client-name-bold">{settlement.vendor_name}</span>
                            {settlement.pan && (
                              <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>
                                PAN: {settlement.pan}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#172B4D", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(settlement.agreed_rate)}
                        </td>
                        <td style={{ textAlign: "right", color: "#3B82F6", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(settlement.advance_paid)}
                        </td>
                        <td style={{ textAlign: "right", color: "#DC2626", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(settlement.tds_amount)}
                          <span style={{ fontSize: "10.5px", color: "#64748B", marginLeft: "4px" }}>
                            ({settlement.tds_rate_percent}%)
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "#059669", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(settlement.net_payable)}
                        </td>
                        <td>
                          <span className={`status-badge-pastel ${
                            settlement.settlement_status === "DISBURSED"
                              ? "active"
                              : settlement.settlement_status === "POD_CLEARED"
                              ? "pending"
                              : "inactive"
                          }`}>
                            {settlement.settlement_status === "DISBURSED"
                              ? "Disbursed"
                              : settlement.settlement_status === "POD_CLEARED"
                              ? "POD Cleared"
                              : settlement.settlement_status === "ADVANCE_PAID"
                              ? "Advance Paid"
                              : "Pending Advance"}
                          </span>
                          {settlement.bank_reference_utr && (
                            <div style={{ fontSize: "10.5px", color: "#64748B", fontFamily: "monospace", marginTop: "3px" }}>
                              UTR: {settlement.bank_reference_utr}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                setSelectedSettlement(settlement);
                                const balancePending = Math.max(0, settlement.net_payable - settlement.disbursed_amount);
                                setDisbursalForm(f => ({
                                  ...f,
                                  amount: balancePending > 0 ? String(balancePending) : String(settlement.advance_paid),
                                  disbursalType: settlement.pod_approved ? "BALANCE_SETTLEMENT" : "ADVANCE",
                                }));
                                setShowDisbursalModal(true);
                              }}
                              className="btn-create-orange"
                              style={{ padding: "6px 14px", fontSize: "12.5px" }}
                            >
                              <ArrowUpRight size={13} />
                              <span>Disburse</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="pagination-bar" style={{ marginTop: "16px" }}>
          <span className="pagination-info">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(
              page * ITEMS_PER_PAGE,
              currentTab === "client" ? filteredBookings.length : filteredSettlements.length
            )} of {currentTab === "client" ? filteredBookings.length : filteredSettlements.length}
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

      {/* ------------------------------------------------------------- */}
      {/* RECORD CLIENT PAYMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {showPaymentModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">Record Client Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
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
              <button className="btn-create-gold" onClick={handleRecordPayment} disabled={savingPayment || !paymentForm.amount}>
                {savingPayment ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RECORD TRANSPORTER DISBURSAL MODAL */}
      {/* ------------------------------------------------------------- */}
      {showDisbursalModal && selectedSettlement && (() => {
        const balancePending = Math.max(0, selectedSettlement.net_payable - (selectedSettlement.disbursed_amount || 0));
        const enteredAmount = parseFloat(disbursalForm.amount) || 0;
        const isOverpaying = enteredAmount > balancePending;

        return (
          <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: "600px", padding: "0", overflow: "hidden" }}>
              <div className="modal-header" style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(244, 83, 37, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Truck size={20} color="#F45325" />
                  </div>
                  <div>
                    <h2 className="modal-title" style={{ fontSize: "17px", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                      Record Transporter Disbursal
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                      Log advance or final settlement payouts linked to transporter trip settlement
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisbursalModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: "20px 24px", maxHeight: "calc(88vh - 140px)", overflowY: "auto" }}>
                {/* Structured Financial Summary Card */}
                <div style={{
                  background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  color: "#FFFFFF",
                  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.15)",
                  marginBottom: "18px",
                  border: "1px solid rgba(255, 255, 255, 0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "10px" }}>
                    <div>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", fontWeight: 600 }}>Transporter / Vendor</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#FFFFFF", marginTop: "2px" }}>
                        {selectedSettlement.vendor_name}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", fontWeight: 600 }}>Trip Reference</div>
                      <span style={{
                        display: "inline-block",
                        marginTop: "4px",
                        background: "rgba(255, 255, 255, 0.1)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        fontFamily: "monospace",
                        color: "#F8FAFC",
                        border: "1px solid rgba(255, 255, 255, 0.15)"
                      }}>
                        {selectedSettlement.booking_code}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>Agreed Freight</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{fmt(selectedSettlement.agreed_rate)}</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>TDS ({selectedSettlement.tds_rate_percent}%)</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#F87171" }}>-{fmt(selectedSettlement.tds_amount)}</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>Disbursed</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#38BDF8" }}>{fmt(selectedSettlement.disbursed_amount || 0)}</div>
                    </div>
                    <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                      <div style={{ fontSize: "11px", color: "#6EE7B7", marginBottom: "4px" }}>Outstanding</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#34D399" }}>{fmt(balancePending)}</div>
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                {balancePending > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Quick Fill:</span>
                    <button
                      type="button"
                      onClick={() => setDisbursalForm(f => ({
                        ...f,
                        amount: balancePending.toString(),
                        disbursalType: selectedSettlement.disbursed_amount > 0 ? "BALANCE_SETTLEMENT" : "ADVANCE"
                      }))}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        cursor: "pointer",
                        color: "#0F172A",
                        transition: "all 0.15s ease"
                      }}
                    >
                      Full Balance ({fmt(balancePending)})
                    </button>
                    {selectedSettlement.disbursed_amount === 0 && (
                      <button
                        type="button"
                        onClick={() => setDisbursalForm(f => ({
                          ...f,
                          amount: Math.min(balancePending, Math.round(selectedSettlement.net_payable * 0.7)).toString(),
                          disbursalType: "ADVANCE"
                        }))}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          cursor: "pointer",
                          color: "#1D4ED8",
                          transition: "all 0.15s ease"
                        }}
                      >
                        70% Advance ({fmt(Math.min(balancePending, Math.round(selectedSettlement.net_payable * 0.7)))})
                      </button>
                    )}
                  </div>
                )}

                {/* Form Fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Disbursal Type *</label>
                    <select
                      className="form-select"
                      value={disbursalForm.disbursalType}
                      onChange={e => setDisbursalForm(f => ({ ...f, disbursalType: e.target.value as any }))}
                      style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #CBD5E1", padding: "0 12px" }}
                    >
                      <option value="ADVANCE">Advance Payout (70% Fuel & Loading)</option>
                      <option value="BALANCE_SETTLEMENT">Final POD Balance Settlement</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Disbursal Amount (₹) *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder={`Max: ${fmt(balancePending)}`}
                      value={disbursalForm.amount}
                      onChange={e => setDisbursalForm(f => ({ ...f, amount: e.target.value }))}
                      style={{
                        width: "100%",
                        height: "40px",
                        borderRadius: "8px",
                        border: isOverpaying ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                        padding: "0 12px",
                        fontWeight: 600
                      }}
                    />
                    {isOverpaying && (
                      <div style={{ color: "#EF4444", fontSize: "12px", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertCircle size={13} />
                        Amount exceeds outstanding balance ({fmt(balancePending)})
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Payment Method *</label>
                    <select
                      className="form-select"
                      value={disbursalForm.mode}
                      onChange={e => setDisbursalForm(f => ({ ...f, mode: e.target.value }))}
                      style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #CBD5E1", padding: "0 12px" }}
                    >
                      {["NEFT", "RTGS", "IMPS", "UPI"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Bank Reference UTR / Transaction ID *</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. UTR20261029NEFT8834"
                      value={disbursalForm.utr}
                      onChange={e => setDisbursalForm(f => ({ ...f, utr: e.target.value.toUpperCase() }))}
                      style={{
                        width: "100%",
                        height: "40px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        padding: "0 12px",
                        fontFamily: "monospace",
                        textTransform: "uppercase"
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Disbursal Date *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={disbursalForm.date}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => setDisbursalForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid #CBD5E1", padding: "0 12px" }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>Disbursal Notes / Remarks</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. Disbursed directly to transporter ICICI bank account..."
                    value={disbursalForm.notes}
                    onChange={e => setDisbursalForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ width: "100%", borderRadius: "8px", border: "1px solid #CBD5E1", padding: "10px 12px" }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowDisbursalModal(false)}
                  style={{ padding: "9px 18px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", color: "#475569" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-create-gold"
                  onClick={() => {
                    const amt = parseFloat(disbursalForm.amount);
                    if (!amt || amt <= 0) {
                      appToast.error("Please enter a valid disbursal amount");
                      return;
                    }
                    if (amt > balancePending) {
                      appToast.error(`Disbursal amount (${fmt(amt)}) exceeds outstanding balance of ${fmt(balancePending)}`);
                      return;
                    }
                    if (!disbursalForm.utr.trim()) {
                      appToast.error("Bank Reference / UTR Number is required");
                      return;
                    }
                    if (!disbursalForm.date) {
                      appToast.error("Disbursal date is required");
                      return;
                    }
                    setShowConfirmDisbursalModal(true);
                  }}
                  disabled={savingDisbursal || !disbursalForm.amount || !disbursalForm.utr || isOverpaying}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: (savingDisbursal || !disbursalForm.amount || !disbursalForm.utr || isOverpaying) ? "not-allowed" : "pointer",
                    opacity: (savingDisbursal || !disbursalForm.amount || !disbursalForm.utr || isOverpaying) ? 0.6 : 1
                  }}
                >
                  Review & Confirm Disbursal
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Dialog Before Disbursal Submission */}
      {showConfirmDisbursalModal && selectedSettlement && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: "440px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Confirm Bank Disbursal</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>Please verify the payout transaction details</p>
              </div>
            </div>

            <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "14px 16px", border: "1px solid #E2E8F0", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748B" }}>Beneficiary Transporter</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{selectedSettlement.vendor_name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748B" }}>Trip Reference</span>
                <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: "monospace", color: "#334155" }}>{selectedSettlement.booking_code}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748B" }}>Payment Method</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>{disbursalForm.mode}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748B" }}>Bank Reference UTR</span>
                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "#1E293B" }}>{disbursalForm.utr.trim().toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #CBD5E1", paddingTop: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>Disbursal Amount</span>
                <span style={{ fontSize: "17px", fontWeight: 800, color: "#059669" }}>
                  {fmt(parseFloat(disbursalForm.amount) || 0)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowConfirmDisbursalModal(false)}
                disabled={savingDisbursal}
                style={{ padding: "8px 16px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", color: "#475569" }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-create-gold"
                onClick={handleRecordDisbursal}
                disabled={savingDisbursal}
                style={{ padding: "8px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                {savingDisbursal ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  "Authorize & Disburse"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
