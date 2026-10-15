import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ShieldCheck,
  Calendar,
  MapPin,
  User,
  Package,
  FileCheck2,
  AlertTriangle,
  QrCode,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';

interface ProofOfDeliveryScreenProps {
  shipmentId: string;
  onBack: () => void;
  onContactSupport?: () => void;
}

export const ProofOfDeliveryScreen: React.FC<ProofOfDeliveryScreenProps> = ({
  shipmentId,
  onBack,
  onContactSupport,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      Alert.alert('Download Complete', 'The digitally signed e-POD has been saved to your downloads folder.');
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <BrandLogoHeader size="sm" />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Verification Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.verifiedIconWrap}>
            <CheckCircle2 size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusBannerTitle}>Proof of Delivery Acknowledged</Text>
            <Text style={styles.statusBannerSub}>
              Digital acknowledgment with physical rubber stamp and consignee signature
            </Text>
          </View>
        </View>

        {/* Consignment Reference Card */}
        <View style={styles.refCard}>
          <Text style={styles.refLabel}>CONSIGNMENT / TRIP REFERENCE</Text>
          <Text style={styles.refId}>{shipmentId || 'NEC-BOK-8491028'}</Text>
          <View style={styles.divider} />
          <View style={styles.refRow}>
            <Calendar size={15} color="#64748B" />
            <Text style={styles.refDate}>Delivered on 12 Oct 2026 at 04:30 PM IST</Text>
          </View>
        </View>

        {/* Receiver Details Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <FileCheck2 size={17} color="#F05A22" />
            <Text style={styles.cardTitle}>Consignee Receiving Sign-off</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Receiver Legal Name</Text>
            <Text style={styles.value}>M/s Dankuni Freight Distributors</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Received By (Person)</Text>
            <Text style={styles.value}>A. K. Ghosh (Warehouse Manager)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Delivery Hub Address</Text>
            <Text style={styles.value}>Dankuni Complex, Delhi Road, Kolkata</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Packages Received</Text>
            <Text style={[styles.value, { color: '#059669', fontWeight: '800' }]}>
              100% Cleared (Zero Shortage)
            </Text>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Cargo Condition</Text>
            <Text style={[styles.value, { color: '#059669' }]}>Sound / Seal Intact</Text>
          </View>
        </View>

        {/* Visual Digital POD Stamp Box */}
        <View style={styles.stampCard}>
          <View style={styles.stampHeader}>
            <ShieldCheck size={16} color="#059669" />
            <Text style={styles.stampHeaderText}>Digitally Signed Electronic POD</Text>
          </View>

          <View style={styles.stampCanvas}>
            <View style={styles.stampBorder}>
              <Text style={styles.stampEntity}>RECEIVED IN GOOD ORDER</Text>
              <Text style={styles.stampConsignee}>DANKUNI LOGISTICS WAREHOUSE</Text>
              <View style={styles.stampLine} />
              <View style={styles.stampFooterRow}>
                <View>
                  <Text style={styles.stampMeta}>DATE: 12-OCT-2026</Text>
                  <Text style={styles.stampMeta}>SIGN: A. K. Ghosh</Text>
                </View>
                <QrCode size={36} color="#065F46" />
              </View>
            </View>
          </View>
        </View>

        {/* Download Button */}
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={handleDownload}
          disabled={downloading}
          activeOpacity={0.88}
        >
          <Download size={18} color="#FFFFFF" />
          <Text style={styles.downloadBtnText}>
            {downloading ? 'Preparing Signed PDF...' : 'Download Stamped e-POD Copy'}
          </Text>
        </TouchableOpacity>

        {/* Discrepancy Reporting Link */}
        {onContactSupport && (
          <TouchableOpacity
            style={styles.discrepancyBtn}
            onPress={onContactSupport}
            activeOpacity={0.7}
          >
            <AlertTriangle size={15} color="#64748B" />
            <Text style={styles.discrepancyText}>
              Notice any discrepancy in this POD? Contact Control Tower
            </Text>
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  verifiedIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#065F46',
  },
  statusBannerSub: {
    fontSize: 11.5,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  refCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  refLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  refId: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1931',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refDate: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  label: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0A1931',
    maxWidth: '58%',
    textAlign: 'right',
  },
  stampCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  stampHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  stampHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1931',
  },
  stampCanvas: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
  },
  stampBorder: {
    borderWidth: 2,
    borderColor: '#059669',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
  },
  stampEntity: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.8,
  },
  stampConsignee: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  stampLine: {
    height: 1,
    backgroundColor: '#A7F3D0',
    marginVertical: 10,
  },
  stampFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stampMeta: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  downloadBtn: {
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
    marginBottom: 14,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discrepancyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  discrepancyText: {
    fontSize: 12,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});
