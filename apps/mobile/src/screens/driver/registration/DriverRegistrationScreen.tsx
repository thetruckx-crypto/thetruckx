import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Keyboard,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  User,
  Phone,
  Calendar,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Building2,
  RefreshCw,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Eye,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DriverDobCalendarModal } from '../../../components/DriverDobCalendarModal';
import { driverService } from '../../../services/driverService';
import { DriverRegistrationFormData } from '../../../types';
import { authService } from '../../../services/authService';

export interface DriverRegistrationScreenProps {
  initialMobile?: string;
  onBack: () => void;
  onSubmitSuccess?: (data: { driverId: string; applicationNumber: string }) => void;
  onStartRegistration?: () => void;
  onCheckStatus?: () => void;
  onProceedToOtp?: (data: { targetPhone: string; testCode?: string; submissionData: any }) => void;
}

interface VendorOption {
  id: string;
  name: string;
  vendorCode?: string;
  phone?: string;
  city?: string;
}

export const DriverRegistrationScreen: React.FC<DriverRegistrationScreenProps> = ({
  initialMobile = '',
  onBack,
  onSubmitSuccess,
  onCheckStatus,
  onProceedToOtp,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(
    initialMobile ? initialMobile.replace(/[^0-9]/g, '').slice(-10) : ''
  );
  const [dateOfBirth, setDateOfBirth] = useState(''); // DD/MM/YYYY
  const [isDobCalendarOpen, setIsDobCalendarOpen] = useState(false);

  // Document Uploads State
  const [dlFrontUri, setDlFrontUri] = useState<string | null>(null);
  const [dlBackUri, setDlBackUri] = useState<string | null>(null);
  const [aadhaarFrontUri, setAadhaarFrontUri] = useState<string | null>(null);
  const [aadhaarBackUri, setAadhaarBackUri] = useState<string | null>(null);

  // Vendor Selection State
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorOption | null>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');

  // Inline Validation Errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
    dlFront?: string;
    dlBack?: string;
    aadhaarFront?: string;
    aadhaarBack?: string;
    vendor?: string;
    general?: string;
  }>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  // Permission Alert State
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  // Load saved draft on mount to preserve state across app switch and activity interruptions
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const draft = await driverService.getDraftForm();
        if (draft && isMounted) {
          if (draft.fullName) setFullName(draft.fullName);
          if (draft.phone && !initialMobile) setPhone(draft.phone);
          if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
          if (draft.primaryVendorId) {
            setSelectedVendor({
              id: draft.primaryVendorId,
              name: draft.transporterName || 'Attached Transporter',
            });
          }
        }
        const rawDocs = await AsyncStorage.getItem('@necl_driver_draft_uris');
        if (rawDocs && isMounted) {
          const parsed = JSON.parse(rawDocs);
          if (parsed.dlFrontUri) setDlFrontUri(parsed.dlFrontUri);
          if (parsed.dlBackUri) setDlBackUri(parsed.dlBackUri);
          if (parsed.aadhaarFrontUri) setAadhaarFrontUri(parsed.aadhaarFrontUri);
          if (parsed.aadhaarBackUri) setAadhaarBackUri(parsed.aadhaarBackUri);
        }
      } catch (e) {
        console.warn('Driver draft restoration notice:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced auto-save draft on any input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fullName || phone || dateOfBirth || selectedVendor) {
        driverService.saveDraftForm({
          fullName,
          phone,
          dateOfBirth,
          primaryVendorId: selectedVendor?.id,
          transporterName: selectedVendor?.name,
        });
      }
      if (dlFrontUri || dlBackUri || aadhaarFrontUri || aadhaarBackUri) {
        AsyncStorage.setItem(
          '@necl_driver_draft_uris',
          JSON.stringify({ dlFrontUri, dlBackUri, aadhaarFrontUri, aadhaarBackUri })
        ).catch(() => {});
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [fullName, phone, dateOfBirth, selectedVendor, dlFrontUri, dlBackUri, aadhaarFrontUri, aadhaarBackUri]);

  // Load Real Vendors from Backend
  const fetchVendors = async () => {
    setLoadingVendors(true);
    setVendorError(null);
    try {
      const vendorList = await driverService.getRegisteredTransporters();
      if (vendorList && vendorList.length > 0) {
        setVendors(vendorList);
      } else {
        setVendors([]);
      }
    } catch (err: any) {
      console.warn('Could not load vendors from backend:', err);
      setVendorError('Unable to connect to vendor registry. Please try again.');
    } finally {
      setLoadingVendors(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleOpenVendorModal = () => {
    if (vendors.length === 0) {
      fetchVendors();
    }
    setIsVendorModalOpen(true);
  };

  // Filtered Vendors for Search
  const filteredVendors = useMemo(() => {
    if (!vendorSearchQuery.trim()) return vendors;
    const q = vendorSearchQuery.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.vendorCode?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q)
    );
  }, [vendors, vendorSearchQuery]);

  // Real-time auto-calculated age from Date of Birth
  const calculatedAge = useMemo(() => {
    if (!dateOfBirth || dateOfBirth.length < 10) return null;
    const parts = dateOfBirth.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const birthDate = new Date(year, month, day);
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month ||
      birthDate.getDate() !== day
    ) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    const valid = age >= 18 && age <= 75;
    return { age, valid };
  }, [dateOfBirth]);

  // Date Formatting & Age Validation
  const handleDateChange = (text: string) => {
    // Automatically format digits to DD/MM/YYYY
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setDateOfBirth(formatted);
    if (errors.dateOfBirth) {
      setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
    }
  };

  const calculateAge = (dobString: string): { valid: boolean; age: number; error?: string } => {
    if (!dobString || dobString.length < 10) {
      return { valid: false, age: 0, error: 'Enter full Date of Birth (DD/MM/YYYY)' };
    }
    const parts = dobString.split('/');
    if (parts.length !== 3) {
      return { valid: false, age: 0, error: 'Invalid date format. Use DD/MM/YYYY' };
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const birthDate = new Date(year, month, day);
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month ||
      birthDate.getDate() !== day
    ) {
      return { valid: false, age: 0, error: 'Please enter a valid calendar date' };
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return { valid: false, age, error: 'Driver must be at least 18 years old to register' };
    }
    if (age > 75) {
      return { valid: false, age, error: 'Age exceeds commercial driver eligibility threshold (75 years)' };
    }

    return { valid: true, age };
  };

  // Convert DD/MM/YYYY to ISO YYYY-MM-DD
  const formatIsoDate = (dobString: string): string => {
    const parts = dobString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dobString;
  };

  // Image Capture & Upload Handlers
  const handleCaptureCamera = async (
    target: 'dlFront' | 'dlBack' | 'aadhaarFront' | 'aadhaarBack'
  ) => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setPermissionNotice(
            'Camera permission is required to take photo of documents. You can grant camera permission in system settings, or tap "Upload from Device" instead.'
          );
          Alert.alert(
            'Camera Permission Denied',
            'Camera access was denied. You can enable camera permission in device settings or choose "Upload from Device".'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        applyDocumentUri(target, uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Failed to capture photo from camera.');
    }
  };

  const handlePickFromGallery = async (
    target: 'dlFront' | 'dlBack' | 'aadhaarFront' | 'aadhaarBack'
  ) => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setPermissionNotice(
            'Storage / photo gallery permission is required to choose documents. You can grant access in device settings or tap "Open Camera" to take a photo.'
          );
          Alert.alert(
            'Gallery Permission Denied',
            'Storage permission was denied. You can enable permission in device settings or tap "Open Camera".'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        applyDocumentUri(target, uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Failed to select document from gallery.');
    }
  };

  const applyDocumentUri = (
    target: 'dlFront' | 'dlBack' | 'aadhaarFront' | 'aadhaarBack',
    uri: string
  ) => {
    if (target === 'dlFront') {
      setDlFrontUri(uri);
      setErrors((prev) => ({ ...prev, dlFront: undefined }));
    } else if (target === 'dlBack') {
      setDlBackUri(uri);
      setErrors((prev) => ({ ...prev, dlBack: undefined }));
    } else if (target === 'aadhaarFront') {
      setAadhaarFrontUri(uri);
      setErrors((prev) => ({ ...prev, aadhaarFront: undefined }));
    } else if (target === 'aadhaarBack') {
      setAadhaarBackUri(uri);
      setErrors((prev) => ({ ...prev, aadhaarBack: undefined }));
    }
  };

  const handleRemoveDocument = (
    target: 'dlFront' | 'dlBack' | 'aadhaarFront' | 'aadhaarBack'
  ) => {
    if (target === 'dlFront') setDlFrontUri(null);
    else if (target === 'dlBack') setDlBackUri(null);
    else if (target === 'aadhaarFront') setAadhaarFrontUri(null);
    else if (target === 'aadhaarBack') setAadhaarBackUri(null);
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errs: typeof errors = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full Name is mandatory.';
    } else if (fullName.trim().length < 3) {
      errs.fullName = 'Please enter driver full legal name (min 3 chars).';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errs.phone = 'Mobile Phone Number is mandatory.';
    } else if (cleanPhone.length !== 10) {
      errs.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    const ageCheck = calculateAge(dateOfBirth);
    if (!ageCheck.valid) {
      errs.dateOfBirth = ageCheck.error || 'Valid Date of Birth is mandatory.';
    }

    if (!dlFrontUri) {
      errs.dlFront = 'Driving Licence Front Side is mandatory.';
    }
    if (!dlBackUri) {
      errs.dlBack = 'Driving Licence Back Side is mandatory.';
    }
    if (!aadhaarFrontUri) {
      errs.aadhaarFront = 'Aadhaar Card Front Side is mandatory.';
    }
    if (!aadhaarBackUri) {
      errs.aadhaarBack = 'Aadhaar Card Back Side is mandatory.';
    }

    if (!selectedVendor) {
      errs.vendor = 'Selecting a connected fleet vendor is mandatory.';
    }

    setErrors(errs);
    const isValid = Object.keys(errs).length === 0;

    if (!isValid) {
      // Scroll to top or show alert for first error
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }

    return isValid;
  };

  // Form Review & Submission
  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent duplicate clicks

    const isValid = validateForm();
    if (!isValid) return;

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    try {
      const roleCheck = await authService.checkExistingRoleInDatabase(cleanPhone, 'DRIVER');
      if (roleCheck.hasExistingDifferentRole) {
        Alert.alert(
          'Registration Restricted',
          `This mobile number is already registered under the ${roleCheck.previousRoleLabel} role. You cannot register under another role using the same mobile number.`
        );
        return;
      }
    } catch (err: any) {
      console.warn('Role check error:', err);
    }

    // Open Review Modal before proceeding to OTP verification
    setIsReviewModalOpen(true);
  };

  const handleConfirmReviewAndSendOtp = async () => {
    setIsSubmitting(true);
    setUploadProgressMsg('Sending OTP verification code...');

    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const isoDob = formatIsoDate(dateOfBirth);

      const submissionData: DriverRegistrationFormData = {
        fullName: fullName.trim(),
        phone: cleanPhone,
        dateOfBirth: isoDob,
        dlFrontUri: dlFrontUri || undefined,
        dlBackUri: dlBackUri || undefined,
        aadhaarFrontUri: aadhaarFrontUri || undefined,
        aadhaarBackUri: aadhaarBackUri || undefined,
        primaryVendorId: selectedVendor!.id,
        selectedVendorName: selectedVendor!.name,
        selectedVendorCode: selectedVendor!.vendorCode,
      };

      if (onProceedToOtp) {
        const otpRes = await authService.sendOtp(cleanPhone, 'REGISTRATION', 'DRIVER');
        setIsReviewModalOpen(false);
        onProceedToOtp({
          targetPhone: cleanPhone,
          testCode: otpRes.testCode,
          submissionData,
        });
        return;
      }

      setUploadProgressMsg('Submitting registration details for admin approval...');
      const result = await driverService.submitDriverRegistration(submissionData, cleanPhone);

      if (result.success) {
        setIsReviewModalOpen(false);
        if (onSubmitSuccess) {
          onSubmitSuccess({
            driverId: result.driverId,
            applicationNumber: result.applicationNumber,
          });
        } else {
          Alert.alert(
            'Registration Submitted',
            'Driver registration submitted successfully. Your details are under review by the NECL Admin.',
            [{ text: 'OK', onPress: onBack }]
          );
        }
      } else {
        throw new Error('Registration submission could not be completed.');
      }
    } catch (err: any) {
      console.error('Driver submission failed:', err);
      Alert.alert(
        'Submission Failed',
        err.message || 'Database registration could not be completed. Please check your network and try again.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgressMsg('');
    }
  };

  // Document Upload Card Sub-component
  const renderDocumentUploadCard = (
    title: string,
    subtitle: string,
    target: 'dlFront' | 'dlBack' | 'aadhaarFront' | 'aadhaarBack',
    uri: string | null,
    error?: string
  ) => {
    return (
      <View style={[styles.docCard, error ? styles.docCardError : null]}>
        <View style={styles.docCardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.docTitleRow}>
              <Text style={styles.docTitle}>{title}</Text>
              <Text style={styles.reqBadge}>Mandatory</Text>
            </View>
            <Text style={styles.docSubtitle}>{subtitle}</Text>
          </View>
          {uri ? (
            <View style={styles.uploadedCheckBadge}>
              <Check size={14} color="#10B981" />
              <Text style={styles.uploadedCheckText}>Attached</Text>
            </View>
          ) : null}
        </View>

        {uri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewActionsRow}>
              <TouchableOpacity
                style={styles.previewBtnRetake}
                onPress={() => handleCaptureCamera(target)}
                disabled={isSubmitting}
              >
                <RotateCcw size={13} color="#F05A22" />
                <Text style={styles.previewBtnRetakeText}>Retake Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.previewBtnReplace}
                onPress={() => handlePickFromGallery(target)}
                disabled={isSubmitting}
              >
                <Upload size={13} color="#475569" />
                <Text style={styles.previewBtnReplaceText}>Replace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.previewBtnRemove}
                onPress={() => handleRemoveDocument(target)}
                disabled={isSubmitting}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.previewBtnRemoveText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.uploadOptionsRow}>
            <TouchableOpacity
              style={styles.uploadOptionBtnPrimary}
              onPress={() => handleCaptureCamera(target)}
              disabled={isSubmitting}
            >
              <Camera size={16} color="#FFFFFF" />
              <Text style={styles.uploadOptionPrimaryText}>Open Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadOptionBtnSecondary}
              onPress={() => handlePickFromGallery(target)}
              disabled={isSubmitting}
            >
              <Upload size={16} color="#F05A22" />
              <Text style={styles.uploadOptionSecondaryText}>Upload from Device</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? (
          <View style={styles.inlineErrorRow}>
            <AlertCircle size={13} color="#EF4444" />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Header Bar without Hero Image */}
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              accessibilityLabel="Back to login"
              activeOpacity={0.8}
            >
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <Text style={styles.headerTopTitle}>Driver Registration</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.contentWrap}>
            {/* Header Title Banner */}
            <View style={styles.headingWrap}>
              <View style={styles.badgeRow}>
                <View style={styles.roleBadge}>
                  <Truck size={13} color="#F05A22" />
                  <Text style={styles.roleBadgeText}>COMMERCIAL PILOT ENROLLMENT</Text>
                </View>
              </View>
              <Text style={styles.titleText}>
                Driver <Text style={styles.goldText}>Registration</Text>
              </Text>
              <Text style={styles.subText}>
                Complete all mandatory details on this single screen, upload both sides of your Driving Licence and Aadhaar, select your connected vendor, and submit for NECL Admin approval.
              </Text>
            </View>

            {/* Permission Alert Notice if active */}
            {permissionNotice ? (
              <View style={styles.permissionAlertCard}>
                <AlertCircle size={16} color="#B45309" />
                <Text style={styles.permissionAlertText}>{permissionNotice}</Text>
                <TouchableOpacity onPress={() => setPermissionNotice(null)}>
                  <X size={16} color="#B45309" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Global Error Banner if any */}
            {errors.general ? (
              <View style={styles.globalErrorBanner}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.globalErrorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION A: PERSONAL DETAILS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionNumberCircle}>
                  <Text style={styles.sectionNumberText}>A</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Personal Details</Text>
                  <Text style={styles.sectionSubtitle}>
                    Official driver identity details matching government records
                  </Text>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Full Legal Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.fullName ? styles.inputWrapError : null,
                  ]}
                >
                  <User size={16} color="#64748B" style={styles.leadingIcon} />
                  <TextInput
                    testID="driver-full-name"
                    style={styles.textInput}
                    placeholder="Enter full legal name as per DL"
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={(txt) => {
                      setFullName(txt);
                      if (errors.fullName)
                        setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    autoCapitalize="words"
                    editable={!isSubmitting}
                  />
                </View>
                {errors.fullName ? (
                  <View style={styles.inlineErrorRow}>
                    <AlertCircle size={12} color="#EF4444" />
                    <Text style={styles.inlineErrorText}>{errors.fullName}</Text>
                  </View>
                ) : null}
              </View>

              {/* Phone Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Mobile Phone Number <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.phone ? styles.inputWrapError : null,
                  ]}
                >
                  <View style={styles.phonePrefix}>
                    <Text style={styles.phonePrefixFlag}>🇮🇳</Text>
                    <Text style={styles.phonePrefixText}>+91</Text>
                  </View>
                  <TextInput
                    testID="driver-phone-number"
                    style={styles.textInput}
                    placeholder="98765 43210"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={(txt) => {
                      setPhone(txt.replace(/\D/g, '').slice(0, 10));
                      if (errors.phone)
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!isSubmitting}
                  />
                </View>
                {errors.phone ? (
                  <View style={styles.inlineErrorRow}>
                    <AlertCircle size={12} color="#EF4444" />
                    <Text style={styles.inlineErrorText}>{errors.phone}</Text>
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    Used for OTP login authentication and active dispatch communications.
                  </Text>
                )}
              </View>

              {/* Date of Birth */}
              <View style={styles.fieldGroup}>
                <View style={styles.dobLabelRow}>
                  <Text style={styles.fieldLabelNoMargin}>
                    Date of Birth <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {calculatedAge ? (
                    <View
                      style={[
                        styles.ageBadgePill,
                        calculatedAge.valid
                          ? styles.ageBadgePillValid
                          : styles.ageBadgePillInvalid,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ageBadgePillText,
                          calculatedAge.valid
                            ? styles.ageBadgePillTextValid
                            : styles.ageBadgePillTextInvalid,
                        ]}
                      >
                        Age: {calculatedAge.age} Yrs {calculatedAge.valid ? '• Eligible' : '• Under 18'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.ageBadgePillPlaceholder}>
                      <Text style={styles.ageBadgePillPlaceholderText}>Auto-calculates age</Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    errors.dateOfBirth ? styles.inputWrapError : null,
                  ]}
                >
                  <Calendar size={16} color="#F05A22" style={styles.leadingIcon} />
                  <TextInput
                    testID="driver-dob"
                    style={styles.textInput}
                    placeholder="DD/MM/YYYY (e.g. 15/08/1992)"
                    placeholderTextColor="#94A3B8"
                    value={dateOfBirth}
                    onChangeText={handleDateChange}
                    keyboardType="numeric"
                    maxLength={10}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    style={styles.openCalendarBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsDobCalendarOpen(true);
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel="Open calendar to pick date of birth"
                  >
                    <Calendar size={14} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.openCalendarBtnText}>Calendar</Text>
                  </TouchableOpacity>
                </View>
                {errors.dateOfBirth ? (
                  <View style={styles.inlineErrorRow}>
                    <AlertCircle size={12} color="#EF4444" />
                    <Text style={styles.inlineErrorText}>{errors.dateOfBirth}</Text>
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    {calculatedAge && calculatedAge.valid
                      ? `Verified Age: ${calculatedAge.age} years old (Eligible for commercial pilot authorization).`
                      : 'Mandatory age validation: Driver must be at least 18 years of age.'}
                  </Text>
                )}
              </View>
            </View>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION B: DRIVING LICENCE UPLOAD */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionNumberCircle}>
                  <Text style={styles.sectionNumberText}>B</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Driving Licence (DL) Upload</Text>
                  <Text style={styles.sectionSubtitle}>
                    Mandatory high-clarity front and back scans of commercial driving licence
                  </Text>
                </View>
              </View>

              {/* DL Front Side */}
              {renderDocumentUploadCard(
                'Driving Licence — Front Side',
                'Ensure licence number, driver photo, name, and validity are clear',
                'dlFront',
                dlFrontUri,
                errors.dlFront
              )}

              {/* DL Back Side */}
              {renderDocumentUploadCard(
                'Driving Licence — Back Side',
                'Ensure authorized vehicle classes (e.g. HGMV, TRANS) and badge numbers are visible',
                'dlBack',
                dlBackUri,
                errors.dlBack
              )}
            </View>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION C: AADHAAR CARD UPLOAD */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionNumberCircle}>
                  <Text style={styles.sectionNumberText}>C</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Aadhaar Card Upload</Text>
                  <Text style={styles.sectionSubtitle}>
                    Mandatory front and back scans for national KYC identity verification
                  </Text>
                </View>
              </View>

              {/* Aadhaar Front Side */}
              {renderDocumentUploadCard(
                'Aadhaar Card — Front Side',
                'Ensure Aadhaar photo, legal name, gender, and date of birth are legible',
                'aadhaarFront',
                aadhaarFrontUri,
                errors.aadhaarFront
              )}

              {/* Aadhaar Back Side */}
              {renderDocumentUploadCard(
                'Aadhaar Card — Back Side',
                'Ensure residential address and QR code are completely visible',
                'aadhaarBack',
                aadhaarBackUri,
                errors.aadhaarBack
              )}
            </View>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION D: VENDOR SELECTION */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionNumberCircle}>
                  <Text style={styles.sectionNumberText}>D</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Select Connected Vendor</Text>
                  <Text style={styles.sectionSubtitle}>
                    Associate your driver profile with the active fleet vendor you work with
                  </Text>
                </View>
              </View>

              {selectedVendor ? (
                /* Selected Vendor Summary Card with Change Option */
                <View style={styles.selectedVendorCard}>
                  <View style={styles.selectedVendorHeader}>
                    <View style={styles.vendorAvatarSquircle}>
                      <Building2 size={20} color="#F05A22" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedVendorName}>{selectedVendor.name}</Text>
                      <Text style={styles.selectedVendorMeta}>
                        Vendor ID: <Text style={styles.monoHighlight}>{selectedVendor.vendorCode}</Text>
                        {selectedVendor.city ? ` • ${selectedVendor.city}` : ''}
                      </Text>
                      {selectedVendor.phone ? (
                        <Text style={styles.selectedVendorPhone}>📞 +91 {selectedVendor.phone}</Text>
                      ) : null}
                    </View>
                    <View style={styles.connectedBadge}>
                      <CheckCircle2 size={13} color="#10B981" />
                      <Text style={styles.connectedBadgeText}>Selected</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.changeVendorBtn}
                    onPress={handleOpenVendorModal}
                    disabled={isSubmitting}
                  >
                    <RefreshCw size={13} color="#F05A22" />
                    <Text style={styles.changeVendorBtnText}>Change Connected Vendor</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Vendor Selection Trigger Box */
                <TouchableOpacity
                  style={[
                    styles.vendorSelectorTrigger,
                    errors.vendor ? styles.vendorSelectorTriggerError : null,
                  ]}
                  onPress={handleOpenVendorModal}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  <Building2 size={18} color="#64748B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorTriggerLabel}>
                      Select Connected Vendor <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <Text style={styles.vendorTriggerPlaceholder}>
                      {loadingVendors
                        ? 'Fetching registered active vendors...'
                        : 'Tap to choose your affiliated transporter'}
                    </Text>
                  </View>
                  {loadingVendors ? (
                    <ActivityIndicator size="small" color="#F05A22" />
                  ) : (
                    <ChevronDown size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              )}

              {errors.vendor ? (
                <View style={styles.inlineErrorRow}>
                  <AlertCircle size={12} color="#EF4444" />
                  <Text style={styles.inlineErrorText}>{errors.vendor}</Text>
                </View>
              ) : null}

              {vendorError ? (
                <View style={styles.vendorNoticeBox}>
                  <AlertCircle size={14} color="#B45309" />
                  <Text style={styles.vendorNoticeText}>{vendorError}</Text>
                </View>
              ) : null}

              <View style={styles.vendorAssistanceCallout}>
                <ShieldCheck size={14} color="#64748B" />
                <Text style={styles.vendorAssistanceText}>
                  If your required vendor is unavailable or not listed, please contact the vendor or NECL administration at 1800-NECL-LOGISTICS.
                </Text>
              </View>
            </View>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SUBMIT BUTTON & PROGRESS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <View style={styles.submitSection}>
              {isSubmitting ? (
                <View style={styles.submittingIndicatorRow}>
                  <ActivityIndicator size="small" color="#F05A22" />
                  <Text style={styles.submittingIndicatorText}>
                    {uploadProgressMsg || 'Processing driver registration...'}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="btn-submit-driver-approval"
                style={[
                  styles.submitBtn,
                  isSubmitting ? styles.submitBtnDisabled : null,
                ]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.submitBtnText}>Submit for Approval</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.approvalDisclaimer}>
                Every new driver registration remains in Pending Admin Approval until an authorized NECL admin audits documents and verifies regulatory Sarathi compliance.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DRIVER APPLICATION REVIEW MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isReviewModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsReviewModalOpen(false)}
            >
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Review Driver Application</Text>
              <Text style={styles.modalSubtitle}>
                Review all entered details before sending OTP verification
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#172B4D', marginBottom: 12 }}>Personal Details</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Full Name</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{fullName || '—'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Mobile Number</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>+91 {phone.replace(/\D/g, '').slice(-10)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Date of Birth</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{dateOfBirth || '—'}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#172B4D', marginBottom: 12 }}>KYC Documents</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Driving Licence Front & Back</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: dlFrontUri && dlBackUri ? '#10B981' : '#EF4444' }}>
                  {dlFrontUri && dlBackUri ? '✓ Attached' : 'Missing'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Aadhaar Card Front & Back</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: aadhaarFrontUri && aadhaarBackUri ? '#10B981' : '#EF4444' }}>
                  {aadhaarFrontUri && aadhaarBackUri ? '✓ Attached' : 'Missing'}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#172B4D', marginBottom: 12 }}>Assigned Transporter</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>Vendor Name</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>{selectedVendor?.name || '—'}</Text>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#F05A22',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={handleConfirmReviewAndSendOtp}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                      Verify & Submit Application
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                }}
                onPress={() => setIsReviewModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#475569', fontSize: 14, fontWeight: '600' }}>
                  Edit Details
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VENDOR SEARCH & SELECTION MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={isVendorModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsVendorModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsVendorModalOpen(false)}
            >
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Select Connected Vendor</Text>
              <Text style={styles.modalSubtitle}>
                Only active, verified NECL vendors eligible to register drivers
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={fetchVendors}
              disabled={loadingVendors}
              accessibilityLabel="Refresh vendor list"
            >
              {loadingVendors ? (
                <ActivityIndicator size="small" color="#F05A22" />
              ) : (
                <RefreshCw size={18} color="#F05A22" />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <Search size={16} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by vendor name, vendor ID, or phone..."
              placeholderTextColor="#94A3B8"
              value={vendorSearchQuery}
              onChangeText={setVendorSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {vendorSearchQuery ? (
              <TouchableOpacity onPress={() => setVendorSearchQuery('')}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Vendor List */}
          <ScrollView contentContainerStyle={styles.vendorListContainer}>
            {loadingVendors ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="large" color="#F05A22" />
                <Text style={styles.modalLoadingText}>Loading verified vendors from backend...</Text>
              </View>
            ) : filteredVendors.length === 0 ? (
              <View style={styles.modalEmptyWrap}>
                <Building2 size={40} color="#CBD5E1" />
                <Text style={styles.modalEmptyTitle}>No matching vendor found</Text>
                <Text style={styles.modalEmptyDesc}>
                  If your required vendor is not displayed, tap below to reload or contact NECL administration at 1800-NECL-LOGISTICS.
                </Text>
                <TouchableOpacity
                  style={styles.emptyRetryBtn}
                  onPress={fetchVendors}
                  activeOpacity={0.8}
                  disabled={loadingVendors}
                >
                  <RefreshCw size={14} color="#FFFFFF" />
                  <Text style={styles.emptyRetryBtnText}>
                    {loadingVendors ? 'Reloading...' : 'Reload Vendor List'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredVendors.map((v) => {
                const isSelected = selectedVendor?.id === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.vendorItemCard,
                      isSelected ? styles.vendorItemCardSelected : null,
                    ]}
                    onPress={() => {
                      setSelectedVendor(v);
                      setErrors((prev) => ({ ...prev, vendor: undefined }));
                      setIsVendorModalOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.vendorItemAvatar}>
                      <Building2 size={18} color="#F05A22" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vendorItemName}>{v.name}</Text>
                      <Text style={styles.vendorItemDetails}>
                        ID: <Text style={styles.monoHighlight}>{v.vendorCode}</Text>
                        {v.city ? ` • ${v.city}` : ''}
                      </Text>
                      {v.phone ? (
                        <Text style={styles.vendorItemPhone}>Phone: +91 {v.phone}</Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedCheckCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.selectBtnPill}>
                        <Text style={styles.selectBtnPillText}>Select</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Date of Birth Interactive Calendar Picker Modal */}
      <DriverDobCalendarModal
        visible={isDobCalendarOpen}
        currentDob={dateOfBirth}
        onConfirm={(newDob) => {
          setDateOfBirth(newDob);
          if (errors.dateOfBirth) {
            setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
          }
        }}
        onClose={() => setIsDobCalendarOpen(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerTopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headingWrap: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 90, 34, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(240, 90, 34, 0.25)',
  },
  roleBadgeText: {
    color: '#F05A22',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  permissionAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  permissionAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  globalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  globalErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#172B4D',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  fieldLabelNoMargin: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  dobLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ageBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  ageBadgePillValid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  ageBadgePillInvalid: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  ageBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ageBadgePillTextValid: {
    color: '#15803D',
  },
  ageBadgePillTextInvalid: {
    color: '#B91C1C',
  },
  ageBadgePillPlaceholder: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  ageBadgePillPlaceholderText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  openCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F05A22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 4,
  },
  openCalendarBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requiredStar: {
    color: '#EF4444',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputWrapError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  leadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 0,
  },
  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  phonePrefixFlag: {
    fontSize: 14,
    marginRight: 4,
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  inlineErrorText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '600',
  },
  docCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  docCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  reqBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  docSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  uploadedCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  uploadedCheckText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#166534',
  },
  uploadOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  uploadOptionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F05A22',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  uploadOptionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  uploadOptionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  uploadOptionSecondaryText: {
    color: '#F05A22',
    fontSize: 12.5,
    fontWeight: '700',
  },
  previewContainer: {
    marginTop: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E2E8F0',
  },
  previewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  previewBtnRetake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previewBtnRetakeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  previewBtnReplace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previewBtnReplaceText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  previewBtnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previewBtnRemoveText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#EF4444',
  },
  vendorSelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  vendorSelectorTriggerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  vendorTriggerLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  vendorTriggerPlaceholder: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectedVendorCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 14,
  },
  selectedVendorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vendorAvatarSquircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedVendorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
  },
  selectedVendorMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  selectedVendorPhone: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  monoHighlight: {
    fontWeight: '700',
    color: '#C2410C',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  connectedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#166534',
  },
  changeVendorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  changeVendorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F05A22',
  },
  vendorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  vendorNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400E',
  },
  vendorAssistanceCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vendorAssistanceText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  submitSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  submittingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  submittingIndicatorText: {
    fontSize: 12.5,
    color: '#F05A22',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#F05A22',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  approvalDisclaimer: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172B4D',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1E293B',
    paddingVertical: 0,
  },
  vendorListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  modalLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  modalEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    gap: 10,
  },
  modalEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  modalEmptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  emptyRetryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vendorItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  vendorItemCardSelected: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  vendorItemAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
  },
  vendorItemDetails: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  vendorItemPhone: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  selectBtnPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  selectBtnPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  selectedCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
