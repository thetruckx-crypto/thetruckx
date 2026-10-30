import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Truck,
  IndianRupee,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Share2,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorLoadsHubScreenProps {
  vendorId?: string;
  onBackToDashboard: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
  onViewMyQuotations?: () => void;
}

export const VendorLoadsHubScreen: React.FC<VendorLoadsHubScreenProps> = ({
  vendorId,
  onBackToDashboard,
  onSelectNavTab,
  onViewMyQuotations,
}) => {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [filteredReqs, setFilteredReqs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCorridor, setSelectedCorridor] = useState<string>('ALL');

  // Detail & Bidding Modal State
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [transitDays, setTransitDays] = useState<string>('3');
  const [bidRemarks, setBidRemarks] = useState<string>('');
  const [submittingBid, setSubmittingBid] = useState<boolean>(false);
  const [bidSuccessResult, setBidSuccessResult] = useState<any | null>(null);

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getAvailableRequirements(vendorId);
      if (Array.isArray(res)) {
        setRequirements(res);
      } else if (res && (res as any).data) {
        setRequirements((res as any).data);
      } else {
        setRequirements([]);
      }
    } catch (err) {
      console.warn('Failed to load freight loads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  // Filter Logic
  useEffect(() => {
    let list = [...requirements];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.pickupCity || r.pickup_city || '').toLowerCase().includes(q) ||
          (r.deliveryCity || r.delivery_city || '').toLowerCase().includes(q) ||
          (r.cargoType || r.cargo_type || '').toLowerCase().includes(q) ||
          (r.requirementNumber || r.id || '').toLowerCase().includes(q)
      );
    }

    if (selectedCorridor === 'GHY') {
      list = list.filter(
        (r) =>
          (r.pickupCity || '').toLowerCase().includes('guwahati') ||
          (r.deliveryCity || '').toLowerCase().includes('guwahati')
      );
    } else if (selectedCorridor === 'CCU') {
      list = list.filter(
        (r) =>
          (r.pickupCity || '').toLowerCase().includes('kolkata') ||
          (r.deliveryCity || '').toLowerCase().includes('kolkata')
      );
    } else if (selectedCorridor === 'HEAVY') {
      list = list.filter((r) => Number(r.weight || r.cargo_weight || 0) >= 15);
    }

    setFilteredReqs(list);
  }, [requirements, searchQuery, selectedCorridor]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequirements();
  };

  const handleOpenDetail = (req: any) => {
    setSelectedReq(req);
    setBidAmount(req.expectedPrice ? String(req.expectedPrice) : '');
    setTransitDays(req.transitDays ? String(req.transitDays) : '3');
    setBidRemarks('');
    setBidSuccessResult(null);
    setShowDetailModal(true);
  };

  const handleSubmitBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount)) || Number(bidAmount) <= 0) {
      Alert.alert('Invalid Bid', 'Please enter a valid quotation amount in INR.');
      return;
    }

    try {
      setSubmittingBid(true);
      const payload = {
        requirementId: selectedReq.id,
        vendorId: vendorId || 'ven-demo',
        quotedRate: Number(bidAmount),
        transitDays: Number(transitDays) || 3,
        remarks: bidRemarks || 'Committed commercial vehicle ready for dispatch',
      };

      const res = await vendorService.submitQuotation(payload);
      setBidSuccessResult({
        quotationId: res.quotationId || `QT-${Date.now().toString().slice(-6)}`,
        quotedRate: Number(bidAmount),
        transitDays: Number(transitDays) || 3,
      });
      // Refresh list in background
      fetchRequirements();
    } catch (err: any) {
      Alert.alert('Bid Submission Failed', err.message || 'Unable to submit quotation at this time.');
    } finally {
      setSubmittingBid(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBackToDashboard}
          accessibilityLabel="Back to Dashboard"
        >
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerSub}>HUB 4: LOAD SOURCING & BIDDING</Text>
          <Text style={styles.headerTitle}>Available Transport Loads</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh Loads"
        >
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <Search size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by city, hub, or cargo material..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Corridor Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedCorridor === 'ALL' && styles.filterChipActive]}
            onPress={() => setSelectedCorridor('ALL')}
          >
            <Text style={[styles.filterChipText, selectedCorridor === 'ALL' && styles.filterChipTextActive]}>
              All Loads ({requirements.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedCorridor === 'GHY' && styles.filterChipActive]}
            onPress={() => setSelectedCorridor('GHY')}
          >
            <Text style={[styles.filterChipText, selectedCorridor === 'GHY' && styles.filterChipTextActive]}>
              Guwahati Corridor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedCorridor === 'CCU' && styles.filterChipActive]}
            onPress={() => setSelectedCorridor('CCU')}
          >
            <Text style={[styles.filterChipText, selectedCorridor === 'CCU' && styles.filterChipTextActive]}>
              Kolkata Trunk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedCorridor === 'HEAVY' && styles.filterChipActive]}
            onPress={() => setSelectedCorridor('HEAVY')}
          >
            <Text style={[styles.filterChipText, selectedCorridor === 'HEAVY' && styles.filterChipTextActive]}>
              Heavy Cargo (15T+)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Loads List */}
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF5A1F" />
          <Text style={styles.loadingText}>Fetching live available freight loads...</Text>
        </View>
      ) : filteredReqs.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Package size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Matching Requirements Found</Text>
          <Text style={styles.emptySub}>
            Try clearing filters or search parameters. New loads are broadcast regularly by NECL Admin.
          </Text>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setSearchQuery('');
              setSelectedCorridor('ALL');
            }}
          >
            <Text style={styles.clearBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
        >
          {filteredReqs.map((req) => {
            const reqNumber = req.requirementNumber || req.id || 'REQ-NECL';
            const pickup = req.pickupCity || req.pickup_city || 'Origin Hub';
            const delivery = req.deliveryCity || req.delivery_city || 'Destination Hub';
            const cargo = req.cargoType || req.cargo_type || 'General Goods';
            const weight = req.weight || req.cargo_weight || '12 Tons';
            const truckType = req.vehicleType || req.vehicle_type || '32ft Container';

            return (
              <View key={req.id} style={styles.loadCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.reqIdBadge}>
                    <Text style={styles.reqIdText}>{reqNumber}</Text>
                  </View>
                  <View style={styles.biddingTimer}>
                    <Clock size={12} color="#D97706" />
                    <Text style={styles.timerText}>Bid Active</Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.routeRow}>
                  <View style={styles.routeCol}>
                    <Text style={styles.routeLabel}>PICKUP</Text>
                    <Text style={styles.routeCity}>{pickup}</Text>
                  </View>
                  <View style={styles.routeArrowCol}>
                    <Text style={styles.arrowLine}>- - - - →</Text>
                  </View>
                  <View style={styles.routeCol}>
                    <Text style={styles.routeLabel}>DELIVERY</Text>
                    <Text style={styles.routeCity}>{delivery}</Text>
                  </View>
                </View>

                {/* Cargo Details Pills */}
                <View style={styles.specsRow}>
                  <View style={styles.specPill}>
                    <Truck size={12} color="#64748B" />
                    <Text style={styles.specText}>{truckType}</Text>
                  </View>
                  <View style={styles.specPill}>
                    <Package size={12} color="#64748B" />
                    <Text style={styles.specText}>{cargo} • {weight}</Text>
                  </View>
                </View>

                {/* Footer with Action */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.targetLabel}>TARGET FREIGHT</Text>
                    <Text style={styles.targetRate}>
                      {req.expectedPrice ? `₹${Number(req.expectedPrice).toLocaleString('en-IN')}` : 'Market Bidding'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.quoteBtn}
                    onPress={() => handleOpenDetail(req)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quoteBtnText}>Quote Now</Text>
                    <ChevronRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Detail & Quote Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>LOAD SPECIFICATION & BIDDING</Text>
              <Text style={styles.modalTitle}>
                {selectedReq?.requirementNumber || selectedReq?.id || 'Load Details'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowDetailModal(false)}
            >
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {bidSuccessResult ? (
            <View style={styles.successStateWrap}>
              <CheckCircle2 size={56} color="#10B981" />
              <Text style={styles.successTitle}>Quotation Submitted!</Text>
              <Text style={styles.successSub}>
                Your bid of ₹{bidSuccessResult.quotedRate.toLocaleString('en-IN')} has been registered in the NECL reverse auction workbench.
              </Text>
              <View style={styles.quoteReceiptCard}>
                <Text style={styles.receiptLabel}>QUOTATION ID</Text>
                <Text style={styles.receiptValue}>{bidSuccessResult.quotationId}</Text>
                <Text style={styles.receiptLabel}>TRANSIT TIME COMMITMENT</Text>
                <Text style={styles.receiptValue}>{bidSuccessResult.transitDays} Days</Text>
              </View>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setShowDetailModal(false);
                  if (onViewMyQuotations) onViewMyQuotations();
                }}
              >
                <Text style={styles.doneBtnText}>View In My Quotations</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
              {/* Route Summary */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.sectionTitle}>TRANSIT CORRIDOR</Text>
                <View style={styles.routeDetailRow}>
                  <MapPin size={18} color="#FF5A1F" />
                  <View style={styles.routeDetailTextWrap}>
                    <Text style={styles.routeDetailCity}>
                      {selectedReq?.pickupCity || selectedReq?.pickup_city}
                    </Text>
                    <Text style={styles.routeDetailSub}>
                      {selectedReq?.pickupAddress || 'Verified Pickup Warehouse'}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeDetailDivider} />
                <View style={styles.routeDetailRow}>
                  <MapPin size={18} color="#059669" />
                  <View style={styles.routeDetailTextWrap}>
                    <Text style={styles.routeDetailCity}>
                      {selectedReq?.deliveryCity || selectedReq?.delivery_city}
                    </Text>
                    <Text style={styles.routeDetailSub}>
                      {selectedReq?.deliveryAddress || 'Delivery Terminal Hub'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quotation Bid Form */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.sectionTitle}>PLACE YOUR REVERSE AUCTION BID</Text>

                <Text style={styles.fieldLabel}>PROPOSED FREIGHT RATE (INR) *</Text>
                <View style={styles.inputWithIcon}>
                  <IndianRupee size={18} color="#64748B" />
                  <TextInput
                    style={styles.numInput}
                    placeholder="e.g. 45000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={bidAmount}
                    onChangeText={setBidAmount}
                  />
                </View>

                <Text style={styles.fieldLabel}>ESTIMATED TRANSIT TIME (DAYS) *</Text>
                <View style={styles.inputWithIcon}>
                  <Calendar size={18} color="#64748B" />
                  <TextInput
                    style={styles.numInput}
                    placeholder="e.g. 3"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={transitDays}
                    onChangeText={setTransitDays}
                  />
                </View>

                <Text style={styles.fieldLabel}>DISPATCH NOTES / VEHICLE COMMITMENT</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="e.g. 32ft MXL Container available at hub, GPS enabled."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  value={bidRemarks}
                  onChangeText={setBidRemarks}
                />

                <TouchableOpacity
                  style={styles.submitBidBtn}
                  onPress={handleSubmitBid}
                  disabled={submittingBid}
                  activeOpacity={0.8}
                >
                  {submittingBid ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.submitBidBtnText}>Submit Freight Quotation</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Bottom Nav */}
      <VendorBottomNavBar
        activeTab="LOADS"
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
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  filterRow: {
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#FF5A1F',
    borderColor: '#FF5A1F',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
  clearBtn: {
    marginTop: 16,
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollList: {
    padding: 16,
    gap: 14,
  },
  loadCard: {
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
    marginBottom: 12,
  },
  reqIdBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reqIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  biddingTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeCol: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  routeCity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  routeArrowCol: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  arrowLine: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  targetLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  targetRate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
  },
  quoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quoteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  modalSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  routeDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDetailTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  routeDetailCity: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  routeDetailSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  routeDetailDivider: {
    width: 2,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginLeft: 8,
    marginVertical: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
  },
  numInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    marginLeft: 6,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF5A1F',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 18,
  },
  submitBidBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successStateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  successSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  quoteReceiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    marginVertical: 20,
  },
  receiptLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
