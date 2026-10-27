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
  Building,
  Calendar,
  FileBadge,
  ArrowRight,
  CheckCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { RegistrationUpdateHeaderBanner } from '../../../components/RegistrationUpdateHeaderBanner';

interface VendorBusinessInfoScreenProps {
  onBack: () => void;
  onNext: (data: { businessType: string; yearEstablished: string; msmeNumber: string }) => void;
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const VendorBusinessInfoScreen: React.FC<VendorBusinessInfoScreenProps> = ({
  onBack,
  onNext,
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  const [businessType, setBusinessType] = useState('');
  const [yearEstablished, setYearEstablished] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');

  const businessTypes = [
    'Proprietorship',
    'Partnership',
    'Private Limited Company',
    'Limited Liability Partnership (LLP)',
  ];

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.businessType) setBusinessType(draft.businessType);
      if (draft?.yearEstablished) setYearEstablished(draft.yearEstablished);
      if (draft?.msmeNumber) setMsmeNumber(draft.msmeNumber);
    })();
  }, []);

  const handleContinue = async () => {
    if (!businessType) {
      Alert.alert('Required Selection', 'Please select your Business Entity Type.');
      return;
    }
    if (!yearEstablished.trim() || yearEstablished.length < 4) {
      Alert.alert('Required Field', 'Please enter a valid 4-digit Year of Establishment (e.g. 2018).');
      return;
    }

    await vendorService.saveDraftForm({
      businessType,
      yearEstablished: yearEstablished.trim(),
      msmeNumber: msmeNumber.trim().toUpperCase(),
    });

    onNext({
      businessType,
      yearEstablished: yearEstablished.trim(),
      msmeNumber: msmeNumber.trim().toUpperCase(),
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
            <View style={styles.logoWrap}>
              <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Registration Update Mode Banner */}
          {isUpdateMode && (
            <RegistrationUpdateHeaderBanner
              isUpdateMode={isUpdateMode}
              onlyIncompleteSteps={onlyIncompleteSteps}
              stepIndex={2}
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
              <Text style={styles.stepBadge}>STEP 2 OF 7</Text>
              <Text style={styles.stepTitle}>Business Constitution</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '28%' }]} />
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.contentWrap}>
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Enterprise <Text style={styles.goldText}>Constitution</Text>
              </Text>
              <Text style={styles.subText}>
                Select your legal entity structure for automated tax deductions and GST compliance.
              </Text>
            </View>

            {/* Constitution Selection */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Building size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>LEGAL ENTITY TYPE *</Text>
              </View>

              <View style={styles.typeOptionsCol}>
                {businessTypes.map((type) => {
                  const isSelected = businessType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeOptionCard, isSelected && styles.typeOptionCardActive]}
                      onPress={() => setBusinessType(type)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.typeRadio}>
                        {isSelected && <View style={styles.typeRadioInner} />}
                      </View>
                      <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                        {type}
                      </Text>
                      {isSelected && <CheckCircle size={16} color="#F05A22" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Profile Metrics */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Calendar size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>ESTABLISHMENT & REGISTRATIONS</Text>
              </View>

              {/* Year of Inception */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Year of Establishment *</Text>
                <View style={styles.inputWrap}>
                  <Calendar size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2018"
                    placeholderTextColor="#94A3B8"
                    value={yearEstablished}
                    onChangeText={setYearEstablished}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              {/* MSME / Udyam */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>MSME / Udyam Registration (Optional)</Text>
                <View style={styles.inputWrap}>
                  <FileBadge size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. UDYAM-AS-03-0012345"
                    placeholderTextColor="#94A3B8"
                    value={msmeNumber}
                    onChangeText={setMsmeNumber}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            {/* Navigation Buttons */}
            <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.goldBtnText}>Continue to Address & Contacts</Text>
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
  typeOptionsCol: {
    gap: 10,
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typeOptionCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  typeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  typeText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#9A3412',
    fontWeight: '700',
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
});
