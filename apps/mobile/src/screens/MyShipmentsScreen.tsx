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
  FileText,
  Phone,
  ShieldCheck,
  Filter,
  Eye,
  FileCheck2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { clientService } from '../services/clientService';
import { supabase } from '../supabase';
import { formatDisplayId } from '../utils/idGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ShipmentStatusFilter =
  | 'ALL'
  | 'CREATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'ON_HOLD'
  | 'DELAYED'
  | 'CANCELLED';

export type DateRangeFilter = 'ALL_TIME' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

interface MyShipmentsScreenProps {
  clientId?: string;
  onBack: () => void;
  onSelectShipment: (shipmentId: string) => void;
  onTrackShipment: (shipmentId: string) => void;
  onViewDocuments?: (shipmentId: string) => void;
  onViewPod?: (shipmentId: string) => void;
  onBookShipment?: () => void;
  onNavigateToBookingDetails?: (bookingId: string) => void;
}

export interface ClientShipmentItem {
  id: string;
  booking_id?: string;
  lr_number: string;
  tracking_number: string;
  origin_city: string;
  destination_city: string;
  origin_address?: string;
  destination_address?: string;
  shipment_status: string;
  raw_status?: string;
  created_at?: string;
  completed_at?: string;
  expected_delivery?: string;
  vehicle: string;
  vehicle_type?: string;
  driver_name?: string;
  driver_phone?: string;
  carrier?: string;
  freight_amount?: number;
  bookings?: any;
}

export const MyShipmentsScreen: React.FC<MyShipmentsScreenProps> = ({
  clientId,
  onBack,
  onSelectShipment,
  onTrackShipment,
  onViewDocuments,
  onViewPod,
  onBookShipment,
  onNavigateToBookingDetails,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatusFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL_TIME');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [shipments, setShipments] = useState<ClientShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Copied toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load shipments strictly for logged-in customer
  const loadShipments = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await clientService.fetchClientShipments(clientId);
      setShipments(data || []);
    } catch {
      setErrorMessage('Unable to load shipments. Please verify network connection.');
      setShipments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadShipments();

    // Supabase Live Realtime subscription for trips
    const channel = supabase
      .channel('client_shipments_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadShipments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadShipments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadShipments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadShipments();
  };

  // Map shipment record to status category
  const mapShipmentToFilter = useCallback((s: ClientShipmentItem): ShipmentStatusFilter => {
    const raw = (s.raw_status || s.shipment_status || '').toUpperCase();
    if (raw === 'DELIVERED' || raw === 'COMPLETED') return 'DELIVERED';
    if (raw === 'DELAYED' || raw === 'EXCEPTION') return 'DELAYED';
    if (raw === 'CANCELLED') return 'CANCELLED';
    if (raw === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
    if (raw === 'IN_TRANSIT' || raw === 'ACTIVE' || raw === 'ON_ROAD') return 'IN_TRANSIT';
    if (raw === 'PICKED_UP' || raw === 'LOADED') return 'PICKED_UP';
    if (raw === 'PICKUP_SCHEDULED' || raw === 'AT_LOADING') return 'PICKUP_SCHEDULED';
    if (raw === 'ON_HOLD') return 'ON_HOLD';
    return 'CREATED';
  }, []);

  // Compute 4 Summary Counts for Overview Cards
  const summaryCounts = useMemo(() => {
    let active = 0;
    let inTransit = 0;
    let delivered = 0;
    let attention = 0;

    shipments.forEach((s) => {
      const f = mapShipmentToFilter(s);
      if (f === 'DELIVERED') {
        delivered++;
      } else if (f === 'CANCELLED') {
        // cancelled not active
      } else {
        active++;
      }

      if (f === 'IN_TRANSIT' || f === 'OUT_FOR_DELIVERY' || f === 'PICKED_UP') {
        inTransit++;
      }
      if (f === 'DELAYED' || f === 'ON_HOLD') {
        attention++;
      }
    });

    return { active, inTransit, delivered, attention };
  }, [shipments, mapShipmentToFilter]);

  // Combined Search, Status Filter, and Date Range Filter
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL') {
        const f = mapShipmentToFilter(s);
        if (f !== selectedStatus) return false;
      }

      // 2. Date Range Filter
      if (dateRange !== 'ALL_TIME' && s.created_at) {
        const itemDate = new Date(s.created_at).getTime();
        const now = Date.now();
        if (dateRange === 'TODAY' && now - itemDate > 24 * 60 * 60 * 1000) return false;
        if (dateRange === 'THIS_WEEK' && now - itemDate > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === 'THIS_MONTH' && now - itemDate > 30 * 24 * 60 * 60 * 1000) return false;
      }

      // 3. Search Query
      if (!debouncedQuery) return true;

      const lr = (s.lr_number || '').toLowerCase();
      const tracking = (s.tracking_number || '').toLowerCase();
      const tripId = (s.id || '').toLowerCase();
      const bookingId = (s.booking_id || '').toLowerCase();
      const origin = `${s.origin_city || ''} ${s.origin_address || ''}`.toLowerCase();
      const dest = `${s.destination_city || ''} ${s.destination_address || ''}`.toLowerCase();
      const vehicle = (s.vehicle || '').toLowerCase();
      const driver = (s.driver_name || '').toLowerCase();

      return (
        lr.includes(debouncedQuery) ||
        tracking.includes(debouncedQuery) ||
        tripId.includes(debouncedQuery) ||
        bookingId.includes(debouncedQuery) ||
        origin.includes(debouncedQuery) ||
        dest.includes(debouncedQuery) ||
        vehicle.includes(debouncedQuery) ||
        driver.includes(debouncedQuery)
      );
    });
  }, [shipments, selectedStatus, dateRange, debouncedQuery, mapShipmentToFilter]);

  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Delivered':
        return { bg: '#ECFDF5', text: '#15803D', border: '#A7F3D0' };
      case 'In Transit':
      case 'Out for Delivery':
        return { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' };
      case 'Picked Up':
      case 'Pickup Scheduled':
        return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
      case 'Delayed':
      case 'On Hold':
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
      case 'Cancelled':
        return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
      default:
        return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Compact Header (Logo + Back Button) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" showSubtitle={false} />
        <View style={{ width: 42 }} />
      </View>

      {/* ── 2. Screen Title Block ── */}
      <View style={styles.titleContainer}>
        <Text style={styles.pageTitleText}>My Shipments</Text>
        <Text style={styles.pageSubtitleText}>
          Real-time consignment tracking, transit milestones, and delivery management.
        </Text>
      </View>

      {/* ── 3. Four Summary Overview Cards (Active, Transit, Delivered, Attention) ── */}
      <View style={styles.summaryGrid}>
        <TouchableOpacity
          style={[styles.summaryCard, selectedStatus === 'ALL' && styles.summaryCardSelected]}
          onPress={() => setSelectedStatus('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.summaryCount, { color: '#0C1A34' }]}>{summaryCounts.active}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
          <View style={[styles.summaryIndicator, { backgroundColor: '#0C1A34' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, selectedStatus === 'IN_TRANSIT' && styles.summaryCardSelected]}
          onPress={() => setSelectedStatus(selectedStatus === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
          activeOpacity={0.8}
        >
          <Text style={[styles.summaryCount, { color: '#F15A24' }]}>{summaryCounts.inTransit}</Text>
          <Text style={styles.summaryLabel}>In Transit</Text>
          <View style={[styles.summaryIndicator, { backgroundColor: '#F15A24' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, selectedStatus === 'DELIVERED' && styles.summaryCardSelected]}
          onPress={() => setSelectedStatus(selectedStatus === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
          activeOpacity={0.8}
        >
          <Text style={[styles.summaryCount, { color: '#16A34A' }]}>{summaryCounts.delivered}</Text>
          <Text style={styles.summaryLabel}>Delivered</Text>
          <View style={[styles.summaryIndicator, { backgroundColor: '#16A34A' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, selectedStatus === 'DELAYED' && styles.summaryCardSelected]}
          onPress={() => setSelectedStatus(selectedStatus === 'DELAYED' ? 'ALL' : 'DELAYED')}
          activeOpacity={0.8}
        >
          <Text style={[styles.summaryCount, { color: '#D97706' }]}>{summaryCounts.attention}</Text>
          <Text style={styles.summaryLabel}>Attention</Text>
          <View style={[styles.summaryIndicator, { backgroundColor: '#D97706' }]} />
        </TouchableOpacity>
      </View>

      {/* ── 4. Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInner}>
          <Search size={18} color="#667085" strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by LR number, docket, route, vehicle..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={16} color="#667085" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 5. Status Filter Chips ── */}
      <View style={styles.filterScrollViewWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipContainer}>
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'IN_TRANSIT', label: 'In Transit' },
              { key: 'PICKED_UP', label: 'Picked Up' },
              { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
              { key: 'DELIVERED', label: 'Delivered' },
              { key: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
              { key: 'CREATED', label: 'Created' },
              { key: 'ON_HOLD', label: 'On Hold' },
              { key: 'DELAYED', label: 'Delayed' },
              { key: 'CANCELLED', label: 'Cancelled' },
            ] as const
          ).map((chip) => {
            const isSelected = selectedStatus === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.filterChip, isSelected ? styles.filterChipSelected : styles.filterChipUnselected]}
                onPress={() => setSelectedStatus(chip.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, isSelected ? styles.filterChipTextSelected : styles.filterChipTextUnselected]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 6. Main Shipments List & Empty States ── */}
      <ScrollView
        contentContainerStyle={styles.scrollListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F15A24" colors={['#F15A24']} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingStatusText}>Loading consignments from fleet tracking...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <AlertTriangle size={32} color="#DC2626" strokeWidth={2} />
            <Text style={styles.errorTitleText}>Failed to load shipments</Text>
            <Text style={styles.errorDescText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadShipments}>
              <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : shipments.length === 0 ? (
          /* Empty State: No shipments */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Compass size={36} color="#F15A24" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No shipments active</Text>
            <Text style={styles.emptyMessageText}>
              Consignments assigned with an LR or tracking docket will automatically appear here.
            </Text>
            <View style={styles.emptyActionsStack}>
              {onBookShipment && (
                <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={onBookShipment} activeOpacity={0.85}>
                  <Truck size={17} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyPrimaryBtnText}>Book a Consignment</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : filteredShipments.length === 0 && searchQuery.length > 0 ? (
          /* Empty Search */
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#F8FAFC' }]}>
              <Search size={32} color="#667085" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No matching shipments</Text>
            <Text style={styles.emptyMessageText}>Try a different LR number, docket, or route location.</Text>
            <TouchableOpacity style={styles.emptyActionButton} onPress={() => setSearchQuery('')}>
              <Text style={styles.emptyActionButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : filteredShipments.length === 0 ? (
          /* Empty Category */
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: '#F8FAFC' }]}>
              <Package size={32} color="#667085" strokeWidth={2} />
            </View>
            <Text style={styles.emptyHeadingText}>No shipments in this category</Text>
            <Text style={styles.emptyMessageText}>There are no shipments matching this filter right now.</Text>
            <TouchableOpacity style={styles.emptyActionButton} onPress={() => setSelectedStatus('ALL')}>
              <Text style={styles.emptyActionButtonText}>View All Shipments</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Shipment Cards List */
          filteredShipments.map((s) => {
            const badge = getStatusBadgeStyle(s.shipment_status);
            const dateStr = s.created_at
              ? new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Recent';

            return (
              <TouchableOpacity
                key={s.id}
                style={styles.shipmentCard}
                onPress={() => onTrackShipment(s.id)}
                activeOpacity={0.85}
              >
                {/* Header: LR / Docket Number + Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.lrWrap}>
                    <Text style={styles.lrLabel}>LR / CONSIGNMENT NO.</Text>
                    <View style={styles.lrBox}>
                      <Text style={styles.lrValue}>{s.lr_number}</Text>
                      <TouchableOpacity onPress={() => handleCopy(s.lr_number)} style={styles.copyBtn}>
                        <Copy size={13} color="#667085" />
                      </TouchableOpacity>
                      {copiedId === s.lr_number && <Text style={styles.copiedBadgeText}>Copied</Text>}
                    </View>
                    <Text style={styles.dateText}>Dispatched: {dateStr}</Text>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.statusPillText, { color: badge.text }]}>{s.shipment_status}</Text>
                  </View>
                </View>

                {/* Linked Booking ID if available */}
                {s.booking_id && (
                  <View style={styles.bookingLinkRow}>
                    <Text style={styles.bookingLinkLabel}>Originating Booking:</Text>
                    <TouchableOpacity
                      onPress={() => onNavigateToBookingDetails?.(s.booking_id!)}
                      style={styles.bookingLinkBtn}
                    >
                      <Text style={styles.bookingLinkText}>{s.booking_id}</Text>
                      <ChevronRight size={13} color="#F15A24" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Route Section: ORIGIN ➔ DESTINATION */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeNode}>
                    <View style={styles.originMarkerDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeNodeHeader}>ORIGIN</Text>
                      <Text style={styles.routeNodeCity} numberOfLines={1}>
                        {s.origin_city}
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
                        {s.destination_city}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Assigned Vehicle & Driver */}
                <View style={styles.vehicleDriverRow}>
                  <View style={styles.vehicleInfoWrap}>
                    <Truck size={15} color="#0C1A34" style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicleRegText} numberOfLines={1}>
                        {s.vehicle} {s.vehicle_type ? `• ${s.vehicle_type}` : ''}
                      </Text>
                      {s.driver_name && (
                        <Text style={styles.driverInfoText} numberOfLines={1}>
                          Driver: {s.driver_name} {s.driver_phone ? `(${s.driver_phone})` : ''}
                        </Text>
                      )}
                    </View>
                  </View>

                  {s.expected_delivery && (
                    <View style={styles.deliveryDateWrap}>
                      <Text style={styles.deliveryDateLabel}>EXPECTED DELIVERY</Text>
                      <Text style={styles.deliveryDateValue}>{s.expected_delivery}</Text>
                    </View>
                  )}
                </View>

                {/* Card Actions: Track Shipment | View Documents | View POD */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.trackDetailsActionBtn}
                    onPress={() => onTrackShipment(s.id)}
                    activeOpacity={0.8}
                  >
                    <Compass size={15} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.trackDetailsActionText}>Track Live GPS</Text>
                    <ChevronRight size={14} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View style={styles.rightActionCluster}>
                    {onViewDocuments && (
                      <TouchableOpacity
                        style={styles.docActionBtn}
                        onPress={() => onViewDocuments(s.id)}
                        activeOpacity={0.75}
                      >
                        <FileText size={14} color="#0C1A34" />
                        <Text style={styles.docActionBtnText}>Docs</Text>
                      </TouchableOpacity>
                    )}

                    {onViewPod && (
                      <TouchableOpacity
                        style={styles.podActionBtn}
                        onPress={() => onViewPod(s.id)}
                        activeOpacity={0.75}
                      >
                        <FileCheck2 size={14} color="#16A34A" />
                        <Text style={styles.podActionBtnText}>POD</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
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
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
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

  /* 4 Summary Cards */
  summaryGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryCardSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFFBF8',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667085',
    marginTop: 2,
  },
  summaryIndicator: {
    width: 16,
    height: 2.5,
    borderRadius: 1.5,
    marginTop: 6,
  },

  /* Search */
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
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

  /* Filter Chips */
  filterScrollViewWrap: {
    marginVertical: 6,
  },
  filterChipContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
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
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextUnselected: {
    color: '#667085',
  },

  /* Scroll list */
  scrollListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
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

  /* Shipment Card */
  shipmentCard: {
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
    marginBottom: 10,
  },
  lrWrap: {
    flex: 1,
  },
  lrLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  lrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  lrValue: {
    fontSize: 15,
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
  dateText: {
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
  bookingLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  bookingLinkLabel: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '500',
  },
  bookingLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bookingLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },
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
  deliveryDateWrap: {
    alignItems: 'flex-end',
  },
  deliveryDateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  deliveryDateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
  },
  trackDetailsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  trackDetailsActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rightActionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  docActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
  },
  podActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  podActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
});
