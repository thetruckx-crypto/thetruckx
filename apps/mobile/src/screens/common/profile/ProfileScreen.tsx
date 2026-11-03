import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Image,
  Platform,
  Clipboard,
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
  Copy,
} from 'lucide-react-native';
import { AuthSessionData, authService } from '../../../services/authService';
import { formatDisplayId } from '../../../utils/idGenerator';

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
  const [photoUrl, setPhotoUrl] = useState(session?.profilePhotoUrl || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (idValue: string, label: string) => {
    Clipboard.setString(idValue);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (session?.fullName) setProfileName(session.fullName);
    if (session?.companyName) setProfileOrg(session.companyName);
    if (session?.profilePhotoUrl) setPhotoUrl(session.profilePhotoUrl);

    if (session?.mobile) {
      (async () => {
        try {
          const cleanPhone = session.mobile.replace(/[^0-9]/g, '').slice(-10);
          const registry = await authService.getLocalRegistry();
          const target = registry.find((u) => u.mobile === cleanPhone);
          if (target) {
            if (target.fullName) setProfileName(target.fullName);
            if (target.companyName) setProfileOrg(target.companyName);
            if (target.profilePhotoUrl) setPhotoUrl(target.profilePhotoUrl);
          }
        } catch {}
      })();
    }
  }, [session]);

  const role = session?.role || 'CLIENT';
  const fullName = profileName;
  const mobile = session?.mobile ? `+91 ${session.mobile}` : '+91 9876543210';
  const companyName = profileOrg;

  // Account ID and Role-specific ID in canonical TRUCKX format
  const accountId =
    session?.accountId ||
    formatDisplayId('AC', session?.userId, session?.createdAt);

  const clientId =
    session?.clientCode ||
    session?.clientId ||
    formatDisplayId('CL', session?.userId, session?.createdAt);

  const vendorId =
    session?.vendorCode ||
    session?.vendorId ||
    formatDisplayId('VE', session?.userId, session?.createdAt);

  const driverId =
    session?.driverCode ||
    session?.driverId ||
    formatDisplayId('DR', session?.userId, session?.createdAt);

  const roleLabelMap = {
    CLIENT: 'Client',
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
            <ArrowLeft size={20} color="#0F172A" />
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
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
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
              <FileText size={12} color="#F05A22" />
              <Text style={styles.roleBadgeText}>{roleLabelMap[role] || 'Client'}</Text>
            </View>

            {/* Organization - clean multi-line display supporting long company names */}
            <View style={styles.organizationBlock}>
              <View style={styles.orgHeaderRow}>
                <Building2 size={12} color="#64748B" />
                <Text style={styles.orgLabel}>Organization</Text>
              </View>
              <Text style={styles.orgValue} numberOfLines={2}>
                {companyName}
              </Text>
            </View>
          </View>

          {/* Right Chevron */}
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* ── Permanent TRUCKX Identifiers Card (Copyable) ── */}
        <View style={styles.idCard}>
          <TouchableOpacity
            style={styles.idBadgeCol}
            onPress={() => handleCopy(accountId, 'Account ID')}
            activeOpacity={0.7}
          >
            <View style={styles.idHeaderRow}>
              <Text style={styles.idBadgeLabel}>ACCOUNT ID</Text>
              <Copy size={11} color="#F05A22" />
            </View>
            <Text style={styles.idBadgeValue} numberOfLines={1}>
              {accountId}
            </Text>
            {copiedKey === 'Account ID' && (
              <Text style={styles.copiedFeedback}>✓ Copied to clipboard</Text>
            )}
          </TouchableOpacity>

          <View style={styles.idVerticalDivider} />

          {role === 'CLIENT' && (
            <TouchableOpacity
              style={styles.idBadgeCol}
              onPress={() => handleCopy(clientId, 'Client ID')}
              activeOpacity={0.7}
            >
              <View style={styles.idHeaderRow}>
                <Text style={styles.idBadgeLabel}>CLIENT ID</Text>
                <Copy size={11} color="#F05A22" />
              </View>
              <Text style={styles.idBadgeValue} numberOfLines={1}>
                {clientId}
              </Text>
              {copiedKey === 'Client ID' && (
                <Text style={styles.copiedFeedback}>✓ Copied to clipboard</Text>
              )}
            </TouchableOpacity>
          )}

          {role === 'VENDOR' && (
            <TouchableOpacity
              style={styles.idBadgeCol}
              onPress={() => handleCopy(vendorId, 'Vendor ID')}
              activeOpacity={0.7}
            >
              <View style={styles.idHeaderRow}>
                <Text style={styles.idBadgeLabel}>VENDOR ID</Text>
                <Copy size={11} color="#F05A22" />
              </View>
              <Text style={styles.idBadgeValue} numberOfLines={1}>
                {vendorId}
              </Text>
              {copiedKey === 'Vendor ID' && (
                <Text style={styles.copiedFeedback}>✓ Copied to clipboard</Text>
              )}
            </TouchableOpacity>
          )}

          {role === 'DRIVER' && (
            <TouchableOpacity
              style={styles.idBadgeCol}
              onPress={() => handleCopy(driverId, 'Driver ID')}
              activeOpacity={0.7}
            >
              <View style={styles.idHeaderRow}>
                <Text style={styles.idBadgeLabel}>DRIVER ID</Text>
                <Copy size={11} color="#F05A22" />
              </View>
              <Text style={styles.idBadgeValue} numberOfLines={1}>
                {driverId}
              </Text>
              {copiedKey === 'Driver ID' && (
                <Text style={styles.copiedFeedback}>✓ Copied to clipboard</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

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

          {/* 2. Saved Hubs & Addresses */}
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
        <Text style={styles.versionText}>THE TRUCKX App v1.0 • Build 2026</Text>
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
    color: '#0F172A',
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
    paddingBottom: 130, // Increased padding to prevent bottom navigation bar truncation
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
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  avatarInitials: {
    color: '#F05A22',
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
    backgroundColor: '#F05A22',
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
    color: '#0F172A',
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
    color: '#F05A22',
  },
  organizationBlock: {
    marginTop: 6,
  },
  orgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  organizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orgLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  orgValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
    lineHeight: 16,
  },
  idCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  idBadgeCol: {
    flex: 1,
  },
  idHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  copiedFeedback: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  idVerticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  idBadgeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  idBadgeValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#0F172A',
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
    color: '#0F172A',
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
