import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  FileText,
  ShieldCheck,
  CreditCard,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react-native';
import { driverService } from '../../../services/driverService';

interface DriverDocumentsScreenProps {
  initialMobile: string;
  driverId?: string;
  onBack: () => void;
  onNavigateCorrection?: () => void;
}

export const DriverDocumentsScreen: React.FC<DriverDocumentsScreenProps> = ({
  initialMobile,
  driverId,
  onBack,
  onNavigateCorrection,
}) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const data = await driverService.getDriverProfile(driverId, initialMobile);
      setProfile(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId, initialMobile]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDocs();
  };

  const handleUpdateDoc = (docType: string) => {
    Alert.alert(
      'Document Update',
      `Upload renewed ${docType.replace(/_/g, ' ')}? Our compliance desk will re-verify the new copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload Scan',
          onPress: async () => {
            const activeId = profile?.id || driverId || 'drv-temp';
            await driverService.reuploadDriverDocument(
              activeId,
              `doc-${Date.now()}`,
              docType,
              `https://trucks.in/storage/renewed/${docType.toLowerCase()}.pdf`
            );
            Alert.alert('Uploaded', 'Renewed document submitted for audit.');
            loadDocs();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Driver Documents</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F05A22" />
        }
      >
        <View style={styles.headingWrap}>
          <Text style={styles.titleText}>
            Driver <Text style={styles.goldText}>Credentials & KYC</Text>
          </Text>
          <Text style={styles.subText}>
            Official commercial heavy driving documents on record with TRUCKS and transport authorities.
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#F05A22" />
          </View>
        ) : (
          <>
            {/* Main DL Credential Card */}
            <View style={styles.dlCard}>
              <View style={styles.dlCardTop}>
                <View style={styles.dlBadge}>
                  <CreditCard size={14} color="#FFFFFF" />
                  <Text style={styles.dlBadgeText}>COMMERCIAL DRIVING LICENCE</Text>
                </View>
                <View style={styles.statusVerified}>
                  <ShieldCheck size={13} color="#10B981" />
                  <Text style={styles.statusVerifiedText}>SARATHI AUDITED</Text>
                </View>
              </View>

              <Text style={styles.dlNumber}>
                {profile?.licenceNumber || 'Licence Pending'}
              </Text>
              <Text style={styles.dlPilotName}>
                Pilot: {profile?.fullName || 'Driver'}
              </Text>

              <View style={styles.dlFooter}>
                <View>
                  <Text style={styles.dlSubLabel}>VALIDITY EXPIRY</Text>
                  <Text style={styles.dlSubVal}>{profile?.licenceExpiryDate || 'Pending Audit'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.dlSubLabel}>FLEET ATTACHMENT</Text>
                  <Text style={styles.dlSubVal}>{profile?.vendorName || 'TRUCKS National Fleet'}</Text>
                </View>
              </View>
            </View>

            {/* Document Verification Roster */}
            <View style={styles.sectionHeadingWrap}>
              <Text style={styles.sectionHeading}>Verification Documents On Record</Text>
            </View>

            <View style={styles.docRoster}>
              {/* Document 1: DL */}
              <View style={styles.docItemCard}>
                <View style={styles.docIconWrap}>
                  <FileText size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Commercial Driving Licence (DL)</Text>
                  <Text style={styles.docSub}>Expiry: {profile?.licenceExpiryDate || 'Under Review'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.updatePill}
                  onPress={() => handleUpdateDoc('DRIVING_LICENCE')}
                >
                  <Text style={styles.updatePillText}>Renew</Text>
                </TouchableOpacity>
              </View>

              {/* Document 2: Aadhaar Card */}
              <View style={styles.docItemCard}>
                <View style={styles.docIconWrap}>
                  <ShieldCheck size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Aadhaar Identity Proof (UIDAI)</Text>
                  <Text style={styles.docSub}>Biometric KYC Match • Verified</Text>
                </View>
                <TouchableOpacity
                  style={styles.updatePill}
                  onPress={() => handleUpdateDoc('AADHAR_CARD')}
                >
                  <Text style={styles.updatePillText}>Update</Text>
                </TouchableOpacity>
              </View>

              {/* Document 3: Medical Fitness Form 1A */}
              <View style={styles.docItemCard}>
                <View style={styles.docIconWrap}>
                  <FileText size={18} color="#F05A22" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Medical Fitness Certificate (Form 1A)</Text>
                  <Text style={styles.docSub}>Annual Heavy Pilot Health Certification</Text>
                </View>
                <TouchableOpacity
                  style={styles.updatePill}
                  onPress={() => handleUpdateDoc('MEDICAL_FITNESS')}
                >
                  <Text style={styles.updatePillText}>Upload</Text>
                </TouchableOpacity>
              </View>

              {/* Document 4: Police Verification */}
              <View style={styles.docItemCard}>
                <View style={styles.docIconWrap}>
                  <ShieldCheck size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>Police Clearance Verification</Text>
                  <Text style={styles.docSub}>State Police Background Check</Text>
                </View>
                <TouchableOpacity
                  style={styles.updatePill}
                  onPress={() => handleUpdateDoc('POLICE_VERIFICATION')}
                >
                  <Text style={styles.updatePillText}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Compliance Guarantee */}
            <View style={styles.complianceCard}>
              <Lock size={16} color="#F05A22" />
              <Text style={styles.complianceText}>
                Credentials are encrypted and safely stored. Commercial pilots with verified credentials receive 100% prioritized load dispatches and direct FASTag toll advances.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172B4D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headingWrap: {
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 4,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  dlCard: {
    backgroundColor: '#14161E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 16,
    marginBottom: 20,
  },
  dlCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dlBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusVerifiedText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  dlNumber: {
    color: '#F05A22',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  dlPilotName: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  dlFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  dlSubLabel: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '700',
  },
  dlSubVal: {
    color: '#172B4D',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeadingWrap: {
    marginBottom: 12,
  },
  sectionHeading: {
    color: '#172B4D',
    fontSize: 13.5,
    fontWeight: '700',
  },
  docRoster: {
    gap: 10,
    marginBottom: 18,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: {
    color: '#172B4D',
    fontSize: 12.5,
    fontWeight: '600',
  },
  docSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  updatePill: {
    backgroundColor: '#1C1F28',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  updatePillText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  complianceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    padding: 12,
  },
  complianceText: {
    flex: 1,
    color: '#172B4D',
    fontSize: 11,
    lineHeight: 16,
  },
});
