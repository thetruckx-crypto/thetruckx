import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { Phone, Mail, FileText, CheckCircle2, X, Headphones, ArrowRight } from 'lucide-react-native';
import { AppTextField } from './AppTextField';
import { PrimaryButton } from './PrimaryButton';
import { MobileRole } from '../../types';

interface ForgotNumberModalProps {
  visible: boolean;
  role?: MobileRole;
  currentRole?: MobileRole;
  onClose: () => void;
  onRecovered: (mobile: string) => void;
}

export const ForgotNumberModal: React.FC<ForgotNumberModalProps> = ({
  visible,
  role,
  currentRole,
  onClose,
  onRecovered,
}) => {
  const activeRole: MobileRole = role || currentRole || 'CLIENT';
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveredPhone, setRecoveredPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!identifier.trim()) {
      setError('Please enter your registered email, PAN, or GSTIN.');
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate enterprise identity recovery lookup
    setTimeout(() => {
      setLoading(false);
      const clean = identifier.trim().toLowerCase();
      // If valid looking input, provide verified recovery result
      if (clean.includes('@') || clean.length >= 10) {
        setRecoveredPhone('9876543210');
      } else {
        setError('No active enterprise account found matching this identifier. Contact Support.');
      }
    }, 900);
  };

  const handleUseRecoveredNumber = () => {
    if (recoveredPhone) {
      onRecovered(recoveredPhone);
      handleReset();
    }
  };

  const handleReset = () => {
    setIdentifier('');
    setRecoveredPhone(null);
    setError(null);
    onClose();
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:1800878259').catch(() => {
      Alert.alert('Customer Support', 'Please call 1800-TRUCKX (1800-878-259) for immediate identity verification.');
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleReset}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Account Recovery</Text>
              <Text style={styles.subtitle}>Find your registered mobile number for {activeRole.toLowerCase()}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleReset}>
              <X size={18} color="#7B8798" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {recoveredPhone ? (
            <View style={styles.successBox}>
              <CheckCircle2 size={44} color="#22A06B" />
              <Text style={styles.successTitle}>Account Found!</Text>
              <Text style={styles.successDesc}>
                Your registered mobile number matching this enterprise identity is:
              </Text>
              <View style={styles.phoneBadge}>
                <Phone size={18} color="#172B4D" />
                <Text style={styles.phoneText}>+91 {recoveredPhone}</Text>
              </View>
              <PrimaryButton
                title="Use This Number & Login"
                onPress={handleUseRecoveredNumber}
                style={{ width: '100%', marginTop: 14 }}
              />
            </View>
          ) : (
            <View style={styles.formWrap}>
              <Text style={styles.instruction}>
                Enter your company's registered official email, 10-digit PAN, or GSTIN to retrieve your login number:
              </Text>

              <AppTextField
                label="Official Email / PAN / GSTIN"
                placeholder="e.g. logistics@company.com or ABCDE1234F"
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (error) setError(null);
                }}
                error={error}
                autoCapitalize="characters"
              />

              <PrimaryButton
                title="Find Registered Number"
                onPress={handleSearch}
                loading={loading}
                disabled={!identifier.trim() || loading}
                style={{ marginTop: 14 }}
              />

              {/* Support Callout */}
              <View style={styles.supportBox}>
                <Headphones size={20} color="#F15A24" />
                <View style={styles.supportTextWrap}>
                  <Text style={styles.supportTitle}>Still need assistance?</Text>
                  <Text style={styles.supportDesc}>Contact THE TRUCKX 24/7 Desk (1800-TRUCKX)</Text>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={handleCallSupport}>
                  <Text style={styles.callBtnText}>1800-TRUCKX</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#7B8798',
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formWrap: {
    marginTop: 6,
  },
  instruction: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  supportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#172B4D',
  },
  supportDesc: {
    fontSize: 11,
    color: '#7B8798',
    marginTop: 1,
  },
  callBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#F15A24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    marginTop: 10,
  },
  successDesc: {
    fontSize: 13,
    color: '#7B8798',
    textAlign: 'center',
    marginTop: 4,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  phoneText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
    letterSpacing: 0.5,
  },
});
