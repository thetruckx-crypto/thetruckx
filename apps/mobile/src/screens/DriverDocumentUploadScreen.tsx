import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  FileText,
  Upload,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  FileCheck,
  AlertCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { driverService } from '../services/driverService';
import { DriverDocumentItem } from '../types';

interface DriverDocumentUploadScreenProps {
  onBack: () => void;
  onNext: () => void;
}

export const DriverDocumentUploadScreen: React.FC<DriverDocumentUploadScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [documents, setDocuments] = useState<DriverDocumentItem[]>([
    {
      id: 'doc-1',
      docType: 'DRIVING_LICENCE',
      title: 'Commercial Driving Licence (Front)',
      status: 'PENDING',
    },
    {
      id: 'doc-2',
      docType: 'DRIVING_LICENCE',
      title: 'Commercial Driving Licence (Back)',
      status: 'PENDING',
    },
    {
      id: 'doc-3',
      docType: 'AADHAR_CARD',
      title: 'Aadhaar Card (Front & Back)',
      status: 'PENDING',
    },
    {
      id: 'doc-4',
      docType: 'MEDICAL_FITNESS',
      title: 'Medical Fitness Certificate (Form 1A)',
      status: 'PENDING',
    },
    {
      id: 'doc-5',
      docType: 'POLICE_VERIFICATION',
      title: 'Police Clearance / Background Verification',
      status: 'PENDING',
    },
  ]);

  useEffect(() => {
    driverService.getDraftForm().then((draft) => {
      if (draft && draft.documents && draft.documents.length > 0) {
        setDocuments(draft.documents);
      }
    });
  }, []);

  const handleSimulateUpload = (index: number) => {
    const updated = [...documents];
    const item = updated[index];
    const generatedFileName = `${item.docType.toLowerCase()}_scan_${Date.now().toString().slice(-4)}.pdf`;

    updated[index] = {
      ...item,
      fileName: generatedFileName,
      fileUrl: `https://necl.in/storage/driver_docs/${generatedFileName}`,
      status: 'PENDING',
      uploadedAt: new Date().toISOString(),
    };

    setDocuments(updated);
  };

  const handleRemoveDoc = (index: number) => {
    const updated = [...documents];
    updated[index] = {
      ...updated[index],
      fileName: undefined,
      fileUrl: undefined,
    };
    setDocuments(updated);
  };

  const handleNext = async () => {
    // Check mandatory documents (DL front, DL back, Aadhaar)
    const dlFront = documents[0].fileName;
    const dlBack = documents[1].fileName;
    const aadhar = documents[2].fileName;

    if (!dlFront || !dlBack || !aadhar) {
      Alert.alert(
        'Mandatory Documents Required',
        'Please upload Commercial Driving Licence (Front & Back) and Aadhaar Card to proceed.'
      );
      return;
    }

    await driverService.saveDraftForm({
      documents,
    });

    onNext();
  };

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
          {/* Step Progress Pill */}
          <View style={styles.stepIndicatorRow}>
            <Text style={styles.stepIndicatorText}>STEP 4 OF 4 • DOCUMENT UPLOAD & KYC</Text>
          </View>

          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Driver <Text style={styles.goldText}>KYC & Documents</Text>
            </Text>
            <Text style={styles.subText}>
              Upload legible photos or PDFs of your commercial credentials for fast approval.
            </Text>
          </View>

          {/* Document Upload Items */}
          <View style={styles.docList}>
            {documents.map((doc, idx) => {
              const isMandatory = idx <= 2;
              const isUploaded = !!doc.fileName;

              return (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <View style={styles.docTitleRow}>
                      <FileText size={16} color={isUploaded ? '#10B981' : '#F05A22'} />
                      <Text style={styles.docTitle}>
                        {doc.title} {isMandatory && <Text style={{ color: '#EF4444' }}>*</Text>}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        isUploaded ? styles.statusPillSuccess : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isUploaded ? styles.statusTextSuccess : styles.statusTextPending,
                        ]}
                      >
                        {isUploaded ? 'Ready for Audit' : isMandatory ? 'Mandatory' : 'Optional'}
                      </Text>
                    </View>
                  </View>

                  {isUploaded ? (
                    <View style={styles.uploadedRow}>
                      <View style={styles.fileDetails}>
                        <CheckCircle2 size={16} color="#10B981" />
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {doc.fileName}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.trashBtn}
                        onPress={() => handleRemoveDoc(idx)}
                        accessibilityLabel="Delete file"
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => handleSimulateUpload(idx)}
                      activeOpacity={0.8}
                    >
                      <Upload size={15} color="#F05A22" />
                      <Text style={styles.uploadBtnText}>Select File or Camera Scan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Compliance Assurance */}
          <View style={styles.complianceNote}>
            <ShieldCheck size={18} color="#F05A22" />
            <Text style={styles.complianceText}>
              NECL encrypts all driver KYC records. Documents are strictly shared only with police and authorized port authorities when required by law.
            </Text>
          </View>

          {/* Next CTA */}
          <TouchableOpacity
            style={styles.goldPillBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.goldPillText}>Review Complete Application</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
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
  stepIndicatorRow: {
    alignSelf: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  stepIndicatorText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
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
  docList: {
    gap: 12,
    marginBottom: 16,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  docTitle: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillPending: {
    backgroundColor: '#1C1D24',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#64748B',
  },
  statusTextSuccess: {
    color: '#10B981',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FDBA74',
    borderRadius: 10,
    paddingVertical: 11,
  },
  uploadBtnText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fileNameText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  trashBtn: {
    padding: 4,
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  complianceText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
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
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
