import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  Building2,
  MapPin,
  Truck,
  ShieldCheck,
  FileText,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorRegistrationFormData } from '../../../types';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';

// Reusing the tested step components in a unified stepped container
import { VendorRegistrationScreen } from '../registration/VendorRegistrationScreen';
import { VendorBusinessInfoScreen } from '../registration/VendorBusinessInfoScreen';
import { VendorAddressContactScreen } from '../registration/VendorAddressContactScreen';
import { VendorOperatingLocationsScreen } from '../registration/VendorOperatingLocationsScreen';
import { VendorFleetInfoScreen } from '../registration/VendorFleetInfoScreen';
import { VendorTransportServicesScreen } from '../registration/VendorTransportServicesScreen';
import { VendorDocumentUploadScreen } from '../registration/VendorDocumentUploadScreen';
import { VendorApplicationReviewScreen } from '../registration/VendorApplicationReviewScreen';

interface VendorRegistrationHubScreenProps {
  initialMobile?: string;
  onBackToLogin: () => void;
  onProceedToOtp: (data: { targetPhone: string; testCode?: string; formData: any }) => void;
  onSubmitSuccess: (result: { vendorId: string; applicationNumber: string }) => void;
  onViewVerificationStatus?: () => void;
}

const STEPS = [
  { index: 1, title: 'Basics', icon: Building2 },
  { index: 2, title: 'Legal', icon: ShieldCheck },
  { index: 3, title: 'Address', icon: MapPin },
  { index: 4, title: 'Lanes', icon: MapPin },
  { index: 5, title: 'Fleet', icon: Truck },
  { index: 6, title: 'Services', icon: FileText },
  { index: 7, title: 'KYC Docs', icon: FileText },
  { index: 8, title: 'Review', icon: CheckCircle2 },
];

export const VendorRegistrationHubScreen: React.FC<VendorRegistrationHubScreenProps> = ({
  initialMobile,
  onBackToLogin,
  onProceedToOtp,
  onSubmitSuccess,
  onViewVerificationStatus,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<VendorRegistrationFormData>({} as any);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDraftData();
  }, []);

  const loadDraftData = async () => {
    try {
      setLoading(true);
      const draft = await vendorService.getDraftForm();
      if (draft) {
        setFormData(draft);
      }
    } catch (err) {
      console.warn('Error loading draft form:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStepNext = async (stepIndex: number, stepData?: any) => {
    try {
      const merged = { ...formData, ...(stepData || {}) };
      setFormData(merged);
      await vendorService.saveDraftForm(merged);

      if (stepIndex < 8) {
        setCurrentStep(stepIndex + 1);
      }
    } catch (err) {
      console.warn('Failed to save step progress:', err);
      setCurrentStep(stepIndex + 1);
    }
  };

  const handleStepBack = (stepIndex: number) => {
    if (stepIndex > 1) {
      setCurrentStep(stepIndex - 1);
    } else {
      onBackToLogin();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF5A1F" />
        <Text style={styles.loadingText}>Restoring your carrier application...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Hub Header */}
      <View style={styles.hubHeader}>
        <View style={styles.brandRow}>
          <BrandLogoHeader showSubtitle={false} />
          <View style={styles.hubBadge}>
            <Text style={styles.hubBadgeText}>HUB 1: CARRIER ONBOARDING</Text>
          </View>
        </View>

        {/* Stepper Progress Bar */}
        <View style={styles.stepperContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepperScroll}
          >
            {STEPS.map((s) => {
              const isActive = s.index === currentStep;
              const isPast = s.index < currentStep;
              return (
                <TouchableOpacity
                  key={s.index}
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                    isPast && styles.stepPillPast,
                  ]}
                  onPress={() => {
                    if (s.index <= currentStep) {
                      setCurrentStep(s.index);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isPast && styles.stepCirclePast,
                    ]}
                  >
                    {isPast ? (
                      <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text
                        style={[
                          styles.stepCircleText,
                          isActive && styles.stepCircleTextActive,
                        ]}
                      >
                        {s.index}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepPillLabel,
                      isActive && styles.stepPillLabelActive,
                      isPast && styles.stepPillLabelPast,
                    ]}
                  >
                    {s.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Render Active Step Content */}
      <View style={styles.contentWrap}>
        {currentStep === 1 && (
          <VendorRegistrationScreen
            initialMobile={initialMobile || formData.phone}
            onBack={() => handleStepBack(1)}
            onNext={(data) => handleStepNext(1, data)}
            onAlreadyRegistered={onBackToLogin}
          />
        )}

        {currentStep === 2 && (
          <VendorBusinessInfoScreen
            onBack={() => handleStepBack(2)}
            onNext={(data) => handleStepNext(2, data)}
          />
        )}

        {currentStep === 3 && (
          <VendorAddressContactScreen
            onBack={() => handleStepBack(3)}
            onNext={(data) => handleStepNext(3, data)}
          />
        )}

        {currentStep === 4 && (
          <VendorOperatingLocationsScreen
            onBack={() => handleStepBack(4)}
            onNext={(data) => handleStepNext(4, data)}
          />
        )}

        {currentStep === 5 && (
          <VendorFleetInfoScreen
            onBack={() => handleStepBack(5)}
            onNext={(data) => handleStepNext(5, data)}
          />
        )}

        {currentStep === 6 && (
          <VendorTransportServicesScreen
            onBack={() => handleStepBack(6)}
            onNext={(data) => handleStepNext(6, data)}
          />
        )}

        {currentStep === 7 && (
          <VendorDocumentUploadScreen
            onBack={() => handleStepBack(7)}
            onNext={(docs) => handleStepNext(7, docs)}
          />
        )}

        {currentStep === 8 && (
          <VendorApplicationReviewScreen
            initialMobile={initialMobile || formData.phone || ''}
            onBack={() => handleStepBack(8)}
            onEditSection={(stepIdx) => setCurrentStep(stepIdx)}
            onProceedToOtp={onProceedToOtp}
            onSubmitSuccess={onSubmitSuccess}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  hubHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  hubBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hubBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  stepperContainer: {
    paddingVertical: 6,
  },
  stepperScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepPillActive: {
    backgroundColor: '#FFECE5',
    borderColor: '#FF5A1F',
  },
  stepPillPast: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepCircleActive: {
    backgroundColor: '#FF5A1F',
  },
  stepCirclePast: {
    backgroundColor: '#10B981',
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepCircleTextActive: {
    color: '#FFFFFF',
  },
  stepPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepPillLabelActive: {
    color: '#FF5A1F',
    fontWeight: '700',
  },
  stepPillLabelPast: {
    color: '#059669',
  },
  contentWrap: {
    flex: 1,
  },
});
