import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  IndianRupee,
  Calendar,
  Truck,
  ArrowRight,
  X,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorQuotationsHubScreenProps {
  vendorId?: string;
  onBackToDashboard: () => void;
  onNavigateToBookingPlacement?: (booking: any) => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorQuotationsHubScreen: React.FC<VendorQuotationsHubScreenProps> = ({
  vendorId,
  onBackToDashboard,
  onNavigateToBookingPlacement,
  onSelectNavTab,
}) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');

  // Detail Modal
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getMyQuotations(vendorId || '');
      if (Array.isArray(res)) {
        setQuotations(res);
      } else if (res && (res as any).data) {
        setQuotations((res as any).data);
      } else {
        setQuotations([]);
      }
    } catch (err) {
      console.warn('Failed to load vendor quotations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  useEffect(() => {
    let list = [...quotations];
    if (activeFilter === 'PENDING') {
      list = list.filter((q) => (q.status || 'PENDING').toUpperCase() === 'PENDING');
    } else if (activeFilter === 'ACCEPTED') {
      list = list.filter((q) => (q.status || '').toUpperCase() === 'ACCEPTED');
    } else if (activeFilter === 'REJECTED') {
      list = list.filter((q) => ['REJECTED', 'EXPIRED'].includes((q.status || '').toUpperCase()));
    }
    setFilteredQuotes(list);
  }, [quotations, activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuotations();
  };

  const handleOpenDetail = (quote: any) => {
    setSelectedQuote(quote);
    setShowDetailModal(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBackToDashboard}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerSub}>HUB 5: BID LEDGER & WORKBENCH</Text>
          <Text style={styles.headerTitle}>My Freight Quotations</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
          onPress={() => setActiveFilter('ALL')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'ALL' && styles.filterTabTextActive]}>
            All ({quotations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'PENDING' && styles.filterTabActive]}
          onPress={() => setActiveFilter('PENDING')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'PENDING' && styles.filterTabTextActive]}>
            Active Bids
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'ACCEPTED' && styles.filterTabActive]}
          onPress={() => setActiveFilter('ACCEPTED')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'ACCEPTED' && styles.filterTabTextActive]}>
            Won / Awarded
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'REJECTED' && styles.filterTabActive]}
          onPress={() => setActiveFilter('REJECTED')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'REJECTED' && styles.filterTabTextActive]}>
            Outbid
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF5A1F" />
          <Text style={styles.loadingText}>Fetching commercial bid history...</Text>
        </View>
      ) : filteredQuotes.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <FileText size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Quotations Found</Text>
          <Text style={styles.emptySub}>
            You haven't placed any bids matching this filter. Browse open loads to submit competitive offers.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
        >
          {filteredQuotes.map((q) => {
            const status = (q.status || 'PENDING').toUpperCase();
            const isAccepted = status === 'ACCEPTED';
            const isPending = status === 'PENDING';
            const isRejected = status === 'REJECTED' || status === 'EXPIRED';

            return (
              <TouchableOpacity
                key={q.id}
                style={styles.quoteCard}
                onPress={() => handleOpenDetail(q)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.quoteIdWrap}>
                    <Text style={styles.quoteId}>{q.quotationNumber || q.id || 'QT-NECL'}</Text>
                    <Text style={styles.reqRef}>For: {q.requirementNumber || q.requirementId || 'RFQ'}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isAccepted && styles.badgeAccepted,
                      isPending && styles.badgePending,
                      isRejected && styles.badgeRejected,
                    ]}
                  >
                    {isAccepted ? (
                      <CheckCircle2 size={12} color="#059669" />
                    ) : isRejected ? (
                      <XCircle size={12} color="#DC2626" />
                    ) : (
                      <Clock size={12} color="#D97706" />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isAccepted && { color: '#059669' },
                        isPending && { color: '#D97706' },
                        isRejected && { color: '#DC2626' },
                      ]}
                    >
                      {isAccepted ? 'AWARDED' : isRejected ? 'OUTBID' : 'IN REVIEW'}
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <Text style={styles.routeText}>
                  {q.pickupCity || 'Origin'} → {q.deliveryCity || 'Destination'}
                </Text>

                {/* Rate & Transit */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.footerLabel}>YOUR QUOTED RATE</Text>
                    <Text style={styles.footerRate}>₹{Number(q.quotedRate || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.transitBadge}>
                    <Calendar size={12} color="#64748B" />
                    <Text style={styles.transitText}>{q.transitDays || 3} Days Transit</Text>
                  </View>
                </View>

                {isAccepted && (
                  <View style={styles.awardBanner}>
                    <Text style={styles.awardBannerText}>🎉 Booking won! Tap to assign vehicle & driver</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Quote Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>COMMERCIAL BID DETAILS</Text>
              <Text style={styles.modalTitle}>
                {selectedQuote?.quotationNumber || selectedQuote?.id || 'Quotation'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetailModal(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
            {/* Status Card */}
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>STATUS & EVALUATION</Text>
              <Text style={styles.detailStatusText}>
                {selectedQuote?.status === 'ACCEPTED'
                  ? 'This quotation was chosen by NECL Admin for execution.'
                  : selectedQuote?.status === 'REJECTED'
                  ? 'A different transporter was selected based on rate or faster SLA.'
                  : 'Your quotation is currently ranked among live competing bids.'}
              </Text>
            </View>

            {/* Financials */}
            <View style={styles.detailSectionCard}>
              <Text style={styles.detailSectionTitle}>FINANCIAL OFFER</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quoted Freight Rate</Text>
                <Text style={styles.detailValue}>
                  ₹{Number(selectedQuote?.quotedRate || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated Transit Time</Text>
                <Text style={styles.detailValue}>{selectedQuote?.transitDays || 3} Days</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Submission Date</Text>
                <Text style={styles.detailValue}>
                  {selectedQuote?.createdAt
                    ? new Date(selectedQuote.createdAt).toLocaleDateString()
                    : 'Recent'}
                </Text>
              </View>
            </View>

            {/* If Accepted: Assign Fleet CTA */}
            {selectedQuote?.status === 'ACCEPTED' && (
              <TouchableOpacity
                style={styles.assignFleetBtn}
                onPress={() => {
                  setShowDetailModal(false);
                  if (onNavigateToBookingPlacement) {
                    onNavigateToBookingPlacement(selectedQuote);
                  }
                }}
                activeOpacity={0.8}
              >
                <Truck size={18} color="#FFFFFF" />
                <Text style={styles.assignFleetBtnText}>Assign Vehicle & Driver Now</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Nav */}
      <VendorBottomNavBar
        activeTab="MORE"
        onSelectTab={(tab) => {
          if (onSelectNavTab) onSelectNavTab(tab);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5A1F',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#FF5A1F',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollList: {
    padding: 16,
    gap: 12,
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteIdWrap: {
    flex: 1,
  },
  quoteId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reqRef: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAccepted: {
    backgroundColor: '#ECFDF5',
  },
  badgePending: {
    backgroundColor: '#FFFBEB',
  },
  badgeRejected: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginVertical: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 6,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  footerRate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  transitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  transitText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  awardBanner: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  awardBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5A1F',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentScroll: {
    padding: 16,
    gap: 16,
  },
  detailSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailStatusText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  assignFleetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
  },
  assignFleetBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
