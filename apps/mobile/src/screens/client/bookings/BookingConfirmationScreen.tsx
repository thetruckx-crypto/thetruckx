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
  Truck,
  Eye,
  Home,
  ShieldCheck,
  MapPin,
  ClipboardList,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';

interface BookingConfirmationScreenProps {
  bookingId: string;
  onViewBookingDetails: (bookingId: string) => void;
  onTrackShipment: (bookingId: string) => void;
  onGoToMyBookings: () => void;
  onGoToDashboard: () => void;
}

export const BookingConfirmationScreen: React.FC<
  BookingConfirmationScreenProps
> = ({
  bookingId,
  onViewBookingDetails,
  onTrackShipment,
  onGoToMyBookings,
  onGoToDashboard,
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

          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            Your transport consignment has been booked with TRUCKS. A dedicated vehicle is being mobilized.
          </Text>

          {/* Reference ID Card */}
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>OFFICIAL BOOKING ID</Text>
            <Text style={styles.refValue}>{bookingId || 'BOK-73910482'}</Text>
            <View style={styles.refDivider} />
            <View style={styles.refRow}>
              <View style={styles.statusPill}>
                <Truck size={13} color="#059669" />
                <Text style={styles.statusPillText}>Status: Lorry Assignment In Progress</Text>
              </View>
            </View>
          </View>

          {/* Next steps info */}
          <View style={styles.infoBox}>
            <ShieldCheck size={20} color="#059669" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Control Tower has initiated driver assignment. You can track lorry placement, dispatch milestones, and download e-Way Bill and LR receipts.
            </Text>
          </View>

          {/* Action Button: Live Tracking */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onTrackShipment(bookingId)}
            activeOpacity={0.88}
          >
            <Truck size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Track Consignment Milestone</Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Action Button: View Booking Details */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onViewBookingDetails(bookingId)}
            activeOpacity={0.88}
          >
            <Eye size={17} color="#0A1931" />
            <Text style={styles.secondaryBtnText}>View Booking & Vehicle Details</Text>
          </TouchableOpacity>

          {/* Action Button: Go to My Bookings */}
          <TouchableOpacity
            style={styles.tertiaryBtn}
            onPress={onGoToMyBookings}
            activeOpacity={0.88}
          >
            <ClipboardList size={16} color="#F05A22" />
            <Text style={styles.tertiaryBtnText}>View All My Bookings</Text>
          </TouchableOpacity>

          {/* Return to Dashboard */}
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
    paddingHorizontal: 12,
  },
  refCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
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
  tertiaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tertiaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#C2410C',
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
