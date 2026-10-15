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
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Phone,
  Mail,
  Check,
  Building2,
  Truck,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../components/AuthBottomDecoration';
import { authService } from '../services/authService';
import { MobileRole } from '../types';

interface RegistrationScreenProps {
  initialRole?: MobileRole;
  onBack: () => void;
  onGoToLogin: () => void;
  onRegisterSuccess: (
    phone: string,
    role: MobileRole,
    testCode?: string,
    draft?: {
      fullName: string;
      email: string;
      companyName?: string;
      companyPhone?: string;
      contactPhone?: string;
      otpDestination?: 'CONTACT_PERSON' | 'COMPANY_PHONE';
    }
  ) => void;
  onViewTerms: () => void;
}

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({
  initialRole = 'CLIENT',
  onBack,
  onGoToLogin,
  onRegisterSuccess,
  onViewTerms,
}) => {
  const [role, setRole] = useState<MobileRole>(initialRole);

  // Common & Role-specific fields
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [otpDestination, setOtpDestination] = useState<'CONTACT_PERSON' | 'COMPANY_PHONE'>('CONTACT_PERSON');
  const [emailAddress, setEmailAddress] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  // Validation errors map
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const roleLabels: Record<MobileRole, string> = {
    CLIENT: 'Client / Shipper',
    VENDOR: 'Vendor / Transporter',
    DRIVER: 'Driver',
  };

  const validateIndianPhone = (phone: string): boolean => {
    const clean = phone.replace(/\D/g, '').slice(-10);
    return clean.length === 10 && /^[6-9]\d{9}$/.test(clean);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const selectedOtpNumber =
    otpDestination === 'CONTACT_PERSON'
      ? contactPhone.replace(/\D/g, '').slice(-10)
      : companyPhone.replace(/\D/g, '').slice(-10);

  const handleRegister = async () => {
    const newErrors: { [key: string]: string } = {};

    if (role === 'CLIENT') {
      if (!companyName.trim()) {
        newErrors.companyName = 'Company Name is required.';
      }
      if (!fullName.trim()) {
        newErrors.fullName = 'Logistics Contact Person Name is required.';
      }
      if (!contactPhone.trim()) {
        newErrors.contactPhone = 'Contact Person Phone is required.';
      } else if (!validateIndianPhone(contactPhone)) {
        newErrors.contactPhone = 'Please enter a valid 10-digit Indian phone number.';
      }
      if (!companyPhone.trim()) {
        newErrors.companyPhone = 'Company Contact Number is required.';
      } else if (!validateIndianPhone(companyPhone)) {
        newErrors.companyPhone = 'Please enter a valid 10-digit Indian phone number.';
      }
      if (!emailAddress.trim()) {
        newErrors.emailAddress = 'Company Email ID is required.';
      } else if (!validateEmail(emailAddress)) {
        newErrors.emailAddress = 'Please enter a valid company email address.';
      }
    } else {
      if (!fullName.trim()) {
        newErrors.fullName = 'Full Name is required.';
      }
      if (!contactPhone.trim()) {
        newErrors.contactPhone = 'Mobile number is required.';
      } else if (!validateIndianPhone(contactPhone)) {
        newErrors.contactPhone = 'Please enter a valid 10-digit Indian mobile number.';
      }
      if (emailAddress.trim() && !validateEmail(emailAddress)) {
        newErrors.emailAddress = 'Please enter a valid email address.';
      }
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = 'Please accept the Terms & Privacy Policy to proceed.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      Alert.alert('Required Field', firstError);
      return;
    }

    const targetPhone = role === 'CLIENT' ? selectedOtpNumber : contactPhone.replace(/\D/g, '').slice(-10);

    setLoading(true);
    try {
      // 1. Check existing account identity & role conflict using verified rules
      const checkRes = await authService.checkMobileRegistration(targetPhone, role);

      if (checkRes.isRegisteredOtherRole && checkRes.status !== 'DEACTIVATED') {
        Alert.alert(
          'Existing Registration Detected',
          `This phone number (+91 ${targetPhone}) is already registered under the role of ${checkRes.otherRole}.\n\nIf you want to register as ${roleLabels[role]}, please contact the NECL Admin for approval.`
        );
        setLoading(false);
        return;
      }

      if (checkRes.isRegistered && checkRes.status === 'APPROVED') {
        Alert.alert(
          'Account Already Registered',
          `An active ${roleLabels[role]} account already exists for +91 ${targetPhone}. Please proceed to login with OTP.`,
          [{ text: 'Go to Login', onPress: onGoToLogin }]
        );
        setLoading(false);
        return;
      }

      // 2. Dispatch OTP strictly to the chosen destination phone number
      // Temporary form state remains in memory; no permanent client records created prematurely.
      const otpRes = await authService.sendOtp(targetPhone, 'REGISTRATION', role);

      onRegisterSuccess(targetPhone, role, otpRes.testCode, {
        fullName: fullName.trim(),
        email: emailAddress.trim().toLowerCase(),
        companyName: companyName.trim(),
        companyPhone: companyPhone.replace(/\D/g, '').slice(-10),
        contactPhone: contactPhone.replace(/\D/g, '').slice(-10),
        otpDestination,
      });
    } catch (err: any) {
      Alert.alert('Registration Notice', err.message || 'Unable to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar with Back Arrow */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={22} color="#172B4D" />
            </TouchableOpacity>
          </View>

          {/* Logo Center */}
          <View style={styles.logoWrap}>
            <BrandLogoHeader size="md" theme="light" />
          </View>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Create <Text style={styles.orangeText}>Account</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Join North Eastern Carriers Logistics pan-India freight network
            </Text>
          </View>

          {/* 3 Role Selection Segment Tabs */}
          <View style={styles.roleSegmentWrap}>
            <TouchableOpacity
              style={[styles.roleSegmentBtn, role === 'CLIENT' && styles.roleSegmentBtnActive]}
              onPress={() => {
                setRole('CLIENT');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Building2
                size={16}
                color={role === 'CLIENT' ? '#FFFFFF' : '#64748B'}
                strokeWidth={2}
              />
              <Text style={[styles.roleSegmentText, role === 'CLIENT' && styles.roleSegmentTextActive]}>
                Client
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleSegmentBtn, role === 'VENDOR' && styles.roleSegmentBtnActive]}
              onPress={() => {
                setRole('VENDOR');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Truck
                size={16}
                color={role === 'VENDOR' ? '#FFFFFF' : '#64748B'}
                strokeWidth={2}
              />
              <Text style={[styles.roleSegmentText, role === 'VENDOR' && styles.roleSegmentTextActive]}>
                Vendor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleSegmentBtn, role === 'DRIVER' && styles.roleSegmentBtnActive]}
              onPress={() => {
                setRole('DRIVER');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <UserCheck
                size={16}
                color={role === 'DRIVER' ? '#FFFFFF' : '#64748B'}
                strokeWidth={2}
              />
              <Text style={[styles.roleSegmentText, role === 'DRIVER' && styles.roleSegmentTextActive]}>
                Driver
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields: Phase 1 Dedicated Client Registration */}
          <View style={styles.formContainer}>
            {role === 'CLIENT' ? (
              <>
                {/* 1. Company Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Company Name *</Text>
                  <View style={[styles.inputContainer, errors.companyName ? styles.inputError : undefined]}>
                    <Building2 size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Registered Company / Entity Name"
                      placeholderTextColor="#94A3B8"
                      value={companyName}
                      onChangeText={(t) => {
                        setCompanyName(t);
                        if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: '' }));
                      }}
                      autoCapitalize="words"
                    />
                  </View>
                  {errors.companyName ? <Text style={styles.errorText}>{errors.companyName}</Text> : null}
                </View>

                {/* 2. Logistics Contact Person Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Logistics Contact Person Name *</Text>
                  <View style={[styles.inputContainer, errors.fullName ? styles.inputError : undefined]}>
                    <User size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Full Name of Contact Person"
                      placeholderTextColor="#94A3B8"
                      value={fullName}
                      onChangeText={(t) => {
                        setFullName(t);
                        if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      autoCapitalize="words"
                    />
                  </View>
                  {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                </View>

                {/* 3. Contact Person Phone Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Contact Person Phone Number *</Text>
                  <View style={[styles.inputContainer, errors.contactPhone ? styles.inputError : undefined]}>
                    <Phone size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <Text style={styles.prefixText}>+91 </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="10-digit Mobile Number"
                      placeholderTextColor="#94A3B8"
                      value={contactPhone}
                      onChangeText={(t) => {
                        setContactPhone(t);
                        if (errors.contactPhone) setErrors((prev) => ({ ...prev, contactPhone: '' }));
                      }}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  {errors.contactPhone ? <Text style={styles.errorText}>{errors.contactPhone}</Text> : null}
                </View>

                {/* 4. Company Contact Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Company Contact Number *</Text>
                  <View style={[styles.inputContainer, errors.companyPhone ? styles.inputError : undefined]}>
                    <Building2 size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <Text style={styles.prefixText}>+91 </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Corporate / Landline / Mobile"
                      placeholderTextColor="#94A3B8"
                      value={companyPhone}
                      onChangeText={(t) => {
                        setCompanyPhone(t);
                        if (errors.companyPhone) setErrors((prev) => ({ ...prev, companyPhone: '' }));
                      }}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  {errors.companyPhone ? <Text style={styles.errorText}>{errors.companyPhone}</Text> : null}
                </View>

                {/* 5. OTP Destination Selection (Radio Button Group) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Select Number for OTP Verification *</Text>
                  <View style={styles.otpDestinationBox}>
                    <TouchableOpacity
                      style={[
                        styles.otpOptionCard,
                        otpDestination === 'CONTACT_PERSON' && styles.otpOptionCardActive,
                      ]}
                      onPress={() => setOtpDestination('CONTACT_PERSON')}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioCircle, otpDestination === 'CONTACT_PERSON' && styles.radioCircleActive]}>
                        {otpDestination === 'CONTACT_PERSON' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.otpOptionTitle}>Logistics Contact Person</Text>
                        <Text style={styles.otpOptionSub}>
                          +91 {contactPhone.trim() || '—'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.otpOptionCard,
                        otpDestination === 'COMPANY_PHONE' && styles.otpOptionCardActive,
                      ]}
                      onPress={() => setOtpDestination('COMPANY_PHONE')}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioCircle, otpDestination === 'COMPANY_PHONE' && styles.radioCircleActive]}>
                        {otpDestination === 'COMPANY_PHONE' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.otpOptionTitle}>Company Contact Number</Text>
                        <Text style={styles.otpOptionSub}>
                          +91 {companyPhone.trim() || '—'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Clear display of chosen number */}
                  <View style={styles.selectedNumberBanner}>
                    <ShieldCheck size={16} color="#059669" />
                    <Text style={styles.selectedNumberText}>
                      OTP will be sent strictly to:{' '}
                      <Text style={{ fontWeight: '700', color: '#065F46' }}>
                        +91 {selectedOtpNumber || '(Enter selected number above)'}
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* 6. Company Email ID */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Company Email ID *</Text>
                  <View style={[styles.inputContainer, errors.emailAddress ? styles.inputError : undefined]}>
                    <Mail size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="official@company.com"
                      placeholderTextColor="#94A3B8"
                      value={emailAddress}
                      onChangeText={(t) => {
                        setEmailAddress(t);
                        if (errors.emailAddress) setErrors((prev) => ({ ...prev, emailAddress: '' }));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  {errors.emailAddress ? <Text style={styles.errorText}>{errors.emailAddress}</Text> : null}
                </View>
              </>
            ) : (
              <>
                {/* Standard Inputs for Vendor / Driver */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name *</Text>
                  <View style={[styles.inputContainer, errors.fullName ? styles.inputError : undefined]}>
                    <User size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Full Name"
                      placeholderTextColor="#94A3B8"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                  </View>
                  {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Mobile Number *</Text>
                  <View style={[styles.inputContainer, errors.contactPhone ? styles.inputError : undefined]}>
                    <Phone size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <Text style={styles.prefixText}>+91 </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="10-digit Mobile Number"
                      placeholderTextColor="#94A3B8"
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  {errors.contactPhone ? <Text style={styles.errorText}>{errors.contactPhone}</Text> : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address (Optional)</Text>
                  <View style={styles.inputContainer}>
                    <Mail size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Email Address"
                      placeholderTextColor="#94A3B8"
                      value={emailAddress}
                      onChangeText={setEmailAddress}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            {/* Consent Checkbox */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                {agreeTerms && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.consentText}>
                I agree to NECL{' '}
                <Text style={styles.linkText} onPress={onViewTerms}>
                  Terms & Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Registration Buttons: Register & Get OTP */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.registerBtnText}>
                    {role === 'CLIENT' ? 'Get OTP' : 'Register & Get OTP'}
                  </Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>

            {/* Already have an account? Login */}
            <TouchableOpacity
              style={styles.loginRow}
              onPress={onGoToLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.loginRowText}>Already have an account? </Text>
              <Text style={styles.loginRowLink}>Login</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Bottom Wave Decoration */}
          <AuthBottomDecoration height={180} />
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
    marginTop: 4,
    marginBottom: 16,
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
  },
  roleSegmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginHorizontal: 24,
    padding: 4,
    marginBottom: 20,
  },
  roleSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  roleSegmentBtnActive: {
    backgroundColor: '#0A1931',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  roleSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roleSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 2,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172B4D',
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#172B4D',
    height: '100%',
  },
  otpDestinationBox: {
    gap: 8,
    marginBottom: 8,
  },
  otpOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  otpOptionCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#F05A22',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
  },
  otpOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#172B4D',
  },
  otpOptionSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  selectedNumberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  selectedNumberText: {
    fontSize: 11.5,
    color: '#065F46',
    flex: 1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  consentText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  linkText: {
    color: '#F05A22',
    fontWeight: '600',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F05A22',
    borderRadius: 10,
    height: 50,
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  registerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginRowText: {
    fontSize: 13,
    color: '#64748B',
  },
  loginRowLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F05A22',
  },
});
