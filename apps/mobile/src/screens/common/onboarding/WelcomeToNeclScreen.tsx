import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Truck,
  FileText,
  MapPin,
  Package,
  Layers,
  Award,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { MobileRole } from '../../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WelcomeToNeclScreenProps {
  role: MobileRole;
  companyName?: string;
  accountCode?: string;
  userName?: string;
  onContinueToDashboard: () => void;
  autoRedirectSeconds?: number;
}

export const WelcomeToNeclScreen: React.FC<WelcomeToNeclScreenProps> = ({
  role,
  companyName,
  accountCode,
  userName,
  onContinueToDashboard,
  autoRedirectSeconds = 4,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onContinueToDashboard();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinueToDashboard();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, onContinueToDashboard]);

  const displayName = companyName || userName || (role === 'CLIENT' ? 'Enterprise Shipper' : role === 'VENDOR' ? 'Fleet Transporter' : 'Commercial Driver');
  const displayCode = accountCode || (role === 'CLIENT' ? 'CLI-APPROVED' : role === 'VENDOR' ? 'VND-APPROVED' : 'DRV-APPROVED');

  const roleLabel =
    role === 'CLIENT'
      ? 'Verified Shipper & Client Partner'
      : role === 'VENDOR'
      ? 'Authorized Fleet Transporter'
      : 'Registered Commercial Driver';

  const features =
    role === 'CLIENT'
      ? [
          {
            icon: Package,
            title: 'Post Freight Requirements',
            desc: 'Create direct multi-axle freight loads and corridor movements in seconds.',
          },
          {
            icon: FileText,
            title: 'Instant Commercial RFQs',
            desc: 'Review competitive live transporter quotations with verified rate parity.',
          },
          {
            icon: MapPin,
            title: 'GPS Milestone Tracking',
            desc: 'Live vehicle telemetry across Kolkata, Guwahati, and Northeast corridors.',
          },
          {
            icon: ShieldCheck,
            title: 'Digital POD & Invoices',
            desc: 'Download instant tamper-proof delivery proofs and GST-compliant bills.',
          },
        ]
      : role === 'VENDOR'
      ? [
          {
            icon: Truck,
            title: 'Receive Freight Requirements',
            desc: 'Access verified industrial freight requirements matching your operating corridors.',
          },
          {
            icon: FileText,
            title: 'Submit Competitive Bids',
            desc: 'Submit transparent transport quotes and secure high-value logistics contracts.',
          },
          {
            icon: Layers,
            title: 'Fleet & Driver Allocation',
            desc: 'Assign vehicles and registered commercial drivers to awarded client bookings.',
          },
          {
            icon: ShieldCheck,
            title: 'Rapid Settlement & Clearances',
            desc: 'Digital trip manifests, e-Way bills, and prompt delivery reconciliation.',
          },
        ]
      : [
          {
            icon: Truck,
            title: 'Assigned Trip Dispatches',
            desc: 'Instant access to your verified load manifests and assigned transport routes.',
          },
          {
            icon: MapPin,
            title: 'Live Route Guidance',
            desc: 'Waypoint navigation and pickup / delivery checkpoint confirmations.',
          },
          {
            icon: ShieldCheck,
            title: 'Instant Digital POD Upload',
            desc: 'Capture signed proof of delivery with your phone camera on arrival.',
          },
          {
            icon: CheckCircle2,
            title: 'Verified Driver Portal',
            desc: 'Clearance records, trip history, and operations dispatch assistance.',
          },
        ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          
        </View>

        {/* Hero Success Badge & Welcome Message */}
        <View style={styles.heroSection}>
          <View style={styles.badgeGlowContainer}>
            <View style={styles.badgePulseRing} />
            <View style={styles.iconCircle}>
              <CheckCircle2 size={54} color="#10B981" strokeWidth={2.4} />
            </View>
          </View>

          <View style={styles.statusPill}>
            <Sparkles size={14} color="#059669" />
            <Text style={styles.statusPillText}>REGISTRATION SUCCESSFULLY COMPLETED</Text>
          </View>

          <Text style={styles.welcomeHeading}>
            Welcome to <Text style={styles.brandAccent}>TRUCKS!</Text>
          </Text>

          <Text style={styles.welcomeSubhead}>
            Your registration has been approved successfully. Your account is now active with full dashboard access.
          </Text>
        </View>

        {/* Enterprise Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Award size={22} color="#F05A22" />
            </View>
            <View style={styles.cardHeaderTextWrap}>
              <Text style={styles.accountName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.roleSubtext}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.accountMetaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ACCOUNT ID</Text>
              <Text style={styles.metaValCode}>{displayCode}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>PORTAL STATUS</Text>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Active & Approved</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Capabilities Unlocked Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>CAPABILITIES ACTIVATED</Text>
          <Text style={styles.featuresSubtitle}>
            Your verified operational privileges are now enabled across all platforms:
          </Text>

          <View style={styles.featuresList}>
            {features.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <View key={idx} style={styles.featureItem}>
                  <View style={styles.featureIconWrap}>
                    <IconComp size={20} color="#F05A22" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <Text style={styles.featureDesc}>{item.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Auto-redirect countdown & Action Button */}
        <View style={styles.actionSection}>
          <View style={styles.timerNotice}>
            <Clock size={16} color="#64748B" />
            <Text style={styles.timerText}>
              Redirecting to your dashboard in{' '}
              <Text style={styles.timerCount}>{secondsRemaining}s</Text>...
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onContinueToDashboard}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>Enter Dashboard Now</Text>
            <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Decorative Gold Wings */}
        <BottomGoldWings />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 20,
  },
  badgeGlowContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgePulseRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 14,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.6,
  },
  welcomeHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  brandAccent: {
    color: '#F05A22',
  },
  welcomeSubhead: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 340,
  },
  accountCard: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTextWrap: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  roleSubtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  accountMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: 'monospace',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  featuresSection: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F05A22',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  featuresSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  actionSection: {
    width: SCREEN_WIDTH - 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  timerCount: {
    fontWeight: '700',
    color: '#F05A22',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
