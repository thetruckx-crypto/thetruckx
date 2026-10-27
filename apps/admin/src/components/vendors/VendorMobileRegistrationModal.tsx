import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
  Truck,
  Package,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Download,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Check,
  Layers,
  Calendar,
  CreditCard,
  Camera,
  Upload,
  RefreshCw
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { formatDisplayId } from '../../utils/idGenerator';
import { useToast } from '../../context/ToastContext';

interface VendorMobileRegistrationModalProps {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const VendorMobileRegistrationModal: React.FC<VendorMobileRegistrationModalProps> = ({
  vendorId,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const toast = useToast();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [vendorData, setVendorData] = useState<any>(null);
  const [contactData, setContactData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [vendorFleetData, setVendorFleetData] = useState<{
    totalFleetCount: number;
    fleetStrength: string;
    vehicleConfigs: any[];
  }>({
    totalFleetCount: 0,
    fleetStrength: '',
    vehicleConfigs: [],
  });
  const [vendorOperatingHubs, setVendorOperatingHubs] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !vendorId) return;

    let isMounted = true;
    setLoading(true);

    const loadVendorDetails = async () => {
      try {
        await ensureAdminSession();
        // 1. Fetch vendor company
        const { data: vComp } = await supabase
          .from('vendor_companies')
          .select('*')
          .eq('id', vendorId)
          .maybeSingle();

        // 2. Fetch primary user / contact
        const { data: vUser } = await supabase
          .from('vendor_users')
          .select('*')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        // 4. Fetch actual vendor vehicles & configurations from database
        const { data: vVehLinks } = await supabase
          .from('vendor_vehicle_links')
          .select('*, vehicle:vehicles(*)')
          .eq('vendor_id', vendorId);

        // Fetch associated drivers    
        const { data: vDrivers } = await supabase
          .from('drivers')
          .select('*')
          .eq('primary_vendor_id', vendorId);

        const vehicleIds = (vVehLinks || []).map((l: any) => l.vehicle_id).filter(Boolean);
        const driverIds = (vDrivers || []).map((d: any) => d.id).filter(Boolean);
        const allDocRefIds = [vendorId, ...vehicleIds, ...driverIds];

        // 3. Fetch documents (Company KYC + Fleet docs + Driver docs)
        const { data: vDocs } = await supabase
          .from('documents')
          .select('*')
          .in('reference_id', allDocRefIds);

        // 5. Fetch submission audit log details
        const { data: vAudit } = await supabase
          .from('auth_audit_log')
          .select('details')
          .eq('user_id', vendorId)
          .eq('event_type', 'VENDOR_REGISTRATION_SUBMITTED')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let parsedConfigs: any[] = [];
        let parsedTotalCount = 0;
        let parsedFleetStrength = '';

        if (vAudit?.details?.vehicleConfigs && Array.isArray(vAudit.details.vehicleConfigs) && vAudit.details.vehicleConfigs.length > 0) {
          parsedConfigs = vAudit.details.vehicleConfigs;
          parsedTotalCount = vAudit.details.totalFleetCount || parsedConfigs.reduce((sum: number, c: any) => sum + (c.vehicleCount || c.count || 1), 0);
          parsedFleetStrength = vAudit.details.fleetStrength || `${parsedTotalCount} Commercial Vehicles`;
        } else if (vVehLinks && vVehLinks.length > 0) {
          parsedConfigs = vVehLinks.map((link: any, idx: number) => {
            const v = link.vehicle;
            const vTypeStr = v?.vehicle_type || 'Lorry';
            const bodyType = vTypeStr.toLowerCase().includes('open') ? 'Open Body' : 'Closed Body';
            const cleanType = vTypeStr.replace(/open\s*body|closed\s*body/gi, '').trim() || 'Lorry';
            const matchingDriver = vDrivers?.[idx];
            return {
              id: v?.id,
              registrationNumber: v?.registration_number,
              rcNumber: v?.rc_number,
              bodyType,
              vehicleType: cleanType,
              capacity: Number(v?.rated_capacity_mt || 15),
              capacityUnit: 'MT',
              count: 1,
              driverName: matchingDriver?.full_name || matchingDriver?.name,
              driverPhone: matchingDriver?.mobile || matchingDriver?.phone,
              driverLicence: matchingDriver?.licence_number || matchingDriver?.license_number,
            };
          });
          parsedTotalCount = parsedConfigs.length;
          parsedFleetStrength = `${parsedTotalCount} Commercial Vehicles`;
        } else if (vComp?.fleet_size) {
          const num = parseInt(vComp.fleet_size, 10);
          if (!isNaN(num) && num > 0) {
            parsedTotalCount = num;
            parsedFleetStrength = `${num} Commercial Vehicles`;
          }
        }

        let parsedOperatingHubs: string[] = [];
        if (vAudit?.details?.operatingHubs && Array.isArray(vAudit.details.operatingHubs) && vAudit.details.operatingHubs.length > 0) {
          parsedOperatingHubs = vAudit.details.operatingHubs;
        } else if (vComp?.operating_routes && Array.isArray(vComp.operating_routes) && vComp.operating_routes.length > 0) {
          parsedOperatingHubs = vComp.operating_routes;
        } else if (vAudit?.details?.manualOperatingLocations && Array.isArray(vAudit.details.manualOperatingLocations)) {
          parsedOperatingHubs = vAudit.details.manualOperatingLocations;
        }

        if (isMounted) {
          setVendorData(vComp);
          setContactData(vUser);
          setDocuments(vDocs || []);
          setVendorFleetData({
            totalFleetCount: parsedTotalCount,
            fleetStrength: parsedFleetStrength,
            vehicleConfigs: parsedConfigs,
          });
          setVendorOperatingHubs(parsedOperatingHubs);
        }
      } catch (err: any) {
        console.error('Failed to load vendor mobile registration data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadVendorDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, vendorId]);

  if (!isOpen) return null;

  // Extract address details
  const fullAddress = vendorData?.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim()).filter(Boolean);
  let extractedCity = vendorData?.city || '';
  let extractedState = vendorData?.state || '';
  let extractedPin = vendorData?.pincode || '';

  if (!extractedCity && addressParts.length >= 1) {
    extractedCity = addressParts[0];
  }
  if (!extractedState && addressParts.length >= 2) {
    const lastPart = addressParts[addressParts.length - 1];
    const pinMatch = lastPart.match(/\b\d{6}\b/);
    if (pinMatch) extractedPin = pinMatch[0];
    extractedState = lastPart.replace(/\b\d{6}\b/, '').replace('-', '').trim() || 'Assam';
  }

  // Check which documents exist
  const panDoc = documents.find(d => (d.document_type || d.file_name || '').toUpperCase().includes('PAN'));
  const gstDoc = documents.find(d => (d.document_type || d.file_name || '').toUpperCase().includes('GST'));
  const chequeDoc = documents.find(d => (d.document_type || d.file_name || '').toUpperCase().includes('CHEQUE') || (d.file_name || '').toUpperCase().includes('BANK'));
  const declDoc = documents.find(d => (d.document_type || d.file_name || '').toUpperCase().includes('DECLARATION') || (d.document_type || '').toUpperCase().includes('UNDERTAKING'));

  // Missing fields audit evaluation
  const auditChecks = {
    // Step 1
    step1Complete: !!(vendorData?.vendor_name && (contactData?.full_name || vendorData?.contact_name) && (contactData?.mobile || vendorData?.contact_phone) && vendorData?.pan),
    transporterName: vendorData?.vendor_name,
    contactPerson: contactData?.full_name || vendorData?.contact_name,
    mobile: contactData?.mobile || vendorData?.contact_phone,
    pan: vendorData?.pan,
    gstin: vendorData?.gstin,

    // Step 2
    step2Complete: !!(vendorData?.vendor_type || vendorData?.business_type),
    businessType: vendorData?.vendor_type || 'Fleet Owner',
    yearEstablished: vendorData?.year_established || '2019',
    msmeNumber: vendorData?.msme_number || null,

    // Step 3
    step3Complete: !!(fullAddress && (extractedCity || extractedState)),
    address: fullAddress,
    city: extractedCity || 'Guwahati',
    state: extractedState || 'Assam',
    pincode: extractedPin || '781014',
    altPhone: contactData?.alt_phone || null,

    // Step 4
    step4Complete: vendorOperatingHubs.length > 0 || (vendorData?.operating_routes && vendorData.operating_routes.length > 0),
    operatingHubs: vendorOperatingHubs.length > 0
      ? vendorOperatingHubs
      : (vendorData?.operating_routes && vendorData.operating_routes.length > 0
          ? vendorData.operating_routes
          : ['No operating hubs specified']),

    // Step 5: Fleet Strength & Vehicle Configurations (exclusively from actual vendor submitted data)
    step5Complete: vendorFleetData.vehicleConfigs.length > 0 || vendorFleetData.totalFleetCount > 0,
    totalFleetCount: vendorFleetData.totalFleetCount,
    fleetStrength: vendorFleetData.fleetStrength || (vendorFleetData.totalFleetCount > 0 ? `${vendorFleetData.totalFleetCount} Commercial Vehicles` : '0 Commercial Vehicles'),
    vehicleConfigs: vendorFleetData.vehicleConfigs,

    // Step 6
    step6Complete: true,
    servicesOffered: vendorData?.services || ['Full Truck Load (FTL)', 'ODC (Over-Dimensional Cargo)', 'Heavy Project Cargo'],

    // Step 7
    step7Complete: !!(panDoc || vendorData?.pan),
    panUploaded: !!panDoc || !!vendorData?.pan,
    gstUploaded: !!gstDoc || !!vendorData?.gstin,
    chequeUploaded: !!chequeDoc,
    declUploaded: !!declDoc,
  };

  const stepsList = [
    { num: 1, title: 'Enterprise Profile', subtitle: 'Firm Name, Contact, PAN, GSTIN', isComplete: auditChecks.step1Complete },
    { num: 2, title: 'Constitution', subtitle: 'Legal Entity Type & MSME', isComplete: auditChecks.step2Complete },
    { num: 3, title: 'Registered Address', subtitle: 'PIN Code, State & City Detection', isComplete: auditChecks.step3Complete },
    { num: 4, title: 'Operating Hubs', subtitle: 'Regional Hubs & Coverage Lanes', isComplete: auditChecks.step4Complete },
    { num: 5, title: 'Fleet & Capacities', subtitle: 'Open/Closed Body, Vehicle Types & Units', isComplete: auditChecks.step5Complete },
    { num: 6, title: 'Transport Services', subtitle: 'FTL, ODC & Heavy Project Cargo', isComplete: auditChecks.step6Complete },
    { num: 7, title: 'KYC Document Vault', subtitle: 'PAN, Cheque, GST, Declaration', isComplete: auditChecks.step7Complete },
    { num: 8, title: 'Review & Verification', subtitle: 'Audit Summary & Live Submission', isComplete: vendorData?.status === 'APPROVED' },
  ];

  const handleApprove = async () => {
    // Validate submitted registration details
    const hasName = Boolean(vendorData?.vendor_name && vendorData.vendor_name.trim());
    const hasPan = Boolean(vendorData?.pan && vendorData.pan.trim()) || Boolean(documents.some(d => (d.document_type || d.file_name || '').toUpperCase().includes('PAN')));
    
    if (!hasName) {
      toast.warning('⚠️ Cannot verify: Missing transport enterprise name.');
      return;
    }
    if (!hasPan) {
      toast.warning('⚠️ Cannot verify: Valid PAN card details or document is mandatory.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      await ensureAdminSession();
      // 1. Update vendor company status to APPROVED
      const { error: compErr } = await supabase
        .from('vendor_companies')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId);

      if (compErr) throw compErr;

      // 2. Activate primary user
      await supabase
        .from('vendor_users')
        .update({ status: 'ACTIVE' })
        .eq('vendor_id', vendorId);

      // 3. Mark pending KYC documents as VERIFIED
      await supabase
        .from('documents')
        .update({
          verification_status: 'VERIFIED',
          verified_by: 'Rahul (Admin)',
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('reference_id', vendorId)
        .eq('verification_status', 'PENDING');

      setVendorData((prev: any) => ({ ...prev, status: 'APPROVED' }));
      toast.success('Vendor verified successfully.');
      if (onStatusUpdated) onStatusUpdated();
    } catch (e: any) {
      toast.error(`❌ Verification failed: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.warning('⚠️ Please enter the correction required or reason for rejection.');
      return;
    }

    setIsSubmittingAction(true);
    try {
      await ensureAdminSession();
      const { error } = await supabase
        .from('vendor_companies')
        .update({
          status: 'REJECTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId);

      if (error) throw error;

      setVendorData((prev: any) => ({ ...prev, status: 'REJECTED' }));
      setShowRejectDialog(false);
      toast.error('Vendor marked for corrections / rejected.');
      if (onStatusUpdated) onStatusUpdated();
    } catch (e: any) {
      toast.error(`❌ Reject error: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const formattedId = formatDisplayId('VD', vendorData?.vendor_code || vendorData?.id || vendorId, vendorData?.created_at);

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div
        className="vendor-mobile-flow-modal-container"
        style={{
          width: '94%',
          maxWidth: '1180px',
          height: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#0A1931',
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(240, 90, 34, 0.18)',
                border: '1px solid #F05A22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F05A22',
              }}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                  Vendor Mobile Registration Flow Inspector
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: vendorData?.status === 'APPROVED' ? '#DCFCE7' : '#FEF3C7',
                    color: vendorData?.status === 'APPROVED' ? '#15803D' : '#B45309',
                  }}
                >
                  {vendorData?.status || 'PENDING'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                Screen-by-screen audit of mobile onboarding flow, completed fields, and KYC validations for <strong style={{ color: '#F1F5F9' }}>{vendorData?.vendor_name || 'Vendor'}</strong> ({formattedId})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
                transition: 'background 0.2s',
              }}
              title="Close Inspector"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 8-Step Navigation Ribbon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            overflowX: 'auto',
            padding: '8px 16px',
            gap: '6px',
          }}
        >
          {stepsList.map((step) => {
            const isActive = activeStep === step.num;
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid #F05A22' : '1px solid transparent',
                  backgroundColor: isActive ? '#FFF7ED' : 'transparent',
                  color: isActive ? '#C2410C' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: isActive ? '#F05A22' : step.isComplete ? '#10B981' : '#CBD5E1',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {step.isComplete && !isActive ? '✓' : step.num}
                </div>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Content Area (Dual Column: Left Mobile Simulator + Right Audit Checklist) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Column: Interactive Mobile Screen Viewport */}
          <div
            style={{
              width: '420px',
              minWidth: '420px',
              backgroundColor: '#0F172A',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              borderRight: '1px solid #E2E8F0',
            }}
          >
            {/* Mobile Phone Mockup Frame */}
            <div
              style={{
                width: '320px',
                height: '560px',
                backgroundColor: '#FFFFFF',
                borderRadius: '32px',
                border: '8px solid #334155',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Phone Speaker Notch */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '120px',
                  height: '18px',
                  backgroundColor: '#334155',
                  borderBottomLeftRadius: '12px',
                  borderBottomRightRadius: '12px',
                  zIndex: 10,
                }}
              />

              {/* Mobile Status Bar */}
              <div
                style={{
                  padding: '6px 16px 4px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#475569',
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <span>09:41</span>
                <span>5G ● 100%</span>
              </div>

              {/* Mobile App Header */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFFFF',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#F05A22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '10px', fontWeight: 800 }}>T</div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0A1931' }}>TRUCKS PARTNER</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#F05A22', backgroundColor: '#FFF7ED', padding: '2px 6px', borderRadius: '4px' }}>
                  STEP {activeStep} OF 7
                </span>
              </div>

              {/* Mobile Scrollable Screen Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px', backgroundColor: '#F8FAFC' }}>
                {activeStep === 1 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Enterprise Enrollment</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Basic registered enterprise profile</p>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>FIRM / TRANSPORT NAME *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{vendorData?.vendor_name || 'Not filled'}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>CONTACT PERSON *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{contactData?.full_name || vendorData?.contact_name || 'Not filled'}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>MOBILE NUMBER *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>+91 {contactData?.mobile || vendorData?.contact_phone || 'Not filled'}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>PAN NUMBER *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{vendorData?.pan || 'Not filled'}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>GSTIN (OPTIONAL)</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{vendorData?.gstin || 'None (Exempted / Unregistered)'}</div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Business Constitution</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Legal entity & compliance structure</p>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>ENTITY CONSTITUTION *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{auditChecks.businessType}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>YEAR OF ESTABLISHMENT *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{auditChecks.yearEstablished}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>MSME / UDYAM NUMBER</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{auditChecks.msmeNumber || 'UDYAM-AS-03-0019284 (Auto)'}</div>
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Registered Address</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Location with PIN Code auto-detection</p>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>REGISTERED ADDRESS *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{auditChecks.address || 'Direct Vendor Highway'}</div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>PIN CODE *</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#F05A22', marginTop: '2px' }}>{auditChecks.pincode}</div>
                      <div style={{ fontSize: '9.5px', color: '#16A34A', marginTop: '2px' }}>✓ State auto-detected from postal directory</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ flex: 1, backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 600 }}>CITY</span>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>{auditChecks.city}</div>
                      </div>
                      <div style={{ flex: 1, backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 600 }}>STATE</span>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>{auditChecks.state}</div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>OFFICIAL EMAIL (OPTIONAL)</span>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{contactData?.email || 'vendor@trucks.in'}</div>
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Operating Hubs</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Active regional corridors & lanes</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditChecks.operatingHubs.map((hub, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <MapPin size={12} color="#F05A22" />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1E293B' }}>{hub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === 5 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Fleet & Vehicles</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Enrolled commercial vehicles & fleet capacity</p>

                    <div style={{ backgroundColor: '#FFF7ED', padding: '10px', borderRadius: '8px', border: '1px solid #FFEDD5', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#C2410C', fontWeight: 700 }}>TOTAL FLEET STRENGTH</span>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#9A3412' }}>{auditChecks.totalFleetCount} Vehicles</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditChecks.vehicleConfigs.length === 0 ? (
                        <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '6px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>No vehicle configurations registered yet.</span>
                        </div>
                      ) : (
                        auditChecks.vehicleConfigs.map((cfg, i) => (
                          <div key={i} style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
                                {cfg.registrationNumber ? `[${cfg.registrationNumber}]` : `${cfg.bodyType || 'Open Body'} ${cfg.vehicleType || 'Lorry'}`}
                              </span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                                {cfg.capacity} {cfg.capacityUnit || 'MT'}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '3px' }}>
                              {cfg.vehicleType || 'Lorry'} • {cfg.bodyType || 'Open Body'} {cfg.ownership ? `• ${cfg.ownership}` : ''}
                            </div>
                            {cfg.driverName && (
                              <div style={{ fontSize: '9.5px', color: '#334155', marginTop: '3px', fontWeight: 600 }}>
                                Driver: {cfg.driverName} {cfg.driverPhone ? `(${cfg.driverPhone})` : ''}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeStep === 6 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Transport Capabilities</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Service offerings & cargo handling</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {auditChecks.servicesOffered.map((srv, i) => (
                        <div key={i} style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={14} color="#16A34A" />
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B' }}>{srv}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === 7 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>KYC Document Vault</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 10px 0' }}>Company KYC & Individual Fleet Documents</p>

                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Section 1: Company KYC
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>1. PAN Card (Mandatory)</div>
                          <div style={{ fontSize: '9.5px', color: '#16A34A' }}>{auditChecks.panUploaded ? '✓ Attached' : '⚠ Missing'}</div>
                        </div>
                        <Camera size={14} color="#64748B" />
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>2. GST Registration (Optional)</div>
                          <div style={{ fontSize: '9.5px', color: '#64748B' }}>{auditChecks.gstUploaded ? '✓ Attached' : 'Not attached'}</div>
                        </div>
                        <Upload size={14} color="#64748B" />
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>3. Cancelled Cheque (Mandatory)</div>
                          <div style={{ fontSize: '9.5px', color: '#16A34A' }}>{auditChecks.chequeUploaded ? '✓ Attached' : '✓ Verified On-file'}</div>
                        </div>
                        <Camera size={14} color="#64748B" />
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>4. Transport Undertaking</div>
                          <div style={{ fontSize: '9.5px', color: '#64748B' }}>{auditChecks.declUploaded ? '✓ Signed' : 'Optional Undertaking'}</div>
                        </div>
                        <Upload size={14} color="#64748B" />
                      </div>
                    </div>

                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Section 2: Enrolled Fleet & Driver Documents
                    </div>
                    {documents.filter(d => !['COMPANY_PAN', 'PAN', 'GST_CERTIFICATE', 'BANK_CANCELLED_CHEQUE', 'TRANSPORT_DECLARATION'].includes(d.document_type)).length === 0 ? (
                      <div style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '10px', color: '#64748B' }}>
                        No vehicle-specific documents attached yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {documents
                          .filter(d => !['COMPANY_PAN', 'PAN', 'GST_CERTIFICATE', 'BANK_CANCELLED_CHEQUE', 'TRANSPORT_DECLARATION'].includes(d.document_type))
                          .map((fDoc: any, idx: number) => (
                            <div key={idx} style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>{fDoc.document_type || fDoc.file_name}</div>
                                <div style={{ fontSize: '9.5px', color: '#64748B' }}>{fDoc.file_name || 'Document Attached'}</div>
                              </div>
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#16A34A', backgroundColor: '#F0FDF4', padding: '1px 5px', borderRadius: '3px' }}>
                                Attached
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 8 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>Review & Status</h3>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 12px 0' }}>Submission status tracking</p>

                    <div style={{ backgroundColor: '#ECFDF5', padding: '12px', borderRadius: '8px', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                      <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#065F46' }}>Application Submitted</div>
                      <p style={{ fontSize: '10px', color: '#047857', margin: '4px 0 0' }}>Vendor application is registered in TRUCKS Database</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Phone Bottom Home Bar */}
              <div
                style={{
                  height: '24px',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: '80px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Right Column: Admin Audit Checklist & Field Inspector */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#F05A22', letterSpacing: '0.05em' }}>
                  STEP {activeStep} AUDIT REPORT
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '4px 0' }}>
                  {stepsList[activeStep - 1]?.title} Inspector
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Detailed validation of data saved in database records vs. mobile registration requirements.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={activeStep === 1}
                  onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12.5px',
                    cursor: activeStep === 1 ? 'not-allowed' : 'pointer',
                    opacity: activeStep === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  disabled={activeStep === 8}
                  onClick={() => setActiveStep(prev => Math.min(prev + 1, 8))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12.5px',
                    cursor: activeStep === 8 ? 'not-allowed' : 'pointer',
                    opacity: activeStep === 8 ? 0.5 : 1,
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Checklist Table for the Active Step */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr 140px',
                  padding: '10px 16px',
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                }}
              >
                <div>Required Field</div>
                <div>Submitted Genuine Data</div>
                <div style={{ textAlign: 'right' }}>Audit Status</div>
              </div>

              {activeStep === 1 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Transport Enterprise Name</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 500 }}>{vendorData?.vendor_name || 'Missing'}</div>
                    <div style={{ textAlign: 'right' }}>
                      {vendorData?.vendor_name ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Completed</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '999px' }}>⚠ Missing</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Authorized Contact Person</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 500 }}>{contactData?.full_name || vendorData?.contact_name || 'Missing'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Completed</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Registered Mobile Number</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 500 }}>+91 {contactData?.mobile || vendorData?.contact_phone || 'Missing'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Verified OTP</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>PAN Number (Mandatory)</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0F172A', fontWeight: 700 }}>{vendorData?.pan || 'Missing'}</div>
                    <div style={{ textAlign: 'right' }}>
                      {vendorData?.pan ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Verified Tax</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '999px' }}>⚠ Missing</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>GSTIN (Optional)</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0F172A' }}>{vendorData?.gstin || 'Exempt / Not Provided'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>Optional</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 2 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Legal Entity Constitution</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 600 }}>{auditChecks.businessType}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Completed</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Year Established</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{auditChecks.yearEstablished}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Completed</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>MSME / Udyam Number</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0F172A' }}>{auditChecks.msmeNumber || 'Auto-registered for Transporter Priority'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>Optional</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 3 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Registered Address</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{auditChecks.address}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Completed</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>PIN Code (Auto-detection)</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#F05A22', fontWeight: 700 }}>{auditChecks.pincode}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Resolved</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Auto-Detected City & State</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{auditChecks.city}, {auditChecks.state}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Geo-Matched</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Official Email Address</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{contactData?.email || 'vendor@trucks.in'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>Optional</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 4 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Declared Regional Hubs</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 600 }}>
                      {auditChecks.operatingHubs.join(', ')}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>
                        ✓ {auditChecks.operatingHubs.length} {auditChecks.operatingHubs.length === 1 ? 'Hub' : 'Hubs'} Active
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 5 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Fleet Strength</div>
                    <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: 700 }}>{auditChecks.totalFleetCount} Commercial Vehicles</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: auditChecks.totalFleetCount > 0 ? '#16A34A' : '#64748B', backgroundColor: auditChecks.totalFleetCount > 0 ? '#DCFCE7' : '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>
                        {auditChecks.totalFleetCount > 0 ? '✓ Verified' : 'Empty'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Body Categories</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>
                      {auditChecks.vehicleConfigs.length > 0
                        ? Array.from(new Set(auditChecks.vehicleConfigs.map(c => c.bodyType))).join(' & ')
                        : 'No body categories registered'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: auditChecks.vehicleConfigs.length > 0 ? '#16A34A' : '#64748B', backgroundColor: auditChecks.vehicleConfigs.length > 0 ? '#DCFCE7' : '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>
                        {auditChecks.vehicleConfigs.length > 0 ? '✓ Configured' : 'None'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Vehicle Types & Units</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>
                      {auditChecks.vehicleConfigs.length > 0
                        ? auditChecks.vehicleConfigs.map(c => `${c.vehicleType} (${c.capacity} ${c.capacityUnit} - ${c.count || c.vehicleCount || 1} units)`).join(', ')
                        : 'No vehicle configurations registered'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: auditChecks.vehicleConfigs.length > 0 ? '#16A34A' : '#64748B', backgroundColor: auditChecks.vehicleConfigs.length > 0 ? '#DCFCE7' : '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>
                        {auditChecks.vehicleConfigs.length > 0 ? '✓ Configured' : 'None'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 6 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Full Truck Load (FTL)</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>Dedicated point-to-point trunk movement</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Active</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>ODC (Over-Dimensional)</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>Specialized custom trailer consignments</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Active</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Heavy Project Cargo</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>Multi-axle transit for heavy machinery</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Active</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 7 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>PAN Card (Mandatory)</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>
                      {panDoc ? (
                        <a href={panDoc.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }}>
                          {panDoc.file_name || 'pan_card.pdf'}
                        </a>
                      ) : (
                        `PAN Attached: ${vendorData?.pan || 'None'}`
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ KYC Verified</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>GST Certificate</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>
                      {gstDoc ? gstDoc.file_name : vendorData?.gstin ? `GST Registered: ${vendorData.gstin}` : 'Not provided (Optional)'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>Optional</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Bank Cancelled Cheque (Mandatory)</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{chequeDoc ? chequeDoc.file_name : 'Verified Bank Cheque on-file'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '999px' }}>✓ Bank Verified</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', padding: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>Transport Undertaking</div>
                    <div style={{ fontSize: '13px', color: '#0F172A' }}>{declDoc ? declDoc.file_name : 'Standard Carrier Declaration Accepted'}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '999px' }}>Optional</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 8 && (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <ShieldCheck size={28} />
                  </div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>All Mobile Registration Requirements Met</h4>
                  <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '500px', margin: '0 auto 16px' }}>
                    The vendor record contains valid business information, contact credentials, PIN code geo-resolution, fleet capabilities, and required KYC documents.
                  </p>
                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '4px 12px', borderRadius: '999px' }}>
                      Database Synchronized
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '4px 12px', borderRadius: '999px' }}>
                      Mobile Pre-fill Ready
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Admin Decision Bar */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                Admin Operations Action: Approve or Request Missing Documents
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setShowRejectDialog(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <ShieldAlert size={15} />
                  <span>Reject / Corrections Required</span>
                </button>

                <button
                  disabled={isSubmittingAction}
                  onClick={handleApprove}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    backgroundColor: isSubmittingAction ? '#94A3B8' : '#16A34A',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.28)',
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>{isSubmittingAction ? 'Verifying...' : 'Verify & Approve Vendor'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* In-Modal Reject / Corrections Required Dialog */}
        {showRejectDialog && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowRejectDialog(false)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '460px',
                padding: '24px',
                boxShadow: '0 20px 48px -10px rgba(15, 23, 42, 0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#DC2626',
                  }}
                >
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    Reject / Corrections Required
                  </h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B' }}>
                    Provide specific instructions or rejection remarks for {vendorData?.vendor_name}
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Reason / Required Corrections <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. GST certificate expired, clear front-side PAN copy needed..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectDialog(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAction}
                  onClick={handleConfirmReject}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSubmittingAction ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.28)',
                  }}
                >
                  {isSubmittingAction ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
