import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Truck,
  ArrowRight,
  Home,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';

interface DriverSubmissionConfirmationScreenProps {
  applicationNumber: string;
  onCheckStatus: () => void;
  onGoHome: () => void;
  onBackToLogin?: () => void;
}

export const DriverSubmissionConfirmationScreen: React.FC<DriverSubmissionConfirmationScreenProps> = ({
  applicationNumber,
  onCheckStatus,
  onGoHome,
  onBackToLogin,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={190} />
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {/* Success Icon */}
          <View style={styles.iconCircle}>
            <CheckCircle2 size={42} color="#10B981" />
          </View>

          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Application <Text style={styles.goldText}>Submitted!</Text>
            </Text>
            <Text style={styles.subText}>
              Your commercial heavy pilot credentials have been received by NECL operations.
            </Text>
          </View>

          {/* Reference Card */}
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>APPLICATION TRACKING REFERENCE</Text>
            <Text style={styles.refNumber}>{applicationNumber || 'DRV-981240'}</Text>
            <View style={styles.divider} />
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Status: Under Sarathi & Compliance Audit</Text>
            </View>
          </View>

          {/* Next Steps Roadmap */}
          <View style={styles.roadmapCard}>
            <Text style={styles.roadmapTitle}>What Happens Next?</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepNumWrap}><Text style={styles.stepNum}>1</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepHeading}>Sarathi DL Verification</Text>
                <Text style={styles.stepDesc}>Driving licence validity and hazardous cargo endorsements audited.</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumWrap}><Text style={styles.stepNum}>2</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepHeading}>NECL Desk Approval</Text>
                <Text style={styles.stepDesc}>Verification team confirms vehicle association within 2-4 business hours.</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumWrap}><Text style={styles.stepNum}>3</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepHeading}>Instant Trip Dispatch</Text>
                <Text style={styles.stepDesc}>Receive Pan-India loads, GPS route navigation, and FASTag toll advances.</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.goldPillBtn}
            onPress={onCheckStatus}
            activeOpacity={0.85}
          >
            <Text style={styles.goldPillText}>Track Verification Status</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onGoHome}
            activeOpacity={0.8}
          >
            <Home size={16} color="#F05A22" />
            <Text style={styles.outlineBtnText}>Return to Welcome Screen</Text>
          </TouchableOpacity>

          {onBackToLogin && (
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={onBackToLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>Log In with Registered Number</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <BottomGoldWings />
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
  logoWrap: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  refCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  refLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  refNumber: {
    color: '#F05A22',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  statusText: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  roadmapCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  roadmapTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
  },
  stepHeading: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
  },
  stepDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  goldPillBtn: {
    width: '100%',
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
    marginBottom: 12,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outlineBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(227, 180, 0, 0.04)',
  },
  outlineBtnText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  loginBtn: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  loginBtnText: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '700',
  },
});
