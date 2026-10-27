import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import {
  ChevronLeft,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  ArrowRight,
  Camera,
  RefreshCw,
  ShieldCheck,
  Check,
  Truck,
  User,
  Phone,
} from 'lucide-react-native';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { VendorDocumentItem, VendorVehicleConfig, VendorVehicleDocumentItem } from '../../../types';
import { DocumentPickerModal, PickedDocumentResult } from '../../../components/DocumentPickerModal';
import { RegistrationUpdateHeaderBanner } from '../../../components/RegistrationUpdateHeaderBanner';

export interface DocumentSlotConfig {
  id: string;
  docType: 'COMPANY_PAN' | 'GST_CERTIFICATE' | 'BANK_CANCELLED_CHEQUE' | 'TRANSPORT_DECLARATION';
  title: string;
  isMandatory: boolean;
  hint: string;
}

export const VENDOR_DOCUMENT_SLOTS: DocumentSlotConfig[] = [
  {
    id: 'doc_pan',
    docType: 'COMPANY_PAN',
    title: 'PAN Card',
    isMandatory: true,
    hint: 'Company / Proprietor PAN Card copy (Mandatory)',
  },
  {
    id: 'doc_gst',
    docType: 'GST_CERTIFICATE',
    title: 'GST Registration Certificate',
    isMandatory: false,
    hint: 'GSTIN Registration Certificate / FORM GST REG-06 (Optional)',
  },
  {
    id: 'doc_cheque',
    docType: 'BANK_CANCELLED_CHEQUE',
    title: 'Bank Cancelled Cheque',
    isMandatory: true,
    hint: 'Original cancelled cheque showing Account Name, No. & IFSC (Mandatory)',
  },
  {
    id: 'doc_decl',
    docType: 'TRANSPORT_DECLARATION',
    title: 'Transport Undertaking / Declaration',
    isMandatory: false,
    hint: 'Transporter declaration / annexure on letterhead (Optional)',
  },
];

export interface VehicleDocSlotConfig {
  docType: 'RC' | 'C_BOOK' | 'PERMIT' | 'INSURANCE' | 'PUC' | 'DRIVING_LICENCE';
  title: string;
  isMandatory: boolean;
  hint: string;
}

export const FLEET_DOCUMENT_SLOTS: VehicleDocSlotConfig[] = [
  {
    docType: 'RC',
    title: 'RC (Registration Certificate)',
    isMandatory: true,
    hint: 'Official RTO Registration Certificate copy',
  },
  {
    docType: 'C_BOOK',
    title: 'C-Book / Fitness Certificate',
    isMandatory: false,
    hint: 'Commercial vehicle fitness and roadworthiness certificate',
  },
  {
    docType: 'PERMIT',
    title: 'Route / Goods Permit',
    isMandatory: false,
    hint: 'State or National commercial goods transport permit',
  },
  {
    docType: 'INSURANCE',
    title: 'Insurance Certificate',
    isMandatory: false,
    hint: 'Valid commercial vehicle insurance policy',
  },
  {
    docType: 'PUC',
    title: 'Pollution Certificate (PUC)',
    isMandatory: false,
    hint: 'Valid PUC emission test certificate',
  },
  {
    docType: 'DRIVING_LICENCE',
    title: "Driver's Driving Licence (DL)",
    isMandatory: false,
    hint: 'Commercial heavy/transport driving licence copy',
  },
];

interface VendorDocumentUploadScreenProps {
  onBack: () => void;
  onNext: (data: any) => void;
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const VendorDocumentUploadScreen: React.FC<VendorDocumentUploadScreenProps> = ({
  onBack,
  onNext,
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  const [documents, setDocuments] = useState<VendorDocumentItem[]>([
    {
      id: 'doc_pan',
      docType: 'COMPANY_PAN',
      title: 'PAN Card',
      status: 'PENDING',
    },
    {
      id: 'doc_gst',
      docType: 'GST_CERTIFICATE',
      title: 'GST Registration Certificate',
      status: 'PENDING',
    },
    {
      id: 'doc_cheque',
      docType: 'BANK_CANCELLED_CHEQUE',
      title: 'Bank Cancelled Cheque',
      status: 'PENDING',
    },
    {
      id: 'doc_decl',
      docType: 'TRANSPORT_DECLARATION',
      title: 'Transport Undertaking / Declaration',
      status: 'PENDING',
    },
  ]);

  const [vehicleConfigs, setVehicleConfigs] = useState<VendorVehicleConfig[]>([]);
  const [fleetDocuments, setFleetDocuments] = useState<VendorVehicleDocumentItem[]>([]);

  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
  const [activePickerSlot, setActivePickerSlot] = useState<
    | { type: 'COMPANY_KYC'; slot: DocumentSlotConfig }
    | { type: 'FLEET_DOC'; vehicleId: string; regNo: string; slot: VehicleDocSlotConfig }
    | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.documents && draft.documents.length > 0) {
        const sanitized = VENDOR_DOCUMENT_SLOTS.map((slot) => {
          const existing = draft.documents.find(
            (d) => d.docType === slot.docType || (slot.docType === 'BANK_CANCELLED_CHEQUE' && d.id === 'doc-3')
          );
          if (existing && existing.fileName) {
            return {
              ...existing,
              id: slot.id,
              docType: slot.docType,
              title: slot.title,
            };
          }
          return {
            id: slot.id,
            docType: slot.docType,
            title: slot.title,
            status: 'PENDING' as const,
          };
        });
        setDocuments(sanitized);
      }

      if (draft?.vehicleConfigs && draft.vehicleConfigs.length > 0) {
        setVehicleConfigs(draft.vehicleConfigs);
      }

      if (draft?.fleetDocuments && draft.fleetDocuments.length > 0) {
        setFleetDocuments(draft.fleetDocuments);
      }
    })();
  }, []);

  // Open Document Picker Modal for Company KYC
  const handleOpenPicker = (slot: DocumentSlotConfig) => {
    setActivePickerSlot({ type: 'COMPANY_KYC', slot });
  };

  // Open Document Picker Modal for Vehicle Fleet Document
  const handleOpenFleetPicker = (vehicleId: string, regNo: string, slot: VehicleDocSlotConfig) => {
    setActivePickerSlot({ type: 'FLEET_DOC', vehicleId, regNo, slot });
  };

  const handleClosePicker = () => {
    setActivePickerSlot(null);
  };

  // Called when camera photo is captured or file is selected from device
  const handleFilePicked = async (file: PickedDocumentResult) => {
    if (!activePickerSlot) return;
    const currentTarget = activePickerSlot;
    setActivePickerSlot(null);

    if (currentTarget.type === 'COMPANY_KYC') {
      const targetSlot = currentTarget.slot;
      setUploadingSlotId(targetSlot.id);

      try {
        const uploadRes = await vendorService.uploadVendorDocument({
          uri: file.uri,
          blob: file.blob,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          docType: targetSlot.docType,
          referenceKey: targetSlot.docType.toLowerCase(),
        });

        if (uploadRes.success) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.docType === targetSlot.docType
                ? {
                    ...d,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                    mimeType: file.mimeType,
                    fileUrl: uploadRes.fileUrl,
                    storagePath: uploadRes.storagePath,
                    uploadedAt: new Date().toISOString(),
                    status: 'PENDING',
                  }
                : d
            )
          );
          Alert.alert('Upload Complete', `"${file.fileName}" uploaded securely for verification.`);
        } else {
          Alert.alert('Upload Failed', uploadRes.error || 'Could not upload document to server. Please try again.');
        }
      } catch (err: any) {
        Alert.alert('Upload Error', err.message || 'An error occurred during file upload.');
      } finally {
        setUploadingSlotId(null);
      }
    } else {
      // Vehicle document upload
      const { vehicleId, regNo, slot } = currentTarget;
      const slotKey = `fleet_${vehicleId}_${slot.docType}`;
      setUploadingSlotId(slotKey);

      try {
        const uploadRes = await vendorService.uploadVendorDocument({
          uri: file.uri,
          blob: file.blob,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          docType: slot.docType,
          referenceKey: `veh_${regNo.replace(/[^a-zA-Z0-9]/g, '_')}`,
        });

        if (uploadRes.success) {
          const docId = `fdoc_${vehicleId}_${slot.docType}`;
          const currentVeh = vehicleConfigs.find((v) => v.id === vehicleId);

          setFleetDocuments((prev) => {
            const filtered = prev.filter((d) => !(d.vehicleId === vehicleId && d.docType === slot.docType));
            return [
              ...filtered,
              {
                id: docId,
                vehicleId,
                registrationNumber: regNo,
                docType: slot.docType,
                title: slot.title,
                fileName: file.fileName,
                fileSize: file.fileSize,
                fileUrl: uploadRes.fileUrl,
                storagePath: uploadRes.storagePath,
                uploadedAt: new Date().toISOString(),
                status: 'PENDING',
                driverName: currentVeh?.driverName,
                driverPhone: currentVeh?.driverPhone,
              },
            ];
          });
          Alert.alert('Upload Complete', `"${file.fileName}" attached for ${regNo}.`);
        } else {
          Alert.alert('Upload Failed', uploadRes.error || 'Could not upload vehicle document.');
        }
      } catch (err: any) {
        Alert.alert('Upload Error', err.message || 'An error occurred during file upload.');
      } finally {
        setUploadingSlotId(null);
      }
    }
  };

  const handleRemoveFile = (docType: string) => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this uploaded document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDocuments((prev) =>
              prev.map((d) =>
                d.docType === docType
                  ? {
                      ...d,
                      fileName: undefined,
                      fileUrl: undefined,
                      storagePath: undefined,
                      fileSize: undefined,
                      mimeType: undefined,
                      uploadedAt: undefined,
                    }
                  : d
              )
            );
          },
        },
      ]
    );
  };

  const handleRemoveFleetFile = (vehicleId: string, docType: string) => {
    Alert.alert(
      'Remove Vehicle Document',
      'Are you sure you want to remove this document for this lorry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setFleetDocuments((prev) =>
              prev.filter((d) => !(d.vehicleId === vehicleId && d.docType === docType))
            );
          },
        },
      ]
    );
  };

  const handleUpdateVehicleDriver = (vehicleId: string, field: 'driverName' | 'driverPhone', value: string) => {
    setVehicleConfigs((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, [field]: value } : v))
    );
  };

  const handlePreviewFile = async (doc: VendorDocumentItem) => {
    if (!doc.fileName) return;

    try {
      const url = doc.fileUrl || (doc.storagePath ? await vendorService.getSignedDocumentUrl(doc.storagePath) : null);
      if (url) {
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          await Linking.openURL(url);
        }
      } else {
        Alert.alert('Document Attached', `${doc.fileName}\nSize: ${doc.fileSize || 'Standard'}\n\nUploaded for compliance review.`);
      }
    } catch {
      Alert.alert('Document Attached', `${doc.fileName}\n\nUploaded for compliance review.`);
    }
  };

  const handlePreviewFleetFile = async (doc: VendorVehicleDocumentItem) => {
    if (!doc.fileName) return;

    try {
      const url = doc.fileUrl || (doc.storagePath ? await vendorService.getSignedDocumentUrl(doc.storagePath) : null);
      if (url) {
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          await Linking.openURL(url);
        }
      } else {
        Alert.alert('Document Attached', `${doc.fileName}\nVehicle: ${doc.registrationNumber}\n\nUploaded for compliance review.`);
      }
    } catch {
      Alert.alert('Document Attached', `${doc.fileName}\nVehicle: ${doc.registrationNumber}\n\nUploaded for compliance review.`);
    }
  };

  const handleContinue = async () => {
    // 1. Validate PAN Card is attached
    const panDoc = documents.find((d) => d.docType === 'COMPANY_PAN');
    if (!panDoc?.fileName) {
      Alert.alert(
        'Mandatory Document Missing',
        'PAN Card is mandatory for vendor registration. Please upload your PAN Card using Camera or Files to continue.'
      );
      return;
    }

    // 2. Validate Bank Cancelled Cheque is attached
    const chequeDoc = documents.find((d) => d.docType === 'BANK_CANCELLED_CHEQUE');
    if (!chequeDoc?.fileName) {
      Alert.alert(
        'Mandatory Document Missing',
        'Bank Cancelled Cheque is mandatory for settlement verification. Please upload a cancelled cheque to continue.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Save active session step and database records
      await vendorService.saveActiveRegistrationStep(7, {
        documents,
        fleetDocuments,
        vehicleConfigs,
      });
      onNext({ documents, fleetDocuments, vehicleConfigs });
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Failed to submit registration documents.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        
        <View style={styles.headerSpacer} />
      </View>

      {/* Registration Update Mode Banner */}
      {isUpdateMode && (
        <RegistrationUpdateHeaderBanner
          isUpdateMode={isUpdateMode}
          onlyIncompleteSteps={onlyIncompleteSteps}
          stepIndex={7}
          totalSteps={7}
          incompleteStepsCount={incompleteStepsCount}
          currentIncompleteStepNumber={currentIncompleteStepNumber}
          missingFields={missingFields}
          onToggleViewAllSteps={onToggleViewAllSteps}
        />
      )}

      {/* Stepper Progress */}
      <View style={styles.stepperWrap}>
        <View style={styles.stepperHeader}>
          <Text style={styles.stepBadge}>STEP 7 OF 7</Text>
          <Text style={styles.stepTitle}>KYC & Fleet Document Verification</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '100%' }]} />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            KYC & Fleet <Text style={styles.goldText}>Documents</Text>
          </Text>
          <Text style={styles.subText}>
            Upload verified documents for your transport enterprise and each individual enrolled vehicle (RC, C-Book, Permit, Insurance, PUC, and Driver DL).
          </Text>
        </View>

        {/* Compliance Guarantee Banner */}
        <View style={styles.complianceNotice}>
          <ShieldCheck size={18} color="#16A34A" style={{ marginTop: 2 }} />
          <Text style={styles.complianceNoticeText}>
            Documents are encrypted and stored securely in TRUCKS compliant cloud storage for administrative review.
          </Text>
        </View>

        {/* Section 1 Header: Enterprise KYC */}
        <View style={styles.sectionDividerWrap}>
          <Text style={styles.sectionDividerTitle}>SECTION 1: ENTERPRISE KYC DOCUMENTS</Text>
          <Text style={styles.sectionDividerSub}>Statutory business identification & banking proofs</Text>
        </View>

        {/* Document Upload Cards: Section 1 */}
        <View style={styles.cardsList}>
          {VENDOR_DOCUMENT_SLOTS.map((slot) => {
            const doc = documents.find((d) => d.docType === slot.docType);
            const isUploaded = Boolean(doc?.fileName);
            const isCurrentlyUploading = uploadingSlotId === slot.id;

            return (
              <View key={slot.id} style={[styles.docCard, isUploaded && styles.docCardUploaded]}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleBadgeRow}>
                      <Text style={styles.docTitle}>{slot.title}</Text>
                      {slot.isMandatory ? (
                        <View style={[styles.mandatoryBadge, styles.reqBadgeMandatory]}>
                          <Text style={styles.mandatoryBadgeText}>MANDATORY</Text>
                        </View>
                      ) : (
                        <View style={[styles.optionalBadge, styles.reqBadgeOptional]}>
                          <Text style={styles.optionalBadgeText}>OPTIONAL</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.docHint}>{slot.hint}</Text>
                  </View>
                </View>

                {/* Upload Status / State */}
                {isCurrentlyUploading ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="small" color="#F05A22" />
                    <Text style={styles.uploadingText}>Uploading securely to TRUCKS cloud...</Text>
                  </View>
                ) : isUploaded ? (
                  /* Attached File Card */
                  <View style={styles.fileAttachedCard}>
                    <View style={styles.fileAttachedLeft}>
                      <View style={styles.fileIconWrap}>
                        <FileText size={18} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fileNameText} numberOfLines={1}>
                          {doc?.fileName}
                        </Text>
                        <Text style={styles.fileMetaText}>
                          {doc?.fileSize ? `${doc.fileSize}  •  ` : ''}Ready for admin review
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fileActionsRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => doc && handlePreviewFile(doc)}
                      >
                        <Eye size={15} color="#2563EB" />
                        <Text style={styles.actionBtnTextBlue}>Preview</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleOpenPicker(slot)}
                      >
                        <RefreshCw size={14} color="#475569" />
                        <Text style={styles.actionBtnTextGray}>Replace File</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleRemoveFile(slot.docType)}
                      >
                        <Trash2 size={14} color="#DC2626" />
                        <Text style={styles.actionBtnTextRed}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Upload Trigger Button */
                  <TouchableOpacity
                    style={styles.uploadTriggerBtn}
                    onPress={() => handleOpenPicker(slot)}
                    activeOpacity={0.85}
                  >
                    <UploadCloud size={18} color="#F05A22" />
                    <Text style={styles.uploadTriggerBtnText}>
                      Take Photo or Choose File
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Section 2: Fleet Documents for Each Individual Vehicle */}
        {vehicleConfigs.length > 0 && (
          <View style={styles.fleetSectionWrap}>
            <View style={styles.sectionDividerWrap}>
              <Text style={styles.sectionDividerTitle}>
                SECTION 2: FLEET DOCUMENTS & DRIVERS ({vehicleConfigs.length} {vehicleConfigs.length === 1 ? 'VEHICLE' : 'VEHICLES'})
              </Text>
              <Text style={styles.sectionDividerSub}>
                Upload RC, C-Book, Permit, Insurance, PUC, and Driver DL for each lorry
              </Text>
            </View>

            {vehicleConfigs.map((veh, vIdx) => {
              const regNumber = veh.registrationNumber || veh.rcNumber || `LORRY #${vIdx + 1}`;
              return (
                <View key={veh.id || vIdx} style={styles.vehicleDocGroupCard}>
                  {/* Vehicle Banner */}
                  <View style={styles.vehicleDocGroupHeader}>
                    <View style={styles.vehBadgeRow}>
                      <View style={styles.vehRegBadge}>
                        <Truck size={15} color="#FFFFFF" />
                        <Text style={styles.vehRegBadgeText}>{regNumber}</Text>
                      </View>
                      <View style={styles.vehSpecPill}>
                        <Text style={styles.vehSpecPillText}>
                          {veh.capacity} MT • {veh.bodyType} {veh.vehicleType}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Driver Details Card for this Vehicle */}
                  <View style={styles.driverSectionCard}>
                    <View style={styles.driverSectionTitleRow}>
                      <User size={14} color="#0284C7" />
                      <Text style={styles.driverSectionTitle}>Assigned Driver Details for this Lorry</Text>
                    </View>
                    <View style={styles.driverInputRow}>
                      <TextInput
                        style={[styles.driverTextInput, { flex: 1.2 }]}
                        placeholder="Driver Full Name"
                        placeholderTextColor="#94A3B8"
                        value={veh.driverName || ''}
                        onChangeText={(txt) => handleUpdateVehicleDriver(veh.id, 'driverName', txt)}
                      />
                      <TextInput
                        style={[styles.driverTextInput, { flex: 1 }]}
                        placeholder="10-Digit Mobile"
                        placeholderTextColor="#94A3B8"
                        value={veh.driverPhone || ''}
                        onChangeText={(txt) =>
                          handleUpdateVehicleDriver(veh.id, 'driverPhone', txt.replace(/\D/g, '').slice(0, 10))
                        }
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  {/* 6 Document Slots for this Vehicle */}
                  <View style={styles.vehicleSlotsGrid}>
                    {FLEET_DOCUMENT_SLOTS.map((slot) => {
                      const fleetDoc = fleetDocuments.find(
                        (fd) => fd.vehicleId === veh.id && fd.docType === slot.docType
                      );
                      const isUploaded = Boolean(fleetDoc?.fileName);
                      const slotKey = `fleet_${veh.id}_${slot.docType}`;
                      const isCurrentlyUploading = uploadingSlotId === slotKey;

                      return (
                        <View
                          key={slot.docType}
                          style={[styles.fleetDocSlotCard, isUploaded && styles.fleetDocSlotCardUploaded]}
                        >
                          <View style={styles.fleetDocSlotHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={styles.cardTitleBadgeRow}>
                                <Text style={styles.fleetDocSlotTitle}>{slot.title}</Text>
                                {slot.isMandatory ? (
                                  <View style={[styles.mandatoryBadge, styles.reqBadgeMandatory]}>
                                    <Text style={styles.mandatoryBadgeText}>MANDATORY</Text>
                                  </View>
                                ) : (
                                  <View style={[styles.optionalBadge, styles.reqBadgeOptional]}>
                                    <Text style={styles.optionalBadgeText}>OPTIONAL</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.fleetDocSlotHint}>{slot.hint}</Text>
                            </View>
                          </View>

                          {isCurrentlyUploading ? (
                            <View style={styles.uploadingBox}>
                              <ActivityIndicator size="small" color="#F05A22" />
                              <Text style={styles.uploadingText}>Uploading {slot.title}...</Text>
                            </View>
                          ) : isUploaded ? (
                            <View style={styles.fileAttachedCard}>
                              <View style={styles.fileAttachedLeft}>
                                <View style={styles.fileIconWrap}>
                                  <FileText size={16} color="#16A34A" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.fileNameText} numberOfLines={1}>
                                    {fleetDoc?.fileName}
                                  </Text>
                                  <Text style={styles.fileMetaText}>
                                    {fleetDoc?.fileSize ? `${fleetDoc.fileSize} • ` : ''}Attached for {regNumber}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.fileActionsRow}>
                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => fleetDoc && handlePreviewFleetFile(fleetDoc)}
                                >
                                  <Eye size={14} color="#2563EB" />
                                  <Text style={styles.actionBtnTextBlue}>Preview</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => handleOpenFleetPicker(veh.id, regNumber, slot)}
                                >
                                  <RefreshCw size={13} color="#475569" />
                                  <Text style={styles.actionBtnTextGray}>Replace</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => handleRemoveFleetFile(veh.id, slot.docType)}
                                >
                                  <Trash2 size={13} color="#DC2626" />
                                  <Text style={styles.actionBtnTextRed}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.fleetUploadTriggerBtn}
                              onPress={() => handleOpenFleetPicker(veh.id, regNumber, slot)}
                              activeOpacity={0.85}
                            >
                              <UploadCloud size={16} color="#F05A22" />
                              <Text style={styles.fleetUploadTriggerBtnText}>
                                Take Photo or Choose File
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Fixed Bottom Action Navigation */}
      <View style={styles.fixedBottomBar}>
        <TouchableOpacity
          style={styles.bottomBackBtn}
          onPress={onBack}
          disabled={isSubmitting}
        >
          <Text style={styles.bottomBackBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomContinueBtn}
          onPress={handleContinue}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.bottomContinueBtnText}>Continue to Review</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal for Camera Photo / Gallery / PDF File Selection */}
      {activePickerSlot && (
        <DocumentPickerModal
          visible={Boolean(activePickerSlot)}
          documentTitle={
            activePickerSlot.type === 'COMPANY_KYC'
              ? activePickerSlot.slot.title
              : `${activePickerSlot.slot.title} (${activePickerSlot.regNo})`
          }
          docType={activePickerSlot.slot.docType}
          onClose={handleClosePicker}
          onFilePicked={handleFilePicked}
        />
      )}

      <BottomGoldWings />
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
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 34,
  },
  stepperWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F05A22',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
  },
  scrollContainer: {
    padding: 16,
  },
  headingWrap: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  complianceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  complianceNoticeText: {
    fontSize: 12,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
  },
  cardsList: {
    gap: 14,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  docCardUploaded: {
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  mandatoryBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reqBadgeMandatory: {
    backgroundColor: '#FEE2E2',
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
    textTransform: 'uppercase',
  },
  optionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reqBadgeOptional: {
    backgroundColor: '#F1F5F9',
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  docHint: {
    fontSize: 12,
    color: '#64748B',
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingVertical: 14,
  },
  uploadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C2410C',
  },
  fileAttachedCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
  },
  fileAttachedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  fileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  fileMetaText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  fileActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionBtnTextBlue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  actionBtnTextGray: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionBtnTextRed: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  uploadTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingVertical: 14,
  },
  uploadTriggerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  fixedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  bottomBackBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  bottomContinueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 13,
    borderRadius: 8,
  },
  bottomContinueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionDividerWrap: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionDividerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  sectionDividerSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  fleetSectionWrap: {
    marginTop: 10,
  },
  vehicleDocGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vehicleDocGroupHeader: {
    marginBottom: 12,
  },
  vehBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  vehRegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  vehRegBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  vehSpecPill: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  vehSpecPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  driverSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  driverSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  driverSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  driverInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  driverTextInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  vehicleSlotsGrid: {
    gap: 12,
  },
  fleetDocSlotCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  fleetDocSlotCardUploaded: {
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
  },
  fleetDocSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fleetDocSlotTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  fleetDocSlotHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fleetUploadTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FDBA74',
    borderRadius: 6,
    paddingVertical: 10,
  },
  fleetUploadTriggerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
});
