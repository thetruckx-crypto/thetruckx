import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Users,
  CreditCard,
  Phone,
  ArrowRight,
  ShieldCheck,
  Truck,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorAssignDriverScreenProps {
  vendorId: string;
  booking: any;
  selectedVehicle: any;
  onBack: () => void;
  onSelectDriver: (driver: any) => void;
}

export const VendorAssignDriverScreen: React.FC<VendorAssignDriverScreenProps> = ({
  vendorId,
  booking,
  selectedVehicle,
  onBack,
  onSelectDriver,
}) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDrivers = useCallback(async () => {
    try {
      const data = await vendorService.getVendorDrivers(vendorId);
      setDrivers(data);
      if (data.length > 0) setSelectedDriver(data[0]);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const handleContinue = () => {
    if (!selectedDriver) {
      Alert.alert('Required Selection', 'Please select a driver from your roster.');
      return;
    }
    onSelectDriver(selectedDriver);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Assign <Text style={styles.goldText}>Driver</Text>
            </Text>
            <Text style={styles.subText}>
              Select a verified pilot for lorry {selectedVehicle?.registrationNumber}.
            </Text>
          </View>

          {/* Pair Summary */}
          <View style={styles.pairBox}>
            <View style={styles.pairItem}>
              <Text style={styles.pairLabel}>BOOKING:</Text>
              <Text style={styles.pairVal}>{booking.id}</Text>
            </View>
            <View style={styles.pairDivider} />
            <View style={styles.pairItem}>
              <Text style={styles.pairLabel}>SELECTED VEHICLE:</Text>
              <Text style={styles.pairValGold}>{selectedVehicle?.registrationNumber}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : drivers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Drivers Available</Text>
              <Text style={styles.emptySub}>Please add a driver in Driver Management first.</Text>
            </View>
          ) : (
            <View style={styles.driversList}>
              {drivers.map((d) => {
                const isSelected = selectedDriver?.id === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.driverCard, isSelected && styles.driverCardActive]}
                    onPress={() => setSelectedDriver(d)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.radio}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>

                    <View style={styles.driverInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.driverName}>{d.fullName}</Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>{d.status || 'APPROVED'}</Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Phone size={11} color="#8A8D96" />
                        <Text style={styles.metaText}>{d.mobile || '+91 98765 43210'}</Text>
                      </View>

                      <View style={styles.metaRow}>
                        <CreditCard size={11} color="#8A8D96" />
                        <Text style={styles.metaText}>DL: {d.licenceNumber}</Text>
                      </View>
                    </View>

                    {isSelected && <ShieldCheck size={20} color="#F05A22" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Review & Confirm Assignment</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
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
  pairBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  pairItem: {
    flex: 1,
  },
  pairDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  pairLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  pairVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  pairValGold: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '800',
  },
  driversList: {
    gap: 10,
    marginBottom: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  driverCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
  },
  driverInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  driverName: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    color: '#64748B',
    fontSize: 11,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
});
