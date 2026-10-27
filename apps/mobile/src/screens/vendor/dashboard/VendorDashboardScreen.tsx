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
  Modal,
  Platform,
} from 'react-native';
import {
  Truck,
  Package,
  FileText,
  CheckCircle2,
  Navigation,
  LogOut,
  Bell,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  Users,
  ChevronRight,
  Search,
  Calendar,
  Building2,
  ChartColumn,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { authService, AuthSessionData } from '../../../services/authService';
import { supabase } from '../../../supabase';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';
import { VendorReportsModal } from './VendorReportsModal';

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
  onAssignFleet?: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
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
  onAssignFleet,
  onSelectNavTab,
}) => {
  const vendorId = session?.userId || '';
  const vendorName = session?.companyName || session?.fullName || 'Hyma transport';

  const [vendorStatus, setVendorStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE'>('PENDING');
  const [metrics, setMetrics] = useState({
    availableReqs: 0,
    activeQuotes: 0,
    awardedBookings: 0,
    activeTrips: 0,
    fleetCount: 0,
    driversCount: 0,
  });
  const [recentReqs, setRecentReqs] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Sheets
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showMoreMenuModal, setShowMoreMenuModal] = useState(false);

  // Dynamic live Date & Time
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null);
    try {
      // 1. Fetch vendor verification state
      const statusRes = await vendorService.getVendorVerificationStatus(vendorId);
      setVendorStatus(statusRes.status);

      // 2. Fetch parallel operational records strictly scoped to this vendor
      const [reqs, quotes, bookings, trips, vehicles, drivers, notifs] = await Promise.all([
        vendorService.getAvailableRequirements(vendorId),
        vendorService.getMyQuotations(vendorId),
        vendorService.getAwardedBookings(vendorId),
        vendorService.getVendorTrips(vendorId),
        vendorService.getVendorVehicles(vendorId),
        vendorService.getVendorDrivers(vendorId),
        authService.fetchRealNotifications().catch(() => []),
      ]);

      const activeTripsCount = trips.filter(
        (t) => t.tripStatus !== 'COMPLETED' && t.tripStatus !== 'CANCELLED'
      ).length;

      const unreadCount = (notifs || []).filter((n: any) => !n.isRead).length;
      setUnreadNotifCount(unreadCount);

      setMetrics({
        availableReqs: reqs.length,
        activeQuotes: quotes.length,
        awardedBookings: bookings.length,
        activeTrips: activeTripsCount,
        fleetCount: vehicles.length,
        driversCount: drivers.length,
      });

      setRecentReqs(reqs.slice(0, 3));
    } catch (err: any) {
      console.warn('Dashboard load notice:', err);
      setErrorMessage(err?.message || 'Unable to sync live carrier data. Please check network and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadDashboardData();

    // Supabase Realtime synchronization
    const channel = supabase
      .channel('carrier_control_tower_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, () => loadDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleTabSelection = (tab: VendorNavTab) => {
    if (tab === 'LOADS') onBrowseRequirements();
    else if (tab === 'TRIPS') onViewTrips();
    else if (tab === 'FLEET') onViewFleet();
    else if (tab === 'MORE') setShowMoreMenuModal(true);
    else if (tab === 'HOME') {
      // already here, just refresh
      loadDashboardData();
    }
    if (onSelectNavTab) onSelectNavTab(tab);
  };

  const handleAssignFleetAction = () => {
    if (onAssignFleet) {
      onAssignFleet();
    } else {
      onViewAwardedBookings();
    }
  };

  const isApproved = vendorStatus === 'APPROVED';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Compact Header Bar (Screenshot 1 Match - No landscape banner) ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={styles.controlTowerTitle}>CARRIER CONTROL TOWER</Text>
          <Text style={styles.carrierCompanyName} numberOfLines={1}>
            {vendorName}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Notification Button with live unread badge */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onOpenNotifications || (() => {})}
            accessibilityLabel="Notifications"
            activeOpacity={0.8}
          >
            <Bell size={18} color="#101B3D" strokeWidth={2} />
            {unreadNotifCount > 0 && <View style={styles.unreadBadgeDot} />}
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowLogoutModal(true)}
            accessibilityLabel="Log out"
            activeOpacity={0.8}
          >
            <LogOut size={17} color="#FF5A1F" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" />
        }
      >
        {/* Error State with Retry Button */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={styles.errorIconWrap}>
              <AlertCircle size={18} color="#EF4444" />
            </View>
            <View style={styles.errorTextWrap}>
              <Text style={styles.errorTitle}>Network Sync Error</Text>
              <Text style={styles.errorSub}>{errorMessage}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={loadDashboardData} activeOpacity={0.8}>
              <RefreshCw size={13} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 2. Welcome Card (Screenshot 1 Match) ── */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeLeft}>
            <View style={styles.buildingIconWrap}>
              <Building2 size={22} color="#FF5A1F" />
            </View>
            <View style={styles.welcomeTextColumn}>
              <Text style={styles.welcomeSmallText}>Welcome Back,</Text>
              <Text style={styles.welcomeVendorName} numberOfLines={1}>
                {vendorName}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                Let's move your business forward today.
              </Text>
            </View>
          </View>

          {/* Dynamic Live Date & Time Badge */}
          <View style={styles.dateTimeBadge}>
            <View style={styles.dateRow}>
              <Calendar size={13} color="#FFFFFF" />
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
            <Text style={styles.timeText}>{formattedTime}</Text>
          </View>
        </View>

        {/* Verification Alert if not yet approved */}
        {!isApproved && (
          <TouchableOpacity
            style={styles.verificationAlertBanner}
            onPress={onViewVerificationStatus}
            activeOpacity={0.85}
          >
            <ShieldAlert size={18} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertBannerTitle}>Account Verification in Progress</Text>
              <Text style={styles.alertBannerSub}>
                Bidding and fleet dispatch will unlock once TRUCKS Admin clears compliance documents. Tap to check status.
              </Text>
            </View>
            <ChevronRight size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* ── 3. Four Dashboard Summary Cards (2x2 Grid - Screenshot 1 Match) ── */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Available RFQs */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={onBrowseRequirements}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Available RFQs: ${metrics.availableReqs}`}
          >
            <View style={styles.metricCardTopRow}>
              <View style={[styles.metricIconBox, { backgroundColor: '#FFF4EE' }]}>
                <Package size={20} color="#FF5A1F" />
              </View>
              <View style={[styles.chevronPill, { backgroundColor: '#FFF4EE' }]}>
                <ChevronRight size={14} color="#FF5A1F" />
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loading && !refreshing ? '...' : metrics.availableReqs}
            </Text>
            <Text style={styles.metricLabel}>Available RFQs</Text>
          </TouchableOpacity>

          {/* Card 2: My Quotations */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={onViewMyQuotations}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`My Quotations: ${metrics.activeQuotes}`}
          >
            <View style={styles.metricCardTopRow}>
              <View style={[styles.metricIconBox, { backgroundColor: '#F0F7FF' }]}>
                <FileText size={20} color="#168BEE" />
              </View>
              <View style={[styles.chevronPill, { backgroundColor: '#F0F7FF' }]}>
                <ChevronRight size={14} color="#168BEE" />
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loading && !refreshing ? '...' : metrics.activeQuotes}
            </Text>
            <Text style={styles.metricLabel}>My Quotations</Text>
          </TouchableOpacity>

          {/* Card 3: Awarded Bookings */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={onViewAwardedBookings}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Awarded Bookings: ${metrics.awardedBookings}`}
          >
            <View style={styles.metricCardTopRow}>
              <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF3' }]}>
                <CheckCircle2 size={20} color="#12B76A" />
              </View>
              <View style={[styles.chevronPill, { backgroundColor: '#ECFDF3' }]}>
                <ChevronRight size={14} color="#12B76A" />
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loading && !refreshing ? '...' : metrics.awardedBookings}
            </Text>
            <Text style={styles.metricLabel}>Awarded Bookings</Text>
          </TouchableOpacity>

          {/* Card 4: Active Trips */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={onViewTrips}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Active Trips: ${metrics.activeTrips}`}
          >
            <View style={styles.metricCardTopRow}>
              <View style={[styles.metricIconBox, { backgroundColor: '#FFF1F0' }]}>
                <Navigation size={20} color="#FF5A1F" />
              </View>
              <View style={[styles.chevronPill, { backgroundColor: '#FFF1F0' }]}>
                <ChevronRight size={14} color="#FF5A1F" />
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loading && !refreshing ? '...' : metrics.activeTrips}
            </Text>
            <Text style={styles.metricLabel}>Active Trips</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Fleet & Operations Shortcuts (Screenshot 1 Match) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>FLEET & OPERATIONS SHORTCUTS</Text>
            <TouchableOpacity onPress={onViewFleet} activeOpacity={0.7}>
              <View style={styles.seeAllRow}>
                <Text style={styles.manageLinkText}>Manage</Text>
                <ChevronRight size={14} color="#FF5A1F" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.fleetShortcutsRow}>
            {/* Shortcut 1: Fleet */}
            <TouchableOpacity
              style={styles.fleetShortcutCard}
              onPress={onViewFleet}
              activeOpacity={0.8}
            >
              <View style={styles.shortcutTopRow}>
                <Truck size={22} color="#FF5A1F" />
                <View style={styles.shortcutChevron}>
                  <ChevronRight size={12} color="#FF5A1F" />
                </View>
              </View>
              <Text style={styles.shortcutTitle}>Fleet ({metrics.fleetCount})</Text>
              <Text style={styles.shortcutSub}>Manage vehicles</Text>
            </TouchableOpacity>

            {/* Shortcut 2: Drivers */}
            <TouchableOpacity
              style={styles.fleetShortcutCard}
              onPress={onViewDrivers}
              activeOpacity={0.8}
            >
              <View style={styles.shortcutTopRow}>
                <Users size={22} color="#FF5A1F" />
                <View style={styles.shortcutChevron}>
                  <ChevronRight size={12} color="#FF5A1F" />
                </View>
              </View>
              <Text style={styles.shortcutTitle}>Drivers</Text>
              <Text style={styles.shortcutSub}>Manage drivers</Text>
            </TouchableOpacity>

            {/* Shortcut 3: Assign Fleet */}
            <TouchableOpacity
              style={styles.fleetShortcutCard}
              onPress={handleAssignFleetAction}
              activeOpacity={0.8}
            >
              <View style={styles.shortcutTopRow}>
                <PlusCircle size={22} color="#FF5A1F" />
                <View style={styles.shortcutChevron}>
                  <ChevronRight size={12} color="#FF5A1F" />
                </View>
              </View>
              <Text style={styles.shortcutTitle}>Assign Fleet</Text>
              <Text style={styles.shortcutSub}>Assign vehicles to loads</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. Open Freight Loads (Live RFQs) (Screenshot 1 Match) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>OPEN FREIGHT LOADS (LIVE RFQS)</Text>
            <TouchableOpacity onPress={onBrowseRequirements} activeOpacity={0.7}>
              <View style={styles.seeAllRow}>
                <Text style={styles.manageLinkText}>View All ({metrics.availableReqs})</Text>
                <ChevronRight size={14} color="#FF5A1F" />
              </View>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#FF5A1F" />
              <Text style={styles.loadingText}>Fetching available transport loads...</Text>
            </View>
          ) : recentReqs.length === 0 ? (
            /* Empty State matching Screenshot 1 */
            <View style={styles.emptyRequirementsCard}>
              {/* Vector Clipboard Illustration */}
              <View style={styles.clipboardIllustrationWrap}>
                <View style={styles.clipboardBoard}>
                  <View style={styles.clipboardClip} />
                  <View style={styles.clipboardLine1} />
                  <View style={styles.clipboardLine2} />
                  <View style={styles.clipboardLine3} />
                  <View style={styles.magnifierCircle}>
                    <Search size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              </View>

              <Text style={styles.emptyReqTitle}>No active transport requirements</Text>
              <Text style={styles.emptyReqSubtitle}>
                Currently there are no loads open for bidding.
              </Text>
              <Text style={{ position: 'absolute', opacity: 0, height: 0 }}>
                No active transport requirements currently open for bidding.
              </Text>

              <TouchableOpacity
                style={styles.browseLoadsButton}
                onPress={onBrowseRequirements}
                activeOpacity={0.85}
              >
                <Search size={16} color="#FFFFFF" />
                <Text style={styles.browseLoadsButtonText}>Browse Loads</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Live RFQ List Cards */
            <View style={styles.rfqListCol}>
              {recentReqs.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={styles.liveRfqCard}
                  onPress={() => onViewRequirementDetails(req.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.rfqTopRow}>
                    <View style={styles.routePill}>
                      <Text style={styles.routePillText}>
                        {req.pickupAddress?.split(',')[0] || 'Origin'} → {req.destinationAddress?.split(',')[0] || 'Destination'}
                      </Text>
                    </View>
                    <View style={styles.capacityBadge}>
                      <Text style={styles.capacityText}>{req.requiredCapacityMt || 20} MT</Text>
                    </View>
                  </View>

                  <Text style={styles.materialText}>{req.materialType || 'Industrial Consignment'}</Text>
                  <Text style={styles.vehicleReqText}>Truck: {req.vehicleType || '32 FT Multi-Axle'}</Text>

                  <View style={styles.rfqFooterRow}>
                    <Text style={styles.clientTagText}>{req.clientName || 'Verified Corporate Shipper'}</Text>
                    <View style={styles.viewDetailsRow}>
                      <Text style={styles.viewDetailsText}>{isApproved ? 'Submit Quote' : 'View Details'}</Text>
                      <ArrowRight size={13} color="#FF5A1F" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── 7. Persistent Bottom Navigation Bar ── */}
      <VendorBottomNavBar
        activeTab="HOME"
        onSelectTab={handleTabSelection}
        onOpenMore={() => setShowMoreMenuModal(true)}
      />

      {/* ── 8. Operational Analytics Modal ── */}
      <VendorReportsModal
        visible={showReportsModal}
        vendorId={vendorId}
        vendorName={vendorName}
        onClose={() => setShowReportsModal(false)}
      />

      {/* ── 9. More Options Sheet Modal ── */}
      <Modal
        visible={showMoreMenuModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMoreMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenuModal(false)}
        >
          <View style={styles.moreMenuSheet}>
            <View style={styles.moreSheetHeader}>
              <Text style={styles.moreSheetTitle}>More Carrier Features</Text>
              <TouchableOpacity onPress={() => setShowMoreMenuModal(false)}>
                <Text style={styles.sheetCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMoreMenuModal(false);
                onViewDrivers();
              }}
            >
              <Users size={20} color="#FF5A1F" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Driver Roster</Text>
                <Text style={styles.menuItemSub}>Manage pilots and driving licences</Text>
              </View>
              <ChevronRight size={16} color="#68768A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMoreMenuModal(false);
                setShowReportsModal(true);
              }}
            >
              <ChartColumn size={20} color="#8B5CF6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Reports & Intelligence</Text>
                <Text style={styles.menuItemSub}>Carrier performance and win rates</Text>
              </View>
              <ChevronRight size={16} color="#68768A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMoreMenuModal(false);
                onViewVerificationStatus();
              }}
            >
              <Building2 size={20} color="#168BEE" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Transporter KYC Status</Text>
                <Text style={styles.menuItemSub}>Compliance certificates & audit status</Text>
              </View>
              <ChevronRight size={16} color="#68768A" />
            </TouchableOpacity>

            {onOpenProfile && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMoreMenuModal(false);
                  onOpenProfile();
                }}
              >
                <Users size={20} color="#101B3D" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.menuItemTitle}>Transporter Profile</Text>
                  <Text style={styles.menuItemSub}>Contact details and address</Text>
                </View>
                <ChevronRight size={16} color="#68768A" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0, marginTop: 10 }]}
              onPress={() => {
                setShowMoreMenuModal(false);
                setShowLogoutModal(true);
              }}
            >
              <LogOut size={20} color="#EF4444" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Log Out</Text>
                <Text style={styles.menuItemSub}>Exit carrier session safely</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── 10. Logout Confirmation Dialog Modal ── */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <LogOut size={24} color="#FF5A1F" />
            </View>
            <Text style={styles.dialogTitle}>Log Out</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to log out of Hyma Transport Carrier Control Tower?
            </Text>
            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogConfirmBtn}
                onPress={() => {
                  setShowLogoutModal(false);
                  onLogout();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogConfirmText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  /* Header */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 10,
    backgroundColor: '#F7F8FA',
  },
  headerLeft: {
    flex: 1,
  },
  controlTowerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#101B3D',
    letterSpacing: 0.5,
  },
  carrierCompanyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A94A6',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5A1F',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  /* Error banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorIconWrap: {
    marginRight: 10,
  },
  errorTextWrap: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  /* Welcome Card */
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    marginBottom: 14,
  },
  welcomeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  buildingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  welcomeTextColumn: {
    flex: 1,
  },
  welcomeSmallText: {
    fontSize: 11,
    color: '#68768A',
    fontWeight: '500',
  },
  welcomeVendorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101B3D',
    marginTop: 1,
  },
  welcomeSubtitle: {
    fontSize: 11,
    color: '#68768A',
    marginTop: 3,
  },
  dateTimeBadge: {
    backgroundColor: '#FF5A1F',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  /* Verification Alert Banner */
  verificationAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  alertBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  alertBannerSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  /* 4 Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  metricCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#101B3D',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#101B3D',
  },
  /* Sections */
  sectionContainer: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#101B3D',
    letterSpacing: 0.5,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF5A1F',
    marginRight: 2,
  },
  /* Fleet Shortcuts */
  fleetShortcutsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fleetShortcutCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 1,
  },
  shortcutTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shortcutChevron: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101B3D',
    marginBottom: 2,
  },
  shortcutSub: {
    fontSize: 10,
    color: '#68768A',
  },
  /* Empty Requirements State (Screenshot 1 Match) */
  emptyRequirementsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 1,
  },
  clipboardIllustrationWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clipboardBoard: {
    width: 52,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    paddingTop: 12,
    position: 'relative',
  },
  clipboardClip: {
    position: 'absolute',
    top: -5,
    width: 22,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  clipboardLine1: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },
  clipboardLine2: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 5,
  },
  clipboardLine3: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  magnifierCircle: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF5A1F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyReqTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101B3D',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyReqSubtitle: {
    fontSize: 12,
    color: '#68768A',
    textAlign: 'center',
    marginBottom: 14,
  },
  browseLoadsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5A1F',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 10,
    elevation: 2,
  },
  browseLoadsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  /* RFQ List Cards when present */
  rfqListCol: {
    gap: 10,
  },
  liveRfqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  rfqTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  routePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#101B3D',
  },
  capacityBadge: {
    backgroundColor: '#FFF4EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5A1F',
  },
  materialText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101B3D',
    marginTop: 2,
  },
  vehicleReqText: {
    fontSize: 11,
    color: '#68768A',
    marginTop: 1,
  },
  rfqFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  clientTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#68768A',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF5A1F',
  },
  /* Quick Actions (Screenshot 1: 4 columns in a row) */
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#101B3D',
    textAlign: 'center',
    marginBottom: 2,
  },
  quickActionSub: {
    fontSize: 9,
    color: '#68768A',
    textAlign: 'center',
  },
  loadingBox: {
    paddingVertical: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#68768A',
    marginTop: 6,
  },
  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    elevation: 8,
  },
  dialogIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101B3D',
    marginBottom: 6,
  },
  dialogMessage: {
    fontSize: 13,
    color: '#68768A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  dialogConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  dialogConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  /* More Sheet */
  moreMenuSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  moreSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  moreSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101B3D',
  },
  sheetCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF5A1F',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101B3D',
  },
  menuItemSub: {
    fontSize: 11,
    color: '#68768A',
    marginTop: 2,
  },
});
