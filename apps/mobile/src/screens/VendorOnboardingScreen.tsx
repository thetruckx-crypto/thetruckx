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
  ChevronLeft,
  Building2,
  FileText,
  CreditCard,
  Truck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { authService } from '../services/authService';

interface VendorOnboardingScreenProps {
  initialMobile: string;
  onBack: () => void;
  onCompleted: () => void;
}

export const VendorOnboardingScreen: React.FC<VendorOnboardingScreenProps> = ({
  initialMobile,
  onBack,
  onCompleted,
}) => {
  const [transporterName, setTransporterName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [fleetSize, setFleetSize] = useState('1 - 5 Trucks');
  const [loading, setLoading] = useState(false);

  const fleetOptions = ['1 - 5 Trucks', '6 - 20 Trucks', '21 - 50 Trucks', '50+ Trucks'];

  const handleSubmit = async () => {
    if (!transporterName.trim()) {
      Alert.alert('Required Field', 'Please enter your Transport Enterprise / Firm Name.');
      return;
    }

    setLoading(true);
    try {
      await authService.saveVendorProfile({
        transporterName: transporterName.trim(),
        gstin: gstin.trim().toUpperCase() || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        fleetSize,
        mobileNumber: initialMobile,
      });

      Alert.alert(
        'Vendor Registration Submitted',
        'Your fleet credentials have been submitted for verification. NECL operations team will review your fleet profile.',
        [{ text: 'Continue', onPress: onCompleted }]
      );
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Submission error. Please try again.');
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
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
          {/* Top Banner */}
          <View style={styles.topWrap}>
            <ScenicHeroBanner height={190} />
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <BrandLogoHeader theme="light" showSubtitle={false} />
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.contentWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Fleet Partner <Text style={styles.goldText}>Enrollment</Text>
              </Text>
              <Text style={styles.subText}>
                Join NECL Logistics as an authorized transport contractor and access steady national freight loads
              </Text>
            </View>

            {/* Business Details Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Building2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>ENTERPRISE DETAILS</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Transport / Firm Name *</Text>
                <View style={styles.inputWrap}>
                  <Building2 size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Guwahati Express Roadlines"
                    placeholderTextColor="#94A3B8"
                    value={transporterName}
                    onChangeText={setTransporterName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>GSTIN (Optional)</Text>
                <View style={styles.inputWrap}>
                  <FileText size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="15-digit GSTIN (e.g. 18AAACH7409R1ZZ)"
                    placeholderTextColor="#94A3B8"
                    value={gstin}
                    onChangeText={setGstin}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PAN Number (Optional)</Text>
                <View style={styles.inputWrap}>
                  <CreditCard size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit PAN (e.g. ABCDE1234F)"
                    placeholderTextColor="#94A3B8"
                    value={pan}
                    onChangeText={setPan}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Fleet Size Selection */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>FLEET STRENGTH</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Active Commercial Vehicles</Text>
                <View style={styles.fleetPillRow}>
                  {fleetOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.fleetPill,
                        fleetSize === opt && styles.fleetPillActive,
                      ]}
                      onPress={() => setFleetSize(opt)}
                    >
                      <Truck
                        size={12}
                        color={fleetSize === opt ? '#FFFFFF' : '#F05A22'}
                      />
                      <Text
                        style={[
                          styles.fleetPillText,
                          fleetSize === opt && styles.fleetPillTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Compliance alert */}
            <View style={styles.complianceNote}>
              <ShieldAlert size={16} color="#F05A22" />
              <Text style={styles.complianceText}>
                All transport vendors require verification of RC, Insurance, and National Permit by NECL compliance team prior to load dispatch.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.goldPillBtn, loading && styles.goldPillBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Submit for Verification</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomGoldWings />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#172B4D',
    fontSize: 14,
  },
  fleetPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fleetPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  fleetPillText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '700',
  },
  fleetPillTextActive: {
    color: '#FFFFFF',
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  complianceText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goldPillBtnDisabled: {
    opacity: 0.5,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
