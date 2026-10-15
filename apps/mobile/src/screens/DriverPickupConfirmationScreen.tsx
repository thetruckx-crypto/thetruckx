import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  MapPin,
  Scale,
  CheckCircle2,
  Navigation,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Package,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { driverService } from '../services/driverService';
import { DriverTripItem } from '../types';

interface DriverPickupConfirmationScreenProps {
  tripId: string;
  onBack: () => void;
  onPickupConfirmed: (tripId: string) => void;
}

export const DriverPickupConfirmationScreen: React.FC<DriverPickupConfirmationScreenProps> = ({
  tripId,
  onBack,
  onPickupConfirmed,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [grossWeight, setGrossWeight] = useState('32.50');
  const [tareWeight, setTareWeight] = useState('12.50');
  const [loadingGateNotes, setLoadingGateNotes] = useState('');
  const [lrChecked, setLrChecked] = useState(true);
  const [tarpaulinChecked, setTarpaulinChecked] = useState(true);

  useEffect(() => {
    driverService.getTripDetails(tripId).then((data) => {
      setTrip(data);
      setLoading(false);
    });
  }, [tripId]);

  const grossMt = parseFloat(grossWeight) || 0;
  const tareMt = parseFloat(tareWeight) || 0;
  const netWeightNum = Math.max(0, grossMt - tareMt);
  const netWeight = netWeightNum.toFixed(2);
  const grossKg = Math.round(grossMt * 1000);
  const tareKg = Math.round(tareMt * 1000);
  const netKg = Math.round(netWeightNum * 1000);

  const targetMt = trip?.capacityMt || 0;
  const isOverweight = targetMt > 0 && netWeightNum > targetMt * 1.05;
  const isWithinTolerance = targetMt > 0 && Math.abs(netWeightNum - targetMt) <= targetMt * 0.05;

  const handleConfirmPickup = async () => {
    if (!trip) return;

    if (!lrChecked || !tarpaulinChecked) {
      Alert.alert('Pre-Dispatch Checklist', 'Please confirm that the physical LR copy has been signed and cargo is properly secured.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await driverService.confirmPickup(
        trip.id,
        trip.bookingId,
        loadingGateNotes.trim(),
        parseFloat(grossWeight) || 32.5,
        parseFloat(tareWeight) || 12.5
      );

      setSubmitting(false);
      Alert.alert(
        'Pickup Confirmed!',
        res.message,
        [{ text: 'Start Highway Transit', onPress: () => onPickupConfirmed(trip.id) }]
      );
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Pickup Error', e.message || 'Could not confirm pickup.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" theme="light" />
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : !trip ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF' }}>Trip not found.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headingWrap}>
              <View style={styles.badgeRow}>
                <View style={styles.stagePill}>
                  <Text style={styles.stagePillText}>DISPATCH GATE CONFIRMATION</Text>
                </View>
              </View>
              <Text style={styles.titleText}>
                Loading & <Text style={styles.goldText}>Pickup Sign-off</Text>
              </Text>
              <Text style={styles.subText}>
                Record weighment bridge gross weight, confirm loading checklist, and trigger active highway transit.
              </Text>
            </View>

            {/* Consignor Pickup Details */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <MapPin size={16} color="#10B981" />
                <Text style={styles.cardHeaderText}>Loading Point Details</Text>
              </View>

              <Text style={styles.consignorAddress}>{trip.pickupAddress}</Text>

              <View style={styles.routeQuickRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Consigned Cargo:</Text>
                  <Text style={styles.val}>{trip.material} ({trip.capacityMt} MT Target)</Text>
                </View>
                <TouchableOpacity
                  style={styles.navGateBtn}
                  onPress={() => driverService.openNavigation(trip.pickupAddress, trip.origin)}
                >
                  <Navigation size={14} color="#F05A22" />
                  <Text style={styles.navGateText}>GPS to Gate</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Weighment Bridge Input */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <Scale size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Loading Weighment Bridge (MT / KG)</Text>
              </View>

              <View style={styles.weighRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Gross Weight (MT) *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={grossWeight}
                      onChangeText={setGrossWeight}
                      placeholder="32.50"
                      placeholderTextColor="#5C5E66"
                    />
                  </View>
                  <Text style={styles.kgHelper}>≈ {grossKg.toLocaleString('en-IN')} KG</Text>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Tare Weight (MT) *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={tareWeight}
                      onChangeText={setTareWeight}
                      placeholder="12.50"
                      placeholderTextColor="#5C5E66"
                    />
                  </View>
                  <Text style={styles.kgHelper}>≈ {tareKg.toLocaleString('en-IN')} KG</Text>
                </View>
              </View>

              <View style={[styles.netWeightBanner, isOverweight && styles.netWeightBannerOverweight]}>
                <Text style={styles.netWeightLabel}>CALCULATED NET CARGO WEIGHT:</Text>
                <Text style={styles.netWeightVal}>
                  {netWeight} MT <Text style={styles.netWeightKg}>({netKg.toLocaleString('en-IN')} KG)</Text>
                </Text>
                {targetMt > 0 && (
                  <View style={styles.toleranceRow}>
                    {isOverweight ? (
                      <Text style={styles.toleranceOverweightText}>
                        ⚠️ Warning: Exceeds target {targetMt} MT (+{((netWeightNum - targetMt)/targetMt * 100).toFixed(1)}%)
                      </Text>
                    ) : isWithinTolerance ? (
                      <Text style={styles.toleranceOkText}>✓ Within Target Tolerance ({targetMt} MT)</Text>
                    ) : (
                      <Text style={styles.toleranceNeutralText}>Target: {targetMt} MT</Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Pre-Dispatch Safety & Documents Checklist */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <FileCheck2 size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Pre-Dispatch Verification</Text>
              </View>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setLrChecked(!lrChecked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, lrChecked && styles.checkBoxActive]}>
                  {lrChecked && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Lorry Receipt (LR) Consignor Sign-off</Text>
                  <Text style={styles.checkSub}>Physical LR copy counter-signed by gate supervisor</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setTarpaulinChecked(!tarpaulinChecked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, tarpaulinChecked && styles.checkBoxActive]}>
                  {tarpaulinChecked && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Weatherproofing & Lashing Secured</Text>
                  <Text style={styles.checkSub}>Cargo covered with waterproof tarpaulin and lashed</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Confirm Pickup Action */}
            <TouchableOpacity
              style={[styles.goldPillBtn, submitting && styles.goldPillBtnDisabled]}
              onPress={handleConfirmPickup}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Confirm Pickup & Start Transit</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headingWrap: {
    marginBottom: 14,
  },
  badgeRow: {
    marginBottom: 6,
  },
  stagePill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stagePillText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  consignorAddress: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  routeQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  label: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
  },
  val: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  navGateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  navGateText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  weighRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '700',
  },
  kgHelper: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  netWeightBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  netWeightBannerOverweight: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  netWeightLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  netWeightVal: {
    color: '#F05A22',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  netWeightKg: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  toleranceRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    alignItems: 'center',
  },
  toleranceOverweightText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  toleranceOkText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  toleranceNeutralText: {
    color: '#64748B',
    fontSize: 11,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#7C7E86',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  checkTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  checkSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 6,
  },
  goldPillBtnDisabled: {
    opacity: 0.6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
