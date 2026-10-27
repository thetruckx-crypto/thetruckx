import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  Search,
  Truck,
  MapPin,
  Navigation,
  ArrowRight,
  Filter,
  Layers,
  Calendar,
} from 'lucide-react-native';
import { driverService } from '../../../services/driverService';
import { DriverTripItem } from '../../../types';

interface DriverAssignedTripsScreenProps {
  driverId?: string;
  onBack: () => void;
  onSelectTrip: (tripId: string) => void;
}

export const DriverAssignedTripsScreen: React.FC<DriverAssignedTripsScreenProps> = ({
  driverId,
  onBack,
  onSelectTrip,
}) => {
  const [trips, setTrips] = useState<DriverTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'ASSIGNED' | 'COMPLETED'>('ALL');

  const loadTrips = useCallback(async () => {
    try {
      const data = await driverService.getDriverTrips(driverId || 'drv-temp');
      setTrips(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const filteredTrips = trips.filter((t) => {
    // Tab filter
    if (activeTab === 'ACTIVE' && t.tripStatus !== 'IN_TRANSIT' && t.tripStatus !== 'AT_LOADING' && t.tripStatus !== 'AT_UNLOADING') {
      return false;
    }
    if (activeTab === 'ASSIGNED' && t.tripStatus !== 'LORRY_ASSIGNED') {
      return false;
    }
    if (activeTab === 'COMPLETED' && t.tripStatus !== 'COMPLETED' && t.tripStatus !== 'DELIVERED') {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrigin = t.origin.toLowerCase().includes(q);
      const matchDest = t.destination.toLowerCase().includes(q);
      const matchMat = t.material.toLowerCase().includes(q);
      const matchVehicle = t.vehicleNumber.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      return matchOrigin || matchDest || matchMat || matchVehicle || matchId;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return { label: 'In Transit', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'AT_LOADING':
        return { label: 'At Loading Gate', color: '#F05A22', bg: '#FFF7ED' };
      case 'AT_UNLOADING':
        return { label: 'At Unloading Gate', color: '#F05A22', bg: 'rgba(240, 90, 34, 0.12)' };
      case 'DELIVERED':
        return { label: 'Delivered (Pending POD)', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
      case 'COMPLETED':
        return { label: 'Completed', color: '#64748B', bg: 'rgba(144, 146, 153, 0.12)' };
      default:
        return { label: 'Lorry Assigned', color: '#F05A22', bg: '#FFF7ED' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Assigned Trips</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F05A22" />
        }
      >
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Assigned <Text style={styles.goldText}>Freight Trips</Text>
          </Text>
          <Text style={styles.subText}>
            Commercial loads authorized for your vehicle. Tap a trip to update milestones or start GPS navigation.
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Search size={16} color="#7C7E86" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city, consignment, vehicle..."
            placeholderTextColor="#5C5E66"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <View style={styles.tabsRow}>
            {(['ALL', 'ACTIVE', 'ASSIGNED', 'COMPLETED'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>
                  {tab === 'ALL' ? 'All Trips' : tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Trip List */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Truck size={36} color="#7C7E86" />
            <Text style={styles.emptyTitle}>No Trips Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? 'No trips match your search filter.' : 'No trips currently assigned in this category.'}
            </Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {filteredTrips.map((item) => {
              const badge = getStatusBadge(item.tripStatus);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.tripCard}
                  onPress={() => onSelectTrip(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text style={styles.tripRef}>
                      #{item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
                    </Text>
                  </View>

                  {/* Route */}
                  <View style={styles.routeRow}>
                    <View style={styles.cityCol}>
                      <Text style={styles.nodeLabel}>FROM</Text>
                      <Text style={styles.cityName}>{item.origin}</Text>
                    </View>
                    <View style={styles.routeDivider}>
                      <View style={styles.dash} />
                      <Truck size={14} color="#F05A22" />
                      <View style={styles.dash} />
                    </View>
                    <View style={styles.cityCol}>
                      <Text style={styles.nodeLabel}>TO</Text>
                      <Text style={styles.cityName}>{item.destination}</Text>
                    </View>
                  </View>

                  <Text style={styles.addressLine} numberOfLines={1}>
                    Pickup: {item.pickupAddress}
                  </Text>

                  {/* Meta Strip */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>CARGO</Text>
                      <Text style={styles.metaVal}>{item.material}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>VEHICLE</Text>
                      <Text style={styles.metaVal}>{item.vehicleNumber}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>RATE</Text>
                      <Text style={[styles.metaVal, { color: '#F05A22' }]}>₹{item.rate || '28,500'}</Text>
                    </View>
                  </View>

                  {/* Card Bottom Actions */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        driverService.openNavigation(item.pickupAddress, item.origin);
                      }}
                    >
                      <Navigation size={13} color="#F05A22" />
                      <Text style={styles.navBtnText}>Navigate</Text>
                    </TouchableOpacity>

                    <View style={styles.viewDetailsRow}>
                      <Text style={styles.viewDetailsText}>Trip Details</Text>
                      <ArrowRight size={14} color="#F05A22" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headingWrap: {
    marginBottom: 14,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13,
  },
  tabScroll: {
    marginBottom: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    backgroundColor: '#14161E',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  tabPillText: {
    color: '#64748B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tripList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripRef: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cityCol: {
    flex: 1,
  },
  nodeLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  cityName: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  dash: {
    width: 12,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  addressLine: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  metaVal: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E212A',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navBtnText: {
    color: '#F05A22',
    fontSize: 11.5,
    fontWeight: '700',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
