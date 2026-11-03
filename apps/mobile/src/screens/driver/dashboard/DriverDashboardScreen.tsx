import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { driverService } from '../../../services/driverService';
import { DriverTripItem } from '../../../types';
import { supabase } from '../../../supabase';
import { formatDisplayId } from '../../../utils/idGenerator';

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
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
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

  const activeTrip = useMemo(() => {
    return trips.find(
      (t) => t.tripStatus === 'IN_TRANSIT' || t.tripStatus === 'AT_LOADING' || t.tripStatus === 'AT_UNLOADING' || t.tripStatus === 'LORRY_ASSIGNED'
    );
  }, [trips]);

  const completedTripsCount = useMemo(() => trips.filter((t) => t.tripStatus === 'COMPLETED').length, [trips]);
  const assignedLoadsCount = useMemo(() => trips.filter((t) => t.tripStatus === 'LORRY_ASSIGNED').length, [trips]);
  const isApproved = driverProfile?.status === 'APPROVED' || driverProfile?.verificationStatus === 'APPROVED';

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
      {/* Clean Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.headerLeftCol}>
          <Text style={styles.headerGreeting}>Welcome,</Text>
          <Text style={styles.headerDriverName} numberOfLines={1}>
            {driverProfile?.fullName || 'Commercial Pilot'}
          </Text>
          <View style={styles.headerStatusRow}>
            <View style={[styles.headerStatusDot, { backgroundColor: isApproved ? '#10B981' : '#F59E0B' }]} />
            <Text style={[styles.headerStatusText, { color: isApproved ? '#059669' : '#D97706' }]}>
              {isApproved ? 'Verified Pilot' : 'Verification Under Review'}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.cleanBellBtn}
            onPress={onNavigateNotifications}
            accessibilityLabel="Notifications"
          >
            <Bell size={24} color="#0F172A" />
            <View style={styles.cleanNotificationBadge}>
              <Text style={styles.cleanNotificationBadgeText}>1</Text>
            </View>
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
        {/* Real DB Driver Operational Status Card */}
        <View style={[styles.statusSummaryCard, sunlightMode && styles.pilotCardSunlight]}>
          <View style={styles.statusCol}>
            <Text style={styles.statusColLabel}>VERIFICATION</Text>
            <View style={styles.statusBadgeInline}>
              <ShieldCheck size={13} color={isApproved ? '#10B981' : '#F59E0B'} />
              <Text style={[styles.statusColVal, { color: isApproved ? '#10B981' : '#F59E0B' }]}>
                {isApproved ? 'Approved' : 'Under Review'}
              </Text>
            </View>
          </View>

          <View style={styles.statusColDivider} />

          <View style={styles.statusCol}>
            <Text style={styles.statusColLabel}>AVAILABILITY</Text>
            <View style={styles.statusBadgeInline}>
              <View style={[styles.statusDotLive, { backgroundColor: activeTrip ? '#3B82F6' : (isApproved ? '#10B981' : '#94A3B8') }]} />
              <Text style={styles.statusColVal}>
                {activeTrip ? 'In Transit' : (isApproved ? 'On Duty' : 'Pending')}
              </Text>
            </View>
          </View>

          <View style={styles.statusColDivider} />

          <View style={styles.statusCol}>
            <Text style={styles.statusColLabel}>ASSIGNED VEHICLE</Text>
            <Text style={[styles.statusColVal, { color: '#0F172A' }]} numberOfLines={1}>
              {activeTrip?.vehicleNumber || driverProfile?.vehicleRegistrationNumber || 'Fleet Dispatched'}
            </Text>
          </View>
        </View>

        {/* Driver Identity Card */}
        <View style={[styles.pilotCard, sunlightMode && styles.pilotCardSunlight]}>
          <View style={styles.pilotInfoCol}>
            <View style={styles.badgeRow}>
              <View style={styles.verifiedPill}>
                <ShieldCheck size={13} color="#10B981" />
                <Text style={styles.verifiedText}>TRUCKS VERIFIED PILOT</Text>
              </View>
            </View>
            <Text style={[styles.driverName, sunlightMode && { color: '#0F172A' }]}>
              {driverProfile?.fullName || 'Commercial Driver'}
            </Text>
            <Text style={[styles.licenceNo, sunlightMode && { color: '#475569' }]}>
              {driverProfile?.licenceNumber ? `DL: ${driverProfile.licenceNumber}` : 'DL Pending Verification'}{driverProfile?.vendorName ? ` • ${driverProfile.vendorName}` : ''}
            </Text>
            {/* Canonical Driver ID and Account ID Badges */}
            <View style={styles.idChipRow}>
              <View style={[styles.idChip, sunlightMode && styles.idChipSunlight]}>
                <Text style={styles.idChipLabel}>DRIVER ID</Text>
                <Text style={styles.idChipValue}>
                  {driverProfile?.driverCode || formatDisplayId('DR', driverProfile?.createdAt, driverProfile?.id || driverId)}
                </Text>
              </View>
              <View style={[styles.idChip, sunlightMode && styles.idChipSunlight]}>
                <Text style={styles.idChipLabel}>ACCOUNT ID</Text>
                <Text style={styles.idChipValue}>
                  {driverProfile?.accountId || formatDisplayId('AC', driverProfile?.createdAt, driverProfile?.id || driverId)}
                </Text>
              </View>
            </View>
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
                {activeTrip.tripCode || formatDisplayId('TR', activeTrip.startedAt, activeTrip.id)}
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
              You are ready on duty. When TRUCKS or your transporter assigns a load, it will appear here instantly.
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

        {/* Quick Actions Grid — 6 Operations */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeadingText}>Quick Actions</Text>
        </View>

        <View style={styles.actionsGrid}>
          {/* Card 1: My Verification */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateDocuments}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <ShieldCheck size={20} color="#10B981" />
            </View>
            <Text style={styles.gridActionTitle}>My Verification</Text>
            <Text style={styles.gridActionSub}>Credentials & licences</Text>
          </TouchableOpacity>

          {/* Card 2: My Trips */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateTrips}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Truck size={20} color="#F05A22" />
            </View>
            <Text style={styles.gridActionTitle}>My Trips</Text>
            <Text style={styles.gridActionSub}>Active dispatches & routes</Text>
          </TouchableOpacity>

          {/* Card 3: Vehicle Details */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={() => setVehicleModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(14, 165, 233, 0.12)' }]}>
              <Layers size={20} color="#0EA5E9" />
            </View>
            <Text style={styles.gridActionTitle}>Vehicle Details</Text>
            <Text style={styles.gridActionSub}>Assigned lorry & RC</Text>
          </TouchableOpacity>

          {/* Card 4: Notifications */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateNotifications}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Bell size={20} color="#F59E0B" />
            </View>
            <Text style={styles.gridActionTitle}>Notifications</Text>
            <Text style={styles.gridActionSub}>Dispatches & alerts</Text>
          </TouchableOpacity>

          {/* Card 5: Trip History */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateTripHistory}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <History size={20} color="#3B82F6" />
            </View>
            <Text style={styles.gridActionTitle}>Trip History</Text>
            <Text style={styles.gridActionSub}>Past completed loads</Text>
          </TouchableOpacity>

          {/* Card 6: Help & Support */}
          <TouchableOpacity
            style={styles.gridActionCard}
            onPress={onNavigateHelpSupport}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <HelpCircle size={20} color="#EF4444" />
            </View>
            <Text style={styles.gridActionTitle}>Help & Support</Text>
            <Text style={styles.gridActionSub}>24/7 Highway SOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Vehicle Details Modal */}
      <Modal
        visible={vehicleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVehicleModalVisible(false)}
        >
          <View style={styles.vehicleModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.vehicleModalHeader}>
              <View style={styles.vehicleModalIcon}>
                <Truck size={22} color="#F05A22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleModalTitle}>Assigned Vehicle Details</Text>
                <Text style={styles.vehicleModalSub}>THE TRUCKX Commercial Fleet Link</Text>
              </View>
            </View>

            <View style={styles.vehicleDetailRow}>
              <Text style={styles.vehicleDetailLabel}>Vehicle Registration</Text>
              <Text style={styles.vehicleDetailVal}>
                {activeTrip?.vehicleNumber || driverProfile?.vehicleRegistrationNumber || 'Assigned per Dispatch'}
              </Text>
            </View>
            <View style={styles.vehicleDetailRow}>
              <Text style={styles.vehicleDetailLabel}>Associated Transporter</Text>
              <Text style={styles.vehicleDetailVal}>{driverProfile?.vendorName || 'Independent Fleet Pilot'}</Text>
            </View>
            <View style={styles.vehicleDetailRow}>
              <Text style={styles.vehicleDetailLabel}>Vehicle Category</Text>
              <Text style={styles.vehicleDetailVal}>{driverProfile?.vehicleCategory || 'Heavy Commercial Vehicle (HCV)'}</Text>
            </View>
            <View style={styles.vehicleDetailRow}>
              <Text style={styles.vehicleDetailLabel}>GPS Telemetry Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <Text style={[styles.vehicleDetailVal, { color: '#10B981' }]}>Active GPS Tracking</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.vehicleModalCloseBtn}
              onPress={() => setVehicleModalVisible(false)}
            >
              <Text style={styles.vehicleModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeftCol: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerDriverName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  headerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cleanBellBtn: {
    padding: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanNotificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cleanNotificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  statusSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  statusCol: {
    flex: 1,
    alignItems: 'center',
  },
  statusColLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDotLive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusColVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  statusColDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  vehicleModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '90%',
    maxWidth: 400,
  },
  vehicleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vehicleModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  vehicleDetailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  vehicleDetailVal: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  vehicleModalCloseBtn: {
    marginTop: 18,
    backgroundColor: '#F05A22',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  vehicleModalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
  idChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  idChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  idChipSunlight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  idChipLabel: {
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  idChipValue: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    letterSpacing: 0.2,
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
