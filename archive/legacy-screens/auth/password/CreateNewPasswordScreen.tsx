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
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';

interface CreateNewPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const CreateNewPasswordScreen: React.FC<CreateNewPasswordScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  const isFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecialChar &&
    newPassword === confirmPassword;

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Required Fields', 'Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords entered do not match. Please verify.');
      return;
    }
    if (!isFormValid) {
      Alert.alert(
        'Password Requirements',
        'Please ensure your password meets all 5 security requirements.'
      );
      return;
    }

    setLoading(true);
    try {
      setTimeout(() => {
        setLoading(false);
        onSuccess();
      }, 500);
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Notice', err.message || 'Unable to reset password. Please try again.');
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
              Create New <Text style={styles.orangeText}>Password</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Set a new password to access your account
            </Text>
          </View>

          {/* Input 1: New Password */}
          <View style={styles.inputContainer}>
            <Lock size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="New Password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff size={18} color="#94A3B8" />
              ) : (
                <Eye size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>
          </View>

          {/* Input 2: Confirm New Password */}
          <View style={styles.inputContainer}>
            <Lock size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Confirm New Password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} color="#94A3B8" />
              ) : (
                <Eye size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>
          </View>

          {/* Password Requirements Box Matching Reference Image 4 */}
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsHeader}>Your password must have:</Text>

            <View style={styles.reqItem}>
              <View style={[styles.reqCheckCircle, hasMinLength && styles.reqCheckCircleActive]}>
                <Check size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={[styles.reqText, hasMinLength && styles.reqTextActive]}>
                At least 8 characters
              </Text>
            </View>

            <View style={styles.reqItem}>
              <View style={[styles.reqCheckCircle, hasUppercase && styles.reqCheckCircleActive]}>
                <Check size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={[styles.reqText, hasUppercase && styles.reqTextActive]}>
                One uppercase letter (A–Z)
              </Text>
            </View>

            <View style={styles.reqItem}>
              <View style={[styles.reqCheckCircle, hasLowercase && styles.reqCheckCircleActive]}>
                <Check size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={[styles.reqText, hasLowercase && styles.reqTextActive]}>
                One lowercase letter (a–z)
              </Text>
            </View>

            <View style={styles.reqItem}>
              <View style={[styles.reqCheckCircle, hasNumber && styles.reqCheckCircleActive]}>
                <Check size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={[styles.reqText, hasNumber && styles.reqTextActive]}>
                One number (0–9)
              </Text>
            </View>

            <View style={styles.reqItem}>
              <View style={[styles.reqCheckCircle, hasSpecialChar && styles.reqCheckCircleActive]}>
                <Check size={11} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={[styles.reqText, hasSpecialChar && styles.reqTextActive]}>
                One special character (e.g. ! @ # $ %)
              </Text>
            </View>
          </View>

          {/* Primary Action Button: Reset Password -> */}
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.resetBtnText}>Reset Password</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Action Button: <- Back to Login */}
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={16} color="#172B4D" strokeWidth={2.2} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
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
    marginBottom: 24,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 14,
    height: 50,
    paddingHorizontal: 14,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#172B4D',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  requirementsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 24,
    padding: 16,
    marginBottom: 22,
  },
  requirementsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 10,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reqCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqCheckCircleActive: {
    backgroundColor: '#10B981',
  },
  reqText: {
    fontSize: 12.5,
    color: '#64748B',
  },
  reqTextActive: {
    color: '#1E293B',
    fontWeight: '600',
  },
  resetBtn: {
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
  resetBtnText: {
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
