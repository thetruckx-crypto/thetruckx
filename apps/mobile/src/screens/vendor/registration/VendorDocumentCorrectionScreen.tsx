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
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { VendorDocumentItem } from '../../../types';

interface VendorDocumentCorrectionScreenProps {
  vendorId: string;
  onBack: () => void;
  onDone: () => void;
}

export const VendorDocumentCorrectionScreen: React.FC<VendorDocumentCorrectionScreenProps> = ({
  vendorId,
  onBack,
  onDone,
}) => {
  const [documents, setDocuments] = useState<VendorDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const docs = await vendorService.getVendorDocuments(vendorId);
      setDocuments(docs);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleReupload = async (doc: VendorDocumentItem) => {
    const updatedFileName = `${doc.docType.toLowerCase()}_corrected_${Date.now().toString().slice(-4)}.pdf`;
    const updatedUrl = `https://trucks.in/storage/corrections/${updatedFileName}`;

    await vendorService.resubmitCorrectedDocument(vendorId, doc.id, updatedFileName, updatedUrl);

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? {
              ...d,
              fileName: updatedFileName,
              fileUrl: updatedUrl,
              status: 'PENDING',
              rejectionReason: undefined,
            }
          : d
      )
    );

    Alert.alert(
      'Document Re-uploaded',
      `${doc.title} has been updated with the corrected copy and flagged for urgent admin re-audit.`
    );
  };

  const handleFinish = () => {
    Alert.alert(
      'Corrections Submitted',
      'All updated compliance documents have been sent to the TRUCKS compliance desk for expedited review.',
      [{ text: 'View Verification Status', onPress: onDone }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Document <Text style={styles.goldText}>Corrections</Text>
            </Text>
            <Text style={styles.subText}>
              Review compliance officer feedback and upload clear, corrected copies of rejected certificates.
            </Text>
          </View>

          {/* Compliance Notice */}
          <View style={styles.alertNotice}>
            <ShieldAlert size={18} color="#EF4444" />
            <Text style={styles.alertNoticeText}>
              Fast-track verification: Once corrected files are uploaded, re-audit takes under 4 hours.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.docsCol}>
              {documents.map((doc) => {
                const isRejected = doc.status === 'REJECTED';
                const isApproved = doc.status === 'APPROVED';
                const isPending = doc.status === 'PENDING';

                return (
                  <View
                    key={doc.id}
                    style={[
                      styles.docCard,
                      isRejected && styles.cardRejected,
                      isApproved && styles.cardApproved,
                    ]}
                  >
                    <View style={styles.docHeaderRow}>
                      <View style={styles.docIconWrap}>
                        <FileText size={18} color={isRejected ? '#EF4444' : '#F05A22'} />
                      </View>
                      <View style={styles.docDetails}>
                        <Text style={styles.docTitle}>{doc.title}</Text>
                        <Text style={styles.docFileText}>{doc.fileName || 'Attached file'}</Text>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          isApproved && styles.badgeApproved,
                          isRejected && styles.badgeRejected,
                          isPending && styles.badgePending,
                        ]}
                      >
                        {isApproved && <CheckCircle2 size={12} color="#10B981" />}
                        {isRejected && <AlertTriangle size={12} color="#EF4444" />}
                        {isPending && <Clock size={12} color="#F59E0B" />}
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isApproved && styles.textApproved,
                            isRejected && styles.textRejected,
                            isPending && styles.textPending,
                          ]}
                        >
                          {doc.status}
                        </Text>
                      </View>
                    </View>

                    {/* Rejection explanation if any */}
                    {isRejected && (
                      <View style={styles.rejectionBox}>
                        <Text style={styles.rejectionLabel}>OFFICER REMARK:</Text>
                        <Text style={styles.rejectionText}>
                          {doc.rejectionReason ||
                            'Submitted document is blurred or missing the authorized seal. Please re-upload a clear copy.'}
                        </Text>
                      </View>
                    )}

                    {/* Re-upload Action */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={[
                          styles.reuploadBtn,
                          isApproved && styles.reuploadBtnDim,
                        ]}
                        onPress={() => handleReupload(doc)}
                        activeOpacity={0.8}
                      >
                        <UploadCloud size={14} color="#F05A22" />
                        <Text style={styles.reuploadBtnText}>
                          {isRejected ? 'Re-upload Corrected File' : 'Replace File'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Submit Action */}
          <TouchableOpacity
            style={styles.goldBtn}
            onPress={handleFinish}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.goldBtnText}>Done with Corrections</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 38,
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
  alertNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertNoticeText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 11,
    lineHeight: 16,
  },
  docsCol: {
    gap: 12,
    marginBottom: 20,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardRejected: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  cardApproved: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docDetails: {
    flex: 1,
  },
  docTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  docFileText: {
    color: '#64748B',
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textApproved: {
    color: '#10B981',
  },
  textRejected: {
    color: '#EF4444',
  },
  textPending: {
    color: '#F59E0B',
  },
  rejectionBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  rejectionLabel: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  rejectionText: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 15,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingVertical: 8,
  },
  reuploadBtnDim: {
    borderColor: '#E2E8F0',
  },
  reuploadBtnText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
