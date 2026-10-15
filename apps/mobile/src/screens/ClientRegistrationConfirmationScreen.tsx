import React, { useState, useEffect } from 'react';
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
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { ClientBusinessDetails, clientService } from '../services/clientService';

const { width } = Dimensions.get('window');

interface ClientRegistrationConfirmationScreenProps {
  clientId?: string;
  businessDetails?: ClientBusinessDetails;
  onTrackStatus: () => void;
  onGoToDashboard?: () => void;
  onContactSupport?: () => void;
  onBackToLogin?: () => void;
}

export const ClientRegistrationConfirmationScreen: React.FC<
  ClientRegistrationConfirmationScreenProps
> = ({
  clientId,
  businessDetails,
  onTrackStatus,
  onContactSupport,
  onBackToLogin,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'PENDING_APPROVAL' | 'APPROVED' | 'CORRECTIONS_REQUESTED' | 'REJECTED'>(
    'PENDING_APPROVAL'
  );

  // Exact user-specified fallback defaults when props are empty or during standalone preview
  const displayClientId = clientId || 'CLI-213392';
  const companyName = businessDetails?.companyName || 'webyourdesign';
  const entityType = businessDetails?.businessType || 'Public Limited';
  const gstin = businessDetails?.gstin || '29AAAAA0000A1Z5';

  // Format submission date defaulting accurately to current date (or 15 Oct 2026 reference)
  const submissionDate = React.useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '15 Oct 2026';
    }
  }, []);

  // Copy Client ID interaction with visual feedback
  const handleCopyClientId = () => {
    try {
      Clipboard.setString(displayClientId);
    } catch {
      // Browser / web fallback if running in React Native Web
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        (navigator as any).clipboard.writeText(displayClientId).catch(() => {});
      }
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  // Optional live registration status refresh from database
  const handleRefreshStatus = async () => {
    if (!displayClientId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await clientService.getClientAccountStatus(displayClientId);
      if (res && res.status) {
        if (res.status === 'APPROVED') {
          setLiveStatus('APPROVED');
        } else if (res.status === 'CORRECTIONS_REQUESTED') {
          setLiveStatus('CORRECTIONS_REQUESTED');
        } else if (res.status === 'REJECTED') {
          setLiveStatus('REJECTED');
        } else {
          setLiveStatus('PENDING_APPROVAL');
        }
      }
    } catch {
      // Safe fallback - preserve pending status
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle support tap with fallback to official NECL Helpline
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
        {/* 1. Header & Scenic Illustrated Banner (Height reduced by ~37% to 120px) */}
        <View style={styles.bannerContainer}>
          <ScenicHeroBanner height={120} />
          
          {/* Preserved NECL Branding overlaid cleanly */}
          <View style={styles.brandBadgeWrap}>
            <View style={styles.brandLogoCard}>
              <BrandLogoHeader size="sm" showSubtitle={false} />
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* 1. Success State (Clean green success icon + heading + concise supporting text) */}
          <View style={styles.successStateWrap}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={34} color="#16A779" strokeWidth={2.4} />
            </View>
            <Text style={styles.mainHeading}>Registration Submitted Successfully</Text>
            <Text style={styles.supportingText}>
              Your application has been submitted successfully and is awaiting admin verification.
            </Text>
          </View>

          {/* 2. Application Status & Client ID Card */}
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
                  onPress={handleRefreshStatus}
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
              
              {/* Subtle amber badge for Pending Approval */}
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  {liveStatus === 'APPROVED' ? 'Approved' : 'Pending Approval'}
                </Text>
              </View>
            </View>

            {/* Clear communication that dashboard access will be available after approval */}
            <Text style={styles.dashboardNotice}>
              Dashboard access will be available after approval.
            </Text>
          </View>

          {/* 3. Application Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Building2 size={16} color="#0B1933" strokeWidth={2.2} />
              <Text style={styles.summaryHeaderText}>Application Summary</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Company Name</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {companyName}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Entity Type</Text>
              <Text style={styles.summaryValue}>{entityType}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GSTIN</Text>
              <Text style={[styles.summaryValue, styles.monoValue]}>{gstin}</Text>
            </View>

            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Submission Date</Text>
              <View style={styles.dateInlineWrap}>
                <Calendar size={13} color="#64748B" strokeWidth={2} />
                <Text style={styles.summaryValue}>{submissionDate}</Text>
              </View>
            </View>
          </View>

          {/* 4. Compliance Information Card (Subtle warm background + shield icon) */}
          <View style={styles.complianceCard}>
            <View style={styles.complianceIconWrap}>
              <Shield size={17} color="#C2410C" strokeWidth={2.2} />
            </View>
            <Text style={styles.complianceText}>
              Transport bookings, rate contracting, and dispatches will be enabled after NECL compliance officers verify your submitted commercial certificates.
            </Text>
          </View>

          {/* 5. Action Buttons Hierarchy */}
          <View style={styles.actionsContainer}>
            {/* Primary CTA: Track Application Status */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onTrackStatus}
              activeOpacity={0.88}
              accessibilityLabel="Track Application Status"
            >
              <Text style={styles.primaryBtnText}>Track Application Status</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>

            {/* Secondary CTA: Back to Login */}
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

            {/* Support Action: Contact NECL Compliance Support */}
            <TouchableOpacity
              style={styles.supportButton}
              onPress={handleSupportPress}
              activeOpacity={0.7}
              accessibilityLabel="Contact NECL Compliance Support"
            >
              <PhoneCall size={14} color="#0B1933" strokeWidth={2} />
              <Text style={styles.supportButtonText}>Contact NECL Compliance Support</Text>
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
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
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
  dateInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
