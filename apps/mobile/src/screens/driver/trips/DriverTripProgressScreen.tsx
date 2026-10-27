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
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  MapPin,
  CheckCircle2,
  Navigation,
  Clock,
  ArrowRight,
  ShieldCheck,
  Radio,
  Phone,
  AlertTriangle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { driverService } from '../../../services/driverService';
import { DriverTripItem } from '../../../types';

interface DriverTripProgressScreenProps {
  tripId: string;
  onBack: () => void;
  onNavigateDeliveryConfirm: (tripId: string) => void;
  onNavigatePodUpload: (tripId: string) => void;
}

export const DriverTripProgressScreen: React.FC<DriverTripProgressScreenProps> = ({
  tripId,
  onBack,
  onNavigateDeliveryConfirm,
  onNavigatePodUpload,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const loadTrip = useCallback(async () => {
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
    loadTrip();
  }, [loadTrip]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrip();
  };

  const getMilestones = (currentStatus: string) => {
    const list = [
      { id: 'LORRY_ASSIGNED', title: 'Lorry Assigned to Driver', desc: 'Vehicle linked at loading gate' },
      { id: 'AT_LOADING', title: 'Weighment & Loading Completed', desc: 'Gross tare MT registered & LR signed' },
      { id: 'IN_TRANSIT', title: 'Commercial Highway Transit', desc: 'National freight corridor GPS active' },
      { id: 'AT_UNLOADING', title: 'Reached Consignee Destination', desc: 'Reported at unloading gate' },
      { id: 'DELIVERED', title: 'Cargo Delivered & Inspected', desc: 'Sign-off acknowledgment by receiver' },
      { id: 'COMPLETED', title: 'POD Verified & Trip Closed', desc: 'e-POD accepted; settlement approved' },
    ];

    const order = ['LORRY_ASSIGNED', 'AT_LOADING', 'IN_TRANSIT', 'AT_UNLOADING', 'DELIVERED', 'COMPLETED'];
    const currentIndex = order.indexOf(currentStatus);

    return list.map((m, index) => {
      const isCompleted = index < currentIndex;
      const isActive = index === currentIndex;
      return {
        ...m,
        isCompleted,
        isActive,
      };
    });
  };

  const handleAdvanceStatus = async () => {
    if (!trip) return;

    if (trip.tripStatus === 'IN_TRANSIT') {
      setAdvancing(true);
      await driverService.updateTripMilestone(trip.id, trip.bookingId, 'AT_UNLOADING');
      setAdvancing(false);
      onNavigateDeliveryConfirm(trip.id);
    } else if (trip.tripStatus === 'AT_UNLOADING') {
      onNavigateDeliveryConfirm(trip.id);
    } else if (trip.tripStatus === 'DELIVERED') {
      onNavigatePodUpload(trip.id);
    } else {
      Alert.alert('Notice', 'Trip is already at milestone: ' + trip.tripStatus);
    }
  };

  const milestones = trip ? getMilestones(trip.tripStatus) : [];

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
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : !trip ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF' }}>Trip not found.</Text>
          </View>
        ) : (
          <>
            {/* Live Transit Banner */}
            <View style={styles.liveBanner}>
              <View style={styles.bannerTop}>
                <View style={styles.radioPill}>
                  <Radio size={14} color="#10B981" />
                  <Text style={styles.radioText}>GPS TRACKING ACTIVE</Text>
                </View>
                <Text style={styles.tripId}>
                  #{trip.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
                </Text>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.cityCol}>
                  <Text style={styles.cityLabel}>ORIGIN</Text>
                  <Text style={styles.cityName}>{trip.origin}</Text>
                </View>
                <Truck size={22} color="#F05A22" />
                <View style={[styles.cityCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.cityLabel}>DESTINATION</Text>
                  <Text style={styles.cityName}>{trip.destination}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.gpsNavBtn}
                onPress={() => driverService.openNavigation(trip.destinationAddress, trip.destination)}
                activeOpacity={0.85}
              >
                <Navigation size={16} color="#FFFFFF" />
                <Text style={styles.gpsNavText}>Navigate to Destination Unloading Gate</Text>
              </TouchableOpacity>
            </View>

            {/* Consignment Milestones Stepper */}
            <View style={styles.stepperCard}>
              <Text style={styles.stepperCardTitle}>Trip Progression Milestones</Text>

              <View style={styles.milestoneList}>
                {milestones.map((m, idx) => {
                  const isLast = idx === milestones.length - 1;

                  return (
                    <View key={m.id} style={styles.milestoneRow}>
                      <View style={styles.indicatorCol}>
                        <View
                          style={[
                            styles.dot,
                            m.isCompleted && styles.dotCompleted,
                            m.isActive && styles.dotActive,
                          ]}
                        >
                          {m.isCompleted ? (
                            <CheckCircle2 size={13} color="#FFFFFF" />
                          ) : m.isActive ? (
                            <View style={styles.activeInnerDot} />
                          ) : (
                            <Text style={styles.inactiveNum}>{idx + 1}</Text>
                          )}
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.connectorLine,
                              m.isCompleted && styles.connectorLineCompleted,
                            ]}
                          />
                        )}
                      </View>

                      <View style={styles.milestoneContent}>
                        <Text
                          style={[
                            styles.milestoneTitle,
                            m.isActive && styles.milestoneTitleActive,
                            m.isCompleted && styles.milestoneTitleCompleted,
                          ]}
                        >
                          {m.title}
                        </Text>
                        <Text style={styles.milestoneDesc}>{m.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Fast Action CTA */}
            {trip.tripStatus === 'IN_TRANSIT' && (
              <TouchableOpacity
                style={[styles.goldPillBtn, advancing && styles.goldPillBtnDisabled]}
                onPress={handleAdvanceStatus}
                disabled={advancing}
                activeOpacity={0.85}
              >
                {advancing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.goldPillText}>Arrived at Destination Gate</Text>
                    <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </>
                )}
              </TouchableOpacity>
            )}

            {(trip.tripStatus === 'AT_UNLOADING' || trip.tripStatus === 'DELIVERED') && (
              <TouchableOpacity
                style={styles.goldPillBtn}
                onPress={() => onNavigatePodUpload(trip.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.goldPillText}>Proceed to POD Upload</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            )}

            {/* Emergency SOS Highway Hotline */}
            <View style={styles.sosCard}>
              <View style={styles.sosLeft}>
                <AlertTriangle size={20} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sosTitle}>Highway Breakdown or Incident?</Text>
                  <Text style={styles.sosSub}>24/7 National Operations Command Center</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.callSosBtn}
                onPress={() => driverService.callPhone('18002584567')}
              >
                <Phone size={14} color="#FFFFFF" />
                <Text style={styles.callSosText}>SOS Call</Text>
              </TouchableOpacity>
            </View>
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
  liveBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 16,
    marginBottom: 14,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  radioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  radioText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tripId: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  gpsNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    borderRadius: 12,
    height: 44,
  },
  gpsNavText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  stepperCardTitle: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  milestoneList: {
    gap: 0,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 52,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#7C7E86',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  dotActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F05A22',
  },
  activeInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  inactiveNum: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  connectorLineCompleted: {
    backgroundColor: '#10B981',
  },
  milestoneContent: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 12,
  },
  milestoneTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  milestoneTitleActive: {
    color: '#F05A22',
    fontWeight: '800',
  },
  milestoneTitleCompleted: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  milestoneDesc: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  goldPillBtnDisabled: {
    opacity: 0.6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  sosLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sosTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sosSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  callSosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  callSosText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
