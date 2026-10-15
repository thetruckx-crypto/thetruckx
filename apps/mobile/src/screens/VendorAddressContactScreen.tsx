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
  MapPin,
  Mail,
  Phone,
  Navigation,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';
import { pincodeService } from '../services/pincodeService';

interface VendorAddressContactScreenProps {
  onBack: () => void;
  onNext: (data: {
    registeredAddress: string;
    city: string;
    state: string;
    pincode: string;
    email: string;
    altPhone: string;
  }) => void;
}

export const VendorAddressContactScreen: React.FC<VendorAddressContactScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Assam');
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [altPhone, setAltPhone] = useState('');

  const states = ['Assam', 'West Bengal', 'Meghalaya', 'Tripura', 'Nagaland', 'Delhi', 'Maharashtra', 'Bihar', 'Odisha', 'Uttar Pradesh'];

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.registeredAddress) setRegisteredAddress(draft.registeredAddress);
      if (draft?.city) setCity(draft.city);
      if (draft?.state) setState(draft.state);
      if (draft?.pincode) setPincode(draft.pincode);
      if (draft?.email) setEmail(draft.email);
      if (draft?.altPhone) setAltPhone(draft.altPhone);
    })();
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

  const handleContinue = async () => {
    if (!registeredAddress.trim()) {
      Alert.alert('Required Field', 'Please enter your Registered Office Address.');
      return;
    }
    const pinCheck = pincodeService.validatePincodeFormat(pincode);
    if (!pinCheck.isValid) {
      Alert.alert('Invalid PIN Code', pinCheck.error || 'Please enter a valid 6-digit Pincode.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required Field', 'Please enter City.');
      return;
    }
    if (!state.trim()) {
      Alert.alert('Required Field', 'Please enter State.');
      return;
    }

    await vendorService.saveDraftForm({
      registeredAddress: registeredAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      email: email.trim().toLowerCase(),
    });

    onNext({
      registeredAddress: registeredAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      email: email.trim().toLowerCase(),
      altPhone: altPhone.trim(),
    });
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
            <ScenicHeroBanner height={180} />
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
            </View>
          </View>

          {/* Stepper Progress */}
          <View style={styles.stepperWrap}>
            <View style={styles.stepperHeader}>
              <Text style={styles.stepBadge}>STEP 3 OF 7</Text>
              <Text style={styles.stepTitle}>Address & Contact Details</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '42%' }]} />
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.contentWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Office & <Text style={styles.goldText}>Yard Location</Text>
              </Text>
              <Text style={styles.subText}>
                Provide your primary logistics depot and registered office address for billing and contract notices.
              </Text>
            </View>

            {/* Address Details */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>REGISTERED OFFICE ADDRESS *</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Street Address / Logistics Park *</Text>
                <View style={styles.inputWrap}>
                  <MapPin size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Plot / Road / Industrial Area"
                    placeholderTextColor="#94A3B8"
                    value={registeredAddress}
                    onChangeText={setRegisteredAddress}
                  />
                </View>
              </View>

              <View style={styles.rowTwo}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Pincode *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="6 digits"
                      placeholderTextColor="#94A3B8"
                      value={pincode}
                      onChangeText={handlePincodeChange}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    {pincodeLoading && (
                      <ActivityIndicator size="small" color="#F05A22" style={{ marginRight: 8 }} />
                    )}
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>City *</Text>
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

              {/* State Selection */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State *</Text>
                <View style={[styles.inputWrap, { marginBottom: 8 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Assam"
                    placeholderTextColor="#94A3B8"
                    value={state}
                    onChangeText={setState}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
                  {states.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statePill, state === st && styles.statePillActive]}
                      onPress={() => setState(st)}
                    >
                      <Navigation size={12} color={state === st ? '#FFFFFF' : '#F05A22'} />
                      <Text style={[styles.statePillText, state === st && styles.statePillTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Communication Details */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Mail size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>OFFICIAL COMMUNICATION</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Official Email Address</Text>
                <View style={styles.inputWrap}>
                  <Mail size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="transporter@domain.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Alternate / Yard Phone Number</Text>
                <View style={styles.inputWrap}>
                  <Phone size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Alternate 10-digit number"
                    placeholderTextColor="#94A3B8"
                    value={altPhone}
                    onChangeText={setAltPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Navigation Button */}
            <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.goldBtnText}>Continue to Operating Hubs</Text>
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
    bottom: 6,
    alignSelf: 'center',
  },
  stepperWrap: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepBadge: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F05A22',
  },
  contentWrap: {
    paddingHorizontal: 20,
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
    textAlign: 'center',
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
  card: {
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
    fontSize: 12,
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
    paddingHorizontal: 12,
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
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  stateScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  statePillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  statePillText: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  statePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
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
