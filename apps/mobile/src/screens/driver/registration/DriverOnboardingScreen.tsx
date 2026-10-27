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
  User,
  CreditCard,
  Truck,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { authService } from '../../../services/authService';

interface DriverOnboardingScreenProps {
  initialMobile: string;
  onBack: () => void;
  onCompleted: () => void;
}

export const DriverOnboardingScreen: React.FC<DriverOnboardingScreenProps> = ({
  initialMobile,
  onBack,
  onCompleted,
}) => {
  const [driverName, setDriverName] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [truckType, setTruckType] = useState('32 FT Multi-Axle (18 MT)');
  const [loading, setLoading] = useState(false);

  const truckOptions = [
    '32 FT Multi-Axle (18 MT)',
    '24 FT Container (9 MT)',
    '40 FT Trailer (30 MT)',
    '14 FT Open (4 MT)',
  ];

  const handleSubmit = async () => {
    if (!driverName.trim() || !licenceNumber.trim()) {
      Alert.alert('Required Fields', 'Please fill driver Full Name and Driving Licence (DL) number.');
      return;
    }

    setLoading(true);
    try {
      await authService.saveDriverProfile({
        fullName: driverName.trim(),
        licenceNumber: licenceNumber.trim().toUpperCase(),
        mobileNumber: initialMobile,
        truckType,
      });

      Alert.alert(
        'Pilot Profile Enrolled',
        'Your commercial driver credentials have been submitted. TRUCKS operations desk will verify your Sarathi Vahan records for instant trip dispatch.',
        [{ text: 'OK', onPress: onCompleted }]
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
          {/* Top Header Bar without Hero Image */}
          <View style={styles.headerBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back" activeOpacity={0.8}>
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <BrandLogoHeader theme="light" size="sm" />
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Driver <Text style={styles.goldText}>Trip Enrollment</Text>
              </Text>
              <Text style={styles.subText}>
                Join TRUCKS verified pilot network & get steady pan-India loads with FASTag fuel advances
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <User size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Commercial Driving Credentials</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name as per DL *</Text>
                <View style={styles.inputWrap}>
                  <User size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Ramesh Singh"
                    placeholderTextColor="#5C5E66"
                    value={driverName}
                    onChangeText={setDriverName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Commercial Driving Licence (DL) *</Text>
                <View style={styles.inputWrap}>
                  <CreditCard size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. AS0120190012345"
                    placeholderTextColor="#5C5E66"
                    autoCapitalize="characters"
                    value={licenceNumber}
                    onChangeText={setLicenceNumber}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vehicle Category Operated</Text>
                <View style={styles.truckPillRow}>
                  {truckOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.truckPill,
                        truckType === opt && styles.truckPillActive,
                      ]}
                      onPress={() => setTruckType(opt)}
                    >
                      <Truck
                        size={12}
                        color={truckType === opt ? '#FFFFFF' : '#F05A22'}
                      />
                      <Text
                        style={[
                          styles.truckPillText,
                          truckType === opt && styles.truckPillTextActive,
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
              <ShieldCheck size={16} color="#F05A22" />
              <Text style={styles.complianceText}>
                Driver licence validity and Sarathi Vahan records are audited before GPS dispatch authorization.
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
                  <Text style={styles.goldPillText}>Submit Driver Profile</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  truckPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  truckPill: {
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
  truckPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  truckPillText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '700',
  },
  truckPillTextActive: {
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
