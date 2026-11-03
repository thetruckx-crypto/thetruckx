import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  X,
  Package,
  FileText,
  CheckCircle2,
  Truck,
  Users,
  UserCheck,
  Navigation,
  FileCheck,
  User,
  ShieldCheck,
  BarChart3,
  Headphones,
  ChevronRight,
  Building2,
} from 'lucide-react-native';

interface VendorOperationsHubModalProps {
  visible: boolean;
  onClose: () => void;
  vendorName: string;
  companyName: string;
  metrics: {
    availableReqs: number;
    activeQuotes: number;
    awardedBookings: number;
    activeTrips: number;
    fleetCount: number;
    driversCount: number;
  };
  onBrowseRequirements: () => void;
  onViewMyQuotations: () => void;
  onViewAwardedBookings: () => void;
  onViewFleet: () => void;
  onViewDrivers: () => void;
  onAssignFleet: () => void;
  onViewTrips: () => void;
  onViewTripDocuments: () => void;
  onOpenProfile?: () => void;
  onViewVerificationStatus: () => void;
  onOpenReports: () => void;
  onOpenSupport?: () => void;
}

export const VendorOperationsHubModal: React.FC<VendorOperationsHubModalProps> = ({
  visible,
  onClose,
  vendorName,
  companyName,
  metrics,
  onBrowseRequirements,
  onViewMyQuotations,
  onViewAwardedBookings,
  onViewFleet,
  onViewDrivers,
  onAssignFleet,
  onViewTrips,
  onViewTripDocuments,
  onOpenProfile,
  onViewVerificationStatus,
  onOpenReports,
  onOpenSupport,
}) => {
  const handleAction = (callback: () => void) => {
    onClose();
    setTimeout(() => {
      callback();
    }, 150);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />

        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerSub}>CARRIER CONTROL</Text>
            <Text style={styles.headerTitle}>Vendor Operations Hub</Text>
            <Text style={styles.headerVendor} numberOfLines={1}>
              {companyName || vendorName || 'Authorized Transporter'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Close Operations Hub"
            activeOpacity={0.7}
          >
            <X size={20} color="#0D1E3A" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Freight & Orders */}
          <Text style={styles.sectionHeader}>FREIGHT & ORDERS</Text>
          <View style={styles.gridSection}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onBrowseRequirements)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FFF4EE' }]}>
                <Package size={22} color="#FD5C15" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Browse Available RFQs</Text>
                  {metrics.availableReqs > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{metrics.availableReqs}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  View and quote on open freight requirements from verified corporate clients.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewMyQuotations)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#F0F9FF' }]}>
                <FileText size={22} color="#0284C7" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>My Quotations & Bids</Text>
                  {metrics.activeQuotes > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#0284C7' }]}>
                      <Text style={styles.badgeText}>{metrics.activeQuotes}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  Track submitted quotations, pending bids, and rate negotiation statuses.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewAwardedBookings)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
                <CheckCircle2 size={22} color="#16A34A" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Awarded Bookings</Text>
                  {metrics.awardedBookings > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#16A34A' }]}>
                      <Text style={styles.badgeText}>{metrics.awardedBookings}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  Confirmed consignments won by your firm ready for fleet dispatch.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Section 2: Fleet & Logistics Operations */}
          <Text style={styles.sectionHeader}>FLEET & DISPATCH OPERATIONS</Text>
          <View style={styles.gridSection}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewFleet)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FFF4EE' }]}>
                <Truck size={22} color="#FD5C15" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Fleet Management</Text>
                  {metrics.fleetCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{metrics.fleetCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  Manage commercial vehicles, RC books, fitness certificates, and insurance.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewDrivers)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Users size={22} color="#7C3AED" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Driver Roster</Text>
                  {metrics.driversCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#7C3AED' }]}>
                      <Text style={styles.badgeText}>{metrics.driversCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  Maintain driver profiles, driving license verifications, and pilot assignments.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onAssignFleet)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
                <UserCheck size={22} color="#059669" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Assign Fleet & Drivers</Text>
                <Text style={styles.cardDesc}>
                  Dispatch specific trucks and licensed drivers to awarded bookings.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewTrips)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Navigation size={22} color="#D97706" />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Active Trips & Tracking</Text>
                  {metrics.activeTrips > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#D97706' }]}>
                      <Text style={styles.badgeText}>{metrics.activeTrips}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc}>
                  Live transit tracking, GPS checkpoints, and milestone updates.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewTripDocuments)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
                <FileCheck size={22} color="#2563EB" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Trip Documents & POD</Text>
                <Text style={styles.cardDesc}>
                  Upload and verify e-Way bills, Lorry Receipts (LR), and Proof of Delivery.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Section 3: Compliance & Intelligence */}
          <Text style={styles.sectionHeader}>COMPLIANCE & ENTERPRISE TOOLS</Text>
          <View style={styles.gridSection}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onViewVerificationStatus)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FFFBEB' }]}>
                <ShieldCheck size={22} color="#B45309" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Transporter KYC & Audit Status</Text>
                <Text style={styles.cardDesc}>
                  Compliance approval status, GSTIN/PAN records, and audit verifications.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAction(onOpenReports)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FDF4FF' }]}>
                <BarChart3 size={22} color="#C026D3" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Operational Reports & Analytics</Text>
                <Text style={styles.cardDesc}>
                  Carrier win rates, dispatched tonnage, completed trips, and revenue metrics.
                </Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            {onOpenProfile && (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleAction(onOpenProfile)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: '#F1F5F9' }]}>
                  <Building2 size={22} color="#334155" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Transporter Business Profile</Text>
                  <Text style={styles.cardDesc}>
                    Registered office address, contact persons, phone numbers, and credentials.
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {onOpenSupport && (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleAction(onOpenSupport)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: '#FFF4EE' }]}>
                  <Headphones size={22} color="#FD5C15" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Help & Support Helpline</Text>
                  <Text style={styles.cardDesc}>
                    24/7 carrier support desk for load inquiries, route issues, and assistance.
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FD5C15',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerVendor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#64748B',
    marginBottom: 10,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  gridSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 12.5,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 17,
  },
  badge: {
    backgroundColor: '#FD5C15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default VendorOperationsHubModal;
