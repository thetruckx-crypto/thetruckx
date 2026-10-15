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
} from 'react-native';
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
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { driverService } from '../services/driverService';
import { DriverTripItem } from '../types';

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
  const [stampVerified, setStampVerified] = useState(true);
  const [signatureVerified, setSignatureVerified] = useState(true);
  const [remarksVerified, setRemarksVerified] = useState(true);

  useEffect(() => {
    driverService.getTripDetails(tripId).then((data) => {
      setTrip(data);
      setLoading(false);
    });
  }, [tripId]);

  const handleSimulatePhoto = () => {
    const filename = `stamped_epod_${Date.now().toString().slice(-5)}.pdf`;
    setUploadedPodFile(filename);
  };

  const handleRemoveFile = () => {
    setUploadedPodFile(null);
  };

  const handleSubmitPod = async () => {
    if (!uploadedPodFile) {
      Alert.alert('POD Required', 'Please capture or select a photo of the counter-signed, rubber-stamped physical POD.');
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
      const res = await driverService.uploadPodAndCompleteTrip(
        trip.id,
        trip.bookingId,
        `https://necl.in/storage/trip_pods/${uploadedPodFile}`,
        trip.receiverName || 'Receiving Officer'
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
            <Text style={{ color: '#FFFFFF' }}>Trip not found.</Text>
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
                Upload the counter-signed physical consignment copy with consignee rubber stamp for freight settlement.
              </Text>
            </View>

            {/* Consignment Reference Card */}
            <View style={styles.refCard}>
              <Text style={styles.refLabel}>DELIVERED CONSIGNMENT</Text>
              <Text style={styles.refTitle}>
                {trip.origin} ➔ {trip.destination}
              </Text>
              <Text style={styles.refSub}>
                Vehicle: {trip.vehicleNumber} • #{trip.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
              </Text>
            </View>

            {/* Upload Box */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <FileCheck2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Signed & Stamped Lorry Receipt (POD)</Text>
              </View>

              {uploadedPodFile ? (
                <View style={styles.previewBox}>
                  <CheckCircle2 size={24} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName}>{uploadedPodFile}</Text>
                    <Text style={styles.fileHint}>High-resolution legible scan attached</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveFile}>
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadArea}>
                  <TouchableOpacity
                    style={styles.cameraBtn}
                    onPress={handleSimulatePhoto}
                    activeOpacity={0.8}
                  >
                    <Camera size={20} color="#F05A22" />
                    <Text style={styles.cameraBtnText}>Capture Stamped POD Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filePickerBtn}
                    onPress={handleSimulatePhoto}
                    activeOpacity={0.8}
                  >
                    <Upload size={16} color="#909299" />
                    <Text style={styles.filePickerText}>Or select PDF from documents</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 3-Point Delivery Sign-off Checklist */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <ShieldCheck size={16} color="#10B981" />
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
                  <Text style={styles.checkTitle}>Consignee Rubber Stamp Visible</Text>
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
                  <Text style={styles.checkTitle}>Receiver Signature & Date Marked</Text>
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
                  <Text style={styles.checkTitle}>Clean Delivery / Zero Damage Remarks</Text>
                  <Text style={styles.checkSub}>No unrecorded shortage, leakage, or package damages</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              style={[styles.goldPillBtn, submitting && styles.goldPillBtnDisabled]}
              onPress={handleSubmitPod}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Submit Stamped POD & Close Trip</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stagePillText: {
    color: '#10B981',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  refLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  refTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  refSub: {
    color: '#64748B',
    fontSize: 11,
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
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadArea: {
    gap: 10,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#F05A22',
    borderRadius: 12,
    height: 52,
  },
  cameraBtnText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    height: 40,
  },
  filePickerText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  fileName: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '700',
  },
  fileHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#7C7E86',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  checkTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
  },
  checkSub: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  stampCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 6,
  },
  goldPillBtnDisabled: {
    opacity: 0.6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
