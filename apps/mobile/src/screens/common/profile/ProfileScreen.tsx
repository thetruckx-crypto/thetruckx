import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
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
} from 'lucide-react-native';
import { AuthSessionData, authService } from '../../../services/authService';

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
  const [profileName, setProfileName] = useState(session?.fullName || 'Pavani');
  const [profileOrg, setProfileOrg] = useState(session?.companyName || 'ABC Logistics Pvt Ltd');

  useEffect(() => {
    if (session?.fullName) setProfileName(session.fullName);
    if (session?.companyName) setProfileOrg(session.companyName);

    if (session?.mobile && (!session?.fullName || !session?.companyName)) {
      (async () => {
        try {
          const cleanPhone = session.mobile.replace(/[^0-9]/g, '').slice(-10);
          const registry = await authService.getLocalRegistry();
          const target = registry.find((u) => u.mobile === cleanPhone);
          if (target) {
            if (target.fullName) setProfileName(target.fullName);
            if (target.companyName) setProfileOrg(target.companyName);
          }
        } catch {}
      })();
    }
  }, [session]);

  const role = session?.role || 'CLIENT';
  const fullName = profileName;
  const mobile = session?.mobile ? `+91 ${session.mobile}` : '+91 9876543210';
  const companyName = profileOrg;

  const roleLabelMap = {
    CLIENT: 'Client / Shipper',
    VENDOR: 'Vendor / Transporter',
    DRIVER: 'Driver / Pilot',
  };

  const initials =
    fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 1) || 'P';

  const handleLogout = () => {
    setShowLogoutModal(false);
    onLogoutConfirm();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header with Centered Title Matching Screenshot 2 ── */}
      <View style={styles.topBar}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#101D36" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={styles.topBarTitle}>My Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User Profile Card (Screenshot 2 Match) ── */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={onNavigateToEditProfile}
          activeOpacity={0.88}
        >
          {/* Avatar with Orange Edit Badge */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.avatarEditBadge}>
              <Edit3 size={11} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </View>

          {/* User Details */}
          <View style={styles.userMainCol}>
            <Text style={styles.userName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.userPhone}>{mobile}</Text>

            {/* Role Badge */}
            <View style={styles.roleBadge}>
              <FileText size={12} color="#F05A24" />
              <Text style={styles.roleBadgeText}>{roleLabelMap[role]}</Text>
            </View>

            {/* Organization */}
            <View style={styles.organizationRow}>
              <Building2 size={13} color="#64748B" />
              <Text style={styles.orgLabel}>Organization </Text>
              <Text style={styles.orgValue} numberOfLines={1}>
                {companyName}
              </Text>
            </View>
          </View>

          {/* Right Chevron */}
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* ── Section 1: ACCOUNT & PREFERENCES ── */}
        <Text style={styles.sectionHeader}>ACCOUNT & PREFERENCES</Text>
        <View style={styles.menuCard}>
          {/* 1. Edit Profile */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToEditProfile}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Edit3 size={18} color="#F05A24" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSubtitle}>Update contact and company details</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.itemDivider} />

          {/* 2. Notifications */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToNotifications}
            activeOpacity={0.75}
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

          <View style={styles.itemDivider} />

          {/* 3. Saved Hubs & Addresses */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToSavedAddresses || onNavigateToEditProfile}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Building2 size={18} color="#F05A24" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Saved Hubs & Addresses</Text>
              <Text style={styles.menuSubtitle}>Manage factory and dispatch locations</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.itemDivider} />

          {/* 4. Registration & KYC Status with Verified Badge */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToRegistrationStatus}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <ShieldCheck size={18} color="#10B981" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Registration & KYC Status</Text>
              <Text style={styles.menuSubtitle}>Verification progress and approval stage</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.itemDivider} />

          {/* 5. Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToSettings}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#F1F5F9' }]}>
              <Settings size={18} color="#475569" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Settings</Text>
              <Text style={styles.menuSubtitle}>Security, push preferences, system</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── Section 2: SUPPORT & COMPLIANCE ── */}
        <Text style={styles.sectionHeader}>SUPPORT & COMPLIANCE</Text>
        <View style={styles.menuCard}>
          {/* 1. Help & Support */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToHelpSupport}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Headphones size={18} color="#D97706" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>24/7 Helpline, FAQs & ticket desk</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.itemDivider} />

          {/* 2. Terms & Privacy Policy */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={onNavigateToTerms}
            activeOpacity={0.75}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <FileText size={18} color="#2563EB" />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Terms & Privacy Policy</Text>
              <Text style={styles.menuSubtitle}>Carriage regulations & data terms</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── Logout Button Card (Screenshot 2 Match) ── */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.logoutLeftRow}>
            <LogOut size={18} color="#DC2626" />
            <Text style={styles.logoutCardText}>Logout of Account</Text>
          </View>
          <ChevronRight size={18} color="#DC2626" />
        </TouchableOpacity>

        {/* ── Version Footer ── */}
        <Text style={styles.versionText}>TRUCKS Logistics App v2.4.0 • Build 2026</Text>
      </ScrollView>

      {/* ── Logout Confirmation Modal ── */}
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
              Are you sure you want to log out of your TRUCKS account?
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
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101D36',
    textAlign: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 90,
  },

  /* User Profile Card */
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#F05A24',
    fontSize: 26,
    fontWeight: '800',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F05A24',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMainCol: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101D36',
  },
  userPhone: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F05A24',
  },
  organizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orgLabel: {
    fontSize: 11.5,
    color: '#64748B',
    marginLeft: 4,
  },
  orgValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#101D36',
    flexShrink: 1,
  },

  /* Menu Section & Cards */
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101D36',
  },
  menuSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },

  /* Logout Card */
  logoutCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutCardText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 16,
    marginBottom: 8,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 29, 54, 0.55)',
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
    color: '#101D36',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
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
    fontSize: 13.5,
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
    fontSize: 13.5,
  },
});
