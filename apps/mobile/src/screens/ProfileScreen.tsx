import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  User,
  ChevronRight,
  Edit3,
  Bell,
  Settings,
  ShieldCheck,
  FileText,
  Headphones,
  LogOut,
  Building2,
  Truck,
  UserCheck,
  Phone,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { AuthSessionData } from '../services/authService';

interface ProfileScreenProps {
  session: AuthSessionData | null;
  onBack: () => void;
  onNavigateToEditProfile: () => void;
  onNavigateToSavedAddresses?: () => void;
  onNavigateToNotifications: () => void;
  onNavigateToSettings: () => void;
  onNavigateToRegistrationStatus: () => void;
  onNavigateToHelpSupport: () => void;
  onNavigateToTerms: () => void;
  onLogoutConfirm: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  session,
  onBack,
  onNavigateToEditProfile,
  onNavigateToSavedAddresses,
  onNavigateToNotifications,
  onNavigateToSettings,
  onNavigateToRegistrationStatus,
  onNavigateToHelpSupport,
  onNavigateToTerms,
  onLogoutConfirm,
}) => {

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const role = session?.role || 'CLIENT';
  const fullName = session?.fullName || 'NECL User';
  const mobile = session?.mobile ? `+91 ${session.mobile}` : '+91 98765 43210';
  const companyName = session?.companyName || 'North Eastern Freightways';

  const roleLabelMap = {
    CLIENT: 'Client / Shipper',
    VENDOR: 'Vendor / Transporter',
    DRIVER: 'Driver / Pilot',
  };

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NE';

  const handleLogout = () => {
    setShowLogoutModal(false);
    onLogoutConfirm();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <BrandLogoHeader size="sm" theme="light" />
          <View style={{ width: 40 }} />
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>

          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userPhone}>{mobile}</Text>

          <View style={styles.roleBadge}>
            {role === 'CLIENT' ? (
              <Building2 size={13} color="#F05A22" />
            ) : role === 'VENDOR' ? (
              <Truck size={13} color="#F05A22" />
            ) : (
              <UserCheck size={13} color="#F05A22" />
            )}
            <Text style={styles.roleBadgeText}>{roleLabelMap[role]}</Text>
          </View>

          <View style={styles.companyRow}>
            <Text style={styles.companyLabel}>Organization: </Text>
            <Text style={styles.companyValue}>{companyName}</Text>
          </View>
        </View>

        {/* Menu Section 1: Account Management */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>Account & Preferences</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToEditProfile}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFF5ED' }]}>
              <Edit3 size={18} color="#F05A22" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSubtitle}>Update contact and company details</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToNotifications}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Bell size={18} color="#2563EB" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuSubtitle}>View shipment & brokerage alerts</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {onNavigateToSavedAddresses && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={onNavigateToSavedAddresses}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <Building2 size={18} color="#F05A22" />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>Saved Hubs & Addresses</Text>
                <Text style={styles.menuSubtitle}>Manage factory and dispatch locations</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToRegistrationStatus}
            activeOpacity={0.7}
          >

            <View style={[styles.menuIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <ShieldCheck size={18} color="#16A34A" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Registration & KYC Status</Text>
              <Text style={styles.menuSubtitle}>Verification progress and approval stage</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToSettings}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#F8FAFC' }]}>
              <Settings size={18} color="#475569" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Settings</Text>
              <Text style={styles.menuSubtitle}>Security, push preferences, system</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Menu Section 2: Support & Legal */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>Support & Compliance</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToHelpSupport}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <Headphones size={18} color="#D97706" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>24/7 Helpline, FAQs & ticket desk</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToTerms}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#F1F5F9' }]}>
              <FileText size={18} color="#64748B" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Terms & Privacy Policy</Text>
              <Text style={styles.menuSubtitle}>Carriage regulations & data terms</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Logout of Account</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>NECL Logistics App v2.4.0 • Build 2026</Text>
      </ScrollView>

      {/* Screen 18: Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLogoutModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.logoutIconBox}>
              <LogOut size={26} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalDesc}>
              Are you sure you want to log out of your North Eastern Carriers account?
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.confirmLogoutBtnText}>Yes, Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    paddingBottom: 90,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0A1931',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#FFF1E8',
  },
  avatarInitials: {
    color: '#F05A22',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13.5,
    color: '#64748B',
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1E8',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F05A22',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyLabel: {
    fontSize: 12.5,
    color: '#64748B',
  },
  companyValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5EAF0',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172B4D',
  },
  menuSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  logoutIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmLogoutBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmLogoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
