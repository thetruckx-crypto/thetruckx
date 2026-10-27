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
  History,
  Truck,
  CheckCircle2,
  Calendar,
  FileCheck2,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { driverService } from '../../../services/driverService';
import { DriverTripItem } from '../../../types';

interface DriverTripHistoryScreenProps {
  driverId?: string;
  onBack: () => void;
  onSelectTrip: (tripId: string) => void;
}

export const DriverTripHistoryScreen: React.FC<DriverTripHistoryScreenProps> = ({
  driverId,
  onBack,
  onSelectTrip,
}) => {
  const [trips, setTrips] = useState<DriverTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await driverService.getDriverTripHistory(driverId || 'drv-temp');
      setTrips(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" theme="light" />
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
            Driver <Text style={styles.goldText}>Trip History</Text>
          </Text>
          <Text style={styles.subText}>
            Archive of all successfully delivered commercial consignments with verified e-POD records.
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyCard}>
            <History size={36} color="#7C7E86" />
            <Text style={styles.emptyTitle}>No Completed Trips Yet</Text>
            <Text style={styles.emptySub}>
              Once you deliver consignments and upload the counter-signed POD, they will be archived here.
            </Text>
          </View>
        ) : (
          <View style={styles.tripList}>
            {trips.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.tripCard}
                onPress={() => onSelectTrip(item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.podBadge}>
                    <CheckCircle2 size={12} color="#10B981" />
                    <Text style={styles.podBadgeText}>e-POD VERIFIED</Text>
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
                  <Truck size={16} color="#F05A22" />
                  <View style={[styles.cityCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.nodeLabel}>TO</Text>
                    <Text style={styles.cityName}>{item.destination}</Text>
                  </View>
                </View>

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
                    <Text style={styles.metaLabel}>PAYOUT</Text>
                    <Text style={[styles.metaVal, { color: '#F05A22' }]}>₹{item.rate}</Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.completedDate}>
                    Delivered on {item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-IN') : 'Recent'}
                  </Text>
                  <View style={styles.viewRow}>
                    <Text style={styles.viewText}>View Summary</Text>
                    <ArrowRight size={13} color="#F05A22" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 16,
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
  tripList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  podBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  podBadgeText: {
    color: '#10B981',
    fontSize: 10,
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
    marginBottom: 10,
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
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
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
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  completedDate: {
    color: '#64748B',
    fontSize: 11,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewText: {
    color: '#F05A22',
    fontSize: 11.5,
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
