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
  CheckCircle2,
  FileCheck2,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
} from 'lucide-react-native';
import { driverService } from '../../../services/driverService';
import { DriverTripItem } from '../../../types';

interface DriverDeliveryConfirmationScreenProps {
  tripId: string;
  onBack: () => void;
  onDeliveryConfirmed: (tripId: string) => void;
}

export const DriverDeliveryConfirmationScreen: React.FC<DriverDeliveryConfirmationScreenProps> = ({
  tripId,
  onBack,
  onDeliveryConfirmed,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receiverName, setReceiverName] = useState('A. K. Ghosh (Warehouse Manager)');
  const [receiverPhone, setReceiverPhone] = useState('9849033445');
  const [cargoIntact, setCargoIntact] = useState(true);
  const [sealIntact, setSealIntact] = useState(true);

  useEffect(() => {
    driverService.getTripDetails(tripId).then((data) => {
      setTrip(data);
      if (data?.dropContactName) setReceiverName(data.dropContactName);
      if (data?.dropContactPhone) setReceiverPhone(data.dropContactPhone.replace(/[^0-9]/g, '').slice(-10));
      setLoading(false);
    });
  }, [tripId]);

  const handleConfirmDelivery = async () => {
    if (!receiverName.trim() || !receiverPhone.trim()) {
      Alert.alert('Receiver Details Required', 'Please provide receiver name and mobile phone number.');
      return;
    }

    if (!cargoIntact || !sealIntact) {
      Alert.alert('Consignment Checklist', 'Please confirm that cargo inspection and seal verification are complete.');
      return;
    }

    if (!trip) return;

    setSubmitting(true);
    try {
      const res = await driverService.confirmDelivery(
        trip.id,
        trip.bookingId,
        receiverName.trim(),
        receiverPhone.trim()
      );

      setSubmitting(false);
      Alert.alert(
        'Delivery Acknowledged',
        res.message,
        [{ text: 'Proceed to POD Upload', onPress: () => onDeliveryConfirmed(trip.id) }]
      );
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Delivery Error', e.message || 'Could not confirm delivery.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Confirm Delivery</Text>
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
                  <Text style={styles.stagePillText}>DESTINATION UNLOADING GATE</Text>
                </View>
              </View>
              <Text style={styles.titleText}>
                Delivery <Text style={styles.goldText}>Confirmation</Text>
              </Text>
              <Text style={styles.subText}>
                Verify cargo handover, capture receiver legal credentials, and proceed to stamped POD submission.
              </Text>
            </View>

            {/* Destination Info Card */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <MapPin size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Unloading Destination</Text>
              </View>

              <Text style={styles.destinationAddress}>{trip.destinationAddress}</Text>

              <View style={styles.cargoSummaryRow}>
                <Text style={styles.cargoSummaryText}>
                  Consigned Cargo: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{trip.material}</Text> • {trip.capacityMt} MT
                </Text>
              </View>
            </View>

            {/* Receiver Credentials Form */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <User size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Receiver / Consignee Official</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Receiving Officer Legal Name *</Text>
                <View style={styles.inputWrap}>
                  <User size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={receiverName}
                    onChangeText={setReceiverName}
                    placeholder="e.g. A. K. Ghosh (Warehouse Manager)"
                    placeholderTextColor="#5C5E66"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Receiver Contact Phone *</Text>
                <View style={styles.inputWrap}>
                  <Phone size={15} color="#7C7E86" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={receiverPhone}
                    onChangeText={setReceiverPhone}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#5C5E66"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Unloading Inspection Checklist */}
            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <PackageCheck size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>Consignment Handover Checklist</Text>
              </View>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setCargoIntact(!cargoIntact)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, cargoIntact && styles.checkBoxActive]}>
                  {cargoIntact && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Cargo Condition Inspected Intact</Text>
                  <Text style={styles.checkSub}>No transit pilferage, leakage, or cargo damage observed</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkItemRow}
                onPress={() => setSealIntact(!sealIntact)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkBox, sealIntact && styles.checkBoxActive]}>
                  {sealIntact && <CheckCircle2 size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>Container / Truck Seal Verified</Text>
                  <Text style={styles.checkSub}>Security seal intact and matched with gate pass</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Confirm Delivery CTA */}
            <TouchableOpacity
              style={[styles.goldPillBtn, submitting && styles.goldPillBtnDisabled]}
              onPress={handleConfirmDelivery}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.goldPillText}>Confirm Delivery & Upload POD</Text>
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
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
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
    backgroundColor: 'rgba(240, 90, 34, 0.12)',
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
  destinationAddress: {
    color: '#172B4D',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  cargoSummaryRow: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  cargoSummaryText: {
    color: '#64748B',
    fontSize: 11.5,
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
    paddingHorizontal: 10,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13.5,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
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
    fontSize: 12.5,
    fontWeight: '600',
  },
  checkSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
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
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
