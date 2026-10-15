import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileText,
  ShieldCheck,
  Truck,
  ArrowRight,
  Headphones,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';
import { ScenicHeroBanner } from '../components/ScenicHeroBanner';
import { BottomGoldWings } from '../components/BottomGoldWings';
import { driverService } from '../services/driverService';

interface DriverVerificationStatusScreenProps {
  initialMobile: string;
  driverId?: string;
  onBack: () => void;
  onGoToDashboard: () => void;
  onGoToCorrection: () => void;
  onContactSupport?: () => void;
}

export const DriverVerificationStatusScreen: React.FC<DriverVerificationStatusScreenProps> = ({
  initialMobile,
  driverId,
  onBack,
  onGoToDashboard,
  onGoToCorrection,
  onContactSupport,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const profile = await driverService.getDriverProfile(driverId, initialMobile);
      setDriverProfile(profile);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId, initialMobile]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStatus();
  };

  const status = driverProfile?.status || 'PENDING';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isPending = status === 'PENDING';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F05A22" />
        }
      >
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={170} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" size="sm" />
          </View>
        </View>

        <View style={styles.contentWrap}>
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#F05A22" />
              <Text style={{ color: '#64748B', marginTop: 12, fontSize: 13 }}>
                Checking real-time verification records...
              </Text>
            </View>
          ) : (
            <>
              {/* Status Header Card */}
              <View
                style={[
                  styles.statusCard,
                  isApproved && styles.statusCardApproved,
                  isRejected && styles.statusCardRejected,
                  isPending && styles.statusCardPending,
                ]}
              >
                <View style={styles.statusIconWrap}>
                  {isApproved && <CheckCircle2 size={36} color="#10B981" />}
                  {isRejected && <XCircle size={36} color="#EF4444" />}
                  {isPending && <Clock size={36} color="#F05A22" />}
                </View>

                <Text style={styles.statusTitle}>
                  {isApproved && 'Pilot Account Approved'}
                  {isRejected && 'Application Requires Correction'}
                  {isPending && 'Under Sarathi & Desk Verification'}
                </Text>

                <Text style={styles.statusDescription}>
                  {isApproved &&
                    'Your commercial DL and identity credentials have been verified by NECL operations. You are cleared for active trip dispatch.'}
                  {isRejected &&
                    (driverProfile?.rejectionReason ||
                      'Document blurriness or DL mismatch observed. Please correct and re-upload.')}
                  {isPending &&
                    'Our compliance desk is verifying your Sarathi Vahan records and transporter association. Average turnaround: 2-4 hours.'}
                </Text>

                <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
                  <RotateCcw size={14} color="#D4D6DB" />
                  <Text style={styles.refreshBtnText}>Refresh Live Status</Text>
                </TouchableOpacity>
              </View>

              {/* Profile Details Card */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Truck size={16} color="#F05A22" />
                  <Text style={styles.cardHeaderText}>Pilot Profile & Credentials</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Driver Name:</Text>
                  <Text style={styles.value}>{driverProfile?.fullName || 'Driver'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Driving Licence No:</Text>
                  <Text style={[styles.value, { color: '#F05A22' }]}>
                    {driverProfile?.licenceNumber || 'Pending Submission'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>DL Expiry Date:</Text>
                  <Text style={styles.value}>{driverProfile?.licenceExpiryDate || 'Under Review'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Associated Transporter:</Text>
                  <Text style={styles.value}>{driverProfile?.vendorName || 'NECL Direct / Transporter Fleet'}</Text>
                </View>
              </View>

              {/* Document Audit Checklist */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <FileText size={16} color="#F05A22" />
                  <Text style={styles.cardHeaderText}>Verification Documents Checklist</Text>
                </View>

                <View style={styles.docCheckList}>
                  <View style={styles.docItem}>
                    <ShieldCheck size={16} color={isApproved ? '#10B981' : '#F05A22'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docItemName}>Commercial Driving Licence (DL)</Text>
                      <Text style={styles.docItemSub}>Verified against Sarathi portal</Text>
                    </View>
                    <Text style={[styles.docItemStatus, { color: isApproved ? '#10B981' : '#F05A22' }]}>
                      {isApproved ? 'VERIFIED' : 'IN AUDIT'}
                    </Text>
                  </View>

                  <View style={styles.docItem}>
                    <ShieldCheck size={16} color={isApproved ? '#10B981' : '#F05A22'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docItemName}>Aadhaar Identity Proof</Text>
                      <Text style={styles.docItemSub}>UIDAI biometric match</Text>
                    </View>
                    <Text style={[styles.docItemStatus, { color: isApproved ? '#10B981' : '#F05A22' }]}>
                      {isApproved ? 'VERIFIED' : 'IN AUDIT'}
                    </Text>
                  </View>

                  <View style={styles.docItem}>
                    <ShieldCheck size={16} color={isApproved ? '#10B981' : '#F05A22'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docItemName}>Fleet Authorization</Text>
                      <Text style={styles.docItemSub}>Transporter approval</Text>
                    </View>
                    <Text style={[styles.docItemStatus, { color: isApproved ? '#10B981' : '#F05A22' }]}>
                      {isApproved ? 'VERIFIED' : 'CONFIRMED'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              {isApproved && (
                <TouchableOpacity
                  style={styles.goldPillBtn}
                  onPress={onGoToDashboard}
                  activeOpacity={0.85}
                >
                  <Text style={styles.goldPillText}>Enter Driver Operations Dashboard</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}

              {isRejected && (
                <TouchableOpacity
                  style={[styles.goldPillBtn, { backgroundColor: '#EF4444' }]}
                  onPress={onGoToCorrection}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.goldPillText, { color: '#FFFFFF' }]}>Correct & Resubmit Documents</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}

              {isPending && (
                <View style={styles.pendingActionWrap}>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={onGoToDashboard}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.outlineBtnText}>View Operations Preview</Text>
                    <ArrowRight size={16} color="#F05A22" />
                  </TouchableOpacity>
                </View>
              )}
            </>
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
    bottom: 8,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusCardApproved: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  statusCardRejected: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  statusCardPending: {
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(227, 180, 0, 0.05)',
  },
  statusIconWrap: {
    marginBottom: 10,
  },
  statusTitle: {
    color: '#172B4D',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  statusDescription: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    color: '#172B4D',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCard: {
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
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
    maxWidth: '60%',
  },
  docCheckList: {
    gap: 10,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  docItemName: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
  },
  docItemSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  docItemStatus: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  goldPillBtn: {
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
    marginTop: 6,
  },
  goldPillText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pendingActionWrap: {
    marginTop: 6,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(227, 180, 0, 0.04)',
  },
  outlineBtnText: {
    color: '#F05A22',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
