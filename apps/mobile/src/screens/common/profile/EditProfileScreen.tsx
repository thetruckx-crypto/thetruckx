import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  User,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  Save,
  Camera,
  Lock,
  Plus,
  Image as ImageIcon,
  Trash2,
  X,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AuthSessionData, authService } from '../../../services/authService';
import { clientService } from '../../../services/clientService';
import { formatDisplayId } from '../../../utils/idGenerator';
import { uploadDocumentToStorage } from '../../../utils/mobileStorageHelper';

interface EditProfileScreenProps {
  session: AuthSessionData | null;
  onBack: () => void;
  onProfileUpdated: (updatedSession: AuthSessionData) => void;
  onNavigateToSavedAddresses?: () => void;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  session,
  onBack,
  onProfileUpdated,
  onNavigateToSavedAddresses,
}) => {
  // Canonical permanent IDs
  const role = session?.role || 'CLIENT';
  const accountId =
    session?.accountId ||
    formatDisplayId('AC', session?.userId, session?.createdAt);

  const clientId =
    session?.clientCode ||
    session?.clientId ||
    formatDisplayId('CL', session?.userId, session?.createdAt);

  const roleSpecificId =
    role === 'CLIENT'
      ? clientId
      : role === 'VENDOR'
        ? (session?.vendorCode || session?.vendorId || formatDisplayId('VE', session?.userId, session?.createdAt))
        : (session?.driverCode || session?.driverId || formatDisplayId('DR', session?.userId, session?.createdAt));

  const roleSpecificLabel =
    role === 'CLIENT'
      ? 'Permanent Client ID'
      : role === 'VENDOR'
        ? 'Permanent Vendor ID'
        : 'Permanent Driver ID';

  // Editable Profile States
  const [fullName, setFullName] = useState(session?.fullName || '');
  const [email, setEmail] = useState(session?.email || '');
  const [companyName, setCompanyName] = useState(session?.companyName || '');
  const [designation, setDesignation] = useState(session?.designation || '');
  const [department, setDepartment] = useState(session?.department || '');
  const [address, setAddress] = useState(
    session?.address ||
    (session?.city ? `${session.city}${session.state ? ', ' + session.state : ''}${session.pincode ? ' - ' + session.pincode : ''}` : '')
  );

  // Registration-locked States
  const [registeredGstin, setRegisteredGstin] = useState(session?.gstin || '');
  const [registeredPan, setRegisteredPan] = useState(session?.pan || '');

  // Photo state (clean placeholder without dark background)
  const [photoUri, setPhotoUri] = useState<string>(session?.profilePhotoUrl || '');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!session?.mobile) return;
        const cleanPhone = session.mobile.replace(/[^0-9]/g, '').slice(-10);

        // 1. Check local registry first
        const registry = await authService.getLocalRegistry();
        const localRec = registry.find((u) => u.mobile === cleanPhone);
        if (localRec) {
          setFullName((prev) => prev || localRec.fullName || '');
          setEmail((prev) => prev || localRec.email || '');
          setCompanyName((prev) => prev || localRec.companyName || '');
          if (localRec.designation) setDesignation((prev) => prev || localRec.designation || '');
          if (localRec.department) setDepartment((prev) => prev || localRec.department || '');
          if (localRec.gstin) setRegisteredGstin((prev) => prev || localRec.gstin || '');
          if (localRec.pan) setRegisteredPan((prev) => prev || localRec.pan || '');
          if (localRec.profilePhotoUrl) setPhotoUri((prev) => prev || localRec.profilePhotoUrl || '');
          const localAddr = localRec.address || (localRec.city ? `${localRec.city}${localRec.state ? ', ' + localRec.state : ''}${localRec.pincode ? ' - ' + localRec.pincode : ''}` : '');
          if (localAddr) setAddress((prev) => prev || localAddr);
        }

        // 2. Also check live client status service
        if (session.role === 'CLIENT') {
          const status = await clientService.getClientAccountStatus(cleanPhone, true);
          if (status) {
            setFullName((prev) => prev || status.fullName || '');
            setEmail((prev) => prev || status.email || '');
            setCompanyName((prev) => prev || status.companyName || '');
            if ((status as any).designation) setDesignation((prev) => prev || (status as any).designation);
            if ((status as any).department) setDepartment((prev) => prev || (status as any).department);
            if ((status as any).gstin) setRegisteredGstin((prev) => prev || (status as any).gstin);
            if ((status as any).pan) setRegisteredPan((prev) => prev || (status as any).pan);
            if ((status as any).profile_photo_url) setPhotoUri((prev) => prev || (status as any).profile_photo_url);
            const serverAddr = status.registeredAddress || (status.city ? `${status.city}${status.state ? ', ' + status.state : ''}${status.pincode ? ' - ' + status.pincode : ''}` : '');
            if (serverAddr) setAddress((prev) => prev || serverAddr);
          }
        }
      } catch (e) {
        console.warn('Failed to load registered profile details:', e);
      }
    })();
  }, [session?.mobile]);

  // Handle Photo Picker Actions
  const handleLaunchCamera = async () => {
    setShowPhotoModal(false);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera permissions in your device settings to take a profile photo.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera.');
    }
  };

  const handleLaunchGallery = async () => {
    setShowPhotoModal(false);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Gallery Permission Required',
            'Please enable photo library access in your device settings to choose a profile photo.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Unable to open photo gallery.');
    }
  };

  const handleRemovePhoto = () => {
    setShowPhotoModal(false);
    setPhotoUri('');
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = photoUri;

      // If user selected a new local photo file, upload it to storage
      if (photoUri && (photoUri.startsWith('file://') || photoUri.startsWith('content://') || photoUri.startsWith('ph://'))) {
        setPhotoUploading(true);
        try {
          const cleanPhone = (session?.mobile || 'client').replace(/[^0-9]/g, '').slice(-10);
          const uploadRes = await uploadDocumentToStorage({
            uri: photoUri,
            fileName: `profile-photo-${cleanPhone}-${Date.now()}.jpg`,
            storagePath: `clients/${cleanPhone}/profile-photo-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
          });

          if (uploadRes.success && uploadRes.fileUrl) {
            finalPhotoUrl = uploadRes.fileUrl;
          }
        } catch (uploadErr) {
          console.warn('Profile photo upload to cloud storage deferred:', uploadErr);
          // Keep local uri so client sees their updated photo
        } finally {
          setPhotoUploading(false);
        }
      }

      const updatedFields = {
        fullName: fullName.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        designation: designation.trim(),
        department: department.trim(),
        address: address.trim(),
        profilePhotoUrl: finalPhotoUrl,
        accountId,
      };

      await authService.updateUserProfile(
        session?.userId || clientId || 'usr-default',
        session?.role || 'CLIENT',
        updatedFields
      );

      const refreshed = await authService.checkExistingSession();
      const updatedSession: AuthSessionData = {
        ...(refreshed || session!),
        ...updatedFields,
        userId: session?.role === 'CLIENT' ? clientId : (refreshed?.userId || session?.userId || 'usr-default'),
        clientCode: session?.role === 'CLIENT' ? clientId : (refreshed?.clientCode || session?.clientCode),
        clientId: session?.role === 'CLIENT' ? clientId : (refreshed?.clientId || session?.clientId),
        accountId,
        profilePhotoUrl: finalPhotoUrl,
      };

      await authService.saveSession(updatedSession);
      onProfileUpdated(updatedSession);

      Alert.alert('Profile Saved', 'Your profile details have been updated successfully.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CL';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={styles.saveBtnTop}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#F05A22" />
            ) : (
              <Text style={styles.saveBtnTopText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar Section with Clean White & Orange Theme (No dark background) ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => setShowPhotoModal(true)}
              activeOpacity={0.85}
              accessibilityLabel="Change Profile Photo"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBtn}>
                <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarTapHint}>Tap photo to upload or change</Text>
          </View>

          {/* ── Section A: Registration-Locked Fields (Protected) ── */}
          <View style={styles.sectionHeaderRow}>
            <ShieldCheck size={16} color="#059669" />
            <Text style={styles.sectionHeaderTitle}>VERIFIED REGISTRATION DETAILS (READ-ONLY)</Text>
          </View>
          <Text style={styles.sectionHeaderSubtitle}>
            These verified parameters are locked to maintain permanent database audit integrity.
          </Text>

          {/* Account ID (Locked) */}
          <View style={styles.formGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Permanent Account ID</Text>
              <View style={styles.lockBadge}>
                <Lock size={10} color="#64748B" />
                <Text style={styles.lockBadgeText}>Locked</Text>
              </View>
            </View>
            <View style={[styles.inputContainer, styles.readOnlyContainer]}>
              <Lock size={16} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={[styles.textInput, styles.readOnlyText]}
                value={accountId}
                editable={false}
              />
            </View>
          </View>

          {/* Role-specific Permanent ID (Locked) */}
          <View style={styles.formGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>{roleSpecificLabel}</Text>
              <View style={styles.lockBadge}>
                <Lock size={10} color="#64748B" />
                <Text style={styles.lockBadgeText}>Locked</Text>
              </View>
            </View>
            <View style={[styles.inputContainer, styles.readOnlyContainer]}>
              <Lock size={16} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={[styles.textInput, styles.readOnlyText]}
                value={roleSpecificId}
                editable={false}
              />
            </View>
          </View>

          {/* Registered Mobile Number (Locked) */}
          <View style={styles.formGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Registered Mobile Number</Text>
              <View style={styles.lockBadge}>
                <Lock size={10} color="#64748B" />
                <Text style={styles.lockBadgeText}>Locked</Text>
              </View>
            </View>
            <View style={[styles.inputContainer, styles.readOnlyContainer]}>
              <Lock size={16} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={[styles.textInput, styles.readOnlyText]}
                value={session?.mobile ? `+91 ${session.mobile}` : '+91 98765 43210'}
                editable={false}
              />
            </View>
          </View>

          {/* Company GSTIN / PAN (Locked if present) */}
          {(registeredGstin || registeredPan) && (
            <View style={styles.formGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Verified Tax Identity (GSTIN / PAN)</Text>
                <View style={styles.lockBadge}>
                  <Lock size={10} color="#64748B" />
                  <Text style={styles.lockBadgeText}>Locked</Text>
                </View>
              </View>
              <View style={[styles.inputContainer, styles.readOnlyContainer]}>
                <Lock size={16} color="#94A3B8" style={styles.leadingIcon} />
                <TextInput
                  style={[styles.textInput, styles.readOnlyText]}
                  value={`${registeredGstin ? 'GST: ' + registeredGstin : ''}${registeredPan ? (registeredGstin ? '  |  ' : '') + 'PAN: ' + registeredPan : ''}`}
                  editable={false}
                />
              </View>
            </View>
          )}

          {/* ── Section B: Permitted Editable Profile Fields ── */}
          <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
            <User size={16} color="#F05A22" />
            <Text style={styles.sectionHeaderTitle}>EDITABLE PROFILE INFORMATION</Text>
          </View>
          <Text style={styles.sectionHeaderSubtitle}>
            Update your operational contact and enterprise details below.
          </Text>

          {/* Full Name */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <View style={styles.inputContainer}>
              <User size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter Full Name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Email Address */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="name@company.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Company / Organization */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Company / Organization Name</Text>
            <View style={styles.inputContainer}>
              <Building2 size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Organization Name"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Designation */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Designation / Role Title</Text>
            <View style={styles.inputContainer}>
              <Briefcase size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={designation}
                onChangeText={setDesignation}
                placeholder="Your Role (e.g. Logistics Head, Dispatch Manager)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Department */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Department</Text>
            <View style={styles.inputContainer}>
              <Briefcase size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={department}
                onChangeText={setDepartment}
                placeholder="Department (e.g. Supply Chain, Commercial)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Operational Hub / Address */}
          <View style={styles.formGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Operational Hub / Address</Text>
              {onNavigateToSavedAddresses && (
                <TouchableOpacity
                  onPress={onNavigateToSavedAddresses}
                  style={styles.addAddressLink}
                >
                  <Plus size={12} color="#F05A22" />
                  <Text style={styles.addAddressLinkText}>Saved Hubs</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inputContainer}>
              <MapPin size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Hub Location / State / Address"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Primary Save Button */}
          <TouchableOpacity
            style={styles.saveBtnBottom}
            onPress={handleSave}
            disabled={saving || photoUploading}
            activeOpacity={0.85}
          >
            {saving || photoUploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Save size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnBottomText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Photo Picker Modal (Camera, Gallery, Cancel) ── */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Profile Photo</Text>
              <TouchableOpacity
                onPress={() => setShowPhotoModal(false)}
                style={styles.closeBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.photoOptionRow}
              onPress={handleLaunchCamera}
              activeOpacity={0.75}
            >
              <View style={[styles.photoOptionIcon, { backgroundColor: '#FFF7ED' }]}>
                <Camera size={20} color="#F05A22" />
              </View>
              <View style={styles.photoOptionTextCol}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionDesc}>Capture new photo using camera</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.modalDivider} />

            <TouchableOpacity
              style={styles.photoOptionRow}
              onPress={handleLaunchGallery}
              activeOpacity={0.75}
            >
              <View style={[styles.photoOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                <ImageIcon size={20} color="#2563EB" />
              </View>
              <View style={styles.photoOptionTextCol}>
                <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoOptionDesc}>Select an existing image from device</Text>
              </View>
            </TouchableOpacity>

            {Boolean(photoUri) && (
              <>
                <View style={styles.modalDivider} />
                <TouchableOpacity
                  style={styles.photoOptionRow}
                  onPress={handleRemovePhoto}
                  activeOpacity={0.75}
                >
                  <View style={[styles.photoOptionIcon, { backgroundColor: '#FEF2F2' }]}>
                    <Trash2 size={20} color="#DC2626" />
                  </View>
                  <View style={styles.photoOptionTextCol}>
                    <Text style={[styles.photoOptionTitle, { color: '#DC2626' }]}>Remove Photo</Text>
                    <Text style={styles.photoOptionDesc}>Reset to default initials placeholder</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowPhotoModal(false)}
              activeOpacity={0.75}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172B4D',
  },
  saveBtnTop: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtnTopText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F05A22',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  avatarInitials: {
    color: '#F05A22',
    fontSize: 30,
    fontWeight: '800',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F05A22',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarTapHint: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  sectionHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 15,
  },
  formGroup: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  addAddressLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addAddressLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F05A22',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  readOnlyContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  readOnlyText: {
    color: '#64748B',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  leadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#172B4D',
    height: '100%',
  },
  saveBtnBottom: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 10,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnBottomText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  photoOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  photoOptionTextCol: {
    flex: 1,
  },
  photoOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
