import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  Package,
  PlusCircle,
  Navigation,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorAwardedBookingsScreenProps {
  vendorId: string;
  onBack: () => void;
  onSelectBooking: (bookingId: string) => void;
  onAssignFleet: (booking: any) => void;
  onViewTrip: (tripId: string) => void;
}

export const VendorAwardedBookingsScreen: React.FC<VendorAwardedBookingsScreenProps> = ({
  vendorId,
  onBack,
  onSelectBooking,
  onAssignFleet,
  onViewTrip,
}) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async () => {
    try {
      const data = await vendorService.getAwardedBookings(vendorId);
      setBookings(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F05A22" />
        }
      >
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Awarded <Text style={styles.goldText}>Bookings</Text>
            </Text>
            <Text style={styles.subText}>
              Confirmed client contracts allocated to your fleet ready for lorry placement and dispatch.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Awarded Bookings Yet</Text>
              <Text style={styles.emptySub}>
                Submit competitive quotations on active loads to secure contracted freight.
              </Text>
            </View>
          ) : (
            <View style={styles.bookingsCol}>
              {bookings.map((b) => {
                const isAssigned = b.hasAssignedFleet;

                return (
                  <View key={b.id} style={styles.bookingCard}>
                    <TouchableOpacity
                      onPress={() => onSelectBooking(b.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.bookingIdWrap}>
                          <Text style={styles.bookingIdText}>{b.id}</Text>
                        </View>

                        <View
                          style={[
                            styles.dispatchBadge,
                            isAssigned ? styles.badgeAssigned : styles.badgeUnassigned,
                          ]}
                        >
                          {isAssigned ? (
                            <CheckCircle2 size={12} color="#10B981" />
                          ) : (
                            <Clock size={12} color="#F59E0B" />
                          )}
                          <Text
                            style={[
                              styles.dispatchBadgeText,
                              isAssigned ? styles.textAssigned : styles.textUnassigned,
                            ]}
                          >
                            {isAssigned ? 'LORRY ALLOCATED' : 'ASSIGNMENT PENDING'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.routeText}>
                        {b.origin} → {b.destination}
                      </Text>
                      <Text style={styles.materialText}>
                        {b.materialType} • {b.capacityMt} MT ({b.vehicleType})
                      </Text>

                      <View style={styles.rateRow}>
                        <Text style={styles.rateLabel}>Contract Value:</Text>
                        <Text style={styles.rateValue}>₹{b.rate?.toLocaleString('en-IN')}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Action Bar */}
                    <View style={styles.cardFooter}>
                      {isAssigned ? (
                        <TouchableOpacity
                          style={styles.viewTripBtn}
                          onPress={() => onViewTrip(b.tripId || b.id)}
                        >
                          <Navigation size={14} color="#10B981" />
                          <Text style={styles.viewTripText}>Manage Trip & Tracking</Text>
                          <ArrowRight size={13} color="#10B981" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.assignBtn}
                          onPress={() => onAssignFleet(b)}
                        >
                          <PlusCircle size={14} color="#FFFFFF" />
                          <Text style={styles.assignBtnText}>Assign Vehicle & Driver</Text>
                          <ArrowRight size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
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
  bookingsCol: {
    gap: 12,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingIdWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bookingIdText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAssigned: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeUnassigned: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  dispatchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textAssigned: {
    color: '#10B981',
  },
  textUnassigned: {
    color: '#F59E0B',
  },
  routeText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  materialText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rateLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  rateValue: {
    color: '#F05A22',
    fontSize: 15,
    fontWeight: '800',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    borderRadius: 8,
    paddingVertical: 9,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  viewTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 9,
  },
  viewTripText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
