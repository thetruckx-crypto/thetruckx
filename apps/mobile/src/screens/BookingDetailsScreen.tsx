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
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { clientService } from '../services/clientService';
import { formatDisplayId } from '../utils/idGenerator';
import {
  buildGoogleMapsDirectionsUrl,
  isValidGoogleMapsUrl,
} from '../utils/googleMapsUtil';

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
          <BrandLogoHeader size="sm" showSubtitle={false} />
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#F15A24" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const req = data?.requirements;
  const trip = data?.trip || (data?.trips && data.trips[0]) || null;
  const vehicle = trip?.vehicles;
  const driver = trip?.drivers;
  const displayBookingId = formatDisplayId('BK', data?.id || bookingId, data?.confirmed_at || data?.created_at);
  const lrNumber = trip?.lr_number || (trip?.id ? formatDisplayId('TRP', trip.id, trip.created_at) : null);

  const statusRaw = (trip?.trip_status || data?.booking_status || 'CONFIRMED').toUpperCase();
  const isDelivered = statusRaw === 'DELIVERED';
  const isTransit = statusRaw === 'IN_TRANSIT' || statusRaw === 'ACTIVE' || statusRaw === 'DISPATCHED';
  const isAssigned = statusRaw === 'ASSIGNED' || statusRaw === 'LORRY_ASSIGNED' || !!vehicle?.registration_number;
  const isCancelled = statusRaw === 'CANCELLED';
  const canCancel = !isCancelled && !isDelivered && !isTransit;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" showSubtitle={false} />
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. Top Summary Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>BOOKING REFERENCE</Text>
              <View style={styles.idBox}>
                <Text style={styles.headerId}>{displayBookingId}</Text>
                <TouchableOpacity onPress={() => handleCopy(displayBookingId)} style={styles.copyBtn}>
                  <Copy size={13} color="#667085" />
                </TouchableOpacity>
                {copiedId === displayBookingId && <Text style={styles.copiedText}>Copied</Text>}
              </View>
              <Text style={styles.createdDate}>
                Booked on{' '}
                {new Date(data?.confirmed_at || data?.created_at || Date.now()).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                isCancelled
                  ? styles.pillCancelled
                  : isDelivered
                  ? styles.pillDelivered
                  : isTransit
                  ? styles.pillTransit
                  : isAssigned
                  ? styles.pillAssigned
                  : styles.pillConfirmed,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isCancelled
                    ? styles.pillTextCancelled
                    : isDelivered
                    ? styles.pillTextDelivered
                    : isTransit
                    ? styles.pillTextTransit
                    : isAssigned
                    ? styles.pillTextAssigned
                    : styles.pillTextConfirmed,
                ]}
              >
                {isCancelled
                  ? 'Cancelled'
                  : isDelivered
                  ? 'Delivered'
                  : isTransit
                  ? 'In Transit'
                  : isAssigned
                  ? 'Lorry Assigned'
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

        {/* 3. Quick Action Strip */}
        <View style={styles.actionStrip}>
          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onTrackShipment(trip?.id || bookingId)}
            activeOpacity={0.8}
          >
            <Compass size={18} color="#F15A24" strokeWidth={2.2} />
            <Text style={[styles.actionTabText, { color: '#F15A24' }]}>Live Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onViewDocuments(trip?.id || bookingId)}
            activeOpacity={0.8}
          >
            <FileText size={18} color="#2563EB" strokeWidth={2.2} />
            <Text style={[styles.actionTabText, { color: '#2563EB' }]}>Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTab}
            onPress={() => onViewPod(trip?.id || bookingId)}
            activeOpacity={0.8}
          >
            <FileCheck2 size={18} color="#16A34A" strokeWidth={2.2} />
            <Text style={[styles.actionTabText, { color: '#16A34A' }]}>View POD</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Consignment Route Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MapPin size={17} color="#F15A24" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Consignment Route</Text>
          </View>

          {/* Pickup Node */}
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
                  <Navigation size={12} color="#F15A24" />
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

          <View style={styles.routeConnector} />

          {/* Delivery Node */}
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
                  <Navigation size={12} color="#16A34A" />
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

        {/* 5. Consignor & Consignee Details */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <User size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Consignor & Consignee Contacts</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Consignor (Sender)</Text>
            <Text style={styles.value}>
              {req?.pickup_contact_name || 'Dispatch Coordinator'}
              {req?.pickup_contact_phone ? ` (${req.pickup_contact_phone})` : ''}
            </Text>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Consignee (Receiver)</Text>
            <Text style={styles.value}>
              {req?.drop_contact_name || 'Receiving Supervisor'}
              {req?.drop_contact_phone ? ` (${req.drop_contact_phone})` : ''}
            </Text>
          </View>
        </View>

        {/* 6. Cargo & Packaging Details */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Package size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Cargo & Shipment Specifications</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Material / Commodity</Text>
            <Text style={styles.value}>{req?.material_type || 'Industrial Goods'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Required Capacity / Weight</Text>
            <Text style={styles.value}>
              {req?.required_capacity_mt ? `${req.required_capacity_mt} MT` : '25 MT Multi-Axle Payload'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Requested Vehicle Type</Text>
            <Text style={styles.value}>{req?.vehicle_type || '32 FT Multi-Axle'}</Text>
          </View>

          <View style={[styles.row, !req?.id && !data?.requirement_id && { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Loading Date / Schedule</Text>
            <Text style={styles.value}>
              {req?.loading_datetime
                ? new Date(req.loading_datetime).toLocaleDateString('en-GB')
                : 'Immediate Dispatch'}
            </Text>
          </View>

          {/* Linked Originating Requirement */}
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

        {/* 7. Assigned Vehicle & Driver Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Truck size={17} color="#F15A24" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Assigned Vehicle & Driver</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Vehicle Reg. Number</Text>
            <Text style={[styles.value, { color: '#0C1A34', fontWeight: '800' }]}>
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

        {/* 8. Commercial & Freight Details */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <IndianRupee size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Commercial & Financials</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Agreed Freight Charge</Text>
            <Text style={[styles.value, { fontSize: 16, color: '#F15A24', fontWeight: '800' }]}>
              ₹{Number(data?.total_amount || 32000).toLocaleString('en-IN')}
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

        {/* 9. Shipment Status Milestones Timeline */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Clock size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Booking & Delivery Timeline</Text>
          </View>

          {[
            {
              title: 'Booking Confirmed',
              desc: 'Freight confirmed and requirement reserved',
              done: true,
            },
            {
              title: 'Lorry & Driver Assigned',
              desc: vehicle?.registration_number
                ? `Vehicle ${vehicle.registration_number} linked`
                : 'Operations allocating vehicle unit',
              done: isAssigned || isTransit || isDelivered,
            },
            {
              title: 'Cargo Dispatched & In Transit',
              desc: isTransit || isDelivered ? 'Consignment moving via highway corridor' : 'Awaiting loading at pickup',
              done: isTransit || isDelivered,
            },
            {
              title: 'Delivered & POD Verified',
              desc: isDelivered ? 'Consignment delivered successfully' : 'Final delivery pending',
              done: isDelivered,
            },
          ].map((milestone, idx, arr) => (
            <View key={milestone.title} style={styles.timelineItem}>
              <View style={styles.timelineLeftCol}>
                <View
                  style={[
                    styles.timelineDot,
                    milestone.done ? styles.timelineDotDone : styles.timelineDotPending,
                  ]}
                >
                  {milestone.done && <CheckCircle2 size={13} color="#FFFFFF" strokeWidth={3} />}
                </View>
                {idx < arr.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      milestone.done ? styles.timelineLineDone : styles.timelineLinePending,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineRightCol}>
                <Text
                  style={[
                    styles.timelineTitle,
                    milestone.done ? styles.timelineTitleDone : styles.timelineTitlePending,
                  ]}
                >
                  {milestone.title}
                </Text>
                <Text style={styles.timelineDesc}>{milestone.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 10. Actions Section */}
        <View style={styles.bottomActionsWrap}>
          {/* Main CTA: Live Tracking */}
          <TouchableOpacity
            style={styles.trackMainBtn}
            onPress={() => onTrackShipment(trip?.id || bookingId)}
            activeOpacity={0.88}
          >
            <Compass size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.trackMainBtnText}>Open Live Shipment Tracking</Text>
            <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.secondaryActionsRow}>
            {canCancel && (
              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={() => setShowCancelModal(true)}
              >
                <XCircle size={16} color="#DC2626" />
                <Text style={styles.cancelActionBtnText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.supportActionBtn}
              onPress={onContactSupport || (() => Alert.alert('Customer Support', 'Call 24/7 Operations Desk at 1800-NECL-CARRIERS'))}
            >
              <Headphones size={16} color="#0C1A34" />
              <Text style={styles.supportActionBtnText}>Help & Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cancellation Modal */}
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
    borderBottomColor: '#EAECF0',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13.5,
    color: '#667085',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  /* Summary Card */
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  idBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  headerId: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0C1A34',
  },
  copyBtn: {
    padding: 3,
  },
  copiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  createdDate: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillConfirmed: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  pillTextConfirmed: {
    color: '#1D4ED8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillAssigned: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  pillTextAssigned: {
    color: '#4338CA',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillTransit: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  pillTextTransit: {
    color: '#0369A1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillDelivered: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pillTextDelivered: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pillCancelled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pillTextCancelled: {
    color: '#B91C1C',
    fontSize: 11.5,
    fontWeight: '700',
  },
  lrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
  },
  lrLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#C2410C',
  },
  lrVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D2D46',
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveGpsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },

  /* Action Strip */
  actionStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionTab: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  actionTabText: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0C1A34',
  },

  /* Route items */
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  originMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F15A24',
    marginTop: 4,
  },
  destMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginTop: 4,
  },
  routeLabelOrigin: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.5,
  },
  routeLabelDest: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  nodeHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  navigateBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F15A24',
  },
  navigateBtnDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  navigateBtnTextDelivery: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  routeAddr: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1D2D46',
    marginTop: 2,
    lineHeight: 18,
  },
  routePin: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 2,
  },
  routeConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginLeft: 4,
    marginVertical: 4,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  linkedReqRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  linkedReqLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.5,
  },
  linkedReqValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0C1A34',
    marginTop: 2,
  },
  viewReqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewReqPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F15A24',
  },
  label: {
    fontSize: 12.5,
    color: '#667085',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    color: '#1D2D46',
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '65%',
  },
  driverNameCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kycBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Timeline */
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: '#16A34A',
  },
  timelineDotPending: {
    backgroundColor: '#E2E8F0',
  },
  timelineLine: {
    width: 2,
    height: 28,
  },
  timelineLineDone: {
    backgroundColor: '#16A34A',
  },
  timelineLinePending: {
    backgroundColor: '#E2E8F0',
  },
  timelineRightCol: {
    flex: 1,
    paddingTop: 1,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineTitleDone: {
    color: '#1D2D46',
  },
  timelineTitlePending: {
    color: '#94A3B8',
  },
  timelineDesc: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 2,
  },

  /* Bottom Actions */
  bottomActionsWrap: {
    gap: 10,
  },
  trackMainBtn: {
    height: 50,
    backgroundColor: '#F15A24',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  trackMainBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  supportActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  supportActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1A34',
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 52, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
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
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
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
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
    marginBottom: 16,
  },
  reasonInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    marginBottom: 8,
    gap: 10,
  },
  reasonOptionSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF5ED',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  radioCircleSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#F15A24',
  },
  reasonOptionText: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '500',
  },
  reasonOptionTextSelected: {
    color: '#0C1A34',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalDismissBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDismissBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#667085',
  },
  modalConfirmCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
