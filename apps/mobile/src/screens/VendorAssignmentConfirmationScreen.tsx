import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  CheckCircle2,
  Truck,
  Users,
  MapPin,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorAssignmentConfirmationScreenProps {
  vendorId: string;
  booking: any;
  vehicle: any;
  driver: any;
  onBack: () => void;
  onConfirmed: (tripId: string) => void;
}

export const VendorAssignmentConfirmationScreen: React.FC<VendorAssignmentConfirmationScreenProps> = ({
  vendorId,
  booking,
  vehicle,
  driver,
  onBack,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirmAssignment = async () => {
    setLoading(true);
    try {
      const res = await vendorService.assignVehicleAndDriver({
        bookingId: booking.id,
        vendorId,
        vehicleId: vehicle.id,
        driverId: driver.id,
        rate: booking.rate,
      });

      if (res.success) {
        Alert.alert(
          'Assignment Confirmed',
          `Vehicle ${vehicle.registrationNumber} and Driver ${driver.fullName} are dispatched for Booking ${booking.id}.`,
          [{ text: 'Manage Trip', onPress: () => onConfirmed(res.tripId) }]
        );
      } else {
        Alert.alert('Error', 'Unable to complete fleet assignment.');
      }
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Error confirming assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Confirm <Text style={styles.goldText}>Allocation</Text>
            </Text>
            <Text style={styles.subText}>
              Verify assigned commercial truck and pilot before initializing live trip execution.
            </Text>
          </View>

          {/* Allocation Details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ASSIGNED COMMERCIAL VEHICLE</Text>
            </View>

            <View style={styles.gridCol}>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Plate Number:</Text>
                <Text style={styles.valueGold}>{vehicle?.registrationNumber}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Category:</Text>
                <Text style={styles.value}>{vehicle?.vehicleType}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Rated Capacity:</Text>
                <Text style={styles.value}>{vehicle?.ratedCapacityMt} MT</Text>
              </View>
            </View>
          </View>

          {/* Driver Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Users size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ASSIGNED COMMERCIAL DRIVER</Text>
            </View>

            <View style={styles.gridCol}>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Pilot Name:</Text>
                <Text style={styles.value}>{driver?.fullName}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Contact Phone:</Text>
                <Text style={styles.value}>{driver?.mobile || '+91 98765 43210'}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Driving Licence:</Text>
                <Text style={styles.value}>{driver?.licenceNumber}</Text>
              </View>
            </View>
          </View>

          {/* Route & Terms Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>TRIP ORDER PARTICULARS</Text>
            </View>

            <View style={styles.gridCol}>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Booking ID:</Text>
                <Text style={styles.value}>{booking.id}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Route:</Text>
                <Text style={styles.value}>
                  {booking.origin} → {booking.destination}
                </Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Agreed Rate:</Text>
                <Text style={styles.valueGreen}>₹{booking.rate?.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>

          {/* Compliance Assurance */}
          <View style={styles.shieldBox}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.shieldText}>
              Lorry allocation synchronizes in real time with client tracking and NECL Admin Control Tower.
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.goldBtn, loading && styles.goldBtnDisabled]}
            onPress={handleConfirmAssignment}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.goldBtnText}>Confirm Allocation & Dispatch</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
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
    bottom: 6,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 14,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gridCol: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  value: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  valueGold: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '800',
  },
  valueGreen: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '800',
  },
  shieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  shieldText: {
    flex: 1,
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
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
  goldBtnDisabled: {
    opacity: 0.5,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
