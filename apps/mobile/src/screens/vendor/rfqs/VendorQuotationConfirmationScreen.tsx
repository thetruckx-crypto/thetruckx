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
  CheckCircle2,
  FileText,
  Clock,
  ArrowRight,
  Package,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';

interface VendorQuotationConfirmationScreenProps {
  quotationId: string;
  quotedRate: number;
  transitDays: number;
  onViewMyQuotes: () => void;
  onBackToBoard: () => void;
}

export const VendorQuotationConfirmationScreen: React.FC<VendorQuotationConfirmationScreenProps> = ({
  quotationId,
  quotedRate,
  transitDays,
  onViewMyQuotes,
  onBackToBoard,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={190} />
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={54} color="#10B981" strokeWidth={2.5} />
          </View>

          <Text style={styles.titleText}>
            Quotation <Text style={styles.goldText}>Dispatched!</Text>
          </Text>

          <Text style={styles.subText}>
            Your freight rate has been submitted to TRUCKS operations and transmitted to the client evaluation panel.
          </Text>

          {/* Receipt Card */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>QUOTATION ID:</Text>
              <Text style={styles.receiptId}>{quotationId}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>OFFERED RATE:</Text>
              <Text style={styles.rateValue}>₹{quotedRate.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>TRANSIT TIME:</Text>
              <Text style={styles.receiptVal}>{transitDays} Business Days</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>STATUS:</Text>
              <View style={styles.statusPill}>
                <Clock size={12} color="#F59E0B" />
                <Text style={styles.statusText}>Under Client Review</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.goldBtn} onPress={onViewMyQuotes} activeOpacity={0.85}>
            <FileText size={18} color="#FFFFFF" />
            <Text style={styles.goldBtnText}>View My Active Quotations</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onBackToBoard} activeOpacity={0.8}>
            <Package size={16} color="#D4D6DB" />
            <Text style={styles.secondaryBtnText}>Browse Other Freight Loads</Text>
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
    paddingTop: 16,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 6,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  receiptLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  receiptId: {
    color: '#F05A22',
    fontSize: 14,
    fontWeight: '800',
  },
  rateValue: {
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
  },
  receiptVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  goldBtn: {
    width: '100%',
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
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
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '700',
  },
});
