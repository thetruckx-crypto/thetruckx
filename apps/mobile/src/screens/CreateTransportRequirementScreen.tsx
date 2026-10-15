import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Calendar,
  Clock,
  Search,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  X,
  Layers,
  Sparkles,
  Info,
  Shield,
  FileText,
  Boxes,
  Anchor,
  Droplet,
  GlassWater,
  CalendarCheck,
  PlusCircle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { TransportRequirementDraft, VehicleRequirementGroup } from '../types';
import { clientService } from '../services/clientService';
import {
  InteractiveCalendarModal,
  toDDMMYYYY,
  toYYYYMMDD,
} from '../components/InteractiveCalendarModal';
import { InteractiveAnalogClockModal } from '../components/InteractiveAnalogClockModal';
import { VehicleThumbnail } from '../components/VehicleThumbnail';

interface CreateTransportRequirementScreenProps {
  initialDraft?: Partial<TransportRequirementDraft>;
  clientId?: string;
  onBack: () => void;
  onNext: (draftUpdate: Partial<TransportRequirementDraft>) => void;
}

export interface VehicleCatalogItem {
  id: string;
  mode: 'ROAD' | 'RAIL' | 'AIR' | 'SEA' | 'MULTIMODAL' | 'OTHER';
  name: string;
  category: string;
  tyreCount?: number;
  payloadMt: number;
  capacityLabel: string;
  dimensions?: string;
  specialCapabilities?: string;
  tag: string;
}

export const TRANSPORT_MODES = [
  { id: 'ROAD', label: 'Road Transport', desc: 'Full truckload, container linehaul & trailers' },
  { id: 'RAIL', label: 'Rail Transport', desc: 'Container train wagons & bulk rake freight' },
  { id: 'AIR', label: 'Air Freight', desc: 'High-priority air cargo & rapid connectivity' },
  { id: 'SEA', label: 'Sea / Ocean Freight', desc: 'Coastal cargo, barges & deep-sea containers' },
  { id: 'MULTIMODAL', label: 'Multimodal Transport', desc: 'Integrated road-rail-port intermodal solutions' },
  { id: 'OTHER', label: 'Other / Special Transport', desc: 'Heavy engineering, hydraulic axles & ODC' },
] as const;

export const VEHICLE_CATALOGUE: VehicleCatalogItem[] = [
  // Road Transport (Tyre-based & Configurations)
  {
    id: '10_TYRE_TRUCK',
    mode: 'ROAD',
    name: '10-Tyre Truck',
    category: 'Multi-Axle Truck',
    tyreCount: 10,
    payloadMt: 16,
    capacityLabel: '16 MT Payload',
    dimensions: '22 x 7.5 x 7.5 ft',
    specialCapabilities: 'Industrial heavy haulage & dry freight',
    tag: 'Popular',
  },
  {
    id: '12_TYRE_TRUCK',
    mode: 'ROAD',
    name: '12-Tyre Truck',
    category: 'Multi-Axle Truck',
    tyreCount: 12,
    payloadMt: 21,
    capacityLabel: '21 MT Payload',
    dimensions: '24 x 8 x 8 ft',
    specialCapabilities: 'Bulk materials & heavy machinery',
    tag: 'Heavy Haul',
  },
  {
    id: '14_TYRE_TRUCK',
    mode: 'ROAD',
    name: '14-Tyre Truck',
    category: 'Multi-Axle Truck',
    tyreCount: 14,
    payloadMt: 26,
    capacityLabel: '26 MT Payload',
    dimensions: '28 x 8 x 8 ft',
    specialCapabilities: 'Long-haul national highway freight',
    tag: 'High Capacity',
  },
  {
    id: '6_TYRE_TRUCK',
    mode: 'ROAD',
    name: '6-Tyre Truck',
    category: 'Single Axle',
    tyreCount: 6,
    payloadMt: 9,
    capacityLabel: '9 MT Payload',
    dimensions: '17.5 x 7 x 7 ft',
    specialCapabilities: 'Medium regional distribution',
    tag: 'Regional',
  },
  {
    id: '16_TYRE_TRUCK',
    mode: 'ROAD',
    name: '16-Tyre Truck',
    category: 'Multi-Axle Truck',
    tyreCount: 16,
    payloadMt: 31,
    capacityLabel: '31 MT Payload',
    dimensions: '32 x 8 x 8 ft',
    specialCapabilities: 'Maximum payload heavy multi-axle freight',
    tag: 'Max Payload',
  },
  {
    id: '32_FT_MX',
    mode: 'ROAD',
    name: '32 FT Multi-Axle Truck',
    category: 'Multi-Axle Truck',
    tyreCount: 10,
    payloadMt: 25,
    capacityLabel: '25 MT Payload',
    dimensions: '32 x 8 x 8 ft',
    specialCapabilities: 'Heavy haulage with air suspension',
    tag: 'High Capacity',
  },
  {
    id: '40_FT_TRAILER',
    mode: 'ROAD',
    name: '40 FT Open Flatbed Trailer',
    category: 'Open Trailer',
    payloadMt: 32,
    capacityLabel: '32 MT Payload',
    dimensions: '40 x 8.5 x 5 ft flatbed',
    specialCapabilities: 'Steel coils, pipes, machinery',
    tag: 'Industrial',
  },
  {
    id: '20_FT_CONT',
    mode: 'ROAD',
    name: '20 FT Closed Container',
    category: 'Container Truck',
    payloadMt: 10,
    capacityLabel: '10 MT Payload',
    dimensions: '20 x 8 x 8 ft',
    specialCapabilities: 'Weather-tight locked container',
    tag: 'High Security',
  },
  {
    id: '24_FT_CONT',
    mode: 'ROAD',
    name: '24 FT Closed Container',
    category: 'Container Truck',
    payloadMt: 14,
    capacityLabel: '14 MT Payload',
    dimensions: '24 x 8 x 8.5 ft',
    specialCapabilities: 'FMCG and high-volume freight',
    tag: 'High Volume',
  },
  {
    id: '32_FT_CONT',
    mode: 'ROAD',
    name: '32 FT Closed Container',
    category: 'Container Truck',
    payloadMt: 18,
    capacityLabel: '18 MT Payload',
    dimensions: '32 x 8 x 8.5 ft',
    specialCapabilities: 'Large volume FMCG & e-commerce container',
    tag: 'High Volume',
  },
  {
    id: 'LOW_BED_TRAILER',
    mode: 'ROAD',
    name: 'Low-Bed Trailer (ODC)',
    category: 'Special Trailer',
    payloadMt: 40,
    capacityLabel: '40 MT ODC Payload',
    dimensions: '40 x 10 x 3.5 ft low-bed',
    specialCapabilities: 'Over-dimensional cargo & heavy equipment',
    tag: 'ODC Special',
  },
  {
    id: 'REEFER_TRUCK',
    mode: 'ROAD',
    name: 'Refrigerated Truck (Reefer)',
    category: 'Temperature Controlled',
    payloadMt: 12,
    capacityLabel: '12 MT Cold Chain',
    dimensions: '20 x 8 x 8 ft insulated',
    specialCapabilities: 'Active cooling (-20°C to +15°C) & telematics',
    tag: 'Cold Chain',
  },
  {
    id: 'TIPPER_TRUCK',
    mode: 'ROAD',
    name: 'Tipper Truck',
    category: 'Bulk Tipper',
    payloadMt: 20,
    capacityLabel: '20 MT Bulk',
    dimensions: 'Hydraulic tipping bed',
    specialCapabilities: 'Aggregates, sand, minerals & construction bulk',
    tag: 'Bulk Mining',
  },
  {
    id: 'TANKER_TRUCK',
    mode: 'ROAD',
    name: 'Tanker Truck',
    category: 'Liquid Tanker',
    payloadMt: 22,
    capacityLabel: '22 KL / 22 MT',
    dimensions: 'Calibrated barrel tanker',
    specialCapabilities: 'Industrial fluids, food-grade oils & chemicals',
    tag: 'Liquid Bulk',
  },
  {
    id: '14_FT_CANTER',
    mode: 'ROAD',
    name: '14 FT LCV / Canter',
    category: 'LCV / Canter',
    payloadMt: 4,
    capacityLabel: '4 MT Payload',
    dimensions: '14 x 6.5 x 6.5 ft',
    specialCapabilities: 'Urban express and last-mile pickup',
    tag: 'City Express',
  },
  {
    id: '19_FT_CANTER',
    mode: 'ROAD',
    name: '19 FT LCV / Medium Truck',
    category: 'LCV / Canter',
    payloadMt: 7,
    capacityLabel: '7 MT Payload',
    dimensions: '19 x 7 x 7 ft',
    specialCapabilities: 'Inter-district feeder haul',
    tag: 'Feeder',
  },

  // Rail Freight
  {
    id: 'RAIL_20FT_CONT',
    mode: 'RAIL',
    name: '20 FT Rail Container Wagon',
    category: 'Rail Freight',
    payloadMt: 28,
    capacityLabel: '28 MT Payload',
    dimensions: '20 x 8 x 8.5 ft',
    specialCapabilities: 'Long-distance railway linehaul container',
    tag: 'Rail Container',
  },
  {
    id: 'RAIL_40FT_CONT',
    mode: 'RAIL',
    name: '40 FT High-Cube Rail Container',
    category: 'Rail Freight',
    payloadMt: 30,
    capacityLabel: '30 MT Payload',
    dimensions: '40 x 8 x 9.5 ft',
    specialCapabilities: 'High-volume intermodal rail wagon',
    tag: 'Rail High-Cube',
  },

  // Air Freight
  {
    id: 'AIR_CARGO_BELLY',
    mode: 'AIR',
    name: 'Commercial Airline Belly Cargo',
    category: 'Air Freight',
    payloadMt: 3.5,
    capacityLabel: 'Up to 3,500 kg',
    dimensions: 'Standard lower-deck container (LD3 / AKE)',
    specialCapabilities: 'Next-day airport-to-airport express',
    tag: 'Air Express',
  },
  {
    id: 'AIR_DEDICATED_FREIGHTER',
    mode: 'AIR',
    name: 'Dedicated Freighter Pallet',
    category: 'Air Freight',
    payloadMt: 8,
    capacityLabel: 'Up to 8,000 kg',
    dimensions: 'Main deck pallet (PAG / PMC)',
    specialCapabilities: 'High-value priority & oversized air freight',
    tag: 'Freighter',
  },

  // Sea Freight
  {
    id: 'SEA_20FT_FCL',
    mode: 'SEA',
    name: '20 FT FCL Ocean Container',
    category: 'Ocean Freight',
    payloadMt: 22,
    capacityLabel: '22 MT Ocean FCL',
    dimensions: '20 x 8 x 8.5 ft marine',
    specialCapabilities: 'Coastal shipping & international export/import',
    tag: 'Ocean FCL',
  },
  {
    id: 'SEA_40FT_HC',
    mode: 'SEA',
    name: '40 FT High-Cube Ocean Container',
    category: 'Ocean Freight',
    payloadMt: 26,
    capacityLabel: '26 MT Ocean HC',
    dimensions: '40 x 8 x 9.5 ft marine',
    specialCapabilities: 'Heavy volumetric ocean freight',
    tag: 'Ocean HC',
  },

  // Multimodal
  {
    id: 'MULTIMODAL_INTERMODAL',
    mode: 'MULTIMODAL',
    name: 'Intermodal Road-Rail Swap Body',
    category: 'Intermodal',
    payloadMt: 28,
    capacityLabel: '28 MT Intermodal',
    dimensions: '32 x 8.5 x 8.5 ft',
    specialCapabilities: 'Seamless railhead transfers without cargo handling',
    tag: 'Intermodal',
  },
];

export const HANDLING_REQUIREMENTS_LIST = [
  { id: 'TARPAULIN', label: 'Tarpaulin Cover Required', icon: Truck },
  { id: 'FRAGILE', label: 'Fragile / Careful Handling', icon: GlassWater },
  { id: 'KEEP_DRY', label: 'Keep Dry / Moisture Proof', icon: Droplet },
  { id: 'FORKLIFT', label: 'Forklift Loading Available', icon: Boxes },
  { id: 'CRANE', label: 'Crane Required at Origin', icon: Anchor },
  { id: 'GATE_PASS', label: 'Advance Gate-Pass Appointment', icon: CalendarCheck },
  { id: 'RESTRICTED_HOURS', label: 'Restricted Delivery Hours', icon: Clock },
  { id: 'PPE', label: 'Driver Safety PPE Required', icon: Shield },
  { id: 'OTHER_CUSTOM', label: 'Other Custom Handling', icon: FileText },
] as const;

export const HANDLING_OPTIONS = HANDLING_REQUIREMENTS_LIST.map((h) => h.label);

export const CreateTransportRequirementScreen: React.FC<
  CreateTransportRequirementScreenProps
> = ({ initialDraft, clientId, onBack, onNext }) => {
  const searchInputRef = useRef<TextInput>(null);

  // ── 1. Multiple Vehicle Requirement Groups State ──
  // Initially, show available catalogue options without displaying any vehicle as selected (Task 4)
  const [vehicleGroups, setVehicleGroups] = useState<VehicleRequirementGroup[]>(() => {
    if (initialDraft?.vehicleGroups && initialDraft.vehicleGroups.length > 0) {
      return initialDraft.vehicleGroups.map((g) => ({
        ...g,
        requestedDate: g.requestedDate ? toDDMMYYYY(g.requestedDate) : '',
      }));
    }

    // Only populate if draft explicitly specified a vehicle type (e.g. from saved draft or edit)
    if (initialDraft?.vehicleTypeRequired && initialDraft.vehicleTypeRequired.trim()) {
      const initialReq = initialDraft.vehicleTypeRequired;
      let initialVehId = '';
      let isCustom = false;
      let customName = '';

      const match = VEHICLE_CATALOGUE.find((v) => initialReq.toLowerCase().includes(v.name.toLowerCase()));
      if (match) {
        initialVehId = match.id;
      } else if (initialDraft?.customVehicleType || initialReq === 'Other') {
        initialVehId = 'OTHER';
        isCustom = true;
        customName = initialDraft?.customVehicleType || initialReq;
      }

      if (match || isCustom) {
        const defaultVeh = match || VEHICLE_CATALOGUE[0];
        const initialDate = initialDraft?.preferredLoadingDate
          ? toDDMMYYYY(initialDraft.preferredLoadingDate)
          : '';
        const initialTime = initialDraft?.preferredLoadingTime || '';

        return [
          {
            id: 'vg_1',
            transportMode: defaultVeh.mode,
            vehicleTypeId: defaultVeh.id,
            vehicleTypeName: isCustom ? (customName || 'Custom Vehicle') : defaultVeh.name,
            vehicleCategory: defaultVeh.category,
            tyreCount: defaultVeh.tyreCount,
            payloadMt: defaultVeh.payloadMt,
            dimensions: defaultVeh.dimensions,
            isCustom,
            customVehicleName: customName,
            quantity: 1,
            requestedDate: initialDate,
            requestedTime: initialTime,
            scheduleScope: 'COMMON',
          },
        ];
      }
    }

    // Default: Starts EMPTY. No vehicle is preselected when starting fresh.
    return [];
  });

  // Search filter for vehicle catalogue
  const [catalogueSearchQuery, setCatalogueSearchQuery] = useState('');

  // Target Budget State (Optional in INR)
  const [targetBudget, setTargetBudget] = useState(initialDraft?.targetBudget || '');

  // Handling Requirements State - Start empty unless provided in draft
  const [selectedHandlingRequirements, setSelectedHandlingRequirements] = useState<string[]>(
    initialDraft?.handlingRequirements || []
  );
  const [hasOtherHandling, setHasOtherHandling] = useState(
    Boolean(initialDraft?.customHandlingRequirement) ||
      initialDraft?.handlingRequirements?.includes('Other Custom Handling') ||
      false
  );
  const [customHandlingRequirement, setCustomHandlingRequirement] = useState(
    initialDraft?.customHandlingRequirement || ''
  );
  const [requirementSearchQuery, setRequirementSearchQuery] = useState('');

  // Special instructions
  const [specialInstructions, setSpecialInstructions] = useState(
    initialDraft?.specialInstructions || initialDraft?.schedulingNotes || ''
  );

  // ── Modals State ──
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [clockModalVisible, setClockModalVisible] = useState(false);
  const [scheduleTargetGroupIndex, setScheduleTargetGroupIndex] = useState<number>(0);

  // Validation errors
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  // Autosave Status
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('SAVED');

  // Total vehicles calculated
  const totalVehiclesCount = useMemo(() => {
    return vehicleGroups.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
  }, [vehicleGroups]);

  // Filtered catalogue items: Initially show available vehicle catalogue options.
  // Filters dynamically when client searches. (Task 4)
  const filteredVehicles = useMemo(() => {
    const q = catalogueSearchQuery.trim().toLowerCase();
    if (!q) return VEHICLE_CATALOGUE;

    return VEHICLE_CATALOGUE.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.capacityLabel.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        (item.dimensions && item.dimensions.toLowerCase().includes(q)) ||
        (item.tyreCount && `${item.tyreCount}`.includes(q))
      );
    });
  }, [catalogueSearchQuery]);

  // Filtered Handling Requirements
  const filteredHandlingList = useMemo(() => {
    const q = requirementSearchQuery.trim().toLowerCase();
    if (!q) return HANDLING_REQUIREMENTS_LIST;
    return HANDLING_REQUIREMENTS_LIST.filter((h) => h.label.toLowerCase().includes(q));
  }, [requirementSearchQuery]);

  // ── Autosave Draft Function ──
  const autoSaveDraft = useCallback(
    async (override?: Partial<TransportRequirementDraft>) => {
      try {
        setSaveStatus('SAVING');

        // Formulate combined summary for backward compatibility with Steps 3 & 4
        const primaryGroup = vehicleGroups[0] || {};
        const combinedVehicleSummary = vehicleGroups
          .map((g) => `${g.quantity}x ${g.isCustom ? (g.customVehicleName || 'Custom Vehicle') : g.vehicleTypeName}`)
          .join(', ');

        const earliestDate = vehicleGroups[0]?.requestedDate || '';
        const earliestTime = vehicleGroups[0]?.requestedTime || '';
        const combinedLoadingDatetime = earliestDate && earliestTime
          ? `${earliestDate} at ${earliestTime}`
          : earliestDate || 'Date pending';

        const draftToPersist: Partial<TransportRequirementDraft> = {
          vehicleTypeRequired: combinedVehicleSummary || primaryGroup.vehicleTypeName || '10-Tyre Truck',
          vehicleCategory: primaryGroup.vehicleCategory,
          customVehicleType: primaryGroup.isCustom ? primaryGroup.customVehicleName : undefined,
          loadingDatetime: combinedLoadingDatetime,
          preferredLoadingDate: earliestDate,
          preferredLoadingTime: earliestTime,
          targetBudget: targetBudget.trim() || undefined,
          targetBudgetCurrency: 'INR',
          handlingRequirements: selectedHandlingRequirements,
          customHandlingRequirement: hasOtherHandling ? customHandlingRequirement.trim() : undefined,
          specialInstructions: specialInstructions.trim() || undefined,
          vehicleGroups,
          totalVehiclesCount,
          ...override,
        };

        const success = await clientService.saveTransportRequirementDraft(draftToPersist, clientId);
        setSaveStatus(success ? 'SAVED' : 'FAILED');
      } catch {
        setSaveStatus('FAILED');
      }
    },
    [
      vehicleGroups,
      targetBudget,
      selectedHandlingRequirements,
      hasOtherHandling,
      customHandlingRequirement,
      specialInstructions,
      totalVehiclesCount,
      clientId,
    ]
  );

  // Debounced autosave on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSaveDraft();
    }, 800);
    return () => clearTimeout(timer);
  }, [autoSaveDraft]);

  // ── Vehicle Group Handlers ──
  const handleAddVehicleFromCatalogue = (item: VehicleCatalogItem) => {
    // Check if vehicle type already exists in groups
    const existingIndex = vehicleGroups.findIndex((g) => g.vehicleTypeId === item.id && !g.isCustom);
    if (existingIndex >= 0) {
      // Increment quantity
      handleUpdateGroup(existingIndex, {
        quantity: (vehicleGroups[existingIndex].quantity || 1) + 1,
      });
    } else {
      // Add as new group
      const newId = `vg_${Date.now()}`;
      const defaultDate = vehicleGroups[0]?.requestedDate || '16-10-2026';
      const defaultTime = vehicleGroups[0]?.requestedTime || '10:30 AM';

      const newGroup: VehicleRequirementGroup = {
        id: newId,
        transportMode: item.mode,
        vehicleTypeId: item.id,
        vehicleTypeName: item.name,
        vehicleCategory: item.category,
        tyreCount: item.tyreCount,
        payloadMt: item.payloadMt,
        dimensions: item.dimensions,
        quantity: 1,
        requestedDate: defaultDate,
        requestedTime: defaultTime,
        scheduleScope: 'COMMON',
      };

      setVehicleGroups((prev) => [...prev, newGroup]);
    }

    // Clear search after adding so catalogue collapses cleanly
    setCatalogueSearchQuery('');
  };

  const handleAddCustomVehicle = () => {
    const newId = `vg_${Date.now()}`;
    const defaultDate = vehicleGroups[0]?.requestedDate || '16-10-2026';
    const defaultTime = vehicleGroups[0]?.requestedTime || '10:30 AM';

    const newGroup: VehicleRequirementGroup = {
      id: newId,
      transportMode: 'ROAD',
      vehicleTypeId: 'OTHER',
      vehicleTypeName: catalogueSearchQuery.trim() || 'Custom Vehicle Type',
      vehicleCategory: 'Custom Vehicle',
      isCustom: true,
      customVehicleName: catalogueSearchQuery.trim() || '',
      quantity: 1,
      requestedDate: defaultDate,
      requestedTime: defaultTime,
      scheduleScope: 'COMMON',
    };

    setVehicleGroups((prev) => [...prev, newGroup]);
    setCatalogueSearchQuery('');
  };

  const handleAddVehicleGroup = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveVehicleGroup = (indexToRemove: number) => {
    // Allow removing previously selected vehicles down to 0 (Task 4)
    setVehicleGroups((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateGroup = (index: number, updates: Partial<VehicleRequirementGroup>) => {
    setVehicleGroups((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleApplyScheduleToAll = (sourceIndex: number) => {
    const src = vehicleGroups[sourceIndex];
    if (!src) return;
    setVehicleGroups((prev) =>
      prev.map((g) => ({
        ...g,
        requestedDate: src.requestedDate,
        requestedTime: src.requestedTime,
      }))
    );
  };

  // Open calendar modal for specific group
  const openCalendarForGroup = (index: number) => {
    setScheduleTargetGroupIndex(index);
    setCalendarModalVisible(true);
  };

  // Open clock modal for specific group
  const openClockForGroup = (index: number) => {
    setScheduleTargetGroupIndex(index);
    setClockModalVisible(true);
  };

  const handleSaveDate = (chosenDate: string) => {
    handleUpdateGroup(scheduleTargetGroupIndex, { requestedDate: toDDMMYYYY(chosenDate) });
    if (inlineErrors[`group_${scheduleTargetGroupIndex}_date`]) {
      setInlineErrors((prev) => ({ ...prev, [`group_${scheduleTargetGroupIndex}_date`]: '' }));
    }
  };

  const handleSaveTime = (chosenTime: string) => {
    handleUpdateGroup(scheduleTargetGroupIndex, { requestedTime: chosenTime });
    if (inlineErrors[`group_${scheduleTargetGroupIndex}_time`]) {
      setInlineErrors((prev) => ({ ...prev, [`group_${scheduleTargetGroupIndex}_time`]: '' }));
    }
  };

  // ── Handling Requirements Toggles ──
  const toggleHandlingRequirement = (label: string) => {
    if (label === 'Other Custom Handling') {
      const nextHasOther = !hasOtherHandling;
      setHasOtherHandling(nextHasOther);
      if (nextHasOther) {
        if (!selectedHandlingRequirements.includes(label)) {
          setSelectedHandlingRequirements((prev) => [...prev, label]);
        }
      } else {
        setSelectedHandlingRequirements((prev) => prev.filter((o) => o !== label));
      }
      return;
    }

    setSelectedHandlingRequirements((prev) =>
      prev.includes(label) ? prev.filter((o) => o !== label) : [...prev, label]
    );
  };

  const handleClearAllRequirements = () => {
    setSelectedHandlingRequirements([]);
    setHasOtherHandling(false);
    setCustomHandlingRequirement('');
  };

  // ── Form Validation & Navigation to Step 2 ──
  const handleContinue = async () => {
    Keyboard.dismiss();
    const errors: Record<string, string> = {};

    if (vehicleGroups.length === 0) {
      errors.vehicles = 'Please select at least one vehicle from the catalogue before continuing.';
    }

    // Validate each vehicle requirement group
    vehicleGroups.forEach((group, idx) => {
      if (group.isCustom && !group.customVehicleName?.trim()) {
        errors[`group_${idx}_customVehicle`] = 'Please specify your required custom vehicle type.';
      }
      if (!group.quantity || group.quantity < 1) {
        errors[`group_${idx}_quantity`] = 'Quantity must be at least 1.';
      }
      if (!group.requestedDate) {
        errors[`group_${idx}_date`] = 'Please select a loading date.';
      }
      if (!group.requestedTime) {
        errors[`group_${idx}_time`] = 'Please select a loading time.';
      }
    });

    // Budget validation if supplied
    if (targetBudget.trim()) {
      const budgetNum = parseFloat(targetBudget.replace(/,/g, ''));
      if (isNaN(budgetNum) || budgetNum <= 0) {
        errors.budget = 'Please enter a valid positive numeric target budget amount.';
      }
    }

    if (hasOtherHandling && !customHandlingRequirement.trim()) {
      errors.customHandling = 'Please describe your custom handling requirement.';
    }

    if (Object.keys(errors).length > 0) {
      setInlineErrors(errors);
      return;
    }

    // Persist final draft before transitioning
    const combinedVehicleSummary = vehicleGroups
      .map((g) => `${g.quantity}x ${g.isCustom ? (g.customVehicleName || 'Custom Vehicle') : g.vehicleTypeName}`)
      .join(', ');

    const primaryDate = vehicleGroups[0]?.requestedDate || '';
    const primaryTime = vehicleGroups[0]?.requestedTime || '';
    const combinedLoadingDatetime = `${primaryDate} at ${primaryTime}`;

    const updatePayload: Partial<TransportRequirementDraft> = {
      vehicleTypeRequired: combinedVehicleSummary,
      vehicleCategory: vehicleGroups[0]?.vehicleCategory,
      customVehicleType: vehicleGroups[0]?.isCustom ? vehicleGroups[0]?.customVehicleName : undefined,
      loadingDatetime: combinedLoadingDatetime,
      preferredLoadingDate: primaryDate,
      preferredLoadingTime: primaryTime,
      targetBudget: targetBudget.trim() || undefined,
      targetBudgetCurrency: 'INR',
      handlingRequirements: selectedHandlingRequirements,
      customHandlingRequirement: hasOtherHandling ? customHandlingRequirement.trim() : undefined,
      specialInstructions: specialInstructions.trim() || undefined,
      vehicleGroups,
      totalVehiclesCount,
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

      {/* ── 2. Progress Step Bar: Step 1 of 4 (25%) ── */}
      <View style={styles.stepContainer}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepBadge}>STEP 1 OF 4</Text>
          <Text style={styles.stepPercent}>25% Completed</Text>
        </View>
        <Text style={styles.stepTitle}>Vehicle & Loading Schedule</Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '25%' }]} />
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
        {/* ── Card 1: Vehicle Catalogue (Screenshot Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Truck size={19} color="#F15A24" strokeWidth={2.4} />
            <Text style={styles.cardTitle}>Vehicle Catalogue</Text>
          </View>

          {/* Search Box with short placeholder "Search vehicles..." and Clear button */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#667085" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={catalogueSearchQuery}
              onChangeText={setCatalogueSearchQuery}
              placeholder="Search vehicles..."
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {catalogueSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCatalogueSearchQuery('')} style={styles.clearSearchBtn}>
                <X size={16} color="#667085" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>

          {/* Catalogue List: Initially displays available vehicles, filtered on search (Task 4) */}
          <View style={styles.catalogueResultsBox}>
            {filteredVehicles.length > 0 ? (
              filteredVehicles.map((veh) => {
                const countSelected = vehicleGroups
                  .filter((g) => g.vehicleTypeId === veh.id && !g.isCustom)
                  .reduce((sum, g) => sum + (g.quantity || 1), 0);
                const isSelected = countSelected > 0;

                return (
                  <View key={veh.id} style={[styles.catalogueItemRow, isSelected && styles.catalogueItemRowActive]}>
                    <VehicleThumbnail vehicleId={veh.id} tyres={veh.tyreCount} width={64} height={42} />

                    <View style={styles.catalogueItemDetails}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.catalogueItemName}>{veh.name}</Text>
                        {isSelected && (
                          <View style={styles.selectedPillBadge}>
                            <Check size={10} color="#16A34A" strokeWidth={3} />
                            <Text style={styles.selectedPillBadgeText}>{countSelected} Added</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.catalogueItemPayload}>{veh.capacityLabel}</Text>
                      {veh.dimensions && (
                        <Text style={styles.catalogueItemDimensions}>{veh.dimensions}</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.addVehicleBtn, isSelected && styles.addMoreVehicleBtn]}
                      onPress={() => handleAddVehicleFromCatalogue(veh)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.addVehicleBtnText, isSelected && styles.addMoreVehicleBtnText]}>
                        {isSelected ? `+ Add More` : `+ Add Vehicle`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.catalogueEmptyBox}>
                <Text style={styles.catalogueEmptyText}>
                  No standard vehicle matching "{catalogueSearchQuery}"
                </Text>
                <TouchableOpacity style={styles.addCustomVehicleBtn} onPress={handleAddCustomVehicle}>
                  <Plus size={14} color="#F15A24" strokeWidth={2.6} />
                  <Text style={styles.addCustomVehicleBtnText}>Add as Custom Vehicle</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── Card 2: Selected Vehicles (Task 4: Clear Distinction & Dynamic Empty State) ── */}
        <View style={styles.selectedSectionHeaderRow}>
          <Text style={styles.selectedSectionTitle}>Selected Vehicles</Text>
          <Text style={styles.selectedSectionCounter}>
            {vehicleGroups.length} vehicle {vehicleGroups.length === 1 ? 'type' : 'types'} • {totalVehiclesCount} {totalVehiclesCount === 1 ? 'vehicle' : 'vehicles'} total
          </Text>
        </View>

        {vehicleGroups.length === 0 ? (
          <View style={styles.noVehiclesSelectedBox}>
            <Truck size={36} color="#CBD5E1" strokeWidth={1.8} />
            <Text style={styles.noVehiclesTitle}>No Vehicles Selected Yet</Text>
            <Text style={styles.noVehiclesSubtitle}>
              Please select one or more vehicles from the catalogue above to configure your booking.
            </Text>
            {inlineErrors.vehicles ? (
              <View style={styles.emptyVehiclesErrorBadge}>
                <AlertCircle size={14} color="#DC2626" />
                <Text style={styles.emptyVehiclesErrorText}>{inlineErrors.vehicles}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          vehicleGroups.map((group, groupIdx) => {
            const groupDateError = inlineErrors[`group_${groupIdx}_date`];
            const groupTimeError = inlineErrors[`group_${groupIdx}_time`];
            const groupCustomError = inlineErrors[`group_${groupIdx}_customVehicle`];

            return (
              <View key={group.id} style={styles.selectedVehicleCard}>
                {/* Header: Thumbnail + Title + Subtitle + Red Trash Icon (Always removable) */}
                <View style={styles.selectedCardHeaderRow}>
                  <VehicleThumbnail
                    vehicleId={group.vehicleTypeId}
                    tyres={group.tyreCount}
                    width={68}
                    height={44}
                  />

                  <View style={styles.selectedCardTitleWrap}>
                    <Text style={styles.selectedVehicleName}>
                      {group.isCustom
                        ? (group.customVehicleName || 'Custom Vehicle Type')
                        : group.vehicleTypeName}
                    </Text>
                    <Text style={styles.selectedVehicleSpecs}>
                      {group.payloadMt ? `${group.payloadMt} MT Payload` : 'Custom Payload'}{' '}
                      {group.dimensions ? ` |  ${group.dimensions}` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteVehicleBtn}
                    onPress={() => handleRemoveVehicleGroup(groupIdx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Remove ${group.vehicleTypeName}`}
                  >
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>

              {/* Conditional custom vehicle input */}
              {group.isCustom && (
                <View style={styles.customVehicleInputBox}>
                  <Text style={styles.subFieldLabel}>Custom Vehicle Type Required *</Text>
                  <TextInput
                    style={[styles.customTextInput, groupCustomError ? styles.textInputError : undefined]}
                    value={group.customVehicleName || ''}
                    onChangeText={(t) => {
                      handleUpdateGroup(groupIdx, { customVehicleName: t });
                      if (inlineErrors[`group_${groupIdx}_customVehicle`]) {
                        setInlineErrors((prev) => ({ ...prev, [`group_${groupIdx}_customVehicle`]: '' }));
                      }
                    }}
                    placeholder="e.g. Hydraulic Multi-Axle, Low Bed Trailer"
                    placeholderTextColor="#94A3B8"
                  />
                  {groupCustomError && <Text style={styles.inlineErrorText}>{groupCustomError}</Text>}
                </View>
              )}

              {/* 3-Column Controls Row: Quantity Stepper | Loading Date | Loading Time */}
              <View style={styles.selectedControlsRow}>
                {/* 1. Number of Vehicles * */}
                <View style={styles.qtyColumn}>
                  <Text style={styles.columnLabel}>Number of Vehicles *</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      style={styles.stepperMinusBtn}
                      onPress={() => {
                        const nextQty = Math.max(1, (group.quantity || 1) - 1);
                        handleUpdateGroup(groupIdx, { quantity: nextQty });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepperMinusText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.stepperValueText}>{group.quantity || 1}</Text>

                    <TouchableOpacity
                      style={styles.stepperPlusBtn}
                      onPress={() => {
                        const nextQty = (group.quantity || 1) + 1;
                        handleUpdateGroup(groupIdx, { quantity: nextQty });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stepperPlusText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Loading Date * (DD-MM-YYYY format) */}
                <View style={styles.dateColumn}>
                  <Text style={styles.columnLabel}>Loading Date *</Text>
                  <TouchableOpacity
                    style={[styles.datePickerBtn, groupDateError ? styles.inputErrorBorder : null]}
                    onPress={() => openCalendarForGroup(groupIdx)}
                    activeOpacity={0.8}
                  >
                    <Calendar size={16} color="#F15A24" strokeWidth={2.2} />
                    <Text style={styles.datePickerText}>
                      {group.requestedDate ? toDDMMYYYY(group.requestedDate) : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  {groupDateError && <Text style={styles.miniErrorText}>{groupDateError}</Text>}
                </View>

                {/* 3. Loading Time * (Analog clock picker) */}
                <View style={styles.timeColumn}>
                  <Text style={styles.columnLabel}>Loading Time *</Text>
                  <TouchableOpacity
                    style={[styles.timePickerBtn, groupTimeError ? styles.inputErrorBorder : null]}
                    onPress={() => openClockForGroup(groupIdx)}
                    activeOpacity={0.8}
                  >
                    <Clock size={16} color="#F15A24" strokeWidth={2.2} />
                    <Text style={styles.timePickerText}>
                      {group.requestedTime || 'Select Time'}
                    </Text>
                  </TouchableOpacity>
                  {groupTimeError && <Text style={styles.miniErrorText}>{groupTimeError}</Text>}
                </View>
              </View>

              {/* Apply Schedule to All helper if multiple groups */}
              {vehicleGroups.length > 1 && group.requestedDate && group.requestedTime && (
                <TouchableOpacity
                  style={styles.applyAllScheduleBtn}
                  onPress={() => handleApplyScheduleToAll(groupIdx)}
                >
                  <Sparkles size={12} color="#0C1A34" />
                  <Text style={styles.applyAllScheduleText}>
                    Apply this schedule to all vehicle groups
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }))}

        {/* ── Add Another Vehicle Button (Screenshot Match) ── */}
        <TouchableOpacity
          style={styles.addAnotherVehicleBtn}
          onPress={handleAddVehicleGroup}
          activeOpacity={0.8}
        >
          <PlusCircle size={18} color="#F15A24" strokeWidth={2.2} />
          <Text style={styles.addAnotherVehicleBtnText}>Add Another Vehicle</Text>
        </TouchableOpacity>

        {/* ── Card 3: Target Freight Budget (Optional) (Screenshot Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.budgetHeaderRow}>
            <View style={styles.budgetIconCircle}>
              <Text style={styles.budgetRupeeSymbol}>₹</Text>
            </View>
            <View style={styles.budgetHeaderTextWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardTitle}>Target Freight Budget</Text>
                <Text style={styles.optionalTagText}>(Optional)</Text>
              </View>
              <Text style={styles.cardSubtitle}>Set your expected budget for this shipment.</Text>
            </View>
          </View>

          {/* INR Input Box */}
          <View style={styles.budgetInputContainer}>
            <View style={styles.currencyPrefixBadge}>
              <Text style={styles.currencyPrefixText}>₹ INR</Text>
            </View>
            <TextInput
              style={[styles.budgetInput, inlineErrors.budget ? styles.textInputError : undefined]}
              value={targetBudget}
              onChangeText={(t) => {
                setTargetBudget(t);
                if (inlineErrors.budget) {
                  setInlineErrors((prev) => ({ ...prev, budget: '' }));
                }
              }}
              placeholder="Enter budget"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>
          {inlineErrors.budget && <Text style={styles.inlineErrorText}>{inlineErrors.budget}</Text>}

          {/* Helper Note */}
          <View style={styles.budgetHelperRow}>
            <Info size={13} color="#667085" />
            <Text style={styles.budgetHelperText}>
              Optional • Final freight charges are subject to quotation.
            </Text>
          </View>
        </View>

        {/* ── Card 4: Handling & Dispatch Requirements (Screenshot Match) ── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.handlingIconCircle}>
              <Layers size={17} color="#F15A24" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Handling & Dispatch Requirements</Text>
              <Text style={styles.cardSubtitle}>Select all requirements that apply to your shipment.</Text>
            </View>
          </View>

          {/* Search Requirements Input */}
          <View style={styles.searchRequirementsBox}>
            <Search size={16} color="#667085" />
            <TextInput
              style={styles.searchRequirementsInput}
              value={requirementSearchQuery}
              onChangeText={setRequirementSearchQuery}
              placeholder="Search requirements..."
              placeholderTextColor="#94A3B8"
            />
            {requirementSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setRequirementSearchQuery('')}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* 2-Column Grid of Requirements */}
          <View style={styles.requirementsGrid}>
            {filteredHandlingList.map((item) => {
              const isSelected = selectedHandlingRequirements.includes(item.label);
              const IconComp = item.icon;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.requirementCard, isSelected && styles.requirementCardSelected]}
                  onPress={() => toggleHandlingRequirement(item.label)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxSquare, isSelected && styles.checkboxSquareSelected]}>
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>

                  <IconComp
                    size={17}
                    color={isSelected ? '#F15A24' : '#475569'}
                    strokeWidth={2.2}
                  />

                  <Text style={[styles.requirementLabel, isSelected && styles.requirementLabelSelected]} numberOfLines={2}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Conditional Custom Handling Input */}
          {hasOtherHandling && (
            <View style={styles.customHandlingWrap}>
              <Text style={styles.subFieldLabel}>Specify Custom Handling Requirement *</Text>
              <TextInput
                style={[styles.customTextInput, inlineErrors.customHandling ? styles.textInputError : undefined]}
                value={customHandlingRequirement}
                onChangeText={(t) => {
                  setCustomHandlingRequirement(t);
                  if (inlineErrors.customHandling) {
                    setInlineErrors((prev) => ({ ...prev, customHandling: '' }));
                  }
                }}
                placeholder="e.g. Hydraulic tail lift, specific strapping, fragile stacking"
                placeholderTextColor="#94A3B8"
              />
              {inlineErrors.customHandling && (
                <Text style={styles.inlineErrorText}>{inlineErrors.customHandling}</Text>
              )}
            </View>
          )}

          {/* Selected Requirements Summary & Removable Badges */}
          {selectedHandlingRequirements.length > 0 && (
            <View style={styles.selectedRequirementsWrap}>
              <View style={styles.selectedRequirementsHeaderRow}>
                <Text style={styles.selectedRequirementsCountText}>
                  Selected Requirements ({selectedHandlingRequirements.length})
                </Text>
                <TouchableOpacity onPress={handleClearAllRequirements}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chipsRow}>
                {selectedHandlingRequirements.map((req) => (
                  <View key={req} style={styles.requirementBadge}>
                    <Text style={styles.requirementBadgeText}>{req}</Text>
                    <TouchableOpacity
                      onPress={() => toggleHandlingRequirement(req)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <X size={13} color="#F15A24" strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── Bottom Action Button (Screenshot Match) ── */}
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.88}>
          <Text style={styles.continueBtnText}>Continue to Cargo Details</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Interactive Monthly Calendar Modal (DD-MM-YYYY) ── */}
      <InteractiveCalendarModal
        visible={calendarModalVisible}
        selectedDate={vehicleGroups[scheduleTargetGroupIndex]?.requestedDate || ''}
        onSelectDate={handleSaveDate}
        onClose={() => setCalendarModalVisible(false)}
        title="Select Loading Date"
      />

      {/* ── Interactive Analog Clock Modal (HH:MM AM/PM) ── */}
      <InteractiveAnalogClockModal
        visible={clockModalVisible}
        selectedTime={vehicleGroups[scheduleTargetGroupIndex]?.requestedTime || '10:30 AM'}
        onSelectTime={handleSaveTime}
        onClose={() => setClockModalVisible(false)}
        title="Select Loading Time"
      />
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
    gap: 8,
    marginBottom: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1D2D46',
    fontWeight: '500',
  },
  clearSearchBtn: {
    padding: 4,
  },
  catalogueResultsBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  catalogueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  catalogueItemRowActive: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  selectedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedPillBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },
  catalogueItemDetails: {
    flex: 1,
  },
  catalogueItemName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  catalogueItemPayload: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    marginTop: 2,
  },
  catalogueItemDimensions: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  addVehicleBtn: {
    backgroundColor: '#F15A24',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addVehicleBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  addMoreVehicleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F15A24',
    shadowOpacity: 0,
    elevation: 0,
  },
  addMoreVehicleBtnText: {
    color: '#F15A24',
  },
  noVehiclesSelectedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noVehiclesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  noVehiclesSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyVehiclesErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  emptyVehiclesErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  catalogueEmptyBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  catalogueEmptyText: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
  },
  addCustomVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  addCustomVehicleBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F15A24',
  },
  selectedSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  selectedSectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  selectedSectionCounter: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#667085',
  },
  selectedVehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1.5,
  },
  selectedCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectedCardTitleWrap: {
    flex: 1,
  },
  selectedVehicleName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  selectedVehicleSpecs: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '500',
    marginTop: 2,
  },
  deleteVehicleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customVehicleInputBox: {
    marginTop: 10,
    paddingBottom: 8,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 6,
  },
  customTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0C1A34',
  },
  selectedControlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
  },
  qtyColumn: {
    flex: 1.15,
  },
  dateColumn: {
    flex: 1.45,
  },
  timeColumn: {
    flex: 1.3,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 6,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    overflow: 'hidden',
  },
  stepperMinusBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F6',
  },
  stepperMinusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667085',
  },
  stepperValueText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  stepperPlusBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F15A24',
  },
  stepperPlusText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 10,
  },
  datePickerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 10,
  },
  timePickerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  inputErrorBorder: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  miniErrorText: {
    fontSize: 10.5,
    color: '#DC2626',
    marginTop: 2,
    fontWeight: '600',
  },
  applyAllScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F4FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  applyAllScheduleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C1A34',
  },
  addAnotherVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F15A24',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 18,
    shadowColor: '#F15A24',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  addAnotherVehicleBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#F15A24',
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  budgetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetRupeeSymbol: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F15A24',
  },
  budgetHeaderTextWrap: {
    flex: 1,
  },
  optionalTagText: {
    fontSize: 12.5,
    color: '#667085',
    fontWeight: '500',
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
    overflow: 'hidden',
  },
  currencyPrefixBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#EAECF0',
  },
  currencyPrefixText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0C1A34',
  },
  budgetInput: {
    flex: 1,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0C1A34',
  },
  budgetHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  budgetHelperText: {
    fontSize: 11.5,
    color: '#667085',
  },
  handlingIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRequirementsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
    marginBottom: 12,
  },
  searchRequirementsInput: {
    flex: 1,
    fontSize: 13,
    color: '#1D2D46',
  },
  requirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  requirementCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    minHeight: 48,
  },
  requirementCardSelected: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF7F2',
  },
  checkboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareSelected: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  requirementLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D2D46',
    flex: 1,
  },
  requirementLabelSelected: {
    color: '#0C1A34',
    fontWeight: '800',
  },
  customHandlingWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  selectedRequirementsWrap: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  selectedRequirementsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedRequirementsCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D2D46',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F15A24',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  requirementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  requirementBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F15A24',
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
    marginTop: 4,
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
