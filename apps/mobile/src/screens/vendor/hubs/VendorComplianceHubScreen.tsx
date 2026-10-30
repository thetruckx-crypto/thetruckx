import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  Phone,
  ChevronRight,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react-native';
import { vendorService } from '../../../services/vendorService';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';

// Reusing tested screens in targeted remediation mode
import { VendorDocumentCorrectionScreen } from '../registration/VendorDocumentCorrectionScreen';

interface VendorComplianceHubScreenProps {
  vendorId?: string;
  mobile?: string;
  vendorName?: string;
  onBackToLogin: () => void;
  onEnterDashboard: () => void;
  onOpenSupport?: () => void;
}

export const VendorComplianceHubScreen: React.FC<VendorComplianceHubScreenProps> = ({
  vendorId,
  mobile,
  vendorName,
  onBackToLogin,
  onEnterDashboard,
  onOpenSupport,
}) => {
  const [statusData, setStatusData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [remediating, setRemediating] = useState<boolean>(false);

  useEffect(() => {
    fetchComplianceStatus();
  }, [vendorId, mobile]);

  const fetchComplianceStatus = async () => {
    try {
      setLoading(true);
      const res = await vendorService.getVendorVerificationStatus(vendorId, mobile);
      setStatusData(res);
    } catch (err) {
      console.warn('Failed to fetch verification status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplianceStatus();
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+9118002008888').catch(() => {
      Alert.alert('Helpline', 'Call NECL Compliance Desk at 1800-200-8888');
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF5A1F" />
        <Text style={styles.loadingText}>Connecting to NECL Compliance Desk...</Text>
      </SafeAreaView>
    );
  }

  if (remediating) {
    return (
      <VendorDocumentCorrectionScreen
        vendorId={vendorId || ''}
        onBack={() => {
          setRemediating(false);
          fetchComplianceStatus();
        }}
        onDone={() => {
          setRemediating(false);
          fetchComplianceStatus();
        }}
      />
    );
  }

  const isApproved = statusData?.status === 'APPROVED';
  const isRejected = statusData?.status === 'REJECTED';
  const hasRemediationNeeded =
    statusData?.status === 'ACTION_REQUIRED' ||
    (statusData?.documents && statusData.documents.some((d: any) => d.status === 'REJECTED'));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBackToLogin}
          accessibilityLabel="Back to Login"
        >
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerSub}>HUB 2: COMPLIANCE & AUDIT</Text>
          <Text style={styles.headerTitle}>KYC Verification Status</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh status"
        >
          <RefreshCw size={18} color="#FF5A1F" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF5A1F']} />
        }
      >
        {/* Status Card */}
        <View
          style={[
            styles.statusCard,
            isApproved
              ? styles.statusCardApproved
              : isRejected
              ? styles.statusCardRejected
              : hasRemediationNeeded
              ? styles.statusCardAction
              : styles.statusCardPending,
          ]}
        >
          <View style={styles.statusBadgeRow}>
            {isApproved ? (
              <ShieldCheck size={26} color="#059669" />
            ) : hasRemediationNeeded ? (
              <ShieldAlert size={26} color="#D97706" />
            ) : isRejected ? (
              <AlertCircle size={26} color="#DC2626" />
            ) : (
              <Clock size={26} color="#EA580C" />
            )}
            <View style={styles.statusBadgeTextWrap}>
              <Text
                style={[
                  styles.statusBadgeTitle,
                  isApproved && { color: '#059669' },
                  hasRemediationNeeded && { color: '#D97706' },
                  isRejected && { color: '#DC2626' },
                ]}
              >
                {isApproved
                  ? 'VERIFIED & ACTIVE CARRIER'
                  : hasRemediationNeeded
                  ? 'DOCUMENTS ACTION REQUIRED'
                  : isRejected
                  ? 'APPLICATION REJECTED'
                  : 'UNDER COMPLIANCE REVIEW'}
              </Text>
              <Text style={styles.statusSub}>
                Ref: {statusData?.applicationNumber || vendorId || 'APP-NECL-PENDING'}
              </Text>
            </View>
          </View>

          <Text style={styles.statusDesc}>
            {isApproved
              ? 'Your transporter enterprise is fully authorized to bid on freight loads and deploy vehicles across all NECL operational corridors.'
              : hasRemediationNeeded
              ? 'Certain KYC documents require clarification or re-upload as noted by the compliance auditor.'
              : isRejected
              ? 'Your application could not be approved at this time. Please contact support.'
              : 'Our compliance officers are verifying your PAN, GSTIN, and commercial fleet registration documents.'}
          </Text>

          {isApproved && (
            <TouchableOpacity
              style={styles.enterDashboardBtn}
              onPress={onEnterDashboard}
              activeOpacity={0.8}
            >
              <Text style={styles.enterDashboardBtnText}>Enter Carrier Control Tower</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {hasRemediationNeeded && (
            <TouchableOpacity
              style={styles.remediateBtn}
              onPress={() => setRemediating(true)}
              activeOpacity={0.8}
            >
              <Upload size={18} color="#FFFFFF" />
              <Text style={styles.remediateBtnText}>Correct Rejected Documents</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Verification Stages Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionHeading}>VERIFICATION MILESTONES</Text>

          <View style={styles.stageItem}>
            <View style={[styles.stageIconWrap, styles.stageIconDone]}>
              <CheckCircle2 size={16} color="#FFFFFF" />
            </View>
            <View style={styles.stageDetails}>
              <Text style={styles.stageTitle}>1. Application Submission</Text>
              <Text style={styles.stageSub}>Completed successfully with basic firm details.</Text>
            </View>
          </View>

          <View style={styles.stageConnector} />

          <View style={styles.stageItem}>
            <View
              style={[
                styles.stageIconWrap,
                isApproved
                  ? styles.stageIconDone
                  : hasRemediationNeeded
                  ? styles.stageIconAction
                  : styles.stageIconCurrent,
              ]}
            >
              {isApproved ? (
                <CheckCircle2 size={16} color="#FFFFFF" />
              ) : (
                <FileText size={16} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.stageDetails}>
              <Text style={styles.stageTitle}>2. Document Audit & PAN/GST Validation</Text>
              <Text style={styles.stageSub}>
                {isApproved
                  ? 'Verified by NSDL / GSTN APIs'
                  : hasRemediationNeeded
                  ? 'Audit flagged issues — re-upload needed'
                  : 'Automated verification in progress'}
              </Text>
            </View>
          </View>

          <View style={styles.stageConnector} />

          <View style={styles.stageItem}>
            <View
              style={[
                styles.stageIconWrap,
                isApproved ? styles.stageIconDone : styles.stageIconPending,
              ]}
            >
              {isApproved ? (
                <CheckCircle2 size={16} color="#FFFFFF" />
              ) : (
                <Clock size={16} color="#94A3B8" />
              )}
            </View>
            <View style={styles.stageDetails}>
              <Text style={styles.stageTitle}>3. Operations & Corridor Approval</Text>
              <Text style={styles.stageSub}>
                {isApproved ? 'Approved for all corridors' : 'Pending final clearance'}
              </Text>
            </View>
          </View>
        </View>

        {/* Support Callout */}
        <View style={styles.supportCard}>
          <View style={styles.supportIconWrap}>
            <Phone size={22} color="#0C1A34" />
          </View>
          <View style={styles.supportInfo}>
            <Text style={styles.supportTitle}>Need Immediate Assistance?</Text>
            <Text style={styles.supportDesc}>
              Our compliance desk is available Mon–Sat (9 AM – 7 PM).
            </Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={handleCallSupport}
            activeOpacity={0.8}
          >
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5A1F',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  statusCardApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusCardAction: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusCardRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusCardPending: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadgeTextWrap: {
    marginLeft: 12,
  },
  statusBadgeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  statusSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  statusDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 14,
  },
  enterDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  enterDashboardBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  remediateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  remediateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  timelineSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIconDone: {
    backgroundColor: '#10B981',
  },
  stageIconCurrent: {
    backgroundColor: '#FF5A1F',
  },
  stageIconAction: {
    backgroundColor: '#D97706',
  },
  stageIconPending: {
    backgroundColor: '#E2E8F0',
  },
  stageDetails: {
    marginLeft: 14,
    flex: 1,
  },
  stageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stageSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  stageConnector: {
    width: 2,
    height: 18,
    backgroundColor: '#E2E8F0',
    marginLeft: 13,
    marginVertical: 4,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  supportDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  callBtn: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
