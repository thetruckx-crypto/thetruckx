import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Boxes,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
  Thermometer,
  Shield,
  FileText,
  X,
  ShoppingCart,
  Factory,
  Leaf,
  Cpu,
  Shirt,
  Upload,
  Droplet,
  GlassWater,
  Maximize2,
  Umbrella,
  Snowflake,
  FileCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { TransportRequirementDraft, CargoItemSpecification } from '../types';
import { clientService } from '../services/clientService';

interface CargoDetailsScreenProps {
  initialDraft?: Partial<TransportRequirementDraft>;
  clientId?: string;
  onBack: () => void;
  onNext: (draftUpdate: Partial<TransportRequirementDraft>) => void;
}

export const COMMODITY_CATEGORIES = [
  'FMCG and Consumer Goods',
  'Industrial Machinery and Parts',
  'Steel, Pipes and Structural Materials',
  'Tea and Agricultural Products',
  'Electronics and Electrical Goods',
  'Textiles and Garments',
  'Construction Materials',
  'Chemicals and Industrial Materials',
  'Food and Perishable Goods',
  'Automotive Parts',
  'Pharmaceutical and Medical Supplies',
  'Paper, Packaging and Printing Materials',
  'Furniture and Household Goods',
  'Minerals and Raw Materials',
  'Other',
];

export const POPULAR_CATEGORIES = [
  { id: 'FMCG', label: 'FMCG', fullCategory: 'FMCG and Consumer Goods', icon: ShoppingCart },
  { id: 'INDUSTRIAL', label: 'Industrial', fullCategory: 'Industrial Machinery and Parts', icon: Factory },
  { id: 'STEEL', label: 'Steel & Metals', fullCategory: 'Steel, Pipes and Structural Materials', icon: Layers },
  { id: 'AGRICULTURE', label: 'Agriculture', fullCategory: 'Tea and Agricultural Products', icon: Leaf },
  { id: 'ELECTRONICS', label: 'Electronics', fullCategory: 'Electronics and Electrical Goods', icon: Cpu },
  { id: 'TEXTILES', label: 'Textiles', fullCategory: 'Textiles and Garments', icon: Shirt },
] as const;

export const PACKAGING_MODES = [
  'Wooden Pallets',
  'Corrugated Boxes / Cartons',
  'Heavy Wooden Crates',
  'Drums & Barrels',
  'Gunny Bags / Sacks',
  'Shrink-Wrapped',
  'Loose Cargo',
  'Bundles / Coils',
  'Rolls',
  'Containerized Cargo',
  'Other',
];

export const PACKAGE_TYPES = [
  { id: 'Boxes', label: 'Boxes' },
  { id: 'Pallets', label: 'Pallets' },
  { id: 'Crates', label: 'Crates' },
  { id: 'Drums', label: 'Drums' },
  { id: 'Bags', label: 'Bags' },
  { id: 'Other', label: '+ Other' },
];

export const HAZARD_CLASSES = [
  'Class 1 - Explosives',
  'Class 2 - Gases (Flammable / Non-flammable)',
  'Class 3 - Flammable Liquids',
  'Class 4 - Flammable Solids',
  'Class 5 - Oxidizing Substances',
  'Class 6 - Toxic & Infectious Substances',
  'Class 7 - Radioactive Materials',
  'Class 8 - Corrosives',
  'Class 9 - Miscellaneous Dangerous Goods',
];

export const PACKING_GROUPS = ['PG I', 'PG II', 'PG III'] as const;

export const CargoDetailsScreen: React.FC<CargoDetailsScreenProps> = ({
  initialDraft,
  clientId,
  onBack,
  onNext,
}) => {
  // ── 1. Commodity State (Task 7: Clean draft isolation, no hardcoded fallbacks) ──
  const [selectedCommodity, setSelectedCommodity] = useState<string>(
    initialDraft?.materialType || ''
  );
  const [isCustomCommodity, setIsCustomCommodity] = useState<boolean>(
    Boolean(initialDraft?.customCommodityName) || initialDraft?.materialType === 'Other'
  );
  const [customCommodityName, setCustomCommodityName] = useState<string>(
    initialDraft?.customCommodityName || ''
  );
  const [commoditySearchQuery, setCommoditySearchQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  // ── 2. Weight and Quantity State ──
  const [cargoWeight, setCargoWeight] = useState<string>(
    initialDraft?.weightValue
      ? String(initialDraft.weightValue)
      : initialDraft?.requiredCapacityMt
      ? String(initialDraft.requiredCapacityMt)
      : ''
  );
  const [weightUnit, setWeightUnit] = useState<'kg' | 'MT'>(
    initialDraft?.weightUnit || 'MT'
  );
  const [packageCount, setPackageCount] = useState<string>(
    initialDraft?.packageCount
      ? String(initialDraft.packageCount)
      : initialDraft?.numberOfUnits
      ? String(initialDraft.numberOfUnits)
      : ''
  );
  const [selectedPackageType, setSelectedPackageType] = useState<string>(
    initialDraft?.packagingUnit || initialDraft?.packagingType || 'Boxes'
  );
  const [customPackageType, setCustomPackageType] = useState<string>(
    initialDraft?.customPackagingUnit || ''
  );

  // ── 3. Packaging Mode State ──
  const [selectedPackagingModes, setSelectedPackagingModes] = useState<string[]>(
    initialDraft?.packagingModes || []
  );
  const [customPackagingMode, setCustomPackagingMode] = useState<string>(
    initialDraft?.customPackagingMode || ''
  );
  const [hasCustomMode, setHasCustomMode] = useState(
    Boolean(initialDraft?.customPackagingMode) || false
  );

  // ── 4. Dimensions & Cargo Properties ──
  const [isDimensionsExpanded, setIsDimensionsExpanded] = useState<boolean>(
    Boolean(initialDraft?.dimensionsLength || initialDraft?.dimensionsWidth || initialDraft?.dimensionsHeight)
  );
  const [dimLength, setDimLength] = useState<string>(initialDraft?.dimensionsLength || '');
  const [dimWidth, setDimWidth] = useState<string>(initialDraft?.dimensionsWidth || '');
  const [dimHeight, setDimHeight] = useState<string>(initialDraft?.dimensionsHeight || '');
  const [dimUnit, setDimUnit] = useState<'ft' | 'cm' | 'm'>(
    (initialDraft?.dimensionsUnit as any) || 'ft'
  );

  // Special cargo properties switches
  const [isFragile, setIsFragile] = useState<boolean>(initialDraft?.isFragile || false);
  const [isLiquid, setIsLiquid] = useState<boolean>(initialDraft?.isLiquid || false);
  const [isOversized, setIsOversized] = useState<boolean>(initialDraft?.isOversized || false);
  const [isMoistureSensitive, setIsMoistureSensitive] = useState<boolean>(
    initialDraft?.isMoistureSensitive || false
  );
  const [isTemperatureSensitive, setIsTemperatureSensitive] = useState<boolean>(
    initialDraft?.isTemperatureSensitive || false
  );
  const [tempMin, setTempMin] = useState<string>(initialDraft?.temperatureMin || '');
  const [tempMax, setTempMax] = useState<string>(initialDraft?.temperatureMax || '');

  // ── 5. Hazardous Cargo State ──
  const [isHazardous, setIsHazardous] = useState<boolean>(initialDraft?.isHazardous || false);
  const [hazardClass, setHazardClass] = useState<string>(
    initialDraft?.hazardClass || 'Class 3 - Flammable Liquids'
  );
  const [unNumber, setUnNumber] = useState<string>(initialDraft?.unNumber || '');
  const [properShippingName, setProperShippingName] = useState<string>(
    initialDraft?.hazardousName || ''
  );
  const [packingGroup, setPackingGroup] = useState<'PG I' | 'PG II' | 'PG III'>(
    (initialDraft?.packingGroup as any) || 'PG II'
  );
  const [sdsDocumentUri, setSdsDocumentUri] = useState<string>(
    initialDraft?.sdsDocumentUri || ''
  );
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // ── 6. Transit Insurance State ──
  const [transitInsuranceNeeded, setTransitInsuranceNeeded] = useState<boolean>(
    initialDraft?.transitInsuranceNeeded ?? false
  );
  const [declaredValue, setDeclaredValue] = useState<string>(
    initialDraft?.declaredCargoValue || ''
  );
  const [currency] = useState<'INR'>('INR');

  // Autosave & Validation
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('SAVED');
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  // ── Calculations ──
  // Equivalent Payload MT (Exact formula: 1 MT = 1,000 kg)
  const equivalentWeightMt = useMemo(() => {
    const rawNum = parseFloat(cargoWeight.replace(/,/g, '')) || 0;
    if (weightUnit === 'kg') {
      return (rawNum / 1000).toFixed(3);
    }
    return rawNum.toFixed(3);
  }, [cargoWeight, weightUnit]);

  // Volume calculation in both ft³ and m³
  const calculatedVolume = useMemo(() => {
    const l = parseFloat(dimLength) || 0;
    const w = parseFloat(dimWidth) || 0;
    const h = parseFloat(dimHeight) || 0;
    if (l <= 0 || w <= 0 || h <= 0) return null;

    let volCuFt = 0;
    let volCuM = 0;

    if (dimUnit === 'ft') {
      volCuFt = l * w * h;
      volCuM = volCuFt * 0.0283168;
    } else if (dimUnit === 'm') {
      volCuM = l * w * h;
      volCuFt = volCuM * 35.3147;
    } else if (dimUnit === 'cm') {
      const volCuCm = l * w * h;
      volCuM = volCuCm / 1000000;
      volCuFt = volCuM * 35.3147;
    }

    return {
      cuFt: volCuFt.toFixed(2),
      cuM: volCuM.toFixed(2),
    };
  }, [dimLength, dimWidth, dimHeight, dimUnit]);

  // Filtered commodity categories when searching or viewing all
  const filteredCategories = useMemo(() => {
    const q = commoditySearchQuery.trim().toLowerCase();
    if (!q) {
      return showAllCategories ? COMMODITY_CATEGORIES : [];
    }
    return COMMODITY_CATEGORIES.filter((c) => c.toLowerCase().includes(q));
  }, [commoditySearchQuery, showAllCategories]);

  // ── Autosave Draft Function ──
  const autoSaveDraft = useCallback(
    async (override?: Partial<TransportRequirementDraft>) => {
      try {
        setSaveStatus('SAVING');

        const weightNum = parseFloat(cargoWeight.replace(/,/g, '')) || 0;
        const normalizedCapacityMt = weightUnit === 'kg' ? weightNum / 1000 : weightNum;
        const countNum = parseInt(packageCount.replace(/[^0-9]/g, ''), 10) || 0;

        const draftToPersist: Partial<TransportRequirementDraft> = {
          materialType: isCustomCommodity ? 'Other' : selectedCommodity,
          customCommodityName: isCustomCommodity ? customCommodityName.trim() : undefined,
          weightValue: weightNum,
          weightUnit,
          requiredCapacityMt: normalizedCapacityMt,
          numberOfUnits: String(countNum),
          packageCount: countNum,
          packagingType: selectedPackageType,
          packagingUnit: selectedPackageType,
          customPackagingUnit: selectedPackageType === 'Other' ? customPackageType.trim() : undefined,
          packagingModes: selectedPackagingModes,
          customPackagingMode: hasCustomMode ? customPackagingMode.trim() : undefined,
          dimensionsLength: dimLength.trim() || undefined,
          dimensionsWidth: dimWidth.trim() || undefined,
          dimensionsHeight: dimHeight.trim() || undefined,
          dimensionsUnit: dimUnit,
          calculatedVolume: calculatedVolume ? parseFloat(calculatedVolume.cuFt) : undefined,
          isFragile,
          isLiquid,
          isOversized,
          isMoistureSensitive,
          isTemperatureSensitive,
          temperatureMin: isTemperatureSensitive ? tempMin.trim() : undefined,
          temperatureMax: isTemperatureSensitive ? tempMax.trim() : undefined,
          isHazardous,
          hazardousName: isHazardous ? properShippingName.trim() : undefined,
          hazardClass: isHazardous ? hazardClass : undefined,
          unNumber: isHazardous ? unNumber.trim() : undefined,
          packingGroup: isHazardous ? packingGroup : undefined,
          sdsDocumentUri: isHazardous ? sdsDocumentUri : undefined,
          transitInsuranceNeeded,
          declaredCargoValue: transitInsuranceNeeded ? declaredValue.trim() : undefined,
          declaredValueCurrency: currency,
          ...override,
        };

        const success = await clientService.saveTransportRequirementDraft(draftToPersist, clientId);
        setSaveStatus(success ? 'SAVED' : 'FAILED');
      } catch {
        setSaveStatus('FAILED');
      }
    },
    [
      selectedCommodity,
      isCustomCommodity,
      customCommodityName,
      cargoWeight,
      weightUnit,
      packageCount,
      selectedPackageType,
      customPackageType,
      selectedPackagingModes,
      hasCustomMode,
      customPackagingMode,
      dimLength,
      dimWidth,
      dimHeight,
      dimUnit,
      calculatedVolume,
      isFragile,
      isLiquid,
      isOversized,
      isMoistureSensitive,
      isTemperatureSensitive,
      tempMin,
      tempMax,
      isHazardous,
      properShippingName,
      hazardClass,
      unNumber,
      packingGroup,
      sdsDocumentUri,
      transitInsuranceNeeded,
      declaredValue,
      currency,
      clientId,
    ]
  );

  // Debounced autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSaveDraft();
    }, 800);
    return () => clearTimeout(timer);
  }, [autoSaveDraft]);

  // ── Commodity Selection Handlers ──
  const handleSelectCommodity = (category: string) => {
    if (category === 'Other') {
      setIsCustomCommodity(true);
      setSelectedCommodity('Other');
    } else {
      setIsCustomCommodity(false);
      setSelectedCommodity(category);
      setCustomCommodityName('');
    }
    setCommoditySearchQuery('');
    setShowAllCategories(false);
    if (inlineErrors.commodity) {
      setInlineErrors((prev) => ({ ...prev, commodity: '' }));
    }
  };

  const handleClearCommodity = () => {
    setSelectedCommodity('');
    setIsCustomCommodity(false);
    setCustomCommodityName('');
  };

  // ── Packaging Mode Toggle ──
  const togglePackagingMode = (mode: string) => {
    if (mode === 'Other') {
      const next = !hasCustomMode;
      setHasCustomMode(next);
      if (next) {
        if (!selectedPackagingModes.includes('Other')) {
          setSelectedPackagingModes((prev) => [...prev, 'Other']);
        }
      } else {
        setSelectedPackagingModes((prev) => prev.filter((m) => m !== 'Other'));
      }
      return;
    }

    setSelectedPackagingModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  // ── Document Upload Simulation ──
  const handleSimulateUpload = () => {
    setIsUploadingDoc(true);
    setTimeout(() => {
      setIsUploadingDoc(false);
      setSdsDocumentUri(`MSDS_${properShippingName.replace(/\s+/g, '_')}_2026.pdf`);
    }, 900);
  };

  // ── Form Validation & Navigation to Step 3 ──
  const handleContinue = async () => {
    Keyboard.dismiss();
    const errors: Record<string, string> = {};

    if (!selectedCommodity) {
      errors.commodity = 'Please select a commodity category.';
    }
    if (isCustomCommodity && !customCommodityName.trim()) {
      errors.customCommodity = 'Please specify your custom commodity name.';
    }

    const weightNum = parseFloat(cargoWeight.replace(/,/g, ''));
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.weight = 'Please enter a valid positive cargo weight.';
    }

    const countNum = parseInt(packageCount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(countNum) || countNum < 1) {
      errors.packageCount = 'Please enter a valid package count (at least 1).';
    }

    if (selectedPackageType === 'Other' && !customPackageType.trim()) {
      errors.customPackageType = 'Please specify custom package type.';
    }

    if (isHazardous) {
      if (!properShippingName.trim()) {
        errors.properShippingName = 'Proper shipping name is required for Hazchem cargo.';
      }
      if (!unNumber.trim()) {
        errors.unNumber = 'UN number is required for Hazchem cargo.';
      }
    }

    if (transitInsuranceNeeded && !declaredValue.trim()) {
      errors.declaredValue = 'Please enter declared cargo value for insurance.';
    }

    if (Object.keys(errors).length > 0) {
      setInlineErrors(errors);
      return;
    }

    const normalizedCapacityMt = weightUnit === 'kg' ? weightNum / 1000 : weightNum;

    const updatePayload: Partial<TransportRequirementDraft> = {
      materialType: isCustomCommodity ? 'Other' : selectedCommodity,
      customCommodityName: isCustomCommodity ? customCommodityName.trim() : undefined,
      weightValue: weightNum,
      weightUnit,
      requiredCapacityMt: normalizedCapacityMt,
      numberOfUnits: String(countNum),
      packageCount: countNum,
      packagingType: selectedPackageType,
      packagingUnit: selectedPackageType,
      customPackagingUnit: selectedPackageType === 'Other' ? customPackageType.trim() : undefined,
      packagingModes: selectedPackagingModes,
      customPackagingMode: hasCustomMode ? customPackagingMode.trim() : undefined,
      dimensionsLength: dimLength.trim() || undefined,
      dimensionsWidth: dimWidth.trim() || undefined,
      dimensionsHeight: dimHeight.trim() || undefined,
      dimensionsUnit: dimUnit,
      calculatedVolume: calculatedVolume ? parseFloat(calculatedVolume.cuFt) : undefined,
      isFragile,
      isLiquid,
      isOversized,
      isMoistureSensitive,
      isTemperatureSensitive,
      temperatureMin: isTemperatureSensitive ? tempMin.trim() : undefined,
      temperatureMax: isTemperatureSensitive ? tempMax.trim() : undefined,
      isHazardous,
      hazardousName: isHazardous ? properShippingName.trim() : undefined,
      hazardClass: isHazardous ? hazardClass : undefined,
      unNumber: isHazardous ? unNumber.trim() : undefined,
      packingGroup: isHazardous ? packingGroup : undefined,
      sdsDocumentUri: isHazardous ? sdsDocumentUri : undefined,
      transitInsuranceNeeded,
      declaredCargoValue: transitInsuranceNeeded ? declaredValue.trim() : undefined,
      declaredValueCurrency: currency,
    };

    await autoSaveDraft(updatePayload);
    onNext(updatePayload);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Top Header Bar (Screenshot Match) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>

        <BrandLogoHeader size="sm" showSubtitle={false} />

        <View style={styles.saveBadgeWrap}>
          {saveStatus === 'SAVING' ? (
            <View style={styles.saveBadge}>
              <ActivityIndicator size="small" color="#F15A24" />
              <Text style={styles.saveBadgeText}>Saving...</Text>
            </View>
          ) : saveStatus === 'SAVED' ? (
            <View style={[styles.saveBadge, styles.saveBadgeSuccess]}>
              <Check size={13} color="#16A34A" strokeWidth={3} />
              <Text style={styles.saveBadgeTextSuccess}>Draft Saved</Text>
            </View>
          ) : saveStatus === 'FAILED' ? (
            <TouchableOpacity onPress={() => autoSaveDraft()} style={[styles.saveBadge, styles.saveBadgeFailed]}>
              <AlertCircle size={13} color="#DC2626" />
              <Text style={styles.saveBadgeTextFailed}>Retry Save</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 42 }} />
          )}
        </View>
      </View>

      {/* ── 2. Progress Step Bar: Step 2 of 4 (50%) ── */}
      <View style={styles.stepContainer}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepBadge}>STEP 2 OF 4</Text>
          <Text style={styles.stepPercent}>50% Completed</Text>
        </View>
        <Text style={styles.stepTitle}>Cargo Specifications</Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '50%' }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* ── Card 1: Material & Commodity Type (Screenshot 1 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.orangeIconCircle}>
              <Package size={18} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Material & Commodity Type</Text>
              <Text style={styles.cardSubtitle}>Select the cargo being transported.</Text>
            </View>
          </View>

          {/* Search Field */}
          <View style={styles.searchContainer}>
            <Search size={17} color="#667085" />
            <TextInput
              style={styles.searchInput}
              value={commoditySearchQuery}
              onChangeText={setCommoditySearchQuery}
              placeholder="Search commodity..."
              placeholderTextColor="#94A3B8"
            />
            {commoditySearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCommoditySearchQuery('')}>
                <X size={16} color="#667085" />
              </TouchableOpacity>
            )}
          </View>

          {/* Popular Categories Grid (or Full List when searching/view all) */}
          {commoditySearchQuery.trim().length === 0 && !showAllCategories ? (
            <View style={{ marginTop: 14 }}>
              <View style={styles.popularHeaderRow}>
                <Text style={styles.popularSectionTitle}>Popular Categories</Text>
                <TouchableOpacity onPress={() => setShowAllCategories(true)}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.popularGrid}>
                {POPULAR_CATEGORIES.map((pop) => {
                  const isSelected = selectedCommodity === pop.fullCategory;
                  const IconComp = pop.icon;

                  return (
                    <TouchableOpacity
                      key={pop.id}
                      style={[styles.popularChip, isSelected && styles.popularChipSelected]}
                      onPress={() => handleSelectCommodity(pop.fullCategory)}
                      activeOpacity={0.8}
                    >
                      <IconComp
                        size={16}
                        color={isSelected ? '#F15A24' : '#0C1A34'}
                        strokeWidth={2.2}
                      />
                      <Text style={[styles.popularChipText, isSelected && styles.popularChipTextSelected]}>
                        {pop.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <View style={styles.popularHeaderRow}>
                <Text style={styles.popularSectionTitle}>All Categories</Text>
                <TouchableOpacity onPress={() => setShowAllCategories(false)}>
                  <Text style={styles.viewAllText}>Show Popular</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fullCategoriesWrap}>
                {filteredCategories.map((cat) => {
                  const isSelected = selectedCommodity === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryRowItem, isSelected && styles.categoryRowItemSelected]}
                      onPress={() => handleSelectCommodity(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.categoryRowText, isSelected && styles.categoryRowTextSelected]}>
                        {cat}
                      </Text>
                      {isSelected && <Check size={16} color="#F15A24" strokeWidth={3} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Selected Commodity Display Card (Screenshot 1 Match) */}
          {selectedCommodity && !isCustomCommodity && (
            <View style={styles.selectedCommodityBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedCommodityLabel}>Selected Commodity</Text>
                <Text style={styles.selectedCommodityValue}>{selectedCommodity}</Text>
              </View>
              <TouchableOpacity onPress={handleClearCommodity} style={styles.removeCommodityBtn}>
                <X size={17} color="#0C1A34" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          )}

          {/* Custom Commodity Input when "Other" is selected */}
          {isCustomCommodity && (
            <View style={styles.customCommodityWrap}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Specify Custom Commodity Name *</Text>
                <TouchableOpacity onPress={handleClearCommodity}>
                  <X size={15} color="#667085" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, inlineErrors.customCommodity ? styles.textInputError : undefined]}
                value={customCommodityName}
                onChangeText={(t) => {
                  setCustomCommodityName(t);
                  if (inlineErrors.customCommodity) {
                    setInlineErrors((prev) => ({ ...prev, customCommodity: '' }));
                  }
                }}
                placeholder="e.g. Pharmaceutical API, Heavy Mining Spares, Solar Panels"
                placeholderTextColor="#94A3B8"
              />
              {inlineErrors.customCommodity && (
                <Text style={styles.inlineErrorText}>{inlineErrors.customCommodity}</Text>
              )}
            </View>
          )}
          {inlineErrors.commodity && <Text style={styles.inlineErrorText}>{inlineErrors.commodity}</Text>}
        </View>

        {/* ── Card 2: Weight and Quantity (Screenshot 1 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.orangeIconCircle}>
              <Scale size={18} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Weight and Quantity</Text>
              <Text style={styles.cardSubtitle}>Enter accurate cargo weight and package count.</Text>
            </View>
          </View>

          {/* Total Cargo Weight * with Unit Selector (kg vs MT) */}
          <Text style={styles.inputLabel}>Total Cargo Weight *</Text>
          <View style={styles.weightInputRow}>
            <TextInput
              style={[styles.weightInput, inlineErrors.weight ? styles.textInputError : undefined]}
              value={cargoWeight}
              onChangeText={(t) => {
                setCargoWeight(t);
                if (inlineErrors.weight) {
                  setInlineErrors((prev) => ({ ...prev, weight: '' }));
                }
              }}
              placeholder="e.g. 25"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />

            <View style={styles.unitSelectorSegment}>
              <TouchableOpacity
                style={[styles.unitSegmentBtn, weightUnit === 'kg' && styles.unitSegmentBtnActive]}
                onPress={() => setWeightUnit('kg')}
              >
                <Text style={[styles.unitSegmentText, weightUnit === 'kg' && styles.unitSegmentTextActive]}>
                  kg
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.unitSegmentBtn, weightUnit === 'MT' && styles.unitSegmentBtnActive]}
                onPress={() => setWeightUnit('MT')}
              >
                <Text style={[styles.unitSegmentText, weightUnit === 'MT' && styles.unitSegmentTextActive]}>
                  MT
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {inlineErrors.weight && <Text style={styles.inlineErrorText}>{inlineErrors.weight}</Text>}

          {/* Equivalent Conversion Badge (Screenshot 1 Match) */}
          <View style={styles.equivalentBadge}>
            <Check size={14} color="#16A34A" strokeWidth={3} />
            <Text style={styles.equivalentBadgeText}>
              Equivalent: {equivalentWeightMt} Metric Tonnes (MT)
            </Text>
          </View>

          {/* Package / Unit Count * */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Package / Unit Count *</Text>
          <View style={styles.packageCountContainer}>
            <TextInput
              style={[styles.packageCountInput, inlineErrors.packageCount ? styles.textInputError : undefined]}
              value={packageCount}
              onChangeText={(t) => {
                setPackageCount(t.replace(/[^0-9]/g, ''));
                if (inlineErrors.packageCount) {
                  setInlineErrors((prev) => ({ ...prev, packageCount: '' }));
                }
              }}
              placeholder="Enter quantity"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
            <Text style={styles.packageCountSuffix}>packages</Text>
          </View>
          {inlineErrors.packageCount && (
            <Text style={styles.inlineErrorText}>{inlineErrors.packageCount}</Text>
          )}

          {/* Package Type * (Screenshot 1 Match) */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Package Type *</Text>
          <View style={styles.packageTypeGrid}>
            {PACKAGE_TYPES.map((pkg) => {
              const isSelected = selectedPackageType === pkg.id;

              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.packageTypeTile, isSelected && styles.packageTypeTileSelected]}
                  onPress={() => {
                    setSelectedPackageType(pkg.id);
                    if (inlineErrors.customPackageType) {
                      setInlineErrors((prev) => ({ ...prev, customPackageType: '' }));
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.packageTypeTileText, isSelected && styles.packageTypeTileTextSelected]}
                  >
                    {pkg.label}
                  </Text>
                  {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedPackageType === 'Other' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.subFieldLabel}>Specify Custom Package Type *</Text>
              <TextInput
                style={[styles.textInput, inlineErrors.customPackageType ? styles.textInputError : undefined]}
                value={customPackageType}
                onChangeText={(t) => {
                  setCustomPackageType(t);
                  if (inlineErrors.customPackageType) {
                    setInlineErrors((prev) => ({ ...prev, customPackageType: '' }));
                  }
                }}
                placeholder="e.g. Cylinders, Reels, Jars, Bundles"
                placeholderTextColor="#94A3B8"
              />
              {inlineErrors.customPackageType && (
                <Text style={styles.inlineErrorText}>{inlineErrors.customPackageType}</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Card 3: Packaging Mode (Screenshot 1 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.orangeIconCircle}>
              <Boxes size={18} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Packaging Mode</Text>
              <Text style={styles.cardSubtitle}>Select all applicable packaging methods.</Text>
            </View>
          </View>

          <View style={styles.packagingModesWrap}>
            {PACKAGING_MODES.slice(0, 7).map((mode) => {
              const isSelected = selectedPackagingModes.includes(mode);

              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.packagingModeChip, isSelected && styles.packagingModeChipSelected]}
                  onPress={() => togglePackagingMode(mode)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.packagingModeChipText, isSelected && styles.packagingModeChipTextSelected]}
                  >
                    {mode}
                  </Text>
                  {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}

            {/* Other Mode Button */}
            <TouchableOpacity
              style={[styles.packagingModeChip, hasCustomMode && styles.packagingModeChipSelected]}
              onPress={() => togglePackagingMode('Other')}
              activeOpacity={0.8}
            >
              <Plus size={13} color={hasCustomMode ? '#FFFFFF' : '#0C1A34'} strokeWidth={2.4} />
              <Text
                style={[styles.packagingModeChipText, hasCustomMode && styles.packagingModeChipTextSelected]}
              >
                Other Mode
              </Text>
            </TouchableOpacity>
          </View>

          {hasCustomMode && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.subFieldLabel}>Describe Custom Packaging *</Text>
              <TextInput
                style={styles.textInput}
                value={customPackagingMode}
                onChangeText={setCustomPackagingMode}
                placeholder="e.g. Foam-lined steel cages, shrink vacuum"
                placeholderTextColor="#94A3B8"
              />
            </View>
          )}
        </View>

        {/* ── Card 4: Dimensions & Cargo Properties (Screenshot 2 Match) ── */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsDimensionsExpanded((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.orangeIconCircle}>
                <Sliders size={18} color="#0C1A34" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Dimensions & Cargo Properties</Text>
                <Text style={styles.cardSubtitle}>
                  Optional dimensions, volume calculation, and special cargo properties.
                </Text>
              </View>
            </View>

            {isDimensionsExpanded ? (
              <ChevronUp size={20} color="#667085" />
            ) : (
              <ChevronDown size={20} color="#667085" />
            )}
          </TouchableOpacity>

          {isDimensionsExpanded && (
            <View style={styles.dimensionsBody}>
              {/* Package Dimensions (L x W x H) */}
              <Text style={styles.inputLabel}>Package Dimensions (L x W x H)</Text>
              <View style={styles.dimRow}>
                <TextInput
                  style={styles.dimBox}
                  value={dimLength}
                  onChangeText={setDimLength}
                  placeholder="L"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <Text style={styles.dimTimesSymbol}>×</Text>
                <TextInput
                  style={styles.dimBox}
                  value={dimWidth}
                  onChangeText={setDimWidth}
                  placeholder="W"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <Text style={styles.dimTimesSymbol}>×</Text>
                <TextInput
                  style={styles.dimBox}
                  value={dimHeight}
                  onChangeText={setDimHeight}
                  placeholder="H"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />

                {/* Segmented Unit Selector (ft, cm, m) */}
                <View style={styles.dimUnitSegment}>
                  {(['ft', 'cm', 'm'] as const).map((u) => {
                    const isSelected = dimUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.dimUnitBtn, isSelected && styles.dimUnitBtnActive]}
                        onPress={() => setDimUnit(u)}
                      >
                        <Text style={[styles.dimUnitText, isSelected && styles.dimUnitTextActive]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Calculated Volume Box (Screenshot 2 Match: 480.00 ft³ | 13.59 m³) */}
              {calculatedVolume && (
                <View style={styles.volumeBox}>
                  <Package size={20} color="#0C1A34" strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.volumeLabel}>Calculated Volume</Text>
                    <Text style={styles.volumeValue}>
                      {calculatedVolume.cuFt} ft³  |  {calculatedVolume.cuM} m³
                    </Text>
                  </View>
                </View>
              )}

              {/* 5 Cargo Properties Switches (Screenshot 2 Match) */}
              <View style={styles.propertiesList}>
                {/* 1. Fragile */}
                <View style={styles.propertyRow}>
                  <GlassWater size={18} color="#0C1A34" strokeWidth={2.2} />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>Fragile / Glassware Cargo</Text>
                    <Text style={styles.propertyDesc}>Requires careful handling</Text>
                  </View>
                  <Switch
                    value={isFragile}
                    onValueChange={setIsFragile}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isFragile ? '#F15A24' : '#FFFFFF'}
                  />
                </View>

                {/* 2. Liquid */}
                <View style={styles.propertyRow}>
                  <Droplet size={18} color="#0C1A34" strokeWidth={2.2} />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>Liquid / Fluid Cargo</Text>
                    <Text style={styles.propertyDesc}>Applicable for liquids and fluids</Text>
                  </View>
                  <Switch
                    value={isLiquid}
                    onValueChange={setIsLiquid}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isLiquid ? '#F15A24' : '#FFFFFF'}
                  />
                </View>

                {/* 3. Oversized */}
                <View style={styles.propertyRow}>
                  <Maximize2 size={18} color="#0C1A34" strokeWidth={2.2} />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>Oversized (ODC) Dimensions</Text>
                    <Text style={styles.propertyDesc}>Non-standard or over-dimensional cargo</Text>
                  </View>
                  <Switch
                    value={isOversized}
                    onValueChange={setIsOversized}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isOversized ? '#F15A24' : '#FFFFFF'}
                  />
                </View>

                {/* 4. Moisture-Sensitive */}
                <View style={styles.propertyRow}>
                  <Umbrella size={18} color="#0C1A34" strokeWidth={2.2} />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>Moisture-Sensitive Cargo</Text>
                    <Text style={styles.propertyDesc}>Requires dry environment</Text>
                  </View>
                  <Switch
                    value={isMoistureSensitive}
                    onValueChange={setIsMoistureSensitive}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isMoistureSensitive ? '#F15A24' : '#FFFFFF'}
                  />
                </View>

                {/* 5. Temperature-Sensitive / Reefer */}
                <View style={styles.propertyRow}>
                  <Snowflake size={18} color="#0C1A34" strokeWidth={2.2} />
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyTitle}>Temperature-Sensitive / Reefer</Text>
                    <Text style={styles.propertyDesc}>Requires temperature control</Text>
                  </View>
                  <Switch
                    value={isTemperatureSensitive}
                    onValueChange={setIsTemperatureSensitive}
                    trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
                    thumbColor={isTemperatureSensitive ? '#F15A24' : '#FFFFFF'}
                  />
                </View>

                {isTemperatureSensitive && (
                  <View style={styles.temperatureRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Min Temp (°C)</Text>
                      <TextInput
                        style={styles.tempInput}
                        value={tempMin}
                        onChangeText={setTempMin}
                        placeholder="e.g. 2°C"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Max Temp (°C)</Text>
                      <TextInput
                        style={styles.tempInput}
                        value={tempMax}
                        onChangeText={setTempMax}
                        placeholder="e.g. 8°C"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ── Card 5: Hazardous (Hazchem) Cargo (Screenshot 2 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeader}>
              <View style={styles.redIconCircle}>
                <AlertTriangle size={18} color="#EA580C" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Hazardous (Hazchem) Cargo</Text>
                <Text style={styles.cardSubtitle}>
                  Declare if the cargo contains regulated or dangerous goods.
                </Text>
              </View>
            </View>

            <Switch
              value={isHazardous}
              onValueChange={setIsHazardous}
              trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
              thumbColor={isHazardous ? '#F15A24' : '#FFFFFF'}
            />
          </View>

          {isHazardous && (
            <View style={styles.hazchemBody}>
              {/* Row 1: Hazard Class & UN Number */}
              <View style={styles.formRow}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>Hazard Class *</Text>
                  <View style={styles.dropdownSelector}>
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {hazardClass}
                    </Text>
                    <ChevronDown size={16} color="#667085" />
                  </View>
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={styles.inputLabel}>UN Number *</Text>
                  <TextInput
                    style={[styles.textInput, inlineErrors.unNumber ? styles.textInputError : undefined]}
                    value={unNumber}
                    onChangeText={(t) => {
                      setUnNumber(t);
                      if (inlineErrors.unNumber) setInlineErrors((p) => ({ ...p, unNumber: '' }));
                    }}
                    placeholder="e.g. UN1203"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Row 2: Proper Shipping Name & Packing Group */}
              <View style={[styles.formRow, { marginTop: 10 }]}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>Proper Shipping Name *</Text>
                  <TextInput
                    style={[styles.textInput, inlineErrors.properShippingName ? styles.textInputError : undefined]}
                    value={properShippingName}
                    onChangeText={(t) => {
                      setProperShippingName(t);
                      if (inlineErrors.properShippingName) {
                        setInlineErrors((p) => ({ ...p, properShippingName: '' }));
                      }
                    }}
                    placeholder="e.g. Gasoline"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={styles.inputLabel}>Packing Group</Text>
                  <View style={styles.dropdownSelector}>
                    <Text style={styles.dropdownText}>{packingGroup}</Text>
                    <ChevronDown size={16} color="#667085" />
                  </View>
                </View>
              </View>

              {/* Upload Safety Document (MSDS) Box */}
              <View style={styles.uploadBox}>
                <View style={styles.uploadInfoWrap}>
                  <FileText size={20} color="#0C1A34" strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadTitle}>Upload Safety Document (MSDS)</Text>
                    <Text style={styles.uploadSubtitle}>
                      {sdsDocumentUri ? sdsDocumentUri : 'PDF, JPG or PNG (Max 5 MB)'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={handleSimulateUpload}
                  disabled={isUploadingDoc}
                >
                  {isUploadingDoc ? (
                    <ActivityIndicator size="small" color="#0C1A34" />
                  ) : (
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Card 6: Transit Insurance Coverage (Screenshot 2 Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeader}>
              <View style={styles.greenIconCircle}>
                <ShieldCheck size={18} color="#16A34A" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Transit Insurance Coverage</Text>
                <Text style={styles.cardSubtitle}>
                  Protect your cargo against transit perils and theft.
                </Text>
              </View>
            </View>

            <Switch
              value={transitInsuranceNeeded}
              onValueChange={setTransitInsuranceNeeded}
              trackColor={{ false: '#E2E8F0', true: '#FED7AA' }}
              thumbColor={transitInsuranceNeeded ? '#F15A24' : '#FFFFFF'}
            />
          </View>

          {transitInsuranceNeeded && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Declared Cargo Value *</Text>
              <View style={styles.declaredValueContainer}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>₹ INR</Text>
                  <ChevronDown size={14} color="#0C1A34" />
                </View>
                <TextInput
                  style={[styles.declaredValueInput, inlineErrors.declaredValue ? styles.textInputError : undefined]}
                  value={declaredValue}
                  onChangeText={(t) => {
                    setDeclaredValue(t);
                    if (inlineErrors.declaredValue) {
                      setInlineErrors((p) => ({ ...p, declaredValue: '' }));
                    }
                  }}
                  placeholder="e.g. 5,00,000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
              {inlineErrors.declaredValue && (
                <Text style={styles.inlineErrorText}>{inlineErrors.declaredValue}</Text>
              )}

              <Text style={styles.insuranceHelperText}>
                Coverage will be arranged as per NECL policy terms.
              </Text>
            </View>
          )}
        </View>

        {/* ── Bottom Action Button (Screenshot Match) ── */}
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.88}>
          <Text style={styles.continueBtnText}>Continue to Pickup & Delivery</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  saveBadgeWrap: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  saveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7F2',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  saveBadgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  saveBadgeFailed: {
    backgroundColor: '#FEF2F2',
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F15A24',
  },
  saveBadgeTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  saveBadgeTextFailed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  stepContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.6,
  },
  stepPercent: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#667085',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0C1A34',
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 3.5,
    backgroundColor: '#EEF2F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F15A24',
    borderRadius: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orangeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C1A34',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1D2D46',
  },
  popularHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  popularSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C1A34',
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularChip: {
    width: '31.3%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
    justifyContent: 'center',
  },
  popularChipSelected: {
    backgroundColor: '#FFF7F2',
    borderColor: '#F15A24',
  },
  popularChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
  },
  popularChipTextSelected: {
    color: '#F15A24',
  },
  fullCategoriesWrap: {
    gap: 4,
    marginTop: 6,
  },
  categoryRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  categoryRowItemSelected: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  categoryRowText: {
    fontSize: 13,
    color: '#0C1A34',
    fontWeight: '600',
  },
  categoryRowTextSelected: {
    color: '#F15A24',
    fontWeight: '800',
  },
  selectedCommodityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  selectedCommodityLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F15A24',
    letterSpacing: 0.3,
  },
  selectedCommodityValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C1A34',
    marginTop: 2,
  },
  removeCommodityBtn: {
    padding: 6,
  },
  customCommodityWrap: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 6,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13.5,
    color: '#0C1A34',
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  weightInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  unitSelectorSegment: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 10,
    padding: 3,
    height: 44,
    alignItems: 'center',
  },
  unitSegmentBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSegmentBtnActive: {
    backgroundColor: '#101D36',
  },
  unitSegmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },
  unitSegmentTextActive: {
    color: '#FFFFFF',
  },
  equivalentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  equivalentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  packageCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  packageCountInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  packageCountSuffix: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  packageTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageTypeTile: {
    width: '31.3%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  packageTypeTileSelected: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  packageTypeTileText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  packageTypeTileTextSelected: {
    color: '#FFFFFF',
  },
  packagingModesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packagingModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  packagingModeChipSelected: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  packagingModeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
  },
  packagingModeChipTextSelected: {
    color: '#FFFFFF',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimensionsBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dimBox: {
    flex: 1,
    height: 42,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
  },
  dimTimesSymbol: {
    fontSize: 14,
    fontWeight: '800',
    color: '#667085',
  },
  dimUnitSegment: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 8,
    padding: 2,
    height: 42,
    alignItems: 'center',
  },
  dimUnitBtn: {
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimUnitBtnActive: {
    backgroundColor: '#101D36',
  },
  dimUnitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
  },
  dimUnitTextActive: {
    color: '#FFFFFF',
  },
  volumeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F4FA',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  volumeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667085',
  },
  volumeValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0C1A34',
    marginTop: 2,
  },
  propertiesList: {
    marginTop: 12,
    gap: 8,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1A34',
  },
  propertyDesc: {
    fontSize: 11,
    color: '#667085',
    marginTop: 1,
  },
  temperatureRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 28,
    marginTop: 4,
  },
  miniLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#667085',
    marginBottom: 4,
  },
  tempInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
    color: '#0C1A34',
  },
  hazchemBody: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  dropdownText: {
    fontSize: 12.5,
    color: '#0C1A34',
    fontWeight: '600',
    flex: 1,
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    gap: 10,
  },
  uploadInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1A34',
  },
  uploadSubtitle: {
    fontSize: 10.5,
    color: '#667085',
    marginTop: 1,
  },
  uploadBtn: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0C1A34',
  },
  declaredValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  currencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    height: 44,
    borderRightWidth: 1,
    borderRightColor: '#EAECF0',
  },
  currencyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C1A34',
  },
  declaredValueInput: {
    flex: 1,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  insuranceHelperText: {
    fontSize: 11,
    color: '#667085',
    marginTop: 6,
  },
  continueBtn: {
    height: 52,
    backgroundColor: '#F15A24',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 6,
  },
  continueBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inlineErrorText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
});
