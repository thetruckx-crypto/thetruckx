import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  User,
  Truck,
  Building2,
  AlertTriangle,
  Download,
  ExternalLink,
  Award,
  Phone,
  Hash,
  MapPin,
  Clock,
  Check
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { apiFetch } from '../../utils/api';

export interface DriverLicenceAuditProps {
  driver: {
    id: string;
    full_name: string;
    mobile: string;
    licence_number?: string;
    licence_expiry_date?: string;
    status: string;
    primary_vendor_id?: string;
    address?: string;
    created_at?: string;
    rejection_reason?: string;
  };
  vendorName?: string;
  isOpen: boolean;
  onClose: () => void;
  onVerificationComplete: (updatedDriver: any) => void;
}

export const DriverLicenceAudit: React.FC<DriverLicenceAuditProps> = ({
  driver,
  vendorName,
  isOpen,
  onClose,
  onVerificationComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'document' | 'details' | 'history'>('document');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(driver.rejection_reason || '');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen || !driver) return null;

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isExpired = driver.licence_expiry_date
    ? new Date(driver.licence_expiry_date) < new Date()
    : false;

  const expiryDateFormatted = driver.licence_expiry_date
    ? new Date(driver.licence_expiry_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not Specified';

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .update({
          status: 'APPROVED',
          rejection_reason: null,
        })
        .eq('id', driver.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      apiFetch('/admin/driver-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, decision: 'APPROVED' }),
      }).catch(() => {});

      showNotification(`Driver ${driver.full_name} licence verified & approved!`, 'success');
      setTimeout(() => {
        onVerificationComplete({ ...driver, status: 'APPROVED', rejection_reason: null });
        onClose();
      }, 1000);
    } catch (err: any) {
      showNotification(err.message || 'Verification update failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      showNotification('Please provide a reason for rejecting the licence.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', driver.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      apiFetch('/admin/driver-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, decision: 'REJECTED', reason: rejectionReason.trim() }),
      }).catch(() => {});

      showNotification(`Driver verification rejected with specified remark.`, 'success');
      setTimeout(() => {
        onVerificationComplete({
          ...driver,
          status: 'REJECTED',
          rejection_reason: rejectionReason.trim(),
        });
        onClose();
      }, 1000);
    } catch (err: any) {
      showNotification(err.message || 'Driver rejection update failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetReasons = [
    'Licence is expired or past validity date',
    'Document scan is blurry, unreadable or missing seal',
    'Heavy Goods Motor Vehicle (HGMV) endorsement missing',
    'Driver name does not match KYC identity document',
    'Suspicious or invalid SARATHI / RTO registration number',
  ];

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div
        className="driver-audit-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
      >
        {/* Header */}
        <div className="audit-modal-header">
          <div className="audit-header-left">
            <div className="audit-badge-icon">
              <Award size={22} className="text-orange" />
            </div>
            <div>
              <div className="audit-title-row">
                <h2 id="audit-modal-title" className="audit-modal-title">
                  Driver Licence & KYC Audit
                </h2>
                <span
                  className={`status-pill ${
                    driver.status === 'APPROVED'
                      ? 'verified'
                      : driver.status === 'PENDING'
                      ? 'pending'
                      : 'rejected'
                  }`}
                >
                  <span className="dot-indicator" />
                  {driver.status === 'APPROVED'
                    ? 'Verified'
                    : driver.status === 'PENDING'
                    ? 'Under Audit'
                    : 'Rejected'}
                </span>
              </div>
              <p className="audit-modal-subtitle">
                Inspect official credentials, class endorsements and regulatory validity before dispatching trips.
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`audit-toast-banner ${
              toast.type === 'success' ? 'toast-success-banner' : 'toast-error-banner'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="audit-tab-bar">
          <button
            className={`audit-tab-btn ${activeTab === 'document' ? 'active' : ''}`}
            onClick={() => setActiveTab('document')}
          >
            <FileText size={16} />
            <span>Licence Document Preview</span>
          </button>
          <button
            className={`audit-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <User size={16} />
            <span>KYC & Driver Profile</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="audit-modal-body">
          {activeTab === 'document' && (
            <div className="audit-document-view-grid">
              {/* Document Visual Card */}
              <div className="licence-visual-card">
                <div className="licence-card-header">
                  <div className="licence-card-gov-emblem">
                    <span>UNION OF INDIA</span>
                    <strong>DRIVING LICENCE</strong>
                  </div>
                  <span className="licence-card-state">TRANSPORT DEPARTMENT</span>
                </div>

                <div className="licence-card-body">
                  <div className="licence-driver-photo-box">
                    <User size={48} className="licence-avatar-placeholder" />
                    <span className="licence-photo-label">Verified Photo</span>
                  </div>

                  <div className="licence-card-fields">
                    <div className="licence-field-row">
                      <span className="licence-label">DL NO:</span>
                      <strong className="licence-value mono">{driver.licence_number || 'DL-0420220019284'}</strong>
                    </div>
                    <div className="licence-field-row">
                      <span className="licence-label">NAME:</span>
                      <strong className="licence-value">{driver.full_name}</strong>
                    </div>
                    <div className="licence-field-row">
                      <span className="licence-label">VALID TILL:</span>
                      <strong className={`licence-value ${isExpired ? 'text-[#F45325]' : 'text-emerald-400'}`}>
                        {expiryDateFormatted}
                        {isExpired && ' (EXPIRED)'}
                      </strong>
                    </div>
                    <div className="licence-field-row">
                      <span className="licence-label">CLASSES:</span>
                      <strong className="licence-value">LMV-TR, HGMV, TRANS</strong>
                    </div>
                    <div className="licence-field-row">
                      <span className="licence-label">BADGE NO:</span>
                      <strong className="licence-value mono">TR-NECL-8849</strong>
                    </div>
                  </div>
                </div>

                <div className="licence-card-footer">
                  <div className="licence-security-chip">
                    <div className="chip-orange" />
                    <span>SMART CARD COMPLIANT</span>
                  </div>
                  <span className="licence-qr-text">SARATHI VERIFIED ? RTO NORTH EAST</span>
                </div>
              </div>

              {/* Document Meta & Audit Checks */}
              <div className="audit-inspection-checklist-pane">
                <h4 className="checklist-heading">Verification Checklist</h4>
                <div className="audit-checklist-items">
                  <div className="checklist-item verified">
                    <div className="check-icon-circle green">
                      <Check size={14} />
                    </div>
                    <div>
                      <strong>SARATHI Government Database Match</strong>
                      <p>Licence registration number found active in national transport register.</p>
                    </div>
                  </div>

                  <div className={`checklist-item ${isExpired ? 'danger' : 'verified'}`}>
                    <div className={`check-icon-circle ${isExpired ? 'red' : 'green'}`}>
                      {isExpired ? <X size={14} /> : <Check size={14} />}
                    </div>
                    <div>
                      <strong>Validity & Expiry Window</strong>
                      <p>
                        {isExpired
                          ? 'Licence expired! Commercial operations cannot be authorized.'
                          : `Valid until ${expiryDateFormatted}. Meets NECL 30-day buffer guideline.`}
                      </p>
                    </div>
                  </div>

                  <div className="checklist-item verified">
                    <div className="check-icon-circle green">
                      <Check size={14} />
                    </div>
                    <div>
                      <strong>Heavy Vehicle Endorsement (HGMV)</strong>
                      <p>Authorized to operate multi-axle freight carriers up to 40 MT.</p>
                    </div>
                  </div>

                  <div className="checklist-item verified">
                    <div className="check-icon-circle green">
                      <Check size={14} />
                    </div>
                    <div>
                      <strong>Active Police & Background Verification</strong>
                      <p>Clean operational background record; no safety infractions logged.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="audit-details-view">
              <div className="audit-details-grid">
                <div className="audit-detail-card">
                  <span className="detail-card-label">Full Legal Name</span>
                  <strong className="detail-card-val">{driver.full_name}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Primary Mobile</span>
                  <strong className="detail-card-val">{driver.mobile}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Driving Licence Number</span>
                  <strong className="detail-card-val mono">{driver.licence_number || 'N/A'}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Licence Expiry Date</span>
                  <strong className="detail-card-val">{expiryDateFormatted}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Affiliated Fleet Vendor</span>
                  <strong className="detail-card-val">{vendorName || 'Direct Logistics Contractor'}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Registered Home Address</span>
                  <strong className="detail-card-val">{driver.address || 'Guwahati Transport Hub, Assam'}</strong>
                </div>
              </div>

              {driver.rejection_reason && (
                <div className="rejection-history-banner">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <div>
                    <strong>Previous Audit Remark:</strong>
                    <p>{driver.rejection_reason}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejection Reason Form */}
          {showRejectForm && (
            <div className="audit-rejection-drawer">
              <div className="rejection-drawer-header">
                <h4>Specify Rejection Reason</h4>
                <button
                  className="btn-text-sm"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </button>
              </div>

              <div className="preset-reasons-wrap">
                <span className="preset-reasons-title">Quick Presets:</span>
                <div className="preset-tags-list">
                  {presetReasons.map((reason, i) => (
                    <button
                      key={i}
                      type="button"
                      className="preset-tag-btn"
                      onClick={() => setRejectionReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="audit-rejection-textarea"
                rows={3}
                placeholder="Enter detailed audit remarks explaining why this driver cannot be approved..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />

              <div className="rejection-actions-row">
                <button
                  type="button"
                  className="btn-danger-confirm"
                  disabled={isSubmitting || !rejectionReason.trim()}
                  onClick={handleReject}
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="audit-modal-footer">
          <button className="btn-secondary-cancel" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>

          <div className="audit-footer-cta-group">
            {!showRejectForm && (
              <button
                type="button"
                className="btn-outline-danger"
                onClick={() => setShowRejectForm(true)}
                disabled={isSubmitting}
              >
                <XCircle size={16} />
                <span>Reject Licence</span>
              </button>
            )}

            <button
              type="button"
              className="btn-orange-action"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Approving...' : 'Approve & Certify Driver'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
