import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileCheck,
  Check,
  FileText,
  AlertCircle,
  Eye,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { ClientDocumentItem, clientService } from '../../../services/clientService';
import { DocumentPickerModal, PickedDocumentResult } from '../../../components/DocumentPickerModal';

interface ClientDocumentUploadScreenProps {
  businessType?: string;
  companyName?: string;
  initialDocuments?: ClientDocumentItem[];
  onBack: () => void;
  onContinue: (docs: ClientDocumentItem[]) => void;
}

type DocKey = 'GST_CERTIFICATE' | 'COMPANY_PAN' | 'INCORPORATION_PROOF' | 'MSME_UDYAM';

interface DocSlotConfig {
  key: DocKey;
  title: string;
  subtitle: string;
  mandatory: boolean;
  color: string;
  bgColor: string;
}

export const ClientDocumentUploadScreen: React.FC<ClientDocumentUploadScreenProps> = ({
  businessType = 'Private Limited',
  companyName = 'Company',
  initialDocuments = [],
  onBack,
  onContinue,
}) => {
  // Check whether Incorporation proof is applicable for this entity
  const isIncorporationApplicable =
    businessType === 'Private Limited' ||
    businessType === 'Public Limited' ||
    businessType === 'LLP';

  // State to allow clients to complete KYC without Certificate of Incorporation
  const [skipIncorporation, setSkipIncorporation] = useState(false);

  // Determine Incorporation proof title based on business type (Optional for ALL entity types)
  const getIncorporationDocTitle = () => {
    if (businessType === 'Partnership') {
      return {
        title: 'Partnership Deed (Optional)',
        subtitle: 'Notarized / Registered Partnership Deed if registered (optional)',
      };
    }
    if (businessType === 'Sole Proprietorship') {
      return {
        title: 'Business Registration / Trade License (Optional)',
        subtitle: 'Shop & Establishment or trade license if available (optional)',
      };
    }
    if (businessType === 'LLP') {
      return {
        title: 'LLP Agreement & Incorporation Certificate (Optional)',
        subtitle: 'Certificate of Incorporation issued by Ministry of Corporate Affairs (optional)',
      };
    }
    if (isIncorporationApplicable) {
      return {
        title: 'Certificate of Incorporation (Optional)',
        subtitle: 'Official MCA Certificate of Incorporation (optional document)',
      };
    }
    return {
      title: 'Business Registration Certificate (Optional)',
      subtitle: 'Official business registration document if available (optional)',
    };
  };

  const incDoc = getIncorporationDocTitle();

  const SLOT_CONFIGS: DocSlotConfig[] = [
    {
      key: 'GST_CERTIFICATE',
      title: 'GST Registration Certificate *',
      subtitle: 'Form GST REG-06 showing principal place of business',
      mandatory: true,
      color: '#F05A22',
      bgColor: '#FFF5ED',
    },
    {
      key: 'COMPANY_PAN',
      title: 'Company PAN Card *',
      subtitle: 'Clear photograph or scanned copy of entity PAN card',
      mandatory: true,
      color: '#2563EB',
      bgColor: '#EFF6FF',
    },
    {
      key: 'INCORPORATION_PROOF',
      title: incDoc.title,
      subtitle: incDoc.subtitle,
      mandatory: false,
      color: '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      key: 'MSME_UDYAM',
      title: 'MSME Udyam Registration (Optional)',
      subtitle: 'Udyam Certificate for priority micro/small enterprise quota',
      mandatory: false,
      color: '#16A34A',
      bgColor: '#F0FDF4',
    },
  ];

  // State map of document items
  const [docMap, setDocMap] = useState<Record<DocKey, ClientDocumentItem | null>>(() => {
    const map: Record<DocKey, ClientDocumentItem | null> = {
      GST_CERTIFICATE: null,
      COMPANY_PAN: null,
      INCORPORATION_PROOF: null,
      MSME_UDYAM: null,
    };
    if (initialDocuments && initialDocuments.length > 0) {
      initialDocuments.forEach((doc) => {
        if (doc.docType && map.hasOwnProperty(doc.docType)) {
          map[doc.docType as DocKey] = doc;
        }
      });
    }
    return map;
  });

  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [previewLoadingKeys, setPreviewLoadingKeys] = useState<Record<string, boolean>>({});
  const [pickerTargetDoc, setPickerTargetDoc] = useState<{ key: DocKey; title: string } | null>(null);

  // Open Document Source Selection Modal (Camera, Gallery, or Document Browse)
  const handlePickAndUpload = (key: DocKey) => {
    const slot = SLOT_CONFIGS.find((s) => s.key === key);
    setPickerTargetDoc({
      key,
      title: slot ? slot.title : key,
    });
  };

  const handleFilePicked = async (file: PickedDocumentResult) => {
    if (!pickerTargetDoc) return;
    const key = pickerTargetDoc.key;
    const title = pickerTargetDoc.title;
    setUploadingKeys((prev) => ({ ...prev, [key]: true }));

    try {
      const refKey = companyName.slice(0, 15).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'kyc';
      const uploadRes = await clientService.uploadClientDocument({
        uri: file.uri,
        blob: file.blob,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        docType: key,
        referenceKey: refKey,
      });

      if (uploadRes.success) {
        const newItem: ClientDocumentItem = {
          id: `doc-${key}-${Date.now()}`,
          name: title,
          docType: key,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          storagePath: uploadRes.storagePath,
          uploadedAt: new Date().toISOString(),
          status: 'UPLOADED',
        };
        setDocMap((prev) => ({ ...prev, [key]: newItem }));
      } else {
        Alert.alert('Upload Failed', uploadRes.error || 'Could not upload document.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'An error occurred during upload.');
    } finally {
      setUploadingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRemove = (key: DocKey) => {
    setDocMap((prev) => ({ ...prev, [key]: null }));
  };

  const handlePreview = async (item: ClientDocumentItem) => {
    if (!item.storagePath) {
      Alert.alert('Preview Unavailable', 'Document path is not recorded.');
      return;
    }

    setPreviewLoadingKeys((prev) => ({ ...prev, [item.docType]: true }));
    try {
      const signedUrl = await clientService.getSignedDocumentUrl(item.storagePath);
      if (signedUrl) {
        if (Platform.OS === 'web') {
          window.open(signedUrl, '_blank');
        } else {
          await Linking.openURL(signedUrl);
        }
      } else {
        Alert.alert('Document Attached', `${item.fileName}\n\nStatus: ${item.status}`);
      }
    } catch {
      Alert.alert('Document Attached', `${item.fileName}\n\nStatus: ${item.status}`);
    } finally {
      setPreviewLoadingKeys((prev) => ({ ...prev, [item.docType]: false }));
    }
  };

  const proceedWithDocuments = () => {
    const docList: ClientDocumentItem[] = [];
    Object.values(docMap).forEach((d) => {
      if (d) docList.push(d);
    });
    onContinue(docList);
  };

  const handleNext = () => {
    // 1. Validate core mandatory documents (GST & Company PAN)
    const missingCore: string[] = [];
    if (!docMap.GST_CERTIFICATE) missingCore.push('GST Registration Certificate');
    if (!docMap.COMPANY_PAN) missingCore.push('Company PAN Card');

    if (missingCore.length > 0) {
      Alert.alert(
        'Mandatory Documents Required',
        `Please upload the following required documents before proceeding:\n\n• ${missingCore.join('\n• ')}`
      );
      return;
    }

    // 2. All mandatory documents satisfied; registration certificate is optional for all business types
    proceedWithDocuments();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Top Bar with Back Arrow */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ArrowLeft size={22} color="#172B4D" />
          </TouchableOpacity>
        </View>

        {/* Logo Center */}
        

        {/* Step Indicator */}
        <View style={styles.stepIndicatorRow}>
          <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>3</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.stepDot}><Text style={styles.stepDotTextInactive}>4</Text></View>
        </View>

        {/* Heading */}
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Corporate <Text style={styles.orangeText}>KYC Documents</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Securely upload official commercial registration files for Admin approval & credit limits
          </Text>
        </View>

        {/* Upload Cards Container */}
        <View style={styles.cardsContainer}>
          {SLOT_CONFIGS.map((slot) => {
            const currentItem = docMap[slot.key];
            const isUploading = !!uploadingKeys[slot.key];
            const isPreviewing = !!previewLoadingKeys[slot.key];
            const isRejected = currentItem?.status === 'REJECTED' || currentItem?.status === 'REPLACEMENT_REQUESTED';
            const isIncSlot = slot.key === 'INCORPORATION_PROOF';

            return (
              <View key={slot.key} style={[styles.uploadCard, isRejected && styles.uploadCardRejected]}>
                <View style={styles.uploadCardTop}>
                  <View style={[styles.docIconSquircle, { backgroundColor: slot.bgColor }]}>
                    <FileText size={20} color={slot.color} />
                  </View>
                  <View style={styles.docTextCol}>
                    <View style={styles.titleBadgeRow}>
                      <Text style={styles.docTitle}>{slot.title}</Text>
                      {slot.mandatory ? (
                        <View style={styles.mandatoryBadge}>
                          <Text style={styles.mandatoryText}>Required</Text>
                        </View>
                      ) : (
                        <View style={styles.optionalBadge}>
                          <Text style={styles.optionalText}>
                            {isIncSlot && skipIncorporation ? 'Optional (Later)' : 'Optional'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.docSubtitle}>{slot.subtitle}</Text>
                  </View>
                </View>

                {/* Optional entity info note */}
                {isIncSlot && !currentItem && (
                  <View style={styles.notApplicableBanner}>
                    <AlertCircle size={13} color="#64748B" />
                    <Text style={styles.notApplicableBannerText}>
                      Optional for {businessType}. You can complete KYC and submit without this document.
                    </Text>
                  </View>
                )}

                {/* Rejection / Correction banner */}
                {isRejected && currentItem?.rejectionReason ? (
                  <View style={styles.rejectionBanner}>
                    <AlertTriangle size={15} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rejectionTitle}>Admin Requested Replacement:</Text>
                      <Text style={styles.rejectionReason}>{currentItem.rejectionReason}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Upload Status / Action */}
                {isUploading ? (
                  <View style={styles.uploadingStateRow}>
                    <ActivityIndicator size="small" color="#F05A22" />
                    <Text style={styles.uploadingText}>Uploading document securely...</Text>
                  </View>
                ) : currentItem ? (
                  <View style={styles.fileAttachedRow}>
                    <View style={styles.fileInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <FileCheck size={16} color={isRejected ? '#DC2626' : '#16A34A'} />
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {currentItem.fileName}
                        </Text>
                      </View>
                      <Text style={styles.fileMetaText}>
                        {currentItem.fileSize || 'Standard size'} • Status: {currentItem.status}
                      </Text>
                    </View>

                    <View style={styles.fileActionsRow}>
                      {/* Preview Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handlePreview(currentItem)}
                        disabled={isPreviewing}
                        accessibilityLabel="Preview document"
                      >
                        {isPreviewing ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <Eye size={17} color="#2563EB" />
                        )}
                      </TouchableOpacity>

                      {/* Replace Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handlePickAndUpload(slot.key)}
                        accessibilityLabel="Replace document"
                      >
                        <RefreshCw size={16} color="#F05A22" />
                      </TouchableOpacity>

                      {/* Delete Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleRemove(slot.key)}
                        accessibilityLabel="Remove document"
                      >
                        <Trash2 size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadActionBtn}
                    onPress={() => handlePickAndUpload(slot.key)}
                    activeOpacity={0.8}
                  >
                    <Upload size={16} color="#F05A22" />
                    <Text style={styles.uploadActionText}>
                      Upload {slot.key === 'MSME_UDYAM' ? 'Optional Proof' : 'Document (PDF / PNG / JPG)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Privacy & Storage Guarantee */}
          <View style={styles.privacyNote}>
            <CheckCircle2 size={14} color="#16A34A" />
            <Text style={styles.privacyNoteText}>
              All commercial compliance documents are securely stored and verified
            </Text>
          </View>

          {/* Continue Action */}
          <TouchableOpacity style={styles.continueBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Continue to Review & Submit</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
        <AuthBottomDecoration height={140} />
      </ScrollView>

      {pickerTargetDoc && (
        <DocumentPickerModal
          visible={Boolean(pickerTargetDoc)}
          documentTitle={pickerTargetDoc.title}
          docType={pickerTargetDoc.key}
          onClose={() => setPickerTargetDoc(null)}
          onFilePicked={handleFilePicked}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: '#16A34A',
  },
  stepDotActive: {
    backgroundColor: '#F05A22',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepDotTextInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: '#16A34A',
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardsContainer: {
    paddingHorizontal: 24,
    gap: 14,
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    padding: 16,
  },
  uploadCardRejected: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF8F8',
  },
  uploadCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  docIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTextCol: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  docTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  mandatoryBadge: {
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  mandatoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E11D48',
  },
  optionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  docSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  rejectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectionReason: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FFE2D1',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
  },
  uploadActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  uploadingStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 12,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  fileAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  fileNameText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#166534',
    maxWidth: 160,
  },
  fileMetaText: {
    fontSize: 10.5,
    color: '#4ADE80',
    marginTop: 2,
  },
  fileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  privacyNoteText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  continueBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  skipToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  skipToggleText: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  notApplicableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notApplicableBannerText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
});

