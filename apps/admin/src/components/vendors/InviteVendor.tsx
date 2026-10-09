import React, { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Calendar,
  Globe,
  Info,
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface InviteVendorProps {
  onBack: () => void;
  onInvited: (vendorId: string) => void;
}

export const InviteVendor: React.FC<InviteVendorProps> = ({ onBack, onInvited }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    vendorType: 'Fleet Owner',
    gstin: '',
    pan: '',
    establishmentYear: '',
    website: '',
    contactName: '',
    designation: 'Owner',
    email: '',
    mobile: '',
    address: '',
    operatingLanes: '',
    vehicleTypes: '40 MT Multi-Axle Trailer',
    vehicleCount: '',
    fleetCapacity: '',
    invitationMessage: 'You are invited to join North Eastern Carriers as a trusted transport partner. Please register and complete your profile to start receiving transport requirements.',
    validDays: '7 Days',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const validate = async (): Promise<boolean> => {
    const errs: { [key: string]: string } = {};

    if (!formData.businessName.trim()) {
      errs.businessName = 'Business Name is required.';
    }

    if (!formData.vendorType) {
      errs.vendorType = 'Vendor Type is required.';
    }

    if (formData.gstin.trim() && formData.gstin.trim().length !== 15) {
      errs.gstin = 'GSTIN must be exactly 15 characters if provided.';
    }

    if (formData.pan.trim() && formData.pan.trim().length !== 10) {
      errs.pan = 'PAN must be exactly 10 characters if provided.';
    }

    if (!formData.contactName.trim()) {
      errs.contactName = 'Contact Person Name is required.';
    }

    if (!formData.designation.trim()) {
      errs.designation = 'Designation is required.';
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      errs.email = 'Valid Email Address is required.';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) {
      errs.mobile = '10-digit Mobile Number is required.';
    }

    // Check duplicate mobile in vendor_users
    if (!errs.mobile) {
      const { data: existingUser } = await supabase
        .from('vendor_users')
        .select('id')
        .eq('mobile', cleanMobile)
        .maybeSingle();

      if (existingUser) {
        errs.mobile = 'A vendor contact with this mobile number is already registered.';
      }
    }

    // Check duplicate GSTIN if provided
    if (formData.gstin.trim() && !errs.gstin) {
      const { data: existingGst } = await supabase
        .from('vendor_companies')
        .select('id')
        .eq('gstin', formData.gstin.trim().toUpperCase())
        .maybeSingle();

      if (existingGst) {
        errs.gstin = 'A vendor company with this GSTIN is already registered.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validate();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      // 1. Insert Vendor Company Record into database
      const { data: comp, error: compErr } = await supabase
        .from('vendor_companies')
        .insert([{
          vendor_name: formData.businessName.trim(),
          pan: formData.pan.trim().toUpperCase() || null,
          gstin: formData.gstin.trim().toUpperCase() || null,
          address: formData.address.trim() || formData.operatingLanes.trim() || 'Transport Hub',
          status: 'PENDING',
          onboarding_source: 'INVITED',
        }])
        .select()
        .single();

      if (compErr) throw compErr;

      // 2. Insert Primary Contact Person into vendor_users
      const { error: userErr } = await supabase
        .from('vendor_users')
        .insert([{
          vendor_id: comp.id,
          full_name: formData.contactName.trim(),
          email: formData.email.trim(),
          mobile: formData.mobile.replace(/\D/g, ''),
          status: 'PENDING',
        }]);

      if (userErr) throw userErr;

      // 3. Dispatch simulated notification event / toast
      showToast(`✅ Invitation sent to ${formData.contactName} (${formData.businessName})!`);

      setTimeout(() => {
        onInvited(comp.id);
      }, 900);

    } catch (err: any) {
      console.error('Failed to provision vendor invitation:', err);
      setErrors({ global: err.message || 'Database error occurred while sending vendor invitation.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="invite-vendor-page-wrapper">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="page-nav-header">
        <div className="breadcrumbs-row">
          <span className="crumb-root">Vendors</span>
          <span className="crumb-sep">›</span>
          <span className="crumb-active">Add Vendor</span>
        </div>
        <div className="page-title-row">
          <div>
            <h1 className="main-page-title">Add Vendor</h1>
            <p className="main-page-subtitle">
              Send an invitation to a transport vendor to register on the platform.
            </p>
          </div>
          <button className="btn-back-link" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back to Vendor Directory</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Split: Left Form (70%), Right Process Guide (30%) */}
      <div className="invite-vendor-layout">
        {/* Left Form Surface */}
        <form onSubmit={handleSubmit} className="invite-form-column">
          {errors.global && (
            <div className="rejection-error-alert" style={{ marginBottom: '16px' }}>
              <AlertTriangle size={16} />
              <span>{errors.global}</span>
            </div>
          )}

          {/* Section 1: Vendor Company Information */}
          <div className="invite-section-card">
            <div className="section-card-header">
              <div className="step-circle-badge">1</div>
              <div>
                <h3 className="section-title">Vendor Company Information</h3>
                <p className="section-subtitle">Enter the transport vendor's business details.</p>
              </div>
            </div>

            <div className="form-fields-grid">
              {/* Business Name */}
              <div className="form-field-group">
                <label className="field-label">
                  Business Name <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter vendor business name"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className={`field-input ${errors.businessName ? 'input-error' : ''}`}
                />
                {errors.businessName && <span className="field-error-text">{errors.businessName}</span>}
              </div>

              {/* Vendor Type */}
              <div className="form-field-group">
                <label className="field-label">
                  Vendor Type <span className="req-star">*</span>
                </label>
                <select
                  value={formData.vendorType}
                  onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                  className="field-input"
                >
                  <option value="Fleet Owner">Fleet Owner</option>
                  <option value="Broker / Aggregator">Broker / Aggregator</option>
                  <option value="Fleet Operator">Fleet Operator</option>
                  <option value="Independent Truck Owner">Independent Truck Owner</option>
                </select>
              </div>

              {/* GSTIN */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">GSTIN (Optional)</label>
                  <span className="field-char-badge">{formData.gstin.length}/15</span>
                </div>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Enter GSTIN (e.g. 36AAACS1234A1Z9)"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className={`field-input ${errors.gstin ? 'input-error' : ''}`}
                />
                {errors.gstin && <span className="field-error-text">{errors.gstin}</span>}
              </div>

              {/* PAN Number */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">PAN Number (Optional)</label>
                  <span className="field-char-badge">{formData.pan.length}/10</span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="Enter PAN number (e.g. AAACS1234A)"
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  className={`field-input ${errors.pan ? 'input-error' : ''}`}
                />
                {errors.pan && <span className="field-error-text">{errors.pan}</span>}
              </div>

              {/* Year of Establishment */}
              <div className="form-field-group">
                <label className="field-label">Year of Establishment (Optional)</label>
                <div className="input-with-icon">
                  <Calendar size={16} className="input-icon-left" />
                  <input
                    type="text"
                    placeholder="e.g. 2018"
                    value={formData.establishmentYear}
                    onChange={(e) => setFormData({ ...formData, establishmentYear: e.target.value })}
                    className="field-input with-left-icon"
                  />
                </div>
              </div>

              {/* Website */}
              <div className="form-field-group">
                <label className="field-label">Website (Optional)</label>
                <div className="input-with-icon">
                  <Globe size={16} className="input-icon-left" />
                  <input
                    type="text"
                    placeholder="https://www.example.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="field-input with-left-icon"
                  />
                </div>
              </div>

              {/* Registered Address */}
              <div className="form-field-group" style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Registered Address</label>
                <textarea
                  rows={2}
                  placeholder="Enter registered business address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="field-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Primary Contact Person */}
          <div className="invite-section-card">
            <div className="section-card-header">
              <div className="step-circle-badge">2</div>
              <div>
                <h3 className="section-title">Primary Contact Person</h3>
                <p className="section-subtitle">Enter the main contact person who will receive the invitation.</p>
              </div>
            </div>

            <div className="form-fields-grid">
              {/* Contact Person Name */}
              <div className="form-field-group">
                <label className="field-label">
                  Contact Person Name <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className={`field-input ${errors.contactName ? 'input-error' : ''}`}
                />
                {errors.contactName && <span className="field-error-text">{errors.contactName}</span>}
              </div>

              {/* Designation */}
              <div className="form-field-group">
                <label className="field-label">
                  Designation <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter designation (e.g. Owner, Fleet Manager)"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className={`field-input ${errors.designation ? 'input-error' : ''}`}
                />
                {errors.designation && <span className="field-error-text">{errors.designation}</span>}
              </div>

              {/* Email Address */}
              <div className="form-field-group">
                <label className="field-label">
                  Email Address <span className="req-star">*</span>
                </label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon-left" />
                  <input
                    type="email"
                    required
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`field-input with-left-icon ${errors.email ? 'input-error' : ''}`}
                  />
                </div>
                {errors.email && <span className="field-error-text">{errors.email}</span>}
              </div>

              {/* Mobile Number with +91 indicator */}
              <div className="form-field-group">
                <label className="field-label">
                  Mobile Number <span className="req-star">*</span>
                </label>
                <div className="mobile-input-group">
                  <span className="country-code-pill">🇮🇳 +91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10 digit mobile number"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                    className={`field-input mobile-input ${errors.mobile ? 'input-error' : ''}`}
                  />
                </div>
                {errors.mobile && <span className="field-error-text">{errors.mobile}</span>}
              </div>
            </div>
          </div>

          {/* Section 3: Operating Details (Optional) */}
          <div className="invite-section-card">
            <div className="section-card-header">
              <div className="step-circle-badge">3</div>
              <div>
                <h3 className="section-title">Operating Details (Optional)</h3>
                <p className="section-subtitle">Provide initial operating details to understand the vendor profile.</p>
              </div>
            </div>

            <div className="form-fields-grid">
              {/* Operating Cities / Lanes */}
              <div className="form-field-group">
                <label className="field-label">Operating Cities / Lanes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad - Bengaluru, Mumbai - Delhi"
                  value={formData.operatingLanes}
                  onChange={(e) => setFormData({ ...formData, operatingLanes: e.target.value })}
                  className="field-input"
                />
              </div>

              {/* Vehicle Types */}
              <div className="form-field-group">
                <label className="field-label">Vehicle Types</label>
                <select
                  value={formData.vehicleTypes}
                  onChange={(e) => setFormData({ ...formData, vehicleTypes: e.target.value })}
                  className="field-input"
                >
                  <option value="40 MT Multi-Axle Trailer">40 MT Multi-Axle Trailer</option>
                  <option value="35 MT High-Bed Trailer">35 MT High-Bed Trailer</option>
                  <option value="32ft Multi-Axle Container">32ft Multi-Axle Container</option>
                  <option value="16 Wheeler 25 MT">16 Wheeler 25 MT</option>
                  <option value="Open Body Truck">Open Body Truck</option>
                </select>
              </div>

              {/* No. of Vehicles (Approx) */}
              <div className="form-field-group">
                <label className="field-label">No. of Vehicles (Approx)</label>
                <input
                  type="number"
                  placeholder="Enter number of vehicles"
                  value={formData.vehicleCount}
                  onChange={(e) => setFormData({ ...formData, vehicleCount: e.target.value })}
                  className="field-input"
                />
              </div>

              {/* Fleet Capacity (MT) (Approx) */}
              <div className="form-field-group">
                <label className="field-label">Fleet Capacity (MT) (Approx)</label>
                <input
                  type="number"
                  placeholder="Enter total capacity in MT"
                  value={formData.fleetCapacity}
                  onChange={(e) => setFormData({ ...formData, fleetCapacity: e.target.value })}
                  className="field-input"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Invitation Settings */}
          <div className="invite-section-card">
            <div className="section-card-header">
              <div className="step-circle-badge">4</div>
              <div>
                <h3 className="section-title">Invitation Settings</h3>
                <p className="section-subtitle">Configure the invitation and access settings.</p>
              </div>
            </div>

            <div className="form-fields-grid" style={{ gridTemplateColumns: '1fr 220px' }}>
              {/* Invitation Message */}
              <div className="form-field-group">
                <div className="field-label-row">
                  <label className="field-label">Invitation Message (Optional)</label>
                  <span className="field-char-badge">{formData.invitationMessage.length}/500</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={formData.invitationMessage}
                  onChange={(e) => setFormData({ ...formData, invitationMessage: e.target.value })}
                  className="field-input"
                />
              </div>

              {/* Valid For (Days) */}
              <div className="form-field-group">
                <label className="field-label">Valid For (Days)</label>
                <select
                  value={formData.validDays}
                  onChange={(e) => setFormData({ ...formData, validDays: e.target.value })}
                  className="field-input"
                >
                  <option value="7 Days">7 Days</option>
                  <option value="14 Days">14 Days</option>
                  <option value="30 Days">30 Days</option>
                </select>
                <span className="field-hint-text">The invitation link will be valid for the selected period.</span>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="invite-form-actions">
            <button type="button" className="btn-cancel-flat" onClick={onBack} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-send-invitation-orange" disabled={isSubmitting}>
              <Send size={15} />
              <span>{isSubmitting ? 'Creating vendor...' : 'Send Invitation'}</span>
            </button>
          </div>
        </form>

        {/* Right Info Sidebar (Matching Image 1) */}
        <aside className="invite-sidebar-column">
          {/* 1. Invitation Process Card */}
          <div className="invite-sidebar-card">
            <h4 className="sidebar-card-title">Invitation Process</h4>
            <div className="sidebar-process-steps">
              <div className="process-step-item">
                <div className="process-step-num active">1</div>
                <div className="process-step-body">
                  <div className="process-step-title">Fill vendor details</div>
                  <div className="process-step-desc">Enter business and contact information</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-step-num">2</div>
                <div className="process-step-body">
                  <div className="process-step-title">Send invitation</div>
                  <div className="process-step-desc">Vendor will receive an email/SMS with registration link</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-step-num">3</div>
                <div className="process-step-body">
                  <div className="process-step-title">Vendor registration</div>
                  <div className="process-step-desc">Vendor completes registration and uploads documents</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-step-num">4</div>
                <div className="process-step-body">
                  <div className="process-step-title">Verification</div>
                  <div className="process-step-desc">Admin verifies documents and approves the vendor</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-step-num">5</div>
                <div className="process-step-body">
                  <div className="process-step-title">Start operations</div>
                  <div className="process-step-desc">Approved vendor can receive RFQs and submit quotations</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Invitation Message Callout */}
          <div className="invitation-tip-card">
            <div className="tip-icon-wrap">
              <Mail size={18} />
            </div>
            <div>
              <div className="tip-title">Invitation Message</div>
              <div className="tip-text">
                The vendor will receive an email and SMS with the registration link and your message.
              </div>
            </div>
          </div>

          {/* 3. Important Notes Card */}
          <div className="invite-sidebar-card">
            <div className="important-notes-header">
              <Info size={16} className="notes-icon" />
              <span className="sidebar-card-title">Important Notes</span>
            </div>
            <ul className="important-notes-list">
              <li>Email or Mobile number must be unique.</li>
              <li>Vendor will be able to register only through the invitation link.</li>
              <li>Vendor needs to complete document upload for verification.</li>
              <li>Unverified vendors cannot receive RFQs or submit quotations.</li>
              <li>You will be notified once the vendor completes registration.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
