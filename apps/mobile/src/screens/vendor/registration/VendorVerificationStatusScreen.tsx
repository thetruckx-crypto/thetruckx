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
  RefreshControl,
} from 'react-native';
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ArrowRight,
  Headphones,
  FileEdit,
  ShieldCheck,
  Building2,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../../../components/BrandLogoHeader';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { supabase } from '../../../supabase';
import { formatDisplayId } from '../../../utils/idGenerator';

interface VendorVerificationStatusScreenProps {
  vendorId: string;
  vendorName?: string;
  onBack?: () => void;
  onEnterDashboard: () => void;
  onApprovedContinue?: () => void;
  onCorrectDocuments: () => void;
  onCompleteRegistration?: () => void;
  onOpenSupport?: () => void;
}

export const VendorVerificationStatusScreen: React.FC<VendorVerificationStatusScreenProps> = ({
  vendorId,
  vendorName = 'Transport Firm',
  onBack,
  onEnterDashboard,
  onApprovedContinue,
  onCorrectDocuments,
  onCompleteRegistration,
  onOpenSupport,
}) => {
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE'>('PENDING');
  const [transporter, setTransporter] = useState(vendorName);
  const [vendorCode, setVendorCode] = useState<string | undefined>(undefined);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await vendorService.getVendorVerificationStatus(vendorId);
      setStatus(res.status);
      if (res.vendorName) setTransporter(res.vendorName);
      if (res.vendorCode) setVendorCode(res.vendorCode);
      if (res.rejectionReason) setRejectionReason(res.rejectionReason);

      if (res.status === 'APPROVED') {
        if (onApprovedContinue) {
          onApprovedContinue();
        } else if (onEnterDashboard) {
          onEnterDashboard();
        }
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId, onApprovedContinue, onEnterDashboard]);

  useEffect(() => {
    if (!vendorId) return;

    checkStatus();

    // Live Supabase Realtime channel for vendor approval sync
    const cleanId = (vendorId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-16);
    const channelName = `realtime-vendor-status-${cleanId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {
        checkStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_users' }, () => {
        checkStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        checkStatus();
      })
      .subscribe();

    // Active polling fallback every 2.5s for instant reactivity upon Admin approval
    const interval = setInterval(() => {
      checkStatus();
    }, 2500);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [vendorId, checkStatus]);

  const onManualRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    Alert.alert('Status Refreshed', `Current compliance state: ${status}`);
  };

  const stages = [
    {
      id: 1,
      title: 'Application Received',
      desc: 'Master transporter credentials recorded in TRUCKS system.',
      state: 'DONE',
    },
    {
      id: 2,
      title: 'Tax & GST Audit',
      desc: 'PAN card and GSTIN validation with central tax records.',
      state: status === 'APPROVED' ? 'DONE' : status === 'REJECTED' ? 'FAILED' : 'CURRENT',
    },
    {
      id: 3,
      title: 'Fleet & Policy Inspection',
      desc: 'Audit of commercial permits, RC, and transporter declaration.',
      state: status === 'APPROVED' ? 'DONE' : status === 'REJECTED' ? 'FAILED' : 'WAITING',
    },
    {
      id: 4,
      title: 'Contractor Activation',
      desc: 'Access to submit freight bids and accept national load bookings.',
      state: status === 'APPROVED' ? 'DONE' : 'WAITING',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onManualRefresh} tintColor="#F05A22" />
        }
      >
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          {onBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
              <ChevronLeft size={22} color="#172B4D" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <View style={styles.logoWrap}>
            <BrandLogoHeader theme="light" showSubtitle={false} size="sm" />
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headingWrap}>
            <Text style={styles.titleText}>
              Verification <Text style={styles.goldText}>Status</Text>
            </Text>
            <Text style={styles.subText}>
              Live tracking of your enterprise compliance verification with TRUCKS Carrier Operations.
            </Text>
          </View>

          {/* Transporter Card */}
          <View style={styles.vendorCard}>
            <View style={styles.vendorHeader}>
              <Building2 size={16} color="#F05A22" />
              <Text style={styles.vendorName}>{transporter}</Text>
            </View>
            <Text style={styles.vendorIdText}>
              Reference ID: {vendorCode || formatDisplayId('VD', vendorId)}
            </Text>

            {/* Current State Indicator */}
            {status === 'APPROVED' && (
              <View style={[styles.statusBanner, styles.bannerApproved]}>
                <CheckCircle2 size={18} color="#10B981" />
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.bannerTitleApproved}>Enterprise Verified & Approved</Text>
                  <Text style={styles.bannerSubApproved}>
                    Your fleet is cleared for load allocation and quotation submission.
                  </Text>
                </View>
              </View>
            )}

            {status === 'REJECTED' && (
              <View style={[styles.statusBanner, styles.bannerRejected]}>
                <XCircle size={18} color="#EF4444" />
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.bannerTitleRejected}>Clarification Required</Text>
                  <Text style={styles.bannerSubRejected}>
                    {rejectionReason || 'Please review and re-upload corrected KYC documents.'}
                  </Text>
                </View>
              </View>
            )}

            {status === 'PENDING' && (
              <View style={[styles.statusBanner, styles.bannerPending]}>
                <Clock size={18} color="#F59E0B" />
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.bannerTitlePending}>Under Compliance Audit</Text>
                  <Text style={styles.bannerSubPending}>
                    Application is being actively reviewed by TRUCKS verification officers.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Audit Stepper Card */}
          <View style={styles.stepperCard}>
            <Text style={styles.stepperCardTitle}>VERIFICATION WORKFLOW</Text>

            <View style={styles.stepperList}>
              {stages.map((st, idx) => (
                <View key={st.id} style={styles.stageItem}>
                  <View style={styles.stageLeft}>
                    <View
                      style={[
                        styles.stageNode,
                        st.state === 'DONE' && styles.nodeDone,
                        st.state === 'CURRENT' && styles.nodeCurrent,
                        st.state === 'FAILED' && styles.nodeFailed,
                      ]}
                    >
                      {st.state === 'DONE' && <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={3} />}
                      {st.state === 'CURRENT' && <Clock size={12} color="#FFFFFF" />}
                      {st.state === 'FAILED' && <XCircle size={12} color="#FFFFFF" />}
                      {st.state === 'WAITING' && <Text style={styles.nodeNum}>{st.id}</Text>}
                    </View>
                    {idx < stages.length - 1 && (
                      <View
                        style={[
                          styles.stageLine,
                          st.state === 'DONE' && styles.lineDone,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.stageRight}>
                    <Text
                      style={[
                        styles.stageTitle,
                        st.state === 'DONE' && styles.stageTitleDone,
                        st.state === 'CURRENT' && styles.stageTitleCurrent,
                      ]}
                    >
                      {st.title}
                    </Text>
                    <Text style={styles.stageDesc}>{st.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons based on status */}
          {status === 'APPROVED' ? (
            <TouchableOpacity style={styles.goldBtn} onPress={onEnterDashboard} activeOpacity={0.85}>
              <Text style={styles.goldBtnText}>Enter Vendor Operations Dashboard</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : status === 'REJECTED' ? (
            <TouchableOpacity style={styles.goldBtn} onPress={onCorrectDocuments} activeOpacity={0.85}>
              <FileEdit size={18} color="#FFFFFF" />
              <Text style={styles.goldBtnText}>Correct & Re-upload Documents</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.pendingActionCol}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onManualRefresh}
                activeOpacity={0.85}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.refreshBtnText}>Check Live Status</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.completeRegBtn}
                onPress={onCompleteRegistration || onCorrectDocuments}
                activeOpacity={0.8}
              >
                <FileEdit size={15} color="#F05A22" />
                <Text style={styles.completeRegText}>Complete / Update Registration Details</Text>
              </TouchableOpacity>
            </View>
          )}

          {onOpenSupport && (
            <TouchableOpacity style={styles.supportBtn} onPress={onOpenSupport}>
              <Headphones size={15} color="#F05A22" />
              <Text style={styles.supportText}>Contact TRUCKS Compliance Desk</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
    textAlign: 'center',
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  vendorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vendorName: {
    color: '#172B4D',
    fontSize: 16,
    fontWeight: '800',
  },
  vendorIdText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bannerRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  bannerPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitleApproved: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSubApproved: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 15,
  },
  bannerTitleRejected: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSubRejected: {
    color: '#FECACA',
    fontSize: 11,
    lineHeight: 15,
  },
  bannerTitlePending: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSubPending: {
    color: '#FDE68A',
    fontSize: 11,
    lineHeight: 15,
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  stepperCardTitle: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  stepperList: {
    gap: 0,
  },
  stageItem: {
    flexDirection: 'row',
  },
  stageLeft: {
    alignItems: 'center',
    width: 32,
  },
  stageNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  nodeCurrent: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  nodeFailed: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  nodeNum: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  stageLine: {
    width: 2,
    height: 38,
    backgroundColor: '#F1F5F9',
  },
  lineDone: {
    backgroundColor: '#10B981',
  },
  stageRight: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 24,
  },
  stageTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  stageTitleDone: {
    color: '#172B4D',
  },
  stageTitleCurrent: {
    color: '#F05A22',
  },
  stageDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pendingActionCol: {
    gap: 10,
    marginBottom: 12,
  },
  refreshBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  completeRegBtn: {
    backgroundColor: '#FFF7ED',
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#FFEDD5',
  },
  completeRegText: {
    color: '#F05A22',
    fontSize: 13,
    fontWeight: '700',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  supportText: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
  },
});
