import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  FileCheck2,
  Camera,
  Upload,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  ArrowRight,
  FileText,
  Stamp,
  Eye,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import { driverService } from '../../../services/driverService';
import { authService } from '../../../services/authService';
import { documentWorkflowService } from '../../../services/documentWorkflowService';
import { DriverTripItem } from '../../../types';

interface DriverPodUploadScreenProps {
  tripId: string;
  onBack: () => void;
  onTripCompleted: (tripId: string) => void;
}

export const DriverPodUploadScreen: React.FC<DriverPodUploadScreenProps> = ({
  tripId,
  onBack,
  onTripCompleted,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedPodFile, setUploadedPodFile] = useState<string | null>(null);
  const [podFileUrl, setPodFileUrl] = useState<string | null>(null);
  const [stampVerified, setStampVerified] = useState(true);
  const [signatureVerified, setSignatureVerified] = useState(true);
  const [remarksVerified, setRemarksVerified] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const data = await driverService.getTripDetails(tripId);
        setTrip(data);

        // Check if POD already exists
        const podCheck = await documentWorkflowService.checkCanCompleteDelivery(tripId);
        if (podCheck.canComplete && podCheck.podDoc) {
          setUploadedPodFile(podCheck.podDoc.fileName);
          setPodFileUrl(podCheck.podDoc.fileUrl);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [tripId]);

  const handleCapturePhoto = async (source: 'camera' | 'gallery') => {
    try {
      if (Platform.OS !== 'web') {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Permission Required', 'Camera access is needed to capture the signed Acknowledgement Slip / POD.');
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Storage Permission Required', 'Media library access is needed to select the signed Acknowledgement Slip / POD.');
            return;
          }
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = `signed_pod_${Date.now().toString().slice(-6)}.jpg`;
        setUploadingImage(true);

        const uploadRes = await driverService.uploadTripDocumentFile({
          uri: asset.uri,
          fileName: filename,
          tripId,
          docCategory: 'pods',
        });

        setUploadingImage(false);
        if (uploadRes.success && uploadRes.fileUrl) {
          setUploadedPodFile(filename);
          setPodFileUrl(uploadRes.fileUrl);
          Alert.alert('POD Attached', `Signed acknowledgement slip captured as "${filename}". Please review checklist before final submission.`);
        } else {
          Alert.alert('Upload Error', 'Failed to upload signed POD image. Please retry.');
        }
      }
    } catch (err: any) {
      setUploadingImage(false);
      Alert.alert('Capture Error', err?.message || 'Failed to capture signed POD document.');
    }
  };

  const handleRemoveFile = () => {
    setUploadedPodFile(null);
    setPodFileUrl(null);
  };

  const handleSubmitPod = async () => {
    if (!uploadedPodFile || !podFileUrl) {
      Alert.alert(
        'POD Required',
        'Delivery completion is strictly blocked until the signed Acknowledgement Slip / Proof of Delivery (POD) has been uploaded.'
      );
      return;
    }

    if (!stampVerified || !signatureVerified || !remarksVerified) {
      Alert.alert(
        'Checklist Incomplete',
        'Please verify that company seal, receiving signature, and shortage/damage remarks checks are all confirmed.'
      );
      return;
    }

    if (!trip) return;

    setSubmitting(true);
    try {
      const session = await authService.getCurrentSession();
      const driverId = session?.userId || trip.driverId || 'DRIVER';

      const res = await driverService.uploadPodAndCompleteTrip(
        trip.id,
        trip.bookingId,
        podFileUrl,
        trip.receiverName || 'Receiving Officer',
        'Consignee stamped and signed acknowledgement slip attached',
        driverId
      );

      setSubmitting(false);
      Alert.alert(
        'Trip Closed Successfully!',
        res.message,
        [{ text: 'View Completion Summary', onPress: () => onTripCompleted(trip.id) }]
      );
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Submission Error', e.message || 'Could not upload POD.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Upload POD</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : !trip ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#0F172A' }}>Trip not found.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headingWrap}>
              <View style={styles.badgeRow}>
                <View style={styles.stagePill}>
                  <Text style={styles.stagePillText}>FINAL TRIP CLOSURE</Text>
                </View>
              </View>
              <Text style={styles.titleText}>
                Proof of Delivery <Text style={styles.goldText}>(e-POD)</Text>
              </Text>
              <Text style={styles.subText}>
                Capture and upload the counter-signed, rubber-stamped physical acknowledgement slip. Delivery completion requires verified POD.
              </Text>
            </View>

            {/* Consignment Reference Card */}
            <View style={styles.refCard}>
              <Text style={styles.refLabel}>DELIVERED CONSIGNMENT</Text>
              <Text style={styles.refTitle}>
                {trip.origin} ➔ {trip.destination}
              </Text>
              <Text style={styles.refSub}>
                Vehicle: {trip.vehicleNumber} • Booking Ref: #{trip.bookingId}
              </Text>
            </View>

            {/* Upload Box */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <FileCheck2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Signed & Stamped Acknowledgement Slip (POD) *</Text>
              </View>

              {uploadingImage ? (
                <View style={[styles.uploadArea, { alignItems: 'center', paddingVertical: 24 }]}>
                  <ActivityIndicator size="small" color="#F05A22" />
                  <Text style={[styles.filePickerText, { marginTop: 10 }]}>
                    Uploading signed POD to secure storage...
                  </Text>
                </View>
              ) : uploadedPodFile ? (
                <View style={styles.previewBox}>
                  <CheckCircle2 size={24} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{uploadedPodFile}</Text>
                    <Text style={styles.fileHint}>High-resolution legible document attached</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => setShowPreviewModal(true)}
                    activeOpacity={0.8}
                  >
                    <Eye size={17} color="#0F172A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleCapturePhoto('camera')}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={16} color="#F05A22" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={handleRemoveFile}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={17} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadArea}>
                  <TouchableOpacity
                    style={styles.cameraBtn}
                    onPress={() => handleCapturePhoto('camera')}
                    activeOpacity={0.85}
                  >
                    <Camera size={20} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.cameraBtnText}>Capture Mobile Camera Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filePickerBtn}
                    onPress={() => handleCapturePhoto('gallery')}
                    activeOpacity={0.8}
                  >
                    <Upload size={16} color="#0F172A" />
                    <Text style={styles.filePickerText}>Select Image / PDF from Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 3-Point Delivery Sign-off Checklist */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <ShieldCheck size={16} color="#16A34A" />
                <Text style={styles.cardHeaderText}>Pre-Closure Document Checklist</Text>
              </View>

              {/* Point 1: Stamp */}
              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setStampVerified(!stampVerified)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, stampVerified && styles.checkBoxActive]}>
                  {stampVerified && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Consignee Rubber Stamp Visible *</Text>
                  <Text style={styles.checkSub}>Official company seal or receiver warehouse stamp legible</Text>
                </View>
              </TouchableOpacity>

              {/* Point 2: Signature */}
              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setSignatureVerified(!signatureVerified)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, signatureVerified && styles.checkBoxActive]}>
                  {signatureVerified && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Receiver Signature & Date Marked *</Text>
                  <Text style={styles.checkSub}>Signed by designated receiver with delivery timestamp</Text>
                </View>
              </TouchableOpacity>

              {/* Point 3: No Shortage / Damage Remark */}
              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setRemarksVerified(!remarksVerified)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, remarksVerified && styles.checkBoxActive]}>
                  {remarksVerified && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Clean Delivery / Zero Damage Remarks *</Text>
                  <Text style={styles.checkSub}>No unrecorded shortage, leakage, or package damages</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              style={[
                styles.goldPillBtn,
                (!uploadedPodFile || submitting) && styles.goldPillBtnDisabled,
              ]}
              onPress={handleSubmitPod}
              disabled={submitting || !uploadedPodFile}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Submit POD & Close Delivery</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            {!uploadedPodFile && (
              <View style={styles.blockingNotice}>
                <AlertTriangle size={15} color="#DC2626" />
                <Text style={styles.blockingNoticeText}>
                  Delivery completion is blocked until signed acknowledgement slip is uploaded.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Document Preview Modal ── */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>Signed Acknowledgement Slip (POD)</Text>
                <Text style={styles.previewSubtitle}>{uploadedPodFile}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewPaper}>
              <View style={styles.paperWatermark}>
                <Stamp size={28} color="#16A34A" />
                <Text style={styles.paperWatermarkText}>CONSIGNEE RECEIVING ACKNOWLEDGEMENT</Text>
              </View>
              <View style={styles.paperMetaRow}>
                <Text style={styles.paperMetaLabel}>Booking ID:</Text>
                <Text style={styles.paperMetaVal}>{trip?.bookingId}</Text>
              </View>
              <View style={styles.paperMetaRow}>
                <Text style={styles.paperMetaLabel}>Destination:</Text>
                <Text style={styles.paperMetaVal}>{trip?.destination}</Text>
              </View>
              <View style={styles.paperMetaRow}>
                <Text style={styles.paperMetaLabel}>Receiving Officer:</Text>
                <Text style={styles.paperMetaVal}>{trip?.receiverName || 'Warehouse Desk'}</Text>
              </View>
              <View style={styles.stampBox}>
                <Text style={styles.stampBoxText}>CONSIGNEE OFFICIAL RUBBER STAMP</Text>
                <Text style={styles.stampBoxSub}>Goods Received in Sound Condition • Approved</Text>
              </View>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.retakeModalBtn}
                onPress={() => {
                  setShowPreviewModal(false);
                  handleCapturePhoto('camera');
                }}
              >
                <RefreshCw size={15} color="#F05A22" />
                <Text style={styles.retakeModalBtnText}>Retake Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headingWrap: {
    marginBottom: 14,
  },
  badgeRow: {
    marginBottom: 6,
  },
  stagePill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stagePillText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  refCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  refLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  refTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  refSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  fileHint: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  actionIconBtn: {
    padding: 6,
  },
  uploadArea: {
    gap: 10,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 12,
    borderRadius: 10,
  },
  cameraBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
  },
  filePickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  checkSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  goldPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  goldPillBtnDisabled: {
    opacity: 0.5,
  },
  goldPillText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  blockingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  blockingNoticeText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  previewModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  previewPaper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 8,
  },
  paperWatermark: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  paperWatermarkText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  paperMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paperMetaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  paperMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stampBox: {
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F0FDF4',
  },
  stampBoxText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  stampBoxSub: {
    fontSize: 8,
    color: '#15803D',
    marginTop: 2,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  retakeModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  retakeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F05A22',
  },
  closeModalBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
