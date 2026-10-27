import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Share,
  Clipboard,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Calendar,
  Package,
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle2,
  Share2,
  MoreVertical,
  Edit3,
  Copy,
  XCircle,
  Bell,
  ChevronRight,
  X,
  FileCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { clientService } from '../../../services/clientService';
import { buildGoogleMapsDirectionsUrl } from '../../../utils/googleMapsUtil';

interface RequirementDetailsScreenProps {
  requirementId: string;
  clientId?: string;
  onBack: () => void;
  onViewQuotations: (requirementId: string) => void;
  onEditRequirement?: (requirement: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

export const RequirementDetailsScreen: React.FC<RequirementDetailsScreenProps> = ({
  requirementId,
  clientId,
  onBack,
  onViewQuotations,
  onEditRequirement,
  onViewBooking,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await clientService.fetchRequirementById(requirementId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = async () => {
    if (!data) return;
    const origin = data.pickup_city || data.pickup_address?.split(',')[0] || 'Origin';
    const dest = data.destination_city || data.destination_address?.split(',')[0] || 'Destination';
    const shareMessage = `TRUCKS Freight RFQ: ${data.id}\nCorridor: ${origin} → ${dest}\nMaterial: ${data.material_type || 'Cargo'} (${data.required_capacity_mt || 25} MT)\nVehicle: ${data.vehicle_type || '32 FT Multi-Axle'}`;

    try {
      await Share.share({
        message: shareMessage,
        title: `TRUCKS Requirement ${data.id}`,
      });
    } catch {
      Clipboard.setString(shareMessage);
      Alert.alert('Link Copied', 'Requirement summary copied to clipboard.');
    }
  };

  const handleCopyId = () => {
    Clipboard.setString(requirementId);
    Alert.alert('Copied', `Requirement ID ${requirementId} copied to clipboard.`);
    setShowMoreMenu(false);
  };

  const handleConfirmCancel = () => {
    setShowMoreMenu(false);
    Alert.alert(
      'Cancel Freight Requirement',
      `Are you sure you want to cancel RFQ ${requirementId}? Carrier bids will be withdrawn.`,
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel RFQ',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            const res = await clientService.cancelRequirement(
              requirementId,
              clientId,
              'Client requested cancellation from mobile app'
            );
            setIsCancelling(false);
            if (res.success) {
              Alert.alert('Requirement Cancelled', 'Your requirement has been cancelled.');
              loadData();
            } else {
              Alert.alert('Unable to Cancel', res.message || 'Failed to cancel requirement.');
            }
          },
        },
      ]
    );
  };

  const handleOpenMap = (address?: string, city?: string, lat?: number, lng?: number) => {
    const directionsUrl = buildGoogleMapsDirectionsUrl({
      latitude: lat,
      longitude: lng,
      address: `${address || city || 'Guwahati, Assam'}`,
    });

    Linking.canOpenURL(directionsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(directionsUrl);
        } else {
          Linking.openURL(directionsUrl);
        }
      })
      .catch(() => {
        Alert.alert('Cannot Open Maps', 'Unable to launch Google Maps.');
      });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Flexible Schedule';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Immediate Loading Required';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const datePart = d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} · ${timePart}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ArrowLeft size={20} color="#101D36" />
          </TouchableOpacity>
          <BrandLogoHeader size="sm" />
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#F05A24" />
          <Text style={styles.loadingText}>Fetching requirement details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBooked = data?.status === 'BOOKED';
  const isCancelled = data?.status === 'CANCELLED';
  const quoteCount = data?.quotationsCount || (data?.quotations && data.quotations.length) || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back to Requirements List"
        >
          <ArrowLeft size={20} color="#101D36" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        <View style={{ width: 38 }} />
      </View>

      {/* ── Screen Title & Subtitle ── */}
      <View style={styles.titleWrap}>
        <Text style={styles.screenHeading}>Requirement Details</Text>
        <Text style={styles.screenSubtitle}>
          Review your posted freight requirement and check quotations.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card 1: Requirement Summary Card (Screenshot 1 Match) ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeftCol}>
            <View style={styles.docIconBox}>
              <FileText size={20} color="#F05A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaIdLabel}>REQUIREMENT ID</Text>
              <Text style={styles.metaIdValue}>{data?.id || requirementId}</Text>
              <Text style={styles.postedDateText}>
                Posted on {formatDate(data?.created_at)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRightCol}>
            {/* Status Badge */}
            {data?.status === 'CORRECTIONS_REQUESTED' ? (
              <View style={styles.statusBadgeRed}>
                <View style={styles.dotRed} />
                <Text style={styles.statusTextRed}>Corrections Needed</Text>
              </View>
            ) : isBooked ? (
              <View style={styles.statusBadgeGreen}>
                <View style={styles.dotGreen} />
                <Text style={styles.statusTextGreen}>Booked</Text>
              </View>
            ) : isCancelled ? (
              <View style={styles.statusBadgeGrey}>
                <View style={styles.dotGrey} />
                <Text style={styles.statusTextGrey}>Cancelled</Text>
              </View>
            ) : quoteCount > 0 ? (
              <View style={styles.statusBadgeBlue}>
                <View style={styles.dotBlue} />
                <Text style={styles.statusTextBlue}>Quotes Received</Text>
              </View>
            ) : (
              <View style={styles.statusBadgeOrange}>
                <View style={styles.dotOrange} />
                <Text style={styles.statusTextOrange}>Active RFQ</Text>
              </View>
            )}

            {/* Action Buttons: Share & More */}
            <View style={styles.summaryActionIconsRow}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={handleShare}
                activeOpacity={0.75}
                accessibilityLabel="Share Requirement"
              >
                <Share2 size={16} color="#101D36" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={() => setShowMoreMenu(true)}
                activeOpacity={0.75}
                accessibilityLabel="More Actions"
              >
                <MoreVertical size={16} color="#101D36" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Corrections Banner if requested by Admin ── */}
        {data?.status === 'CORRECTIONS_REQUESTED' && (
          <View style={styles.correctionsBannerCard}>
            <View style={styles.correctionsBannerHeader}>
              <XCircle size={18} color="#DC2626" />
              <Text style={styles.correctionsBannerTitle}>Admin Requested Clarifications</Text>
            </View>
            <Text style={styles.correctionsBannerText}>
              {data?.correction_notes ||
                (data?.special_instructions?.startsWith('[CORRECTIONS REQUESTED]:')
                  ? data.special_instructions.replace('[CORRECTIONS REQUESTED]:', '').trim()
                  : '') ||
                'Please review your cargo, route, or timing details according to operational guidance.'}
            </Text>
            {onEditRequirement && (
              <TouchableOpacity
                style={styles.correctionsEditBtn}
                onPress={() => onEditRequirement(data)}
                activeOpacity={0.8}
              >
                <Edit3 size={14} color="#FFFFFF" />
                <Text style={styles.correctionsEditBtnText}>Update Requirement Details</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Card 2: Vehicle & Route Card (Screenshot 1 Match) ── */}
        <View style={styles.sectionCard}>
          {/* Vehicle Header Banner */}
          <View style={styles.vehicleHeaderRow}>
            <View style={styles.vehicleIconBox}>
              <Truck size={20} color="#F05A24" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleTitleText}>
                {data?.vehicle_type || data?.vehicle_type_required || '32 FT Multi-Axle'}
              </Text>
              <Text style={styles.vehicleCapacityText}>
                {data?.required_capacity_mt ? `${data.required_capacity_mt} MT Capacity` : '25 MT Capacity'}
              </Text>
            </View>
          </View>

          {/* Vertical Route Indicator with Origin & Destination */}
          <View style={styles.routeTimelineWrap}>
            {/* Origin Node */}
            <View style={styles.timelineNodeRow}>
              <View style={styles.markerOriginCircle}>
                <MapPin size={14} color="#F05A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nodeLabel}>Loading Origin</Text>
                <Text style={styles.nodeAddressText}>
                  {data?.pickup_address || data?.pickup_city || 'North Eastern Freight Hub, Guwahati'}
                </Text>
                {data?.pickup_pincode ? (
                  <Text style={styles.nodePinText}>PIN: {data.pickup_pincode}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.viewOnMapPill}
                onPress={() =>
                  handleOpenMap(
                    data?.pickup_address,
                    data?.pickup_city,
                    data?.pickup_latitude,
                    data?.pickup_longitude
                  )
                }
                activeOpacity={0.8}
              >
                <MapPin size={13} color="#2563EB" />
                <Text style={styles.viewOnMapPillText}>View on Map</Text>
              </TouchableOpacity>
            </View>

            {/* Vertical Connector Line */}
            <View style={styles.timelineDottedLineWrap}>
              <View style={styles.timelineVerticalLine} />
            </View>

            {/* Destination Node */}
            <View style={styles.timelineNodeRow}>
              <View style={styles.markerDestCircle}>
                <MapPin size={14} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nodeLabel}>Unloading Destination</Text>
                <Text style={styles.nodeAddressText}>
                  {data?.destination_address || data?.destination_city || 'Eastern Logistics Yard, Kolkata'}
                </Text>
                {data?.destination_pincode ? (
                  <Text style={styles.nodePinText}>PIN: {data.destination_pincode}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.viewOnMapPill}
                onPress={() =>
                  handleOpenMap(
                    data?.destination_address,
                    data?.destination_city,
                    data?.destination_latitude,
                    data?.destination_longitude
                  )
                }
                activeOpacity={0.8}
              >
                <MapPin size={13} color="#2563EB" />
                <Text style={styles.viewOnMapPillText}>View on Map</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Card 3: Cargo & Shipment Specifications (Screenshot 1 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Package size={17} color="#F05A24" strokeWidth={2.4} />
            </View>
            <Text style={styles.sectionHeaderText}>Cargo & Shipment Specifications</Text>
          </View>

          {/* Row 1: Commodity / Material */}
          <View style={styles.specRow}>
            <View style={styles.specIconWrap}>
              <Package size={16} color="#64748B" />
              <Text style={styles.specLabelText}>Commodity / Material</Text>
            </View>
            <Text style={styles.specValueText}>
              {data?.material_type || 'FMCG & Consumer Goods'}
            </Text>
          </View>

          {/* Row 2: Payload Weight */}
          <View style={styles.specRow}>
            <View style={styles.specIconWrap}>
              <Truck size={16} color="#64748B" />
              <Text style={styles.specLabelText}>Payload Weight</Text>
            </View>
            <Text style={styles.specValueText}>
              {data?.required_capacity_mt ? `${data.required_capacity_mt} MT` : '200 MT'}
            </Text>
          </View>

          {/* Row 3: Expected Loading Date */}
          <View style={styles.specRow}>
            <View style={styles.specIconWrap}>
              <Calendar size={16} color="#64748B" />
              <Text style={styles.specLabelText}>Expected Loading Date</Text>
            </View>
            <Text style={styles.specValueText}>
              {formatDateTime(data?.loading_datetime)}
            </Text>
          </View>

          {/* Row 4: Transit Insurance */}
          {(() => {
            const insuranceNeeded = data?.transit_insurance_needed ?? data?.transitInsuranceNeeded ?? true;
            const insuranceStatus = (data?.insurance_status || '').toUpperCase();
            let label = 'Full Value Coverage Requested';
            let pillStyle: any = styles.insurancePill;
            let textStyle: any = styles.insurancePillText;
            let icon = <CheckCircle2 size={13} color="#16A34A" />;

            if (!insuranceNeeded) {
              label = 'Not Requested';
              pillStyle = styles.insurancePillNeutral;
              textStyle = styles.insurancePillTextNeutral;
              icon = <ShieldCheck size={13} color="#64748B" />;
            } else if (insuranceStatus === 'CONFIRMED' || insuranceStatus === 'ACTIVE') {
              label = 'Full Value Coverage Confirmed';
              pillStyle = styles.insurancePill;
              textStyle = styles.insurancePillText;
              icon = <CheckCircle2 size={13} color="#16A34A" />;
            } else if (insuranceStatus === 'PENDING') {
              label = 'Coverage Pending Confirmation';
              pillStyle = styles.insurancePillPending;
              textStyle = styles.insurancePillTextPending;
              icon = <Clock size={13} color="#D97706" />;
            }

            return (
              <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                <View style={styles.specIconWrap}>
                  <ShieldCheck size={16} color="#64748B" />
                  <Text style={styles.specLabelText}>Transit Insurance</Text>
                </View>
                <View style={pillStyle}>
                  {icon}
                  <Text style={textStyle}>{label}</Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* ── Card 3.5: Confirmed Booking Link Banner (When Booked) ── */}
        {(isBooked || !!data?.booking_id) && (
          <TouchableOpacity
            style={styles.bookedBannerCard}
            onPress={() => {
              const targetBokId = data?.booking_id || `BOK-${requirementId.slice(-8)}`;
              if (onViewBooking) onViewBooking(targetBokId);
            }}
            activeOpacity={0.85}
            accessibilityLabel="View Confirmed Booking"
          >
            <View style={styles.bookedBannerLeft}>
              <View style={styles.bookedIconBox}>
                <CheckCircle2 size={20} color="#16A34A" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookedBannerTitle}>Confirmed Transport Booking</Text>
                <Text style={styles.bookedBannerSubtitle}>
                  {data?.booking_id ? `Booking ID: ${data.booking_id}` : 'Certified Transporter Allocated'} • Tap to view tracking & trip status
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#16A34A" />
          </TouchableOpacity>
        )}

        {/* ── Card 4: Quotations Received Summary (Screenshot 1 Match) ── */}
        <View style={styles.quotesBannerCard}>
          <View style={styles.quotesBannerLeft}>
            <View style={styles.quotesIconBox}>
              <FileText size={18} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quotesBannerTitle}>Quotations Received</Text>
              <Text style={styles.quotesBannerSubtitle}>
                {quoteCount > 0
                  ? `${quoteCount} carrier quotes received. Compare rates & terms.`
                  : 'Suppliers are reviewing your requirement.'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkOffersBtn}
            onPress={() => onViewQuotations(requirementId)}
            activeOpacity={0.8}
          >
            <Bell size={13} color="#1D4ED8" />
            <Text style={styles.checkOffersBtnText}>Check latest offers</Text>
            <ChevronRight size={13} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Action Bar (Screenshot 1 Match) ── */}
      <View style={styles.bottomStickyBar}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            if (onEditRequirement) {
              onEditRequirement(data);
            } else {
              Alert.alert('Edit Requirement', 'Reopening booking workflow with saved fields.');
            }
          }}
          activeOpacity={0.85}
        >
          <Edit3 size={16} color="#F05A24" />
          <Text style={styles.editBtnText}>Edit Requirement</Text>
        </TouchableOpacity>

        {(isBooked || !!data?.booking_id) && onViewBooking ? (
          <TouchableOpacity
            style={styles.viewBookingCtaBtn}
            onPress={() => {
              const targetBokId = data?.booking_id || `BOK-${requirementId.slice(-8)}`;
              onViewBooking(targetBokId);
            }}
            activeOpacity={0.88}
            accessibilityLabel="View Confirmed Booking"
          >
            <Package size={17} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.viewQuotesCtaText}>View Confirmed Booking</Text>
            <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.8} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.viewQuotesCtaBtn}
            onPress={() => onViewQuotations(requirementId)}
            activeOpacity={0.88}
          >
            <FileText size={17} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.viewQuotesCtaText}>View Quotations & Rates</Text>
            <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.8} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── More Actions Modal ── */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenuCard}>
            <View style={styles.moreMenuHeader}>
              <Text style={styles.moreMenuTitle}>Requirement Actions</Text>
              <TouchableOpacity onPress={() => setShowMoreMenu(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                if (onEditRequirement) onEditRequirement(data);
              }}
            >
              <Edit3 size={17} color="#101D36" />
              <Text style={styles.moreMenuItemText}>Edit Requirement</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreMenuItem} onPress={handleCopyId}>
              <Copy size={17} color="#101D36" />
              <Text style={styles.moreMenuItemText}>Copy Requirement ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreMenuItem} onPress={handleShare}>
              <Share2 size={17} color="#101D36" />
              <Text style={styles.moreMenuItemText}>Share Requirement Summary</Text>
            </TouchableOpacity>

            {!isBooked && !isCancelled && (
              <TouchableOpacity
                style={[styles.moreMenuItem, styles.moreMenuItemDanger]}
                onPress={handleConfirmCancel}
              >
                <XCircle size={17} color="#DC2626" />
                <Text style={styles.moreMenuItemTextDanger}>Cancel Freight RFQ</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101D36',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // safe area spacing for sticky bottom bar
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  /* Card 1: Summary Card */
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  summaryLeftCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metaIdValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#101D36',
    marginTop: 1,
  },
  postedDateText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  summaryRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  summaryActionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Badges */
  statusBadgeOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  dotOrange: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F05A24',
  },
  statusTextOrange: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
  },
  statusBadgeBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dotBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  statusTextBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusTextGreen: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  statusBadgeGrey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dotGrey: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748B',
  },
  statusTextGrey: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  statusBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  statusTextRed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  correctionsBannerCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    marginBottom: 14,
  },
  correctionsBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  correctionsBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  correctionsBannerText: {
    fontSize: 12.5,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 10,
  },
  correctionsEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  correctionsEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Card 2: Vehicle & Route Card */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  vehicleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101D36',
  },
  vehicleCapacityText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },

  /* Vertical Route Timeline */
  routeTimelineWrap: {
    paddingLeft: 4,
  },
  timelineNodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  markerOriginCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  markerDestCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  nodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  nodeAddressText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#101D36',
    marginTop: 2,
    lineHeight: 18,
  },
  nodePinText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  viewOnMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewOnMapPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  timelineDottedLineWrap: {
    width: 28,
    alignItems: 'center',
    marginVertical: 4,
  },
  timelineVerticalLine: {
    width: 1,
    height: 28,
    borderStyle: 'dashed',
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
  },

  /* Card 3: Cargo & Shipment Specifications */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101D36',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  specIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specLabelText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  specValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101D36',
  },
  insurancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  insurancePillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  insurancePillNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insurancePillTextNeutral: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  insurancePillPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insurancePillTextPending: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
  },

  /* Card 4: Quotations Received Summary */
  quotesBannerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quotesBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  quotesIconBox: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotesBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#101D36',
  },
  quotesBannerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  checkOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  checkOffersBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },

  /* Sticky Bottom Action Bar */
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F05A24',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F05A24',
  },
  viewQuotesCtaBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F05A24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#F05A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  viewBookingCtaBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  viewQuotesCtaText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Booked Banner Card */
  bookedBannerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  bookedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  bookedIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookedBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  bookedBannerSubtitle: {
    fontSize: 11.5,
    color: '#166534',
    marginTop: 2,
    fontWeight: '500',
  },

  /* More Menu Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 29, 54, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  moreMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  moreMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  moreMenuTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101D36',
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  moreMenuItemDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  moreMenuItemText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#101D36',
  },
  moreMenuItemTextDanger: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },
});
