import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Package,
  Truck,
  Users,
  CreditCard,
  Building2,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Navigation,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorBookingDetailsScreenProps {
  bookingId: string;
  onBack: () => void;
  onAssignFleet: (booking: any) => void;
  onViewTrip: (tripId: string) => void;
}

export const VendorBookingDetailsScreen: React.FC<VendorBookingDetailsScreenProps> = ({
  bookingId,
  onBack,
  onAssignFleet,
  onViewTrip,
}) => {
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBooking = useCallback(async () => {
    try {
      const data = await vendorService.getBookingDetails(bookingId);
      setBooking(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching Booking Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) return null;

  const hasTrip = !!booking.trip;

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>{booking.id}</Text>
              <Text style={styles.subDate}>
                Confirmed on {new Date(booking.confirmedAt || Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <ShieldCheck size={12} color="#10B981" />
              <Text style={styles.statusText}>{booking.bookingStatus}</Text>
            </View>
          </View>

          {/* Route Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>PICKUP & DELIVERY ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeStop}>
                <View style={styles.dotGold} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{booking.pickupAddress}</Text>
                  {booking.pickupPincode && <Text style={styles.pinText}>PIN: {booking.pickupPincode}</Text>}
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStop}>
                <View style={styles.dotGreen} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>DROP DESTINATION</Text>
                  <Text style={styles.stopAddress}>{booking.destinationAddress}</Text>
                  {booking.destinationPincode && <Text style={styles.pinText}>PIN: {booking.destinationPincode}</Text>}
                </View>
              </View>
            </View>
          </View>

          {/* Cargo & Dispatch Status */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CARGO PARTICULARS</Text>
            </View>

            <View style={styles.specsGrid}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Commodity:</Text>
                <Text style={styles.specVal}>{booking.materialType || 'Industrial Equipment'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Tonnage:</Text>
                <Text style={styles.specVal}>{booking.capacityMt} MT</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Vehicle Required:</Text>
                <Text style={styles.specVal}>{booking.vehicleType || '32 FT Multi-Axle'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Payment Status:</Text>
                <Text style={styles.specValGreen}>{booking.paymentStatus || 'PAYMENT_PENDING'}</Text>
              </View>
            </View>
          </View>

          {/* Assigned Lorry & Driver */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ASSIGNED FLEET & CREW</Text>
            </View>

            {hasTrip ? (
              <View style={styles.assignedBox}>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Vehicle Number:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.vehicleNumber}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Assigned Driver:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.driverName}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Driver Contact:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.driverPhone}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Trip Status:</Text>
                  <Text style={styles.specValGold}>{booking.trip.tripStatus}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedBox}>
                <Text style={styles.unassignedText}>
                  No commercial vehicle or driver has been allocated to this booking yet.
                </Text>
              </View>
            )}
          </View>

          {/* Action CTAs */}
          {hasTrip ? (
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={() => onViewTrip(booking.trip.id)}
              activeOpacity={0.85}
            >
              <Navigation size={18} color="#FFFFFF" />
              <Text style={styles.goldBtnText}>Manage Live Trip & POD</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={() => onAssignFleet(booking)}
              activeOpacity={0.85}
            >
              <PlusCircle size={18} color="#FFFFFF" />
              <Text style={styles.goldBtnText}>Assign Vehicle & Driver</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
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
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#172B4D',
    marginTop: 12,
    fontSize: 13,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
  },
  subDate: {
    color: '#64748B',
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
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
    marginBottom: 12,
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
  routeCol: {
    gap: 8,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  routeDivider: {
    width: 2,
    height: 14,
    backgroundColor: '#F1F5F9',
    marginLeft: 3,
  },
  stopTextWrap: {
    flex: 1,
  },
  stopLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  stopAddress: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  pinText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  specsGrid: {
    gap: 6,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  specVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  specValGreen: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  specValGold: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  assignedBox: {
    gap: 6,
  },
  assignedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assignedLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  assignedVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  unassignedBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    padding: 12,
  },
  unassignedText: {
    color: '#FDE68A',
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
    marginTop: 6,
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
