import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { ClientProfileFormData } from '../../../types';

interface ClientProfileSetupScreenProps {
  initialMobile: string;
  initialData?: ClientProfileFormData;
  onBack: () => void;
  onSuccess: (data: ClientProfileFormData) => void;
}

const SUGGESTED_DEPARTMENTS = [
  'Logistics',
  'Supply Chain',
  'Procurement',
  'Operations',
  'Dispatch',
];

export const ClientProfileSetupScreen: React.FC<ClientProfileSetupScreenProps> = ({
  initialMobile,
  initialData,
  onBack,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [emailAddress, setEmailAddress] = useState(initialData?.emailAddress || '');
  const [designation, setDesignation] = useState(initialData?.designation || '');
  const [department, setDepartment] = useState(initialData?.department || '');
  const [customDepartment, setCustomDepartment] = useState('');
  const [isCustomDept, setIsCustomDept] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [designationError, setDesignationError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  const handleSelectDepartment = (dept: string) => {
    setIsCustomDept(false);
    setDepartment(dept);
    setDepartmentError(null);
  };

  const handleSelectCustomDepartment = () => {
    setIsCustomDept(true);
    setDepartment(customDepartment);
  };

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = () => {
    let isValid = true;

    if (!fullName.trim() || fullName.trim().length < 2) {
      setFullNameError('Please enter the Authorized Contact Person name');
      isValid = false;
    } else {
      setFullNameError(null);
    }

    if (!emailAddress.trim() || !validateEmail(emailAddress.trim())) {
      setEmailError('Please enter a valid official email address');
      isValid = false;
    } else {
      setEmailError(null);
    }

    if (!designation.trim() || designation.trim().length < 2) {
      setDesignationError('Please enter the contact person designation');
      isValid = false;
    } else {
      setDesignationError(null);
    }

    const effectiveDept = isCustomDept ? customDepartment.trim() : department.trim();
    if (!effectiveDept || effectiveDept.length < 2) {
      setDepartmentError('Please select or enter a department');
      isValid = false;
    } else {
      setDepartmentError(null);
    }

    if (!isValid) {
      Alert.alert('Required Fields', 'Please complete all mandatory corporate profile fields.');
      return;
    }

    const payload: ClientProfileFormData = {
      fullName: fullName.trim(),
      mobileNumber: initialMobile,
      emailAddress: emailAddress.trim(),
      designation: designation.trim(),
      department: effectiveDept,
      companyName: initialData?.companyName || '',
      companyPhone: initialData?.companyPhone || '',
      gstNumber: initialData?.gstNumber || '',
      businessType: initialData?.businessType || '',
    };

    onSuccess(payload);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Bar with Back Arrow */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ArrowLeft size={22} color="#172B4D" />
            </TouchableOpacity>
          </View>

          {/* Centered Brand Logo */}
          <View style={styles.logoWrap}>
            <BrandLogoHeader size="md" theme="light" />
          </View>

          {/* Step Indicator (Step 1 of 4) */}
          <View style={styles.stepIndicatorRow}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <Text style={styles.stepDotText}>1</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepDot}>
              <Text style={styles.stepDotTextInactive}>2</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepDot}>
              <Text style={styles.stepDotTextInactive}>3</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepDot}>
              <Text style={styles.stepDotTextInactive}>4</Text>
            </View>
          </View>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Contact <Text style={styles.orangeText}>Profile Setup</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Set up your authorized logistics representative profile for transport coordination
            </Text>
          </View>

          <View style={styles.formContainer}>
            {/* Verified Phone Banner */}
            <View style={styles.verifiedPhoneCard}>
              <View style={styles.phoneIconCircle}>
                <Phone size={18} color="#16A34A" />
              </View>
              <View style={styles.phoneDetailsCol}>
                <Text style={styles.phoneLabel}>Verified Mobile Number</Text>
                <Text style={styles.phoneNumberText}>+91 {initialMobile.replace('+91', '')}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <CheckCircle2 size={14} color="#16A34A" />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            </View>

            {/* Section 1: Authorized Contact Person */}
            <View style={styles.sectionHeader}>
              <User size={16} color="#F05A22" />
              <Text style={styles.sectionHeaderText}>Authorized Representative</Text>
            </View>

            <Text style={styles.fieldLabel}>Authorized Contact Person Name *</Text>
            <View style={[styles.inputContainer, fullNameError ? styles.inputError : null]}>
              <User size={16} color={fullNameError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ramesh Chandra Sharma"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (fullNameError) setFullNameError(null);
                }}
              />
            </View>
            {fullNameError ? <Text style={styles.errorText}>{fullNameError}</Text> : null}

            <Text style={styles.fieldLabel}>Official Email Address *</Text>
            <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
              <Mail size={16} color={emailError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="ramesh@company.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={emailAddress}
                onChangeText={(text) => {
                  setEmailAddress(text);
                  if (emailError) setEmailError(null);
                }}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            {/* Department Selection */}
            <Text style={styles.fieldLabel}>Department *</Text>
            <View style={styles.departmentChipsRow}>
              {SUGGESTED_DEPARTMENTS.map((dept) => {
                const isSelected = !isCustomDept && department === dept;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.deptChip, isSelected && styles.deptChipActive]}
                    onPress={() => handleSelectDepartment(dept)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.deptChipText, isSelected && styles.deptChipTextActive]}>
                      {dept}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.deptChip, isCustomDept && styles.deptChipActive]}
                onPress={handleSelectCustomDepartment}
                activeOpacity={0.75}
              >
                <Text style={[styles.deptChipText, isCustomDept && styles.deptChipTextActive]}>
                  + Other / Custom
                </Text>
              </TouchableOpacity>
            </View>

            {isCustomDept && (
              <View style={[styles.inputContainer, departmentError ? styles.inputError : null, { marginTop: 6 }]}>
                <Building2 size={16} color={departmentError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter custom department (e.g. Plant Logistics)"
                  placeholderTextColor="#94A3B8"
                  value={customDepartment}
                  onChangeText={(text) => {
                    setCustomDepartment(text);
                    if (departmentError) setDepartmentError(null);
                  }}
                />
              </View>
            )}
            {departmentError ? <Text style={styles.errorText}>{departmentError}</Text> : null}

            {/* Designation */}
            <Text style={styles.fieldLabel}>Designation *</Text>
            <View style={[styles.inputContainer, designationError ? styles.inputError : null]}>
              <Briefcase size={16} color={designationError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Senior Logistics Officer / VP Supply Chain"
                placeholderTextColor="#94A3B8"
                value={designation}
                onChangeText={(text) => {
                  setDesignation(text);
                  if (designationError) setDesignationError(null);
                }}
              />
            </View>
            {designationError ? <Text style={styles.errorText}>{designationError}</Text> : null}

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleSubmit}
              activeOpacity={0.88}
            >
              <Text style={styles.continueBtnText}>Continue to Business Details</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Security Guarantee Note */}
            <View style={styles.securityNote}>
              <ShieldCheck size={14} color="#16A34A" />
              <Text style={styles.securityText}>
                TRUCKS encrypted registration • Verified corporate session
              </Text>
            </View>
          </View>

          <AuthBottomDecoration />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
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
  formContainer: {
    paddingHorizontal: 24,
  },
  verifiedPhoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 12,
  },
  phoneIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneDetailsCol: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  phoneNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14532D',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeaderText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
    letterSpacing: 0.2,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
  },
  leadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#172B4D',
    height: '100%',
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    marginTop: -10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  departmentChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  deptChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptChipActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  deptChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  deptChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  continueBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    marginTop: 10,
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
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 12,
  },
  securityText: {
    color: '#64748B',
    fontSize: 11,
  },
});

