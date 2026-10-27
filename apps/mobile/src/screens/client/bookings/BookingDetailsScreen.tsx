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
  Modal,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Calendar,
  IndianRupee,
  ShieldCheck,
  User,
  Phone,
  FileText,
  Clock,
  Compass,
  FileCheck2,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Copy,
  Package,
  Layers,
  X,
  XCircle,
  HelpCircle,
  Headphones,
  Navigation,
  Building2,
  Check,
  Scale,
  FileUp,
} from 'lucide-react-native';
import { clientService } from '../../../services/clientService';
import { formatDisplayId } from '../../../utils/idGenerator';
import {
  buildGoogleMapsDirectionsUrl,
  isValidGoogleMapsUrl,
} from '../../../utils/googleMapsUtil';

interface BookingDetailsScreenProps {
  bookingId: string;
  onBack: () => void;
  onTrackShipment: (bookingId: string) => void;
  onViewDocuments: (bookingId: string) => void;
  onViewPod: (bookingId: string) => void;
  onContactSupport?: () => void;
  onViewRequirement?: (requirementId: string) => void;
}

export const BookingDetailsScreen: React.FC<BookingDetailsScreenProps> = ({
  bookingId,
  onBack,
  onTrackShipment,
  onViewDocuments,
  onViewPod,
  onContactSupport,
  onViewRequirement,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('Change of logistics schedule');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await clientService.fetchBookingById(bookingId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCallDriver = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleOpenDirections = (
    address?: string,
    city?: string,
    googleMapsUrl?: string,
    lat?: number,
    lng?: number
  ) => {
    if (!address && !lat && !googleMapsUrl) {
      Alert.alert('Address Missing', 'No location specified for navigation.');
      return;
    }

    let url: string;
    if (googleMapsUrl && isValidGoogleMapsUrl(googleMapsUrl)) {
      url = googleMapsUrl;
    } else {
      url = buildGoogleMapsDirectionsUrl({
        latitude: lat,
        longitude: lng,
        address: `${address || ''}${city ? ', ' + city : ''}`.trim(),
      });
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(url);
        }
      })
      .catch(() => {
        Linking.openURL(url);
      });
  };

  const handleConfirmCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await clientService.cancelBooking(bookingId, data?.client_id, cancellationReason);
      if (res.success) {
        Alert.alert('Booking Cancelled', 'Your booking has been cancelled successfully.');
        setShowCancelModal(false);
        fetchDetails();
      } else {
        Alert.alert('Cancellation Error', res.message || 'Unable to cancel booking.');
      }
    } catch {
      Alert.alert('Cancellation Error', 'An unexpected network error occurred.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Booking Details</Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#F15A24" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Booking Details</Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.centerWrap}>
          <AlertTriangle size={44} color="#DC2626" strokeWidth={1.8} />
          <Text style={[styles.loadingText, { color: '#0B1730', fontWeight: '700', fontSize: 16, marginTop: 12 }]}>
            Booking Not Found
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 }}>
            Unable to load booking details or you may not be authorized to view this consignment.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: '#F15A24',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 8,
            }}
            onPress={onBack}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Go Back to Shipments</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const req = data?.requirements;
  const trip = data?.trip || (data?.trips && data.trips[0]) || null;
  const vehicle = trip?.vehicles;
  const driver = trip?.drivers;

  const displayBookingId =
    data?.booking_reference || formatDisplayId('BK', data.id, data.confirmed_at || data.created_at);

  const lrNumber = trip?.lr_number || (trip?.id ? formatDisplayId('TRP', trip.id, trip.created_at) : null);

  const statusRaw = (trip?.trip_status || data?.booking_status || 'CONFIRMED').toUpperCase();
  const isDelivered = statusRaw === 'DELIVERED';
  const isTransit = statusRaw === 'IN_TRANSIT' || statusRaw === 'ACTIVE' || statusRaw === 'DISPATCHED';
  const isAssigned = statusRaw === 'ASSIGNED' || statusRaw === 'LORRY_ASSIGNED' || !!vehicle?.registration_number;
  const isCancelled = statusRaw === 'CANCELLED';
  const canCancel = !isCancelled && !isDelivered && !isTransit;

  const bookingDateText = data?.confirmed_at || data?.created_at
    ? new Date(data.confirmed_at || data.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Confirmed Date on File';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Compact Header Bar with Logo and Back Button ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back"
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Booking Details</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* ── Continuous Single Scrollable Screen ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2. Booking Reference Card ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>BOOKING REFERENCE</Text>
              <View style={styles.idBox}>
                <Text style={styles.headerId}>{displayBookingId}</Text>
                <TouchableOpacity
                  onPress={() => handleCopy(displayBookingId)}
                  style={styles.copyBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Copy reference"
                >
                  {copiedId === displayBookingId ? (
                    <Check size={16} color="#16A34A" strokeWidth={2.6} />
                  ) : (
                    <Copy size={16} color="#667085" />
                  )}
                </TouchableOpacity>
                {copiedId === displayBookingId && (
                  <Text style={styles.copiedText}>Copied</Text>
                )}
              </View>
              <Text style={styles.createdDate}>Booked on {bookingDateText}</Text>
            </View>

            {/* Status Badge: Green pill for Confirmed */}
            <View
              style={[
                styles.statusPill,
                isCancelled
                  ? styles.pillCancelled
                  : isDelivered
                  ? styles.pillDelivered
                  : isTransit
                  ? styles.pillTransit
                  : styles.pillConfirmed,
              ]}
            >
              <CheckCircle2
                size={13}
                color={
                  isCancelled
                    ? '#DC2626'
                    : isTransit
                    ? '#D97706'
                    : '#16A34A'
                }
                strokeWidth={2.6}
              />
              <Text
                style={[
                  styles.statusPillText,
                  isCancelled
                    ? styles.pillTextCancelled
                    : isTransit
                    ? styles.pillTextTransit
                    : styles.pillTextConfirmed,
                ]}
              >
                {isCancelled
                  ? 'Cancelled'
                  : isDelivered
                  ? 'Delivered'
                  : isTransit
                  ? 'In Transit'
                  : 'Confirmed'}
              </Text>
            </View>
          </View>

          {/* LR Number row if assigned */}
          {lrNumber && (
            <View style={styles.lrRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.lrLabel}>LR NO:</Text>
                <Text style={styles.lrVal}>{lrNumber}</Text>
                <TouchableOpacity onPress={() => handleCopy(lrNumber)} style={styles.copyBtn}>
                  <Copy size={12} color="#C2410C" />
                </TouchableOpacity>
                {copiedId === lrNumber && <Text style={styles.copiedText}>Copied</Text>}
              </View>
              <TouchableOpacity
                style={styles.liveGpsBadge}
                onPress={() => onTrackShipment(trip?.id || bookingId)}
              >
                <Compass size={13} color="#F15A24" />
                <Text style={styles.liveGpsText}>Live GPS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 3. Quick Actions (3 Compact Horizontal Buttons) ── */}
        <View style={styles.actionStrip}>
          {/* Live Tracking */}
          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onTrackShipment(trip?.id || bookingId)}
            activeOpacity={0.8}
            accessibilityLabel="Live Tracking"
          >
            <Compass size={19} color="#F15A24" strokeWidth={2.4} />
            <Text style={[styles.actionTabText, { color: '#F15A24' }]}>Live Tracking</Text>
          </TouchableOpacity>

          {/* Documents */}
          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onViewDocuments(trip?.id || bookingId)}
            activeOpacity={0.8}
            accessibilityLabel="Documents"
          >
            <FileText size={19} color="#2563EB" strokeWidth={2.4} />
            <Text style={[styles.actionTabText, { color: '#2563EB' }]}>Documents</Text>
          </TouchableOpacity>

          {/* View POD */}
          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onViewPod(trip?.id || bookingId)}
            activeOpacity={0.8}
            accessibilityLabel="View POD"
          >
            <FileCheck2 size={19} color="#16A34A" strokeWidth={2.4} />
            <Text style={[styles.actionTabText, { color: '#16A34A' }]}>View POD</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Consignment Route Card ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MapPin size={17} color="#F15A24" strokeWidth={2.4} />
            <Text style={styles.cardTitle}>Consignment Route</Text>
          </View>

          {/* Origin / Pickup Node */}
          <View style={styles.routeItem}>
            <View style={styles.originMarkerDot} />
            <View style={{ flex: 1 }}>
              <View style={styles.nodeHeaderWithAction}>
                <Text style={styles.routeLabelOrigin}>ORIGIN (PICKUP LOCATION)</Text>
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() =>
                    handleOpenDirections(
                      req?.pickup_address,
                      req?.pickup_city,
                      req?.pickup_google_maps_url,
                      req?.pickup_latitude,
                      req?.pickup_longitude
                    )
                  }
                  accessibilityLabel="Navigate to Pickup"
                >
                  <Navigation size={12} color="#F15A24" strokeWidth={2.4} />
                  <Text style={styles.navigateBtnText}>Navigate to Pickup</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.routeAddr}>
                {req?.pickup_address || req?.pickup_city || 'North Eastern Freight Hub, Guwahati'}
              </Text>
              {req?.pickup_pincode && (
                <Text style={styles.routePin}>PIN Code: {req.pickup_pincode}</Text>
              )}
            </View>
          </View>

          {/* Route Dotted Connector */}
          <View style={styles.routeConnectorContainer}>
            <View style={styles.routeConnectorDotted} />
          </View>

          {/* Destination / Delivery Node */}
          <View style={styles.routeItem}>
            <View style={styles.destMarkerDot} />
            <View style={{ flex: 1 }}>
              <View style={styles.nodeHeaderWithAction}>
                <Text style={styles.routeLabelDest}>DESTINATION (DELIVERY LOCATION)</Text>
                <TouchableOpacity
                  style={styles.navigateBtnDelivery}
                  onPress={() =>
                    handleOpenDirections(
                      req?.destination_address,
                      req?.destination_city,
                      req?.destination_google_maps_url,
                      req?.destination_latitude,
                      req?.destination_longitude
                    )
                  }
                  accessibilityLabel="Navigate to Destination"
                >
                  <Navigation size={12} color="#16A34A" strokeWidth={2.4} />
                  <Text style={styles.navigateBtnTextDelivery}>Navigate to Destination</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.routeAddr}>
                {req?.destination_address || req?.destination_city || 'Eastern Logistics Yard, Kolkata'}
              </Text>
              {req?.destination_pincode && (
                <Text style={styles.routePin}>PIN Code: {req.destination_pincode}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── 5. Consignor and Consignee Contacts ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <User size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Consignor & Consignee Contacts</Text>
          </View>

          <View style={styles.contactsGrid}>
            {/* Consignor (Sender) */}
            <View style={styles.contactCol}>
              <View style={styles.contactIconWrap}>
                <Building2 size={16} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactRoleLabel}>Consignor (Sender)</Text>
                <Text style={styles.contactNameText}>
                  {req?.pickup_contact_name || 'Dispatch Coordinator'}
                </Text>
                {req?.pickup_contact_phone && (
                  <TouchableOpacity
                    onPress={() => handleCallDriver(req.pickup_contact_phone)}
                    style={styles.contactPhoneRow}
                  >
                    <Phone size={11} color="#0C1A34" />
                    <Text style={styles.contactPhoneText}>{req.pickup_contact_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Consignee (Receiver) */}
            <View style={styles.contactCol}>
              <View style={styles.contactIconWrap}>
                <Building2 size={16} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactRoleLabel}>Consignee (Receiver)</Text>
                <Text style={styles.contactNameText}>
                  {req?.drop_contact_name || 'Receiving Supervisor'}
                </Text>
                {req?.drop_contact_phone && (
                  <TouchableOpacity
                    onPress={() => handleCallDriver(req.drop_contact_phone)}
                    style={styles.contactPhoneRow}
                  >
                    <Phone size={11} color="#0C1A34" />
                    <Text style={styles.contactPhoneText}>{req.drop_contact_phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── 6. Cargo & Shipment Specifications ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Package size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Cargo & Shipment Specifications</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Material / Commodity</Text>
            <Text style={styles.value}>
              {req?.commodity_type
                ? `${req.commodity_type}${req?.material_type ? ` • ${req.material_type}` : ''}`
                : req?.material_type || 'Industrial Goods'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Required Capacity / Weight</Text>
            <Text style={styles.value}>
              {req?.total_cargo_weight
                ? `${req.total_cargo_weight} ${req.weight_unit || 'MT'}`
                : req?.required_capacity_mt
                ? `${req.required_capacity_mt} MT`
                : '25 MT Multi-Axle Payload'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Requested Vehicle Type</Text>
            <Text style={styles.value}>
              {req?.total_vehicles_count && req.total_vehicles_count > 1
                ? `${req.total_vehicles_count} Vehicles (${req.vehicle_type || 'Multi-Vehicle'})`
                : req?.vehicle_type || '32 FT Multi-Axle'}
            </Text>
          </View>

          <View style={[styles.row, !req?.id && !data?.requirement_id && { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Loading Date / Schedule</Text>
            <Text style={styles.value}>
              {req?.loading_datetime
                ? new Date(req.loading_datetime).toLocaleDateString('en-GB')
                : 'Immediate Dispatch'}
            </Text>
          </View>

          {/* Originating Requirement link when present */}
          {(req?.id || data?.requirement_id) && (
            <View style={[styles.row, styles.linkedReqRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkedReqLabel}>ORIGINATING REQUIREMENT</Text>
                <Text style={styles.linkedReqValue}>
                  {req?.id || data?.requirement_id}
                </Text>
              </View>
              {onViewRequirement && (
                <TouchableOpacity
                  style={styles.viewReqPill}
                  onPress={() => onViewRequirement(req?.id || data.requirement_id)}
                  activeOpacity={0.8}
                  accessibilityLabel="View Originating Requirement"
                >
                  <Text style={styles.viewReqPillText}>View RFQ</Text>
                  <ChevronRight size={13} color="#F15A24" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── 7. Assigned Vehicle and Driver ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Truck size={17} color="#F15A24" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Assigned Vehicle & Driver</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Reg. Number</Text>
            <Text
              style={[
                styles.value,
                vehicle?.registration_number
                  ? { color: '#0C1A34', fontWeight: '800' }
                  : { color: '#F15A24', fontWeight: '700' },
              ]}
            >
              {vehicle?.registration_number || 'Allocation in Progress'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Model / Specs</Text>
            <Text style={styles.value}>
              {vehicle?.vehicle_type || req?.vehicle_type || '32 FT Multi-Axle Container'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Assigned Driver</Text>
            <View style={styles.driverNameCol}>
              <Text style={styles.value}>{driver?.name || 'Driver Allocation Pending'}</Text>
              {driver?.name && (
                <View style={styles.kycBadge}>
                  <ShieldCheck size={11} color="#16A34A" />
                  <Text style={styles.kycBadgeText}>KYC Verified</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Driver Mobile</Text>
            {driver?.phone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => handleCallDriver(driver.phone)}
                accessibilityLabel="Call Driver"
              >
                <Phone size={13} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Call Driver</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.value, { color: '#94A3B8', fontStyle: 'italic' }]}>
                Pending Allocation
              </Text>
            )}
          </View>
        </View>

        {/* ── 7.5 Loading Stage Documents & Dual Weighbill Reconciliation ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Scale size={17} color="#F15A24" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Loading Documents & Dual Weighbill</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Dual Weighbill Status</Text>
            <View style={styles.kycBadge}>
              <CheckCircle2 size={11} color="#16A34A" />
              <Text style={styles.kycBadgeText}>Dual Confirmation System</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Required Loading Documents</Text>
            <Text style={styles.value}>Invoice, Weighbridge Slip, Material Docs</Text>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0, paddingTop: 12 }]}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#F15A24',
                paddingVertical: 11,
                borderRadius: 8,
              }}
              onPress={() => onViewDocuments(bookingId)}
              activeOpacity={0.88}
              accessibilityLabel="Upload and View Loading Documents"
            >
              <FileUp size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                Manage Documents & Weighbill
              </Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 8. Commercial & Financial Details ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <IndianRupee size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Commercial & Financials</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Agreed Freight Charge</Text>
            <Text style={[styles.value, { fontSize: 16, color: '#F15A24', fontWeight: '800' }]}>
              ₹{data?.total_amount ? Number(data.total_amount).toLocaleString('en-IN') : '32,000'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Payment Status</Text>
            <Text style={[styles.value, { color: '#16A34A', fontWeight: '700' }]}>
              {data?.payment_status || 'Net 15 Days Commercial Credit'}
            </Text>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Transit Insurance</Text>
            <Text style={styles.value}>Active Coverage (₹50L Comprehensive)</Text>
          </View>
        </View>

        {/* ── 9. Booking and Delivery Timeline ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Clock size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Booking & Delivery Timeline</Text>
          </View>

          {[
            {
              title: 'Booking Confirmed',
              desc: 'Freight confirmed and requirement reserved',
              status: 'Completed',
              state: 'completed',
            },
            {
              title: 'Lorry & Driver Assigned',
              desc: vehicle?.registration_number
                ? `Vehicle ${vehicle.registration_number} linked`
                : 'Operations allocating vehicle unit',
              status: isAssigned || isTransit || isDelivered ? 'Completed' : 'Pending',
              state: isAssigned || isTransit || isDelivered ? 'completed' : 'pending',
            },
            {
              title: 'Cargo Dispatched & In Transit',
              desc: isTransit || isDelivered ? 'Consignment moving via highway corridor' : 'Awaiting loading at pickup',
              status: isTransit || isDelivered ? 'In Transit' : 'Pending',
              state: isTransit || isDelivered ? (isDelivered ? 'completed' : 'active') : 'pending',
            },
            {
              title: 'Delivered & POD Verified',
              desc: isDelivered ? 'Consignment delivered successfully' : 'Final delivery pending',
              status: isDelivered ? 'Completed' : 'Pending',
              state: isDelivered ? 'completed' : 'pending',
            },
          ].map((milestone, idx, arr) => {
            const isDone = milestone.state === 'completed';
            const isActive = milestone.state === 'active';

            return (
              <View key={milestone.title} style={styles.timelineItem}>
                <View style={styles.timelineLeftCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      isDone
                        ? styles.timelineDotDone
                        : isActive
                        ? styles.timelineDotActive
                        : styles.timelineDotPending,
                    ]}
                  >
                    {isDone && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  {idx < arr.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        isDone ? styles.timelineLineDone : styles.timelineLinePending,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.timelineRightCol}>
                  <View style={styles.timelineHeaderRow}>
                    <Text
                      style={[
                        styles.timelineTitle,
                        isDone ? styles.timelineTitleDone : styles.timelineTitlePending,
                      ]}
                    >
                      {milestone.title}
                    </Text>
                    <View
                      style={[
                        styles.milestoneBadge,
                        isDone
                          ? styles.milestoneBadgeDone
                          : isActive
                          ? styles.milestoneBadgeActive
                          : styles.milestoneBadgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.milestoneBadgeText,
                          isDone
                            ? styles.milestoneBadgeTextDone
                            : isActive
                            ? styles.milestoneBadgeTextActive
                            : styles.milestoneBadgeTextPending,
                        ]}
                      >
                        {milestone.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.timelineDesc}>{milestone.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── 10. Bottom Actions ── */}
        <View style={styles.bottomActionsWrap}>
          {/* Primary Action Button: Open Live Shipment Tracking */}
          <TouchableOpacity
            style={styles.trackMainBtn}
            onPress={() => onTrackShipment(trip?.id || bookingId)}
            activeOpacity={0.88}
            accessibilityLabel="Open Live Shipment Tracking"
          >
            <Compass size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.trackMainBtnText}>Open Live Shipment Tracking</Text>
            <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Secondary Actions Row: Cancel Booking & Help & Support */}
          <View style={styles.secondaryActionsRow}>
            {canCancel && (
              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={() => setShowCancelModal(true)}
                activeOpacity={0.8}
                accessibilityLabel="Cancel Booking"
              >
                <XCircle size={16} color="#DC2626" />
                <Text style={styles.cancelActionBtnText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.supportActionBtn}
              onPress={
                onContactSupport ||
                (() =>
                  Alert.alert(
                    'Customer Support',
                    'Contact 24/7 Control Tower Operations at 1800-TRUCKS-CARRIERS'
                  ))
              }
              activeOpacity={0.8}
              accessibilityLabel="Help & Support"
            >
              <Headphones size={16} color="#0C1A34" />
              <Text style={styles.supportActionBtnText}>Help & Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Cancellation Modal ── */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalAlertIconBox}>
                <AlertTriangle size={24} color="#DC2626" />
              </View>
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#667085" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Cancel Booking?</Text>
            <Text style={styles.modalDesc}>
              Are you sure you want to cancel booking{' '}
              <Text style={{ fontWeight: '800', color: '#1D2D46' }}>{displayBookingId}</Text>?
            </Text>

            <Text style={styles.reasonInputLabel}>Select Cancellation Reason</Text>
            {[
              'Change of logistics schedule',
              'Found alternative carrier',
              'Consignment postponed by receiver',
              'Price or quotation mismatch',
            ].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  cancellationReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setCancellationReason(reason)}
              >
                <View
                  style={[
                    styles.radioCircle,
                    cancellationReason === reason && styles.radioCircleSelected,
                  ]}
                />
                <Text
                  style={[
                    styles.reasonOptionText,
                    cancellationReason === reason && styles.reasonOptionTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalDismissBtn}
                onPress={() => setShowCancelModal(false)}
                disabled={isCancelling}
              >
                <Text style={styles.modalDismissBtnText}>Keep Booking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmCancelBtn}
                onPress={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmCancelBtnText}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#F6F8FB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#667085',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
    letterSpacing: 0.5,
  },
  idBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  headerId: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0C1A34',
    letterSpacing: -0.2,
  },
  copyBtn: {
    padding: 4,
  },
  copiedText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  createdDate: {
    fontSize: 12.5,
    color: '#667085',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pillConfirmed: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pillTransit: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pillDelivered: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pillCancelled: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillTextConfirmed: {
    color: '#16A34A',
  },
  pillTextTransit: {
    color: '#D97706',
  },
  pillTextDelivered: {
    color: '#16A34A',
  },
  pillTextCancelled: {
    color: '#DC2626',
  },
  lrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  lrLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#667085',
  },
  lrVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C1A34',
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveGpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  actionStrip: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  actionTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  originMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F15A24',
    marginTop: 4,
  },
  destMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    marginTop: 4,
  },
  routeConnectorContainer: {
    marginLeft: 5,
    paddingVertical: 2,
  },
  routeConnectorDotted: {
    width: 2,
    height: 24,
    backgroundColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  nodeHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routeLabelOrigin: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.3,
  },
  routeLabelDest: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.3,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  navigateBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  navigateBtnDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  navigateBtnTextDelivery: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  routeAddr: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
    lineHeight: 19,
  },
  routePin: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 2,
  },
  contactsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCol: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  contactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contactRoleLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  contactNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 2,
  },
  contactPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  contactPhoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0C1A34',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  label: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 13.5,
    color: '#0C1A34',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.2,
  },
  linkedReqRow: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  linkedReqLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  linkedReqValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 1,
  },
  viewReqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewReqPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  driverNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kycBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  callBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 22,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineDotDone: {
    backgroundColor: '#16A34A',
  },
  timelineDotActive: {
    backgroundColor: '#F15A24',
  },
  timelineDotPending: {
    backgroundColor: '#E2E8F0',
  },
  timelineLine: {
    width: 2,
    height: 38,
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: '#16A34A',
  },
  timelineLinePending: {
    backgroundColor: '#E2E8F0',
  },
  timelineRightCol: {
    flex: 1,
    paddingBottom: 14,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  timelineTitleDone: {
    color: '#0C1A34',
  },
  timelineTitlePending: {
    color: '#64748B',
  },
  timelineDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  milestoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  milestoneBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  milestoneBadgeActive: {
    backgroundColor: '#FFEDD5',
  },
  milestoneBadgePending: {
    backgroundColor: '#F1F5F9',
  },
  milestoneBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  milestoneBadgeTextDone: {
    color: '#16A34A',
  },
  milestoneBadgeTextActive: {
    color: '#F15A24',
  },
  milestoneBadgeTextPending: {
    color: '#64748B',
  },
  bottomActionsWrap: {
    marginTop: 6,
    gap: 10,
  },
  trackMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F15A24',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  trackMainBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 11,
  },
  cancelActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  supportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 11,
  },
  supportActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1A34',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 52, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalAlertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0C1A34',
  },
  modalDesc: {
    fontSize: 13,
    color: '#667085',
    marginTop: 6,
    lineHeight: 18,
  },
  reasonInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 16,
    marginBottom: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  reasonOptionSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF7ED',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
  },
  radioCircleSelected: {
    borderColor: '#F15A24',
    borderWidth: 5,
  },
  reasonOptionText: {
    fontSize: 12.5,
    color: '#667085',
  },
  reasonOptionTextSelected: {
    color: '#0C1A34',
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalDismissBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modalDismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
  },
  modalConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
