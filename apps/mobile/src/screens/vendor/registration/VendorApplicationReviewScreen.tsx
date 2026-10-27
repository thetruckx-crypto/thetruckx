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
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { authService } from '../../../services/authService';
import { VendorRegistrationFormData } from '../../../types';
import { ADMIN_ACTIVE_REGIONAL_HUBS, AdminRegionalHub } from './VendorOperatingLocationsScreen';

export interface VendorApplicationReviewScreenProps {
  initialMobile: string;
  onBack: () => void;
  onEditSection: (stepIndex: number) => void;
  onSubmitSuccess: (result: { vendorId: string; applicationNumber: string }) => void;
  onProceedToOtp?: (data: { targetPhone: string; testCode?: string; formData: any }) => void;
}

export const VendorApplicationReviewScreen: React.FC<VendorApplicationReviewScreenProps> = ({
  initialMobile,
  onBack,
  onEditSection,
  onSubmitSuccess,
  onProceedToOtp,
}) => {
  const [formData, setFormData] = useState<VendorRegistrationFormData | null>(null);
  const [allHubs, setAllHubs] = useState<AdminRegionalHub[]>(ADMIN_ACTIVE_REGIONAL_HUBS);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = React.useRef(false);

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft) {
        setFormData(draft);
      }
      try {
        const fetched = await vendorService.getActiveRegionalHubs();
        if (fetched && fetched.length > 0) {
          setAllHubs(fetched as AdminRegionalHub[]);
        }
      } catch {}
    })();
  }, []);

  const handleSubmit = async () => {
    if (isSubmittingRef.current || loading) return;

    if (!agreedToTerms) {
      Alert.alert('Terms Agreement', 'Please confirm and accept the transporter compliance declaration.');
      return;
    }

    if (!formData) return;

    // 1. Mandatory Business Rules & Field Validation prior to submission
    const validation = vendorService.validateVendorRegistrationData(formData);
    if (!validation.isAllComplete) {
      const firstIncomplete = validation.firstIncompleteStep;
      const missingList = validation.incompleteSteps
        .map((s) => `• Step ${s.stepIndex} (${s.stepTitle}): ${s.missingFields.join(', ')}`)
        .join('\n');

      Alert.alert(
        'Incomplete Application',
        `Please complete the required details before submitting to Compliance:\n\n${missingList}`,
        [
          {
            text: `Open Step ${firstIncomplete?.stepIndex || 1}`,
            onPress: () => {
              if (firstIncomplete) onEditSection(firstIncomplete.stepIndex);
            },
          },
          { text: 'Review Here', style: 'cancel' },
        ]
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      // 2. Role Change Detection: Verify against database only upon submission
      const roleCheck = await authService.checkExistingRoleInDatabase(initialMobile, 'VENDOR');
      if (roleCheck.hasExistingDifferentRole) {
        setLoading(false);
        isSubmittingRef.current = false;
        Alert.alert(
          'Registration Restricted',
          `This mobile number is already registered under the ${roleCheck.previousRoleLabel} role. You cannot register under another role using the same mobile number.`
        );
        return;
      }

      // 3. Send OTP only after reviewing application; submit happens after OTP verification
      if (onProceedToOtp) {
        const otpRes = await authService.sendOtp(initialMobile, 'REGISTRATION', 'VENDOR');
        onProceedToOtp({
          targetPhone: initialMobile,
          testCode: otpRes.testCode,
          formData,
        });
        return;
      }

      // Direct submission fallback
      const res = await vendorService.submitVendorRegistration(formData, initialMobile);
      if (res.success) {
        onSubmitSuccess(res);
      } else {
        Alert.alert('Submission Incomplete', 'Unable to complete submission. Your details are saved. Please tap Submit to retry.');
      }
    } catch (e: any) {
      Alert.alert(
        'Submission Failed',
        e.message || 'Unable to connect to TRUCKS Carrier Network. Your application details are preserved. Please retry submission.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
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
              Application <Text style={styles.goldText}>Review</Text>
            </Text>
            <Text style={styles.subText}>
              Review your full transporter profile before final submission to TRUCKS Compliance Committee.
            </Text>
            <TouchableOpacity
              style={{
                marginTop: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#FFF7ED',
                borderWidth: 1,
                borderColor: '#FFEDD5',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
              }}
              onPress={() => onEditSection(1)}
              activeOpacity={0.8}
            >
              <Edit2 size={13} color="#F05A22" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#F05A22' }}>
                View All Steps / Edit Completed Details
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section 1: Enterprise Profile */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Building2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>ENTERPRISE PROFILE (STEP 1)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(1)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Firm Name:</Text>
                <Text style={styles.value}>{formData.transporterName || 'Not Provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Contact Person:</Text>
                <Text style={styles.value}>{formData.contactPerson || 'Not Provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Mobile:</Text>
                <Text style={styles.value}>+91 {formData.phone || initialMobile}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>PAN:</Text>
                <Text style={styles.value}>{formData.pan || 'Not Provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>GSTIN:</Text>
                <Text style={styles.value}>{formData.gstin || 'Not Provided / Exempted'}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Business Constitution */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Building2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>BUSINESS CONSTITUTION (STEP 2)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(2)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Entity Structure:</Text>
                <Text style={styles.value}>{formData.businessType || 'Not Provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Year Established:</Text>
                <Text style={styles.value}>{formData.yearEstablished || 'Not Provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>MSME / Udyam No.:</Text>
                <Text style={styles.value}>{formData.msmeNumber || 'Not Provided (Optional)'}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Address & Depot */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>REGISTERED OFFICE & DEPOT (STEP 3)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(3)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.stackedBlock}>
                <Text style={styles.stackedLabel}>Registered Office Address:</Text>
                <View style={styles.stackedValueBox}>
                  <Text style={styles.stackedValueText}>{formData.registeredAddress || 'Not Provided'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>City, State:</Text>
                <Text style={styles.value}>
                  {formData.city || formData.state || formData.pincode
                    ? `${formData.city ? `${formData.city}, ` : ''}${formData.state || ''}${
                        formData.pincode ? ` - ${formData.pincode}` : ''
                      }`
                    : 'Not Provided'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{formData.email || 'Not Provided (Optional)'}</Text>
              </View>
            </View>
          </View>

          {/* Section 3: Route Coverage & Operating Hubs */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>ROUTE COVERAGE & OPERATING HUBS (STEP 4)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(4)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.stackedBlock}>
                <Text style={styles.stackedLabel}>Active Regional Hubs:</Text>
                <View style={styles.stackedValueBox}>
                  <Text style={styles.stackedValueText}>
                    {formData.operatingHubs && formData.operatingHubs.length > 0
                      ? formData.operatingHubs
                          .map((idOrName) => {
                            const match = allHubs.find((h) => h.id === idOrName);
                            return match ? match.name : idOrName;
                          })
                          .join(', ')
                      : 'None selected'}
                  </Text>
                </View>
              </View>
              {formData.manualOperatingLocations && formData.manualOperatingLocations.length > 0 && (
                <View style={styles.stackedBlock}>
                  <Text style={styles.stackedLabel}>Manually Added Locations:</Text>
                  <View style={styles.stackedValueBox}>
                    <Text style={styles.stackedValueText}>
                      {formData.manualOperatingLocations.join(', ')}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.label}>Commercial Permits:</Text>
                <Text style={styles.value}>
                  {formData.interstatePermits && formData.interstatePermits.length > 0
                    ? formData.interstatePermits.join(', ')
                    : 'None selected'}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4: Fleet Strength & Vehicle Configurations */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>FLEET STRENGTH & VEHICLE DETAILS (STEP 5)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(5)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Total Active Fleet:</Text>
                <Text style={styles.value}>
                  {formData.totalFleetCount && formData.totalFleetCount > 0
                    ? `${formData.totalFleetCount} Vehicles`
                    : formData.fleetStrength || '0 Vehicles'}
                </Text>
              </View>
              <View style={styles.stackedBlock}>
                <Text style={styles.stackedLabel}>Enrolled Fleet Vehicles & Lorries:</Text>
                <View style={styles.stackedValueBox}>
                  {formData.vehicleConfigs && formData.vehicleConfigs.length > 0 ? (
                    formData.vehicleConfigs.map((c, i) => (
                      <View key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottomWidth: i < (formData.vehicleConfigs?.length || 0) - 1 ? 1 : 0, borderBottomColor: '#E2E8F0' }}>
                        <Text style={styles.configItemText}>
                          • <Text style={styles.boldText}>{c.registrationNumber || c.rcNumber || `Lorry #${i + 1}`}</Text>: {c.bodyType} {c.vehicleType} ({c.capacity} {c.capacityUnit}) - {c.ownership || 'Owned'}
                        </Text>
                        {c.makeModel ? (
                          <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 12 }}>
                            Make/Model: {c.makeModel}
                          </Text>
                        ) : null}
                        {c.driverName ? (
                          <Text style={{ fontSize: 11, color: '#0369A1', marginLeft: 12, fontWeight: '600' }}>
                            Driver: {c.driverName} {c.driverPhone ? `(+91 ${c.driverPhone})` : ''}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  ) : formData.truckCategories && formData.truckCategories.length > 0 ? (
                    <Text style={styles.stackedValueText}>{formData.truckCategories.join(', ')}</Text>
                  ) : (
                    <Text style={styles.stackedValueText}>None specified</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Section 5: Transport Service Capabilities */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Package size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>SERVICE OFFERINGS (STEP 6)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(6)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.stackedBlock}>
                <Text style={styles.stackedLabel}>Selected Offerings:</Text>
                <View style={styles.stackedValueBox}>
                  <Text style={styles.stackedValueText}>
                    {formData.servicesOffered && formData.servicesOffered.length > 0
                      ? formData.servicesOffered.join(', ')
                      : 'None selected'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section 6: Attached KYC Documents */}
          <View style={styles.reviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <FileText size={16} color="#F05A22" />
                <Text style={styles.cardHeaderTitle}>COMPLIANCE KYC DOCUMENTS (STEP 7)</Text>
              </View>
              <TouchableOpacity onPress={() => onEditSection(7)} style={styles.editBtn}>
                <Edit2 size={12} color="#F05A22" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.docItemCard}>
                <View style={styles.docItemHeader}>
                  <Text style={styles.docItemTitle}>PAN Card (Mandatory)</Text>
                  <Text style={formData.documents?.find((d) => d.docType === 'COMPANY_PAN')?.fileName ? styles.docStatusOk : styles.docStatusMissing}>
                    {formData.documents?.find((d) => d.docType === 'COMPANY_PAN')?.fileName ? '✓ Uploaded' : 'Missing'}
                  </Text>
                </View>
                <Text style={styles.docFileName} numberOfLines={1}>
                  {formData.documents?.find((d) => d.docType === 'COMPANY_PAN')?.fileName || 'Not uploaded yet'}
                </Text>
              </View>

              <View style={styles.docItemCard}>
                <View style={styles.docItemHeader}>
                  <Text style={styles.docItemTitle}>Cancelled Cheque (Mandatory)</Text>
                  <Text style={formData.documents?.find((d) => d.docType === 'BANK_CANCELLED_CHEQUE')?.fileName ? styles.docStatusOk : styles.docStatusMissing}>
                    {formData.documents?.find((d) => d.docType === 'BANK_CANCELLED_CHEQUE')?.fileName ? '✓ Uploaded' : 'Missing'}
                  </Text>
                </View>
                <Text style={styles.docFileName} numberOfLines={1}>
                  {formData.documents?.find((d) => d.docType === 'BANK_CANCELLED_CHEQUE')?.fileName || 'Not uploaded yet'}
                </Text>
              </View>

              <View style={styles.docItemCard}>
                <View style={styles.docItemHeader}>
                  <Text style={styles.docItemTitle}>GST Certificate (Optional)</Text>
                  <Text style={formData.documents?.find((d) => d.docType === 'GST_CERTIFICATE')?.fileName ? styles.docStatusOk : styles.docStatusOptional}>
                    {formData.documents?.find((d) => d.docType === 'GST_CERTIFICATE')?.fileName ? '✓ Uploaded' : 'Omitted (Optional)'}
                  </Text>
                </View>
                <Text style={styles.docFileName} numberOfLines={1}>
                  {formData.documents?.find((d) => d.docType === 'GST_CERTIFICATE')?.fileName || 'Exempted / Not provided'}
                </Text>
              </View>

              <View style={styles.docItemCard}>
                <View style={styles.docItemHeader}>
                  <Text style={styles.docItemTitle}>Transport Declaration (Optional)</Text>
                  <Text style={formData.documents?.find((d) => d.docType === 'TRANSPORT_DECLARATION')?.fileName ? styles.docStatusOk : styles.docStatusOptional}>
                    {formData.documents?.find((d) => d.docType === 'TRANSPORT_DECLARATION')?.fileName ? '✓ Uploaded' : 'Omitted (Optional)'}
                  </Text>
                </View>
                <Text style={styles.docFileName} numberOfLines={1}>
                  {formData.documents?.find((d) => d.docType === 'TRANSPORT_DECLARATION')?.fileName || 'Exempted / Not provided'}
                </Text>
              </View>

              {/* Fleet Documents Summary */}
              {formData.fleetDocuments && formData.fleetDocuments.length > 0 && (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>
                    Attached Fleet & Driver Documents ({formData.fleetDocuments.length}):
                  </Text>
                  {formData.fleetDocuments.map((fd, fIdx) => (
                    <View key={fIdx} style={[styles.docItemCard, { marginBottom: 6 }]}>
                      <View style={styles.docItemHeader}>
                        <Text style={styles.docItemTitle}>{fd.title || fd.docType} ({fd.registrationNumber})</Text>
                        <Text style={styles.docStatusOk}>✓ Attached</Text>
                      </View>
                      <Text style={styles.docFileName} numberOfLines={1}>
                        {fd.fileName}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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
                <Text style={styles.goldBtnText}>Verify & Submit Application</Text>
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
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  value: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },
  stackedBlock: {
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
  },
  stackedLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stackedValueBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stackedValueText: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  configItemText: {
    color: '#1E293B',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  docItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  docItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  docItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  docStatusOk: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docStatusMissing: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docStatusOptional: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docFileName: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
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
