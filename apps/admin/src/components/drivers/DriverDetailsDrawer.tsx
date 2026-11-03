import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Calendar,
  CreditCard,
  Building2,
  Truck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  MapPin,
  ExternalLink,
  Edit2,
  Check,
  AlertCircle,
  Zap,
  SlidersHorizontal,
  Eye,
  FileCheck,
  ArrowRight,
  Shield,
  Activity,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { formatDisplayId } from '../../utils/idGenerator';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

export interface DriverDetailsDrawerProps {
  isOpen: boolean;
  driver: any | null;
  vendorName: string;
  vendorDetails?: any | null;
  assignedVehicle?: any | null;
  activeTrip?: any | null;
  onClose: () => void;
  onEditDriver: (driver: any) => void;
  onAssignVehicle: (driver: any) => void;
  onUpdateTransportStatus: (driver: any) => void;
  onApproveDriver: (driver: any) => Promise<void>;
  onRejectDriver: (driver: any, reason: string) => Promise<void>;
  onRefreshData: () => void;
  onNavigateToVendorProfile?: (vendorId: string) => void;
}

export const DriverDetailsDrawer: React.FC<DriverDetailsDrawerProps> = ({
  isOpen,
  driver,
  vendorName,
  vendorDetails,
  assignedVehicle,
  activeTrip,
  onClose,
  onEditDriver,
  onAssignVehicle,
  onUpdateTransportStatus,
  onApproveDriver,
  onRejectDriver,
  onRefreshData,
  onNavigateToVendorProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'fleet' | 'trips' | 'audit'>('overview');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Approval & Rejection State
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(driver?.rejection_reason || '');
  const [actionError, setActionError] = useState<string | null>(null);

  // Document action state
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  // Load Driver Documents
  useEffect(() => {
    if (!isOpen || !driver?.id) return;
    setActionError(null);
    setShowRejectInput(false);
    setRejectionReason(driver.rejection_reason || '');

    const fetchDocs = async () => {
      setLoadingDocs(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('reference_id', driver.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setDocuments(data);
        } else {
          setDocuments([]);
        }
      } catch (err: any) {
        console.warn('Error fetching driver documents for drawer:', err.message);
        setDocuments([]);
      } finally {
        setLoadingDocs(false);
      }
    };

    fetchDocs();
  }, [isOpen, driver?.id]);

  if (!isOpen || !driver) return null;

  // Licence calculations
  const calculateLicence = () => {
    if (!driver.licence_expiry_date) {
      return { status: 'MISSING', label: 'Missing Expiry Date', color: 'red', daysLeft: -999 };
    }
    const today = new Date();
    const expiry = new Date(driver.licence_expiry_date);
    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { status: 'EXPIRED', label: 'Expired', color: 'red', daysLeft };
    }
    if (daysLeft <= 30) {
      return { status: 'EXPIRING_SOON', label: `Expiring Soon (${daysLeft}d left)`, color: 'amber', daysLeft };
    }
    return { status: 'VALID', label: 'Valid', color: 'green', daysLeft };
  };

  const licenceInfo = calculateLicence();

  // Age calculations
  const calculateAge = (dobString?: string) => {
    if (!dobString) return { age: null, text: 'Not Specified', eligible: false };
    try {
      const birth = new Date(dobString);
      if (isNaN(birth.getTime())) return { age: null, text: 'Invalid Date', eligible: false };
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return {
        age,
        text: `${age} years old`,
        eligible: age >= 18,
      };
    } catch {
      return { age: null, text: 'Not Specified', eligible: false };
    }
  };

  const ageInfo = calculateAge(driver.date_of_birth || driver.dob);

  // Document status summary
  const dlDocs = documents.filter((d) => d.document_type === 'LICENCE');
  const aadhaarDocs = documents.filter((d) => d.document_type === 'AADHAAR');
  const dlFront = dlDocs.find((d) => d.doc_side === 'FRONT') || dlDocs[0];
  const dlBack = dlDocs.find((d) => d.doc_side === 'BACK') || dlDocs[1];
  const aadhaarFront = aadhaarDocs.find((d) => d.doc_side === 'FRONT') || aadhaarDocs[0];
  const aadhaarBack = aadhaarDocs.find((d) => d.doc_side === 'BACK') || aadhaarDocs[1];

  const totalMandatoryDocs = 4; // DL Front, DL Back, Aadhaar Front, Aadhaar Back
  const uploadedCount = [dlFront, dlBack, aadhaarFront, aadhaarBack].filter(Boolean).length;
  const verifiedCount = [dlFront, dlBack, aadhaarFront, aadhaarBack].filter(
    (d) => d && (d.verification_status === 'APPROVED' || d.verification_status === 'VERIFIED')
  ).length;

  const handleUpdateDocumentStatus = async (
    docId: string,
    newStatus: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED',
    reason?: string
  ) => {
    setProcessingDocId(docId);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          verification_status: newStatus,
          rejection_reason: reason || null,
          verified_at: new Date().toISOString(),
          verified_by: 'Admin Desk',
        })
        .eq('id', docId);

      if (error) throw error;

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                verification_status: newStatus,
                rejection_reason: reason || null,
                verified_at: new Date().toISOString(),
              }
            : d
        )
      );
      onRefreshData();
    } catch (err: any) {
      alert(`Failed to update document status: ${err.message}`);
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleApproveClick = async () => {
    setActionError(null);
    if (licenceInfo.status === 'EXPIRED') {
      setActionError('Cannot approve driver: Driving Licence has expired.');
      return;
    }
    if (!driver.primary_vendor_id) {
      setActionError('Cannot approve driver: Connected Vendor must be assigned before approval.');
      return;
    }

    setIsApproving(true);
    try {
      await onApproveDriver(driver);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve driver');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClick = async () => {
    if (!rejectionReason.trim()) {
      setActionError('Please provide a specific rejection reason.');
      return;
    }
    setIsRejecting(true);
    try {
      await onRejectDriver(driver, rejectionReason.trim());
      setShowRejectInput(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject driver');
    } finally {
      setIsRejecting(false);
    }
  };

  const isApproved = driver.status === 'APPROVED';
  const isRejected = driver.status === 'REJECTED';
  const isPending = driver.status === 'PENDING' || driver.status === 'PENDING_APPROVAL';

  // Derived Transport Status
  const getTransportStatusBadge = () => {
    if (driver.is_active === false) {
      return { label: 'Inactive', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' };
    }
    if (activeTrip) {
      if (['DISPATCHED', 'IN_TRANSIT', 'AT_LOADING'].includes(activeTrip.trip_status)) {
        return { label: 'On Trip', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
      }
      if (activeTrip.trip_status === 'LORRY_ASSIGNED') {
        return { label: 'Assigned to Trip', bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' };
      }
    }
    if (driver.rejection_reason?.startsWith('STATUS:')) {
      const custom = driver.rejection_reason.replace('STATUS:', '');
      if (custom === 'NOT_TAKING_TRANSPORT') {
        return { label: 'Not Taking Transport', bg: '#FFF7ED', color: '#C2410C', border: '#FFEDD5' };
      }
      if (custom === 'TEMP_UNAVAILABLE') {
        return { label: 'Temporarily Unavailable', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' };
      }
    }
    return { label: 'Available for Transport', bg: '#ECFDF5', color: '#16A34A', border: '#A7F3D0' };
  };

  const transportBadge = getTransportStatusBadge();
  const driverDisplayId = formatDisplayId('DR', driver.driver_code || driver.id, driver.created_at);

  return (
    <>
      <div className="vfv-backdrop" onClick={onClose}>
        <div className="vfv-drawer" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="vfv-header">
            <div className="vfv-breadcrumb-row">
              <div className="vfv-breadcrumbs">
                <span>Drivers</span>
                <span className="vfv-breadcrumb-sep">›</span>
                <span>Verification Queue</span>
                <span className="vfv-breadcrumb-sep">›</span>
                <span className="vfv-breadcrumb-active">{driver.full_name}</span>
              </div>
              <button
                className="vfv-close-btn"
                onClick={onClose}
                aria-label="Close driver drawer"
                id="btn-close-driver-drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <div>
                <h2 className="vfv-title" style={{ margin: '0 0 6px 0' }}>
                  {driver.full_name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="vfv-plate-badge">
                    <span className="vfv-plate-ind">IND</span>
                    <span className="vfv-plate-number">{driverDisplayId}</span>
                  </div>
                  <span className="vfv-meta-dot">•</span>
                  <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
                    {vendorName}
                  </span>
                </div>
              </div>

              {/* Header Quick Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="vfv-edit-btn"
                  onClick={() => onEditDriver(driver)}
                  title="Edit driver profile"
                  id="btn-drawer-edit-driver"
                >
                  <Edit2 size={13} />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  className="vfv-edit-btn"
                  onClick={() => onAssignVehicle(driver)}
                  title="Assign or change vehicle"
                  id="btn-drawer-assign-veh"
                >
                  <Truck size={13} />
                  <span>Assign Vehicle</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              padding: '0 24px',
              gap: 20,
              flexShrink: 0,
            }}
          >
            {[
              { key: 'overview', label: 'Overview & Details', icon: User },
              { key: 'documents', label: `Documents (${verifiedCount}/${totalMandatoryDocs})`, icon: FileText },
              { key: 'fleet', label: 'Vendor & Vehicle', icon: Truck },
              { key: 'trips', label: 'Transport & Trips', icon: Zap },
              { key: 'audit', label: 'Audit Trail', icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 2px',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#F05A22' : '#64748B',
                    borderBottom: isActive ? '2px solid #F05A22' : '2px solid transparent',
                    background: 'none',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Body */}
          <div className="vfv-body">
            {actionError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#991B1B',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{actionError}</span>
              </div>
            )}

            {/* 4 Status Cards */}
            <div className="vfv-status-grid">
              {/* Card 1: Account Status */}
              <div className="vfv-status-card">
                <div
                  className={`vfv-status-icon-circle ${
                    isApproved ? 'green' : isPending ? 'amber' : 'red'
                  }`}
                >
                  {isApproved ? <CheckCircle2 size={16} /> : isPending ? <Clock size={16} /> : <XCircle size={16} />}
                </div>
                <div className="vfv-status-info">
                  <div className="vfv-status-label">Verification</div>
                  <div className="vfv-status-val">
                    {isApproved ? 'Approved' : isPending ? 'Pending Review' : 'Rejected'}
                  </div>
                </div>
              </div>

              {/* Card 2: Licence Status */}
              <div className="vfv-status-card">
                <div
                  className={`vfv-status-icon-circle ${
                    licenceInfo.status === 'VALID' ? 'green' : licenceInfo.status === 'EXPIRING_SOON' ? 'amber' : 'red'
                  }`}
                >
                  <CreditCard size={16} />
                </div>
                <div className="vfv-status-info">
                  <div className="vfv-status-label">Licence Validity</div>
                  <div className="vfv-status-val">{licenceInfo.label}</div>
                </div>
              </div>

              {/* Card 3: Assigned Vehicle */}
              <div className="vfv-status-card">
                <div className={`vfv-status-icon-circle ${assignedVehicle ? 'blue' : 'gray'}`}>
                  <Truck size={16} />
                </div>
                <div className="vfv-status-info">
                  <div className="vfv-status-label">Assigned Lorry</div>
                  <div className="vfv-status-val" style={{ fontFamily: 'monospace' }}>
                    {assignedVehicle?.registration_number || 'Not Assigned'}
                  </div>
                </div>
              </div>

              {/* Card 4: Transport Status */}
              <div className="vfv-status-card">
                <div className="vfv-status-icon-circle green">
                  <Activity size={16} />
                </div>
                <div className="vfv-status-info">
                  <div className="vfv-status-label">Availability</div>
                  <div className="vfv-status-val">{transportBadge.label}</div>
                </div>
              </div>
            </div>

            {/* Tab 1: Overview & Details */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Personal & Contact Details */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Personal & Identity Information</div>
                  </div>
                  <div className="vfv-info-grid">
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Full Legal Name</div>
                      <div className="vfv-info-value font-semibold">{driver.full_name}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Mobile Number</div>
                      <div className="vfv-info-value font-mono">{driver.mobile || driver.phone || '—'}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Date of Birth & Age</div>
                      <div className="vfv-info-value">
                        {driver.date_of_birth || driver.dob
                          ? `${new Date(driver.date_of_birth || driver.dob).toLocaleDateString('en-IN')} (${ageInfo.text})`
                          : '—'}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Driving Licence (DL)</div>
                      <div className="vfv-info-value font-mono font-bold text-slate-800">
                        {driver.licence_number || '—'}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">DL Expiry Date</div>
                      <div className="vfv-info-value font-mono">
                        {driver.licence_expiry_date
                          ? new Date(driver.licence_expiry_date).toLocaleDateString('en-IN')
                          : 'Not Specified'}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Registration Date</div>
                      <div className="vfv-info-value">
                        {driver.created_at ? new Date(driver.created_at).toLocaleDateString('en-IN') : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address & Emergency Contact */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Residential & Emergency Contact</div>
                  </div>
                  <div className="vfv-info-grid">
                    <div className="vfv-info-row" style={{ gridColumn: 'span 2' }}>
                      <div className="vfv-info-label">Residential Address</div>
                      <div className="vfv-info-value">
                        {driver.address || 'Address not registered on file'}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">City & State</div>
                      <div className="vfv-info-value">
                        {driver.city ? `${driver.city}, ${driver.state || 'Assam'}` : driver.state || '—'}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Pincode</div>
                      <div className="vfv-info-value">{driver.pincode || '—'}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Emergency Contact Name</div>
                      <div className="vfv-info-value">{driver.emergency_contact_name || '—'}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Emergency Contact Phone</div>
                      <div className="vfv-info-value font-mono">{driver.emergency_contact_phone || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Documents & KYC */}
            {activeTab === 'documents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      Identity & Driving Licence Verification
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                      Inspect original uploads and approve or reject documents individually.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: verifiedCount === totalMandatoryDocs ? '#ECFDF5' : '#FFFBEB',
                      color: verifiedCount === totalMandatoryDocs ? '#16A34A' : '#D97706',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    {verifiedCount}/{totalMandatoryDocs} Verified
                  </span>
                </div>

                {loadingDocs ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Loading verification documents...</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {[
                      { key: 'dl_front', label: 'Driving Licence — Front', doc: dlFront, required: true },
                      { key: 'dl_back', label: 'Driving Licence — Back', doc: dlBack, required: true },
                      { key: 'aadhaar_front', label: 'Aadhaar Card — Front', doc: aadhaarFront, required: true },
                      { key: 'aadhaar_back', label: 'Aadhaar Card — Back', doc: aadhaarBack, required: true },
                    ].map((item) => {
                      const doc = item.doc;
                      const hasDoc = Boolean(doc);
                      const isDocApproved = doc?.verification_status === 'APPROVED' || doc?.verification_status === 'VERIFIED';
                      const isDocRejected = doc?.verification_status === 'REJECTED';

                      return (
                        <div
                          key={item.key}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: 10,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                                {item.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  background: !hasDoc
                                    ? '#FEE2E2'
                                    : isDocApproved
                                    ? '#ECFDF5'
                                    : isDocRejected
                                    ? '#FEF2F2'
                                    : '#FEF3C7',
                                  color: !hasDoc
                                    ? '#991B1B'
                                    : isDocApproved
                                    ? '#16A34A'
                                    : isDocRejected
                                    ? '#EF4444'
                                    : '#D97706',
                                }}
                              >
                                {!hasDoc ? 'Missing' : isDocApproved ? 'Verified' : isDocRejected ? 'Rejected' : 'Pending'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 11.5, color: '#64748B', wordBreak: 'break-all' }}>
                              {doc?.file_name || 'No document file uploaded yet'}
                            </p>
                          </div>

                          {hasDoc ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDoc({
                                    documentTitle: item.label,
                                    fileName: doc.file_name || item.label,
                                    fileUrlOrPath: doc.file_url || doc.storage_path,
                                    verificationStatus: doc.verification_status,
                                    rejectionReason: doc.rejection_reason,
                                    uploadedAt: doc.created_at,
                                    fileSize: doc.file_size,
                                    mimeType: doc.mime_type,
                                    onVerify: () => handleUpdateDocumentStatus(doc.id, 'APPROVED'),
                                    onReject: () => handleUpdateDocumentStatus(doc.id, 'REJECTED', 'Admin rejection'),
                                  })
                                }
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 4,
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #CBD5E1',
                                  background: '#F8FAFC',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                <Eye size={13} />
                                <span>Preview</span>
                              </button>

                              {!isDocApproved && (
                                <button
                                  type="button"
                                  disabled={processingDocId === doc.id}
                                  onClick={() => handleUpdateDocumentStatus(doc.id, 'APPROVED')}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: '#10B981',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                  title="Approve document"
                                >
                                  <Check size={13} />
                                </button>
                              )}

                              {!isDocRejected && (
                                <button
                                  type="button"
                                  disabled={processingDocId === doc.id}
                                  onClick={() => {
                                    const r = prompt('Enter rejection reason for this document:');
                                    if (r) handleUpdateDocumentStatus(doc.id, 'REJECTED', r);
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: '#EF4444',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                  title="Reject document"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#EF4444', fontStyle: 'italic' }}>
                              ⚠️ Mandatory compliance document missing
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Vendor & Vehicle */}
            {activeTab === 'fleet' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Vendor Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Connected Transporter / Vendor</div>
                    {onNavigateToVendorProfile && driver.primary_vendor_id && (
                      <button
                        type="button"
                        onClick={() => onNavigateToVendorProfile(driver.primary_vendor_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#F05A22',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>View Vendor</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                  <div className="vfv-info-grid">
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Transporter Name</div>
                      <div className="vfv-info-value font-semibold text-slate-800">{vendorName}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Vendor Code</div>
                      <div className="vfv-info-value font-mono">
                        {vendorDetails?.vendor_code || (driver.primary_vendor_id ? `VD-${driver.primary_vendor_id.slice(0, 6).toUpperCase()}` : '—')}
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Hub / City</div>
                      <div className="vfv-info-value">{vendorDetails?.city || vendorDetails?.address || 'Guwahati Hub'}</div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Vendor Status</div>
                      <div className="vfv-info-value">
                        <span className="status-badge-pastel active">
                          {vendorDetails?.status || 'Active Transporter'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Vehicle Card */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Assigned Fleet Vehicle</div>
                    <button
                      type="button"
                      className="vfv-edit-btn"
                      onClick={() => onAssignVehicle(driver)}
                    >
                      <Truck size={13} />
                      <span>{assignedVehicle ? 'Change Assignment' : 'Assign Vehicle'}</span>
                    </button>
                  </div>
                  {assignedVehicle ? (
                    <div className="vfv-info-grid">
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Registration Plate</div>
                        <div className="vfv-info-value font-mono font-bold text-slate-900 text-sm">
                          {assignedVehicle.registration_number}
                        </div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Vehicle Category</div>
                        <div className="vfv-info-value">{assignedVehicle.vehicle_type || 'Standard Lorry'}</div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Body Type</div>
                        <div className="vfv-info-value">{assignedVehicle.body_type || 'Open Body'}</div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Rated Capacity</div>
                        <div className="vfv-info-value">
                          {assignedVehicle.rated_capacity_mt ? `${assignedVehicle.rated_capacity_mt} MT` : '—'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', background: '#F8FAFC', borderRadius: 8 }}>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B' }}>
                        No commercial vehicle currently assigned to this driver.
                      </p>
                      <button
                        type="button"
                        onClick={() => onAssignVehicle(driver)}
                        style={{
                          background: '#F05A22',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Assign Eligible Lorry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Transport & Trips */}
            {activeTab === 'trips' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Operational Availability Status</div>
                    <button
                      type="button"
                      className="vfv-edit-btn"
                      onClick={() => onUpdateTransportStatus(driver)}
                    >
                      <SlidersHorizontal size={13} />
                      <span>Update Status</span>
                    </button>
                  </div>
                  <div className="vfv-info-grid">
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Current Availability</div>
                      <div className="vfv-info-value">
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            background: transportBadge.bg,
                            color: transportBadge.color,
                            border: `1px solid ${transportBadge.border}`,
                          }}
                        >
                          {transportBadge.label}
                        </span>
                      </div>
                    </div>
                    <div className="vfv-info-row">
                      <div className="vfv-info-label">Account Active</div>
                      <div className="vfv-info-value font-semibold">
                        {driver.is_active !== false ? 'Yes (Enabled for dispatch)' : 'No (Suspended)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Trip Info */}
                <div className="vfv-card">
                  <div className="vfv-card-header">
                    <div className="vfv-card-title">Active Freight Dispatch / Trip</div>
                  </div>
                  {activeTrip ? (
                    <div className="vfv-info-grid">
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Trip Reference ID</div>
                        <div className="vfv-info-value font-mono font-semibold">
                          #{activeTrip.id.slice(0, 8).toUpperCase()}
                        </div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Trip Status</div>
                        <div className="vfv-info-value">
                          <span className="status-badge-pastel active">{activeTrip.trip_status}</span>
                        </div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Assigned Vehicle</div>
                        <div className="vfv-info-value font-mono">
                          {activeTrip.vehicle?.registration_number || assignedVehicle?.registration_number || '—'}
                        </div>
                      </div>
                      <div className="vfv-info-row">
                        <div className="vfv-info-label">Started Timestamp</div>
                        <div className="vfv-info-value">
                          {activeTrip.started_at ? new Date(activeTrip.started_at).toLocaleString('en-IN') : 'En Route / Active'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', background: '#F8FAFC', borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                        No active freight trip ongoing. Driver is ready for fresh dispatch allocation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Audit Trail */}
            {activeTab === 'audit' && (
              <div className="vfv-card">
                <div className="vfv-card-header">
                  <div className="vfv-card-title">Verification Audit Trail & Security Log</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F05A22', marginTop: 6 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Driver Record Registered</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>
                        Created on {driver.created_at ? new Date(driver.created_at).toLocaleString('en-IN') : '—'}
                      </div>
                    </div>
                  </div>

                  {driver.verified_at && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', marginTop: 6 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Driver Approval Decision</div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          Verified by {driver.verified_by || 'Admin Desk'} on{' '}
                          {new Date(driver.verified_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  )}

                  {driver.rejection_reason && !driver.rejection_reason.startsWith('STATUS:') && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', marginTop: 6 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>Rejection Recorded</div>
                        <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                          Reason: {driver.rejection_reason}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer Actions */}
          <div
            style={{
              padding: '16px 24px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
            }}
          >
            {showRejectInput ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <input
                  type="text"
                  placeholder="Enter rejection reason..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                  }}
                />
                <button
                  type="button"
                  disabled={isRejecting}
                  onClick={handleRejectClick}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#DC2626',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    background: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    id="btn-drawer-reject-driver"
                  >
                    <XCircle size={15} />
                    <span>Reject Driver</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>

                  {!isApproved && (
                    <button
                      type="button"
                      disabled={isApproving}
                      onClick={handleApproveClick}
                      style={{
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#10B981',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isApproving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: isApproving ? 0.7 : 1,
                      }}
                      id="btn-drawer-approve-driver"
                    >
                      <CheckCircle2 size={16} />
                      <span>{isApproving ? 'Approving...' : 'Approve Driver'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Document Full Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          documentTitle={previewDoc.documentTitle}
          fileName={previewDoc.fileName}
          fileUrlOrPath={previewDoc.fileUrlOrPath}
          verificationStatus={previewDoc.verificationStatus}
          rejectionReason={previewDoc.rejectionReason}
          uploadedAt={previewDoc.uploadedAt}
          fileSize={previewDoc.fileSize}
          mimeType={previewDoc.mimeType}
          onVerify={previewDoc.onVerify}
          onReject={previewDoc.onReject}
        />
      )}
    </>
  );
};
