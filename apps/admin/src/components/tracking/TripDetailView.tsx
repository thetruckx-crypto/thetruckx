import React, { useState, useEffect } from "react";
import {
  MapPin, Truck, Calendar, User, Package, Navigation, Clock,
  CheckCircle, AlertTriangle, ArrowLeft, RefreshCw, FileText,
  DollarSign, CheckCircle2, ShieldCheck, ExternalLink
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";

const STATUS_STEPS = [
  "LORRY_ASSIGNED",
  "AT_LOADING",
  "IN_TRANSIT",
  "AT_UNLOADING",
  "DELIVERED",
  "COMPLETED"
];

export const TripDetailView: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) fetchTripDetail();
  }, [tripId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchTripDetail = async () => {
    setLoading(true);
    try {
      // 1. Fetch trip
      const { data: tripData, error: tripErr } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();

      if (tripErr) throw tripErr;

      if (!tripData) {
        setTrip(null);
        return;
      }

      // 2. Fetch booking, requirement, client, vehicle, driver, vendor
      const [bookingRes, vehRes, drvRes, venRes, docRes] = await Promise.all([
        supabase.from("bookings").select("id, requirement_id, client_id, booking_status").eq("id", tripData.booking_id).maybeSingle(),
        tripData.vehicle_id ? supabase.from("vehicles").select("id, vehicle_number, vehicle_type").eq("id", tripData.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
        tripData.driver_id ? supabase.from("drivers").select("id, full_name, mobile").eq("id", tripData.driver_id).maybeSingle() : Promise.resolve({ data: null }),
        tripData.vendor_id ? supabase.from("vendor_companies").select("id, vendor_name").eq("id", tripData.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("documents").select("*").eq("reference_id", tripId),
      ]);

      let reqData = null;
      let clientData = null;
      if (bookingRes.data?.requirement_id) {
        const { data: req } = await supabase.from("requirements").select("*").eq("id", bookingRes.data.requirement_id).maybeSingle();
        reqData = req;
      }
      if (bookingRes.data?.client_id) {
        const { data: cl } = await supabase.from("client_companies").select("id, company_name").eq("id", bookingRes.data.client_id).maybeSingle();
        clientData = cl;
      }

      setTrip({
        ...tripData,
        trip_reference: `TRP-${tripData.id.substring(0, 8)}`,
        booking: bookingRes.data,
        requirement: reqData,
        client: clientData,
        vehicle: vehRes.data,
        driver: drvRes.data,
        vendor: venRes.data,
      });

      setDocuments(docRes.data || []);
    } catch (err: any) {
      console.error("Error fetching trip detail:", err);
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!tripId || !trip) return;
    setUpdating(true);
    try {
      const payload: any = {
        trip_status: newStatus,
      };
      if (newStatus === "IN_TRANSIT" && !trip.started_at) {
        payload.started_at = new Date().toISOString();
      }
      if ((newStatus === "DELIVERED" || newStatus === "COMPLETED") && !trip.completed_at) {
        payload.completed_at = new Date().toISOString();
      }

      const { error: updErr } = await supabase
        .from("trips")
        .update(payload)
        .eq("id", tripId);

      if (updErr) throw updErr;

      // Update booking status if completed or in transit
      if (trip.booking_id) {
        if (newStatus === "IN_TRANSIT") {
          await supabase.from("bookings").update({ booking_status: "IN_PROGRESS" }).eq("id", trip.booking_id);
        } else if (newStatus === "COMPLETED" || newStatus === "DELIVERED") {
          await supabase.from("bookings").update({ booking_status: "COMPLETED" }).eq("id", trip.booking_id);
        }
      }

      showToast(`Trip status successfully updated to ${newStatus}`);
      fetchTripDetail();
    } catch (err: any) {
      console.error("Failed to update trip status:", err);
      showToast(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="cli-dir-wrapper">
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <div className="spin-animation" style={{ display: "inline-block" }}>
            <Navigation size={48} color="#F45325" />
          </div>
          <p style={{ color: "#64748B", marginTop: "1rem" }}>Loading trip details from database...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="cli-dir-wrapper">
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <AlertTriangle size={48} color="#F45325" style={{ opacity: 0.5 }} />
          <h3 style={{ color: "#111111", margin: "1rem 0 0.5rem" }}>Trip not found</h3>
          <p style={{ color: "#64748B", margin: 0 }}>The requested trip record does not exist in the database.</p>
          <button onClick={() => navigate("/admin/tracking")} className="btn-create-gold" style={{ marginTop: "1.5rem" }}>
            Back to Tracking
          </button>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(trip.trip_status);

  return (
    <div className="cli-dir-wrapper">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-success" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => navigate("/admin/tracking")} style={{ cursor: "pointer" }}>
          Tracking
        </span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{trip.trip_reference}</span>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">{trip.trip_reference}</h1>
            <span style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              background: "#FEF3EE",
              color: "#F45325"
            }}>
              {trip.trip_status}
            </span>
          </div>
          <p className="page-subtitle">
            Booking: {trip.booking?.id || "N/A"} • Client: {trip.client?.company_name || "Enterprise Client"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={fetchTripDetail} className="btn-sub-action">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button onClick={() => navigate("/admin/tracking")} className="btn-sub-action">
            <ArrowLeft size={14} />
            <span>Back to Trips</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Vehicle & Driver */}
        <div className="content-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <Truck size={18} color="#F45325" />
            <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>Assigned Vehicle</span>
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111111" }}>
            {trip.vehicle?.vehicle_number || "Unassigned Vehicle"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: 2 }}>
            Type: {trip.vehicle?.vehicle_type || "Standard Freight Truck"}
          </div>
        </div>

        {/* Driver */}
        <div className="content-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <User size={18} color="#F45325" />
            <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>Assigned Driver</span>
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111111" }}>
            {trip.driver?.full_name || "Unassigned Driver"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: 2 }}>
            Mobile: {trip.driver?.mobile || "Not specified"}
          </div>
        </div>

        {/* Vendor Partner */}
        <div className="content-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <DollarSign size={18} color="#F45325" />
            <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>Vendor & Freight</span>
          </div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111111" }}>
            ₹{Number(trip.vendor_rate || 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: 2 }}>
            Vendor: {trip.vendor?.vendor_name || "Partner Fleet"}
          </div>
        </div>

        {/* Route */}
        <div className="content-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <MapPin size={18} color="#F45325" />
            <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: 600 }}>Origin & Destination</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "#111111", marginBottom: 2 }}>
            <strong>From:</strong> {trip.requirement?.pickup_address || "Consignor Pickup"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#111111" }}>
            <strong>To:</strong> {trip.requirement?.destination_address || "Consignee Delivery"}
          </div>
        </div>
      </div>

      {/* Live GPS & Telematics Signal */}
      <div className="content-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Navigation size={18} color="#F45325" />
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111111", margin: 0 }}>
              Live Telematics & GPS Tracking
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: (trip.current_lat && trip.current_lng) ? "#10B981" : "#F59E0B",
              display: "inline-block",
              boxShadow: (trip.current_lat && trip.current_lng) ? "0 0 8px #10B981" : "0 0 6px #F59E0B"
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: (trip.current_lat && trip.current_lng) ? "#047857" : "#B45309" }}>
              {(trip.current_lat && trip.current_lng) ? "Live Beacon Active" : "Awaiting Telematics Beacon"}
            </span>
          </div>
        </div>

        {(trip.current_lat && trip.current_lng) ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>Current Coordinates</div>
              <div style={{ fontSize: 12, color: "#15803D", marginTop: 2 }}>
                Latitude: {Number(trip.current_lat).toFixed(5)}, Longitude: {Number(trip.current_lng).toFixed(5)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#166534" }}>
              Last Ping: {trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString() : "Just now"}
            </div>
          </div>
        ) : (
          <div style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 8, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#FEF3EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <Navigation size={22} color="#F45325" />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                Awaiting GPS Telematics Ping
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                Coordinates will stream automatically in real-time as the assigned driver advances transit updates from the TRUCKS Mobile Driver App or onboard FASTag / AIS-140 GPS telematics device.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trip Lifecycle Status Pipeline */}
      <div className="content-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111111", margin: "0 0 1rem" }}>
          Trip Execution Lifecycle & Progression
        </h2>

        {/* Stepper bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem", overflowX: "auto", paddingBottom: 6 }}>
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <React.Fragment key={step}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: isCurrent ? "#FEF3EE" : isCompleted ? "#F0FDF4" : "#F8FAFC",
                  border: isCurrent ? "1px solid #F45325" : isCompleted ? "1px solid #BBF7D0" : "1px solid #E2E8F0",
                  color: isCurrent ? "#F45325" : isCompleted ? "#15803D" : "#94A3B8",
                  fontWeight: isCurrent || isCompleted ? 700 : 500,
                  fontSize: 12,
                  whiteSpace: "nowrap"
                }}>
                  {isCompleted ? <CheckCircle2 size={14} color="#15803D" /> : null}
                  <span>{step.replace(/_/g, " ")}</span>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div style={{ width: 16, height: 2, background: isCompleted ? "#BBF7D0" : "#E2E8F0", flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Administrative Progression Action Buttons */}
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 8 }}>
            Administrative Actions:
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn-sub-action"
              disabled={updating || trip.trip_status === "AT_LOADING"}
              onClick={() => handleUpdateStatus("AT_LOADING")}
            >
              Mark At Loading Point
            </button>
            <button
              className="btn-sub-action"
              disabled={updating || trip.trip_status === "IN_TRANSIT"}
              onClick={() => handleUpdateStatus("IN_TRANSIT")}
            >
              Dispatch (In Transit)
            </button>
            <button
              className="btn-sub-action"
              disabled={updating || trip.trip_status === "AT_UNLOADING"}
              onClick={() => handleUpdateStatus("AT_UNLOADING")}
            >
              Mark At Unloading Point
            </button>
            <button
              className="btn-sub-action"
              disabled={updating || trip.trip_status === "DELIVERED"}
              onClick={() => handleUpdateStatus("DELIVERED")}
              style={{
                background: trip.trip_status === "DELIVERED" ? "#D1FAE5" : undefined,
                color: trip.trip_status === "DELIVERED" ? "#047857" : undefined,
              }}
            >
              Confirm Delivery
            </button>
            <button
              className="btn-create-gold"
              disabled={updating || trip.trip_status === "COMPLETED"}
              onClick={() => handleUpdateStatus("COMPLETED")}
            >
              Complete Trip
            </button>
          </div>
        </div>
      </div>

      {/* Uploaded Documents & POD (Proof of Delivery) */}
      <div className="content-card">
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111111", margin: "0 0 1rem", display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={18} color="#F45325" />
          <span>Trip Documents & Proof of Delivery (POD)</span>
        </h2>

        {documents.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: 8, border: "1px dashed #CBD5E1" }}>
            <FileText size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#111111" }}>No documents uploaded for this trip yet</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Documents uploaded via the Driver or Vendor mobile applications (POD, Lorry Receipt, Weighbridge Slip) will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {documents.map(doc => (
              <div
                key={doc.id}
                style={{
                  padding: 14,
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  background: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ fontSize: 14, color: "#111111" }}>{doc.document_type}</strong>
                  <span style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                    background: doc.verification_status === "APPROVED" ? "#D1FAE5" : "#FEF3EE",
                    color: doc.verification_status === "APPROVED" ? "#047857" : "#F45325",
                  }}>
                    {doc.verification_status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                  Category: {doc.category} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                </div>
                {doc.file_url ? (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#F45325",
                      textDecoration: "none"
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>View / Download Document</span>
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>File stored locally</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .spin-animation {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};