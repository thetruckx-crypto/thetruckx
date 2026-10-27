import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Check,
  CheckCircle2,
  Headphones,
  Info,
  Clock,
  Phone,
  X,
  FileText,
  Package,
  ArrowLeft,
  AlertTriangle,
  Upload,
  Edit2,
  Save,
  Camera,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { supabase } from '../../../supabase';
import { clientService, ClientAccountStatusResult, ClientDocumentItem } from '../../../services/clientService';
import { pincodeService } from '../../../services/pincodeService';
import { DocumentPickerModal, PickedDocumentResult } from '../../../components/DocumentPickerModal';
import { formatDisplayId } from '../../../utils/idGenerator';

interface RegistrationStatusScreenProps {
  userRole?: 'CLIENT' | 'VENDOR' | 'DRIVER';
  userId?: string;
  onRefreshStatus?: () => void;
  onApprovedContinue?: () => void;
  onFixCorrections?: () => void;
  onBack?: () => void;
  onOpenSupport?: () => void;
}

export const RegistrationStatusScreen: React.FC<RegistrationStatusScreenProps> = ({
  userRole = 'VENDOR',
  userId,
  onRefreshStatus,
  onApprovedContinue,
  onFixCorrections,
  onBack,
  onOpenSupport,
}) => {
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [clientStatus, setClientStatus] = useState<ClientAccountStatusResult | null>(null);
  const [clientDocs, setClientDocs] = useState<ClientDocumentItem[]>([]);
  const [reuploadingDocId, setReuploadingDocId] = useState<string | null>(null);

  // Incomplete Registration & Document Upload Modal States
  const [showIncompleteProfileModal, setShowIncompleteProfileModal] = useState(false);
  const [showPendingUploadModal, setShowPendingUploadModal] = useState(false);
  const [hasPromptedProfile, setHasPromptedProfile] = useState(false);
  const [hasPromptedUpload, setHasPromptedUpload] = useState(false);

  const hasNavigatedRef = useRef(false);

  // Editable Profile Form State
  const [editPan, setEditPan] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handlePincodeChange = async (pin: string) => {
    setEditPincode(pin);
    const cleaned = pin.trim().replace(/\D/g, '');
    if (cleaned.length === 6) {
      setPincodeLoading(true);
      try {
        const res = await pincodeService.lookupPincode(cleaned);
        if (res.success && res.data) {
          if (res.data.city) setEditCity(res.data.city);
          if (res.data.state) setEditState(res.data.state);
        }
      } catch {
        // Fallback to manual entry
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleSaveMissingDetails = async () => {
    const targetCompId = clientStatus?.companyId || userId;
    if (!targetCompId) return;

    if (editPan && editPan.length !== 10) {
      Alert.alert('Invalid PAN', 'Company PAN must be 10 characters (e.g. ABCDE1234F)');
      return;
    }
    if (editPincode && editPincode.length !== 6) {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit PIN code.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await clientService.updateClientProfileDetails({
        companyId: targetCompId,
        pan: editPan,
        pincode: editPincode,
        city: editCity,
        state: editState,
        registeredAddress: editAddress,
      });

      if (res.success) {
        Alert.alert(
          'Registration Updated',
          res.profileCompletionStatus === 'COMPLETE'
            ? 'All required profile information is now complete!'
            : `Information saved. Remaining fields: ${res.incompleteFields?.join(', ')}`
        );
        setShowIncompleteProfileModal(false);
        await checkLiveStatus(false);
      } else {
        Alert.alert('Update Failed', res.error || 'Failed to update profile information.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    if (!userId) return;

    // 1. Initial check (silent background check, bypass cache)
    checkLiveStatus(false);

    // 2. Supabase Realtime channel subscription
    const cleanId = (userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-16);
    const channelName = `realtime-status-${userRole.toLowerCase()}-${cleanId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_companies' }, () => {
        checkLiveStatus(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_users' }, () => {
        checkLiveStatus(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        checkLiveStatus(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {
        checkLiveStatus(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        checkLiveStatus(false);
      })
      .subscribe();

    // 3. Fallback active polling every 2.5 seconds to ensure instant UI reactivity
    const interval = setInterval(() => {
      checkLiveStatus(false);
    }, 2500);

    // 4. AppState listener: recheck immediately when app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkLiveStatus(false);
      }
    });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [userRole, userId]);

  const checkLiveStatus = async (isManual: boolean = false) => {
    if (checking || hasNavigatedRef.current) return;
    setChecking(true);
    try {
      if (userRole === 'CLIENT') {
        const res = await clientService.getClientAccountStatus(userId || '', true);
        setClientStatus(res);

        // Fetch attached verification documents
        const targetId = res.companyId || userId;
        let docs: ClientDocumentItem[] = [];
        if (targetId) {
          docs = await clientService.getClientDocuments(targetId);
          setClientDocs(docs);
        }

        // Pre-fill editable profile inputs from loaded data
        if (res.pan) setEditPan((prev) => prev || res.pan || '');
        if (res.pincode) setEditPincode((prev) => prev || res.pincode || '');
        if (res.city) setEditCity((prev) => prev || res.city || '');
        if (res.state) setEditState((prev) => prev || res.state || '');
        if (res.registeredAddress) setEditAddress((prev) => prev || res.registeredAddress || '');

        // Immediate popups on login for incomplete registration and pending uploads
        if (res.profileCompletionStatus === 'INCOMPLETE' && !hasPromptedProfile) {
          setHasPromptedProfile(true);
          setShowIncompleteProfileModal(true);
        }

        const hasPendingUploads = docs.some(
          (d) => d.status === 'PENDING_UPLOAD' || (d as any).verification_status === 'PENDING_UPLOAD'
        );
        if (hasPendingUploads && !hasPromptedUpload) {
          setHasPromptedUpload(true);
          setShowPendingUploadModal(true);
        }

        const isApproved = res.status === 'APPROVED' || (res as any).status === 'ACTIVE';

        if (isApproved && onApprovedContinue && !hasNavigatedRef.current) {
          // Instant automated transition to dashboard on Admin approval
          hasNavigatedRef.current = true;
          onApprovedContinue();
          return;
        } else if (res.status === 'REJECTED') {
          if (isManual) {
            Alert.alert(
              'Application Rejected',
              res.rejectionReason || 'Your application was rejected by Admin. Please contact support.'
            );
          }
        } else if (res.status === 'CORRECTIONS_REQUESTED') {
          if (isManual) {
            Alert.alert(
              'Corrections Requested',
              res.correctionNotes || 'Admin requested document corrections before approval.'
            );
          }
        } else {
          if (isManual) {
            Alert.alert(
              'Registration Under Review',
              'Your registration is under review. You will get access to your dashboard once the Admin approves your account.'
            );
          }
        }
      } else if (userId) {
        if (userRole === 'VENDOR') {
          const { data: v } = await supabase
            .from('vendor_companies')
            .select('status')
            .eq('id', userId)
            .maybeSingle();

          if (v && (v.status === 'APPROVED' || v.status === 'ACTIVE') && onApprovedContinue) {
            onApprovedContinue();
            return;
          }
        } else if (userRole === 'DRIVER') {
          const { data: d } = await supabase
            .from('drivers')
            .select('verification_status')
            .eq('id', userId)
            .maybeSingle();

          if (d && (d.verification_status === 'APPROVED' || d.verification_status === 'ACTIVE') && onApprovedContinue) {
            onApprovedContinue();
            return;
          }
        }
        if (isManual) {
          Alert.alert('Status Updated', 'Your registration is actively under verification by the TRUCKS operations team.');
        }
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  };

  const [reuploadTargetDoc, setReuploadTargetDoc] = useState<ClientDocumentItem | null>(null);

  const handleUploadAgain = (doc: ClientDocumentItem) => {
    setReuploadTargetDoc(doc);
  };

  const handleReuploadFilePicked = async (file: PickedDocumentResult) => {
    if (!reuploadTargetDoc) return;
    const doc = reuploadTargetDoc;
    const targetCompId = clientStatus?.companyId || userId || '';
    if (!targetCompId) return;
    setReuploadingDocId(doc.id || doc.docType);

    try {
      const refKey = (clientStatus?.companyName || 'client').slice(0, 15).toLowerCase().replace(/[^a-z0-9]/g, '_');

      // 1. Upload to Supabase storage bucket
      const uploadRes = await clientService.uploadClientDocument({
        uri: file.uri,
        blob: file.blob,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        docType: doc.docType,
        referenceKey: refKey,
      });

      // 2. Update database record and set to PENDING
      const replaceRes = await clientService.replaceClientDocument({
        companyId: targetCompId,
        docId: doc.id,
        docType: doc.docType,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        storagePath: uploadRes.storagePath,
        mobile: clientStatus?.mobile || userId || '',
      });

      if (replaceRes.success) {
        Alert.alert(
          'Document Uploaded Successfully',
          `Your replacement document (${file.fileName}) has been submitted to the TRUCKS compliance desk for re-verification.`
        );
        // Refresh local documents and account status
        await checkLiveStatus(false);
      } else {
        Alert.alert('Upload Failed', replaceRes.error || 'Failed to replace document.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'An unexpected error occurred while uploading.');
    } finally {
      setReuploadingDocId(null);
      setReuploadTargetDoc(null);
    }
  };

  const rejectedDocs = clientDocs.filter(
    (d) => d.status === 'REJECTED' || (d as any).verification_status === 'REJECTED' || Boolean(d.rejectionReason)
  );

  const pendingUploadDocs = clientDocs.filter(
    (d) => d.status === 'PENDING_UPLOAD' || (d as any).verification_status === 'PENDING_UPLOAD'
  );

  const steps = [
    {
      id: 1,
      title: 'Account Created',
      subtitle: 'Mobile verified via secure OTP',
      status: 'completed',
    },
    {
      id: 2,
      title: 'Authorized Profile',
      subtitle: clientStatus?.fullName ? `${clientStatus.fullName} registered` : 'Completed',
      status: 'completed',
    },
    {
      id: 3,
      title: 'Business & Tax KYC',
      subtitle: clientStatus?.profileCompletionStatus === 'INCOMPLETE'
        ? `Incomplete: ${(clientStatus?.incompleteFields || []).join(', ') || 'Mandatory fields'}`
        : clientStatus?.companyName ? `${clientStatus.companyName}` : 'Completed',
      status: clientStatus?.profileCompletionStatus === 'INCOMPLETE' ? 'attention' : 'completed',
    },
    {
      id: 4,
      title: 'Document Upload',
      subtitle: rejectedDocs.length > 0
        ? `${rejectedDocs.length} replacement(s) required`
        : pendingUploadDocs.length > 0
        ? `${pendingUploadDocs.length} document(s) pending your upload`
        : 'GST, PAN, Incorporation files attached',
      status: rejectedDocs.length > 0 || pendingUploadDocs.length > 0 ? 'attention' : 'completed',
    },
    {
      id: 5,
      title: clientStatus?.status === 'APPROVED' ? 'Verification Complete' : (rejectedDocs.length > 0 || pendingUploadDocs.length > 0 || clientStatus?.profileCompletionStatus === 'INCOMPLETE') ? 'Action Needed' : 'Compliance Verification',
      subtitle: clientStatus?.status === 'APPROVED' ? 'Approved by Admin' : (rejectedDocs.length > 0 || pendingUploadDocs.length > 0) ? 'Awaiting your document uploads' : clientStatus?.profileCompletionStatus === 'INCOMPLETE' ? 'Awaiting profile completion' : 'Review in progress by Admin desk',
      status: clientStatus?.status === 'APPROVED' ? 'completed' : 'in_progress',
    },
    {
      id: 6,
      title: 'Dashboard Access',
      subtitle: clientStatus?.status === 'APPROVED' ? 'Unlocked & Active' : 'Activated upon Admin sign-off',
      status: clientStatus?.status === 'APPROVED' ? 'completed' : 'pending',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Bar with Support Icon */}
        <View style={styles.topBar}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={22} color="#172B4D" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <BrandLogoHeader size="sm" theme="light" />
          <TouchableOpacity
            style={styles.supportIconBtn}
            onPress={() => (onOpenSupport ? onOpenSupport() : setShowSupportModal(true))}
            activeOpacity={0.7}
          >
            <Headphones size={20} color="#172B4D" />
          </TouchableOpacity>
        </View>

        {/* Heading with Clipboard Illustration on Right */}
        <View style={styles.headerRow}>
          <View style={styles.headingTextCol}>
            <Text style={styles.titleText}>
              Registration <Text style={styles.orangeText}>Status</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Track your registration progress and complete any pending steps.
            </Text>
          </View>

          {/* Clipboard & Parcel Graphic */}
          <View style={styles.clipboardGraphicBox}>
            <View style={styles.clipboardSheet}>
              <View style={styles.clipboardClip} />
              <View style={styles.clipboardLine} />
              <View style={[styles.clipboardLine, { width: 28 }]} />
              <View style={styles.clipboardBadge}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <View style={styles.parcelBoxSmall}>
              <Package size={14} color="#C26A28" />
            </View>
          </View>
        </View>

        {/* Dynamic Status Banner Card */}
        {clientStatus?.status === 'APPROVED' ? (
          <View style={[styles.submittedBannerCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <View style={[styles.submittedIconCircle, { backgroundColor: '#16A34A' }]}>
              <Check size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View style={styles.submittedTextCol}>
              <View style={styles.submittedTitleRow}>
                <Text style={[styles.submittedTitle, { color: '#166534' }]}>Application Approved!</Text>
                <View style={[styles.underReviewBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.underReviewText, { color: '#16A34A' }]}>Approved</Text>
                </View>
              </View>
              <Text style={[styles.submittedDesc, { color: '#15803D' }]}>
                {`Client ID: ${formatDisplayId('CL', clientStatus?.clientCode || clientStatus?.companyId, clientStatus?.submittedAt)} • `}Your enterprise registration is fully verified and active.
              </Text>
              {onApprovedContinue && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#16A34A',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    marginTop: 8,
                    alignSelf: 'flex-start',
                  }}
                  onPress={onApprovedContinue}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    Open Client Dashboard →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : clientStatus?.status === 'REJECTED' ? (
          <View style={[styles.submittedBannerCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={[styles.submittedIconCircle, { backgroundColor: '#DC2626' }]}>
              <X size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View style={styles.submittedTextCol}>
              <View style={styles.submittedTitleRow}>
                <Text style={[styles.submittedTitle, { color: '#991B1B' }]}>Application Rejected</Text>
                <View style={[styles.underReviewBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.underReviewText, { color: '#DC2626' }]}>Rejected</Text>
                </View>
              </View>
              <Text style={[styles.submittedDesc, { color: '#B91C1C' }]}>
                {clientStatus?.rejectionReason || 'Please review compliance requirements or contact the TRUCKS Admin desk.'}
              </Text>
            </View>
          </View>
        ) : clientStatus?.status === 'CORRECTIONS_REQUESTED' ? (
          <View style={[styles.submittedBannerCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
            <View style={[styles.submittedIconCircle, { backgroundColor: '#D97706' }]}>
              <Clock size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View style={styles.submittedTextCol}>
              <View style={styles.submittedTitleRow}>
                <Text style={[styles.submittedTitle, { color: '#92400E' }]}>Corrections Requested</Text>
                <View style={[styles.underReviewBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.underReviewText, { color: '#D97706' }]}>Action Needed</Text>
                </View>
              </View>
              <Text style={[styles.submittedDesc, { color: '#B45309' }]}>
                {clientStatus?.correctionNotes || 'Admin requested document replacements.'}
              </Text>
              {onFixCorrections && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#D97706',
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    marginTop: 8,
                    alignSelf: 'flex-start',
                  }}
                  onPress={onFixCorrections}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    Update Documents →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.submittedBannerCard}>
            <View style={styles.submittedIconCircle}>
              <Check size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View style={styles.submittedTextCol}>
              <View style={styles.submittedTitleRow}>
                <Text style={styles.submittedTitle}>Registration Submitted</Text>
                <View style={styles.underReviewBadge}>
                  <Text style={styles.underReviewText}>Under Review</Text>
                </View>
              </View>
              <Text style={styles.submittedDesc}>
                {`Assigned ID: ${formatDisplayId('CL', clientStatus?.clientCode || clientStatus?.companyId, clientStatus?.submittedAt)} • `}Your registration is under review. You will get access to your dashboard once the Admin approves your account.
              </Text>
            </View>
          </View>
        )}

        {/* Action Needed: Rejected Documents Banner & Re-upload Cards */}
        {userRole === 'CLIENT' && rejectedDocs.length > 0 && (
          <View style={styles.reuploadSectionCard}>
            <View style={styles.reuploadHeaderRow}>
              <View style={styles.reuploadIconCircle}>
                <AlertTriangle size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reuploadSectionTitle}>Action Needed: Document Correction</Text>
                <Text style={styles.reuploadSectionSubtitle}>
                  Admin reviewed your application and requested replacement for {rejectedDocs.length} document{rejectedDocs.length > 1 ? 's' : ''}.
                </Text>
              </View>
            </View>

            <View style={styles.rejectedDocsList}>
              {rejectedDocs.map((doc) => {
                const isUploadingThis = reuploadingDocId === (doc.id || doc.docType);
                return (
                  <View key={doc.id || doc.docType} style={styles.rejectedDocItemCard}>
                    <View style={styles.rejectedDocTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectedDocName}>
                          {doc.docType === 'GST_CERTIFICATE'
                            ? 'GST Registration Certificate'
                            : doc.docType === 'COMPANY_PAN'
                            ? 'Company PAN Card'
                            : doc.docType === 'INCORPORATION_PROOF'
                            ? 'Certificate of Incorporation'
                            : doc.docType === 'MSME_UDYAM'
                            ? 'MSME / Udyam Registration'
                            : doc.name || doc.docType}
                        </Text>
                        <Text style={styles.rejectedDocFileName} numberOfLines={1}>
                          {doc.fileName || 'Original file on record'}
                        </Text>
                      </View>
                      <View style={styles.rejectedBadge}>
                        <Text style={styles.rejectedBadgeText}>Re-upload Required</Text>
                      </View>
                    </View>

                    {/* Rejection Reason Box */}
                    <View style={styles.rejectionReasonBox}>
                      <Text style={styles.rejectionReasonLabel}>Reason from Compliance Desk:</Text>
                      <Text style={styles.rejectionReasonText}>
                        {doc.rejectionReason || clientStatus?.correctionNotes || 'Please upload a clearer, uncropped copy showing all 4 corners.'}
                      </Text>
                    </View>

                    {/* Upload Again Button */}
                    <TouchableOpacity
                      style={[styles.uploadAgainBtn, isUploadingThis && styles.uploadAgainBtnDisabled]}
                      onPress={() => handleUploadAgain(doc)}
                      disabled={isUploadingThis}
                      activeOpacity={0.8}
                    >
                      {isUploadingThis ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.uploadAgainBtnText}>Uploading Replacement...</Text>
                        </>
                      ) : (
                        <>
                          <Upload size={16} color="#FFFFFF" />
                          <Text style={styles.uploadAgainBtnText}>Upload Again</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Action Needed: Pending Client Uploads Banner */}
        {userRole === 'CLIENT' && pendingUploadDocs.length > 0 && (
          <View style={[styles.reuploadSectionCard, { borderColor: '#BFDBFE', backgroundColor: '#F8FAFC' }]}>
            <View style={styles.reuploadHeaderRow}>
              <View style={[styles.reuploadIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Upload size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reuploadSectionTitle, { color: '#1E40AF' }]}>Action Needed: Upload Compliance Documents</Text>
                <Text style={[styles.reuploadSectionSubtitle, { color: '#3B82F6' }]}>
                  Admin assigned document upload responsibility to you for {pendingUploadDocs.length} mandatory compliance document{pendingUploadDocs.length > 1 ? 's' : ''}.
                </Text>
              </View>
            </View>

            <View style={styles.rejectedDocsList}>
              {pendingUploadDocs.map((doc) => {
                const isUploadingThis = reuploadingDocId === (doc.id || doc.docType);
                return (
                  <View key={doc.id || doc.docType} style={styles.rejectedDocItemCard}>
                    <View style={styles.rejectedDocTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectedDocName}>
                          {doc.docType === 'GST_CERTIFICATE'
                            ? 'GST Registration Certificate'
                            : doc.docType === 'COMPANY_PAN'
                            ? 'Company PAN Card'
                            : doc.docType === 'INCORPORATION_PROOF'
                            ? 'Certificate of Incorporation'
                            : doc.docType === 'MSME_UDYAM'
                            ? 'MSME / Udyam Registration'
                            : doc.name || doc.docType}
                        </Text>
                        <Text style={styles.rejectedDocFileName} numberOfLines={1}>
                          Awaiting client upload (Camera or File)
                        </Text>
                      </View>
                      <View style={[styles.rejectedBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <Text style={[styles.rejectedBadgeText, { color: '#1D4ED8' }]}>Upload Required</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.uploadAgainBtn, { backgroundColor: '#2563EB' }, isUploadingThis && styles.uploadAgainBtnDisabled]}
                      onPress={() => handleUploadAgain(doc)}
                      disabled={isUploadingThis}
                      activeOpacity={0.8}
                    >
                      {isUploadingThis ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.uploadAgainBtnText}>Uploading Document...</Text>
                        </>
                      ) : (
                        <>
                          <Camera size={16} color="#FFFFFF" />
                          <Text style={styles.uploadAgainBtnText}>Upload Document (Camera / Files)</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Action Needed: Complete Your Registration Details */}
        {userRole === 'CLIENT' && clientStatus?.profileCompletionStatus === 'INCOMPLETE' && (
          <View style={[styles.reuploadSectionCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
            <View style={styles.reuploadHeaderRow}>
              <View style={[styles.reuploadIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Edit2 size={18} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reuploadSectionTitle, { color: '#92400E' }]}>Complete Your Registration</Text>
                <Text style={[styles.reuploadSectionSubtitle, { color: '#B45309' }]}>
                  Mandatory information was left incomplete during initial account creation. Please complete all missing fields to enable account activation.
                </Text>
                {Array.isArray(clientStatus.incompleteFields) && clientStatus.incompleteFields.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {clientStatus.incompleteFields.map((f, i) => (
                      <View key={i} style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FCD34D' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>• {f}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.uploadAgainBtn, { backgroundColor: '#D97706', marginTop: 12 }]}
              onPress={() => setShowIncompleteProfileModal(true)}
              activeOpacity={0.8}
            >
              <Edit2 size={16} color="#FFFFFF" />
              <Text style={styles.uploadAgainBtnText}>Complete Registration Details →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step Timeline List Matching Reference Image 3 */}
        <View style={styles.timelineWrap}>
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in_progress';
            const isLast = idx === steps.length - 1;

            return (
              <View key={step.id} style={styles.timelineStepRow}>
                {/* Left Indicator Column */}
                <View style={styles.indicatorCol}>
                  {isCompleted ? (
                    <View style={styles.completedCircle}>
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : isInProgress ? (
                    <View style={styles.inProgressOuterRing}>
                      <View style={styles.inProgressInnerDot} />
                    </View>
                  ) : (
                    <View style={styles.pendingCircle} />
                  )}

                  {!isLast && (
                    <View
                      style={[
                        styles.connectorLine,
                        isCompleted ? styles.connectorLineActive : styles.connectorLineInactive,
                      ]}
                    />
                  )}
                </View>

                {/* Right Step Details Card */}
                <View
                  style={[
                    styles.stepContentCard,
                    isInProgress && styles.stepContentCardActive,
                  ]}
                >
                  <Text style={[styles.stepTitle, isInProgress && styles.stepTitleActive]}>
                    {step.title}
                  </Text>
                  <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Info Callout Box Matching Reference Image 3 */}
        <View style={styles.infoCalloutBox}>
          <View style={styles.infoIconWrap}>
            <Info size={18} color="#2563EB" />
          </View>
          <Text style={styles.infoCalloutText}>
            We will notify you once your registration is approved. This may take 1-2 business days.
          </Text>
        </View>

        {/* Refresh Status Action */}
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => checkLiveStatus(true)}
          disabled={checking}
          activeOpacity={0.8}
        >
          <Clock size={16} color="#F05A22" />
          <Text style={styles.refreshBtnText}>
            {checking ? 'Checking Status...' : 'Check Live Verification Status'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Support Modal */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.supportModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Verification Helpdesk</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.supportDesc}>
              Need urgent verification or have queries about KYC documents? Contact our partner onboarding desk directly.
            </Text>
            <View style={styles.contactRow}>
              <Phone size={18} color="#F05A22" />
              <Text style={styles.contactText}>Toll Free: 1800 200 4567</Text>
            </View>
            <View style={styles.contactRow}>
              <Phone size={18} color="#F05A22" />
              <Text style={styles.contactText}>Onboarding Cell: +91 361 2345678</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Incomplete Profile Registration Modal */}
      <Modal
        visible={showIncompleteProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIncompleteProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.supportModalCard, { maxHeight: '90%', paddingBottom: 20 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="#D97706" />
                <Text style={styles.modalTitle}>Complete Your Registration</Text>
              </View>
              <TouchableOpacity onPress={() => setShowIncompleteProfileModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 18 }}>
                Your account was created by the TRUCKS operations team. Please complete the missing mandatory business details to proceed with account verification and activation.
              </Text>

              {/* Company PAN Number */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.inputFieldLabel}>Company PAN Number *</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. ABCDE1234F"
                  placeholderTextColor="#94A3B8"
                  value={editPan}
                  onChangeText={(t) => setEditPan(t.toUpperCase().slice(0, 10))}
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                  10-character alphanumeric PAN issued to your business
                </Text>
              </View>

              {/* PIN Code & Auto Lookup */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.inputFieldLabel}>6-Digit PIN Code *</Text>
                  {pincodeLoading && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color="#F05A22" />
                      <Text style={{ fontSize: 11, color: '#F05A22' }}>Fetching city/state...</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. 781001"
                  placeholderTextColor="#94A3B8"
                  value={editPincode}
                  onChangeText={handlePincodeChange}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              {/* City and State */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>City *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. Guwahati"
                    placeholderTextColor="#94A3B8"
                    value={editCity}
                    onChangeText={setEditCity}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>State *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. Assam"
                    placeholderTextColor="#94A3B8"
                    value={editState}
                    onChangeText={setEditState}
                  />
                </View>
              </View>

              {/* Registered Office Address */}
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.inputFieldLabel}>Registered Office Address *</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Building, street, landmark, area"
                  placeholderTextColor="#94A3B8"
                  value={editAddress}
                  onChangeText={setEditAddress}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Save & Update Button */}
              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: '#F05A22', flexDirection: 'row', justifyContent: 'center', gap: 8 },
                  isSavingProfile && { opacity: 0.7 }
                ]}
                onPress={handleSaveMissingDetails}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.modalCloseBtnText}>Saving Information...</Text>
                  </>
                ) : (
                  <>
                    <Save size={16} color="#FFFFFF" />
                    <Text style={styles.modalCloseBtnText}>Save & Complete Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pending Document Uploads In-App Popup Modal */}
      <Modal
        visible={showPendingUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPendingUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.supportModalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Upload size={18} color="#2563EB" />
                <Text style={styles.modalTitle}>Upload Documents</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPendingUploadModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 18 }}>
                Your client account is in pending-document status. Please upload your mandatory business compliance documents to allow the compliance desk to review and approve your account.
              </Text>

              {pendingUploadDocs.map((doc) => (
                <View key={doc.id || doc.docType} style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 }}>
                    {doc.docType === 'GST_CERTIFICATE'
                      ? 'GST Registration Certificate'
                      : doc.docType === 'COMPANY_PAN'
                      ? 'Company PAN Card'
                      : doc.docType === 'INCORPORATION_PROOF'
                      ? 'Certificate of Incorporation'
                      : doc.name || doc.docType}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10 }}>
                    Upload using your mobile camera or pick a file (PDF, JPG, PNG)
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onPress={() => {
                      setShowPendingUploadModal(false);
                      handleUploadAgain(doc);
                    }}
                  >
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>Take Photo or Select File</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.modalCloseBtn, { marginTop: 10 }]}
                onPress={() => setShowPendingUploadModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Document Picker Modal for Replacement Uploads */}
      {reuploadTargetDoc && (
        <DocumentPickerModal
          visible={Boolean(reuploadTargetDoc)}
          documentTitle={
            reuploadTargetDoc.docType === 'GST_CERTIFICATE'
              ? 'GST Registration Certificate'
              : reuploadTargetDoc.docType === 'COMPANY_PAN'
              ? 'Company PAN Card'
              : reuploadTargetDoc.docType === 'INCORPORATION_PROOF'
              ? 'Certificate of Incorporation'
              : reuploadTargetDoc.docType === 'MSME_UDYAM'
              ? 'MSME / Udyam Registration'
              : reuploadTargetDoc.name || reuploadTargetDoc.docType
          }
          docType={reuploadTargetDoc.docType}
          onClose={() => setReuploadTargetDoc(null)}
          onFilePicked={handleReuploadFilePicked}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  headingTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  titleText: {
    fontSize: 27,
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
    lineHeight: 18,
  },
  clipboardGraphicBox: {
    width: 72,
    height: 80,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipboardSheet: {
    width: 52,
    height: 68,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    paddingTop: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  clipboardClip: {
    position: 'absolute',
    top: -5,
    width: 24,
    height: 10,
    backgroundColor: '#F05A22',
    borderRadius: 3,
  },
  clipboardLine: {
    width: 36,
    height: 3,
    backgroundColor: '#CBD5E1',
    borderRadius: 1.5,
    marginBottom: 5,
  },
  clipboardBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelBoxSmall: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    marginHorizontal: 20,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  submittedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedTextCol: {
    flex: 1,
  },
  submittedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  submittedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#172B4D',
  },
  underReviewBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  underReviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  submittedDesc: {
    fontSize: 12,
    color: '#475569',
  },
  timelineWrap: {
    paddingHorizontal: 20,
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  indicatorCol: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 10,
  },
  completedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  inProgressOuterRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F05A22',
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  inProgressInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
  },
  pendingCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  connectorLine: {
    width: 2,
    height: 38,
    marginTop: 2,
  },
  connectorLineActive: {
    backgroundColor: '#F05A22',
  },
  connectorLineInactive: {
    backgroundColor: '#E2E8F0',
  },
  stepContentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  stepContentCardActive: {
    backgroundColor: '#FFF8F4',
    borderColor: '#FFD9C6',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 2,
  },
  stepTitleActive: {
    color: '#F05A22',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  infoCalloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    gap: 10,
  },
  infoIconWrap: {
    flexShrink: 0,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FFD9C6',
  },
  refreshBtnText: {
    color: '#F05A22',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  supportModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172B4D',
  },
  supportDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#172B4D',
  },
  modalCloseBtn: {
    backgroundColor: '#F05A22',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reuploadSectionCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reuploadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  reuploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reuploadSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  reuploadSectionSubtitle: {
    fontSize: 12.5,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  rejectedDocsList: {
    gap: 12,
  },
  rejectedDocItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectedDocTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  rejectedDocName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1933',
    marginBottom: 2,
  },
  rejectedDocFileName: {
    fontSize: 12,
    color: '#64748B',
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rejectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectionReasonBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#E11D48',
  },
  rejectionReasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F1239',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rejectionReasonText: {
    fontSize: 12.5,
    color: '#4C0519',
    lineHeight: 18,
  },
  uploadAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F15A29',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  uploadAgainBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  uploadAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  inputFieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
});
