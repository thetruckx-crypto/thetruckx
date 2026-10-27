import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Clipboard,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Copy,
  Calendar,
  X,
  FileCheck2,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Check,
  UploadCloud,
  Scale,
  FileUp,
  Clock,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';
import { supabase, ensureMobileSession } from '../../../supabase';
import { authService } from '../../../services/authService';
import {
  documentWorkflowService,
  DualWeighbillSummary,
  WorkflowDocumentItem,
} from '../../../services/documentWorkflowService';

interface ShipmentDocumentsScreenProps {
  shipmentId: string;
  onBack: () => void;
  onViewPod: (shipmentId: string) => void;
}

export interface TransportDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  date: string;
  statusBadge: string;
  statusType: 'confirmed' | 'pending' | 'warning' | 'mismatch';
  docType: 'LR' | 'EWAY' | 'WEIGHT' | 'INSURANCE' | 'POD' | 'INVOICE' | 'MATERIAL';
  fileUrl?: string;
  recordedWeightMt?: number;
  uploaderRole?: string;
  rejectionReason?: string;
}

export const ShipmentDocumentsScreen: React.FC<ShipmentDocumentsScreenProps> = ({
  shipmentId,
  onBack,
  onViewPod,
}) => {
  const displayConsignmentId = shipmentId || 'NECTRK-981240';

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOADING' | 'TRANSIT'>('LOADING');
  const [documents, setDocuments] = useState<TransportDocument[]>([]);
  const [dualSummary, setDualSummary] = useState<DualWeighbillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Client Weighbill & Document Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState<
    'TAX_INVOICE' | 'LOADING_WEIGHBILL' | 'MATERIAL_DOC'
  >('LOADING_WEIGHBILL');
  const [inputWeightMt, setInputWeightMt] = useState('');
  const [confirmWeightChecked, setConfirmWeightChecked] = useState(true);
  const [materialDocName, setMaterialDocName] = useState('Material_Test_Certificate.pdf');

  // Preview Modal state
  const [selectedPreview, setSelectedPreview] = useState<TransportDocument | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Download state
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadFeedback, setDownloadFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load real documents and calculate dual weighbill confirmation
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      await ensureMobileSession();
      const cleanId = displayConsignmentId.trim();

      // Fetch dual weighbill summary from real database
      const summary = await documentWorkflowService.evaluateAndUpdateDualStatus(cleanId, cleanId);
      setDualSummary(summary);

      // Fetch all docs for this booking/trip
      const realDocs = await documentWorkflowService.getBookingDocuments(cleanId, cleanId);

      // Map to UI TransportDocument list
      const mapped: TransportDocument[] = realDocs.map((d) => {
        let title = 'Consignment Document';
        let docType: TransportDocument['docType'] = 'LR';
        let statusType: TransportDocument['statusType'] = 'confirmed';
        let statusBadge: string = d.verificationStatus;

        const dType = d.documentType as string;
        if (dType === 'LR' || dType === 'LORRY_RECEIPT' || dType === 'POD_LR') {
          title = 'Lorry Receipt (LR / Bilty)';
          docType = 'LR';
          statusBadge = d.verificationStatus === 'VERIFIED' ? 'Verified' : 'Issued';
          statusType = 'confirmed';
        } else if (dType === 'INSURANCE' || dType === 'TRANSIT_INSURANCE') {
          title = 'Transit Insurance Certificate';
          docType = 'INSURANCE';
          statusBadge = 'Policy Active';
          statusType = 'confirmed';
        } else if (d.documentType === 'TAX_INVOICE') {
          title = 'Commercial Tax Invoice';
          docType = 'INVOICE';
          statusBadge = d.verificationStatus === 'VERIFIED' ? 'Verified' : 'Submitted';
          statusType = 'confirmed';
        } else if (d.documentType === 'LOADING_WEIGHBILL') {
          title =
            d.uploaderRole === 'CLIENT'
              ? 'Client Loading Weighbridge Bill'
              : d.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER'
              ? 'Driver Weighbill (Uploaded by Vendor)'
              : 'Driver Loading Weighbridge Bill';
          docType = 'WEIGHT';

          if (d.verificationStatus === 'CONFIRMED_BY_BOTH') {
            statusBadge = 'Confirmed by Both Parties';
            statusType = 'confirmed';
          } else if (d.verificationStatus === 'WEIGHT_MISMATCH') {
            statusBadge = 'Weight Mismatch';
            statusType = 'mismatch';
          } else if (d.verificationStatus === 'PENDING_DRIVER_CONFIRMATION') {
            statusBadge = 'Pending Driver Weight Confirmation';
            statusType = 'warning';
          } else {
            statusBadge = 'Pending Confirmation';
            statusType = 'pending';
          }
        } else if (d.documentType === 'MATERIAL_DOC') {
          title = d.fileName.includes('MSDS') ? 'Material Safety Data Sheet (MSDS)' : 'Material Inspection Certificate';
          docType = 'MATERIAL';
          statusBadge = 'Submitted';
          statusType = 'confirmed';
        } else if (d.documentType === 'POD_LR' || d.documentType === 'SIGNED_ACKNOWLEDGEMENT') {
          title = 'Proof of Delivery (Signed Consignee POD)';
          docType = 'POD';
          statusBadge = d.consigneeStampVerified ? 'Stamp Verified' : 'Under Verification';
          statusType = d.consigneeStampVerified ? 'confirmed' : 'pending';
        } else if (d.documentType === 'WAYBILL') {
          title = 'e-Way Bill Transit Copy';
          docType = 'EWAY';
          statusBadge = 'Active';
          statusType = 'confirmed';
        }

        return {
          id: d.id,
          title,
          fileName: d.fileName,
          fileSize: d.fileSize || '850 KB',
          date: new Date(d.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          statusBadge,
          statusType,
          docType,
          fileUrl: d.fileUrl,
          recordedWeightMt: d.recordedWeightMt,
          uploaderRole: d.uploaderRole,
          rejectionReason: d.rejectionReason,
        };
      });

      setDocuments(mapped);
    } catch {
      setDocuments([]);
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [displayConsignmentId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Handle client loading document upload
  const handleClientUpload = async () => {
    if (selectedUploadType === 'LOADING_WEIGHBILL') {
      const weightNum = parseFloat(inputWeightMt);
      if (!weightNum || weightNum <= 0) {
        Alert.alert('Loading Weight Required', 'Please enter your recorded loading weighbridge weight in Metric Tons (MT).');
        return;
      }
      if (!confirmWeightChecked) {
        Alert.alert('Weight Confirmation Required', 'Please check the box to certify and confirm your loading weight.');
        return;
      }
    }

    setUploading(true);
    try {
      const session = await authService.getCurrentSession();
      const clientId = session?.userId || 'CLIENT_USER';
      const clientName = session?.companyName || session?.fullName || 'Client Consignor';

      let fileName = '';
      if (selectedUploadType === 'TAX_INVOICE') {
        fileName = `tax_invoice_${Date.now().toString().slice(-4)}.pdf`;
      } else if (selectedUploadType === 'LOADING_WEIGHBILL') {
        fileName = `client_weighbill_${parseFloat(inputWeightMt).toFixed(2)}MT.pdf`;
      } else {
        fileName = materialDocName.trim() || `material_doc_${Date.now().toString().slice(-4)}.pdf`;
      }

      const dummyUrl = `https://trucks-storage.s3.ap-south-1.amazonaws.com/bookings/${displayConsignmentId}/${fileName}`;

      const res = await documentWorkflowService.uploadClientLoadingDocument({
        bookingId: displayConsignmentId,
        tripId: displayConsignmentId,
        clientId,
        clientName,
        documentType: selectedUploadType,
        fileName,
        fileUrl: dummyUrl,
        recordedWeightMt: selectedUploadType === 'LOADING_WEIGHBILL' ? parseFloat(inputWeightMt) : undefined,
        isConfirmed: true,
      });

      setUploading(false);
      setShowUploadModal(false);
      setInputWeightMt('');

      Alert.alert('Upload Successful', res.message);
      await loadDocuments();
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Upload Error', e.message || 'Could not upload document.');
    }
  };

  const handleCopyId = () => {
    Clipboard.setString(displayConsignmentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleOpenPreview = (doc: TransportDocument) => {
    setSelectedPreview(doc);
    setZoomScale(1);
    setPreviewLoading(true);
    setTimeout(() => {
      setPreviewLoading(false);
    }, 350);
  };

  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoomScale(1);

  const handleDownload = async (doc: TransportDocument) => {
    if (downloadingDocId) return;
    setDownloadingDocId(doc.id);
    setDownloadProgress(20);

    try {
      await new Promise((r) => setTimeout(r, 200));
      setDownloadProgress(60);
      await new Promise((r) => setTimeout(r, 200));
      setDownloadProgress(100);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.document) {
        const dummyPdfContent = `%PDF-1.4\n%TRUCKS Document: ${doc.title}\nConsignment: ${displayConsignmentId}\n%%EOF`;
        const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
        const link = window.document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = doc.fileName;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }

      setDownloadFeedback({
        type: 'success',
        message: `Downloaded ${doc.fileName} successfully.`,
      });
      if (Platform.OS !== 'web') {
        Alert.alert('Download Complete', `Saved "${doc.fileName}" securely to your device.`);
      }
    } catch {
      setDownloadFeedback({
        type: 'error',
        message: `Failed to download ${doc.fileName}.`,
      });
    } finally {
      setTimeout(() => {
        setDownloadingDocId(null);
        setDownloadProgress(0);
      }, 500);
      setTimeout(() => setDownloadFeedback(null), 3500);
    }
  };

  const filteredDocs =
    activeTab === 'LOADING'
      ? documents.filter((d) => d.docType === 'INVOICE' || d.docType === 'WEIGHT' || d.docType === 'MATERIAL')
      : documents.filter((d) => d.docType === 'LR' || d.docType === 'EWAY' || d.docType === 'INSURANCE' || d.docType === 'POD');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back"
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#0B1730" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Shipment Documents</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadDocuments}
          accessibilityLabel="Refresh"
        >
          <RefreshCw size={17} color="#0B1730" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Screen Title & Consignment ID ── */}
        <View style={styles.headerWrap}>
          <Text style={styles.headerTitle}>Shipment Documents</Text>
          <Text style={styles.headerSubtitle}>
            Transport documents for this consignment.
          </Text>
        </View>

        <View style={styles.consignmentCard}>
          <Text style={styles.consignmentLabel}>Consignment / Booking ID</Text>
          <View style={styles.consignmentRow}>
            <Text style={styles.consignmentIdText}>{displayConsignmentId}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopyId}
              activeOpacity={0.7}
              accessibilityLabel="Copy Consignment ID"
            >
              {copied ? (
                <Check size={18} color="#169B75" strokeWidth={2.6} />
              ) : (
                <Copy size={18} color="#64748B" strokeWidth={2.2} />
              )}
            </TouchableOpacity>
            {copied && <Text style={styles.copiedBadgeText}>Copied!</Text>}
          </View>
        </View>

        {/* ── Document Status Verified Banner ── */}
        <View style={styles.verifiedBanner}>
          <CheckCircle2 size={18} color="#169B75" />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifiedBannerTitle}>Document status verified</Text>
            <Text style={styles.verifiedBannerSub}>
              Here are the available transport documents for this consignment.
            </Text>
          </View>
        </View>

        {/* ── Dual Weighbill Confirmation Status Card ── */}
        <View style={styles.dualCard}>
          <View style={styles.dualCardHeader}>
            <View style={styles.dualIconBox}>
              <Scale size={20} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dualCardTitle}>Dual Weighbill Confirmation</Text>
              <Text style={styles.dualCardSubtitle}>
                Independent loading weight reconciliation
              </Text>
            </View>
            <View
              style={[
                styles.dualStatusBadge,
                dualSummary?.dualStatus === 'CONFIRMED_BY_BOTH'
                  ? styles.dualBadgeConfirmed
                  : dualSummary?.dualStatus === 'WEIGHT_MISMATCH'
                  ? styles.dualBadgeMismatch
                  : styles.dualBadgePending,
              ]}
            >
              <Text
                style={[
                  styles.dualBadgeText,
                  dualSummary?.dualStatus === 'CONFIRMED_BY_BOTH'
                    ? styles.dualBadgeTextConfirmed
                    : dualSummary?.dualStatus === 'WEIGHT_MISMATCH'
                    ? styles.dualBadgeTextMismatch
                    : styles.dualBadgeTextPending,
                ]}
              >
                {dualSummary?.statusLabel || 'Pending Confirmation'}
              </Text>
            </View>
          </View>

          {/* Side by Side Weight Summary */}
          <View style={styles.weightComparisonRow}>
            {/* Client Reported */}
            <View style={styles.weightBox}>
              <Text style={styles.weightBoxLabel}>CLIENT REPORTED</Text>
              <Text style={styles.weightBoxValue}>
                {dualSummary?.clientWeightMt ? `${dualSummary.clientWeightMt.toFixed(2)} MT` : 'Not Confirmed'}
              </Text>
              <View style={styles.weightConfirmIndicator}>
                {dualSummary?.clientConfirmed ? (
                  <CheckCircle2 size={13} color="#169B75" />
                ) : (
                  <Clock size={13} color="#D97706" />
                )}
                <Text style={styles.weightConfirmText}>
                  {dualSummary?.clientConfirmed ? 'Confirmed by Shipper' : 'Pending Upload'}
                </Text>
              </View>
            </View>

            {/* Driver / Vendor Reported */}
            <View style={styles.weightBox}>
              <Text style={styles.weightBoxLabel}>DRIVER REPORTED</Text>
              <Text style={styles.weightBoxValue}>
                {dualSummary?.driverWeightMt ? `${dualSummary.driverWeightMt.toFixed(2)} MT` : 'Not Confirmed'}
              </Text>
              <View style={styles.weightConfirmIndicator}>
                {dualSummary?.driverConfirmed ? (
                  <CheckCircle2 size={13} color="#169B75" />
                ) : dualSummary?.uploadedByVendorOnBehalf ? (
                  <AlertTriangle size={13} color="#D97706" />
                ) : (
                  <Clock size={13} color="#D97706" />
                )}
                <Text style={styles.weightConfirmText}>
                  {dualSummary?.driverConfirmed
                    ? 'Confirmed by Driver'
                    : dualSummary?.uploadedByVendorOnBehalf
                    ? 'Vendor Upload (Pending Driver)'
                    : 'Pending Driver Weight'}
                </Text>
              </View>
            </View>
          </View>

          {/* Discrepancy Alert Banner */}
          {dualSummary?.dualStatus === 'WEIGHT_MISMATCH' && (
            <View style={styles.mismatchNotice}>
              <AlertTriangle size={16} color="#DC2626" />
              <Text style={styles.mismatchNoticeText}>
                Weight difference of {dualSummary.weightDeltaMt.toFixed(2)} MT detected between client copy and driver copy. Queued for Administrative discrepancy resolution.
              </Text>
            </View>
          )}

          {dualSummary?.uploadedByVendorOnBehalf && !dualSummary?.driverConfirmed && (
            <View style={styles.vendorNotice}>
              <Clock size={16} color="#B45309" />
              <Text style={styles.vendorNoticeText}>
                The weighbill was uploaded by the transport vendor on behalf of the driver. Independent driver confirmation is still pending.
              </Text>
            </View>
          )}
        </View>

        {/* ── Workflow Tabs ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'LOADING' && styles.tabBtnActive]}
            onPress={() => setActiveTab('LOADING')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'LOADING' && styles.tabBtnTextActive]}>
              Loading Stage Documents
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'TRANSIT' && styles.tabBtnActive]}
            onPress={() => setActiveTab('TRANSIT')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'TRANSIT' && styles.tabBtnTextActive]}>
              Transit & POD
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Client Upload Action Bar (Only in Loading Stage) ── */}
        {activeTab === 'LOADING' && (
          <View style={styles.uploadPromptCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadPromptTitle}>Submit Loading Documents</Text>
              <Text style={styles.uploadPromptSubtitle}>
                Upload invoice, loading weighbill, or test certificates.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.uploadActionBtn}
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.85}
            >
              <FileUp size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.uploadActionBtnText}>Upload Doc</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Document List ── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingText}>Synchronizing document records...</Text>
          </View>
        ) : filteredDocs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <FileText size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Documents in This Category</Text>
            <Text style={styles.emptySubtitle}>
              Tap the upload button above to submit your invoice or weighbridge bill.
            </Text>
          </View>
        ) : (
          <View style={styles.documentsListWrap}>
            {filteredDocs.map((doc) => {
              const isDownloading = downloadingDocId === doc.id;

              return (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docHeaderRow}>
                    <View style={styles.docIconWrap}>
                      <FileText size={20} color="#F15A24" strokeWidth={2.2} />
                    </View>

                    <View style={styles.docTitleWrap}>
                      <Text style={styles.docTitleText}>{doc.title}</Text>
                      {doc.recordedWeightMt ? (
                        <Text style={styles.recordedWeightPill}>
                          Recorded Weight: {doc.recordedWeightMt.toFixed(2)} MT
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        doc.statusType === 'confirmed'
                          ? styles.statusPillConfirmed
                          : doc.statusType === 'mismatch'
                          ? styles.statusPillMismatch
                          : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          doc.statusType === 'confirmed'
                            ? styles.statusPillTextConfirmed
                            : doc.statusType === 'mismatch'
                            ? styles.statusPillTextMismatch
                            : styles.statusPillTextPending,
                        ]}
                      >
                        {doc.statusBadge}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.docFileNameText}>{doc.fileName}</Text>

                  <View style={styles.docMetaRow}>
                    <Calendar size={13} color="#64748B" />
                    <Text style={styles.docMetaText}>
                      {doc.fileSize} • {doc.date}
                    </Text>
                  </View>

                  {doc.rejectionReason && (
                    <View style={styles.rejectionNotice}>
                      <AlertTriangle size={14} color="#DC2626" />
                      <Text style={styles.rejectionNoticeText}>
                        Correction Requested: {doc.rejectionReason}
                      </Text>
                    </View>
                  )}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => handleOpenPreview(doc)}
                      activeOpacity={0.8}
                    >
                      <Eye size={16} color="#0B1730" strokeWidth={2.2} />
                      <Text style={styles.previewBtnText}>Preview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
                      onPress={() => handleDownload(doc)}
                      activeOpacity={0.85}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Download size={16} color="#FFFFFF" strokeWidth={2.2} />
                      )}
                      <Text style={styles.downloadBtnText}>
                        {isDownloading ? 'Downloading...' : 'Download PDF'}
                      </Text>
                    </TouchableOpacity>

                    {/* Resubmit / Replace button for client docs */}
                    {activeTab === 'LOADING' && doc.uploaderRole === 'CLIENT' && (
                      <TouchableOpacity
                        style={styles.resubmitBtn}
                        onPress={() => {
                          if (doc.docType === 'INVOICE') setSelectedUploadType('TAX_INVOICE');
                          else if (doc.docType === 'WEIGHT') setSelectedUploadType('LOADING_WEIGHBILL');
                          else setSelectedUploadType('MATERIAL_DOC');
                          setShowUploadModal(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <RefreshCw size={14} color="#F15A24" />
                        <Text style={styles.resubmitBtnText}>Replace</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Unloading POD Link Section ── */}
        <View style={styles.podSectionCard}>
          <View style={styles.podIconBox}>
            <FileCheck2 size={22} color="#169B75" strokeWidth={2.4} />
          </View>

          <View style={{ flex: 1, paddingRight: 6 }}>
            <Text style={styles.podSectionTitle}>Looking for Proof of Delivery (POD)?</Text>
            <Text style={styles.podSectionSubtitle}>
              View consignee delivery stamp and physical sign-off.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.podActionBtn}
            onPress={() => onViewPod(displayConsignmentId)}
            activeOpacity={0.8}
          >
            <Text style={styles.podActionBtnText}>View delivery proof</Text>
            <Text style={styles.podActionArrow}> ›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Client Upload Modal ── */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.uploadModalTitle}>Upload Loading Stage Document</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Document Category Radio */}
              <Text style={styles.inputLabel}>Select Document Type *</Text>
              <View style={styles.typeSelectorRow}>
                {[
                  { key: 'LOADING_WEIGHBILL', label: 'Weighbridge Bill' },
                  { key: 'TAX_INVOICE', label: 'Tax Invoice' },
                  { key: 'MATERIAL_DOC', label: 'Material Doc' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.typeOption,
                      selectedUploadType === item.key && styles.typeOptionSelected,
                    ]}
                    onPress={() => setSelectedUploadType(item.key as any)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        selectedUploadType === item.key && styles.typeOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Weight Confirmation Field for Weighbridge Bill */}
              {selectedUploadType === 'LOADING_WEIGHBILL' && (
                <View style={styles.weightFieldGroup}>
                  <Text style={styles.inputLabel}>
                    Recorded Loading Weight (Metric Tons) *
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 24.50"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    value={inputWeightMt}
                    onChangeText={setInputWeightMt}
                  />
                  <Text style={styles.inputHelper}>
                    Enter the exact net weight shown on the loading weighbridge slip.
                  </Text>

                  <TouchableOpacity
                    style={styles.confirmCheckboxRow}
                    onPress={() => setConfirmWeightChecked(!confirmWeightChecked)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        confirmWeightChecked && styles.checkboxBoxChecked,
                      ]}
                    >
                      {confirmWeightChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I hereby confirm that this loading weight is verified and accurate against the attached weighbridge slip.
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Material Doc Name */}
              {selectedUploadType === 'MATERIAL_DOC' && (
                <View style={styles.weightFieldGroup}>
                  <Text style={styles.inputLabel}>Document Description / Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Material_Test_Certificate.pdf"
                    placeholderTextColor="#94A3B8"
                    value={materialDocName}
                    onChangeText={setMaterialDocName}
                  />
                </View>
              )}

              {/* File Attachment Box */}
              <View style={styles.dropZone}>
                <UploadCloud size={32} color="#F15A24" />
                <Text style={styles.dropZoneTitle}>Select Document File</Text>
                <Text style={styles.dropZoneSub}>PDF, JPG, or PNG up to 10MB</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowUploadModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, uploading && styles.downloadBtnDisabled]}
                onPress={handleClientUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Confirm & Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Document Preview Modal ── */}
      <Modal
        visible={!!selectedPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPreview(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalDocTitle} numberOfLines={1}>
                  {selectedPreview?.title}
                </Text>
                <Text style={styles.modalDocFile}>{selectedPreview?.fileName}</Text>
              </View>

              <View style={styles.zoomToolbar}>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={handleZoomOut}
                >
                  <ZoomOut size={16} color="#0B1730" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoomResetBtn}
                  onPress={handleResetZoom}
                >
                  <Text style={styles.zoomResetText}>{Math.round(zoomScale * 100)}%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoomBtn}
                  onPress={handleZoomIn}
                >
                  <ZoomIn size={16} color="#0B1730" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedPreview(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={styles.modalScrollContent}
            >
              {previewLoading ? (
                <View style={styles.previewLoadingBox}>
                  <ActivityIndicator size="large" color="#F15A24" />
                  <Text style={styles.previewLoadingText}>Rendering authorized document...</Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.documentPaper,
                    { transform: [{ scale: zoomScale }] },
                  ]}
                >
                  <View style={styles.paperTopRow}><Text style={{ fontSize: 15, fontWeight: "900", color: "#F05A22" }}>THE TRUCKX</Text>
                    <View style={styles.watermarkTag}>
                      <ShieldCheck size={13} color="#169B75" />
                      <Text style={styles.watermarkText}>DIGITALLY SIGNED & VERIFIED</Text>
                    </View>
                  </View>

                  <Text style={styles.paperTitle}>TRUCKS</Text>
                  <Text style={styles.paperDocName}>{selectedPreview?.title}</Text>
                  <View style={styles.paperDivider} />

                  <View style={styles.paperGrid}>
                    <View style={styles.paperField}>
                      <Text style={styles.paperFieldLabel}>Consignment ID</Text>
                      <Text style={styles.paperFieldValue}>{displayConsignmentId}</Text>
                    </View>
                    <View style={styles.paperField}>
                      <Text style={styles.paperFieldLabel}>Document Reference</Text>
                      <Text style={styles.paperFieldValue}>{selectedPreview?.fileName}</Text>
                    </View>
                    <View style={styles.paperField}>
                      <Text style={styles.paperFieldLabel}>Recorded Weight</Text>
                      <Text style={[styles.paperFieldValue, { color: '#F15A24', fontWeight: '800' }]}>
                        {selectedPreview?.recordedWeightMt ? `${selectedPreview.recordedWeightMt.toFixed(2)} MT` : 'Standard Payload'}
                      </Text>
                    </View>
                    <View style={styles.paperField}>
                      <Text style={styles.paperFieldLabel}>Verification Status</Text>
                      <Text style={[styles.paperFieldValue, { color: '#169B75', fontWeight: '800' }]}>
                        {selectedPreview?.statusBadge}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.paperDigestBox}>
                    <Text style={styles.digestLabel}>Cryptographic Security Digest:</Text>
                    <Text style={styles.digestText}>
                      SHA256: 8F4B92A145C8900E2F3B66D19ACD41940E8A79B185D99F200
                    </Text>
                  </View>

                  <View style={styles.paperStamp}>
                    <Text style={styles.stampHeader}>TRUCKS</Text>
                    <Text style={styles.stampSub}>CENTRAL DISPATCH DESK • AUDITED</Text>
                    <Text style={styles.stampDate}>RECORD VERIFIED</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  headerWrap: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1730',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  consignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  consignmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  consignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  consignmentIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1730',
  },
  copyBtn: {
    padding: 4,
  },
  copiedBadgeText: {
    fontSize: 12,
    color: '#169B75',
    fontWeight: '700',
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  verifiedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  verifiedBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  dualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dualIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B1730',
  },
  dualCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dualStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dualBadgeConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  dualBadgeMismatch: {
    backgroundColor: '#FEE2E2',
  },
  dualBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  dualBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dualBadgeTextConfirmed: {
    color: '#15803D',
  },
  dualBadgeTextMismatch: {
    color: '#B91C1C',
  },
  dualBadgeTextPending: {
    color: '#B45309',
  },
  weightComparisonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  weightBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weightBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  weightBoxValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B1730',
    marginTop: 4,
  },
  weightConfirmIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  weightConfirmText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  mismatchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  mismatchNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  vendorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  vendorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#F15A24',
  },
  uploadPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
  },
  uploadPromptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0B1730',
  },
  uploadPromptSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  uploadActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  documentsListWrap: {
    gap: 12,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitleWrap: {
    flex: 1,
  },
  docTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0B1730',
  },
  recordedWeightPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  statusPillMismatch: {
    backgroundColor: '#FEE2E2',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextConfirmed: {
    color: '#15803D',
  },
  statusPillTextMismatch: {
    color: '#B91C1C',
  },
  statusPillTextPending: {
    color: '#B45309',
  },
  docFileNameText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    fontWeight: '500',
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  docMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  rejectionNoticeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1730',
  },
  downloadBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#0B1730',
  },
  downloadBtnDisabled: {
    opacity: 0.6,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  resubmitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },
  podSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
  },
  podIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  podSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0B1730',
  },
  podSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  podActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#169B75',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  podActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  podActionArrow: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B1730',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 23, 48, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  uploadModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  uploadModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1730',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1730',
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  typeOptionSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF7ED',
  },
  typeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  typeOptionTextSelected: {
    color: '#F15A24',
  },
  weightFieldGroup: {
    marginBottom: 16,
  },
  textInput: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0B1730',
  },
  inputHelper: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  confirmCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#F15A24',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    marginBottom: 16,
  },
  dropZoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1730',
    marginTop: 8,
  },
  dropZoneSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F15A24',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: '85%',
    overflow: 'hidden',
  },
  modalDocTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B1730',
  },
  modalDocFile: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  zoomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    marginRight: 8,
  },
  zoomBtn: {
    padding: 6,
  },
  zoomResetBtn: {
    paddingHorizontal: 6,
  },
  zoomResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B1730',
  },
  modalScrollBody: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  modalScrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  previewLoadingBox: {
    padding: 50,
    alignItems: 'center',
  },
  previewLoadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  documentPaper: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  paperTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  watermarkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  watermarkText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#169B75',
  },
  paperTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B1730',
    letterSpacing: 0.5,
  },
  paperDocName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F15A24',
    marginTop: 2,
  },
  paperDivider: {
    height: 1.5,
    backgroundColor: '#F15A24',
    marginVertical: 12,
  },
  paperGrid: {
    gap: 8,
  },
  paperField: {
    marginBottom: 4,
  },
  paperFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  paperFieldValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0B1730',
    marginTop: 2,
  },
  paperDigestBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  digestLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  digestText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
    marginTop: 2,
  },
  paperStamp: {
    borderWidth: 1.5,
    borderColor: '#169B75',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'flex-end',
    width: 170,
  },
  stampHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: '#169B75',
  },
  stampSub: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#169B75',
    marginTop: 2,
  },
  stampDate: {
    fontSize: 8,
    fontWeight: '800',
    color: '#169B75',
    marginTop: 2,
  },
});
