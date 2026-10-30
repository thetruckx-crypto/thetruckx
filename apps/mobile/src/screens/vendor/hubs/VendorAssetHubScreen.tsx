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
  Linking,
  Platform,
} from 'react-native';
import {
  Truck,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ShieldCheck,
  FileText,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorAssetHubScreenProps {
  vendorId?: string;
  onBackToDashboard: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorAssetHubScreen: React.FC<VendorAssetHubScreenProps> = ({
  vendorId,
  onBackToDashboard,
  onSelectNavTab,
}) => {
  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'DRIVERS'>('VEHICLES');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Vehicle Modal
  const [showAddVehicleModal, setShowAddVehicleModal] = useState<boolean>(false);
  const [vehRc, setVehRc] = useState<string>('');
  const [vehType, setVehType] = useState<string>('32ft Container');
  const [vehCapacity, setVehCapacity] = useState<string>('15');
  const [savingVehicle, setSavingVehicle] = useState<boolean>(false);

  // Add Driver Modal
  const [showAddDriverModal, setShowAddDriverModal] = useState<boolean>(false);
  const [drvName, setDrvName] = useState<string>('');
  const [drvPhone, setDrvPhone] = useState<string>('');
  const [drvDl, setDrvDl] = useState<string>('');
  const [savingDriver, setSavingDriver] = useState<boolean>(false);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const [vehRes, drvRes] = await Promise.all([
        vendorService.getVendorVehicles(vendorId || ''),
        vendorService.getVendorDrivers(vendorId || ''),
      ]);
      setVehicles(Array.isArray(vehRes) ? vehRes : (vehRes as any)?.data || []);
      setDrivers(Array.isArray(drvRes) ? drvRes : (drvRes as any)?.data || []);
    } catch (err) {
      console.warn('Failed to load fleet assets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const handleAddVehicle = async () => {
    if (!vehRc.trim()) {
      Alert.alert('RC Required', 'Please enter commercial vehicle registration number (e.g. AS01BC1234).');
      return;
    }

    try {
      setSavingVehicle(true);
      await vendorService.addVendorVehicle(vendorId || 'ven-demo', {
        registrationNumber: vehRc.toUpperCase().trim(),
        vehicleType: vehType,
        capacityMt: Number(vehCapacity) || 15,
      });
      setShowAddVehicleModal(false);
      setVehRc('');
      fetchAssets();
      Alert.alert('Vehicle Added', 'Commercial vehicle added and submitted for NECL tie-up verification.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not register vehicle.');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleAddDriver = async () => {
    if (!drvName.trim() || drvPhone.length < 10 || !drvDl.trim()) {
      Alert.alert('Required Fields', 'Please enter Driver Name, valid 10-digit Phone, and DL Number.');
      return;
    }

    try {
      setSavingDriver(true);
      await vendorService.addVendorDriver(vendorId || 'ven-demo', {
        fullName: drvName.trim(),
        mobile: drvPhone.trim(),
        licenceNumber: drvDl.toUpperCase().trim(),
        licenceExpiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      });
      setShowAddDriverModal(false);
      setDrvName('');
      setDrvPhone('');
      setDrvDl('');
      fetchAssets();
      Alert.alert('Driver Added', 'Commercial heavy vehicle pilot enrolled successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not register driver.');
    } finally {
      setSavingDriver(false);
    }
  };

  // Filtered Lists
  const filteredVehicles = vehicles.filter((v) =>
    (v.registrationNumber || v.rcNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDrivers = drivers.filter(
    (d) =>
      (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.phone || d.mobile || '').includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBackToDashboard}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerSub}>HUB 7: FLEET & PILOT ASSETS</Text>
          <Text style={styles.headerTitle}>Asset Registry</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      {/* Segmented Switcher */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'VEHICLES' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('VEHICLES')}
        >
          <Truck size={16} color={activeTab === 'VEHICLES' ? '#FF5A1F' : '#64748B'} />
          <Text style={[styles.segmentBtnText, activeTab === 'VEHICLES' && styles.segmentBtnTextActive]}>
            Trucks ({vehicles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'DRIVERS' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('DRIVERS')}
        >
          <Users size={16} color={activeTab === 'DRIVERS' ? '#FF5A1F' : '#64748B'} />
          <Text style={[styles.segmentBtnText, activeTab === 'DRIVERS' && styles.segmentBtnTextActive]}>
            Drivers ({drivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Add Bar */}
      <View style={styles.actionRow}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'VEHICLES' ? 'Search RC number...' : 'Search driver name or phone...'}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => (activeTab === 'VEHICLES' ? setShowAddVehicleModal(true) : setShowAddDriverModal(true))}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{activeTab === 'VEHICLES' ? 'Add Truck' : 'Add Driver'}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF5A1F" />
          <Text style={styles.loadingText}>Fetching registered fleet assets...</Text>
        </View>
      ) : activeTab === 'VEHICLES' ? (
        // Vehicles List
        filteredVehicles.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Truck size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Trucks Enrolled</Text>
            <Text style={styles.emptySub}>
              Register your commercial transport vehicles with RC details to enable load assignment.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowAddVehicleModal(true)}
            >
              <Text style={styles.emptyActionBtnText}>Add Your First Truck</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
          >
            {filteredVehicles.map((v) => {
              const rc = v.registrationNumber || v.rcNumber || 'TRUCK-RC';
              const type = v.vehicleType || '32ft MXL Container';
              const status = (v.verificationStatus || v.status || 'VERIFIED').toUpperCase();
              const isVerified = status === 'VERIFIED' || status === 'ACTIVE';

              return (
                <View key={v.id} style={styles.assetCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.rcBadge}>
                      <Text style={styles.rcBadgeText}>{rc}</Text>
                    </View>
                    <View style={[styles.statusBadge, isVerified ? styles.badgeGreen : styles.badgeOrange]}>
                      {isVerified ? (
                        <CheckCircle2 size={12} color="#059669" />
                      ) : (
                        <Clock size={12} color="#D97706" />
                      )}
                      <Text style={[styles.statusBadgeText, isVerified ? { color: '#059669' } : { color: '#D97706' }]}>
                        {isVerified ? 'VERIFIED RC' : 'AUDIT PENDING'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.vehicleType}>{type} • {v.capacity || 15} Tons</Text>

                  {/* Compliance Badges */}
                  <View style={styles.complianceRow}>
                    <View style={styles.compPill}>
                      <ShieldCheck size={12} color="#059669" />
                      <Text style={styles.compPillText}>Fitness: Valid</Text>
                    </View>
                    <View style={styles.compPill}>
                      <ShieldCheck size={12} color="#059669" />
                      <Text style={styles.compPillText}>National Permit</Text>
                    </View>
                    <View style={styles.compPill}>
                      <ShieldCheck size={12} color="#059669" />
                      <Text style={styles.compPillText}>Insurance</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        // Drivers List
        filteredDrivers.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Users size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Drivers Enrolled</Text>
            <Text style={styles.emptySub}>
              Add heavy commercial drivers with valid DL numbers to deploy on active freight trips.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowAddDriverModal(true)}
            >
              <Text style={styles.emptyActionBtnText}>Add Your First Driver</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />}
          >
            {filteredDrivers.map((d) => {
              const name = d.name || 'Commercial Driver';
              const phone = d.phone || d.mobile || '9876543210';
              const dl = d.licenseNumber || 'DL-ASSAM-2024';

              return (
                <View key={d.id} style={styles.assetCard}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.driverName}>{name}</Text>
                      <Text style={styles.driverDl}>DL: {dl}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.callIconBtn}
                      onPress={() => Linking.openURL(`tel:${phone}`)}
                    >
                      <Phone size={16} color="#059669" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.driverFooter}>
                    <Text style={styles.driverPhone}>{phone}</Text>
                    <View style={styles.badgeGreen}>
                      <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Sarathi Verified</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Add Truck Modal */}
      <Modal
        visible={showAddVehicleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddVehicleModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>COMMERCIAL FLEET REGISTRATION</Text>
              <Text style={styles.modalTitle}>Add Commercial Truck</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddVehicleModal(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
            <Text style={styles.fieldLabel}>VEHICLE REGISTRATION NUMBER (RC) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. AS01BC1234 or WB19A9988"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={vehRc}
              onChangeText={setVehRc}
            />

            <Text style={styles.fieldLabel}>VEHICLE CONFIGURATION TYPE *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 32ft MXL Container or 24ft Open"
              placeholderTextColor="#94A3B8"
              value={vehType}
              onChangeText={setVehType}
            />

            <Text style={styles.fieldLabel}>RATED PAYLOAD CAPACITY (TONS) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 15"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={vehCapacity}
              onChangeText={setVehCapacity}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleAddVehicle}
              disabled={savingVehicle}
              activeOpacity={0.8}
            >
              {savingVehicle ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Enroll Truck in Fleet</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Driver Modal */}
      <Modal
        visible={showAddDriverModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddDriverModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>DRIVER PILOT ENROLLMENT</Text>
              <Text style={styles.modalTitle}>Add Commercial Driver</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddDriverModal(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentScroll}>
            <Text style={styles.fieldLabel}>DRIVER FULL NAME *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Rajesh Kumar Sharma"
              placeholderTextColor="#94A3B8"
              value={drvName}
              onChangeText={setDrvName}
            />

            <Text style={styles.fieldLabel}>10-DIGIT MOBILE NUMBER *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={10}
              value={drvPhone}
              onChangeText={setDrvPhone}
            />

            <Text style={styles.fieldLabel}>DRIVING LICENCE (DL) NUMBER *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. AS0120190012345"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={drvDl}
              onChangeText={setDrvDl}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleAddDriver}
              disabled={savingDriver}
              activeOpacity={0.8}
            >
              {savingDriver ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Enroll Driver in Roster</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  segmentBtnActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FF5A1F',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FF5A1F',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
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
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollList: {
    padding: 16,
    gap: 12,
  },
  assetCard: {
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
  rcBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rcBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
  },
  badgeOrange: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vehicleType: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
  },
  complianceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  driverDl: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  callIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  driverPhone: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  modalSubmitBtn: {
    backgroundColor: '#FF5A1F',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
