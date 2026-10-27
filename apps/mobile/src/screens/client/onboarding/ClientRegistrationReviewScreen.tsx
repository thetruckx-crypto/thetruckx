import React, { useState } from 'react';
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
  ArrowLeft,
  ArrowRight,
  Building2,
  User,
  FileCheck,
  Check,
  MapPin,
  ShieldCheck,
  Edit2,
  FileText,
  AlertTriangle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { ClientBusinessDetails, ClientDocumentItem, clientService } from '../../../services/clientService';
import { authService } from '../../../services/authService';
import { ClientProfileFormData } from '../../../types';

interface ClientRegistrationReviewScreenProps {
  profileData: ClientProfileFormData;
  businessDetails: ClientBusinessDetails;
  documents: ClientDocumentItem[];
  onBack: () => void;
  onEditContact?: () => void;
  onEditBusiness?: () => void;
  onEditDocuments?: () => void;
  onSubmitSuccess: (assignedClientId: string) => void;
  onProceedToOtp?: (data: { targetPhone: string; testCode?: string; submissionData: any }) => void;
}

export const ClientRegistrationReviewScreen: React.FC<ClientRegistrationReviewScreenProps> = ({
  profileData,
  businessDetails,
  documents,
  onBack,
  onEditContact,
  onEditBusiness,
  onEditDocuments,
  onSubmitSuccess,
  onProceedToOtp,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 1. Mandatory validations check
    if (!profileData.fullName || !profileData.emailAddress) {
      Alert.alert('Incomplete Profile', 'Please complete the Authorized Contact details before submission.');
      return;
    }
    if (!businessDetails.companyName || !businessDetails.gstin || !businessDetails.registeredAddress) {
      Alert.alert('Incomplete Business Information', 'Please complete all required company and address fields.');
      return;
    }

    const hasGst = documents.some((d) => d.docType === 'GST_CERTIFICATE');
    const hasPan = documents.some((d) => d.docType === 'COMPANY_PAN');

    if (!hasGst || !hasPan) {
      Alert.alert(
        'Missing Mandatory Documents',
        'Please ensure GST Registration Certificate and Company PAN Card are attached before submission.'
      );
      return;
    }

    setSubmitting(true);
    try {
      // 2. Check for Role Conflict: only checked after details completed
      const roleCheck = await authService.checkExistingRoleInDatabase(profileData.mobileNumber, 'CLIENT');
      if (roleCheck.hasExistingDifferentRole) {
        setSubmitting(false);
        Alert.alert(
          'Registration Restricted',
          `This mobile number is already registered under the ${roleCheck.previousRoleLabel} role. You cannot register under another role using the same mobile number.`
        );
        return;
      }

      const submissionData = {
        fullName: profileData.fullName,
        mobile: profileData.mobileNumber,
        companyPhone: profileData.companyPhone,
        email: profileData.emailAddress,
        designation: profileData.designation,
        department: profileData.department,
        companyName: businessDetails.companyName,
        businessType: businessDetails.businessType,
        gstin: businessDetails.gstin,
        pan: businessDetails.pan,
        registeredAddress: businessDetails.registeredAddress,
        city: businessDetails.city,
        state: businessDetails.state,
        pincode: businessDetails.pincode,
        documents,
      };

      // 3. Send OTP only after reviewing application; submit happens after OTP verification
      if (onProceedToOtp) {
        const otpRes = await authService.sendOtp(profileData.mobileNumber, 'REGISTRATION', 'CLIENT');
        onProceedToOtp({
          targetPhone: profileData.mobileNumber,
          testCode: otpRes.testCode,
          submissionData,
        });
        return;
      }

      // Direct submission fallback
      const result = await clientService.submitCompleteRegistration(submissionData);

      if (result.roleConflict) {
        Alert.alert(
          'Registration Restricted',
          `This mobile number is already registered under the ${result.previousRole || 'another'} role. You cannot register under another role using the same mobile number.`
        );
        return;
      }

      if (result.success && (result.clientCode || result.companyId)) {
        onSubmitSuccess(result.clientCode || result.companyId || 'CLI-TRUCKS');
      } else {
        Alert.alert('Submission Notice', result.error || 'Unable to submit application for review.');
      }
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'An unexpected error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
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
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="md" theme="light" />
        </View>

        {/* Step Indicator (Step 4 of 4) */}
        <View style={styles.stepIndicatorRow}>
          <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>4</Text></View>
        </View>

        {/* Heading */}
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Review & <Text style={styles.orangeText}>Submit</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Verify all details before submitting for official Admin compliance approval
          </Text>
        </View>

        <View style={styles.reviewContainer}>
          {/* Section A: Contact Information */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionHeaderIconWrap}>
                  <User size={16} color="#F05A22" />
                </View>
                <Text style={styles.sectionHeaderTitle}>A. Contact Information</Text>
              </View>
              {onEditContact && (
                <TouchableOpacity style={styles.editBtn} onPress={onEditContact}>
                  <Edit2 size={13} color="#F05A22" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Authorized Representative:</Text>
              <Text style={styles.dataVal}>{profileData.fullName || 'N/A'}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Verified Mobile Number:</Text>
              <Text style={styles.dataVal}>+91 {profileData.mobileNumber.replace('+91', '')}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Official Email:</Text>
              <Text style={styles.dataVal}>{profileData.emailAddress || 'N/A'}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Department:</Text>
              <Text style={styles.dataVal}>{profileData.department || 'Logistics'}</Text>
            </View>
            <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.dataLabel}>Designation:</Text>
              <Text style={styles.dataVal}>{profileData.designation || 'N/A'}</Text>
            </View>
          </View>

          {/* Section B: Business & Company Information */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionHeaderIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Building2 size={16} color="#2563EB" />
                </View>
                <Text style={styles.sectionHeaderTitle}>B. Business & Company Information</Text>
              </View>
              {onEditBusiness && (
                <TouchableOpacity style={styles.editBtn} onPress={onEditBusiness}>
                  <Edit2 size={13} color="#2563EB" />
                  <Text style={[styles.editBtnText, { color: '#2563EB' }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Registered Company Name:</Text>
              <Text style={styles.dataVal}>{businessDetails.companyName}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Entity Type:</Text>
              <Text style={styles.dataVal}>{businessDetails.businessType}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>GSTIN:</Text>
              <Text style={styles.dataVal}>{businessDetails.gstin}</Text>
            </View>
            <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.dataLabel}>Company PAN:</Text>
              <Text style={styles.dataVal}>{businessDetails.pan}</Text>
            </View>
          </View>

          {/* Section C: Registered Business Address */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionHeaderIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <MapPin size={16} color="#16A34A" />
                </View>
                <Text style={styles.sectionHeaderTitle}>C. Registered Business Address</Text>
              </View>
              {onEditBusiness && (
                <TouchableOpacity style={styles.editBtn} onPress={onEditBusiness}>
                  <Edit2 size={13} color="#16A34A" />
                  <Text style={[styles.editBtnText, { color: '#16A34A' }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Registered Office:</Text>
              <Text style={styles.dataVal}>{businessDetails.registeredAddress}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>City / District:</Text>
              <Text style={styles.dataVal}>{businessDetails.city}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>State:</Text>
              <Text style={styles.dataVal}>{businessDetails.state}</Text>
            </View>
            <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.dataLabel}>PIN Code:</Text>
              <Text style={styles.dataVal}>{businessDetails.pincode}</Text>
            </View>
          </View>

          {/* Section D: Uploaded Documents */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionHeaderIconWrap, { backgroundColor: '#FAF5FF' }]}>
                  <FileCheck size={16} color="#7C3AED" />
                </View>
                <Text style={styles.sectionHeaderTitle}>D. Uploaded Documents ({documents.length})</Text>
              </View>
              {onEditDocuments && (
                <TouchableOpacity style={styles.editBtn} onPress={onEditDocuments}>
                  <Edit2 size={13} color="#7C3AED" />
                  <Text style={[styles.editBtnText, { color: '#7C3AED' }]}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {documents.length > 0 ? (
              documents.map((d, i) => (
                <View key={i} style={styles.docItemRow}>
                  <FileText size={15} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docItemName} numberOfLines={1}>{d.fileName}</Text>
                    <Text style={styles.docItemType}>
                      {d.docType.replace(/_/g, ' ')} • {d.fileSize || 'Attached'}
                    </Text>
                  </View>
                  <View style={styles.docVerifiedPill}>
                    <Check size={11} color="#16A34A" />
                    <Text style={styles.docVerifiedPillText}>Ready</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDocText}>No documents attached</Text>
            )}

            {!documents.some((d) => d.docType === 'INCORPORATION_PROOF') && (
              <View style={styles.optionalDocNotice}>
                <FileText size={14} color="#64748B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionalDocNoticeTitle}>
                    Certificate of Incorporation / Registration
                  </Text>
                  <Text style={styles.optionalDocNoticeText}>
                    Not attached • Optional / When Applicable (Can be submitted later)
                  </Text>
                </View>
                <View style={styles.optionalPill}>
                  <Text style={styles.optionalPillText}>Optional</Text>
                </View>
              </View>
            )}
          </View>

          {/* Security & Idempotency Guarantee Note */}
          <View style={styles.securityBox}>
            <ShieldCheck size={16} color="#16A34A" />
            <Text style={styles.securityBoxText}>
              Submitting registers your company under PENDING_APPROVAL. Full operational dashboard is unlocked following compliance review.
            </Text>
          </View>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Verify & Submit Application</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
        <AuthBottomDecoration height={140} />
      </ScrollView>
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
    marginBottom: 16,
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
  reviewContainer: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionHeaderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  editBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dataLabel: {
    fontSize: 12.5,
    color: '#64748B',
  },
  dataVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#172B4D',
    maxWidth: '60%',
    textAlign: 'right',
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  docItemName: {
    fontSize: 12.5,
    color: '#1E293B',
    fontWeight: '600',
  },
  docItemType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  docVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docVerifiedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  noDocText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 10,
  },
  securityBoxText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  optionalDocNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionalDocNoticeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  optionalDocNoticeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  optionalPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  optionalPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});

