import React, { useState } from 'react';
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
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Star,
  Clock,
  Truck,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Calendar,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { clientService } from '../../../services/clientService';

interface QuotationDetailsScreenProps {
  quotation: any;
  requirementId: string;
  clientId?: string;
  onBack: () => void;
  onBookingCreated: (bookingId: string) => void;
}

export const QuotationDetailsScreen: React.FC<QuotationDetailsScreenProps> = ({
  quotation,
  requirementId,
  clientId,
  onBack,
  onBookingCreated,
}) => {
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [rejectInProgress, setRejectInProgress] = useState(false);

  const rate = quotation?.rate || 0;
  const baseFreight = Math.round(rate * 0.88);
  const tollAndFuel = Math.round(rate * 0.12);
  const isExpired = Boolean(
    quotation?.validity_expires_at &&
    new Date(quotation.validity_expires_at).getTime() < Date.now()
  );

  const handleAcceptAndBook = async () => {
    if (!quotation?.id || !clientId) {
      Alert.alert('Notice', 'Invalid quotation or client session.');
      return;
    }
    if (isExpired) {
      Alert.alert('Quotation Expired', 'This quotation has expired and can no longer be accepted. Please request an updated quotation.');
      return;
    }
    setBookingInProgress(true);
    try {
      const res = await clientService.acceptQuotationAndBook(
        requirementId,
        quotation.id,
        clientId,
        rate
      );

      if (res.success) {
        onBookingCreated(res.bookingId);
      } else {
        Alert.alert('Notice', res.message || 'Unable to confirm booking. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error processing quotation acceptance.');
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Decline Quotation',
      'Are you sure you want to decline this quotation? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setRejectInProgress(true);
            try {
              const ok = await clientService.rejectQuotation(quotation.id, clientId, 'Declined by client from quotation details');
              if (ok) {
                Alert.alert('Quotation Declined', 'You have declined this quotation.', [
                  { text: 'OK', onPress: onBack },
                ]);
              } else {
                Alert.alert('Notice', 'Unable to decline quotation. Please try again.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to decline quotation.');
            } finally {
              setRejectInProgress(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} disabled={bookingInProgress}>
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Vendor Header Card */}
        <View style={styles.vendorCard}>
          <View style={styles.vendorHeader}>
            <View>
              <View style={styles.vendorTitleRow}>
                <Text style={styles.vendorName}>{quotation?.vendorName || 'Verified Carrier'}</Text>
                <ShieldCheck size={16} color="#10B981" />
              </View>
              <Text style={styles.quoteId}>Quotation Ref: {quotation?.id || 'QT-LIVE-01'}</Text>
            </View>

            <View style={styles.validBadge}>
              <Clock size={12} color="#B45309" />
              <Text style={styles.validBadgeText}>Valid for 24h</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.metaItemVal}>{quotation?.rating || '4.8'}</Text>
              <Text style={styles.metaItemLabel}>Rating</Text>
            </View>
            <View style={styles.metaItemDivider} />
            <View style={styles.metaItem}>
              <Truck size={14} color="#0A1931" />
              <Text style={styles.metaItemVal}>{quotation?.completedTrips || 140}</Text>
              <Text style={styles.metaItemLabel}>Trips Done</Text>
            </View>
            <View style={styles.metaItemDivider} />
            <View style={styles.metaItem}>
              <Clock size={14} color="#F05A22" />
              <Text style={styles.metaItemVal}>{quotation?.transitTimeDays || 3} Days</Text>
              <Text style={styles.metaItemLabel}>Transit</Text>
            </View>
          </View>
        </View>

        {/* Itemized Cost Breakdown Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <IndianRupee size={18} color="#F05A22" />
            <Text style={styles.cardTitle}>Itemized Freight Breakdown</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Base Freight Rate</Text>
            <Text style={styles.breakdownValue}>₹{baseFreight.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Tolls, Fuel & State Surcharges</Text>
            <Text style={styles.breakdownValue}>₹{tollAndFuel.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>All-Risk Transit Insurance</Text>
            <Text style={[styles.breakdownValue, { color: '#059669' }]}>Included (₹0)</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>24/7 Control Tower GPS Tracking</Text>
            <Text style={[styles.breakdownValue, { color: '#059669' }]}>Included (₹0)</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>GST (5% Reverse Charge)</Text>
            <Text style={styles.breakdownValue}>As Applicable</Text>
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total Payable Freight</Text>
              <Text style={styles.totalSub}>All road expenses included</Text>
            </View>
            <Text style={styles.totalValue}>₹{rate.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Operational Commitments Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <FileCheck2 size={18} color="#F05A22" />
            <Text style={styles.cardTitle}>Service Level Commitments</Text>
          </View>

          <View style={styles.commitmentRow}>
            <CheckCircle2 size={15} color="#10B981" />
            <Text style={styles.commitmentText}>
              Vehicle placement guaranteed within 4 hours of confirmation.
            </Text>
          </View>

          <View style={styles.commitmentRow}>
            <CheckCircle2 size={15} color="#10B981" />
            <Text style={styles.commitmentText}>
              24 Hours free loading at origin and 24 hours free unloading at destination.
            </Text>
          </View>

          <View style={styles.commitmentRow}>
            <CheckCircle2 size={15} color="#10B981" />
            <Text style={styles.commitmentText}>
              Instant digital e-POD upload upon safe delivery sign-off.
            </Text>
          </View>
        </View>

        {/* Accept & Confirm Button */}
        <TouchableOpacity
          style={[styles.confirmBtn, isExpired && { backgroundColor: '#94A3B8' }]}
          onPress={handleAcceptAndBook}
          disabled={bookingInProgress || rejectInProgress || isExpired}
          activeOpacity={0.88}
        >
          {bookingInProgress ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.confirmBtnText}>
                {isExpired ? 'Quotation Expired' : 'Accept Quotation & Confirm Booking'}
              </Text>
              {!isExpired && <ArrowRight size={18} color="#FFFFFF" />}
            </>
          )}
        </TouchableOpacity>

        {/* Decline Quotation Button */}
        {!isExpired && (
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={handleReject}
            disabled={bookingInProgress || rejectInProgress}
            activeOpacity={0.8}
          >
            {rejectInProgress ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.declineBtnText}>Decline This Quotation</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  vendorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vendorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1931',
  },
  quoteId: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  validBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metaItem: {
    alignItems: 'center',
    gap: 2,
  },
  metaItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1931',
    marginTop: 2,
  },
  metaItemLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  metaItemDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
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
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A1931',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1931',
  },
  totalSub: {
    fontSize: 11,
    color: '#64748B',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F05A22',
  },
  commitmentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  commitmentText: {
    flex: 1,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: '#F05A22',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});
