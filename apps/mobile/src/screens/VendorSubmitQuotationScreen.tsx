import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  DollarSign,
  Clock,
  Truck,
  Users,
  FileText,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';
import { formatINR, numberToIndianWords } from '../utils/formatters';

interface VendorSubmitQuotationScreenProps {
  vendorId: string;
  requirement: any;
  onBack: () => void;
  onSubmitSuccess: (data: { quotationId: string; quotedRate: number; transitDays: number }) => void;
}

export const VendorSubmitQuotationScreen: React.FC<VendorSubmitQuotationScreenProps> = ({
  vendorId,
  requirement,
  onBack,
  onSubmitSuccess,
}) => {
  const [quotedRate, setQuotedRate] = useState('38500');
  const [transitDays, setTransitDays] = useState('3');
  const [remarks, setRemarks] = useState('Tolls, transit tarpaulin cover & loading assistance included.');
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(undefined);
  
  const [loading, setLoading] = useState(false);
  const [loadingFleet, setLoadingFleet] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [vList, dList] = await Promise.all([
          vendorService.getVendorVehicles(vendorId),
          vendorService.getVendorDrivers(vendorId),
        ]);
        setVehicles(vList);
        if (vList.length > 0) setSelectedVehicleId(vList[0].id);

        setDrivers(dList);
        if (dList.length > 0) setSelectedDriverId(dList[0].id);
      } catch {
        // Keep empty
      } finally {
        setLoadingFleet(false);
      }
    })();
  }, [vendorId]);

  const adjustRate = (delta: number) => {
    const current = parseFloat(quotedRate.replace(/[^0-9.]/g, '')) || 0;
    const next = Math.max(1000, current + delta);
    setQuotedRate(next.toString());
  };

  const currentRateNum = parseFloat(quotedRate.replace(/[^0-9.]/g, '')) || 0;
  const rateInWords = currentRateNum > 0 ? numberToIndianWords(currentRateNum) : '';
  const capacityMt = requirement.requiredCapacityMt ? parseFloat(requirement.requiredCapacityMt) : 0;
  const ratePerMt = capacityMt > 0 && currentRateNum > 0 ? Math.round(currentRateNum / capacityMt) : null;

  const handleSubmit = async () => {
    const rateNum = parseFloat(quotedRate.replace(/[^0-9.]/g, ''));
    if (!rateNum || rateNum < 1000) {
      Alert.alert('Required Rate', 'Please enter a valid quoted freight rate (min ₹1,000).');
      return;
    }

    const daysNum = parseInt(transitDays, 10) || 3;

    setLoading(true);
    try {
      const res = await vendorService.submitQuotation({
        vendorId,
        requirementId: requirement.id,
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
        quotedRate: rateNum,
        transitDays: daysNum,
        remarks: remarks.trim(),
      });

      if (res.success) {
        onSubmitSuccess({
          quotationId: res.quotationId,
          quotedRate: rateNum,
          transitDays: daysNum,
        });
      } else {
        Alert.alert('Error', 'Failed to record quotation. Please retry.');
      }
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Error submitting quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
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
            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Submit Freight <Text style={styles.goldText}>Quotation</Text>
              </Text>
              <Text style={styles.subText}>
                Enter your competitive carrier rate for {requirement.pickupAddress?.split(',')[0]} →{' '}
                {requirement.destinationAddress?.split(',')[0]}.
              </Text>
            </View>

            {/* Requirement Summary Tag */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryRoute}>
                {requirement.id} • {requirement.materialType || 'Industrial Machinery'} (
                {requirement.requiredCapacityMt} MT)
              </Text>
            </View>

            {/* Rate & Transit Form */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <DollarSign size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>COMMERCIAL FREIGHT RATE *</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Total Quoted Carrier Rate (₹) *</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.inputBold}
                    placeholder="e.g. 38500"
                    placeholderTextColor="#94A3B8"
                    value={quotedRate}
                    onChangeText={setQuotedRate}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Indian Currency Words Visualizer */}
                {rateInWords ? (
                  <View style={styles.wordsBanner}>
                    <Text style={styles.wordsText}>🗣️ {rateInWords}</Text>
                    {ratePerMt !== null && (
                      <View style={styles.perMtBadge}>
                        <Text style={styles.perMtText}>≈ ₹{ratePerMt.toLocaleString('en-IN')}/MT</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Quick Stepper Chips */}
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustRate(-1000)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperText}>- ₹1,000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustRate(-500)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperText}>- ₹500</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustRate(500)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperText}>+ ₹500</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => adjustRate(1000)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepperText}>+ ₹1,000</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.hintText}>Inclusive of all road taxes, tolls & transit fuel.</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Estimated Transit Duration (Days) *</Text>
                <View style={styles.inputWrap}>
                  <Clock size={16} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 3"
                    placeholderTextColor="#94A3B8"
                    value={transitDays}
                    onChangeText={setTransitDays}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.daysSuffix}>Days</Text>
                </View>
              </View>
            </View>

            {/* Fleet & Driver Pre-Allocation */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Truck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>PROPOSED LORRY & DRIVER (OPTIONAL)</Text>
              </View>

              {loadingFleet ? (
                <ActivityIndicator size="small" color="#F05A22" />
              ) : (
                <>
                  {vehicles.length > 0 && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Assign Commercial Vehicle</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                        {vehicles.map((v) => {
                          const isSel = selectedVehicleId === v.id;
                          return (
                            <TouchableOpacity
                              key={v.id}
                              style={[styles.fleetPill, isSel && styles.fleetPillActive]}
                              onPress={() => setSelectedVehicleId(v.id)}
                            >
                              <Truck size={12} color={isSel ? '#FFFFFF' : '#F05A22'} />
                              <Text style={[styles.fleetPillText, isSel && styles.fleetPillTextActive]}>
                                {v.registrationNumber} ({v.vehicleType})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {drivers.length > 0 && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Assign Verified Driver</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                        {drivers.map((d) => {
                          const isSel = selectedDriverId === d.id;
                          return (
                            <TouchableOpacity
                              key={d.id}
                              style={[styles.fleetPill, isSel && styles.fleetPillActive]}
                              onPress={() => setSelectedDriverId(d.id)}
                            >
                              <Users size={12} color={isSel ? '#FFFFFF' : '#F05A22'} />
                              <Text style={[styles.fleetPillText, isSel && styles.fleetPillTextActive]}>
                                {d.fullName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Remarks / Terms */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <FileText size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>ADDITIONAL TERMS / NOTES</Text>
              </View>

              <View style={styles.fieldGroup}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Terms of carriage, detention allowance, tarpaulin guarantee..."
                  placeholderTextColor="#94A3B8"
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            {/* Compliance Guarantee */}
            <View style={styles.guaranteeBox}>
              <ShieldCheck size={16} color="#10B981" />
              <Text style={styles.guaranteeText}>
                NECL Fast-Settlement: Carrier payment released upon verified digital POD submission.
              </Text>
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              style={[styles.goldBtn, loading && styles.goldBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldBtnText}>Submit Freight Quotation</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomGoldWings />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
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
    marginBottom: 12,
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
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryRoute: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  currencyPrefix: {
    color: '#F05A22',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  inputBold: {
    flex: 1,
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#172B4D',
    fontSize: 14,
  },
  daysSuffix: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  hintText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  wordsBanner: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  wordsText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  perMtBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  perMtText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  stepperBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  stepperText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  pillsScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  fleetPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  fleetPillText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '600',
  },
  fleetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    color: '#172B4D',
    fontSize: 12,
    height: 70,
    textAlignVertical: 'top',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  guaranteeText: {
    flex: 1,
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 54,
    borderRadius: 27,
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
  goldBtnDisabled: {
    opacity: 0.5,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
