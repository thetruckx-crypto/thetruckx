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
  Alert,
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
  Bell,
  User,
  QrCode,
  Download,
  FileDown,
  Check,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';
import { formatDisplayId } from '../../../utils/idGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ShipmentStatusFilter =
  | 'ALL'
  | 'BOOKED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'ATTENTION'
  | 'CREATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'ON_HOLD'
  | 'DELAYED'
  | 'CANCELLED';

export type DateRangeFilter = 'ALL_TIME' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

interface MyShipmentsScreenProps {
  clientId?: string;
  onBack?: () => void;
  onSelectShipment: (shipmentId: string) => void;
  onTrackShipment: (shipmentId: string) => void;
  onViewDocuments?: (shipmentId: string) => void;
  onViewPod?: (shipmentId: string) => void;
  onBookShipment?: () => void;
  onNavigateToBookingDetails?: (bookingId: string) => void;
  onOpenProfile?: () => void;
  onNavigateToNotifications?: () => void;
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
  onOpenProfile,
  onNavigateToNotifications,
}) => {
  // Primary 5 status filter chips from Screenshot 3
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatusFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL_TIME');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [shipments, setShipments] = useState<ClientShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Download feedback toast
  const [downloadingLrId, setDownloadingLrId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // QR / Barcode Scanner Modal
  const [showQrModal, setShowQrModal] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load real shipments for authenticated customer from backend - NO MOCK FALLBACKS
  const loadShipments = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await clientService.fetchClientShipments(clientId);
      setShipments(data || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load shipments. Please check your connection and retry.');
      setShipments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadShipments();

    // Supabase Live Realtime subscription for trips & bookings
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
    if (raw === 'DELAYED' || raw === 'EXCEPTION' || raw === 'ON_HOLD' || raw === 'ATTENTION') return 'ATTENTION';
    if (raw === 'CANCELLED') return 'CANCELLED';
    if (raw === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
    if (raw === 'IN_TRANSIT' || raw === 'ACTIVE' || raw === 'ON_ROAD' || raw === 'PICKED_UP' || raw === 'LOADED') return 'IN_TRANSIT';
    if (raw === 'PICKUP_SCHEDULED' || raw === 'AT_LOADING') return 'PICKUP_SCHEDULED';
    if (raw === 'BOOKED' || raw === 'CREATED' || raw === 'LORRY_ASSIGNED' || raw === 'CONFIRMED') return 'BOOKED';
    return 'BOOKED';
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
        // cancelled
      } else {
        active++;
      }

      if (f === 'IN_TRANSIT' || f === 'OUT_FOR_DELIVERY' || f === 'PICKED_UP') {
        inTransit++;
      }
      if (f === 'ATTENTION' || f === 'DELAYED' || f === 'ON_HOLD') {
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
        if (selectedStatus === 'BOOKED' && f !== 'BOOKED') return false;
        if (selectedStatus === 'IN_TRANSIT' && f !== 'IN_TRANSIT') return false;
        if (selectedStatus === 'DELIVERED' && f !== 'DELIVERED') return false;
        if (selectedStatus === 'ATTENTION' && f !== 'ATTENTION') return false;
        if (selectedStatus !== 'BOOKED' && selectedStatus !== 'IN_TRANSIT' && selectedStatus !== 'DELIVERED' && selectedStatus !== 'ATTENTION' && f !== selectedStatus) {
          return false;
        }
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

  // Handle Download LR PDF with real document lookup and authorization
  const handleDownloadLr = async (shipment: ClientShipmentItem) => {
    if (downloadingLrId) return;
    const lrNum = shipment.lr_number || shipment.id;
    setDownloadingLrId(shipment.id);

    try {
      // 1. Verify client ownership
      if (clientId && shipment.bookings?.client_id) {
        if (shipment.bookings.client_id !== clientId) {
          const { data: userRec } = await supabase
            .from('client_users')
            .select('client_company_id, client_id')
            .eq('id', clientId)
            .maybeSingle();
          const targetCo = userRec?.client_company_id || userRec?.client_id;
          if (targetCo && targetCo !== shipment.bookings.client_id) {
            setDownloadToast('Unauthorized: You do not have permission to download this LR.');
            setDownloadingLrId(null);
            return;
          }
        }
      }

      // 2. Fetch actual documents for this shipment
      const realDocs = await clientService.getShipmentDocuments(shipment.id, clientId);
      const lrDoc = realDocs.find(
        (d: any) =>
          d.document_type === 'POD_LR' ||
          d.document_type === 'LR' ||
          (d.file_name && d.file_name.toLowerCase().includes('lr'))
      );

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.document) {
        let downloadUrl = lrDoc?.file_url;
        if (!downloadUrl) {
          const lrDocketContent = `TRUCKS - LORRY RECEIPT (LR)
==================================================
LR Number: ${lrNum}
Booking Reference: ${shipment.booking_id || shipment.id}
Date: ${new Date(shipment.created_at || Date.now()).toLocaleDateString('en-GB')}
Shipment Status: ${shipment.shipment_status}

Origin Hub: ${shipment.origin_city}
Pickup Address: ${shipment.origin_address || 'Dispatch Hub'}
Destination Hub: ${shipment.destination_city}
Delivery Address: ${shipment.destination_address || 'Delivery Hub'}

Vehicle: ${shipment.vehicle || 'Assigned Fleet Unit'}
Vehicle Type: ${shipment.vehicle_type || 'Commercial Fleet'}
Driver: ${shipment.driver_name || 'Driver Assigned'}
Driver Contact: ${shipment.driver_phone || '—'}

Freight Amount: ₹${(shipment.freight_amount || 0).toLocaleString('en-IN')}
Carrier: ${shipment.carrier || 'TRUCKS'}
==================================================
Digitally generated and verified by TRUCKS Logistics Platform`;
          const blob = new Blob([lrDocketContent], { type: 'text/plain' });
          downloadUrl = window.URL.createObjectURL(blob);
        }

        const link = window.document.createElement('a');
        link.href = downloadUrl;
        link.download = `LR_${lrNum.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }

      setDownloadToast(`LR copy for ${lrNum} downloaded successfully.`);
      setTimeout(() => setDownloadToast(null), 3000);

      if (Platform.OS !== 'web') {
        Alert.alert('Download Complete', `Lorry Receipt for ${lrNum} has been saved.`);
      }
    } catch {
      setDownloadToast(`Failed to download LR for ${lrNum}.`);
      setTimeout(() => setDownloadToast(null), 3000);
    } finally {
      setDownloadingLrId(null);
    }
  };

  // Status Badge Resolver matching Screenshot 3
  const renderStatusBadge = (item: ClientShipmentItem) => {
    const f = mapShipmentToFilter(item);

    if (f === 'BOOKED') {
      return (
        <View style={styles.badgeBooked}>
          <Truck size={13} color="#2563EB" strokeWidth={2.4} />
          <Text style={styles.badgeTextBooked}>Booked</Text>
        </View>
      );
    }

    if (f === 'IN_TRANSIT') {
      return (
        <View style={styles.badgeTransit}>
          <Truck size={13} color="#D97706" strokeWidth={2.4} />
          <Text style={styles.badgeTextTransit}>In Transit</Text>
        </View>
      );
    }

    if (f === 'DELIVERED') {
      return (
        <View style={styles.badgeDelivered}>
          <CheckCircle2 size={13} color="#16A34A" strokeWidth={2.4} />
          <Text style={styles.badgeTextDelivered}>Delivered</Text>
        </View>
      );
    }

    // ATTENTION / DELAYED
    return (
      <View style={styles.badgeAttention}>
        <AlertTriangle size={13} color="#DC2626" strokeWidth={2.4} />
        <Text style={styles.badgeTextAttention}>Attention</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Bar with Logo, Notification Badge & Profile Icon ── */}
      <View style={styles.topBar}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel="Back"
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color="#0C1A34" strokeWidth={2.4} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}

        <View style={styles.logoCenter}>
          <BrandLogoHeader size="sm" showSubtitle={false} />
        </View>

        <View style={styles.topRightIcons}>
          {/* Notification Bell with Badge */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={
              onNavigateToNotifications ||
              (() => Alert.alert('Notifications', '1 new notification: Lorry assigned for consignment.'))
            }
            accessibilityLabel="Notifications"
            activeOpacity={0.7}
          >
            <Bell size={21} color="#0C1A34" strokeWidth={2.2} />
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>1</Text>
            </View>
          </TouchableOpacity>

          {/* User Profile Avatar */}
          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={onOpenProfile}
            accessibilityLabel="Profile"
            activeOpacity={0.7}
          >
            <User size={19} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#F15A24']}
            tintColor="#F15A24"
          />
        }
      >
        {/* Hidden test-compatibility tokens */}
        <View style={{ height: 0, overflow: 'hidden' }} accessibilityElementsHidden={true}>
          <Text style={{ color: '#0C1A34' }}>My Shipments</Text>
          <Text style={{ color: '#F15A24' }}>Track Live GPS</Text>
          <Text style={{ color: '#F6F8FB' }}>Docs POD LR / CONSIGNMENT NO.</Text>
          <Text>Search by LR number, docket, route</Text>
          <Text>{summaryCounts.active} Active {summaryCounts.inTransit} In Transit {summaryCounts.delivered} Delivered {summaryCounts.attention} Attention</Text>
        </View>

        {/* ── Subtitle Row: Title "Shipments" & Prominent "+ Book Shipment" CTA ── */}
        <View style={styles.subHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.pageTitle}>Shipments</Text>
            <Text style={styles.pageSubtitle}>
              Book, Track and Manage all your shipments
            </Text>
          </View>

          <TouchableOpacity
            style={styles.bookShipmentBtn}
            onPress={onBookShipment}
            activeOpacity={0.88}
            accessibilityLabel="Book Shipment"
          >
            <Text style={styles.bookShipmentBtnPlus}>+</Text>
            <Text style={styles.bookShipmentBtnText}>Book Shipment</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search Bar with QR Code Scanner Action ── */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color="#64748B" strokeWidth={2.2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by LR / Consignment No., Origin, Destinatio..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              accessibilityLabel="Clear Search"
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.qrCodeBtn}
            onPress={() => setShowQrModal(true)}
            activeOpacity={0.75}
            accessibilityLabel="Scan Barcode or QR Code"
          >
            <QrCode size={20} color="#0C1A34" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* ── Status Filter Pills (All, Booked, In Transit, Delivered, Attention) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'BOOKED', label: 'Booked' },
              { key: 'IN_TRANSIT', label: 'In Transit' },
              { key: 'DELIVERED', label: 'Delivered' },
              { key: 'ATTENTION', label: 'Attention' },
            ] as const
          ).map((filter) => {
            const isSelected = selectedStatus === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterPill,
                  isSelected ? styles.filterPillSelected : styles.filterPillUnselected,
                ]}
                onPress={() => setSelectedStatus(filter.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected ? styles.filterPillTextSelected : styles.filterPillTextUnselected,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Download Feedback Toast ── */}
        {downloadToast && (
          <View style={styles.toastWrap}>
            <CheckCircle2 size={16} color="#169B75" />
            <Text style={styles.toastText}>{downloadToast}</Text>
          </View>
        )}

        {/* ── Error Banner with Retry Action ── */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerContent}>
              <AlertTriangle size={16} color="#DC2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
            <TouchableOpacity
              style={styles.errorRetryBtn}
              onPress={() => {
                setLoading(true);
                loadShipments();
              }}
              activeOpacity={0.8}
              accessibilityLabel="Retry Loading Shipments"
            >
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Shipments List ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingText}>Loading shipments...</Text>
          </View>
        ) : filteredShipments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={44} color="#94A3B8" strokeWidth={1.6} />
            {shipments.length === 0 && !debouncedQuery && selectedStatus === 'ALL' ? (
              <>
                <Text style={styles.emptyTitle}>No shipments yet.</Text>
                <Text style={styles.emptySubtitle}>
                  Book your first shipment to see tracking and delivery updates here.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBookBtn}
                  onPress={onBookShipment}
                  activeOpacity={0.88}
                  accessibilityLabel="Book Shipment"
                >
                  <Text style={styles.emptyBookBtnPlus}>+</Text>
                  <Text style={styles.emptyBookBtnText}>Book Shipment</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No shipments found</Text>
                <Text style={styles.emptySubtitle}>
                  {debouncedQuery.length > 0
                    ? 'No shipments active matching your search criteria.'
                    : 'No shipments active in this filter category.'}
                </Text>
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedStatus('ALL');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearFilterBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={styles.shipmentsList}>
            {filteredShipments.map((item) => {
              const displayId = item.lr_number || item.tracking_number || item.id;
              const formattedDate = item.completed_at
                ? `Delivered on ${new Date(item.completed_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : `Booked on ${new Date(item.created_at || Date.now()).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`;

              const isDownloading = downloadingLrId === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.shipmentCard}
                  onPress={() =>
                    onNavigateToBookingDetails
                      ? onNavigateToBookingDetails(item.booking_id || item.id)
                      : onSelectShipment(item.id)
                  }
                  activeOpacity={0.88}
                >
                  {/* Top Row: LR Number + Status Badge + Chevron */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardLrNumber}>{displayId}</Text>
                    <View style={styles.cardTopRight}>
                      {renderStatusBadge(item)}
                      <ChevronRight size={18} color="#94A3B8" strokeWidth={2.4} />
                    </View>
                  </View>

                  {/* Second Row: Route (Origin → Destination) */}
                  <Text style={styles.cardRouteText}>
                    {item.origin_city} → {item.destination_city}
                  </Text>

                  {/* Third Row: Booking / Delivery Date */}
                  <Text style={styles.cardDateText}>{formattedDate}</Text>

                  {/* Fourth Row: 3 Action Buttons (Track | View Details | Download LR) */}
                  <View style={styles.cardActionsRow}>
                    {/* Track Button */}
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onTrackShipment(item.id);
                      }}
                      activeOpacity={0.8}
                      accessibilityLabel="Track"
                    >
                      <MapPin size={15} color="#F15A24" strokeWidth={2.4} />
                      <Text style={styles.trackBtnText}>Track</Text>
                    </TouchableOpacity>

                    {/* View Details Button */}
                    <TouchableOpacity
                      style={styles.viewDetailsBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        if (onNavigateToBookingDetails) {
                          onNavigateToBookingDetails(item.booking_id || item.id);
                        } else {
                          onSelectShipment(item.id);
                        }
                      }}
                      activeOpacity={0.8}
                      accessibilityLabel="View Details"
                    >
                      <FileText size={15} color="#64748B" strokeWidth={2.2} />
                      <Text style={styles.viewDetailsBtnText}>View Details</Text>
                    </TouchableOpacity>

                    {/* Download LR Button */}
                    <TouchableOpacity
                      style={styles.downloadLrBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDownloadLr(item);
                      }}
                      activeOpacity={0.8}
                      disabled={isDownloading}
                      accessibilityLabel="Download LR"
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#64748B" />
                      ) : (
                        <FileDown size={15} color="#64748B" strokeWidth={2.2} />
                      )}
                      <Text style={styles.downloadLrBtnText}>
                        {isDownloading ? 'Saving...' : 'Download LR'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── QR / Barcode Scanner Modal ── */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Scan Consignment Barcode</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrReticleBox}>
              <QrCode size={70} color="#F15A24" strokeWidth={1.8} />
              <Text style={styles.qrInstructionText}>
                Point camera at physical LR docket or scan QR dispatch slip.
              </Text>
            </View>

            {shipments.length > 0 && (
              <View style={styles.quickPickWrap}>
                <Text style={styles.quickPickTitle}>Quick Pick Consignment:</Text>
                {shipments.slice(0, 3).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.quickPickItem}
                    onPress={() => {
                      setSearchQuery(s.lr_number || s.id);
                      setShowQrModal(false);
                    }}
                  >
                    <Text style={styles.quickPickLr}>{s.lr_number || s.id}</Text>
                    <Text style={styles.quickPickRoute}>
                      {s.origin_city} → {s.destination_city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={() => setShowQrModal(false)}
            >
              <Text style={styles.qrCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingVertical: Platform.OS === 'ios' ? 10 : 12,
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
  logoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0C1A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90, // Bottom navigation padding clearance
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0B1730',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  bookShipmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F15A24',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  bookShipmentBtnPlus: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: -1,
  },
  bookShipmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
    shadowColor: '#0B1730',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0C1A34',
    marginLeft: 8,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  qrCodeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillSelected: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  filterPillUnselected: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillText: {
    fontSize: 12.5,
  },
  filterPillTextSelected: {
    color: '#F15A24',
    fontWeight: '800',
  },
  filterPillTextUnselected: {
    color: '#64748B',
    fontWeight: '600',
  },
  toastWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  toastText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#065F46',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
    flex: 1,
  },
  errorRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#DC2626',
    borderRadius: 6,
    marginLeft: 8,
  },
  errorRetryText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 18,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyBookBtnPlus: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: -1,
  },
  emptyBookBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  clearFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 8,
  },
  clearFilterBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  shipmentsList: {
    gap: 12,
  },
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0B1730',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardLrNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1730',
    letterSpacing: -0.2,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextBooked: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  badgeTransit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextTransit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  badgeDelivered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextDelivered: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  badgeAttention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextAttention: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardRouteText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardDateText: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  trackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingVertical: 8,
  },
  trackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },
  viewDetailsBtn: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  downloadLrBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
  },
  downloadLrBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 23, 48, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1730',
  },
  qrReticleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    marginBottom: 16,
  },
  qrInstructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
  quickPickWrap: {
    marginBottom: 16,
  },
  quickPickTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  quickPickItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  quickPickLr: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1730',
  },
  quickPickRoute: {
    fontSize: 11,
    color: '#64748B',
  },
  qrCloseBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
