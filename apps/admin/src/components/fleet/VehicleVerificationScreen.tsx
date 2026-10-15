import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Upload,
  FileText,
  Calendar,
  Truck,
  MapPin,
  Info,
  Edit2,
  Save,
  X,
  RefreshCw,
  Shield,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  Vehicle,
  VehicleDocument,
  getVehicleById,
  getVehicleDocuments,
  getVehicleDocumentByType,
  approveVehicleDocument,
  rejectVehicleDocument,
  updateVehicleMinimumCapacity,
  approveVehicle,
  rejectVehicle,
  uploadVehicleDocument,
} from '../../services/vehicleService';
import { useToast } from '../../context/ToastContext';
import { formatDisplayId } from '../../utils/idGenerator';

interface VehicleVerificationScreenProps {
  vehicleId: string;
  onBack: () => void;
  onNavigateToTieups: (vehicleId: string) => void;
}

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper to get expiry status
function getExpiryStatus(expiryDate: string | null): {
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_DATE';
  color: string;
  label: string;
  icon: React.ReactNode;
} {
  if (!expiryDate) {
    return {
      status: 'NO_DATE',
      color: 'text-[rgba(17,17,17,0.60)]',
      label: 'No Date',
      icon: <AlertTriangle size={16} />,
    };
  }

  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return {
      status: 'EXPIRED',
      color: 'text-[#F45325]',
      label: `Expired ${Math.abs(daysUntilExpiry)}d ago`,
      icon: <XCircle size={16} />,
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      status: 'EXPIRING_SOON',
      color: 'text-[#F45325]',
      label: `Expires in ${daysUntilExpiry}d`,
      icon: <Clock size={16} />,
    };
  } else {
    return {
      status: 'VALID',
      color: 'text-[#F45325]',
      label: 'Valid',
      icon: <CheckCircle size={16} />,
    };
  }
}

export const VehicleVerificationScreen: React.FC<VehicleVerificationScreenProps> = ({
  vehicleId,
  onBack,
  onNavigateToTieups,
}) => {
  // State
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<{
    RC: VehicleDocument | null;
    INSURANCE: VehicleDocument | null;
    FITNESS: VehicleDocument | null;
    PERMIT: VehicleDocument | null;
  }>({
    RC: null,
    INSURANCE: null,
    FITNESS: null,
    PERMIT: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for minimum capacity
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityValue, setCapacityValue] = useState('');

  // Document preview modal
  const [previewDocument, setPreviewDocument] = useState<VehicleDocument | null>(null);

  // Rejection modal
  const [rejectingDocument, setRejectingDocument] = useState<{
    documentId: string;
    documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT';
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Vehicle rejection modal
  const [showRejectVehicleModal, setShowRejectVehicleModal] = useState(false);
  const [vehicleRejectionReason, setVehicleRejectionReason] = useState('');

  // Success toast
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const toast = useToast();

  // Fetch vehicle and documents
  const fetchVehicleData = async () => {
    try {
      setLoading(true);
      setError(null);

      const vehicleData = await getVehicleById(vehicleId);
      if (!vehicleData) {
        setError('Vehicle not found');
        return;
      }
      setVehicle(vehicleData);
      setCapacityValue(vehicleData.minimum_capacity_mt.toString());

      // Fetch documents
      const [rcDoc, insuranceDoc, fitnessDoc, permitDoc] = await Promise.all([
        getVehicleDocumentByType(vehicleId, 'RC'),
        getVehicleDocumentByType(vehicleId, 'INSURANCE'),
        getVehicleDocumentByType(vehicleId, 'FITNESS'),
        getVehicleDocumentByType(vehicleId, 'PERMIT'),
      ]);

      setDocuments({
        RC: rcDoc,
        INSURANCE: insuranceDoc,
        FITNESS: fitnessDoc,
        PERMIT: permitDoc,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicle data');
      console.error('Error fetching vehicle data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleData();
  }, [vehicleId]);

  // Show success message
  const showSuccess = (message: string) => {
    toast.success(message);
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle approve document
  const handleApproveDocument = async (
    documentId: string,
    documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT'
  ) => {
    try {
      setSaving(true);
      await approveVehicleDocument(documentId, vehicleId, documentType, 'Admin');
      showSuccess(`${documentType} document approved successfully`);
      await fetchVehicleData();
    } catch (err: any) {
      toast.error(`Failed to approve document: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject document
  const handleRejectDocument = async () => {
    if (!rejectingDocument || !rejectionReason.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVehicleDocument(
        rejectingDocument.documentId,
        vehicleId,
        rejectingDocument.documentType,
        rejectionReason,
        'Admin'
      );
      showSuccess(`${rejectingDocument.documentType} document rejected`);
      setRejectingDocument(null);
      setRejectionReason('');
      await fetchVehicleData();
    } catch (err: any) {
      toast.error(`Failed to reject document: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle update minimum capacity
  const handleUpdateCapacity = async () => {
    if (!vehicle) return;

    const newCapacity = parseFloat(capacityValue);
    if (isNaN(newCapacity) || newCapacity <= 0) {
      toast.warning('Please enter a valid capacity');
      return;
    }

    if (newCapacity > vehicle.rated_capacity_mt) {
      toast.warning('Minimum capacity cannot exceed rated capacity');
      return;
    }

    try {
      setSaving(true);
      await updateVehicleMinimumCapacity(vehicleId, newCapacity);
      showSuccess('Minimum capacity updated successfully');
      setEditingCapacity(false);
      await fetchVehicleData();
    } catch (err: any) {
      toast.error(`Failed to update capacity: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle approve vehicle
  const handleApproveVehicle = async () => {
    if (!vehicle) return;

    // Check all documents are approved
    if (
      vehicle.rc_verification_status !== 'APPROVED' ||
      vehicle.insurance_verification_status !== 'APPROVED' ||
      vehicle.fitness_verification_status !== 'APPROVED' ||
      vehicle.permit_verification_status !== 'APPROVED'
    ) {
      toast.warning('All documents must be approved before approving the vehicle');
      return;
    }

    if (!window.confirm('Are you sure you want to approve this vehicle? It will become eligible for operations.')) {
      return;
    }

    try {
      setSaving(true);
      await approveVehicle(vehicleId, 'Admin');
      showSuccess('Vehicle approved successfully');
      await fetchVehicleData();
    } catch (err: any) {
      toast.error(`Failed to approve vehicle: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject vehicle
  const handleRejectVehicle = async () => {
    if (!vehicleRejectionReason.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVehicle(vehicleId, vehicleRejectionReason, 'Admin');
      showSuccess('Vehicle rejected');
      setShowRejectVehicleModal(false);
      setVehicleRejectionReason('');
      await fetchVehicleData();
    } catch (err: any) {
      toast.error(`Failed to reject vehicle: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Document card component
  const DocumentCard = ({
    title,
    documentType,
    document,
    verificationStatus,
    expiryDate,
    additionalInfo,
  }: {
    title: string;
    documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT';
    document: VehicleDocument | null;
    verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    expiryDate: string | null;
    additionalInfo?: string;
  }) => {
    const expiryStatus = getExpiryStatus(expiryDate);

    return (
      <div className="vv-doc-card">
        <div className="vv-doc-header">
          <div className="vv-doc-title-group">
            <div
              className={`vv-doc-status-icon-box ${
                verificationStatus === 'APPROVED'
                  ? 'approved'
                  : verificationStatus === 'REJECTED'
                  ? 'rejected'
                  : 'pending'
              }`}
            >
              {verificationStatus === 'APPROVED' && <CheckCircle size={22} />}
              {verificationStatus === 'REJECTED' && <XCircle size={22} />}
              {verificationStatus === 'PENDING' && <Clock size={22} />}
            </div>
            <div>
              <h3 className="vv-doc-title">{title}</h3>
              <span
                className={`vv-doc-status-pill ${
                  verificationStatus === 'APPROVED'
                    ? 'approved'
                    : verificationStatus === 'REJECTED'
                    ? 'rejected'
                    : 'pending'
                }`}
              >
                {verificationStatus === 'APPROVED' && 'Verified'}
                {verificationStatus === 'REJECTED' && 'Rejected'}
                {verificationStatus === 'PENDING' && 'Pending'}
              </span>
            </div>
          </div>
          {document && (
            <button
              onClick={() => setPreviewDocument(document)}
              className="row-action-btn-circle"
              title="View Document"
            >
              <Eye size={16} />
            </button>
          )}
        </div>

        {additionalInfo && (
          <div className="vv-doc-extra-info">
            <span>{additionalInfo}</span>
          </div>
        )}

        {expiryDate && (
          <div className="vv-doc-expiry-row">
            <Calendar size={15} />
            <span>Valid Until:</span>
            <strong className="vv-doc-expiry-val">{formatDate(expiryDate)}</strong>
            <span className={`doc-expiry-pill ${expiryStatus.status.toLowerCase()}`}>({expiryStatus.label})</span>
          </div>
        )}

        {document ? (
          <div className="vv-doc-action-btns">
            {verificationStatus === 'PENDING' && (
              <>
                <button
                  onClick={() => handleApproveDocument(document.id, documentType)}
                  disabled={saving}
                  className="vv-btn-approve-sm"
                >
                  <CheckCircle size={15} />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() =>
                    setRejectingDocument({
                      documentId: document.id,
                      documentType,
                    })
                  }
                  disabled={saving}
                  className="vv-btn-reject-sm"
                >
                  <XCircle size={15} />
                  <span>Reject</span>
                </button>
              </>
            )}
            {verificationStatus === 'REJECTED' && document.rejection_reason && (
              <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-700">
                  <span className="font-semibold">Rejection Reason:</span> {document.rejection_reason}
                </p>
              </div>
            )}
            {verificationStatus === 'APPROVED' && (
              <div className="w-full flex items-center justify-center gap-2 text-emerald-600 text-sm font-semibold">
                <CheckCircle size={16} />
                <span>Document verified and approved</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 text-sm mb-2 font-semibold">
              <AlertTriangle size={16} />
              <span>Document not uploaded</span>
            </div>
            <p className="text-xs text-amber-600">
              This document needs to be uploaded before verification can proceed
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="text-[#F45325] animate-spin mx-auto mb-4" />
          <p className="text-[rgba(17,17,17,0.60)]">Loading vehicle data...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <XCircle size={48} className="text-[#F45325] mx-auto mb-4" />
          <p className="text-red-400 mb-2">Failed to load vehicle</p>
          <p className="text-[rgba(17,17,17,0.60)] text-sm mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-white text-[#111111] rounded-lg hover:bg-white transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vehicle-verification-page-wrapper">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right">
          <div className="bg-[#F45325] text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="vv-header-section">
        {/* Breadcrumbs */}
        <div className="vv-breadcrumbs">
          <button onClick={onBack} className="hover:text-[#F45325]">
            Fleet & Vehicles
          </button>
          <span>/</span>
          <button onClick={onBack} className="hover:text-[#F45325]">
            Shared Vehicle Master
          </button>
          <span>/</span>
          <span className="text-[#F45325] font-semibold">Vehicle Verification</span>
        </div>

        {/* Title & Actions */}
        <div className="vv-title-row">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="vv-back-btn"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="vv-title">
                Vehicle Verification & Minimum Capacity Setup
              </h1>
              <p className="vv-subtitle">
                Verify vehicle documents, set minimum capacity and manage verification status.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateToTieups(vehicleId)}
              className="vv-btn-outline"
            >
              <Shield size={16} />
              <span>View Tie-ups</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="vv-body-container">
        {/* Vehicle Info Card */}
        <div className="vv-card vv-overview-card">
          <div className="vv-overview-top">
            <div className="vv-truck-avatar">
              <Truck size={36} />
            </div>
            <div className="vv-overview-details">
              <div className="vv-identity-row">
                <div>
                  <h2 className="vv-reg-number font-mono">
                    {vehicle.registration_number}{' '}
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                      ({formatDisplayId('VH', (vehicle as any).vehicle_code || vehicle.id, vehicle.created_at)})
                    </span>
                  </h2>
                  <div className="vv-sub-meta">
                    <span>
                      {vehicle.vehicle_type} • {vehicle.body_type || 'Body type not specified'}
                    </span>
                    {vehicle.make && vehicle.model && (
                      <span>
                        • {vehicle.make} {vehicle.model}
                      </span>
                    )}
                    {vehicle.year_of_manufacture && (
                      <span>• Year: {vehicle.year_of_manufacture}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`status-pill ${
                    vehicle.verification_status === 'APPROVED'
                      ? 'verified'
                      : vehicle.verification_status === 'REJECTED'
                      ? 'rejected'
                      : 'pending'
                  }`}
                >
                  <span className="dot-indicator" />
                  {vehicle.verification_status === 'APPROVED' && 'Approved'}
                  {vehicle.verification_status === 'PENDING_DOCS' && 'Pending Verification'}
                  {vehicle.verification_status === 'REJECTED' && 'Rejected'}
                  {vehicle.verification_status === 'BLOCKED' && 'Blocked'}
                </div>
              </div>

              <div className="vv-metrics-grid">
                <div className="vv-metric-item">
                  <div className="vv-metric-label">Rated Capacity (MT)</div>
                  <div className="vv-metric-val">{vehicle.rated_capacity_mt} MT</div>
                </div>
                <div className="vv-metric-item">
                  <div className="vv-metric-label">Minimum Capacity (MT)</div>
                  {editingCapacity ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={capacityValue}
                        onChange={(e) => setCapacityValue(e.target.value)}
                        className="vv-capacity-input"
                        step="0.1"
                        min="0"
                        max={vehicle.rated_capacity_mt}
                      />
                      <button
                        onClick={handleUpdateCapacity}
                        disabled={saving}
                        className="vv-save-icon-btn"
                        title="Save Capacity"
                      >
                        <Save size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCapacity(false);
                          setCapacityValue(vehicle.minimum_capacity_mt.toString());
                        }}
                        className="vv-cancel-icon-btn"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="vv-metric-val">{vehicle.minimum_capacity_mt} MT</div>
                      <button
                        onClick={() => setEditingCapacity(true)}
                        className="vv-edit-btn"
                        title="Edit Minimum Capacity"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="vv-metric-item">
                  <div className="vv-metric-label">RC Number</div>
                  <div className="vv-metric-val mono">{vehicle.rc_number || '-'}</div>
                </div>
                <div className="vv-metric-item">
                  <div className="vv-metric-label">GPS Installed</div>
                  <div className="vv-metric-val">
                    {vehicle.gps_installed ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Details Tab */}
        <div className="vv-tabs-bar">
          <button className="vv-tab-btn active">
            Verification Details
          </button>
          <button className="vv-tab-btn">
            Documents
          </button>
          <button className="vv-tab-btn">
            Capacity & Availability
          </button>
          <button
            onClick={() => onNavigateToTieups(vehicleId)}
            className="vv-tab-btn"
          >
            Vendor Tie-ups
          </button>
        </div>

        {/* Document Verification Section */}
        <div className="vv-docs-section">
          <h3 className="vv-section-title">Document Verification</h3>
          <p className="vv-section-desc">
            Upload and verify all mandatory vehicle documents. All documents must be verified before approving the vehicle.
          </p>

          <div className="vv-docs-grid">
            <DocumentCard
              title="RC Certificate"
              documentType="RC"
              document={documents.RC}
              verificationStatus={vehicle.rc_verification_status}
              expiryDate={vehicle.rc_expiry_date}
              additionalInfo={vehicle.rc_number ? `RC Number: ${vehicle.rc_number}` : undefined}
            />

            <DocumentCard
              title="Commercial Insurance"
              documentType="INSURANCE"
              document={documents.INSURANCE}
              verificationStatus={vehicle.insurance_verification_status}
              expiryDate={vehicle.insurance_expiry_date}
              additionalInfo={
                vehicle.insurance_policy_number
                  ? `Policy Number: ${vehicle.insurance_policy_number}`
                  : undefined
              }
            />

            <DocumentCard
              title="Fitness Certificate"
              documentType="FITNESS"
              document={documents.FITNESS}
              verificationStatus={vehicle.fitness_verification_status}
              expiryDate={vehicle.fitness_expiry_date}
            />

            <DocumentCard
              title="State/National Permit"
              documentType="PERMIT"
              document={documents.PERMIT}
              verificationStatus={vehicle.permit_verification_status}
              expiryDate={vehicle.permit_expiry_date}
            />
          </div>
        </div>

        {/* Verification Actions */}
        <div className="vv-card vv-actions-card">
          <h3 className="vv-card-heading">Verification Actions</h3>
          <div className="vv-actions-buttons">
            <button
              onClick={handleApproveVehicle}
              disabled={
                saving ||
                vehicle.rc_verification_status !== 'APPROVED' ||
                vehicle.insurance_verification_status !== 'APPROVED' ||
                vehicle.fitness_verification_status !== 'APPROVED' ||
                vehicle.permit_verification_status !== 'APPROVED'
              }
              className="btn-approve-primary"
            >
              <CheckCircle size={18} />
              <span>Save & Approve Vehicle</span>
            </button>
            <button
              onClick={() => setShowRejectVehicleModal(true)}
              disabled={saving}
              className="btn-reject-secondary"
            >
              <XCircle size={18} />
              <span>Reject Vehicle</span>
            </button>
          </div>
          {vehicle.rc_verification_status !== 'APPROVED' ||
          vehicle.insurance_verification_status !== 'APPROVED' ||
          vehicle.fitness_verification_status !== 'APPROVED' ||
          vehicle.permit_verification_status !== 'APPROVED' ? (
            <div className="vv-alert-warning">
              <Info size={16} />
              <span>All documents must be approved before you can approve the vehicle</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="drawer-overlay fixed inset-0 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewDocument(null)}
        >
          <div
            className="vv-modal-dialog max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Document Preview</h3>
              <button
                onClick={() => setPreviewDocument(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                <iframe
                  src={previewDocument.file_url}
                  className="w-full h-full rounded-lg"
                  title="Document Preview"
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">{previewDocument.document_type}</span> •{' '}
                  Uploaded {formatDate(previewDocument.created_at)}
                </div>
                <a
                  href={previewDocument.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                >
                  <ExternalLink size={16} />
                  <span>Open in New Tab</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Document Modal */}
      {rejectingDocument && (
        <div className="drawer-overlay fixed inset-0 flex items-center justify-center z-50 p-6" onClick={() => setRejectingDocument(null)}>
          <div className="vv-modal-dialog max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Reject Document</h3>
              <button
                onClick={() => {
                  setRejectingDocument(null);
                  setRejectionReason('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Please provide a reason for rejecting the <strong className="text-slate-900">{rejectingDocument.documentType}</strong> document. This will be visible
                to the vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none text-sm"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectDocument}
                  disabled={saving || !rejectionReason.trim()}
                  className="flex-1 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setRejectingDocument(null);
                    setRejectionReason('');
                  }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Vehicle Modal */}
      {showRejectVehicleModal && (
        <div className="drawer-overlay fixed inset-0 flex items-center justify-center z-50 p-6" onClick={() => setShowRejectVehicleModal(false)}>
          <div className="vv-modal-dialog max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Reject Vehicle</h3>
              <button
                onClick={() => {
                  setShowRejectVehicleModal(false);
                  setVehicleRejectionReason('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Please provide a reason for rejecting this vehicle. This action will prevent the vehicle from being used
                in operations.
              </p>
              <textarea
                value={vehicleRejectionReason}
                onChange={(e) => setVehicleRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none text-sm"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectVehicle}
                  disabled={saving || !vehicleRejectionReason.trim()}
                  className="flex-1 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectVehicleModal(false);
                    setVehicleRejectionReason('');
                  }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

