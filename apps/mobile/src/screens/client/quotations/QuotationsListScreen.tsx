import React, { useState, useEffect } from 'react';
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
  Columns2,
  FileText,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { clientService } from '../../../services/clientService';

interface QuotationsListScreenProps {
  requirementId: string;
  clientId?: string;
  onBack: () => void;
  onCompare: (requirementId: string, quotations: any[]) => void;
  onViewQuoteDetails: (quotation: any) => void;
  onAcceptAndBook: (quotation: any) => void;
}

export const QuotationsListScreen: React.FC<QuotationsListScreenProps> = ({
  requirementId,
  clientId,
  onBack,
  onCompare,
  onViewQuoteDetails,
  onAcceptAndBook,
}) => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientService.fetchQuotationsForRequirement(requirementId).then((res: any[]) => {
      setQuotations(res);
      setLoading(false);
    });
  }, [requirementId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        {quotations.length > 1 ? (
          <TouchableOpacity
            style={styles.compareBtn}
            onPress={() => onCompare(requirementId, quotations)}
          >
            <Columns2 size={16} color="#F05A22" />
            <Text style={styles.compareBtnText}>Compare</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Header Info */}
      <View style={styles.infoBar}>
        <View>
          <Text style={styles.screenTitle}>Received Quotations</Text>
          <Text style={styles.screenSub}>
            Quotes for Requirement {requirementId}
          </Text>
        </View>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeCountText}>{quotations.length} Bids</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#F05A22" />
            <Text style={styles.loadingText}>Fetching competitive carrier rates...</Text>
          </View>
        ) : quotations.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Truck size={46} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Bids Under Formulation</Text>
            <Text style={styles.emptySub}>
              Certified TRUCKS regional fleet owners are preparing quotations for this corridor. You will receive real-time notifications as bids arrive.
            </Text>
          </View>
        ) : (
          <>
            {quotations.length > 1 && (
              <TouchableOpacity
                style={styles.compareBanner}
                onPress={() => onCompare(requirementId, quotations)}
                activeOpacity={0.85}
              >
                <Columns2 size={18} color="#C2410C" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.compareBannerTitle}>Side-by-Side Comparison</Text>
                  <Text style={styles.compareBannerSub}>
                    Compare pricing, transit duration, and carrier compliance metrics
                  </Text>
                </View>
                <ArrowRight size={16} color="#C2410C" />
              </TouchableOpacity>
            )}

            {quotations.map((q, idx) => (
              <View key={q.id || idx} style={styles.quoteCard}>
                {/* Card Top: Vendor & Rating */}
                <View style={styles.vendorRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.vendorNameRow}>
                      <Text style={styles.vendorName}>{q.vendorName}</Text>
                      <ShieldCheck size={16} color="#10B981" />
                    </View>
                    <View style={styles.ratingRow}>
                      <Star size={13} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.ratingText}>{q.rating || '4.8'}</Text>
                      <Text style={styles.tripsText}>• {q.completedTrips || 120} Trips</Text>
                    </View>
                  </View>

                  {/* Rate Display */}
                  <View style={styles.rateBox}>
                    <Text style={styles.rateCurrency}>INR</Text>
                    <Text style={styles.rateAmount}>
                      ₹{(q.rate || 32000).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.rateTag}>All-Inclusive</Text>
                  </View>
                </View>

                {/* Specs Pill Row */}
                <View style={styles.specsWrap}>
                  <View style={styles.specPill}>
                    <Clock size={13} color="#475569" />
                    <Text style={styles.specPillText}>{q.transitTimeDays || 3} Days Transit</Text>
                  </View>
                  <View style={styles.specPill}>
                    <Truck size={13} color="#475569" />
                    <Text style={styles.specPillText}>{q.vehicleType || '32 FT Multi-Axle'}</Text>
                  </View>
                </View>

                {/* Included Features */}
                <View style={styles.featuresRow}>
                  <View style={styles.featureItem}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <Text style={styles.featureText}>Toll & Fuel Included</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <Text style={styles.featureText}>GPS Live Tracking</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <Text style={styles.featureText}>Transit Insurance</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => onViewQuoteDetails(q)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailsBtnText}>View Breakdown</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() => onAcceptAndBook(q)}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.bookBtnText}>Accept & Book</Text>
                    <ArrowRight size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
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
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F05A22',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1931',
  },
  screenSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeCount: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
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
    lineHeight: 19,
  },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  compareBannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  compareBannerSub: {
    fontSize: 11.5,
    color: '#9A3412',
    marginTop: 2,
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0A1931',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vendorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A1931',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1931',
  },
  tripsText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  rateBox: {
    alignItems: 'flex-end',
  },
  rateCurrency: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  rateAmount: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F05A22',
  },
  rateTag: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  specsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specPillText: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  bookBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
