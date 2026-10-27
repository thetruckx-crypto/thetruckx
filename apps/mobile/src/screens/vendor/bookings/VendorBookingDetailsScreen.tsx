import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Package,
  Truck,
  Users,
  CreditCard,
  Building2,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Navigation,
  Scale,
  FileUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
} from 'lucide-react-native';
import { ScenicHeroBanner } from '../../../components/ScenicHeroBanner';
import { BottomGoldWings } from '../../../components/BottomGoldWings';
import { vendorService } from '../../../services/vendorService';
import { authService } from '../../../services/authService';
import { documentWorkflowService } from '../../../services/documentWorkflowService';

interface VendorBookingDetailsScreenProps {
  bookingId: string;
  onBack: () => void;
  onAssignFleet: (booking: any) => void;
  onViewTrip: (tripId: string) => void;
}

export const VendorBookingDetailsScreen: React.FC<VendorBookingDetailsScreenProps> = ({
  bookingId,
  onBack,
  onAssignFleet,
  onViewTrip,
}) => {
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [weighbillDoc, setWeighbillDoc] = useState<any | null>(null);

  // Upload on behalf modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      const data = await vendorService.getBookingDetails(bookingId);
      setBooking(data);

      if (data?.trip?.id) {
        const docs = await documentWorkflowService.getBookingDocuments(bookingId, data.trip.id);
        const wb = docs.find(
          (d) =>
            d.documentType === 'LOADING_WEIGHBILL' &&
            (d.uploaderRole === 'DRIVER' || d.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER')
        );
        setWeighbillDoc(wb || null);
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleUploadOnBehalf = async () => {
    const grossNum = parseFloat(grossWeight);
    const tareNum = parseFloat(tareWeight);
    if (!grossNum || !tareNum || grossNum <= tareNum) {
      Alert.alert('Invalid Weights', 'Please enter valid Gross and Tare weights in MT.');
      return;
    }

    if (!booking?.trip?.id) {
      Alert.alert('Trip Required', 'Vehicle and driver must be assigned before uploading loading slip.');
      return;
    }

    setUploading(true);
    try {
      const session = await authService.getCurrentSession();
      const vendorId = session?.userId || booking.trip.vendorId || 'VENDOR';
      const vendorName = session?.companyName || session?.fullName || 'Transport Partner';

      const netNum = grossNum - tareNum;
      const fileName = `vendor_behalf_weighslip_${booking.trip.id.slice(-6)}.pdf`;
      const fileUrl = `https://trucks-storage.s3.ap-south-1.amazonaws.com/vendor_uploads/${fileName}`;

      const res = await vendorService.uploadWeighbillOnBehalfOfDriver({
        bookingId,
        tripId: booking.trip.id,
        vendorId,
        vendorName,
        driverId: booking.trip.driverId || 'DRIVER_USER',
        driverName: booking.trip.driverName || 'Assigned Driver',
        fileName,
        fileUrl,
        grossWeightMt: grossNum,
        tareWeightMt: tareNum,
        recordedWeightMt: netNum,
      });

      setUploading(false);
      setShowUploadModal(false);

      if (res.success) {
        Alert.alert(
          'Document Uploaded on Driver Behalf',
          'Weighbill uploaded successfully. Labeled: "Uploaded by Vendor on Behalf of Driver". Note: Driver independent confirmation is still pending.'
        );
        await loadBooking();
      } else {
        Alert.alert('Upload Error', res.message);
      }
    } catch (e: any) {
      setUploading(false);
      Alert.alert('Upload Failed', e.message || 'Could not upload on behalf of driver.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#F05A22" />
          <Text style={styles.loadingText}>Fetching Booking Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) return null;

  const hasTrip = !!booking.trip;
  const isDriverConfirmed = weighbillDoc && (weighbillDoc.metadata?.driverConfirmed || weighbillDoc.uploaderRole === 'DRIVER');
  const isVendorOnBehalf = weighbillDoc?.uploaderRole === 'VENDOR_ON_BEHALF_OF_DRIVER';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        {/* Top Banner */}
        <View style={styles.topWrap}>
          <ScenicHeroBanner height={180} />
          <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#172B4D" />
          </TouchableOpacity>
          
        </View>

        {/* Content */}
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.titleText}>{booking.id}</Text>
              <Text style={styles.subDate}>
                Confirmed on {new Date(booking.confirmedAt || Date.now()).toLocaleDateString('en-GB')}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <ShieldCheck size={12} color="#10B981" />
              <Text style={styles.statusText}>{booking.bookingStatus}</Text>
            </View>
          </View>

          {/* Route Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>PICKUP & DELIVERY ROUTE</Text>
            </View>

            <View style={styles.routeCol}>
              <View style={styles.routeStop}>
                <View style={styles.dotGold} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{booking.pickupAddress}</Text>
                  {booking.pickupPincode && <Text style={styles.pinText}>PIN: {booking.pickupPincode}</Text>}
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeStop}>
                <View style={styles.dotGreen} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopLabel}>DROP DESTINATION</Text>
                  <Text style={styles.stopAddress}>{booking.destinationAddress}</Text>
                  {booking.destinationPincode && <Text style={styles.pinText}>PIN: {booking.destinationPincode}</Text>}
                </View>
              </View>
            </View>
          </View>

          {/* Cargo Particulars */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>CARGO PARTICULARS</Text>
            </View>

            <View style={styles.specsGrid}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Commodity:</Text>
                <Text style={styles.specVal}>{booking.materialType || 'Industrial Equipment'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Tonnage:</Text>
                <Text style={styles.specVal}>{booking.capacityMt} MT</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Vehicle Required:</Text>
                <Text style={styles.specVal}>{booking.vehicleType || '32 FT Multi-Axle'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Payment Status:</Text>
                <Text style={styles.specValGreen}>{booking.paymentStatus || 'PAYMENT_PENDING'}</Text>
              </View>
            </View>
          </View>

          {/* Assigned Lorry & Driver */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Truck size={16} color="#F05A22" />
              <Text style={styles.cardHeaderText}>ASSIGNED FLEET & CREW</Text>
            </View>

            {hasTrip ? (
              <View style={styles.assignedBox}>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Vehicle Number:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.vehicleNumber}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Assigned Driver:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.driverName}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Driver Contact:</Text>
                  <Text style={styles.assignedVal}>{booking.trip.driverPhone}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedLabel}>Trip Status:</Text>
                  <Text style={styles.specValGold}>{booking.trip.tripStatus}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedBox}>
                <Text style={styles.unassignedText}>
                  No commercial vehicle or driver has been allocated to this booking yet.
                </Text>
              </View>
            )}
          </View>

          {/* ── 4. Driver Loading Documents Support Section (Vendor App Feature) ── */}
          {hasTrip && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Scale size={16} color="#F05A22" />
                <Text style={styles.cardHeaderText}>DRIVER LOADING WEIGHBILL STATUS</Text>
              </View>

              {weighbillDoc ? (
                <View style={styles.docStatusBox}>
                  {isVendorOnBehalf && (
                    <View style={styles.vendorBehalfBadge}>
                      <Text style={styles.vendorBehalfBadgeText}>
                        Uploaded by Vendor on Behalf of Driver
                      </Text>
                    </View>
                  )}

                  <View style={styles.docRow}>
                    <Text style={styles.docLabel}>Document:</Text>
                    <Text style={styles.docVal}>{weighbillDoc.fileName}</Text>
                  </View>

                  <View style={styles.docRow}>
                    <Text style={styles.docLabel}>Recorded Weight:</Text>
                    <Text style={[styles.docVal, { color: '#F05A22', fontWeight: '800' }]}>
                      {weighbillDoc.recordedWeightMt ? `${weighbillDoc.recordedWeightMt.toFixed(2)} MT` : 'Not recorded'}
                    </Text>
                  </View>

                  <View style={styles.docRow}>
                    <Text style={styles.docLabel}>Driver Confirmation:</Text>
                    <Text
                      style={[
                        styles.docVal,
                        { color: isDriverConfirmed ? '#16A34A' : '#D97706', fontWeight: '700' },
                      ]}
                    >
                      {isDriverConfirmed ? '✓ Confirmed by Driver' : '⏳ Pending Independent Driver Confirmation'}
                    </Text>
                  </View>

                  {!isDriverConfirmed && (
                    <View style={styles.noticeCallout}>
                      <Clock size={14} color="#B45309" />
                      <Text style={styles.noticeCalloutText}>
                        Vendor upload does not replace driver independent confirmation. The driver must confirm the weight in their app before delivery sign-off.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.pendingUploadBox}>
                  <View style={styles.pendingUploadHeader}>
                    <AlertTriangle size={18} color="#D97706" />
                    <Text style={styles.pendingUploadTitle}>
                      Driver Weighbill Upload Pending
                    </Text>
                  </View>
                  <Text style={styles.pendingUploadSub}>
                    If the driver is unable to upload the loading weighbridge slip from the scale yard, you can upload it on the driver's behalf.
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadOnBehalfBtn}
                    onPress={() => setShowUploadModal(true)}
                    activeOpacity={0.88}
                  >
                    <FileUp size={16} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.uploadOnBehalfBtnText}>
                      Upload Weighbill on Behalf of Driver
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Action CTAs */}
          {hasTrip ? (
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={() => onViewTrip(booking.trip.id)}
              activeOpacity={0.85}
            >
              <Navigation size={18} color="#FFFFFF" />
              <Text style={styles.goldBtnText}>Manage Live Trip & Documents</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.goldBtn}
              onPress={() => onAssignFleet(booking)}
              activeOpacity={0.85}
            >
              <PlusCircle size={18} color="#FFFFFF" />
              <Text style={styles.goldBtnText}>Assign Vehicle & Driver</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        <BottomGoldWings />
      </ScrollView>

      {/* ── Upload on Behalf of Driver Modal ── */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Upload on Behalf of Driver</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.labelNoticeBox}>
              <Text style={styles.labelNoticeBadge}>Will be Labeled:</Text>
              <Text style={styles.labelNoticeHighlight}>"Uploaded by Vendor on Behalf of Driver"</Text>
              <Text style={styles.labelNoticeDesc}>
                This submission will identify you ({booking.trip?.vendorName || 'Vendor'}) as the uploader for driver {booking.trip?.driverName}. Driver confirmation remains pending until the driver independently certifies the weight.
              </Text>
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Gross Weight (MT) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={grossWeight}
                  onChangeText={setGrossWeight}
                  placeholder="32.50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Tare Weight (MT) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={tareWeight}
                  onChangeText={setTareWeight}
                  placeholder="12.50"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.netPreviewRow}>
              <Text style={styles.netPreviewLabel}>Net Cargo Weight:</Text>
              <Text style={styles.netPreviewVal}>
                {(Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(tareWeight) || 0))).toFixed(2)} MT
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowUploadModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, uploading && styles.btnDisabled]}
                onPress={handleUploadOnBehalf}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit on Driver Behalf</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    paddingBottom: 60,
  },
  topWrap: {
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoWrap: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
  },
  contentWrap: {
    paddingHorizontal: 16,
    marginTop: -20,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  routeCol: {
    gap: 10,
  },
  routeStop: {
    flexDirection: 'row',
    gap: 12,
  },
  dotGold: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F05A22',
    marginTop: 4,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  stopTextWrap: {
    flex: 1,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  stopAddress: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  pinText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  routeDivider: {
    height: 12,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginLeft: 5,
  },
  specsGrid: {
    gap: 8,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  specValGreen: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  assignedBox: {
    gap: 8,
  },
  assignedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assignedLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  assignedVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  specValGold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F05A22',
  },
  unassignedBox: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unassignedText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  docStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  vendorBehalfBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  vendorBehalfBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#C2410C',
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  docLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  docVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  noticeCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  noticeCalloutText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  pendingUploadBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 14,
  },
  pendingUploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pendingUploadTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  pendingUploadSub: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
    marginBottom: 12,
  },
  uploadOnBehalfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadOnBehalfBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  goldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F05A22',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  goldBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  labelNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  labelNoticeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  labelNoticeHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  labelNoticeDesc: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 15,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  textInput: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  netPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  netPreviewLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  netPreviewVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F05A22',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F05A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
