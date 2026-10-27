import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Package,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorQuotationsListScreenProps {
  vendorId: string;
  onBack: () => void;
  onSelectQuotation: (quotation: any) => void;
}

export const VendorQuotationsListScreen: React.FC<VendorQuotationsListScreenProps> = ({
  vendorId,
  onBack,
  onSelectQuotation,
}) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'AWARDED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadQuotes = useCallback(async () => {
    try {
      const data = await vendorService.getMyQuotations(vendorId);
      setQuotations(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const onRefresh = () => {
    setRefreshing(true);
    loadQuotes();
  };

  const filteredQuotes = quotations.filter((q) => {
    if (activeFilter === 'AWARDED') return q.status === 'AWARDED';
    if (activeFilter === 'PENDING') return q.status === 'QUOTED' || q.status === 'PENDING';
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
              My Freight <Text style={styles.goldText}>Quotations</Text>
            </Text>
            <Text style={styles.subText}>
              Track submitted rates, client evaluation status, and booking conversion.
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
                All ({quotations.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'PENDING' && styles.filterPillActive]}
              onPress={() => setActiveFilter('PENDING')}
            >
              <Text style={[styles.filterText, activeFilter === 'PENDING' && styles.filterTextActive]}>
                Under Review
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'AWARDED' && styles.filterPillActive]}
              onPress={() => setActiveFilter('AWARDED')}
            >
              <Text style={[styles.filterText, activeFilter === 'AWARDED' && styles.filterTextActive]}>
                Awarded / Won
              </Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : filteredQuotes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Quotations Found</Text>
              <Text style={styles.emptySub}>
                Browse open freight requirements and submit quotes to start winning loads.
              </Text>
            </View>
          ) : (
            <View style={styles.quotesCol}>
              {filteredQuotes.map((q) => {
                const isAwarded = q.status === 'AWARDED';
                const isPending = q.status === 'QUOTED' || q.status === 'PENDING';

                return (
                  <TouchableOpacity
                    key={q.id}
                    style={styles.quoteCard}
                    onPress={() => onSelectQuotation(q)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.idWrap}>
                        <Text style={styles.idText}>{q.id}</Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isAwarded && styles.badgeAwarded,
                          isPending && styles.badgePending,
                        ]}
                      >
                        {isAwarded && <CheckCircle2 size={12} color="#10B981" />}
                        {isPending && <Clock size={12} color="#F59E0B" />}
                        <Text
                          style={[
                            styles.statusText,
                            isAwarded && styles.textAwarded,
                            isPending && styles.textPending,
                          ]}
                        >
                          {isAwarded ? 'LOAD AWARDED' : 'UNDER REVIEW'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.routeText}>{q.route}</Text>
                    <Text style={styles.materialText}>
                      {q.material} • {q.capacityMt} MT ({q.vehicleType})
                    </Text>

                    <View style={styles.cardBottom}>
                      <View>
                        <Text style={styles.rateLabel}>QUOTED CARRIER RATE</Text>
                        <Text style={styles.rateValue}>₹{q.quotedRate?.toLocaleString('en-IN')}</Text>
                      </View>

                      <View style={styles.viewDetailsBtn}>
                        <Text style={styles.viewDetailsText}>View Details</Text>
                        <ArrowRight size={13} color="#F05A22" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
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
  quotesCol: {
    gap: 12,
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  idWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  idText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAwarded: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textAwarded: {
    color: '#10B981',
  },
  textPending: {
    color: '#F59E0B',
  },
  routeText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  materialText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rateLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  rateValue: {
    color: '#F05A22',
    fontSize: 16,
    fontWeight: '800',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
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
