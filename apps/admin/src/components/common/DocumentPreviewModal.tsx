import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { supabase } from "../../utils/supabase";

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentTypeKey?: string;
  fileName: string;
  fileUrlOrPath: string;
  verificationStatus?: string;
  rejectionReason?: string | null;
  uploadedAt?: string;
  fileSize?: string;
  onVerify?: () => void;
  onReject?: () => void;
  canVerify?: boolean;
  canReject?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  fileName,
  fileUrlOrPath,
  verificationStatus = "PENDING",
  rejectionReason,
  uploadedAt,
  fileSize,
  onVerify,
  onReject,
  canVerify = true,
  canReject = true
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Zoom and rotation state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Determine file format
  const isPdf =
    fileName?.toLowerCase().endsWith(".pdf") ||
    fileUrlOrPath?.toLowerCase().includes(".pdf") ||
    fileUrlOrPath?.toLowerCase().includes("pdf");

  // Fetch real signed URL from Supabase Storage
  const resolveFileUrl = useCallback(async () => {
    if (!fileUrlOrPath) {
      setLoadError("No file path or URL provided for this document.");
      setIsLoadingUrl(false);
      return;
    }

    setIsLoadingUrl(true);
    setLoadError(null);

    try {
      // If it's already a full signed or http(s) URL
      if (fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://")) {
        setResolvedUrl(fileUrlOrPath);
        setIsLoadingUrl(false);
        return;
      }

      // Clean storage path
      const cleanPath = fileUrlOrPath.replace(/^\/+/, "");

      // Try creating signed URL from client-documents bucket (valid for 1 hour)
      const { data, error: signErr } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(cleanPath, 3600);

      if (data?.signedUrl) {
        let fullUrl = data.signedUrl;
        if (!fullUrl.startsWith("http")) {
          const supabaseUrl =
            (supabase as any).supabaseUrl ||
            (import.meta as any).env?.VITE_SUPABASE_URL ||
            "https://nbsgmorzrccbyfmjbvgx.supabase.co";
          fullUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1${fullUrl}`;
        }
        setResolvedUrl(fullUrl);
      } else {
        // Fallback to public URL
        const { data: pubData } = supabase.storage
          .from("client-documents")
          .getPublicUrl(cleanPath);

        if (pubData?.publicUrl) {
          setResolvedUrl(pubData.publicUrl);
        } else {
          throw signErr || new Error("Could not resolve document storage URL");
        }
      }
    } catch (err: any) {
      console.error("Document preview URL resolution failed:", err);
      setLoadError(err.message || "Unable to access document from cloud storage");
    } finally {
      setIsLoadingUrl(false);
    }
  }, [fileUrlOrPath]);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      resolveFileUrl();
    } else {
      setResolvedUrl(null);
      setLoadError(null);
    }
  }, [isOpen, resolveFileUrl]);

  if (!isOpen) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Download handler
  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch {
      // Fallback: direct window download
      window.open(resolvedUrl, "_blank");
    }
  };

  // Open in new tab handler
  const handleOpenNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isVerified = verificationStatus === "VERIFIED" || verificationStatus === "APPROVED";
  const isRejected = verificationStatus === "REJECTED" || verificationStatus === "REPLACEMENT_REQUESTED";
  const isReuploaded = verificationStatus === "RE_UPLOADED" || (verificationStatus === "PENDING" && Boolean(rejectionReason));

  return (
    <div
      className="modal-backdrop-overlay"
      style={{
        zIndex: 10000,
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 25, 51, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          width: "95%",
          maxWidth: 1040,
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
          border: "1px solid #CBD5E1",
          overflow: "hidden"
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#FFF5ED",
                border: "1px solid #FFEDD5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <FileText size={22} color="#F05A22" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {documentTitle}
                </h3>
                {isVerified ? (
                  <span
                    style={{
                      background: "#DCFCE7",
                      color: "#166534",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <CheckCircle size={12} /> Verified
                  </span>
                ) : isRejected ? (
                  <span
                    style={{
                      background: "#FEE2E2",
                      color: "#991B1B",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <AlertTriangle size={12} /> Rejected / Re-upload Required
                  </span>
                ) : isReuploaded ? (
                  <span
                    style={{
                      background: "#EFF6FF",
                      color: "#1E40AF",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <RefreshCw size={12} /> Re-uploaded
                  </span>
                ) : (
                  <span
                    style={{
                      background: "#FEF3C7",
                      color: "#92400E",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    Pending Review
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                <strong style={{ color: "#334155" }}>{fileName}</strong>
                {fileSize ? ` • ${fileSize}` : ""}
                {uploadedAt ? ` • Uploaded ${new Date(uploadedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                color: "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Close Viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Rejection notice banner if document is rejected */}
        {isRejected && rejectionReason && (
          <div
            style={{
              padding: "10px 24px",
              background: "#FEF2F2",
              borderBottom: "1px solid #FECACA",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: "#991B1B"
            }}
          >
            <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
            <div>
              <strong>Rejection Reason:</strong> {rejectionReason}
            </div>
          </div>
        )}

        {/* Toolbar Controls */}
        <div
          style={{
            padding: "8px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#FFFFFF",
            flexWrap: "wrap",
            gap: 8
          }}
        >
          {/* Zoom and Rotate controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: zoom <= 0.5 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
              title="Zoom Out"
            >
              <ZoomOut size={14} /> Zoom -
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                padding: "0 6px",
                minWidth: 46,
                textAlign: "center"
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3.0}
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: zoom >= 3.0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
              title="Zoom In"
            >
              <ZoomIn size={14} /> Zoom +
            </button>

            <button
              onClick={handleRotate}
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginLeft: 4
              }}
              title="Rotate 90° Clockwise"
            >
              <RotateCw size={14} /> Rotate
            </button>

            <button
              onClick={handleResetZoom}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 12,
                color: "#64748B",
                cursor: "pointer",
                textDecoration: "underline",
                marginLeft: 4
              }}
            >
              Reset
            </button>
          </div>

          {/* Download & External Tab controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={!resolvedUrl}
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#0F172A",
                cursor: resolvedUrl ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Download size={14} /> Download File
            </button>

            <button
              onClick={handleOpenNewTab}
              disabled={!resolvedUrl}
              style={{
                background: "#0B1933",
                border: "1px solid #0B1933",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                cursor: resolvedUrl ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <ExternalLink size={14} /> Open in New Tab
            </button>
          </div>
        </div>

        {/* Viewer Content Area */}
        <div
          style={{
            flex: 1,
            background: "#F1F5F9",
            overflow: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            padding: 16
          }}
        >
          {isLoadingUrl ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Loader2 size={36} color="#F05A22" className="animate-spin" />
              <p style={{ fontSize: 14, color: "#64748B", fontWeight: 600, margin: 0 }}>
                Retrieving secure document from storage...
              </p>
            </div>
          ) : loadError ? (
            <div
              style={{
                background: "#FFFFFF",
                padding: "24px 32px",
                borderRadius: 12,
                border: "1px solid #FECACA",
                textAlign: "center",
                maxWidth: 440
              }}
            >
              <AlertCircle size={36} color="#DC2626" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ fontSize: 16, fontWeight: 700, color: "#991B1B", margin: "0 0 6px" }}>
                Preview Not Available
              </h4>
              <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>{loadError}</p>
              <button
                onClick={resolveFileUrl}
                style={{
                  background: "#F05A22",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Retry Loading
              </button>
            </div>
          ) : isPdf ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out"
              }}
            >
              <iframe
                src={resolvedUrl || ""}
                title={documentTitle}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "560px",
                  border: "none",
                  borderRadius: 8,
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
                }}
              />
            </div>
          ) : (
            <div
              style={{
                overflow: "auto",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img
                src={resolvedUrl || ""}
                alt={documentTitle}
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out"
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer with Verification Actions */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC"
          }}
        >
          <div style={{ fontSize: 13, color: "#64748B" }}>
            Review every mandatory document before approving client registration.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canReject && !isRejected && onReject && (
              <button
                type="button"
                onClick={onReject}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <AlertTriangle size={15} /> Reject / Request Re-upload
              </button>
            )}

            {canVerify && !isVerified && onVerify && (
              <button
                type="button"
                onClick={onVerify}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#16A34A",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <ShieldCheck size={15} /> Verify Document
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#334155",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
