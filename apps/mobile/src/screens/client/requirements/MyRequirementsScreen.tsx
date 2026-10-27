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
  Linking,
  Alert,
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
  Send,
  CheckCircle2,
  X,
  ArrowUpDown,
  FileCheck,
  Clock,
  Layers,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { clientService } from '../../../services/clientService';
import { buildGoogleMapsDirectionsUrl } from '../../../utils/googleMapsUtil';

export type RequirementStatusFilter =
  | 'ALL'
  | 'ACTIVE_RFQS'
  | 'QUOTATIONS_RECEIVED'
  | 'BOOKED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export type SortOrder = 'RECENT' | 'NEWEST' | 'OLDEST';

interface MyRequirementsScreenProps {
  clientId?: string;
  onBack: () => void;
  onSelectRequirement: (requirementId: string) => void;
  onViewQuotations?: (requirementId: string) => void;
  onCreateNew: () => void;
}

export const MyRequirementsScreen: React.FC<MyRequirementsScreenProps> = ({
  clientId,
  onBack,
  onSelectRequirement,
  onViewQuotations,
  onCreateNew,
}) => {
  const [filterTab, setFilterTab] = useState<RequirementStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('RECENT');
  const [showSortModal, setShowSortModal] = useState(false);

  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRequirements = useCallback(async () => {
    try {
      setErrorMsg(null);
      const data = await clientService.fetchClientRequirements(clientId);
      setRequirements(data || []);
    } catch {
      setErrorMsg('Unable to retrieve transport requirements. Please check your connection.');
      setRequirements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequirements();
  };

  // ── Helper to resolve customer status ──
  const getRequirementCategory = (item: any): RequirementStatusFilter => {
    const rawStatus = (item.status || '').toUpperCase();
    if (rawStatus === 'BOOKED') return 'BOOKED';
    if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') return 'COMPLETED';
    if (rawStatus === 'IN_TRANSIT') return 'IN_TRANSIT';
    if (rawStatus === 'CANCELLED') return 'CANCELLED';

    const quoteCount = item.quotationsCount || (item.quotations && item.quotations.length) || 0;
    if (quoteCount > 0) return 'QUOTATIONS_RECEIVED';
    return 'ACTIVE_RFQS';
  };

  // ── Calculated Summary Counts ──
  const summaryCounts = useMemo(() => {
    let total = requirements.length;
    let active = 0;
    let quotesReceived = 0;
    let booked = 0;
    let inTransit = 0;
    let completed = 0;
    let cancelled = 0;

    requirements.forEach((r) => {
      const cat = getRequirementCategory(r);
      if (cat === 'ACTIVE_RFQS') active++;
      else if (cat === 'QUOTATIONS_RECEIVED') quotesReceived++;
      else if (cat === 'BOOKED') booked++;
      else if (cat === 'IN_TRANSIT') inTransit++;
      else if (cat === 'COMPLETED') completed++;
      else if (cat === 'CANCELLED') cancelled++;
    });

    return {
      total,
      active: active + quotesReceived,
      quotesReceived,
      booked,
      inTransit,
      completed,
      cancelled,
    };
  }, [requirements]);

  // ── Filtered & Sorted Requirements ──
  const filteredAndSortedItems = useMemo(() => {
    let list = [...requirements];

    // Filter by Tab
    if (filterTab !== 'ALL') {
      list = list.filter((item) => {
        const cat = getRequirementCategory(item);
        if (filterTab === 'ACTIVE_RFQS') {
          return cat === 'ACTIVE_RFQS' || cat === 'QUOTATIONS_RECEIVED';
        }
        return cat === filterTab;
      });
    }

    // Search query
    const cleanSearch = searchQuery.trim().toLowerCase();
    if (cleanSearch) {
      list = list.filter((item) => {
        const searchTarget = [
          item.id,
          item.pickup_address,
          item.pickup_city,
          item.pickup_pincode,
          item.destination_address,
          item.destination_city,
          item.destination_pincode,
          item.material_type,
          item.vehicle_type,
          item.vehicle_type_required,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchTarget.includes(cleanSearch);
      });
    }

    // Sort order
    list.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();

      if (sortOrder === 'NEWEST') return dateB - dateA;
      if (sortOrder === 'OLDEST') return dateA - dateB;
      // Default: Recently updated
      return dateB - dateA;
    });

    return list;
  }, [requirements, filterTab, searchQuery, sortOrder]);

  const handleOpenMap = (item: any) => {
    const directionsUrl = buildGoogleMapsDirectionsUrl({
      latitude: item.pickup_latitude,
      longitude: item.pickup_longitude,
      address: `${item.pickup_address || item.pickup_city || ''}`,
    });

    Linking.canOpenURL(directionsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(directionsUrl);
        } else {
          Linking.openURL(directionsUrl);
        }
      })
      .catch(() => {
        Alert.alert('Cannot Open Maps', 'Unable to launch Google Maps.');
      });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Flexible Schedule';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Immediate Loading Required';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const datePart = d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} · ${timePart}`;
    } catch {
      return dateString;
    }
  };

  const getCity = (addr?: string, pincode?: string) => {
    if (!addr) return pincode ? `PIN: ${pincode}` : 'Hub Depot';
    const firstPart = addr.split(',')[0].trim();
    return firstPart || addr;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back to Dashboard"
        >
          <ArrowLeft size={20} color="#101D36" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onCreateNew}
          accessibilityLabel="Create Transport Requirement"
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.8} />
        </TouchableOpacity>
      </View>

      {/* ── Screen Title & Subtitle ── */}
      <View style={styles.titleWrap}>
        <Text style={styles.screenHeading}>My Transport Requirements</Text>
        <Text style={styles.screenSubtitle}>
          Track freight requests, compare quotations, and manage shipments.
        </Text>
      </View>

      {/* ── Summary Statistics Cards (Screenshot 2 Match) ── */}
      <View style={styles.statsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          {/* Card 1: Total Requirements */}
          <View style={styles.statCard}>
            <View style={styles.statIconBoxOrange}>
              <FileText size={17} color="#F05A24" />
            </View>
            <View>
              <Text style={styles.statNumber}>{summaryCounts.total}</Text>
              <Text style={styles.statLabel}>Total Requirements</Text>
            </View>
          </View>

          {/* Card 2: Active RFQs */}
          <View style={styles.statCard}>
            <View style={styles.statIconBoxOrange}>
              <Send size={16} color="#F05A24" />
            </View>
            <View>
              <Text style={styles.statNumber}>{summaryCounts.active}</Text>
              <Text style={styles.statLabel}>Active RFQs</Text>
            </View>
          </View>

          {/* Card 3: Booked */}
          <View style={styles.statCard}>
            <View style={styles.statIconBoxOrange}>
              <Truck size={17} color="#F05A24" />
            </View>
            <View>
              <Text style={styles.statNumber}>{summaryCounts.booked}</Text>
              <Text style={styles.statLabel}>Booked</Text>
            </View>
          </View>

          {/* Card 4: Completed */}
          <View style={styles.statCard}>
            <View style={styles.statIconBoxGreen}>
              <CheckCircle2 size={17} color="#10B981" />
            </View>
            <View>
              <Text style={styles.statNumber}>{summaryCounts.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── Functional Search & Sort Bar ── */}
      <View style={styles.searchAndSortRow}>
        <View style={styles.searchBox}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by ID, route, material, vehicle..."
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setShowSortModal(true)}
          activeOpacity={0.8}
        >
          <ArrowUpDown size={14} color="#101D36" />
          <Text style={styles.sortBtnText}>Sort</Text>
        </TouchableOpacity>
      </View>

      {/* ── Horizontally Scrollable Status Filter Chips ── */}
      <View style={styles.filterChipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
          <TouchableOpacity
            style={[styles.chip, filterTab === 'ALL' && styles.chipActive]}
            onPress={() => setFilterTab('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'ALL' && styles.chipTextActive]}>
              All ({summaryCounts.total})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'ACTIVE_RFQS' && styles.chipActive]}
            onPress={() => setFilterTab('ACTIVE_RFQS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'ACTIVE_RFQS' && styles.chipTextActive]}>
              Active RFQs ({summaryCounts.active})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'QUOTATIONS_RECEIVED' && styles.chipActive]}
            onPress={() => setFilterTab('QUOTATIONS_RECEIVED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'QUOTATIONS_RECEIVED' && styles.chipTextActive]}>
              Quotations Received ({summaryCounts.quotesReceived})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'BOOKED' && styles.chipActive]}
            onPress={() => setFilterTab('BOOKED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'BOOKED' && styles.chipTextActive]}>
              Booked ({summaryCounts.booked})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'IN_TRANSIT' && styles.chipActive]}
            onPress={() => setFilterTab('IN_TRANSIT')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'IN_TRANSIT' && styles.chipTextActive]}>
              In Transit ({summaryCounts.inTransit})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'COMPLETED' && styles.chipActive]}
            onPress={() => setFilterTab('COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'COMPLETED' && styles.chipTextActive]}>
              Completed ({summaryCounts.completed})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filterTab === 'CANCELLED' && styles.chipActive]}
            onPress={() => setFilterTab('CANCELLED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filterTab === 'CANCELLED' && styles.chipTextActive]}>
              Cancelled ({summaryCounts.cancelled})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Requirements List ── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F05A24']} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#F05A24" />
            <Text style={styles.loadingText}>Fetching authorized freight requirements...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadRequirements}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Layers size={40} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching requirements' : 'No transport requirements yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search criteria or clear the filter.'
                : 'Post a new freight requirement to get competitive carrier quotations across North Eastern corridors.'}
            </Text>
            {searchQuery ? (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearFilterBtnText}>Clear Search</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.createFirstBtn} onPress={onCreateNew}>
                <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.createFirstBtnText}>Create Requirement</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredAndSortedItems.map((item) => {
            const category = getRequirementCategory(item);
            const quoteCount = item.quotationsCount || (item.quotations && item.quotations.length) || 0;
            const isBooked = category === 'BOOKED' || item.status === 'BOOKED';
            const isCompleted = category === 'COMPLETED' || item.status === 'COMPLETED';

            const originCity = getCity(item.pickup_address, item.pickup_pincode);
            const destinationCity = getCity(item.destination_address, item.destination_pincode);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.requirementCard}
                onPress={() => onSelectRequirement(item.id)}
                activeOpacity={0.88}
              >
                {/* 1. Card Top Row: ID, Date, Status */}
                <View style={styles.cardTopRow}>
                  <View style={styles.idDateRow}>
                    <Text style={styles.requirementIdText}>{item.id}</Text>
                    <Text style={styles.datePostedText}>{formatDate(item.created_at)}</Text>
                  </View>

                  {/* Status Badge */}
                  {category === 'QUOTATIONS_RECEIVED' ? (
                    <View style={styles.badgeBlue}>
                      <View style={styles.dotBlue} />
                      <Text style={styles.badgeBlueText}>Quotations Received</Text>
                    </View>
                  ) : isBooked ? (
                    <View style={styles.badgeGreen}>
                      <View style={styles.dotGreen} />
                      <Text style={styles.badgeGreenText}>Booked</Text>
                    </View>
                  ) : isCompleted ? (
                    <View style={styles.badgeGreen}>
                      <View style={styles.dotGreen} />
                      <Text style={styles.badgeGreenText}>Completed</Text>
                    </View>
                  ) : category === 'CANCELLED' ? (
                    <View style={styles.badgeGrey}>
                      <View style={styles.dotGrey} />
                      <Text style={styles.badgeGreyText}>Cancelled</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeOrange}>
                      <View style={styles.dotOrange} />
                      <Text style={styles.badgeOrangeText}>Under Review / RFQ</Text>
                    </View>
                  )}
                </View>

                {/* 2. Route Corridor & Actions (Screenshot 2 Match) */}
                <View style={styles.routeSectionRow}>
                  {/* Origin & Destination Display */}
                  <View style={styles.corridorBlock}>
                    <View style={styles.originNode}>
                      <View style={styles.nodeTagRow}>
                        <MapPin size={11} color="#F05A24" />
                        <Text style={styles.nodeTagOrigin}>FROM</Text>
                      </View>
                      <Text style={styles.nodeCityText} numberOfLines={1}>
                        {originCity}
                      </Text>
                      {item.pickup_pincode ? (
                        <Text style={styles.nodePinText}>PIN: {item.pickup_pincode}</Text>
                      ) : null}
                    </View>

                    {/* Dotted Route Connector */}
                    <View style={styles.corridorConnector}>
                      <View style={styles.corridorDotLine} />
                      <View style={styles.truckIconBadge}>
                        <Truck size={13} color="#F05A24" />
                      </View>
                      <View style={styles.corridorDotLine} />
                    </View>

                    <View style={styles.destNode}>
                      <View style={styles.nodeTagRow}>
                        <MapPin size={11} color="#10B981" />
                        <Text style={styles.nodeTagDest}>TO</Text>
                      </View>
                      <Text style={styles.nodeCityText} numberOfLines={1}>
                        {destinationCity}
                      </Text>
                      {item.destination_pincode ? (
                        <Text style={styles.nodePinText}>PIN: {item.destination_pincode}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Actions Column (Far Right) */}
                  <View style={styles.rightActionsColumn}>
                    <TouchableOpacity
                      style={styles.viewOnMapBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenMap(item);
                      }}
                      activeOpacity={0.8}
                    >
                      <MapPin size={12} color="#101D36" />
                      <Text style={styles.viewOnMapBtnText}>View on Map</Text>
                    </TouchableOpacity>

                    {isBooked || isCompleted ? (
                      <TouchableOpacity
                        style={styles.viewDetailsBtn}
                        onPress={() => onSelectRequirement(item.id)}
                        activeOpacity={0.85}
                      >
                        <FileCheck size={12} color="#FFFFFF" />
                        <Text style={styles.viewDetailsBtnText}>View Details</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.viewQuotesBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (onViewQuotations) {
                            onViewQuotations(item.id);
                          } else {
                            onSelectRequirement(item.id);
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <FileText size={12} color="#FFFFFF" />
                        <Text style={styles.viewQuotesBtnText}>
                          {quoteCount > 0 ? `View ${quoteCount} Quotations` : 'View Quotations'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 3. Specs Row: Vehicle & Cargo */}
                <View style={styles.specsRow}>
                  <View style={styles.specColumn}>
                    <View style={styles.specLabelRow}>
                      <Truck size={14} color="#64748B" />
                      <Text style={styles.specTitle} numberOfLines={1}>
                        {item.vehicle_type || item.vehicle_type_required || '32 FT Multi-Axle'}
                      </Text>
                    </View>
                    <Text style={styles.specSub}>
                      {item.required_capacity_mt ? `${item.required_capacity_mt} MT Capacity` : '25 MT Capacity'}
                    </Text>
                  </View>

                  <View style={styles.specDivider} />

                  <View style={styles.specColumn}>
                    <View style={styles.specLabelRow}>
                      <Package size={14} color="#64748B" />
                      <Text style={styles.specTitle} numberOfLines={1}>
                        {item.material_type || 'FMCG & Consumer Goods'}
                      </Text>
                    </View>
                    <Text style={styles.specSub}>
                      {item.required_capacity_mt ? `${item.required_capacity_mt} MT` : 'Full Truckload'}
                    </Text>
                  </View>
                </View>

                {/* 4. Bottom Meta Row: Loading Date & Quote Status */}
                <View style={styles.bottomMetaRow}>
                  <View style={styles.dateMetaWrap}>
                    <Calendar size={13} color="#64748B" />
                    <Text style={styles.dateMetaText}>
                      {formatDateTime(item.loading_datetime)}
                    </Text>
                  </View>

                  <View style={styles.quoteStatusWrap}>
                    {isBooked ? (
                      <View style={styles.quoteStatusPillGreen}>
                        <CheckCircle2 size={12} color="#16A34A" />
                        <Text style={styles.quoteStatusTextGreen}>Booked with Certified Transporter</Text>
                      </View>
                    ) : quoteCount > 0 ? (
                      <View style={styles.quoteStatusPillBlue}>
                        <FileText size={12} color="#2563EB" />
                        <Text style={styles.quoteStatusTextBlue}>{quoteCount} Quotations Received</Text>
                      </View>
                    ) : (
                      <View style={styles.quoteStatusPillOrange}>
                        <Clock size={12} color="#F05A24" />
                        <Text style={styles.quoteStatusTextOrange}>Awaiting Carrier Quotations</Text>
                      </View>
                    )}
                    <ChevronRight size={15} color="#F05A24" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Sort Order Selection Modal ── */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModalCard}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>Sort Requirements</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sortOptionItem, sortOrder === 'RECENT' && styles.sortOptionSelected]}
              onPress={() => {
                setSortOrder('RECENT');
                setShowSortModal(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortOrder === 'RECENT' && styles.sortOptionTextActive]}>
                Recently Updated
              </Text>
              {sortOrder === 'RECENT' && <CheckCircle2 size={16} color="#F05A24" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortOptionItem, sortOrder === 'NEWEST' && styles.sortOptionSelected]}
              onPress={() => {
                setSortOrder('NEWEST');
                setShowSortModal(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortOrder === 'NEWEST' && styles.sortOptionTextActive]}>
                Newest First
              </Text>
              {sortOrder === 'NEWEST' && <CheckCircle2 size={16} color="#F05A24" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortOptionItem, sortOrder === 'OLDEST' && styles.sortOptionSelected]}
              onPress={() => {
                setSortOrder('OLDEST');
                setShowSortModal(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortOrder === 'OLDEST' && styles.sortOptionTextActive]}>
                Oldest First
              </Text>
              {sortOrder === 'OLDEST' && <CheckCircle2 size={16} color="#F05A24" />}
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
    backgroundColor: '#F4F6FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F05A24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  titleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101D36',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },

  /* Stats Container */
  statsContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  statsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
  },
  statIconBoxOrange: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBoxGreen: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#101D36',
    lineHeight: 20,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },

  /* Search and Sort */
  searchAndSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#101D36',
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  sortBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#101D36',
  },

  /* Filter Chips */
  filterChipsWrap: {
    paddingBottom: 6,
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#101D36',
    borderColor: '#101D36',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  /* Requirement List Cards */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  requirementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  idDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIdText: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#101D36',
  },
  datePostedText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Badges */
  badgeOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  dotOrange: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F05A24',
  },
  badgeOrangeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
  },
  badgeBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dotBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  badgeBlueText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeGreenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  badgeGrey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dotGrey: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },
  badgeGreyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },

  /* Route Section Row */
  routeSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  corridorBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  originNode: {
    flex: 1,
  },
  destNode: {
    flex: 1,
  },
  nodeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  nodeTagOrigin: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F05A24',
    letterSpacing: 0.5,
  },
  nodeTagDest: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  nodeCityText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101D36',
  },
  nodePinText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  corridorConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  corridorDotLine: {
    width: 14,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.6,
    borderColor: '#CBD5E1',
  },
  truckIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Right Actions Column */
  rightActionsColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  viewOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewOnMapBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#101D36',
  },
  viewQuotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F05A24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    shadowColor: '#F05A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  viewQuotesBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F05A24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  viewDetailsBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Specs Row */
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  specColumn: {
    flex: 1,
  },
  specLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101D36',
  },
  specSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },

  /* Bottom Meta Row */
  bottomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  dateMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateMetaText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  quoteStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteStatusPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteStatusTextBlue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  quoteStatusPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteStatusTextGreen: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  quoteStatusPillOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteStatusTextOrange: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F05A24',
  },

  /* Empty & Loading States */
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101D36',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F05A24',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#F05A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  createFirstBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearFilterBtn: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  clearFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#101D36',
  },

  /* Sort Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 29, 54, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sortModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101D36',
  },
  sortOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  sortOptionSelected: {
    backgroundColor: '#FFF7ED',
  },
  sortOptionText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  sortOptionTextActive: {
    fontWeight: '800',
    color: '#F05A24',
  },
});
