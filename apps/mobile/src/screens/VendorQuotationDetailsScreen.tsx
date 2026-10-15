import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  ChevronLeft,
  DollarSign,
  Clock,
  CheckCircle2,
  MapPin,
  Package,
  Truck,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';

interface VendorQuotationDetailsScreenProps {
  quotation: any;
  onBack: () => void;
  onNavigateToBooking?: () => void;
}

export const VendorQuotationDetailsScreen: React.FC<VendorQuotationDetailsScreenProps> = ({
  quotation,
  onBack,
  onNavigateToBooking,
}) => {
  if (!quotation) return null;

  const isAwarded = quotation.status === 'AWARDED';

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>Quotation Details</Text>
              <Text style={styles.idSubText}>{quotation.id}</Text>
            </View>

            <View style={[styles.statusBadge, isAwarded && styles.badgeAwarded]}>
              {isAwarded ? (
                <CheckCircle2 size={12} color="#10B981" />
              ) : (
                <Clock size={12} color="#F59E0B" />
              )}
              <Text style={[styles.statusText, isAwarded && styles.textAwarded]}>
                {isAwarded ? 'AWARDED' : 'UNDER REVIEW'}
              </Text>
            </View>
          </View>

          {/* Rate Card */}
          <View style={styles.rateCard}>
            <Text style={styles.rateLabel}>SUBMITTED FREIGHT RATE</Text>
            <Text style={styles.rateValue}>₹{quotation.quotedRate?.toLocaleString('en-IN')}</Text>
            <Text style={styles.rateTerms}>Toll, Tarpaulin Cover & Driver Allowance Included</Text>
          </View>

          {/* Route Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CONSIGNMENT ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeItem}>
                <View style={styles.dotGold} />
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeHubLabel}>PICKUP</Text>
                  <Text style={styles.routeHubValue}>{quotation.fullPickup || quotation.route?.split('→')[0]}</Text>
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeItem}>
                <View style={styles.dotGreen} />
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeHubLabel}>DESTINATION</Text>
                  <Text style={styles.routeHubValue}>{quotation.fullDestination || quotation.route?.split('→')[1]}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Cargo Specs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CARGO SPECIFICATIONS</Text>
            </View>

            <View style={styles.specsRow}>
              <View style={styles.specBox}>
                <Text style={styles.specBoxLabel}>Material</Text>
                <Text style={styles.specBoxVal}>{quotation.material || 'Commercial Freight'}</Text>
              </View>

              <View style={styles.specBox}>
                <Text style={styles.specBoxLabel}>Capacity</Text>
                <Text style={styles.specBoxVal}>{quotation.capacityMt} MT</Text>
              </View>

              <View style={styles.specBox}>
                <Text style={styles.specBoxLabel}>Vehicle Type</Text>
                <Text style={styles.specBoxVal}>{quotation.vehicleType || '32 FT MXL'}</Text>
              </View>
            </View>
          </View>

          {/* If Awarded CTA */}
          {isAwarded && onNavigateToBooking && (
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={onNavigateToBooking}
              activeOpacity={0.85}
            >
              <Text style={styles.goldBtnText}>View Booking & Assign Fleet</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
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
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172B4D',
  },
  idSubText: {
    color: '#64748B',
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAwarded: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  textAwarded: {
    color: '#10B981',
  },
  rateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  rateLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rateValue: {
    color: '#F05A22',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  rateTerms: {
    color: '#64748B',
    fontSize: 11,
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
    gap: 6,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dotGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  routeDivider: {
    width: 2,
    height: 14,
    backgroundColor: '#F1F5F9',
    marginLeft: 3,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeHubLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  routeHubValue: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  specsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  specBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
  },
  specBoxLabel: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 2,
  },
  specBoxVal: {
    color: '#172B4D',
    fontSize: 12,
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
