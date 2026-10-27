import React, { useState, useEffect, useCallback } from 'react';
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
  TextInput,
} from 'react-native';
import {
  ChevronLeft,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  Eye,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Scale,
  X,
  FileUp,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { authService } from '../../../services/authService';
import { documentWorkflowService } from '../../../services/documentWorkflowService';

interface VendorTripDocumentsScreenProps {
  tripId: string;
  onBack: () => void;
}

export const VendorTripDocumentsScreen: React.FC<VendorTripDocumentsScreenProps> = ({
  tripId,
  onBack,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [trip, setTrip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload weighbill on behalf modal
  const [showWeighbillModal, setShowWeighbillModal] = useState(false);
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');

  const docSlots = [
    {
      type: 'LOADING_WEIGHBILL',
      title: 'Loading Weighbridge Bill (On Behalf of Driver)',
      description: 'Upload weighbridge gross & tare slip if driver is unable to upload from scale yard',
      required: true,
      isOnBehalf: true,
    },
    {
      type: 'POD_LR',
      title: 'Signed Proof of Delivery (POD / Consignee Copy)',
      description: 'Counter-signed LR with rubber stamp and receiver seal',
      required: true,
      isOnBehalf: false,
    },
    {
      type: 'DELIVERY_RECEIPT',
      title: 'Unloading Acknowledgment Receipt',
      description: 'Consignee warehouse receiving voucher / gate pass',
      required: false,
      isOnBehalf: false,
    },
    {
      type: 'WAYBILL',
      title: 'E-Waybill Transit Copy',
      description: 'Official GST e-waybill document copy',
      required: false,
      isOnBehalf: false,
    },
  ];

  const loadData = useCallback(async () => {
    try {
      const [tripDetails, docs] = await Promise.all([
        vendorService.getTripDetails(tripId),
        vendorService.getTripDocuments(tripId),
      ]);
      setTrip(tripDetails);
      setDocuments(docs);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadWeighbillOnBehalf = async () => {
    const grossNum = parseFloat(grossWeight);
    const tareNum = parseFloat(tareWeight);
    if (!grossNum || !tareNum || grossNum <= tareNum) {
      Alert.alert('Invalid Weights', 'Please enter valid Gross and Tare weights in MT.');
      return;
    }

    setUploading(true);
    try {
      const session = await authService.getCurrentSession();
      const vendorId = session?.userId || trip?.vendorId || 'VENDOR';
      const vendorName = session?.companyName || session?.fullName || 'Transport Partner';

      const netNum = grossNum - tareNum;
      const fileName = `vendor_weighslip_${tripId.slice(-6)}.pdf`;
      const fileUrl = `https://trucks-storage.s3.ap-south-1.amazonaws.com/vendor_uploads/${fileName}`;

      const res = await vendorService.uploadWeighbillOnBehalfOfDriver({
        bookingId: trip?.bookingId || tripId,
        tripId,
        vendorId,
        vendorName,
        driverId: trip?.driver?.id || 'DRIVER_USER',
        driverName: trip?.driver?.fullName || 'Assigned Driver',
        fileName,
        fileUrl,
        grossWeightMt: grossNum,
        tareWeightMt: tareNum,
        recordedWeightMt: netNum,
      });

      setUploading(false);
      setShowWeighbillModal(false);

      if (res.success) {
        Alert.alert(
          'Document Uploaded',
          'Weighbill uploaded and labeled: "Uploaded by Vendor on Behalf of Driver". Driver independent confirmation remains pending.'
        );
        await loadData();
      } else {
        Alert.alert('Upload Error', res.message);
      }
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Upload Failed', e.message || 'Could not upload weighbill.');
    }
  };

  const handleUploadGenericDoc = async (type: string, title: string) => {
    setUploading(true);
    try {
      const simulatedUrl = `https://trucks-storage.s3.ap-south-1.amazonaws.com/trips/${tripId}/${type.toLowerCase()}_signed.pdf`;
      await vendorService.uploadTripDocument({
        tripId,
        documentType: type as any,
        fileUrl: simulatedUrl,
      });

      Alert.alert(
        'Document Uploaded',
        `${title} has been uploaded and queued for TRUCKS consignee audit.`
      );
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Trip & Driver <Text style={styles.goldText}>Documents</Text>
            </Text>
            <Text style={styles.subText}>
              Upload signed consignee POD receipts and support drivers with loading weighbill submissions.
            </Text>
          </View>

          {/* Compliance Notice */}
          <View style={styles.noticeBox}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.noticeText}>
              Vendor-Uploaded Driver Weighbills will be clearly labeled and require independent confirmation from the driver.
            </Text>
          </View>

          {/* Document Slots */}
          <View style={styles.slotsCol}>
            {docSlots.map((slot) => {
              const uploadedDoc = documents.find(
                (d) =>
                  d.documentType === slot.type ||
                  (slot.type === 'LOADING_WEIGHBILL' && d.documentType === 'WEIGHBRIDGE_SLIP')
              );

              const isVendorOnBehalf =
                uploadedDoc?.uploadResponsibility === 'VENDOR_ON_BEHALF_OF_DRIVER' ||
                uploadedDoc?.metadata?.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER';
              const isDriverConfirmed =
                uploadedDoc &&
                (uploadedDoc.metadata?.driverConfirmed ||
                  uploadedDoc.uploadResponsibility === 'DRIVER');

              return (
                <View key={slot.type} style={styles.slotCard}>
                  <View style={styles.slotHeader}>
                    <View style={styles.slotIconBox}>
                      {slot.type === 'LOADING_WEIGHBILL' ? (
                        <Scale size={18} color="#F05A22" />
                      ) : (
                        <FileText size={18} color="#F05A22" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotTitle}>{slot.title}</Text>
                      <Text style={styles.slotSub}>{slot.description}</Text>
                    </View>

                    {uploadedDoc ? (
                      <View style={styles.badgeSuccess}>
                        <CheckCircle2 size={13} color="#15803D" />
                        <Text style={styles.badgeSuccessText}>
                          {slot.type === 'LOADING_WEIGHBILL' && !isDriverConfirmed
                            ? 'Uploaded (Driver Pending)'
                            : 'Submitted'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.badgePending}>
                        <Clock size={13} color="#B45309" />
                        <Text style={styles.badgePendingText}>
                          {slot.required ? 'Pending' : 'Optional'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Label for vendor on behalf */}
                  {uploadedDoc && isVendorOnBehalf && (
                    <View style={styles.behalfTag}>
                      <Text style={styles.behalfTagText}>
                        Uploaded by Vendor on Behalf of Driver
                      </Text>
                      {!isDriverConfirmed && (
                        <Text style={styles.behalfTagNotice}>
                          ⏳ Driver independent weight confirmation is still pending.
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.slotActionRow}>
                    {slot.type === 'LOADING_WEIGHBILL' ? (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => setShowWeighbillModal(true)}
                        activeOpacity={0.85}
                      >
                        <FileUp size={15} color="#FFFFFF" />
                        <Text style={styles.uploadBtnText}>
                          {uploadedDoc ? 'Replace Slip on Driver Behalf' : 'Upload on Behalf of Driver'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => handleUploadGenericDoc(slot.type, slot.title)}
                        activeOpacity={0.85}
                      >
                        <UploadCloud size={15} color="#FFFFFF" />
                        <Text style={styles.uploadBtnText}>
                          {uploadedDoc ? 'Replace Document' : 'Upload File'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <BottomGoldWings />
      </ScrollView>

      {/* ── Weighbill On Behalf Modal ── */}
      <Modal
        visible={showWeighbillModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeighbillModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Upload Weighbill on Driver Behalf</Text>
              <TouchableOpacity onPress={() => setShowWeighbillModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.labelNoticeBox}>
              <Text style={styles.labelNoticeBadge}>Notice:</Text>
              <Text style={styles.labelNoticeHighlight}>"Uploaded by Vendor on Behalf of Driver"</Text>
              <Text style={styles.labelNoticeDesc}>
                This upload will identify your vendor organization as the submitting entity. Driver confirmation will remain pending until confirmed by the assigned driver in their mobile app.
              </Text>
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Gross Weight (MT) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={grossWeight}
                  onChangeText={setGrossWeight}
                  placeholder="32.50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Tare Weight (MT) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={tareWeight}
                  onChangeText={setTareWeight}
                  placeholder="12.50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.netPreviewRow}>
              <Text style={styles.netPreviewLabel}>Net Cargo Weight:</Text>
              <Text style={styles.netPreviewVal}>
                {(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(tareWeight) || 0))).toFixed(2)} MT
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowWeighbillModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, uploading && styles.btnDisabled]}
                onPress={handleUploadWeighbillOnBehalf}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit on Driver Behalf</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    paddingBottom: 60,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
  },
  contentWrap: {
    paddingHorizontal: 16,
    marginTop: -20,
    zIndex: 2,
  },
  headingWrap: {
    marginBottom: 14,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#E2E8F0',
    lineHeight: 16,
  },
  slotsCol: {
    gap: 12,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  slotIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  slotTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  slotSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeSuccessText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgePendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  behalfTag: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  behalfTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  behalfTagNotice: {
    fontSize: 10.5,
    color: '#78350F',
    marginTop: 2,
  },
  slotActionRow: {
    marginTop: 12,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingVertical: 9,
    borderRadius: 8,
  },
  uploadBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  labelNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  labelNoticeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  labelNoticeHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  labelNoticeDesc: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 15,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  textInput: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  netPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  netPreviewLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  netPreviewVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F05A22',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
