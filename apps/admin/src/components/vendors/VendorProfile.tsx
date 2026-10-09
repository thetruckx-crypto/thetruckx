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
  Package
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { DocumentRejectionModal } from './DocumentRejectionModal';

interface VendorProfileProps {
  vendorId: string;
  onBack: () => void;
  userRole?: 'ADMIN' | 'SUPER_ADMIN';
}

type VendorTab =
  | 'overview'
  | 'requirements'
  | 'trips'
  | 'vehicles'
  | 'documents'
  | 'payments'
  | 'activity';

export const VendorProfile: React.FC<VendorProfileProps> = ({
  vendorId,
  onBack,
  userRole = 'ADMIN',
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
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['overview']));
  
  // UI state
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState<boolean>(false);
  const [selectedDocForRejection, setSelectedDocForRejection] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    vendorName: '',
    vendorType: 'Fleet Owner',
    gstin: '',
    pan: '',
    address: '',
    website: '',
    contactName: '',
    mobile: '',
    email: '',
    designation: '',
    accountStatus: 'PENDING',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Vendor Basic Data
  const loadVendorData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      setEditForm({
        vendorName: compData.vendor_name || '',
        vendorType: 'Fleet Owner',
        gstin: compData.gstin || '',
        pan: compData.pan || '',
        address: compData.address || '',
        website: '',
        contactName: '',
        mobile: '',
        email: '',
        designation: '',
        accountStatus: compData.status || 'PENDING',
      });

      // Fetch Primary Contact from vendor_users
      const { data: uData } = await supabase
        .from('vendor_users')
        .select('*')
        .eq('vendor_id', compData.id)
        .limit(1)
        .maybeSingle();

      if (uData) {
        setPrimaryContact(uData);
        setEditForm(prev => ({
          ...prev,
          contactName: uData.full_name || '',
          mobile: uData.mobile || '',
          email: uData.email || '',
          designation: uData.designation || '',
        }));
      } else {
        setPrimaryContact(null);
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
      switch (tab) {
        case 'documents':
          const { data: docData } = await supabase
            .from('documents')
            .select('*')
            .eq('reference_id', vendor.id);
          setDocuments(docData || []);
          break;

        case 'vehicles':
          const { data: tData } = await supabase
            .from('trips')
            .select('*, vehicles(*)')
            .eq('vendor_id', vendor.id);
          const realTrips = tData || [];
          setTrips(realTrips);
          const vehMap = new Map();
          realTrips.forEach(t => {
            if (t.vehicles && !vehMap.has(t.vehicles.id)) {
              vehMap.set(t.vehicles.id, t.vehicles);
            }
          });
          setVehicles(Array.from(vehMap.values()));
          break;

        case 'trips':
          if (trips.length === 0) {
            const { data: tData2 } = await supabase
              .from('trips')
              .select('*, vehicles(registration_number)')
              .eq('vendor_id', vendor.id)
              .order('created_at', { ascending: false });
            setTrips(tData2 || []);
          }
          break;

        case 'requirements':
          const { data: reqData } = await supabase
            .from('requirements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          setRequirements(reqData || []);
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
    setConfirmDialog({
      isOpen: true,
      title: 'Approve Vendor',
      message: `Are you sure you want to approve ${vendor.vendor_name}? This will allow them to receive RFQs and submit quotations.`,
      onConfirm: async () => {
        setIsActionLoading(true);
        try {
          const { error: appErr } = await supabase
            .from('vendor_companies')
            .update({
              status: 'APPROVED',
              approved_by: 'USR-ADM-002',
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendor.id);

          if (appErr) throw appErr;

          showToast(`✅ Vendor "${vendor.vendor_name}" has been approved!`);
          await loadVendorData();
        } catch (err: any) {
          showToast(`❌ Approval failed: ${err.message}`);
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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    setIsActionLoading(true);
    try {
      // Update vendor company
      const { error: editErr } = await supabase
        .from('vendor_companies')
        .update({
          vendor_name: editForm.vendorName.trim(),
          address: editForm.address.trim(),
          gstin: editForm.gstin.trim().toUpperCase() || null,
          pan: editForm.pan.trim().toUpperCase() || null,
          status: userRole === 'SUPER_ADMIN' ? editForm.accountStatus : vendor.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (editErr) throw editErr;

      // Update or insert primary contact
      if (primaryContact) {
        const { error: contactErr } = await supabase
          .from('vendor_users')
          .update({
            full_name: editForm.contactName.trim(),
            mobile: editForm.mobile.trim(),
            email: editForm.email.trim(),
          })
          .eq('id', primaryContact.id);

        if (contactErr) throw contactErr;
      } else if (editForm.contactName && editForm.mobile) {
        const { error: insertErr } = await supabase
          .from('vendor_users')
          .insert([{
            vendor_id: vendor.id,
            full_name: editForm.contactName.trim(),
            mobile: editForm.mobile.trim(),
            email: editForm.email.trim(),
            status: 'ACTIVE',
          }]);

        if (insertErr) throw insertErr;
      }

      showToast('✅ Vendor details updated successfully.');
      setIsEditModalOpen(false);
      await loadVendorData();
    } catch (err: any) {
      showToast(`❌ Update failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
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
        <RefreshCw size={24} className="spin" style={{ color: '#FF6B35', margin: '0 auto 12px' }} />
        <p>Loading vendor profile from database...</p>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="profile-error-box">
        <AlertTriangle size={32} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
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
          <span className="crumb-active">{vendor.vendor_name}</span>
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

          <div className="title-right-actions">
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
            <p className="banner-id">VEN-{vendor.id.slice(0, 8).toUpperCase()}</p>
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
          <span className="stat-label">Requirements</span>
          <span className="stat-value">{loadedTabs.has('requirements') ? requirements.length : '—'}</span>
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
          <span className="stat-label">Vehicles</span>
          <span className="stat-value">{totalVehiclesCount}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Documents</span>
          <span className="stat-value">{documentsCount}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Payments</span>
          <span className="stat-value">—</span>
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="vendor-tabs-bar">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'requirements', label: 'Requirements' },
          { key: 'trips', label: 'Trips' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'documents', label: 'Documents' },
          { key: 'payments', label: 'Payments' },
          { key: 'activity', label: 'Activity' },
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
                        <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#065F46', fontSize: '13px' }}>
                            RFQ Eligibility: Active & Eligible
                          </div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                            This vendor is verified to receive broadcast RFQs and submit commercial quotations.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={18} style={{ color: '#FF6B35', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#171717', fontSize: '13px' }}>
                            RFQ Eligibility: Ineligible
                          </div>
                          <div style={{ fontSize: '12px', color: '#E85D26', marginTop: '2px' }}>
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
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#FF6B35' }} />
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
                                {doc.file_url && (
                                  <button
                                    className="btn-row-action"
                                    title="View"
                                    onClick={() => window.open(doc.file_url, '_blank')}
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}
                                {doc.file_url && (
                                  <button
                                    className="btn-row-action"
                                    title="Download"
                                    onClick={() => window.open(doc.file_url, '_blank')}
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
                <h3 className="section-title">Vehicles ({totalVehiclesCount})</h3>
              </div>

              {!loadedTabs.has('vehicles') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#FF6B35' }} />
                  <p>Loading vehicles...</p>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="empty-state-text">No vehicles enrolled for this vendor.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Vehicle No.</th>
                        <th>Type</th>
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

        {activeTab === 'trips' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <h3 className="section-title">Trips ({trips.length})</h3>
              </div>

              {!loadedTabs.has('trips') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#FF6B35' }} />
                  <p>Loading trips...</p>
                </div>
              ) : trips.length === 0 ? (
                <div className="empty-state-text">No trips recorded for this vendor.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Trip ID</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th>Rate</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => (
                        <tr key={trip.id}>
                          <td className="mono-text">TRIP-{trip.id.slice(0, 8).toUpperCase()}</td>
                          <td>{trip.vehicles?.registration_number || '—'}</td>
                          <td>
                            <span className={`status-pill ${trip.trip_status === 'COMPLETED' ? 'verified' : 'pending'}`}>
                              <span className="dot-indicator"></span>
                              {trip.trip_status || 'Active'}
                            </span>
                          </td>
                          <td>₹{Number(trip.vendor_rate || 0).toLocaleString('en-IN')}</td>
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
                      ))}
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
                <h3 className="section-title">Requirements</h3>
              </div>

              {!loadedTabs.has('requirements') ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', color: '#FF6B35' }} />
                  <p>Loading requirements...</p>
                </div>
              ) : requirements.length === 0 ? (
                <div className="empty-state-text">No requirements found.</div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Requirement ID</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map((req) => (
                        <tr key={req.id}>
                          <td className="mono-text">REQ-{req.id.slice(0, 8).toUpperCase()}</td>
                          <td>
                            <span className="status-pill pending">
                              <span className="dot-indicator"></span>
                              {req.status || 'Open'}
                            </span>
                          </td>
                          <td>{new Date(req.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="btn-row-action"
                              title="View"
                              onClick={() => showToast(`Requirement ${req.id.slice(0, 8)}`)}
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

        {activeTab === 'payments' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <h3 className="section-title">Payments</h3>
              </div>
              <div className="empty-state-text">Payment history not available yet.</div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="tab-content-single">
            <div className="profile-section-card">
              <div className="card-header-bar">
                <h3 className="section-title">Activity Log</h3>
              </div>
              <div className="empty-state-text">Activity log not implemented yet.</div>
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
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="edit-vendor-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="create-modal-header">
              <h3 className="create-modal-title">Edit Vendor</h3>
              <button className="create-modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="create-modal-body">
                <h4 className="form-section-heading">Business Information</h4>
                <div className="form-fields-grid">
                  <div className="form-field-group">
                    <label className="field-label">Business Name <span className="req-star">*</span></label>
                    <input
                      type="text"
                      required
                      value={editForm.vendorName}
                      onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Vendor Type</label>
                    <select
                      value={editForm.vendorType}
                      onChange={(e) => setEditForm({ ...editForm, vendorType: e.target.value })}
                      className="field-input"
                    >
                      <option value="Fleet Owner">Fleet Owner</option>
                      <option value="Broker">Broker</option>
                      <option value="Aggregator">Aggregator</option>
                      <option value="Independent">Independent</option>
                    </select>
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">GSTIN</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={editForm.gstin}
                      onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">PAN Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editForm.pan}
                      onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="field-label">Address</label>
                    <textarea
                      rows={2}
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Website</label>
                    <input
                      type="text"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="field-input"
                    />
                  </div>
                </div>

                <h4 className="form-section-heading">Contact Information</h4>
                <div className="form-fields-grid">
                  <div className="form-field-group">
                    <label className="field-label">Contact Name <span className="req-star">*</span></label>
                    <input
                      type="text"
                      required
                      value={editForm.contactName}
                      onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Mobile <span className="req-star">*</span></label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value.replace(/\D/g, '') })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Email <span className="req-star">*</span></label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Designation</label>
                    <input
                      type="text"
                      value={editForm.designation}
                      onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                      className="field-input"
                    />
                  </div>
                </div>

                {userRole === 'SUPER_ADMIN' && (
                  <>
                    <h4 className="form-section-heading">Status</h4>
                    <div className="form-fields-grid">
                      <div className="form-field-group">
                        <label className="field-label">Account Status</label>
                        <select
                          value={editForm.accountStatus}
                          onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value })}
                          className="field-input"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="create-modal-footer">
                <button type="button" className="btn-cancel-modal" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-modal" disabled={isActionLoading}>
                  <Edit size={15} />
                  <span>{isActionLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

