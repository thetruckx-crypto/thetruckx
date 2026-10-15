import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  ChevronLeft,
  Search,
  Package,
  Calendar,
  Truck,
  ArrowRight,
  Filter,
  CheckCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorRequirementsScreenProps {
  vendorId?: string;
  onBack: () => void;
  onSelectRequirement: (reqId: string) => void;
}

export const VendorRequirementsScreen: React.FC<VendorRequirementsScreenProps> = ({
  vendorId,
  onBack,
  onSelectRequirement,
}) => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'GHY' | 'CCU' | 'HEAVY'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReqs = useCallback(async () => {
    try {
      const data = await vendorService.getAvailableRequirements(vendorId);
      setRequirements(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadReqs();
  }, [loadReqs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReqs();
  };

  const filteredRequirements = requirements.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.pickupAddress?.toLowerCase().includes(q) ||
      r.destinationAddress?.toLowerCase().includes(q) ||
      r.materialType?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (activeFilter === 'GHY') {
      return (
        r.pickupAddress?.toLowerCase().includes('guwahati') ||
        r.destinationAddress?.toLowerCase().includes('guwahati')
      );
    }
    if (activeFilter === 'CCU') {
      return (
        r.pickupAddress?.toLowerCase().includes('kolkata') ||
        r.destinationAddress?.toLowerCase().includes('kolkata')
      );
    }
    if (activeFilter === 'HEAVY') {
      return (r.requiredCapacityMt || 0) >= 20;
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F05A22" />
        }
      >
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Available <Text style={styles.goldText}>Transport Loads</Text>
            </Text>
            <Text style={styles.subText}>
              Live requirements from verified corporate shippers awaiting competitive freight bids.
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <Search size={16} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by city, hub or cargo material..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
                All ({requirements.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'GHY' && styles.filterPillActive]}
              onPress={() => setActiveFilter('GHY')}
            >
              <Text style={[styles.filterText, activeFilter === 'GHY' && styles.filterTextActive]}>
                Guwahati Corridor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'CCU' && styles.filterPillActive]}
              onPress={() => setActiveFilter('CCU')}
            >
              <Text style={[styles.filterText, activeFilter === 'CCU' && styles.filterTextActive]}>
                Kolkata Trunk
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'HEAVY' && styles.filterPillActive]}
              onPress={() => setActiveFilter('HEAVY')}
            >
              <Text style={[styles.filterText, activeFilter === 'HEAVY' && styles.filterTextActive]}>
                Heavy (20T+)
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Requirements List */}
          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : filteredRequirements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Matching Requirements Found</Text>
              <Text style={styles.emptySub}>Try clearing filters or search parameters.</Text>
            </View>
          ) : (
            <View style={styles.reqsCol}>
              {filteredRequirements.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={styles.card}
                  onPress={() => onSelectRequirement(req.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.reqIdWrap}>
                      <Text style={styles.reqIdText}>{req.id}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>
                        {req.hasQuoted ? 'Quote Submitted' : 'Open for Quotation'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.routeBox}>
                    <View style={styles.routeDot} />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeHubText}>
                        {req.pickupAddress?.split(',')[0] || 'Guwahati Hub'}
                      </Text>
                      <Text style={styles.subHubText}>Origin Depot</Text>
                    </View>

                    <Text style={styles.routeArrow}>→</Text>

                    <View style={styles.routeDotGreen} />
                    <View style={styles.routeTextWrap}>
                      <Text style={styles.routeHubText}>
                        {req.destinationAddress?.split(',')[0] || 'Kolkata Depot'}
                      </Text>
                      <Text style={styles.subHubText}>Destination Hub</Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Package size={13} color="#F05A22" />
                      <Text style={styles.detailText}>{req.materialType || 'Industrial Goods'}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Truck size={13} color="#F05A22" />
                      <Text style={styles.detailText}>
                        {req.vehicleType || '32 FT MXL'} ({req.requiredCapacityMt} MT)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.clientText}>Shipper: {req.clientName}</Text>
                    <View style={styles.ctaWrap}>
                      <Text style={styles.ctaText}>
                        {req.hasQuoted ? 'Review Bid' : 'Quote Rate'}
                      </Text>
                      <ArrowRight size={14} color="#F05A22" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomGoldWings />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  filterText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  reqsCol: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reqIdWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  reqIdText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  routeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  routeTextWrap: {
    flex: 1,
  },
  routeHubText: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  subHubText: {
    color: '#64748B',
    fontSize: 9,
  },
  routeArrow: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  clientText: {
    color: '#64748B',
    fontSize: 10,
  },
  ctaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
