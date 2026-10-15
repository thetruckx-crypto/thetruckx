import React, { useState, useEffect } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  User,
  MapPin,
  Phone,
  Calendar,
  Heart,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { driverService } from '../services/driverService';
import { pincodeService } from '../services/pincodeService';

interface DriverPersonalInfoScreenProps {
  initialMobile: string;
  onBack: () => void;
  onNext: () => void;
}

export const DriverPersonalInfoScreen: React.FC<DriverPersonalInfoScreenProps> = ({
  initialMobile,
  onBack,
  onNext,
}) => {
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Assam');
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  useEffect(() => {
    driverService.getDraftForm().then((draft) => {
      if (draft) {
        if (draft.fullName) setFullName(draft.fullName);
        if (draft.fatherName) setFatherName(draft.fatherName);
        if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
        if (draft.bloodGroup) setBloodGroup(draft.bloodGroup);
        if (draft.address) setAddress(draft.address);
        if (draft.city) setCity(draft.city);
        if (draft.state) setState(draft.state);
        if (draft.pincode) setPincode(draft.pincode);
        if (draft.emergencyContactName) setEmergencyContactName(draft.emergencyContactName);
        if (draft.emergencyContactPhone) setEmergencyContactPhone(draft.emergencyContactPhone);
      }
    });
  }, []);

  const handlePincodeChange = async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);

    if (clean.length === 6) {
      setPincodeLoading(true);
      setPinFeedback(null);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setCity(res.data.city);
          setState(res.data.state);
          setPinFeedback(`✓ ${res.data.city}, ${res.data.state}`);
        } else {
          setPinFeedback('PIN lookup: Please confirm City & State manually.');
        }
      } catch {
        setPinFeedback('Please enter City & State manually.');
      } finally {
        setPincodeLoading(false);
      }
    } else {
      setPinFeedback(null);
    }
  };

  const handleNext = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name as printed on your Driving Licence.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please provide complete residential street address.');
      return;
    }
    const pinCheck = pincodeService.validatePincodeFormat(pincode);
    if (!pinCheck.isValid) {
      Alert.alert('Invalid Pincode', pinCheck.error || 'Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required Field', 'Please enter City / Town.');
      return;
    }
    if (!state.trim()) {
      Alert.alert('Required Field', 'Please enter State.');
      return;
    }
    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      Alert.alert('Emergency Contact', 'Emergency contact name and phone number are required for road safety compliance.');
      return;
    }

    await driverService.saveDraftForm({
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      phone: initialMobile,
      dateOfBirth: dateOfBirth.trim(),
      bloodGroup,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      emergencyContactName: emergencyContactName.trim(),
      emergencyContactPhone: emergencyContactPhone.trim(),
    });

    onNext();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
          {/* Top Banner */}
          <View style={styles.topWrap}>
            <ScenicHeroBanner height={170} />
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <BrandLogoHeader theme="light" size="sm" />
            </View>
          </View>

          <View style={styles.contentWrap}>
            {/* Step Progress Pill */}
            <View style={styles.stepIndicatorRow}>
              <Text style={styles.stepIndicatorText}>STEP 1 OF 4 • PERSONAL INFORMATION</Text>
            </View>

            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Pilot <Text style={styles.goldText}>Identity & Address</Text>
              </Text>
              <Text style={styles.subText}>
                Official personal details for insurance coverage and regional RTO validation.
              </Text>
            </View>

            {/* Basic Info Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <User size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Personal Profile</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name (as per DL) *</Text>
                <View style={styles.inputWrap}>
                  <User size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor="#5C5E66"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Father's / Guardian Name</Text>
                <View style={styles.inputWrap}>
                  <User size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Suresh Kumar"
                    placeholderTextColor="#5C5E66"
                    value={fatherName}
                    onChangeText={setFatherName}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <View style={styles.inputWrap}>
                    <Calendar size={15} color="#7C7E86" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor="#5C5E66"
                      value={dateOfBirth}
                      onChangeText={setDateOfBirth}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Blood Group</Text>
                  <View style={styles.bloodPillRow}>
                    {bloodGroupOptions.slice(0, 4).map((bg) => (
                      <TouchableOpacity
                        key={bg}
                        style={[styles.bloodPill, bloodGroup === bg && styles.bloodPillActive]}
                        onPress={() => setBloodGroup(bg)}
                      >
                        <Text style={[styles.bloodPillText, bloodGroup === bg && styles.bloodPillTextActive]}>
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* Address Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Residential Address</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Street Address / House No. *</Text>
                <View style={styles.inputWrap}>
                  <MapPin size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. House 42, G.S. Road, Dispur"
                    placeholderTextColor="#5C5E66"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Pincode *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="6 digits"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={pincode}
                      onChangeText={handlePincodeChange}
                    />
                    {pincodeLoading && (
                      <ActivityIndicator size="small" color="#F05A22" style={{ marginRight: 8 }} />
                    )}
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>City / Town *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Guwahati"
                      placeholderTextColor="#94A3B8"
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                </View>
              </View>

              {pinFeedback && (
                <Text style={styles.pinFeedbackText}>{pinFeedback}</Text>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State *</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Assam"
                    placeholderTextColor="#94A3B8"
                    value={state}
                    onChangeText={setState}
                  />
                </View>
              </View>
            </View>

            {/* Emergency Contact Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <ShieldAlert size={16} color="#EF4444" />
                <Text style={[styles.cardHeaderText, { color: '#FCA5A5' }]}>Highway Emergency Contact *</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Contact Person Name *</Text>
                <View style={styles.inputWrap}>
                  <User size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Family member / Spouse name"
                    placeholderTextColor="#5C5E66"
                    value={emergencyContactName}
                    onChangeText={setEmergencyContactName}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Emergency Phone Number *</Text>
                <View style={styles.inputWrap}>
                  <Phone size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#5C5E66"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={emergencyContactPhone}
                    onChangeText={setEmergencyContactPhone}
                  />
                </View>
              </View>
            </View>

            {/* Next CTA */}
            <TouchableOpacity
              style={styles.goldPillBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.goldPillText}>Save & Proceed to DL Details</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
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
  stepIndicatorRow: {
    alignSelf: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  stepIndicatorText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
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
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 13.5,
  },
  bloodPillRow: {
    flexDirection: 'row',
    gap: 6,
    height: 46,
    alignItems: 'center',
  },
  bloodPill: {
    flex: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  bloodPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  bloodPillTextActive: {
    color: '#FFFFFF',
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
    marginTop: 6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pinFeedbackText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
});
