import React, { useState, useEffect, useCallback } from "react";
import {
  Scale, Upload, CheckCircle, AlertTriangle, X, TruckIcon,
  MapPin, Calendar, FileText, Loader2, RefreshCw, ZoomIn, ZoomOut, RotateCw
} from "lucide-react";
import { supabase } from "../../utils/supabase";

interface Weighment {
  id: string;
  trip_id: string;
  stage: "LOADING" | "UNLOADING";
  gross_weight_mt: number;
  tare_weight_mt: number;
  net_weight_mt: number;
  slip_document_url?: string;
  verified_by?: string;
  status: string;
  recorded_at: string;
}

interface Trip {
  id: string;
  booking_id: string;
  trip_status: string;
  vehicle_id: string;
  trip_reference?: string;
  booking_reference?: string;
  vehicle_registration?: string;
  vehicle_minimum_capacity?: number;
}

interface WeighbridgeModuleProps {}

export const WeighbridgeModule: React.FC<WeighbridgeModuleProps> = () => {
  const [activeTab, setActiveTab] = useState<"LOADING" | "UNLOADING">("LOADING");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Weighment entry state
  const [showWeighmentForm, setShowWeighmentForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [slipZoom, setSlipZoom] = useState(1);
  const [slipRotation, setSlipRotation] = useState(0);
  const [formData, setFormData] = useState({
    grossWeight: "",
    tareWeight: "",
    slipNumber: "",
    slipLocation: "",
    slipDate: ""
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch trips needing weighments
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch weighments first to determine which trips need them
      const { data: weighments } = await supabase
        .from("weighments")
        .select("trip_id, stage");

      const loadingTripIds = new Set(weighments?.filter(w => w.stage === "LOADING").map(w => w.trip_id) || []);
      const unloadingTripIds = new Set(weighments?.filter(w => w.stage === "UNLOADING").map(w => w.trip_id) || []);

      // For LOADING tab: fetch IN_TRANSIT trips without loading weighment
      // For UNLOADING tab: fetch PENDING_UNLOADING trips without unloading weighment
      let query = supabase.from("trips").select("*");

      if (activeTab === "LOADING") {
        query = query.eq("trip_status", "IN_TRANSIT");
      } else {
        query = query.eq("trip_status", "PENDING_UNLOADING");
      }

      const { data: tripsData, error: tErr } = await query;
      if (tErr) throw tErr;

      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        return;
      }

      // Filter out trips that already have the relevant weighment
      const filteredTrips = tripsData.filter(t => {
        if (activeTab === "LOADING") {
          return !loadingTripIds.has(t.id);
        } else {
          return !unloadingTripIds.has(t.id);
        }
      });

      // Enrich with related data
      const vehicleIds = [...new Set(filteredTrips.map(t => t.vehicle_id).filter(Boolean))];
      const bookingIds = [...new Set(filteredTrips.map(t => t.booking_id))];

      const [vehiclesRes, bookingsRes] = await Promise.all([
        vehicleIds.length > 0 ? supabase.from("vehicles").select("id, registration_number, minimum_capacity").in("id", vehicleIds) : Promise.resolve({ data: [] }),
        supabase.from("bookings").select("id").in("id", bookingIds)
      ]);

      const vehicleMap = new Map<string, any>((vehiclesRes.data || []).map((v: any) => [v.id, v]));
      const bookingMap = new Map<string, any>((bookingsRes.data || []).map((b: any) => [b.id, b]));

      const enriched: Trip[] = filteredTrips.map((t, idx) => {
        const vehicle = vehicleMap.get(t.vehicle_id);
        return {
          ...t,
          trip_reference: `TRP-${String(idx + 1).padStart(3, "0")}`,
          booking_reference: bookingMap.get(t.booking_id) ? `BOK-${t.booking_id.substring(0, 8)}` : "N/A",
          vehicle_registration: vehicle?.registration_number || "Unassigned",
          vehicle_minimum_capacity: vehicle?.minimum_capacity || 0
        };
      });

      setTrips(enriched);
    } catch (err: any) {
      console.error("Error fetching trips:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleOpenWeighmentForm = (trip: Trip) => {
    setSelectedTrip(trip);
    setFormData({
      grossWeight: "",
      tareWeight: "",
      slipNumber: "",
      slipLocation: "",
      slipDate: ""
    });
    setFormError(null);
    setShowWeighmentForm(true);
  };

  const handleSubmitWeighment = async () => {
    if (!selectedTrip) return;

    const gross = parseFloat(formData.grossWeight);
    const tare = parseFloat(formData.tareWeight);

    if (isNaN(gross) || isNaN(tare) || gross <= 0 || tare < 0) {
      setFormError("Please enter valid positive weights");
      return;
    }

    const net = gross - tare;
    if (net <= 0) {
      setFormError("Net weight must be positive (gross must be greater than tare)");
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
      const grossVal = parseFloat(formData.grossWeight);
      const tareVal = parseFloat(formData.tareWeight);
      const grossMt = grossVal > 100 ? Number((grossVal / 1000).toFixed(2)) : Number(grossVal.toFixed(2));
      const tareMt = tareVal > 100 ? Number((tareVal / 1000).toFixed(2)) : Number(tareVal.toFixed(2));
      const netMt = Number((grossMt - tareMt).toFixed(2));
      const userRes = await supabase.auth.getUser();

      const weighmentData = {
        trip_id: selectedTrip.id,
        stage: activeTab,
        gross_weight_mt: grossMt,
        tare_weight_mt: tareMt,
        net_weight_mt: netMt,
        status: "APPROVED",
        verified_by: userRes.data.user?.id || null
      };

      const { error: insertErr } = await supabase
        .from("weighments")
        .insert(weighmentData);

      if (insertErr) throw insertErr;

      // If this is an unloading weighment, compute billable quantity
      if (activeTab === "UNLOADING") {
        const billableQty = Math.max(net, selectedTrip.vehicle_minimum_capacity || 0);
        // Store billable_qty on trip or separate table as needed
        await supabase
          .from("trips")
          .update({ billable_quantity: billableQty })
          .eq("id", selectedTrip.id);
      }

      setToastMessage(`${activeTab} weighment recorded successfully`);
      setTimeout(() => setToastMessage(null), 3000);
      setShowWeighmentForm(false);
      fetchTrips();
    } catch (err: any) {
      console.error("Error submitting weighment:", err.message);
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Header */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link">Operations</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Weighbridge & Freight</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Weighbridge & Freight Calculation</h1>
          <p className="page-subtitle">
            Record loading and unloading weighments to calculate billable freight quantities
          </p>
        </div>
      </div>

      {/* Tab Layout */}
      <div className="table-sub-bar" style={{ marginBottom: "16px" }}>
        <div className="status-tabs-group">
          <button
            onClick={() => { setActiveTab("LOADING"); setShowWeighmentForm(false); }}
            className={`status-tab-btn ${activeTab === "LOADING" ? "active" : ""}`}
          >
            Loading Weighments
          </button>
          <button
            onClick={() => { setActiveTab("UNLOADING"); setShowWeighmentForm(false); }}
            className={`status-tab-btn ${activeTab === "UNLOADING" ? "active" : ""}`}
          >
            Unloading Weighments
          </button>
        </div>
        <button
          onClick={fetchTrips}
          className="btn-action-outline"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Trip List */}
      {loading ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <Loader2 size={36} color="#F05A22" style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
          <p className="empty-state-text">Loading trips...</p>
        </div>
      ) : error ? (
        <div className="alert-error-bar">
          Error: {error}
        </div>
      ) : trips.length === 0 ? (
        <div className="table-empty-state" style={{ padding: "3rem" }}>
          <Scale size={44} style={{ color: "#94A3B8", marginBottom: "12px" }} />
          <h4 className="empty-state-heading">No weighment trips found</h4>
          <p className="empty-state-text">No trips currently awaiting {activeTab.toLowerCase()} weighment</p>
        </div>
      ) : (
        <div className="client-table-card">
          <div className="table-wrapper">
            <table className="client-table">
              <thead>
                <tr>
                  <th>Trip Ref</th>
                  <th>Booking Ref</th>
                  <th>Vehicle</th>
                  <th>Min. Capacity (kg)</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trips.map(trip => (
                  <tr key={trip.id} className="client-data-row">
                    <td>
                      <span className="mono-code" style={{ color: "#F05A22", fontWeight: 700 }}>{trip.trip_reference}</span>
                    </td>
                    <td>
                      <span className="mono-code" style={{ color: "#64748B" }}>{trip.booking_reference}</span>
                    </td>
                    <td>
                      <span className="client-name-bold">{trip.vehicle_registration}</span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {trip.vehicle_minimum_capacity?.toLocaleString() || "N/A"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleOpenWeighmentForm(trip)}
                        className="btn-create-orange"
                        style={{ padding: "6px 14px", fontSize: "13px" }}
                      >
                        <Upload size={14} />
                        <span>Record Weighment</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weighment Entry Modal — Split Inspector Layout */}
      {showWeighmentForm && selectedTrip && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1.5rem"
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: "16px",
            maxWidth: "960px", width: "100%", maxHeight: "90vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            border: "1px solid #E2E8F0", boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.3)"
          }}>
            {/* Header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "1.25rem 1.75rem", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0"
            }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Record {activeTab} Weighment & Slip Audit
                </h2>
                <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "2px" }}>
                  Trip: <strong style={{ color: "#0F172A" }}>{selectedTrip.trip_reference}</strong> • Vehicle: <strong style={{ color: "#0F172A" }}>{selectedTrip.vehicle_registration}</strong>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowWeighmentForm(false);
                  setSlipZoom(1);
                  setSlipRotation(0);
                }}
                style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "4px" }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Split Body */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, overflow: "hidden"
            }}>
              {/* Left Pane: Interactive Slip Inspector */}
              <div className="slip-viewer-canvas" style={{ minHeight: "440px" }}>
                <div style={{
                  transform: `scale(${slipZoom}) rotate(${slipRotation}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "#FFFFFF", padding: "1.5rem", borderRadius: "8px", maxWidth: "80%", boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                }}>
                  <div style={{ borderBottom: "2px dashed #CBD5E1", width: "100%", paddingBottom: "8px", marginBottom: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", letterSpacing: "1px" }}>NORTH EASTERN CARRIERS</div>
                    <div style={{ fontSize: "10px", color: "#64748B" }}>WEIGHBRIDGE MEMO SLIP</div>
                  </div>
                  <div style={{ fontSize: "11px", color: "#334155", width: "100%", lineHeight: "1.6" }}>
                    <div>Vehicle: <strong>{selectedTrip.vehicle_registration || "TRUCK UNIT"}</strong></div>
                    <div>Slip No: <strong>{formData.slipNumber || "WB-PENDING"}</strong></div>
                    <div>Gross: <strong>{formData.grossWeight ? `${formData.grossWeight} kg` : "—"}</strong></div>
                    <div>Tare: <strong>{formData.tareWeight ? `${formData.tareWeight} kg` : "—"}</strong></div>
                    <div style={{ borderTop: "1px solid #E2E8F0", marginTop: "4px", paddingTop: "4px", color: "#F45325", fontWeight: 700 }}>
                      Net: {formData.grossWeight && formData.tareWeight ? `${(parseFloat(formData.grossWeight) - parseFloat(formData.tareWeight)).toLocaleString()} kg` : "—"}
                    </div>
                  </div>
                </div>

                {/* Slip Controls Overlay */}
                <div className="slip-viewer-controls">
                  <button className="slip-control-btn" onClick={() => setSlipZoom(z => Math.min(z + 0.25, 2.5))} title="Zoom In">
                    <ZoomIn size={14} /> Zoom +
                  </button>
                  <button className="slip-control-btn" onClick={() => setSlipZoom(z => Math.max(z - 0.25, 0.75))} title="Zoom Out">
                    <ZoomOut size={14} /> Zoom -
                  </button>
                  <button className="slip-control-btn" onClick={() => setSlipRotation(r => (r + 90) % 360)} title="Rotate">
                    <RotateCw size={14} /> Rotate
                  </button>
                  <button className="slip-control-btn" onClick={() => { setSlipZoom(1); setSlipRotation(0); }} title="Reset View">
                    Reset
                  </button>
                </div>
              </div>

              {/* Right Pane: Form Inputs */}
              <div style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {formError && (
                  <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #FCA5A5" }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "#475569", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                      Gross Weight (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.grossWeight}
                      onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                      style={{
                        width: "100%", padding: "0.65rem 0.85rem", background: "#FFFFFF", border: "1px solid #CBD5E1",
                        borderRadius: "6px", color: "#0F172A", fontSize: "0.95rem", fontWeight: 600
                      }}
                      placeholder="e.g. 35000"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "#475569", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                      Tare Weight (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tareWeight}
                      onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                      style={{
                        width: "100%", padding: "0.65rem 0.85rem", background: "#FFFFFF", border: "1px solid #CBD5E1",
                        borderRadius: "6px", color: "#0F172A", fontSize: "0.95rem", fontWeight: 600
                      }}
                      placeholder="e.g. 10000"
                    />
                  </div>
                </div>

                {/* Computed Net Weight Banner */}
                {formData.grossWeight && formData.tareWeight && (
                  <div style={{
                    padding: "1rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ color: "#64748B", fontSize: "0.85rem", fontWeight: 600 }}>Computed Net Weight:</span>
                      <span style={{ color: "#F45325", fontSize: "1.35rem", fontWeight: 800 }}>
                        {(parseFloat(formData.grossWeight) - parseFloat(formData.tareWeight)).toLocaleString()} kg
                      </span>
                    </div>

                    {activeTab === "UNLOADING" && selectedTrip.vehicle_minimum_capacity && (
                      <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed #CBD5E1", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#0F172A", fontSize: "0.85rem", fontWeight: 600 }}>Billable Quantity (Max rule):</span>
                        <span style={{ color: "#10B981", fontSize: "0.95rem", fontWeight: 700 }}>
                          {Math.max(
                            parseFloat(formData.grossWeight) - parseFloat(formData.tareWeight),
                            selectedTrip.vehicle_minimum_capacity
                          ).toLocaleString()} kg
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", color: "#475569", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Weighbridge Slip Number
                  </label>
                  <input
                    type="text"
                    value={formData.slipNumber}
                    onChange={(e) => setFormData({ ...formData, slipNumber: e.target.value })}
                    style={{
                      width: "100%", padding: "0.65rem 0.85rem", background: "#FFFFFF", border: "1px solid #CBD5E1",
                      borderRadius: "6px", color: "#0F172A", fontSize: "0.9rem"
                    }}
                    placeholder="e.g. WB-2026-10294"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "#475569", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                      Weighbridge Location
                    </label>
                    <input
                      type="text"
                      value={formData.slipLocation}
                      onChange={(e) => setFormData({ ...formData, slipLocation: e.target.value })}
                      style={{
                        width: "100%", padding: "0.65rem 0.85rem", background: "#FFFFFF", border: "1px solid #CBD5E1",
                        borderRadius: "6px", color: "#0F172A", fontSize: "0.9rem"
                      }}
                      placeholder="e.g. Guwahati Port Bridge"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", color: "#475569", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                      Slip Date
                    </label>
                    <input
                      type="date"
                      value={formData.slipDate}
                      onChange={(e) => setFormData({ ...formData, slipDate: e.target.value })}
                      style={{
                        width: "100%", padding: "0.65rem 0.85rem", background: "#FFFFFF", border: "1px solid #CBD5E1",
                        borderRadius: "6px", color: "#0F172A", fontSize: "0.9rem"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "1rem" }}>
                  <button
                    onClick={() => {
                      setShowWeighmentForm(false);
                      setSlipZoom(1);
                      setSlipRotation(0);
                    }}
                    style={{
                      flex: 1, padding: "0.75rem", background: "#F1F5F9", color: "#334155",
                      border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitWeighment}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "0.75rem", background: "#F45325", color: "#FFFFFF",
                      border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer",
                      fontSize: "0.9rem", fontWeight: 600, opacity: loading ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(244, 83, 37, 0.3)"
                    }}
                  >
                    {loading ? "Submitting..." : "Audit & Save Weighment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="toast-success">
          <CheckCircle size={16} />
          {toastMessage}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
