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
  Truck,
  Check,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorAssignVehicleScreenProps {
  vendorId: string;
  booking: any;
  onBack: () => void;
  onSelectVehicle: (vehicle: any) => void;
  onAddVehicle?: () => void;
}

export const VendorAssignVehicleScreen: React.FC<VendorAssignVehicleScreenProps> = ({
  vendorId,
  booking,
  onBack,
  onSelectVehicle,
  onAddVehicle,
}) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await vendorService.getVendorVehicles(vendorId);
      setVehicles(data);
      if (data.length > 0) setSelectedVehicle(data[0]);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleContinue = () => {
    if (!selectedVehicle) {
      Alert.alert('Required Selection', 'Please select a vehicle from your fleet.');
      return;
    }
    onSelectVehicle(selectedVehicle);
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
              Assign <Text style={styles.goldText}>Vehicle</Text>
            </Text>
            <Text style={styles.subText}>
              Select an available commercial lorry from your fleet for {booking.origin} → {booking.destination}.
            </Text>
          </View>

          {/* Booking Summary Box */}
          <View style={styles.bookingBox}>
            <Text style={styles.bookingTitle}>Booking #{booking.id}</Text>
            <Text style={styles.bookingReq}>
              Required Truck: {booking.vehicleType || '32 FT Multi-Axle'} • {booking.capacityMt || 20} MT
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Truck size={36} color="#F05A22" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No Commercial Lorries Available</Text>
              <Text style={styles.emptySub}>
                You do not have any active commercial vehicles registered in your fleet matching this route requirement.
              </Text>
              {onAddVehicle ? (
                <TouchableOpacity style={styles.addLorryBtn} onPress={onAddVehicle} activeOpacity={0.85}>
                  <Text style={styles.addLorryBtnText}>+ Add Lorry to Fleet</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.addLorryBtn} onPress={loadVehicles} activeOpacity={0.85}>
                  <Text style={styles.addLorryBtnText}>Refresh Fleet List</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.vehiclesList}>
              {vehicles.map((v) => {
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vehicleCard, isSelected && styles.vehicleCardActive]}
                    onPress={() => setSelectedVehicle(v)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.radio}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>

                    <View style={styles.vehicleInfo}>
                      <View style={styles.regRow}>
                        <Text style={styles.regText}>{v.registrationNumber}</Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>{v.status || 'ACTIVE'}</Text>
                        </View>
                      </View>
                      <Text style={styles.categoryText}>
                        {v.vehicleType} • Rated: {v.ratedCapacityMt} MT
                      </Text>
                      <Text style={styles.rcText}>RC: {v.rcNumber || 'VERIFIED'}</Text>
                    </View>

                    {isSelected && <ShieldCheck size={20} color="#F05A22" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Next Button */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Continue to Assign Driver</Text>
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
  bookingBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  bookingTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  bookingReq: {
    color: '#F05A22',
    fontSize: 11,
  },
  vehiclesList: {
    gap: 10,
    marginBottom: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  vehicleCardActive: {
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
  vehicleInfo: {
    flex: 1,
  },
  regRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  regText: {
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
  categoryText: {
    color: '#172B4D',
    fontSize: 12,
    marginBottom: 2,
  },
  rcText: {
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
    textAlign: 'center',
    lineHeight: 18,
  },
  addLorryBtn: {
    marginTop: 14,
    backgroundColor: '#F05A22',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addLorryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
