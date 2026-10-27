import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  Truck,
  Plus,
  CheckCircle2,
  X,
  FileText,
  Weight,
  ShieldCheck,
  Camera,
  UploadCloud,
  Check,
  Trash2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react-native';
import { DocumentPickerModal, PickedDocumentResult } from '../../../components/DocumentPickerModal';
import { vendorService } from '../../../services/vendorService';
import { VendorBottomNavBar, VendorNavTab } from '../../../components/VendorBottomNavBar';

interface VendorFleetManagementScreenProps {
  vendorId: string;
  onBack: () => void;
  onSelectNavTab?: (tab: VendorNavTab) => void;
}

type VehicleCategory = 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
type BodyType = 'Open Body' | 'Closed Body';
type OwnershipType = 'Owned' | 'Attached';
type DocType = 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT';

interface VehicleDocState {
  docType: DocType;
  fileName: string;
  fileSize: string;
  mimeType: string;
  uri: string;
  blob?: any;
}

export const VendorFleetManagementScreen: React.FC<VendorFleetManagementScreenProps> = ({
  vendorId,
  onBack,
  onSelectNavTab,
}) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form state
  const [regNumber, setRegNumber] = useState('');
  const [category, setCategory] = useState<VehicleCategory>('Lorry');
  const [bodyType, setBodyType] = useState<BodyType>('Open Body');
  const [ratedCapacityMt, setRatedCapacityMt] = useState('');
  const [minimumCapacityMt, setMinimumCapacityMt] = useState('');
  const [ownership, setOwnership] = useState<OwnershipType>('Owned');
  const [rcNumber, setRcNumber] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocType, VehicleDocState | null>>({
    RC: null,
    INSURANCE: null,
    FITNESS: null,
    PERMIT: null,
  });

  // Document picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activePickerDoc, setActivePickerDoc] = useState<{
    docType: DocType;
    title: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  const categories: VehicleCategory[] = ['Lorry', 'Trailer', 'Van', 'Heavy Carrier'];
  const bodyTypes: BodyType[] = ['Open Body', 'Closed Body'];
  const ownershipOptions: OwnershipType[] = ['Owned', 'Attached'];

  const loadVehicles = useCallback(async () => {
    try {
      const data = await vendorService.getVendorVehicles(vendorId);
      setVehicles(data);
    } catch {
      // Keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVehicles();
  };

  const openDocPicker = (docType: DocType, title: string) => {
    setActivePickerDoc({ docType, title });
    setPickerVisible(true);
  };

  const handleDocumentPicked = (result: PickedDocumentResult) => {
    if (!activePickerDoc) return;
    setUploadedDocs((prev) => ({
      ...prev,
      [activePickerDoc.docType]: {
        docType: activePickerDoc.docType,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        uri: result.uri,
        blob: result.blob,
      },
    }));
    setPickerVisible(false);
    setActivePickerDoc(null);
  };

  const removeDoc = (docType: DocType) => {
    setUploadedDocs((prev) => ({
      ...prev,
      [docType]: null,
    }));
  };

  const resetForm = () => {
    setRegNumber('');
    setCategory('Lorry');
    setBodyType('Open Body');
    setRatedCapacityMt('');
    setMinimumCapacityMt('');
    setOwnership('Owned');
    setRcNumber('');
    setUploadedDocs({
      RC: null,
      INSURANCE: null,
      FITNESS: null,
      PERMIT: null,
    });
  };

  const handleAddVehicle = async () => {
    const cleanPlate = regNumber.trim().toUpperCase();
    if (!cleanPlate || cleanPlate.length < 6) {
      Alert.alert('Required Field', 'Please enter a valid Commercial Registration Number (e.g. AS 01 AB 1234).');
      return;
    }

    const ratedMt = parseFloat(ratedCapacityMt);
    if (isNaN(ratedMt) || ratedMt <= 0) {
      Alert.alert('Required Field', 'Please enter a valid Rated Capacity in MT (e.g. 25).');
      return;
    }

    const minMt = minimumCapacityMt.trim() ? parseFloat(minimumCapacityMt) : Math.max(1, Math.round(ratedMt * 0.5));
    if (isNaN(minMt) || minMt <= 0 || minMt > ratedMt) {
      Alert.alert('Invalid Input', 'Minimum Capacity (MT) must be greater than 0 and less than or equal to Rated Capacity.');
      return;
    }

    const cleanRc = rcNumber.trim() ? rcNumber.trim().toUpperCase() : cleanPlate;

    // Check mandatory RC doc
    if (!uploadedDocs.RC) {
      Alert.alert('Document Required', 'Please upload the Vehicle Registration Certificate (RC) to proceed.');
      return;
    }

    setSaving(true);
    try {
      // Gather documents
      const docsToUpload: Array<{
        docType: DocType;
        fileName: string;
        fileSize?: string;
        mimeType?: string;
        uri?: string;
        blob?: any;
      }> = [];

      (Object.keys(uploadedDocs) as DocType[]).forEach((dt) => {
        const item = uploadedDocs[dt];
        if (item) {
          docsToUpload.push({
            docType: dt,
            fileName: item.fileName,
            fileSize: item.fileSize,
            mimeType: item.mimeType,
            uri: item.uri,
            blob: item.blob,
          });
        }
      });

      const res = await vendorService.addVendorVehicle(vendorId, {
        registrationNumber: cleanPlate,
        category,
        bodyType,
        ratedCapacityMt: ratedMt,
        minimumCapacityMt: minMt,
        ownership,
        rcNumber: cleanRc,
        documents: docsToUpload,
      });

      if (res.success) {
        Alert.alert(
          'Vehicle Registered Successfully',
          `Vehicle ${cleanPlate} (${category} - ${bodyType}) has been submitted for admin verification.`
        );
        setShowAddModal(false);
        resetForm();
        loadVehicles();
      } else {
        Alert.alert('Registration Error', 'Failed to register vehicle. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not register vehicle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Compact Header Bar */}
      <View style={styles.compactHeaderBar}>
        <TouchableOpacity style={styles.headerBackCircle} onPress={onBack} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.compactHeaderTitle}>
          Fleet & <Text style={{ color: '#FF5A1F' }}>Vehicles</Text>
        </Text>
        <TouchableOpacity style={styles.addVehicleBtnHeader} onPress={() => setShowAddModal(true)}>
          <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5A1F" />
        }
      >
        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>
                Fleet & <Text style={styles.goldText}>Vehicles</Text>
              </Text>
              <Text style={styles.subText}>
                Register & manage commercial transport vehicles under your transport firm.
              </Text>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#F05A22" style={{ marginVertical: 30 }} />
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Truck size={36} color="#F05A22" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No Fleet Vehicles Registered</Text>
              <Text style={styles.emptySub}>
                Vehicles must be registered through this portal to appear in the fleet directory. Tap "+ Add Vehicle" to register your commercial trucks.
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { marginTop: 16 }]}
                onPress={() => setShowAddModal(true)}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Register First Vehicle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.vehiclesCol}>
              {vehicles.map((v) => {
                const isApproved = v.verificationStatus === 'APPROVED' || v.status === 'APPROVED';
                const isRejected = v.verificationStatus === 'REJECTED';
                const statusLabel = isApproved ? 'VERIFIED' : isRejected ? 'REJECTED' : 'UNDER REVIEW';

                return (
                  <View key={v.id} style={styles.vehicleCard}>
                    <View style={styles.vehicleTop}>
                      <View style={styles.regBadge}>
                        <Truck size={14} color="#F05A22" />
                        <Text style={styles.regNumber}>{v.registrationNumber}</Text>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          isApproved && styles.statusPillApproved,
                          isRejected && styles.statusPillRejected,
                        ]}
                      >
                        {isApproved ? (
                          <CheckCircle2 size={11} color="#10B981" />
                        ) : isRejected ? (
                          <AlertCircle size={11} color="#EF4444" />
                        ) : (
                          <FileCheck2 size={11} color="#F59E0B" />
                        )}
                        <Text
                          style={[
                            styles.statusText,
                            isApproved && styles.statusTextApproved,
                            isRejected && styles.statusTextRejected,
                          ]}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.specsRow}>
                      <View style={styles.specBox}>
                        <Text style={styles.specLabel}>Category & Body:</Text>
                        <Text style={styles.specVal}>
                          {v.category || v.vehicleType || 'Lorry'} • {v.bodyType || 'Open Body'}
                        </Text>
                      </View>

                      <View style={styles.specBox}>
                        <Text style={styles.specLabel}>Capacity (Rated / Min):</Text>
                        <Text style={styles.specVal}>
                          {parseFloat(String(v.ratedCapacityMt || '')) || 20} MT / {parseFloat(String(v.minimumCapacityMt || '')) || Math.round((parseFloat(String(v.ratedCapacityMt || '')) || 20) * 0.5)} MT
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.rcWrap}>
                        <FileText size={12} color="#64748B" />
                        <Text style={styles.rcText}>RC: {v.rcNumber || v.registrationNumber}</Text>
                      </View>
                      <View style={styles.readyBadge}>
                        <ShieldCheck size={12} color={isApproved ? '#10B981' : '#F59E0B'} />
                        <Text style={[styles.readyText, !isApproved && { color: '#F59E0B' }]}>
                          {isApproved ? 'Operations Ready' : 'Pending Verification'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Vehicle Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Register Commercial Vehicle</Text>
                <Text style={styles.modalSubTitle}>
                  Enter vehicle specs and upload official verification documents.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollBody}>
              {/* Registration Number */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Commercial Registration Number (Plate) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. AS 01 AB 1234"
                  placeholderTextColor="#94A3B8"
                  value={regNumber}
                  onChangeText={setRegNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* Vehicle Category */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Vehicle Category *</Text>
                <View style={styles.pillRow}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.typePill, category === cat && styles.typePillActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.typePillText, category === cat && styles.typePillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Body Type */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Body Type (Open / Closed only) *</Text>
                <View style={styles.pillRow}>
                  {bodyTypes.map((bt) => (
                    <TouchableOpacity
                      key={bt}
                      style={[styles.typePill, bodyType === bt && styles.typePillActive]}
                      onPress={() => setBodyType(bt)}
                    >
                      <Text style={[styles.typePillText, bodyType === bt && styles.typePillTextActive]}>
                        {bt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Capacity row */}
              <View style={styles.twoColRow}>
                <View style={[styles.modalField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.modalLabel}>Rated Capacity (MT) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 25"
                    placeholderTextColor="#94A3B8"
                    value={ratedCapacityMt}
                    onChangeText={setRatedCapacityMt}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.modalField, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.modalLabel}>Minimum Capacity (MT) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 15"
                    placeholderTextColor="#94A3B8"
                    value={minimumCapacityMt}
                    onChangeText={setMinimumCapacityMt}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Ownership */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Vehicle Ownership *</Text>
                <View style={styles.pillRow}>
                  {ownershipOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.typePill, ownership === opt && styles.typePillActive]}
                      onPress={() => setOwnership(opt)}
                    >
                      <Text style={[styles.typePillText, ownership === opt && styles.typePillTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* RC Number */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>RC Certificate Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. RC9876543210"
                  placeholderTextColor="#94A3B8"
                  value={rcNumber}
                  onChangeText={setRcNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* Documents Upload Section */}
              <View style={styles.docsSection}>
                <Text style={styles.docsSectionTitle}>Required Vehicle Documents (Camera or Local Files)</Text>
                <Text style={styles.docsSectionSubtitle}>
                  Upload clear photos or PDF copies for compliance verification.
                </Text>

                {/* 1. RC Certificate */}
                <View style={styles.docTile}>
                  <View style={styles.docTileInfo}>
                    <Text style={styles.docTileTitle}>Registration Certificate (RC) *</Text>
                    <Text style={styles.docTileSub}>Mandatory vehicle ownership proof</Text>
                    {uploadedDocs.RC && (
                      <View style={styles.uploadedBadge}>
                        <Check size={12} color="#10B981" />
                        <Text style={styles.uploadedBadgeText} numberOfLines={1}>
                          {uploadedDocs.RC.fileName} ({uploadedDocs.RC.fileSize})
                        </Text>
                      </View>
                    )}
                  </View>
                  {uploadedDocs.RC ? (
                    <View style={styles.docTileActions}>
                      <TouchableOpacity
                        style={styles.changeDocBtn}
                        onPress={() => openDocPicker('RC', 'Registration Certificate (RC)')}
                      >
                        <Text style={styles.changeDocText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteDocBtn}
                        onPress={() => removeDoc('RC')}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadDocBtn}
                      onPress={() => openDocPicker('RC', 'Registration Certificate (RC)')}
                    >
                      <Camera size={14} color="#F05A22" />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Insurance */}
                <View style={styles.docTile}>
                  <View style={styles.docTileInfo}>
                    <Text style={styles.docTileTitle}>Commercial Insurance Policy</Text>
                    <Text style={styles.docTileSub}>Comprehensive commercial goods policy</Text>
                    {uploadedDocs.INSURANCE && (
                      <View style={styles.uploadedBadge}>
                        <Check size={12} color="#10B981" />
                        <Text style={styles.uploadedBadgeText} numberOfLines={1}>
                          {uploadedDocs.INSURANCE.fileName} ({uploadedDocs.INSURANCE.fileSize})
                        </Text>
                      </View>
                    )}
                  </View>
                  {uploadedDocs.INSURANCE ? (
                    <View style={styles.docTileActions}>
                      <TouchableOpacity
                        style={styles.changeDocBtn}
                        onPress={() => openDocPicker('INSURANCE', 'Insurance Policy')}
                      >
                        <Text style={styles.changeDocText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteDocBtn}
                        onPress={() => removeDoc('INSURANCE')}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadDocBtn}
                      onPress={() => openDocPicker('INSURANCE', 'Insurance Policy')}
                    >
                      <UploadCloud size={14} color="#F05A22" />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3. Fitness Certificate */}
                <View style={styles.docTile}>
                  <View style={styles.docTileInfo}>
                    <Text style={styles.docTileTitle}>Fitness Certificate</Text>
                    <Text style={styles.docTileSub}>Valid commercial vehicle roadworthiness</Text>
                    {uploadedDocs.FITNESS && (
                      <View style={styles.uploadedBadge}>
                        <Check size={12} color="#10B981" />
                        <Text style={styles.uploadedBadgeText} numberOfLines={1}>
                          {uploadedDocs.FITNESS.fileName} ({uploadedDocs.FITNESS.fileSize})
                        </Text>
                      </View>
                    )}
                  </View>
                  {uploadedDocs.FITNESS ? (
                    <View style={styles.docTileActions}>
                      <TouchableOpacity
                        style={styles.changeDocBtn}
                        onPress={() => openDocPicker('FITNESS', 'Fitness Certificate')}
                      >
                        <Text style={styles.changeDocText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteDocBtn}
                        onPress={() => removeDoc('FITNESS')}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadDocBtn}
                      onPress={() => openDocPicker('FITNESS', 'Fitness Certificate')}
                    >
                      <UploadCloud size={14} color="#F05A22" />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 4. Permit */}
                <View style={styles.docTile}>
                  <View style={styles.docTileInfo}>
                    <Text style={styles.docTileTitle}>Goods Transport Permit</Text>
                    <Text style={styles.docTileSub}>National or Northeast All-States permit</Text>
                    {uploadedDocs.PERMIT && (
                      <View style={styles.uploadedBadge}>
                        <Check size={12} color="#10B981" />
                        <Text style={styles.uploadedBadgeText} numberOfLines={1}>
                          {uploadedDocs.PERMIT.fileName} ({uploadedDocs.PERMIT.fileSize})
                        </Text>
                      </View>
                    )}
                  </View>
                  {uploadedDocs.PERMIT ? (
                    <View style={styles.docTileActions}>
                      <TouchableOpacity
                        style={styles.changeDocBtn}
                        onPress={() => openDocPicker('PERMIT', 'Goods Transport Permit')}
                      >
                        <Text style={styles.changeDocText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteDocBtn}
                        onPress={() => removeDoc('PERMIT')}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadDocBtn}
                      onPress={() => openDocPicker('PERMIT', 'Goods Transport Permit')}
                    >
                      <UploadCloud size={14} color="#F05A22" />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.goldBtn, saving && styles.goldBtnDisabled]}
                onPress={handleAddVehicle}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.goldBtnText}>Submit Vehicle for Verification</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reusable Document Picker (Camera + Local Files) */}
      {pickerVisible && activePickerDoc && (
        <DocumentPickerModal
          visible={pickerVisible}
          documentTitle={activePickerDoc.title}
          docType={activePickerDoc.docType}
          onClose={() => {
            setPickerVisible(false);
            setActivePickerDoc(null);
          }}
          onFilePicked={handleDocumentPicked}
        />
      )}

      <VendorBottomNavBar
        activeTab="FLEET"
        onSelectTab={(tab) => {
          if (onSelectNavTab) onSelectNavTab(tab);
          else onBack();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  compactHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  headerBackCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  compactHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172B4D',
  },
  addVehicleBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF5A1F',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 2,
  },
  goldText: {
    color: '#F05A22',
  },
  subText: {
    fontSize: 11,
    color: '#64748B',
    maxWidth: 220,
    lineHeight: 15,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F05A22',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  vehiclesCol: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  vehicleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  regBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  regNumber: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusPillRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextApproved: {
    color: '#10B981',
  },
  statusTextRejected: {
    color: '#EF4444',
  },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  specBox: {
    flex: 1,
  },
  specLabel: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 2,
  },
  specVal: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rcWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rcText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readyText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    color: '#172B4D',
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  closeBtn: {
    padding: 4,
  },
  modalTitle: {
    color: '#172B4D',
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubTitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  modalScrollBody: {
    paddingBottom: 20,
  },
  modalField: {
    marginBottom: 14,
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  typePillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  docsSection: {
    marginTop: 10,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  docsSectionTitle: {
    color: '#172B4D',
    fontSize: 13,
    fontWeight: '800',
  },
  docsSectionSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 10,
    marginTop: 2,
  },
  docTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  docTileInfo: {
    flex: 1,
    marginRight: 10,
  },
  docTileTitle: {
    color: '#172B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  docTileSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  uploadedBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 160,
  },
  docTileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeDocBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  changeDocText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteDocBtn: {
    padding: 5,
  },
  uploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  uploadDocText: {
    color: '#F05A22',
    fontSize: 11,
    fontWeight: '700',
  },
  goldBtn: {
    backgroundColor: '#F05A22',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  goldBtnDisabled: {
    opacity: 0.5,
  },
  goldBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
