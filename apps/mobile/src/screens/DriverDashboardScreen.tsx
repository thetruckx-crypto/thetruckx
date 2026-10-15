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
  Modal,
  Alert,
} from 'react-native';
import {
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  FileText,
  History,
  Phone,
  Bell,
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Layers,
  Sun,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { driverService } from '../services/driverService';
import { DriverTripItem } from '../types';
import { supabase } from '../supabase';

interface DriverDashboardScreenProps {
  initialMobile: string;
  driverId?: string;
  onNavigateTrips: () => void;
  onNavigateTripDetails: (tripId: string) => void;
  onNavigateTripProgress: (tripId: string) => void;
  onNavigatePickupConfirm: (tripId: string) => void;
  onNavigateDeliveryConfirm: (tripId: string) => void;
  onNavigatePodUpload: (tripId: string) => void;
  onNavigateTripHistory: () => void;
  onNavigateDocuments: () => void;
  onNavigateNotifications: () => void;
  onNavigateProfile: () => void;
  onNavigateSettings: () => void;
  onNavigateHelpSupport: () => void;
  onLogout: () => void;
}

export const DriverDashboardScreen: React.FC<DriverDashboardScreenProps> = ({
  initialMobile,
  driverId,
  onNavigateTrips,
  onNavigateTripDetails,
  onNavigateTripProgress,
  onNavigatePickupConfirm,
  onNavigateDeliveryConfirm,
  onNavigatePodUpload,
  onNavigateTripHistory,
  onNavigateDocuments,
  onNavigateNotifications,
  onNavigateProfile,
  onNavigateSettings,
  onNavigateHelpSupport,
  onLogout,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [trips, setTrips] = useState<DriverTripItem[]>([]);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [sunlightMode, setSunlightMode] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profile, tripList] = await Promise.all([
        driverService.getDriverProfile(driverId, initialMobile),
        driverService.getDriverTrips(driverId || 'drv-temp'),
      ]);
      setDriverProfile(profile);
      setTrips(tripList);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId, initialMobile]);

  useEffect(() => {
    loadData();

    // Live Supabase Realtime sync for driver trips
    const channel = supabase
      .channel('driver_dashboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeTrip = trips.find(
    (t) => t.tripStatus === 'IN_TRANSIT' || t.tripStatus === 'AT_LOADING' || t.tripStatus === 'AT_UNLOADING' || t.tripStatus === 'LORRY_ASSIGNED'
  );

  const completedTripsCount = trips.filter((t) => t.tripStatus === 'COMPLETED').length;
  const assignedLoadsCount = trips.filter((t) => t.tripStatus === 'LORRY_ASSIGNED').length;

  const getActionForTrip = (trip: DriverTripItem) => {
    if (trip.tripStatus === 'LORRY_ASSIGNED' || trip.tripStatus === 'AT_LOADING') {
      return {
        label: 'Confirm Pickup & Dispatch',
        action: () => onNavigatePickupConfirm(trip.id),
      };
    }
    if (trip.tripStatus === 'IN_TRANSIT') {
      return {
        label: 'View Live Route & Milestones',
        action: () => onNavigateTripProgress(trip.id),
      };
    }
    if (trip.tripStatus === 'AT_UNLOADING' || trip.tripStatus === 'DELIVERED') {
      return {
        label: 'Upload POD & Complete Trip',
        action: () => onNavigatePodUpload(trip.id),
      };
    }
    return {
      label: 'View Trip Details',
      action: () => onNavigateTripDetails(trip.id),
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoWrap}>
          <BrandLogoHeader size="sm" theme="light" />
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.iconCircleBtn, sunlightMode && styles.sunlightActiveBtn]}
            onPress={() => setSunlightMode(!sunlightMode)}
            accessibilityLabel="Toggle Sunlight Mode"
          >
            <Sun size={18} color={sunlightMode ? '#F59E0B' : '#D4D6DB'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={onNavigateNotifications}
            accessibilityLabel="Notifications"
          >
            <Bell size={18} color="#64748B" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => setMenuModalVisible(true)}
            accessibilityLabel="Driver Profile Menu"
          >
            <User size={18} color="#F05A22" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F05A22" />
        }
      >
        {/* Driver Identity Card */}
        <View style={[styles.pilotCard, sunlightMode && styles.pilotCardSunlight]}>
          <View style={styles.pilotInfoCol}>
            <View style={styles.badgeRow}>
              <View style={styles.verifiedPill}>
                <ShieldCheck size={13} color="#10B981" />
                <Text style={styles.verifiedText}>NECL VERIFIED PILOT</Text>
              </View>
            </View>
            <Text style={[styles.driverName, sunlightMode && { color: '#0F172A' }]}>
              {driverProfile?.fullName || 'Commercial Driver'}
            </Text>
            <Text style={[styles.licenceNo, sunlightMode && { color: '#475569' }]}>
              {driverProfile?.licenceNumber ? `DL: ${driverProfile.licenceNumber}` : 'DL Pending Verification'}{driverProfile?.vendorName ? ` • ${driverProfile.vendorName}` : ''}
            </Text>
          </View>
          <View style={[styles.truckMarkWrap, sunlightMode && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Truck size={28} color={sunlightMode ? '#B45309' : '#F05A22'} />
          </View>
        </View>

        {/* Live Active Trip Card */}
        {activeTrip ? (
          <View style={[styles.activeTripCard, sunlightMode && styles.activeTripCardSunlight]}>
            <View style={[styles.tripCardHeader, sunlightMode && { borderBottomColor: '#E2E8F0' }]}>
              <View style={styles.pulseLiveIndicator}>
                <View style={styles.pulsingDot} />
                <Text style={[styles.liveIndicatorText, sunlightMode && { color: '#B45309' }]}>
                  {activeTrip.tripStatus === 'IN_TRANSIT' ? 'LIVE IN TRANSIT' : 'CURRENT ASSIGNED LOAD'}
                </Text>
              </View>
              <Text style={[styles.tripIdText, sunlightMode && { color: '#475569' }]}>
                #{activeTrip.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
              </Text>
            </View>

            {/* Route */}
            <View style={styles.routeContainer}>
              <View style={styles.routeCol}>
                <Text style={[styles.routeNodeLabel, sunlightMode && { color: '#64748B' }]}>PICKUP</Text>
                <Text style={[styles.routeCityName, sunlightMode && { color: '#0F172A' }]}>{activeTrip.origin}</Text>
                <Text style={[styles.routeAddress, sunlightMode && { color: '#334155' }]} numberOfLines={1}>
                  {activeTrip.pickupAddress}
                </Text>
              </View>

              <View style={styles.routeTruckDivider}>
                <View style={[styles.routeDash, sunlightMode && { backgroundColor: '#CBD5E1' }]} />
                <View style={styles.truckIconCircle}>
                  <Truck size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.routeDash, sunlightMode && { backgroundColor: '#CBD5E1' }]} />
              </View>

              <View style={styles.routeCol}>
                <Text style={[styles.routeNodeLabel, sunlightMode && { color: '#64748B' }]}>DESTINATION</Text>
                <Text style={[styles.routeCityName, sunlightMode && { color: '#0F172A' }]}>{activeTrip.destination}</Text>
                <Text style={[styles.routeAddress, sunlightMode && { color: '#334155' }]} numberOfLines={1}>
                  {activeTrip.destinationAddress}
                </Text>
              </View>
            </View>

            {/* Meta Strip */}
            <View style={[styles.tripMetaStrip, sunlightMode && styles.tripMetaStripSunlight]}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, sunlightMode && { color: '#64748B' }]}>CARGO</Text>
                <Text style={[styles.metaVal, sunlightMode && { color: '#0F172A' }]}>{activeTrip.material}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, sunlightMode && { color: '#64748B' }]}>VEHICLE</Text>
                <Text style={[styles.metaVal, sunlightMode && { color: '#0F172A' }]}>{activeTrip.vehicleNumber}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, sunlightMode && { color: '#64748B' }]}>ADVANCE</Text>
                <Text style={[styles.metaVal, { color: sunlightMode ? '#B45309' : '#F05A22' }]}>{activeTrip.rate ? `₹${activeTrip.rate}` : 'Trip Sheet'}</Text>
              </View>
            </View>

            {/* Action Bar */}
            <View style={styles.tripActionRow}>
              <TouchableOpacity
                style={[styles.navMapBtn, sunlightMode && styles.navMapBtnSunlight]}
                onPress={() => driverService.openNavigation(activeTrip.pickupAddress, activeTrip.origin)}
                activeOpacity={0.8}
              >
                <Navigation size={18} color="#059669" />
                <Text style={[styles.navMapBtnText, { color: '#059669' }]}>Maps Nav</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mainTripBtn}
                onPress={getActionForTrip(activeTrip).action}
                activeOpacity={0.85}
              >
                <Text style={styles.mainTripBtnText}>{getActionForTrip(activeTrip).label}</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noActiveTripCard}>
            <Truck size={32} color="#7C7E86" />
            <Text style={styles.noActiveTitle}>No Active Trip in Progress</Text>
            <Text style={styles.noActiveDesc}>
              You are ready on duty. When NECL or your transporter assigns a load, it will appear here instantly.
            </Text>
            <TouchableOpacity style={styles.viewAssignedBtn} onPress={onNavigateTrips}>
              <Text style={styles.viewAssignedBtnText}>View All Assigned Trips</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Metric Counters Strip */}
        <View style={styles.metricsRow}>
          <TouchableOpacity style={styles.metricCard} onPress={onNavigateTrips}>
            <Layers size={18} color="#F05A22" />
            <Text style={styles.metricVal}>{assignedLoadsCount}</Text>
            <Text style={styles.metricLabel}>Assigned Loads</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metricCard} onPress={onNavigateTrips}>
            <Navigation size={18} color="#10B981" />
            <Text style={styles.metricVal}>{activeTrip ? 1 : 0}</Text>
            <Text style={styles.metricLabel}>In Transit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metricCard} onPress={onNavigateTripHistory}>
            <CheckCircle2 size={18} color="#3B82F6" />
            <Text style={styles.metricVal}>{completedTripsCount}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </TouchableOpacity>
        </View>

        {/* Fast Action Grid */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeadingText}>Quick Operations</Text>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateTrips}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Truck size={20} color="#F05A22" />
            </View>
            <Text style={styles.gridActionTitle}>My Assigned Trips</Text>
            <Text style={styles.gridActionSub}>View active loads & routes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateDocuments}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <FileText size={20} color="#10B981" />
            </View>
            <Text style={styles.gridActionTitle}>Driver Documents</Text>
            <Text style={styles.gridActionSub}>DL validity & credentials</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateTripHistory}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <History size={20} color="#3B82F6" />
            </View>
            <Text style={styles.gridActionTitle}>Trip History</Text>
            <Text style={styles.gridActionSub}>Past completed consignments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateHelpSupport}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Phone size={20} color="#EF4444" />
            </View>
            <Text style={styles.gridActionTitle}>24/7 Highway SOS</Text>
            <Text style={styles.gridActionSub}>Emergency desk & breakdown</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Profile & Logout Modal */}
      <Modal
        visible={menuModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuModalVisible(false)}
        >
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <View style={styles.menuAvatarWrap}>
                <User size={22} color="#F05A22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuUserName}>{driverProfile?.fullName || 'Commercial Driver'}</Text>
                <Text style={styles.menuUserMobile}>{initialMobile ? `+91 ${initialMobile}` : 'Mobile Verified'}</Text>
                <Text style={styles.menuUserRole}>Commercial Heavy Pilot</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                onNavigateProfile();
              }}
            >
              <User size={18} color="#64748B" />
              <Text style={styles.menuItemText}>My Profile</Text>
              <ChevronRight size={16} color="#7C7E86" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                onNavigateDocuments();
              }}
            >
              <FileText size={18} color="#D4D6DB" />
              <Text style={styles.menuItemText}>Driver Documents & DL</Text>
              <ChevronRight size={16} color="#7C7E86" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                onNavigateSettings();
              }}
            >
              <Settings size={18} color="#64748B" />
              <Text style={styles.menuItemText}>Settings</Text>
              <ChevronRight size={16} color="#7C7E86" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuModalVisible(false);
                onNavigateHelpSupport();
              }}
            >
              <HelpCircle size={18} color="#64748B" />
              <Text style={styles.menuItemText}>Help & Support</Text>
              <ChevronRight size={16} color="#7C7E86" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.menuItem, { marginBottom: 4 }]}
              onPress={() => {
                setMenuModalVisible(false);
                onLogout();
              }}
            >
              <LogOut size={18} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  logoWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F05A22',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunlightActiveBtn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  pilotCardSunlight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    elevation: 2,
  },
  activeTripCardSunlight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F59E0B',
    borderWidth: 2,
    elevation: 4,
  },
  tripMetaStripSunlight: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navMapBtnSunlight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  pilotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  pilotInfoCol: {
    flex: 1,
  },
  badgeRow: {
    marginBottom: 4,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  driverName: {
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  licenceNo: {
    color: '#64748B',
    fontSize: 11.5,
    marginTop: 2,
  },
  truckMarkWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 16,
    marginBottom: 16,
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pulseLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  liveIndicatorText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripIdText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  routeCol: {
    flex: 1,
  },
  routeNodeLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeCityName: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  routeAddress: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  routeTruckDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  routeDash: {
    width: 14,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  truckIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  tripMetaStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
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
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  tripActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
  },
  navMapBtnText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '800',
  },
  mainTripBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    borderRadius: 14,
    height: 54,
    elevation: 3,
  },
  mainTripBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  noActiveTripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  noActiveTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  noActiveDesc: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 14,
  },
  viewAssignedBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewAssignedBtnText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
  },
  metricVal: {
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeadingWrap: {
    marginBottom: 12,
  },
  sectionHeadingText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridActionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  gridIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridActionTitle: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '700',
  },
  gridActionSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-start',
    paddingTop: 65,
    paddingHorizontal: 16,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuUserName: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '700',
  },
  menuUserMobile: {
    color: '#64748B',
    fontSize: 12,
  },
  menuUserRole: {
    color: '#F05A22',
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  menuItemText: {
    color: '#172B4D',
    fontSize: 13.5,
    fontWeight: '600',
    flex: 1,
  },
});
