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
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorTripDocumentsScreenProps {
  tripId: string;
  onBack: () => void;
}

export const VendorTripDocumentsScreen: React.FC<VendorTripDocumentsScreenProps> = ({
  tripId,
  onBack,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const docSlots = [
    { type: 'POD_LR', title: 'Signed Proof of Delivery (POD / Consignee Copy)', required: true },
    { type: 'WEIGHBRIDGE_SLIP', title: 'Weighbridge Gross & Tare Slip', required: false },
    { type: 'DELIVERY_RECEIPT', title: 'Unloading Acknowledgment Receipt', required: false },
    { type: 'WAYBILL', title: 'E-Waybill Transit Copy', required: false },
  ];

  const loadDocs = useCallback(async () => {
    try {
      const data = await vendorService.getTripDocuments(tripId);
      setDocuments(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUploadDoc = async (type: string, title: string) => {
    setUploading(true);
    try {
      const simulatedUrl = `https://necl.in/storage/trips/${tripId}/${type.toLowerCase()}_signed.pdf`;
      await vendorService.uploadTripDocument({
        tripId,
        documentType: type as any,
        fileUrl: simulatedUrl,
      });

      Alert.alert(
        'Document Uploaded',
        `${title} has been uploaded and queued for NECL consignee audit.`
      );
      await loadDocs();
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
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Proof of <Text style={styles.goldText}>Delivery & POD</Text>
            </Text>
            <Text style={styles.subText}>
              Upload signed consignee POD receipt and weighbridge slips for carrier freight clearance.
            </Text>
          </View>

          {/* Compliance Notice */}
          <View style={styles.noticeBox}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.noticeText}>
              Digital POD Fast-Settlement: Carrier payment is authorized immediately upon approved POD stamp.
            </Text>
          </View>

          {/* Document Slots */}
          <View style={styles.slotsCol}>
            {docSlots.map((slot) => {
              const uploadedDoc = documents.find((d) => d.documentType === slot.type);
              const isUploaded = !!uploadedDoc;
              const isApproved = uploadedDoc?.status === 'APPROVED';

              return (
                <View key={slot.type} style={styles.slotCard}>
                  <View style={styles.slotTopRow}>
                    <View style={styles.iconWrap}>
                      <FileText size={18} color="#F05A22" />
                    </View>

                    <View style={styles.slotInfo}>
                      <Text style={styles.slotTitle}>{slot.title}</Text>
                      <Text style={styles.slotStatusSub}>
                        {isUploaded
                          ? `Uploaded • ${uploadedDoc.status}`
                          : slot.required
                          ? 'Mandatory for freight payment'
                          : 'Optional transit document'}
                      </Text>
                    </View>

                    {isApproved ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : isUploaded ? (
                      <Clock size={16} color="#F59E0B" />
                    ) : null}
                  </View>

                  <View style={styles.slotActionsRow}>
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => handleUploadDoc(slot.type, slot.title)}
                      disabled={uploading}
                      activeOpacity={0.8}
                    >
                      <UploadCloud size={14} color="#F05A22" />
                      <Text style={styles.uploadBtnText}>
                        {isUploaded ? 'Re-upload / Replace' : 'Upload Document'}
                      </Text>
                    </TouchableOpacity>

                    {isUploaded && (
                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={() =>
                          Alert.alert('Document Preview', `Previewing ${slot.title} securely.`)
                        }
                      >
                        <Eye size={14} color="#A0A2A8" />
                        <Text style={styles.previewBtnText}>Preview</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Back Action */}
          <TouchableOpacity style={styles.doneBtn} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Return to Trip Management</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomGoldWings />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
  },
  slotsCol: {
    gap: 12,
    marginBottom: 20,
  },
  slotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInfo: {
    flex: 1,
  },
  slotTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  slotStatusSub: {
    color: '#64748B',
    fontSize: 11,
  },
  slotActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  uploadBtnText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  previewBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
  },
});
