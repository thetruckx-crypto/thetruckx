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
  Truck,
  Check,
  Radio,
  RadioTower,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorFleetInfoScreenProps {
  onBack: () => void;
  onNext: (data: { fleetStrength: string; truckCategories: string[] }) => void;
}

export const VendorFleetInfoScreen: React.FC<VendorFleetInfoScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [fleetStrength, setFleetStrength] = useState('6 - 20 Trucks');
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([
    '32 FT Multi-Axle (25 MT)',
    '20 FT Container (12 MT)',
  ]);
  const [gpsCoverage, setGpsCoverage] = useState('100% Real-Time GPS Tracking');

  const fleetOptions = ['1 - 5 Trucks', '6 - 20 Trucks', '21 - 50 Trucks', '50+ Heavy Lorries'];

  const truckCategories = [
    { id: '32mxl', name: '32 FT Multi-Axle (25 MT)' },
    { id: '32sxl', name: '32 FT Single-Axle (15 MT)' },
    { id: '20cnt', name: '20 FT Container (12 MT)' },
    { id: '40trl', name: '40 FT Trailer (35 MT)' },
    { id: 'open', name: 'Open Body Truck (16 MT)' },
    { id: 'lcv', name: 'LCV 14 FT (4 MT)' },
  ];

  const gpsOptions = [
    '100% Real-Time GPS Tracking',
    'Driver Smartphone Tracking',
    'FASTag & Toll Gate Tracking',
  ];

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.fleetStrength) setFleetStrength(draft.fleetStrength);
      if (draft?.truckCategories && draft.truckCategories.length > 0) {
        setSelectedTrucks(draft.truckCategories);
      }
    })();
  }, []);

  const toggleTruck = (name: string) => {
    if (selectedTrucks.includes(name)) {
      if (selectedTrucks.length === 1) {
        Alert.alert('Required Selection', 'Please retain at least one truck type.');
        return;
      }
      setSelectedTrucks(selectedTrucks.filter((t) => t !== name));
    } else {
      setSelectedTrucks([...selectedTrucks, name]);
    }
  };

  const handleContinue = async () => {
    await vendorService.saveDraftForm({
      fleetStrength,
      truckCategories: selectedTrucks,
    });

    onNext({
      fleetStrength,
      truckCategories: selectedTrucks,
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
            <Text style={styles.stepBadge}>STEP 5 OF 7</Text>
            <Text style={styles.stepTitle}>Fleet Capacity</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '70%' }]} />
          </View>
        </View>

        {/* Form Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Fleet <Text style={styles.goldText}>Strength</Text>
            </Text>
            <Text style={styles.subText}>
              Specify your commercial lorry count and vehicle types for matching tailored high-value loads.
            </Text>
          </View>

          {/* Active Fleet Strength */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>TOTAL ACTIVE FLEET COUNT *</Text>
            </View>

            <View style={styles.fleetPillsRow}>
              {fleetOptions.map((opt) => {
                const isSelected = fleetStrength === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.fleetPill, isSelected && styles.fleetPillActive]}
                    onPress={() => setFleetStrength(opt)}
                  >
                    <Truck size={14} color={isSelected ? '#FFFFFF' : '#F05A22'} />
                    <Text style={[styles.fleetPillText, isSelected && styles.fleetPillTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Truck Categories */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>COMMERCIAL TRUCK CATEGORIES *</Text>
            </View>

            <View style={styles.categoryList}>
              {truckCategories.map((c) => {
                const isSelected = selectedTrucks.includes(c.name);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                    onPress={() => toggleTruck(c.name)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Telematics / Tracking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <RadioTower size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>TELEMATICS & GPS COMPLIANCE *</Text>
            </View>

            <View style={styles.categoryList}>
              {gpsOptions.map((opt) => {
                const isSelected = gpsCoverage === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                    onPress={() => setGpsCoverage(opt)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radioDot}>
                      {isSelected && <View style={styles.radioDotInner} />}
                    </View>
                    <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Continue to Transport Services</Text>
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
  fleetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fleetPillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  fleetPillText: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  fleetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  categoryList: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  categoryText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
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
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
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
