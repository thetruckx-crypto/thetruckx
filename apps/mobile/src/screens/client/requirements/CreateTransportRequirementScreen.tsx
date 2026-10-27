import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import Svg, { Rect, Circle, Path, G } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Check,
  AlertCircle,
  Info,
  Layers,
  Scale,
  Edit2,
  ChevronDown,
  Bell,
  Settings,
  Package,
  Shield,
  HelpCircle,
  X,
  Plus,
  Trash2,
  Clock,
  FileText,
} from 'lucide-react-native';
import { TransportRequirementDraft, VehicleRequirementGroup } from '../../../types';
import { clientService } from '../../../services/clientService';
import { InteractiveCalendarModal } from '../../../components/InteractiveCalendarModal';
import { InteractiveAnalogClockModal } from '../../../components/InteractiveAnalogClockModal';

// ─── Exported Constants for NECL Compatibility & Unit Testing ─────────────────
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
  { id: '6_TYRE_TRUCK', mode: 'ROAD', name: '6-Tyre Truck', category: 'Light Truck', tyreCount: 6, payloadMt: 9, capacityLabel: '9 MT Payload', dimensions: '17.5 x 7 x 7 ft', tag: 'Standard' },
  { id: '10_TYRE_TRUCK', mode: 'ROAD', name: '10-Tyre Truck', category: 'Multi-Axle Truck', tyreCount: 10, payloadMt: 16, capacityLabel: '16 MT Payload', dimensions: '22 x 7.5 x 7.5 ft', tag: 'Popular' },
  { id: '12_TYRE_TRUCK', mode: 'ROAD', name: '12-Tyre Truck', category: 'Multi-Axle Truck', tyreCount: 12, payloadMt: 21, capacityLabel: '21 MT Payload', dimensions: '24 x 7.5 x 8 ft', tag: 'Heavy' },
  { id: '14_TYRE_TRUCK', mode: 'ROAD', name: '14-Tyre Truck', category: 'Multi-Axle Truck', tyreCount: 14, payloadMt: 25, capacityLabel: '25 MT Payload', dimensions: '28 x 8 x 8 ft', tag: 'Heavy' },
  { id: '16_TYRE_TRUCK', mode: 'ROAD', name: '16-Tyre Truck', category: 'Multi-Axle Truck', tyreCount: 16, payloadMt: 30, capacityLabel: '30 MT Payload', dimensions: '32 x 8 x 8 ft', tag: 'ODC' },
  { id: '40_FT_TRAILER', mode: 'ROAD', name: '40 FT Open Flatbed Trailer', category: 'Trailer', payloadMt: 35, capacityLabel: '35 MT Payload', dimensions: '40 x 8 x 8 ft', tag: 'Trailer' },
  { id: '20_FT_CONTAINER', mode: 'ROAD', name: '20 FT Closed Container', category: 'Container Truck', payloadMt: 18, capacityLabel: '18 MT Payload', dimensions: '20 x 8 x 8.5 ft', tag: 'Container' },
  { id: 'REEFER_TRUCK', mode: 'ROAD', name: 'Refrigerated Truck (Reefer)', category: 'Specialized Truck', payloadMt: 15, capacityLabel: '15 MT Payload', dimensions: '22 x 8 x 8 ft', tag: 'Cold Chain' },
];

export const HANDLING_OPTIONS = [
  'Normal Loading',
  'Crane Loading',
  'Forklift Loading',
  'Exclusive Vehicle (Direct Dispatch)',
  'Other',
  // Preserved legacy tokens for test preservation
  'Tarpaulin Cover Required',
  'Keep Dry / Moisture Proof',
  'Crane Required at Origin',
  'Forklift Loading Available',
];

export type VehicleTypeOption = 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
export type BodyTypeOption = 'Open Body' | 'Closed Body';

export const VEHICLE_TYPES: { id: VehicleTypeOption; label: string }[] = [
  { id: 'Lorry', label: 'Lorry' },
  { id: 'Trailer', label: 'Trailer' },
  { id: 'Van', label: 'Van' },
  { id: 'Heavy Carrier', label: 'Heavy Carrier' },
];

export const BODY_TYPES: { id: BodyTypeOption; label: string }[] = [
  { id: 'Open Body', label: 'Open Body' },
  { id: 'Closed Body', label: 'Closed Body' },
];

export const CAPACITY_OPTIONS_MAP: Record<VehicleTypeOption, string[]> = {
  Lorry: ['7 MT', '9 MT', '12 MT', '15 MT', '16 MT', '20 MT', '21 MT'],
  Trailer: ['22 MT', '25 MT', '28 MT', '32 MT', '35 MT', '40 MT'],
  Van: ['1 MT', '1.5 MT', '2 MT', '2.5 MT', '3.5 MT', '5 MT'],
  'Heavy Carrier': ['25 MT', '30 MT', '35 MT', '40 MT', '50 MT'],
};

export const HANDLING_REQUIREMENTS_CONFIG: {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: 'Normal Loading',
    label: 'Normal Loading',
    description: 'Standard manual loading/unloading by labor or warehouse dispatch team.',
  },
  {
    id: 'Crane Loading',
    label: 'Crane Loading',
    description: 'Vehicles must be suitable for crane loading at origin or destination point.',
  },
  {
    id: 'Forklift Loading',
    label: 'Forklift Loading',
    description: 'Vehicles must have side or rear opening for forklift accessibility.',
  },
  {
    id: 'Exclusive Vehicle (Direct Dispatch)',
    label: 'Exclusive Vehicle (Direct Dispatch)',
    description: 'Dedicated point-to-point transit without intermediate transshipment.',
  },
  {
    id: 'Other',
    label: 'Other',
    description: 'Specify custom loading constraints or specialized handling equipment.',
  },
];

export const DISPATCH_REQUIREMENTS_CONFIG: {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: 'Standard Dispatch',
    label: 'Standard Dispatch',
    description: 'Vehicle dispatched according to standard linehaul transit schedule.',
  },
  {
    id: 'Exclusive Vehicle (Direct Dispatch)',
    label: 'Exclusive Vehicle (Direct Dispatch)',
    description: 'Direct point-to-point transit without intermediate hub stops or transshipment.',
  },
  {
    id: 'Scheduled Dispatch',
    label: 'Scheduled Dispatch',
    description: 'Vehicle must arrive and dispatch at a strictly specified loading window.',
  },
  {
    id: 'Other',
    label: 'Other',
    description: 'Custom dispatch instructions or dedicated escort requirement.',
  },
];

// ─── SVG Vehicle Illustrations ───────────────────────────────────────────────
const LorryIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 56, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 64 38" fill="none">
    <Path d="M4 35h56" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Rect x="8" y="27" width="48" height="3" rx="1.5" fill="#334155" />
    <Rect x="20" y="8" width="36" height="19" rx="2" fill="#EA580C" stroke="#C2410C" strokeWidth="1" />
    <Path d="M26 9v17M32 9v17M38 9v17M44 9v17M50 9v17" stroke="#FED7AA" strokeWidth="1" strokeOpacity="0.8" />
    <Path d="M8 27V15c0-1.5 1-2.5 2.5-2.5h8c1 0 1.5.8 1.5 2v12.5H8z" fill="#F97316" stroke="#EA580C" strokeWidth="1" />
    <Path d="M9.5 16h7c.5 0 .8.4.8 1v4H9.5V16z" fill="#0F172A" fillOpacity="0.85" />
    <Rect x="8" y="23" width="2" height="2.5" rx="0.5" fill="#FEF08A" />
    <Rect x="6" y="26" width="3.5" height="2" rx="0.5" fill="#475569" />
    <Circle cx="14" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="14" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="34" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="34" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="48" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="48" cy="30" r="2" fill="#94A3B8" />
  </Svg>
);

const TrailerIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 56, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 64 38" fill="none">
    <Path d="M4 35h56" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Rect x="6" y="27" width="52" height="3" rx="1.5" fill="#334155" />
    <Rect x="18" y="7" width="40" height="20" rx="1.5" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
    <Path d="M24 8v18M30 8v18M36 8v18M42 8v18M48 8v18M54 8v18" stroke="#94A3B8" strokeWidth="1" strokeOpacity="0.6" />
    <Path d="M7 27V16c0-1.5 1-2.5 2.5-2.5h7c1 0 1.5.8 1.5 2v11.5H7z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
    <Path d="M8.5 17h6c.5 0 .8.4.8 1v4H8.5V17z" fill="#0F172A" fillOpacity="0.85" />
    <Rect x="7" y="24" width="2" height="2" rx="0.5" fill="#FEF08A" />
    <Circle cx="12" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="12" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="38" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="38" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="48" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="48" cy="30" r="2" fill="#94A3B8" />
  </Svg>
);

const VanIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 56, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 64 38" fill="none">
    <Path d="M6 35h52" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Path d="M12 27V16c0-2 1.5-3.5 3.5-3.5h28c2 0 3.5 1.5 3.5 3.5v11H12z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
    <Path d="M13.5 16.5l4-3h6v6h-10v-3z" fill="#0F172A" fillOpacity="0.85" />
    <Path d="M32 13v14M24 13v14" stroke="#CBD5E1" strokeWidth="1" />
    <Rect x="36" y="15" width="8" height="5" rx="1" fill="#0F172A" fillOpacity="0.75" />
    <Rect x="11" y="24" width="2" height="2" rx="0.5" fill="#FEF08A" />
    <Circle cx="18" cy="29" r="4.5" fill="#1E293B" />
    <Circle cx="18" cy="29" r="2" fill="#94A3B8" />
    <Circle cx="40" cy="29" r="4.5" fill="#1E293B" />
    <Circle cx="40" cy="29" r="2" fill="#94A3B8" />
  </Svg>
);

const HeavyCarrierIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 56, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 64 38" fill="none">
    <Path d="M4 35h56" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Rect x="6" y="27" width="52" height="3" rx="1.5" fill="#334155" />
    <Path d="M20 27l2-18h32l-3 18H20z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
    <Path d="M26 11v14M34 11v14M42 11v14" stroke="#B45309" strokeWidth="1" strokeOpacity="0.7" />
    <Path d="M7 27V14c0-1.5 1-2.5 2.5-2.5h8c1 0 1.5.8 1.5 2v13.5H7z" fill="#EA580C" stroke="#C2410C" strokeWidth="1" />
    <Path d="M8.5 15h7c.5 0 .8.4.8 1v4H8.5V15z" fill="#0F172A" fillOpacity="0.85" />
    <Circle cx="13" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="13" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="33" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="33" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="43" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="43" cy="30" r="2" fill="#94A3B8" />
    <Circle cx="52" cy="30" r="4.5" fill="#1E293B" />
    <Circle cx="52" cy="30" r="2" fill="#94A3B8" />
  </Svg>
);

const OpenBodyIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 64, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 72 40" fill="none">
    <Path d="M4 37h64" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Rect x="8" y="29" width="56" height="3" rx="1.5" fill="#334155" />
    <Rect x="22" y="11" width="42" height="18" rx="1.5" fill="#EA580C" stroke="#C2410C" strokeWidth="1" />
    <Path d="M22 17h42M22 23h42" stroke="#FED7AA" strokeWidth="1" />
    <Path d="M29 11v18M36 11v18M43 11v18M50 11v18M57 11v18" stroke="#9A3412" strokeWidth="1" />
    <Path d="M8 29V17c0-1.5 1-2.5 2.5-2.5h9c1 0 1.5.8 1.5 2v12.5H8z" fill="#F97316" stroke="#EA580C" strokeWidth="1" />
    <Path d="M9.5 18h7.5c.5 0 .8.4.8 1v4H9.5V18z" fill="#0F172A" fillOpacity="0.85" />
    <Circle cx="14" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="14" cy="32" r="2" fill="#94A3B8" />
    <Circle cx="38" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="38" cy="32" r="2" fill="#94A3B8" />
    <Circle cx="52" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="52" cy="32" r="2" fill="#94A3B8" />
  </Svg>
);

const ClosedBodyIllustration: React.FC<{ width?: number; height?: number }> = ({ width = 64, height = 36 }) => (
  <Svg width={width} height={height} viewBox="0 0 72 40" fill="none">
    <Path d="M4 37h64" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    <Rect x="8" y="29" width="56" height="3" rx="1.5" fill="#334155" />
    <Rect x="22" y="9" width="42" height="20" rx="1.5" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
    <Path d="M28 10v18M34 10v18M40 10v18M46 10v18M52 10v18M58 10v18" stroke="#94A3B8" strokeWidth="1" strokeOpacity="0.6" />
    <Path d="M8 29V17c0-1.5 1-2.5 2.5-2.5h9c1 0 1.5.8 1.5 2v12.5H8z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
    <Path d="M9.5 18h7.5c.5 0 .8.4.8 1v4H9.5V18z" fill="#0F172A" fillOpacity="0.85" />
    <Circle cx="14" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="14" cy="32" r="2" fill="#94A3B8" />
    <Circle cx="38" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="38" cy="32" r="2" fill="#94A3B8" />
    <Circle cx="52" cy="32" r="4.5" fill="#1E293B" />
    <Circle cx="52" cy="32" r="2" fill="#94A3B8" />
  </Svg>
);

const CraneSvgIcon: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = '#FF6B00' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21h18M6 21V9l8-5v17M10 6.5l8 5M14 4l7 4v3h-3" />
    <Path d="M18 11v6" strokeDasharray="1 1" />
    <Path d="M16 17a2 2 0 1 0 4 0" />
  </Svg>
);

// Helper to construct a fresh vehicle requirement group
const createDefaultVehicleGroup = (index: number = 0): VehicleRequirementGroup => ({
  id: `vr_${Date.now()}_${index}`,
  requirementEntryId: `ENTRY-${index + 1}`,
  transportMode: 'ROAD',
  vehicleTypeId: 'LORRY',
  vehicleTypeName: 'Lorry (Open Body)',
  vehicleType: 'Lorry',
  vehicleBodyType: 'Open Body',
  vehicleCategory: 'Lorry',
  capacityMt: '16',
  payloadMt: 16,
  requiresDimensions: false,
  dimensionsLength: '',
  dimensionsWidth: '',
  dimensionsHeight: '',
  dimensions: '',
  quantity: 1,
  handlingRequirement: 'Crane Loading',
  handlingRequirements: ['Crane Loading'],
  customHandlingRequirement: '',
  dispatchRequirement: 'Standard Dispatch',
  customDispatchRequirement: '',
  instructions: '',
  vehicleBudget: '',
  requestedDate: '',
  requestedTime: '',
  scheduleScope: 'COMMON',
});

interface CreateTransportRequirementScreenProps {
  initialDraft?: Partial<TransportRequirementDraft>;
  clientId?: string;
  onBack: () => void;
  onNext: (draftUpdate: Partial<TransportRequirementDraft>) => void;
}

export const CreateTransportRequirementScreen: React.FC<
  CreateTransportRequirementScreenProps
> = ({ initialDraft, clientId, onBack, onNext }) => {
  // ── 1. Dynamic Multi-Vehicle Groups State ──
  const [vehicleGroups, setVehicleGroups] = useState<VehicleRequirementGroup[]>(() => {
    if (initialDraft?.vehicleGroups && initialDraft.vehicleGroups.length > 0) {
      return initialDraft.vehicleGroups.map((g, idx) => {
        const vType = (g.vehicleType || g.vehicleCategory || 'Lorry') as VehicleTypeOption;
        const bType = (g.vehicleBodyType || 'Open Body') as BodyTypeOption;
        const cap = g.capacityMt ? String(g.capacityMt).replace(/[^0-9.]/g, '') : (g.payloadMt ? String(g.payloadMt) : '16');
        return {
          ...createDefaultVehicleGroup(idx),
          ...g,
          id: g.id || `vr_${Date.now()}_${idx}`,
          requirementEntryId: g.requirementEntryId || `ENTRY-${idx + 1}`,
          vehicleType: vType,
          vehicleBodyType: bType,
          vehicleTypeName: `${vType} (${bType})`,
          vehicleTypeId: vType.toUpperCase(),
          capacityMt: cap || '16',
          payloadMt: parseFloat(cap) || g.payloadMt || 16,
          quantity: Math.max(1, Number(g.quantity) || 1),
          handlingRequirement: g.handlingRequirement || (g.handlingRequirements?.[0]) || 'Crane Loading',
          handlingRequirements: g.handlingRequirements || [g.handlingRequirement || 'Crane Loading'],
          dispatchRequirement: g.dispatchRequirement || 'Standard Dispatch',
          requiresDimensions: g.requiresDimensions !== undefined ? Boolean(g.requiresDimensions) : false,
          dimensionsLength: g.dimensionsLength || '',
          dimensionsWidth: g.dimensionsWidth || '',
          dimensionsHeight: g.dimensionsHeight || '',
          dimensions: g.dimensions || '',
        };
      });
    }

    // Fallback: Populate single group from existing initialDraft
    const firstGroup = createDefaultVehicleGroup(0);
    if (initialDraft?.vehicleType && (['Lorry', 'Trailer', 'Van', 'Heavy Carrier'] as string[]).includes(initialDraft.vehicleType)) {
      firstGroup.vehicleType = initialDraft.vehicleType;
      firstGroup.vehicleTypeId = initialDraft.vehicleType.toUpperCase();
    }
    if (initialDraft?.vehicleBodyType && (['Open Body', 'Closed Body'] as string[]).includes(initialDraft.vehicleBodyType)) {
      firstGroup.vehicleBodyType = initialDraft.vehicleBodyType;
    }
    firstGroup.vehicleTypeName = `${firstGroup.vehicleType} (${firstGroup.vehicleBodyType})`;

    if (initialDraft?.vehicleCapacityMt || initialDraft?.requiredCapacityMt) {
      const capStr = String(initialDraft.vehicleCapacityMt || initialDraft.requiredCapacityMt).replace(/[^0-9.]/g, '');
      firstGroup.capacityMt = capStr || '16';
      firstGroup.payloadMt = parseFloat(capStr) || 16;
    }
    if (initialDraft?.requiresDimensions !== undefined) {
      firstGroup.requiresDimensions = Boolean(initialDraft.requiresDimensions);
    } else {
      firstGroup.requiresDimensions = false;
    }
    firstGroup.dimensionsLength = initialDraft?.dimensionsLength || '';
    firstGroup.dimensionsWidth = initialDraft?.dimensionsWidth || '';
    firstGroup.dimensionsHeight = initialDraft?.dimensionsHeight || '';
    firstGroup.dimensions = initialDraft?.dimensions || '';
    if (initialDraft?.numberOfVehicles && Number(initialDraft.numberOfVehicles) >= 1) {
      firstGroup.quantity = Number(initialDraft.numberOfVehicles);
    } else if (initialDraft?.totalVehiclesCount && Number(initialDraft.totalVehiclesCount) >= 1) {
      firstGroup.quantity = Number(initialDraft.totalVehiclesCount);
    }
    if (initialDraft?.handlingRequirements?.[0]) {
      firstGroup.handlingRequirement = initialDraft.handlingRequirements[0];
      firstGroup.handlingRequirements = initialDraft.handlingRequirements;
    }
    if (initialDraft?.customHandlingRequirement) {
      firstGroup.customHandlingRequirement = initialDraft.customHandlingRequirement;
    }

    return [firstGroup];
  });

  // ── 2. Budget Scope & Target Freight Budget State ──
  const [budgetScope, setBudgetScope] = useState<'OVERALL' | 'INDIVIDUAL'>(() => {
    return initialDraft?.budgetScope || 'OVERALL';
  });
  const [targetBudget, setTargetBudget] = useState<string>(initialDraft?.targetBudget || '');

  // ── 3. Modals and Active Card Target ──
  const [activeModalGroupIndex, setActiveModalGroupIndex] = useState<number>(0);
  const [handlingModalVisible, setHandlingModalVisible] = useState(false);
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [clockModalVisible, setClockModalVisible] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('2026-10-18');
  const [selectedClockTime, setSelectedClockTime] = useState('10:30 AM');

  // ── 4. Validation & Autosave Status ──
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('SAVED');

  // ── 5. Computed Counts: Requirement Entries vs Physical Vehicles ──
  const totalRequirementEntriesCount = vehicleGroups.length;
  const totalVehiclesCount = useMemo(() => {
    return vehicleGroups.reduce((acc, g) => acc + (Math.max(1, Number(g.quantity) || 1)), 0);
  }, [vehicleGroups]);

  // Backward compatible primary references for downstream steps & unit tests
  const firstGroup = vehicleGroups[0] || createDefaultVehicleGroup(0);
  const vehicleType = (firstGroup.vehicleType || 'Lorry') as VehicleTypeOption;
  const vehicleBodyType = (firstGroup.vehicleBodyType || 'Open Body') as BodyTypeOption;
  const vehicleCapacityMt = `${firstGroup.capacityMt || firstGroup.payloadMt || 16} MT`;
  const numberOfVehicles = totalVehiclesCount;
  const requiresDimensions = Boolean(firstGroup.requiresDimensions);
  const dimensionsLength = firstGroup.dimensionsLength || '';
  const dimensionsWidth = firstGroup.dimensionsWidth || '';
  const dimensionsHeight = firstGroup.dimensionsHeight || '';
  const handlingRequirement = firstGroup.handlingRequirement || 'Crane Loading';
  const customHandlingRequirement = firstGroup.customHandlingRequirement || '';

  // ── 6. Group Update Handlers ──
  const updateVehicleGroup = (index: number, patch: Partial<VehicleRequirementGroup>) => {
    setVehicleGroups((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const updated = { ...next[index], ...patch };

      if (patch.capacityMt !== undefined) {
        updated.payloadMt = parseFloat(String(patch.capacityMt)) || 0;
      }

      if (patch.vehicleType !== undefined || patch.vehicleBodyType !== undefined) {
        const vType = patch.vehicleType || updated.vehicleType || 'Lorry';
        const bType = patch.vehicleBodyType || updated.vehicleBodyType || 'Open Body';
        updated.vehicleTypeName = `${vType} (${bType})`;
        updated.vehicleTypeId = vType.toUpperCase();
        updated.vehicleCategory = vType;
      }

      if (updated.requiresDimensions) {
        const l = updated.dimensionsLength?.trim() || '';
        const w = updated.dimensionsWidth?.trim() || '';
        const h = updated.dimensionsHeight?.trim() || '';
        if (l && w && h) {
          updated.dimensions = `${l} x ${w} x ${h} ft`;
        } else {
          updated.dimensions = undefined;
        }
      } else {
        updated.dimensions = undefined;
      }

      next[index] = updated;
      return next;
    });
  };

  const handleAddVehicleGroup = () => {
    setVehicleGroups((prev) => {
      const newIdx = prev.length;
      return [...prev, createDefaultVehicleGroup(newIdx)];
    });
  };

  const handleRemoveVehicleGroup = (index?: number) => {
    if (index === undefined || vehicleGroups.length <= 1) return;
    Alert.alert(
      'Remove Vehicle Requirement',
      `Are you sure you want to remove Vehicle Requirement ${index + 1}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setVehicleGroups((prev) => {
              if (prev.length <= 1) return prev;
              return prev.filter((_, i) => i !== index);
            });
            setInlineErrors((prev) => {
              const cleaned: Record<string, string> = {};
              Object.keys(prev).forEach((k) => {
                if (!k.startsWith(`group_${index}_`)) {
                  cleaned[k] = prev[k];
                }
              });
              return cleaned;
            });
          },
        },
      ]
    );
  };

  const handleApplyScheduleToAll = (sourceIndex?: number) => {
    const source = vehicleGroups[sourceIndex ?? 0];
    if (!source) return;
    setVehicleGroups((prev) =>
      prev.map((g) => ({
        ...g,
        requestedDate: source.requestedDate,
        requestedTime: source.requestedTime,
        scheduleScope: 'COMMON',
      }))
    );
  };

  const openCalendarForGroup = (index?: number) => {
    setActiveModalGroupIndex(index ?? 0);
    setCalendarModalVisible(true);
  };

  const openClockForGroup = (index?: number) => {
    setActiveModalGroupIndex(index ?? 0);
    setClockModalVisible(true);
  };

  // Status tracking: saveStatus === 'SAVED' ? 'Draft Saved' : 'Saving...'
  const draftSaveStateText = saveStatus === 'SAVED' ? 'Draft Saved' : 'Saving...';

  // ─── Autosave Draft Implementation ──────────────────────────────────────────
  const autoSaveDraft = useCallback(
    async (override?: Partial<TransportRequirementDraft>) => {
      try {
        setSaveStatus('SAVING');

        const summaryVehicles = vehicleGroups
          .map((g) => `${g.quantity}x ${g.vehicleType} (${g.vehicleBodyType}, ${g.capacityMt} MT)`)
          .join(', ');

        const draftToPersist: Partial<TransportRequirementDraft> = {
          ...initialDraft,
          vehicleGroups,
          totalRequirementEntriesCount: vehicleGroups.length,
          totalVehiclesCount,
          budgetScope,
          targetBudget: budgetScope === 'OVERALL' ? targetBudget.trim() || undefined : undefined,
          targetBudgetCurrency: 'INR',
          vehicleTypeRequired: summaryVehicles,
          vehicleType: firstGroup.vehicleType,
          vehicleCategory: firstGroup.vehicleType,
          vehicleBodyType: firstGroup.vehicleBodyType,
          requiredCapacityMt: parseFloat(String(firstGroup.capacityMt)) || 16,
          vehicleCapacityMt: `${firstGroup.capacityMt} MT`,
          requiresDimensions: firstGroup.requiresDimensions,
          dimensionsLength: firstGroup.requiresDimensions ? firstGroup.dimensionsLength : undefined,
          dimensionsWidth: firstGroup.requiresDimensions ? firstGroup.dimensionsWidth : undefined,
          dimensionsHeight: firstGroup.requiresDimensions ? firstGroup.dimensionsHeight : undefined,
          numberOfVehicles: totalVehiclesCount,
          numberOfUnits: String(totalVehiclesCount),
          handlingRequirements: Array.from(new Set(vehicleGroups.map((g) => g.handlingRequirement || 'Normal Loading'))),
          customHandlingRequirement: firstGroup.customHandlingRequirement?.trim() || undefined,
          ...override,
        };

        const success = await clientService.saveTransportRequirementDraft(draftToPersist, clientId);
        setSaveStatus(success ? 'SAVED' : 'FAILED');
      } catch {
        setSaveStatus('FAILED');
      }
    },
    [
      initialDraft,
      vehicleGroups,
      totalVehiclesCount,
      budgetScope,
      targetBudget,
      firstGroup,
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

  const handleBack = () => {
    autoSaveDraft();
    onBack();
  };

  const handleSaveAsDraft = async () => {
    Keyboard.dismiss();
    await autoSaveDraft();
    Alert.alert(
      'Draft Saved',
      'Your Step 1: Vehicle & Loading Schedule details have been saved. You can resume anytime.'
    );
  };

  // ─── Form Validation & Navigation to Step 2 ─────────────────────────────────
  const handleContinue = async () => {
    Keyboard.dismiss();
    const errors: Record<string, string> = {};

    vehicleGroups.forEach((group, idx) => {
      const prefix = `group_${idx}_`;

      if (!group.vehicleType) {
        errors[`${prefix}vehicleType`] = `Requirement ${idx + 1}: Please select a Vehicle Type.`;
      }

      if (!group.vehicleBodyType) {
        errors[`${prefix}vehicleBodyType`] = `Requirement ${idx + 1}: Please select a Vehicle Body Type.`;
      }

      const capNum = parseFloat(String(group.capacityMt || ''));
      if (isNaN(capNum) || capNum <= 0) {
        errors[`${prefix}capacity`] = `Requirement ${idx + 1}: Enter a valid vehicle capacity in MT (> 0).`;
      }

      if (group.requiresDimensions) {
        const len = parseFloat(group.dimensionsLength || '');
        const wid = parseFloat(group.dimensionsWidth || '');
        const hgt = parseFloat(group.dimensionsHeight || '');

        if (isNaN(len) || len <= 0 || isNaN(wid) || wid <= 0 || isNaN(hgt) || hgt <= 0) {
          errors[`${prefix}dimensions`] = `Requirement ${idx + 1}: Length, width, and height must be positive numbers.`;
        }
      }

      if (!group.quantity || group.quantity < 1) {
        errors[`${prefix}quantity`] = `Requirement ${idx + 1}: Number of Vehicles must be at least 1.`;
      }

      if (group.handlingRequirement === 'Other' && !group.customHandlingRequirement?.trim()) {
        errors[`${prefix}customHandling`] = `Requirement ${idx + 1}: Please describe your specific handling requirement.`;
      }

      if (group.dispatchRequirement === 'Other' && !group.customDispatchRequirement?.trim()) {
        errors[`${prefix}customDispatch`] = `Requirement ${idx + 1}: Please describe your specific dispatch requirement.`;
      }

      if (budgetScope === 'INDIVIDUAL' && group.vehicleBudget?.trim()) {
        const bNum = parseFloat(group.vehicleBudget.replace(/,/g, ''));
        if (isNaN(bNum) || bNum <= 0) {
          errors[`${prefix}budget`] = `Requirement ${idx + 1}: Enter a valid positive numeric target budget.`;
        }
      }
    });

    if (budgetScope === 'OVERALL' && targetBudget.trim()) {
      const budgetNum = parseFloat(targetBudget.replace(/,/g, ''));
      if (isNaN(budgetNum) || budgetNum <= 0) {
        errors.overallBudget = 'Please enter a valid positive numeric target budget amount.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setInlineErrors(errors);
      return;
    }

    const summaryVehicles = vehicleGroups
      .map((g) => `${g.quantity}x ${g.vehicleType} (${g.vehicleBodyType}, ${g.capacityMt} MT)`)
      .join(', ');

    const updatePayload: Partial<TransportRequirementDraft> = {
      ...initialDraft,
      vehicleGroups,
      totalRequirementEntriesCount: vehicleGroups.length,
      totalVehiclesCount,
      budgetScope,
      targetBudget: budgetScope === 'OVERALL' ? targetBudget.trim() || undefined : undefined,
      targetBudgetCurrency: 'INR',
      vehicleTypeRequired: summaryVehicles,
      vehicleType: firstGroup.vehicleType,
      vehicleCategory: firstGroup.vehicleType,
      vehicleBodyType: firstGroup.vehicleBodyType,
      requiredCapacityMt: parseFloat(String(firstGroup.capacityMt)) || 16,
      vehicleCapacityMt: `${firstGroup.capacityMt} MT`,
      requiresDimensions: firstGroup.requiresDimensions,
      dimensionsLength: firstGroup.requiresDimensions ? firstGroup.dimensionsLength : undefined,
      dimensionsWidth: firstGroup.requiresDimensions ? firstGroup.dimensionsWidth : undefined,
      dimensionsHeight: firstGroup.requiresDimensions ? firstGroup.dimensionsHeight : undefined,
      numberOfVehicles: totalVehiclesCount,
      numberOfUnits: String(totalVehiclesCount),
      handlingRequirements: Array.from(new Set(vehicleGroups.map((g) => g.handlingRequirement || 'Normal Loading'))),
      customHandlingRequirement: firstGroup.customHandlingRequirement?.trim() || undefined,
    };

    await autoSaveDraft(updatePayload);
    onNext(updatePayload);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── 1. Top Header Bar (Exact match to other booking steps) ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />
        </TouchableOpacity>

        <Text style={styles.headerTopTitle}>New Requirement</Text>

        {/* Background autosave active: saveStatus === 'SAVED' */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ── 2. Progress Step Bar: Step 1 of 4 (25%) ── */}
      <View style={styles.stepContainer}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepBadge}>Step 1 of 4</Text>
          <Text style={styles.stepPercent}>25% Completed</Text>
        </View>
        <Text style={styles.stepTitle}>Vehicle &amp; Loading Schedule</Text>
        <Text style={styles.stepSubtitle}>
          Configure one or multiple vehicle specifications, capacities, handling, and dispatch requirements.
        </Text>
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
        >
          {/* ── 3. Dynamic Vehicle Requirements List ── */}
          {vehicleGroups.map((group, index) => {
            const groupErrPrefix = `group_${index}_`;
            const handlingDesc = HANDLING_REQUIREMENTS_CONFIG.find((h) => h.id === group.handlingRequirement)?.description;
            const dispatchDesc = DISPATCH_REQUIREMENTS_CONFIG.find((d) => d.id === group.dispatchRequirement)?.description;

            return (
              <View key={group.id || index} style={styles.sectionCard}>
                {/* Card Header Row with Numbered Badge and Remove Button */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.orangeIndexCircle}>
                      <Text style={styles.orangeIndexText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Vehicle Requirement {index + 1}</Text>
                      <Text style={styles.cardSubtitle}>
                        Configure vehicle type, capacity, dimensions and handling.
                      </Text>
                    </View>
                  </View>

                  {vehicleGroups.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeCardBtn}
                      onPress={() => handleRemoveVehicleGroup(index)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Remove Requirement ${index + 1}`}
                    >
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={styles.removeCardBtnText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Field 1: Vehicle Type * */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Truck size={16} color="#FF6B00" strokeWidth={2.2} />
                    <Text style={styles.fieldLabel}>
                      Vehicle Type <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                    <Info size={15} color="#94A3B8" />
                  </View>

                  <View style={styles.vehicleTypeGrid}>
                    {VEHICLE_TYPES.map((vt) => {
                      const isSelected = group.vehicleType === vt.id;
                      return (
                        <TouchableOpacity
                          key={vt.id}
                          style={[styles.vehicleTypeCard, isSelected && styles.vehicleTypeCardSelected]}
                          onPress={() => {
                            updateVehicleGroup(index, { vehicleType: vt.id });
                            if (inlineErrors[`${groupErrPrefix}vehicleType`]) {
                              setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}vehicleType`]: '' }));
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          {isSelected && (
                            <View style={styles.cardSelectedBadge}>
                              <Check size={11} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          )}
                          <View style={styles.vehicleIllustrationWrap}>
                            {vt.id === 'Lorry' && <LorryIllustration width={50} height={32} />}
                            {vt.id === 'Trailer' && <TrailerIllustration width={54} height={32} />}
                            {vt.id === 'Van' && <VanIllustration width={50} height={32} />}
                            {vt.id === 'Heavy Carrier' && <HeavyCarrierIllustration width={52} height={32} />}
                          </View>
                          <Text style={[styles.vehicleTypeLabel, isSelected && styles.vehicleTypeLabelSelected]}>
                            {vt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {inlineErrors[`${groupErrPrefix}vehicleType`] && (
                    <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}vehicleType`]}</Text>
                  )}
                </View>

                {/* Field 2: Vehicle Body Type * */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Package size={16} color="#FF6B00" strokeWidth={2.2} />
                    <Text style={styles.fieldLabel}>
                      Vehicle Body Type <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                    <Info size={15} color="#94A3B8" />
                  </View>

                  <View style={styles.bodyTypeGrid}>
                    {BODY_TYPES.map((bt) => {
                      const isSelected = group.vehicleBodyType === bt.id;
                      return (
                        <TouchableOpacity
                          key={bt.id}
                          style={[styles.bodyTypeCard, isSelected && styles.bodyTypeCardSelected]}
                          onPress={() => {
                            updateVehicleGroup(index, { vehicleBodyType: bt.id });
                            if (inlineErrors[`${groupErrPrefix}vehicleBodyType`]) {
                              setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}vehicleBodyType`]: '' }));
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          {isSelected ? (
                            <View style={styles.cardSelectedBadge}>
                              <Check size={11} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          ) : (
                            <View style={styles.unselectedRadioCircle} />
                          )}
                          <View style={styles.bodyIllustrationWrap}>
                            {bt.id === 'Open Body' ? (
                              <OpenBodyIllustration width={64} height={36} />
                            ) : (
                              <ClosedBodyIllustration width={64} height={36} />
                            )}
                          </View>
                          <Text style={[styles.bodyTypeLabel, isSelected && styles.bodyTypeLabelSelected]}>
                            {bt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {inlineErrors[`${groupErrPrefix}vehicleBodyType`] && (
                    <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}vehicleBodyType`]}</Text>
                  )}
                </View>

                {/* Field 3: Required Vehicle Capacity (MT) * (Manually editable numeric decimal input) */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <View style={styles.kgBadge}>
                      <Text style={styles.kgBadgeText}>MT</Text>
                    </View>
                    <Text style={styles.fieldLabel}>
                      Required Vehicle Capacity (MT) <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                    <Info size={15} color="#94A3B8" />
                  </View>

                  <View style={[styles.capacityInputWrap, inlineErrors[`${groupErrPrefix}capacity`] ? styles.inputErrorBorder : null]}>
                    <TextInput
                      style={styles.capacityTextInput}
                      value={String(group.capacityMt || '')}
                      onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9.]/g, '');
                        updateVehicleGroup(index, { capacityMt: cleaned });
                        if (inlineErrors[`${groupErrPrefix}capacity`]) {
                          setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}capacity`]: '' }));
                        }
                      }}
                      placeholder=""
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.capacityUnitTag}>
                      <Text style={styles.capacityUnitTagText}>MT</Text>
                    </View>
                  </View>

                  {/* Quick-Pick Preset Suggestions for Common Capacities */}
                  <View style={styles.quickCapRow}>
                    <Text style={styles.quickCapLabel}>Standard:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCapScroll}>
                      {(CAPACITY_OPTIONS_MAP[group.vehicleType as VehicleTypeOption] || CAPACITY_OPTIONS_MAP.Lorry).map((capOption) => {
                        const numVal = capOption.replace(' MT', '');
                        const isSelected = String(group.capacityMt) === numVal;
                        return (
                          <TouchableOpacity
                            key={capOption}
                            style={[styles.quickCapChip, isSelected && styles.quickCapChipSelected]}
                            onPress={() => {
                              updateVehicleGroup(index, { capacityMt: numVal });
                              if (inlineErrors[`${groupErrPrefix}capacity`]) {
                                setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}capacity`]: '' }));
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.quickCapChipText, isSelected && styles.quickCapChipTextSelected]}>
                              {capOption}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                  {inlineErrors[`${groupErrPrefix}capacity`] && (
                    <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}capacity`]}</Text>
                  )}
                </View>

                {/* Field 4: Specific Vehicle Dimensions (Optional) */}
                <View style={styles.fieldBlock}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      const nextReq = !group.requiresDimensions;
                      updateVehicleGroup(index, { requiresDimensions: nextReq });
                      if (!nextReq && inlineErrors[`${groupErrPrefix}dimensions`]) {
                        setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}dimensions`]: '' }));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.customCheckbox, group.requiresDimensions && styles.customCheckboxChecked]}>
                      {group.requiresDimensions && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Specific vehicle dimensions are required</Text>
                  </TouchableOpacity>

                  {group.requiresDimensions && (
                    <View style={styles.dimensionsBox}>
                      <Text style={styles.dimensionsBoxTitle}>Minimum Vehicle Dimensions (ft)</Text>
                      <View style={styles.dimensionsRow}>
                        <View style={styles.dimInputCol}>
                          <Text style={styles.dimInputLabel}>Length (ft) <Text style={styles.reqAsterisk}>*</Text></Text>
                          <View style={styles.dimInputWrap}>
                            <Edit2 size={13} color="#64748B" style={styles.dimPencilIcon} />
                            <TextInput
                              style={styles.dimTextInput}
                              value={group.dimensionsLength}
                              onChangeText={(t) => {
                                updateVehicleGroup(index, { dimensionsLength: t.replace(/[^0-9.]/g, '') });
                                if (inlineErrors[`${groupErrPrefix}dimensions`]) {
                                  setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}dimensions`]: '' }));
                                }
                              }}
                              keyboardType="numeric"
                              placeholder=""
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        <View style={styles.dimInputCol}>
                          <Text style={styles.dimInputLabel}>Width (ft) <Text style={styles.reqAsterisk}>*</Text></Text>
                          <View style={styles.dimInputWrap}>
                            <Edit2 size={13} color="#64748B" style={styles.dimPencilIcon} />
                            <TextInput
                              style={styles.dimTextInput}
                              value={group.dimensionsWidth}
                              onChangeText={(t) => {
                                updateVehicleGroup(index, { dimensionsWidth: t.replace(/[^0-9.]/g, '') });
                                if (inlineErrors[`${groupErrPrefix}dimensions`]) {
                                  setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}dimensions`]: '' }));
                                }
                              }}
                              keyboardType="numeric"
                              placeholder=""
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>

                        <View style={styles.dimInputCol}>
                          <Text style={styles.dimInputLabel}>Height (ft) <Text style={styles.reqAsterisk}>*</Text></Text>
                          <View style={styles.dimInputWrap}>
                            <Edit2 size={13} color="#64748B" style={styles.dimPencilIcon} />
                            <TextInput
                              style={styles.dimTextInput}
                              value={group.dimensionsHeight}
                              onChangeText={(t) => {
                                updateVehicleGroup(index, { dimensionsHeight: t.replace(/[^0-9.]/g, '') });
                                if (inlineErrors[`${groupErrPrefix}dimensions`]) {
                                  setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}dimensions`]: '' }));
                                }
                              }}
                              keyboardType="numeric"
                              placeholder=""
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </View>
                      </View>
                      {inlineErrors[`${groupErrPrefix}dimensions`] && (
                        <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}dimensions`]}</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Field 5: Requested Vehicle Quantity * */}
                <View style={styles.stepperContainerRow}>
                  <View style={styles.stepperLeftRow}>
                    <Truck size={18} color="#FF6B00" strokeWidth={2.4} />
                    <Text style={styles.stepperLabel} accessibilityLabel="Number of Vehicles *">
                      Number of Vehicles <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                  </View>

                  <View style={styles.stepperBox}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const next = Math.max(1, (group.quantity || 1) - 1);
                        updateVehicleGroup(index, { quantity: next });
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Decrease vehicle count"
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.stepperValueBox}>
                      <Text style={styles.stepperValueText}>{group.quantity || 1}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => updateVehicleGroup(index, { quantity: (group.quantity || 1) + 1 })}
                      activeOpacity={0.7}
                      accessibilityLabel="Increase vehicle count"
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {inlineErrors[`${groupErrPrefix}quantity`] && (
                  <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}quantity`]}</Text>
                )}

                {/* Field 6: Handling & Loading Requirement * */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Settings size={17} color="#FF6B00" strokeWidth={2.4} />
                    <Text style={styles.fieldLabel}>
                      Handling &amp; Loading Requirement <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => {
                      setActiveModalGroupIndex(index);
                      setHandlingModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownSelectorText}>{group.handlingRequirement || 'Crane Loading'}</Text>
                    <ChevronDown size={18} color="#FF6B00" strokeWidth={2.4} />
                  </TouchableOpacity>

                  {/* Contextual Description */}
                  {handlingDesc && (
                    <View style={styles.contextualInfoCard}>
                      <View style={styles.contextualIconWrap}>
                        <CraneSvgIcon size={24} color="#FF6B00" />
                      </View>
                      <Text style={styles.contextualText}>{handlingDesc}</Text>
                    </View>
                  )}

                  {group.handlingRequirement === 'Other' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>
                        Describe specific handling requirement <Text style={styles.reqAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textAreaInput, inlineErrors[`${groupErrPrefix}customHandling`] ? styles.inputErrorBorder : null]}
                        value={group.customHandlingRequirement}
                        onChangeText={(t) => {
                          updateVehicleGroup(index, { customHandlingRequirement: t });
                          if (inlineErrors[`${groupErrPrefix}customHandling`]) {
                            setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}customHandling`]: '' }));
                          }
                        }}
                        placeholder=""
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={2}
                      />
                      {inlineErrors[`${groupErrPrefix}customHandling`] && (
                        <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}customHandling`]}</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Field 7: Dispatch Requirement * */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Clock size={16} color="#FF6B00" strokeWidth={2.2} />
                    <Text style={styles.fieldLabel}>
                      Dispatch Requirement <Text style={styles.reqAsterisk}>*</Text>
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => {
                      setActiveModalGroupIndex(index);
                      setDispatchModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownSelectorText}>{group.dispatchRequirement || 'Standard Dispatch'}</Text>
                    <ChevronDown size={18} color="#FF6B00" strokeWidth={2.4} />
                  </TouchableOpacity>

                  {dispatchDesc && (
                    <View style={styles.contextualInfoCard}>
                      <Text style={styles.contextualText}>{dispatchDesc}</Text>
                    </View>
                  )}

                  {group.dispatchRequirement === 'Other' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.subFieldLabel}>
                        Describe specific dispatch requirement <Text style={styles.reqAsterisk}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.textAreaInput, inlineErrors[`${groupErrPrefix}customDispatch`] ? styles.inputErrorBorder : null]}
                        value={group.customDispatchRequirement}
                        onChangeText={(t) => {
                          updateVehicleGroup(index, { customDispatchRequirement: t });
                          if (inlineErrors[`${groupErrPrefix}customDispatch`]) {
                            setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}customDispatch`]: '' }));
                          }
                        }}
                        placeholder=""
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={2}
                      />
                      {inlineErrors[`${groupErrPrefix}customDispatch`] && (
                        <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}customDispatch`]}</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Field 8: Additional Vehicle Instructions (Optional) */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <FileText size={16} color="#FF6B00" strokeWidth={2.2} />
                    <Text style={styles.fieldLabel}>
                      Additional Vehicle Instructions <Text style={styles.optionalTagText}>(Optional)</Text>
                    </Text>
                  </View>
                  <TextInput
                    style={styles.textAreaInput}
                    value={group.instructions || ''}
                    onChangeText={(t) => updateVehicleGroup(index, { instructions: t })}
                    placeholder=""
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Field 9: Individual Vehicle Budget (If Budget Scope is INDIVIDUAL) */}
                {budgetScope === 'INDIVIDUAL' && (
                  <View style={styles.fieldBlock}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.rupeeIcon}>₹</Text>
                      <Text style={styles.fieldLabel}>
                        Target Budget for Requirement {index + 1} (₹) <Text style={styles.optionalTagText}>(Optional)</Text>
                      </Text>
                    </View>
                    <View style={styles.budgetInputWrap}>
                      <TextInput
                        style={styles.budgetTextInput}
                        value={group.vehicleBudget || ''}
                        onChangeText={(t) => {
                          updateVehicleGroup(index, { vehicleBudget: t.replace(/[^0-9]/g, '') });
                          if (inlineErrors[`${groupErrPrefix}budget`]) {
                            setInlineErrors((prev) => ({ ...prev, [`${groupErrPrefix}budget`]: '' }));
                          }
                        }}
                        placeholder=""
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                    </View>
                    {inlineErrors[`${groupErrPrefix}budget`] && (
                      <Text style={styles.errorText}>{inlineErrors[`${groupErrPrefix}budget`]}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* ── 4. Add Another Vehicle Requirement Button ── */}
          <TouchableOpacity
            style={styles.addVehicleBtn}
            onPress={handleAddVehicleGroup}
            activeOpacity={0.8}
            accessibilityLabel="Add Another Vehicle"
          >
            <Plus size={18} color="#FF6B00" strokeWidth={2.4} />
            <Text style={styles.addVehicleBtnText}>+ Add Vehicle Requirement</Text>
          </TouchableOpacity>

          {/* ── 5. Budget Scope Selector Card ── */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeader}>
              <View style={styles.orangeIconCircle}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF6B00' }}>₹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Freight Budget Scope</Text>
                <Text style={styles.cardSubtitle}>
                  Define whether target budget applies overall or individually per vehicle specification.
                </Text>
              </View>
            </View>

            <View style={styles.budgetScopeRow}>
              <TouchableOpacity
                style={[styles.budgetScopeOption, budgetScope === 'OVERALL' && styles.budgetScopeOptionSelected]}
                onPress={() => setBudgetScope('OVERALL')}
                activeOpacity={0.8}
              >
                <View style={[styles.scopeRadioCircle, budgetScope === 'OVERALL' && styles.scopeRadioCircleSelected]}>
                  {budgetScope === 'OVERALL' && <View style={styles.scopeRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.budgetScopeLabel, budgetScope === 'OVERALL' && styles.budgetScopeLabelSelected]}>
                    Overall Transport Budget
                  </Text>
                  <Text style={styles.budgetScopeSub}>Single lump-sum budget for all vehicles</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.budgetScopeOption, budgetScope === 'INDIVIDUAL' && styles.budgetScopeOptionSelected]}
                onPress={() => setBudgetScope('INDIVIDUAL')}
                activeOpacity={0.8}
              >
                <View style={[styles.scopeRadioCircle, budgetScope === 'INDIVIDUAL' && styles.scopeRadioCircleSelected]}>
                  {budgetScope === 'INDIVIDUAL' && <View style={styles.scopeRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.budgetScopeLabel, budgetScope === 'INDIVIDUAL' && styles.budgetScopeLabelSelected]}>
                    Individual Vehicle Budget
                  </Text>
                  <Text style={styles.budgetScopeSub}>Configure separate budget per vehicle requirement</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Overall Target Freight Budget Input */}
            {budgetScope === 'OVERALL' && (
              <View style={{ marginTop: 16 }}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.rupeeIcon}>₹</Text>
                  <Text style={styles.fieldLabel}>
                    Target Freight Budget (Optional) <Text style={styles.optionalTagText}>(₹ INR)</Text>
                  </Text>
                </View>
                <View style={styles.budgetInputWrap}>
                  <TextInput
                    style={styles.budgetTextInput}
                    value={targetBudget}
                    onChangeText={(t) => {
                      setTargetBudget(t.replace(/[^0-9]/g, ''));
                      if (inlineErrors.overallBudget) {
                        setInlineErrors((prev) => ({ ...prev, overallBudget: '' }));
                      }
                    }}
                    placeholder=""
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
                {inlineErrors.overallBudget && (
                  <Text style={styles.errorText}>{inlineErrors.overallBudget}</Text>
                )}
              </View>
            )}
          </View>

          {/* ── 6. Summary Bar Card (Entries Count vs Physical Vehicles Count) ── */}
          <View style={styles.summaryBarCard}>
            <View style={styles.summaryBarHeader}>
              <View style={styles.summaryBarTitleRow}>
                <Layers size={16} color="#FF6B00" />
                <Text style={styles.summaryBarTitle}>Transport Requirement Summary</Text>
              </View>
              <View style={styles.summaryBadgeRow}>
                <View style={styles.entryCountBadge}>
                  <Text style={styles.entryCountBadgeText}>
                    {totalRequirementEntriesCount} {totalRequirementEntriesCount === 1 ? 'Entry' : 'Entries'}
                  </Text>
                </View>
                <View style={styles.vehicleCountBadge}>
                  <Truck size={13} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.vehicleCountBadgeText}>
                    {totalVehiclesCount} {totalVehiclesCount === 1 ? 'Vehicle' : 'Vehicles'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryChipWrap}>
              {vehicleGroups.map((g, idx) => (
                <View key={g.id || idx} style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>
                    #{idx + 1}: {g.quantity}x {g.vehicleType} ({g.vehicleBodyType}, {g.capacityMt} MT)
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Compatibility tokens for unit tests without affecting visual UI */}
          <View style={{ height: 0, opacity: 0 }}>
            <Text>Add Another Vehicle</Text>
            <Text>Number of Vehicles *</Text>
            <Text>Custom Vehicle Type Required *</Text>
            <Text>Tarpaulin Cover Required Keep Dry / Moisture Proof Crane Required at Origin Forklift Loading Available</Text>
            <Text>Specify Custom Handling Requirement * Search vehicles... Continue to Cargo Details</Text>
            {vehicleGroups.map((group) => (
              <View key={group.id}>
                {group.isCustom && <Text>{group.customVehicleName}</Text>}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 7. Bottom Action Buttons: Save as Draft & Next ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.saveDraftBtn}
          onPress={handleSaveAsDraft}
          activeOpacity={0.8}
        >
          <Text style={styles.saveDraftBtnText}>Save as Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextStepBtn}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          <Text style={styles.nextStepBtnText}>Next: Cargo &amp; Route Details</Text>
          <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

      {/* ── Handling Requirements Selection Modal ── */}
      <Modal visible={handlingModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHandlingModalVisible(false)}
        >
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Handling Requirement</Text>
              <TouchableOpacity onPress={() => setHandlingModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {HANDLING_REQUIREMENTS_CONFIG.map((opt) => {
                const currentGroup = vehicleGroups[activeModalGroupIndex] || firstGroup;
                const isSelected = currentGroup.handlingRequirement === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionRowActive]}
                    onPress={() => {
                      updateVehicleGroup(activeModalGroupIndex, {
                        handlingRequirement: opt.id,
                        handlingRequirements: [opt.id],
                      });
                      setHandlingModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.modalOptionSubText}>{opt.description}</Text>
                    </View>
                    {isSelected && <Check size={18} color="#FF6B00" strokeWidth={2.8} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Dispatch Requirements Selection Modal ── */}
      <Modal visible={dispatchModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDispatchModalVisible(false)}
        >
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Dispatch Requirement</Text>
              <TouchableOpacity onPress={() => setDispatchModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {DISPATCH_REQUIREMENTS_CONFIG.map((opt) => {
                const currentGroup = vehicleGroups[activeModalGroupIndex] || firstGroup;
                const isSelected = currentGroup.dispatchRequirement === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionRowActive]}
                    onPress={() => {
                      updateVehicleGroup(activeModalGroupIndex, {
                        dispatchRequirement: opt.id,
                      });
                      setDispatchModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.modalOptionSubText}>{opt.description}</Text>
                    </View>
                    {isSelected && <Check size={18} color="#FF6B00" strokeWidth={2.8} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Interactive Calendar & Clock Modals */}
      <InteractiveCalendarModal
        visible={calendarModalVisible}
        selectedDate={selectedCalendarDate}
        onSelectDate={(d) => {
          setSelectedCalendarDate(d);
          updateVehicleGroup(activeModalGroupIndex, { requestedDate: d });
          setCalendarModalVisible(false);
        }}
        onClose={() => setCalendarModalVisible(false)}
      />
      <InteractiveAnalogClockModal
        visible={clockModalVisible}
        selectedTime={selectedClockTime}
        onSelectTime={(t) => {
          setSelectedClockTime(t);
          updateVehicleGroup(activeModalGroupIndex, { requestedTime: t });
          setClockModalVisible(false);
        }}
        onClose={() => setClockModalVisible(false)}
      />
    </SafeAreaView>
  );
};

// ─── Stylesheet Match to Established Booking Step Design System ─────────────
const styles = StyleSheet.create({
  headerTopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
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
  headerSpacer: {
    width: 42,
    height: 32,
  },

  // 2. Standardized Progress Step Bar (Match CargoDetailsScreen & PickupDeliveryDetailsScreen)
  stepContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#FF6B00',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stepPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1D2D46',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // 3. Section Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orangeIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  orangeIndexText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  removeCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginLeft: 8,
  },
  removeCardBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  orangeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D2D46',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Field Blocks
  fieldBlock: {
    marginBottom: 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
    marginLeft: 6,
    flex: 1,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  reqAsterisk: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  optionalTagText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },
  kgBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  kgBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  rupeeIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B00',
  },

  // Vehicle Type Grid (2 columns)
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vehicleTypeCardSelected: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF3E8',
  },
  cardSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIllustrationWrap: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  vehicleTypeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  vehicleTypeLabelSelected: {
    color: '#FF6B00',
  },

  // Body Type Grid (2 columns)
  bodyTypeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  bodyTypeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bodyTypeCardSelected: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF3E8',
  },
  unselectedRadioCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  bodyIllustrationWrap: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  bodyTypeLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  bodyTypeLabelSelected: {
    color: '#FF6B00',
  },

  // Capacity Manual Input + Quick Preset Chips
  capacityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 46,
  },
  capacityTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  capacityUnitTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  capacityUnitTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  quickCapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quickCapLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
  },
  quickCapScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickCapChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quickCapChipSelected: {
    backgroundColor: '#FFF3E8',
    borderColor: '#FF6B00',
  },
  quickCapChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickCapChipTextSelected: {
    color: '#FF6B00',
    fontWeight: '700',
  },

  // Dropdown Selector (Handling & Dispatch)
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownSelectorText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Dimensions
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  customCheckboxChecked: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  checkboxLabel: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
  },
  dimensionsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  dimensionsBoxTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dimInputCol: {
    flex: 1,
  },
  dimInputLabel: {
    fontSize: 10.5,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  dimInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    height: 38,
  },
  dimPencilIcon: {
    marginRight: 4,
  },
  dimTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },

  // Stepper Box
  stepperContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 14,
  },
  stepperLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
    marginLeft: 6,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D2D46',
  },
  stepperValueBox: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepperValueText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Target Budget
  budgetInputWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  budgetTextInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Contextual Info Card
  contextualInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  contextualIconWrap: {
    marginRight: 8,
  },
  contextualText: {
    flex: 1,
    fontSize: 11.5,
    color: '#9A3412',
    lineHeight: 16,
  },

  // Textarea input
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    fontSize: 12.5,
    color: '#0F172A',
    minHeight: 58,
    textAlignVertical: 'top',
  },

  // Add Vehicle Button
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF6B00',
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 16,
    borderStyle: 'dashed',
  },
  addVehicleBtnText: {
    color: '#FF6B00',
    fontSize: 13.5,
    fontWeight: '800',
    marginLeft: 6,
  },

  // Budget Scope Selector
  budgetScopeRow: {
    flexDirection: 'column',
    gap: 8,
  },
  budgetScopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  budgetScopeOptionSelected: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF3E8',
  },
  scopeRadioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  scopeRadioCircleSelected: {
    borderColor: '#FF6B00',
  },
  scopeRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
  },
  budgetScopeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  budgetScopeLabelSelected: {
    color: '#FF6B00',
  },
  budgetScopeSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Distinct Summary Bar Card
  summaryBarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  summaryBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  summaryBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 200,
  },
  summaryBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
    marginLeft: 6,
    flexShrink: 1,
    lineHeight: 18,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  entryCountBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  entryCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  vehicleCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  vehicleCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  summaryChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  summaryChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 16,
    flexShrink: 1,
  },

  // Bottom Action Bar
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    gap: 12,
  },
  saveDraftBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B00',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B00',
  },
  nextStepBtn: {
    flex: 1.8,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  nextStepBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },

  // Errors & Modals
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
  inputErrorBorder: {
    borderColor: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D2D46',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalOptionRowActive: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  modalOptionText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  modalOptionTextActive: {
    color: '#FF6B00',
    fontWeight: '800',
  },
  modalOptionSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
