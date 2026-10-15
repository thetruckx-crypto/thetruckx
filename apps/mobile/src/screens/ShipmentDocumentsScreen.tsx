import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  X,
  ExternalLink,
} from 'lucide-react-native';
import { BrandLogoHeader } from '../components/BrandLogoHeader';

interface ShipmentDocumentsScreenProps {
  shipmentId: string;
  onBack: () => void;
  onViewPod: (shipmentId: string) => void;
}

const DOCUMENTS = [
  {
    id: 'DOC-LR',
    title: 'Lorry Receipt (LR / Bilty)',
    fileName: 'NECL_LR_2026_0948.pdf',
    size: '1.2 MB',
    date: '10 Oct 2026',
    status: 'ISSUED & STAMPED',
    docType: 'LR',
  },
  {
    id: 'DOC-EWAY',
    title: 'e-Way Bill Copy',
    fileName: 'EWAY_BILL_981240182.pdf',
    size: '850 KB',
    date: '10 Oct 2026',
    status: 'ACTIVE ON GST PORTAL',
    docType: 'EWAY',
  },
  {
    id: 'DOC-WEIGHT',
    title: 'Weighbridge Weight Slip',
    fileName: 'WEIGH_SLIP_BELTOLA_HUB.pdf',
    size: '640 KB',
    date: '10 Oct 2026',
    status: 'GROSS / TARE CERTIFIED',
    docType: 'WEIGHT',
  },
  {
    id: 'DOC-INS',
    title: 'Transit Insurance Certificate',
    fileName: 'NECL_POLICY_50L_COV.pdf',
    size: '1.5 MB',
    date: '10 Oct 2026',
    status: 'ACTIVE ALL-RISK POLICY',
    docType: 'INSURANCE',
  },
];

export const ShipmentDocumentsScreen: React.FC<ShipmentDocumentsScreenProps> = ({
  shipmentId,
  onBack,
  onViewPod,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null);

  const handleDownload = (docName: string) => {
    Alert.alert('Download Started', `Downloading official copy of "${docName}" from secure storage.`);
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

      {/* Screen Title */}
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Shipment Documents</Text>
        <Text style={styles.headerSubtitle}>
          Authorized transport receipts, e-Way bill & weighbridge records for {shipmentId}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Compliance Card */}
        <View style={styles.complianceCard}>
          <ShieldCheck size={20} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.complianceTitle}>Official NECL Transit Records</Text>
            <Text style={styles.complianceDesc}>
              All documents are cryptographically signed and stored in compliance with Indian Motor Vehicle & GST rules.
            </Text>
          </View>
        </View>

        {/* Documents List */}
        {DOCUMENTS.map((doc) => (
          <View key={doc.id} style={styles.docCard}>
            <View style={styles.docHeader}>
              <View style={styles.docIconBox}>
                <FileText size={20} color="#F05A22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docFileName}>{doc.fileName}</Text>
                <Text style={styles.docMeta}>
                  {doc.size} • Issued on {doc.date}
                </Text>
              </View>
            </View>

            <View style={styles.statusPill}>
              <CheckCircle2 size={12} color="#059669" />
              <Text style={styles.statusPillText}>{doc.status}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => setSelectedPreview(doc)}
                activeOpacity={0.8}
              >
                <Eye size={15} color="#0A1931" />
                <Text style={styles.previewBtnText}>Preview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => handleDownload(doc.fileName)}
                activeOpacity={0.8}
              >
                <Download size={15} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Shortcut to POD */}
        <TouchableOpacity
          style={styles.podShortcutBtn}
          onPress={() => onViewPod(shipmentId)}
          activeOpacity={0.88}
        >
          <FileCheck2 size={18} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.podShortcutTitle}>Looking for Proof of Delivery (POD)?</Text>
            <Text style={styles.podShortcutSub}>View consignee delivery stamp and physical sign-off</Text>
          </View>
          <ExternalLink size={16} color="#059669" />
        </TouchableOpacity>
      </ScrollView>

      {/* Preview Modal */}
      <Modal
        visible={!!selectedPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPreview(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPreview?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedPreview(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewPaper}>
              <BrandLogoHeader size="sm" />
              <Text style={styles.paperSub}>NORTH EASTERN CARRIERS OFFICIAL RECEIPT</Text>
              <View style={styles.paperDivider} />
              <Text style={styles.paperItem}>Reference: {shipmentId}</Text>
              <Text style={styles.paperItem}>File: {selectedPreview?.fileName}</Text>
              <Text style={styles.paperItem}>Security Digest: SHA256-AUTHENTICATED</Text>
              <View style={styles.paperStamp}>
                <Text style={styles.stampText}>AUTHORIZED & ISSUED</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalDownloadBtn}
              onPress={() => {
                handleDownload(selectedPreview?.fileName);
                setSelectedPreview(null);
              }}
            >
              <Download size={16} color="#FFFFFF" />
              <Text style={styles.modalDownloadText}>Download File</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerWrap: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1931',
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  complianceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  complianceTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#065F46',
  },
  complianceDesc: {
    fontSize: 11.5,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  docHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  docIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  docFileName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  docMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0A1931',
  },
  downloadBtn: {
    flex: 1.2,
    height: 42,
    backgroundColor: '#F05A22',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  podShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
  },
  podShortcutTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#166534',
  },
  podShortcutSub: {
    fontSize: 11.5,
    color: '#15803D',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 49, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1931',
  },
  previewPaper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  paperSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
    letterSpacing: 0.8,
  },
  paperDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  paperItem: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  paperStamp: {
    marginTop: 14,
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stampText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
  },
  modalDownloadBtn: {
    height: 48,
    backgroundColor: '#F05A22',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalDownloadText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
