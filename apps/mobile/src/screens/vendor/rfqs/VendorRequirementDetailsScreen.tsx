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
  Modal,
  TextInput,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Package,
  Truck,
  Building2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';

interface VendorRequirementDetailsScreenProps {
  requirementId: string;
  vendorId?: string;
  onBack: () => void;
  onSubmitQuotation: (req: any) => void;
}

const DECLINE_REASONS = [
  'No vehicle available for this route / date',
  'Capacity mismatch (insufficient MT rating)',
  'Route outside operational service coverage',
  'Rate unfeasible for commercial constraints',
  'Fleet already committed to other client bookings',
  'Other operational reason',
];

export const VendorRequirementDetailsScreen: React.FC<VendorRequirementDetailsScreenProps> = ({
  requirementId,
  vendorId,
  onBack,
  onSubmitQuotation,
}) => {
  const [requirement, setRequirement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(DECLINE_REASONS[0]);
  const [customReasonNote, setCustomReasonNote] = useState('');
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  const loadDetails = useCallback(async () => {
    try {
      const data = await vendorService.getRequirementDetails(requirementId, vendorId);
      setRequirement(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [requirementId, vendorId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleConfirmDecline = async () => {
    if (!vendorId) {
      Alert.alert('Session Error', 'Vendor session not detected. Please log in again.');
      return;
    }
    const finalReason =
      selectedReason === 'Other operational reason' && customReasonNote.trim()
        ? `Other: ${customReasonNote.trim()}`
        : selectedReason;

    setIsSubmittingDecline(true);
    try {
      const res = await vendorService.declineRequirement(vendorId, requirement.id, finalReason);
      if (res.success) {
        setDeclineModalOpen(false);
        Alert.alert(
          'Requirement Declined',
          'Admin has been notified that this requirement cannot be fulfilled by your fleet.',
          [
            {
              text: 'OK',
              onPress: () => {
                loadDetails();
              },
            },
          ]
        );
      } else {
        Alert.alert('Decline Failed', res.error || 'Could not record decline. Please retry.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching Requirement Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!requirement) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <Text style={styles.loadingText}>Requirement not found or expired.</Text>
          <TouchableOpacity style={styles.backLink} onPress={onBack}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isQuoted = requirement.vendorStatus === 'QUOTED' || requirement.hasQuoted;
  const isDeclined = requirement.vendorStatus === 'DECLINED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.reqHeaderRow}>
            <View>
              <Text style={styles.reqIdText}>{requirement.id}</Text>
              <Text style={styles.reqDateText}>
                Posted on {new Date(requirement.createdAt || Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={13} color="#10B981" />
              <Text style={styles.verifiedText}>Verified Shipper</Text>
            </View>
          </View>

          {/* Feasibility Response Status Banner if already responded */}
          {isQuoted && (
            <View style={styles.quotedStatusBanner}>
              <CheckCircle2 size={18} color="#10B981" />
              <View style={styles.statusBannerTextWrap}>
                <Text style={styles.quotedStatusTitle}>Feasibility Confirmed & Quoted</Text>
                <Text style={styles.quotedStatusSub}>
                  {requirement.quotedRate
                    ? `Your quoted rate: ₹${Number(requirement.quotedRate).toLocaleString('en-IN')}. Awaiting admin comparison.`
                    : 'Quotation submitted successfully. Awaiting admin comparison & client review.'}
                </Text>
              </View>
            </View>
          )}

          {isDeclined && (
            <View style={styles.declinedStatusBanner}>
              <XCircle size={18} color="#EF4444" />
              <View style={styles.statusBannerTextWrap}>
                <Text style={styles.declinedStatusTitle}>Requirement Declined</Text>
                <Text style={styles.declinedStatusSub}>
                  You indicated this requirement cannot be fulfilled by your fleet.
                </Text>
              </View>
            </View>
          )}

          {/* Route Section Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ORIGIN & DESTINATION ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeStop}>
                <View style={styles.dotGold} />
                <View style={styles.stopInfo}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{requirement.pickupAddress}</Text>
                  {requirement.pickupPincode && (
                    <Text style={styles.pinText}>PIN: {requirement.pickupPincode}</Text>
                  )}
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStop}>
                <View style={styles.dotGreen} />
                <View style={styles.stopInfo}>
                  <Text style={styles.stopLabel}>DELIVERY DESTINATION</Text>
                  <Text style={styles.stopAddress}>{requirement.destinationAddress}</Text>
                  {requirement.destinationPincode && (
                    <Text style={styles.pinText}>PIN: {requirement.destinationPincode}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Cargo & Fleet Specs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNMENT & VEHICLE REQUIRED</Text>
            </View>

            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Commodity Material:</Text>
                <Text style={styles.specValue}>{requirement.materialType || 'Industrial Cargo'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Required Capacity:</Text>
                <Text style={styles.specValue}>
                  {requirement.requiredCapacityMt < 0.5 && requirement.requiredCapacityMt > 0
                    ? `${requirement.requiredCapacityMt} MT (${Math.round(requirement.requiredCapacityMt * 1000)} kg)`
                    : `${requirement.requiredCapacityMt} MT`}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Vehicle Type:</Text>
                <Text style={styles.specValue}>{requirement.vehicleType || '32 FT Multi-Axle'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Loading Schedule:</Text>
                <Text style={styles.specValue}>
                  {requirement.loadingDatetime
                    ? new Date(requirement.loadingDatetime).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Immediate / Next Day'}
                </Text>
              </View>
            </View>

            {requirement.specialInstructions && (
              <View style={styles.specialNoteBox}>
                <AlertCircle size={14} color="#F05A22" />
                <Text style={styles.specialNoteText}>
                  Special Notes: {requirement.specialInstructions}
                </Text>
              </View>
            )}
          </View>

          {/* Shipper Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNOR ENTERPRISE</Text>
            </View>

            <View style={styles.shipperRow}>
              <Text style={styles.shipperName}>{requirement.clientName}</Text>
              <Text style={styles.shipperCity}>{requirement.clientCity || 'National Logistics Hub'}</Text>
            </View>
          </View>

          {/* Two-Action Decision Buttons: Feasibility & Quotation vs Decline */}
          {!isDeclined && (
            <View style={styles.decisionActionsWrap}>
              <TouchableOpacity
                style={styles.goldBtn}
                onPress={() => onSubmitQuotation(requirement)}
                activeOpacity={0.85}
              >
                <Text style={styles.goldBtnText}>
                  {isQuoted ? 'Revise Commercial Quotation' : 'Confirm Feasibility & Quote Rate'}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>

              {!isQuoted && (
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => setDeclineModalOpen(true)}
                  activeOpacity={0.85}
                >
                  <XCircle size={16} color="#EF4444" />
                  <Text style={styles.declineBtnText}>Cannot Fulfil (Decline Requirement)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isDeclined && (
            <TouchableOpacity
              style={[styles.declineBtn, { borderColor: '#E2E8F0' }]}
              onPress={() => setDeclineModalOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.declineBtnText, { color: '#64748B' }]}>Change Decline Reason</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Decline Reason Modal */}
      <Modal visible={declineModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <XCircle size={18} color="#EF4444" />
                <Text style={styles.modalTitle}>Decline Transport Requirement</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDeclineModalOpen(false)}
                disabled={isSubmittingDecline}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Please select the operational reason why your fleet cannot fulfill requirement{' '}
              <Text style={{ fontWeight: '700', color: '#172B4D' }}>{requirement.id}</Text>:
            </Text>

            <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
              {DECLINE_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedReason === 'Other operational reason' && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Specify reason (e.g. state permit limitation, vehicle maintenance)..."
                placeholderTextColor="#94A3B8"
                value={customReasonNote}
                onChangeText={setCustomReasonNote}
                multiline
                numberOfLines={2}
              />
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeclineModalOpen(false)}
                disabled={isSubmittingDecline}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmDeclineBtn}
                onPress={handleConfirmDecline}
                disabled={isSubmittingDecline}
              >
                {isSubmittingDecline ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.modalConfirmDeclineText}>Confirm Decline</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomGoldWings />
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
  backLink: {
    marginTop: 12,
    padding: 8,
  },
  backLinkText: {
    color: '#F05A22',
    fontSize: 14,
    fontWeight: '700',
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
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqIdText: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '800',
  },
  reqDateText: {
    color: '#64748B',
    fontSize: 11,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 10,
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
  routeCol: {
    gap: 8,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotGold: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  routeDivider: {
    width: 2,
    height: 16,
    backgroundColor: '#F1F5F9',
    marginLeft: 4,
  },
  stopInfo: {
    flex: 1,
  },
  stopLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  stopAddress: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  pinText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  specsGrid: {
    gap: 8,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  specValue: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  specialNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  specialNoteText: {
    flex: 1,
    color: '#F05A22',
    fontSize: 11,
    lineHeight: 16,
  },
  shipperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shipperName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
  },
  shipperCity: {
    color: '#64748B',
    fontSize: 12,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quotedStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statusBannerTextWrap: {
    flex: 1,
  },
  quotedStatusTitle: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  quotedStatusSub: {
    color: '#047857',
    fontSize: 11,
    lineHeight: 16,
  },
  declinedStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  declinedStatusTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  declinedStatusSub: {
    color: '#B91C1C',
    fontSize: 11,
    lineHeight: 16,
  },
  decisionActionsWrap: {
    gap: 10,
    marginTop: 6,
  },
  declineBtn: {
    backgroundColor: '#FFFFFF',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  declineBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSub: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  reasonOptionSelected: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#F05A22',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
  },
  reasonOptionText: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
  reasonOptionTextSelected: {
    color: '#F05A22',
    fontWeight: '700',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#172B4D',
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmDeclineBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  modalConfirmDeclineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
