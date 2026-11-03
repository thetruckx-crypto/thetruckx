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
  AccessibilityInfo,
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
  IndianRupee,
  FileCheck,
  Compass,
  Filter,
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
  onNavigateToRequirementDetails?: (requirementId: string) => void;
  onNavigateToBookingDetails?: (bookingId: string) => void;
  onNavigateToQuotations?: (requirementId?: string) => void;
  onNavigateToPayments?: () => void;
  onNavigateToDocuments?: () => void;
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

export type SearchCategoryFilter = 'ALL' | 'REQUIREMENTS' | 'BOOKINGS' | 'SHIPMENTS';

export interface GlobalSearchResultItem {
  id: string;
  type: 'REQUIREMENT' | 'BOOKING' | 'SHIPMENT';
  displayId: string;
  statusText: string;
  origin: string;
  destination: string;
  extraInfo?: string;
  dateText?: string;
  originalRecord: any;
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
  onNavigateToRequirementDetails,
  onNavigateToBookingDetails,
  onNavigateToQuotations,
  onNavigateToPayments,
  onNavigateToDocuments,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [recentRequirements, setRecentRequirements] = useState<any[]>([]);
  const [recentQuotations, setRecentQuotations] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [bellBlinkColor, setBellBlinkColor] = useState('#F15A24');

  // Smart Global Search Modal State
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategoryFilter>('ALL');
  const [searchResults, setSearchResults] = useState<GlobalSearchResultItem[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter for Shipment Overview
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ACTIVE' | 'TRANSIT' | 'DELIVERED' | 'ATTENTION'>('ALL');

  // Modals
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

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
        .select('*')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
        .order('created_at', { ascending: false });

      setRecentRequirements(myReqs || []);
      const reqIds = (myReqs || []).map((r) => r.id);

      // 3. Fetch real bookings
      let myBookings: any[] = [];
      const { data: bData } = await supabase
        .from('bookings')
        .select('*, requirements(*)')
        .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
        .order('confirmed_at', { ascending: false })
        .limit(20);

      if (bData && bData.length > 0) {
        myBookings = bData;
      } else if (reqIds.length > 0) {
        const { data: bByReq } = await supabase
          .from('bookings')
          .select('*, requirements(*)')
          .in('requirement_id', reqIds)
          .order('confirmed_at', { ascending: false })
          .limit(20);
        myBookings = bByReq || [];
      }

      // 4. Fetch associated trips
      const bookingIds = myBookings.map((b) => b.id);
      let myTrips: any[] = [];
      if (bookingIds.length > 0) {
        const { data: tData } = await supabase
          .from('trips')
          .select('*, vehicles(registration_number, vehicle_type, model), drivers(full_name, mobile), vendors:vendor_id(id, name, company_name)')
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false })
          .limit(20);
        myTrips = tData || [];
      }

      // 5. Fetch real quotations
      if (reqIds.length > 0) {
        try {
          const { data: quotes } = await supabase
            .from('client_quotes')
            .select('*, requirements(pickup_city, destination_city, vehicle_type)')
            .in('requirement_id', reqIds)
            .order('created_at', { ascending: false })
            .limit(6);
          setRecentQuotations(quotes || []);
        } catch {}
      }

      const realShipments: ShipmentItem[] = [];

      // Map trips first
      if (myTrips.length > 0) {
        myTrips.forEach((t) => {
          let statusText = 'In Transit';
          let statusType: 'delivered' | 'transit' | 'booked' | 'delayed' = 'transit';
          let isDelayed = false;

          const rawStatus = (t.trip_status || '').toUpperCase();
          if (rawStatus === 'DELIVERED' || rawStatus === 'COMPLETED') {
            statusText = 'Delivered';
            statusType = 'delivered';
          } else if (rawStatus === 'DELAYED' || rawStatus === 'EXCEPTION') {
            statusText = 'Delayed';
            statusType = 'delayed';
            isDelayed = true;
          } else if (rawStatus === 'BOOKED' || rawStatus === 'LORRY_ASSIGNED') {
            statusText = 'Lorry Assigned';
            statusType = 'booked';
          } else if (rawStatus === 'AT_LOADING') {
            statusText = 'At Loading Gate';
            statusType = 'booked';
          } else if (rawStatus === 'AT_DESTINATION' || rawStatus === 'UNLOADING') {
            statusText = 'At Unloading Yard';
            statusType = 'transit';
          }

          const dateObj = new Date(t.created_at || Date.now());
          const dateFormatted = dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          realShipments.push({
            id: t.id,
            trackingNumber: t.lr_number || t.trip_code || formatDisplayId('TRP', t.id, t.created_at),
            origin: t.pickup_city || 'Origin Depot',
            destination: t.destination_city || 'Destination Yard',
            statusText,
            statusType,
            date: dateFormatted,
            vehicle: t.vehicles?.registration_number || 'Transport Unit Assigned',
            carrier: t.vendors?.company_name || 'TRUCKS Certified Fleet',
            expectedDelivery: t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-GB') : undefined,
            isDelayed,
          });
        });
      } else if (myBookings.length > 0) {
        myBookings.forEach((b) => {
          const dateObj = new Date(b.confirmed_at || Date.now());
          realShipments.push({
            id: b.id,
            trackingNumber: b.booking_code || formatDisplayId('BK', b.id, b.confirmed_at),
            origin: b.requirements?.pickup_address?.split(',')[0] || b.requirements?.pickup_city || 'Origin Depot',
            destination: b.requirements?.destination_address?.split(',')[0] || b.requirements?.destination_city || 'Destination Yard',
            statusText: b.booking_status === 'CONFIRMED' ? 'Booking Confirmed' : 'Allocation Pending',
            statusType: 'booked',
            date: dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            vehicle: 'Vehicle Allocation Pending',
            carrier: 'TRUCKS Network',
          });
        });
      }

      setShipments(realShipments);

      // 6. Fetch notification count
      try {
        const notifs = await authService.fetchRealNotifications();
        const unread = notifs.filter((n: any) => {
          if (n.isRead !== undefined) return !n.isRead;
          if (n.read !== undefined) return !n.read;
          return false;
        }).length;
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

  // Reduced motion detection
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotionEnabled(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (isMounted) setReduceMotionEnabled(enabled);
      }
    );

    return () => {
      isMounted = false;
      if (subscription && typeof (subscription as any).remove === 'function') {
        (subscription as any).remove();
      }
    };
  }, []);

  // Alternating orange and navy blinking animation for unread notifications
  useEffect(() => {
    if (unreadNotificationsCount <= 0 || reduceMotionEnabled) {
      setBellBlinkColor('#F15A24');
      return;
    }

    const interval = setInterval(() => {
      setBellBlinkColor((prev) => (prev === '#F15A24' ? '#0C1A34' : '#F15A24'));
    }, 650);

    return () => clearInterval(interval);
  }, [unreadNotificationsCount, reduceMotionEnabled]);

  useEffect(() => {
    loadData();

    // Supabase Realtime sync for live update
    const channel = supabase
      .channel('client_dashboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_quotes' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── Debounce Search Query ───
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(globalSearchQuery.trim());
    }, 280);
    return () => clearTimeout(handler);
  }, [globalSearchQuery]);

  // ─── Smart Global Search Query (Real DB Scoped to Authenticated Client) ───
  const executeGlobalSearch = useCallback(async () => {
    if (!debouncedSearchQuery) {
      setSearchResults([]);
      setIsSearchingGlobal(false);
      setSearchError(null);
      return;
    }

    setIsSearchingGlobal(true);
    setSearchError(null);

    try {
      const clientId = session?.userId;
      if (!clientId) {
        setSearchResults([]);
        setIsSearchingGlobal(false);
        return;
      }

      // Resolve company ID
      let targetCompanyId = clientId;
      const { data: userRec } = await supabase
        .from('client_users')
        .select('client_id, client_company_id')
        .eq('id', clientId)
        .maybeSingle();

      if (userRec?.client_id || userRec?.client_company_id) {
        targetCompanyId = userRec.client_id || userRec.client_company_id;
      }

      const cleanQ = debouncedSearchQuery.replace(/[^a-zA-Z0-9- ]/g, '');
      const results: GlobalSearchResultItem[] = [];

      // 1. Search Requirements if category is ALL or REQUIREMENTS
      if (searchCategory === 'ALL' || searchCategory === 'REQUIREMENTS') {
        const { data: matchedReqs } = await supabase
          .from('requirements')
          .select('*')
          .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
          .or(
            `id.ilike.%${cleanQ}%,pickup_city.ilike.%${cleanQ}%,destination_city.ilike.%${cleanQ}%,pickup_address.ilike.%${cleanQ}%,destination_address.ilike.%${cleanQ}%,vehicle_type.ilike.%${cleanQ}%,material_type.ilike.%${cleanQ}%,status.ilike.%${cleanQ}%`
          )
          .limit(10);

        if (matchedReqs && matchedReqs.length > 0) {
          matchedReqs.forEach((r) => {
            results.push({
              id: r.id,
              type: 'REQUIREMENT',
              displayId: formatDisplayId('REQ', r.id, r.created_at),
              statusText: (r.status || 'SUBMITTED').replace(/_/g, ' '),
              origin: r.pickup_city || (r.pickup_address ? r.pickup_address.split(',')[0].trim() : 'Origin'),
              destination: r.destination_city || (r.destination_address ? r.destination_address.split(',')[0].trim() : 'Destination'),
              extraInfo: `${r.vehicle_type || 'Vehicle'} • ${r.material_type || 'Cargo'}`,
              dateText: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
              originalRecord: r,
            });
          });
        }
      }

      // 2. Search Bookings if category is ALL or BOOKINGS
      if (searchCategory === 'ALL' || searchCategory === 'BOOKINGS') {
        const { data: matchedBookings } = await supabase
          .from('bookings')
          .select('*, requirements(*)')
          .or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)
          .or(`id.ilike.%${cleanQ}%,booking_code.ilike.%${cleanQ}%,booking_status.ilike.%${cleanQ}%`)
          .limit(10);

        if (matchedBookings && matchedBookings.length > 0) {
          matchedBookings.forEach((b) => {
            const req = b.requirements || {};
            results.push({
              id: b.id,
              type: 'BOOKING',
              displayId: b.booking_code || formatDisplayId('BK', b.id, b.confirmed_at),
              statusText: (b.booking_status || 'CONFIRMED').replace(/_/g, ' '),
              origin: req.pickup_city || (req.pickup_address ? req.pickup_address.split(',')[0].trim() : 'Origin Depot'),
              destination: req.destination_city || (req.destination_address ? req.destination_address.split(',')[0].trim() : 'Destination Depot'),
              extraInfo: b.grand_total ? `₹ ${Number(b.grand_total).toLocaleString('en-IN')}` : undefined,
              dateText: b.confirmed_at ? new Date(b.confirmed_at).toLocaleDateString('en-GB') : '',
              originalRecord: b,
            });
          });
        }
      }

      // 3. Search Trips / Shipments if category is ALL or SHIPMENTS
      if (searchCategory === 'ALL' || searchCategory === 'SHIPMENTS') {
        const { data: matchedTrips } = await supabase
          .from('trips')
          .select(
            '*, vehicles(registration_number, vehicle_type), drivers(full_name, mobile), vendors:vendor_id(company_name, name), bookings(client_id, requirements(*))'
          )
          .or(
            `id.ilike.%${cleanQ}%,trip_code.ilike.%${cleanQ}%,lr_number.ilike.%${cleanQ}%,trip_status.ilike.%${cleanQ}%,pickup_city.ilike.%${cleanQ}%,destination_city.ilike.%${cleanQ}%`
          )
          .limit(12);

        if (matchedTrips && matchedTrips.length > 0) {
          matchedTrips.forEach((t) => {
            // Check client ownership
            const b = t.bookings;
            if (b && b.client_id && b.client_id !== clientId && b.client_id !== targetCompanyId) {
              return; // Exclude cross-client records
            }

            results.push({
              id: t.id,
              type: 'SHIPMENT',
              displayId: t.lr_number || t.trip_code || formatDisplayId('TRP', t.id, t.created_at),
              statusText: (t.trip_status || 'IN TRANSIT').replace(/_/g, ' '),
              origin: t.pickup_city || 'Origin Depot',
              destination: t.destination_city || 'Destination Terminal',
              extraInfo: t.vehicles?.registration_number
                ? `${t.vehicles.registration_number}${t.drivers?.full_name ? ` • Driver: ${t.drivers.full_name}` : ''}`
                : t.vendors?.company_name || 'Carrier Assigned',
              dateText: t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '',
              originalRecord: t,
            });
          });
        }
      }

      setSearchResults(results);
    } catch (err: any) {
      console.warn('Global search query notice:', err);
      setSearchError('Search failed. Please check network connection and retry.');
      setSearchResults([]);
    } finally {
      setIsSearchingGlobal(false);
    }
  }, [debouncedSearchQuery, searchCategory, session?.userId]);

  useEffect(() => {
    if (showGlobalSearch) {
      executeGlobalSearch();
    }
  }, [showGlobalSearch, executeGlobalSearch]);

  const handleSelectSearchResult = (item: GlobalSearchResultItem) => {
    setShowGlobalSearch(false);
    setGlobalSearchQuery('');

    if (item.type === 'REQUIREMENT') {
      if (onNavigateToRequirementDetails) {
        onNavigateToRequirementDetails(item.id);
      } else if (onNavigateToRequirements) {
        onNavigateToRequirements();
      }
    } else if (item.type === 'BOOKING') {
      if (onNavigateToBookingDetails) {
        onNavigateToBookingDetails(item.id);
      } else if (onNavigateToBookings) {
        onNavigateToBookings();
      }
    } else if (item.type === 'SHIPMENT') {
      if (onNavigateToTracking) {
        onNavigateToTracking(item.id);
      }
    }
  };

  // ─── Quick Overview Stats ───
  const overviewStats = useMemo(() => {
    const totalRequirements = recentRequirements.length;
    const activeShipments = shipments.filter((s) => s.statusType === 'transit').length;
    const deliveredShipments = shipments.filter((s) => s.statusType === 'delivered').length;
    const quotesReceived = recentQuotations.length;
    return {
      totalRequirements,
      activeShipments,
      deliveredShipments,
      quotesReceived,
    };
  }, [recentRequirements, shipments, recentQuotations]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Top Header with Compact Search Bar Beside Notification Bell ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <BrandLogoHeader size="sm" theme="light" />
        </View>

        <View style={styles.headerRightActions}>
          {/* Compact Search Bar placed beside notification icon */}
          <TouchableOpacity
            style={styles.headerCompactSearch}
            onPress={() => setShowGlobalSearch(true)}
            activeOpacity={0.8}
            accessibilityRole="search"
            accessibilityLabel="Search transport information"
          >
            <Search size={15} color="#64748B" />
            <Text style={styles.headerCompactSearchText} numberOfLines={1}>
              Search ID, route...
            </Text>
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.headerBellOnlyBtn}
            onPress={() => (onNavigateToNotifications ? onNavigateToNotifications() : null)}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <Bell
              size={22}
              color={unreadNotificationsCount > 0 ? (reduceMotionEnabled ? '#F15A24' : bellBlinkColor) : '#1D2D46'}
              strokeWidth={2.2}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F15A24" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 2. Welcome Banner with Enterprise Code ── */}
        <View style={styles.welcomeBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeGreeting}>{greeting}, {customerName} 👋</Text>
            <Text style={styles.welcomeSub}>
              {session?.companyName || 'TRUCKS Commercial Enterprise'} • {clientCode}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileBadgeBtn}
            onPress={() => (onOpenProfile ? onOpenProfile() : setShowProfileModal(true))}
            accessibilityLabel="Open Profile"
          >
            <User size={16} color="#0C1A34" />
          </TouchableOpacity>
        </View>

        {/* ── 3. Transport Requirement Summary Cards ── */}
        <View style={styles.overviewGrid}>
          {/* Total Requirements */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#0C1A34' }]}>{overviewStats.totalRequirements}</Text>
            <Text style={styles.statLabel}>Total RFQs</Text>
            <View style={[styles.statBar, { backgroundColor: '#0C1A34' }]} />
          </TouchableOpacity>

          {/* Quotations Received */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => (onNavigateToQuotations ? onNavigateToQuotations() : onNavigateToRequirements?.())}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{overviewStats.quotesReceived}</Text>
            <Text style={styles.statLabel}>Quotes Recv</Text>
            <View style={[styles.statBar, { backgroundColor: '#16A34A' }]} />
          </TouchableOpacity>

          {/* Active / In Transit Shipments */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#F15A24' }]}>{overviewStats.activeShipments}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
            <View style={[styles.statBar, { backgroundColor: '#F15A24' }]} />
          </TouchableOpacity>

          {/* Delivered Shipments */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{overviewStats.deliveredShipments}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
            <View style={[styles.statBar, { backgroundColor: '#2563EB' }]} />
          </TouchableOpacity>
        </View>

        {/* ── 4. Quick Actions (Responsive Grid for Essential Client Tasks) ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          {/* 1. Create Requirement */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToCreateRequirement ? onNavigateToCreateRequirement() : null)}
            activeOpacity={0.75}
            accessibilityLabel="Create Transport Requirement"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#FFF5ED' }]}>
              <Truck size={20} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Post New RFQ</Text>
              <Text style={styles.tileSub}>Create requirement</Text>
            </View>
          </TouchableOpacity>

          {/* 2. My Requirements (Unified Lifecycle) */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
            activeOpacity={0.75}
            accessibilityLabel="My Requirements"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Layers size={20} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>My Requirements</Text>
              <Text style={styles.tileSub}>Manage RFQ lifecycle</Text>
            </View>
          </TouchableOpacity>

          {/* 3. Received Quotations */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToQuotations ? onNavigateToQuotations() : onNavigateToRequirements?.())}
            activeOpacity={0.75}
            accessibilityLabel="Received Quotations"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <ClipboardList size={20} color="#16A34A" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Quotations</Text>
              <Text style={styles.tileSub}>Review carrier bids</Text>
            </View>
          </TouchableOpacity>

          {/* 4. Bookings & Shipments */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToBookings ? onNavigateToBookings() : onNavigateToRequirements?.())}
            activeOpacity={0.75}
            accessibilityLabel="My Bookings"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#F5F3FF' }]}>
              <Package size={20} color="#7C3AED" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>My Bookings</Text>
              <Text style={styles.tileSub}>Confirmed orders</Text>
            </View>
          </TouchableOpacity>

          {/* 5. Invoices & Payments */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToPayments ? onNavigateToPayments() : onNavigateToBookings?.())}
            activeOpacity={0.75}
            accessibilityLabel="Invoices and Payments"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <IndianRupee size={20} color="#059669" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Invoices & Pay</Text>
              <Text style={styles.tileSub}>Billing status</Text>
            </View>
          </TouchableOpacity>

          {/* 6. Documents & POD */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToDocuments ? onNavigateToDocuments() : onNavigateToBookings?.())}
            activeOpacity={0.75}
            accessibilityLabel="Documents and POD"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#FFFBEB' }]}>
              <FileCheck size={20} color="#D97706" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>POD & LR Docs</Text>
              <Text style={styles.tileSub}>Download papers</Text>
            </View>
          </TouchableOpacity>

          {/* 7. Help & Support */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => (onNavigateToSupport ? onNavigateToSupport() : setShowSupportModal(true))}
            activeOpacity={0.75}
            accessibilityLabel="24/7 Operations Desk"
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#FEF2F2' }]}>
              <Headphones size={20} color="#DC2626" strokeWidth={2.2} />
            </View>
            <View style={styles.tileTextWrap}>
              <Text style={styles.tileTitle}>Control Tower</Text>
              <Text style={styles.tileSub}>24/7 Dispatch help</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── 5. Active Shipments Section ── */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Active Consignments</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{shipments.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
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
        ) : shipments.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Compass size={28} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitleText}>No active shipments</Text>
            <Text style={styles.emptySubText}>
              Confirmed bookings and in-transit consignments will appear here with live tracking.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => (onNavigateToCreateRequirement ? onNavigateToCreateRequirement() : null)}
            >
              <Text style={styles.emptyActionBtnText}>Post Transport RFQ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          shipments.slice(0, 3).map((item) => {
            let pillBg = '#FFF5ED';
            let pillColor = '#F15A24';
            if (item.statusType === 'delivered') {
              pillBg = '#ECFDF5';
              pillColor = '#059669';
            } else if (item.statusType === 'booked') {
              pillBg = '#EFF6FF';
              pillColor = '#2563EB';
            }

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.shipmentCard}
                onPress={() => {
                  if (onNavigateToTracking) onNavigateToTracking(item.id);
                }}
                activeOpacity={0.75}
              >
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

                {/* Route */}
                <View style={styles.routeRow}>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.originDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>{item.origin}</Text>
                  </View>
                  <View style={styles.routeArrowBox}>
                    <Text style={styles.routeArrowText}>➔</Text>
                  </View>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.destDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>{item.destination}</Text>
                  </View>
                </View>

                <View style={styles.shipmentFooterRow}>
                  <View style={styles.vehicleInfoBox}>
                    <Truck size={14} color="#64748B" />
                    <Text style={styles.vehicleNumberText} numberOfLines={1}>{item.vehicle}</Text>
                  </View>
                  <View style={styles.trackDetailsAction}>
                    <Text style={styles.trackDetailsText}>Live Tracking</Text>
                    <ChevronRight size={15} color="#F15A24" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── 6. Recent Requirements Section ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Recent Transport Requirements</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{recentRequirements.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => (onNavigateToRequirements ? onNavigateToRequirements() : null)}
            accessibilityLabel="View all requirements"
          >
            <Text style={styles.viewAllBtnText}>View All &gt;</Text>
          </TouchableOpacity>
        </View>

        {recentRequirements.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <FileText size={28} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitleText}>No requirements posted</Text>
            <Text style={styles.emptySubText}>
              Post a freight requirement to receive verified bids from fleet carriers across North Eastern corridors.
            </Text>
          </View>
        ) : (
          recentRequirements.slice(0, 3).map((req) => {
            const reqDisplayId = formatDisplayId('REQ', req.id, req.created_at);
            const originCity = req.pickup_city || (req.pickup_address ? req.pickup_address.split(',')[0].trim() : 'Origin');
            const destCity = req.destination_city || (req.destination_address ? req.destination_address.split(',')[0].trim() : 'Destination');
            const reqStatus = (req.status || 'SUBMITTED').toUpperCase();

            let statusLabel = 'Submitted';
            let statusPillBg = '#EFF6FF';
            let statusPillColor = '#2563EB';

            if (reqStatus === 'UNDER_REVIEW') {
              statusLabel = 'Under Review';
              statusPillBg = '#FFFBEB';
              statusPillColor = '#D97706';
            } else if (reqStatus === 'QUOTATIONS_RECEIVED') {
              statusLabel = 'Quotes Received';
              statusPillBg = '#F0FDF4';
              statusPillColor = '#16A34A';
            } else if (reqStatus === 'BOOKED') {
              statusLabel = 'Booked';
              statusPillBg = '#FFF5ED';
              statusPillColor = '#F15A24';
            }

            return (
              <TouchableOpacity
                key={req.id}
                style={styles.shipmentCard}
                onPress={() => {
                  if (onNavigateToRequirementDetails) onNavigateToRequirementDetails(req.id);
                  else if (onNavigateToRequirements) onNavigateToRequirements();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.shipmentTopRow}>
                  <View style={styles.shipmentIdWrap}>
                    <Text style={styles.shipmentNumberText}>{reqDisplayId}</Text>
                    <Text style={styles.shipmentDateText}>
                      {req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB') : 'Recent'}
                    </Text>
                  </View>
                  <View style={[styles.shipmentStatusPill, { backgroundColor: statusPillBg }]}>
                    <Text style={[styles.shipmentStatusText, { color: statusPillColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeRow}>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.originDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>{originCity}</Text>
                  </View>
                  <View style={styles.routeArrowBox}>
                    <Text style={styles.routeArrowText}>➔</Text>
                  </View>
                  <View style={styles.routeLocationWrap}>
                    <View style={styles.destDot} />
                    <Text style={styles.routeCityText} numberOfLines={1}>{destCity}</Text>
                  </View>
                </View>

                <View style={styles.shipmentFooterRow}>
                  <View style={styles.vehicleInfoBox}>
                    <Truck size={14} color="#64748B" />
                    <Text style={styles.vehicleNumberText} numberOfLines={1}>
                      {req.vehicle_type || 'Vehicle Allocation'} • {req.material_type || 'General Cargo'}
                    </Text>
                  </View>
                  <View style={styles.trackDetailsAction}>
                    <Text style={styles.trackDetailsText}>View RFQ</Text>
                    <ChevronRight size={15} color="#F15A24" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── 7. Recent Quotations Section (If Available) ── */}
        {recentQuotations.length > 0 && (
          <>
            <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Recent Quotations</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{recentQuotations.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => (onNavigateToQuotations ? onNavigateToQuotations() : onNavigateToRequirements?.())}
              >
                <Text style={styles.viewAllBtnText}>Compare Bids &gt;</Text>
              </TouchableOpacity>
            </View>

            {recentQuotations.slice(0, 2).map((q) => {
              const req = q.requirements || {};
              return (
                <TouchableOpacity
                  key={q.id}
                  style={styles.quoteCard}
                  onPress={() => {
                    if (onNavigateToQuotations) onNavigateToQuotations(q.requirement_id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.quoteHeaderRow}>
                    <View>
                      <Text style={styles.quoteRateText}>
                        ₹ {Number(q.total_client_amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.quoteSubText}>
                        {req.pickup_city || 'Origin'} ➔ {req.destination_city || 'Destination'}
                      </Text>
                    </View>
                    <View style={styles.quoteBadge}>
                      <Text style={styles.quoteBadgeText}>Active Quote</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── SMART GLOBAL SEARCH MODAL (Full functional search across DB) ── */}
      <Modal
        visible={showGlobalSearch}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGlobalSearch(false)}
      >
        <SafeAreaView style={styles.searchModalSafeArea}>
          {/* Search Header Bar */}
          <View style={styles.searchModalTopBar}>
            <View style={styles.searchModalInputWrap}>
              <Search size={18} color="#F15A24" />
              <TextInput
                style={styles.searchModalInput}
                placeholder="Search by ID, booking, trip, route, vehicle, driver..."
                placeholderTextColor="#94A3B8"
                value={globalSearchQuery}
                onChangeText={setGlobalSearchQuery}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {globalSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setGlobalSearchQuery('')} style={{ padding: 4 }}>
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.searchCancelBtn}
              onPress={() => {
                setShowGlobalSearch(false);
                setGlobalSearchQuery('');
              }}
            >
              <Text style={styles.searchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Category Filter Tabs */}
          <View style={styles.searchCategoryRow}>
            {(['ALL', 'REQUIREMENTS', 'BOOKINGS', 'SHIPMENTS'] as SearchCategoryFilter[]).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catTab, searchCategory === cat && styles.catTabActive]}
                onPress={() => setSearchCategory(cat)}
              >
                <Text style={[styles.catTabText, searchCategory === cat && styles.catTabTextActive]}>
                  {cat === 'ALL' ? 'All' : cat === 'REQUIREMENTS' ? 'RFQs' : cat === 'BOOKINGS' ? 'Bookings' : 'Shipments'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Content */}
          {isSearchingGlobal ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color="#F15A24" />
              <Text style={styles.searchLoadingText}>Searching client transport records...</Text>
            </View>
          ) : searchError ? (
            <View style={styles.searchErrorContainer}>
              <AlertTriangle size={28} color="#DC2626" />
              <Text style={styles.searchErrorText}>{searchError}</Text>
            </View>
          ) : !debouncedSearchQuery ? (
            <ScrollView contentContainerStyle={styles.searchSuggestionsContent}>
              <Text style={styles.suggestionsTitle}>QUICK SEARCH SUGGESTIONS</Text>

              <View style={styles.tagWrap}>
                <TouchableOpacity
                  style={styles.suggestionTag}
                  onPress={() => setGlobalSearchQuery('In Transit')}
                >
                  <Compass size={13} color="#F15A24" />
                  <Text style={styles.suggestionTagText}>In Transit Shipments</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionTag}
                  onPress={() => setGlobalSearchQuery('Quotes Received')}
                >
                  <ClipboardList size={13} color="#16A34A" />
                  <Text style={styles.suggestionTagText}>Quotations Received</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionTag}
                  onPress={() => setGlobalSearchQuery('Guwahati')}
                >
                  <MapPin size={13} color="#2563EB" />
                  <Text style={styles.suggestionTagText}>Guwahati Corridors</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionTag}
                  onPress={() => setGlobalSearchQuery('Kolkata')}
                >
                  <MapPin size={13} color="#2563EB" />
                  <Text style={styles.suggestionTagText}>Kolkata Routes</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.suggestionsTitle, { marginTop: 24 }]}>SEARCHABLE IDENTIFIERS</Text>
              <Text style={styles.searchHintText}>
                • Requirement ID (e.g., REQ-...) & RFQ Status{'\n'}
                • Booking ID (e.g., BK-...) & Confirmation status{'\n'}
                • Trip ID & LR / Consignment Number{'\n'}
                • Pickup & Delivery cities or addresses{'\n'}
                • Assigned Vehicle registration & Driver name
              </Text>
            </ScrollView>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchEmptyContainer}>
              <Package size={36} color="#94A3B8" />
              <Text style={styles.searchEmptyTitle}>No matching transport records</Text>
              <Text style={styles.searchEmptySub}>
                No results found for "{debouncedSearchQuery}". Please check the ID or search term.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.searchResultsList}>
              <Text style={styles.searchResultsCountHeader}>
                Found {searchResults.length} matching result{searchResults.length !== 1 ? 's' : ''}
              </Text>

              {searchResults.map((res) => {
                let badgeColor = '#2563EB';
                let badgeBg = '#EFF6FF';
                let typeLabel = 'RFQ';

                if (res.type === 'BOOKING') {
                  badgeColor = '#7C3AED';
                  badgeBg = '#F5F3FF';
                  typeLabel = 'BOOKING';
                } else if (res.type === 'SHIPMENT') {
                  badgeColor = '#F15A24';
                  badgeBg = '#FFF5ED';
                  typeLabel = 'SHIPMENT';
                }

                return (
                  <TouchableOpacity
                    key={`${res.type}_${res.id}`}
                    style={styles.searchResultCard}
                    onPress={() => handleSelectSearchResult(res)}
                    activeOpacity={0.78}
                  >
                    <View style={styles.searchResultTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.typePill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.typePillText, { color: badgeColor }]}>{typeLabel}</Text>
                        </View>
                        <Text style={styles.searchResultIdText}>{res.displayId}</Text>
                      </View>
                      <Text style={styles.searchResultStatusText}>{res.statusText}</Text>
                    </View>

                    <View style={styles.searchResultRouteRow}>
                      <MapPin size={13} color="#64748B" />
                      <Text style={styles.searchResultRouteText}>
                        {res.origin} ➔ {res.destination}
                      </Text>
                    </View>

                    {res.extraInfo ? (
                      <Text style={styles.searchResultExtraText}>{res.extraInfo}</Text>
                    ) : null}

                    <View style={styles.searchResultFooterRow}>
                      <Text style={styles.searchResultDateText}>{res.dateText}</Text>
                      <View style={styles.openDetailsAction}>
                        <Text style={styles.openDetailsText}>
                          {res.type === 'SHIPMENT' ? 'Open Live Tracking' : 'View Details'}
                        </Text>
                        <ChevronRight size={14} color="#F15A24" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
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
              TRUCKS Control Tower is available round-the-clock for consignment tracking, freight bookings, and driver coordination.
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
                <User size={26} color="#FFFFFF" />
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
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  headerCompactSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    maxWidth: 200,
    flex: 1,
  },
  headerCompactSearchText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  headerBellOnlyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 30,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  welcomeGreeting: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C1A34',
    letterSpacing: -0.3,
  },
  welcomeSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  profileBadgeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  statBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0C1A34',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  viewAllBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  quickActionTile: {
    width: (SCREEN_WIDTH - 38) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileTextWrap: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  tileSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
    marginBottom: 3,
  },
  emptySubText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  emptyActionBtn: {
    backgroundColor: '#F15A24',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  shipmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shipmentIdWrap: {
    flex: 1,
  },
  shipmentNumberText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  shipmentDateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  shipmentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shipmentStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  routeLocationWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  originDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  destDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  routeCityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
  },
  routeArrowBox: {
    paddingHorizontal: 6,
  },
  routeArrowText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  shipmentFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  vehicleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '65%',
  },
  vehicleNumberText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  trackDetailsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackDetailsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteRateText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  quoteSubText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  quoteBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quoteBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },

  /* Global Search Modal Styles */
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchModalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchModalInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
  },
  searchModalInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0C1A34',
    paddingVertical: 0,
  },
  searchCancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  searchCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F15A24',
  },
  searchCategoryRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  catTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catTabActive: {
    backgroundColor: '#0C1A34',
    borderColor: '#0C1A34',
  },
  catTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  catTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  searchLoadingText: {
    fontSize: 12.5,
    color: '#64748B',
  },
  searchErrorContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  searchErrorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  searchSuggestionsContent: {
    padding: 16,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  suggestionTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  searchHintText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  searchEmptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  searchEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 10,
  },
  searchEmptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  searchResultsList: {
    padding: 14,
  },
  searchResultsCountHeader: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  searchResultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  searchResultIdText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1A34',
  },
  searchResultStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  searchResultRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  searchResultRouteText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  searchResultExtraText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
  },
  searchResultFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  searchResultDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  openDetailsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openDetailsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
  },

  /* Support & Profile Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 52, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  modalCloseBtn: {
    width: '100%',
    height: 42,
    backgroundColor: '#F15A24',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supportModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  supportDescText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  supportContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5ED',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  supportContactText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  profileModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
  },
  profileUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBigAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0C1A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBigName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  profileBigRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  profileClientCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
    marginTop: 2,
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  profileMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  profileMenuOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1A34',
  },
});
