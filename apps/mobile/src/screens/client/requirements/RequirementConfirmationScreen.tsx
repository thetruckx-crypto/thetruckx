import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  ClipboardList,
  Eye,
  Home,
  Truck,
  ShieldCheck,
  PlusCircle,
  Copy,
  MapPin,
  Calendar,
  IndianRupee,
  Package,
  FileText,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { TransportRequirementDraft } from '../../../types';
import { clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';
import { formatDisplayId } from '../../../utils/idGenerator';

interface RequirementConfirmationScreenProps {
  requirementId: string;
  draft?: TransportRequirementDraft;
  onViewDetails: (requirementId: string) => void;
  onViewQuotations: (requirementId: string) => void;
  onGoToDashboard: () => void;
  onCreateAnother?: () => void;
}

export const RequirementConfirmationScreen: React.FC<
  RequirementConfirmationScreenProps
> = ({
  requirementId,
  draft,
  onViewDetails,
  onViewQuotations,
  onGoToDashboard,
  onCreateAnother,
}) => {
  const [loading, setLoading] = useState(true);
  const [dbRequirement, setDbRequirement] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadRequirementDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (requirementId) {
        // 1. Fetch authentic requirement from database
        const { data, error } = await supabase
          .from('requirements')
          .select('*')
          .eq('id', requirementId)
          .maybeSingle();

        if (data && !error) {
          setDbRequirement(data);
          return;
        }

        // 2. Fallback to clientService helper if direct select returned null
        const fromService = await clientService.fetchRequirementById(requirementId);
        if (fromService) {
          setDbRequirement(fromService);
          return;
        }
      }
    } catch (err) {
      console.warn('Error loading requirement confirmation record:', err);
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    loadRequirementDetails();
  }, [loadRequirementDetails]);

  // Merge database values with draft fallback
  const effectiveReq = dbRequirement || {};

  const pickupCity =
    effectiveReq.pickup_city ||
    (effectiveReq.pickup_address ? effectiveReq.pickup_address.split(',')[0].trim() : '') ||
    draft?.pickupCity ||
    'Origin';

  const pickupAddress =
    effectiveReq.pickup_address ||
    draft?.pickupAddress ||
    'Origin Pickup Depot';

  const pickupPincode =
    effectiveReq.pickup_pincode ||
    draft?.pickupPincode ||
    '';

  const destCity =
    effectiveReq.destination_city ||
    (effectiveReq.destination_address ? effectiveReq.destination_address.split(',')[0].trim() : '') ||
    draft?.destinationCity ||
    'Destination';

  const destAddress =
    effectiveReq.destination_address ||
    draft?.destinationAddress ||
    'Destination Delivery Yard';

  const destPincode =
    effectiveReq.destination_pincode ||
    draft?.destinationPincode ||
    '';

  const vehicleType =
    effectiveReq.vehicle_type ||
    effectiveReq.vehicle_type_required ||
    draft?.vehicleTypeRequired ||
    'Commercial Freight Unit';

  const materialType =
    effectiveReq.material_type ||
    draft?.materialType ||
    'General Commercial Freight';

  const weightMt =
    effectiveReq.capacity_mt ||
    effectiveReq.weight_mt ||
    draft?.requiredCapacityMt ||
    '—';

  const cargoValue =
    effectiveReq.cargo_value ||
    (draft as any)?.cargoValue ||
    null;

  const packageCount =
    effectiveReq.package_count ||
    effectiveReq.quantity ||
    draft?.packageCount ||
    null;

  const scheduleDate =
    effectiveReq.pickup_date ||
    effectiveReq.schedule_date ||
    draft?.preferredLoadingDate ||
    draft?.loadingDatetime ||
    'Immediate Dispatch Window';

  const targetBudget =
    effectiveReq.target_rate ||
    effectiveReq.budget_amount ||
    effectiveReq.expected_price ||
    draft?.targetBudget ||
    null;

  const specialInstructions =
    effectiveReq.special_instructions ||
    effectiveReq.notes ||
    draft?.specialInstructions ||
    '';

  const rawCreatedAt = effectiveReq.created_at || new Date().toISOString();
  const submissionDateFormatted = new Date(rawCreatedAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const displayId = formatDisplayId('REQ', requirementId || effectiveReq.id, rawCreatedAt);

  const rawStatus = (effectiveReq.status || 'UNDER_REVIEW').toUpperCase();
  let statusText = 'Under Review / Live RFQ';
  if (rawStatus === 'QUOTATIONS_RECEIVED') statusText = 'Quotations Received';
  else if (rawStatus === 'BOOKED') statusText = 'Booking Confirmed';
  else if (rawStatus === 'SUBMITTED') statusText = 'Submitted / Under Review';

  const handleCopyId = () => {
    Clipboard.setString(displayId);
    setCopiedId(true);
    Alert.alert('Copied', `Requirement ID ${displayId} copied to clipboard.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Professional Header */}
      <View style={styles.topHeader}>
        <BrandLogoHeader size="sm" theme="light" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* Success Badge without graphic illustrations */}
          <View style={styles.badgeContainer}>
            <View style={styles.outerGlow}>
              <View style={styles.innerCircle}>
                <CheckCircle2 size={44} color="#10B981" strokeWidth={2.4} />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Requirement Submitted!</Text>
          <Text style={styles.subtitle}>
            Your transport requirement is now live. Verified regional fleet carriers and operations dispatchers are reviewing specifications.
          </Text>

          {/* Reference ID Card */}
          <View style={styles.refCard}>
            <View style={styles.refHeaderRow}>
              <Text style={styles.refLabel}>REQUIREMENT IDENTIFIER</Text>
              <TouchableOpacity
                onPress={handleCopyId}
                style={styles.copyPillBtn}
                accessibilityLabel="Copy Requirement ID"
              >
                <Copy size={13} color="#F15A24" />
                <Text style={styles.copyPillText}>{copiedId ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.refValue}>{displayId}</Text>

            <View style={styles.refDivider} />

            <View style={styles.refMetaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>SUBMITTED ON</Text>
                <Text style={styles.metaValue}>{submissionDateFormatted}</Text>
              </View>

              <View style={styles.statusPill}>
                <Clock size={12} color="#B45309" />
                <Text style={styles.statusPillText}>{statusText}</Text>
              </View>
            </View>
          </View>

          {/* Loading Indicator for DB Fetch */}
          {loading && !dbRequirement && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#F15A24" />
              <Text style={styles.loadingText}>Syncing requirement details from database...</Text>
            </View>
          )}

          {/* Detailed Requirement Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <View style={styles.summaryHeaderIconBox}>
                <FileText size={16} color="#F15A24" />
              </View>
              <Text style={styles.summaryCardTitle}>Summary of Submitted Requirement</Text>
            </View>

            {/* Route Details */}
            <View style={styles.routeSection}>
              {/* Pickup */}
              <View style={styles.routeStopRow}>
                <View style={styles.originDotBox}>
                  <MapPin size={14} color="#16A34A" />
                </View>
                <View style={styles.stopInfoCol}>
                  <Text style={styles.stopTypeLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopCityText}>
                    {pickupCity} {pickupPincode ? `• PIN ${pickupPincode}` : ''}
                  </Text>
                  <Text style={styles.stopAddressText}>{pickupAddress}</Text>
                </View>
              </View>

              {/* Connecting Line */}
              <View style={styles.routeConnectorLine} />

              {/* Delivery */}
              <View style={styles.routeStopRow}>
                <View style={styles.destDotBox}>
                  <MapPin size={14} color="#DC2626" />
                </View>
                <View style={styles.stopInfoCol}>
                  <Text style={styles.stopTypeLabel}>DELIVERY LOCATION</Text>
                  <Text style={styles.stopCityText}>
                    {destCity} {destPincode ? `• PIN ${destPincode}` : ''}
                  </Text>
                  <Text style={styles.stopAddressText}>{destAddress}</Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            {/* Specifications Grid */}
            <View style={styles.specGrid}>
              {/* Vehicle Type */}
              <View style={styles.specItem}>
                <Truck size={15} color="#64748B" />
                <View style={styles.specTextCol}>
                  <Text style={styles.specLabel}>Vehicle Required</Text>
                  <Text style={styles.specValue}>{vehicleType}</Text>
                </View>
              </View>

              {/* Cargo / Material */}
              <View style={styles.specItem}>
                <Package size={15} color="#64748B" />
                <View style={styles.specTextCol}>
                  <Text style={styles.specLabel}>Cargo & Capacity</Text>
                  <Text style={styles.specValue}>
                    {materialType} ({weightMt} MT)
                  </Text>
                  {packageCount ? (
                    <Text style={styles.specSubValue}>{packageCount} Packages / Units</Text>
                  ) : null}
                </View>
              </View>

              {/* Pickup Schedule */}
              <View style={styles.specItem}>
                <Calendar size={15} color="#64748B" />
                <View style={styles.specTextCol}>
                  <Text style={styles.specLabel}>Requested Schedule</Text>
                  <Text style={styles.specValue}>{scheduleDate}</Text>
                </View>
              </View>

              {/* Freight Budget */}
              <View style={styles.specItem}>
                <IndianRupee size={15} color="#64748B" />
                <View style={styles.specTextCol}>
                  <Text style={styles.specLabel}>Freight Budget</Text>
                  <Text style={styles.specValue}>
                    {targetBudget
                      ? `₹ ${Number(targetBudget).toLocaleString('en-IN')}`
                      : 'Open for Competitive Bidding'}
                  </Text>
                  {cargoValue ? (
                    <Text style={styles.specSubValue}>
                      Cargo Value: ₹ {Number(cargoValue).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Special Instructions if provided */}
            {specialInstructions ? (
              <View style={styles.instructionsBox}>
                <Text style={styles.instructionsLabel}>Special Instructions:</Text>
                <Text style={styles.instructionsText}>{specialInstructions}</Text>
              </View>
            ) : null}
          </View>

          {/* Next Steps Notification */}
          <View style={styles.infoBox}>
            <ShieldCheck size={20} color="#059669" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Quotations typically arrive within 15–30 minutes. You will receive real-time push alerts as carriers submit bids.
            </Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onViewQuotations(requirementId || effectiveReq.id)}
            activeOpacity={0.88}
            accessibilityLabel="Check Received Quotations"
          >
            <ClipboardList size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.primaryBtnText}>Check Received Quotations</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onViewDetails(requirementId || effectiveReq.id)}
            activeOpacity={0.88}
            accessibilityLabel="View Requirement Details"
          >
            <Eye size={17} color="#0C1A34" strokeWidth={2.2} />
            <Text style={styles.secondaryBtnText}>View Requirement Details</Text>
          </TouchableOpacity>

          {onCreateAnother && (
            <TouchableOpacity
              style={styles.createAnotherBtn}
              onPress={onCreateAnother}
              activeOpacity={0.88}
              accessibilityLabel="Create Another Requirement"
            >
              <PlusCircle size={17} color="#F15A24" strokeWidth={2.4} />
              <Text style={styles.createAnotherBtnText}>Create Another Requirement</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={onGoToDashboard}
            activeOpacity={0.8}
            accessibilityLabel="Return to Client Dashboard"
          >
            <Home size={15} color="#64748B" />
            <Text style={styles.homeBtnText}>Return to Client Dashboard</Text>
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
  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    alignItems: 'center',
  },
  badgeContainer: {
    marginBottom: 14,
    alignItems: 'center',
  },
  outerGlow: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#ECFDF5',
    borderWidth: 5,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C1A34',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  refCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  refHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  refLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFF5ED',
    borderRadius: 6,
  },
  copyPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  refValue: {
    fontSize: 21,
    fontWeight: '800',
    color: '#F15A24',
    marginTop: 6,
    letterSpacing: 0.4,
  },
  refDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  refMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryHeaderIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
  },
  routeSection: {
    paddingVertical: 4,
  },
  routeStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  originDotBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  destDotBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stopInfoCol: {
    flex: 1,
  },
  stopTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  stopCityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
    marginTop: 1,
  },
  stopAddressText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    lineHeight: 16,
  },
  routeConnectorLine: {
    width: 2,
    height: 18,
    backgroundColor: '#E2E8F0',
    marginLeft: 11,
    marginVertical: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  specGrid: {
    gap: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  specTextCol: {
    flex: 1,
  },
  specLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  specValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  specSubValue: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  instructionsBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  instructionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  instructionsText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
    fontWeight: '500',
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#F15A24',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0C1A34',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  createAnotherBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#FFF5ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  createAnotherBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 6,
  },
  homeBtnText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
});
