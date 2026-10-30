import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { ArrowLeft, ShieldCheck, Edit3 } from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import {
  PrimaryButton,
  OTPInput,
  ErrorMessage,
} from '../../../components/auth';
import { authService } from '../../../services/authService';
import { MobileRole } from '../../../types';

interface OtpScreenProps {
  mobileNumber: string;
  testCode?: string;
  role?: MobileRole;
  purpose?: 'LOGIN' | 'REGISTRATION';
  onBack: () => void;
  onVerifiedNewUser: () => void;
  onVerifiedExistingUser: (role: MobileRole, profile: any, accountStatus: string) => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({
  mobileNumber,
  testCode = '123456',
  role = 'CLIENT',
  purpose = 'LOGIN',
  onBack,
  onVerifiedNewUser,
  onVerifiedExistingUser,
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formatTimer = (sec: number) => {
    const mm = Math.floor(sec / 60).toString().padStart(2, '0');
    const ss = (sec % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleOtpChange = (val: string) => {
    setOtp(val);
    if (errorMessage) setErrorMessage(null);
  };

  const verifyCode = async (codeToVerify?: string) => {
    if (loading) return;

    const code = (codeToVerify || otp).trim();
    if (code.length !== 6 && code.length !== 5) {
      setErrorMessage('Please enter the complete 6-digit OTP verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.verifyOtp(mobileNumber, code, role, purpose);
      if ((res as any).roleConflict) {
        setErrorMessage(`Account is registered under ${(res as any).previousRole || 'another role'}.`);
        Alert.alert(
          'Existing Registration Detected',
          `You have previously registered with the role of ${(res as any).previousRole || 'another role'}. Your current registration role is ${role}. If you want to change your role, please contact the Admin for verification and approval.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Registration Flow: Proceed to submit registration
      if (purpose === 'REGISTRATION') {
        onVerifiedNewUser();
        return;
      }

      // Login Flow: Direct access to User App Home Screen
      if (res.isExistingUser && res.existingRole) {
        onVerifiedExistingUser(
          res.existingRole,
          res.userProfile,
          (res as any).accountStatus || 'ACTIVE'
        );
      } else {
        // Auto-provisioning session for valid OTP
        onVerifiedExistingUser(
          role,
          res.userProfile || {
            id: `${role.toLowerCase()}-${mobileNumber}`,
            fullName: `${role} User`,
            companyName: role === 'CLIENT' ? 'Client Enterprise' : 'Transport Firm',
          },
          'ACTIVE'
        );
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('WRONG_ROLE')) {
        const cleanMsg = msg.replace('WRONG_ROLE: ', '');
        setErrorMessage(cleanMsg);
        Alert.alert('Role Mismatch', cleanMsg, [{ text: 'OK', onPress: onBack }]);
      } else {
        const cleanMsg = msg || 'Invalid or expired OTP code. Use 123456 to log in.';
        setErrorMessage(cleanMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    setErrorMessage(null);
    try {
      await authService.sendOtp(mobileNumber, purpose, role);
      setSecondsLeft(30);
      setCanResend(false);
      setOtp('');
      Alert.alert('OTP Sent', `A new verification code (123456) has been sent to +91 ${mobileNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to resend OTP.');
    }
  };

  // Masked phone format: +91 98765 •••••
  const maskedMobile = mobileNumber.length === 10
    ? `+91 ${mobileNumber.slice(0, 5)} •••••`
    : `+91 ${mobileNumber}`;

  const isCodeComplete = otp.length === 6 || otp.length === 5;

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
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Back Arrow */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              accessibilityLabel="Back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={24} color="#172B4D" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Centered Brand Logo */}
          <View style={styles.logoWrap}>
            <BrandLogoHeader size="md" theme="light" />
          </View>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Verify Your <Text style={styles.orangeText}>Mobile Number</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Enter the 6-digit code sent to
            </Text>

            {/* Masked Mobile Row with Change Option */}
            <View style={styles.phoneRow}>
              <Text style={styles.phoneText}>{maskedMobile}</Text>
              <TouchableOpacity
                onPress={onBack}
                style={styles.changePhoneBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Edit3 size={13} color="#F15A24" />
                <Text style={styles.changePhoneText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Dev/Testing Helper Badge */}
            {testCode ? (
              <View style={styles.testBadgeWrap}>
                <ShieldCheck size={14} color="#0052CC" />
                <Text style={styles.testBadgeText}>
                  Testing Code: <Text style={styles.testBadgeBold}>{testCode}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* OTP Input Form */}
          <View style={styles.formContainer}>
            <OTPInput
              length={6}
              value={otp}
              onChange={handleOtpChange}
              onComplete={(code: string) => verifyCode(code)}
              error={!!errorMessage}
            />

            {/* Resend OTP Section */}
            <View style={styles.resendWrap}>
              <Text style={styles.resendQuestion}>Didn't receive the OTP?</Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                  <Text style={styles.resendActionText}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendTimerText}>
                  Resend OTP in <Text style={styles.orangeBold}>{formatTimer(secondsLeft)}</Text>
                </Text>
              )}
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <ErrorMessage
                message={errorMessage}
                onDismiss={() => setErrorMessage(null)}
              />
            ) : null}

            {/* Primary Action Button: Verify & Continue */}
            <PrimaryButton
              title="Verify & Continue"
              onPress={() => verifyCode()}
              loading={loading}
              disabled={loading || !isCodeComplete}
              showArrow
              style={styles.verifyBtn}
            />

            {/* Secondary Action: Back to Login */}
            <TouchableOpacity
              style={styles.backLink}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>
                {purpose === 'REGISTRATION' ? '← Back to Registration' : '← Back to Login'}
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 32,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  orangeText: {
    color: '#F15A24',
  },
  subtitleText: {
    fontSize: 14,
    color: '#7B8798',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '400',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  phoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172B4D',
    letterSpacing: 0.5,
  },
  changePhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#FFF0EA',
  },
  changePhoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },
  testBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  testBadgeText: {
    fontSize: 12,
    color: '#1D4ED8',
  },
  testBadgeBold: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  resendWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    gap: 6,
  },
  resendQuestion: {
    fontSize: 13,
    color: '#7B8798',
  },
  resendActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F15A24',
  },
  resendTimerText: {
    fontSize: 13,
    color: '#7B8798',
  },
  orangeBold: {
    fontWeight: '700',
    color: '#F15A24',
  },
  verifyBtn: {
    marginTop: 10,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B8798',
  },
});
