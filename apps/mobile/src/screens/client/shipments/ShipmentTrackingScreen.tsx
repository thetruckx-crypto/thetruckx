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
  Platform,
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
  AlertTriangle,
  Radio,
  Scale,
  ShieldCheck,
  CheckSquare,
  Navigation,
  ExternalLink,
} from 'lucide-react-native';
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { formatDisplayId } from '../../../utils/idGenerator';

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

    // Realtime Supabase changes subscription for trips & weighments
    const cleanChan = (trackingId || '').replace(/[^a-zA-Z0-9]/g, '');
    const channel = supabase
      .channel(`tracking_screen_${cleanChan}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        if (isMounted) loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_location_logs' }, () => {
        if (isMounted) loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_pod_submissions' }, () => {
        if (isMounted) loadData();
      })
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

  // Identifiers
  const displayTripId = tripData?.trip_code || formatDisplayId('TRP', tripData?.id || trackingId, tripData?.created_at);
  const displayBookingId =
    tripData?.bookings?.booking_code ||
    (tripData?.booking_id ? formatDisplayId('BK', tripData.booking_id, tripData.created_at) : '—');
  const lrNumber = tripData?.lr_number || null;
  const ewaybillNumber = tripData?.ewaybill_number || null;

  // Corridor Locations
  const reqObj = tripData?.bookings?.requirements || {};
  const originCity = tripData?.pickup_city || reqObj.pickup_city || 'Origin Depot';
  const originAddress = reqObj.pickup_address || tripData?.pickup_address || 'Origin Hub, North Eastern Corridor';
  const originPin = reqObj.pickup_pincode || '—';

  const destCity = tripData?.destination_city || reqObj.destination_city || 'Destination Yard';
  const destAddress = reqObj.destination_address || tripData?.destination_address || 'Delivery Terminal';
  const destPin = reqObj.destination_pincode || '—';

  // Vendor / Carrier Details
  const vendorName =
    tripData?.vendors?.company_name ||
    tripData?.vendors?.name ||
    'TRUCKS Certified Fleet Partner';

  // Driver & Vehicle Details
  const driverName = tripData?.drivers?.name || tripData?.drivers?.full_name;
  const driverPhone = tripData?.drivers?.phone || tripData?.drivers?.mobile;
  const vehicleReg = tripData?.vehicles?.registration_number;
  const vehicleType =
    tripData?.vehicles?.vehicle_type ||
    reqObj.vehicle_type ||
    reqObj.vehicle_type_required ||
    'Commercial Freight Unit';

  const isDriverAssigned = !!(driverName && driverName !== 'Driver Allocation Pending');
  const isVehicleAssigned = !!(vehicleReg && vehicleReg !== 'Pending Assignment' && vehicleReg !== 'Vehicle Allocation Pending');

  const rawTripStatus = (tripData?.trip_status || tripData?.status || 'BOOKED').toUpperCase();

  // Status badge header
  let statusBadgeTitle = 'Booking Confirmed';
  let statusBadgeSub = 'Awaiting Vehicle Placement';
  let statusColor = '#2563EB';
  let statusBg = '#EFF6FF';

  if (rawTripStatus === 'DELIVERED' || rawTripStatus === 'COMPLETED') {
    statusBadgeTitle = 'Delivered';
    statusBadgeSub = 'Consignee Sign-off Verified';
    statusColor = '#059669';
    statusBg = '#ECFDF5';
  } else if (rawTripStatus === 'AT_DESTINATION' || rawTripStatus === 'UNLOADING') {
    statusBadgeTitle = 'At Destination Yard';
    statusBadgeSub = 'Unloading & Weighment in Progress';
    statusColor = '#7C3AED';
    statusBg = '#F5F3FF';
  } else if (rawTripStatus === 'IN_TRANSIT') {
    statusBadgeTitle = 'In Transit';
    statusBadgeSub = 'On Highway Freight Corridor';
    statusColor = '#F15A24';
    statusBg = '#FFF5ED';
  } else if (rawTripStatus === 'LOADED') {
    statusBadgeTitle = 'Cargo Loaded';
    statusBadgeSub = 'Dispatched from Hub';
    statusColor = '#F15A24';
    statusBg = '#FFF5ED';
  } else if (rawTripStatus === 'AT_LOADING') {
    statusBadgeTitle = 'At Loading Gate';
    statusBadgeSub = 'Placement Verified at Origin';
    statusColor = '#D97706';
    statusBg = '#FFFBEB';
  } else if (isDriverAssigned || isVehicleAssigned || rawTripStatus === 'LORRY_ASSIGNED') {
    statusBadgeTitle = 'Lorry Assigned';
    statusBadgeSub = 'En Route to Origin Hub';
    statusColor = '#2563EB';
    statusBg = '#EFF6FF';
  } else if (rawTripStatus === 'CANCELLED') {
    statusBadgeTitle = 'Cancelled';
    statusBadgeSub = 'Consignment Cancelled';
    statusColor = '#DC2626';
    statusBg = '#FEF2F2';
  }

  // ── Milestone State Evaluator ──
  const getMilestoneState = (stepIndex: number): MilestoneStatus => {
    if (rawTripStatus === 'DELIVERED' || rawTripStatus === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (rawTripStatus === 'AT_DESTINATION' || rawTripStatus === 'UNLOADING') {
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
    : 'Confirmed';

  const milestones: MilestoneItem[] = [
    {
      id: 1,
      title: 'Booking Confirmed',
      desc: 'Freight requirement accepted & booking generated',
      timestamp: bookingDateText,
      status: getMilestoneState(1),
    },
    {
      id: 2,
      title: 'Vehicle & Driver Assigned',
      desc: isDriverAssigned
        ? `${driverName} • ${vehicleReg || vehicleType}`
        : 'Carrier allocating verified vehicle unit',
      timestamp: tripData?.assigned_at ? new Date(tripData.assigned_at).toLocaleString('en-GB') : undefined,
      status: getMilestoneState(2),
    },
    {
      id: 3,
      title: 'Placed at Loading Gate',
      desc: 'Vehicle reported and docked at origin hub',
      status: getMilestoneState(3),
    },
    {
      id: 4,
      title: 'Cargo Loaded & Dispatched',
      desc: ewaybillNumber
        ? `Loaded • E-Way Bill ${ewaybillNumber}`
        : 'Cargo loading checklist verified',
      timestamp: tripData?.dispatched_at ? new Date(tripData.dispatched_at).toLocaleString('en-GB') : undefined,
      status: getMilestoneState(4),
    },
    {
      id: 5,
      title: 'In Transit',
      desc: tripData?.distance_remaining_km
        ? `En route • ${tripData.distance_remaining_km} km remaining`
        : 'Consignment moving along highway corridor',
      status: getMilestoneState(5),
    },
    {
      id: 6,
      title: 'Reached Destination Yard',
      desc: 'Vehicle arrived at delivery warehouse for unloading',
      status: getMilestoneState(6),
    },
    {
      id: 7,
      title: 'Delivered & POD Clearance',
      desc: tripData?.pod_approved
        ? 'Digital Proof of Delivery verified by operations'
        : 'Consignee verification & digital sign-off',
      timestamp: tripData?.completed_at ? new Date(tripData.completed_at).toLocaleString('en-GB') : undefined,
      status: getMilestoneState(7),
    },
  ];

  // GPS Telemetry Data (Genuine database coordinates ONLY)
  const hasGps = !!(tripData?.last_latitude && tripData?.last_longitude);
  const gpsLat = tripData?.last_latitude;
  const gpsLon = tripData?.last_longitude;
  const gpsSpeed = tripData?.last_speed != null ? `${Number(tripData.last_speed).toFixed(0)} km/h` : '0 km/h';
  const lastPingTime = tripData?.last_ping_at
    ? new Date(tripData.last_ping_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Estimated Arrival Time (Authentic DB data only)
  const estimatedArrival = tripData?.estimated_arrival_at
    ? new Date(tripData.estimated_arrival_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Loading & Unloading recorded weighments
  const weighments: any[] = tripData?.weighments || [];
  const loadingWeighment = weighments.find((w) => w.stage === 'LOADING');
  const unloadingWeighment = weighments.find((w) => w.stage === 'UNLOADING');

  // Proof of Delivery Status
  const podSubmissions: any[] = tripData?.pod_submissions || [];
  const latestPod = podSubmissions[0];
  const isPodApproved = tripData?.pod_approved || latestPod?.review_status === 'APPROVED';
  const isPodPendingReview = latestPod && latestPod.review_status === 'PENDING';

  const handleCopy = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} ${text} copied to clipboard.`);
  };

  const handleCallDriver = () => {
    if (!driverPhone) {
      Alert.alert('Driver Phone Pending', 'Driver details and contact number will be updated once assigned.');
      return;
    }
    const clean = driverPhone.replace(/[^0-9+]/g, '');
    Platform.OS === 'web'
      ? window.open(`tel:${clean}`)
      : Linking.openURL(`tel:${clean}`).catch(() => {
          Alert.alert('Phone Call', `Unable to dial ${clean}`);
        });
  };

  const handleShareTracking = async () => {
    const msg = `TRUCKS Consignment Tracking:\nTrip ID: ${displayTripId}\nBooking: ${displayBookingId}\nRoute: ${originCity} → ${destCity}\nStatus: ${statusBadgeTitle}\nETA: ${estimatedArrival || 'Highway transit in progress'}`;
    try {
      await Share.share({ title: `Consignment: ${displayTripId}`, message: msg });
    } catch {
      Clipboard.setString(msg);
      Alert.alert('Copied', 'Tracking summary copied to clipboard.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color="#0C1A34" />
        </TouchableOpacity>

        <BrandLogoHeader size="sm" showSubtitle={false} />

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => {
            if (onHelp) onHelp();
            else Alert.alert('Support Desk', '24/7 Operations Control Tower: 1800-258-4567');
          }}
          accessibilityLabel="Operations Help"
        >
          <Headphones size={15} color="#0C1A34" />
          <Text style={styles.helpBtnText}>Support</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F15A24" />
          <Text style={styles.centerLoadingText}>Fetching live shipment tracking & telemetry...</Text>
        </View>
      ) : !tripData ? (
        <View style={styles.centerContainer}>
          <AlertTriangle size={36} color="#DC2626" />
          <Text style={styles.errorTitle}>Shipment Not Found</Text>
          <Text style={styles.errorSubtitle}>
            No tracking records found for "{trackingId}". Please verify the booking or consignment number.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <RotateCw size={15} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry Lookup</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 1. Reference Identifiers Card (Trip ID + Booking ID) ── */}
          <View style={styles.refCard}>
            <View style={styles.refRow}>
              <View style={styles.refItem}>
                <Text style={styles.refItemLabel}>TRIP / TRACKING ID</Text>
                <TouchableOpacity
                  style={styles.refCopyRow}
                  onPress={() => handleCopy(displayTripId, 'Trip ID')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.refItemValue}>{displayTripId}</Text>
                  <Copy size={13} color="#F15A24" />
                </TouchableOpacity>
              </View>

              <View style={styles.refDividerVertical} />

              <View style={styles.refItem}>
                <Text style={styles.refItemLabel}>BOOKING REFERENCE</Text>
                <TouchableOpacity
                  style={styles.refCopyRow}
                  onPress={() => handleCopy(displayBookingId, 'Booking ID')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.refItemValue}>{displayBookingId}</Text>
                  <Copy size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Optional LR & E-Way Bill Bar */}
            {(lrNumber || ewaybillNumber) && (
              <View style={styles.docketBar}>
                {lrNumber && (
                  <View style={styles.docketItem}>
                    <Text style={styles.docketLabel}>LR No:</Text>
                    <Text style={styles.docketVal}>{lrNumber}</Text>
                  </View>
                )}
                {ewaybillNumber && (
                  <View style={styles.docketItem}>
                    <Text style={styles.docketLabel}>E-Way Bill:</Text>
                    <Text style={styles.docketVal}>{ewaybillNumber}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Overall Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusBg }]}>
              <View style={[styles.statusIconBox, { backgroundColor: statusColor }]}>
                <Truck size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: statusColor }]}>{statusBadgeTitle}</Text>
                <Text style={styles.statusSub}>{statusBadgeSub}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={12} color="#16A34A" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>

          {/* ── 2. Full Corridor Route Card ── */}
          <View style={styles.routeCard}>
            <View style={styles.routeSectionHeader}>
              <Text style={styles.cardHeaderTitle}>Corridor & Route</Text>
              {tripData?.total_distance_km ? (
                <Text style={styles.distanceBadge}>{tripData.total_distance_km} KM</Text>
              ) : null}
            </View>

            {/* Pickup */}
            <View style={styles.routeStop}>
              <View style={styles.originIconCircle}>
                <MapPin size={15} color="#16A34A" />
              </View>
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeStopLabel}>PICKUP LOCATION</Text>
                <Text style={styles.routeCityTitle}>{originCity} {originPin !== '—' ? `• ${originPin}` : ''}</Text>
                <Text style={styles.routeAddressText}>{originAddress}</Text>
              </View>
            </View>

            <View style={styles.routeConnector} />

            {/* Destination */}
            <View style={styles.routeStop}>
              <View style={styles.destIconCircle}>
                <MapPin size={15} color="#DC2626" />
              </View>
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeStopLabel}>DELIVERY DESTINATION</Text>
                <Text style={styles.routeCityTitle}>{destCity} {destPin !== '—' ? `• ${destPin}` : ''}</Text>
                <Text style={styles.routeAddressText}>{destAddress}</Text>
              </View>
            </View>

            {/* ETA Row if Available */}
            <View style={styles.etaRow}>
              <Clock size={14} color="#D97706" />
              <Text style={styles.etaLabel}>Estimated Arrival:</Text>
              <Text style={styles.etaValue}>
                {estimatedArrival || 'Dynamic ETA will calculate once highway corridor transit starts.'}
              </Text>
            </View>
          </View>

          {/* ── 3. Carrier, Vehicle & Driver Details Card ── */}
          <View style={styles.allocationCard}>
            <Text style={styles.cardHeaderTitle}>Transport & Fleet Allocation</Text>

            {/* Carrier Name */}
            <View style={styles.allocRow}>
              <ShieldCheck size={16} color="#F15A24" />
              <View style={{ flex: 1 }}>
                <Text style={styles.allocLabel}>Assigned Carrier / Vendor</Text>
                <Text style={styles.allocValue}>{vendorName}</Text>
              </View>
              <View style={styles.fleetVerifiedPill}>
                <Text style={styles.fleetVerifiedText}>Verified Fleet</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Vehicle Details */}
            <View style={styles.allocRow}>
              <Truck size={16} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={styles.allocLabel}>Assigned Vehicle Unit</Text>
                <Text style={styles.allocValue}>
                  {isVehicleAssigned ? vehicleReg : `${vehicleType} (Allocation Pending)`}
                </Text>
                {tripData?.vehicles?.model ? (
                  <Text style={styles.allocSub}>{tripData.vehicles.model} • {vehicleType}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Driver Details */}
            <View style={styles.allocRow}>
              <User size={16} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.allocLabel}>Assigned Driver</Text>
                <Text style={styles.allocValue}>
                  {isDriverAssigned ? driverName : 'Driver Assignment in Progress'}
                </Text>
                <Text style={styles.allocSub}>
                  {isDriverAssigned ? 'Verified KYC & Commercial Driving License' : 'Driver roster pending'}
                </Text>
              </View>

              {driverPhone ? (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={handleCallDriver}
                  accessibilityLabel="Call Driver"
                >
                  <Phone size={13} color="#FFFFFF" />
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ── 4. Live GPS Telemetry Status Card (Real DB Telemetry Only) ── */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryHeaderRow}>
              <View style={styles.telemetryIconBox}>
                <Radio size={16} color={hasGps ? '#16A34A' : '#94A3B8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Live GPS Telemetry</Text>
                <Text style={styles.telemetrySubtitle}>
                  {hasGps
                    ? `Hardware stream active • Speed: ${gpsSpeed}`
                    : 'Awaiting highway checkpost or hardware telemetry ping'}
                </Text>
              </View>
              {hasGps && (
                <View style={styles.liveGreenPill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveGreenText}>Live Feed</Text>
                </View>
              )}
            </View>

            {hasGps ? (
              <View style={styles.telemetryDataGrid}>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>COORDINATES</Text>
                  <Text style={styles.telemetryVal}>{Number(gpsLat).toFixed(4)}°, {Number(gpsLon).toFixed(4)}°</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>SPEED</Text>
                  <Text style={styles.telemetryVal}>{gpsSpeed}</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>LAST PING</Text>
                  <Text style={styles.telemetryVal}>{lastPingTime || 'Just now'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noGpsNotice}>
                <Text style={styles.noGpsNoticeText}>
                  Hardware telemetry is pending or unit is between checkpost towers along North Eastern terrain. Location updates automatically upon next telemetry broadcast.
                </Text>
              </View>
            )}
          </View>

          {/* ── 5. Recorded Loading & Unloading Weighbridge Details ── */}
          <View style={styles.weighmentCard}>
            <View style={styles.weighmentHeader}>
              <Scale size={16} color="#7C3AED" />
              <Text style={styles.cardHeaderTitle}>Loading & Unloading Details</Text>
            </View>

            {/* Loading Stage */}
            <View style={styles.stageBlock}>
              <View style={styles.stageTitleRow}>
                <Text style={styles.stageTitleText}>1. Loading Gate & Dispatch</Text>
                <Text style={[styles.stageStatusBadge, loadingWeighment ? styles.badgeGreen : styles.badgeMuted]}>
                  {loadingWeighment ? 'Weighment Completed' : rawTripStatus === 'AT_LOADING' ? 'At Loading Bay' : 'Pending'}
                </Text>
              </View>
              {loadingWeighment ? (
                <View style={styles.weighmentDetailsRow}>
                  <Text style={styles.weighmentDetailItem}>
                    Gross: <Text style={styles.bold}>{loadingWeighment.gross_weight_mt} MT</Text>
                  </Text>
                  <Text style={styles.weighmentDetailItem}>
                    Net: <Text style={styles.bold}>{loadingWeighment.net_weight_mt} MT</Text>
                  </Text>
                  {loadingWeighment.slip_number && (
                    <Text style={styles.weighmentDetailItem}>Slip #{loadingWeighment.slip_number}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.stageSubText}>
                  Loading gate placement and gross cargo weighment record will appear here upon completion.
                </Text>
              )}
            </View>

            <View style={styles.cardDivider} />

            {/* Unloading Stage */}
            <View style={styles.stageBlock}>
              <View style={styles.stageTitleRow}>
                <Text style={styles.stageTitleText}>2. Unloading & Consignee Gate</Text>
                <Text style={[styles.stageStatusBadge, unloadingWeighment ? styles.badgeGreen : styles.badgeMuted]}>
                  {unloadingWeighment ? 'Unload Cleared' : rawTripStatus === 'AT_DESTINATION' ? 'Reporting at Yard' : 'Pending'}
                </Text>
              </View>
              {unloadingWeighment ? (
                <View style={styles.weighmentDetailsRow}>
                  <Text style={styles.weighmentDetailItem}>
                    Net Received: <Text style={styles.bold}>{unloadingWeighment.net_weight_mt} MT</Text>
                  </Text>
                  {unloadingWeighment.variance_mt != null && (
                    <Text style={styles.weighmentDetailItem}>
                      Variance: {unloadingWeighment.variance_mt} MT
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.stageSubText}>
                  Unloading tare verification and final discharge inspection record will log here upon arrival.
                </Text>
              )}
            </View>
          </View>

          {/* ── 6. Proof of Delivery (POD) Confirmation ── */}
          <View style={styles.podCard}>
            <View style={styles.podHeaderRow}>
              <CheckSquare size={16} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Proof of Delivery (POD)</Text>
                <Text style={styles.podStatusSub}>
                  {isPodApproved
                    ? 'Verified & Approved by Operations Desk'
                    : isPodPendingReview
                      ? 'Consignee sign-off submitted — Control Tower reviewing'
                      : rawTripStatus === 'DELIVERED'
                        ? 'Consignment delivered — Awaiting digital POD upload'
                        : 'POD clearance will be enabled upon destination delivery.'}
                </Text>
              </View>

              <View
                style={[
                  styles.podBadge,
                  isPodApproved ? styles.podBadgeApproved : isPodPendingReview ? styles.podBadgeReview : styles.podBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.podBadgeText,
                    isPodApproved ? styles.podTextApproved : isPodPendingReview ? styles.podTextReview : styles.podTextPending,
                  ]}
                >
                  {isPodApproved ? 'Approved' : isPodPendingReview ? 'Review' : 'Pending'}
                </Text>
              </View>
            </View>

            {(isPodApproved || isPodPendingReview || latestPod?.pod_document_url) && (
              <TouchableOpacity
                style={styles.viewPodBtn}
                onPress={() => onViewPod(tripData?.id || trackingId)}
                activeOpacity={0.85}
              >
                <FileText size={15} color="#FFFFFF" />
                <Text style={styles.viewPodBtnText}>View Signed Acknowledgement / POD</Text>
                <ExternalLink size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── 7. Consignment Operational Milestones ── */}
          <View style={styles.milestonesCard}>
            <View style={styles.milestonesHeader}>
              <GitCommit size={18} color="#F15A24" strokeWidth={2.4} />
              <Text style={styles.cardHeaderTitle}>Consignment Milestones</Text>
            </View>

            <View style={styles.milestonesList}>
              {milestones.map((m, index) => {
                const isLast = index === milestones.length - 1;
                const isCompleted = m.status === 'COMPLETED';
                const isCurrent = m.status === 'CURRENT';

                return (
                  <View key={m.id} style={styles.milestoneRow}>
                    <View style={styles.timelineCol}>
                      {isCompleted ? (
                        <View style={styles.nodeCompleted}>
                          <CheckCircle2 size={15} color="#FFFFFF" />
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
                      {m.timestamp ? <Text style={styles.milestoneTime}>{m.timestamp}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── 8. Bottom Action Grid ── */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={handleRefresh} activeOpacity={0.8}>
              <RotateCw size={18} color="#F15A24" />
              <Text style={styles.actionTitle}>Refresh Status</Text>
              <Text style={styles.actionSub}>Latest telemetry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                if (onViewDetails) onViewDetails(tripData?.booking_id || tripData?.id);
                else Alert.alert('Consignment Info', `Booking Ref: ${displayBookingId}`);
              }}
              activeOpacity={0.8}
            >
              <FileText size={18} color="#2563EB" />
              <Text style={styles.actionTitle}>Booking Details</Text>
              <Text style={styles.actionSub}>Requirement specs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleShareTracking} activeOpacity={0.8}>
              <Share2 size={18} color="#16A34A" />
              <Text style={styles.actionTitle}>Share Tracking</Text>
              <Text style={styles.actionSub}>WhatsApp / SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                if (onHelp) onHelp();
                else Alert.alert('Support Desk', '24/7 Operations Control Tower: 1800-258-4567');
              }}
              activeOpacity={0.8}
            >
              <Headphones size={18} color="#7C3AED" />
              <Text style={styles.actionTitle}>Help Desk</Text>
              <Text style={styles.actionSub}>24/7 Operations</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
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
    color: '#0C1A34',
  },
  scrollContent: {
    padding: 14,
  },
  centerContainer: {
    paddingVertical: 80,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLoadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refItem: {
    flex: 1,
  },
  refItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  refCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  refItemValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  refDividerVertical: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  docketBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  docketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docketLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  docketVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  statusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  statusSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  cardHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  routeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  distanceBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
    backgroundColor: '#FFF5ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  originIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  destIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeStopLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  routeCityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 1,
  },
  routeAddressText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 1,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginLeft: 12,
    marginVertical: 2,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  etaLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  etaValue: {
    fontSize: 11.5,
    color: '#78350F',
    flex: 1,
  },
  allocationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  allocLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  allocValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  allocSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  fleetVerifiedPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fleetVerifiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F15A24',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  telemetryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  telemetryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetrySubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  liveGreenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveGreenText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  telemetryDataGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  telemetryCell: {
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 2,
  },
  noGpsNotice: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  noGpsNoticeText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  weighmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  weighmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stageBlock: {
    paddingVertical: 4,
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stageTitleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  stageStatusBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
  },
  badgeMuted: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  weighmentDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  weighmentDetailItem: {
    fontSize: 11.5,
    color: '#475569',
  },
  bold: {
    fontWeight: '700',
    color: '#0C1A34',
  },
  stageSubText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  podCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  podHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  podStatusSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  podBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  podBadgeApproved: {
    backgroundColor: '#ECFDF5',
  },
  podBadgeReview: {
    backgroundColor: '#FFFBEB',
  },
  podBadgePending: {
    backgroundColor: '#F1F5F9',
  },
  podBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  podTextApproved: {
    color: '#059669',
  },
  podTextReview: {
    color: '#D97706',
  },
  podTextPending: {
    color: '#64748B',
  },
  viewPodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  viewPodBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  milestonesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  milestonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  milestonesList: {
    paddingLeft: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  timelineCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 10,
  },
  nodeCompleted: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF5ED',
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
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineLineCompleted: {
    backgroundColor: '#16A34A',
  },
  timelineLineCurrent: {
    backgroundColor: '#FDBA74',
  },
  milestoneContentCol: {
    flex: 1,
    paddingBottom: 12,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  milestoneTitleCompleted: {
    color: '#0C1A34',
    fontWeight: '700',
  },
  milestoneTitleCurrent: {
    color: '#F15A24',
    fontWeight: '800',
  },
  milestoneDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  milestoneTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  pillGreen: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  pillOrange: {
    backgroundColor: '#FFF5ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillTextOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F15A24',
  },
  pillGrey: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillTextGrey: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  actionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 6,
  },
  actionSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
});
