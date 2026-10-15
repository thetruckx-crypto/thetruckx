import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Package,
  Truck,
  Building2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { vendorService } from '../services/vendorService';

interface VendorRequirementDetailsScreenProps {
  requirementId: string;
  onBack: () => void;
  onSubmitQuotation: (req: any) => void;
}

export const VendorRequirementDetailsScreen: React.FC<VendorRequirementDetailsScreenProps> = ({
  requirementId,
  onBack,
  onSubmitQuotation,
}) => {
  const [requirement, setRequirement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    try {
      const data = await vendorService.getRequirementDetails(requirementId);
      setRequirement(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching Requirement Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!requirement) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <Text style={styles.loadingText}>Requirement not found or expired.</Text>
          <TouchableOpacity style={styles.backLink} onPress={onBack}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.reqHeaderRow}>
            <View>
              <Text style={styles.reqIdText}>{requirement.id}</Text>
              <Text style={styles.reqDateText}>
                Posted on {new Date(requirement.createdAt || Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={13} color="#10B981" />
              <Text style={styles.verifiedText}>Verified Shipper</Text>
            </View>
          </View>

          {/* Route Section Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ORIGIN & DESTINATION ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeStop}>
                <View style={styles.dotGold} />
                <View style={styles.stopInfo}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{requirement.pickupAddress}</Text>
                  {requirement.pickupPincode && (
                    <Text style={styles.pinText}>PIN: {requirement.pickupPincode}</Text>
                  )}
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStop}>
                <View style={styles.dotGreen} />
                <View style={styles.stopInfo}>
                  <Text style={styles.stopLabel}>DELIVERY DESTINATION</Text>
                  <Text style={styles.stopAddress}>{requirement.destinationAddress}</Text>
                  {requirement.destinationPincode && (
                    <Text style={styles.pinText}>PIN: {requirement.destinationPincode}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Cargo & Fleet Specs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNMENT & VEHICLE REQUIRED</Text>
            </View>

            <View style={styles.specsGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Commodity Material:</Text>
                <Text style={styles.specValue}>{requirement.materialType || 'Industrial Cargo'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Required Capacity:</Text>
                <Text style={styles.specValue}>{requirement.requiredCapacityMt} MT</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Vehicle Type:</Text>
                <Text style={styles.specValue}>{requirement.vehicleType || '32 FT Multi-Axle'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>Loading Schedule:</Text>
                <Text style={styles.specValue}>
                  {requirement.loadingDatetime
                    ? new Date(requirement.loadingDatetime).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Immediate / Next Day'}
                </Text>
              </View>
            </View>

            {requirement.specialInstructions && (
              <View style={styles.specialNoteBox}>
                <AlertCircle size={14} color="#F05A22" />
                <Text style={styles.specialNoteText}>
                  Special Notes: {requirement.specialInstructions}
                </Text>
              </View>
            )}
          </View>

          {/* Shipper Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNOR ENTERPRISE</Text>
            </View>

            <View style={styles.shipperRow}>
              <Text style={styles.shipperName}>{requirement.clientName}</Text>
              <Text style={styles.shipperCity}>{requirement.clientCity || 'National Logistics Hub'}</Text>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.goldBtn}
            onPress={() => onSubmitQuotation(requirement)}
            activeOpacity={0.85}
          >
            <Text style={styles.goldBtnText}>Submit Quotation / Bid</Text>
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
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#172B4D',
    marginTop: 12,
    fontSize: 13,
  },
  backLink: {
    marginTop: 12,
    padding: 8,
  },
  backLinkText: {
    color: '#F05A22',
    fontSize: 14,
    fontWeight: '700',
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
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqIdText: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '800',
  },
  reqDateText: {
    color: '#64748B',
    fontSize: 11,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeCol: {
    gap: 8,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotGold: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  routeDivider: {
    width: 2,
    height: 16,
    backgroundColor: '#F1F5F9',
    marginLeft: 4,
  },
  stopInfo: {
    flex: 1,
  },
  stopLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
  },
  stopAddress: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  pinText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  specsGrid: {
    gap: 8,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  specValue: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  specialNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  specialNoteText: {
    flex: 1,
    color: '#F05A22',
    fontSize: 11,
    lineHeight: 16,
  },
  shipperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shipperName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
  },
  shipperCity: {
    color: '#64748B',
    fontSize: 12,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
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
