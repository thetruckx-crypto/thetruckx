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
  AlertTriangle,
  Upload,
  CheckCircle2,
  FileText,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { driverService } from '../../../services/driverService';

interface DriverDocumentCorrectionScreenProps {
  initialMobile: string;
  driverId?: string;
  onBack: () => void;
  onCorrectionSubmitted: () => void;
}

export const DriverDocumentCorrectionScreen: React.FC<DriverDocumentCorrectionScreenProps> = ({
  initialMobile,
  driverId,
  onBack,
  onCorrectionSubmitted,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [selectedFileMap, setSelectedFileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    driverService.getDriverProfile(driverId, initialMobile).then((res) => {
      setDriverProfile(res);
      setLoading(false);
    });
  }, [driverId, initialMobile]);

  const handleSimulateSelect = (docKey: string) => {
    const filename = `corrected_${docKey.toLowerCase()}_${Date.now().toString().slice(-4)}.pdf`;
    setSelectedFileMap((prev) => ({
      ...prev,
      [docKey]: filename,
    }));
  };

  const handleSubmitCorrections = async () => {
    const keys = Object.keys(selectedFileMap);
    if (keys.length === 0) {
      Alert.alert('No Documents Selected', 'Please upload at least one corrected document to resubmit.');
      return;
    }

    setSubmitting(true);
    try {
      const activeDriverId = driverProfile?.id || driverId || 'drv-temp';
      for (const key of keys) {
        const file = selectedFileMap[key];
        await driverService.reuploadDriverDocument(
          activeDriverId,
          key,
          'DRIVING_LICENCE',
          `https://trucks.in/storage/corrections/${file}`
        );
      }

      setSubmitting(false);
      Alert.alert(
        'Corrections Submitted',
        'Your updated commercial documents have been queued for priority re-audit by the TRUCKS compliance desk.',
        [{ text: 'View Status', onPress: onCorrectionSubmitted }]
      );
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Upload Error', e.message || 'Could not resubmit documents.');
    }
  };

  const rejectionReason = driverProfile?.rejectionReason || 'Driving licence scan blurriness or validity mismatch.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={170} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {/* Header */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Document <Text style={styles.goldText}>Status & Correction</Text>
            </Text>
            <Text style={styles.subText}>
              Review the compliance officer's feedback and re-upload clear document scans.
            </Text>
          </View>

          {/* Feedback Card */}
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <ShieldAlert size={18} color="#EF4444" />
              <Text style={styles.alertHeaderText}>Audit Feedback from TRUCKS Desk</Text>
            </View>
            <Text style={styles.alertMessage}>{rejectionReason}</Text>
          </View>

          {/* Documents Requiring Re-upload */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <RotateCcw size={15} color="#F05A22" />
              <Text style={styles.cardHeaderText}>Action Required: Re-Upload Items</Text>
            </View>

            {/* DL Front */}
            <View style={styles.correctionItem}>
              <View style={styles.correctionTop}>
                <FileText size={16} color="#F05A22" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>Commercial Driving Licence (Front)</Text>
                  <Text style={styles.docHint}>Ensure all numbers, photo, and RTO stamp are sharp</Text>
                </View>
              </View>

              {selectedFileMap['DL_FRONT'] ? (
                <View style={styles.attachedRow}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.attachedText}>{selectedFileMap['DL_FRONT']}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.reuploadBtn}
                  onPress={() => handleSimulateSelect('DL_FRONT')}
                >
                  <Upload size={14} color="#F05A22" />
                  <Text style={styles.reuploadBtnText}>Upload Clear Scan / Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* DL Back */}
            <View style={styles.correctionItem}>
              <View style={styles.correctionTop}>
                <FileText size={16} color="#F05A22" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>Commercial Driving Licence (Back)</Text>
                  <Text style={styles.docHint}>Badge authorization and endorsements side</Text>
                </View>
              </View>

              {selectedFileMap['DL_BACK'] ? (
                <View style={styles.attachedRow}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.attachedText}>{selectedFileMap['DL_BACK']}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.reuploadBtn}
                  onPress={() => handleSimulateSelect('DL_BACK')}
                >
                  <Upload size={14} color="#F05A22" />
                  <Text style={styles.reuploadBtnText}>Upload Clear Scan / Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Resubmit CTA */}
          <TouchableOpacity
            style={[styles.goldPillBtn, submitting && styles.goldPillBtnDisabled]}
            onPress={handleSubmitCorrections}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.goldPillText}>Resubmit Corrected Documents</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
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
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
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
    textAlign: 'center',
    lineHeight: 17,
  },
  alertCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertHeaderText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  alertMessage: {
    color: '#172B4D',
    fontSize: 12.5,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  correctionItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
  },
  correctionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  docName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  docHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F222B',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingVertical: 10,
  },
  reuploadBtnText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  attachedText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goldPillBtnDisabled: {
    opacity: 0.6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
