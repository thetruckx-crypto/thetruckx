import React, { useState, useEffect, useCallback } from "react";
import {
  Search, AlertTriangle, CheckCircle, TruckIcon, RefreshCw, Navigation,
  Loader2, ChevronLeft, ChevronRight, Eye
} from "lucide-react";
import { supabase } from "../../utils/supabase";

export interface Trip {
  id: string;
  booking_id: string;
  vehicle_id: string;
  driver_id: string;
  trip_status: string;
  created_at: string;
  updated_at: string;
  trip_reference?: string;
  booking_reference?: string;
  vehicle_registration?: string;
  driver_name?: string;
  has_active_exception?: boolean;
}

interface TrackingModuleProps {
  onNavigateToTripDetail?: (tripId: string) => void;
}

const ITEMS_PER_PAGE = 10;

function formatTripReference(id: string, createdAt: string, sequence?: number) {
  if (!id) return "TRP-001";
  if (id.startsWith("TRP-")) return id;
  const seq = sequence || parseInt(id.replace(/\D/g, "")) || 1;
  return `TRP-${String(seq).padStart(3, "0")}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "LORRY_ASSIGNED":
      return { bg: "#DBEAFE", text: "#1D4ED8", label: "Lorry Assigned" };
    case "AT_LOADING":
      return { bg: "#FEF3C7", text: "#B45309", label: "At Loading" };
    case "IN_TRANSIT":
      return { bg: "#DBEAFE", text: "#1D4ED8", label: "In Transit" };
    case "AT_UNLOADING":
      return { bg: "#EDE9FE", text: "#6D28D9", label: "At Unloading" };
    case "DELIVERED":
      return { bg: "#D1FAE5", text: "#047857", label: "Delivered" };
    case "COMPLETED":
      return { bg: "#D1FAE5", text: "#047857", label: "Completed" };
    case "CLEARED_FOR_DISPATCH":
      return { bg: "#E0E7FF", text: "#4338CA", label: "Cleared" };
    case "PENDING_UNLOADING":
      return { bg: "#FEF3C7", text: "#B45309", label: "Pending Unloading" };
    default:
      return { bg: "#F1F5F9", text: "#475569", label: status };
  }
}

export const TrackingModule: React.FC<TrackingModuleProps> = ({
  onNavigateToTripDetail
}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ cleared: 0, inTransit: 0, pendingUnloading: 0, delivered: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [allRes, transitRes, unloadingRes, deliveredRes] = await Promise.all([
        supabase.from("trips").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("id", { count: "exact", head: true }).in("trip_status", ["IN_TRANSIT", "LORRY_ASSIGNED", "AT_LOADING"]),
        supabase.from("trips").select("id", { count: "exact", head: true }).in("trip_status", ["AT_UNLOADING", "PENDING_UNLOADING"]),
        supabase.from("trips").select("id", { count: "exact", head: true }).in("trip_status", ["DELIVERED", "COMPLETED"])
      ]);
      setCounts({
        cleared: allRes.count || 0,
        inTransit: transitRes.count || 0,
        pendingUnloading: unloadingRes.count || 0,
        delivered: deliveredRes.count || 0
      });
    } catch (err: any) {
      console.error("Error fetching trip counts:", err.message);
    }
  }, []);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("trips").select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") query = query.eq("trip_status", statusFilter);

      const { data: tripsData, error: tErr } = await query;
      if (tErr) throw tErr;

      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        return;
      }

      const bookingIds = [...new Set(tripsData.map(t => t.booking_id))];
      const vehicleIds = [...new Set(tripsData.map(t => t.vehicle_id).filter(Boolean))];
      const driverIds = [...new Set(tripsData.map(t => t.driver_id).filter(Boolean))];
      const tripIds = tripsData.map(t => t.id);

      const [bookingsRes, vehiclesRes, driversRes, exceptionsRes] = await Promise.all([
        supabase.from("bookings").select("id, requirement_id").in("id", bookingIds),
        vehicleIds.length > 0 ? supabase.from("vehicles").select("id, vehicle_number").in("id", vehicleIds) : Promise.resolve({ data: [] }),
        driverIds.length > 0 ? supabase.from("drivers").select("id, full_name").in("id", driverIds) : Promise.resolve({ data: [] }),
        supabase.from("exceptions").select("id, trip_id, status").in("trip_id", tripIds).eq("status", "OPEN")
      ]);

      const bookingMap = new Map<string, any>((bookingsRes.data || []).map((b: any) => [b.id, b]));
      const vehicleMap = new Map<string, any>((vehiclesRes.data || []).map((v: any) => [v.id, v]));
      const driverMap = new Map<string, any>((driversRes.data || []).map((d: any) => [d.id, d]));
      const exceptionMap = new Map<string, boolean>();
      (exceptionsRes.data || []).forEach(e => exceptionMap.set(e.trip_id, true));

      const enriched: Trip[] = tripsData.map((t, idx) => {
        const booking = bookingMap.get(t.booking_id);
        const vehicle = vehicleMap.get(t.vehicle_id);
        const driver = driverMap.get(t.driver_id);
        return {
          ...t,
          trip_reference: formatTripReference(t.id, t.created_at, idx + 1),
          booking_reference: booking ? `BOK-${booking.id.substring(0, 8)}` : "N/A",
          vehicle_registration: vehicle?.vehicle_number || "Unassigned",
          driver_name: driver?.full_name || "Unassigned",
          has_active_exception: exceptionMap.get(t.id) || false
        };
      });

      setTrips(enriched);
    } catch (err: any) {
      console.error("Error fetching trips:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCounts();
    fetchTrips();
  }, [fetchCounts, fetchTrips]);

  const filteredTrips = trips.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    return (
      t.trip_reference?.toLowerCase().includes(searchLower) ||
      t.booking_reference?.toLowerCase().includes(searchLower) ||
      t.vehicle_registration?.toLowerCase().includes(searchLower) ||
      t.driver_name?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE);
  const paginatedTrips = filteredTrips.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="cli-dir-wrapper">
      {toastMessage && (
        <div className="toast-success">
          <CheckCircle size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Operations</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Trip Tracking</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Trip Tracking & Milestone Monitoring</h1>
          <p className="page-subtitle">Monitor active trips and record milestone events</p>
        </div>
        <button className="btn-back-outline" onClick={() => { fetchCounts(); fetchTrips(); }}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="client-kpi-bar">
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <TruckIcon size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Cleared for Dispatch</div>
            <div className="kpi-stat-value">{counts.cleared}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <Navigation size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">In Transit</div>
            <div className="kpi-stat-value">{counts.inTransit}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <TruckIcon size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Pending Unloading</div>
            <div className="kpi-stat-value">{counts.pendingUnloading}</div>
          </div>
        </div>
        <div className="kpi-stat-card">
          <div className="kpi-stat-icon" style={{ background: "var(--brand-soft)" }}>
            <CheckCircle size={20} color="#F45325" />
          </div>
          <div>
            <div className="kpi-stat-label">Delivered</div>
            <div className="kpi-stat-value">{counts.delivered}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="client-toolbar-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search trips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-field"
          />
        </div>

        <div className="filter-tab-group">
          {["ALL", "CLEARED_FOR_DISPATCH", "IN_TRANSIT", "PENDING_UNLOADING", "DELIVERED"].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status as any); setPage(1); }}
              className={statusFilter === status ? "filter-tab-active" : "filter-tab"}
            >
              {status === "ALL" ? "All" : status.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Trip Table */}
      {loading ? (
        <div className="empty-state-box">
          <Loader2 size={48} style={{ animation: "spin 1s linear infinite", color: "#64748B" }} />
          <p style={{ color: "#64748B" }}>Loading trips...</p>
        </div>
      ) : error ? (
        <div className="alert-error-bar">
          <AlertTriangle size={16} />
          <span>Error: {error}</span>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="empty-state-box">
          <Navigation size={48} style={{ color: "#94A3B8", opacity: 0.5 }} />
          <p style={{ color: "#64748B" }}>No active trips to track</p>
        </div>
      ) : (
        <>
          <div className="white-data-table-card">
            <table className="data-table-standard">
              <thead>
                <tr>
                  <th>Trip Ref</th>
                  <th>Booking Ref</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrips.map(trip => {
                  const statusColors = getStatusColor(trip.trip_status);
                  return (
                    <tr key={trip.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {trip.has_active_exception && <AlertTriangle size={14} color="#F45325" />}
                          <span style={{ fontWeight: 600, color: "#111111" }}>{trip.trip_reference}</span>
                        </div>
                      </td>
                      <td style={{ color: "#64748B" }}>{trip.booking_reference}</td>
                      <td style={{ color: "#111111" }}>{trip.vehicle_registration}</td>
                      <td style={{ color: "#111111" }}>{trip.driver_name}</td>
                      <td>
                        <span className="status-badge" style={{ background: statusColors.bg, color: statusColors.text }}>
                          {statusColors.label}
                        </span>
                      </td>
                      <td style={{ color: "#64748B", fontSize: "13px" }}>
                        {new Date(trip.updated_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => onNavigateToTripDetail?.(trip.id)}
                          className="btn-icon-action"
                          style={{ padding: "6px 12px" }}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-btn"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
};
