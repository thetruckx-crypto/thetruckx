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
  AlertTriangle,
  FileSpreadsheet,
  File,
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
  mimeType?: string;
  onVerify?: () => void;
  onReject?: () => void;
  canVerify?: boolean;
  canReject?: boolean;
}

type FileCategory = "pdf" | "image" | "word" | "excel" | "other";

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
  mimeType,
  onVerify,
  onReject,
  canVerify = true,
  canReject = true,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMissingInStorage, setIsMissingInStorage] = useState<boolean>(false);
  const [imageFailedToRender, setImageFailedToRender] = useState<boolean>(false);

  // Zoom and rotation state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Determine file format category
  const detectFileCategory = useCallback((): FileCategory => {
    const raw = `${fileName || ""} ${fileUrlOrPath || ""} ${mimeType || ""}`.toLowerCase();
    if (raw.includes(".pdf") || raw.includes("application/pdf")) {
      return "pdf";
    }
    if (
      raw.includes(".jpg") ||
      raw.includes(".jpeg") ||
      raw.includes(".png") ||
      raw.includes(".webp") ||
      raw.includes(".svg") ||
      raw.includes(".gif") ||
      raw.includes("image/")
    ) {
      return "image";
    }
    if (
      raw.includes(".doc") ||
      raw.includes(".docx") ||
      raw.includes("msword") ||
      raw.includes("wordprocessingml")
    ) {
      return "word";
    }
    if (
      raw.includes(".xls") ||
      raw.includes(".xlsx") ||
      raw.includes(".csv") ||
      raw.includes("ms-excel") ||
      raw.includes("spreadsheetml")
    ) {
      return "excel";
    }
    return "other";
  }, [fileName, fileUrlOrPath, mimeType]);

  const fileCategory = detectFileCategory();

  // Clean filename for display and download
  const cleanDisplayFileName = fileName || fileUrlOrPath?.split("/").pop() || "document";

  // Fetch real, secure signed URL from Supabase Storage with bucket auto-discovery
  const resolveFileUrl = useCallback(async () => {
    if (!fileUrlOrPath || fileUrlOrPath.trim() === "") {
      setLoadError("No document file path or storage reference found in database record.");
      setIsMissingInStorage(true);
      setIsLoadingUrl(false);
      return;
    }

    setIsLoadingUrl(true);
    setLoadError(null);
    setIsMissingInStorage(false);
    setImageFailedToRender(false);

    try {
      const supabaseUrl =
        (supabase as any).supabaseUrl ||
        (import.meta as any).env?.VITE_SUPABASE_URL ||
        "https://nbsgmorzrccbyfmjbvgx.supabase.co";

      // 1. If it's already a full signed URL with active token
      if (fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://")) {
        // If it's a broken public URL to a private bucket, extract path and sign it properly
        if (fileUrlOrPath.includes("/storage/v1/object/public/")) {
          const parts = fileUrlOrPath.split("/storage/v1/object/public/")[1].split("/");
          const bucket = parts.shift() || "client-documents";
          const subPath = parts.join("/");
          const { data: signRes } = await supabase.storage.from(bucket).createSignedUrl(subPath, 86400);
          if (signRes?.signedUrl) {
            let fullSigned = signRes.signedUrl;
            if (!fullSigned.startsWith("http")) {
              fullSigned = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1${fullSigned}`;
            }
            // Verify file availability via HEAD
            const check = await fetch(fullSigned, { method: "HEAD" }).catch(() => null);
            if (check && (check.status === 404 || check.status === 400)) {
              setIsMissingInStorage(true);
              setLoadError(
                "Document file is missing from cloud storage. The database record exists, but the physical file was not successfully uploaded. Please request the user to re-upload."
              );
              setIsLoadingUrl(false);
              return;
            }
            setResolvedUrl(fullSigned);
            setIsLoadingUrl(false);
            return;
          }
        }

        // Test if existing HTTP/signed URL is accessible
        const check = await fetch(fileUrlOrPath, { method: "HEAD" }).catch(() => null);
        if (check && (check.status === 404 || check.status === 400)) {
          // Object not found at this URL
          setIsMissingInStorage(true);
          setLoadError(
            "Document file is missing from cloud storage. The database record exists, but the physical file was not successfully uploaded. Please request the user to re-upload."
          );
          setIsLoadingUrl(false);
          return;
        }

        setResolvedUrl(fileUrlOrPath);
        setIsLoadingUrl(false);
        return;
      }

      // 2. Clean storage path
      let cleanPath = fileUrlOrPath.replace(/^\/+/, "");
      // If path accidentally starts with a known bucket name, strip it
      for (const b of ["client-documents/", "vendor-documents/", "driver-documents/", "documents/"]) {
        if (cleanPath.startsWith(b)) {
          cleanPath = cleanPath.slice(b.length);
        }
      }

      // Candidate buckets to try in priority order
      const candidateBuckets = ["client-documents", "vendor-documents", "documents"];

      let validSignedUrl: string | null = null;
      let foundInStorage = false;

      for (const bucket of candidateBuckets) {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(cleanPath, 86400); // 24-hour validity

          if (data?.signedUrl) {
            let fullUrl = data.signedUrl;
            if (!fullUrl.startsWith("http")) {
              fullUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1${fullUrl}`;
            }

            // Verify if object actually exists in this bucket via HEAD request
            const headRes = await fetch(fullUrl, { method: "HEAD" }).catch(() => null);
            if (headRes && headRes.status === 200) {
              validSignedUrl = fullUrl;
              foundInStorage = true;
              break;
            } else if (headRes && headRes.status === 404) {
              // 404 in this bucket, try next bucket
              continue;
            } else if (!headRes) {
              // Network/CORS fallback: keep signed URL if fetch failed due to CORS preflight
              validSignedUrl = fullUrl;
            }
          }
        } catch {
          // Continue to next bucket
        }
      }

      if (foundInStorage && validSignedUrl) {
        setResolvedUrl(validSignedUrl);
      } else if (validSignedUrl) {
        // Fallback: Check if file physically exists before assuming it's available
        const headCheck = await fetch(validSignedUrl, { method: "HEAD" }).catch(() => null);
        if (headCheck && (headCheck.status === 404 || headCheck.status === 400)) {
          setIsMissingInStorage(true);
          setLoadError(
            "Document file is missing from cloud storage. The database record exists, but the physical file was not successfully uploaded. Please request the user to re-upload."
          );
        } else {
          setResolvedUrl(validSignedUrl);
        }
      } else {
        setIsMissingInStorage(true);
        setLoadError(
          "Document file not found in storage bucket. The storage reference does not map to an existing file. Please request a re-upload."
        );
      }
    } catch (err: any) {
      console.error("Document preview URL resolution failed:", err);
      setLoadError(err.message || "Unable to access document from cloud storage");
      setIsMissingInStorage(true);
    } finally {
      setIsLoadingUrl(false);
    }
  }, [fileUrlOrPath]);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setImageFailedToRender(false);
      setIsMissingInStorage(false);
      resolveFileUrl();
    } else {
      setResolvedUrl(null);
      setLoadError(null);
      setImageFailedToRender(false);
      setIsMissingInStorage(false);
    }
  }, [isOpen, resolveFileUrl]);

  if (!isOpen) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 3.0));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.5));
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
      if (!response.ok) throw new Error("File not reachable for download");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = cleanDisplayFileName;
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
  const isRejected =
    verificationStatus === "REJECTED" ||
    verificationStatus === "REPLACEMENT_REQUESTED" ||
    verificationStatus === "RE_UPLOAD_REQUESTED";
  const isReuploaded =
    verificationStatus === "RE_UPLOADED" ||
    (verificationStatus === "PENDING" && Boolean(rejectionReason));

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
        padding: 16,
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
          maxWidth: 1060,
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
          border: "1px solid #CBD5E1",
          overflow: "hidden",
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
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background:
                  fileCategory === "excel"
                    ? "#ECFDF5"
                    : fileCategory === "word"
                    ? "#EFF6FF"
                    : fileCategory === "pdf"
                    ? "#FFF1F2"
                    : "#FFF5ED",
                border: `1px solid ${
                  fileCategory === "excel"
                    ? "#A7F3D0"
                    : fileCategory === "word"
                    ? "#BFDBFE"
                    : fileCategory === "pdf"
                    ? "#FECDD3"
                    : "#FFEDD5"
                }`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {fileCategory === "excel" ? (
                <FileSpreadsheet size={22} color="#059669" />
              ) : fileCategory === "word" ? (
                <FileText size={22} color="#2563EB" />
              ) : fileCategory === "pdf" ? (
                <FileText size={22} color="#E11D48" />
              ) : (
                <FileText size={22} color="#F05A22" />
              )}
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
                      gap: 4,
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
                      gap: 4,
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
                      gap: 4,
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
                      gap: 4,
                    }}
                  >
                    Pending Review
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                <strong style={{ color: "#334155" }}>{cleanDisplayFileName}</strong>
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
                justifyContent: "center",
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
              color: "#991B1B",
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
            gap: 8,
          }}
        >
          {/* Zoom and Rotate controls (For Images & PDF) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {fileCategory === "image" || fileCategory === "pdf" ? (
              <>
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
                    gap: 4,
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
                    textAlign: "center",
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
                    gap: 4,
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
                    marginLeft: 4,
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
                    marginLeft: 4,
                  }}
                >
                  Reset
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                {fileCategory === "word"
                  ? "Microsoft Word Document"
                  : fileCategory === "excel"
                  ? "Microsoft Excel Spreadsheet"
                  : "Document Attachment"}
              </span>
            )}
          </div>

          {/* Download & External Tab controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={!resolvedUrl || isMissingInStorage}
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#0F172A",
                cursor: resolvedUrl && !isMissingInStorage ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: resolvedUrl && !isMissingInStorage ? 1 : 0.6,
              }}
            >
              <Download size={14} /> Download File
            </button>

            <button
              onClick={handleOpenNewTab}
              disabled={!resolvedUrl || isMissingInStorage}
              style={{
                background: "#0B1933",
                border: "1px solid #0B1933",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#FFFFFF",
                cursor: resolvedUrl && !isMissingInStorage ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: resolvedUrl && !isMissingInStorage ? 1 : 0.6,
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
            padding: 16,
          }}
        >
          {isLoadingUrl ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Loader2 size={36} color="#F05A22" className="animate-spin" />
              <p style={{ fontSize: 14, color: "#64748B", fontWeight: 600, margin: 0 }}>
                Retrieving secure document from storage...
              </p>
            </div>
          ) : isMissingInStorage || imageFailedToRender || loadError ? (
            <div
              style={{
                background: "#FFFFFF",
                padding: "32px 36px",
                borderRadius: 14,
                border: "1px solid #FECACA",
                boxShadow: "0 10px 25px rgba(220, 38, 38, 0.08)",
                textAlign: "center",
                maxWidth: 520,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <AlertTriangle size={28} color="#DC2626" />
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: "#991B1B", margin: "0 0 8px" }}>
                Document File Not Available in Storage
              </h4>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 20px" }}>
                {loadError ||
                  `The database record references "${cleanDisplayFileName}", but the actual file is inaccessible or missing from storage. Please request the user to re-upload.`}
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={resolveFileUrl}
                  style={{
                    background: "#F1F5F9",
                    color: "#334155",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={14} /> Retry Loading
                </button>
                {canReject && onReject && (
                  <button
                    type="button"
                    onClick={onReject}
                    style={{
                      background: "#DC2626",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={14} /> Request Re-upload from User
                  </button>
                )}
              </div>
            </div>
          ) : fileCategory === "pdf" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out",
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
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              />
            </div>
          ) : fileCategory === "image" ? (
            <div
              style={{
                overflow: "auto",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={resolvedUrl || ""}
                alt={documentTitle}
                onError={() => {
                  console.warn("Image load error in DocumentPreviewModal for:", resolvedUrl);
                  setImageFailedToRender(true);
                  setLoadError("The document image could not be loaded from storage. It may be corrupted or missing.");
                }}
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
              />
            </div>
          ) : fileCategory === "word" ? (
            /* Microsoft Word Document Card */
            <div
              style={{
                background: "#FFFFFF",
                padding: "36px 40px",
                borderRadius: 16,
                border: "1px solid #BFDBFE",
                boxShadow: "0 10px 30px rgba(37, 99, 235, 0.08)",
                textAlign: "center",
                maxWidth: 520,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.25)",
                }}
              >
                <FileText size={32} color="#FFFFFF" />
              </div>
              <h4 style={{ fontSize: 18, fontWeight: 800, color: "#1E3A8A", margin: "0 0 6px" }}>
                Microsoft Word Document
              </h4>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: "0 0 12px" }}>
                {cleanDisplayFileName}
              </p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 24px", lineHeight: 1.5 }}>
                Word documents cannot be embedded directly in standard web canvases. Use the secure download button below to inspect this document on your device.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    background: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Download size={16} /> Download Word File
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  style={{
                    background: "#F1F5F9",
                    color: "#1E3A8A",
                    border: "1px solid #BFDBFE",
                    borderRadius: 8,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ExternalLink size={16} /> Open
                </button>
              </div>
            </div>
          ) : fileCategory === "excel" ? (
            /* Microsoft Excel Spreadsheet Card */
            <div
              style={{
                background: "#FFFFFF",
                padding: "36px 40px",
                borderRadius: 16,
                border: "1px solid #A7F3D0",
                boxShadow: "0 10px 30px rgba(5, 150, 105, 0.08)",
                textAlign: "center",
                maxWidth: 520,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 8px 20px rgba(16, 185, 129, 0.25)",
                }}
              >
                <FileSpreadsheet size={32} color="#FFFFFF" />
              </div>
              <h4 style={{ fontSize: 18, fontWeight: 800, color: "#064E3B", margin: "0 0 6px" }}>
                Microsoft Excel Spreadsheet
              </h4>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: "0 0 12px" }}>
                {cleanDisplayFileName}
              </p>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 24px", lineHeight: 1.5 }}>
                Spreadsheet data cannot be rendered inline securely. Download the file to review full rows, formulas, and columns in Microsoft Excel or Google Sheets.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    background: "#059669",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Download size={16} /> Download Spreadsheet
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  style={{
                    background: "#F1F5F9",
                    color: "#065F46",
                    border: "1px solid #A7F3D0",
                    borderRadius: 8,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ExternalLink size={16} /> Open
                </button>
              </div>
            </div>
          ) : (
            /* Generic Document Card */
            <div
              style={{
                background: "#FFFFFF",
                padding: "36px 40px",
                borderRadius: 16,
                border: "1px solid #CBD5E1",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
                textAlign: "center",
                maxWidth: 480,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  background: "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <File size={30} color="#475569" />
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                {documentTitle}
              </h4>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 20px" }}>
                {cleanDisplayFileName}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  background: "#0B1933",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Download size={16} /> Download File
              </button>
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
            background: "#F8FAFC",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "#64748B" }}>
            Review every mandatory document before approving account registration.
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
                  gap: 6,
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
                  gap: 6,
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
                cursor: "pointer",
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
