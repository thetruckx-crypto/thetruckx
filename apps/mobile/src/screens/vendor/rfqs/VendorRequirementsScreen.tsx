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
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  Search,
  Package,
  Calendar,
  Truck,
  RefreshCw,
  Clock,
  X,
  MapPin,
  ChevronRight,
  Filter,
  Scale,
  AlertCircle,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorRequirementsScreenProps {
  vendorId?: string;
  onBack: () => void;
  onSelectRequirement: (reqId: string) => void;
  onContinueRegistration?: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorRequirementsScreen: React.FC<VendorRequirementsScreenProps> = ({
  vendorId,
  onBack,
  onSelectRequirement,
  onContinueRegistration,
  onSelectNavTab,
}) => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'GHY' | 'CCU' | 'HEAVY'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Registration reminder banner state
  const [showRegBanner, setShowRegBanner] = useState(true);
  const [vendorStatus, setVendorStatus] = useState<string>('APPROVED');

  const loadRequirements = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (vendorId) {
        const statusRes = await vendorService.getVendorVerificationStatus(vendorId);
        setVendorStatus(statusRes.status);
      }

      const data = await vendorService.getAvailableRequirements(vendorId);
      setRequirements(data);
    } catch (err: any) {
      console.warn('Requirements loading notice:', err);
      setErrorMessage(err?.message || 'Could not retrieve live requirements. Tap to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequirements();
  };

  // Helper to format friendly RFQ ID
  const getRfqDisplayNumber = (req: any, index: number) => {
    if (req.id && typeof req.id === 'string' && req.id.length < 15) {
      return req.id.toUpperCase();
    }
    const shortCode = (req.id || '').replace(/[^0-9]/g, '').slice(-5) || String(10025 + index);
    return `RFQ-2025-${shortCode.padStart(5, '0')}`;
  };

  // Helper to format bid deadline
  const formatBidDeadline = (loadingDatetime?: string) => {
    if (!loadingDatetime) return 'Open for Bids';
    const d = new Date(loadingDatetime);
    if (isNaN(d.getTime())) return 'Active Bidding';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper to format pickup date
  const formatPickupDate = (loadingDatetime?: string) => {
    if (!loadingDatetime) return 'Immediate Loading';
    const d = new Date(loadingDatetime);
    if (isNaN(d.getTime())) return 'Standard Dispatch';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Status badge styling
  const getStatusBadge = (req: any, index: number) => {
    if (req.hasQuoted) {
      return { text: 'Quoted', bg: '#EFF6FF', color: '#168BEE' };
    }
    if (index % 3 === 0) {
      return { text: 'Open', bg: '#ECFDF3', color: '#12B76A' };
    }
    if (index % 3 === 1) {
      return { text: 'Bidding', bg: '#EFF6FF', color: '#168BEE' };
    }
    return { text: 'New', bg: '#F1F5F9', color: '#475569' };
  };

  // Filter counts
  const counts = useMemo(() => {
    const total = requirements.length;
    const ghy = requirements.filter(
      (r) =>
        r.pickupAddress?.toLowerCase().includes('guwahati') ||
        r.destinationAddress?.toLowerCase().includes('guwahati') ||
        r.pickupAddress?.toLowerCase().includes('assam') ||
        r.destinationAddress?.toLowerCase().includes('assam')
    ).length;
    const ccu = requirements.filter(
      (r) =>
        r.pickupAddress?.toLowerCase().includes('kolkata') ||
        r.destinationAddress?.toLowerCase().includes('kolkata') ||
        r.pickupAddress?.toLowerCase().includes('bengal') ||
        r.destinationAddress?.toLowerCase().includes('bengal')
    ).length;
    const heavy = requirements.filter((r) => (Number(r.requiredCapacityMt) || 0) >= 20).length;

    return { total, ghy, ccu, heavy };
  }, [requirements]);

  // Filtered Requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.pickupAddress?.toLowerCase().includes(q) ||
        r.destinationAddress?.toLowerCase().includes(q) ||
        r.materialType?.toLowerCase().includes(q) ||
        r.vehicleType?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeFilter === 'GHY') {
        return (
          r.pickupAddress?.toLowerCase().includes('guwahati') ||
          r.destinationAddress?.toLowerCase().includes('guwahati') ||
          r.pickupAddress?.toLowerCase().includes('assam') ||
          r.destinationAddress?.toLowerCase().includes('assam')
        );
      }
      if (activeFilter === 'CCU') {
        return (
          r.pickupAddress?.toLowerCase().includes('kolkata') ||
          r.destinationAddress?.toLowerCase().includes('kolkata') ||
          r.pickupAddress?.toLowerCase().includes('bengal') ||
          r.destinationAddress?.toLowerCase().includes('bengal')
        );
      }
      if (activeFilter === 'HEAVY') {
        return (Number(r.requiredCapacityMt) || 0) >= 20;
      }

      return true;
    });
  }, [requirements, searchQuery, activeFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setActiveFilter('ALL');
  };

  const handleResumeRegistration = () => {
    if (onContinueRegistration) {
      onContinueRegistration();
    } else {
      onBack();
    }
  };

  const handleTabSelection = (tab: VendorNavTab) => {
    if (tab === 'LOADS') {
      onRefresh();
    } else {
      if (onSelectNavTab) onSelectNavTab(tab);
      else onBack();
    }
  };

  const isRegistrationPending = vendorStatus === 'PENDING' || vendorStatus === 'INCOMPLETE';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Compact Header (Screenshot 2 Match - No landscape banner) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onBack}
          accessibilityLabel="Back to Dashboard"
          activeOpacity={0.8}
        >
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>

        <Text style={styles.headerTitleText}>
          Available <Text style={styles.headerTitleOrange}>Transport Loads</Text>
        </Text>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={onRefresh}
          accessibilityLabel="Refresh requirements"
          activeOpacity={0.8}
        >
          <RefreshCw size={18} color="#F15A24" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F15A24" />
        }
      >
        {/* ── 2. Registration Reminder Banner (Screenshot 2 Match) ── */}
        {showRegBanner && isRegistrationPending && (
          <View style={styles.registrationBanner}>
            <TouchableOpacity
              style={styles.regBannerTouchArea}
              onPress={handleResumeRegistration}
              activeOpacity={0.85}
            >
              <Clock size={18} color="#D97706" style={{ marginTop: 2 }} />
              <View style={styles.regBannerTextWrap}>
                <Text style={styles.regBannerMainText}>
                  <Text style={{ fontWeight: '800' }}>Complete Your Registration:</Text> Resume remaining required registration steps and submit for TRUCKS verification.
                </Text>
              </View>
              <ChevronRight size={18} color="#B45309" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.regBannerCloseBtn}
              onPress={() => setShowRegBanner(false)}
              accessibilityLabel="Dismiss banner"
              activeOpacity={0.7}
            >
              <X size={16} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── 3. Screen Subtitle (Screenshot 2 Match) ── */}
        <Text style={styles.screenSubtitle}>
          Live requirements from verified corporate shippers awaiting competitive freight bids.
        </Text>

        {/* ── 4. Search Bar (Screenshot 2 Match) ── */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color="#667085" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by city, hub or cargo material..."
            placeholderTextColor="#98A2B3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color="#667085" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── 5. Horizontal Filter Chips (Screenshot 2 Match) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {/* All */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>
              All ({counts.total})
            </Text>
          </TouchableOpacity>

          {/* Guwahati Corridor */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'GHY' && styles.filterChipActive]}
            onPress={() => setActiveFilter('GHY')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === 'GHY' && styles.filterChipTextActive]}>
              Guwahati Corridor ({counts.ghy})
            </Text>
          </TouchableOpacity>

          {/* Kolkata Trunk */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'CCU' && styles.filterChipActive]}
            onPress={() => setActiveFilter('CCU')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === 'CCU' && styles.filterChipTextActive]}>
              Kolkata Trunk ({counts.ccu})
            </Text>
          </TouchableOpacity>

          {/* Heavy Cargo */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'HEAVY' && styles.filterChipActive]}
            onPress={() => setActiveFilter('HEAVY')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === 'HEAVY' && styles.filterChipTextActive]}>
              Heavy Cargo ({counts.heavy})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Network Error Notification */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            <TouchableOpacity onPress={loadRequirements} style={styles.errorRetryBtn}>
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 6. Freight Load Results List ── */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F15A24" />
            <Text style={styles.loadingText}>Loading available corporate freight loads...</Text>
          </View>
        ) : filteredRequirements.length === 0 ? (
          /* Empty State (Screenshot 2 Match) */
          <View style={styles.emptyContainer}>
            {/* Vector Clipboard Illustration */}
            <View style={styles.clipboardIllustrationWrap}>
              <View style={styles.clipboardBoard}>
                <View style={styles.clipboardClip} />
                <View style={styles.clipboardLine1} />
                <View style={styles.clipboardLine2} />
                <View style={styles.clipboardLine3} />
                <View style={styles.magnifierCircle}>
                  <Search size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            </View>

            <Text style={styles.emptyTitle}>No Matching Requirements Found</Text>
            <Text style={styles.emptySubtitle}>Try clearing filters or search parameters.</Text>

            <TouchableOpacity style={styles.clearFiltersBtn} onPress={handleClearFilters} activeOpacity={0.8}>
              <Filter size={15} color="#F15A24" />
              <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Live Freight Load Cards (Screenshot 2 Match) */
          <View style={styles.cardsList}>
            {filteredRequirements.map((req, idx) => {
              const rfqNum = getRfqDisplayNumber(req, idx);
              const badge = getStatusBadge(req, idx);
              const deadline = formatBidDeadline(req.loadingDatetime);
              const pickupDateStr = formatPickupDate(req.loadingDatetime);

              const originCity = req.pickupAddress?.split(',')[0]?.trim() || 'Guwahati, AS';
              const destCity = req.destinationAddress?.split(',')[0]?.trim() || 'Kolkata, WB';
              const material = req.materialType || 'Industrial Cargo';
              const vehicleType = req.vehicleType || 'Truck (32 ft)';
              const capacity = req.requiredCapacityMt || 20;

              return (
                <View key={req.id || idx} style={styles.loadCard}>
                  {/* Top Row: RFQ Number, Status Pill, Bid Deadline */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.rfqLeftCluster}>
                      <View style={styles.boxIconWrap}>
                        <Package size={18} color="#F15A24" />
                      </View>
                      <Text style={styles.rfqIdText}>{rfqNum}</Text>
                      <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusPillText, { color: badge.color }]}>{badge.text}</Text>
                      </View>
                    </View>

                    <View style={styles.deadlineCluster}>
                      <Clock size={13} color="#F15A24" />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.bidTillLabel}>Bid till</Text>
                        <Text style={styles.bidTillValue}>{deadline}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Cargo Subtitle */}
                  <Text style={styles.materialTitle}>{material}</Text>

                  {/* Route Row: Origin ---> Destination */}
                  <View style={styles.routeRow}>
                    {/* Origin */}
                    <View style={styles.locationNode}>
                      <MapPin size={16} color="#FF5A1F" style={{ marginTop: 2 }} />
                      <View>
                        <Text style={styles.cityNameText}>{originCity}</Text>
                        <Text style={styles.locationTypeLabel}>Pickup</Text>
                      </View>
                    </View>

                    {/* Connecting Dashed Arrow */}
                    <View style={styles.routeArrowCluster}>
                      <Text style={styles.dashedArrowText}>- - - →</Text>
                    </View>

                    {/* Destination */}
                    <View style={styles.locationNode}>
                      <MapPin size={16} color="#168BEE" style={{ marginTop: 2 }} />
                      <View>
                        <Text style={styles.cityNameText}>{destCity}</Text>
                        <Text style={styles.locationTypeLabel}>Delivery</Text>
                      </View>
                    </View>
                  </View>

                  {/* Bottom Details Row: Truck, Weight, Date & View Details Button */}
                  <View style={styles.detailsRow}>
                    <View style={styles.specChipsWrap}>
                      <View style={styles.specChip}>
                        <Truck size={14} color="#667085" />
                        <Text style={styles.specChipText}>{vehicleType}</Text>
                      </View>

                      <View style={styles.specChip}>
                        <Scale size={14} color="#667085" />
                        <Text style={styles.specChipText}>{capacity} MT</Text>
                      </View>

                      <View style={styles.specChip}>
                        <Calendar size={14} color="#667085" />
                        <Text style={styles.specChipText}>{pickupDateStr}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.viewDetailsBtn}
                      onPress={() => onSelectRequirement(req.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewDetailsBtnText}>View Details</Text>
                      <ChevronRight size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── 7. Persistent Bottom Navigation Bar ── */}
      <VendorBottomNavBar
        activeTab="LOADS"
        onSelectTab={handleTabSelection}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  /* Compact Header */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 10,
    backgroundColor: '#F6F8FB',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
  },
  headerTitleOrange: {
    color: '#F15A24',
  },
  /* Registration reminder banner */
  registrationBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regBannerTouchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regBannerTextWrap: {
    flex: 1,
    paddingRight: 6,
  },
  regBannerMainText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  regBannerCloseBtn: {
    padding: 4,
    marginLeft: 4,
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 17,
  },
  /* Search field */
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DEE7',
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#172B4D',
    height: '100%',
  },
  /* Filter chips */
  filterChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DEE7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  /* Error banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
  },
  errorRetryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  /* Load cards */
  cardsList: {
    gap: 12,
  },
  loadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  rfqLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  boxIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfqIdText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deadlineCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bidTillLabel: {
    fontSize: 9,
    color: '#667085',
  },
  bidTillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  materialTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
    marginBottom: 12,
    marginLeft: 34,
  },
  /* Route */
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFCFE',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  locationNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cityNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#172B4D',
  },
  locationTypeLabel: {
    fontSize: 10,
    color: '#667085',
  },
  routeArrowCluster: {
    paddingHorizontal: 6,
  },
  dashedArrowText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  /* Bottom details row */
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specChipText: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '500',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F15A24',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  /* Empty state */
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    marginVertical: 10,
  },
  clipboardIllustrationWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clipboardBoard: {
    width: 52,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    paddingTop: 12,
    position: 'relative',
  },
  clipboardClip: {
    position: 'absolute',
    top: -5,
    width: 22,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  clipboardLine1: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },
  clipboardLine2: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },
  clipboardLine3: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  magnifierCircle: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F15A24',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F15A24',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#667085',
    marginTop: 10,
  },
});
