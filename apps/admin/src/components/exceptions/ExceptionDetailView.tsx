import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowLeft, Clock, User, FileText, CheckCircle, X } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { useToast } from "../../context/ToastContext";

interface ExceptionDetail {
  id: string;
  exception_reference: string;
  exception_type: string;
  severity: string;
  status: string;
  trip_id: string;
  booking_id: string;
  description: string;
  reported_by: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export const ExceptionDetailView: React.FC = () => {
  const { exceptionId } = useParams<{ exceptionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [exception, setException] = useState<ExceptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    if (exceptionId) fetchExceptionDetail();
  }, [exceptionId]);

  const fetchExceptionDetail = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("exceptions")
        .select("*")
        .eq("id", exceptionId)
        .single();

      if (data) {
        setException({
          ...data,
          exception_reference: `EXC-${data.id.substring(0, 8)}`
        });
      }
    } catch (err) {
      console.error("Error fetching exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast.warning("Resolution notes are required");
      return;
    }

    setResolving(true);
    try {
      await supabase.from("exceptions").update({
        status: "RESOLVED",
        resolved_at: new Date().toISOString(),
        resolved_by: (await supabase.auth.getUser()).data.user?.id,
        resolution_notes: resolutionNotes
      }).eq("id", exceptionId);

      toast.success("Exception marked as resolved");
      navigate("/admin/exceptions");
    } catch (err: any) {
      toast.error(err.message || "Error resolving exception");
    } finally {
      setResolving(false);
    }
  };

  if (loading || !exception) {
    return (
      <div className="cli-dir-wrapper">
        <div style={{ textAlign: "center", padding: "4rem", color: "#64748B" }}>
          Loading exception details...
        </div>
      </div>
    );
  }

  return (
    <div className="cli-dir-wrapper">
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={() => navigate("/admin/exceptions")} style={{ cursor: "pointer" }}>
          Exceptions
        </span>
        <span className="breadcrumb-sep">�</span>
        <span className="breadcrumb-current">{exception.exception_reference}</span>
      </div>

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Exception Details</h1>
          <p className="page-subtitle">{exception.exception_reference}</p>
        </div>
        <button onClick={() => navigate("/admin/exceptions")} className="btn-create-gold" style={{ background: "#FFFFFF", color: "#111111" }}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Main Details */}
        <div className="content-card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111111", marginBottom: "1.5rem" }}>
            Exception Information
          </h2>

          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Type</div>
              <div style={{ fontSize: "1rem", color: "#111111", fontWeight: 600 }}>
                {exception.exception_type.replace(/_/g, " ")}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Severity</div>
              <span className="status-badge" style={{
                background: exception.severity === "CRITICAL" ? "rgba(244,83,37,0.08)" : 
                           exception.severity === "HIGH" ? "rgba(244,83,37,0.08)" : "rgba(244,83,37,0.08)",
                color: exception.severity === "CRITICAL" ? "#F45325" : 
                       exception.severity === "HIGH" ? "#F45325" : "#F45325"
              }}>
                {exception.severity}
              </span>
            </div>

            <div>
              <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Description</div>
              <div style={{ fontSize: "0.95rem", color: "#111111", lineHeight: "1.6" }}>
                {exception.description}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Reported At</div>
              <div style={{ fontSize: "0.95rem", color: "#111111" }}>
                {new Date(exception.created_at).toLocaleString()}
              </div>
            </div>

            {exception.status === "RESOLVED" && exception.resolution_notes && (
              <div style={{ padding: "1rem", background: "#FEF3EE", borderRadius: "8px", border: "1px solid #86EFAC" }}>
                <div style={{ fontSize: "0.85rem", color: "#F45325", marginBottom: "0.5rem", fontWeight: 600 }}>
                  ? Resolution Notes
                </div>
                <div style={{ fontSize: "0.95rem", color: "#111111", lineHeight: "1.6" }}>
                  {exception.resolution_notes}
                </div>
                {exception.resolved_at && (
                  <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: "0.5rem" }}>
                    Resolved on {new Date(exception.resolved_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="content-card" style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Status</div>
            <span className="status-badge" style={{
              background: exception.status === "OPEN" ? "rgba(244,83,37,0.08)" : "rgba(244,83,37,0.08)",
              color: exception.status === "OPEN" ? "#F45325" : "#F45325"
            }}>
              {exception.status}
            </span>
          </div>

          {exception.trip_id && (
            <div className="content-card" style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "0.5rem" }}>Related Trip</div>
              <button 
                onClick={() => navigate(`/admin/tracking/${exception.trip_id}`)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  color: "#111111",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                View Trip ?
              </button>
            </div>
          )}

          {exception.status === "OPEN" && (
            <div className="content-card">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111111", marginBottom: "1rem" }}>
                Resolve Exception
              </h3>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter resolution notes..."
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#FFFFFF",
                  border: "1px solid rgba(244,83,37,0.25)",
                  borderRadius: "6px",
                  color: "#111111",
                  fontSize: "0.9rem",
                  minHeight: "100px",
                  resize: "vertical",
                  marginBottom: "1rem"
                }}
              />
              <button
                onClick={handleResolve}
                disabled={resolving}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#F45325",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "6px",
                  cursor: resolving ? "not-allowed" : "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  opacity: resolving ? 0.6 : 1
                }}
              >
                {resolving ? "Resolving..." : "Mark as Resolved"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};