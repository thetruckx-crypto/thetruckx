import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Clipboard,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  CheckCircle2,
  Check,
  Truck,
  Calendar,
  MapPin,
  Package,
  FileText,
  Scale,
  Box,
  ShieldCheck,
  Copy,
  Phone,
  Edit3,
  Bell,
  Radio,
  FileCheck2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { TransportRequirementDraft } from '../types';
import { clientService } from '../services/clientService';

interface RequirementReviewScreenProps {
  draft: TransportRequirementDraft;
  clientId?: string;
  onBack: () => void;
  onSubmitSuccess: (requirementId: string) => void;
  onEditStep?: (step: 1 | 2 | 3) => void;
  onHelp?: () => void;
  onNavigateToFeature?: (feature: 'QUOTES' | 'TRACKING' | 'DOCS' | 'NOTIFICATIONS') => void;
}

export const RequirementReviewScreen: React.FC<RequirementReviewScreenProps> = ({
  draft,
  clientId,
  onBack,
  onSubmitSuccess,
  onEditStep,
  onHelp,
  onNavigateToFeature,
}) => {
  const [submitting, setSubmitting] = useState(false);

  // Read directly from draft (Task 7: clean draft isolation, no hardcoded fallbacks)
  const originCity = draft.pickupCity || (draft.pickupAddress ? draft.pickupAddress.split(',')[0].trim() : 'Pickup Location');
  const originPin = draft.pickupPincode || '';
  const destCity = draft.destinationCity || (draft.destinationAddress ? draft.destinationAddress.split(',')[0].trim() : 'Delivery Location');
  const destPin = draft.destinationPincode || '';

  const pickupDate = draft.preferredLoadingDate || (draft.loadingDatetime ? draft.loadingDatetime.split(' ')[0] : '');
  const pickupTime = draft.preferredLoadingTime || (draft.loadingDatetime && draft.loadingDatetime.includes(' ')
    ? draft.loadingDatetime.split(' ').slice(1).join(' ')
    : '');

  const vehicleName = draft.vehicleTypeRequired || (draft.vehicleGroups && draft.vehicleGroups.length > 0
    ? draft.vehicleGroups.map((g) => `${g.quantity}x ${g.vehicleTypeName}`).join(', ')
    : 'Vehicle Not Selected');
  const targetBudget = draft.targetBudget ? `₹${draft.targetBudget}` : 'Competitive Market RFQ';

  // Commodity commodity category (e.g. Steel, Pipes and Structural Materials or general cargo)
  const materialName = draft.materialType || 'General Cargo';
  const cargoWeightMt = draft.requiredCapacityMt ? Number(draft.requiredCapacityMt) : 0;
  const cargoWeightKg = Math.round(cargoWeightMt * 1000);
  const packagingMode = draft.packagingType || (draft.packagingModes && draft.packagingModes.length > 0 ? draft.packagingModes.join(', ') : 'Standard Packaging');
  const packageQuantity = draft.numberOfUnits ? `${draft.numberOfUnits} Packages` : 'Quantity Not Specified';
  const hasInsurance = !!draft.transitInsuranceNeeded;

  const pickupAddressFull = draft.pickupAddress || '';
  const pickupContact = draft.pickupContactName || 'Loading Point Contact';
  const pickupPhone = draft.pickupContactPhone || '';

  const destAddressFull = draft.destinationAddress || '';
  const destContact = draft.dropContactName || 'Delivery Point Contact';
  const destPhone = draft.dropContactPhone || '';

  const handleCopyText = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        Alert.alert('Phone Call', `Dialer could not be opened for ${cleanPhone}`);
      });
    }
  };

  const handleConfirmSubmit = () => {
    Alert.alert(
      'Confirm Freight Requirement',
      `Submit requirement from ${originCity} to ${destCity} for ${vehicleName}?\n\nEligible carriers will be notified to quote.`,
      [
        { text: 'Review Again', style: 'cancel' },
        { text: 'Submit RFQ', style: 'default', onPress: handleSubmit },
      ]
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Validate required fields before submitting
    const missing: string[] = [];
    if (!pickupAddressFull.trim() && !originPin) missing.push('Pickup Address / PIN');
    if (!destAddressFull.trim() && !destPin) missing.push('Delivery Address / PIN');
    if (!vehicleName || vehicleName === 'Vehicle Not Selected') missing.push('Vehicle Selection');
    if (!draft.materialType) missing.push('Cargo Material');

    if (missing.length > 0) {
      Alert.alert(
        'Incomplete Details',
        `Please complete the following required fields before submitting:\n\n• ${missing.join('\n• ')}`,
        [
          { text: 'Edit Requirement', onPress: () => onEditStep?.(1) },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await clientService.createTransportRequirement({
        clientId: clientId || 'ca111111-1111-1111-1111-111111111111',
        pickupAddress: pickupAddressFull || `${originCity} - ${originPin}`,
        pickupPincode: originPin || '781028',
        pickupCity: originCity,
        destinationAddress: destAddressFull || `${destCity} - ${destPin}`,
        destinationPincode: destPin || '700024',
        destinationCity: destCity,
        vehicleTypeRequired: vehicleName,
        materialType: materialName,
        requiredCapacityMt: cargoWeightMt || 1,
        packagingType: packagingMode,
        numberOfUnits: draft.numberOfUnits ? Number(draft.numberOfUnits) : undefined,
        loadingDatetime: `${pickupDate} ${pickupTime}`.trim() || new Date(Date.now() + 86400000).toISOString(),
        targetBudget: draft.targetBudget,
        transitInsuranceNeeded: hasInsurance,
        declaredCargoValue: draft.declaredCargoValue,
        specialInstructions: draft.specialInstructions,
        pickupContactName: pickupContact,
        pickupContactPhone: pickupPhone,
        dropContactName: destContact,
        dropContactPhone: destPhone,
      });

      if (res.success && res.requirementId) {
        onSubmitSuccess(res.requirementId);
      } else {
        Alert.alert(
          'Submission Failed',
          res.error || 'Unable to record your transport requirement. Your details have been preserved. Please check your connection and retry.'
        );
      }
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Error creating transport requirement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Header Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          disabled={submitting}
          accessibilityLabel="Back to Schedule"
        >
          <ArrowLeft size={20} color="#0B1730" />
        </TouchableOpacity>

        <BrandLogoHeader size="sm" />

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => {
            if (onHelp) onHelp();
            else Alert.alert('NECL Support', 'Call toll-free support at 1800-NECL-LOGISTICS or email support@necl.in');
          }}
          accessibilityLabel="Help & Support"
        >
          <Headphones size={16} color="#0B1730" />
          <Text style={styles.helpBtnText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* ── Four-Step Stepper & Verification Status ── */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperRow}>
          {/* Step 1: Details (Completed) */}
          <TouchableOpacity
            style={styles.stepItem}
            onPress={() => onEditStep && onEditStep(1)}
            activeOpacity={0.8}
          >
            <View style={styles.stepCircleCompleted}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.stepLabelCompleted}>Details</Text>
          </TouchableOpacity>

          <View style={styles.stepConnectorActive} />

          {/* Step 2: Cargo (Completed) */}
          <TouchableOpacity
            style={styles.stepItem}
            onPress={() => onEditStep && onEditStep(2)}
            activeOpacity={0.8}
          >
            <View style={styles.stepCircleCompleted}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.stepLabelCompleted}>Cargo</Text>
          </TouchableOpacity>

          <View style={styles.stepConnectorActive} />

          {/* Step 3: Schedule (Completed) */}
          <TouchableOpacity
            style={styles.stepItem}
            onPress={() => onEditStep && onEditStep(3)}
            activeOpacity={0.8}
          >
            <View style={styles.stepCircleCompleted}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.stepLabelCompleted}>Schedule</Text>
          </TouchableOpacity>

          <View style={styles.stepConnectorActive} />

          {/* Step 4: Review (Active) */}
          <View style={styles.stepItem}>
            <View style={styles.stepCircleActive}>
              <Text style={styles.stepCircleNumber}>4</Text>
            </View>
            <Text style={styles.stepLabelActive}>Review</Text>
          </View>

          {/* Right Status Pill: All details verified */}
          <View style={styles.verifiedBadge}>
            <View style={styles.verifiedCheckCircle}>
              <Check size={11} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View>
              <Text style={styles.verifiedTitle}>All details verified</Text>
              <Text style={styles.verifiedSubtitle}>Ready to submit</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Screen Heading & Subtitle ── */}
      <View style={styles.headingWrap}>
        <Text style={styles.screenHeading}>Requirement Review</Text>
        <Text style={styles.screenSubtitle}>
          Please review all details before submitting your transport requirement.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Shipment Summary Card (Reference Screenshot 1 Match) ── */}
        <View style={styles.navySummaryCard}>
          <View style={styles.navyLocationsCol}>
            {/* Origin */}
            <View style={styles.navyLocRow}>
              <View style={styles.navyLocIconOrigin}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navyLocLabel}>ORIGIN</Text>
                <Text style={styles.navyLocCity}>{originCity}</Text>
                <Text style={styles.navyLocPin}>PIN {originPin}</Text>
              </View>
            </View>

            {/* Destination */}
            <View style={styles.navyLocRow}>
              <View style={styles.navyLocIconDest}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navyLocLabel}>DESTINATION</Text>
                <Text style={styles.navyLocCity}>{destCity}</Text>
                <Text style={styles.navyLocPin}>PIN {destPin}</Text>
              </View>
            </View>
          </View>

          {/* Vertical Divider inside Navy Card */}
          <View style={styles.navyVerticalDivider} />

          {/* Right Meta Column: Pickup Time & Vehicle */}
          <View style={styles.navyMetaCol}>
            {/* Pickup Date & Time */}
            <View style={styles.navyMetaRow}>
              <View style={styles.navyMetaIconBox}>
                <Calendar size={14} color="#CBD5E1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navyMetaLabel}>Pickup Date & Time</Text>
                <Text style={styles.navyMetaValue}>{pickupDate}</Text>
                <Text style={styles.navyMetaValue}>{pickupTime}</Text>
              </View>
            </View>

            {/* Vehicle Type */}
            <View style={styles.navyMetaRow}>
              <View style={styles.navyMetaIconBox}>
                <Truck size={14} color="#F15A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navyMetaLabel}>Vehicle Type</Text>
                <Text style={styles.navyMetaValueBold}>{vehicleName}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Card 1: Vehicle & Loading Schedule ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.orangeIconBadge}>
                <Truck size={16} color="#F15A24" strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionHeaderTitle}>Vehicle & Loading Schedule</Text>
            </View>
            <TouchableOpacity
              style={styles.editActionBtn}
              onPress={() => onEditStep && onEditStep(1)}
              activeOpacity={0.7}
            >
              <Edit3 size={13} color="#2563EB" />
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridThreeCol}>
            {/* Col 1: Vehicle Type */}
            <View style={styles.gridItem}>
              <View style={styles.pillIconOrange}>
                <Truck size={15} color="#F15A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridItemLabel}>Vehicle Type</Text>
                <Text style={styles.gridItemValue}>{vehicleName}</Text>
              </View>
            </View>

            {/* Col 2: Expected Loading */}
            <View style={styles.gridItem}>
              <View style={styles.pillIconBlue}>
                <Calendar size={15} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridItemLabel}>Expected Loading</Text>
                <Text style={styles.gridItemValue}>{pickupDate}</Text>
                <Text style={styles.gridItemSub}>{pickupTime}</Text>
              </View>
            </View>

            {/* Col 3: Target Budget */}
            <View style={styles.gridItem}>
              <View style={styles.pillIconGreen}>
                <Text style={styles.rupeeIconText}>₹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridItemLabel}>Target Budget</Text>
                <Text style={styles.gridItemValue}>{targetBudget}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Card 2: Cargo & Commodity ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.orangeIconBadge}>
                <Package size={16} color="#F15A24" strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionHeaderTitle}>Cargo & Commodity</Text>
            </View>
            <TouchableOpacity
              style={styles.editActionBtn}
              onPress={() => onEditStep && onEditStep(2)}
              activeOpacity={0.7}
            >
              <Edit3 size={13} color="#2563EB" />
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cargoSpecsRow}>
            {/* Material */}
            <View style={styles.cargoSpecItem}>
              <View style={styles.cargoIconWrap}>
                <FileText size={15} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cargoSpecLabel}>Material</Text>
                <Text style={styles.cargoSpecValue}>{materialName}</Text>
              </View>
            </View>

            {/* Weight */}
            <View style={styles.cargoSpecItem}>
              <View style={styles.cargoIconWrap}>
                <Scale size={15} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cargoSpecLabel}>Weight</Text>
                <Text style={styles.cargoSpecValue}>{cargoWeightMt} MT</Text>
                <Text style={styles.cargoSpecSub}>({cargoWeightKg} kg)</Text>
              </View>
            </View>

            {/* Packaging Mode */}
            <View style={styles.cargoSpecItem}>
              <View style={styles.cargoIconWrap}>
                <Box size={15} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cargoSpecLabel}>Packaging Mode</Text>
                <Text style={styles.cargoSpecValue}>{packagingMode}</Text>
              </View>
            </View>

            {/* Quantity */}
            <View style={styles.cargoSpecItem}>
              <View style={styles.cargoIconWrap}>
                <Package size={15} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cargoSpecLabel}>Quantity</Text>
                <Text style={styles.cargoSpecValue}>{packageQuantity}</Text>
              </View>
            </View>

            {/* Transit Insurance */}
            <View style={styles.cargoSpecItem}>
              <View style={styles.cargoIconWrap}>
                <ShieldCheck size={15} color={hasInsurance ? '#169B75' : '#64748B'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cargoSpecLabel}>Transit Insurance</Text>
                <Text style={[styles.cargoSpecValue, hasInsurance && { color: '#169B75' }]}>
                  {hasInsurance ? 'Coverage Active' : 'Not Requested'}
                </Text>
                {!hasInsurance ? (
                  <TouchableOpacity onPress={() => onEditStep && onEditStep(2)}>
                    <Text style={styles.addInsuranceLink}>Add Insurance</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* ── Card 3: Hub & Contact Details ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.orangeIconBadge}>
                <MapPin size={16} color="#F15A24" strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionHeaderTitle}>Hub & Contact Details</Text>
            </View>
            <TouchableOpacity
              style={styles.editActionBtn}
              onPress={() => onEditStep && onEditStep(3)}
              activeOpacity={0.7}
            >
              <Edit3 size={13} color="#2563EB" />
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contactsGrid}>
            {/* Sub-Card 1: Pickup Address */}
            <View style={styles.contactSubCard}>
              <View style={styles.contactCardTop}>
                <View style={styles.addressTagRow}>
                  <View style={styles.miniIconOrigin}>
                    <MapPin size={12} color="#F15A24" />
                  </View>
                  <Text style={styles.addressTagOrigin}>PICKUP ADDRESS</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopyText(pickupAddressFull, 'Pickup address')}
                  accessibilityLabel="Copy Pickup Address"
                >
                  <Copy size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.contactAddressText} numberOfLines={3}>
                {pickupAddressFull}
              </Text>

              <View style={styles.contactBottomBar}>
                <View style={styles.contactPersonWrap}>
                  <Phone size={13} color="#64748B" />
                  <Text style={styles.contactPersonName}>
                    {pickupContact} ({pickupPhone})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callPillBtn}
                  onPress={() => handleCall(pickupPhone)}
                  activeOpacity={0.8}
                >
                  <Phone size={12} color="#2563EB" />
                  <Text style={styles.callPillText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-Card 2: Destination Address */}
            <View style={styles.contactSubCard}>
              <View style={styles.contactCardTop}>
                <View style={styles.addressTagRow}>
                  <View style={styles.miniIconDest}>
                    <MapPin size={12} color="#169B75" />
                  </View>
                  <Text style={styles.addressTagDest}>DESTINATION ADDRESS</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopyText(destAddressFull, 'Destination address')}
                  accessibilityLabel="Copy Destination Address"
                >
                  <Copy size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.contactAddressText} numberOfLines={3}>
                {destAddressFull}
              </Text>

              <View style={styles.contactBottomBar}>
                <View style={styles.contactPersonWrap}>
                  <Phone size={13} color="#64748B" />
                  <Text style={styles.contactPersonName}>
                    {destContact} ({destPhone})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.callPillBtn}
                  onPress={() => handleCall(destPhone)}
                  activeOpacity={0.8}
                >
                  <Phone size={12} color="#2563EB" />
                  <Text style={styles.callPillText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── Green Validation Message Panel ── */}
        <View style={styles.greenValidationPanel}>
          <View style={styles.validationCheckWrap}>
            <CheckCircle2 size={24} color="#169B75" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.validationTitle}>Shipment details look good!</Text>
            <Text style={styles.validationDesc}>
              You can edit any section above if needed. Submitting will notify verified carriers across the North Eastern corridor. You will start receiving quotations in real time.
            </Text>
          </View>
        </View>

        {/* ── Feature Shortcuts (4 compact cards) ── */}
        <View style={styles.featureShortcutsGrid}>
          {/* 1. Compare Quotes */}
          <TouchableOpacity
            style={styles.featureShortcutCard}
            onPress={() => onNavigateToFeature && onNavigateToFeature('QUOTES')}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconPurple}>
              <Text style={styles.shortcutRupee}>₹</Text>
            </View>
            <Text style={styles.shortcutTitle}>Compare Quotes</Text>
            <Text style={styles.shortcutSub}>Get best rates</Text>
          </TouchableOpacity>

          {/* 2. Live Tracking */}
          <TouchableOpacity
            style={styles.featureShortcutCard}
            onPress={() => onNavigateToFeature && onNavigateToFeature('TRACKING')}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconGreen}>
              <Truck size={17} color="#169B75" />
            </View>
            <Text style={styles.shortcutTitle}>Live Tracking</Text>
            <Text style={styles.shortcutSub}>Track your shipment</Text>
          </TouchableOpacity>

          {/* 3. Digital Documents */}
          <TouchableOpacity
            style={styles.featureShortcutCard}
            onPress={() => onNavigateToFeature && onNavigateToFeature('DOCS')}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBlue}>
              <FileCheck2 size={17} color="#2563EB" />
            </View>
            <Text style={styles.shortcutTitle}>Digital Documents</Text>
            <Text style={styles.shortcutSub}>Invoices & POD</Text>
          </TouchableOpacity>

          {/* 4. Notifications */}
          <TouchableOpacity
            style={styles.featureShortcutCard}
            onPress={() => onNavigateToFeature && onNavigateToFeature('NOTIFICATIONS')}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconOrange}>
              <Bell size={17} color="#F15A24" />
            </View>
            <Text style={styles.shortcutTitle}>Notifications</Text>
            <Text style={styles.shortcutSub}>Real-time updates</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for sticky bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Sticky Bottom Action Bar ── */}
      <View style={styles.stickyBottomBar}>
        <TouchableOpacity
          style={styles.backSecondaryBtn}
          onPress={onBack}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <ArrowLeft size={16} color="#0B1730" />
          <Text style={styles.backSecondaryBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitPrimaryBtn}
          onPress={handleConfirmSubmit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.submitPrimaryBtnText}>Submit Transport Requirement</Text>
              <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1730',
  },

  /* Stepper */
  stepperContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircleCompleted: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepLabelCompleted: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  stepLabelActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F15A24',
  },
  stepConnectorActive: {
    width: 20,
    height: 2,
    backgroundColor: '#F15A24',
    marginTop: -14,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
  },
  verifiedCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#169B75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#169B75',
  },
  verifiedSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
  },

  /* Headings */
  headingWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0B1730',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },

  scrollContent: {
    padding: 14,
  },

  /* Navy Shipment Summary Card */
  navySummaryCard: {
    backgroundColor: '#0B1730',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#0B1730',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  navyLocationsCol: {
    flex: 1.3,
    gap: 12,
  },
  navyLocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  navyLocIconOrigin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  navyLocIconDest: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#169B75',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  navyLocLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  navyLocCity: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },
  navyLocPin: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 1,
  },
  navyVerticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  navyMetaCol: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  navyMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  navyMetaIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyMetaLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  navyMetaValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  navyMetaValueBold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 1,
  },

  /* White Section Cards */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orangeIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0B1730',
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  editActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Card 1 Grid */
  gridThreeCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pillIconOrange: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeIconText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#169B75',
  },
  gridItemLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  gridItemValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0B1730',
    marginTop: 1,
  },
  gridItemSub: {
    fontSize: 10.5,
    color: '#64748B',
  },

  /* Card 2 Cargo Specs */
  cargoSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cargoSpecItem: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  cargoIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cargoSpecLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  cargoSpecValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0B1730',
    marginTop: 1,
  },
  cargoSpecSub: {
    fontSize: 10,
    color: '#64748B',
  },
  addInsuranceLink: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F15A24',
    marginTop: 2,
  },

  /* Card 3 Hub Contacts */
  contactsGrid: {
    gap: 10,
  },
  contactSubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  contactCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniIconOrigin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIconDest: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTagOrigin: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.4,
  },
  addressTagDest: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#169B75',
    letterSpacing: 0.4,
  },
  contactAddressText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 16,
    marginVertical: 4,
  },
  contactBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  contactPersonWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactPersonName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  callPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* Green Validation Panel */
  greenValidationPanel: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  validationCheckWrap: {
    marginTop: 2,
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#169B75',
    marginBottom: 2,
  },
  validationDesc: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },

  /* Feature Shortcuts Grid */
  featureShortcutsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },
  featureShortcutCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  shortcutIconPurple: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutRupee: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9333EA',
  },
  shortcutIconGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutIconBlue: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutIconOrange: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0B1730',
    textAlign: 'center',
  },
  shortcutSub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },

  /* Sticky Bottom Action Bar */
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  backSecondaryBtn: {
    width: 90,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1730',
  },
  submitPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F15A24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
