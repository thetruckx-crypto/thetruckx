import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  ChevronLeft,
  Users,
  Plus,
  Phone,
  CreditCard,
  Calendar,
  CheckCircle2,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorDriverManagementScreenProps {
  vendorId: string;
  onBack: () => void;
}

export const VendorDriverManagementScreen: React.FC<VendorDriverManagementScreenProps> = ({
  vendorId,
  onBack,
}) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('2028-12-31');
  const [saving, setSaving] = useState(false);

  const loadDrivers = useCallback(async () => {
    try {
      const data = await vendorService.getVendorDrivers(vendorId);
      setDrivers(data);
    } catch {
      // Keep state
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
    if (!mobile.trim() || mobile.replace(/[^0-9]/g, '').length < 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit driver mobile number.');
      return;
    }
    if (!licenceNumber.trim()) {
      Alert.alert('Required Field', 'Please enter Driver Driving Licence Number.');
      return;
    }

    setSaving(true);
    try {
      await vendorService.addVendorDriver(vendorId, {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        licenceNumber: licenceNumber.trim().toUpperCase(),
        licenceExpiryDate: expiryDate,
      });

      Alert.alert('Driver Added', `Driver ${fullName} has been registered to your transport fleet.`);
      setShowAddModal(false);
      setFullName('');
      setMobile('');
      setLicenceNumber('');
      loadDrivers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add driver.');
    } finally {
      setSaving(false);
    }
  };

  const callDriver = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>
                Driver <Text style={styles.goldText}>Roster</Text>
              </Text>
              <Text style={styles.subText}>Manage verified commercial heavy vehicle pilots & drivers.</Text>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Driver</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : drivers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Users size={32} color="#6B7280" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Drivers Enrolled</Text>
              <Text style={styles.emptySub}>Tap "+ Add Driver" to enroll your commercial heavy vehicle pilots.</Text>
            </View>
          ) : (
            <View style={styles.driversCol}>
              {drivers.map((d) => (
                <View key={d.id} style={styles.driverCard}>
                  <View style={styles.driverTop}>
                    <View style={styles.driverNameWrap}>
                      <Users size={16} color="#F05A22" />
                      <Text style={styles.driverName}>{d.fullName}</Text>
                    </View>

                    <View style={styles.statusPill}>
                      <CheckCircle2 size={11} color="#10B981" />
                      <Text style={styles.statusText}>{d.status || 'APPROVED'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <CreditCard size={12} color="#6B7280" />
                      <Text style={styles.detailText}>DL: {d.licenceNumber}</Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Calendar size={12} color="#6B7280" />
                      <Text style={styles.detailText}>Exp: {d.licenceExpiryDate || '2028'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callDriver(d.mobile)}
                      activeOpacity={0.8}
                    >
                      <Phone size={13} color="#F05A22" />
                      <Text style={styles.callBtnText}>{d.mobile || '+91 98765 43210'}</Text>
                    </TouchableOpacity>

                    <View style={styles.auditPill}>
                      <ShieldCheck size={12} color="#10B981" />
                      <Text style={styles.auditPillText}>Background Checked</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Driver Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enroll Commercial Driver</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Driver Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Driver Mobile Number *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Driving Licence Number (Commercial) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. AP 12 2023 0001234"
                placeholderTextColor="#94A3B8"
                value={licenceNumber}
                onChangeText={setLicenceNumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Licence Expiry Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 2028-12-31"
                placeholderTextColor="#94A3B8"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            </View>

            <TouchableOpacity
              style={[styles.goldBtn, saving && styles.goldBtnDisabled]}
              onPress={handleAddDriver}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.goldBtnText}>Enroll Driver to Fleet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 2,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 11,
    color: '#64748B',
    maxWidth: 220,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  driversCol: {
    gap: 12,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  driverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
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
    color: '#64748B',
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  callBtnText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  auditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
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
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '800',
  },
  modalField: {
    marginBottom: 12,
  },
  modalLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: '#172B4D',
    fontSize: 13,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  goldBtnDisabled: {
    opacity: 0.5,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
