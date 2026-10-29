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
} from 'lucide-react-native';
import { AuthSessionData, authService } from '../../../services/authService';
import { clientService } from '../../../services/clientService';
import { formatDisplayId } from '../../../utils/idGenerator';

interface EditProfileScreenProps {
  session: AuthSessionData | null;
  onBack: () => void;
  onProfileUpdated: (updatedSession: AuthSessionData) => void;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  session,
  onBack,
  onProfileUpdated,
}) => {
  const clientId =
    session?.clientCode ||
    session?.clientId ||
    (session?.role === 'CLIENT' && session?.userId
      ? (session.userId.startsWith('CLI-') || session.userId.startsWith('NECL-')
          ? session.userId
          : formatDisplayId('CL', session.userId, session.createdAt))
      : session?.userId || 'CLI-2026');

  const [fullName, setFullName] = useState(session?.fullName || '');
  const [email, setEmail] = useState(session?.email || '');
  const [companyName, setCompanyName] = useState(session?.companyName || '');
  const [designation, setDesignation] = useState(session?.designation || '');
  const [department, setDepartment] = useState(session?.department || '');
  const [address, setAddress] = useState(
    session?.address ||
    (session?.city ? `${session.city}${session.state ? ', ' + session.state : ''}${session.pincode ? ' - ' + session.pincode : ''}` : '')
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!session?.mobile) return;
        const cleanPhone = session.mobile.replace(/[^0-9]/g, '').slice(-10);

        // 1. Check local registry first (saved upon client registration)
        const registry = await authService.getLocalRegistry();
        const localRec = registry.find((u) => u.mobile === cleanPhone);
        if (localRec) {
          setFullName((prev) => prev || localRec.fullName || '');
          setEmail((prev) => prev || localRec.email || '');
          setCompanyName((prev) => prev || localRec.companyName || '');
          if (localRec.designation) setDesignation((prev) => prev || localRec.designation || '');
          if (localRec.department) setDepartment((prev) => prev || localRec.department || '');
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
            const serverAddr = status.registeredAddress || (status.city ? `${status.city}${status.state ? ', ' + status.state : ''}${status.pincode ? ' - ' + status.pincode : ''}` : '');
            if (serverAddr) setAddress((prev) => prev || serverAddr);
          }
        }
      } catch (e) {
        console.warn('Failed to load registered profile details:', e);
      }
    })();
  }, [session?.mobile]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const updatedFields = {
        fullName: fullName.trim(),
        email: email.trim(),
        companyName: companyName.trim(),
        designation: designation.trim(),
        department: department.trim(),
        address: address.trim(),
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
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NE';

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
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={() => Alert.alert('Photo', 'Profile avatar is synced with your TRUCKS account credentials.')}
              >
                <Camera size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>Account ID: {clientId}</Text>
          </View>

          {/* Form Fields */}
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

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Registered Mobile Number (Read-only)</Text>
            <View style={[styles.inputContainer, styles.readOnlyContainer]}>
              <TextInput
                style={[styles.textInput, styles.readOnlyText]}
                value={session?.mobile ? `+91 ${session.mobile}` : '+91 98765 43210'}
                editable={false}
              />
            </View>
          </View>

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

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Company / Organization</Text>
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

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Designation</Text>
            <View style={styles.inputContainer}>
              <Briefcase size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={designation}
                onChangeText={setDesignation}
                placeholder="Your Role / Designation"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Department</Text>
            <View style={styles.inputContainer}>
              <Briefcase size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={department}
                onChangeText={setDepartment}
                placeholder="Department (e.g. Logistics, Supply Chain)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Operational Hub / Address</Text>
            <View style={styles.inputContainer}>
              <MapPin size={18} color="#94A3B8" style={styles.leadingIcon} />
              <TextInput
                style={styles.textInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Hub Location / State"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Primary Save Button */}
          <TouchableOpacity
            style={styles.saveBtnBottom}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
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
    padding: 24,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0A1931',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatarInitials: {
    color: '#F05A22',
    fontSize: 28,
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
  avatarHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
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
    marginTop: 12,
    marginBottom: 10,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
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
});
