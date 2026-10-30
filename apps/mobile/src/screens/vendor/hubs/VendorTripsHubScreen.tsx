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
  Linking,
  Platform,
} from 'react-native';
import {
  Navigation,
  Truck,
  Phone,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ShieldCheck,
  Camera,
  FileCheck,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorTripsHubScreenProps {
  vendorId?: string;
  initialTripId?: string;
  onBackToDashboard: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorTripsHubScreen: React.FC<VendorTripsHubScreenProps> = ({
  vendorId,
  initialTripId,
  onBackToDashboard,
  onSelectNavTab,
}) => {
  const [trips, setTrips] = useState<any[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'POD_PENDING'>('ALL');

  // Trip Control & Document Vault Sheet
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [showTripModal, setShowTripModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'TELEMATICS' | 'DOCS'>('TELEMATICS');
  const [uploadingPod, setUploadingPod] = useState<boolean>(false);

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vendorService.getVendorTrips(vendorId);
      if (Array.isArray(res)) {
        setTrips(res);
      } else if (res && (res as any).data) {
        setTrips((res as any).data);
      } else {
        setTrips([]);
      }
    } catch (err) {
      console.warn('Failed to load trips:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    if (initialTripId && trips.length > 0) {
      const match = trips.find((t) => t.id === initialTripId || t.tripNumber === initialTripId);
      if (match) {
        setSelectedTrip(match);
        setShowTripModal(true);
      }
    }
  }, [initialTripId, trips]);

  useEffect(() => {
    let list = [...trips];
    if (activeFilter === 'IN_TRANSIT') {
      list = list.filter((t) => ['IN_TRANSIT', 'DISPATCHED', 'ACTIVE'].includes((t.status || '').toUpperCase()));
    } else if (activeFilter === 'DELIVERED') {
      list = list.filter((t) => (t.status || '').toUpperCase() === 'DELIVERED');
    } else if (activeFilter === 'POD_PENDING') {
      list = list.filter((t) => !t.podUrl && (t.status || '').toUpperCase() !== 'CANCELLED');
    }
    setFilteredTrips(list);
  }, [trips, activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const handleOpenTrip = (trip: any) => {
    setSelectedTrip(trip);
    setModalTab('TELEMATICS');
    setShowTripModal(true);
  };

  const handleSimulatePodUpload = async () => {
    if (!selectedTrip) return;
    try {
      setUploadingPod(true);
      await vendorService.uploadTripDocument({
        tripId: selectedTrip.id,
        documentType: 'POD_LR',
        fileUrl: 'https://storage.truckx.in/pods/signed_epod_demo.pdf',
        uploadedBy: vendorId || 'ven-demo',
      });
      Alert.alert('POD Uploaded', 'Electronic Proof of Delivery uploaded for Admin verification.');
      fetchTrips();
      setShowTripModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload POD.');
    } finally {
      setUploadingPod(false);
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
          <Text style={styles.headerSub}>HUB 8: IN-TRANSIT & TRIP VAULT</Text>
          <Text style={styles.headerTitle}>Active Operations</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      {/* Status Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
          onPress={() => setActiveFilter('ALL')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'ALL' && styles.filterTabTextActive]}>
            All ({trips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'IN_TRANSIT' && styles.filterTabActive]}
          onPress={() => setActiveFilter('IN_TRANSIT')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'IN_TRANSIT' && styles.filterTabTextActive]}>
            In Transit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'DELIVERED' && styles.filterTabActive]}
          onPress={() => setActiveFilter('DELIVERED')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'DELIVERED' && styles.filterTabTextActive]}>
            Delivered
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'POD_PENDING' && styles.filterTabActive]}
          onPress={() => setActiveFilter('POD_PENDING')}
        >
          <Text style={[styles.filterTabText, activeFilter === 'POD_PENDING' && styles.filterTabTextActive]}>
            POD Pending
          </Text>
        </TouchableOpacity>
      </View>

      {/* Trips List */}
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF5A1F" />
          <Text style={styles.loadingText}>Fetching active fleet missions...</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Navigation size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Trips Found</Text>
          <Text style={styles.emptySub}>
            Allocated vehicle dispatches and ongoing line-haul shipments will appear here for live tracking and POD clearance.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
        >
          {filteredTrips.map((trip) => {
            const tripNo = trip.tripNumber || trip.id || 'TRIP-NECL';
            const pickup = trip.originCity || trip.pickupCity || 'Origin';
            const delivery = trip.destinationCity || trip.deliveryCity || 'Destination';
            const truck = trip.vehicleNumber || trip.vehicleRegistration || 'Truck';
            const driver = trip.driverName || 'Pilot';
            const status = (trip.status || 'IN_TRANSIT').toUpperCase();
            const isInTransit = status === 'IN_TRANSIT' || status === 'DISPATCHED';

            return (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripCard}
                onPress={() => handleOpenTrip(trip)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.tripIdWrap}>
                    <Text style={styles.tripId}>{tripNo}</Text>
                    <Text style={styles.truckText}>{truck} • {driver}</Text>
                  </View>
                  <View style={[styles.statusBadge, isInTransit ? styles.badgeOrange : styles.badgeGreen]}>
                    <Text style={[styles.statusBadgeText, isInTransit ? { color: '#EA580C' } : { color: '#059669' }]}>
                      {isInTransit ? 'LIVE IN TRANSIT' : 'DELIVERED'}
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <Text style={styles.routeText}>{pickup} → {delivery}</Text>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.checkpointWrap}>
                    <MapPin size={12} color="#64748B" />
                    <Text style={styles.checkpointText}>
                      {trip.currentLocation || 'NH-27 Highway Corridor'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Trip Details & POD Modal */}
      <Modal
        visible={showTripModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTripModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>MISSION CONTROL & VAULT</Text>
              <Text style={styles.modalTitle}>
                {selectedTrip?.tripNumber || selectedTrip?.id || 'Trip Details'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTripModal(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Modal Tabs */}
          <View style={styles.modalTabBar}>
            <TouchableOpacity
              style={[styles.modalTabBtn, modalTab === 'TELEMATICS' && styles.modalTabBtnActive]}
              onPress={() => setModalTab('TELEMATICS')}
            >
              <Navigation size={14} color={modalTab === 'TELEMATICS' ? '#FF5A1F' : '#64748B'} />
              <Text style={[styles.modalTabBtnText, modalTab === 'TELEMATICS' && styles.modalTabBtnTextActive]}>
                Tracking & Driver
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalTabBtn, modalTab === 'DOCS' && styles.modalTabBtnActive]}
              onPress={() => setModalTab('DOCS')}
            >
              <FileCheck size={14} color={modalTab === 'DOCS' ? '#FF5A1F' : '#64748B'} />
              <Text style={[styles.modalTabBtnText, modalTab === 'DOCS' && styles.modalTabBtnTextActive]}>
                POD & Documents
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
            {modalTab === 'TELEMATICS' ? (
              <View>
                {/* Telematics Card */}
                <View style={styles.modalCard}>
                  <Text style={styles.cardHeading}>ACTIVE TELEMETRY</Text>
                  <View style={styles.teleRow}>
                    <Text style={styles.teleLabel}>Assigned Truck:</Text>
                    <Text style={styles.teleVal}>
                      {selectedTrip?.vehicleNumber || 'AS01BC9988'}
                    </Text>
                  </View>
                  <View style={styles.teleRow}>
                    <Text style={styles.teleLabel}>Driver Pilot:</Text>
                    <Text style={styles.teleVal}>{selectedTrip?.driverName || 'Driver'}</Text>
                  </View>
                  <View style={styles.teleRow}>
                    <Text style={styles.teleLabel}>Last GPS Ping:</Text>
                    <Text style={styles.teleVal}>{selectedTrip?.currentLocation || 'Jorabat Checkpoint'}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.callDriverBtn}
                    onPress={() => Linking.openURL(`tel:${selectedTrip?.driverPhone || '9876543210'}`)}
                    activeOpacity={0.8}
                  >
                    <Phone size={16} color="#FFFFFF" />
                    <Text style={styles.callDriverBtnText}>Call Driver Pilot</Text>
                  </TouchableOpacity>
                </View>

                {/* Milestone Timeline */}
                <View style={styles.modalCard}>
                  <Text style={styles.cardHeading}>JOURNEY MILESTONES</Text>
                  <View style={styles.milestoneItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <Text style={styles.milestoneText}>Consignment Loaded & Dispatched</Text>
                  </View>
                  <View style={styles.milestoneItem}>
                    <Clock size={16} color="#FF5A1F" />
                    <Text style={styles.milestoneText}>In Transit on Trunk Corridor</Text>
                  </View>
                  <View style={styles.milestoneItem}>
                    <Clock size={16} color="#CBD5E1" />
                    <Text style={styles.milestoneTextPending}>Destination Unloading & Stamped POD</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                {/* Documents Vault */}
                <View style={styles.modalCard}>
                  <Text style={styles.cardHeading}>DIGITAL TRANSIT PAPERS</Text>
                  <View style={styles.docItem}>
                    <FileText size={18} color="#FF5A1F" />
                    <View style={styles.docInfo}>
                      <Text style={styles.docTitle}>Electronic Lorry Receipt (e-LR)</Text>
                      <Text style={styles.docSub}>Generated automatically by NECL</Text>
                    </View>
                    <CheckCircle2 size={16} color="#10B981" />
                  </View>

                  <View style={styles.docItem}>
                    <FileText size={18} color="#FF5A1F" />
                    <View style={styles.docInfo}>
                      <Text style={styles.docTitle}>e-Way Bill Copy</Text>
                      <Text style={styles.docSub}>Verified with GSTN System</Text>
                    </View>
                    <CheckCircle2 size={16} color="#10B981" />
                  </View>
                </View>

                {/* Proof of Delivery Upload Card */}
                <View style={styles.modalCard}>
                  <Text style={styles.cardHeading}>PROOF OF DELIVERY (e-POD)</Text>
                  <Text style={styles.podDesc}>
                    Capture or upload physical stamped consignee delivery challan to trigger payment clearance.
                  </Text>

                  <TouchableOpacity
                    style={styles.uploadPodBtn}
                    onPress={handleSimulatePodUpload}
                    disabled={uploadingPod}
                    activeOpacity={0.8}
                  >
                    {uploadingPod ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Camera size={18} color="#FFFFFF" />
                        <Text style={styles.uploadPodBtnText}>Upload Stamped POD Document</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Nav */}
      <VendorBottomNavBar
        activeTab="TRIPS"
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
  tripCard: {
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
  tripIdWrap: {
    flex: 1,
  },
  tripId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  truckText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOrange: {
    backgroundColor: '#FFF7ED',
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  routeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  checkpointWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkpointText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
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
  modalTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabBtnActive: {
    borderBottomColor: '#FF5A1F',
  },
  modalTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  modalTabBtnTextActive: {
    color: '#FF5A1F',
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
  },
  modalContentScroll: {
    padding: 16,
    gap: 14,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  teleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  teleLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  teleVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 14,
  },
  callDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  milestoneTextPending: {
    fontSize: 13,
    color: '#94A3B8',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  docInfo: {
    flex: 1,
    marginLeft: 10,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  docSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  podDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  uploadPodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF5A1F',
    borderRadius: 8,
    paddingVertical: 12,
  },
  uploadPodBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
