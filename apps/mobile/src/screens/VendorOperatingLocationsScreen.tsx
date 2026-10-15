import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Navigation,
  MapPin,
  Check,
  Shield,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorOperatingLocationsScreenProps {
  onBack: () => void;
  onNext: (data: { operatingHubs: string[]; interstatePermits: string[] }) => void;
}

export const VendorOperatingLocationsScreen: React.FC<VendorOperatingLocationsScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [selectedHubs, setSelectedHubs] = useState<string[]>(['Guwahati', 'Kolkata', 'Siliguri']);
  const [selectedPermits, setSelectedPermits] = useState<string[]>(['All India National Permit (NP)']);

  const hubsList = [
    { id: 'ghy', name: 'Guwahati (Gateway Hub)' },
    { id: 'slg', name: 'Siliguri (North Bengal)' },
    { id: 'ccu', name: 'Kolkata (Dankuni Port)' },
    { id: 'del', name: 'Delhi / NCR' },
    { id: 'bom', name: 'Mumbai / Bhiwandi' },
    { id: 'hyd', name: 'Hyderabad Logistics Hub' },
    { id: 'agt', name: 'Agartala (Tripura Corridor)' },
    { id: 'dmp', name: 'Dimapur (Nagaland)' },
    { id: 'shl', name: 'Shillong (Meghalaya)' },
  ];

  const permitsList = [
    'All India National Permit (NP)',
    'North East Regional Composite Permit',
    'State Heavy Goods Permit',
  ];

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.operatingHubs && draft.operatingHubs.length > 0) {
        setSelectedHubs(draft.operatingHubs);
      }
      if (draft?.interstatePermits && draft.interstatePermits.length > 0) {
        setSelectedPermits(draft.interstatePermits);
      }
    })();
  }, []);

  const toggleHub = (name: string) => {
    if (selectedHubs.includes(name)) {
      if (selectedHubs.length === 1) {
        Alert.alert('Required Selection', 'Please retain at least one operating hub.');
        return;
      }
      setSelectedHubs(selectedHubs.filter((h) => h !== name));
    } else {
      setSelectedHubs([...selectedHubs, name]);
    }
  };

  const togglePermit = (permit: string) => {
    if (selectedPermits.includes(permit)) {
      if (selectedPermits.length === 1) {
        Alert.alert('Required Selection', 'Please select at least one commercial permit type.');
        return;
      }
      setSelectedPermits(selectedPermits.filter((p) => p !== permit));
    } else {
      setSelectedPermits([...selectedPermits, permit]);
    }
  };

  const handleContinue = async () => {
    await vendorService.saveDraftForm({
      operatingHubs: selectedHubs,
      interstatePermits: selectedPermits,
    });

    onNext({
      operatingHubs: selectedHubs,
      interstatePermits: selectedPermits,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
        </View>

        {/* Stepper Progress */}
        <View style={styles.stepperWrap}>
          <View style={styles.stepperHeader}>
            <Text style={styles.stepBadge}>STEP 4 OF 7</Text>
            <Text style={styles.stepTitle}>Operating Corridors</Text>
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
              Select the logistics hubs and interstate transit lanes your vehicles actively operate on.
            </Text>
          </View>

          {/* Operating Hubs Selection */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ACTIVE REGIONAL HUBS (SELECT ALL THAT APPLY) *</Text>
            </View>

            <View style={styles.pillsWrap}>
              {hubsList.map((h) => {
                const isSelected = selectedHubs.includes(h.name);
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.hubPill, isSelected && styles.hubPillActive]}
                    onPress={() => toggleHub(h.name)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.hubPillText, isSelected && styles.hubPillTextActive]}>
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Interstate Permits */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Shield size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>COMMERCIAL ROUTE PERMITS *</Text>
            </View>

            <View style={styles.permitList}>
              {permitsList.map((p) => {
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
    bottom: 6,
    alignSelf: 'center',
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
    marginBottom: 14,
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
  pillsWrap: {
    gap: 8,
  },
  hubPill: {
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
  hubPillActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  hubPillText: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  hubPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    color: '#FFFFFF',
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
});
