import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  CheckCircle2,
  Truck,
  MapPin,
  Calendar,
  FileCheck2,
  Home,
  History,
  ShieldCheck,
  CreditCard,
  ArrowRight,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { driverService } from '../services/driverService';
import { DriverTripItem } from '../types';

interface DriverTripCompletionScreenProps {
  tripId: string;
  onGoToDashboard: () => void;
  onGoToTripHistory: () => void;
}

export const DriverTripCompletionScreen: React.FC<DriverTripCompletionScreenProps> = ({
  tripId,
  onGoToDashboard,
  onGoToTripHistory,
}) => {
  const [trip, setTrip] = useState<DriverTripItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driverService.getTripDetails(tripId).then((data) => {
      setTrip(data);
      setLoading(false);
    });
  }, [tripId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={190} />
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {/* Big Checkmark */}
          <View style={styles.iconCircle}>
            <CheckCircle2 size={42} color="#10B981" />
          </View>

          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Trip Closed & <Text style={styles.goldText}>Delivered!</Text>
            </Text>
            <Text style={styles.subText}>
              Consignment successfully delivered with stamped e-POD verification on record.
            </Text>
          </View>

          {/* Settlement / Receipt Card */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptLabel}>SETTLEMENT RECEIPT</Text>
              <Text style={styles.receiptId}>
                #{tripId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
              </Text>
            </View>

            <View style={styles.routeRow}>
              <View style={styles.cityCol}>
                <Text style={styles.nodeLabel}>ORIGIN</Text>
                <Text style={styles.cityName}>{trip?.origin || 'Visakhapatnam'}</Text>
              </View>
              <Truck size={18} color="#F05A22" />
              <View style={[styles.cityCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.nodeLabel}>DESTINATION</Text>
                <Text style={styles.cityName}>{trip?.destination || 'Hyderabad'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>Consigned Cargo:</Text>
              <Text style={styles.value}>{trip?.material || 'Heavy Machinery'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Delivered Vehicle:</Text>
              <Text style={styles.value}>{trip?.vehicleNumber || 'AP 39 AB 1234'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>e-POD Status:</Text>
              <Text style={[styles.value, { color: '#10B981' }]}>STAMP VERIFIED & CLOSED</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Freight Payout:</Text>
              <Text style={[styles.value, { color: '#F05A22', fontWeight: '800' }]}>
                ₹{trip?.rate || '28,500'} (Settlement Approved)
              </Text>
            </View>
          </View>

          {/* Next Actions */}
          <TouchableOpacity
            style={styles.goldPillBtn}
            onPress={onGoToDashboard}
            activeOpacity={0.85}
          >
            <Home size={18} color="#FFFFFF" />
            <Text style={styles.goldPillText}>Return to Driver Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onGoToTripHistory}
            activeOpacity={0.8}
          >
            <History size={16} color="#F05A22" />
            <Text style={styles.outlineBtnText}>View Past Completed Trips</Text>
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
  logoWrap: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 18,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  receiptId: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '800',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cityCol: {
    flex: 1,
  },
  nodeLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  cityName: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  label: {
    color: '#64748B',
    fontSize: 12,
  },
  value: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  goldPillBtn: {
    width: '100%',
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
    marginBottom: 12,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outlineBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(227, 180, 0, 0.04)',
  },
  outlineBtnText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
});
