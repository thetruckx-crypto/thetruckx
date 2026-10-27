import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Edit,
  ShieldAlert,
  Send,
  Plus,
  FileText,
  Truck,
  Users,
  Eye,
  MoreVertical,
  ExternalLink,
  StickyNote,
  DollarSign,
  TrendingUp,
  Receipt,
  RefreshCw,
  X,
  Download,
  Calendar,
  Package,
  Smartphone
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { apiFetch } from '../../utils/api';
import { DocumentRejectionModal } from './DocumentRejectionModal';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { EditVendorModal } from './EditVendorModal';
import { formatDisplayId } from '../../utils/idGenerator';

interface VendorProfileProps {
  vendorId: string;
  onBack: () => void;
  userRole?: 'ADMIN' | 'SUPER_ADMIN';
  initialEdit?: boolean;
}

type VendorTab =
  | 'overview'
  | 'requirements'
  | 'trips'
  | 'vehicles'
  | 'drivers'
  | 'documents'
  | 'payments'
  | 'activity';

export const VendorProfile: React.FC<VendorProfileProps> = ({
  vendorId,
  onBack,
  userRole = 'ADMIN',
  initialEdit = false,
}) => {
  const [vendor, setVendor] = useState<any>(null);
  const [primaryContact, setPrimaryContact] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VendorTab>('overview');
  
  // Tab-specific data (lazy loaded)
  const [documents, setDocuments] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['overview']));
  const [fleetConfigs, setFleetConfigs] = useState<any[]>([]);
  
  // UI state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState<boolean>(false);
  const [selectedDocForRejection, setSelectedDocForRejection] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(Boolean(initialEdit));
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Vendor Basic Data
  const loadVendorData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAdminSession();
      // Fetch Vendor Company
      let compData: any = null;
      if (vendorId) {
        const { data, error: vErr } = await supabase
          .from('vendor_companies')
          .select('*')
          .eq('id', vendorId)
          .maybeSingle();

        if (vErr) throw vErr;
        compData = data;
      }

      // Fallback if ID not found
      if (!compData) {
        const { data: firstVendor } = await supabase
          .from('vendor_companies')
          .select('*')
          .limit(1)
          .maybeSingle();
        compData = firstVendor;
      }

      if (!compData) {
        setError('No vendor company record found in the database.');
        setLoading(false);
        return;
      }

      setVendor(compData);

      // Fetch Primary Contact from vendor_users
      const { data: uData } = await supabase
        .from('vendor_users')
        .select('*')
        .eq('vendor_id', compData.id)
        .limit(1)
        .maybeSingle();

      if (uData) {
        setPrimaryContact(uData);
      } else {
        setPrimaryContact(null);
      }

      // Fetch mobile registration configs if logged
      try {
        const { data: regAudit } = await supabase
          .from('auth_audit_log')
          .select('*')
          .eq('user_id', compData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (regAudit && regAudit.length > 0) {
          const subLog = regAudit.find((a: any) =>
            (a.action === 'VENDOR_REGISTRATION_SUBMITTED' || a.event_type === 'VENDOR_REGISTRATION_SUBMITTED') &&
            (a.details?.configs || a.details?.vehicleConfigs)
          );
          if (subLog) {
            const cfgs = subLog.details?.configs || subLog.details?.vehicleConfigs;
            if (Array.isArray(cfgs)) {
              setFleetConfigs(cfgs);
            }
          }
        }
      } catch (auditErr) {
        console.warn('Could not load audit log for vendor fleet configs:', auditErr);
      }

    } catch (err: any) {
      console.error('Failed to load vendor profile:', err);
      setError(err.message || 'Error fetching vendor profile from database.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // Load tab-specific data
  const loadTabData = useCallback(async (tab: VendorTab) => {
    if (!vendor || loadedTabs.has(tab)) return;

    try {
      await ensureAdminSession();
      switch (tab) {
        case 'documents': {
          const { data: vLinks } = await supabase
            .from('vendor_vehicle_links')
            .select('vehicle_id')
            .eq('vendor_id', vendor.id);
          const vehicleIds = (vLinks || []).map((l: any) => l.vehicle_id).filter(Boolean);

          const { data: dLinks } = await supabase
            .from('drivers')
            .select('id')
            .eq('primary_vendor_id', vendor.id);
          const driverIds = (dLinks || []).map((d: any) => d.id).filter(Boolean);

          const allRefIds = [vendor.id, ...vehicleIds, ...driverIds];

          const { data: docData } = await supabase
            .from('documents')
            .select('*')
            .in('reference_id', allRefIds)
            .order('created_at', { ascending: false });
          setDocuments(docData || []);
          break;
        }

        case 'vehicles':
          const { data: linkData } = await supabase
            .from('vendor_vehicle_links')
            .select('*, vehicles(*)')
            .eq('vendor_id', vendor.id);

          const linkedVehicles = (linkData || [])
            .map((l: any) => l.vehicles)
            .filter(Boolean);

          if (linkedVehicles.length > 0) {
            setVehicles(linkedVehicles);
          } else {
            // Also check trips if any vehicle was dispatched
            const { data: tData } = await supabase
              .from('trips')
              .select('*, vehicles(*)')
              .eq('vendor_id', vendor.id);
            const vehMap = new Map();
            (tData || []).forEach((t: any) => {
              if (t.vehicles && !vehMap.has(t.vehicles.id)) {
                vehMap.set(t.vehicles.id, t.vehicles);
              }
            });
            setVehicles(Array.from(vehMap.values()));
          }
          break;

        case 'drivers':
          const { data: driverData } = await supabase
            .from('drivers')
            .select('*')
            .eq('primary_vendor_id', vendor.id)
            .order('created_at', { ascending: false });
          setDrivers(driverData || []);
          break;

        case 'trips':
          if (trips.length === 0) {
            const { data: tData2 } = await supabase
              .from('trips')
              .select('*, vehicles(registration_number, vehicle_type), drivers(full_name, mobile), bookings(*, requirements(*, client_companies(company_name))))')
              .eq('vendor_id', vendor.id)
              .order('created_at', { ascending: false });
            setTrips(tData2 || []);
          }
          break;

        case 'requirements':
          const { data: vrData } = await supabase
            .from('vendor_requests')
            .select('*, requirements(*, client_companies(company_name)), vendor_quotations(*)')
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: false });

          let mappedReqs: any[] = [];
          if (vrData && vrData.length > 0) {
            mappedReqs = vrData.map((vr: any) => ({
              ...vr.requirements,
              vendor_request_id: vr.id,
              vendor_request_status: vr.status,
              deadline_at: vr.deadline_at,
              quotations: vr.vendor_quotations || [],
            }));
          }

          // Also check direct vendor_quotations
          const { data: vqData } = await supabase
            .from('vendor_quotations')
            .select('*, requirements(*, client_companies(company_name))')
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: false });

          if (vqData && vqData.length > 0) {
            const existingIds = new Set(mappedReqs.map((r: any) => r?.id).filter(Boolean));
            vqData.forEach((vq: any) => {
              if (vq.requirements && !existingIds.has(vq.requirements.id)) {
                mappedReqs.push({
                  ...vq.requirements,
                  vendor_request_id: vq.vendor_request_id,
                  vendor_request_status: vq.status,
                  quotations: [vq],
                });
                existingIds.add(vq.requirements.id);
              }
            });
          }

          if (mappedReqs.length > 0) {
            setRequirements(mappedReqs);
          } else {
            setRequirements([]);
          }
          break;

        case 'payments':
          const { data: payData } = await supabase
            .from('payment_records')
            .select('*')
            .eq('recipient_id', vendor.id)
            .order('created_at', { ascending: false });

          if (payData && payData.length > 0) {
            setPayments(payData);
          } else {
            // Fallback from vendor trips
            const { data: tripPays } = await supabase
              .from('trips')
              .select('id, booking_id, vendor_rate, trip_status, created_at, completed_at')
              .eq('vendor_id', vendor.id);
            setPayments(tripPays || []);
          }
          break;

        case 'activity':
          const { data: actData } = await supabase
            .from('auth_audit_log')
            .select('*')
            .eq('user_id', vendor.id)
            .order('created_at', { ascending: false })
            .limit(30);
          setActivities(actData || []);
          break;

        default:
          break;
      }

      setLoadedTabs(prev => new Set(prev).add(tab));
    } catch (err: any) {
      console.error(`Failed to load ${tab} data:`, err);
      showToast(`Failed to load ${tab} data`);
    }
  }, [vendor, loadedTabs, trips]);

  useEffect(() => {
    loadVendorData();
  }, [loadVendorData]);

  useEffect(() => {
    if (vendor && activeTab !== 'overview') {
      loadTabData(activeTab);
    }
  }, [activeTab, vendor, loadTabData]);

  // Load drivers always (shown in overview)
  useEffect(() => {
    if (vendor) {
      supabase
        .from('drivers')
        .select('*')
        .eq('primary_vendor_id', vendor.id)
        .then(({ data }) => setDrivers(data || []));
    }
  }, [vendor]);

  // Actions
  const handleApproveVendor = () => {
    if (!vendor) return;

    // Comprehensive validation checks prior to approval
    const missingItems: string[] = [];
    if (!vendor.vendor_name?.trim()) missingItems.push('Business Legal Name');
    if (!primaryContact?.full_name?.trim()) missingItems.push('Authorized Contact Person Name');
    if (!primaryContact?.mobile?.trim()) missingItems.push('Contact Mobile Number');
    if (!vendor.address?.trim()) missingItems.push('Registered Office Address');
    if (!vendor.pan?.trim() || vendor.pan === 'NOT_PROVIDED') {
      const hasPanDoc = documents.some(
        (d) => d.document_type === 'COMPANY_PAN' || d.document_type === 'PAN'
      );
      if (!hasPanDoc) missingItems.push('Company / Transporter PAN or PAN Card document');
    }

    const hasRejectedDocs = documents.some((d) => d.verification_status === 'REJECTED');
    if (hasRejectedDocs) {
      missingItems.push('Unresolved rejected KYC document(s) need resolution');
    }

    if (missingItems.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: '⚠️ Compliance Warning: Missing Required Information',
        message: `This vendor application has incomplete or unverified compliance items:\n• ${missingItems.join('\n• ')}\n\nDo you want to proceed with administrative override approval, or cancel to request vendor updates?`,
        onConfirm: async () => {
          await executeVendorApproval();
        },
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Approve Vendor Application',
      message: `Are you sure you want to approve "${vendor.vendor_name}"? This verifies their credentials, activates their mobile vendor portal, and allows them to receive broadcast RFQs.`,
      onConfirm: async () => {
        await executeVendorApproval();
      },
    });
  };

  const executeVendorApproval = async () => {
    setIsActionLoading(true);
    try {
      const { error: appErr } = await supabase
        .from('vendor_companies')
        .update({
          status: 'APPROVED',
          approved_by: 'TRUCKS Compliance Desk',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (appErr) throw appErr;

      await supabase
        .from('vendor_users')
        .update({ status: 'ACTIVE' })
        .eq('vendor_id', vendor.id);

      // Record in audit log
      try {
        await supabase.from('auth_audit_log').insert([
          {
            user_id: vendor.id,
            action: 'VENDOR_APPROVED',
            details: {
              approved_by: 'TRUCKS Compliance Desk',
              timestamp: new Date().toISOString(),
            },
          },
        ]);
      } catch {}

      apiFetch('/admin/vendor-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: vendor.id, decision: 'APPROVED' }),
      }).catch(() => {});

      showToast(`✅ Vendor "${vendor.vendor_name}" has been approved!`);
      await loadVendorData();
      await loadTabData('documents');
    } catch (err: any) {
      showToast(`❌ Approval failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
      setConfirmDialog(null);
    }
  };

  const handleRejectVendor = () => {
    if (!vendor) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Reject Vendor Application',
      message: `Are you sure you want to reject "${vendor.vendor_name}"? The vendor will be marked as REJECTED in the database and audit trail.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          const { error: rejErr } = await supabase
            .from('vendor_companies')
            .update({
              status: 'REJECTED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendor.id);

          if (rejErr) throw rejErr;

          try {
            await supabase.from('auth_audit_log').insert([
              {
                user_id: vendor.id,
                action: 'VENDOR_REJECTED',
                details: {
                  rejected_by: 'TRUCKS Compliance Desk',
                  timestamp: new Date().toISOString(),
                },
              },
            ]);
          } catch {}

          apiFetch('/admin/vendor-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vendorId: vendor.id, decision: 'REJECTED' }),
          }).catch(() => {});

          showToast(`❌ Vendor "${vendor.vendor_name}" has been marked as rejected.`);
          await loadVendorData();
        } catch (err: any) {
          showToast(`❌ Action failed: ${err.message}`);
        } finally {
          setIsActionLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleToggleBlockVendor = () => {
    if (!vendor) return;
    const newStatus = vendor.status === 'INACTIVE' ? 'APPROVED' : 'INACTIVE';
    const actionLabel = newStatus === 'INACTIVE' ? 'block' : 'activate';

    setConfirmDialog({
      isOpen: true,
      title: `${actionLabel === 'block' ? 'Block' : 'Activate'} Vendor`,
      message: `Are you sure you want to ${actionLabel} ${vendor.vendor_name}?`,
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          const { error: upErr } = await supabase
            .from('vendor_companies')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendor.id);

          if (upErr) throw upErr;

          showToast(`✅ Vendor ${actionLabel}d successfully.`);
          await loadVendorData();
        } catch (err: any) {
          showToast(`❌ Action failed: ${err.message}`);
        } finally {
          setIsActionLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleApproveDocument = async (docId: string) => {
    try {
      const { error: docErr } = await supabase
        .from('documents')
        .update({
          verification_status: 'VERIFIED',
          verified_by: 'USR-ADM-002',
        })
        .eq('id', docId);

      if (docErr) throw docErr;

      showToast('✅ Document approved.');
      loadTabData('documents');
    } catch (err: any) {
      showToast(`❌ Failed: ${err.message}`);
    }
  };

  if (loading && !vendor) {
    return (
      <div className="profile-loading-box">
        <RefreshCw size={24} className="spin" style={{ color: '#F45325', margin: '0 auto 12px' }} />
        <p>Loading vendor profile from database...</p>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="profile-error-box">
        <AlertTriangle size={32} style={{ color: '#F45325', margin: '0 auto 12px' }} />
        <h3>Unable to load vendor profile</h3>
        <p>{error || 'Vendor not found.'}</p>
        <button className="btn-back-link" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Vendor Directory</span>
        </button>
      </div>
    );
  }

  // Calculations
  const isApproved = vendor.status === 'APPROVED';
  const isPending = vendor.status === 'PENDING';
  const isRejected = vendor.status === 'REJECTED';
  const isInactive = vendor.status === 'INACTIVE';

  const activeDriversCount = drivers.filter(d => d.status === 'APPROVED' || d.status === 'ACTIVE').length;
  const completedTripsCount = trips.filter(t => t.trip_status === 'COMPLETED').length;
  const activeTripsCount = trips.filter(t => t.trip_status !== 'COMPLETED' && t.trip_status !== 'CANCELLED').length;
  const totalVehiclesCount = vehicles.length;
  const documentsCount = documents.length;
  const fleetConfigsCount = fleetConfigs.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0);
  const effectiveFleetStrength = Number(vendor.fleet_size) || (fleetConfigsCount > 0 ? fleetConfigsCount : totalVehiclesCount);

  const regDateFormatted = vendor.created_at
    ? new Date(vendor.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Recently';

  const initials = vendor.vendor_name
    ? vendor.vendor_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'VN';

  return (
    <div className="vendor-profile-page-wrapper">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-dialog-title">{confirmDialog.title}</h3>
            <p className="confirm-dialog-message">{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel-flat"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-action"
                onClick={confirmDialog.onConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="page-nav-header">
        <div className="breadcrumbs-row">
          <span className="crumb-root" onClick={onBack} style={{ cursor: 'pointer' }}>Vendors</span>
          <span className="crumb-sep">›</span>
          <span className="crumb-root" onClick={onBack} style={{ cursor: 'pointer' }}>Vendor Directory</span>
          <span className="crumb-sep">›</span>
          <span className="crumb-active">{vendor.vendor_name}</span>
          {isEditModalOpen && (
            <>
              <span className="crumb-sep">›</span>
              <span className="crumb-active" style={{ color: '#F05A22', fontWeight: 600 }}>Edit Vendor</span>
            </>
          )}
        </div>

        <div className="profile-top-title-row">
          <button className="btn-back-link" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="title-left-group">
            <h1 className="profile-vendor-name">{vendor.vendor_name}</h1>
            <div className="profile-badges-row">
              <span className={`status-pill ${isApproved ? 'verified' : isPending ? 'pending' : isRejected ? 'rejected' : 'inactive'}`}>
                <span className="dot-indicator"></span>
                {isApproved ? 'Verified' : isPending ? 'Pending Review' : isRejected ? 'Rejected' : 'Docs Required'}
              </span>
              <span className={`status-pill ${isInactive ? 'inactive' : 'active'}`}>
                <span className="dot-indicator"></span>
                {isInactive ? 'Inactive' : 'Active'}
              </span>
            </div>
          </div>

          <div className="title-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isPending && (
              <>
                <button
                  className="btn-approve-action"
                  onClick={handleApproveVendor}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Approve Vendor</span>
                </button>
                <button
                  className="btn-reject-action"
                  onClick={handleRejectVendor}
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <XCircle size={15} />
                  <span>Reject</span>
                </button>
              </>
            )}

            <button
              className="btn-orange-action"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Edit size={15} />
              <span>Edit Vendor</span>
            </button>
            <div className="menu-wrapper">
              <button
                className="btn-outline-action"
                onClick={() => setOpenMenuId(openMenuId === 'more' ? null : 'more')}
              >
                <MoreVertical size={15} />
                <span>More</span>
              </button>
              {openMenuId === 'more' && (
                <div className="action-menu-dropdown">

                  <button className="menu-item" onClick={() => showToast('Message sent')}>
                    <Send size={14} />
                    <span>Send Message</span>
                  </button>
                  <button className="menu-item" onClick={handleToggleBlockVendor}>
                    <ShieldAlert size={14} />
                    <span>{isInactive ? 'Activate' : 'Block'} Vendor</span>
                  </button>
                  <button className="menu-item" onClick={() => showToast('Exporting profile...')}>
                    <Download size={14} />
                    <span>Export Profile</span>
                  </button>
                  {userRole === 'SUPER_ADMIN' && (
                    <>
                      <div className="menu-separator"></div>
                      <button className="menu-item danger" onClick={() => showToast('Delete requires confirmation')}>
                        <XCircle size={14} />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Profile Banner */}
      <section className="vendor-profile-banner-card">
        <div className="banner-left-profile">
          <div className="vendor-avatar-circle-large">{initials}</div>
          <div className="banner-details">
            <h2 className="banner-company-title">{vendor.vendor_name}</h2>
            <p className="banner-id">{formatDisplayId('VD', vendor.vendor_code || vendor.id, vendor.created_at)}</p>
            <div className="banner-meta-row">
              <span>{vendor.onboarding_source === 'INVITED' ? 'Fleet Owner (Invited)' : 'Fleet Owner'}</span>
              <span className="sep">•</span>
              <span>{vendor.address ? vendor.address.split(',')[0].trim() : 'Location not specified'}</span>
              <span className="sep">•</span>
              <span>Registered {regDateFormatted}</span>
            </div>
          </div>
        </div>

        <div className="banner-right-contact">
          <div className="contact-chip">
            <Phone size={13} />
            <span>{primaryContact?.mobile ? `+91 ${primaryContact.mobile}` : 'No phone'}</span>
          </div>
          <div className="contact-chip">
            <Mail size={13} />
            <span>{primaryContact?.email || 'No email'}</span>
          </div>
        </div>
      </section>

      {/* Summary Stats Row */}
      <section className="vendor-summary-stats-row">
        <div className="stat-cell">
          <span className="stat-label">Fleet Strength</span>
          <span className="stat-value">{effectiveFleetStrength}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Enrolled Vehicles</span>
          <span className="stat-value">{totalVehiclesCount}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Associated Drivers</span>
          <span className="stat-value">{drivers.length}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Active Trips</span>
          <span className="stat-value">{activeTripsCount}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Completed Trips</span>
          <span className="stat-value">{completedTripsCount}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Requirements / RFQs</span>
          <span className="stat-value">{loadedTabs.has('requirements') ? requirements.length : '—'}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">KYC Documents</span>
          <span className="stat-value">{documentsCount}</span>
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="vendor-tabs-bar">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'requirements', label: 'Requirements & Quotations' },
          { key: 'trips', label: 'Trips & Bookings' },
          { key: 'vehicles', label: 'Registered Vehicles' },
          { key: 'drivers', label: 'Associated Drivers' },
          { key: 'documents', label: 'KYC & Documents' },
          { key: 'payments', label: 'Commercial Settlements' },
          { key: 'activity', label: 'Audit Trail' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`vendor-tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as VendorTab)}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="vendor-tab-content">
        {activeTab === 'overview' && (
          <div className="tab-content-grid">
            <div className="tab-content-main">
              {/* Vendor Information Card */}
              <div className="profile-section-card">
                <div className="card-header-bar">
                  <h3 className="section-title">Vendor Information</h3>
                </div>
                <div className="meta-definition-grid">
                  <div>
                    <span className="def-label">Business Name</span>
                    <span className="def-val">{vendor.vendor_name}</span>
                  </div>
                  <div>
                    <span className="def-label">Vendor Type</span>
                    <span className="def-val">{vendor.onboarding_source === 'INVITED' ? 'Fleet Owner (Invited)' : 'Fleet Owner'}</span>
                  </div>
                  <div>
                    <span className="def-label">GSTIN</span>
                    <span className="def-val mono">{vendor.gstin || 'Unspecified'}</span>
                  </div>
                  <div>
                    <span className="def-label">PAN Number</span>
                    <span className="def-val mono">{vendor.pan || 'Unspecified'}</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="def-label">Registered Address</span>
                    <span className="def-val">{vendor.address || 'No registered address'}</span>
                  </div>
                  <div>
                    <span className="def-label">Registration Date</span>
                    <span className="def-val">{regDateFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Primary Contact Card */}
              <div className="profile-section-card">
                <div className="card-header-bar">
                  <h3 className="section-title">Primary Contact</h3>
                </div>
                {primaryContact ? (
                  <div className="meta-definition-grid">
                    <div>
                      <span className="def-label">Name</span>
                      <span className="def-val">{primaryContact.full_name}</span>
                    </div>
                    <div>
                      <span className="def-label">Designation</span>
                      <span className="def-val">{primaryContact.designation || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="def-label">Phone</span>
                      <span className="def-val">+91 {primaryContact.mobile}</span>
                    </div>
                    <div>
                      <span className="def-label">Email</span>
                      <span className="def-val">{primaryContact.email}</span>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state-text">No contact person registered.</p>
                )}
              </div>

              {/* Fleet Strength & Vehicle Configurations Card */}
              <div className="profile-section-card">
                <div className="card-header-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={18} color="#F05A22" />
                    <h3 className="section-title">Fleet Strength & Configurations</h3>
                  </div>
                  <span className="status-pill active" style={{ fontWeight: 700 }}>
                    {effectiveFleetStrength} Total Vehicles
                  </span>
                </div>
                <div className="meta-definition-grid" style={{ marginBottom: 14 }}>
                  <div>
                    <span className="def-label">Total Fleet Strength</span>
                    <span className="def-val" style={{ fontSize: '16px', fontWeight: 700, color: '#F05A22' }}>
                      {effectiveFleetStrength} Vehicles
                    </span>
                  </div>
                  <div>
                    <span className="def-label">Enrolled Vehicles</span>
                    <span className="def-val">{totalVehiclesCount} Verified</span>
                  </div>
                  <div>
                    <span className="def-label">Supported Body Types</span>
                    <span className="def-val">Open Body, Closed Body</span>
                  </div>
                  <div>
                    <span className="def-label">Supported Categories</span>
                    <span className="def-val">Lorry, Trailer, Van, Heavy Carrier</span>
                  </div>
                </div>

                {fleetConfigs.length > 0 && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Configured Fleet Breakdown (Vendor Step 5 Registered Configurations)
                    </div>
                    <table className="profile-data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Body Type</th>
                          <th>Capacity (MT)</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fleetConfigs.map((cfg: any, i: number) => (
                          <tr key={cfg.id || i}>
                            <td className="bold-text">{cfg.vehicleType || cfg.category || '—'}</td>
                            <td>
                              <span className="status-pill active">{cfg.bodyType || 'Open Body'}</span>
                            </td>
                            <td>{cfg.capacity ? `${cfg.capacity} MT` : '—'}</td>
                            <td style={{ fontWeight: 700, color: '#0F172A' }}>{cfg.quantity || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Associated Drivers Summary Card */}
              <div className="profile-section-card">
                <div className="card-header-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#F05A22" />
                    <h3 className="section-title">Associated Drivers ({drivers.length})</h3>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#F05A22',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveTab('drivers')}
                  >
                    View All Drivers →
                  </button>
                </div>
                {drivers.length === 0 ? (
                  <p className="empty-state-text">No drivers currently assigned or attached to this vendor.</p>
                ) : (
                  <div className="table-responsive-wrapper">
                    <table className="profile-data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Driver Name</th>
                          <th>Phone</th>
                          <th>Licence No.</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.slice(0, 3).map((d: any) => (
                          <tr key={d.id}>
                            <td className="bold-text">{d.full_name || 'Driver'}</td>
                            <td>{d.mobile ? `+91 ${d.mobile}` : '—'}</td>
                            <td className="mono-text">{d.license_number || d.dl_number || '—'}</td>
                            <td>
                              <span className={`status-pill ${d.verification_status === 'VERIFIED' ? 'verified' : 'active'}`}>
                                <span className="dot-indicator"></span>
                                {d.verification_status || d.status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="tab-content-sidebar">
              {/* Verification Status Card */}
              <div className="profile-section-card">
                <h3 className="section-title">Verification Status</h3>
                <div className="verification-status-banner">
                  <div className="verification-badge-large">
                    <CheckCircle2 size={24} className={isApproved ? 'icon-green' : 'icon-amber'} />
                    <div>
                      <div className="verif-title">{isApproved ? 'Verified Partner' : 'Verification Under Review'}</div>
                      <div className="verif-desc">
                        {isApproved
                          ? 'All mandatory business credentials have been verified.'
                          : 'Credentials awaiting final administrative sign-off.'}
                      </div>
                    </div>
                  </div>

                  <div className="verif-metadata-row">
                    <div className="verif-cell">
                      <span className="cell-label">Verified On</span>
                      <span className="cell-val">
                        {vendor.approved_at
                          ? new Date(vendor.approved_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
                          : (isApproved ? regDateFormatted : 'Pending')}
                      </span>
                    </div>
                    <div className="verif-cell">
                      <span className="cell-label">Verified By</span>
                      <span className="cell-val">{vendor.approved_by || (isApproved ? 'Admin' : 'Awaiting Review')}</span>
                    </div>
                    <div className="verif-cell">
                      <span className="cell-label">Onboarding Source</span>
                      <span className="cell-val">{vendor.onboarding_source || 'DIRECT'}</span>
                    </div>
                  </div>

                  {/* RFQ Eligibility Callout */}
                  <div className={`rfq-eligibility-callout ${isApproved ? 'eligible' : 'ineligible'}`}>
                    {isApproved ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <CheckCircle2 size={18} style={{ color: '#F45325', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#F45325', fontSize: '13px' }}>
                            RFQ Eligibility: Active & Eligible
                          </div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                            This vendor is verified to receive broadcast RFQs and submit commercial quotations.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={18} style={{ color: '#F45325', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#171717', fontSize: '13px' }}>
                            RFQ Eligibility: Ineligible
                          </div>
                          <div style={{ fontSize: '12px', color: '#F45325', marginTop: '2px' }}>
                            Unapproved vendors cannot receive RFQs. Review credentials and approve to activate.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isApproved && (
                    <button
                      className="btn-orange-action"
                      onClick={handleApproveVendor}
                      disabled={isActionLoading}
                      style={{ width: '100%', marginTop: '12px' }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Approve Vendor</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Service Coverage Card */}
              <div className="profile-section-card">
                <h3 className="section-title">Service Coverage</h3>
                <div className="meta-definition-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="def-label">Operating Lanes</span>
                    <span className="def-val">{vendor.address || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="def-label">Vehicle Types</span>
                    <span className="def-val">{totalVehiclesCount > 0 ? 'Multi-Axle Trailers' : 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <h3 className="section-title">Documents ({documentsCount})</h3>
              </div>

              {!loadedTabs.has('documents') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#F45325' }} />
                  <p>Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="empty-state-text">No documents uploaded yet.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Document Name</th>
                        <th>Type</th>
                        <th>Uploaded</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                        const statusClass = doc.verification_status === 'VERIFIED' ? 'verified' :
                          doc.verification_status === 'REJECTED' ? 'rejected' :
                          isExpired ? 'expired' : 'pending';

                        return (
                          <tr key={doc.id}>
                            <td className="bold-text">{doc.file_name || doc.document_type}</td>
                            <td>{doc.document_type}</td>
                            <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                            <td className={isExpired ? 'text-danger' : ''}>
                              {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '—'}
                            </td>
                            <td>
                              <span className={`status-pill ${statusClass}`}>
                                <span className="dot-indicator"></span>
                                {doc.verification_status === 'VERIFIED' ? 'Verified' :
                                  doc.verification_status === 'REJECTED' ? 'Rejected' :
                                  isExpired ? 'Expired' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions-group">
                                <button
                                  className="btn-row-action"
                                  title="View / Preview Document"
                                  onClick={() => setPreviewDoc(doc)}
                                >
                                  <Eye size={14} />
                                </button>
                                {(doc.file_url || doc.file_path) && (
                                  <button
                                    className="btn-row-action"
                                    title="Download"
                                    onClick={() => window.open(doc.file_url || doc.file_path, '_blank')}
                                  >
                                    <Download size={14} />
                                  </button>
                                )}
                                {userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' ? (
                                  <>
                                    {doc.verification_status !== 'VERIFIED' && (
                                      <button
                                        className="btn-row-action"
                                        title="Approve"
                                        onClick={() => handleApproveDocument(doc.id)}
                                      >
                                        <CheckCircle2 size={14} />
                                      </button>
                                    )}
                                    <button
                                      className="btn-row-action"
                                      title="Reject"
                                      onClick={() => {
                                        setSelectedDocForRejection({
                                          id: doc.id,
                                          type: doc.document_type,
                                          fileName: doc.file_name,
                                          uploadedAt: new Date(doc.created_at).toLocaleDateString(),
                                        });
                                        setIsRejectionModalOpen(true);
                                      }}
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#F05A22" />
                  <h3 className="section-title">Enrolled Vehicles & Fleet Configurations</h3>
                </div>
                <span className="status-pill active" style={{ fontWeight: 700 }}>
                  Total Strength: {effectiveFleetStrength}
                </span>
              </div>

              {/* Fleet Summary Overview Grid */}
              <div className="meta-definition-grid" style={{ marginBottom: 16 }}>
                <div>
                  <span className="def-label">Total Fleet Strength</span>
                  <span className="def-val" style={{ fontSize: '16px', fontWeight: 700, color: '#F05A22' }}>
                    {effectiveFleetStrength} Vehicles
                  </span>
                </div>
                <div>
                  <span className="def-label">Verified Registered</span>
                  <span className="def-val">{totalVehiclesCount} Enrolled</span>
                </div>
                <div>
                  <span className="def-label">Supported Body Types</span>
                  <span className="def-val">Open Body, Closed Body</span>
                </div>
                <div>
                  <span className="def-label">Supported Categories</span>
                  <span className="def-val">Lorry, Trailer, Van, Heavy Carrier</span>
                </div>
              </div>

              {fleetConfigs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                    Registered Fleet Strength Configurations (Mobile Step 5 Data)
                  </h4>
                  <div className="table-responsive-wrapper">
                    <table className="profile-data-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Body Type</th>
                          <th>Capacity (MT)</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fleetConfigs.map((cfg: any, i: number) => (
                          <tr key={cfg.id || i}>
                            <td className="bold-text">{cfg.vehicleType || cfg.category || '—'}</td>
                            <td>
                              <span className="status-pill active">{cfg.bodyType || 'Open Body'}</span>
                            </td>
                            <td>{cfg.capacity ? `${cfg.capacity} MT` : '—'}</td>
                            <td style={{ fontWeight: 700, color: '#0F172A' }}>{cfg.quantity || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Enrolled Individual Vehicles ({totalVehiclesCount})
              </h4>

              {!loadedTabs.has('vehicles') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#F45325' }} />
                  <p>Loading vehicles...</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="empty-state-text">No individually registered vehicles enrolled for this vendor yet.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Vehicle No.</th>
                        <th>Category / Type</th>
                        <th>Body Type</th>
                        <th>Capacity</th>
                        <th>RC Number</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id}>
                          <td className="bold-text">{v.registration_number}</td>
                          <td>{v.vehicle_type}</td>
                          <td>
                            <span className="status-pill active">{v.body_type || 'Open Body'}</span>
                          </td>
                          <td>{v.rated_capacity_mt} MT</td>
                          <td className="mono-text">{v.rc_number || '—'}</td>
                          <td>
                            <span className={`status-pill ${v.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                              <span className="dot-indicator"></span>
                              {v.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-row-action"
                              title="View Vehicle"
                              onClick={() => showToast(`Vehicle: ${v.registration_number}`)}
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#F05A22" />
                  <h3 className="section-title">Associated Drivers ({drivers.length})</h3>
                </div>
              </div>

              {drivers.length === 0 ? (
                <div className="empty-state-text">No associated drivers found for this vendor.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Driver Name</th>
                        <th>Mobile Number</th>
                        <th>Driving Licence No.</th>
                        <th>Association Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d: any) => (
                        <tr key={d.id}>
                          <td className="bold-text">{d.full_name || 'Driver'}</td>
                          <td>{d.mobile ? `+91 ${d.mobile}` : '—'}</td>
                          <td className="mono-text">{d.license_number || d.dl_number || '—'}</td>
                          <td>
                            <span className="status-pill active">
                              {d.association_type === 'VENDOR_FLEET' ? 'Fleet Driver' : 'Attached'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${d.verification_status === 'VERIFIED' ? 'verified' : d.status === 'ACTIVE' ? 'active' : 'pending'}`}>
                              <span className="dot-indicator"></span>
                              {d.verification_status || d.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-row-action"
                              title="Driver details"
                              onClick={() => showToast(`Driver: ${d.full_name} (${d.mobile || 'No phone'})`)}
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'trips' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#F05A22" />
                  <h3 className="section-title">Dispatches & Related Bookings ({trips.length})</h3>
                </div>
              </div>

              {!loadedTabs.has('trips') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#F45325' }} />
                  <p>Loading trips...</p>
                </div>
              ) : trips.length === 0 ? (
                <div className="empty-state-text">No trips or bookings recorded for this vendor.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Trip ID</th>
                        <th>Booking Ref</th>
                        <th>Route</th>
                        <th>Vehicle</th>
                        <th>Assigned Driver</th>
                        <th>Status</th>
                        <th>Vendor Rate</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => {
                        const routeStr = trip.bookings?.requirements?.origin_city || trip.bookings?.origin || trip.origin
                          ? `${trip.bookings?.requirements?.origin_city || trip.bookings?.origin || trip.origin} → ${trip.bookings?.requirements?.destination_city || trip.bookings?.destination || trip.destination}`
                          : 'Operational Route';

                        return (
                          <tr key={trip.id}>
                            <td className="mono-text">{formatDisplayId('TRP', trip.id, trip.created_at)}</td>
                            <td className="mono-text">{trip.bookings?.booking_code || (trip.booking_id ? formatDisplayId('BK', trip.booking_id, trip.created_at) : 'Direct Dispatch')}</td>
                            <td>{routeStr}</td>
                            <td className="bold-text">{trip.vehicles?.registration_number || '—'}</td>
                            <td>{trip.drivers?.full_name ? `${trip.drivers.full_name}` : '—'}</td>
                            <td>
                              <span className={`status-pill ${trip.trip_status === 'COMPLETED' ? 'verified' : 'pending'}`}>
                                <span className="dot-indicator"></span>
                                {trip.trip_status || 'Active'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#0F172A' }}>₹{Number(trip.vendor_rate || 0).toLocaleString('en-IN')}</td>
                            <td>{new Date(trip.created_at).toLocaleDateString()}</td>
                            <td>
                              <button
                                className="btn-row-action"
                                title="View Trip"
                                onClick={() => showToast(`Trip ${trip.id.slice(0, 8)}`)}
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#F05A22" />
                  <h3 className="section-title">Requirements, RFQs & Quotations ({requirements.length})</h3>
                </div>
              </div>

              {!loadedTabs.has('requirements') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#F45325' }} />
                  <p>Loading requirements & quotations...</p>
                </div>
              ) : requirements.length === 0 ? (
                <div className="empty-state-text">No requirements or quotations found.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Requirement / RFQ Ref</th>
                        <th>Client</th>
                        <th>Route</th>
                        <th>Vehicle Required</th>
                        <th>RFQ Status</th>
                        <th>Quotation (Rate)</th>
                        <th>Quote Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map((req) => {
                        const quote = req.quotations?.[0];
                        const quoteAmount = quote?.quote_amount || quote?.vendor_rate;
                        const route = (req.origin_city || req.origin)
                          ? `${req.origin_city || req.origin} → ${req.destination_city || req.destination}`
                          : 'General Route';

                        return (
                          <tr key={req.id}>
                            <td className="mono-text">{formatDisplayId('REQ', req.requirement_reference || req.requirement_code || req.id, req.created_at)}</td>
                            <td>{req.client_companies?.company_name || 'Enterprise Client'}</td>
                            <td>{route}</td>
                            <td>{req.vehicle_type || req.vehicle_category || 'Commercial'}</td>
                            <td>
                              <span className="status-pill pending">
                                <span className="dot-indicator"></span>
                                {req.vendor_request_status || req.status || 'Open'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: quoteAmount ? '#0F172A' : '#94A3B8' }}>
                              {quoteAmount ? `₹${Number(quoteAmount).toLocaleString('en-IN')}` : 'Awaiting Quote'}
                            </td>
                            <td>
                              <span className={`status-pill ${quote?.status === 'ACCEPTED' ? 'verified' : quote ? 'pending' : 'inactive'}`}>
                                {quote?.status || (quote ? 'Submitted' : 'Pending Response')}
                              </span>
                            </td>
                            <td>{new Date(req.created_at).toLocaleDateString()}</td>
                            <td>
                              <button
                                className="btn-row-action"
                                title="View Requirement"
                                onClick={() => showToast(`Requirement ${req.id.slice(0, 8)}`)}
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} color="#F05A22" />
                  <h3 className="section-title">Commercial & Payment Settlements</h3>
                </div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  {payments.length} settlement record{payments.length === 1 ? '' : 's'}
                </div>
              </div>
              {payments.length === 0 ? (
                <div className="empty-state-text">No payment or settlement records found for this vendor.</div>
              ) : (
                <div className="table-responsive">
                  <table className="client-table">
                    <thead>
                      <tr>
                        <th>Reference / ID</th>
                        <th>Trip / Booking</th>
                        <th>Amount (₹)</th>
                        <th>Payment Type</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any, idx: number) => (
                        <tr key={p.id || `pay-${idx}`}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {p.transaction_id || `PAY-${(p.id || '').substring(0, 8).toUpperCase()}`}
                          </td>
                          <td>{p.trip_id || p.booking_id || 'Direct Freight Settlement'}</td>
                          <td style={{ fontWeight: 700, color: '#0F172A' }}>
                            ₹{(p.amount || p.vendor_rate || 0).toLocaleString('en-IN')}
                          </td>
                          <td>{p.payment_type || 'Vendor Payout'}</td>
                          <td>
                            <span className={`status-badge ${(p.status || p.trip_status || 'COMPLETED').toLowerCase()}`}>
                              {p.status || (p.trip_status === 'COMPLETED' ? 'Settled' : 'Pending')}
                            </span>
                          </td>
                          <td>{new Date(p.created_at || p.completed_at || Date.now()).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#F05A22" />
                  <h3 className="section-title">Vendor Audit & Activity Timeline</h3>
                </div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>
                  {activities.length} event{activities.length === 1 ? '' : 's'} logged
                </div>
              </div>
              {activities.length === 0 ? (
                <div className="empty-state-text">No activity history recorded for this vendor.</div>
              ) : (
                <div className="table-responsive">
                  <table className="client-table">
                    <thead>
                      <tr>
                        <th>Event Type</th>
                        <th>Source / User</th>
                        <th>Details</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((a: any, idx: number) => (
                        <tr key={a.id || `act-${idx}`}>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>
                            {a.event_type || 'AUDIT_LOG'}
                          </td>
                          <td>{a.user_type || 'VENDOR_SYSTEM'}</td>
                          <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {typeof a.details === 'object' ? JSON.stringify(a.details) : (a.details || '—')}
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>
                            {new Date(a.created_at).toLocaleString('en-GB')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      <DocumentRejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
        vendor={{ id: vendor.id, name: vendor.vendor_name }}
        document={selectedDocForRejection}
        onRejectSuccess={(data) => {
          showToast(`❌ Document rejected.`);
          loadVendorData();
          loadTabData('documents');
        }}
      />

      {/* Edit Vendor Modal */}
      {isEditModalOpen && vendor && (
        <EditVendorModal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          vendor={vendor}
          primaryContact={primaryContact}
          userRole={userRole}
          onSaved={async () => {
            await loadVendorData();
            showToast('✅ Vendor details updated successfully.');
          }}
        />
      )}



      {/* Interactive Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          documentTitle={previewDoc.file_name || previewDoc.document_type || 'Vendor KYC Document'}
          fileName={previewDoc.file_name || previewDoc.document_type || 'Document'}
          fileUrlOrPath={previewDoc.storage_path || previewDoc.file_url || previewDoc.file_path || ''}
          verificationStatus={previewDoc.verification_status || 'PENDING'}
          rejectionReason={previewDoc.rejection_reason}
          uploadedAt={previewDoc.created_at}
          fileSize={previewDoc.file_size}
          mimeType={previewDoc.mime_type}
          canVerify={userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'}
          canReject={userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'}
          onVerify={() => {
            handleApproveDocument(previewDoc.id);
            setPreviewDoc(null);
          }}
          onReject={() => {
            const docToReject = previewDoc;
            setPreviewDoc(null);
            setSelectedDocForRejection({
              id: docToReject.id,
              type: docToReject.document_type,
              fileName: docToReject.file_name,
              uploadedAt: new Date(docToReject.created_at).toLocaleDateString(),
            });
            setIsRejectionModalOpen(true);
          }}
        />
      )}
    </div>
  );
};

