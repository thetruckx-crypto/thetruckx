import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Star,
  Clock,
  Truck,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';

interface QuotationComparisonScreenProps {
  requirementId: string;
  quotations: any[];
  onBack: () => void;
  onSelectAndBook: (quotation: any) => void;
  onViewQuoteDetails: (quotation: any) => void;
}

export const QuotationComparisonScreen: React.FC<QuotationComparisonScreenProps> = ({
  requirementId,
  quotations,
  onBack,
  onSelectAndBook,
  onViewQuoteDetails,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Sanitize carrier names to TRUCKS client-facing service tiers (no raw competitor/vendor leaks)
  const sanitizeTierName = (q: any, idx: number) => {
    if (q.tierName || q.serviceTier) return q.tierName || q.serviceTier;
    if (idx === 0) return 'TRUCKS Standard Express';
    if (idx === 1) return 'TRUCKS Priority Cargo';
    if (idx === 2) return 'TRUCKS Dedicated Fleet';
    return `TRUCKS Service Option ${idx + 1}`;
  };

  const rawQuotes = Array.isArray(quotations) ? quotations : [];
  const quoteList = rawQuotes.map((q, idx) => ({
    ...q,
    displayName: sanitizeTierName(q, idx),
  }));

  const hasQuotes = quoteList.length > 0;
  const maxRate = hasQuotes ? Math.max(...quoteList.map((q) => q.rate || 0)) : 0;
  const minRate = hasQuotes ? Math.min(...quoteList.map((q) => q.rate || 0)) : 0;
  const minTransit = hasQuotes ? Math.min(...quoteList.map((q) => q.transitTimeDays || 3)) : 0;

  const activeQuote = hasQuotes && selectedIdx < quoteList.length ? quoteList[selectedIdx] : null;
  const activeRate = activeQuote?.rate || 0;
  const savings = maxRate > activeRate ? maxRate - activeRate : 0;
  const savingsPercent = maxRate > 0 && savings > 0 ? Math.round((savings / maxRate) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        <View style={{ width: 40 }} />
      </View>

      {/* Screen Title */}
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Quotation Comparison</Text>
        <Text style={styles.headerSub}>
          Compare competitive offers for {requirementId}
        </Text>
      </View>

      {!hasQuotes ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Clock size={34} color="#F05A22" />
          </View>
          <Text style={styles.emptyTitle}>Quotations Under Review</Text>
          <Text style={styles.emptyDescription}>
            TRUCKS operations team and verified network carriers are actively calculating optimal route rates for requirement {requirementId}.
            Quotations usually appear within 15–30 minutes. You will receive an instant notification once quotes are ready.
          </Text>
          <TouchableOpacity style={styles.emptyActionBtn} onPress={onBack} activeOpacity={0.88}>
            <Text style={styles.emptyActionBtnText}>Back to Shipments</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Summary Highlights */}
          <View style={styles.highlightBanner}>
            <View style={styles.highlightItem}>
              <Zap size={15} color="#10B981" />
              <Text style={styles.highlightText}>
                Lowest Freight: <Text style={{ fontWeight: '800' }}>₹{minRate.toLocaleString('en-IN')}</Text>
              </Text>
            </View>
            <View style={styles.highlightDivider} />
            <View style={styles.highlightItem}>
              <Clock size={15} color="#F05A22" />
              <Text style={styles.highlightText}>
                Fastest Delivery: <Text style={{ fontWeight: '800' }}>{minTransit} Days</Text>
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Horizontal Carrier Switcher */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
              {quoteList.map((q, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <TouchableOpacity
                    key={q.id || idx}
                    style={[styles.vendorTab, isSelected && styles.vendorTabActive]}
                    onPress={() => setSelectedIdx(idx)}
                  >
                    {q.rate === minRate && (
                      <View style={styles.badgeBestRate}>
                        <Text style={styles.badgeBestRateText}>Best Rate</Text>
                      </View>
                    )}
                    {q.transitTimeDays === minTransit && q.rate !== minRate && (
                      <View style={styles.badgeFastest}>
                        <Text style={styles.badgeFastestText}>Fastest</Text>
                      </View>
                    )}
                    <Text style={[styles.vendorTabText, isSelected && styles.vendorTabTextActive]}>
                      {q.displayName}
                    </Text>
                    <Text style={[styles.vendorTabRate, isSelected && styles.vendorTabRateActive]}>
                      ₹{(q.rate || 0).toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active Quotation Detailed Comparison Card */}
            {activeQuote && (
              <View style={styles.comparisonCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.activeVendorName}>{activeQuote.displayName}</Text>
                    <View style={styles.starsRow}>
                      <Star size={13} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.starText}>{activeQuote.rating || '4.9'}</Text>
                      <Text style={styles.tripsCount}>
                        ({activeQuote.completedTrips || 150}+ verified trips)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pricePill}>
                    <Text style={styles.priceVal}>
                      ₹{(activeQuote.rate || 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.priceLabel}>All Taxes & Tolls Inc.</Text>
                  </View>
                </View>

                {/* Savings Delta Banner */}
                {savings > 0 && (
                  <View style={styles.savingsBanner}>
                    <ShieldCheck size={16} color="#047857" />
                    <Text style={styles.savingsText}>
                      Competitive Advantage: Save ₹{savings.toLocaleString('en-IN')} ({savingsPercent}% below highest quote)
                    </Text>
                  </View>
                )}

                {/* Matrix comparison table */}
                <View style={styles.matrixTable}>
                  <View style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>Transit Duration</Text>
                    <Text style={styles.matrixValue}>
                      {activeQuote.transitTimeDays || 3} Days
                      {activeQuote.transitTimeDays === minTransit ? ' (Fastest ⚡)' : ''}
                    </Text>
                  </View>

                  <View style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>Vehicle Specification</Text>
                    <Text style={styles.matrixValue}>
                      {activeQuote.vehicleType || '32 FT Multi-Axle'}
                    </Text>
                  </View>

                  <View style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>Toll & Fuel Surcharge</Text>
                    <View style={styles.checkVal}>
                      <CheckCircle2 size={15} color="#10B981" />
                      <Text style={styles.matrixValue}>100% Included</Text>
                    </View>
                  </View>

                  <View style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>Live GPS Integration</Text>
                    <View style={styles.checkVal}>
                      <CheckCircle2 size={15} color="#10B981" />
                      <Text style={styles.matrixValue}>Continuous Telematics</Text>
                    </View>
                  </View>

                  <View style={styles.matrixRow}>
                    <Text style={styles.matrixLabel}>Driver Police Verification</Text>
                    <View style={styles.checkVal}>
                      <CheckCircle2 size={15} color="#10B981" />
                      <Text style={styles.matrixValue}>Aadhaar & DL Verified</Text>
                    </View>
                  </View>

                  <View style={[styles.matrixRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.matrixLabel}>Transit Insurance</Text>
                    <View style={styles.checkVal}>
                      <CheckCircle2 size={15} color="#10B981" />
                      <Text style={styles.matrixValue}>₹50 Lakh Coverage</Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={() => onSelectAndBook(activeQuote)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.bookNowBtnText}>Select & Confirm Booking</Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.breakdownBtn}
                  onPress={() => onViewQuoteDetails(activeQuote)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.breakdownBtnText}>View Detailed Cost Breakdown</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </>
      )}
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0A1931',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  highlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightText: {
    fontSize: 12,
    color: '#334155',
  },
  highlightDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabScroll: {
    marginBottom: 16,
  },
  vendorTab: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  vendorTabActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F05A22',
  },
  vendorTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  vendorTabTextActive: {
    color: '#C2410C',
  },
  vendorTabRate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1931',
    marginTop: 4,
  },
  vendorTabRateActive: {
    color: '#F05A22',
  },
  comparisonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0A1931',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activeVendorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1931',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  starText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1931',
  },
  tripsCount: {
    fontSize: 11,
    color: '#64748B',
  },
  pricePill: {
    alignItems: 'flex-end',
  },
  priceVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F05A22',
  },
  priceLabel: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  matrixTable: {
    marginBottom: 18,
  },
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  matrixLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  matrixValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A1931',
  },
  checkVal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeBestRate: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeBestRateText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeFastest: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeFastestText: {
    color: '#C2410C',
    fontSize: 9,
    fontWeight: '800',
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  savingsText: {
    color: '#065F46',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  bookNowBtn: {
    height: 54,
    backgroundColor: '#F05A22',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  bookNowBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  breakdownBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1931',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyActionBtn: {
    backgroundColor: '#F05A22',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
