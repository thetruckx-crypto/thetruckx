import React, { useState } from 'react';
import {
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useToast } from '../../context/ToastContext';

interface DocumentRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: string;
    name: string;
  };
  document?: {
    id?: string;
    type: string;
    fileName?: string;
    uploadedAt?: string;
  } | null;
  onRejectSuccess: (rejectionData: { reasons: string[]; comments: string }) => void;
}

const APPROVED_REASONS = [
  'Document is expired',
  'Invalid document format',
  'Document is unclear / not readable',
  'Missing required information',
  'Incorrect document type',
  'Incomplete document (missing pages)',
  'Mismatched vendor details',
  'Other (Please specify)'
];

export const DocumentRejectionModal: React.FC<DocumentRejectionModalProps> = ({
  isOpen,
  onClose,
  vendor,
  document,
  onRejectSuccess,
}) => {
  const toast = useToast();
  const [selectedReasons, setSelectedReasons] = useState<string[]>(['Document is expired']);
  const [comments, setComments] = useState<string>('The transport license has expired. Please upload a valid and updated license.');
  const [notifyVendor, setNotifyVendor] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleReason = (reason: string) => {
    setValidationError(null);
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedReasons.length === 0) {
      setValidationError('Please select at least one rejection reason.');
      return;
    }

    if (!comments.trim()) {
      setValidationError('Additional comments and explanation are mandatory for rejection.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const fullReasonText = `${selectedReasons.join(', ')} — ${comments.trim()}`;

      // 1. If rejecting a specific document from documents table
      if (document?.id) {
        const { error: docErr } = await supabase
          .from('documents')
          .update({
            verification_status: 'REJECTED',
            rejection_reason: fullReasonText,
            verified_by: 'USR-ADM-002',
          })
          .eq('id', document.id);

        if (docErr) {
          console.warn('Document record update note:', docErr);
        }
      }

      // 2. Update Vendor Company Status to REJECTED in database
      const { error: vendorUpdateErr } = await supabase
        .from('vendor_companies')
        .update({
          status: 'REJECTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (vendorUpdateErr) throw vendorUpdateErr;

      onRejectSuccess({
        reasons: selectedReasons,
        comments: comments.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to submit rejection:', err);
      setValidationError(err.message || 'Failed to update database with rejection details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const docTitle = document?.type || 'Transport License';
  const docFileName = document?.fileName || `transport_license_${vendor.name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
  const uploadDate = document?.uploadedAt || '10 Sep 2026, 11:24 AM';

  return (
    <div className="rejection-modal-backdrop" onClick={onClose}>
      <div className="rejection-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rejection-modal-header">
          <div>
            <h3 className="rejection-modal-title">Reject Document</h3>
            <p className="rejection-modal-subtitle">
              Provide the reason for rejection so the vendor can re-upload the correct document.
            </p>
          </div>
          <button className="rejection-modal-close" onClick={onClose} title="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirmRejection}>
          {/* Document Preview Card */}
          <div className="rejection-doc-preview-card">
            <div className="doc-preview-left">
              <div className="doc-preview-thumb">
                <FileText size={28} className="doc-thumb-icon" />
              </div>
              <div className="doc-preview-info">
                <div className="doc-preview-title-row">
                  <span className="doc-preview-name">{docTitle}</span>
                  <span className="doc-preview-status-pill rejected">Rejected</span>
                </div>
                <div className="doc-preview-meta">Document Type: {docTitle}</div>
                <div className="doc-preview-meta">File Name: {docFileName}</div>
                <div className="doc-preview-meta">Uploaded On: {uploadDate}</div>
              </div>
            </div>

            <button
              type="button"
              className="btn-view-full-doc"
              onClick={() => toast.info(`Previewing verified document: ${docFileName}`)}
            >
              <ExternalLink size={14} />
              <span>View Full Document</span>
            </button>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="rejection-error-alert">
              <AlertTriangle size={16} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Rejection Reasons Grid */}
          <div className="rejection-form-section">
            <label className="rejection-section-label">
              Rejection Reason <span className="req-star">*</span>
            </label>
            <div className="rejection-section-desc">
              Select the reason for rejection or enter a custom reason.
            </div>

            <div className="rejection-checkbox-grid">
              {APPROVED_REASONS.map((reason) => {
                const isChecked = selectedReasons.includes(reason);
                return (
                  <label
                    key={reason}
                    className={`rejection-checkbox-item ${isChecked ? 'selected' : ''}`}
                    onClick={() => handleToggleReason(reason)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent onClick
                      className="rejection-checkbox-input"
                    />
                    <span className="rejection-checkbox-text">{reason}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Additional Comments */}
          <div className="rejection-form-section">
            <div className="comments-label-row">
              <label className="rejection-section-label">
                Additional Comments <span className="req-star">*</span>
              </label>
              <span className="char-counter">{comments.length}/500</span>
            </div>
            <div className="rejection-section-desc">
              Provide detailed comments to help the vendor re-upload the correct document.
            </div>
            <textarea
              className="rejection-textarea"
              maxLength={500}
              required
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Provide specific notes regarding invalid fields, blurry scans, or missing endorsements..."
            />
          </div>

          {/* Notify Vendor Checkbox and Callout */}
          <div className="rejection-notify-box">
            <label className="notify-checkbox-label">
              <input
                type="checkbox"
                checked={notifyVendor}
                onChange={(e) => setNotifyVendor(e.target.checked)}
                className="rejection-checkbox-input"
              />
              <span className="notify-text">
                Send email and SMS notification to vendor about this rejection.
              </span>
            </label>

            <div className="notify-info-callout">
              <Info size={16} className="callout-icon" />
              <span>
                The vendor will receive this rejection reason and can re-upload the document from their portal.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="rejection-modal-footer">
            <button
              type="button"
              className="btn-cancel-rejection"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-confirm-rejection-red"
              disabled={isSubmitting}
            >
              <XCircle size={16} />
              <span>{isSubmitting ? 'Rejecting...' : 'Reject Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
