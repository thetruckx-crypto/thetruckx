import React, { useEffect } from 'react';
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
  Clock,
  ShieldCheck,
  ArrowRight,
  Home,
  FileCheck,
} from 'lucide-react-native';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { supabase } from '../../../supabase';

interface VendorSubmissionConfirmationScreenProps {
  applicationNumber: string;
  vendorName?: string;
  vendorId?: string;
  onTrackStatus: () => void;
  onGoToDashboard: () => void;
  onBackToLogin?: () => void;
}

export const VendorSubmissionConfirmationScreen: React.FC<VendorSubmissionConfirmationScreenProps> = ({
  applicationNumber,
  vendorName = 'Transport Enterprise',
  vendorId,
  onTrackStatus,
  onGoToDashboard,
  onBackToLogin,
}) => {
  useEffect(() => {
    const targetIdentifier = vendorId || applicationNumber;
    if (!targetIdentifier) return;

    const checkApproval = async () => {
      try {
        const res = await vendorService.getVendorVerificationStatus(targetIdentifier);
        if (res.status === 'APPROVED') {
          onGoToDashboard();
        }
      } catch {
        // Ignore
      }
    };

    checkApproval();

    const cleanId = (targetIdentifier || '').replace(/[^a-zA-Z0-9]/g, '').slice(-16);
    const channelName = `realtime-vendor-sub-${cleanId}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_companies' }, () => {
        checkApproval();
      })
      .subscribe();

    const interval = setInterval(checkApproval, 2500);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [vendorId, applicationNumber, onGoToDashboard]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          {/* Success Icon */}
          <View style={styles.successIconWrap}>
            <CheckCircle2 size={56} color="#10B981" strokeWidth={2.5} />
          </View>

          <Text style={styles.titleText}>
            Registration <Text style={styles.goldText}>Submitted Successfully</Text>
          </Text>

          <Text style={styles.subText}>
            Your application is awaiting admin approval.
          </Text>

          {/* Reference Card */}
          <View style={styles.refCard}>
            <View style={styles.refRow}>
              <Text style={styles.refLabel}>APPLICATION REF:</Text>
              <Text style={styles.refCode}>{applicationNumber}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.refRow}>
              <Text style={styles.refLabel}>ENTERPRISE:</Text>
              <Text style={styles.refVal}>{vendorName}</Text>
            </View>

            <View style={styles.refRow}>
              <Text style={styles.refLabel}>SUBMITTED ON:</Text>
              <Text style={styles.refVal}>
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>

            <View style={styles.refRow}>
              <Text style={styles.refLabel}>CURRENT STATUS:</Text>
              <View style={styles.statusPill}>
                <Clock size={12} color="#F59E0B" />
                <Text style={styles.statusPillText}>Under Review</Text>
              </View>
            </View>
          </View>

          {/* Verification Timeline Notice */}
          <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <ShieldCheck size={16} color="#F05A22" />
              <Text style={styles.timelineTitle}>WHAT HAPPENS NEXT?</Text>
            </View>

            <View style={styles.timelineSteps}>
              <View style={styles.stepItem}>
                <View style={styles.bullet} />
                <Text style={styles.stepText}>
                  <Text style={styles.boldText}>Document Audit:</Text> Compliance team verifies GSTIN, PAN, and Bank Cheque validity.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.bullet} />
                <Text style={styles.stepText}>
                  <Text style={styles.boldText}>Review Window:</Text> Audit completed within 12 - 24 business hours.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.bullet} />
                <Text style={styles.stepText}>
                  <Text style={styles.boldText}>Load Allocation:</Text> Full access to submit quotes on active transport requirements once approved.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.goldBtn} onPress={onTrackStatus} activeOpacity={0.85}>
            <FileCheck size={18} color="#FFFFFF" />
            <Text style={styles.goldBtnText}>Track Verification Status</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onGoToDashboard} activeOpacity={0.8}>
            <Home size={16} color="#475569" />
            <Text style={styles.secondaryBtnText}>Enter Vendor Portal</Text>
          </TouchableOpacity>

          {onBackToLogin && (
            <TouchableOpacity style={styles.loginBtn} onPress={onBackToLogin} activeOpacity={0.85}>
              <Text style={styles.loginBtnText}>Log In with Registered Number</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  logoWrap: {
    alignItems: 'center',
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    paddingHorizontal: 12,
  },
  refCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  refLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  refCode: {
    color: '#F05A22',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  refVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '600',
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
  statusPillText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    padding: 16,
    marginBottom: 24,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timelineTitle: {
    color: '#F05A22',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timelineSteps: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F05A22',
    marginTop: 6,
  },
  stepText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    color: '#172B4D',
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
  loginBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  loginBtnText: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '700',
  },
});
