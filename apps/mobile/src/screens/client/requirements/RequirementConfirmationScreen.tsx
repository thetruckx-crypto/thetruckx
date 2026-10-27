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
  ArrowRight,
  ClipboardList,
  Eye,
  Home,
  Truck,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { TransportRequirementDraft } from '../../../types';

interface RequirementConfirmationScreenProps {
  requirementId: string;
  draft?: TransportRequirementDraft;
  onViewDetails: (requirementId: string) => void;
  onViewQuotations: (requirementId: string) => void;
  onGoToDashboard: () => void;
  onCreateAnother?: () => void;
}

export const RequirementConfirmationScreen: React.FC<
  RequirementConfirmationScreenProps
> = ({
  requirementId,
  draft,
  onViewDetails,
  onViewQuotations,
  onGoToDashboard,
  onCreateAnother,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Scenic Hero Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={190} />
          <View style={styles.logoWrap}>
            <BrandLogoHeader size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {/* Success Badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.outerGlow}>
              <View style={styles.innerCircle}>
                <CheckCircle2 size={46} color="#10B981" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Requirement Submitted!</Text>
          <Text style={styles.subtitle}>
            Your freight posting is live. Control Tower dispatchers and certified regional fleet owners have been notified.
          </Text>

          {/* Reference ID Card */}
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>REQUIREMENT IDENTIFIER</Text>
            <Text style={styles.refValue}>{requirementId || 'REQ-91028471'}</Text>
            <View style={styles.refDivider} />
            <View style={styles.refRow}>
              <View style={styles.statusPill}>
                <Clock size={13} color="#B45309" />
                <Text style={styles.statusPillText}>Status: Under Review / Live RFQ</Text>
              </View>
            </View>
          </View>

          {/* Quick Route Summary */}
          {draft && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.summaryVehicle}>{draft.vehicleTypeRequired}</Text>
              </View>
              <View style={styles.routeRow}>
                <Text style={styles.routeCity}>{draft.pickupCity || 'Origin'}</Text>
                <Text style={styles.routeArrow}>⟶</Text>
                <Text style={styles.routeCity}>{draft.destinationCity || 'Destination'}</Text>
              </View>
              <Text style={styles.cargoSub}>
                {draft.materialType} • {draft.requiredCapacityMt} MT
              </Text>
            </View>
          )}

          {/* Next Steps Notification */}
          <View style={styles.infoBox}>
            <ShieldCheck size={20} color="#059669" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Quotations typically arrive within 15–30 minutes. You will receive real-time push notifications once bids are submitted.
            </Text>
          </View>

          {/* Primary Action: View Live Quotations */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onViewQuotations(requirementId)}
            activeOpacity={0.88}
          >
            <ClipboardList size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Check Received Quotations</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Secondary Action: View Requirement Details */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onViewDetails(requirementId)}
            activeOpacity={0.88}
          >
            <Eye size={17} color="#0A1931" />
            <Text style={styles.secondaryBtnText}>View Requirement Details</Text>
          </TouchableOpacity>

          {/* Tertiary Action: Create Another Requirement (Task 8) */}
          {onCreateAnother && (
            <TouchableOpacity
              style={styles.createAnotherBtn}
              onPress={onCreateAnother}
              activeOpacity={0.88}
            >
              <PlusCircle size={17} color="#F05A22" strokeWidth={2.4} />
              <Text style={styles.createAnotherBtnText}>Create Another Requirement</Text>
            </TouchableOpacity>
          )}

          {/* Back to Dashboard */}
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={onGoToDashboard}
            activeOpacity={0.8}
          >
            <Home size={15} color="#64748B" />
            <Text style={styles.homeBtnText}>Return to Client Dashboard</Text>
          </TouchableOpacity>

          <BottomGoldWings />
        </View>
      </ScrollView>
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
  topWrap: {
    position: 'relative',
    height: 190,
  },
  logoWrap: {
    position: 'absolute',
    top: 36,
    left: 20,
    zIndex: 10,
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    alignItems: 'center',
  },
  badgeContainer: {
    marginTop: -42,
    marginBottom: 16,
    alignItems: 'center',
  },
  outerGlow: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ECFDF5',
    borderWidth: 6,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A1931',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  refCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  refLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  refValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F05A22',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  refDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  summaryVehicle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  routeCity: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1931',
  },
  routeArrow: {
    fontSize: 15,
    color: '#F05A22',
    fontWeight: 'bold',
  },
  cargoSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    color: '#065F46',
    lineHeight: 18,
    fontWeight: '500',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#F05A22',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0A1931',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A1931',
  },
  createAnotherBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFF7F2',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  createAnotherBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F05A22',
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  homeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});
