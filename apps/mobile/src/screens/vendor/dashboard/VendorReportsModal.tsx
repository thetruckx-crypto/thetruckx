import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import {
  X,
  TrendingUp,
  FileText,
  Truck,
  CheckCircle2,
  Navigation,
  ShieldCheck,
  RefreshCw,
  Award,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';

interface VendorReportsModalProps {
  visible: boolean;
  vendorId: string;
  vendorName: string;
  onClose: () => void;
}

export const VendorReportsModal: React.FC<VendorReportsModalProps> = ({
  visible,
  vendorId,
  vendorName,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalQuotations: 0,
    awardedBookings: 0,
    winRate: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    totalTrips: 0,
    completedTrips: 0,
    activeTrips: 0,
    totalTonnageMt: 0,
    verificationStatus: 'PENDING',
  });

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const [quotes, bookings, trips, vehicles, drivers, statusRes] = await Promise.all([
        vendorService.getMyQuotations(vendorId),
        vendorService.getAwardedBookings(vendorId),
        vendorService.getVendorTrips(vendorId),
        vendorService.getVendorVehicles(vendorId),
        vendorService.getVendorDrivers(vendorId),
        vendorService.getVendorVerificationStatus(vendorId),
      ]);

      const completed = trips.filter((t) => t.tripStatus === 'COMPLETED').length;
      const active = trips.filter(
        (t) => t.tripStatus !== 'COMPLETED' && t.tripStatus !== 'CANCELLED'
      ).length;

      const totalTonnage = trips.reduce(
        (sum, t) => sum + (Number(t.capacityMt) || Number(t.requiredCapacityMt) || 0),
        0
      );

      const winRateCalc =
        quotes.length > 0 ? Math.round((bookings.length / quotes.length) * 100) : 0;

      setStats({
        totalQuotations: quotes.length,
        awardedBookings: bookings.length,
        winRate: winRateCalc,
        totalVehicles: vehicles.length,
        totalDrivers: drivers.length,
        totalTrips: trips.length,
        completedTrips: completed,
        activeTrips: active,
        totalTonnageMt: totalTonnage,
        verificationStatus: statusRes.status,
      });
    } catch (err) {
      console.warn('Analytics loading notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (visible) {
      loadAnalytics();
    }
  }, [visible, loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerSubtitle}>CARRIER PERFORMANCE</Text>
            <Text style={styles.headerTitle}>Operational Reports</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close Reports">
            <X size={20} color="#101B3D" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" />}
        >
          {/* Vendor Overview Card */}
          <View style={styles.carrierOverviewCard}>
            <View style={styles.carrierRow}>
              <View style={styles.carrierIconWrap}>
                <TrendingUp size={22} color="#FF5A1F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.carrierName}>{vendorName || 'Transporter Carrier'}</Text>
                <Text style={styles.carrierMeta}>Live Analytics & Operational Intelligence</Text>
              </View>
              <View style={[styles.statusBadge, stats.verificationStatus === 'APPROVED' ? styles.statusApproved : styles.statusPending]}>
                <Text style={[styles.statusBadgeText, stats.verificationStatus === 'APPROVED' ? styles.textApproved : styles.textPending]}>
                  {stats.verificationStatus}
                </Text>
              </View>
            </View>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#FF5A1F" />
              <Text style={styles.loadingText}>Compiling carrier operational metrics...</Text>
            </View>
          ) : (
            <>
              {/* Freight Bidding & Win Rate */}
              <Text style={styles.sectionTitle}>BIDDING & COMMERCIAL EFFICIENCY</Text>
              <View style={styles.gridRow}>
                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#F0F7FF' }]}>
                    <FileText size={18} color="#168BEE" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.totalQuotations}</Text>
                  <Text style={styles.metricLabel}>Total Quotes Submitted</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#ECFDF3' }]}>
                    <Award size={18} color="#12B76A" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.awardedBookings}</Text>
                  <Text style={styles.metricLabel}>Bookings Awarded</Text>
                </View>
              </View>

              <View style={styles.winRateCard}>
                <View style={styles.winRateRow}>
                  <View>
                    <Text style={styles.winRateTitle}>Commercial Award Conversion</Text>
                    <Text style={styles.winRateSub}>Ratio of accepted bids across corporate shippers</Text>
                  </View>
                  <Text style={styles.winRatePercent}>{stats.winRate}%</Text>
                </View>
              </View>

              {/* Transit & Operational Execution */}
              <Text style={styles.sectionTitle}>TRANSIT & FLEET PERFORMANCE</Text>
              <View style={styles.gridRow}>
                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#FFF4EE' }]}>
                    <Truck size={18} color="#FF5A1F" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.totalVehicles}</Text>
                  <Text style={styles.metricLabel}>Active Registered Fleet</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#F3E8FF' }]}>
                    <CheckCircle2 size={18} color="#8B5CF6" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.totalDrivers}</Text>
                  <Text style={styles.metricLabel}>Enrolled Pilots & Drivers</Text>
                </View>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#FEF3C7' }]}>
                    <Navigation size={18} color="#D97706" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.activeTrips}</Text>
                  <Text style={styles.metricLabel}>Active In-Transit Trips</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.iconPill, { backgroundColor: '#ECFDF3' }]}>
                    <ShieldCheck size={18} color="#12B76A" />
                  </View>
                  <Text style={styles.metricNumber}>{stats.completedTrips}</Text>
                  <Text style={styles.metricLabel}>Completed Deliveries</Text>
                </View>
              </View>

              {/* Data Integrity Notice */}
              <View style={styles.integrityCard}>
                <Text style={styles.integrityTitle}>Verified Platform Data</Text>
                <Text style={styles.integrityText}>
                  All metrics above reflect authenticated transactions, bookings, and telematics-cleared transit records recorded in the TRUCKS Carrier Network.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF0',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5A1F',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101B3D',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  carrierOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    marginBottom: 20,
  },
  carrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carrierIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101B3D',
  },
  carrierMeta: {
    fontSize: 12,
    color: '#68768A',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusApproved: {
    backgroundColor: '#ECFDF3',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textApproved: {
    color: '#12B76A',
  },
  textPending: {
    color: '#D97706',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101B3D',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#101B3D',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#68768A',
    marginTop: 2,
  },
  winRateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    marginBottom: 16,
  },
  winRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winRateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101B3D',
  },
  winRateSub: {
    fontSize: 11,
    color: '#68768A',
    marginTop: 2,
  },
  winRatePercent: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FF5A1F',
  },
  integrityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  integrityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  integrityText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 13,
    color: '#68768A',
    marginTop: 12,
  },
});
