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
      color: 'text-gray-400',
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
      color: 'text-red-600',
      label: `Expired ${Math.abs(daysUntilExpiry)}d ago`,
      icon: <XCircle size={16} />,
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      status: 'EXPIRING_SOON',
      color: 'text-amber-600',
      label: `Expires in ${daysUntilExpiry}d`,
      icon: <Clock size={16} />,
    };
  } else {
    return {
      status: 'VALID',
      color: 'text-emerald-600',
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
      await approveVehicleDocument(documentId, vehicleId, documentType, 'Admin'); // TODO: Get actual admin ID
      showSuccess(`${documentType} document approved successfully`);
      await fetchVehicleData();
    } catch (err: any) {
      alert(`Failed to approve document: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject document
  const handleRejectDocument = async () => {
    if (!rejectingDocument || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVehicleDocument(
        rejectingDocument.documentId,
        vehicleId,
        rejectingDocument.documentType,
        rejectionReason,
        'Admin' // TODO: Get actual admin ID
      );
      showSuccess(`${rejectingDocument.documentType} document rejected`);
      setRejectingDocument(null);
      setRejectionReason('');
      await fetchVehicleData();
    } catch (err: any) {
      alert(`Failed to reject document: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle update minimum capacity
  const handleUpdateCapacity = async () => {
    if (!vehicle) return;

    const newCapacity = parseFloat(capacityValue);
    if (isNaN(newCapacity) || newCapacity <= 0) {
      alert('Please enter a valid capacity');
      return;
    }

    if (newCapacity > vehicle.rated_capacity_mt) {
      alert('Minimum capacity cannot exceed rated capacity');
      return;
    }

    try {
      setSaving(true);
      await updateVehicleMinimumCapacity(vehicleId, newCapacity);
      showSuccess('Minimum capacity updated successfully');
      setEditingCapacity(false);
      await fetchVehicleData();
    } catch (err: any) {
      alert(`Failed to update capacity: ${err.message}`);
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
      alert('All documents must be approved before approving the vehicle');
      return;
    }

    if (!window.confirm('Are you sure you want to approve this vehicle? It will become eligible for operations.')) {
      return;
    }

    try {
      setSaving(true);
      await approveVehicle(vehicleId, 'Admin'); // TODO: Get actual admin ID
      showSuccess('Vehicle approved successfully');
      await fetchVehicleData();
    } catch (err: any) {
      alert(`Failed to approve vehicle: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle reject vehicle
  const handleRejectVehicle = async () => {
    if (!vehicleRejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setSaving(true);
      await rejectVehicle(vehicleId, vehicleRejectionReason, 'Admin'); // TODO: Get actual admin ID
      showSuccess('Vehicle rejected');
      setShowRejectVehicleModal(false);
      setVehicleRejectionReason('');
      await fetchVehicleData();
    } catch (err: any) {
      alert(`Failed to reject vehicle: ${err.message}`);
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
      <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                verificationStatus === 'APPROVED'
                  ? 'bg-emerald-500/10'
                  : verificationStatus === 'REJECTED'
                  ? 'bg-red-500/10'
                  : 'bg-amber-500/10'
              }`}
            >
              {verificationStatus === 'APPROVED' && <CheckCircle size={24} className="text-emerald-500" />}
              {verificationStatus === 'REJECTED' && <XCircle size={24} className="text-red-500" />}
              {verificationStatus === 'PENDING' && <Clock size={24} className="text-amber-500" />}
            </div>
            <div>
              <h3 className="text-[#F8F8F8] font-medium">{title}</h3>
              <span
                className={`inline-flex items-center gap-1.5 text-sm ${
                  verificationStatus === 'APPROVED'
                    ? 'text-emerald-500'
                    : verificationStatus === 'REJECTED'
                    ? 'text-red-500'
                    : 'text-amber-500'
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
              className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors group"
              title="View Document"
            >
              <Eye size={18} className="text-gray-400 group-hover:text-[#FF6B35]" />
            </button>
          )}
        </div>

        {additionalInfo && (
          <div className="mb-3">
            <span className="text-sm text-gray-400">{additionalInfo}</span>
          </div>
        )}

        {expiryDate && (
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-sm text-gray-400">Valid Until:</span>
            <span className={`text-sm font-medium ${expiryStatus.color}`}>
              {formatDate(expiryDate)}
            </span>
            <span className={`text-xs ${expiryStatus.color}`}>({expiryStatus.label})</span>
          </div>
        )}

        {document ? (
          <div className="flex items-center gap-2">
            {verificationStatus === 'PENDING' && (
              <>
                <button
                  onClick={() => handleApproveDocument(document.id, documentType)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  <span className="font-medium">Approve</span>
                </button>
                <button
                  onClick={() =>
                    setRejectingDocument({
                      documentId: document.id,
                      documentType,
                    })
                  }
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle size={16} />
                  <span className="font-medium">Reject</span>
                </button>
              </>
            )}
            {verificationStatus === 'REJECTED' && document.rejection_reason && (
              <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">
                  <span className="font-medium">Rejection Reason:</span> {document.rejection_reason}
                </p>
              </div>
            )}
            {verificationStatus === 'APPROVED' && (
              <div className="w-full flex items-center justify-center gap-2 text-emerald-500 text-sm">
                <CheckCircle size={16} />
                <span>Document verified and approved</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-500 text-sm mb-2">
              <AlertTriangle size={16} />
              <span className="font-medium">Document not uploaded</span>
            </div>
            <p className="text-xs text-gray-400">
              This document needs to be uploaded before verification can proceed
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0E] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="text-[#FF6B35] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading vehicle data...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-[#0D0D0E] flex items-center justify-center">
        <div className="text-center">
          <XCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Failed to load vehicle</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0E]">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#2A2A2C]">
        <div className="px-8 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <button onClick={onBack} className="hover:text-[#FF6B35]">
              Fleet & Vehicles
            </button>
            <span>/</span>
            <button onClick={onBack} className="hover:text-[#FF6B35]">
              Shared Vehicle Master
            </button>
            <span>/</span>
            <span className="text-[#FF6B35]">Vehicle Verification</span>
          </div>

          {/* Title & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 bg-[#1A1A1C] border border-[#2A2A2C] rounded-lg hover:bg-[#2A2A2C] transition-colors"
              >
                <ArrowLeft size={20} className="text-[#F8F8F8]" />
              </button>
              <div>
                <h1 className="text-3xl font-semibold text-[#F8F8F8] mb-2">
                  Vehicle Verification & Minimum Capacity Setup
                </h1>
                <p className="text-gray-400">
                  Verify vehicle documents, set minimum capacity and manage verification status.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigateToTieups(vehicleId)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
              >
                <Shield size={18} />
                <span className="font-medium">View Tie-ups</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Info Card */}
      <div className="px-8 py-6">
        <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6 mb-6">
          <div className="flex flex-wrap sm:flex-nowrap items-start gap-6">
            <div className="w-24 h-24 bg-[#2A2A2C] rounded-xl flex items-center justify-center">
              <Truck size={40} className="text-[#FF6B35]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-[#F8F8F8] mb-2">{vehicle.registration_number}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      {vehicle.vehicle_type} • {vehicle.body_type || 'Body type not specified'}
                    </span>
                    {vehicle.make && vehicle.model && (
                      <span className="text-gray-400">
                        {vehicle.make} {vehicle.model}
                      </span>
                    )}
                    {vehicle.year_of_manufacture && (
                      <span className="text-gray-400">Year: {vehicle.year_of_manufacture}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`px-4 py-2 rounded-lg font-medium ${
                    vehicle.verification_status === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : vehicle.verification_status === 'REJECTED'
                      ? 'bg-red-500/10 text-red-500'
                      : vehicle.verification_status === 'BLOCKED'
                      ? 'bg-gray-500/10 text-gray-400'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {vehicle.verification_status === 'APPROVED' && 'Approved'}
                  {vehicle.verification_status === 'PENDING_DOCS' && 'Pending Verification'}
                  {vehicle.verification_status === 'REJECTED' && 'Rejected'}
                  {vehicle.verification_status === 'BLOCKED' && 'Blocked'}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Rated Capacity (MT)</div>
                  <div className="text-xl font-semibold text-[#F8F8F8]">{vehicle.rated_capacity_mt} MT</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Minimum Capacity (MT)</div>
                  {editingCapacity ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={capacityValue}
                        onChange={(e) => setCapacityValue(e.target.value)}
                        className="w-24 px-3 py-1.5 bg-[#0D0D0E] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] focus:outline-none focus:border-[#FF6B35]"
                        step="0.1"
                        min="0"
                        max={vehicle.rated_capacity_mt}
                      />
                      <button
                        onClick={handleUpdateCapacity}
                        disabled={saving}
                        className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCapacity(false);
                          setCapacityValue(vehicle.minimum_capacity_mt.toString());
                        }}
                        className="p-1.5 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-semibold text-[#F8F8F8]">{vehicle.minimum_capacity_mt} MT</div>
                      <button
                        onClick={() => setEditingCapacity(true)}
                        className="p-1.5 hover:bg-[#2A2A2C] rounded-lg transition-colors"
                      >
                        <Edit2 size={16} className="text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">RC Number</div>
                  <div className="text-lg font-medium text-[#F8F8F8]">{vehicle.rc_number || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">GPS Installed</div>
                  <div className="text-lg font-medium text-[#F8F8F8]">
                    {vehicle.gps_installed ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Details Tab */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-6 border-b border-[#2A2A2C] whitespace-nowrap">
            <button className="px-1 py-4 border-b-2 border-[#FF6B35] text-[#FF6B35] font-medium">
              Verification Details
            </button>
            <button className="px-1 py-4 border-b-2 border-transparent text-gray-400 hover:text-[#F8F8F8]">
              Documents
            </button>
            <button className="px-1 py-4 border-b-2 border-transparent text-gray-400 hover:text-[#F8F8F8]">
              Capacity & Availability
            </button>
            <button
              onClick={() => onNavigateToTieups(vehicleId)}
              className="px-1 py-4 border-b-2 border-transparent text-gray-400 hover:text-[#F8F8F8]"
            >
              Vendor Tie-ups
            </button>
          </div>
        </div>

        {/* Document Verification Section */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-[#F8F8F8] mb-4">Document Verification</h3>
          <p className="text-gray-400 mb-6">
            Upload and verify all mandatory vehicle documents. All documents must be verified before approving the vehicle.
          </p>

          <div className="grid grid-cols-2 gap-6">
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
        <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#F8F8F8] mb-4">Verification Actions</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handleApproveVehicle}
              disabled={
                saving ||
                vehicle.rc_verification_status !== 'APPROVED' ||
                vehicle.insurance_verification_status !== 'APPROVED' ||
                vehicle.fitness_verification_status !== 'APPROVED' ||
                vehicle.permit_verification_status !== 'APPROVED'
              }
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={20} />
              <span className="font-medium">Save & Approve Vehicle</span>
            </button>
            <button
              onClick={() => setShowRejectVehicleModal(true)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <XCircle size={20} />
              <span className="font-medium">Reject Vehicle</span>
            </button>
          </div>
          {vehicle.rc_verification_status !== 'APPROVED' ||
          vehicle.insurance_verification_status !== 'APPROVED' ||
          vehicle.fitness_verification_status !== 'APPROVED' ||
          vehicle.permit_verification_status !== 'APPROVED' ? (
            <p className="text-sm text-amber-500 mt-3 flex items-center gap-2">
              <Info size={16} />
              All documents must be approved before you can approve the vehicle
            </p>
          ) : null}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => setPreviewDocument(null)}
        >
          <div
            className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#2A2A2C]">
              <h3 className="text-xl font-semibold text-[#F8F8F8]">Document Preview</h3>
              <button
                onClick={() => setPreviewDocument(null)}
                className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-[#0D0D0E] rounded-lg flex items-center justify-center">
                <iframe
                  src={previewDocument.file_url}
                  className="w-full h-full rounded-lg"
                  title="Document Preview"
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-[#F8F8F8]">{previewDocument.document_type}</span> •{' '}
                  Uploaded {formatDate(previewDocument.created_at)}
                </div>
                <a
                  href={previewDocument.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-[#2A2A2C]">
              <h3 className="text-xl font-semibold text-[#F8F8F8]">Reject Document</h3>
              <button
                onClick={() => {
                  setRejectingDocument(null);
                  setRejectionReason('');
                }}
                className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-400 mb-4">
                Please provide a reason for rejecting the {rejectingDocument.documentType} document. This will be visible
                to the vendor.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-[#0D0D0E] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] resize-none"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectDocument}
                  disabled={saving || !rejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setRejectingDocument(null);
                    setRejectionReason('');
                  }}
                  className="px-6 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors font-medium"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-[#2A2A2C]">
              <h3 className="text-xl font-semibold text-[#F8F8F8]">Reject Vehicle</h3>
              <button
                onClick={() => {
                  setShowRejectVehicleModal(false);
                  setVehicleRejectionReason('');
                }}
                className="p-2 hover:bg-[#2A2A2C] rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-400 mb-4">
                Please provide a reason for rejecting this vehicle. This action will prevent the vehicle from being used
                in operations.
              </p>
              <textarea
                value={vehicleRejectionReason}
                onChange={(e) => setVehicleRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-[#0D0D0E] border border-[#2A2A2C] rounded-lg text-[#F8F8F8] placeholder-gray-500 focus:outline-none focus:border-[#FF6B35] resize-none"
              />
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleRejectVehicle}
                  disabled={saving || !vehicleRejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectVehicleModal(false);
                    setVehicleRejectionReason('');
                  }}
                  className="px-6 py-3 bg-[#2A2A2C] text-[#F8F8F8] rounded-lg hover:bg-[#3A3A3C] transition-colors font-medium"
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

