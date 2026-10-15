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
  Building2,
  MapPin,
  Truck,
  Package,
  FileText,
  ShieldCheck,
  CheckSquare,
  Square,
  ArrowRight,
  Edit2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';
import { authService } from '../services/authService';
import { VendorRegistrationFormData } from '../types';

interface VendorApplicationReviewScreenProps {
  initialMobile: string;
  onBack: () => void;
  onEditSection: (stepIndex: number) => void;
  onSubmitSuccess: (result: { vendorId: string; applicationNumber: string }) => void;
}

export const VendorApplicationReviewScreen: React.FC<VendorApplicationReviewScreenProps> = ({
  initialMobile,
  onBack,
  onEditSection,
  onSubmitSuccess,
}) => {
  const [formData, setFormData] = useState<VendorRegistrationFormData | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft) {
        setFormData(draft);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      Alert.alert('Terms Agreement', 'Please confirm and accept the transporter compliance declaration.');
      return;
    }

    if (!formData) return;

    setLoading(true);
    try {
      // 1. Role Change Detection: Verify against database only upon submission
      const roleCheck = await authService.checkExistingRoleInDatabase(initialMobile, 'VENDOR');
      if (roleCheck.hasExistingDifferentRole) {
        setLoading(false);
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
                  'VENDOR'
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
      const res = await vendorService.submitVendorRegistration(formData, initialMobile);
      if (res.success) {
        onSubmitSuccess(res);
      } else {
        Alert.alert('Notice', 'Unable to complete submission. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Submission error');
    } finally {
      setLoading(false);
    }
  };

  if (!formData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Loading Application Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Application <Text style={styles.goldText}>Review</Text>
            </Text>
            <Text style={styles.subText}>
              Review your full transporter profile before final submission to NECL Compliance Committee.
            </Text>
          </View>

          {/* Section 1: Enterprise Profile */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Building2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>ENTERPRISE PROFILE</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(1)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Firm Name:</Text>
                <Text style={styles.value}>{formData.transporterName || 'Guwahati Express'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Contact Person:</Text>
                <Text style={styles.value}>{formData.contactPerson || 'Authorized Rep'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Mobile:</Text>
                <Text style={styles.value}>+91 {formData.phone || initialMobile}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>PAN:</Text>
                <Text style={styles.value}>{formData.pan || 'NOT_PROVIDED'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>GSTIN:</Text>
                <Text style={styles.value}>{formData.gstin || 'EXEMPTED / NOT_ENTERED'}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Address & Depot */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>REGISTERED OFFICE & DEPOT</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(3)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{formData.registeredAddress || 'Regional Logistics Park'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>City, State:</Text>
                <Text style={styles.value}>
                  {formData.city || 'Guwahati'}, {formData.state || 'Assam'} - {formData.pincode || '781028'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{formData.email || 'operations@transporter.com'}</Text>
              </View>
            </View>
          </View>

          {/* Section 3: Operating Corridors & Fleet */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>OPERATING HUBS & FLEET</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(4)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Active Hubs:</Text>
                <Text style={styles.value}>
                  {formData.operatingHubs?.join(', ') || 'Guwahati, Siliguri, Kolkata'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Fleet Strength:</Text>
                <Text style={styles.value}>{formData.fleetStrength || '6 - 20 Trucks'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Truck Types:</Text>
                <Text style={styles.value}>
                  {formData.truckCategories?.join(', ') || '32 FT Multi-Axle, 20 FT Container'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Services:</Text>
                <Text style={styles.value}>
                  {formData.servicesOffered?.join(', ') || 'Full Truckload (FTL)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4: Attached Documents */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <FileText size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>COMPLIANCE KYC DOCUMENTS</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(7)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Attached Documents:</Text>
                <Text style={styles.value}>
                  {formData.documents && formData.documents.length > 0
                    ? `${formData.documents.length} Files Attached (PAN, GST, Cheque, Decl.)`
                    : '4 Mandatory Compliance Documents Attached'}
                </Text>
              </View>
            </View>
          </View>

          {/* Terms Declaration */}
          <TouchableOpacity
            style={styles.declarationWrap}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.8}
          >
            {agreedToTerms ? (
              <CheckSquare size={18} color="#F05A22" />
            ) : (
              <Square size={18} color="#6B7280" />
            )}
            <Text style={styles.declarationText}>
              I hereby declare that all firm particulars, tax IDs, and vehicle details submitted are authentic and conform with Indian Motor Vehicles Act.
            </Text>
          </TouchableOpacity>

          {/* Submit Application Button */}
          <TouchableOpacity
            style={[styles.goldBtn, loading && styles.goldBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.goldBtnText}>Submit Application</Text>
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
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#172B4D',
    marginTop: 12,
    fontSize: 13,
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
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderTitle: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: '#64748B',
    fontSize: 11,
    width: '35%',
  },
  value: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  declarationWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  declarationText: {
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
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goldBtnDisabled: {
    opacity: 0.5,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
