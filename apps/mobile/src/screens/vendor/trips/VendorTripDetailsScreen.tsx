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
  Linking,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Truck,
  Users,
  Phone,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  Navigation,
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { vendorService } from '../../../services/vendorService';

interface VendorTripDetailsScreenProps {
  tripId: string;
  onBack: () => void;
  onViewDocuments: (tripId: string) => void;
}

export const VendorTripDetailsScreen: React.FC<VendorTripDetailsScreenProps> = ({
  tripId,
  onBack,
  onViewDocuments,
}) => {
  const [trip, setTrip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadTrip = useCallback(async () => {
    try {
      const data = await vendorService.getTripDetails(tripId);
      setTrip(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const advanceTripStatus = async (nextStatus: any) => {
    if (!trip) return;
    setUpdating(true);
    try {
      await vendorService.updateTripStatus(trip.id, trip.bookingId, nextStatus);
      Alert.alert('Trip Status Updated', `Trip lifecycle transitioned to: ${nextStatus}`);
      await loadTrip();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    } finally {
      setUpdating(false);
    }
  };

  const callDriver = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching Trip Telematics & Lifecycle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <BrandLogoHeader size="sm" showSubtitle={false} />
          </View>
          <View style={{ width: 38 }} />
        </View>
        <View style={[styles.loadingCenter, { paddingHorizontal: 32 }]}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <AlertCircle size={32} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
            Trip Record Not Found
          </Text>
          <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            The requested trip details could not be retrieved from the fleet dispatch ledger.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#F05A22', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            onPress={onBack}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Back to Trips</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = trip.tripStatus;
  const isCompleted = currentStatus === 'COMPLETED';

  const stages = [
    { key: 'LORRY_ASSIGNED', label: 'Lorry Allocated' },
    { key: 'AT_LOADING', label: 'At Loading Dock' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
    { key: 'AT_UNLOADING', label: 'At Unloading Hub' },
    { key: 'DELIVERED', label: 'Delivered (POD Pending)' },
    { key: 'COMPLETED', label: 'Trip Completed' },
  ];

  const currentIdx = stages.findIndex((s) => s.key === currentStatus);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Clean Professional Top Bar (Unwanted image removed) */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <BrandLogoHeader size="sm" showSubtitle={false} />
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>Trip Execution</Text>
              <Text style={styles.subText}>{trip.id.substring(0, 22)}</Text>
            </View>

            <View style={styles.statusPill}>
              {isCompleted ? (
                <CheckCircle2 size={12} color="#10B981" />
              ) : (
                <Clock size={12} color="#F05A22" />
              )}
              <Text style={[styles.statusText, isCompleted && styles.textCompleted]}>
                {trip.tripStatus}
              </Text>
            </View>
          </View>

          {/* Stepper Progression Card */}
          <View style={styles.stepperCard}>
            <View style={styles.stepperHeaderRow}>
              <Navigation size={14} color="#F05A22" />
              <Text style={styles.stepperCardTitle}>Trip Lifecycle Process</Text>
            </View>
            <Text style={styles.stepperSubtext}>Real-time telematics and dispatch milestone verification</Text>

            <View style={styles.stepperCol}>
              {stages.map((st, idx) => {
                const isPast = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <View key={st.key} style={styles.stepRow}>
                    <View style={styles.stepLeft}>
                      <View
                        style={[
                          styles.stepNode,
                          isPast && styles.nodePast,
                          isCurrent && styles.nodeCurrent,
                        ]}
                      >
                        {isPast && <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={3} />}
                        {isCurrent && <Clock size={12} color="#FFFFFF" />}
                      </View>
                      {idx < stages.length - 1 && (
                        <View style={[styles.stepLine, isPast && styles.linePast]} />
                      )}
                    </View>

                    <View style={styles.stepRight}>
                      <Text
                        style={[
                          styles.stepLabel,
                          isPast && styles.labelPast,
                          isCurrent && styles.labelCurrent,
                        ]}
                      >
                        {st.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Lifecycle Action Buttons */}
          <View style={styles.actionCard}>
            <Text style={styles.actionCardTitle}>TRIP STATUS CONTROLS</Text>

            {updating ? (
              <ActivityIndicator color="#F05A22" style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.buttonStack}>
                {currentStatus === 'LORRY_ASSIGNED' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => advanceTripStatus('AT_LOADING')}
                  >
                    <Text style={styles.actionBtnText}>1. Confirm Lorry at Loading Dock</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {currentStatus === 'AT_LOADING' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => advanceTripStatus('IN_TRANSIT')}
                  >
                    <Text style={styles.actionBtnText}>2. Dispatch Shipment (In Transit)</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {currentStatus === 'IN_TRANSIT' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => advanceTripStatus('AT_UNLOADING')}
                  >
                    <Text style={styles.actionBtnText}>3. Mark Arrived at Destination Hub</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {currentStatus === 'AT_UNLOADING' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => advanceTripStatus('DELIVERED')}
                  >
                    <Text style={styles.actionBtnText}>4. Confirm Unloading (Delivered)</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {currentStatus === 'DELIVERED' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => advanceTripStatus('COMPLETED')}
                  >
                    <Text style={styles.actionBtnText}>5. Complete Trip & Settle Freight</Text>
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}

                {currentStatus === 'COMPLETED' && (
                  <View style={styles.completedNotice}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <Text style={styles.completedNoticeText}>
                      Trip execution completed and payment settled.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Vehicle & Driver Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ASSIGNED VEHICLE & PILOT</Text>
            </View>

            <View style={styles.gridCol}>
              <View style={styles.gridRow}>
                <Text style={styles.label}>Vehicle Plate:</Text>
                <Text style={styles.valGold}>{trip.vehicle?.registrationNumber || 'Pending Assignment'}</Text>
              </View>

              <View style={styles.gridRow}>
                <Text style={styles.label}>Driver Name:</Text>
                <Text style={styles.valWhite}>{trip.driver?.fullName || 'Driver Allocation Pending'}</Text>
              </View>

              <View style={styles.gridRow}>
                <Text style={styles.label}>Licence Number:</Text>
                <Text style={styles.valWhite}>{trip.driver?.licenceNumber || 'Not Available'}</Text>
              </View>
            </View>

            {trip.driver?.mobile && (
              <TouchableOpacity
                style={styles.callDriverBtn}
                onPress={() => callDriver(trip.driver.mobile)}
                activeOpacity={0.8}
              >
                <Phone size={14} color="#FFFFFF" />
                <Text style={styles.callDriverText}>Call Driver: {trip.driver.mobile}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Consignment Route Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNMENT ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeStop}>
                <View style={styles.dotGold} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{trip.pickupAddress}</Text>
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStop}>
                <View style={styles.dotGreen} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>DELIVERY DESTINATION</Text>
                  <Text style={styles.stopAddress}>{trip.destinationAddress}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Documents CTA */}
          <TouchableOpacity
            style={styles.docsBtn}
            onPress={() => onViewDocuments(trip.id)}
            activeOpacity={0.85}
          >
            <FileText size={16} color="#F05A22" />
            <Text style={styles.docsBtnText}>Trip Documents & Proof of Delivery (POD)</Text>
            <ArrowRight size={16} color="#F05A22" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#172B4D',
    marginTop: 12,
    fontSize: 13,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  topBarCenter: {
    alignItems: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  subText: {
    color: '#64748B',
    fontSize: 11,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
  },
  textCompleted: {
    color: '#10B981',
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stepperCardTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stepperSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 14,
  },
  stepperCol: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepLeft: {
    alignItems: 'center',
    width: 28,
  },
  stepNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePast: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  nodeCurrent: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: '#F1F5F9',
  },
  linePast: {
    backgroundColor: '#10B981',
  },
  stepRight: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 16,
  },
  stepLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  labelPast: {
    color: '#0F172A',
    fontWeight: '700',
  },
  labelCurrent: {
    color: '#F05A22',
    fontWeight: '800',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 14,
    marginBottom: 12,
  },
  actionCardTitle: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  buttonStack: {
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#F05A22',
    height: 46,
    borderRadius: 23,
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
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    padding: 12,
  },
  completedNoticeText: {
    color: '#047857',
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
    marginBottom: 10,
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
  gridCol: {
    gap: 6,
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  valWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  valGold: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '800',
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    borderRadius: 8,
    paddingVertical: 9,
  },
  callDriverText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  routeCol: {
    gap: 8,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  routeDivider: {
    width: 2,
    height: 14,
    backgroundColor: '#F1F5F9',
    marginLeft: 3,
  },
  stopTextWrap: {
    flex: 1,
  },
  stopLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  stopAddress: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  docsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 14,
    marginTop: 2,
  },
  docsBtnText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
});
