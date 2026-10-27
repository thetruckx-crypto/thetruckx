import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
  Clipboard,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  Truck,
  MapPin,
  Calendar,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Clock,
  X,
  RotateCcw,
  Compass,
  AlertTriangle,
  Copy,
  Package,
  Eye,
  XCircle,
  FileText,
  Phone,
  ShieldCheck,
} from 'lucide-react-native';
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';
import { formatDisplayId } from '../../../utils/idGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type BookingStatusCategory =
  | 'ALL'
  | 'PENDING'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

interface MyBookingsScreenProps {
  clientId?: string;
  onBack: () => void;
  onSelectBooking: (bookingId: string) => void;
  onTrackShipment?: (bookingId: string) => void;
  onBookShipment?: () => void;
}

export interface EnrichedBooking {
  id: string;
  client_id?: string;
  requirement_id?: string;
  booking_status?: string;
  payment_status?: string;
  total_amount?: number;
  confirmed_at?: string;
  created_at?: string;
  requirements?: {
    pickup_address?: string;
    pickup_city?: string;
    pickup_pincode?: string;
    destination_address?: string;
    destination_city?: string;
    destination_pincode?: string;
    vehicle_type?: string;
    material_type?: string;
    required_capacity_mt?: number;
    loading_datetime?: string;
    pickup_contact_name?: string;
    pickup_contact_phone?: string;
    drop_contact_name?: string;
    drop_contact_phone?: string;
  };
  trips?: any[];
  trip?: {
    id: string;
    trip_status?: string;
    created_at?: string;
    lr_number?: string;
    vehicles?: {
      registration_number?: string;
      vehicle_type?: string;
      model?: string;
    };
    drivers?: {
      name?: string;
      phone?: string;
      license_number?: string;
    };
  } | null;
}

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
  clientId,
  onBack,
  onSelectBooking,
  onTrackShipment,
  onBookShipment,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<BookingStatusCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancelTargetBooking, setCancelTargetBooking] = useState<EnrichedBooking | null>(null);
  const [cancellationReason, setCancellationReason] = useState('Change of logistics schedule');
  const [isCancelling, setIsCancelling] = useState(false);

  // Copied toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load bookings from backend
  const loadBookings = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await clientService.fetchClientBookings(clientId);
      setBookings(data || []);
    } catch {
      setErrorMessage('Unable to load bookings. Please check your network connection.');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadBookings();

    // Supabase Realtime synchronization
    const channel = supabase
      .channel('client_bookings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  // Helper to map booking status into category
  const mapBookingToCategory = useCallback((b: EnrichedBooking): BookingStatusCategory => {
    const rawStatus = (b.booking_status || '').toUpperCase();
    const tripStatus = (b.trip?.trip_status || '').toUpperCase();

    if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED' || tripStatus === 'CANCELLED') {
      return 'CANCELLED';
    }
    if (rawStatus === 'DELIVERED' || tripStatus === 'DELIVERED' || tripStatus === 'COMPLETED') {
      return 'DELIVERED';
    }
    if (
      rawStatus === 'IN_TRANSIT' ||
      rawStatus === 'ACTIVE' ||
      rawStatus === 'ON_ROAD' ||
      tripStatus === 'IN_TRANSIT' ||
      tripStatus === 'DISPATCHED' ||
      tripStatus === 'LOADED' ||
      tripStatus === 'ACTIVE'
    ) {
      return 'TRANSIT';
    }
    if (
      rawStatus === 'ASSIGNED' ||
      rawStatus === 'LORRY_ASSIGNED' ||
      rawStatus === 'VEHICLE_ASSIGNED' ||
      tripStatus === 'LORRY_ASSIGNED' ||
      b.trip?.vehicles?.registration_number
    ) {
      return 'ASSIGNED';
    }
    if (rawStatus === 'CONFIRMED' || rawStatus === 'BOOKED' || rawStatus === 'CLIENT_ACCEPTED') {
      return 'CONFIRMED';
    }
    return 'PENDING';
  }, []);

  // Compute status counts dynamically across all loaded bookings
  const statusCounts = useMemo(() => {
    const counts: Record<BookingStatusCategory, number> = {
      ALL: bookings.length,
      PENDING: 0,
      CONFIRMED: 0,
      ASSIGNED: 0,
      TRANSIT: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    bookings.forEach((b) => {
      const cat = mapBookingToCategory(b);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, [bookings, mapBookingToCategory]);

  // Combined Search and Status Filter
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Status Filter
      if (selectedFilter !== 'ALL') {
        const cat = mapBookingToCategory(b);
        if (cat !== selectedFilter) return false;
      }

      // 2. Search Query matching
      if (!debouncedQuery) return true;

      const displayBookingId = formatDisplayId('BK', b.id, b.confirmed_at || b.created_at);
      const rawId = (b.id || '').toLowerCase();
      const lrNumber = (b.trip?.lr_number || formatDisplayId('TRP', b.trip?.id, b.trip?.created_at) || '').toLowerCase();
      const origin = `${b.requirements?.pickup_city || ''} ${b.requirements?.pickup_address || ''}`.toLowerCase();
      const dest = `${b.requirements?.destination_city || ''} ${b.requirements?.destination_address || ''}`.toLowerCase();
      const vehicleNum = (b.trip?.vehicles?.registration_number || '').toLowerCase();
      const vehicleType = (b.requirements?.vehicle_type || b.trip?.vehicles?.vehicle_type || '').toLowerCase();
      const driverName = (b.trip?.drivers?.name || '').toLowerCase();

      return (
        rawId.includes(debouncedQuery) ||
        displayBookingId.toLowerCase().includes(debouncedQuery) ||
        lrNumber.includes(debouncedQuery) ||
        origin.includes(debouncedQuery) ||
        dest.includes(debouncedQuery) ||
        vehicleNum.includes(debouncedQuery) ||
        vehicleType.includes(debouncedQuery) ||
        driverName.includes(debouncedQuery)
      );
    });
  }, [bookings, selectedFilter, debouncedQuery, mapBookingToCategory]);

  // Copy ID to clipboard
  const handleCopyId = (id: string) => {
    Clipboard.setString(id);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Perform Booking Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelTargetBooking || isCancelling) return;
    setIsCancelling(true);

    try {
      const res = await clientService.cancelBooking(
        cancelTargetBooking.id,
        clientId,
        cancellationReason
      );

      if (res.success) {
        Alert.alert('Booking Cancelled', `Booking ${cancelTargetBooking.id} has been cancelled successfully.`);
        setCancelTargetBooking(null);
        loadBookings();
      } else {
        Alert.alert('Cancellation Failed', res.message || 'Unable to cancel this booking.');
      }
    } catch {
      Alert.alert('Cancellation Error', 'An unexpected error occurred while cancelling.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Check cancellation eligibility: only PENDING or CONFIRMED before truck dispatch
  const isEligibleForCancellation = (b: EnrichedBooking): boolean => {
    const cat = mapBookingToCategory(b);
    return cat === 'PENDING' || (cat === 'CONFIRMED' && !b.trip);
  };

  // Determine status color styling
  const getStatusStyle = (cat: BookingStatusCategory) => {
    switch (cat) {
      case 'PENDING':
        return {
          bg: '#FEF3C7',
          color: '#B45309',
          border: '#FDE68A',
          label: 'Pending',
        };
      case 'CONFIRMED':
        return {
          bg: '#EFF6FF',
          color: '#1D4ED8',
          border: '#BFDBFE',
          label: 'Confirmed',
        };
      case 'ASSIGNED':
        return {
          bg: '#EEF2FF',
          color: '#4338CA',
          border: '#C7D2FE',
          label: 'Lorry Assigned',
        };
      case 'TRANSIT':
        return {
          bg: '#F0F9FF',
          color: '#0369A1',
          border: '#BAE6FD',
          label: 'In Transit',
        };
      case 'DELIVERED':
        return {
          bg: '#ECFDF5',
          color: '#15803D',
          border: '#A7F3D0',
          label: 'Delivered',
        };
      case 'CANCELLED':
        return {
          bg: '#FEF2F2',
          color: '#B91C1C',
          border: '#FECACA',
          label: 'Cancelled',
        };
      default:
        return {
          bg: '#F1F5F9',
          color: '#475569',
          border: '#E2E8F0',
          label: 'Standard',
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Header (Logo + Back Button) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Back to previous screen"
        >
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>My Bookings</Text>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* ── 2. Page Title & Subtitle ── */}
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitleText}>My Bookings & Orders</Text>
            <Text style={styles.pageSubtitleText}>
              Manage your bookings, assigned vehicles, and shipment status.
            </Text>
          </View>
          {onBookShipment && (
            <TouchableOpacity
              style={styles.newBookingBtn}
              onPress={onBookShipment}
              activeOpacity={0.85}
              accessibilityLabel="New Booking"
            >
              <Text style={styles.newBookingBtnText}>+ New Booking</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 3. Search Bar with Clear Button ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInner}>
          <Search size={18} color="#667085" strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by Booking ID, LR number, route..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              accessibilityLabel="Clear search input"
            >
              <X size={16} color="#667085" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 4. Horizontally Scrollable Status Filter Chips ── */}
      <View style={styles.filterScrollViewWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipContainer}
        >
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'PENDING', label: 'Pending' },
              { key: 'CONFIRMED', label: 'Confirmed' },
              { key: 'ASSIGNED', label: 'Assigned' },
              { key: 'TRANSIT', label: 'Active / In Transit' },
              { key: 'DELIVERED', label: 'Delivered' },
              { key: 'CANCELLED', label: 'Cancelled' },
            ] as const
          ).map((chip) => {
            const isSelected = selectedFilter === chip.key;
            const count = statusCounts[chip.key];

            return (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipSelected : styles.filterChipUnselected,
                ]}
                onPress={() => setSelectedFilter(chip.key)}
                activeOpacity={0.75}
                accessibilityLabel={`${chip.label} filter, count ${count}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected ? styles.filterChipTextSelected : styles.filterChipTextUnselected,
                  ]}
                >
                  {chip.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    isSelected
                      ? styles.filterCountBadgeSelected
                      : styles.filterCountBadgeUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountBadgeText,
                      isSelected
                        ? styles.filterCountBadgeTextSelected
                        : styles.filterCountBadgeTextUnselected,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 5. Main Booking Cards List & Empty States ── */}
      <ScrollView
        contentContainerStyle={styles.scrollListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F15A24"
            colors={['#F15A24']}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingStatusText}>Fetching confirmed bookings...</Text>
          </View>
        ) : errorMessage ? (
          /* Error State with Retry */
          <View style={styles.errorCard}>
            <AlertTriangle size={32} color="#DC2626" strokeWidth={2} />
            <Text style={styles.errorTitleText}>Failed to load bookings</Text>
            <Text style={styles.errorDescText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadBookings}>
              <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : bookings.length === 0 ? (
          /* 1. Empty State: No bookings exist at all */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Package size={36} color="#F15A24" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No bookings yet</Text>
            <Text style={styles.emptyMessageText}>
              Your confirmed bookings will appear here once you create a booking.
            </Text>
            <View style={styles.emptyActionsStack}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={onBookShipment || onBack}
                activeOpacity={0.85}
              >
                <Truck size={17} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.emptyPrimaryBtnText}>Book a Shipment</Text>
              </TouchableOpacity>

              {onTrackShipment && (
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  onPress={() => onTrackShipment('')}
                  activeOpacity={0.75}
                >
                  <Compass size={17} color="#0C1A34" strokeWidth={2.2} />
                  <Text style={styles.emptySecondaryBtnText}>Track an Existing Shipment</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : filteredBookings.length === 0 && searchQuery.length > 0 ? (
          /* 2. Empty State: No search results */
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#F8FAFC' }]}>
              <Search size={32} color="#667085" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No matching bookings</Text>
            <Text style={styles.emptyMessageText}>
              Try a different booking ID, LR number, or route.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.emptyActionButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : filteredBookings.length === 0 ? (
          /* 3. Empty State: No bookings for selected status */
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#F8FAFC' }]}>
              <ClipboardList size={32} color="#667085" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No bookings in this category</Text>
            <Text style={styles.emptyMessageText}>
              There are no bookings matching this status right now.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => setSelectedFilter('ALL')}
            >
              <Text style={styles.emptyActionButtonText}>View All Bookings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Booking Cards List */
          filteredBookings.map((b) => {
            const category = mapBookingToCategory(b);
            const statusConfig = getStatusStyle(category);
            const displayBookingId = formatDisplayId('BK', b.id, b.confirmed_at || b.created_at);

            const pickupCity =
              b.requirements?.pickup_city ||
              b.requirements?.pickup_address?.split(',')[0]?.trim() ||
              'Origin Hub';
            const destCity =
              b.requirements?.destination_city ||
              b.requirements?.destination_address?.split(',')[0]?.trim() ||
              'Destination Depot';

            const bookingDate = new Date(
              b.confirmed_at || b.created_at || Date.now()
            ).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            const vehicleNumber =
              b.trip?.vehicles?.registration_number ||
              b.requirements?.vehicle_type ||
              'Vehicle Allocation Pending';
            const vehicleModel = b.trip?.vehicles?.vehicle_type || '';
            const driverName = b.trip?.drivers?.name;

            const lrNumber =
              b.trip?.lr_number ||
              (b.trip?.id ? formatDisplayId('TRP', b.trip.id, b.trip.created_at) : null);

            const canCancel = isEligibleForCancellation(b);

            return (
              <TouchableOpacity
                key={b.id}
                style={styles.bookingCard}
                onPress={() => onSelectBooking(b.id)}
                activeOpacity={0.85}
              >
                {/* Card Header: Booking ID + Copy + Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.bookingIdWrap}>
                    <Text style={styles.bookingIdLabel}>BOOKING ID</Text>
                    <View style={styles.bookingIdBox}>
                      <Text style={styles.bookingIdValue}>{displayBookingId}</Text>
                      <TouchableOpacity
                        onPress={() => handleCopyId(displayBookingId)}
                        style={styles.copyBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Copy size={13} color="#667085" />
                      </TouchableOpacity>
                      {copiedId === displayBookingId && (
                        <Text style={styles.copiedBadgeText}>Copied</Text>
                      )}
                    </View>
                    <Text style={styles.bookingDateText}>Booked on {bookingDate}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: statusConfig.bg,
                        borderColor: statusConfig.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Route Section: ORIGIN ➔ DESTINATION */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeNode}>
                    <View style={styles.originMarkerDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeNodeHeader}>ORIGIN</Text>
                      <Text style={styles.routeNodeCity} numberOfLines={1}>
                        {pickupCity}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeConnectorCol}>
                    <Text style={styles.routeArrowText}>➔</Text>
                  </View>

                  <View style={styles.routeNode}>
                    <View style={styles.destMarkerDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeNodeHeader}>DESTINATION</Text>
                      <Text style={styles.routeNodeCity} numberOfLines={1}>
                        {destCity}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* LR or Consignment Number Banner if assigned */}
                {lrNumber && (
                  <View style={styles.lrBannerRow}>
                    <View style={styles.lrBadge}>
                      <Text style={styles.lrBadgeLabel}>LR NUMBER</Text>
                      <Text style={styles.lrBadgeValue}>{lrNumber}</Text>
                    </View>
                    {b.trip?.id && onTrackShipment && (
                      <TouchableOpacity
                        onPress={() => onTrackShipment(b.trip!.id)}
                        style={styles.quickTrackBtn}
                      >
                        <Compass size={14} color="#F15A24" />
                        <Text style={styles.quickTrackBtnText}>Live GPS</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Vehicle & Driver Details Strip */}
                <View style={styles.vehicleDriverRow}>
                  <View style={styles.vehicleInfoWrap}>
                    <Truck size={15} color="#0C1A34" style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicleRegText} numberOfLines={1}>
                        {vehicleNumber} {vehicleModel ? `(${vehicleModel})` : ''}
                      </Text>
                      {driverName && (
                        <Text style={styles.driverInfoText} numberOfLines={1}>
                          Driver: {driverName}
                        </Text>
                      )}
                    </View>
                  </View>

                  {b.total_amount ? (
                    <View style={styles.amountWrap}>
                      <Text style={styles.amountLabel}>FREIGHT CHARGE</Text>
                      <Text style={styles.amountValue}>
                        ₹{Number(b.total_amount).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Actions: View Details | Track Shipment | Cancel */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.viewDetailsActionBtn}
                    onPress={() => onSelectBooking(b.id)}
                    activeOpacity={0.75}
                  >
                    <Eye size={15} color="#0C1A34" />
                    <Text style={styles.viewDetailsActionText}>View Details</Text>
                    <ChevronRight size={14} color="#0C1A34" />
                  </TouchableOpacity>

                  <View style={styles.rightActionCluster}>
                    {canCancel && (
                      <TouchableOpacity
                        style={styles.cancelBookingBtn}
                        onPress={() => setCancelTargetBooking(b)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.cancelBookingBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}

                    {onTrackShipment && (
                      <TouchableOpacity
                        style={styles.trackShipmentBtn}
                        onPress={() => onTrackShipment(b.trip?.id || b.id)}
                        activeOpacity={0.8}
                      >
                        <Compass size={14} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.trackShipmentBtnText}>Track</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── 6. Cancellation Confirmation Modal ── */}
      <Modal
        visible={!!cancelTargetBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTargetBooking(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalAlertIconBox}>
                <AlertTriangle size={24} color="#DC2626" />
              </View>
              <TouchableOpacity
                onPress={() => setCancelTargetBooking(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#667085" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Cancel Booking?</Text>
            <Text style={styles.modalDesc}>
              Are you sure you want to cancel booking{' '}
              <Text style={{ fontWeight: '800', color: '#1D2D46' }}>
                {cancelTargetBooking?.id}
              </Text>
              ? This action cannot be undone.
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
                onPress={() => setCancelTargetBooking(null)}
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },

  /* 1. Top Header */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    width: 42,
  },

  /* 2. Page Title */
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  newBookingBtn: {
    backgroundColor: '#F15A24',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  newBookingBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pageTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C1A34',
    letterSpacing: -0.3,
  },
  pageSubtitleText: {
    fontSize: 13,
    color: '#667085',
    marginTop: 4,
    lineHeight: 18,
  },

  /* 3. Search Field */
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1D2D46',
    fontWeight: '500',
  },
  clearSearchBtn: {
    padding: 6,
  },

  /* 4. Horizontally Scrollable Status Filter Chips */
  filterScrollViewWrap: {
    marginVertical: 8,
  },
  filterChipContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  filterChipSelected: {
    backgroundColor: '#0C1A34',
    borderColor: '#0C1A34',
  },
  filterChipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EAECF0',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextUnselected: {
    color: '#667085',
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  filterCountBadgeUnselected: {
    backgroundColor: '#F1F5F9',
  },
  filterCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterCountBadgeTextSelected: {
    color: '#FFFFFF',
  },
  filterCountBadgeTextUnselected: {
    color: '#667085',
  },

  /* 5. Scroll Content & Cards */
  scrollListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },

  /* Loading State */
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingStatusText: {
    marginTop: 14,
    fontSize: 13.5,
    color: '#667085',
    fontWeight: '600',
  },

  /* Error State */
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  errorTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B91C1C',
    marginTop: 10,
  },
  errorDescText: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Empty States */
  emptyStateContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyHeadingText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0C1A34',
    textAlign: 'center',
  },
  emptyMessageText: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyActionsStack: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  emptyPrimaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#F15A24',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySecondaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptySecondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  emptyActionButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 12,
  },
  emptyActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F15A24',
  },

  /* Booking Card */
  bookingCard: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingIdWrap: {
    flex: 1,
  },
  bookingIdLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  bookingIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  bookingIdValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  copyBtn: {
    padding: 2,
  },
  copiedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 2,
  },
  bookingDateText: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* Route Container: ORIGIN ➔ DESTINATION */
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  routeNode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originMarkerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F15A24',
  },
  destMarkerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#16A34A',
  },
  routeNodeHeader: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  routeNodeCity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
    marginTop: 1,
  },
  routeConnectorCol: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeArrowText: {
    fontSize: 14,
    color: '#667085',
    fontWeight: '700',
  },

  /* LR Banner */
  lrBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  lrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lrBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  lrBadgeValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1D2D46',
  },
  quickTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickTrackBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },

  /* Vehicle & Driver Details */
  vehicleDriverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  vehicleInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginRight: 10,
  },
  vehicleRegText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D2D46',
  },
  driverInfoText: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 1,
  },
  amountWrap: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F15A24',
    marginTop: 1,
  },

  /* Card Actions */
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
  },
  viewDetailsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  viewDetailsActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  rightActionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBookingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBookingBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  trackShipmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F15A24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trackShipmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
