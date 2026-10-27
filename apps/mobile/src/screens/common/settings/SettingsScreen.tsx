import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Truck,
  FileText,
  Fingerprint,
  Lock,
  Headphones,
  ChevronRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { authService } from '../../../services/authService';

interface SettingsScreenProps {
  onBack: () => void;
  onChangePassword?: () => void;
  onNavigateToTerms: () => void;
  onNavigateToSupport: () => void;
  onNavigateToPrivacy?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onChangePassword,
  onNavigateToTerms,
  onNavigateToSupport,
  onNavigateToPrivacy,
}) => {
  const [shipmentUpdates, setShipmentUpdates] = useState(true);
  const [quotesUpdates, setQuotesUpdates] = useState(true);
  const [biometricUnlock, setBiometricUnlock] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await authService.getSettings();
        setShipmentUpdates(s.pushTripUpdates ?? true);
        setQuotesUpdates(s.pushQuotations ?? true);
        setBiometricUnlock(s.biometricLogin ?? false);
      } catch (e) {
        console.warn('Failed to load user settings:', e);
      }
    })();
  }, []);

  const handleToggleShipmentUpdates = async (value: boolean) => {
    setShipmentUpdates(value);
    try {
      const current = await authService.getSettings();
      await authService.saveSettings({ ...current, pushTripUpdates: value });
    } catch {
      setShipmentUpdates(!value);
      Alert.alert('Notice', 'Unable to update shipment notifications preference.');
    }
  };

  const handleToggleQuotesUpdates = async (value: boolean) => {
    setQuotesUpdates(value);
    try {
      const current = await authService.getSettings();
      await authService.saveSettings({ ...current, pushQuotations: value });
    } catch {
      setQuotesUpdates(!value);
      Alert.alert('Notice', 'Unable to update quotation notifications preference.');
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      Alert.alert(
        'Biometric Authentication',
        'Enable fingerprint/face recognition for faster sign-in on this device?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              setBiometricUnlock(true);
              const current = await authService.getSettings();
              await authService.saveSettings({ ...current, biometricLogin: true });
            },
          },
        ]
      );
    } else {
      setBiometricUnlock(false);
      const current = await authService.getSettings();
      await authService.saveSettings({ ...current, biometricLogin: false });
    }
  };

  const handleOpenPrivacy = () => {
    if (onNavigateToPrivacy) {
      onNavigateToPrivacy();
    } else if (onChangePassword) {
      onChangePassword();
    } else {
      Alert.alert(
        'Privacy & Security',
        'Your session is encrypted end-to-end with TLS 1.3. For password resets or security questions, contact IT compliance.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back to Profile"
        >
          <ArrowLeft size={20} color="#0B1730" />
        </TouchableOpacity>

        <BrandLogoHeader size="sm" />

        <View style={{ width: 38 }} />
      </View>

      {/* ── Screen Heading & Subtitle ── */}
      <View style={styles.headingWrap}>
        <Text style={styles.screenHeading}>Settings</Text>
        <Text style={styles.screenSubtitle}>Manage your app preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section A: Notifications ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Text style={styles.sectionSubtitle}>
              Choose what updates you want to receive
            </Text>
          </View>

          <View style={styles.cardContainer}>
            {/* Row 1: Shipment updates */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <Truck size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Shipment updates</Text>
                  <Text style={styles.settingDescription}>
                    Pickup, transit and delivery status
                  </Text>
                </View>
              </View>
              <Switch
                value={shipmentUpdates}
                onValueChange={handleToggleShipmentUpdates}
                trackColor={{ false: '#CBD5E1', true: '#F15A24' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#CBD5E1"
              />
            </View>

            <View style={styles.rowDivider} />

            {/* Row 2: Quotes & booking updates */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <FileText size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Quotes & booking updates</Text>
                  <Text style={styles.settingDescription}>
                    New freight quotes and booking confirmations
                  </Text>
                </View>
              </View>
              <Switch
                value={quotesUpdates}
                onValueChange={handleToggleQuotesUpdates}
                trackColor={{ false: '#CBD5E1', true: '#F15A24' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#CBD5E1"
              />
            </View>
          </View>
        </View>

        {/* ── Section B: Security ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Security</Text>
            <Text style={styles.sectionSubtitle}>Keep your account secure</Text>
          </View>

          <View style={styles.cardContainer}>
            {/* Row 1: Biometric unlock */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <Fingerprint size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Biometric unlock</Text>
                  <Text style={styles.settingDescription}>
                    Quick and secure access to your account
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricUnlock}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#CBD5E1', true: '#F15A24' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#CBD5E1"
              />
            </View>

            <View style={styles.rowDivider} />

            {/* Row 2: Privacy & security */}
            <TouchableOpacity
              style={styles.navRow}
              onPress={handleOpenPrivacy}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <Lock size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Privacy & security</Text>
                  <Text style={styles.settingDescription}>
                    Manage your data and account security
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section C: Support ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.sectionSubtitle}>Get help and learn more</Text>
          </View>

          <View style={styles.cardContainer}>
            {/* Row 1: Help & support */}
            <TouchableOpacity
              style={styles.navRow}
              onPress={onNavigateToSupport}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <Headphones size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Help & support</Text>
                  <Text style={styles.settingDescription}>
                    FAQs, phone support and ticket submission
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* Row 2: Terms & privacy */}
            <TouchableOpacity
              style={styles.navRow}
              onPress={onNavigateToTerms}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeftCol}>
                <View style={styles.iconBoxOrange}>
                  <FileText size={18} color="#F15A24" />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Terms & privacy</Text>
                  <Text style={styles.settingDescription}>
                    Read our terms of service and privacy policy
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0B1730',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
  },

  /* Sections */
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0B1730',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* Card Containers */
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingLeftCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 10,
  },
  iconBoxOrange: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0B1730',
  },
  settingDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 62,
  },
});
