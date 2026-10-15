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
  User,
  CreditCard,
  Truck,
  Building2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { driverService } from '../services/driverService';
import { authService } from '../services/authService';
import { DriverRegistrationFormData } from '../types';

interface DriverApplicationReviewScreenProps {
  initialMobile: string;
  onBack: () => void;
  onSubmitSuccess: (data: { driverId: string; applicationNumber: string }) => void;
  onEditSection: (step: number) => void;
}

export const DriverApplicationReviewScreen: React.FC<DriverApplicationReviewScreenProps> = ({
  initialMobile,
  onBack,
  onSubmitSuccess,
  onEditSection,
}) => {
  const [formData, setFormData] = useState<DriverRegistrationFormData | null>(null);
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    driverService.getDraftForm().then((draft) => {
      if (draft) setFormData(draft);
    });
  }, []);

  const handleSubmit = async () => {
    if (!agreed) {
      Alert.alert('Terms Agreement', 'Please confirm the commercial driver accuracy declaration to submit.');
      return;
    }

    if (!formData) {
      Alert.alert('Incomplete Form', 'Application data is missing.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Role Change Detection: Verify against database only upon submission
      const roleCheck = await authService.checkExistingRoleInDatabase(initialMobile, 'DRIVER');
      if (roleCheck.hasExistingDifferentRole) {
        setSubmitting(false);
        Alert.alert(
          'Existing Registration Detected',
          `You have previously registered with the role of ${roleCheck.previousRoleLabel}. Your current registration role is ${roleCheck.currentRoleLabel}. If you want to change your role, please contact the Admin for verification and approval.`,
          [
            {
              text: 'Contact Admin',
              onPress: async () => {
                const reqRes = await authService.requestAdminRoleDeactivation(
                  initialMobile,
                  roleCheck.previousRole!,
                  'DRIVER'
                );
                Alert.alert('Request Submitted', reqRes.message, [{ text: 'OK' }]);
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }

      // 2. Persist registration details to database upon successful submission
      const res = await driverService.submitDriverRegistration(formData, initialMobile);
      setSubmitting(false);
      onSubmitSuccess({
        driverId: res.driverId,
        applicationNumber: res.applicationNumber,
      });
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Submission Error', e.message || 'Could not submit application.');
    }
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
          {/* Header */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Review <Text style={styles.goldText}>Driver Application</Text>
            </Text>
            <Text style={styles.subText}>
              Verify your information before submitting to the NECL verification desk.
            </Text>
          </View>

          {/* Section 1: Personal Details */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleWrap}>
                <User size={15} color="#F05A22" />
                <Text style={styles.cardTitle}>Personal Information</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(1)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Full Name:</Text>
              <Text style={styles.value}>{formData?.fullName || 'Not Provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Mobile Phone:</Text>
              <Text style={styles.value}>{initialMobile ? `+91 ${initialMobile}` : 'Not Provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Residential City:</Text>
              <Text style={styles.value}>
                {formData?.city ? `${formData.city}${formData.state ? `, ${formData.state}` : ''}` : 'Not Provided'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Emergency Contact:</Text>
              <Text style={styles.value}>
                {formData?.emergencyContactName ? `${formData.emergencyContactName} (${formData.emergencyContactPhone || 'N/A'})` : 'Not Provided'}
              </Text>
            </View>
          </View>

          {/* Section 2: DL Details */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleWrap}>
                <CreditCard size={15} color="#F05A22" />
                <Text style={styles.cardTitle}>Driving Licence (DL)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(2)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Licence Number:</Text>
              <Text style={[styles.value, { color: '#F05A22' }]}>
                {formData?.licenceNumber || 'Not Provided'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Issuing RTO State:</Text>
              <Text style={styles.value}>{formData?.rtoState || 'Not Provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Operated Category:</Text>
              <Text style={styles.value}>{formData?.vehicleCategory || 'Not Provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Validity Expiry Date:</Text>
              <Text style={styles.value}>{formData?.licenceExpiryDate || 'Not Provided'}</Text>
            </View>
          </View>

          {/* Section 3: Fleet Association */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleWrap}>
                <Building2 size={15} color="#F05A22" />
                <Text style={styles.cardTitle}>Fleet Association</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(3)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Association Type:</Text>
              <Text style={styles.value}>
                {formData?.associationType === 'VENDOR_FLEET' ? 'Transporter Fleet' : 'Independent Owner'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Linked Transporter / Truck:</Text>
              <Text style={styles.value}>
                {formData?.transporterName || formData?.vehicleRegistrationNumber || 'NECL Direct / Fleet Allocation'}
              </Text>
            </View>
          </View>

          {/* Section 4: Documents Uploaded */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <View style={styles.headerTitleWrap}>
                <FileText size={15} color="#F05A22" />
                <Text style={styles.cardTitle}>Uploaded Documents</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(4)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.docsSummaryList}>
              {(formData?.documents || []).filter((d) => d.fileName).map((d) => (
                <View key={d.id} style={styles.docSummaryItem}>
                  <CheckCircle2 size={15} color="#10B981" />
                  <Text style={styles.docSummaryTitle}>{d.title}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Legal Declaration */}
          <TouchableOpacity
            style={styles.declarationRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.8}
          >
            {agreed ? (
              <CheckSquare size={20} color="#F05A22" />
            ) : (
              <Square size={20} color="#7C7E86" />
            )}
            <Text style={styles.declarationText}>
              I declare that the commercial driving licence, identity documents, and details submitted are authentic and valid under the Motor Vehicles Act, 1988.
            </Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.goldPillBtn, submitting && styles.goldPillBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.goldPillText}>Submit Official Driver Application</Text>
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
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  editLink: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  value: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '60%',
  },
  docsSummaryList: {
    gap: 8,
  },
  docSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docSummaryTitle: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  declarationText: {
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
