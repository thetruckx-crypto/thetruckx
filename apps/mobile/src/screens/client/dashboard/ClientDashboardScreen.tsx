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
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import {
  Search,
  ArrowRight,
  Package,
  FileText,
  ClipboardList,
  Headphones,
  ChevronRight,
  Home,
  User,
  LogOut,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  X,
  Phone,
  Bell,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { supabase } from '../../../supabase';
import { AuthSessionData, authService } from '../../../services/authService';
import { clientService } from '../../../services/clientService';
import { formatDisplayId } from '../../../utils/idGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ClientDashboardScreenProps {
  session: AuthSessionData | null;
  onLogout: () => void;
  onNavigateToBooking?: () => void;
  onNavigateToShipments?: () => void;
  onOpenProfile?: () => void;
  onNavigateToCreateRequirement?: () => void;
  onNavigateToRequirements?: () => void;
  onNavigateToBookings?: () => void;
  onNavigateToTracking?: (trackingId: string) => void;
  onNavigateToSupport?: () => void;
  onNavigateToSavedAddresses?: () => void;
  onNavigateToNotifications?: () => void;
}

interface ShipmentItem {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  statusText: string;
  statusType: 'transit' | 'delivered' | 'booked' | 'delayed';
  date: string;
  vehicle: string;
  carrier: string;
  expectedDelivery?: string;
  isDelayed?: boolean;
}

export const ClientDashboardScreen: React.FC<ClientDashboardScreenProps> = ({
  session,
  onLogout,
  onNavigateToBooking,
  onNavigateToShipments,
  onOpenProfile,
  onNavigateToCreateRequirement,
  onNavigateToRequirements,
  onNavigateToBookings,
  onNavigateToTracking,
  onNavigateToSupport,
  onNavigateToSavedAddresses,
  onNavigateToNotifications,
}) => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Filter for Shipment Overview
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ACTIVE' | 'TRANSIT' | 'DELIVERED' | 'ATTENTION'>('ALL');

  // Modals
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [trackingResult, setTrackingResult] = useState<ShipmentItem | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  // Time-based personalized greeting
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const customerName = useMemo(() => {
    if (session?.fullName) {
      return session.fullName.split(' ')[0];
    }
    if (session?.companyName) {
      return session.companyName;
    }
    return 'Partner';
  }, [session]);

  const clientCode = useMemo(() => {
    return formatDisplayId('CL', session?.userId, session?.createdAt);
  }, [session]);

  // Load real customer records scoped strictly to authenticated client/company
  const loadData = useCallback(async () => {
    try {
      const clientId = session?.userId;
      if (!clientId) {
        setShipments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Resolve companyId if session.userId is client_users.id
      let targetCompanyId = clientId;
      const { data: userRec } = await supabase
        .from('client_users')
        .select('client_id, client_company_id')
        .eq('id', clientId)
        .maybeSingle();

      if (userRec?.client_id || userRec?.client_company_id) {
        targetCompanyId = userRec.client_id || userRec.client_company_id;
      }

      // 2. Fetch requirements for this client
      const { data: myReqs } = await supabase
        .from('requirements')
        .select('id, pickup_address, destination_address')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`);

      const reqIds = (myReqs || []).map((r) => r.id);

      // 3. Fetch real bookings
      let myBookings: any[] = [];
      const { data: bData } = await supabase
        .from('bookings')
        .select('*, requirements(*)')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
        .order('confirmed_at', { ascending: false })
        .limit(15);

      if (bData && bData.length > 0) {
        myBookings = bData;
      } else if (reqIds.length > 0) {
        const { data: bByReq } = await supabase
          .from('bookings')
          .select('*, requirements(*)')
          .in('requirement_id', reqIds)
          .order('confirmed_at', { ascending: false })
          .limit(15);
        myBookings = bByReq || [];
      }

      // 4. Fetch associated trips
      const bookingIds = myBookings.map((b) => b.id);
      let myTrips: any[] = [];
      if (bookingIds.length > 0) {
        const { data: tData } = await supabase
          .from('trips')
          .select('*, vehicles(registration_number, vehicle_type)')
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false })
          .limit(15);
        myTrips = tData || [];
      }

      const realShipments: ShipmentItem[] = [];

      // Map trips first
      if (myTrips.length > 0) {
        myTrips.forEach((t) => {
          let statusText = 'In Transit';
          let statusType: 'delivered' | 'transit' | 'booked' | 'delayed' = 'transit';
          let isDelayed = false;

          if (t.trip_status === 'DELIVERED') {
            statusText = 'Delivered';
            statusType = 'delivered';
          } else if (t.trip_status === 'DELAYED' || t.trip_status === 'EXCEPTION') {
            statusText = 'Delayed';
            statusType = 'delayed';
            isDelayed = true;
          } else if (t.trip_status === 'BOOKED' || t.trip_status === 'LORRY_ASSIGNED') {
            statusText = 'Lorry Assigned';
            statusType = 'booked';
          }

          const dateObj = new Date(t.created_at || Date.now());
          const dateFormatted = dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          realShipments.push({
            id: t.id,
            trackingNumber: formatDisplayId('TRP', t.id, t.created_at),
            origin: t.pickup_city || 'Guwahati Hub',
            destination: t.destination_city || 'Kolkata Depot',
            statusText,
            statusType,
            date: dateFormatted,
            vehicle: t.vehicles?.registration_number || 'Transport Unit Assigned',
            carrier: 'TRUCKS',
            expectedDelivery: t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-GB') : undefined,
            isDelayed,
          });
        });
      } else if (myBookings.length > 0) {
        myBookings.forEach((b) => {
          const dateObj = new Date(b.confirmed_at || Date.now());
          realShipments.push({
            id: b.id,
            trackingNumber: formatDisplayId('BK', b.id, b.confirmed_at),
            origin: b.requirements?.pickup_address?.split(',')[0] || 'Origin Depot',
            destination: b.requirements?.destination_address?.split(',')[0] || 'Destination Depot',
            statusText: b.booking_status === 'CONFIRMED' ? 'Confirmed' : 'Pending',
            statusType: 'booked',
            date: dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            vehicle: 'Vehicle Allocation Pending',
            carrier: 'TRUCKS',
          });
        });
      }

      setShipments(realShipments);

      // 5. Fetch notification count
      try {
        const notifs = await authService.fetchRealNotifications();
        const unread = notifs.filter((n: any) => !n.read).length;
        setUnreadNotificationsCount(unread);
      } catch {
        // Notification count fallback
      }
    } catch (err) {
      console.warn('Dashboard data fetch notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.userId]);

  useEffect(() => {
    loadData();

    // Live Supabase Realtime sync for bookings, trips, and quotations
    const channel = supabase
      .channel('client_dashboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    setTrackingError(null);
    loadData();
  };

  // ─── 1. Primary Action: Real Shipment Tracking Lookup ─────────────────────
  const handleTrackShipment = async (overrideNum?: string) => {
    const rawInput = overrideNum || trackingNumber;
    const cleanQuery = (rawInput || '').trim().toUpperCase();

    if (!cleanQuery) {
      setTrackingError('Please enter a valid LR or Consignment Tracking number.');
      return;
    }

    setTrackingError(null);
    setIsSearchingTracking(true);

    try {
      // 1. Check loaded client shipments first
      const foundInList = shipments.find(
        (s) =>
          s.trackingNumber.toUpperCase().includes(cleanQuery) ||
          s.id.toLowerCase().includes(cleanQuery.toLowerCase())
      );

      if (foundInList) {
        setIsSearchingTracking(false);
        if (onNavigateToTracking) {
          onNavigateToTracking(foundInList.id);
          return;
        }
        setTrackingResult(foundInList);
        setShowTrackingModal(true);
        return;
      }

      // 2. Query tracking service directly via clientService
      const tripData = await clientService.fetchShipmentTracking(cleanQuery, session?.userId);
      if (tripData) {
        setIsSearchingTracking(false);
        if (onNavigateToTracking) {
          onNavigateToTracking(tripData.id);
          return;
        }
        setTrackingResult({
          id: tripData.id,
          trackingNumber: formatDisplayId('TRP', tripData.id, tripData.created_at),
          origin: tripData.pickup_city || 'Origin Hub',
          destination: tripData.destination_city || 'Destination Hub',
          statusText: tripData.trip_status === 'DELIVERED' ? 'Delivered' : 'In Transit',
          statusType: tripData.trip_status === 'DELIVERED' ? 'delivered' : 'transit',
          date: new Date(tripData.created_at || Date.now()).toLocaleDateString('en-GB'),
          vehicle: tripData.vehicles?.registration_number || 'Transport Unit',
          carrier: 'TRUCKS',
        });
        setShowTrackingModal(true);
        return;
      }

      // 3. Fallback direct Supabase query across trips and bookings
      const cleanId = cleanQuery.replace(/[^a-zA-Z0-9-]/g, '');
      const { data: dbTrip } = await supabase
        .from('trips')
        .select('*, vehicles(registration_number)')
        .or(`id.ilike.%${cleanId}%,booking_id.ilike.%${cleanId}%,lr_number.ilike.%${cleanId}%`)
        .maybeSingle();

      if (dbTrip) {
        setIsSearchingTracking(false);
        if (onNavigateToTracking) {
          onNavigateToTracking(dbTrip.id);
          return;
        }
        setTrackingResult({
          id: dbTrip.id,
          trackingNumber: dbTrip.lr_number || formatDisplayId('TRP', dbTrip.id, dbTrip.created_at),
          origin: dbTrip.pickup_city || 'Consignment Depot',
          destination: dbTrip.destination_city || 'Delivery Yard',
          statusText: dbTrip.trip_status === 'DELIVERED' ? 'Delivered' : 'In Transit',
          statusType: dbTrip.trip_status === 'DELIVERED' ? 'delivered' : 'transit',
          date: new Date(dbTrip.created_at || Date.now()).toLocaleDateString('en-GB'),
          vehicle: dbTrip.vehicles?.registration_number || 'Transport Unit',
          carrier: 'TRUCKS',
        });
        setShowTrackingModal(true);
        return;
      }

      // No match found
      setTrackingError(`No shipment found for LR / Consignment Number "${cleanQuery}". Please verify the number or contact dispatch.`);
    } catch {
      setTrackingError('Unable to complete tracking lookup right now. Check network connection and retry.');
    } finally {
      setIsSearchingTracking(false);
    }
  };

  // ─── 2. Quick Action Tiles Navigation ─────────────────────────────────────
  const handleQuickAction = (action: 'shipments' | 'book' | 'quote' | 'support') => {
    switch (action) {
      case 'shipments':
        if (onNavigateToShipments) onNavigateToShipments();
        else if (onNavigateToBookings) onNavigateToBookings();
        break;
      case 'book':
        if (onNavigateToCreateRequirement) onNavigateToCreateRequirement();
        else if (onNavigateToBooking) onNavigateToBooking();
        break;
      case 'quote':
        if (onNavigateToRequirements) onNavigateToRequirements();
        else if (onNavigateToCreateRequirement) onNavigateToCreateRequirement();
        break;
      case 'support':
        if (onNavigateToSupport) onNavigateToSupport();
        else setShowSupportModal(true);
        break;
    }
  };

  // ─── 3. Overview Counts Derived from Real Data ────────────────────────────
  const overviewStats = useMemo(() => {
    const active = shipments.filter((s) => s.statusType !== 'delivered').length;
    const inTransit = shipments.filter((s) => s.statusType === 'transit').length;
    const delivered = shipments.filter((s) => s.statusType === 'delivered').length;
    const attention = shipments.filter((s) => s.statusType === 'delayed' || s.isDelayed).length;
    return { active, inTransit, delivered, attention };
  }, [shipments]);

  // Filtered shipments list
  const filteredShipments = useMemo(() => {
    if (selectedFilter === 'ACTIVE') return shipments.filter((s) => s.statusType !== 'delivered');
    if (selectedFilter === 'TRANSIT') return shipments.filter((s) => s.statusType === 'transit');
    if (selectedFilter === 'DELIVERED') return shipments.filter((s) => s.statusType === 'delivered');
    if (selectedFilter === 'ATTENTION') return shipments.filter((s) => s.statusType === 'delayed' || s.isDelayed);
    return shipments;
  }, [shipments, selectedFilter]);

  // Top 4 recent shipments
  const recentShipmentsToDisplay = useMemo(() => {
    return filteredShipments.slice(0, 4);
  }, [filteredShipments]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Top Header (Logo + Personalized Greeting + Notification Bell + Profile) ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <BrandLogoHeader size="sm" theme="light" />
        </View>

        <View style={styles.headerRightActions}>
          {/* Notification Bell with Unread Badge */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => (onNavigateToNotifications ? onNavigateToNotifications() : null)}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color="#1D2D46" strokeWidth={2} />
            {unreadNotificationsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Profile Shortcut */}
          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => (onOpenProfile ? onOpenProfile() : setShowProfileModal(true))}
            activeOpacity={0.8}
            accessibilityLabel="Profile shortcut"
          >
            <View style={styles.avatarInner}>
              <User size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting Strip */}
      <View style={styles.greetingStrip}>
        <View>
          <Text style={styles.greetingPrefixText}>{greeting},</Text>
          <Text style={styles.customerNameText} numberOfLines={1}>
            {customerName}
          </Text>
        </View>
        <View style={styles.clientCodeChip}>
          <Text style={styles.clientCodeChipText}>{clientCode}</Text>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F15A24" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 2. Primary Action: Shipment Tracking Section ── */}
        <View style={styles.trackingCard}>
          <View style={styles.trackingHeaderRow}>
            <View style={styles.trackingIconBadge}>
              <Search size={18} color="#F15A24" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackingCardTitle}>Shipment Tracking</Text>
              <Text style={styles.trackingCardSubtitle}>
                Enter LR / Consignment Number to Track Shipment
              </Text>
            </View>
          </View>

          {/* Tracking Input Row */}
          <View style={styles.inputContainer}>
            <View style={styles.searchIconBox}>
              <Search size={17} color="#667085" />
            </View>

            <TextInput
              style={styles.textInput}
              placeholder=""
              placeholderTextColor="#94A3B8"
              value={trackingNumber}
              onChangeText={(txt) => {
                setTrackingNumber(txt);
                if (trackingError) setTrackingError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => handleTrackShipment()}
            />

            {trackingNumber.length > 0 && (
              <TouchableOpacity
                style={styles.clearInputBtn}
                onPress={() => {
                  setTrackingNumber('');
                  setTrackingError(null);
                }}
                accessibilityLabel="Clear tracking input"
              >
                <X size={16} color="#667085" />
              </TouchableOpacity>
            )}
          </View>

          {/* Error Message with Retry */}
          {trackingError && (
            <View style={styles.errorBox}>
              <AlertTriangle size={15} color="#DC2626" style={{ marginTop: 1 }} />
              <Text style={styles.errorText}>{trackingError}</Text>
              <TouchableOpacity
                onPress={() => handleTrackShipment()}
                style={styles.retryBtn}
              >
                <RotateCcw size={13} color="#DC2626" />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Prominent Orange Track Shipment CTA */}
          <TouchableOpacity
            style={styles.primaryTrackBtn}
            onPress={() => handleTrackShipment()}
            activeOpacity={0.88}
            disabled={isSearchingTracking}
            accessibilityLabel="Track Shipment"
          >
            {isSearchingTracking ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryTrackBtnText}>Searching Database...</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryTrackBtnText}>Track Shipment</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 3. Quick Actions (Responsive 2x2 Grid) ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          {/* Tile 1: My Shipments */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => handleQuickAction('shipments')}
            activeOpacity={0.75}
            accessibilityLabel="My Shipments"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#FFF5ED' }]}>
              <Package size={22} color="#F15A24" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>My Shipments</Text>
              <Text style={styles.tileSub}>View all consignments</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 2: Book Shipment */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => handleQuickAction('book')}
            activeOpacity={0.75}
            accessibilityLabel="Book Shipment"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#F0F7FF' }]}>
              <Truck size={22} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Book Shipment</Text>
              <Text style={styles.tileSub}>New freight booking</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 3: Request Quotation */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => handleQuickAction('quote')}
            activeOpacity={0.75}
            accessibilityLabel="Request Quotation"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <FileText size={22} color="#16A34A" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Request Quotation</Text>
              <Text style={styles.tileSub}>Instant freight pricing</Text>
            </View>
          </TouchableOpacity>

          {/* Tile 4: Help & Support */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => handleQuickAction('support')}
            activeOpacity={0.75}
            accessibilityLabel="Help and Support"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#F5F3FF' }]}>
              <Headphones size={22} color="#7C3AED" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Help & Support</Text>
              <Text style={styles.tileSub}>24/7 Operations desk</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── 4. Shipment Overview (Useful Customer Summary Replacing Oversized Banner) ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Shipment Overview</Text>
          {selectedFilter !== 'ALL' && (
            <TouchableOpacity onPress={() => setSelectedFilter('ALL')} style={styles.resetFilterBtn}>
              <Text style={styles.resetFilterText}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.overviewGrid}>
          {/* Active */}
          <TouchableOpacity
            style={[styles.statCard, selectedFilter === 'ACTIVE' && styles.statCardSelected]}
            onPress={() => setSelectedFilter(selectedFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#0C1A34' }]}>{overviewStats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
            <View style={[styles.statBar, { backgroundColor: '#0C1A34' }]} />
          </TouchableOpacity>

          {/* In Transit */}
          <TouchableOpacity
            style={[styles.statCard, selectedFilter === 'TRANSIT' && styles.statCardSelected]}
            onPress={() => setSelectedFilter(selectedFilter === 'TRANSIT' ? 'ALL' : 'TRANSIT')}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#F15A24' }]}>{overviewStats.inTransit}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
            <View style={[styles.statBar, { backgroundColor: '#F15A24' }]} />
          </TouchableOpacity>

          {/* Delivered */}
          <TouchableOpacity
            style={[styles.statCard, selectedFilter === 'DELIVERED' && styles.statCardSelected]}
            onPress={() => setSelectedFilter(selectedFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{overviewStats.delivered}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
            <View style={[styles.statBar, { backgroundColor: '#16A34A' }]} />
          </TouchableOpacity>

          {/* Attention */}
          <TouchableOpacity
            style={[styles.statCard, selectedFilter === 'ATTENTION' && styles.statCardSelected]}
            onPress={() => setSelectedFilter(selectedFilter === 'ATTENTION' ? 'ALL' : 'ATTENTION')}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#D97706' }]}>{overviewStats.attention}</Text>
            <Text style={styles.statLabel}>Attention</Text>
            <View style={[styles.statBar, { backgroundColor: '#D97706' }]} />
          </TouchableOpacity>
        </View>

        {/* ── 5. Recent Shipments Section ── */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Recent Shipments</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredShipments.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (onNavigateToShipments) onNavigateToShipments();
              else if (onNavigateToBookings) onNavigateToBookings();
            }}
            accessibilityLabel="View all shipments"
          >
            <Text style={styles.viewAllBtnText}>View All &gt;</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#F15A24" />
            <Text style={styles.loadingText}>Syncing shipment database...</Text>
          </View>
        ) : recentShipmentsToDisplay.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyShipmentsCard}>
            <View style={styles.emptyIconCircle}>
              <Package size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitleText}>No active shipments found</Text>
            <Text style={styles.emptySubText}>
              Book a new transport requirement or enter an LR number to track consignment milestones.
            </Text>
            <View style={styles.emptyActionsRow}>
              <TouchableOpacity
                style={styles.emptyActionPrimaryBtn}
                onPress={() => handleQuickAction('book')}
              >
                <Text style={styles.emptyActionPrimaryBtnText}>Book Consignment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyActionSecondaryBtn}
                onPress={() => {
                  setTrackingNumber('');
                }}
              >
                <Text style={styles.emptyActionSecondaryBtnText}>Track by LR</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          recentShipmentsToDisplay.map((item) => {
            let pillBg = '#FFF5ED';
            let pillColor = '#F15A24';

            if (item.statusType === 'delivered') {
              pillBg = '#ECFDF5';
              pillColor = '#16A779';
            } else if (item.statusType === 'booked') {
              pillBg = '#EFF6FF';
              pillColor = '#2563EB';
            } else if (item.statusType === 'delayed') {
              pillBg = '#FFFBEB';
              pillColor = '#D97706';
            }

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.shipmentCard}
                onPress={() => {
                  if (onNavigateToTracking) {
                    onNavigateToTracking(item.id);
                  } else {
                    setTrackingResult(item);
                    setShowTrackingModal(true);
                  }
                }}
                activeOpacity={0.72}
              >
                {/* Header row: Tracking Number & Status Badge */}
                <View style={styles.shipmentTopRow}>
                  <View style={styles.shipmentIdWrap}>
                    <Text style={styles.shipmentNumberText}>{item.trackingNumber}</Text>
                    <Text style={styles.shipmentDateText}>{item.date}</Text>
                  </View>
                  <View style={[styles.shipmentStatusPill, { backgroundColor: pillBg }]}>
                    <Text style={[styles.shipmentStatusText, { color: pillColor }]}>
                      {item.statusText}
                    </Text>
                  </View>
                </View>

                {/* Route: Origin -> Destination */}
                <View style={styles.routeRow}>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.originDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>
                      {item.origin}
                    </Text>
                  </View>
                  <View style={styles.routeArrowBox}>
                    <Text style={styles.routeArrowText}>➔</Text>
                  </View>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.destDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>
                      {item.destination}
                    </Text>
                  </View>
                </View>

                {/* Bottom Row: Vehicle & Track Details */}
                <View style={styles.shipmentFooterRow}>
                  <View style={styles.vehicleInfoBox}>
                    <Truck size={14} color="#667085" />
                    <Text style={styles.vehicleNumberText} numberOfLines={1}>
                      {item.vehicle}
                    </Text>
                  </View>
                  <View style={styles.trackDetailsAction}>
                    <Text style={styles.trackDetailsText}>Track Details</Text>
                    <ChevronRight size={15} color="#F15A24" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Modal: Tracking Details Fallback ── */}
      <Modal
        visible={showTrackingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTrackingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.trackingModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTrackNum}>{trackingResult?.trackingNumber}</Text>
                <Text style={styles.modalCarrier}>TRUCKS</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrackingModal(false)}>
                <X size={20} color="#667085" />
              </TouchableOpacity>
            </View>

            <View style={styles.routeBox}>
              <View style={styles.routeItem}>
                <MapPin size={16} color="#F15A24" />
                <Text style={styles.routeText}>Origin: {trackingResult?.origin}</Text>
              </View>
              <View style={styles.routeItem}>
                <MapPin size={16} color="#16A34A" />
                <Text style={styles.routeText}>Destination: {trackingResult?.destination}</Text>
              </View>
            </View>

            <View style={styles.trackingMetaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaCellLabel}>Status</Text>
                <Text style={styles.metaCellVal}>{trackingResult?.statusText}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaCellLabel}>Vehicle</Text>
                <Text style={styles.metaCellVal}>{trackingResult?.vehicle || 'Assigned'}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaCellLabel}>Date</Text>
                <Text style={styles.metaCellVal}>{trackingResult?.date}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaCellLabel}>GPS</Text>
                <Text style={styles.metaCellVal}>Live Tracking Active</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowTrackingModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: 24x7 Customer Support ── */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.supportModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>24x7 Operations Support</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <X size={20} color="#667085" />
              </TouchableOpacity>
            </View>
            <Text style={styles.supportDescText}>
              TRUCKS control tower is available round-the-clock for consignment tracking, freight bookings, and driver coordination.
            </Text>

            <TouchableOpacity
              style={styles.supportContactRow}
              onPress={() => Linking.openURL('tel:18002584567')}
            >
              <Phone size={18} color="#F15A24" />
              <Text style={styles.supportContactText}>Toll Free Helpline: 1800 258 4567</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportContactRow}
              onPress={() => Linking.openURL('tel:+913612345678')}
            >
              <Phone size={18} color="#F15A24" />
              <Text style={styles.supportContactText}>Guwahati Operations Desk: +91 361 2345678</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Profile Shortcut ── */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <View style={styles.profileModalCard}>
            <View style={styles.profileUserHeader}>
              <View style={styles.profileBigAvatar}>
                <User size={28} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileBigName}>{session?.fullName || 'Client User'}</Text>
                <Text style={styles.profileBigRole}>{session?.companyName || 'Verified Enterprise'}</Text>
                <Text style={styles.profileClientCodeText}>{clientCode}</Text>
              </View>
            </View>

            <View style={styles.profileDivider} />

            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setShowProfileModal(false);
                if (onOpenProfile) onOpenProfile();
              }}
            >
              <User size={18} color="#0C1A34" />
              <Text style={styles.profileMenuOptionText}>View Complete Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setShowProfileModal(false);
                if (onNavigateToSavedAddresses) onNavigateToSavedAddresses();
              }}
            >
              <MapPin size={18} color="#0C1A34" />
              <Text style={styles.profileMenuOptionText}>Saved Addresses & Warehouses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileMenuOption, { borderBottomWidth: 0 }]}
              onPress={() => {
                setShowProfileModal(false);
                onLogout();
              }}
            >
              <LogOut size={18} color="#DC2626" />
              <Text style={[styles.profileMenuOptionText, { color: '#DC2626' }]}>Sign Out</Text>
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
    backgroundColor: '#F6F8FB',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  /* 1. Header */
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F6F8FB',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#F15A24',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileAvatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0C1A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Greeting Strip */
  greetingStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  greetingPrefixText: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '500',
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D2D46',
    maxWidth: 220,
  },
  clientCodeChip: {
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clientCodeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
    letterSpacing: 0.4,
  },

  /* 2. Primary Action: Tracking Card */
  trackingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trackingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  trackingIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D2D46',
  },
  trackingCardSubtitle: {
    fontSize: 12,
    color: '#667085',
    marginTop: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    height: 48,
    marginBottom: 10,
  },
  searchIconBox: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    color: '#1D2D46',
    fontWeight: '600',
  },
  clearInputBtn: {
    padding: 6,
  },
  scanBtn: {
    padding: 6,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    paddingLeft: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    lineHeight: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  primaryTrackBtn: {
    backgroundColor: '#F15A24',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryTrackBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* 3. Quick Actions */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D2D46',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  quickActionTile: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileTextWrap: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D2D46',
    lineHeight: 16,
  },
  tileSub: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },

  /* 4. Shipment Overview */
  resetFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F15A24',
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statCardSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFFBF8',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667085',
    marginTop: 2,
    textAlign: 'center',
  },
  statBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  /* 5. Recent Shipments */
  countBadge: {
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
  },
  viewAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F15A24',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAECF0',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#667085',
  },
  emptyShipmentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D2D46',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12.5,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyActionPrimaryBtn: {
    backgroundColor: '#F15A24',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptyActionPrimaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyActionSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0C1A34',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptyActionSecondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },

  /* Shipment Cards */
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  shipmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  shipmentIdWrap: {
    flex: 1,
  },
  shipmentNumberText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1D2D46',
    letterSpacing: 0.3,
  },
  shipmentDateText: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 2,
  },
  shipmentStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shipmentStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  routeLocationWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  originDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F15A24',
  },
  destDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  routeCityText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D2D46',
  },
  routeArrowBox: {
    paddingHorizontal: 6,
  },
  routeArrowText: {
    fontSize: 13,
    color: '#667085',
  },
  shipmentFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  vehicleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '65%',
  },
  vehicleNumberText: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '500',
  },
  trackDetailsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 52, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D2D46',
  },
  scanReticleBox: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 16,
  },
  scanInstructionText: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 17,
  },
  quickPickBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  quickPickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
    marginBottom: 8,
  },
  quickPickItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  quickPickItemNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F15A24',
  },
  quickPickItemRoute: {
    fontSize: 11.5,
    color: '#667085',
  },
  modalCloseBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#F6F8FB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D2D46',
  },

  /* Tracking Details Modal */
  trackingModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTrackNum: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1D2D46',
  },
  modalCarrier: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 14,
    gap: 8,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
  },
  trackingMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaCell: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  metaCellLabel: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '600',
  },
  metaCellVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D2D46',
    marginTop: 2,
  },

  /* Support Modal */
  supportModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  supportDescText: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
    marginBottom: 16,
  },
  supportContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  supportContactText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
  },

  /* Profile Modal */
  profileModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  profileUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBigAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0C1A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBigName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D2D46',
  },
  profileBigRole: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    marginTop: 1,
  },
  profileClientCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
    marginTop: 3,
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#EAECF0',
    marginVertical: 14,
  },
  profileMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  profileMenuOptionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1D2D46',
  },
});
