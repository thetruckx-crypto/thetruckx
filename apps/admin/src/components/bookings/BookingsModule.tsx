import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search, Plus, Eye, Edit2, MoreVertical, ChevronLeft, ChevronRight,
  Download, Upload, Filter, X, CheckCircle, AlertCircle, Package,
  TruckIcon, Calendar, MapPin, DollarSign, RefreshCw, ArrowUpDown,
  Clock, Users, FileText, Navigation
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { formatDisplayId } from "../../utils/idGenerator";

export interface Booking {
  id: string;
  requirement_id: string;
  client_id: string;
  booking_status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  payment_status: string;
  created_at: string;
  updated_at: string;
  // Enriched fields
  booking_reference?: string;
  client_company_name?: string;
  route_summary?: string;
  trip_count?: number;
  origin?: string;
  destination?: string;
}

interface BookingsModuleProps {
  onNavigateToDetail: (bookingId: string) => void;
  onNavigateToCreateFromQuote?: (quoteId: string) => void;
}

const ITEMS_PER_PAGE = 10;

function formatBookingReference(id: string, createdAt: string) {
  if (!id) return formatDisplayId("BK", null, createdAt);
  if (id.startsWith("NECL-BK-")) return id;
  return formatDisplayId("BK", id, createdAt);
}

function getStatusColor(status: string) {
  switch (status) {
    case "CONFIRMED":
      return { bg: "#DBEAFE", text: "#1D4ED8", label: "Confirmed" };
    case "IN_PROGRESS":
      return { bg: "#EDE9FE", text: "#6D28D9", label: "In Progress" };
    case "COMPLETED":
      return { bg: "#D1FAE5", text: "#047857", label: "Completed" };
    case "CANCELLED":
      return { bg: "#FEE2E2", text: "#B91C1C", label: "Cancelled" };
    default:
      return { bg: "#F1F5F9", text: "#64748B", label: status };
  }
}

function getPaymentStatusColor(status: string) {
  switch (status) {
    case "PAYMENT_PENDING":
      return { bg: "#FEF3C7", text: "#B45309", label: "Pending" };
    case "PARTIALLY_PAID":
      return { bg: "#E0E7FF", text: "#4338CA", label: "Partial" };
    case "PAID":
      return { bg: "#D1FAE5", text: "#047857", label: "Paid" };
    case "NOT_DUE":
      return { bg: "#F1F5F9", text: "#64748B", label: "Not Due" };
    default:
      return { bg: "#F1F5F9", text: "#64748B", label: status };
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
  const [page, setPage] = useState(1);

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

  // Trip Assignment State
  const [showAssignTrip, setShowAssignTrip] = useState(false);
  const [assignVendors, setAssignVendors] = useState<any[]>([]);
  const [assignVehicles, setAssignVehicles] = useState<any[]>([]);
  const [assignDrivers, setAssignDrivers] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [tripRate, setTripRate] = useState("");

  // Fetch real statistics from connected database
  const fetchRealStats = useCallback(async () => {
    try {
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
      // 1. Fetch bookings
      let query = supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

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

      // 4. Fetch trip counts per booking
      const { data: trips } = await supabase
        .from("trips")
        .select("id, booking_id")
        .in("booking_id", bookingIds);

      const tripCountMap = new Map<string, number>();
      (trips || []).forEach(t => {
        const count = tripCountMap.get(t.booking_id) || 0;
        tripCountMap.set(t.booking_id, count + 1);
      });

      // Assemble enriched bookings
      const enrichedBookings: Booking[] = bookingsData.map(b => {
        const client = clientMap.get(b.client_id);
        const requirement = requirementMap.get(b.requirement_id);
        const tripCount = tripCountMap.get(b.id) || 0;

        // Build route summary
        const origin = requirement?.pickup_address || "Origin";
        const destination = requirement?.destination_address || "Destination";
        const routeSummary = `${origin.substring(0, 25)}... → ${destination.substring(0, 25)}...`;

        return {
          id: b.id,
          requirement_id: b.requirement_id,
          client_id: b.client_id,
          booking_status: b.booking_status,
          payment_status: b.payment_status || "PAYMENT_PENDING",
          created_at: b.created_at,
          updated_at: b.updated_at,
          booking_reference: formatBookingReference(b.id, b.created_at),
          client_company_name: client?.company_name || "Unknown Client",
          route_summary: routeSummary,
          trip_count: tripCount,
          origin,
          destination
        };
      });

      // Apply search filter
      let filtered = enrichedBookings;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(b =>
          b.booking_reference?.toLowerCase().includes(q) ||
          b.client_company_name?.toLowerCase().includes(q) ||
          b.route_summary?.toLowerCase().includes(q)
        );
      }

      setBookings(filtered);
      setSelectedBookingId((prev) => prev || (filtered[0]?.id ?? null));
    } catch (err: any) {
      console.warn("Database query error:", err);
      setError(null);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

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

  // Tab filtering
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (activeTab === "ALL") return true;
      return b.booking_status === activeTab;
    });
  }, [bookings, activeTab]);

  // Pagination calculation
  const totalCount = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const paginatedBookings = useMemo(() => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredBookings, page]);

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
    try {
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

      // Pre-fetch vendors, vehicles, and drivers for trip assignment
      const [allVen, allVeh, allDrv] = await Promise.all([
        supabase.from("vendor_companies").select("id, vendor_name").eq("status", "APPROVED"),
        supabase.from("vehicles").select("id, vendor_id, registration_number, vehicle_type"),
        supabase.from("drivers").select("id, primary_vendor_id, full_name, mobile").eq("status", "APPROVED"),
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

    setUpdatingStatus(true);
    try {
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

      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => {}}>Operations</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Bookings</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Bookings & Multi-Trip Operations</h1>
          <p className="page-subtitle">
            Manage confirmed bookings, assign vehicles and drivers to trips, and track multi-trip operations.
          </p>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="bookings-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "#FFFFFF" }}>
            <Package size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Total Bookings</div>
            <div className="kpi-stat-value">{dbKpis.total}</div>
            <div className="kpi-stat-trend positive">
              <span>Live Database Count</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <CheckCircle size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Confirmed</div>
            <div className="kpi-stat-value">{dbKpis.confirmed}</div>
            <div className="kpi-stat-trend">
              <span>Ready for dispatch</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <TruckIcon size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">In Progress</div>
            <div className="kpi-stat-value">{dbKpis.inProgress}</div>
            <div className="kpi-stat-trend">
              <span>Active operations</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <FileText size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Completed</div>
            <div className="kpi-stat-value">{dbKpis.completed}</div>
            <div className="kpi-stat-trend positive">
              <span>Delivered & closed</span>
            </div>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <X size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Cancelled</div>
            <div className="kpi-stat-value">{dbKpis.cancelled}</div>
            <div className="kpi-stat-trend negative">
              <span>Cancelled bookings</span>
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
            placeholder="Search by booking ID, client name, route..."
            className="booking-search-input"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            id="booking-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
        >
          <option value="ALL">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Refresh from Database */}
        <button
          className="btn-filter-more"
          onClick={() => {
            fetchRealStats();
            fetchRealBookings();
            setToastMessage("Synchronized booking data from database.");
            setTimeout(() => setToastMessage(null), 2500);
          }}
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
            setActiveTab("ALL");
            setPage(1);
          }}
        >
          Reset
        </button>
      </div>

      {/* Sub-bar with Dynamic Database Counts */}
      <div className="table-sub-bar">
        <div className="status-tabs-list">
          <button
            className={`status-tab-btn ${activeTab === "ALL" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("ALL"); setPage(1); }}
          >
            All ({dbKpis.total})
          </button>
          <button
            className={`status-tab-btn ${activeTab === "CONFIRMED" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("CONFIRMED"); setPage(1); }}
          >
            Confirmed ({dbKpis.confirmed})
          </button>
          <button
            className={`status-tab-btn ${activeTab === "IN_PROGRESS" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("IN_PROGRESS"); setPage(1); }}
          >
            In Progress ({dbKpis.inProgress})
          </button>
          <button
            className={`status-tab-btn ${activeTab === "COMPLETED" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("COMPLETED"); setPage(1); }}
          >
            Completed ({dbKpis.completed})
          </button>
          <button
            className={`status-tab-btn ${activeTab === "CANCELLED" ? "active-tab" : ""}`}
            onClick={() => { setActiveTab("CANCELLED"); setPage(1); }}
          >
            Cancelled ({dbKpis.cancelled})
          </button>
        </div>

        <div className="sub-bar-actions">
          <button className="btn-sub-action" onClick={handleExportCSV}>
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bookings-table-card">
        <table className="bookings-table">
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
              <th>
                <div className="th-sortable">
                  <span>Booking Reference</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Client Company</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Route Summary</span>
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Trips</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Booking Status</span>
                  <ArrowUpDown size={12} color="#94A3B8" />
                </div>
              </th>
              <th>
                <div className="th-sortable">
                  <span>Payment Status</span>
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
            ) : paginatedBookings.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <Package size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
                  <h3 style={{ color: "#111111", margin: "0 0 6px" }}>No bookings found in database</h3>
                  <p style={{ color: "#64748B", margin: 0, fontSize: 13 }}>
                    {searchQuery
                      ? "No records matched your search query in the connected database."
                      : "Bookings will appear here once clients accept quotes and bookings are created."}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedBookings.map(booking => {
                const isSelected = selectedBookingId === booking.id;
                const statusStyle = getStatusColor(booking.booking_status);
                const paymentStyle = getPaymentStatusColor(booking.payment_status);

                return (
                  <tr
                    key={booking.id}
                    className={`booking-row ${isSelected ? "row-selected" : ""}`}
                    onClick={() => {
                      setSelectedBookingId(booking.id);
                      openBookingDetail(booking);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Checkbox */}
                    <td onClick={e => e.stopPropagation()} style={{ paddingLeft: 18 }}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={selectedRows.has(booking.id)}
                        onChange={() => handleSelectRow(booking.id)}
                      />
                    </td>

                    {/* Booking Reference */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #F45325 0%, #F45325 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          <Package size={18} color="#FFF" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#111111", fontSize: 14 }}>
                            {booking.booking_reference}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B" }}>
                            {new Date(booking.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Client Company */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={14} color="#64748B" />
                        <span style={{ fontWeight: 500, color: "#111111" }}>
                          {booking.client_company_name}
                        </span>
                      </div>
                    </td>

                    {/* Route Summary */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <Navigation size={12} color="#64748B" />
                        <span style={{ color: "#475569" }}>{booking.route_summary}</span>
                      </div>
                    </td>

                    {/* Trip Count */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <TruckIcon size={14} color="#64748B" />
                        <span style={{ fontWeight: 600, color: "#111111" }}>
                          {booking.trip_count || 0}
                        </span>
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>
                          {booking.trip_count === 1 ? "trip" : "trips"}
                        </span>
                      </div>
                    </td>

                    {/* Booking Status */}
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: statusStyle.bg,
                          color: statusStyle.text
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: paymentStyle.bg,
                          color: paymentStyle.text
                        }}
                      >
                        <DollarSign size={12} />
                        {paymentStyle.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          className="btn-icon-table"
                          onClick={() => openBookingDetail(booking)}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn-icon-table"
                          onClick={() => setOpenActionMenuId(openActionMenuId === booking.id ? null : booking.id)}
                          title="More Actions"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
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
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} bookings
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-current">
                Page {page} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </button>
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
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseDetail}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
