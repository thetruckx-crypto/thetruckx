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
  ChevronLeft,
  UserCheck,
  CreditCard,
  Truck,
  ShieldCheck,
  ArrowRight,
  Clock,
  Compass,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';

interface DriverRegistrationScreenProps {
  initialMobile: string;
  onBack: () => void;
  onStartRegistration: () => void;
  onCheckStatus: () => void;
}

export const DriverRegistrationScreen: React.FC<DriverRegistrationScreenProps> = ({
  initialMobile,
  onBack,
  onStartRegistration,
  onCheckStatus,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Hero Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={200} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {/* Header Title */}
          <View style={styles.headingWrap}>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Truck size={13} color="#F05A22" />
                <Text style={styles.roleBadgeText}>COMMERCIAL PILOT NETWORK</Text>
              </View>
            </View>
            <Text style={styles.titleText}>
              Driver <Text style={styles.goldText}>Enrollment & KYC</Text>
            </Text>
            <Text style={styles.subText}>
              Join NECL's national logistics network. Get verified for heavy commercial vehicle dispatches with fuel advances.
            </Text>
          </View>

          {/* User Phone Confirmation */}
          <View style={styles.phoneCard}>
            <View style={styles.phoneIconWrap}>
              <UserCheck size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.phoneLabel}>AUTHENTICATED MOBILE NUMBER</Text>
              <Text style={styles.phoneValue}>+91 {initialMobile || '98765 43210'}</Text>
            </View>
          </View>

          {/* 4 Steps Roadmap */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsCardTitle}>4 Simple Steps to Get Dispatched</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>Personal Information</Text>
                <Text style={styles.stepDesc}>Basic details, residential address & emergency contact</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>Commercial Driving Licence (DL)</Text>
                <Text style={styles.stepDesc}>DL number, RTO state & heavy vehicle category</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>Vehicle & Transporter Association</Text>
                <Text style={styles.stepDesc}>Link with transporter fleet or registered truck</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>4</Text></View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepName}>Document Upload & KYC</Text>
                <Text style={styles.stepDesc}>DL front/back, Aadhaar ID and fitness verification</Text>
              </View>
            </View>
          </View>

          {/* Trust Banner */}
          <View style={styles.complianceNote}>
            <ShieldCheck size={18} color="#F05A22" />
            <Text style={styles.complianceText}>
              All driver records are audited against Ministry of Road Transport (Sarathi/Vahan) databases before GPS dispatch authorization.
            </Text>
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={styles.goldPillBtn}
            onPress={onStartRegistration}
            activeOpacity={0.85}
          >
            <Text style={styles.goldPillText}>Begin Driver Registration</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Check Existing Status */}
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onCheckStatus}
            activeOpacity={0.8}
          >
            <Clock size={16} color="#F05A22" />
            <Text style={styles.outlineBtnText}>Check Existing Application Status</Text>
          </TouchableOpacity>
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
    paddingTop: 14,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  roleBadgeText: {
    color: '#F05A22',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
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
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  phoneIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  phoneValue: {
    fontSize: 15,
    color: '#172B4D',
    fontWeight: '700',
    marginTop: 2,
  },
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  stepsCardTitle: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
  },
  stepName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  stepDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  complianceText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
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
    marginBottom: 12,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outlineBtn: {
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
});
