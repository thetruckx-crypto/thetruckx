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
  Package,
  Check,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorTransportServicesScreenProps {
  onBack: () => void;
  onNext: (data: { servicesOffered: string[] }) => void;
}

export const VendorTransportServicesScreen: React.FC<VendorTransportServicesScreenProps> = ({
  onBack,
  onNext,
}) => {
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'Full Truckload (FTL)',
    'Containerized High-Value Transit',
  ]);

  const serviceOptions = [
    {
      id: 'ftl',
      title: 'Full Truckload (FTL)',
      desc: 'Point-to-point dedicated commercial truckloads across trunk routes.',
    },
    {
      id: 'ptl',
      title: 'Part Truckload (PTL / LTL)',
      desc: 'Consolidated parcel and partial cargo movement through transshipment hubs.',
    },
    {
      id: 'odc',
      title: 'ODC & Heavy Project Cargo',
      desc: 'Over-dimensional equipment and hydraulic multi-axle machinery transit.',
    },
    {
      id: 'exp',
      title: 'Express Dedicated Transit',
      desc: 'Time-critical guaranteed delivery schedule with dual-driver teams.',
    },
    {
      id: 'cnt',
      title: 'Containerized High-Value Transit',
      desc: 'Sealed container haulage with zero mid-transit handling and digital seals.',
    },
  ];

  useEffect(() => {
    (async () => {
      const draft = await vendorService.getDraftForm();
      if (draft?.servicesOffered && draft.servicesOffered.length > 0) {
        setSelectedServices(draft.servicesOffered);
      }
    })();
  }, []);

  const toggleService = (title: string) => {
    if (selectedServices.includes(title)) {
      if (selectedServices.length === 1) {
        Alert.alert('Required Selection', 'Please retain at least one transport service capability.');
        return;
      }
      setSelectedServices(selectedServices.filter((s) => s !== title));
    } else {
      setSelectedServices([...selectedServices, title]);
    }
  };

  const handleContinue = async () => {
    await vendorService.saveDraftForm({
      servicesOffered: selectedServices,
    });

    onNext({
      servicesOffered: selectedServices,
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
            <Text style={styles.stepBadge}>STEP 6 OF 7</Text>
            <Text style={styles.stepTitle}>Transport Capabilities</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '84%' }]} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Service <Text style={styles.goldText}>Offerings</Text>
            </Text>
            <Text style={styles.subText}>
              Select the transport service lines you actively execute for national manufacturers and shippers.
            </Text>
          </View>

          {/* Service Cards */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>OFFERED TRANSPORT MODES *</Text>
            </View>

            <View style={styles.serviceCol}>
              {serviceOptions.map((opt) => {
                const isSelected = selectedServices.includes(opt.title);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                    onPress={() => toggleService(opt.title)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <View style={styles.serviceTextWrap}>
                      <Text style={[styles.serviceTitle, isSelected && styles.serviceTitleActive]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.serviceDesc}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SLA Standard Notice */}
          <View style={styles.slaBadge}>
            <ShieldCheck size={16} color="#F05A22" />
            <Text style={styles.slaText}>
              Contracted vendors adhere to NECL 98%+ On-Time Placement & Delivery Guarantee standards.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity style={styles.goldBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.goldBtnText}>Continue to Document Upload</Text>
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
  serviceCol: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  serviceCardActive: {
    borderColor: '#F05A22',
    backgroundColor: '#FFF7ED',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  serviceTextWrap: {
    flex: 1,
  },
  serviceTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  serviceTitleActive: {
    color: '#FFFFFF',
  },
  serviceDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  slaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  slaText: {
    flex: 1,
    color: '#F05A22',
    fontSize: 11,
    lineHeight: 16,
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
