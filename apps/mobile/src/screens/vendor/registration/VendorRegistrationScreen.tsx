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
  Building2,
  Phone,
  FileText,
  CreditCard,
  User,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { RegistrationUpdateHeaderBanner } from '../../../components/RegistrationUpdateHeaderBanner';

interface VendorRegistrationScreenProps {
  initialMobile?: string;
  onBack: () => void;
  onNext: (data: { transporterName: string; contactPerson: string; phone: string; pan: string; gstin: string }) => void;
  onAlreadyRegistered?: () => void;
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const VendorRegistrationScreen: React.FC<VendorRegistrationScreenProps> = ({
  initialMobile = '',
  onBack,
  onNext,
  onAlreadyRegistered,
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  const [transporterName, setTransporterName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState(initialMobile);
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.transporterName) setTransporterName(draft.transporterName);
      if (draft?.contactPerson) setContactPerson(draft.contactPerson);
      if (draft?.phone) setPhone(draft.phone);
      if (draft?.pan) setPan(draft.pan);
      if (draft?.gstin) setGstin(draft.gstin);
    })();
  }, []);

  const handleContinue = async () => {
    if (!transporterName.trim()) {
      Alert.alert('Required Field', 'Please enter your Transport Enterprise / Firm Name.');
      return;
    }
    if (!contactPerson.trim()) {
      Alert.alert('Required Field', 'Please enter the Authorized Contact Person Name.');
      return;
    }
    if (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit Mobile Number.');
      return;
    }

    await vendorService.saveDraftForm({
      transporterName: transporterName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      pan: pan.trim().toUpperCase(),
      gstin: gstin.trim().toUpperCase(),
    });

    onNext({
      transporterName: transporterName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      pan: pan.trim().toUpperCase(),
      gstin: gstin.trim().toUpperCase(),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
          {/* Top Header Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            
            <View style={styles.headerSpacer} />
          </View>

          {/* Registration Update Mode Banner */}
          {isUpdateMode && (
            <RegistrationUpdateHeaderBanner
              isUpdateMode={isUpdateMode}
              onlyIncompleteSteps={onlyIncompleteSteps}
              stepIndex={1}
              totalSteps={7}
              incompleteStepsCount={incompleteStepsCount}
              currentIncompleteStepNumber={currentIncompleteStepNumber}
              missingFields={missingFields}
              onToggleViewAllSteps={onToggleViewAllSteps}
            />
          )}

          {/* Stepper Progress */}
          <View style={styles.stepperWrap}>
            <View style={styles.stepperHeader}>
              <Text style={styles.stepBadge}>STEP 1 OF 7</Text>
              <Text style={styles.stepTitle}>Enterprise Registration</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '14%' }]} />
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.contentWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Transport Partner <Text style={styles.goldText}>Enrollment</Text>
              </Text>
              <Text style={styles.subText}>
                Register your fleet company to receive national freight load contracts across North Eastern corridors.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Building2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>BASIC ENTERPRISE PROFILE</Text>
              </View>

              {/* Firm Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Transport / Firm Name *</Text>
                <View style={styles.inputWrap}>
                  <Building2 size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Guwahati Express Roadways"
                    placeholderTextColor="#94A3B8"
                    value={transporterName}
                    onChangeText={setTransporterName}
                  />
                </View>
              </View>

              {/* Contact Person */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Authorized Person Name *</Text>
                <View style={styles.inputWrap}>
                  <User size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Rajesh Kalita"
                    placeholderTextColor="#94A3B8"
                    value={contactPerson}
                    onChangeText={setContactPerson}
                  />
                </View>
              </View>

              {/* Mobile Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Official Mobile Number *</Text>
                <View style={styles.inputWrap}>
                  <Phone size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Company PAN */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Company / Proprietor PAN</Text>
                <View style={styles.inputWrap}>
                  <CreditCard size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="10-character PAN (e.g. ABCDE1234F)"
                    placeholderTextColor="#94A3B8"
                    value={pan}
                    onChangeText={setPan}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* GSTIN */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>GSTIN (Optional if under threshold)</Text>
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
            </View>

            {/* Compliance Badge */}
            <View style={styles.securityBadge}>
              <ShieldCheck size={16} color="#10B981" />
              <Text style={styles.securityText}>
                Transport Partner Program • 100% Verified Freight Settlement
              </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.goldBtnText}>Continue to Business Details</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            {onAlreadyRegistered && (
              <TouchableOpacity style={styles.linkBtn} onPress={onAlreadyRegistered}>
                <Text style={styles.linkText}>
                  Already registered? <Text style={styles.goldLink}>Check Verification Status</Text>
                </Text>
              </TouchableOpacity>
            )}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 38,
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
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  securityText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '600',
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  linkBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  linkText: {
    color: '#64748B',
    fontSize: 12,
  },
  goldLink: {
    color: '#F05A22',
    fontWeight: '700',
  },
});
