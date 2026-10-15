import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Modal,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ShieldCheck,
  ChevronRight,
  Check,
  X,
  Lock,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';

interface TermsPrivacyScreenProps {
  onBack: () => void;
  onAcceptContinue: () => void;
}

export const TermsPrivacyScreen: React.FC<TermsPrivacyScreenProps> = ({
  onBack,
  onAcceptContinue,
}) => {
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [docModal, setDocModal] = useState<{
    title: string;
    content: string;
  } | null>(null);

  const canContinue = agreeTerms && agreePrivacy;

  const handleContinue = () => {
    if (!canContinue) {
      Alert.alert(
        'Agreement Required',
        'Please review and accept both the Terms of Service and Privacy Policy to proceed.'
      );
      return;
    }
    onAcceptContinue();
  };

  const openDoc = (type: 'terms' | 'privacy' | 'data') => {
    if (type === 'terms') {
      setDocModal({
        title: 'Terms of Service',
        content:
          'Welcome to North Eastern Carriers Logistics (NECL).\n\n1. Acceptance: By registering or using the platform, you agree to comply with our commercial carriage rules.\n2. Consignment Booking: All load bookings, lorry attachments, and freight quotes are legally binding.\n3. Digital POD: Consignees must provide digital or physical POD sign-off within 24 hours of delivery.\n4. Liability & Insurance: Freight transit is covered per standard Indian Carriage by Road Act guidelines.\n5. Rates & Settlement: Charges are settled per the mutually confirmed dispatch contract.',
      });
    } else if (type === 'privacy') {
      setDocModal({
        title: 'Privacy Policy',
        content:
          'North Eastern Carriers respects and safeguards your data.\n\n1. Data Collected: Mobile number, KYC credentials (GSTIN/PAN/Aadhaar/Driving Licence), and real-time GPS locations for active transit tracking.\n2. Usage: Collected data is strictly used for shipment dispatch, consignment billing, and driver safety.\n3. Encryption: All communications and credentials are stored securely with enterprise-grade encryption.\n4. Third-Party Sharing: We never sell your personal information to third parties.',
      });
    } else {
      setDocModal({
        title: 'Data Usage Disclosure',
        content:
          'How your operational data is utilized:\n\n1. Live Telematics: GPS coordinates are tracked only during active trip dispatches to provide live ETA updates to shippers.\n2. Invoicing & GST: Company GSTIN & PAN details are transmitted securely to GST portals for e-Way Bill generation.\n3. Performance Analytics: Delivery timelines are analyzed to reward top-performing fleet operators.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar with Back Arrow */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#172B4D" />
          </TouchableOpacity>
        </View>

        {/* Logo Center */}
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="md" theme="light" />
        </View>

        {/* Header with Highway Truck Image Matching Reference Image 4 */}
        <View style={styles.headerSectionCard}>
          <View style={styles.headerTextCol}>
            <Text style={styles.titleText}>
              Terms &{'\n'}
              <Text style={styles.orangeText}>Privacy</Text>
            </Text>
            <Text style={styles.subtitleText}>
              Please review and accept the terms to continue.
            </Text>
          </View>

          <View style={styles.headerImageSnippetBox}>
            <ShieldCheck size={28} color="#F05A22" />
          </View>
        </View>

        {/* 3 Document Cards Matching Reference Image 4 */}
        <View style={styles.documentsWrap}>
          {/* Card 1: Terms of Service */}
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => openDoc('terms')}
            activeOpacity={0.7}
          >
            <View style={[styles.docIconSquircle, { backgroundColor: '#FFF5ED' }]}>
              <FileText size={22} color="#F05A22" strokeWidth={2} />
            </View>
            <View style={styles.docTextCol}>
              <Text style={styles.docTitle}>Terms of Service</Text>
              <Text style={styles.docDesc}>
                Read our terms and conditions for using North Eastern Carriers app.
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Card 2: Privacy Policy */}
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => openDoc('privacy')}
            activeOpacity={0.7}
          >
            <View style={[styles.docIconSquircle, { backgroundColor: '#EFF6FF' }]}>
              <ShieldCheck size={22} color="#2563EB" strokeWidth={2} />
            </View>
            <View style={styles.docTextCol}>
              <Text style={styles.docTitle}>Privacy Policy</Text>
              <Text style={styles.docDesc}>
                Learn how we collect, use, and protect your personal information.
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Card 3: Data Usage */}
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => openDoc('data')}
            activeOpacity={0.7}
          >
            <View style={[styles.docIconSquircle, { backgroundColor: '#F0FDF4' }]}>
              <FileText size={22} color="#16A34A" strokeWidth={2} />
            </View>
            <View style={styles.docTextCol}>
              <Text style={styles.docTitle}>Data Usage</Text>
              <Text style={styles.docDesc}>
                Understand how your data is used to provide better services.
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Agreement Checkboxes Matching Reference Image 4 */}
        <View style={styles.checkboxesWrap}>
          {/* Checkbox 1: Terms */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
              {agreeTerms && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and agree to the{' '}
              <Text
                style={styles.orangeLink}
                onPress={() => openDoc('terms')}
              >
                Terms of Service
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Checkbox 2: Privacy */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreePrivacy(!agreePrivacy)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreePrivacy && styles.checkboxActive]}>
              {agreePrivacy && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and agree to the{' '}
              <Text
                style={styles.orangeLink}
                onPress={() => openDoc('privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary Action Button: Continue -> */}
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Document Reader Modal */}
      <Modal
        visible={docModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDocModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{docModal?.title}</Text>
              <TouchableOpacity onPress={() => setDocModal(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalBodyText}>{docModal?.content}</Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setDocModal(null)}
            >
              <Text style={styles.modalCloseBtnText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginTop: 4,
    marginBottom: 16,
  },
  headerSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.4,
    lineHeight: 34,
    marginBottom: 4,
  },
  orangeText: {
    color: '#F05A22',
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  headerImageSnippetBox: {
    width: 140,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerTruckImg: {
    width: '100%',
    height: '100%',
  },
  documentsWrap: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 22,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  docIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docTextCol: {
    flex: 1,
    paddingRight: 6,
  },
  docTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 2,
  },
  docDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  checkboxesWrap: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#172B4D',
    lineHeight: 18,
  },
  orangeLink: {
    color: '#F05A22',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  continueBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    height: 50,
    borderRadius: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
  },
  modalScroll: {
    marginBottom: 16,
  },
  modalBodyText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 22,
  },
  modalCloseBtn: {
    backgroundColor: '#F05A22',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
