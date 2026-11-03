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
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  Plus,
  Truck,
  MapPin,
  Calendar,
  ChevronRight,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  RotateCcw,
  Compass,
  Copy,
  Layers,
  IndianRupee,
  Phone,
  ShieldCheck,
  Eye,
  Filter,
} from 'lucide-react-native';
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { formatDisplayId } from '../../../utils/idGenerator';

export type TransportLifecycleStage =
  | 'ALL'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'QUOTATIONS_RECEIVED'
  | 'BOOKING_CONFIRMED'
  | 'VEHICLE_ASSIGNED'
  | 'LOADING'
  | 'IN_TRANSIT'
  | 'UNLOADING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface MyRequirementsScreenProps {
  clientId?: string;
  onBack: () => void;
  onSelectRequirement: (requirementId: string) => void;
  onViewQuotations?: (requirementId: string) => void;
  onTrackShipment?: (trackingId: string) => void;
  onSelectBooking?: (bookingId: string) => void;
  onCreateNew: () => void;
  onResumeDraft?: (draft: any) => void;
  onNavigateToShipments?: () => void;
}

export interface UnifiedRequirementItem {
  id: string;
  displayId: string;
  stage: TransportLifecycleStage;
  stageLabel: string;
  status: string;
  created_at: string;
  pickup_city: string;
  pickup_address: string;
  pickup_pincode?: string;
  destination_city: string;
  destination_address: string;
  destination_pincode?: string;
  vehicle_type: string;
  material_type: string;
  capacity_mt?: string | number;
  package_count?: string | number;
  pickup_date?: string;
  target_rate?: number;
  quotations_count: number;
  quotations?: any[];
  // Linked Booking Details
  booking_id?: string;
  booking_code?: string;
  booking_status?: string;
  booking_amount?: number;
  // Linked Trip / Shipment Details
  trip_id?: string;
  trip_code?: string;
  lr_number?: string;
  trip_status?: string;
  vehicle_registration?: string;
  vehicle_model?: string;
  driver_name?: string;
  driver_phone?: string;
  is_draft?: boolean;
}

export const MyRequirementsScreen: React.FC<MyRequirementsScreenProps> = ({
  clientId,
  onBack,
  onSelectRequirement,
  onViewQuotations,
  onTrackShipment,
  onSelectBooking,
  onCreateNew,
  onResumeDraft,
  onNavigateToShipments,
}) => {
  const [selectedStage, setSelectedStage] = useState<TransportLifecycleStage>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<UnifiedRequirementItem[]>([]);
  const [savedDraft, setSavedDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load requirements with associated bookings & trips from authentic DB
  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);

      // Resolve company ID if clientId is user ID
      let targetCompanyId = clientId;
      if (clientId && clientId.includes('-')) {
        const { data: userRec } = await supabase
          .from('client_users')
          .select('client_id, client_company_id')
          .eq('id', clientId)
          .maybeSingle();

        if (userRec?.client_id || userRec?.client_company_id) {
          targetCompanyId = userRec.client_id || userRec.client_company_id;
        }
      }

      // 1. Fetch requirements
      let reqQuery = supabase
        .from('requirements')
        .select('*')
        .order('created_at', { ascending: false });

      if (targetCompanyId || clientId) {
        reqQuery = reqQuery.or(
          `client_id.eq.${targetCompanyId || clientId},client_id.eq.${clientId || targetCompanyId}`
        );
      }

      const [reqRes, draftRes] = await Promise.all([
        reqQuery.limit(50),
        clientService.getTransportRequirementDraft(clientId),
      ]);

      const rawReqs = reqRes.data || [];
      if (
        draftRes &&
        (draftRes.vehicleTypeRequired ||
          draftRes.materialType ||
          draftRes.pickupAddress ||
          draftRes.destinationAddress)
      ) {
        setSavedDraft(draftRes);
      } else {
        setSavedDraft(null);
      }

      if (rawReqs.length === 0 && !draftRes) {
        setItems([]);
        return;
      }

      const reqIds = rawReqs.map((r) => r.id);

      // 2. Fetch associated bookings
      let bookingsByReqId: Record<string, any> = {};
      let bookingIds: string[] = [];
      if (reqIds.length > 0) {
        const { data: bData } = await supabase
          .from('bookings')
          .select('*')
          .in('requirement_id', reqIds);

        if (bData && bData.length > 0) {
          bData.forEach((b) => {
            bookingsByReqId[b.requirement_id] = b;
            bookingIds.push(b.id);
          });
        }
      }

      // 3. Fetch associated trips
      let tripsByBookingId: Record<string, any> = {};
      if (bookingIds.length > 0) {
        const { data: tData } = await supabase
          .from('trips')
          .select('*, vehicles(registration_number, vehicle_type, model), drivers(full_name, mobile)')
          .in('booking_id', bookingIds);

        if (tData && tData.length > 0) {
          tData.forEach((t) => {
            tripsByBookingId[t.booking_id] = t;
          });
        }
      }

      // 4. Fetch quotes count
      let quotesByReqId: Record<string, any[]> = {};
      if (reqIds.length > 0) {
        const { data: qData } = await supabase
          .from('client_quotes')
          .select('id, requirement_id, status, total_client_amount, created_at')
          .in('requirement_id', reqIds);

        if (qData && qData.length > 0) {
          qData.forEach((q) => {
            if (!quotesByReqId[q.requirement_id]) quotesByReqId[q.requirement_id] = [];
            quotesByReqId[q.requirement_id].push(q);
          });
        }
      }

      // 5. Construct Unified Lifecycle Items
      const unifiedList: UnifiedRequirementItem[] = [];

      // Add Saved Draft if available
      if (
        draftRes &&
        (draftRes.vehicleTypeRequired ||
          draftRes.materialType ||
          draftRes.pickupAddress ||
          draftRes.destinationAddress)
      ) {
        unifiedList.push({
          id: 'draft-active',
          displayId: 'DRAFT-IN-PROGRESS',
          stage: 'DRAFT',
          stageLabel: 'Draft',
          status: 'DRAFT',
          created_at: new Date().toISOString(),
          pickup_city: draftRes.pickupCity || 'Origin',
          pickup_address: draftRes.pickupAddress || 'Unsaved Pickup Address',
          pickup_pincode: draftRes.pickupPincode,
          destination_city: draftRes.destinationCity || 'Destination',
          destination_address: draftRes.destinationAddress || 'Unsaved Delivery Address',
          destination_pincode: draftRes.destinationPincode,
          vehicle_type: draftRes.vehicleTypeRequired || 'Commercial Unit',
          material_type: draftRes.materialType || 'General Freight',
          capacity_mt: draftRes.requiredCapacityMt,
          pickup_date: draftRes.preferredLoadingDate || draftRes.loadingDatetime,
          target_rate: draftRes.targetBudget ? Number(draftRes.targetBudget) : undefined,
          quotations_count: 0,
          is_draft: true,
        });
      }

      // Map Real Database Requirements
      rawReqs.forEach((r) => {
        const linkedBooking = bookingsByReqId[r.id];
        const linkedTrip = linkedBooking ? tripsByBookingId[linkedBooking.id] : undefined;
        const linkedQuotes = quotesByReqId[r.id] || [];

        // Determine precise lifecycle stage based on workflow state machine
        let stage: TransportLifecycleStage = 'SUBMITTED';
        let stageLabel = 'Submitted';

        const rawReqStatus = (r.status || '').toUpperCase();
        const rawTripStatus = (linkedTrip?.trip_status || '').toUpperCase();
        const rawBookingStatus = (linkedBooking?.booking_status || '').toUpperCase();

        if (rawReqStatus === 'CANCELLED' || rawBookingStatus === 'CANCELLED' || rawTripStatus === 'CANCELLED') {
          stage = 'CANCELLED';
          stageLabel = 'Cancelled';
        } else if (rawTripStatus === 'COMPLETED' || rawReqStatus === 'COMPLETED' || rawBookingStatus === 'COMPLETED') {
          stage = 'COMPLETED';
          stageLabel = 'Completed';
        } else if (rawTripStatus === 'DELIVERED') {
          stage = 'DELIVERED';
          stageLabel = 'Delivered';
        } else if (rawTripStatus === 'AT_DESTINATION' || rawTripStatus === 'UNLOADING') {
          stage = 'UNLOADING';
          stageLabel = 'Unloading';
        } else if (
          rawTripStatus === 'IN_TRANSIT' ||
          rawTripStatus === 'LOADED' ||
          rawTripStatus === 'DISPATCHED'
        ) {
          stage = 'IN_TRANSIT';
          stageLabel = 'In Transit';
        } else if (rawTripStatus === 'AT_LOADING' || rawTripStatus === 'LOADING') {
          stage = 'LOADING';
          stageLabel = 'Loading';
        } else if (
          rawTripStatus === 'LORRY_ASSIGNED' ||
          linkedTrip?.vehicle_id ||
          linkedTrip?.driver_id ||
          linkedTrip?.vehicles
        ) {
          stage = 'VEHICLE_ASSIGNED';
          stageLabel = 'Vehicle Assigned';
        } else if (linkedBooking && (rawBookingStatus === 'CONFIRMED' || rawBookingStatus === 'BOOKED')) {
          stage = 'BOOKING_CONFIRMED';
          stageLabel = 'Booking Confirmed';
        } else if (linkedQuotes.length > 0 || rawReqStatus === 'QUOTATIONS_RECEIVED') {
          stage = 'QUOTATIONS_RECEIVED';
          stageLabel = 'Quotes Received';
        } else if (rawReqStatus === 'UNDER_REVIEW' || rawReqStatus === 'PENDING_REVIEW') {
          stage = 'UNDER_REVIEW';
          stageLabel = 'Under Review';
        } else if (rawReqStatus === 'DRAFT') {
          stage = 'DRAFT';
          stageLabel = 'Draft';
        }

        const displayId =
          r.requirement_code && r.requirement_code.startsWith('TRUCKX-REQ-')
            ? r.requirement_code
            : formatDisplayId('REQ', r.requirement_code || r.requirement_id || r.id, r.created_at);

        const canonicalBookingCode = linkedBooking
          ? (linkedBooking.booking_code && linkedBooking.booking_code.startsWith('TRUCKX-BK-')
              ? linkedBooking.booking_code
              : formatDisplayId('BK', linkedBooking.booking_code || linkedBooking.id, linkedBooking.confirmed_at || linkedBooking.created_at))
          : undefined;

        const canonicalTripCode = linkedTrip
          ? (linkedTrip.trip_code && linkedTrip.trip_code.startsWith('TRUCKX-TR-')
              ? linkedTrip.trip_code
              : formatDisplayId('TR', linkedTrip.trip_code || linkedTrip.lr_number || linkedTrip.id, linkedTrip.created_at))
          : undefined;

        unifiedList.push({
          id: r.id,
          displayId,
          stage,
          stageLabel,
          status: r.status,
          created_at: r.created_at,
          pickup_city:
            r.pickup_city ||
            (r.pickup_address ? r.pickup_address.split(',')[0].trim() : 'Origin Hub'),
          pickup_address: r.pickup_address || 'Pickup Point',
          pickup_pincode: r.pickup_pincode,
          destination_city:
            r.destination_city ||
            (r.destination_address ? r.destination_address.split(',')[0].trim() : 'Destination Depot'),
          destination_address: r.destination_address || 'Delivery Point',
          destination_pincode: r.destination_pincode,
          vehicle_type: r.vehicle_type || r.vehicle_type_required || 'Commercial Fleet Unit',
          material_type: r.material_type || 'General Cargo',
          capacity_mt: r.capacity_mt || r.weight_mt,
          package_count: r.package_count || r.quantity,
          pickup_date: r.pickup_date || r.schedule_date,
          target_rate: r.target_rate || r.budget_amount,
          quotations_count: linkedQuotes.length,
          quotations: linkedQuotes,
          booking_id: linkedBooking?.id,
          booking_code: canonicalBookingCode,
          booking_status: linkedBooking?.booking_status,
          booking_amount: linkedBooking?.grand_total,
          trip_id: linkedTrip?.id,
          trip_code: canonicalTripCode,
          lr_number: linkedTrip?.lr_number || canonicalTripCode,
          trip_status: linkedTrip?.trip_status,
          vehicle_registration: linkedTrip?.vehicles?.registration_number,
          vehicle_model: linkedTrip?.vehicles?.model,
          driver_name: linkedTrip?.drivers?.full_name,
          driver_phone: linkedTrip?.drivers?.mobile,
        });
      });

      setItems(unifiedList);
    } catch (err: any) {
      console.warn('Error loading client requirements:', err);
      setErrorMessage('Unable to load requirements. Please check your network connection.');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();

    // Supabase Live Realtime Subscription for requirements, bookings & trips
    const channel = supabase
      .channel('my_requirements_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
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

  const handleClearDraft = async () => {
    Alert.alert(
      'Clear Draft',
      'Are you sure you want to discard your unsaved transport requirement draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Draft',
          style: 'destructive',
          onPress: async () => {
            await clientService.clearTransportRequirementDraft(clientId);
            setSavedDraft(null);
            setItems((prev) => prev.filter((i) => !i.is_draft));
          },
        },
      ]
    );
  };

  // Stage filters matching Task 5 requirements
  const stageFilters: { key: TransportLifecycleStage; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'QUOTATIONS_RECEIVED', label: 'Quotations Received' },
    { key: 'BOOKING_CONFIRMED', label: 'Booking Confirmed' },
    { key: 'VEHICLE_ASSIGNED', label: 'Vehicle Assigned' },
    { key: 'LOADING', label: 'Loading' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
    { key: 'UNLOADING', label: 'Unloading' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  // Stage counts for quick header cards
  const stageCounts = useMemo(() => {
    let total = items.length;
    let quotes = 0;
    let confirmed = 0;
    let inTransit = 0;
    let completed = 0;

    items.forEach((i) => {
      if (i.stage === 'QUOTATIONS_RECEIVED') quotes++;
      else if (i.stage === 'BOOKING_CONFIRMED' || i.stage === 'VEHICLE_ASSIGNED') confirmed++;
      else if (i.stage === 'LOADING' || i.stage === 'IN_TRANSIT' || i.stage === 'UNLOADING') inTransit++;
      else if (i.stage === 'DELIVERED' || i.stage === 'COMPLETED') completed++;
    });

    return { total, quotes, confirmed, inTransit, completed };
  }, [items]);

  // Filter & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Stage Filter
      if (selectedStage !== 'ALL') {
        if (item.stage !== selectedStage) return false;
      }

      // Search Query
      if (debouncedQuery) {
        const searchTarget = [
          item.id,
          item.displayId,
          item.lr_number,
          item.trip_code,
          item.booking_code,
          item.pickup_city,
          item.pickup_address,
          item.destination_city,
          item.destination_address,
          item.vehicle_type,
          item.material_type,
          item.vehicle_registration,
          item.driver_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchTarget.includes(debouncedQuery)) return false;
      }

      return true;
    });
  }, [items, selectedStage, debouncedQuery]);

  const handleCopyId = (id: string) => {
    Clipboard.setString(id);
    Alert.alert('Copied', `ID ${id} copied to clipboard.`);
  };

  const handleCallDriver = (phone?: string) => {
    if (!phone) {
      Alert.alert('Driver Contact', 'Driver phone number is not available.');
      return;
    }
    const clean = phone.replace(/[^0-9+]/g, '');
    Platform.OS === 'web'
      ? window.open(`tel:${clean}`)
      : Alert.alert('Call Driver', `Calling ${clean}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header matching Shipment Screen Theme ── */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel="Back to Dashboard"
          >
            <ArrowLeft size={20} color="#0C1A34" />
          </TouchableOpacity>
          <BrandLogoHeader size="sm" showSubtitle={false} />
        </View>

        <TouchableOpacity
          style={styles.createRfqButton}
          onPress={onCreateNew}
          activeOpacity={0.85}
          accessibilityLabel="Post New Requirement"
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.createRfqButtonText}>Post RFQ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F15A24" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Quick Summary Cards ── */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={[styles.metricCard, selectedStage === 'ALL' && styles.metricCardActive]}
            onPress={() => setSelectedStage('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricValue, { color: '#0C1A34' }]}>{stageCounts.total}</Text>
            <Text style={styles.metricLabel}>Total Reqs</Text>
            <View style={[styles.metricBar, { backgroundColor: '#0C1A34' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              selectedStage === 'QUOTATIONS_RECEIVED' && styles.metricCardActive,
            ]}
            onPress={() => setSelectedStage(selectedStage === 'QUOTATIONS_RECEIVED' ? 'ALL' : 'QUOTATIONS_RECEIVED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricValue, { color: '#16A34A' }]}>{stageCounts.quotes}</Text>
            <Text style={styles.metricLabel}>Quotes Recv</Text>
            <View style={[styles.metricBar, { backgroundColor: '#16A34A' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              selectedStage === 'IN_TRANSIT' && styles.metricCardActive,
            ]}
            onPress={() => setSelectedStage(selectedStage === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricValue, { color: '#F15A24' }]}>{stageCounts.inTransit}</Text>
            <Text style={styles.metricLabel}>In Transit</Text>
            <View style={[styles.metricBar, { backgroundColor: '#F15A24' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metricCard,
              selectedStage === 'COMPLETED' && styles.metricCardActive,
            ]}
            onPress={() => setSelectedStage(selectedStage === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.metricValue, { color: '#2563EB' }]}>{stageCounts.completed}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
            <View style={[styles.metricBar, { backgroundColor: '#2563EB' }]} />
          </TouchableOpacity>
        </View>

        {/* ── Search Input Bar ── */}
        <View style={[styles.searchBarContainer, isSearchFocused && styles.searchBarFocused]}>
          <Search size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID, route, material, vehicle, driver..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Horizontal Stage Filters (Matching Theme) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {stageFilters.map((tab) => {
            const isSelected = selectedStage === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedStage(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── List of Requirements & Shipments ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingText}>Syncing transport requirements & shipments...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorContainer}>
            <AlertTriangle size={32} color="#DC2626" />
            <Text style={styles.errorTitle}>Connection Issue</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadData} activeOpacity={0.8}>
              <RotateCcw size={15} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry Sync</Text>
            </TouchableOpacity>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Package size={34} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No requirements found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No matching records found for "${searchQuery}".`
                : selectedStage !== 'ALL'
                  ? `No records found under the "${stageFilters.find((s) => s.key === selectedStage)?.label}" stage.`
                  : 'You have not submitted any transport requirements yet. Post an RFQ to get instant carrier quotes.'}
            </Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={onCreateNew} activeOpacity={0.85}>
              <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.emptyActionBtnText}>Create Transport Requirement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredItems.map((item) => {
            const hasTrip = !!item.trip_id;
            const hasBooking = !!item.booking_id;
            const hasQuotes = item.quotations_count > 0;
            const isLiveShipment =
              item.stage === 'LOADING' ||
              item.stage === 'IN_TRANSIT' ||
              item.stage === 'UNLOADING' ||
              item.stage === 'DELIVERED';

            // Resolve stage badge styling
            let badgeBg = '#EFF6FF';
            let badgeColor = '#2563EB';
            let badgeBorder = '#BFDBFE';

            if (item.stage === 'DRAFT') {
              badgeBg = '#F1F5F9';
              badgeColor = '#64748B';
              badgeBorder = '#CBD5E1';
            } else if (item.stage === 'UNDER_REVIEW') {
              badgeBg = '#FFFBEB';
              badgeColor = '#D97706';
              badgeBorder = '#FDE68A';
            } else if (item.stage === 'QUOTATIONS_RECEIVED') {
              badgeBg = '#F0FDF4';
              badgeColor = '#16A34A';
              badgeBorder = '#BBF7D0';
            } else if (item.stage === 'BOOKING_CONFIRMED' || item.stage === 'VEHICLE_ASSIGNED') {
              badgeBg = '#F5F3FF';
              badgeColor = '#7C3AED';
              badgeBorder = '#DDD6FE';
            } else if (item.stage === 'LOADING' || item.stage === 'IN_TRANSIT' || item.stage === 'UNLOADING') {
              badgeBg = '#FFF5ED';
              badgeColor = '#F15A24';
              badgeBorder = '#FED7AA';
            } else if (item.stage === 'DELIVERED' || item.stage === 'COMPLETED') {
              badgeBg = '#ECFDF5';
              badgeColor = '#059669';
              badgeBorder = '#A7F3D0';
            } else if (item.stage === 'CANCELLED') {
              badgeBg = '#FEF2F2';
              badgeColor = '#DC2626';
              badgeBorder = '#FECACA';
            }

            return (
              <View key={item.id} style={styles.card}>
                {/* ── Top Header Row ── */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardIdGroup}>
                    <TouchableOpacity
                      onPress={() => !item.is_draft && handleCopyId(item.displayId)}
                      style={styles.idCopyRow}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardIdText}>{item.displayId}</Text>
                      {!item.is_draft && <Copy size={12} color="#94A3B8" />}
                    </TouchableOpacity>

                    {item.trip_id && (
                      <View style={styles.tripIdPill}>
                        <Compass size={11} color="#F15A24" />
                        <Text style={styles.tripIdPillText}>
                          {item.lr_number || formatDisplayId('TRP', item.trip_id)}
                        </Text>
                      </View>
                    )}

                    {item.booking_id && !item.trip_id && (
                      <View style={styles.bookingIdPill}>
                        <Text style={styles.bookingIdPillText}>
                          {item.booking_code || formatDisplayId('BK', item.booking_id)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.stageBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                    <Text style={[styles.stageBadgeText, { color: badgeColor }]}>
                      {item.stageLabel}
                    </Text>
                  </View>
                </View>

                {/* ── Route Row ── */}
                <View style={styles.routeRow}>
                  <View style={styles.routeCityBox}>
                    <View style={styles.originGreenDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cityText} numberOfLines={1}>
                        {item.pickup_city}
                      </Text>
                      <Text style={styles.addressSubText} numberOfLines={1}>
                        {item.pickup_address}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeArrowBox}>
                    <Text style={styles.routeArrow}>➔</Text>
                  </View>

                  <View style={styles.routeCityBox}>
                    <View style={styles.destRedDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cityText} numberOfLines={1}>
                        {item.destination_city}
                      </Text>
                      <Text style={styles.addressSubText} numberOfLines={1}>
                        {item.destination_address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── Cargo & Vehicle Row ── */}
                <View style={styles.specsRow}>
                  <View style={styles.specChip}>
                    <Truck size={13} color="#64748B" />
                    <Text style={styles.specChipText} numberOfLines={1}>
                      {item.vehicle_type}
                    </Text>
                  </View>

                  <View style={styles.specChip}>
                    <Package size={13} color="#64748B" />
                    <Text style={styles.specChipText} numberOfLines={1}>
                      {item.material_type} {item.capacity_mt ? `• ${item.capacity_mt} MT` : ''}
                    </Text>
                  </View>

                  {item.target_rate ? (
                    <View style={styles.budgetChip}>
                      <IndianRupee size={12} color="#16A34A" />
                      <Text style={styles.budgetChipText}>
                        ₹{Number(item.target_rate).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* ── Assigned Driver / Vehicle Details if available ── */}
                {item.driver_name || item.vehicle_registration ? (
                  <View style={styles.driverInfoBanner}>
                    <View style={styles.driverBannerLeft}>
                      <ShieldCheck size={14} color="#16A34A" />
                      <Text style={styles.driverBannerText} numberOfLines={1}>
                        {item.vehicle_registration || 'Vehicle Assigned'}
                        {item.driver_name ? ` • ${item.driver_name}` : ''}
                      </Text>
                    </View>

                    {item.driver_phone ? (
                      <TouchableOpacity
                        style={styles.callDriverBtn}
                        onPress={() => handleCallDriver(item.driver_phone)}
                        accessibilityLabel="Call Driver"
                      >
                        <Phone size={12} color="#F15A24" />
                        <Text style={styles.callDriverText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {/* ── Card Footer & Contextual Actions ── */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.dateWrap}>
                    <Calendar size={13} color="#94A3B8" />
                    <Text style={styles.dateText}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Recent'}
                    </Text>
                  </View>

                  <View style={styles.actionsRight}>
                    {/* Live Shipment / Trip Active: Prominent Track CTA */}
                    {isLiveShipment && item.trip_id && (
                      <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => {
                          if (onTrackShipment) onTrackShipment(item.trip_id!);
                        }}
                        activeOpacity={0.85}
                        accessibilityLabel="Track Shipment"
                      >
                        <Compass size={14} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.primaryActionBtnText}>Track Shipment</Text>
                      </TouchableOpacity>
                    )}

                    {/* Quotations Received: Review Quotes CTA */}
                    {!isLiveShipment && hasQuotes && (
                      <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => {
                          if (onViewQuotations) onViewQuotations(item.id);
                        }}
                        activeOpacity={0.85}
                        accessibilityLabel="View Quotations"
                      >
                        <FileText size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.primaryActionBtnText}>
                          Quotes ({item.quotations_count})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Booking Confirmed without live trip yet: View Booking CTA */}
                    {!isLiveShipment && !hasQuotes && hasBooking && (
                      <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => {
                          if (onSelectBooking) onSelectBooking(item.booking_id!);
                          else onSelectRequirement(item.id);
                        }}
                        activeOpacity={0.8}
                        accessibilityLabel="View Booking Details"
                      >
                        <Text style={styles.secondaryActionBtnText}>View Booking</Text>
                      </TouchableOpacity>
                    )}

                    {/* Unsaved Draft: Resume Draft or Clear CTA */}
                    {item.is_draft && (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.clearDraftBtn}
                          onPress={handleClearDraft}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.clearDraftBtnText}>Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => {
                            if (onResumeDraft && savedDraft) onResumeDraft(savedDraft);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.primaryActionBtnText}>Resume Draft</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Normal Submitted / Under Review Requirement Details */}
                    {!item.is_draft && (
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => onSelectRequirement(item.id)}
                        activeOpacity={0.8}
                        accessibilityLabel="View Requirement Details"
                      >
                        <Text style={styles.detailsBtnText}>Details</Text>
                        <ChevronRight size={14} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
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
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRfqButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F15A24',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  createRfqButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  metricCardActive: {
    borderColor: '#F15A24',
    backgroundColor: '#FFFBF8',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  metricBar: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
    marginTop: 6,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchBarFocused: {
    borderColor: '#F15A24',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0C1A34',
    borderColor: '#0C1A34',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 10,
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
    marginBottom: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1A34',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F15A24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  idCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C1A34',
    letterSpacing: 0.2,
  },
  tripIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripIdPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  bookingIdPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingIdPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  routeCityBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  originGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginTop: 5,
  },
  destRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginTop: 5,
  },
  cityText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  addressSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  routeArrowBox: {
    paddingHorizontal: 8,
  },
  routeArrow: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  budgetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  budgetChipText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  driverInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  driverBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  driverBannerText: {
    fontSize: 11.5,
    color: '#1E293B',
    fontWeight: '600',
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callDriverText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F15A24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  clearDraftBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  clearDraftBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
});
