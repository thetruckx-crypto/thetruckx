import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Truck,
  Package,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Users,
  Navigation,
  LogOut,
  Bell,
  RefreshCw,
  PlusCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';
import { AuthSessionData } from '../services/authService';
import { supabase } from '../supabase';

interface VendorDashboardScreenProps {
  session: AuthSessionData | null;
  onLogout: () => void;
  onBrowseRequirements: () => void;
  onViewRequirementDetails: (reqId: string) => void;
  onViewMyQuotations: () => void;
  onViewAwardedBookings: () => void;
  onViewFleet: () => void;
  onViewDrivers: () => void;
  onViewTrips: () => void;
  onViewVerificationStatus: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

export const VendorDashboardScreen: React.FC<VendorDashboardScreenProps> = ({
  session,
  onLogout,
  onBrowseRequirements,
  onViewRequirementDetails,
  onViewMyQuotations,
  onViewAwardedBookings,
  onViewFleet,
  onViewDrivers,
  onViewTrips,
  onViewVerificationStatus,
  onOpenNotifications,
  onOpenProfile,
}) => {
  const vendorId = session?.userId || '';
  const vendorName = session?.companyName || session?.fullName || 'Transporter';

  const [vendorStatus, setVendorStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [metrics, setMetrics] = useState({
    availableReqs: 0,
    activeQuotes: 0,
    awardedBookings: 0,
    activeTrips: 0,
    fleetCount: 0,
  });
  const [recentReqs, setRecentReqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Fetch vendor verification state
      const statusRes = await vendorService.getVendorVerificationStatus(vendorId);
      setVendorStatus(statusRes.status);

      // 2. Fetch parallel operational records
      const [reqs, quotes, bookings, trips, vehicles] = await Promise.all([
        vendorService.getAvailableRequirements(vendorId),
        vendorService.getMyQuotations(vendorId),
        vendorService.getAwardedBookings(vendorId),
        vendorService.getVendorTrips(vendorId),
        vendorService.getVendorVehicles(vendorId),
      ]);

      const activeTripsCount = trips.filter(
        (t) => t.tripStatus !== 'COMPLETED' && t.tripStatus !== 'CANCELLED'
      ).length;

      setMetrics({
        availableReqs: reqs.length,
        activeQuotes: quotes.length,
        awardedBookings: bookings.length,
        activeTrips: activeTripsCount,
        fleetCount: vehicles.length,
      });

      setRecentReqs(reqs.slice(0, 4));
    } catch (err) {
      console.warn('Dashboard load notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadDashboardData();

    // Live Supabase Realtime sync for vendor trips, quotations, and fleet
    const channel = supabase
      .channel('vendor_dashboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const isApproved = vendorStatus === 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F05A22" />
        }
      >
        {/* Top Scenic Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={190} />
          
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <Text style={styles.portalTag}>CARRIER CONTROL TOWER</Text>
              <Text style={styles.vendorTitle} numberOfLines={1}>{vendorName}</Text>
            </View>

            <View style={styles.headerRight}>
              {onOpenNotifications && (
                <TouchableOpacity style={styles.iconCircle} onPress={onOpenNotifications}>
                  <Bell size={18} color="#64748B" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconCircle} onPress={onLogout}>
                <LogOut size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Content Wrap */}
        <View style={styles.contentWrap}>
          {/* Status Alert if not yet approved */}
          {!isApproved && (
            <TouchableOpacity
              style={styles.restrictedBanner}
              onPress={onViewVerificationStatus}
              activeOpacity={0.85}
            >
              <ShieldAlert size={18} color="#F59E0B" />
              <View style={styles.restrictedTextWrap}>
                <Text style={styles.restrictedTitle}>
                  {vendorStatus === 'PENDING' ? 'Account Verification in Progress' : 'Clarification Required'}
                </Text>
                <Text style={styles.restrictedSub}>
                  Quotation and dispatch features unlock once KYC documents are approved. Tap to view status.
                </Text>
              </View>
              <ArrowRight size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}

          {/* Operational Metrics Cards */}
          <View style={styles.metricsGrid}>
            <TouchableOpacity
              style={styles.metricCard}
              onPress={onBrowseRequirements}
              activeOpacity={0.8}
            >
              <View style={styles.metricIconWrap}>
                <Package size={18} color="#F05A22" />
              </View>
              <Text style={styles.metricValue}>{metrics.availableReqs}</Text>
              <Text style={styles.metricLabel}>Available RFQs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              onPress={onViewMyQuotations}
              activeOpacity={0.8}
            >
              <View style={styles.metricIconWrap}>
                <FileText size={18} color="#38BDF8" />
              </View>
              <Text style={styles.metricValue}>{metrics.activeQuotes}</Text>
              <Text style={styles.metricLabel}>My Quotations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              onPress={onViewAwardedBookings}
              activeOpacity={0.8}
            >
              <View style={styles.metricIconWrap}>
                <CheckCircle2 size={18} color="#10B981" />
              </View>
              <Text style={styles.metricValue}>{metrics.awardedBookings}</Text>
              <Text style={styles.metricLabel}>Awarded Bookings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metricCard}
              onPress={onViewTrips}
              activeOpacity={0.8}
            >
              <View style={styles.metricIconWrap}>
                <Navigation size={18} color="#F45325" />
              </View>
              <Text style={styles.metricValue}>{metrics.activeTrips}</Text>
              <Text style={styles.metricLabel}>Active Trips</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Hub Shortcuts */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>FLEET & OPERATIONS SHORTCUTS</Text>
            <View style={styles.shortcutsRow}>
              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={onViewFleet}
                activeOpacity={0.8}
              >
                <Truck size={16} color="#F05A22" />
                <Text style={styles.shortcutText}>Fleet ({metrics.fleetCount})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={onViewDrivers}
                activeOpacity={0.8}
              >
                <Users size={16} color="#F05A22" />
                <Text style={styles.shortcutText}>Drivers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutBtn}
                onPress={onViewAwardedBookings}
                activeOpacity={0.8}
              >
                <PlusCircle size={16} color="#F05A22" />
                <Text style={styles.shortcutText}>Assign Fleet</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Open Requirements Section */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>OPEN FREIGHT LOADS (LIVE RFQS)</Text>
              <TouchableOpacity onPress={onBrowseRequirements}>
                <Text style={styles.seeAllText}>View All ({metrics.availableReqs})</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#F05A22" style={{ marginVertical: 20 }} />
            ) : recentReqs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No active transport requirements currently open for bidding.</Text>
              </View>
            ) : (
              <View style={styles.reqsCol}>
                {recentReqs.map((req) => (
                  <TouchableOpacity
                    key={req.id}
                    style={styles.reqCard}
                    onPress={() => onViewRequirementDetails(req.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.reqTopRow}>
                      <View style={styles.routePill}>
                        <Text style={styles.routePillText}>
                          {req.pickupAddress?.split(',')[0] || 'Origin'} → {req.destinationAddress?.split(',')[0] || 'Dest'}
                        </Text>
                      </View>
                      <View style={styles.capacityBadge}>
                        <Text style={styles.capacityText}>{req.requiredCapacityMt} MT</Text>
                      </View>
                    </View>

                    <Text style={styles.materialText}>{req.materialType || 'Industrial Cargo'}</Text>
                    <Text style={styles.vehicleReqText}>Truck: {req.vehicleType || '32 FT Multi-Axle'}</Text>

                    <View style={styles.reqFooter}>
                      <View style={styles.clientTagWrap}>
                        <Text style={styles.clientTagText}>{req.clientName}</Text>
                      </View>
                      <View style={styles.actionWrap}>
                        <Text style={styles.actionText}>{isApproved ? 'Submit Quote' : 'View Details'}</Text>
                        <ArrowRight size={14} color="#F05A22" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
  headerBar: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  portalTag: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  vendorTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
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
  restrictedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  restrictedTextWrap: {
    flex: 1,
  },
  restrictedTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  restrictedSub: {
    color: '#FDE68A',
    fontSize: 11,
    lineHeight: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    color: '#172B4D',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionWrap: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  seeAllText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    paddingVertical: 10,
  },
  shortcutText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '700',
  },
  reqsCol: {
    gap: 10,
  },
  reqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  reqTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  routePillText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
  capacityBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  capacityText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  materialText: {
    color: '#172B4D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  vehicleReqText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 10,
  },
  reqFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  clientTagWrap: {},
  clientTagText: {
    color: '#64748B',
    fontSize: 11,
  },
  actionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
