import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  Users,
  Plus,
  Phone,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Search,
  UserCheck,
  ShieldAlert,
  AlertCircle,
  Truck,
  IdCard,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorDriverManagementScreenProps {
  vendorId: string;
  onBack: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

export const VendorDriverManagementScreen: React.FC<VendorDriverManagementScreenProps> = ({
  vendorId,
  onBack,
  onSelectNavTab,
}) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING'>('ALL');

  // Add / Edit Driver Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('2028-12-31');
  const [saving, setSaving] = useState(false);

  const loadDrivers = useCallback(async () => {
    setErrorMessage(null);
    try {
      const data = await vendorService.getVendorDrivers(vendorId);
      setDrivers(data);
    } catch (err: any) {
      console.warn('Driver roster loading notice:', err);
      setErrorMessage(err?.message || 'Could not load drivers. Tap to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDrivers();
  };

  const handleAddDriver = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter Driver Full Name.');
      return;
    }
    const cleanPhone = mobile.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!licenceNumber.trim()) {
      Alert.alert('Required Field', 'Please enter Driver Commercial Driving Licence (DL) Number.');
      return;
    }

    setSaving(true);
    try {
      const res = await vendorService.addVendorDriver(vendorId, {
        fullName: fullName.trim(),
        mobile: cleanPhone,
        licenceNumber: licenceNumber.trim().toUpperCase(),
        licenceExpiryDate: expiryDate || '2028-12-31',
      });

      if (res.success) {
        Alert.alert('Driver Enrolled', `Driver ${fullName} has been successfully added to your carrier roster.`);
        setShowAddModal(false);
        setFullName('');
        setMobile('');
        setLicenceNumber('');
        setExpiryDate('2028-12-31');
        loadDrivers();
      } else {
        Alert.alert('Notice', 'Could not register driver. Please verify details and retry.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add driver.');
    } finally {
      setSaving(false);
    }
  };

  const callDriver = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  // Filter counts
  const counts = useMemo(() => {
    const total = drivers.length;
    const verified = drivers.filter(
      (d) => (d.status || '').toUpperCase() === 'APPROVED' || (d.status || '').toUpperCase() === 'VERIFIED'
    ).length;
    const pending = total - verified;
    return { total, verified, pending };
  }, [drivers]);

  // Filtered Driver List
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        d.fullName?.toLowerCase().includes(q) ||
        d.mobile?.toLowerCase().includes(q) ||
        d.licenceNumber?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isVerified =
        (d.status || '').toUpperCase() === 'APPROVED' || (d.status || '').toUpperCase() === 'VERIFIED';

      if (activeFilter === 'VERIFIED') {
        return isVerified;
      }
      if (activeFilter === 'PENDING') {
        return !isVerified;
      }
      return true;
    });
  }, [drivers, searchQuery, activeFilter]);

  const handleTabSelection = (tab: VendorNavTab) => {
    if (tab === 'FLEET') {
      onRefresh();
    } else {
      if (onSelectNavTab) onSelectNavTab(tab);
      else onBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Compact Header (Screenshot 3 Match - No landscape banner) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={onBack}
          accessibilityLabel="Back"
          activeOpacity={0.8}
        >
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText}>
            Driver <Text style={styles.headerTitleOrange}>Roster</Text>
          </Text>
          <Text style={styles.headerSubtitleText}>
            Manage verified commercial heavy vehicle pilots & drivers.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.headerAddBtnText}>Add Driver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" />
        }
      >
        {/* ── 2. Search Field (Screenshot 3 Match) ── */}
        <View style={styles.searchBarContainer}>
          <Search size={18} color="#667085" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search driver name or phone number"
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

        {/* ── 3. Filter Chips (Screenshot 3 Match) ── */}
        <View style={styles.filterChipsRow}>
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

          {/* Verified */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'VERIFIED' && styles.filterChipActive]}
            onPress={() => setActiveFilter('VERIFIED')}
            activeOpacity={0.8}
          >
            <CheckCircle2
              size={15}
              color={activeFilter === 'VERIFIED' ? '#FFFFFF' : '#12B76A'}
              strokeWidth={2}
            />
            <Text style={[styles.filterChipText, activeFilter === 'VERIFIED' && styles.filterChipTextActive]}>
              Verified ({counts.verified})
            </Text>
          </TouchableOpacity>

          {/* Pending */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'PENDING' && styles.filterChipActive]}
            onPress={() => setActiveFilter('PENDING')}
            activeOpacity={0.8}
          >
            <Clock
              size={15}
              color={activeFilter === 'PENDING' ? '#FFFFFF' : '#FF5A1F'}
              strokeWidth={2}
            />
            <Text style={[styles.filterChipText, activeFilter === 'PENDING' && styles.filterChipTextActive]}>
              Pending ({counts.pending})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Network Error Notification */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            <TouchableOpacity onPress={loadDrivers} style={styles.errorRetryBtn}>
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 4. Driver Content List or Empty State ── */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF5A1F" />
            <Text style={styles.loadingText}>Syncing verified driver roster...</Text>
          </View>
        ) : filteredDrivers.length === 0 ? (
          /* Empty State (Screenshot 3 Match) */
          <View style={styles.emptyCard}>
            {/* Vector Illustration: 2 people with radiant sparkle burst */}
            <View style={styles.illustrationWrap}>
              <View style={styles.sunburstRays}>
                <View style={styles.rayTop} />
                <View style={styles.rayLeft} />
                <View style={styles.rayRight} />
              </View>
              <View style={styles.peopleIconsWrap}>
                <View style={styles.personBack}>
                  <Users size={32} color="#CBD5E1" strokeWidth={1.8} />
                </View>
                <View style={styles.personFront}>
                  <Users size={40} color="#64748B" strokeWidth={2} />
                </View>
              </View>
            </View>

            <Text style={styles.emptyCardTitle}>No Drivers Enrolled</Text>
            <Text style={styles.emptyCardSubtitle}>
              Add your first driver to manage driver details, verification and fleet assignments.
            </Text>

            <TouchableOpacity
              style={styles.addFirstDriverBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.addFirstDriverBtnText}>Add Your First Driver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Driver Cards List */
          <View style={styles.driverList}>
            {filteredDrivers.map((driver) => {
              const isVerified =
                (driver.status || '').toUpperCase() === 'APPROVED' ||
                (driver.status || '').toUpperCase() === 'VERIFIED';

              return (
                <View key={driver.id} style={styles.driverCard}>
                  <View style={styles.driverCardTop}>
                    <View style={styles.driverAvatar}>
                      <Users size={20} color="#FF5A1F" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.driverName}>{driver.fullName}</Text>
                      <Text style={styles.driverPhone}>{driver.mobile}</Text>
                    </View>
                    <View style={[styles.statusBadge, isVerified ? styles.statusVerified : styles.statusPending]}>
                      {isVerified ? (
                        <CheckCircle2 size={12} color="#12B76A" strokeWidth={2.5} />
                      ) : (
                        <Clock size={12} color="#D97706" strokeWidth={2.5} />
                      )}
                      <Text style={[styles.statusBadgeText, isVerified ? styles.textVerified : styles.textPending]}>
                        {isVerified ? 'Verified' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.driverCardDetails}>
                    <View style={styles.detailRow}>
                      <CreditCard size={14} color="#667085" />
                      <Text style={styles.detailText}>DL: {driver.licenceNumber || 'Not Uploaded'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Calendar size={14} color="#667085" />
                      <Text style={styles.detailText}>Valid till: {driver.licenceExpiryDate || '2028-12-31'}</Text>
                    </View>
                  </View>

                  <View style={styles.driverCardFooter}>
                    <TouchableOpacity
                      style={styles.callDriverBtn}
                      onPress={() => callDriver(driver.mobile)}
                      activeOpacity={0.8}
                    >
                      <Phone size={14} color="#FF5A1F" />
                      <Text style={styles.callDriverText}>Call Driver</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 5. Info Callout Card (Screenshot 3 Match) ── */}
        <View style={styles.infoCalloutCard}>
          <View style={styles.infoIconWrap}>
            <Users size={20} color="#FF5A1F" strokeWidth={2} />
          </View>
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>
              Keep driver licence and verification details up to date.
            </Text>
            <Text style={styles.infoSubtitle}>
              This helps ensure smooth fleet operations and faster load assignments.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── 6. Persistent Bottom Navigation Bar (Fleet Active) ── */}
      <VendorBottomNavBar
        activeTab="FLEET"
        onSelectTab={handleTabSelection}
      />

      {/* ── 7. Add Driver Registration Modal ── */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Fleet Driver</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#172B4D" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              <Text style={styles.fieldLabel}>DRIVER FULL NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.fieldLabel}>10-DIGIT MOBILE NUMBER *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
              />

              <Text style={styles.fieldLabel}>DRIVING LICENCE (DL) NUMBER *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. AS-01-2018-0012345"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={licenceNumber}
                onChangeText={setLicenceNumber}
              />

              <Text style={styles.fieldLabel}>LICENCE VALIDITY EXPIRY DATE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD (e.g. 2028-12-31)"
                placeholderTextColor="#94A3B8"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />

              <TouchableOpacity
                style={styles.saveDriverBtn}
                onPress={handleAddDriver}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveDriverBtnText}>Save Driver</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 12,
    backgroundColor: '#F6F8FB',
  },
  headerBackBtn: {
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
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#172B4D',
  },
  headerTitleOrange: {
    color: '#FF5A1F',
  },
  headerSubtitleText: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF5A1F',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    elevation: 2,
  },
  headerAddBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DEE7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: '#FF5A1F',
    borderColor: '#FF5A1F',
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
  /* Empty Card (Screenshot 3 Match) */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    marginBottom: 16,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
    height: 70,
    width: 80,
  },
  sunburstRays: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    gap: 8,
  },
  rayTop: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FF5A1F',
  },
  rayLeft: {
    width: 3,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#FF8A50',
    transform: [{ rotate: '-25deg' }],
  },
  rayRight: {
    width: 3,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#FF8A50',
    transform: [{ rotate: '25deg' }],
  },
  peopleIconsWrap: {
    marginTop: 14,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personBack: {
    position: 'absolute',
    top: -2,
    right: -10,
    opacity: 0.5,
  },
  personFront: {
    zIndex: 2,
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#172B4D',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyCardSubtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  addFirstDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5A1F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
  },
  addFirstDriverBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  /* Driver List Cards */
  driverList: {
    gap: 12,
    marginBottom: 16,
  },
  driverCard: {
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
  driverCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
  },
  driverPhone: {
    fontSize: 12,
    color: '#667085',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusVerified: {
    backgroundColor: '#ECFDF3',
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textVerified: {
    color: '#12B76A',
  },
  textPending: {
    color: '#D97706',
  },
  driverCardDetails: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#475569',
  },
  driverCardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF4EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callDriverText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5A1F',
  },
  /* Info Callout Card (Screenshot 3 Match) */
  infoCalloutCard: {
    backgroundColor: '#FFFBF9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE8DC',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF1EA',
    borderWidth: 1,
    borderColor: '#FFD9C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101B3D',
    lineHeight: 18,
    marginBottom: 3,
  },
  infoSubtitle: {
    fontSize: 11,
    color: '#667085',
    lineHeight: 16,
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
  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDialog: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101B3D',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#101B3D',
  },
  saveDriverBtn: {
    backgroundColor: '#FF5A1F',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  saveDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
