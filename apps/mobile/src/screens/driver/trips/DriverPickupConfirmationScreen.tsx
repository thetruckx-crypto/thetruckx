import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Truck,
  MapPin,
  Scale,
  CheckCircle2,
  Navigation,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Package,
  Camera,
  Upload,
  RefreshCw,
  Eye,
  AlertTriangle,
  Clock,
  Check,
  X,
  FileText,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { driverService } from '../../../services/driverService';
import { authService } from '../../../services/authService';
import { documentWorkflowService } from '../../../services/documentWorkflowService';
import { DriverTripItem } from '../../../types';

interface DriverPickupConfirmationScreenProps {
  tripId: string;
  onBack: () => void;
  onPickupConfirmed: (tripId: string) => void;
}

export const DriverPickupConfirmationScreen: React.FC<DriverPickupConfirmationScreenProps> = ({
  tripId,
  onBack,
  onPickupConfirmed,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Weights
  const [grossWeight, setGrossWeight] = useState('32.50');
  const [tareWeight, setTareWeight] = useState('12.50');
  const [loadingGateNotes, setLoadingGateNotes] = useState('');
  const [independentWeightConfirmed, setIndependentWeightConfirmed] = useState(true);

  // Weighbill Document state
  const [uploadedWeighbillUrl, setUploadedWeighbillUrl] = useState<string | null>(null);
  const [weighbillFileName, setWeighbillFileName] = useState<string | null>(null);
  const [vendorUploadedOnBehalf, setVendorUploadedOnBehalf] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);

  // Checklists
  const [lrChecked, setLrChecked] = useState(true);
  const [tarpaulinChecked, setTarpaulinChecked] = useState(true);

  // Preview Modal
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Fetch trip & existing weighbill records (to check if vendor uploaded on behalf)
  useEffect(() => {
    async function loadData() {
      try {
        const data = await driverService.getTripDetails(tripId);
        setTrip(data);

        let dynamicTare = 12.5;
        if (data?.capacityMt && Number(data.capacityMt) > 0) {
          const cap = Number(data.capacityMt);
          dynamicTare = Number((cap * 0.4).toFixed(2));
          const estGross = Number((cap + dynamicTare).toFixed(2));
          setTareWeight(dynamicTare.toFixed(2));
          setGrossWeight(estGross.toFixed(2));
        }

        // Check if a loading weighbill already exists for this trip
        const docs = await documentWorkflowService.getBookingDocuments(data?.bookingId || tripId, tripId);
        const weighDoc = docs.find(
          (d) =>
            d.documentType === 'LOADING_WEIGHBILL' &&
            (d.uploaderRole === 'DRIVER' || d.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER')
        );

        if (weighDoc) {
          setUploadedWeighbillUrl(weighDoc.fileUrl);
          setWeighbillFileName(weighDoc.fileName);
          if (weighDoc.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER') {
            setVendorUploadedOnBehalf(true);
            setVendorName(weighDoc.metadata?.vendorName || 'Transport Vendor');
          }
          if (weighDoc.recordedWeightMt) {
            setGrossWeight((weighDoc.recordedWeightMt + dynamicTare).toFixed(2));
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tripId]);

  const grossMt = parseFloat(grossWeight) || 0;
  const tareMt = parseFloat(tareWeight) || 0;
  const netWeightNum = Math.max(0, grossMt - tareMt);
  const netWeight = netWeightNum.toFixed(2);
  const grossKg = Math.round(grossMt * 1000);
  const tareKg = Math.round(tareMt * 1000);
  const netKg = Math.round(netWeightNum * 1000);

  const targetMt = trip?.capacityMt || 0;
  const isOverweight = targetMt > 0 && netWeightNum > targetMt * 1.05;
  const isWithinTolerance = targetMt > 0 && Math.abs(netWeightNum - targetMt) <= targetMt * 0.05;

  // Real camera capture or gallery selection with Supabase upload
  const handleCaptureWeighbill = async (source: 'camera' | 'gallery') => {
    try {
      if (Platform.OS !== 'web') {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Permission Required', 'Camera access is needed to photograph the weighbridge slip.');
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Storage Permission Required', 'Media library access is needed to select weighbridge slip document.');
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
        const filename = `weighslip_${Date.now().toString().slice(-6)}.jpg`;
        setUploadingImage(true);

        const uploadRes = await driverService.uploadTripDocumentFile({
          uri: asset.uri,
          fileName: filename,
          tripId,
          docCategory: 'weighbills',
        });

        setUploadingImage(false);
        if (uploadRes.success && uploadRes.fileUrl) {
          setUploadedWeighbillUrl(uploadRes.fileUrl);
          setWeighbillFileName(filename);
          setVendorUploadedOnBehalf(false);
          Alert.alert('Weighslip Attached', 'Weighbridge slip successfully captured and attached to trip record.');
        } else {
          Alert.alert('Upload Error', 'Failed to upload weighbridge slip image. Please retry.');
        }
      }
    } catch (err: any) {
      setUploadingImage(false);
      Alert.alert('Capture Error', err?.message || 'Failed to capture weighbridge slip image.');
    }
  };

  const handleConfirmPickup = async () => {
    if (!trip) return;

    // Strict validation: Loading weighbill document MUST be uploaded
    if (!uploadedWeighbillUrl) {
      Alert.alert(
        'Weighbridge Slip Required',
        'You must capture and upload the loading-stage Weighbridge Bill / Weight Slip before starting transit.'
      );
      return;
    }

    // Strict validation: Driver independent weight confirmation is mandatory
    if (!independentWeightConfirmed) {
      Alert.alert(
        'Independent Confirmation Required',
        'You must independently certify and confirm the recorded loading weight.'
      );
      return;
    }

    if (!lrChecked || !tarpaulinChecked) {
      Alert.alert(
        'Pre-Dispatch Checklist',
        'Please confirm that the physical LR copy has been signed and cargo is properly secured.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const session = await authService.getCurrentSession();
      const driverId = session?.userId || trip.driverId || 'DRIVER';
      const driverName = session?.fullName || 'Assigned Driver';

      // 1. If document was uploaded by vendor on behalf, driver independently confirms weight
      if (vendorUploadedOnBehalf) {
        await driverService.confirmLoadingWeightIndependently({
          tripId: trip.id,
          bookingId: trip.bookingId,
          driverId,
          driverName,
          recordedWeightMt: netWeightNum,
        });
      }

      // 2. Confirm pickup, persist weighment, and start transit
      const res = await driverService.confirmPickup(
        trip.id,
        trip.bookingId,
        loadingGateNotes.trim(),
        parseFloat(grossWeight) || 32.5,
        parseFloat(tareWeight) || 12.5,
        uploadedWeighbillUrl,
        driverId,
        driverName
      );

      setSubmitting(false);
      Alert.alert(
        'Pickup Confirmed!',
        res.message,
        [{ text: 'Start Highway Transit', onPress: () => onPickupConfirmed(trip.id) }]
      );
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Pickup Error', e.message || 'Could not confirm pickup.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" theme="light" />
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
                  <Text style={styles.stagePillText}>DISPATCH GATE CONFIRMATION</Text>
                </View>
              </View>
              <Text style={styles.titleText}>
                Loading & <Text style={styles.goldText}>Pickup Sign-off</Text>
              </Text>
              <Text style={styles.subText}>
                Upload the loading weighbridge bill, independently confirm recorded weight, and trigger active highway transit.
              </Text>
            </View>

            {/* Consignor Pickup Details */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <MapPin size={16} color="#10B981" />
                <Text style={styles.cardHeaderText}>Loading Point Details</Text>
              </View>

              <Text style={styles.consignorAddress}>{trip.pickupAddress}</Text>

              <View style={styles.routeQuickRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Consigned Cargo:</Text>
                  <Text style={styles.val}>{trip.material} ({trip.capacityMt} MT Target)</Text>
                </View>
                <TouchableOpacity
                  style={styles.navGateBtn}
                  onPress={() => driverService.openNavigation(trip.pickupAddress, trip.origin)}
                >
                  <Navigation size={14} color="#F05A22" />
                  <Text style={styles.navGateText}>GPS to Gate</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── 1. Weighbridge Document Upload Section ── */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Scale size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Loading Weighbridge Bill / Weight Slip *</Text>
              </View>

              {/* Vendor-On-Behalf Banner if applicable */}
              {vendorUploadedOnBehalf && (
                <View style={styles.vendorUploadBanner}>
                  <View style={styles.vendorBadge}>
                    <Text style={styles.vendorBadgeText}>Uploaded by Vendor on Behalf of Driver</Text>
                  </View>
                  <Text style={styles.vendorUploadNotice}>
                    Your transport partner ({vendorName}) uploaded the weighbill on your behalf. Please inspect the slip and independently certify the recorded weight below.
                  </Text>
                </View>
              )}

              {uploadingImage ? (
                <View style={[styles.uploadPromptBox, { alignItems: 'center', paddingVertical: 20 }]}>
                  <ActivityIndicator size="small" color="#F05A22" />
                  <Text style={[styles.uploadInstructionText, { marginTop: 8 }]}>
                    Uploading weighbridge slip to secure storage...
                  </Text>
                </View>
              ) : uploadedWeighbillUrl ? (
                <View style={styles.slipUploadedBox}>
                  <View style={styles.slipIconWrap}>
                    <FileText size={22} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slipFileNameText} numberOfLines={1}>
                      {weighbillFileName || 'Weighbridge_Slip_Loading.pdf'}
                    </Text>
                    <Text style={styles.slipUploadedDateText}>
                      {vendorUploadedOnBehalf ? 'Uploaded by Vendor' : 'Captured by Driver'} • Ready for Verification
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.slipPreviewBtn}
                    onPress={() => setShowSlipPreview(true)}
                    activeOpacity={0.8}
                  >
                    <Eye size={15} color="#0F172A" />
                    <Text style={styles.slipPreviewBtnText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.slipRetakeBtn}
                    onPress={() => handleCaptureWeighbill('camera')}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={14} color="#F05A22" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadPromptBox}>
                  <Text style={styles.uploadInstructionText}>
                    Capture or select the physical weighbridge slip received from the consignor scale operator.
                  </Text>
                  <View style={styles.uploadBtnsRow}>
                    <TouchableOpacity
                      style={styles.captureCameraBtn}
                      onPress={() => handleCaptureWeighbill('camera')}
                      activeOpacity={0.85}
                    >
                      <Camera size={18} color="#FFFFFF" strokeWidth={2.2} />
                      <Text style={styles.captureCameraBtnText}>Take Camera Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.galleryPickBtn}
                      onPress={() => handleCaptureWeighbill('gallery')}
                      activeOpacity={0.8}
                    >
                      <Upload size={16} color="#0F172A" strokeWidth={2.2} />
                      <Text style={styles.galleryPickBtnText}>Select Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* ── 2. Independent Loading Weight Confirmation (MT / KG) ── */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Scale size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Independent Loading Weight Confirmation *</Text>
              </View>

              <View style={styles.weighRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Gross Weight (MT) *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={grossWeight}
                      onChangeText={setGrossWeight}
                      placeholder="32.50"
                      placeholderTextColor="#5C5E66"
                    />
                  </View>
                  <Text style={styles.kgHelper}>≈ {grossKg.toLocaleString('en-IN')} KG</Text>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tare Weight (MT) *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={tareWeight}
                      onChangeText={setTareWeight}
                      placeholder="12.50"
                      placeholderTextColor="#5C5E66"
                    />
                  </View>
                  <Text style={styles.kgHelper}>≈ {tareKg.toLocaleString('en-IN')} KG</Text>
                </View>
              </View>

              <View style={[styles.netWeightBanner, isOverweight && styles.netWeightBannerOverweight]}>
                <Text style={styles.netWeightLabel}>CALCULATED NET CARGO WEIGHT:</Text>
                <Text style={styles.netWeightVal}>
                  {netWeight} MT <Text style={styles.netWeightKg}>({netKg.toLocaleString('en-IN')} KG)</Text>
                </Text>
                {targetMt > 0 && (
                  <View style={styles.toleranceRow}>
                    {isOverweight ? (
                      <Text style={styles.toleranceOverweightText}>
                        ⚠️ Warning: Exceeds target {targetMt} MT (+{((netWeightNum - targetMt)/targetMt * 100).toFixed(1)}%)
                      </Text>
                    ) : isWithinTolerance ? (
                      <Text style={styles.toleranceOkText}>✓ Within Target Tolerance ({targetMt} MT)</Text>
                    ) : (
                      <Text style={styles.toleranceNeutralText}>Target: {targetMt} MT</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Driver Independent Weight Certification Checkbox */}
              <TouchableOpacity
                style={styles.certifyRow}
                onPress={() => setIndependentWeightConfirmed(!independentWeightConfirmed)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkBox,
                    independentWeightConfirmed && styles.checkBoxActive,
                  ]}
                >
                  {independentWeightConfirmed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.certifyTitle}>Independent Driver Confirmation *</Text>
                  <Text style={styles.certifySub}>
                    I independently certify that {netWeight} MT represents the accurate net cargo weight recorded at the loading weighbridge.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ── 3. Pre-Dispatch Safety & Documents Checklist ── */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <FileCheck2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Pre-Dispatch Checklist</Text>
              </View>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setLrChecked(!lrChecked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, lrChecked && styles.checkBoxActive]}>
                  {lrChecked && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Lorry Receipt (LR) Consignor Sign-off</Text>
                  <Text style={styles.checkSub}>Physical LR copy counter-signed by gate supervisor</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setTarpaulinChecked(!tarpaulinChecked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, tarpaulinChecked && styles.checkBoxActive]}>
                  {tarpaulinChecked && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Weatherproofing & Lashing Secured</Text>
                  <Text style={styles.checkSub}>Cargo covered with waterproof tarpaulin and lashed</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Confirm Pickup Action */}
            <TouchableOpacity
              style={[
                styles.goldPillBtn,
                (!uploadedWeighbillUrl || !independentWeightConfirmed || submitting) && styles.goldPillBtnDisabled,
              ]}
              onPress={handleConfirmPickup}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Confirm Loading & Start Transit</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            {!uploadedWeighbillUrl && (
              <Text style={styles.blockedNoticeText}>
                * Loading weighbridge bill photo capture is mandatory to proceed.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Document Preview Modal ── */}
      <Modal
        visible={showSlipPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSlipPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Weighbridge Slip Preview</Text>
              <TouchableOpacity onPress={() => setShowSlipPreview(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewPaper}>
              <View style={styles.paperWatermark}>
                <Scale size={32} color="#F05A22" />
                <Text style={styles.paperWatermarkText}>LOADING WEIGHBRIDGE CERTIFICATE</Text>
              </View>
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewMetaLabel}>Trip Reference:</Text>
                <Text style={styles.previewMetaVal}>{tripId}</Text>
              </View>
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewMetaLabel}>Gross Weight:</Text>
                <Text style={styles.previewMetaVal}>{grossWeight} MT</Text>
              </View>
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewMetaLabel}>Tare Weight:</Text>
                <Text style={styles.previewMetaVal}>{tareWeight} MT</Text>
              </View>
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewMetaLabel}>Net Payload:</Text>
                <Text style={[styles.previewMetaVal, { color: '#F05A22', fontWeight: '800' }]}>
                  {netWeight} MT
                </Text>
              </View>
              {vendorUploadedOnBehalf && (
                <View style={styles.vendorStamp}>
                  <Text style={styles.vendorStampText}>Uploaded by Vendor on Behalf of Driver</Text>
                  <Text style={styles.vendorStampSub}>{vendorName}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowSlipPreview(false)}
            >
              <Text style={styles.closeModalBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  consignorAddress: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
  },
  routeQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  val: {
    fontSize: 13,
    fontWeight: '700',
    color: '#172B4D',
  },
  navGateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  navGateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F05A22',
  },
  vendorUploadBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  vendorBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  vendorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  vendorUploadNotice: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  slipUploadedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  slipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipFileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  slipUploadedDateText: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  slipPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  slipPreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  slipRetakeBtn: {
    padding: 8,
  },
  uploadPromptBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  uploadInstructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  uploadBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  captureCameraBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingVertical: 10,
    borderRadius: 8,
  },
  captureCameraBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  galleryPickBtn: {
    flex: 1,
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
  galleryPickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  weighRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  fieldGroup: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  kgHelper: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  netWeightBanner: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  netWeightBannerOverweight: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  netWeightLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  netWeightVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  netWeightKg: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  toleranceRow: {
    marginTop: 4,
  },
  toleranceOkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  toleranceOverweightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  toleranceNeutralText: {
    fontSize: 11,
    color: '#64748B',
  },
  certifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  certifyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9A3412',
  },
  certifySub: {
    fontSize: 11,
    color: '#7C2D12',
    marginTop: 2,
    lineHeight: 16,
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
    marginTop: 10,
  },
  goldPillBtnDisabled: {
    opacity: 0.5,
  },
  goldPillText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  blockedNoticeText: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  paperWatermarkText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F05A22',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewMetaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  previewMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  vendorStamp: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D97706',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    backgroundColor: '#FFFBEB',
  },
  vendorStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  vendorStampSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  closeModalBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
