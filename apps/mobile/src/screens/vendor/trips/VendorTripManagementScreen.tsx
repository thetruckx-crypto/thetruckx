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
  Navigation,
  Truck,
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
  Package,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorTripManagementScreenProps {
  vendorId: string;
  onBack: () => void;
  onSelectTrip: (tripId: string) => void;
}

export const VendorTripManagementScreen: React.FC<VendorTripManagementScreenProps> = ({
  vendorId,
  onBack,
  onSelectTrip,
}) => {
  const [trips, setTrips] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const data = await vendorService.getVendorTrips(vendorId);
      setTrips(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const filteredTrips = trips.filter((t) => {
    if (activeFilter === 'ACTIVE') {
      return t.tripStatus !== 'COMPLETED' && t.tripStatus !== 'CANCELLED';
    }
    if (activeFilter === 'COMPLETED') {
      return t.tripStatus === 'COMPLETED' || t.tripStatus === 'DELIVERED';
    }
    return true;
  });

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
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Trip <Text style={styles.goldText}>Management</Text>
            </Text>
            <Text style={styles.subText}>
              Monitor real-time status, driver progression, and delivery confirmations across national routes.
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
                All Trips ({trips.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ACTIVE' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ACTIVE')}
            >
              <Text style={[styles.filterText, activeFilter === 'ACTIVE' && styles.filterTextActive]}>
                Active In-Transit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'COMPLETED' && styles.filterPillActive]}
              onPress={() => setActiveFilter('COMPLETED')}
            >
              <Text style={[styles.filterText, activeFilter === 'COMPLETED' && styles.filterTextActive]}>
                Completed
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : filteredTrips.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Trips Found</Text>
              <Text style={styles.emptySub}>
                When bookings are awarded and vehicles are assigned, trips appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.tripsCol}>
              {filteredTrips.map((t) => {
                const isCompleted = t.tripStatus === 'COMPLETED' || t.tripStatus === 'DELIVERED';

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.tripCard}
                    onPress={() => onSelectTrip(t.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.tripIdWrap}>
                        <Text style={styles.tripIdText}>{t.id.substring(0, 18)}</Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isCompleted ? styles.badgeCompleted : styles.badgeActive,
                        ]}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={11} color="#10B981" />
                        ) : (
                          <Clock size={11} color="#F05A22" />
                        )}
                        <Text
                          style={[
                            styles.statusText,
                            isCompleted ? styles.textCompleted : styles.textActive,
                          ]}
                        >
                          {t.tripStatus}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.routeText}>
                      {t.origin} → {t.destination}
                    </Text>

                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Truck size={12} color="#F05A22" />
                        <Text style={styles.infoText}>{t.vehicleNumber}</Text>
                      </View>

                      <View style={styles.infoItem}>
                        <Users size={12} color="#F05A22" />
                        <Text style={styles.infoText}>{t.driverName}</Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.valLabel}>CARRIER FREIGHT</Text>
                        <Text style={styles.valText}>₹{t.rate?.toLocaleString('en-IN')}</Text>
                      </View>

                      <View style={styles.ctaWrap}>
                        <Text style={styles.ctaText}>Manage Lifecycle & POD</Text>
                        <ArrowRight size={13} color="#F05A22" />
                      </View>
                    </View>
                  </TouchableOpacity>
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  filterText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  tripsCol: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripIdWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tripIdText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: '#FFF7ED',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textActive: {
    color: '#F05A22',
  },
  textCompleted: {
    color: '#10B981',
  },
  routeText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  valLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  valText: {
    color: '#F05A22',
    fontSize: 14,
    fontWeight: '800',
  },
  ctaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    color: '#F05A22',
    fontSize: 11,
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
