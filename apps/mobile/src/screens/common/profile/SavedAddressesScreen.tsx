import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Building,
  User,
  Phone,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Bookmark,
} from 'lucide-react-native';
import { clientService, SavedAddressItem } from '../../../services/clientService';
import { pincodeService } from '../../../services/pincodeService';

interface SavedAddressesScreenProps {
  clientId?: string;
  onBack: () => void;
  onSelectAddress?: (address: SavedAddressItem) => void;
}

export const SavedAddressesScreen: React.FC<SavedAddressesScreenProps> = ({
  clientId,
  onBack,
  onSelectAddress,
}) => {
  const [addresses, setAddresses] = useState<SavedAddressItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const data = await clientService.getSavedAddresses(clientId);
      setAddresses(data);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setLabel('');
    setContactPerson('');
    setPhone('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setPinFeedback(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: SavedAddressItem) => {
    setEditingId(item.id);
    setLabel(item.label);
    setContactPerson(item.contactPerson);
    setPhone(item.phone);
    setAddress(item.address);
    setCity(item.city);
    setState(item.state || '');
    setPincode(item.pincode);
    setPinFeedback(null);
    setShowModal(true);
  };

  const handlePincodeChange = async (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);

    if (clean.length === 6) {
      setPincodeLoading(true);
      setPinFeedback(null);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setCity(res.data.city);
          setState(res.data.state);
          setPinFeedback(`✓ ${res.data.city}, ${res.data.state}`);
        } else {
          setPinFeedback('PIN lookup: Please confirm City & State manually.');
        }
      } catch {
        setPinFeedback('Please enter City & State manually.');
      } finally {
        setPincodeLoading(false);
      }
    } else {
      setPinFeedback(null);
    }
  };

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert('Required Field', 'Please enter an address label (e.g. Factory Gate 1, Primary Warehouse).');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please enter street address / plot details.');
      return;
    }
    const pinCheck = pincodeService.validatePincodeFormat(pincode);
    if (!pinCheck.isValid) {
      Alert.alert('Invalid PIN Code', pinCheck.error || 'Please enter a valid 6-digit PIN code.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required Field', 'Please enter City.');
      return;
    }

    const newItem: SavedAddressItem = {
      id: editingId || `addr-${Date.now().toString().slice(-6)}`,
      label: label.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: false,
    };

    const updated = await clientService.saveAddress(newItem, clientId);
    setAddresses(updated);
    setShowModal(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Address', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await clientService.deleteAddress(id, clientId);
          setAddresses(updated);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Saved Addresses</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
          <Plus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Screen Title */}
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Saved Hubs & Addresses</Text>
        <Text style={styles.headerSubtitle}>
          Manage factory yards, warehouses, and client dispatch centers
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {addresses.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.labelRow}>
                <Building size={17} color="#F05A22" />
                <Text style={styles.labelTitle}>{item.label}</Text>
                {item.isDefault && (
                  <View style={styles.defaultPill}>
                    <Text style={styles.defaultText}>Primary</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}>
                  <Edit2 size={15} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.label)} style={styles.iconBtn}>
                  <Trash2 size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.addressText}>{item.address}</Text>
            <Text style={styles.cityPin}>
              {item.city}, Assam — PIN {item.pincode}
            </Text>

            <View style={styles.contactRow}>
              <User size={13} color="#64748B" />
              <Text style={styles.contactText}>
                {item.contactPerson || 'Dispatch Officer'} • {item.phone || '+91 98765 12345'}
              </Text>
            </View>

            {onSelectAddress && (
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => onSelectAddress(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.selectBtnText}>Select for Transport Requirement</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {addresses.length === 0 && !loading && (
          <View style={styles.emptyWrap}>
            <MapPin size={46} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Saved Addresses Yet</Text>
            <Text style={styles.emptySub}>
              Save your frequent warehouses and hubs for 1-tap requirement creation.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Address Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Hub Address' : 'Add New Hub Address'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Hub Label / Facility Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Guwahati Plant 1 / Dankuni Yard"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Full Street Address *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Plot/Gate number, Industrial Area, Landmark"
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>PIN Code *</Text>
                  <View style={styles.pinInputRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={pincode}
                      onChangeText={handlePincodeChange}
                      placeholder="e.g. 781028"
                      keyboardType="numeric"
                      maxLength={6}
                      placeholderTextColor="#94A3B8"
                    />
                    {pincodeLoading && (
                      <ActivityIndicator size="small" color="#F05A22" style={styles.pinSpinner} />
                    )}
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. Guwahati"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {pinFeedback && (
                <Text style={styles.pinFeedbackText}>{pinFeedback}</Text>
              )}

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput
                  style={styles.textInput}
                  value={state}
                  onChangeText={setState}
                  placeholder="e.g. Assam"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Contact Person</Text>
                  <TextInput
                    style={styles.textInput}
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    placeholder="Manager Name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 98765..."
                    keyboardType="phone-pad"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.88}>
              <Text style={styles.saveBtnText}>Save Address</Text>
            </TouchableOpacity>
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
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1931',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1931',
  },
  defaultPill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  cityPin: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  contactText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  selectBtn: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  selectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A1931',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 49, 0.65)',
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
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A1931',
  },
  inputWrap: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 13.5,
    color: '#0A1931',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  saveBtn: {
    height: 50,
    backgroundColor: '#F05A22',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinSpinner: {
    position: 'absolute',
    right: 12,
  },
  pinFeedbackText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
});
