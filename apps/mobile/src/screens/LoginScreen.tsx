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
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  Phone,
  User,
  ArrowRight,
  Check,
  Building2,
  Truck,
  UserCheck,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  UserPlus,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { AuthBottomDecoration } from '../components/AuthBottomDecoration';
import { authService, AuthSessionData } from '../services/authService';
import { MobileRole } from '../types';

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
  onLoginSuccess,
  onRoleChanged,
  onRegisterPress,
  onNavigateToRegistration,
}) => {
  const [mobileNumber, setMobileNumber] = useState(initialMobile || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [role, setRole] = useState<MobileRole>(selectedRole);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [showWrongRoleModal, setShowWrongRoleModal] = useState(false);
  const [registeredOtherRole, setRegisteredOtherRole] = useState<MobileRole | null>(null);
  const [loading, setLoading] = useState(false);

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
    CLIENT: 'Client / Shipper',
    VENDOR: 'Vendor / Transporter',
    DRIVER: 'Driver',
  };

  const handleSelectRole = (newRole: MobileRole) => {
    setRole(newRole);
    onRoleChanged(newRole);
    setShowRoleModal(false);
  };

  const handleRegisterNow = () => {
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

  const handleLogin = async () => {
    const cleanPhone = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      showNotice(
        'Invalid Mobile Number',
        'Please enter a valid 10-digit Indian mobile number to log in.'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Block Login for Unregistered Users: Validate mobile & role against database
      const checkRes = await authService.checkMobileRegistration(cleanPhone, role);

      // Check if registered under a different role
      if (checkRes.isRegisteredOtherRole && checkRes.status !== 'DEACTIVATED') {
        setRegisteredOtherRole(checkRes.otherRole || 'CLIENT');
        setShowWrongRoleModal(true);
        setLoading(false);
        return;
      }

      // Check if not registered under this role
      if (!checkRes.isRegistered || checkRes.status === 'DEACTIVATED' || checkRes.status === 'NOT_REGISTERED') {
        setShowNotRegisteredModal(true);
        setLoading(false);
        return;
      }

      // 2. User is verified as registered! Dispatch OTP for login
      const res = await authService.sendOtp(cleanPhone, 'LOGIN', role);
      onContinueToOtp(cleanPhone, 'LOGIN', res.testCode);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('NOT_REGISTERED')) {
        setShowNotRegisteredModal(true);
      } else if (msg.includes('WRONG_ROLE')) {
        setShowWrongRoleModal(true);
      } else {
        showNotice('Notice', msg || 'Unable to send OTP. Please try again.');
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
              Welcome <Text style={styles.orangeText}>Back</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Login to continue to your account
            </Text>
          </View>

          {/* Role Selector Pill Matching Reference Image 3 */}
          <TouchableOpacity
            style={styles.rolePill}
            onPress={() => setShowRoleModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.roleAvatar}>
              <User size={16} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <Text style={styles.roleNameText}>{roleLabels[role]}</Text>
            <View style={styles.changeRoleWrap}>
              <Text style={styles.changeRoleText}>Change Role</Text>
              <ChevronDown size={14} color="#F05A22" />
            </View>
          </TouchableOpacity>

          {/* Input: 10-Digit Mobile Number */}
          <View style={styles.inputContainer}>
            <Phone size={18} color="#94A3B8" style={styles.inputLeadingIcon} />
            <Text style={styles.prefixText}>+91 </Text>
            <TextInput
              style={styles.textInput}
              placeholder="10-digit Mobile Number"
              placeholderTextColor="#94A3B8"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Options: Remember Me */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />
          </View>

          {/* Primary Action Button: Login with OTP */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Send OTP & Login</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {/* Don't have an account? Register link */}
          {onRegisterPress && (
            <TouchableOpacity
              style={styles.registerRow}
              onPress={onRegisterPress}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Bottom Scenic Truck & Wave Decoration */}
          <AuthBottomDecoration height={180} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Role Selection Modal */}
      <Modal
        visible={showRoleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRoleModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Account Role</Text>
            <Text style={styles.modalSubtitle}>Choose your account type to access appropriate portal</Text>

            <TouchableOpacity
              style={[styles.roleOption, role === 'CLIENT' && styles.roleOptionActive]}
              onPress={() => handleSelectRole('CLIENT')}
            >
              <View style={[styles.roleOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Building2 size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleOptionTitle}>Client / Shipper</Text>
                <Text style={styles.roleOptionDesc}>Book loads, track shipments, manage invoices</Text>
              </View>
              {role === 'CLIENT' && <Check size={18} color="#F05A22" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === 'VENDOR' && styles.roleOptionActive]}
              onPress={() => handleSelectRole('VENDOR')}
            >
              <View style={[styles.roleOptionIcon, { backgroundColor: '#FFF5ED' }]}>
                <Truck size={20} color="#F05A22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleOptionTitle}>Vendor / Fleet Owner</Text>
                <Text style={styles.roleOptionDesc}>Attach vehicles, submit quotes, manage drivers</Text>
              </View>
              {role === 'VENDOR' && <Check size={18} color="#F05A22" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === 'DRIVER' && styles.roleOptionActive]}
              onPress={() => handleSelectRole('DRIVER')}
            >
              <View style={[styles.roleOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                <UserCheck size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleOptionTitle}>Driver / Pilot</Text>
                <Text style={styles.roleOptionDesc}>View assigned trips, upload POD, navigation</Text>
              </View>
              {role === 'DRIVER' && <Check size={18} color="#F05A22" />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Improved Notice Popup: Clean rounded design, orange warning icon, balanced spacing, subtle shadow, prominent orange OK button */}
      <Modal
        visible={noticeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseNotice}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.noticeCard}>
            {/* Orange Warning Icon Badge */}
            <View style={styles.noticeWarningBadge}>
              <AlertTriangle size={34} color="#F05A22" strokeWidth={2.4} />
            </View>

            {/* Clear Title & Friendly Message */}
            <Text style={styles.noticeCardTitle}>{noticeModal.title || 'Notice'}</Text>
            <Text style={styles.noticeCardMessage}>{noticeModal.message}</Text>

            {/* Prominent Orange OK Button Matching Brand */}
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

      {/* Registration Notification Modal: Block Unregistered Users */}
      <Modal
        visible={showNotRegisteredModal}
        transparent
        animationType="fade"
        onRequestClose={handleTryAgain}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertWarningBadge}>
              <AlertTriangle size={34} color="#F05A22" strokeWidth={2.4} />
            </View>

            <Text style={styles.alertCardTitle}>Registration Required</Text>
            
            <Text style={styles.notRegisteredHeadline}>
              You are not registered yet. Please register before logging in.
            </Text>

            <Text style={styles.alertCardBody}>
              No registered {roleLabels[role]} account was found for +91 {mobileNumber}. Please complete your registration to access the {roleLabels[role]} portal.
            </Text>

            {/* Required Action Buttons: Register Now & Try Again */}
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
                <Text style={styles.alertSecondaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Mismatch Notification Modal: Role-Based Authentication */}
      <Modal
        visible={showWrongRoleModal}
        transparent
        animationType="fade"
        onRequestClose={handleTryAgain}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertWarningBadge}>
              <AlertTriangle size={34} color="#F05A22" strokeWidth={2.4} />
            </View>

            <Text style={styles.alertCardTitle}>Incorrect Role Selected</Text>

            <Text style={styles.alertCardBodyBold}>
              This mobile number (+91 {mobileNumber}) is registered under the {roleLabels[registeredOtherRole || 'CLIENT']} role.
            </Text>

            <Text style={styles.alertCardBody}>
              Please select the correct role ({roleLabels[registeredOtherRole || 'CLIENT']}) to log in, or complete the registration process for {roleLabels[role]}.
            </Text>

            <View style={styles.alertActionsWrap}>
              {registeredOtherRole && (
                <TouchableOpacity
                  style={styles.alertPrimaryBtn}
                  onPress={handleSwitchToRegisteredRole}
                  activeOpacity={0.88}
                >
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.alertPrimaryBtnText}>
                    Switch to {roleLabels[registeredOtherRole]} & Login
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.alertOutlineBtn}
                onPress={handleRegisterNow}
                activeOpacity={0.88}
              >
                <UserPlus size={16} color="#C2410C" strokeWidth={2} />
                <Text style={styles.alertOutlineBtnText}>
                  Register as {roleLabels[role]}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alertSecondaryBtn}
                onPress={handleTryAgain}
                activeOpacity={0.75}
              >
                <Text style={styles.alertSecondaryBtnText}>Try Again</Text>
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
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFF1E8',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FFE2D1',
    marginBottom: 22,
    gap: 10,
  },
  roleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172B4D',
  },
  changeRoleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeRoleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 14,
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
    marginRight: 4,
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginTop: 2,
    marginBottom: 22,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  rememberText: {
    fontSize: 13,
    color: '#172B4D',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#F05A22',
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    height: 50,
    borderRadius: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    marginBottom: 10,
    gap: 12,
  },
  roleOptionActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF8F4',
  },
  roleOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  roleOptionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 12,
  },
  registerText: {
    fontSize: 13.5,
    color: '#64748B',
  },
  registerLink: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  // Dialog & Notice Card Styles
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 49, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // Notice Popup Card
  noticeCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  noticeWarningBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  noticeCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1931',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  noticeCardMessage: {
    fontSize: 14.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  noticeOkBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#F05A22',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  noticeOkBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Alert Card
  alertCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  alertWarningBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  alertCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1931',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  notRegisteredHeadline: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#C2410C',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 21,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  alertCardBodyBold: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 21,
  },
  alertCardBody: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  alertActionsWrap: {
    width: '100%',
    gap: 10,
  },
  alertPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  alertPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  alertOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    height: 48,
    borderRadius: 24,
    gap: 8,
  },
  alertOutlineBtnText: {
    color: '#C2410C',
    fontSize: 14.5,
    fontWeight: '700',
  },
  alertSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 46,
    borderRadius: 23,
    gap: 6,
  },
  alertSecondaryBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
