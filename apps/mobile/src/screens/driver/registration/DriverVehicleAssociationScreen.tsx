import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  Building2,
  CheckCircle2,
  ArrowRight,
  Search,
  Check,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { driverService } from '../../../services/driverService';

interface DriverVehicleAssociationScreenProps {
  onBack: () => void;
  onNext: () => void;
}

export const DriverVehicleAssociationScreen: React.FC<DriverVehicleAssociationScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [associationType, setAssociationType] = useState<'VENDOR_FLEET' | 'INDEPENDENT_ATTACHED'>('VENDOR_FLEET');
  const [transporters, setTransporters] = useState<{ id: string; name: string; city?: string }[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined);
  const [selectedVendorName, setSelectedVendorName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driverService.getRegisteredTransporters().then((list) => {
      setTransporters(list);
      if (list.length > 0) {
        setSelectedVendorId(list[0].id);
        setSelectedVendorName(list[0].name);
      }
      setLoading(false);
    });

    driverService.getDraftForm().then((draft) => {
      if (draft) {
        if (draft.associationType) setAssociationType(draft.associationType);
        if (draft.primaryVendorId) setSelectedVendorId(draft.primaryVendorId);
        if (draft.transporterName) setSelectedVendorName(draft.transporterName);
        if (draft.vehicleRegistrationNumber) setVehicleRegNumber(draft.vehicleRegistrationNumber);
      }
    });
  }, []);

  const filteredTransporters = transporters.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.city && t.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleNext = async () => {
    if (associationType === 'VENDOR_FLEET' && !selectedVendorId) {
      Alert.alert('Transporter Required', 'Please select the registered transport company or fleet you operate with.');
      return;
    }

    if (associationType === 'INDEPENDENT_ATTACHED' && !vehicleRegNumber.trim()) {
      Alert.alert('Vehicle Number Required', 'Please enter your commercial truck registration number (e.g. AS 01 GC 4819).');
      return;
    }

    await driverService.saveDraftForm({
      associationType,
      primaryVendorId: associationType === 'VENDOR_FLEET' ? selectedVendorId : undefined,
      transporterName: associationType === 'VENDOR_FLEET' ? selectedVendorName : 'Independent Fleet',
      vehicleRegistrationNumber: vehicleRegNumber.trim().toUpperCase(),
    });

    onNext();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
          {/* Top Banner */}
          <View style={styles.topWrap}>
            <ScenicHeroBanner height={170} />
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <BrandLogoHeader theme="light" size="sm" />
            </View>
          </View>

          <View style={styles.contentWrap}>
            {/* Step Progress Pill */}
            <View style={styles.stepIndicatorRow}>
              <Text style={styles.stepIndicatorText}>STEP 3 OF 4 • FLEET & VEHICLE LINK</Text>
            </View>

            <View style={styles.headingWrap}>
              <Text style={styles.titleText}>
                Fleet & <Text style={styles.goldText}>Transporter Association</Text>
              </Text>
              <Text style={styles.subText}>
                Connect with an approved TRUCKS transporter or register as an independent commercial pilot.
              </Text>
            </View>

            {/* Association Type Selector */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  associationType === 'VENDOR_FLEET' && styles.tabBtnActive,
                ]}
                onPress={() => setAssociationType('VENDOR_FLEET')}
              >
                <Building2 size={15} color={associationType === 'VENDOR_FLEET' ? '#FFFFFF' : '#A0A2A8'} />
                <Text
                  style={[
                    styles.tabBtnText,
                    associationType === 'VENDOR_FLEET' && styles.tabBtnTextActive,
                  ]}
                >
                  Transporter Fleet
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  associationType === 'INDEPENDENT_ATTACHED' && styles.tabBtnActive,
                ]}
                onPress={() => setAssociationType('INDEPENDENT_ATTACHED')}
              >
                <Truck size={15} color={associationType === 'INDEPENDENT_ATTACHED' ? '#FFFFFF' : '#A0A2A8'} />
                <Text
                  style={[
                    styles.tabBtnText,
                    associationType === 'INDEPENDENT_ATTACHED' && styles.tabBtnTextActive,
                  ]}
                >
                  Independent Owner
                </Text>
              </TouchableOpacity>
            </View>

            {associationType === 'VENDOR_FLEET' ? (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Building2 size={16} color="#F05A22" />
                  <Text style={styles.cardHeaderText}>Select Operating Transporter</Text>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                  <Search size={15} color="#7C7E86" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search transporter or hub..."
                    placeholderTextColor="#5C5E66"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {loading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#F05A22" />
                  </View>
                ) : (
                  <View style={styles.transporterList}>
                    {filteredTransporters.map((item) => {
                      const isSelected = selectedVendorId === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.transporterItem,
                            isSelected && styles.transporterItemActive,
                          ]}
                          onPress={() => {
                            setSelectedVendorId(item.id);
                            setSelectedVendorName(item.name);
                          }}
                        >
                          <View style={styles.transporterIconWrap}>
                            <Building2 size={16} color={isSelected ? '#F05A22' : '#7C7E86'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.transporterName, isSelected && styles.transporterNameActive]}>
                              {item.name}
                            </Text>
                            {item.city && (
                              <Text style={styles.transporterCity}>Hub: {item.city}</Text>
                            )}
                          </View>
                          {isSelected && (
                            <View style={styles.checkCircle}>
                              <Check size={14} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Truck size={16} color="#F05A22" />
                  <Text style={styles.cardHeaderText}>Independent Commercial Truck</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Vehicle Registration Plate No. *</Text>
                  <View style={styles.inputWrap}>
                    <Truck size={15} color="#7C7E86" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. AS 01 GC 4819"
                      placeholderTextColor="#5C5E66"
                      autoCapitalize="characters"
                      value={vehicleRegNumber}
                      onChangeText={setVehicleRegNumber}
                    />
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.infoBoxText}>
                    As an independent pilot, trip earnings and FASTag toll advances will be credited directly to your bank account upon POD submission.
                  </Text>
                </View>
              </View>
            )}

            {/* Next CTA */}
            <TouchableOpacity
              style={styles.goldPillBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.goldPillText}>Save & Proceed to Documents</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomGoldWings />
      </KeyboardAvoidingView>
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
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  stepIndicatorRow: {
    alignSelf: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  stepIndicatorText: {
    color: '#F05A22',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
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
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#F05A22',
  },
  tabBtnText: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13,
  },
  transporterList: {
    gap: 8,
  },
  transporterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  transporterItemActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F05A22',
  },
  transporterIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#14161C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transporterName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  transporterNameActive: {
    color: '#172B4D',
    fontWeight: '700',
  },
  transporterCity: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 12,
  },
  infoBoxText: {
    flex: 1,
    color: '#D1FAE5',
    fontSize: 11,
    lineHeight: 16,
  },
  goldPillBtn: {
    backgroundColor: '#F05A22',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
