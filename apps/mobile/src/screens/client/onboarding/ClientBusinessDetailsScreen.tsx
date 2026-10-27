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
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  MapPin,
  Check,
  ShieldAlert,
} from 'lucide-react-native';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { ClientBusinessDetails } from '../../../services/clientService';
import { pincodeService } from '../../../services/pincodeService';

interface ClientBusinessDetailsScreenProps {
  initialCompanyName?: string;
  initialDetails?: ClientBusinessDetails;
  onBack: () => void;
  onContinue: (details: ClientBusinessDetails) => void;
}

const BUSINESS_ENTITY_TYPES = [
  'Private Limited',
  'Public Limited',
  'Partnership',
  'Sole Proprietorship',
  'LLP',
  'MSME / PSU',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const ClientBusinessDetailsScreen: React.FC<ClientBusinessDetailsScreenProps> = ({
  initialCompanyName = '',
  initialDetails,
  onBack,
  onContinue,
}) => {
  const [companyName, setCompanyName] = useState(
    initialDetails?.companyName || initialCompanyName || ''
  );
  const [businessType, setBusinessType] = useState<string>(
    initialDetails?.businessType || ''
  );
  const [gstin, setGstin] = useState(initialDetails?.gstin || '');
  const [pan, setPan] = useState(initialDetails?.pan || '');
  const [registeredAddress, setRegisteredAddress] = useState(
    initialDetails?.registeredAddress || ''
  );
  const [pincode, setPincode] = useState(initialDetails?.pincode || '');
  const [city, setCity] = useState(initialDetails?.city || '');
  const [state, setState] = useState(initialDetails?.state || '');

  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  // Field validation errors
  const [companyNameError, setCompanyNameError] = useState<string | null>(null);
  const [gstinError, setGstinError] = useState<string | null>(null);
  const [panError, setPanError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  const handleGstinChange = (text: string) => {
    const upper = text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
    setGstin(upper);
    if (gstinError) setGstinError(null);

    // Auto-derive PAN from chars 3..12 if valid length
    if (upper.length >= 10) {
      const derivedPan = upper.slice(2, 12);
      if (PAN_REGEX.test(derivedPan) && (!pan || pan.length < 10)) {
        setPan(derivedPan);
        if (panError) setPanError(null);
      }
    }
  };

  const handlePanChange = (text: string) => {
    const upper = text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
    setPan(upper);
    if (panError) setPanError(null);
  };

  const handlePincodeChange = async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (pincodeError) setPincodeError(null);

    if (clean.length === 6) {
      setPincodeLoading(true);
      setPinFeedback(null);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setCity(res.data.city);
          setState(res.data.state);
          if (cityError) setCityError(null);
          if (stateError) setStateError(null);
          setPinFeedback(`✓ ${res.data.city}, ${res.data.state} (editable if inaccurate)`);
        } else {
          setPinFeedback('PIN verified. Please enter or confirm City & State manually.');
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

  const handleNext = () => {
    let isValid = true;

    if (!companyName.trim() || companyName.trim().length < 2) {
      setCompanyNameError('Please enter Registered Company Name');
      isValid = false;
    } else {
      setCompanyNameError(null);
    }

    if (!businessType) {
      Alert.alert('Required Selection', 'Please select your Business Entity Type.');
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (!cleanGstin || !GSTIN_REGEX.test(cleanGstin)) {
      setGstinError('Please enter a valid 15-digit GSTIN (e.g. 18AABCA1234A1Z5)');
      isValid = false;
    } else {
      setGstinError(null);
    }

    const cleanPan = pan.trim().toUpperCase();
    if (!cleanPan || !PAN_REGEX.test(cleanPan)) {
      setPanError('Please enter a valid 10-digit Company PAN (e.g. AABCA1234A)');
      isValid = false;
    } else {
      setPanError(null);
    }

    if (!registeredAddress.trim() || registeredAddress.trim().length < 5) {
      setAddressError('Please enter Registered Office Address');
      isValid = false;
    } else {
      setAddressError(null);
    }

    const pinCheck = pincodeService.validatePincodeFormat(pincode);
    if (!pinCheck.isValid) {
      setPincodeError(pinCheck.error || 'Please enter a valid 6-digit PIN code');
      isValid = false;
    } else {
      setPincodeError(null);
    }

    if (!city.trim() || city.trim().length < 2) {
      setCityError('Please enter City / District');
      isValid = false;
    } else {
      setCityError(null);
    }

    if (!state.trim() || state.trim().length < 2) {
      setStateError('Please enter State');
      isValid = false;
    } else {
      setStateError(null);
    }

    if (!isValid) {
      Alert.alert('Validation Notice', 'Please correct the highlighted errors before continuing.');
      return;
    }

    onContinue({
      companyName: companyName.trim(),
      businessType,
      gstin: cleanGstin,
      pan: cleanPan,
      registeredAddress: registeredAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Top Bar with Back Arrow */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ArrowLeft size={22} color="#172B4D" />
            </TouchableOpacity>
          </View>

          {/* Logo Center */}
          

          {/* Step Indicator */}
          <View style={styles.stepIndicatorRow}>
            <View style={[styles.stepDot, styles.stepDotDone]}><Check size={10} color="#FFFFFF" /></View>
            <View style={[styles.stepLine, styles.stepLineDone]} />
            <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotText}>2</Text></View>
            <View style={styles.stepLine} />
            <View style={styles.stepDot}><Text style={styles.stepDotTextInactive}>3</Text></View>
            <View style={styles.stepLine} />
            <View style={styles.stepDot}><Text style={styles.stepDotTextInactive}>4</Text></View>
          </View>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Business <Text style={styles.orangeText}>Details</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Commercial GST and registered corporate entity information
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Registered Company Name */}
            <Text style={styles.fieldLabel}>Registered Company Name *</Text>
            <View style={[styles.inputContainer, companyNameError ? styles.inputError : null]}>
              <Building2 size={18} color={companyNameError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={companyName}
                onChangeText={(text) => {
                  setCompanyName(text);
                  if (companyNameError) setCompanyNameError(null);
                }}
                placeholder="Enterprise Legal Name (e.g. Brahmaputra Tea Ltd.)"
                placeholderTextColor="#94A3B8"
              />
            </View>
            {companyNameError ? <Text style={styles.errorText}>{companyNameError}</Text> : null}

            {/* Business Entity Type */}
            <Text style={styles.fieldLabel}>Business Entity Type *</Text>
            <View style={styles.typeSelectorRow}>
              {BUSINESS_ENTITY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, businessType === t && styles.typePillActive]}
                  onPress={() => setBusinessType(t)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.typePillText, businessType === t && styles.typePillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* GSTIN & PAN */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>GSTIN *</Text>
                <View style={[styles.inputContainer, gstinError ? styles.inputError : null]}>
                  <FileText size={16} color={gstinError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={gstin}
                    onChangeText={handleGstinChange}
                    placeholder="15-digit GSTIN"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </View>
                {gstinError ? <Text style={styles.errorText}>{gstinError}</Text> : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Company PAN *</Text>
                <View style={[styles.inputContainer, panError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.textInput}
                    value={pan}
                    onChangeText={handlePanChange}
                    placeholder="10-digit PAN"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
                {panError ? <Text style={styles.errorText}>{panError}</Text> : null}
              </View>
            </View>

            {/* Registered Commercial Address */}
            <Text style={styles.fieldLabel}>Registered Office Address *</Text>
            <View style={[styles.inputContainer, addressError ? styles.inputError : null]}>
              <MapPin size={18} color={addressError ? '#DC2626' : '#94A3B8'} style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={registeredAddress}
                onChangeText={(text) => {
                  setRegisteredAddress(text);
                  if (addressError) setAddressError(null);
                }}
                placeholder="Door, Building, Street, Industrial Area"
                placeholderTextColor="#94A3B8"
              />
            </View>
            {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

            {/* Pincode & City */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>PIN Code *</Text>
                <View style={[styles.inputContainer, pincodeError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.textInput}
                    value={pincode}
                    onChangeText={handlePincodeChange}
                    placeholder="6-digit PIN"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  {pincodeLoading && (
                    <ActivityIndicator size="small" color="#F05A22" style={{ marginLeft: 6 }} />
                  )}
                </View>
                {pincodeError ? <Text style={styles.errorText}>{pincodeError}</Text> : null}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>City / District *</Text>
                <View style={[styles.inputContainer, cityError ? styles.inputError : null]}>
                  <TextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={(text) => {
                      setCity(text);
                      if (cityError) setCityError(null);
                    }}
                    placeholder="e.g. Guwahati"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {cityError ? <Text style={styles.errorText}>{cityError}</Text> : null}
              </View>
            </View>

            {pinFeedback && (
              <Text style={styles.pincodeHelperText}>{pinFeedback}</Text>
            )}

            {/* State */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>State *</Text>
              <View style={[styles.inputContainer, stateError ? styles.inputError : null]}>
                <TextInput
                  style={styles.textInput}
                  value={state}
                  onChangeText={(text) => {
                    setState(text);
                    if (stateError) setStateError(null);
                  }}
                  placeholder="e.g. Assam"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              {stateError ? <Text style={styles.errorText}>{stateError}</Text> : null}
            </View>

            {/* Compliance Disclaimer */}
            <View style={styles.disclaimerBox}>
              <ShieldAlert size={14} color="#64748B" />
              <Text style={styles.disclaimerText}>
                Note: Valid format entry does not constitute official approval. All business credentials will be verified by TRUCKS Compliance Officers.
              </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity style={styles.continueBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.continueBtnText}>Continue to Document Upload</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 20 }} />
          <AuthBottomDecoration height={140} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: '#16A34A',
  },
  stepDotActive: {
    backgroundColor: '#F05A22',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepDotTextInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: '#16A34A',
  },
  headingWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
  },
  leadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#172B4D',
    height: '100%',
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pincodeHelperText: {
    fontSize: 11.5,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  continueBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

