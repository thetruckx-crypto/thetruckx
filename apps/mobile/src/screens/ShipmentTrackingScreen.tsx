import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Clipboard,
  Share,
} from 'react-native';
import {
  ArrowLeft,
  Headphones,
  Copy,
  Truck,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  Clock,
  RotateCw,
  FileText,
  Share2,
  ChevronRight,
  GitCommit,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { clientService } from '../services/clientService';
import { supabase } from '../supabase';

interface ShipmentTrackingScreenProps {
  trackingId: string;
  onBack: () => void;
  onViewDocuments: (id: string) => void;
  onViewPod: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onHelp?: () => void;
}

export type MilestoneStatus = 'COMPLETED' | 'CURRENT' | 'PENDING';

interface MilestoneItem {
  id: number;
  title: string;
  desc: string;
  timestamp?: string;
  status: MilestoneStatus;
}

export const ShipmentTrackingScreen: React.FC<ShipmentTrackingScreenProps> = ({
  trackingId,
  onBack,
  onViewDocuments,
  onViewPod,
  onViewDetails,
  onHelp,
}) => {
  const [tripData, setTripData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await clientService.fetchShipmentTracking(trackingId);
      setTripData(res);
    } catch {
      setTripData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trackingId]);

  useEffect(() => {
    let isMounted = true;
    loadData();

    // Realtime Supabase changes subscription
    const channel = supabase
      .channel(`tracking_${trackingId.replace(/[^a-zA-Z0-9]/g, '')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          if (isMounted) loadData();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [trackingId, loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Consignment ID
  const displayConsignmentId =
    tripData?.lr_number ||
    (trackingId && trackingId.startsWith('NEC') ? trackingId : `NECTRK-${trackingId.slice(-6).toUpperCase()}`);

  // Corridor Locations (Matches Screenshot 3)
  const originCity =
    tripData?.pickup_city ||
    tripData?.bookings?.requirements?.pickup_city ||
    (tripData?.bookings?.requirements?.pickup_address ? tripData.bookings.requirements.pickup_address.split(',')[0].trim() : 'Hanamkonda');
  const originPin = tripData?.bookings?.requirements?.pickup_pincode || '506001';

  const destCity =
    tripData?.destination_city ||
    tripData?.bookings?.requirements?.destination_city ||
    (tripData?.bookings?.requirements?.destination_address ? tripData.bookings.requirements.destination_address.split(',')[0].trim() : 'Visakhapatnam');
  const destPin = tripData?.bookings?.requirements?.destination_pincode || '530040';

  // Driver & Vehicle Allocation Details
  const driverName = tripData?.drivers?.name || tripData?.drivers?.full_name;
  const driverPhone = tripData?.drivers?.phone;
  const vehicleReg = tripData?.vehicles?.registration_number;
  const vehicleType = tripData?.vehicles?.vehicle_type || tripData?.bookings?.requirements?.vehicle_type || '1 x 10-Tyre Truck';

  const isDriverAssigned = !!(driverName && driverName !== 'Driver Allocation Pending');
  const isVehicleAssigned = !!(vehicleReg && vehicleReg !== 'Pending Assignment');

  const rawTripStatus = (tripData?.trip_status || tripData?.status || 'LORRY_ASSIGNED').toUpperCase();

  // Status badge header
  let statusBadgeTitle = 'Lorry Assigned';
  let statusBadgeSub = 'En route to Pickup';
  if (rawTripStatus === 'DELIVERED' || rawTripStatus === 'COMPLETED') {
    statusBadgeTitle = 'Delivered';
    statusBadgeSub = 'POD Verified';
  } else if (rawTripStatus === 'IN_TRANSIT') {
    statusBadgeTitle = 'In Transit';
    statusBadgeSub = 'On Highway Corridor';
  } else if (rawTripStatus === 'LOADED') {
    statusBadgeTitle = 'Cargo Loaded';
    statusBadgeSub = 'Dispatched from Hub';
  } else if (rawTripStatus === 'AT_LOADING') {
    statusBadgeTitle = 'At Loading Gate';
    statusBadgeSub = 'Placement Verified';
  }

  // ── 7 Explicit Consignment Milestones ──
  // Milestone order:
  // 1. Booking Confirmed
  // 2. Vehicle & Driver Assigned
  // 3. Placed at Loading Gate
  // 4. Cargo Loaded & Dispatched
  // 5. In Transit
  // 6. Reached Destination Hub
  // 7. Delivered & POD Sign-off
  const getMilestoneState = (stepIndex: number): MilestoneStatus => {
    if (rawTripStatus === 'DELIVERED' || rawTripStatus === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (rawTripStatus === 'AT_DESTINATION') {
      if (stepIndex <= 6) return 'COMPLETED';
      return 'CURRENT';
    }
    if (rawTripStatus === 'IN_TRANSIT') {
      if (stepIndex <= 4) return 'COMPLETED';
      if (stepIndex === 5) return 'CURRENT';
      return 'PENDING';
    }
    if (rawTripStatus === 'LOADED') {
      if (stepIndex <= 3) return 'COMPLETED';
      if (stepIndex === 4) return 'CURRENT';
      return 'PENDING';
    }
    if (rawTripStatus === 'AT_LOADING') {
      if (stepIndex <= 2) return 'COMPLETED';
      if (stepIndex === 3) return 'CURRENT';
      return 'PENDING';
    }
    if (isDriverAssigned || isVehicleAssigned || rawTripStatus === 'LORRY_ASSIGNED') {
      if (stepIndex === 1) return 'COMPLETED';
      if (stepIndex === 2) return 'CURRENT';
      return 'PENDING';
    }
    // Default Booking Confirmed
    if (stepIndex === 1) return 'COMPLETED';
    return 'PENDING';
  };

  const bookingDateText = tripData?.created_at
    ? new Date(tripData.created_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '16 Oct 2026, 10:32 AM';

  const milestones: MilestoneItem[] = [
    {
      id: 1,
      title: 'Booking Confirmed',
      desc: 'Freight requirement approved by carrier',
      timestamp: bookingDateText,
      status: getMilestoneState(1),
    },
    {
      id: 2,
      title: 'Vehicle & Driver Assigned',
      desc: isDriverAssigned ? `${driverName} · ${vehicleReg || vehicleType}` : 'Pending Assignment',
      status: getMilestoneState(2),
    },
    {
      id: 3,
      title: 'Placed at Loading Gate',
      desc: 'Vehicle reporting at origin hub',
      status: getMilestoneState(3),
    },
    {
      id: 4,
      title: 'Cargo Loaded & Dispatched',
      desc: 'E-way bill & dispatch checklist verified',
      status: getMilestoneState(4),
    },
    {
      id: 5,
      title: 'In Transit',
      desc: 'En route via NH-16 freight corridor',
      status: getMilestoneState(5),
    },
    {
      id: 6,
      title: 'Reached Destination Hub',
      desc: 'Reporting at unloading terminal',
      status: getMilestoneState(6),
    },
    {
      id: 7,
      title: 'Delivered & POD Sign-off',
      desc: 'Consignee sign-off & digital POD clearance',
      status: getMilestoneState(7),
    },
  ];

  const handleCopyId = () => {
    Clipboard.setString(displayConsignmentId);
    Alert.alert('Copied', `Consignment ID ${displayConsignmentId} copied to clipboard.`);
  };

  const handleCallDriver = () => {
    if (!driverPhone) {
      Alert.alert('Driver Phone Pending', 'Driver details and contact number will be updated once assigned.');
      return;
    }
    const clean = driverPhone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Phone Call', `Unable to open dialer for ${clean}`);
    });
  };

  const handleShareTracking = async () => {
    const trackingMsg = `Track North Eastern Carriers Consignment:\nID: ${displayConsignmentId}\nRoute: ${originCity} → ${destCity}\nStatus: ${statusBadgeTitle} (${statusBadgeSub})\nPortal: https://necl.in/track?id=${displayConsignmentId}`;
    try {
      await Share.share({
        title: `NECL Tracking: ${displayConsignmentId}`,
        message: trackingMsg,
      });
    } catch {
      Clipboard.setString(trackingMsg);
      Alert.alert('Link Copied', 'Tracking summary copied to clipboard.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back to Shipments"
        >
          <ArrowLeft size={20} color="#0B1730" />
        </TouchableOpacity>

        <BrandLogoHeader size="sm" />

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => {
            if (onHelp) onHelp();
            else Alert.alert('NECL Support', 'Toll-free 24/7 Consignment Support: 1800-NECL-LOGISTICS');
          }}
          accessibilityLabel="Help & Support"
        >
          <Headphones size={16} color="#0B1730" />
          <Text style={styles.helpBtnText}>Help</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Consignment Tracking Header Block ── */}
        <View style={styles.headerBlock}>
          <View style={styles.headerLeftCol}>
            <Text style={styles.pageLabel}>CONSIGNMENT TRACKING</Text>
            <View style={styles.consignmentIdRow}>
              <Text style={styles.consignmentIdText}>{displayConsignmentId}</Text>
              <TouchableOpacity onPress={handleCopyId} accessibilityLabel="Copy Consignment ID">
                <Copy size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.liveTrackingPill}>
              <View style={styles.liveGreenDot} />
              <Text style={styles.liveTrackingText}>Live Tracking Active</Text>
            </View>
          </View>

          {/* Top Right Status Card */}
          <View style={styles.topStatusCard}>
            <View style={styles.statusTruckIconBox}>
              <Truck size={18} color="#F15A24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusCardTitle}>{statusBadgeTitle}</Text>
              <Text style={styles.statusCardSub}>{statusBadgeSub}</Text>
            </View>
            <ChevronRight size={14} color="#F15A24" />
          </View>
        </View>

        {/* ── Origin & Destination Navy Card (Reference Screenshot 3 Match) ── */}
        <View style={styles.navyRouteCard}>
          {/* Origin */}
          <View style={styles.navyLocBlock}>
            <View style={styles.navyLocIconOrigin}>
              <MapPin size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navyLocLabel}>ORIGIN</Text>
              <Text style={styles.navyLocCity}>{originCity}</Text>
              <Text style={styles.navyLocPin}>PIN {originPin}</Text>
            </View>
          </View>

          {/* Vertical Divider */}
          <View style={styles.navyVerticalDivider} />

          {/* Destination */}
          <View style={styles.navyLocBlock}>
            <View style={styles.navyLocIconDest}>
              <MapPin size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navyLocLabel}>DESTINATION</Text>
              <Text style={styles.navyLocCity}>{destCity}</Text>
              <Text style={styles.navyLocPin}>PIN {destPin}</Text>
            </View>
          </View>
        </View>

        {/* ── Driver Allocation Card (Reference Screenshot 3 Match) ── */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatarBox}>
            <User size={24} color="#F15A24" />
          </View>

          <View style={styles.driverInfoCol}>
            <Text style={styles.driverNameText}>
              {isDriverAssigned ? driverName : 'Driver Allocation Pending'}
            </Text>
            <Text style={styles.driverVehicleText}>
              Vehicle: {isVehicleAssigned ? vehicleReg : `${vehicleType} (To be assigned)`}
            </Text>
            <Text style={styles.driverNoticeText}>
              {isDriverAssigned
                ? 'Driver verified by NECL operations.'
                : 'Driver details will be updated soon.'}
            </Text>
          </View>

          {/* Contact Driver Action Button */}
          <TouchableOpacity
            style={[styles.contactDriverBtn, !driverPhone && styles.contactDriverBtnDisabled]}
            onPress={handleCallDriver}
            disabled={!driverPhone}
            activeOpacity={0.8}
          >
            <Phone size={14} color={driverPhone ? '#FFFFFF' : '#94A3B8'} />
            <View>
              <Text style={[styles.contactDriverBtnTitle, !driverPhone && styles.contactDriverTextDisabled]}>
                Contact Driver
              </Text>
              <Text style={[styles.contactDriverBtnSub, !driverPhone && styles.contactDriverSubDisabled]}>
                {driverPhone || 'Phone Pending'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Consignment Milestones (Reference Screenshot 3 Match) ── */}
        <View style={styles.milestonesSectionCard}>
          <View style={styles.milestonesHeader}>
            <View style={styles.milestoneHeaderIconBox}>
              <GitCommit size={18} color="#F15A24" strokeWidth={2.4} />
            </View>
            <Text style={styles.milestonesHeaderTitle}>Consignment Milestones</Text>
          </View>

          <View style={styles.milestonesList}>
            {milestones.map((m, index) => {
              const isLast = index === milestones.length - 1;
              const isCompleted = m.status === 'COMPLETED';
              const isCurrent = m.status === 'CURRENT';

              return (
                <View key={m.id} style={styles.milestoneRow}>
                  {/* Timeline Node Column */}
                  <View style={styles.timelineCol}>
                    {isCompleted ? (
                      <View style={styles.nodeCompleted}>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.nodeCurrent}>
                        <View style={styles.nodeCurrentInner} />
                      </View>
                    ) : (
                      <View style={styles.nodePending} />
                    )}

                    {!isLast && (
                      <View
                        style={[
                          styles.timelineVerticalLine,
                          isCompleted && styles.timelineLineCompleted,
                          isCurrent && styles.timelineLineCurrent,
                        ]}
                      />
                    )}
                  </View>

                  {/* Milestone Content Column */}
                  <View style={styles.milestoneContentCol}>
                    <View style={styles.milestoneTitleRow}>
                      <Text
                        style={[
                          styles.milestoneTitle,
                          isCompleted && styles.milestoneTitleCompleted,
                          isCurrent && styles.milestoneTitleCurrent,
                        ]}
                      >
                        {m.title}
                      </Text>

                      {/* Status Pill */}
                      {isCompleted ? (
                        <View style={styles.pillGreen}>
                          <Text style={styles.pillTextGreen}>Completed</Text>
                        </View>
                      ) : isCurrent ? (
                        <View style={styles.pillOrange}>
                          <Text style={styles.pillTextOrange}>Current</Text>
                        </View>
                      ) : (
                        <View style={styles.pillGrey}>
                          <Text style={styles.pillTextGrey}>Pending</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.milestoneDesc}>{m.desc}</Text>
                    {m.timestamp ? (
                      <Text style={styles.milestoneTime}>{m.timestamp}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Bottom Quick Actions (4 accessible cards) ── */}
        <View style={styles.quickActionsGrid}>
          {/* 1. Refresh */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleRefresh}
            disabled={refreshing}
            activeOpacity={0.8}
          >
            <View style={styles.quickIconOrange}>
              {refreshing ? (
                <ActivityIndicator size="small" color="#F15A24" />
              ) : (
                <RotateCw size={18} color="#F15A24" />
              )}
            </View>
            <Text style={styles.quickActionTitle}>Refresh</Text>
            <Text style={styles.quickActionSub}>Get latest status</Text>
          </TouchableOpacity>

          {/* 2. View Details */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              if (onViewDetails) onViewDetails(tripData?.booking_id || trackingId);
              else Alert.alert('Consignment Info', `Booking Ref: ${tripData?.booking_id || trackingId}\nMaterial: ${tripData?.bookings?.requirements?.material_type || 'General Cargo'}`);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.quickIconBlue}>
              <FileText size={18} color="#2563EB" />
            </View>
            <Text style={styles.quickActionTitle}>View Details</Text>
            <Text style={styles.quickActionSub}>Consignment info</Text>
          </TouchableOpacity>

          {/* 3. Share Tracking */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={handleShareTracking}
            activeOpacity={0.8}
          >
            <View style={styles.quickIconGreen}>
              <Share2 size={18} color="#169B75" />
            </View>
            <Text style={styles.quickActionTitle}>Share Tracking</Text>
            <Text style={styles.quickActionSub}>Send to others</Text>
          </TouchableOpacity>

          {/* 4. Need Help? */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              if (onHelp) onHelp();
              else Alert.alert('NECL Support', 'Toll-free 24/7 Consignment Support: 1800-NECL-LOGISTICS');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.quickIconPurple}>
              <Headphones size={18} color="#9333EA" />
            </View>
            <Text style={styles.quickActionTitle}>Need Help?</Text>
            <Text style={styles.quickActionSub}>Contact support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1730',
  },
  scrollContent: {
    padding: 14,
  },

  /* Consignment Header Block */
  headerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  headerLeftCol: {
    flex: 1,
  },
  pageLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  consignmentIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  consignmentIdText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0B1730',
    letterSpacing: -0.2,
  },
  liveTrackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveTrackingText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
  },

  /* Top Right Status Card */
  topStatusCard: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTruckIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C2410C',
  },
  statusCardSub: {
    fontSize: 10,
    color: '#EA580C',
    marginTop: 1,
  },

  /* Navy Route Card (Screenshot 3 Match) */
  navyRouteCard: {
    backgroundColor: '#0B1730',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#0B1730',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  navyLocBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navyLocIconOrigin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyLocIconDest: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyLocLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  navyLocCity: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  navyLocPin: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 1,
  },
  navyVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },

  /* Driver Allocation Card (Screenshot 3 Match) */
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  driverAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  driverInfoCol: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B1730',
  },
  driverVehicleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  driverNoticeText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  contactDriverBtn: {
    backgroundColor: '#0B1730',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactDriverBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactDriverBtnTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  contactDriverTextDisabled: {
    color: '#94A3B8',
  },
  contactDriverBtnSub: {
    fontSize: 9,
    color: '#CBD5E1',
  },
  contactDriverSubDisabled: {
    color: '#94A3B8',
  },

  /* Consignment Milestones Card */
  milestonesSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  milestonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  milestoneHeaderIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestonesHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0B1730',
  },
  milestonesList: {
    paddingLeft: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineCol: {
    alignItems: 'center',
    width: 26,
    marginRight: 10,
  },
  nodeCompleted: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F15A24',
  },
  nodePending: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineVerticalLine: {
    width: 2,
    height: 38,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineLineCompleted: {
    backgroundColor: '#10B981',
  },
  timelineLineCurrent: {
    backgroundColor: '#F15A24',
  },
  milestoneContentCol: {
    flex: 1,
    paddingBottom: 16,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  milestoneTitleCompleted: {
    color: '#0B1730',
    fontWeight: '800',
  },
  milestoneTitleCurrent: {
    color: '#F15A24',
    fontWeight: '800',
  },
  milestoneDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  milestoneTime: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 3,
  },
  pillGreen: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pillTextGreen: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  pillOrange: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pillTextOrange: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
  },
  pillGrey: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillTextGrey: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },

  /* Quick Actions Grid (Screenshot 3 Match) */
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  quickIconOrange: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIconBlue: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIconGreen: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIconPurple: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B1730',
    textAlign: 'center',
  },
  quickActionSub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },
});
