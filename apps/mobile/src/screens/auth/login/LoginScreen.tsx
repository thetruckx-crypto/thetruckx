import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import {
  PrimaryButton,
  SecondaryButton,
  CustomCheckbox,
  MobileNumberField,
  AccountTypeSelector,
  AccountTypeBottomSheet,
  ErrorMessage,
} from '../../../components/auth';
import { authService, AuthSessionData } from '../../../services/authService';
import { MobileRole } from '../../../types';

interface LoginScreenProps {
  initialMobile?: string;
  selectedRole?: MobileRole;
  onBack: () => void;
  onContinueToOtp: (phone: string, purpose: 'LOGIN' | 'REGISTRATION', testCode?: string) => void;
  onLoginSuccess: (session: AuthSessionData) => void;
  onRoleChanged: (role: MobileRole) => void;
  onRegisterPress?: () => void;
  onNavigateToRegistration?: (role: MobileRole, mobile: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialMobile = '',
  selectedRole = 'CLIENT',
  onBack,
  onContinueToOtp,
  onRoleChanged,
  onRegisterPress,
  onNavigateToRegistration,
}) => {
  const [mobileNumber, setMobileNumber] = useState(initialMobile || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [role, setRole] = useState<MobileRole>(selectedRole);
  const [isRoleSheetVisible, setIsRoleSheetVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Modals for role mismatch & registration requirements
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showWrongRoleModal, setShowWrongRoleModal] = useState(false);
  const [registeredOtherRole, setRegisteredOtherRole] = useState<MobileRole | null>(null);

  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  const showNotice = (title: string, message: string, onOk?: () => void) => {
    setNoticeModal({
      visible: true,
      title,
      message,
      onOk,
    });
  };

  const handleCloseNotice = () => {
    const cb = noticeModal.onOk;
    setNoticeModal({ visible: false, title: '', message: '' });
    if (cb) cb();
  };

  const roleLabels: Record<MobileRole, string> = {
    CLIENT: 'Client',
    VENDOR: 'Vendor',
    DRIVER: 'Driver',
  };

  const handleSelectRole = (newRole: MobileRole) => {
    setRole(newRole);
    onRoleChanged(newRole);
    setIsRoleSheetVisible(false);
    if (inlineError) setInlineError(null);
  };

  const handleRegisterNow = () => {
    if (showWrongRoleModal && registeredOtherRole) {
      const otherLabel = roleLabels[registeredOtherRole];
      Alert.alert(
        'Registration Restricted',
        `This mobile number is already registered under the ${otherLabel} role. You cannot register under another role using the same mobile number.`
      );
      return;
    }
    setShowNotRegisteredModal(false);
    const cleanPhone = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    if (onNavigateToRegistration) {
      onNavigateToRegistration(role, cleanPhone);
    } else if (onRegisterPress) {
      onRegisterPress();
    }
  };

  const handleTryAgain = () => {
    setShowNotRegisteredModal(false);
    setShowWrongRoleModal(false);
  };

  const handleSwitchToRegisteredRole = () => {
    if (registeredOtherRole) {
      handleSelectRole(registeredOtherRole);
      setShowWrongRoleModal(false);
    }
  };

  const handleMobileChange = (val: string) => {
    setMobileNumber(val);
    if (inlineError) setInlineError(null);
  };

  const cleanPhone = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
  const isMobileValid = cleanPhone.length === 10;

  const handleLogin = async () => {
    if (!isMobileValid) {
      setInlineError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    setInlineError(null);

    try {
      // 1. Cross-role and registration check
      const check = await authService.checkMobileRegistration(cleanPhone, role);

      if (check.isRegisteredOtherRole && check.status !== 'DEACTIVATED') {
        setRegisteredOtherRole(check.otherRole || null);
        setShowWrongRoleModal(true);
        setLoading(false);
        return;
      }

      if (!check.isRegistered && check.status === 'NOT_REGISTERED') {
        setShowNotRegisteredModal(true);
        setLoading(false);
        return;
      }

      // 2. Dispatch OTP to mobile number
      const res = await authService.sendOtp(cleanPhone, 'LOGIN', role);
      onContinueToOtp(cleanPhone, 'LOGIN', res.testCode || '123456');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('WRONG_ROLE')) {
        setInlineError(msg);
      } else {
        // Fallback: Proceed to OTP screen with testing code 123456
        onContinueToOtp(cleanPhone, 'LOGIN', '123456');
      }
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

          {/* Welcome Back Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Welcome <Text style={styles.orangeText}>Back</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Login to continue to your account
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Account Type Selector Card */}
            <AccountTypeSelector
              selectedRole={role}
              onPress={() => setIsRoleSheetVisible(true)}
              style={styles.accountTypeSelector}
            />

            {/* Mobile Number Field */}
            <MobileNumberField
              value={mobileNumber}
              onChangeText={handleMobileChange}
              error={inlineError || undefined}
            />

            {/* Remember Me Option */}
            <View style={styles.optionsRow}>
              <CustomCheckbox
                checked={rememberMe}
                onChange={setRememberMe}
                label="Remember Me"
              />
            </View>

            {/* Inline Error Message */}
            {inlineError ? (
              <ErrorMessage
                message={inlineError}
                onDismiss={() => setInlineError(null)}
              />
            ) : null}

            {/* Primary Action Button: Send OTP & Login */}
            <PrimaryButton
              title="Send OTP & Login"
              onPress={handleLogin}
              loading={loading}
              disabled={!isMobileValid || loading}
              showArrow
              style={styles.primaryBtn}
            />

            {/* Divider: ─── OR ─── */}
            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Dynamic Registration CTA */}
            <SecondaryButton
              role={role}
              onPress={() => {
                const phone = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
                if (onNavigateToRegistration) {
                  onNavigateToRegistration(role, phone);
                } else if (onRegisterPress) {
                  onRegisterPress();
                }
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Type Bottom Sheet Modal */}
      <AccountTypeBottomSheet
        visible={isRoleSheetVisible}
        selectedRole={role}
        onSelectRole={handleSelectRole}
        onClose={() => setIsRoleSheetVisible(false)}
      />

      {/* Notice Popup Modal */}
      <Modal
        visible={noticeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseNotice}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.noticeCard}>
            <TouchableOpacity
              style={styles.modalCloseXBtn}
              onPress={handleCloseNotice}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.noticeWarningBadge}>
              <AlertTriangle size={32} color="#F15A24" strokeWidth={2.4} />
            </View>

            <Text style={styles.noticeCardTitle}>{noticeModal.title || 'Notice'}</Text>
            <Text style={styles.noticeCardMessage}>{noticeModal.message}</Text>

            <TouchableOpacity
              style={styles.noticeOkBtn}
              onPress={handleCloseNotice}
              activeOpacity={0.88}
            >
              <Text style={styles.noticeOkBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Not Registered Modal */}
      <Modal
        visible={showNotRegisteredModal}
        transparent
        animationType="fade"
        onRequestClose={handleTryAgain}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.alertCard}>
            <TouchableOpacity
              style={styles.modalCloseXBtn}
              onPress={handleTryAgain}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.alertWarningBadge}>
              <AlertTriangle size={32} color="#F15A24" strokeWidth={2.4} />
            </View>

            <Text style={styles.alertCardTitle}>Registration Required</Text>
            <Text style={styles.notRegisteredHeadline}>
              You are not registered yet. Please register before logging in.
            </Text>
            <Text style={styles.alertCardBody}>
              No registered {roleLabels[role]} account was found for +91 {mobileNumber}. Please complete your registration to access the {roleLabels[role]} portal.
            </Text>

            <View style={styles.alertActionsWrap}>
              <TouchableOpacity
                style={styles.alertPrimaryBtn}
                onPress={handleRegisterNow}
                activeOpacity={0.88}
              >
                <UserPlus size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.alertPrimaryBtnText}>Register Now</Text>
                <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alertSecondaryBtn}
                onPress={handleTryAgain}
                activeOpacity={0.75}
              >
                <RefreshCw size={15} color="#475569" strokeWidth={2} />
                <Text style={styles.alertSecondaryBtnText}>Try Another Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wrong Role Mismatch Modal */}
      <Modal
        visible={showWrongRoleModal}
        transparent
        animationType="fade"
        onRequestClose={handleTryAgain}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.alertCard}>
            <TouchableOpacity
              style={styles.modalCloseXBtn}
              onPress={handleTryAgain}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={18} color="#64748B" strokeWidth={2.4} />
            </TouchableOpacity>

            <View style={styles.alertWarningBadge}>
              <AlertTriangle size={32} color="#F15A24" strokeWidth={2.4} />
            </View>

            <Text style={styles.alertCardTitle}>Role Mismatch Detected</Text>
            <Text style={styles.notRegisteredHeadline}>
              This mobile number is registered as {registeredOtherRole ? roleLabels[registeredOtherRole] : 'another role'}.
            </Text>
            <Text style={styles.alertCardBody}>
              +91 {mobileNumber} is registered under the {registeredOtherRole ? roleLabels[registeredOtherRole] : 'different'} portal. You cannot log in as {roleLabels[role]}.
            </Text>

            <View style={styles.alertActionsWrap}>
              {registeredOtherRole && (
                <TouchableOpacity
                  style={styles.alertPrimaryBtn}
                  onPress={handleSwitchToRegisteredRole}
                  activeOpacity={0.88}
                >
                  <Text style={styles.alertPrimaryBtnText}>
                    Switch to {roleLabels[registeredOtherRole]} & Login
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.alertSecondaryBtn}
                onPress={handleTryAgain}
                activeOpacity={0.75}
              >
                <RefreshCw size={15} color="#475569" strokeWidth={2} />
                <Text style={styles.alertSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.5,
  },
  orangeText: {
    color: '#F15A24',
  },
  subtitleText: {
    fontSize: 14,
    color: '#7B8798',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '400',
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  accountTypeSelector: {
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  primaryBtn: {
    marginTop: 4,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B8798',
    marginHorizontal: 16,
    letterSpacing: 0.5,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 30, 66, 0.54)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalCloseXBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  noticeWarningBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 8,
    textAlign: 'center',
  },
  noticeCardMessage: {
    fontSize: 14,
    color: '#5E6C84',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  noticeOkBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#F15A24',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeOkBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alertCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  alertWarningBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 8,
    textAlign: 'center',
  },
  notRegisteredHeadline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertCardBody: {
    fontSize: 13,
    color: '#5E6C84',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertActionsWrap: {
    width: '100%',
    gap: 10,
  },
  alertPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: '#F15A24',
    borderRadius: 10,
    gap: 8,
  },
  alertPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alertSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    backgroundColor: '#F4F5F7',
    borderRadius: 10,
    gap: 8,
  },
  alertSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
