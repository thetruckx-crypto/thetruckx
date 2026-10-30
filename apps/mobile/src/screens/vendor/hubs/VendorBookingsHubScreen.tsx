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
  Alert,
  Platform,
} from 'react-native';
import {
  CheckCircle2,
  Truck,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Calendar,
  IndianRupee,
  ShieldCheck,
  X,
  ArrowRight,
  Package,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorBookingsHubScreenProps {
  vendorId?: string;
  onBackToDashboard: () => void;
  onViewTrip?: (tripId: string) => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorBookingsHubScreen: React.FC<VendorBookingsHubScreenProps> = ({
  vendorId,
  onBackToDashboard,
  onViewTrip,
  onSelectNavTab,
}) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Integrated Fleet Placement Modal State
  const [showPlacementModal, setShowPlacementModal] = useState<boolean>(false);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [placementStep, setPlacementStep] = useState<'VEHICLE' | 'DRIVER' | 'CONFIRM'>('VEHICLE');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [submittingPlacement, setSubmittingPlacement] = useState<boolean>(false);
  const [placementSuccessTripId, setPlacementSuccessTripId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getAwardedBookings(vendorId);
      if (Array.isArray(res)) {
        setBookings(res);
      } else if (res && (res as any).data) {
        setBookings((res as any).data);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.warn('Failed to load awarded bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleStartPlacement = async (booking: any) => {
    setActiveBooking(booking);
    setPlacementStep('VEHICLE');
    setSelectedVehicle(null);
    setSelectedDriver(null);
    setPlacementSuccessTripId(null);
    setShowPlacementModal(true);

    try {
      const [vehRes, drvRes] = await Promise.all([
        vendorService.getVendorVehicles(vendorId || ''),
        vendorService.getVendorDrivers(vendorId || ''),
      ]);
      setVehicles(Array.isArray(vehRes) ? vehRes : (vehRes as any)?.data || []);
      setDrivers(Array.isArray(drvRes) ? drvRes : (drvRes as any)?.data || []);
    } catch (err) {
      console.warn('Failed to load fleet assets for placement:', err);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!selectedVehicle || !selectedDriver) {
      Alert.alert('Incomplete Assignment', 'Please select both a vehicle and a driver.');
      return;
    }

    try {
      setSubmittingPlacement(true);
      const res = await vendorService.assignVehicleAndDriver({
        bookingId: activeBooking.id,
        vendorId: vendorId || 'ven-demo',
        vehicleId: selectedVehicle.id,
        driverId: selectedDriver.id,
      });

      const generatedTripId = res.tripId || `TRIP-${Date.now().toString().slice(-6)}`;
      setPlacementSuccessTripId(generatedTripId);
      fetchBookings();
    } catch (err: any) {
      Alert.alert('Assignment Error', err.message || 'Unable to confirm fleet placement.');
    } finally {
      setSubmittingPlacement(false);
    }
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
          <Text style={styles.headerSub}>HUB 6: BOOKINGS & FLEET PLACEMENT</Text>
          <Text style={styles.headerTitle}>Awarded Bookings</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF5A1F" />
          <Text style={styles.loadingText}>Fetching awarded commercial shipments...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Package size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Awarded Bookings Yet</Text>
          <Text style={styles.emptySub}>
            When your quotation bids are accepted by NECL Admin, awarded shipments will appear here for vehicle and driver allocation.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
        >
          {bookings.map((booking) => {
            const bookingNo = booking.bookingNumber || booking.id || 'BK-NECL';
            const pickup = booking.pickupCity || booking.pickup_city || 'Origin';
            const delivery = booking.deliveryCity || booking.delivery_city || 'Destination';
            const rate = booking.totalFreight || booking.agreedRate || booking.amount || 0;
            const isAssigned = Boolean(booking.vehicleId || booking.tripId);

            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badgeText}>{bookingNo}</Text>
                  </View>
                  <View style={[styles.statusTag, isAssigned ? styles.tagAssigned : styles.tagPending]}>
                    <Text style={[styles.statusTagText, isAssigned ? styles.tagAssignedText : styles.tagPendingText]}>
                      {isAssigned ? 'PLACED & DISPATCHED' : 'ASSIGNMENT PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <Text style={styles.routeText}>{pickup} → {delivery}</Text>

                {/* Details */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Cargo: {booking.cargoType || 'General Cargo'}</Text>
                  <Text style={styles.infoPrice}>₹{Number(rate).toLocaleString('en-IN')}</Text>
                </View>

                {/* Action */}
                <View style={styles.cardActions}>
                  {isAssigned ? (
                    <TouchableOpacity
                      style={styles.viewTripBtn}
                      onPress={() => {
                        if (onViewTrip) onViewTrip(booking.tripId || booking.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Truck size={16} color="#059669" />
                      <Text style={styles.viewTripBtnText}>Track Active Trip</Text>
                      <ChevronRight size={16} color="#059669" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => handleStartPlacement(booking)}
                      activeOpacity={0.8}
                    >
                      <Truck size={16} color="#FFFFFF" />
                      <Text style={styles.assignBtnText}>Assign Vehicle & Driver</Text>
                      <ChevronRight size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Integrated Fleet Placement Modal */}
      <Modal
        visible={showPlacementModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPlacementModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>COMMERCIAL FLEET PLACEMENT</Text>
              <Text style={styles.modalTitle}>
                {placementSuccessTripId
                  ? 'Placement Dispatched'
                  : placementStep === 'VEHICLE'
                  ? 'Step 1: Select Vehicle'
                  : placementStep === 'DRIVER'
                  ? 'Step 2: Select Driver'
                  : 'Step 3: Confirm Dispatch'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPlacementModal(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {placementSuccessTripId ? (
            <View style={styles.successPlacementWrap}>
              <CheckCircle2 size={56} color="#10B981" />
              <Text style={styles.successPlacementTitle}>Placement Complete!</Text>
              <Text style={styles.successPlacementSub}>
                Vehicle {selectedVehicle?.registrationNumber} & Driver {selectedDriver?.name} have been allocated. Trip dispatch record created in NECL Control Tower.
              </Text>
              <View style={styles.tripBadgeBox}>
                <Text style={styles.tripBadgeLabel}>DISPATCHED TRIP ID</Text>
                <Text style={styles.tripBadgeValue}>{placementSuccessTripId}</Text>
              </View>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setShowPlacementModal(false);
                  if (onViewTrip) onViewTrip(placementSuccessTripId);
                }}
              >
                <Text style={styles.doneBtnText}>Go to Trip Tracking</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
              {/* Step 1: Vehicle Selector */}
              {placementStep === 'VEHICLE' && (
                <View>
                  <Text style={styles.selectionPrompt}>Select an active, compliant truck from your fleet:</Text>
                  {vehicles.length === 0 ? (
                    <View style={styles.emptyAssetBox}>
                      <Truck size={32} color="#94A3B8" />
                      <Text style={styles.emptyAssetText}>No vehicles registered in fleet.</Text>
                      <Text style={styles.emptyAssetSub}>Add trucks in Hub 7 (Fleet Management).</Text>
                    </View>
                  ) : (
                    vehicles.map((v) => {
                      const isSel = selectedVehicle?.id === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.assetItem, isSel && styles.assetItemActive]}
                          onPress={() => setSelectedVehicle(v)}
                        >
                          <Truck size={20} color={isSel ? '#FF5A1F' : '#64748B'} />
                          <View style={styles.assetInfo}>
                            <Text style={styles.assetTitle}>{v.registrationNumber || v.rcNumber || 'Truck'}</Text>
                            <Text style={styles.assetSub}>{v.vehicleType || '32ft Container'} • RC Verified</Text>
                          </View>
                          {isSel && <CheckCircle2 size={20} color="#FF5A1F" />}
                        </TouchableOpacity>
                      );
                    })
                  )}

                  <TouchableOpacity
                    style={[styles.nextBtn, !selectedVehicle && styles.btnDisabled]}
                    disabled={!selectedVehicle}
                    onPress={() => setPlacementStep('DRIVER')}
                  >
                    <Text style={styles.nextBtnText}>Continue to Driver Selection</Text>
                    <ChevronRight size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Driver Selector */}
              {placementStep === 'DRIVER' && (
                <View>
                  <Text style={styles.selectionPrompt}>Select a verified driver pilot:</Text>
                  {drivers.length === 0 ? (
                    <View style={styles.emptyAssetBox}>
                      <User size={32} color="#94A3B8" />
                      <Text style={styles.emptyAssetText}>No drivers enrolled in roster.</Text>
                      <Text style={styles.emptyAssetSub}>Add drivers in Hub 7 (Driver Roster).</Text>
                    </View>
                  ) : (
                    drivers.map((d) => {
                      const isSel = selectedDriver?.id === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.assetItem, isSel && styles.assetItemActive]}
                          onPress={() => setSelectedDriver(d)}
                        >
                          <User size={20} color={isSel ? '#FF5A1F' : '#64748B'} />
                          <View style={styles.assetInfo}>
                            <Text style={styles.assetTitle}>{d.name || 'Commercial Driver'}</Text>
                            <Text style={styles.assetSub}>DL: {d.licenseNumber || 'Verified'} • {d.phone || d.mobile}</Text>
                          </View>
                          {isSel && <CheckCircle2 size={20} color="#FF5A1F" />}
                        </TouchableOpacity>
                      );
                    })
                  )}

                  <View style={styles.stepBtnRow}>
                    <TouchableOpacity
                      style={styles.backStepBtn}
                      onPress={() => setPlacementStep('VEHICLE')}
                    >
                      <Text style={styles.backStepBtnText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.nextBtn, !selectedDriver && styles.btnDisabled, { flex: 1 }]}
                      disabled={!selectedDriver}
                      onPress={() => setPlacementStep('CONFIRM')}
                    >
                      <Text style={styles.nextBtnText}>Review Placement</Text>
                      <ChevronRight size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: Review & Confirm */}
              {placementStep === 'CONFIRM' && (
                <View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>ALLOCATION SUMMARY</Text>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Vehicle:</Text>
                      <Text style={styles.summaryVal}>
                        {selectedVehicle?.registrationNumber} ({selectedVehicle?.vehicleType})
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Driver:</Text>
                      <Text style={styles.summaryVal}>
                        {selectedDriver?.name} ({selectedDriver?.phone || selectedDriver?.mobile})
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Booking Reference:</Text>
                      <Text style={styles.summaryVal}>{activeBooking?.bookingNumber || activeBooking?.id}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmDispatchBtn}
                    onPress={handleConfirmAssignment}
                    disabled={submittingPlacement}
                    activeOpacity={0.8}
                  >
                    {submittingPlacement ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <ShieldCheck size={18} color="#FFFFFF" />
                        <Text style={styles.confirmDispatchBtnText}>Confirm Fleet Placement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Bottom Nav */}
      <VendorBottomNavBar
        activeTab="FLEET"
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
    gap: 14,
  },
  bookingCard: {
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
  badgeWrap: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tagPending: {
    backgroundColor: '#FFFBEB',
  },
  tagPendingText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
  },
  tagAssigned: {
    backgroundColor: '#ECFDF5',
  },
  tagAssignedText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  routeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
  },
  infoPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  cardActions: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF5A1F',
    borderRadius: 8,
    paddingVertical: 10,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  viewTripBtnText: {
    color: '#059669',
    fontSize: 13,
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
    gap: 12,
  },
  selectionPrompt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  assetItemActive: {
    borderColor: '#FF5A1F',
    backgroundColor: '#FFF7ED',
  },
  assetInfo: {
    marginLeft: 12,
    flex: 1,
  },
  assetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  assetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF5A1F',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  backStepBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backStepBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  summaryRow: {
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  confirmDispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 16,
  },
  confirmDispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyAssetBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginVertical: 10,
  },
  emptyAssetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptyAssetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  successPlacementWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successPlacementTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  successPlacementSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  tripBadgeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    marginVertical: 20,
    alignItems: 'center',
  },
  tripBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  tripBadgeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
    marginTop: 4,
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
