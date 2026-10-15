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
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  Plus,
  CheckCircle2,
  X,
  FileText,
  Weight,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorFleetManagementScreenProps {
  vendorId: string;
  onBack: () => void;
}

export const VendorFleetManagementScreen: React.FC<VendorFleetManagementScreenProps> = ({
  vendorId,
  onBack,
}) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form state
  const [regNumber, setRegNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('32FT_MXL');
  const [capacityMt, setCapacityMt] = useState('25');
  const [rcNumber, setRcNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const vehicleTypes = ['32FT_MXL', '32FT_SXL', '20FT_SXL', '40FT_TRAILER', 'OPEN_16MT'];

  const loadVehicles = useCallback(async () => {
    try {
      const data = await vendorService.getVendorVehicles(vendorId);
      setVehicles(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVehicles();
  };

  const handleAddVehicle = async () => {
    if (!regNumber.trim() || regNumber.trim().length < 6) {
      Alert.alert('Required Field', 'Please enter a valid Commercial Registration Number (e.g. AS 01 AB 1234).');
      return;
    }
    if (!rcNumber.trim()) {
      Alert.alert('Required Field', 'Please enter the RC Certificate Number.');
      return;
    }

    setSaving(true);
    try {
      await vendorService.addVendorVehicle(vendorId, {
        registrationNumber: regNumber.trim().toUpperCase(),
        vehicleType,
        capacityMt: parseFloat(capacityMt) || 20,
        rcNumber: rcNumber.trim().toUpperCase(),
      });

      Alert.alert('Vehicle Registered', `Vehicle ${regNumber.toUpperCase()} added to active fleet roster.`);
      setShowAddModal(false);
      setRegNumber('');
      setRcNumber('');
      loadVehicles();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not register vehicle.');
    } finally {
      setSaving(false);
    }
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
                Fleet & <Text style={styles.goldText}>Vehicles</Text>
              </Text>
              <Text style={styles.subText}>Manage commercial trucks registered under your transport firm.</Text>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Truck</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Truck size={32} color="#6B7280" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Fleet Vehicles Registered</Text>
              <Text style={styles.emptySub}>Tap "+ Add Truck" above to register commercial vehicles.</Text>
            </View>
          ) : (
            <View style={styles.vehiclesCol}>
              {vehicles.map((v) => (
                <View key={v.id} style={styles.vehicleCard}>
                  <View style={styles.vehicleTop}>
                    <View style={styles.regBadge}>
                      <Truck size={14} color="#F05A22" />
                      <Text style={styles.regNumber}>{v.registrationNumber}</Text>
                    </View>

                    <View style={styles.statusPill}>
                      <CheckCircle2 size={11} color="#10B981" />
                      <Text style={styles.statusText}>{v.status || 'ACTIVE'}</Text>
                    </View>
                  </View>

                  <View style={styles.specsRow}>
                    <View style={styles.specBox}>
                      <Text style={styles.specLabel}>Category:</Text>
                      <Text style={styles.specVal}>{v.vehicleType || '32 FT MXL'}</Text>
                    </View>

                    <View style={styles.specBox}>
                      <Text style={styles.specLabel}>Rated Capacity:</Text>
                      <Text style={styles.specVal}>{v.ratedCapacityMt} MT</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.rcWrap}>
                      <FileText size={12} color="#6B7280" />
                      <Text style={styles.rcText}>RC: {v.rcNumber || 'RC-VERIFIED'}</Text>
                    </View>
                    <View style={styles.readyBadge}>
                      <ShieldCheck size={12} color="#10B981" />
                      <Text style={styles.readyText}>Dispatch Ready</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Vehicle Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Commercial Vehicle</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Registration Number (Plate) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. AS 01 AB 1234"
                placeholderTextColor="#94A3B8"
                value={regNumber}
                onChangeText={setRegNumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Vehicle Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {vehicleTypes.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, vehicleType === t && styles.typePillActive]}
                    onPress={() => setVehicleType(t)}
                  >
                    <Text style={[styles.typePillText, vehicleType === t && styles.typePillTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Rated Capacity in MT *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 25"
                placeholderTextColor="#94A3B8"
                value={capacityMt}
                onChangeText={setCapacityMt}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>RC Registration Number *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. RC9876543210"
                placeholderTextColor="#94A3B8"
                value={rcNumber}
                onChangeText={setRcNumber}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={[styles.goldBtn, saving && styles.goldBtnDisabled]}
              onPress={handleAddVehicle}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.goldBtnText}>Save Vehicle to Fleet</Text>
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
  vehiclesCol: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  vehicleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  regBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  regNumber: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  specVal: {
    color: '#172B4D',
    fontSize: 12,
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
  rcWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rcText: {
    color: '#64748B',
    fontSize: 11,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readyText: {
    color: '#10B981',
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
  typeScroll: {
    flexDirection: 'row',
  },
  typePill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  typePillText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
