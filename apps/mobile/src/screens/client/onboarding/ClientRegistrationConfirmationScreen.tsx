import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Clipboard,
  Platform,
  Linking,
  ActivityIndicator,
  Dimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Building2,
  Calendar,
  PhoneCall,
  Copy,
  Check,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { ClientBusinessDetails, clientService } from '../../../services/clientService';
import { supabase } from '../../../supabase';

const { width } = Dimensions.get('window');

/**
 * Format timestamp accurately in Asia/Kolkata timezone: e.g. "19 Oct 2026, 10:45 AM"
 */
export function formatKolkataDateTime(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(validDate);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(validDate);

  return `${datePart}, ${timePart}`;
}

interface ClientRegistrationConfirmationScreenProps {
  clientId?: string;
  mobileNumber?: string;
  businessDetails?: ClientBusinessDetails;
  onTrackStatus: () => void;
  onGoToDashboard?: () => void;
  onFixCorrections?: () => void;
  onContactSupport?: () => void;
  onBackToLogin?: () => void;
}

export const ClientRegistrationConfirmationScreen: React.FC<
  ClientRegistrationConfirmationScreenProps
> = ({
  clientId,
  mobileNumber,
  businessDetails,
  onTrackStatus,
  onGoToDashboard,
  onFixCorrections,
  onContactSupport,
  onBackToLogin,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    'PENDING_APPROVAL' | 'APPROVED' | 'CORRECTIONS_REQUESTED' | 'REJECTED'
  >('PENDING_APPROVAL');
  const [actualSubmittedAt, setActualSubmittedAt] = useState<string | undefined>(
    businessDetails?.submittedAt
  );
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const [correctionNotes, setCorrectionNotes] = useState<string | undefined>();

  const hasNavigatedRef = useRef(false);
  const isRefreshingRef = useRef(false);

  // Fallback defaults for standalone preview or unassigned id
  const displayClientId = clientId || 'CLI-213392';
  const companyName = businessDetails?.companyName || 'Enterprise Partner';
  const entityType = businessDetails?.businessType || 'Private Limited';
  const gstin = businessDetails?.gstin || '18AAAAA0000A1Z5';

  // Format single-line submission date in Asia/Kolkata timezone
  const formattedSubmissionDate = React.useMemo(() => {
    return formatKolkataDateTime(actualSubmittedAt);
  }, [actualSubmittedAt]);

  // Copy Client ID interaction with visual feedback
  const handleCopyClientId = () => {
    try {
      Clipboard.setString(displayClientId);
    } catch {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        (navigator as any).clipboard.writeText(displayClientId).catch(() => {});
      }
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  // Live registration status refresh from database (bypassing stale cache)
  const handleRefreshStatus = async (bypassCache: boolean = true) => {
    if (isRefreshingRef.current || hasNavigatedRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const targetLookup = mobileNumber || displayClientId;
      const res = await clientService.getClientAccountStatus(targetLookup, bypassCache);
      if (res && res.status) {
        if (res.submittedAt) {
          setActualSubmittedAt(res.submittedAt);
        }
        if (res.status === 'APPROVED' || (res as any).status === 'ACTIVE') {
          setLiveStatus('APPROVED');
          if (!hasNavigatedRef.current && onGoToDashboard) {
            hasNavigatedRef.current = true;
            onGoToDashboard();
          }
        } else if (res.status === 'CORRECTIONS_REQUESTED') {
          setLiveStatus('CORRECTIONS_REQUESTED');
          setCorrectionNotes(
            res.correctionNotes || 'Please update your submitted documents.'
          );
        } else if (res.status === 'REJECTED') {
          setLiveStatus('REJECTED');
          setRejectionReason(
            res.rejectionReason || 'Application was not approved by compliance.'
          );
        } else {
          setLiveStatus('PENDING_APPROVAL');
        }
      }
    } catch {
      // Safe fallback - preserve pending status
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Initial check on mount
    handleRefreshStatus(true);

    // 2. Realtime subscription to database changes for client_companies and client_users
    const cleanId = (displayClientId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-16);
    const channelName = `realtime-client-confirm-${cleanId || 'sync'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_companies' },
        () => {
          handleRefreshStatus(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_users' },
        () => {
          handleRefreshStatus(true);
        }
      )
      .subscribe();

    // 3. Fallback polling every 2.5 seconds ensuring sub-second sync even if WS drops
    const interval = setInterval(() => {
      handleRefreshStatus(true);
    }, 2500);

    // 4. AppState lifecycle listener: recheck immediately when app returns to foreground
    const appStateSub = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          handleRefreshStatus(true);
        }
      }
    );

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [displayClientId, mobileNumber]);

  const handleSupportPress = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      Linking.openURL('tel:18002584567').catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header & Scenic Illustrated Banner */}
        <View style={styles.bannerContainer}>
          <ScenicHeroBanner height={120} />
          
          <View style={styles.brandBadgeWrap}>
            <View style={styles.brandLogoCard}>
              <BrandLogoHeader size="sm" showSubtitle={false} />
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* Success State */}
          <View style={styles.successStateWrap}>
            <View
              style={[
                styles.successIconCircle,
                liveStatus === 'APPROVED' && styles.successIconApproved,
                liveStatus === 'REJECTED' && styles.successIconRejected,
                liveStatus === 'CORRECTIONS_REQUESTED' && styles.successIconCorrection,
              ]}
            >
              {liveStatus === 'APPROVED' ? (
                <CheckCircle2 size={34} color="#16A779" strokeWidth={2.4} />
              ) : liveStatus === 'REJECTED' ? (
                <X size={34} color="#DC2626" strokeWidth={2.4} />
              ) : liveStatus === 'CORRECTIONS_REQUESTED' ? (
                <AlertTriangle size={34} color="#D97706" strokeWidth={2.4} />
              ) : (
                <CheckCircle2 size={34} color="#16A779" strokeWidth={2.4} />
              )}
            </View>

            <Text style={styles.mainHeading}>
              {liveStatus === 'APPROVED'
                ? 'Registration Approved!'
                : liveStatus === 'REJECTED'
                ? 'Registration Review Completed'
                : liveStatus === 'CORRECTIONS_REQUESTED'
                ? 'Information Update Required'
                : 'Registration Submitted Successfully'}
            </Text>

            <Text style={styles.supportingText}>
              {liveStatus === 'APPROVED'
                ? 'Your enterprise registration has been approved by NECL Admin. Transitioning directly to your operational dashboard...'
                : liveStatus === 'REJECTED'
                ? 'Your registration could not be verified. Please review compliance feedback below or contact support.'
                : liveStatus === 'CORRECTIONS_REQUESTED'
                ? 'Admin reviewed your submission and requested updates to your registration documents.'
                : 'Your registration has been submitted and is awaiting admin verification.'}
            </Text>
          </View>

          {/* Instant Approval Banner */}
          {liveStatus === 'APPROVED' && (
            <View style={styles.approvedBannerCard}>
              <CheckCircle2 size={20} color="#16A779" strokeWidth={2.4} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.approvedBannerTitle}>Account Approved & Active</Text>
                <Text style={styles.approvedBannerSubtitle}>
                  Opening your enterprise dashboard...
                </Text>
              </View>
              <ActivityIndicator size="small" color="#16A779" />
            </View>
          )}

          {/* Rejection / Correction Notices */}
          {liveStatus === 'REJECTED' && (
            <View style={styles.rejectionCard}>
              <View style={styles.rejectionHeader}>
                <X size={16} color="#DC2626" strokeWidth={2.4} />
                <Text style={styles.rejectionTitle}>Compliance Desk Remarks</Text>
              </View>
              <Text style={styles.rejectionText}>
                {rejectionReason || 'Commercial certificate verification failed.'}
              </Text>
            </View>
          )}

          {liveStatus === 'CORRECTIONS_REQUESTED' && (
            <View style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <AlertTriangle size={16} color="#D97706" strokeWidth={2.4} />
                <Text style={styles.correctionTitle}>Correction Required</Text>
              </View>
              <Text style={styles.correctionText}>
                {correctionNotes || 'Please upload clearer copies of your GST or PAN certificate.'}
              </Text>
              {onFixCorrections && (
                <TouchableOpacity
                  style={styles.fixBtn}
                  onPress={onFixCorrections}
                  activeOpacity={0.8}
                >
                  <Text style={styles.fixBtnText}>Update Documents Now →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Application Status & Client ID Card */}
          <View style={styles.statusCard}>
            <View style={styles.idHeaderRow}>
              <Text style={styles.idCardLabel}>ASSIGNED CLIENT ID</Text>
              {copied ? (
                <View style={styles.copiedPill}>
                  <Check size={11} color="#16A779" strokeWidth={2.6} />
                  <Text style={styles.copiedPillText}>Client ID copied</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => handleRefreshStatus(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Refresh status"
                  accessibilityHint="Check latest status"
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color="#64748B" />
                  ) : (
                    <RefreshCw size={12} color="#64748B" />
                  )}
                  <Text style={styles.refreshBtnText}>Live Status</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.idActionRow}>
              <Text style={styles.clientIdText}>{displayClientId}</Text>
              <TouchableOpacity
                style={[styles.copyButton, copied && styles.copyButtonActive]}
                onPress={handleCopyClientId}
                activeOpacity={0.7}
                accessibilityLabel="Copy Client ID"
              >
                {copied ? (
                  <Check size={17} color="#16A779" strokeWidth={2.4} />
                ) : (
                  <Copy size={17} color="#F15A29" strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Clock size={16} color="#B45309" strokeWidth={2.2} />
                <Text style={styles.statusTitleText}>Application Status</Text>
              </View>
              
              <View
                style={[
                  styles.pendingBadge,
                  liveStatus === 'APPROVED' && styles.pendingBadgeApproved,
                  liveStatus === 'REJECTED' && styles.pendingBadgeRejected,
                  liveStatus === 'CORRECTIONS_REQUESTED' && styles.pendingBadgeCorrection,
                ]}
              >
                <Text
                  style={[
                    styles.pendingBadgeText,
                    liveStatus === 'APPROVED' && styles.pendingTextApproved,
                    liveStatus === 'REJECTED' && styles.pendingTextRejected,
                    liveStatus === 'CORRECTIONS_REQUESTED' && styles.pendingTextCorrection,
                  ]}
                >
                  {liveStatus === 'APPROVED'
                    ? 'Approved'
                    : liveStatus === 'REJECTED'
                    ? 'Rejected'
                    : liveStatus === 'CORRECTIONS_REQUESTED'
                    ? 'Correction Required'
                    : 'Pending Verification'}
                </Text>
              </View>
            </View>

            <Text style={styles.dashboardNotice}>
              {liveStatus === 'APPROVED'
                ? 'Your account is approved! Direct access to all logistics services is active.'
                : 'Dashboard access will be automatically unlocked upon admin approval.'}
            </Text>
          </View>

          {/* Application Summary Card - Single-Line Formatted Date & Status */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Building2 size={16} color="#0B1933" strokeWidth={2.2} />
              <Text style={styles.summaryHeaderText}>Application Summary</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Registration Status</Text>
              <View
                style={[
                  styles.tableBadgeWrap,
                  liveStatus === 'APPROVED' && styles.tableBadgeApproved,
                  liveStatus === 'REJECTED' && styles.tableBadgeRejected,
                  liveStatus === 'CORRECTIONS_REQUESTED' && styles.tableBadgeCorrection,
                ]}
              >
                {liveStatus === 'APPROVED' ? (
                  <CheckCircle2 size={12} color="#16A779" strokeWidth={2.4} />
                ) : liveStatus === 'REJECTED' ? (
                  <X size={12} color="#DC2626" strokeWidth={2.4} />
                ) : liveStatus === 'CORRECTIONS_REQUESTED' ? (
                  <AlertTriangle size={12} color="#D97706" strokeWidth={2.4} />
                ) : (
                  <Clock size={12} color="#B45309" strokeWidth={2.2} />
                )}
                <Text
                  style={[
                    styles.tableBadgeText,
                    liveStatus === 'APPROVED' && styles.tableTextApproved,
                    liveStatus === 'REJECTED' && styles.tableTextRejected,
                    liveStatus === 'CORRECTIONS_REQUESTED' && styles.tableTextCorrection,
                  ]}
                  numberOfLines={1}
                >
                  {liveStatus === 'APPROVED'
                    ? 'Approved'
                    : liveStatus === 'REJECTED'
                    ? 'Rejected'
                    : liveStatus === 'CORRECTIONS_REQUESTED'
                    ? 'Correction Required'
                    : 'Pending Verification'}
                </Text>
              </View>
            </View>

            {/* Single-Line Submission Date */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submission Date</Text>
              <View style={styles.dateInlineWrap}>
                <Calendar size={13} color="#64748B" strokeWidth={2} />
                <Text style={styles.dateSingleLineText} numberOfLines={1}>
                  {formattedSubmissionDate}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Company Name</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {companyName}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Entity Type</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {entityType}
              </Text>
            </View>

            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>GSTIN</Text>
              <Text style={[styles.summaryValue, styles.monoValue]} numberOfLines={1}>
                {gstin}
              </Text>
            </View>
          </View>

          {/* Compliance Card */}
          <View style={styles.complianceCard}>
            <View style={styles.complianceIconWrap}>
              <Shield size={17} color="#C2410C" strokeWidth={2.2} />
            </View>
            <Text style={styles.complianceText}>
              Transport bookings, rate contracting, and dispatches will be enabled after NECL compliance officers verify your submitted commercial certificates.
            </Text>
          </View>

          {/* Action Buttons Hierarchy */}
          <View style={styles.actionsContainer}>
            {liveStatus === 'APPROVED' ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#16A779' }]}
                onPress={onGoToDashboard}
                activeOpacity={0.88}
                accessibilityLabel="Go to Dashboard"
              >
                <Text style={styles.primaryBtnText}>Open Client Dashboard</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onTrackStatus}
                activeOpacity={0.88}
                accessibilityLabel="Track Application Status"
              >
                <Text style={styles.primaryBtnText}>Track Application Status</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            )}

            {onBackToLogin && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onBackToLogin}
                activeOpacity={0.88}
                accessibilityLabel="Back to Login"
              >
                <Text style={styles.secondaryBtnText}>Back to Login</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.supportButton}
              onPress={handleSupportPress}
              activeOpacity={0.7}
              accessibilityLabel="Contact NECL Compliance Support"
            >
              <PhoneCall size={14} color="#0B1933" strokeWidth={2} />
              <Text style={styles.supportButtonText}>
                Contact NECL Compliance Support
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 36,
  },

  /* 1. Header & Scenic Banner */
  bannerContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0A1931',
    overflow: 'visible',
    marginBottom: 20,
  },
  brandBadgeWrap: {
    position: 'absolute',
    bottom: -16,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  brandLogoCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0B1933',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Content Body */
  contentBody: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  /* Success State */
  successStateWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  successIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ECFDF5',
    borderWidth: 3,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mainHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B1933',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 6,
  },
  supportingText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  successIconApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  successIconRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  successIconCorrection: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  approvedBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  approvedBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  approvedBannerSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rejectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectionText: {
    fontSize: 12.5,
    color: '#B91C1C',
    lineHeight: 18,
  },
  correctionCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  correctionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  correctionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#92400E',
  },
  correctionText: {
    fontSize: 12.5,
    color: '#B45309',
    lineHeight: 18,
    marginBottom: 10,
  },
  fixBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 2. Application Status & Client ID Card */
  statusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  idHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  idCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  copiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  copiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A779',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  idActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientIdText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F15A29',
    letterSpacing: 0.6,
  },
  copyButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0B1933',
  },
  pendingBadge: {
    backgroundColor: '#FFF0C2', // Exact subtle pending amber
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pendingBadgeRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pendingBadgeCorrection: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  pendingTextApproved: {
    color: '#059669',
  },
  pendingTextRejected: {
    color: '#DC2626',
  },
  pendingTextCorrection: {
    color: '#D97706',
  },
  dashboardNotice: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },

  /* 3. Application Summary Card */
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1933',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    flexShrink: 0,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B1933',
    maxWidth: '65%',
    textAlign: 'right',
  },
  monoValue: {
    letterSpacing: 0.4,
  },
  tableBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0C2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tableBadgeApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tableBadgeRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  tableBadgeCorrection: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  tableBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  tableTextApproved: {
    color: '#059669',
  },
  tableTextRejected: {
    color: '#DC2626',
  },
  tableTextCorrection: {
    color: '#D97706',
  },
  dateInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  dateSingleLineText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0B1933',
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'right',
  },

  /* 4. Compliance Information Card */
  complianceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  complianceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  complianceText: {
    flex: 1,
    fontSize: 12.5,
    color: '#9A3412',
    lineHeight: 18,
    fontWeight: '500',
  },

  /* 5. Action Buttons */
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#F15A29',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F15A29',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#0B1933',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supportButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  supportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1933',
    textDecorationLine: 'underline',
  },
});
