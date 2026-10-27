import React, { useState, useEffect } from 'react';
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
  Check,
  RefreshCw,
  Eye,
  Maximize2,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { apiFetch } from '../../utils/api';
import { formatDisplayId } from '../../utils/idGenerator';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

export interface DriverLicenceAuditProps {
  driver: {
    id: string;
    full_name: string;
    mobile: string;
    phone?: string;
    licence_number?: string;
    licence_expiry_date?: string;
    date_of_birth?: string;
    dob?: string;
    status: string;
    primary_vendor_id?: string;
    address?: string;
    created_at?: string;
    rejection_reason?: string;
    driver_code?: string;
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
  const [rejectionReason, setRejectionReason] = useState(driver?.rejection_reason || '');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    fileName: string;
    fileUrlOrPath: string;
    verificationStatus?: string;
    rejectionReason?: string;
    uploadedAt?: string;
    fileSize?: string;
    mimeType?: string;
  } | null>(null);

  // Vendor Re-association State
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(driver?.primary_vendor_id || '');
  const [isUpdatingVendor, setIsUpdatingVendor] = useState(false);

  // Fetch Documents and Vendors when modal opens
  useEffect(() => {
    if (!isOpen || !driver?.id) return;

    setSelectedVendorId(driver.primary_vendor_id || '');
    setRejectionReason(driver.rejection_reason || '');

    const fetchAuditData = async () => {
      setLoadingDocs(true);
      try {
        const [docsRes, vendorsRes] = await Promise.all([
          supabase
            .from('documents')
            .select('*')
            .eq('reference_id', driver.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('vendor_companies')
            .select('id, vendor_name, vendor_code, city, status')
            .order('vendor_name', { ascending: true }),
        ]);

        if (docsRes.data) {
          setDocuments(docsRes.data);
        }
        if (vendorsRes.data) {
          setAvailableVendors(vendorsRes.data);
        }
      } catch (err: any) {
        console.warn('Error loading driver audit data:', err.message);
      } finally {
        setLoadingDocs(false);
      }
    };

    fetchAuditData();
  }, [isOpen, driver?.id]);

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

  const dobFormatted = driver.date_of_birth || driver.dob
    ? new Date(driver.date_of_birth || driver.dob!).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not Specified';

  const submissionDateFormatted = driver.created_at
    ? new Date(driver.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not Specified';

  // Find documents by type and side
  const dlFrontDoc = documents.find(
    (d) =>
      d.document_type === 'LICENCE' &&
      (d.doc_side === 'FRONT' || d.file_name?.toLowerCase().includes('front'))
  ) || documents.find((d) => d.document_type === 'LICENCE');

  const dlBackDoc = documents.find(
    (d) =>
      d.document_type === 'LICENCE' &&
      (d.doc_side === 'BACK' || d.file_name?.toLowerCase().includes('back')) &&
      d.id !== dlFrontDoc?.id
  );

  const aadhaarFrontDoc = documents.find(
    (d) =>
      d.document_type === 'AADHAAR' &&
      (d.doc_side === 'FRONT' || d.file_name?.toLowerCase().includes('front'))
  ) || documents.find((d) => d.document_type === 'AADHAAR');

  const aadhaarBackDoc = documents.find(
    (d) =>
      d.document_type === 'AADHAAR' &&
      (d.doc_side === 'BACK' || d.file_name?.toLowerCase().includes('back')) &&
      d.id !== aadhaarFrontDoc?.id
  );

  // Status mapping
  const normalizedStatus =
    driver.status === 'APPROVED'
      ? 'Approved'
      : driver.status === 'REJECTED'
      ? 'Rejected'
      : 'Pending Approval';

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

      if (error) throw error;

      // Also update documents status
      await supabase
        .from('documents')
        .update({ verification_status: 'VERIFIED' })
        .eq('reference_id', driver.id);

      apiFetch('/admin/driver-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, decision: 'APPROVED' }),
      }).catch(() => {});

      showNotification(`Driver ${driver.full_name} approved successfully! Account is now active.`, 'success');
      setTimeout(() => {
        onVerificationComplete({
          ...driver,
          status: 'APPROVED',
          rejection_reason: null,
          primary_vendor_id: selectedVendorId,
        });
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
      showNotification('Please enter a rejection reason before rejecting.', 'error');
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

      if (error) throw error;

      // Update documents status
      await supabase
        .from('documents')
        .update({ verification_status: 'REJECTED', rejection_reason: rejectionReason.trim() })
        .eq('reference_id', driver.id);

      apiFetch('/admin/driver-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          decision: 'REJECTED',
          reason: rejectionReason.trim(),
        }),
      }).catch(() => {});

      showNotification(`Driver registration marked as Rejected.`, 'success');
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

  const handleUpdateVendorAssociation = async () => {
    if (!selectedVendorId) {
      showNotification('Please choose a valid vendor.', 'error');
      return;
    }

    setIsUpdatingVendor(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ primary_vendor_id: selectedVendorId })
        .eq('id', driver.id);

      if (error) throw error;

      const newVendor = availableVendors.find((v) => v.id === selectedVendorId);
      showNotification(
        `Driver successfully associated with ${newVendor?.vendor_name || 'selected vendor'}!`,
        'success'
      );
      onVerificationComplete({
        ...driver,
        primary_vendor_id: selectedVendorId,
      });
    } catch (err: any) {
      showNotification(err.message || 'Failed to update vendor association.', 'error');
    } finally {
      setIsUpdatingVendor(false);
    }
  };

  const presetReasons = [
    'Licence is expired or past validity date',
    'Driving Licence front/back scan is blurry or unreadable',
    'Aadhaar card front/back scan is incomplete or missing corners',
    'Driver name on DL does not match Aadhaar KYC document',
    'Heavy Goods Motor Vehicle (HGMV) endorsement missing',
    'Unverified or inactive connected vendor association',
  ];

  const renderDocPreviewCard = (
    title: string,
    sideLabel: string,
    docItem?: any,
    placeholderIcon: React.ReactNode = <FileText size={32} color="#94A3B8" />
  ) => {
    const hasDoc = Boolean(docItem && (docItem.file_url || docItem.storage_path));
    const isPdf = Boolean(
      (docItem?.file_name || docItem?.storage_path || docItem?.file_url || '')
        .toLowerCase()
        .includes('.pdf')
    );

    const handleOpenPreview = () => {
      if (!docItem) return;
      setPreviewDoc({
        title: `${title} (${sideLabel})`,
        fileName: docItem.file_name || `${title}.${isPdf ? 'pdf' : 'jpg'}`,
        fileUrlOrPath: docItem.storage_path || docItem.file_url || '',
        verificationStatus: docItem.verification_status,
        rejectionReason: docItem.rejection_reason,
        uploadedAt: docItem.created_at,
        fileSize: docItem.file_size,
        mimeType: docItem.mime_type,
      });
    };

    return (
      <div
        className="audit-doc-card"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ fontSize: '13px', color: '#172B4D' }}>{title}</strong>
            <span
              style={{
                display: 'inline-block',
                marginLeft: '8px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#F1F5F9',
                color: '#475569',
              }}
            >
              {sideLabel}
            </span>
          </div>
          {docItem ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: docItem.verification_status === 'VERIFIED' ? '#166534' : '#F05A22',
                background: docItem.verification_status === 'VERIFIED' ? '#DCFCE7' : '#FFF7ED',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              {docItem.verification_status === 'VERIFIED' ? 'Verified' : 'Attached'}
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                color: '#EF4444',
                background: '#FEE2E2',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              Missing
            </span>
          )}
        </div>

        {/* Thumbnail Preview Card */}
        <div
          onClick={hasDoc ? handleOpenPreview : undefined}
          style={{
            width: '100%',
            height: '140px',
            background: hasDoc ? '#F8FAFC' : '#F8FAFC',
            borderRadius: '8px',
            border: hasDoc ? '1px solid #CBD5E1' : '1px dashed #CBD5E1',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: hasDoc ? 'pointer' : 'default',
            transition: 'border-color 0.15s ease',
          }}
        >
          {hasDoc ? (
            <>
              {isPdf ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <FileText size={32} color="#E11D48" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E11D48' }}>PDF Document</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Click to preview</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Eye size={28} color="#2563EB" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>Document Image</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Click to open full preview</span>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPreview();
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Maximize2 size={12} />
                <span>Preview</span>
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              {placeholderIcon}
              <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#94A3B8' }}>
                No document file uploaded
              </p>
            </div>
          )}
        </div>

        {/* Document Metadata */}
        <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
            {docItem?.file_name || 'driver_doc.jpg'}
          </span>
          <span>{docItem?.file_size || '300 KB'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div
        className="driver-audit-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
        style={{ maxWidth: '860px', width: '92%' }}
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
                  Driver Licence & Registration Audit
                </h2>
                <span
                  className={`status-pill ${
                    driver.status === 'APPROVED'
                      ? 'verified'
                      : driver.status === 'PENDING' || driver.status === 'PENDING_APPROVAL'
                      ? 'pending'
                      : 'rejected'
                  }`}
                >
                  <span className="dot-indicator" />
                  {normalizedStatus}
                </span>
              </div>
              <p className="audit-modal-subtitle">
                Review submitted driver identity credentials, driving licence front & back, Aadhaar front & back, and fleet vendor association before authorization.
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Toast Notification */}
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
            <span>Licence & Aadhaar Previews ({documents.length} docs)</span>
          </button>
          <button
            className={`audit-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <User size={16} />
            <span>Profile & Vendor Association</span>
          </button>
          <button
            className={`audit-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} />
            <span>Approval History & Logs</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="audit-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {/* TAB 1: DOCUMENT PREVIEWS */}
          {activeTab === 'document' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Driving Licence Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Award size={18} color="#F05A22" />
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                    1. Driving Licence Upload (Front & Back)
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {renderDocPreviewCard('Driving Licence', 'Front Side', dlFrontDoc)}
                  {renderDocPreviewCard('Driving Licence', 'Back Side', dlBackDoc)}
                </div>
              </div>

              {/* Aadhaar Card Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={18} color="#166534" />
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                    2. Aadhaar Card Upload (Front & Back)
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {renderDocPreviewCard('Aadhaar Card', 'Front Side', aadhaarFrontDoc)}
                  {renderDocPreviewCard('Aadhaar Card', 'Back Side', aadhaarBackDoc)}
                </div>
              </div>

              {/* Regulatory Checklist */}
              <div className="audit-inspection-checklist-pane" style={{ marginTop: '10px' }}>
                <h4 className="checklist-heading">Sarathi & KYC Verification Checklist</h4>
                <div className="audit-checklist-items">
                  <div className="checklist-item verified">
                    <div className="check-icon-circle green">
                      <Check size={14} />
                    </div>
                    <div>
                      <strong>Document Completeness Verified</strong>
                      <p>Driving Licence front/back and Aadhaar front/back scans received for compliance review.</p>
                    </div>
                  </div>

                  <div className={`checklist-item ${isExpired ? 'danger' : 'verified'}`}>
                    <div className={`check-icon-circle ${isExpired ? 'red' : 'green'}`}>
                      {isExpired ? <X size={14} /> : <Check size={14} />}
                    </div>
                    <div>
                      <strong>Licence Expiry & Validity Window</strong>
                      <p>
                        {isExpired
                          ? 'Licence expired! Commercial operations cannot be authorized.'
                          : `Valid until ${expiryDateFormatted}. Meets national logistics carrier criteria.`}
                      </p>
                    </div>
                  </div>

                  <div className="checklist-item verified">
                    <div className="check-icon-circle green">
                      <Check size={14} />
                    </div>
                    <div>
                      <strong>Vendor Fleet Eligibility</strong>
                      <p>Associated with active registered vendor: {vendorName || 'Selected Vendor'}.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE & VENDOR ASSOCIATION */}
          {activeTab === 'details' && (
            <div className="audit-details-view">
              <div className="audit-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div className="audit-detail-card">
                  <span className="detail-card-label">Full Legal Name</span>
                  <strong className="detail-card-val">{driver.full_name}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Mobile Phone Number</span>
                  <strong className="detail-card-val">{driver.mobile || driver.phone}</strong>
                </div>

                <div className="audit-detail-card">
                  <span className="detail-card-label">Date of Birth (DOB)</span>
                  <strong className="detail-card-val">{dobFormatted}</strong>
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
                  <span className="detail-card-label">Registration Submission Date</span>
                  <strong className="detail-card-val">{submissionDateFormatted}</strong>
                </div>

                <div className="audit-detail-card" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-card-label">Current Registration Status</span>
                  <strong className="detail-card-val" style={{
                    color: driver.status === 'APPROVED' ? '#166534' : driver.status === 'REJECTED' ? '#DC2626' : '#C2410C'
                  }}>
                    {normalizedStatus}
                  </strong>
                </div>
              </div>

              {/* Vendor Association & Reassignment Card */}
              <div style={{
                marginTop: '18px',
                background: '#FFF7ED',
                border: '1.5px solid #FDBA74',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Building2 size={18} color="#F05A22" />
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                    Connected Vendor Association
                  </h4>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748B' }}>
                  Review and update the driver's connected fleet vendor where authorized. Selecting a vendor associates the driver with their commercial dispatch operations.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    style={{
                      flex: 1,
                      height: '40px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      padding: '0 12px',
                      fontSize: '13px',
                      background: '#FFFFFF',
                      color: '#1E293B'
                    }}
                  >
                    <option value="">-- Choose Connected Vendor --</option>
                    {availableVendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendor_name} ({v.vendor_code || formatDisplayId('VD', v.id)}) {v.city ? `• ${v.city}` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleUpdateVendorAssociation}
                    disabled={isUpdatingVendor || selectedVendorId === driver.primary_vendor_id}
                    style={{
                      height: '40px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      background: '#F05A22',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: isUpdatingVendor || selectedVendorId === driver.primary_vendor_id ? 'not-allowed' : 'pointer',
                      opacity: selectedVendorId === driver.primary_vendor_id ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={13} className={isUpdatingVendor ? 'spin' : ''} />
                    <span>{isUpdatingVendor ? 'Updating...' : 'Update Vendor'}</span>
                  </button>
                </div>
              </div>

              {driver.rejection_reason && (
                <div className="rejection-history-banner" style={{ marginTop: '16px' }}>
                  <AlertTriangle size={18} className="text-amber-500" />
                  <div>
                    <strong>Previous Audit Remark / Rejection Reason:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px' }}>{driver.rejection_reason}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: APPROVAL HISTORY & LOGS */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', color: '#172B4D' }}>Initial Registration Submission</strong>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>{submissionDateFormatted}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                  Driver registration form submitted from mobile app with DL and Aadhaar front/back scans. Status set to Pending Approval.
                </p>
              </div>

              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', color: '#172B4D' }}>Current Status: {normalizedStatus}</strong>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: driver.status === 'APPROVED' ? '#DCFCE7' : driver.status === 'REJECTED' ? '#FEE2E2' : '#FFF7ED',
                    color: driver.status === 'APPROVED' ? '#166534' : driver.status === 'REJECTED' ? '#DC2626' : '#C2410C'
                  }}>
                    {driver.status}
                  </span>
                </div>
                {driver.rejection_reason ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#DC2626' }}>
                    <strong>Rejection Reason:</strong> {driver.rejection_reason}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                    {driver.status === 'APPROVED'
                      ? 'Driver has been audited and approved by NECL Admin. Account is active.'
                      : 'Application awaiting admin audit and verification decision.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason Drawer */}
          {showRejectForm && (
            <div className="audit-rejection-drawer" style={{ marginTop: '16px' }}>
              <div className="rejection-drawer-header">
                <h4>Specify Rejection Reason (Mandatory)</h4>
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
                placeholder="Enter detailed audit remark explaining why this driver registration is rejected so the driver can correct and resubmit..."
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
            {!showRejectForm && driver.status !== 'REJECTED' && (
              <button
                type="button"
                className="btn-outline-danger"
                onClick={() => setShowRejectForm(true)}
                disabled={isSubmitting}
              >
                <XCircle size={16} />
                <span>Reject Registration</span>
              </button>
            )}

            <button
              type="button"
              className="btn-orange-action"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Approving...' : 'Approve & Activate Driver'}</span>
            </button>
          </div>
        </div>

        {/* Full Interactive Document Preview Modal */}
        {previewDoc && (
          <DocumentPreviewModal
            isOpen={Boolean(previewDoc)}
            onClose={() => setPreviewDoc(null)}
            documentTitle={previewDoc.title}
            fileName={previewDoc.fileName}
            fileUrlOrPath={previewDoc.fileUrlOrPath}
            verificationStatus={previewDoc.verificationStatus}
            rejectionReason={previewDoc.rejectionReason}
            uploadedAt={previewDoc.uploadedAt}
            fileSize={previewDoc.fileSize}
            mimeType={previewDoc.mimeType}
            canVerify={false}
            canReject={false}
          />
        )}
      </div>
    </div>
  );
};
