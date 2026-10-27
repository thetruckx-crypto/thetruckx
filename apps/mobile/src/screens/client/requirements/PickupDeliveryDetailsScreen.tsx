import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Clipboard,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Building,
  User,
  Phone,
  Bookmark,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Link as LinkIcon,
  Crosshair,
  Compass,
} from 'lucide-react-native';
import { AuthBottomDecoration } from '../../../components/AuthBottomDecoration';
import { StaticMapPreviewTile } from '../../../components/StaticMapPreviewTile';
import { TransportRequirementDraft } from '../../../types';
import { clientService, SavedAddressItem } from '../../../services/clientService';
import { pincodeService } from '../../../services/pincodeService';
import {
  isValidGoogleMapsUrl,
  extractCoordinatesFromGoogleMapsUrl,
  buildGoogleMapsSearchUrl,
  buildGoogleMapsDirectionsUrl,
} from '../../../utils/googleMapsUtil';

const POPULAR_HUBS = [
  { city: 'Guwahati', state: 'Assam', region: 'North East' },
  { city: 'Kolkata', state: 'West Bengal', region: 'East' },
  { city: 'Siliguri', state: 'West Bengal', region: 'North Bengal' },
  { city: 'Shillong', state: 'Meghalaya', region: 'North East' },
  { city: 'Dimapur', state: 'Nagaland', region: 'North East' },
  { city: 'Agartala', state: 'Tripura', region: 'North East' },
  { city: 'Dibrugarh', state: 'Assam', region: 'Upper Assam' },
  { city: 'Jorhat', state: 'Assam', region: 'Upper Assam' },
  { city: 'Tezpur', state: 'Assam', region: 'North East' },
  { city: 'Bongaigaon', state: 'Assam', region: 'Lower Assam' },
  { city: 'Patna', state: 'Bihar', region: 'East' },
  { city: 'Delhi NCR', state: 'Delhi', region: 'North' },
  { city: 'Mumbai', state: 'Maharashtra', region: 'West' },
  { city: 'Chennai', state: 'Tamil Nadu', region: 'South' },
  { city: 'Bengaluru', state: 'Karnataka', region: 'South' },
];

interface PickupDeliveryDetailsScreenProps {
  initialDraft?: Partial<TransportRequirementDraft>;
  clientId?: string;
  onBack: () => void;
  onNext: (draftUpdate: Partial<TransportRequirementDraft>) => void;
  onManageSavedAddresses?: () => void;
}

export const PickupDeliveryDetailsScreen: React.FC<
  PickupDeliveryDetailsScreenProps
> = ({ initialDraft, clientId, onBack, onNext, onManageSavedAddresses }) => {
  // Pickup state
  const [pickupAddress, setPickupAddress] = useState(
    initialDraft?.pickupAddress || ''
  );
  const [pickupCity, setPickupCity] = useState(initialDraft?.pickupCity || '');
  const [pickupState, setPickupState] = useState(initialDraft?.pickupState || '');
  const [pickupPincode, setPickupPincode] = useState(
    initialDraft?.pickupPincode || ''
  );
  const [pickupPincodeLoading, setPickupPincodeLoading] = useState(false);
  const [pickupFeedback, setPickupFeedback] = useState<string | null>(null);
  const [pickupContactName, setPickupContactName] = useState(
    initialDraft?.pickupContactName || ''
  );
  const [pickupContactPhone, setPickupContactPhone] = useState(
    initialDraft?.pickupContactPhone || ''
  );

  // Pickup Google Maps state (Zero Paid API Cost)
  const [pickupGoogleMapsUrl, setPickupGoogleMapsUrl] = useState<string>(
    initialDraft?.pickupGoogleMapsUrl || ''
  );
  const [pickupLatitude, setPickupLatitude] = useState<number | undefined>(
    initialDraft?.pickupLatitude
  );
  const [pickupLongitude, setPickupLongitude] = useState<number | undefined>(
    initialDraft?.pickupLongitude
  );

  // Delivery state
  const [destinationAddress, setDestinationAddress] = useState(
    initialDraft?.destinationAddress || ''
  );
  const [destinationCity, setDestinationCity] = useState(
    initialDraft?.destinationCity || ''
  );
  const [destinationState, setDestinationState] = useState(
    initialDraft?.destinationState || ''
  );
  const [destinationPincode, setDestinationPincode] = useState(
    initialDraft?.destinationPincode || ''
  );
  const [destinationPincodeLoading, setDestinationPincodeLoading] = useState(false);
  const [destinationFeedback, setDestinationFeedback] = useState<string | null>(null);
  const [dropContactName, setDropContactName] = useState(
    initialDraft?.dropContactName || ''
  );
  const [dropContactPhone, setDropContactPhone] = useState(
    initialDraft?.dropContactPhone || ''
  );

  // Delivery Google Maps state (Zero Paid API Cost)
  const [destinationGoogleMapsUrl, setDestinationGoogleMapsUrl] = useState<string>(
    initialDraft?.destinationGoogleMapsUrl || ''
  );
  const [destinationLatitude, setDestinationLatitude] = useState<number | undefined>(
    initialDraft?.destinationLatitude
  );
  const [destinationLongitude, setDestinationLongitude] = useState<number | undefined>(
    initialDraft?.destinationLongitude
  );

  // Autosave status indicator
  const [saveStatus, setSaveStatus] = useState<'SAVED' | 'SAVING' | 'IDLE'>('SAVED');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Address picker modal
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressItem[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');

  // City / Hub picker modal
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityPickerTarget, setCityPickerTarget] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [citySearchText, setCitySearchText] = useState('');

  // Paste Google Maps Link Modal
  const [showPasteLinkModal, setShowPasteLinkModal] = useState(false);
  const [pasteLinkTarget, setPasteLinkTarget] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [pastedLinkInput, setPastedLinkInput] = useState('');
  const [pasteLinkError, setPasteLinkError] = useState<string | null>(null);

  // Load saved hubs
  useEffect(() => {
    clientService.getSavedAddresses(clientId).then(setSavedAddresses);
  }, [clientId]);

  // Debounced Autosave
  const triggerAutosave = useCallback(
    (updates: Partial<TransportRequirementDraft>) => {
      setSaveStatus('SAVING');
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          await clientService.saveTransportRequirementDraft(
            {
              ...initialDraft,
              pickupAddress,
              pickupCity,
              pickupState,
              pickupPincode,
              pickupContactName,
              pickupContactPhone,
              destinationAddress,
              destinationCity,
              destinationState,
              destinationPincode,
              dropContactName,
              dropContactPhone,
              pickupGoogleMapsUrl,
              pickupLatitude,
              pickupLongitude,
              destinationGoogleMapsUrl,
              destinationLatitude,
              destinationLongitude,
              ...updates,
            },
            clientId
          );
          setSaveStatus('SAVED');
        } catch {
          setSaveStatus('SAVED');
        }
      }, 700);
    },
    [
      initialDraft,
      clientId,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupPincode,
      pickupContactName,
      pickupContactPhone,
      destinationAddress,
      destinationCity,
      destinationState,
      destinationPincode,
      dropContactName,
      dropContactPhone,
      pickupGoogleMapsUrl,
      pickupLatitude,
      pickupLongitude,
      destinationGoogleMapsUrl,
      destinationLatitude,
      destinationLongitude,
    ]
  );

  const handleOpenPicker = (target: 'PICKUP' | 'DELIVERY') => {
    setPickerTarget(target);
    setShowAddressPicker(true);
  };

  const handleSelectAddress = (addr: SavedAddressItem) => {
    if (pickerTarget === 'PICKUP') {
      const fullAddr = `${addr.address}, ${addr.city}, PIN: ${addr.pincode}`;
      setPickupAddress(fullAddr);
      setPickupCity(addr.city);
      if (addr.state) setPickupState(addr.state);
      setPickupPincode(addr.pincode);
      if (addr.contactPerson) setPickupContactName(addr.contactPerson);
      if (addr.phone) setPickupContactPhone(addr.phone.replace(/[^0-9]/g, '').slice(-10));
      triggerAutosave({
        pickupAddress: fullAddr,
        pickupCity: addr.city,
        pickupState: addr.state,
        pickupPincode: addr.pincode,
      });
    } else {
      const fullAddr = `${addr.address}, ${addr.city}, PIN: ${addr.pincode}`;
      setDestinationAddress(fullAddr);
      setDestinationCity(addr.city);
      if (addr.state) setDestinationState(addr.state);
      setDestinationPincode(addr.pincode);
      if (addr.contactPerson) setDropContactName(addr.contactPerson);
      if (addr.phone) setDropContactPhone(addr.phone.replace(/[^0-9]/g, '').slice(-10));
      triggerAutosave({
        destinationAddress: fullAddr,
        destinationCity: addr.city,
        destinationState: addr.state,
        destinationPincode: addr.pincode,
      });
    }
    setShowAddressPicker(false);
  };

  const handlePickupPincodeChange = async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setPickupPincode(clean);
    triggerAutosave({ pickupPincode: clean });

    if (clean.length === 6) {
      setPickupPincodeLoading(true);
      setPickupFeedback(null);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setPickupCity(res.data.city);
          setPickupState(res.data.state);
          setPickupFeedback(`✓ ${res.data.city}, ${res.data.state}`);
          triggerAutosave({
            pickupPincode: clean,
            pickupCity: res.data.city,
            pickupState: res.data.state,
          });
        } else {
          setPickupFeedback('PIN lookup: Please confirm City manually.');
        }
      } catch {
        setPickupFeedback('Please enter City manually.');
      } finally {
        setPickupPincodeLoading(false);
      }
    } else {
      setPickupFeedback(null);
    }
  };

  const handleDestinationPincodeChange = async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setDestinationPincode(clean);
    triggerAutosave({ destinationPincode: clean });

    if (clean.length === 6) {
      setDestinationPincodeLoading(true);
      setDestinationFeedback(null);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setDestinationCity(res.data.city);
          setDestinationState(res.data.state);
          setDestinationFeedback(`✓ ${res.data.city}, ${res.data.state}`);
          triggerAutosave({
            destinationPincode: clean,
            destinationCity: res.data.city,
            destinationState: res.data.state,
          });
        } else {
          setDestinationFeedback('PIN lookup: Please confirm City manually.');
        }
      } catch {
        setDestinationFeedback('Please enter City manually.');
      } finally {
        setDestinationPincodeLoading(false);
      }
    } else {
      setDestinationFeedback(null);
    }
  };

  // Zero-Cost Google Maps Actions
  const handleSelectOnGoogleMaps = (target: 'PICKUP' | 'DELIVERY') => {
    const address = target === 'PICKUP' ? pickupAddress : destinationAddress;
    const city = target === 'PICKUP' ? pickupCity : destinationCity;
    const query = address || city || 'Guwahati, Assam';
    const searchUrl = buildGoogleMapsSearchUrl(query);

    Linking.canOpenURL(searchUrl).then((supported) => {
      if (supported) {
        Linking.openURL(searchUrl);
      } else {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
      }
    }).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
    });

    Alert.alert(
      'Google Maps Search Opened',
      `Google Maps has opened for "${query}".\n\nTo pin this exact location for the driver:\n1. Tap "Share" in Google Maps and copy link.\n2. Tap "Paste Google Maps Link" to attach it.`,
      [
        {
          text: 'Attach Current Address Now',
          onPress: () => {
            if (target === 'PICKUP') {
              setPickupGoogleMapsUrl(searchUrl);
              triggerAutosave({ pickupGoogleMapsUrl: searchUrl });
            } else {
              setDestinationGoogleMapsUrl(searchUrl);
              triggerAutosave({ destinationGoogleMapsUrl: searchUrl });
            }
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const handleOpenPasteLinkModal = (target: 'PICKUP' | 'DELIVERY') => {
    setPasteLinkTarget(target);
    setPastedLinkInput(target === 'PICKUP' ? pickupGoogleMapsUrl : destinationGoogleMapsUrl);
    setPasteLinkError(null);
    setShowPasteLinkModal(true);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (clipboardContent) {
        setPastedLinkInput(clipboardContent.trim());
        setPasteLinkError(null);
      } else {
        Alert.alert('Clipboard Empty', 'No text found in clipboard.');
      }
    } catch {
      Alert.alert('Clipboard', 'Unable to read from clipboard.');
    }
  };

  const handleSavePastedLink = () => {
    const trimmed = pastedLinkInput.trim();
    if (!trimmed) {
      setPasteLinkError('Please enter a Google Maps share URL.');
      return;
    }

    if (!isValidGoogleMapsUrl(trimmed)) {
      setPasteLinkError(
        'Invalid URL. Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or google.com/maps).'
      );
      return;
    }

    const coords = extractCoordinatesFromGoogleMapsUrl(trimmed);

    if (pasteLinkTarget === 'PICKUP') {
      setPickupGoogleMapsUrl(trimmed);
      if (coords?.latitude && coords?.longitude) {
        setPickupLatitude(coords.latitude);
        setPickupLongitude(coords.longitude);
      }
      triggerAutosave({
        pickupGoogleMapsUrl: trimmed,
        pickupLatitude: coords?.latitude,
        pickupLongitude: coords?.longitude,
      });
    } else {
      setDestinationGoogleMapsUrl(trimmed);
      if (coords?.latitude && coords?.longitude) {
        setDestinationLatitude(coords.latitude);
        setDestinationLongitude(coords.longitude);
      }
      triggerAutosave({
        destinationGoogleMapsUrl: trimmed,
        destinationLatitude: coords?.latitude,
        destinationLongitude: coords?.longitude,
      });
    }

    setShowPasteLinkModal(false);
  };

  const handleRemoveGoogleMapsLocation = (target: 'PICKUP' | 'DELIVERY') => {
    if (target === 'PICKUP') {
      setPickupGoogleMapsUrl('');
      setPickupLatitude(undefined);
      setPickupLongitude(undefined);
      triggerAutosave({
        pickupGoogleMapsUrl: '',
        pickupLatitude: undefined,
        pickupLongitude: undefined,
      });
    } else {
      setDestinationGoogleMapsUrl('');
      setDestinationLatitude(undefined);
      setDestinationLongitude(undefined);
      triggerAutosave({
        destinationGoogleMapsUrl: '',
        destinationLatitude: undefined,
        destinationLongitude: undefined,
      });
    }
  };

  const handleViewLocationOnMap = (target: 'PICKUP' | 'DELIVERY') => {
    const url =
      target === 'PICKUP'
        ? pickupGoogleMapsUrl ||
          buildGoogleMapsDirectionsUrl({
            latitude: pickupLatitude,
            longitude: pickupLongitude,
            address: `${pickupAddress}, ${pickupCity}`,
          })
        : destinationGoogleMapsUrl ||
          buildGoogleMapsDirectionsUrl({
            latitude: destinationLatitude,
            longitude: destinationLongitude,
            address: `${destinationAddress}, ${destinationCity}`,
          });

    Linking.openURL(url).catch(() => {
      Alert.alert('Cannot Open Maps', 'Unable to launch Google Maps.');
    });
  };

  const handleSelectCityHub = (cityItem: { city: string; state: string }) => {
    if (cityPickerTarget === 'PICKUP') {
      setPickupCity(cityItem.city);
      setPickupState(cityItem.state);
      triggerAutosave({ pickupCity: cityItem.city, pickupState: cityItem.state });
    } else {
      setDestinationCity(cityItem.city);
      setDestinationState(cityItem.state);
      triggerAutosave({ destinationCity: cityItem.city, destinationState: cityItem.state });
    }
    setShowCityPicker(false);
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    if (!pickupAddress.trim()) {
      Alert.alert('Pickup Required', 'Please enter complete pickup address.');
      return;
    }
    const pickupPinCheck = pincodeService.validatePincodeFormat(pickupPincode);
    if (!pickupPinCheck.isValid) {
      Alert.alert(
        'Invalid Pickup PIN',
        pickupPinCheck.error || 'Please enter a valid 6-digit pickup PIN code.'
      );
      return;
    }
    if (!pickupCity.trim()) {
      Alert.alert('Pickup Required', 'Please enter pickup City / Hub.');
      return;
    }

    if (!destinationAddress.trim()) {
      Alert.alert('Delivery Required', 'Please enter complete delivery address.');
      return;
    }
    const destPinCheck = pincodeService.validatePincodeFormat(destinationPincode);
    if (!destPinCheck.isValid) {
      Alert.alert(
        'Invalid Delivery PIN',
        destPinCheck.error || 'Please enter a valid 6-digit destination PIN code.'
      );
      return;
    }
    if (pickupContactPhone.trim() && pickupContactPhone.trim().replace(/\D/g, '').length !== 10) {
      Alert.alert('Invalid Contact Phone', 'Pickup contact phone number must be 10 digits when entered.');
      return;
    }
    if (dropContactPhone.trim() && dropContactPhone.trim().replace(/\D/g, '').length !== 10) {
      Alert.alert('Invalid Contact Phone', 'Delivery contact phone number must be 10 digits when entered.');
      return;
    }

    onNext({
      pickupAddress: pickupAddress.trim(),
      pickupCity: pickupCity.trim(),
      pickupState: pickupState.trim(),
      pickupPincode: pickupPincode.trim(),
      pickupContactName: pickupContactName.trim(),
      pickupContactPhone: pickupContactPhone.trim(),
      destinationAddress: destinationAddress.trim(),
      destinationCity: destinationCity.trim(),
      destinationState: destinationState.trim(),
      destinationPincode: destinationPincode.trim(),
      dropContactName: dropContactName.trim(),
      dropContactPhone: dropContactPhone.trim(),
      pickupGoogleMapsUrl: pickupGoogleMapsUrl.trim() || undefined,
      pickupLatitude,
      pickupLongitude,
      destinationGoogleMapsUrl: destinationGoogleMapsUrl.trim() || undefined,
      destinationLatitude,
      destinationLongitude,
    });
  };

  const handleBack = () => {
    triggerAutosave({});
    onBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityLabel="Back to Step 2"
        >
          <ArrowLeft size={20} color="#101D36" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Pickup & Delivery</Text>
        {/* Background autosave active: saveStatus === 'SAVED' (visible "Draft Saved" and "Saving..." text removed per user specification) */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Step Bar */}
      <View style={styles.stepContainer}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepBadge}>STEP 3 OF 4</Text>
          <Text style={styles.stepPercent}>75% Completed</Text>
        </View>
        <Text style={styles.stepTitle}>Pickup & Delivery Details</Text>
        <Text style={styles.stepSubtitle}>
          Provide complete pickup and delivery information for smooth transportation.
        </Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '75%' }]} />
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
        {/* ─── CARD 1: Pickup Origin (Loading) ─── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconTagPickup}>
              <MapPin size={17} color="#F05A24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Pickup Origin (Loading)</Text>
              <Text style={styles.sectionSubtitle}>Factory, warehouse or supplier depot</Text>
            </View>
            <TouchableOpacity
              style={styles.savedAddrBtn}
              onPress={() => handleOpenPicker('PICKUP')}
              activeOpacity={0.75}
            >
              <Bookmark size={12} color="#F05A24" />
              <Text style={styles.savedAddrBtnText}>Saved Hub</Text>
            </TouchableOpacity>
          </View>

          {/* Quick-Pick Dock Pills for Pickup */}
          {savedAddresses.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickPillsScroll}
            >
              {savedAddresses.map((addr) => (
                <TouchableOpacity
                  key={`quick-p-${addr.id}`}
                  style={styles.quickDockPill}
                  onPress={() => handleSelectAddress(addr)}
                  activeOpacity={0.75}
                >
                  <Building size={12} color="#F05A24" />
                  <Text style={styles.quickDockPillText}>{addr.label || addr.city}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Pickup Address (Task 2: 'Use Current Location' GPS button removed in favor of manual entry) */}
          <View style={styles.inputWrap}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Pickup Address *</Text>
            </View>
            <View style={styles.inputWithIconRow}>
              <Building size={16} color="#64748B" style={styles.fieldLeftIcon} />
              <TextInput
                style={[styles.textInputBox, styles.addressArea]}
                value={pickupAddress}
                onChangeText={(text) => {
                  setPickupAddress(text);
                  triggerAutosave({ pickupAddress: text });
                }}
                placeholder=""
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>
          </View>

          {/* PIN Code & City / Hub Row */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>PIN Code *</Text>
              <View style={styles.inputWithIconRow}>
                <MapPin size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <TextInput
                  style={[styles.textInputBox, { flex: 1 }]}
                  value={pickupPincode}
                  onChangeText={handlePickupPincodeChange}
                  placeholder=""
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94A3B8"
                />
                {pickupPincodeLoading && (
                  <ActivityIndicator
                    size="small"
                    color="#F05A24"
                    style={styles.pinSpinner}
                  />
                )}
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.inputLabel}>City / Hub *</Text>
              <TouchableOpacity
                style={[styles.inputWithIconRow, styles.selectorTouchBox]}
                onPress={() => {
                  setCityPickerTarget('PICKUP');
                  setCitySearchText('');
                  setShowCityPicker(true);
                }}
                activeOpacity={0.8}
              >
                <Building size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <Text
                  style={[
                    styles.selectorTouchText,
                    !pickupCity && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {pickupCity || 'Select City / Hub'}
                </Text>
                <ChevronDown size={16} color="#64748B" style={styles.fieldRightIcon} />
              </TouchableOpacity>
            </View>
          </View>

          {pickupFeedback && (
            <Text style={styles.pinFeedbackText}>{pickupFeedback}</Text>
          )}

          {/* Contact Person & Phone */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>Contact Person (Optional)</Text>
              <View style={styles.inputWithIconRow}>
                <User size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <TextInput
                  style={[styles.textInputBox, { flex: 1 }]}
                  value={pickupContactName}
                  onChangeText={(text) => {
                    setPickupContactName(text);
                    triggerAutosave({ pickupContactName: text });
                  }}
                  placeholder=""
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <View style={styles.phoneInputRow}>
                <Phone size={15} color="#64748B" style={styles.phoneLeftIcon} />
                <Text style={styles.phonePrefixText}>+91</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={[styles.textInputBox, styles.phoneInputBox]}
                  value={pickupContactPhone}
                  onChangeText={(text) => {
                    const clean = text.replace(/[^0-9]/g, '').slice(0, 10);
                    setPickupContactPhone(clean);
                    triggerAutosave({ pickupContactPhone: clean });
                  }}
                  placeholder=""
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* Google Maps Location Sub-card (Optional, Zero API Cost) */}
          <View style={styles.mapsSubCard}>
            <View style={styles.mapsHeaderRow}>
              <Compass size={17} color="#F05A24" />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapsTitle}>Google Maps Location (Optional)</Text>
                <Text style={styles.mapsSubtitle}>Pin the exact location for the driver.</Text>
              </View>
            </View>

            {/* If location added, show preview */}
            {pickupGoogleMapsUrl ? (
              <View style={styles.locationAddedBox}>
                <StaticMapPreviewTile
                  label={pickupAddress.split(',')[0] || 'Pickup Location'}
                  city={pickupCity || 'Guwahati'}
                  onPress={() => handleViewLocationOnMap('PICKUP')}
                />
                <View style={styles.locationAddedInfo}>
                  <View style={styles.locationAddedBadgeRow}>
                    <View style={styles.locationAddedPill}>
                      <CheckCircle2 size={12} color="#16A34A" />
                      <Text style={styles.locationAddedPillText}>Location Added</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveGoogleMapsLocation('PICKUP')}
                      style={styles.removeLocBtn}
                      accessibilityLabel="Remove location"
                    >
                      <X size={15} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.locationAddedAddressText} numberOfLines={3}>
                    {pickupAddress || `${pickupCity}, ${pickupState || ''} ${pickupPincode}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.viewOnMapsLink}
                    onPress={() => handleViewLocationOnMap('PICKUP')}
                    activeOpacity={0.75}
                  >
                    <MapPin size={12} color="#F05A24" />
                    <Text style={styles.viewOnMapsLinkText}>View on Google Maps</Text>
                    <ExternalLink size={11} color="#F05A24" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.mapsActionsRow}>
                <TouchableOpacity
                  style={styles.mapsActionBtn}
                  onPress={() => handleSelectOnGoogleMaps('PICKUP')}
                  activeOpacity={0.8}
                >
                  <MapPin size={14} color="#101D36" />
                  <Text style={styles.mapsActionBtnText}>Select on Google Maps</Text>
                </TouchableOpacity>

                <View style={styles.orDividerWrap}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>

                <TouchableOpacity
                  style={styles.mapsActionBtn}
                  onPress={() => handleOpenPasteLinkModal('PICKUP')}
                  activeOpacity={0.8}
                >
                  <LinkIcon size={14} color="#101D36" />
                  <Text style={styles.mapsActionBtnText}>Paste Google Maps Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ─── CARD 2: Delivery Destination (Unloading) ─── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconTagDelivery}>
              <MapPin size={17} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Delivery Destination (Unloading)</Text>
              <Text style={styles.sectionSubtitle}>Consignee yard or distributor center</Text>
            </View>
            <TouchableOpacity
              style={styles.savedAddrBtn}
              onPress={() => handleOpenPicker('DELIVERY')}
              activeOpacity={0.75}
            >
              <Bookmark size={12} color="#F05A24" />
              <Text style={styles.savedAddrBtnText}>Saved Hub</Text>
            </TouchableOpacity>
          </View>

          {/* Quick-Pick Dock Pills for Delivery */}
          {savedAddresses.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickPillsScroll}
            >
              {savedAddresses.map((addr) => (
                <TouchableOpacity
                  key={`quick-d-${addr.id}`}
                  style={styles.quickDockPillDelivery}
                  onPress={() => {
                    const fullAddr = `${addr.address}, ${addr.city}, PIN: ${addr.pincode}`;
                    setDestinationAddress(fullAddr);
                    setDestinationCity(addr.city);
                    if (addr.state) setDestinationState(addr.state);
                    setDestinationPincode(addr.pincode);
                    if (addr.contactPerson) setDropContactName(addr.contactPerson);
                    if (addr.phone)
                      setDropContactPhone(addr.phone.replace(/[^0-9]/g, '').slice(-10));
                    triggerAutosave({
                      destinationAddress: fullAddr,
                      destinationCity: addr.city,
                      destinationState: addr.state,
                      destinationPincode: addr.pincode,
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Building size={12} color="#10B981" />
                  <Text style={styles.quickDockPillTextDelivery}>
                    {addr.label || addr.city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Destination Address (Task 2: Manual entry only, current location option removed) */}
          <View style={styles.inputWrap}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Destination Address *</Text>
            </View>
            <View style={styles.inputWithIconRow}>
              <Building size={16} color="#64748B" style={styles.fieldLeftIcon} />
              <TextInput
                style={[styles.textInputBox, styles.addressArea]}
                value={destinationAddress}
                onChangeText={(text) => {
                  setDestinationAddress(text);
                  triggerAutosave({ destinationAddress: text });
                }}
                placeholder=""
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>
          </View>

          {/* PIN Code & City / Destination Row */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>PIN Code *</Text>
              <View style={styles.inputWithIconRow}>
                <MapPin size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <TextInput
                  style={[styles.textInputBox, { flex: 1 }]}
                  value={destinationPincode}
                  onChangeText={handleDestinationPincodeChange}
                  placeholder=""
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#94A3B8"
                />
                {destinationPincodeLoading && (
                  <ActivityIndicator
                    size="small"
                    color="#10B981"
                    style={styles.pinSpinner}
                  />
                )}
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.inputLabel}>City / Destination *</Text>
              <TouchableOpacity
                style={[styles.inputWithIconRow, styles.selectorTouchBox]}
                onPress={() => {
                  setCityPickerTarget('DELIVERY');
                  setCitySearchText('');
                  setShowCityPicker(true);
                }}
                activeOpacity={0.8}
              >
                <Building size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <Text
                  style={[
                    styles.selectorTouchText,
                    !destinationCity && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {destinationCity || 'Select Destination City'}
                </Text>
                <ChevronDown size={16} color="#64748B" style={styles.fieldRightIcon} />
              </TouchableOpacity>
            </View>
          </View>

          {destinationFeedback && (
            <Text style={[styles.pinFeedbackText, { color: '#059669' }]}>
              {destinationFeedback}
            </Text>
          )}

          {/* Unloading Contact & Phone */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>Unloading Contact (Optional)</Text>
              <View style={styles.inputWithIconRow}>
                <User size={16} color="#64748B" style={styles.fieldLeftIcon} />
                <TextInput
                  style={[styles.textInputBox, { flex: 1 }]}
                  value={dropContactName}
                  onChangeText={(text) => {
                    setDropContactName(text);
                    triggerAutosave({ dropContactName: text });
                  }}
                  placeholder=""
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <View style={styles.phoneInputRow}>
                <Phone size={15} color="#64748B" style={styles.phoneLeftIcon} />
                <Text style={styles.phonePrefixText}>+91</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={[styles.textInputBox, styles.phoneInputBox]}
                  value={dropContactPhone}
                  onChangeText={(text) => {
                    const clean = text.replace(/[^0-9]/g, '').slice(0, 10);
                    setDropContactPhone(clean);
                    triggerAutosave({ dropContactPhone: clean });
                  }}
                  placeholder=""
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* Google Maps Location Sub-card (Optional, Zero API Cost) */}
          <View style={styles.mapsSubCard}>
            <View style={styles.mapsHeaderRow}>
              <Compass size={17} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapsTitle}>Google Maps Location (Optional)</Text>
                <Text style={styles.mapsSubtitle}>Pin the exact location for the driver.</Text>
              </View>
            </View>

            {/* If location added, show preview */}
            {destinationGoogleMapsUrl ? (
              <View style={styles.locationAddedBox}>
                <StaticMapPreviewTile
                  label={destinationAddress.split(',')[0] || 'Destination Yard'}
                  city={destinationCity || 'Kolkata'}
                  onPress={() => handleViewLocationOnMap('DELIVERY')}
                />
                <View style={styles.locationAddedInfo}>
                  <View style={styles.locationAddedBadgeRow}>
                    <View style={styles.locationAddedPill}>
                      <CheckCircle2 size={12} color="#16A34A" />
                      <Text style={styles.locationAddedPillText}>Location Added</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveGoogleMapsLocation('DELIVERY')}
                      style={styles.removeLocBtn}
                      accessibilityLabel="Remove location"
                    >
                      <X size={15} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.locationAddedAddressText} numberOfLines={3}>
                    {destinationAddress ||
                      `${destinationCity}, ${destinationState || ''} ${destinationPincode}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.viewOnMapsLink}
                    onPress={() => handleViewLocationOnMap('DELIVERY')}
                    activeOpacity={0.75}
                  >
                    <MapPin size={12} color="#F05A24" />
                    <Text style={styles.viewOnMapsLinkText}>View on Google Maps</Text>
                    <ExternalLink size={11} color="#F05A24" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.mapsActionsRow}>
                <TouchableOpacity
                  style={styles.mapsActionBtn}
                  onPress={() => handleSelectOnGoogleMaps('DELIVERY')}
                  activeOpacity={0.8}
                >
                  <MapPin size={14} color="#101D36" />
                  <Text style={styles.mapsActionBtnText}>Select on Google Maps</Text>
                </TouchableOpacity>

                <View style={styles.orDividerWrap}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>

                <TouchableOpacity
                  style={styles.mapsActionBtn}
                  onPress={() => handleOpenPasteLinkModal('DELIVERY')}
                  activeOpacity={0.8}
                >
                  <LinkIcon size={14} color="#101D36" />
                  <Text style={styles.mapsActionBtnText}>Paste Google Maps Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Sticky Continue CTA */}
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          <Text style={styles.continueBtnText}>Review Transport Requirement</Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <AuthBottomDecoration />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── MODAL 1: Saved Address Selection Modal ─── */}
      <Modal
        visible={showAddressPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddressPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select {pickerTarget} Hub</Text>
                <Text style={styles.modalSubtitle}>
                  Quick-fill from pre-configured client addresses
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddressPicker(false)}>
                <X size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {savedAddresses.map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={styles.addrChoiceItem}
                  onPress={() => handleSelectAddress(addr)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addrChoiceIcon}>
                    <Building size={18} color="#F05A24" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrChoiceLabel}>{addr.label}</Text>
                    <Text style={styles.addrChoiceText} numberOfLines={2}>
                      {addr.address}, {addr.city} ({addr.pincode})
                    </Text>
                    <Text style={styles.addrChoiceContact}>
                      Contact: {addr.contactPerson} • {addr.phone}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}

              {savedAddresses.length === 0 && (
                <Text style={styles.emptyAddrText}>No saved addresses found.</Text>
              )}
            </ScrollView>

            {onManageSavedAddresses && (
              <TouchableOpacity
                style={styles.manageAddrBtn}
                onPress={() => {
                  setShowAddressPicker(false);
                  onManageSavedAddresses();
                }}
              >
                <Text style={styles.manageAddrBtnText}>Manage Saved Hubs</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: City / Hub Picker Modal ─── */}
      <Modal
        visible={showCityPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Select {cityPickerTarget === 'PICKUP' ? 'Pickup Hub' : 'Destination City'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Major TRUCKS logistics nodes
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <X size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.citySearchInput}
              value={citySearchText}
              onChangeText={setCitySearchText}
              placeholder="Search or type custom city..."
              placeholderTextColor="#94A3B8"
            />

            <ScrollView style={{ maxHeight: 320 }}>
              {POPULAR_HUBS.filter(
                (h) =>
                  h.city.toLowerCase().includes(citySearchText.toLowerCase()) ||
                  h.state.toLowerCase().includes(citySearchText.toLowerCase())
              ).map((h) => (
                <TouchableOpacity
                  key={h.city}
                  style={styles.hubChoiceItem}
                  onPress={() => handleSelectCityHub(h)}
                >
                  <Building size={16} color="#F05A24" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hubChoiceCity}>{h.city}</Text>
                    <Text style={styles.hubChoiceRegion}>
                      {h.state} • {h.region}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}

              {citySearchText.trim().length > 0 &&
                !POPULAR_HUBS.some(
                  (h) => h.city.toLowerCase() === citySearchText.trim().toLowerCase()
                ) && (
                  <TouchableOpacity
                    style={styles.customCityBtn}
                    onPress={() =>
                      handleSelectCityHub({
                        city: citySearchText.trim(),
                        state: 'India',
                      })
                    }
                  >
                    <Text style={styles.customCityBtnText}>
                      Use "{citySearchText.trim()}" as custom city
                    </Text>
                  </TouchableOpacity>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: Paste Google Maps Link Modal (Zero Cost) ─── */}
      <Modal
        visible={showPasteLinkModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPasteLinkModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paste Google Maps Link</Text>
                <Text style={styles.modalSubtitle}>
                  Pin {pasteLinkTarget === 'PICKUP' ? 'pickup loading gate' : 'destination yard'} for driver
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasteLinkModal(false)}>
                <X size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.pasteExplainerText}>
              Open Google Maps, tap "Share", copy link, and paste below. Valid links include maps.app.goo.gl or google.com/maps.
            </Text>

            <View style={styles.pasteInputWrap}>
              <TextInput
                style={[
                  styles.pasteLinkInput,
                  pasteLinkError ? styles.pasteLinkInputError : null,
                ]}
                value={pastedLinkInput}
                onChangeText={(text) => {
                  setPastedLinkInput(text);
                  setPasteLinkError(null);
                }}
                placeholder=""
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.clipboardPasteBtn}
                onPress={handlePasteFromClipboard}
                activeOpacity={0.75}
              >
                <Text style={styles.clipboardPasteBtnText}>Paste</Text>
              </TouchableOpacity>
            </View>

            {pasteLinkError && (
              <Text style={styles.pasteErrorText}>{pasteLinkError}</Text>
            )}

            <View style={styles.pasteModalActions}>
              <TouchableOpacity
                style={styles.cancelPasteBtn}
                onPress={() => setShowPasteLinkModal(false)}
              >
                <Text style={styles.cancelPasteBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmPasteBtn}
                onPress={handleSavePastedLink}
              >
                <Text style={styles.confirmPasteBtnText}>Attach Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
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
  headerSpacer: {
    width: 36,
    height: 36,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  draftBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
  },
  stepContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    color: '#F05A24',
    letterSpacing: 0.8,
  },
  stepPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101D36',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F05A24',
    borderRadius: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconTagPickup: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTagDelivery: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#101D36',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  savedAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  savedAddrBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  quickPillsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  quickDockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickDockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  quickDockPillDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  quickDockPillTextDelivery: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  inputWrap: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  gpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F05A24',
  },
  inputWithIconRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  fieldLeftIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
  },
  fieldRightIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
  textInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingLeft: 38,
    paddingRight: 12,
    height: 46,
    fontSize: 13.5,
    color: '#101D36',
  },
  addressArea: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  selectorTouchBox: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingLeft: 38,
    paddingRight: 34,
    justifyContent: 'center',
  },
  selectorTouchText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#101D36',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  col: {
    flex: 1,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 10,
  },
  phoneLeftIcon: {
    marginRight: 6,
  },
  phonePrefixText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#101D36',
  },
  phoneDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  phoneInputBox: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 0,
    height: '100%',
  },
  pinSpinner: {
    position: 'absolute',
    right: 12,
  },
  pinFeedbackText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  /* Google Maps Sub-Card */
  mapsSubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 4,
  },
  mapsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mapsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#101D36',
  },
  mapsSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  mapsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapsActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  mapsActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#101D36',
  },
  orDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orLine: {
    width: 8,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  orText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },

  /* Location Added Box */
  locationAddedBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    padding: 8,
    gap: 10,
  },
  locationAddedInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationAddedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationAddedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  locationAddedPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  removeLocBtn: {
    padding: 4,
  },
  locationAddedAddressText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
    marginVertical: 4,
  },
  viewOnMapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOnMapsLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F05A24',
  },

  /* Sticky CTA */
  continueBtn: {
    height: 52,
    backgroundColor: '#F05A24',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 6,
    marginBottom: 16,
  },
  continueBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* Modal Backdrop & Shared */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 29, 54, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#101D36',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  /* Saved Hubs modal items */
  addrChoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  addrChoiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrChoiceLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#101D36',
  },
  addrChoiceText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  addrChoiceContact: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  emptyAddrText: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 20,
  },
  manageAddrBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  manageAddrBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F05A24',
  },

  /* City Picker modal items */
  citySearchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13.5,
    color: '#101D36',
    marginBottom: 12,
  },
  hubChoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  hubChoiceCity: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#101D36',
  },
  hubChoiceRegion: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  customCityBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  customCityBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },

  /* Paste Link Modal */
  pasteExplainerText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  pasteInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pasteLinkInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#101D36',
  },
  pasteLinkInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
  },
  clipboardPasteBtn: {
    height: 46,
    backgroundColor: '#101D36',
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipboardPasteBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pasteErrorText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 10,
  },
  pasteModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelPasteBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPasteBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmPasteBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F05A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPasteBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
