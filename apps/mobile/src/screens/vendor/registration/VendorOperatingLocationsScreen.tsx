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
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Check,
  Shield,
  ArrowRight,
  Search,
  Plus,
  X,
  Globe2,
  ChevronDown,
  ChevronUp,
  Building,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService, RegionalHub } from '../../../services/vendorService';
import { RegistrationUpdateHeaderBanner } from '../../../components/RegistrationUpdateHeaderBanner';

export interface AdminRegionalHub {
  id: string;
  name: string;
  city?: string;
  state: string;
  region: string;
  status?: string;
  isCustom?: boolean;
}

export const ADMIN_ACTIVE_REGIONAL_HUBS: AdminRegionalHub[] = [
  { id: 'hub_ghy', name: 'Guwahati (Gateway Hub)', city: 'Guwahati', state: 'Assam', region: 'North East' },
  { id: 'hub_slg', name: 'Siliguri (North Bengal Corridor)', city: 'Siliguri', state: 'West Bengal', region: 'East' },
  { id: 'hub_ccu', name: 'Kolkata (Dankuni Port Hub)', city: 'Kolkata', state: 'West Bengal', region: 'East' },
  { id: 'hub_del', name: 'Delhi / NCR Logistics Hub', city: 'Delhi', state: 'Delhi', region: 'North' },
  { id: 'hub_bom', name: 'Mumbai / Bhiwandi Terminal', city: 'Mumbai', state: 'Maharashtra', region: 'West' },
  { id: 'hub_hyd', name: 'Hyderabad Logistics Hub', city: 'Hyderabad', state: 'Telangana', region: 'South' },
  { id: 'hub_agt', name: 'Agartala (Tripura Corridor)', city: 'Agartala', state: 'Tripura', region: 'North East' },
  { id: 'hub_dmp', name: 'Dimapur (Nagaland Hub)', city: 'Dimapur', state: 'Nagaland', region: 'North East' },
  { id: 'hub_shl', name: 'Shillong (Meghalaya Hub)', city: 'Shillong', state: 'Meghalaya', region: 'North East' },
  { id: 'hub_maa', name: 'Chennai Logistics Hub', city: 'Chennai', state: 'Tamil Nadu', region: 'South' },
  { id: 'hub_blr', name: 'Bengaluru Logistics Terminal', city: 'Bengaluru', state: 'Karnataka', region: 'South' },
  { id: 'hub_amd', name: 'Ahmedabad Logistics Park', city: 'Ahmedabad', state: 'Gujarat', region: 'West' },
  { id: 'hub_pat', name: 'Patna Freight Hub', city: 'Patna', state: 'Bihar', region: 'East' },
  { id: 'hub_bbs', name: 'Bhubaneswar Logistics Hub', city: 'Bhubaneswar', state: 'Odisha', region: 'East' },
  { id: 'hub_rpr', name: 'Raipur Logistics Terminal', city: 'Raipur', state: 'Chhattisgarh', region: 'Central' },
  { id: 'hub_jpr', name: 'Jaipur Transport Hub', city: 'Jaipur', state: 'Rajasthan', region: 'North' },
];

export const COMMERCIAL_PERMITS = [
  'All India National Permit (NP)',
  'North East Regional Composite Permit',
  'State Heavy Goods Permit',
];

interface VendorOperatingLocationsScreenProps {
  onBack: () => void;
  onNext: (data: {
    operatingHubs: string[];
    manualOperatingLocations?: string[];
    interstatePermits: string[];
  }) => void;
  isUpdateMode?: boolean;
  onlyIncompleteSteps?: boolean;
  incompleteStepsCount?: number;
  currentIncompleteStepNumber?: number;
  missingFields?: string[];
  onToggleViewAllSteps?: () => void;
}

export const VendorOperatingLocationsScreen: React.FC<VendorOperatingLocationsScreenProps> = ({
  onBack,
  onNext,
  isUpdateMode = false,
  onlyIncompleteSteps = true,
  incompleteStepsCount = 0,
  currentIncompleteStepNumber = 1,
  missingFields,
  onToggleViewAllSteps,
}) => {
  const [regionalHubs, setRegionalHubs] = useState<AdminRegionalHub[]>(ADMIN_ACTIVE_REGIONAL_HUBS);
  const [selectedHubIds, setSelectedHubIds] = useState<string[]>([]);
  const [manualLocations, setManualLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [selectedPermits, setSelectedPermits] = useState<string[]>([]);

  // Searchable Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingHubs, setLoadingHubs] = useState(false);

  // Add Missing Regional Hub Modal State
  const [showAddHubModal, setShowAddHubModal] = useState(false);
  const [newHubName, setNewHubName] = useState('');
  const [newHubCity, setNewHubCity] = useState('');
  const [newHubState, setNewHubState] = useState('');
  const [savingHub, setSavingHub] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingHubs(true);
      try {
        const fetchedHubs = await vendorService.getActiveRegionalHubs();
        if (fetchedHubs && fetchedHubs.length > 0) {
          setRegionalHubs(fetchedHubs as AdminRegionalHub[]);
        }
      } catch (err) {
        console.warn('Failed to load active regional hubs:', err);
      } finally {
        setLoadingHubs(false);
      }

      // Load draft only if genuine data exists
      const draft = await vendorService.getDraftForm();
      if (draft?.operatingHubs && draft.operatingHubs.length > 0) {
        // Map stored names or IDs to ID keys
        const ids = draft.operatingHubs.map((stored) => {
          const match = regionalHubs.find(
            (h) => h.id === stored || h.name.toLowerCase() === stored.toLowerCase()
          );
          return match ? match.id : stored;
        });
        setSelectedHubIds(ids);
      }
      if (draft?.manualOperatingLocations && draft.manualOperatingLocations.length > 0) {
        setManualLocations(draft.manualOperatingLocations);
      }
      if (draft?.interstatePermits && draft.interstatePermits.length > 0) {
        setSelectedPermits(draft.interstatePermits);
      }
    })();
  }, []);

  const toggleHub = (hubId: string) => {
    if (selectedHubIds.includes(hubId)) {
      setSelectedHubIds(selectedHubIds.filter((id) => id !== hubId));
    } else {
      setSelectedHubIds([...selectedHubIds, hubId]);
    }
  };

  const isAllIndiaSelected =
    regionalHubs.length > 0 &&
    regionalHubs.every((h) => selectedHubIds.includes(h.id));

  const toggleSelectAllIndia = () => {
    if (isAllIndiaSelected) {
      setSelectedHubIds([]);
    } else {
      setSelectedHubIds(regionalHubs.map((h) => h.id));
    }
  };

  // Add Missing Regional Hub to Database (Name, City, State)
  const handleSaveNewHub = async () => {
    const cleanName = newHubName.trim();
    const cleanCity = newHubCity.trim();
    const cleanState = newHubState.trim();

    if (!cleanName) {
      Alert.alert('Hub Name Required', 'Please enter the Regional Hub or Terminal Name.');
      return;
    }
    if (!cleanCity) {
      Alert.alert('City Required', 'Please enter the Hub City location.');
      return;
    }
    if (!cleanState) {
      Alert.alert('State Required', 'Please enter the Hub State.');
      return;
    }

    setSavingHub(true);
    try {
      const created = await vendorService.addRegionalHub({
        name: cleanName,
        city: cleanCity,
        state: cleanState,
      });

      // Append to regional hubs list if not already present
      setRegionalHubs((prev) => {
        const exists = prev.some((h) => h.id === created.id || h.name.toLowerCase() === created.name.toLowerCase());
        return exists ? prev : [...prev, created as AdminRegionalHub];
      });

      // Automatically select the new regional hub
      if (!selectedHubIds.includes(created.id)) {
        setSelectedHubIds((prev) => [...prev, created.id]);
      }

      setNewHubName('');
      setNewHubCity('');
      setNewHubState('');
      setShowAddHubModal(false);

      Alert.alert(
        'Regional Hub Added & Selected',
        `"${created.name}" has been saved to the database and added to your operating hubs.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save regional hub. Please try again.');
    } finally {
      setSavingHub(false);
    }
  };

  // Backward compatible manual location input
  const handleAddManualLocation = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      Alert.alert('Location Required', 'Please enter a hub or coverage location name.');
      return;
    }
    if (manualLocations.some((loc) => loc.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate Location', 'This location has already been added.');
      return;
    }
    const matchedAdmin = regionalHubs.find(
      (h) => h.name.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (matchedAdmin) {
      if (!selectedHubIds.includes(matchedAdmin.id)) {
        setSelectedHubIds([...selectedHubIds, matchedAdmin.id]);
      }
      setManualInput('');
      Alert.alert(
        'Configured Hub Selected',
        `"${matchedAdmin.name}" is an active regional hub and has been added to your selected hubs.`
      );
      return;
    }

    setManualLocations([...manualLocations, trimmed]);
    setManualInput('');
  };

  const removeManualLocation = (indexToRemove: number) => {
    setManualLocations(manualLocations.filter((_, idx) => idx !== indexToRemove));
  };

  const removeSelectedHub = (hubId: string) => {
    setSelectedHubIds(selectedHubIds.filter((id) => id !== hubId));
  };

  const togglePermit = (permit: string) => {
    if (selectedPermits.includes(permit)) {
      setSelectedPermits(selectedPermits.filter((p) => p !== permit));
    } else {
      setSelectedPermits([...selectedPermits, permit]);
    }
  };

  const filteredHubs = regionalHubs.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      (h.city && h.city.toLowerCase().includes(q)) ||
      h.state.toLowerCase().includes(q) ||
      (h.region && h.region.toLowerCase().includes(q))
    );
  });

  const handleContinue = async () => {
    if (selectedHubIds.length === 0 && manualLocations.length === 0) {
      Alert.alert(
        'Required Selection',
        'Please select at least one active regional hub or add a coverage location.'
      );
      return;
    }
    if (selectedPermits.length === 0) {
      Alert.alert('Required Selection', 'Please select at least one commercial permit type.');
      return;
    }

    // Save selected hub IDs and manual locations separately
    await vendorService.saveDraftForm({
      operatingHubs: selectedHubIds,
      manualOperatingLocations: manualLocations,
      interstatePermits: selectedPermits,
    });

    onNext({
      operatingHubs: selectedHubIds,
      manualOperatingLocations: manualLocations,
      interstatePermits: selectedPermits,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Header Bar */}
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
            stepIndex={4}
            totalSteps={7}
            incompleteStepsCount={incompleteStepsCount}
            currentIncompleteStepNumber={currentIncompleteStepNumber}
            missingFields={missingFields}
            onToggleViewAllSteps={onToggleViewAllSteps}
          />
        )}

        {/* Stepper Progress */}
        <View style={styles.stepperWrap}>
          <View style={styles.stepperHeader}>
            <Text style={styles.stepBadge}>STEP 4 OF 7</Text>
            <Text style={styles.stepTitle}>Route Coverage & Regional Hubs</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '56%' }]} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Route <Text style={styles.goldText}>Coverage</Text>
            </Text>
            <Text style={styles.subText}>
              Select the active regional logistics hubs and transit lanes where your fleet operates.
            </Text>
          </View>

          {/* Active Regional Hubs Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ACTIVE REGIONAL HUBS *</Text>
            </View>

            {/* Dropdown Selector Button */}
            <TouchableOpacity
              style={[styles.dropdownTrigger, isDropdownOpen && styles.dropdownTriggerOpen]}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              activeOpacity={0.85}
            >
              <View style={styles.dropdownTriggerLeft}>
                <MapPin size={16} color={selectedHubIds.length > 0 ? '#F05A22' : '#94A3B8'} />
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    selectedHubIds.length > 0 && styles.dropdownTriggerTextActive,
                  ]}
                >
                  {selectedHubIds.length === 0
                    ? 'Select Regional Hubs from Network...'
                    : `${selectedHubIds.length} Regional Hub(s) Selected`}
                </Text>
              </View>
              {isDropdownOpen ? (
                <ChevronUp size={18} color="#F05A22" />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {/* Searchable Multi-Select Dropdown Menu */}
            {isDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {/* Search Input Bar */}
                <View style={styles.searchBarWrap}>
                  <Search size={16} color="#94A3B8" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search active regional hubs by name, city, or state..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                    autoFocus={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Select All India Active Hubs Action */}
                <TouchableOpacity
                  style={[styles.selectAllBtn, isAllIndiaSelected && styles.selectAllBtnActive]}
                  onPress={toggleSelectAllIndia}
                  activeOpacity={0.8}
                >
                  <Globe2 size={16} color={isAllIndiaSelected ? '#FFFFFF' : '#F05A22'} />
                  <Text style={[styles.selectAllText, isAllIndiaSelected && styles.selectAllTextActive]}>
                    {isAllIndiaSelected
                      ? 'All India Active Regional Hubs Selected (Deselect)'
                      : 'Select All India Active Regional Hubs'}
                  </Text>
                  <View style={[styles.checkbox, isAllIndiaSelected && styles.checkboxActive]}>
                    {isAllIndiaSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Hubs Multi-select Scrollable List */}
                <ScrollView
                  style={styles.dropdownScrollList}
                  nestedScrollEnabled={true}
                  bounces={false}
                >
                  {loadingHubs ? (
                    <View style={styles.emptySearchWrap}>
                      <ActivityIndicator size="small" color="#F05A22" />
                      <Text style={styles.emptySearchText}>Loading active regional hubs...</Text>
                    </View>
                  ) : filteredHubs.length === 0 ? (
                    <View style={styles.emptySearchWrap}>
                      <Text style={styles.emptySearchText}>
                        No configured active hub matching "{searchQuery}"
                      </Text>
                      <TouchableOpacity
                        style={styles.inlineAddBtn}
                        onPress={() => {
                          setNewHubName(searchQuery);
                          setShowAddHubModal(true);
                        }}
                      >
                        <Plus size={14} color="#F05A22" />
                        <Text style={styles.inlineAddBtnText}>Add "{searchQuery}" as Missing Hub</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    filteredHubs.map((h) => {
                      const isSelected = selectedHubIds.includes(h.id);
                      return (
                        <TouchableOpacity
                          key={h.id}
                          style={[styles.hubPill, isSelected && styles.hubPillActive]}
                          onPress={() => toggleHub(h.id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                            {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                          <View style={styles.hubDetailsCol}>
                            <Text style={[styles.hubPillText, isSelected && styles.hubPillTextActive]}>
                              {h.name}
                            </Text>
                            <Text style={styles.hubSubText}>
                              {h.city ? `${h.city}, ` : ''}{h.state} • {h.region || 'National'}
                            </Text>
                          </View>
                          {h.isCustom && (
                            <View style={styles.customBadge}>
                              <Text style={styles.customBadgeText}>Custom</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {/* Dropdown Footer Actions */}
                <View style={styles.dropdownFooter}>
                  <TouchableOpacity
                    style={styles.addMissingHubBtn}
                    onPress={() => setShowAddHubModal(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color="#F05A22" strokeWidth={2.5} />
                    <Text style={styles.addMissingHubBtnText}>+ Add Missing Hub (Name, City, State)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeDropdownBtn}
                    onPress={() => setIsDropdownOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.closeDropdownBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Selected Active Hubs Display as Removable Chips */}
            {selectedHubIds.length > 0 && (
              <View style={styles.chipsSection}>
                <Text style={styles.chipsSectionLabel}>
                  Selected Active Hubs ({selectedHubIds.length}):
                </Text>
                <View style={styles.chipsContainer}>
                  {selectedHubIds.map((id) => {
                    const hub = regionalHubs.find((h) => h.id === id);
                    const label = hub
                      ? `${hub.name.split(' (')[0]} (${hub.state})`
                      : id;
                    return (
                      <View key={id} style={styles.selectedChip}>
                        <Text style={styles.selectedChipText}>{label}</Text>
                        <TouchableOpacity
                          onPress={() => removeSelectedHub(id)}
                          style={styles.chipRemoveBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel={`Remove ${label}`}
                        >
                          <X size={12} color="#9A3412" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Missing Regional Hub Action Button (outside dropdown) */}
            <TouchableOpacity
              style={styles.manualHubTriggerBtn}
              onPress={() => setShowAddHubModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={14} color="#F05A22" strokeWidth={2} />
              <Text style={styles.manualHubTriggerText}>
                Hub not in list? Add Missing Regional Hub (Name, City, State)
              </Text>
            </TouchableOpacity>

            {/* Other / Custom Hub Option */}
            <View style={styles.otherDivider} />
            <TouchableOpacity
              style={styles.otherToggleBtn}
              onPress={() => setShowOtherInput(!showOtherInput)}
              activeOpacity={0.8}
            >
              <Text style={styles.otherToggleText}>
                {showOtherInput
                  ? '− Hide Manual Location Entry'
                  : '+ Required hub unavailable? Enter Other Location'}
              </Text>
            </TouchableOpacity>

            {showOtherInput && (
              <View style={styles.otherInputCard}>
                <Text style={styles.otherInputDesc}>
                  Enter custom terminal, yard, or regional transit lane not listed above:
                </Text>
                <View style={styles.otherInputRow}>
                  <TextInput
                    style={styles.manualTextInput}
                    placeholder="e.g. Bongaigaon Industrial Yard"
                    placeholderTextColor="#94A3B8"
                    value={manualInput}
                    onChangeText={setManualInput}
                  />
                  <TouchableOpacity
                    style={styles.addManualBtn}
                    onPress={handleAddManualLocation}
                    activeOpacity={0.85}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.addManualBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Manually Entered Locations Chips Display */}
            {manualLocations.length > 0 && (
              <View style={styles.manualChipsSection}>
                <Text style={styles.manualChipsLabel}>
                  Manually Added Locations ({manualLocations.length}):
                </Text>
                <View style={styles.chipsContainer}>
                  {manualLocations.map((loc, idx) => (
                    <View key={`${loc}-${idx}`} style={styles.manualChip}>
                      <Text style={styles.manualChipBadge}>Custom</Text>
                      <Text style={styles.manualChipText}>{loc}</Text>
                      <TouchableOpacity
                        onPress={() => removeManualLocation(idx)}
                        style={styles.chipRemoveBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={12} color="#1E3A8A" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Interstate Route Permits */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Shield size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>COMMERCIAL ROUTE PERMITS *</Text>
            </View>

            <View style={styles.permitList}>
              {COMMERCIAL_PERMITS.map((p) => {
                const isSelected = selectedPermits.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.permitRow, isSelected && styles.permitRowActive]}
                    onPress={() => togglePermit(p)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.permitText, isSelected && styles.permitTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Navigation Button */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Continue to Fleet Profile</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Missing Regional Hub Modal */}
      <Modal
        visible={showAddHubModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddHubModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Building size={18} color="#F05A22" />
                <Text style={styles.modalTitle}>Add Missing Regional Hub</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddHubModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter hub details below. It will be saved directly to the TRUCKS database, automatically selected, and persisted in your registration.
            </Text>

            <View style={styles.modalForm}>
              {/* Hub Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REGIONAL HUB / TERMINAL NAME *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Bongaigaon Inland Terminal"
                  placeholderTextColor="#94A3B8"
                  value={newHubName}
                  onChangeText={setNewHubName}
                />
              </View>

              {/* City */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CITY *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Bongaigaon"
                  placeholderTextColor="#94A3B8"
                  value={newHubCity}
                  onChangeText={setNewHubCity}
                />
              </View>

              {/* State */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>STATE *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Assam"
                  placeholderTextColor="#94A3B8"
                  value={newHubState}
                  onChangeText={setNewHubState}
                />
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddHubModal(false)}
                disabled={savingHub}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingHub && styles.modalSaveBtnDisabled]}
                onPress={handleSaveNewHub}
                disabled={savingHub}
              >
                {savingHub ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.modalSaveBtnText}>Save & Select Hub</Text>
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
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  stepperWrap: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepBadge: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F05A22',
  },
  contentWrap: {
    paddingHorizontal: 20,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Dropdown Trigger Styling
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dropdownTriggerOpen: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  dropdownTriggerTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },

  // Dropdown Menu Container
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  dropdownScrollList: {
    maxHeight: 240,
    marginVertical: 6,
  },
  dropdownFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  addMissingHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMissingHubBtnText: {
    fontSize: 11,
    color: '#F05A22',
    fontWeight: '700',
  },
  closeDropdownBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeDropdownBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },

  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  selectAllBtnActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  selectAllText: {
    flex: 1,
    marginHorizontal: 10,
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
  },
  selectAllTextActive: {
    color: '#FFFFFF',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#172B4D',
  },
  emptySearchWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptySearchText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  inlineAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F05A22',
  },
  hubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 6,
  },
  hubPillActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  hubDetailsCol: {
    flex: 1,
  },
  hubPillText: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
  },
  hubPillTextActive: {
    color: '#9A3412',
    fontWeight: '700',
  },
  hubSubText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  customBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },

  // Removable Chips Styling
  chipsSection: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  chipsSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  chipRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(240, 90, 34, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Manual Hub Trigger Outside Dropdown
  manualHubTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 6,
  },
  manualHubTriggerText: {
    fontSize: 12,
    color: '#F05A22',
    fontWeight: '600',
  },

  // Other / Manual Location Section
  otherDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 12,
    marginBottom: 8,
  },
  otherToggleBtn: {
    paddingVertical: 6,
  },
  otherToggleText: {
    fontSize: 12,
    color: '#F05A22',
    fontWeight: '700',
  },
  otherInputCard: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  otherInputDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  otherInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  manualTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  addManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F05A22',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    gap: 4,
  },
  addManualBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  manualChipsSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  manualChipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  manualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },
  manualChipBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  manualChipText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
  },

  // Route Permits Section
  permitList: {
    gap: 8,
  },
  permitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  permitRowActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  permitText: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  permitTextActive: {
    color: '#9A3412',
    fontWeight: '700',
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 16,
  },
  modalForm: {
    gap: 12,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
  },
  modalInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F05A22',
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
