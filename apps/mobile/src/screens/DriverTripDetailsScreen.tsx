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
  Linking,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  MapPin,
  Phone,
  Navigation,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Calendar,
  Layers,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { driverService } from '../services/driverService';
import { DriverTripItem } from '../types';

interface DriverTripDetailsScreenProps {
  tripId: string;
  onBack: () => void;
  onNavigateProgress: (tripId: string) => void;
  onNavigatePickupConfirm: (tripId: string) => void;
  onNavigateDeliveryConfirm: (tripId: string) => void;
  onNavigatePodUpload: (tripId: string) => void;
}

export const DriverTripDetailsScreen: React.FC<DriverTripDetailsScreenProps> = ({
  tripId,
  onBack,
  onNavigateProgress,
  onNavigatePickupConfirm,
  onNavigateDeliveryConfirm,
  onNavigatePodUpload,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetails = useCallback(async () => {
    try {
      const data = await driverService.getTripDetails(tripId);
      setTrip(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDetails();
  };

  const getNextAction = (t: DriverTripItem) => {
    switch (t.tripStatus) {
      case 'LORRY_ASSIGNED':
      case 'AT_LOADING':
        return {
          title: 'Confirm Pickup & Start Transit',
          onPress: () => onNavigatePickupConfirm(t.id),
        };
      case 'IN_TRANSIT':
        return {
          title: 'Update Milestones & Track Route',
          onPress: () => onNavigateProgress(t.id),
        };
      case 'AT_UNLOADING':
        return {
          title: 'Confirm Unloading & Delivery',
          onPress: () => onNavigateDeliveryConfirm(t.id),
        };
      case 'DELIVERED':
        return {
          title: 'Upload Stamped e-POD',
          onPress: () => onNavigatePodUpload(t.id),
        };
      default:
        return {
          title: 'View In-Transit Milestones',
          onPress: () => onNavigateProgress(t.id),
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
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
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : !trip ? (
          <View style={styles.emptyWrap}>
            <Text style={{ color: '#FFFFFF' }}>Trip not found.</Text>
          </View>
        ) : (
          <>
            {/* Header Card */}
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{trip.tripStatus.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.tripId}>
                  #{trip.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
                </Text>
              </View>

              <View style={styles.routeHeaderRow}>
                <View style={styles.cityCol}>
                  <Text style={styles.cityLabel}>LOADING ORIGIN</Text>
                  <Text style={styles.cityName}>{trip.origin}</Text>
                </View>
                <Truck size={20} color="#F05A22" />
                <View style={[styles.cityCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.cityLabel}>DESTINATION</Text>
                  <Text style={styles.cityName}>{trip.destination}</Text>
                </View>
              </View>
            </View>

            {/* Pickup Node Card */}
            <View style={styles.nodeCard}>
              <View style={styles.nodeHeader}>
                <View style={styles.nodeIconWrapGreen}>
                  <MapPin size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeType}>CONSIGNOR PICKUP ADDRESS</Text>
                  <Text style={styles.nodeAddress}>{trip.pickupAddress}</Text>
                </View>
              </View>

              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{trip.pickupContactName || 'Warehouse Loading Desk'}</Text>
                  <Text style={styles.contactPhone}>{trip.pickupContactPhone || '+91 98480 11223'}</Text>
                </View>
                <View style={styles.actionPillRow}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => driverService.callPhone(trip.pickupContactPhone || '+91 98480 11223')}
                    accessibilityLabel="Call Consignor"
                  >
                    <Phone size={18} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionNavBtn}
                    onPress={() => driverService.openNavigation(trip.pickupAddress, trip.origin)}
                    accessibilityLabel="Navigate to Pickup"
                  >
                    <Navigation size={16} color="#38BDF8" />
                    <Text style={styles.actionNavText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Destination Node Card */}
            <View style={styles.nodeCard}>
              <View style={styles.nodeHeader}>
                <View style={styles.nodeIconWrapOrange}>
                  <MapPin size={16} color="#F05A22" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeType}>CONSIGNEE DELIVERY ADDRESS</Text>
                  <Text style={styles.nodeAddress}>{trip.destinationAddress}</Text>
                </View>
              </View>

              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{trip.dropContactName || 'Receiving In-charge'}</Text>
                  <Text style={styles.contactPhone}>{trip.dropContactPhone || '+91 98490 33445'}</Text>
                </View>
                <View style={styles.actionPillRow}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => driverService.callPhone(trip.dropContactPhone || '+91 98490 33445')}
                    accessibilityLabel="Call Consignee"
                  >
                    <Phone size={18} color="#F05A22" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionNavBtn}
                    onPress={() => driverService.openNavigation(trip.destinationAddress, trip.destination)}
                    accessibilityLabel="Navigate to Delivery"
                  >
                    <Navigation size={16} color="#38BDF8" />
                    <Text style={styles.actionNavText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Cargo & Lorry Specs Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Package size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Cargo & Vehicle Specifications</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Consigned Material:</Text>
                <Text style={styles.value}>{trip.material}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Consignment Tonnage:</Text>
                <Text style={styles.value}>{trip.capacityMt} MT</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Assigned Vehicle:</Text>
                <Text style={styles.value}>{trip.vehicleNumber} ({trip.vehicleType})</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Transporter:</Text>
                <Text style={styles.value}>{trip.vendorName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Contracted Freight:</Text>
                <Text style={[styles.value, { color: '#F05A22' }]}>₹{trip.rate}</Text>
              </View>
            </View>

            {/* 24/7 Operations Control Support Strip */}
            <View style={styles.controlRoomStrip}>
              <View style={{ flex: 1 }}>
                <Text style={styles.controlRoomTitle}>24/7 NECL Ops Control Room</Text>
                <Text style={styles.controlRoomSub}>Highway breakdown or route assistance</Text>
              </View>
              <TouchableOpacity
                style={styles.controlCallBtn}
                onPress={() => driverService.callPhone('1800-200-8899')}
                activeOpacity={0.8}
              >
                <Phone size={15} color="#FFFFFF" />
                <Text style={styles.controlCallText}>Call Ops</Text>
              </TouchableOpacity>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={styles.goldPillBtn}
              onPress={getNextAction(trip).onPress}
              activeOpacity={0.85}
            >
              <Text style={styles.goldPillText}>{getNextAction(trip).title}</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </>
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
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusPill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#F05A22',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripId: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityCol: {
    flex: 1,
  },
  cityLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  cityName: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  nodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  nodeIconWrapGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIconWrapOrange: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(240, 90, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeType: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nodeAddress: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  contactName: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  contactPhone: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  actionPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 44,
  },
  actionNavText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
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
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  value: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
  },
  controlRoomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  controlRoomTitle: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  controlRoomSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  controlCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  controlCallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
});
