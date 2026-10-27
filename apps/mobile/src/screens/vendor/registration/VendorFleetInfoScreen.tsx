import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  CheckCircle2,
  Layers,
  X,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { VendorVehicleConfig } from '../../../types';
import { RegistrationUpdateHeaderBanner } from '../../../components/RegistrationUpdateHeaderBanner';

export const VEHICLE_CATEGORIES: ('Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier')[] = [
  'Lorry',
  'Trailer',
  'Van',
  'Heavy Carrier',
];

export const VEHICLE_BODY_TYPES: ('Open Body' | 'Closed Body')[] = [
  'Open Body',
  'Closed Body',
];

export const CAPACITY_UNITS: ('MT' | 'KG' | 'CBM')[] = [
  'MT',
  'KG',
  'CBM',
];

export const OWNERSHIP_TYPES: ('Owned' | 'Attached' | 'Both')[] = [
  'Owned',
  'Attached',
  'Both',
];

interface VendorFleetInfoScreenProps {
  onBack: () => void;
  onNext: (data: {
    totalFleetCount: number;
    fleetStrength: string;
    vehicleConfigs: VendorVehicleConfig[];
    truckCategories: string[];
    fleetOwnership?: 'Owned' | 'Attached' | 'Both';
  }) => void;
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const VendorFleetInfoScreen: React.FC<VendorFleetInfoScreenProps> = ({
  onBack,
  onNext,
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  // State variables strictly matching registration specifications
  const [totalFleetCount, setTotalFleetCount] = useState('');
  const [vehicleConfigs, setVehicleConfigs] = useState<VendorVehicleConfig[]>([]);
  const [selectedBodyType, setSelectedBodyType] = useState<'Open Body' | 'Closed Body' | ''>('');
  const [selectedVehicleType, setSelectedVehicleType] = useState<'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier' | ''>('');
  const [capacityInput, setCapacityInput] = useState('');
  const [vehicleCountInput, setVehicleCountInput] = useState('');
  const [selectedOwnership, setSelectedOwnership] = useState<'Owned' | 'Attached' | 'Both'>('Owned');

  // Lorry-specific registration and driver fields
  const [registrationNumberInput, setRegistrationNumberInput] = useState('');
  const [makeModelInput, setMakeModelInput] = useState('');
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [driverLicenceInput, setDriverLicenceInput] = useState('');

  const [overallOwnership, setOverallOwnership] = useState<'Owned' | 'Attached' | 'Both'>('Owned');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for Add / Edit Vehicle Configuration
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load any active in-memory session registration data
  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.vehicleConfigs && draft.vehicleConfigs.length > 0) {
        setVehicleConfigs(draft.vehicleConfigs);
        const count = draft.vehicleConfigs.reduce((acc, c) => acc + (Number(c.vehicleCount) || 1), 0);
        setTotalFleetCount(String(count));
      }
      if (draft?.fleetOwnership) {
        setOverallOwnership(draft.fleetOwnership);
        setSelectedOwnership(draft.fleetOwnership);
      }
    })();
  }, []);

  // Total Fleet Strength calculated strictly from saved configurations
  const calculatedTotalFleet = vehicleConfigs.reduce(
    (sum, cfg) => sum + (Number(cfg.vehicleCount) || 1),
    0
  );

  const openAddModal = () => {
    setEditingConfigId(null);
    setRegistrationNumberInput('');
    setSelectedVehicleType('Lorry');
    setSelectedBodyType('Open Body');
    setCapacityInput('');
    setVehicleCountInput('1');
    setMakeModelInput('');
    setDriverNameInput('');
    setDriverPhoneInput('');
    setDriverLicenceInput('');
    setSelectedOwnership(overallOwnership || 'Owned');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleEditConfig = (config: VendorVehicleConfig) => {
    setEditingConfigId(config.id);
    setRegistrationNumberInput(config.registrationNumber || config.rcNumber || '');
    setSelectedVehicleType(config.vehicleType);
    setSelectedBodyType(config.bodyType);
    setCapacityInput(String(config.capacity));
    setVehicleCountInput(String(config.vehicleCount || 1));
    setMakeModelInput(config.makeModel || '');
    setDriverNameInput(config.driverName || '');
    setDriverPhoneInput(config.driverPhone || '');
    setDriverLicenceInput(config.driverLicence || '');
    setSelectedOwnership(config.ownership || overallOwnership || 'Owned');
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingConfigId(null);
    setModalError(null);
  };

  const handleAddOrUpdateConfig = () => {
    setModalError(null);

    const cleanRegNo = registrationNumberInput.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleanRegNo) {
      setModalError('Please enter the Lorry / Vehicle Registration Number (e.g. AS-01-AB-1234).');
      return;
    }

    if (cleanRegNo.length < 5) {
      setModalError('Please enter a valid Registration Number with at least 5 characters (e.g. AS-01-AB-1234).');
      return;
    }

    // Check for duplicate registration numbers
    const duplicate = vehicleConfigs.find(
      (c) => c.id !== editingConfigId && (c.registrationNumber || '').toUpperCase() === cleanRegNo
    );
    if (duplicate) {
      setModalError(`A vehicle with Registration Number "${cleanRegNo}" is already added.`);
      return;
    }

    if (!selectedVehicleType) {
      setModalError('Please select a Vehicle Category (Lorry, Trailer, Van, or Heavy Carrier).');
      return;
    }

    if (!selectedBodyType) {
      setModalError('Please select a Body Type (Open Body or Closed Body).');
      return;
    }

    const cleanCap = parseFloat(capacityInput);
    if (isNaN(cleanCap) || cleanCap <= 0) {
      setModalError('Please enter a valid numeric vehicle capacity in metric tonnes (MT) greater than 0.');
      return;
    }

    const cleanCount = parseInt(vehicleCountInput || '1', 10);
    if (isNaN(cleanCount) || cleanCount <= 0 || !Number.isInteger(cleanCount)) {
      setModalError('Please enter a valid positive whole number for vehicle count.');
      return;
    }

    if (driverPhoneInput.trim() && driverPhoneInput.replace(/\D/g, '').length !== 10) {
      setModalError('Assigned driver phone must be a valid 10-digit mobile number, or left empty.');
      return;
    }

    let updatedConfigs: VendorVehicleConfig[];
    if (editingConfigId) {
      // Update existing configuration
      updatedConfigs = vehicleConfigs.map((c) =>
        c.id === editingConfigId
          ? {
              ...c,
              registrationNumber: cleanRegNo,
              rcNumber: cleanRegNo,
              vehicleType: selectedVehicleType as 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier',
              bodyType: selectedBodyType as 'Open Body' | 'Closed Body',
              capacity: cleanCap,
              capacityUnit: 'MT' as const,
              vehicleCount: cleanCount,
              ownership: selectedOwnership,
              makeModel: makeModelInput.trim() || undefined,
              driverName: driverNameInput.trim() || undefined,
              driverPhone: driverPhoneInput.trim().replace(/\D/g, '') || undefined,
              driverLicence: driverLicenceInput.trim().toUpperCase() || undefined,
            }
          : c
      );
    } else {
      // Add new configuration
      const newConfig: VendorVehicleConfig = {
        id: `vcfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        registrationNumber: cleanRegNo,
        rcNumber: cleanRegNo,
        vehicleType: selectedVehicleType as 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier',
        bodyType: selectedBodyType as 'Open Body' | 'Closed Body',
        capacity: cleanCap,
        capacityUnit: 'MT',
        vehicleCount: cleanCount,
        ownership: selectedOwnership,
        makeModel: makeModelInput.trim() || undefined,
        driverName: driverNameInput.trim() || undefined,
        driverPhone: driverPhoneInput.trim().replace(/\D/g, '') || undefined,
        driverLicence: driverLicenceInput.trim().toUpperCase() || undefined,
      };
      updatedConfigs = [...vehicleConfigs, newConfig];
    }

    setVehicleConfigs(updatedConfigs);
    const newTotal = updatedConfigs.reduce((acc, c) => acc + (Number(c.vehicleCount) || 1), 0);
    setTotalFleetCount(String(newTotal));
    closeModal();
  };

  const handleRemoveConfig = (id: string) => {
    Alert.alert(
      'Remove Configuration',
      'Are you sure you want to delete this vehicle configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const filtered = vehicleConfigs.filter((c) => c.id !== id);
            setVehicleConfigs(filtered);
            const newTotal = filtered.reduce((acc, c) => acc + (Number(c.vehicleCount) || 1), 0);
            setTotalFleetCount(newTotal > 0 ? String(newTotal) : '');
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (vehicleConfigs.length === 0) {
      Alert.alert(
        'Vehicle Registration Required',
        'Please declare your commercial fleet by tapping "Add Another Vehicle (+)". At least one vehicle is required to continue.'
      );
      return;
    }

    if (calculatedTotalFleet <= 0) {
      Alert.alert(
        'Valid Fleet Count Required',
        'Your total fleet strength must be at least 1 vehicle.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const fleetLabel = `${calculatedTotalFleet} Active ${
        calculatedTotalFleet === 1 ? 'Commercial Vehicle' : 'Commercial Vehicles'
      }`;
      const truckCategoriesLabels = vehicleConfigs.map(
        (c) => `${c.bodyType} ${c.vehicleType} (${c.capacity} MT)`
      );

      const stepData = {
        totalFleetCount: calculatedTotalFleet,
        fleetStrength: fleetLabel,
        fleetOwnership: overallOwnership,
        vehicleConfigs,
        truckCategories: truckCategoriesLabels,
      };

      // Save to active in-memory session and database step
      await vendorService.saveActiveRegistrationStep(5, stepData);

      onNext(stepData);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save fleet strength details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Fixed Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Registration Update Mode Banner */}
      {isUpdateMode && (
        <RegistrationUpdateHeaderBanner
          isUpdateMode={isUpdateMode}
          onlyIncompleteSteps={onlyIncompleteSteps}
          stepIndex={5}
          totalSteps={7}
          incompleteStepsCount={incompleteStepsCount}
          currentIncompleteStepNumber={currentIncompleteStepNumber}
          missingFields={missingFields}
          onToggleViewAllSteps={onToggleViewAllSteps}
        />
      )}

      {/* Stepper Progress: Step 5 of 6/7 */}
      <View style={styles.stepperWrap}>
        <View style={styles.stepperHeader}>
          <Text style={styles.stepBadge}>STEP 5 OF 7</Text>
          <Text style={styles.stepTitle}>Fleet Strength & Vehicle Details</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '71%' }]} />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Fleet <Text style={styles.goldText}>Strength</Text>
          </Text>
          <Text style={styles.subText}>
            Declare your commercial fleet size, vehicle categories, body types, and metric tonne capacities.
          </Text>
        </View>

        {/* 1. Total Fleet Strength Summary Card */}
        <View style={styles.totalFleetCard}>
          <View style={styles.totalFleetHeader}>
            <View style={styles.totalFleetIconWrap}>
              <Truck size={22} color="#F05A22" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalFleetLabel}>TOTAL FLEET STRENGTH</Text>
              <Text style={styles.totalFleetSubLabel}>Auto-calculated from saved configurations</Text>
            </View>
          </View>

          <View style={styles.totalCountDisplayRow}>
            <Text style={styles.bigCountText}>{calculatedTotalFleet}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {calculatedTotalFleet === 1 ? 'Commercial Vehicle' : 'Commercial Vehicles'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Vehicle Ownership Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>VEHICLE OWNERSHIP MODEL *</Text>
          <Text style={styles.helperText}>
            Select the primary operational model of commercial vehicles in your fleet:
          </Text>

          <View style={styles.ownershipRow}>
            {OWNERSHIP_TYPES.map((type) => {
              const isSelected = overallOwnership === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.ownershipBtn, isSelected && styles.ownershipBtnActive]}
                  onPress={() => {
                    setOverallOwnership(type);
                    setSelectedOwnership(type);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.ownershipBtnText, isSelected && styles.ownershipBtnTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Registered Fleet Configurations List */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                REGISTERED CONFIGURATIONS ({vehicleConfigs.length})
              </Text>
              <Text style={styles.helperText}>
                Categories, body types, and MT capacities in your fleet:
              </Text>
            </View>
          </View>

          {/* Add Vehicle Configuration Button */}
          <TouchableOpacity
            style={styles.addConfigPrimaryBtn}
            onPress={openAddModal}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addConfigPrimaryBtnText}>Add Another Vehicle (+)</Text>
          </TouchableOpacity>

          {/* Empty State */}
          {vehicleConfigs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Truck size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Vehicles Added Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the "Add Another Vehicle (+)" button above to add your Lorries, Trailers, Vans, or Heavy Carriers.
              </Text>
            </View>
          ) : (
            /* Populated Configuration List */
            <View style={styles.configsList}>
              {vehicleConfigs.map((cfg, index) => (
                <View key={cfg.id} style={styles.configItemCard}>
                  <View style={styles.configCardTop}>
                    <View style={styles.regNoBadge}>
                      <Truck size={14} color="#FFFFFF" />
                      <Text style={styles.regNoBadgeText}>
                        {cfg.registrationNumber || cfg.rcNumber || `LORRY #${index + 1}`}
                      </Text>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{cfg.vehicleType}</Text>
                    </View>
                    <View style={styles.bodyTypeBadge}>
                      <Text style={styles.bodyTypeBadgeText}>{cfg.bodyType}</Text>
                    </View>
                    <View style={styles.ownershipBadge}>
                      <Text style={styles.ownershipBadgeText}>{cfg.ownership || 'Owned'}</Text>
                    </View>
                  </View>

                  <View style={styles.configCardMiddle}>
                    <View style={styles.specColumn}>
                      <Text style={styles.specLabel}>Capacity</Text>
                      <Text style={styles.specValueBold}>{cfg.capacity} MT</Text>
                    </View>
                    <View style={styles.specDivider} />
                    <View style={styles.specColumn}>
                      <Text style={styles.specLabel}>Make / Model</Text>
                      <Text style={styles.specValue} numberOfLines={1}>{cfg.makeModel || 'Commercial Lorry'}</Text>
                    </View>
                  </View>

                  {/* Assigned Driver Row */}
                  <View style={styles.driverInfoRow}>
                    <Text style={styles.driverInfoLabel}>Assigned Driver:</Text>
                    <Text style={styles.driverInfoValue} numberOfLines={1}>
                      {cfg.driverName
                        ? `${cfg.driverName} ${cfg.driverPhone ? '• +91 ' + cfg.driverPhone : ''}`
                        : 'Driver details & DL can be attached in Step 7'}
                    </Text>
                  </View>

                  <View style={styles.configCardBottom}>
                    <TouchableOpacity
                      style={styles.editActionBtn}
                      onPress={() => handleEditConfig(cfg)}
                    >
                      <Edit2 size={14} color="#2563EB" />
                      <Text style={styles.editActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteActionBtn}
                      onPress={() => handleRemoveConfig(cfg.id)}
                    >
                      <Trash2 size={14} color="#DC2626" />
                      <Text style={styles.deleteActionText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 4. Informational Guideline Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <Info size={16} color="#0284C7" />
            <Text style={styles.infoTitle}>TRUCKS Fleet Registration Guidelines</Text>
          </View>
          <Text style={styles.infoText}>
            • Allowed Vehicle Categories: <Text style={styles.boldText}>Lorry, Trailer, Van, Heavy Carrier</Text>.{'\n'}
            • Allowed Body Types: strictly <Text style={styles.boldText}>Open Body</Text> or <Text style={styles.boldText}>Closed Body</Text>.{'\n'}
            • Each vehicle registration number must be authentic and registered under national RTO database.{'\n'}
            • In Step 7, upload individual vehicle documents: RC, C-Book (Fitness), Route Permit, Insurance, PUC, and Driver's Licence.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Action Navigation Bar */}
      <View style={styles.fixedBottomBar}>
        <TouchableOpacity
          style={styles.bottomBackBtn}
          onPress={onBack}
          disabled={isSubmitting}
        >
          <Text style={styles.bottomBackBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomContinueBtn, vehicleConfigs.length === 0 && styles.bottomBtnDisabled]}
          onPress={handleContinue}
          disabled={isSubmitting || vehicleConfigs.length === 0}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.bottomContinueBtnText}>Save & Continue</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 5. Add / Edit Vehicle Configuration Modal / Bottom Sheet */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContentCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingConfigId ? 'Edit Vehicle Details' : 'Vehicle Registration Form'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Enter vehicle registration number, category, capacity & driver
                  </Text>
                </View>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.modalScroll}
              >
                {modalError && (
                  <View style={styles.modalErrorBanner}>
                    <Info size={16} color="#DC2626" />
                    <Text style={styles.modalErrorText}>{modalError}</Text>
                  </View>
                )}

                {/* Field 0: Vehicle Registration Number */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Vehicle Registration Number (RC / Lorry No.) *</Text>
                  <TextInput
                    style={styles.modalTextInputStandalone}
                    placeholder="e.g. AS-01-AB-1234"
                    placeholderTextColor="#94A3B8"
                    value={registrationNumberInput}
                    onChangeText={(val) => setRegistrationNumberInput(val.toUpperCase())}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.modalFieldHint}>Official RTO vehicle numberplate format</Text>
                </View>

                {/* Field 1: Vehicle Body Type */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>1. Vehicle Body Type *</Text>
                  <View style={styles.bodyTypeRow}>
                    {VEHICLE_BODY_TYPES.map((bt) => {
                      const isSelected = selectedBodyType === bt;
                      return (
                        <TouchableOpacity
                          key={bt}
                          style={[styles.bodyTypeBtn, isSelected && styles.bodyTypeBtnActive]}
                          onPress={() => setSelectedBodyType(bt)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.bodyTypeBtnText, isSelected && styles.bodyTypeBtnTextActive]}>
                            {bt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Field 2: Vehicle Type */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>2. Vehicle Type *</Text>
                  <View style={styles.categoryGrid}>
                    {VEHICLE_CATEGORIES.map((cat) => {
                      const isSelected = selectedVehicleType === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                          onPress={() => setSelectedVehicleType(cat)}
                          activeOpacity={0.8}
                        >
                          <Truck size={14} color={isSelected ? '#FFFFFF' : '#475569'} />
                          <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Field 3: Capacity in MT */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>3. Vehicle Capacity & Available Count *</Text>
                  <View style={styles.inputWithUnitWrap}>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="e.g. 15"
                      placeholderTextColor="#94A3B8"
                      value={capacityInput}
                      onChangeText={setCapacityInput}
                      keyboardType="numeric"
                    />
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>MT</Text>
                    </View>
                  </View>
                  <Text style={styles.modalFieldHint}>Rated gross metric tonnes per vehicle</Text>
                </View>

                {/* Field 4: Number of Vehicles */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>4. Number of Vehicles *</Text>
                  <View style={styles.inputWithUnitWrap}>
                    <TextInput
                      style={styles.modalTextInput}
                      placeholder="e.g. 1"
                      placeholderTextColor="#94A3B8"
                      value={vehicleCountInput}
                      onChangeText={(val) => setVehicleCountInput(val.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                    />
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>Vehicles</Text>
                    </View>
                  </View>
                  <Text style={styles.modalFieldHint}>Commercial vehicles with this exact registration / configuration</Text>
                </View>

                {/* Field 5: Vehicle Ownership */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>5. Vehicle Ownership *</Text>
                  <View style={styles.ownershipRow}>
                    {OWNERSHIP_TYPES.map((ot) => {
                      const isSelected = selectedOwnership === ot;
                      return (
                        <TouchableOpacity
                          key={ot}
                          style={[styles.ownershipBtn, isSelected && styles.ownershipBtnActive]}
                          onPress={() => setSelectedOwnership(ot)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.ownershipBtnText, isSelected && styles.ownershipBtnTextActive]}>
                            {ot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Field 6: Vehicle Make & Model (Optional) */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>6. Vehicle Make & Model (Optional)</Text>
                  <TextInput
                    style={styles.modalTextInputStandalone}
                    placeholder="e.g. Tata Signa 2823 / Ashok Leyland 1618"
                    placeholderTextColor="#94A3B8"
                    value={makeModelInput}
                    onChangeText={setMakeModelInput}
                  />
                  <Text style={styles.modalFieldHint}>Commercial vehicle manufacturing details</Text>
                </View>

                {/* Field 7: Assigned Driver Details (Optional) */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>7. Assigned Driver Details (Optional)</Text>
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={styles.modalTextInputStandalone}
                      placeholder="Driver Full Name (e.g. Ramesh Singh)"
                      placeholderTextColor="#94A3B8"
                      value={driverNameInput}
                      onChangeText={setDriverNameInput}
                    />
                    <TextInput
                      style={styles.modalTextInputStandalone}
                      placeholder="Driver 10-Digit Mobile (e.g. 9876543210)"
                      placeholderTextColor="#94A3B8"
                      value={driverPhoneInput}
                      onChangeText={(val) => setDriverPhoneInput(val.replace(/\D/g, '').slice(0, 10))}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={styles.modalTextInputStandalone}
                      placeholder="Driver Licence Number (Optional)"
                      placeholderTextColor="#94A3B8"
                      value={driverLicenceInput}
                      onChangeText={(val) => setDriverLicenceInput(val.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </View>
                  <Text style={styles.modalFieldHint}>Documents for this vehicle and driver can be uploaded in Step 7</Text>
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeModal}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddOrUpdateConfig}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.modalSaveText}>
                    {editingConfigId ? 'Save Changes' : 'Add Vehicle'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 34,
  },
  stepperWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F05A22',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F05A22',
  },
  scrollContainer: {
    padding: 16,
  },
  headingWrap: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  totalFleetCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
    padding: 16,
    marginBottom: 16,
  },
  totalFleetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  totalFleetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  totalFleetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  totalFleetSubLabel: {
    fontSize: 12,
    color: '#9A3412',
    marginTop: 2,
  },
  totalCountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  bigCountText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  ownershipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ownershipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  ownershipBtnActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#F05A22',
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F05A22',
  },
  ownershipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  ownershipBtnTextActive: {
    color: '#F05A22',
    fontWeight: '700',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addConfigPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  addConfigPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  configsList: {
    gap: 12,
  },
  configItemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  configCardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2410C',
  },
  bodyTypeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  bodyTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  ownershipBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownershipBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  configCardMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  specColumn: {
    flex: 1,
    alignItems: 'center',
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  specLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  specValueBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F05A22',
  },
  configCardBottom: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 14,
    marginBottom: 20,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  infoText: {
    fontSize: 11.5,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  fixedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  bottomBackBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  bottomContinueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 13,
    borderRadius: 8,
  },
  bottomBtnDisabled: {
    opacity: 0.5,
  },
  bottomContinueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  categoryPillActive: {
    borderColor: '#F05A22',
    backgroundColor: '#F05A22',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bodyTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bodyTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  bodyTypeBtnActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  bodyTypeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bodyTypeBtnTextActive: {
    color: '#F05A22',
    fontWeight: '700',
  },
  inputWithUnitWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  modalTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  unitBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalFieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  regNoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  regNoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    marginBottom: 8,
  },
  driverInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  driverInfoValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  modalTextInputStandalone: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
});
