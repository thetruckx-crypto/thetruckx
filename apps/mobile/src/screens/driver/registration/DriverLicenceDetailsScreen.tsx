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
} from 'react-native';
import {
  ChevronLeft,
  CreditCard,
  Truck,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Award,
  AlertCircle,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { driverService } from '../../../services/driverService';

interface DriverLicenceDetailsScreenProps {
  onBack: () => void;
  onNext: () => void;
}

export const DriverLicenceDetailsScreen: React.FC<DriverLicenceDetailsScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [licenceNumber, setLicenceNumber] = useState('');
  const [rtoState, setRtoState] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [licenceExpiryDate, setLicenceExpiryDate] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [hasHazmat, setHasHazmat] = useState(false);

  const vehicleOptions = [
    '32 FT Multi-Axle (18-25 MT)',
    '24 FT Container (9-12 MT)',
    '40 FT High Bed Trailer (30-35 MT)',
    '14-19 FT Intermediate Open (4-7 MT)',
  ];

  const rtoStates = [
    'AS - Assam',
    'WB - West Bengal',
    'BR - Bihar',
    'AP - Andhra Pradesh',
    'TS - Telangana',
    'MH - Maharashtra',
    'DL - Delhi NCR',
  ];

  useEffect(() => {
    driverService.getDraftForm().then((draft) => {
      if (draft) {
        if (draft.licenceNumber) setLicenceNumber(draft.licenceNumber);
        if (draft.rtoState) setRtoState(draft.rtoState);
        if (draft.vehicleCategory) setVehicleCategory(draft.vehicleCategory);
        if (draft.licenceExpiryDate) setLicenceExpiryDate(draft.licenceExpiryDate);
        if (draft.badgeNumber) setBadgeNumber(draft.badgeNumber);
      }
    });
  }, []);

  const handleNext = async () => {
    const cleanDl = licenceNumber.trim().toUpperCase();
    if (!cleanDl || cleanDl.length < 8) {
      Alert.alert('Invalid DL Number', 'Please enter a valid commercial Driving Licence number (e.g. AS0120220012345).');
      return;
    }

    if (!licenceExpiryDate.trim()) {
      Alert.alert('Expiry Date Required', 'Please enter DL expiry date.');
      return;
    }

    // Verify expiry date is in future
    const parsedDate = new Date(licenceExpiryDate);
    if (!isNaN(parsedDate.getTime()) && parsedDate < new Date()) {
      Alert.alert('Expired Licence', 'Driving licence validity has expired. TRUCKS can only enroll pilots with active commercial driving licences.');
      return;
    }

    await driverService.saveDraftForm({
      licenceNumber: cleanDl,
      rtoState,
      vehicleCategory,
      licenceExpiryDate: licenceExpiryDate.trim(),
      badgeNumber: badgeNumber.trim(),
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
            
          </View>

          <View style={styles.contentWrap}>
            {/* Step Progress Pill */}
            <View style={styles.stepIndicatorRow}>
              <Text style={styles.stepIndicatorText}>STEP 2 OF 4 • DRIVING LICENCE DETAILS</Text>
            </View>

            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Commercial <Text style={styles.goldText}>Driving Licence</Text>
              </Text>
              <Text style={styles.subText}>
                Verified against MoRTH Sarathi national portal for heavy transport authorizations.
              </Text>
            </View>

            {/* DL Credentials Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <CreditCard size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Driving Licence Credentials</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Driving Licence (DL) Number *</Text>
                <View style={styles.inputWrap}>
                  <CreditCard size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. AS0120220012345"
                    placeholderTextColor="#5C5E66"
                    autoCapitalize="characters"
                    value={licenceNumber}
                    onChangeText={setLicenceNumber}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Issuing RTO State / Authority *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  <View style={styles.rtoRow}>
                    {rtoStates.map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.rtoPill, rtoState === st && styles.rtoPillActive]}
                        onPress={() => setRtoState(st)}
                      >
                        <Text style={[styles.rtoPillText, rtoState === st && styles.rtoPillTextActive]}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Validity Expiry Date *</Text>
                  <View style={styles.inputWrap}>
                    <Calendar size={15} color="#7C7E86" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#5C5E66"
                      value={licenceExpiryDate}
                      onChangeText={setLicenceExpiryDate}
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Commercial Badge No.</Text>
                  <View style={styles.inputWrap}>
                    <Award size={15} color="#7C7E86" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. BDG-9102"
                      placeholderTextColor="#5C5E66"
                      autoCapitalize="characters"
                      value={badgeNumber}
                      onChangeText={setBadgeNumber}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Vehicle Category Operated Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Operated Vehicle Category</Text>
              </View>

              <View style={styles.categoryCol}>
                {vehicleOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.categoryOption,
                      vehicleCategory === opt && styles.categoryOptionActive,
                    ]}
                    onPress={() => setVehicleCategory(opt)}
                  >
                    <View style={styles.catRadio}>
                      {vehicleCategory === opt && <View style={styles.catRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catName, vehicleCategory === opt && styles.catNameActive]}>
                        {opt}
                      </Text>
                    </View>
                    <Truck size={16} color={vehicleCategory === opt ? '#F05A22' : '#7C7E86'} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Hazmat Endorsement Toggle */}
            <View style={styles.hazmatCard}>
              <TouchableOpacity
                style={styles.hazmatRow}
                onPress={() => setHasHazmat(!hasHazmat)}
                activeOpacity={0.8}
              >
                <AlertCircle size={20} color={hasHazmat ? '#F05A22' : '#7C7E86'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.hazmatTitle}>Hazardous Cargo (Hazmat) Endorsement</Text>
                  <Text style={styles.hazmatSub}>
                    Certified for petroleum, chemical, or industrial hazardous cargo transport
                  </Text>
                </View>
                <View style={[styles.hazmatToggle, hasHazmat && styles.hazmatToggleActive]}>
                  <View style={[styles.hazmatKnob, hasHazmat && styles.hazmatKnobActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Next CTA */}
            <TouchableOpacity
              style={styles.goldPillBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.goldPillText}>Save & Proceed to Vehicle Association</Text>
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
  pillScroll: {
    marginTop: 2,
  },
  rtoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rtoPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rtoPillActive: {
    backgroundColor: 'rgba(227, 180, 0, 0.18)',
    borderColor: '#F05A22',
  },
  rtoPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  rtoPillTextActive: {
    color: '#F05A22',
    fontWeight: '700',
  },
  categoryCol: {
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  categoryOptionActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F05A22',
  },
  catRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#7C7E86',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
  },
  catName: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
  },
  catNameActive: {
    color: '#9A3412',
    fontWeight: '700',
  },
  hazmatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  hazmatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hazmatTitle: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '700',
  },
  hazmatSub: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  hazmatToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F2128',
    padding: 2,
    justifyContent: 'center',
  },
  hazmatToggleActive: {
    backgroundColor: '#F05A22',
  },
  hazmatKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7C7E86',
  },
  hazmatKnobActive: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
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
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
