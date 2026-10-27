import React, { useState, useEffect, useRef } from 'react';
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
import { ArrowLeft, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
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
  testCode,
  role = 'CLIENT',
  purpose = 'LOGIN',
  onBack,
  onVerifiedNewUser,
  onVerifiedExistingUser,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(28); // Matches "00:28" in reference image!
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const isVerifyingRef = useRef(false);

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

  const handleDigitChange = (val: string, index: number) => {
    if (errorMessage) setErrorMessage(null);
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newDigits = [...digits];

    // Case 1: Pasted full or partial code (e.g. >= 5 digits)
    if (cleanVal.length >= 5) {
      const pasted = cleanVal.slice(0, 5).split('');
      for (let i = 0; i < 5; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      setFocusedIndex(4);
      inputRefs.current[4]?.focus();
      if (pasted.length === 5) {
        verifyCode(newDigits.join(''));
      }
      return;
    }

    // Case 2: Overwrite existing digit when typed in an already-filled box (cleanVal length > 1)
    if (cleanVal.length > 1) {
      const singleChar = cleanVal.slice(-1);
      newDigits[index] = singleChar;
      setDigits(newDigits);
      if (index < 4) {
        setFocusedIndex(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
      const fullCode = newDigits.join('');
      if (fullCode.length === 5) {
        verifyCode(fullCode);
      }
      return;
    }

    // Case 3: Empty string (user cleared digit)
    if (cleanVal === '') {
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Case 4: Single digit entry
    newDigits[index] = cleanVal;
    setDigits(newDigits);

    if (cleanVal && index < 4) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 5) {
      verifyCode(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (errorMessage) setErrorMessage(null);
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const verifyCode = async (codeToVerify?: string) => {
    if (isVerifyingRef.current || loading) return;

    const code = (codeToVerify || digits.join('')).trim();
    if (code.length !== 5) {
      setErrorMessage('Please enter all 5 digits of the verification code.');
      return;
    }

    isVerifyingRef.current = true;
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

      // Strict separation: Verifying an OTP during registration must NOT grant direct access to the dashboard.
      if (purpose === 'REGISTRATION') {
        onVerifiedNewUser();
        return;
      }

      if (res.isExistingUser && res.existingRole) {
        onVerifiedExistingUser(
          res.existingRole,
          res.userProfile,
          (res as any).accountStatus || 'ACTIVE'
        );
      } else if (purpose === 'LOGIN') {
        // Block proceeding into dashboard for unregistered users during login
        setErrorMessage('You are not registered yet. Please register before logging in.');
        Alert.alert(
          'Registration Required',
          'You are not registered yet. Please register before logging in.',
          [
            {
              text: 'Register Now',
              onPress: onVerifiedNewUser,
            },
            {
              text: 'Try Again',
              onPress: onBack,
              style: 'cancel',
            },
          ]
        );
      } else {
        onVerifiedNewUser();
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('NOT_REGISTERED')) {
        setErrorMessage('You are not registered yet. Please register before logging in.');
        Alert.alert(
          'Registration Required',
          'You are not registered yet. Please register before logging in.',
          [
            {
              text: 'Register Now',
              onPress: onVerifiedNewUser,
            },
            {
              text: 'Try Again',
              onPress: onBack,
              style: 'cancel',
            },
          ]
        );
      } else if (msg.includes('WRONG_ROLE')) {
        const cleanMsg = msg.replace('WRONG_ROLE: ', '');
        setErrorMessage(cleanMsg);
        Alert.alert(
          'Role Mismatch',
          cleanMsg,
          [{ text: 'OK', onPress: onBack }]
        );
      } else {
        const cleanMsg = msg || 'Invalid or expired OTP code.';
        setErrorMessage(cleanMsg);
        Alert.alert('Verification Notice', cleanMsg);
      }
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || loading) return;
    setErrorMessage(null);
    try {
      await authService.sendOtp(mobileNumber, purpose, role);
      setSecondsLeft(30);
      setCanResend(false);
      setDigits(['', '', '', '', '']);
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
      Alert.alert('OTP Sent', `A new verification code has been sent to +91 ${mobileNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to resend OTP.');
      Alert.alert('Notice', err.message || 'Unable to resend OTP.');
    }
  };

  const formattedMobile = mobileNumber.length === 10
    ? `+91 ${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}`
    : `+91 ${mobileNumber}`;

  const isCodeComplete = digits.join('').length === 5;

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
              Verify <Text style={styles.orangeText}>OTP</Text>
            </Text>
            <Text style={styles.subtitleText}>
              We have sent a 5-digit OTP to
            </Text>
            <Text style={styles.phoneText}>{formattedMobile}</Text>

            {testCode ? (
              <View style={styles.testBadgeWrap}>
                <ShieldCheck size={14} color="#0052CC" />
                <Text style={styles.testBadgeText}>
                  Dev/Testing Code: <Text style={styles.testBadgeBold}>{testCode}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* 5 Individual Square OTP Input Boxes */}
          <View style={styles.otpBoxesRow}>
            {digits.map((digit, index) => {
              const isFocused = focusedIndex === index;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFocused && styles.otpBoxFocused,
                    digit !== '' && styles.otpBoxFilled,
                  ]}
                >
                  <TextInput
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    style={styles.otpInput}
                    keyboardType="number-pad"
                    maxLength={5}
                    value={digit}
                    onFocus={() => {
                      setFocusedIndex(index);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onChangeText={(val) => handleDigitChange(val, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    selectTextOnFocus
                  />
                  {isFocused && digit === '' && <View style={styles.cursorBar} />}
                </View>
              );
            })}
          </View>

          {/* Resend OTP Section */}
          <View style={styles.resendWrap}>
            <Text style={styles.resendQuestion}>Didn't receive the OTP?</Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOtp}>
                <Text style={styles.resendActionText}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendTimerText}>
                Resend OTP in <Text style={styles.orangeBold}>{formatTimer(secondsLeft)}</Text>
              </Text>
            )}
          </View>

          {/* Inline Error Message Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Primary Action Button: Verify & Continue -> */}
          <TouchableOpacity
            style={[
              styles.verifyBtn,
              (loading || !isCodeComplete) && styles.verifyBtnDisabled,
            ]}
            onPress={() => verifyCode()}
            disabled={loading || !isCodeComplete}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.verifyBtnText}>Verify & Continue</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Action Button: Back */}
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={16} color="#172B4D" strokeWidth={2.2} />
            <Text style={styles.backToLoginText}>
              {purpose === 'REGISTRATION' ? 'Back to Registration' : 'Back to Login'}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Bottom Scenic Truck & Wave Decoration */}
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
    marginTop: 6,
    marginBottom: 20,
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 26,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#172B4D',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  otpBox: {
    width: 48,
    height: 54,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5EAF0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  otpBoxFocused: {
    borderColor: '#F05A22',
    backgroundColor: '#FFFBF9',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#172B4D',
  },
  cursorBar: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: '#F05A22',
  },
  resendWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendQuestion: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  resendTimerText: {
    fontSize: 13.5,
    color: '#64748B',
  },
  orangeBold: {
    color: '#F05A22',
    fontWeight: '700',
  },
  resendActionText: {
    fontSize: 13.5,
    color: '#F05A22',
    fontWeight: '700',
  },
  testBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 8,
  },
  testBadgeText: {
    fontSize: 12.5,
    color: '#1E40AF',
    fontWeight: '500',
  },
  testBadgeBold: {
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    height: 50,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backToLoginBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    height: 50,
    borderRadius: 12,
  },
  backToLoginText: {
    color: '#172B4D',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
