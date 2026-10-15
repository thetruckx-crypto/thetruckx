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
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';
import { VendorDocumentItem } from '../types';

interface VendorDocumentUploadScreenProps {
  onBack: () => void;
  onNext: (documents: VendorDocumentItem[]) => void;
}

export const VendorDocumentUploadScreen: React.FC<VendorDocumentUploadScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [documents, setDocuments] = useState<VendorDocumentItem[]>([
    {
      id: 'doc-1',
      docType: 'COMPANY_PAN',
      title: 'Company / Proprietor PAN Card',
      status: 'PENDING',
    },
    {
      id: 'doc-2',
      docType: 'GST_CERTIFICATE',
      title: 'GST Registration Certificate',
      status: 'PENDING',
    },
    {
      id: 'doc-3',
      docType: 'BANK_CANCELLED_CHEQUE',
      title: 'Bank Cancelled Cheque / Statement',
      status: 'PENDING',
    },
    {
      id: 'doc-4',
      docType: 'TRANSPORT_DECLARATION',
      title: 'Transporter Undertaking / Declaration',
      status: 'PENDING',
    },
  ]);

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.documents && draft.documents.length > 0) {
        setDocuments(draft.documents);
      }
    })();
  }, []);

  const handleSimulateUpload = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              fileName: `${d.docType.toLowerCase()}_updated_${Date.now().toString().slice(-4)}.pdf`,
              uploadedAt: new Date().toISOString(),
            }
          : d
      )
    );
    Alert.alert('Document Attached', 'File selected and prepared for compliance upload.');
  };

  const handleContinue = async () => {
    await vendorService.saveDraftForm({ documents });
    onNext(documents);
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

        {/* Stepper Progress */}
        <View style={styles.stepperWrap}>
          <View style={styles.stepperHeader}>
            <Text style={styles.stepBadge}>STEP 7 OF 7</Text>
            <Text style={styles.stepTitle}>Compliance KYC Documents</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '100%' }]} />
          </View>
        </View>

        {/* Form Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Document <Text style={styles.goldText}>Upload</Text>
            </Text>
            <Text style={styles.subText}>
              Upload mandatory compliance documents required for GST settlement and vendor onboarding.
            </Text>
          </View>

          {/* Document Slot Cards */}
          <View style={styles.docsCol}>
            {documents.map((doc) => {
              const isAttached = !!doc.fileName;
              return (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docTopRow}>
                    <View style={styles.docIconWrap}>
                      <FileText size={18} color="#F05A22" />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docTitle}>{doc.title}</Text>
                      <Text style={styles.docFileName}>
                        {isAttached ? doc.fileName : 'PDF / JPG / PNG (Max 5MB)'}
                      </Text>
                    </View>
                    {isAttached && <CheckCircle2 size={18} color="#10B981" />}
                  </View>

                  <View style={styles.docActionsRow}>
                    <TouchableOpacity
                      style={styles.uploadActionBtn}
                      onPress={() => handleSimulateUpload(doc.id)}
                      activeOpacity={0.8}
                    >
                      <UploadCloud size={14} color="#F05A22" />
                      <Text style={styles.uploadActionText}>
                        {isAttached ? 'Replace File' : 'Choose File'}
                      </Text>
                    </TouchableOpacity>

                    {isAttached && (
                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={() =>
                          Alert.alert('Preview Document', `Viewing ${doc.fileName} securely.`)
                        }
                      >
                        <Eye size={14} color="#A0A2A8" />
                        <Text style={styles.previewText}>Preview</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Compliance Note */}
          <View style={styles.noteBox}>
            <AlertCircle size={15} color="#F05A22" />
            <Text style={styles.noteText}>
              All documents are encrypted and audited according to Indian Logistics Compliance regulations.
            </Text>
          </View>

          {/* Continue to Review */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Review Full Application</Text>
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
    bottom: 6,
    alignSelf: 'center',
  },
  stepperWrap: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepBadge: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F05A22',
  },
  contentWrap: {
    paddingHorizontal: 20,
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
  docsCol: {
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
  docTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  docIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  docFileName: {
    color: '#64748B',
    fontSize: 11,
  },
  docActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  uploadActionBtn: {
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
  uploadActionText: {
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
  previewText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noteText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
