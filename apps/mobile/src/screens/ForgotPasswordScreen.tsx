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
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../components/AuthBottomDecoration';
import { authService } from '../services/authService';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onCodeSent: (phone: string, testCode?: string) => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBack,
  onCodeSent,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    const cleanPhone = identifier.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.sendOtp(cleanPhone, 'PASSWORD_RESET');
      Alert.alert(
        'Recovery Code Sent',
        `A 6-digit verification code has been dispatched to +91 ${cleanPhone}.`,
        [{ text: 'Continue', onPress: () => onCodeSent(cleanPhone, res.testCode) }]
      );
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Unable to send recovery code. Please try again.');
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
              Forgot <Text style={styles.orangeText}>Password?</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Enter your registered mobile number to receive a secure recovery verification code.
            </Text>
          </View>

          {/* Security Notice Card */}
          <View style={styles.noticeCard}>
            <ShieldAlert size={20} color="#F05A22" />
            <Text style={styles.noticeText}>
              We will verify your identity via a one-time OTP before allowing password modification.
            </Text>
          </View>

          {/* Input: Mobile Number */}
          <View style={styles.inputContainer}>
            <Phone size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
            <Text style={styles.prefixText}>+91 </Text>
            <TextInput
              style={styles.textInput}
              placeholder="10-digit Mobile Number"
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Primary Action Button: Send Recovery Code -> */}
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSendCode}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.sendBtnText}>Send Recovery Code</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Action Button: Back to Login */}
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={16} color="#172B4D" strokeWidth={2.2} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, minHeight: 30 }} />

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
    marginTop: 6,
    marginBottom: 20,
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
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
    lineHeight: 20,
    maxWidth: 320,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    marginHorizontal: 24,
    padding: 12,
    marginBottom: 18,
    gap: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    color: '#9A3412',
    lineHeight: 17,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 20,
    height: 50,
    paddingHorizontal: 14,
  },
  inputLeadingIcon: {
    marginRight: 10,
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
  sendBtn: {
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
  sendBtnText: {
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
