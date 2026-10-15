import React, { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Calendar,
  Globe,
  Info,
  AlertTriangle,
  ChevronRight,
  Truck,
  Building2,
  Mail,
  Phone,
  FileText,
  Clock,
  ShieldCheck,
  X,
  Plus
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
    vehicleCount: '',
    fleetCapacity: '',
    invitationMessage: 'You are invited to join North Eastern Carriers as a trusted transport partner.',
    validDays: '7 Days',
  });

  // Dynamic tags for Operating Cities and Vehicle Types
  const [operatingLanes, setOperatingLanes] = useState<string[]>([
    'Hyderabad',
    'Vijayawada',
    'Visakhapatnam',
    'Nagpur',
  ]);
  const [newLaneInput, setNewLaneInput] = useState('');
  const [showAddLane, setShowAddLane] = useState(false);

  const [vehicleTypes, setVehicleTypes] = useState<string[]>([
    'FTL',
    'PTL',
    'Container',
    'Project Cargo',
  ]);
  const [newVehicleInput, setNewVehicleInput] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const removeLane = (lane: string) => {
    setOperatingLanes(operatingLanes.filter((l) => l !== lane));
  };

  const addLane = () => {
    if (newLaneInput.trim() && !operatingLanes.includes(newLaneInput.trim())) {
      setOperatingLanes([...operatingLanes, newLaneInput.trim()]);
      setNewLaneInput('');
      setShowAddLane(false);
    }
  };

  const removeVehicleType = (type: string) => {
    setVehicleTypes(vehicleTypes.filter((t) => t !== type));
  };

  const addVehicleType = () => {
    if (newVehicleInput.trim() && !vehicleTypes.includes(newVehicleInput.trim())) {
      setVehicleTypes([...vehicleTypes, newVehicleInput.trim()]);
      setNewVehicleInput('');
      setShowAddVehicle(false);
    }
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

    // Server-side check for duplicate mobile in vendor_users
    if (!errs.mobile) {
      try {
        const { data: existingUser } = await supabase
          .from('vendor_users')
          .select('id')
          .eq('mobile', cleanMobile)
          .maybeSingle();

        if (existingUser) {
          errs.mobile = 'A vendor contact with this mobile number already exists.';
        }
      } catch (e) {
        // Ignore network timeout on check
      }
    }

    // Server-side check for duplicate GSTIN
    if (formData.gstin.trim() && !errs.gstin) {
      try {
        const { data: existingGst } = await supabase
          .from('vendor_companies')
          .select('id')
          .eq('gstin', formData.gstin.trim().toUpperCase())
          .maybeSingle();

        if (existingGst) {
          errs.gstin = 'A vendor company with this GSTIN is already registered.';
        }
      } catch (e) {
        // Ignore network timeout on check
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
        .insert([
          {
            vendor_name: formData.businessName.trim(),
            pan: formData.pan.trim().toUpperCase() || null,
            gstin: formData.gstin.trim().toUpperCase() || null,
            address: operatingLanes.join(', ') || 'Transport Hub',
            status: 'PENDING',
            onboarding_source: 'INVITED',
          },
        ])
        .select()
        .single();

      if (compErr) throw compErr;

      // 2. Insert Primary Contact Person into vendor_users
      const { error: userErr } = await supabase.from('vendor_users').insert([
        {
          vendor_id: comp.id,
          full_name: formData.contactName.trim(),
          email: formData.email.trim(),
          mobile: formData.mobile.replace(/\D/g, ''),
          status: 'PENDING',
        },
      ]);

      if (userErr) throw userErr;

      showToast(`✅ Invitation sent to ${formData.contactName} (${formData.businessName})!`);

      setTimeout(() => {
        onInvited(comp.id);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to create vendor invitation:', err);
      setErrors({
        global: err.message || 'Database error occurred while sending vendor invitation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="operational-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="client-header-hero">
        <div className="client-header-truck-bg">
          <div className="client-header-truck-overlay" />
        </div>

        <div className="client-header-info">
          <div className="client-header-breadcrumbs">
            <span>Vendors</span>
            <ChevronRight size={13} className="breadcrumb-chevron" />
            <span className="breadcrumb-current">Add Vendor</span>
          </div>
          <h1 className="client-directory-title">Add Vendor</h1>
          <p className="client-directory-desc">
            Invite a transport partner to join your operations.
          </p>
        </div>

        <div className="client-header-actions">
          <button
            type="button"
            className="btn-form-cancel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>Back to Vendor Directory</span>
          </button>
        </div>
      </div>

      {errors.global && (
        <div className="rejection-error-alert" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <span>{errors.global}</span>
        </div>
      )}

      {/* Main 2-Column Grid Matching Reference Image 3 */}
      <form onSubmit={handleSubmit}>
        <div className="add-vendor-form-grid">
          {/* Left Column (Cards 1, 2, 3) */}
          <div className="add-vendor-left-col">
            {/* Card 1: Vendor Company Information */}
            <div className="vendor-form-card">
              <div className="vendor-card-header">
                <div className="step-num-circle">1</div>
                <div>
                  <h3 className="card-title-text">Vendor Company Information</h3>
                  <p className="card-subtitle-text">Enter the transport vendor's business details.</p>
                </div>
              </div>

              <div className="form-two-col">
                <div className="form-field-group">
                  <label>
                    Business Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vendor business name"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    className={`field-input-box ${errors.businessName ? 'input-error' : ''}`}
                  />
                  {errors.businessName && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.businessName}
                    </span>
                  )}
                </div>

                <div className="form-field-group">
                  <label>
                    Vendor Type <span className="required-star">*</span>
                  </label>
                  <select
                    value={formData.vendorType}
                    onChange={(e) =>
                      setFormData({ ...formData, vendorType: e.target.value })
                    }
                    className="field-input-box"
                  >
                    <option value="Fleet Owner">Fleet Owner</option>
                    <option value="Broker / Aggregator">Broker / Aggregator</option>
                    <option value="Fleet Operator">Fleet Operator</option>
                    <option value="Independent Truck Owner">Independent Truck Owner</option>
                  </select>
                </div>
              </div>

              <div className="form-two-col">
                <div className="form-field-group">
                  <label>GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 36AAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) =>
                      setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                    }
                    className={`field-input-box ${errors.gstin ? 'input-error' : ''}`}
                  />
                  {errors.gstin && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.gstin}
                    </span>
                  )}
                </div>

                <div className="form-field-group">
                  <label>PAN Number (Optional)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. AAAAA1234A"
                    value={formData.pan}
                    onChange={(e) =>
                      setFormData({ ...formData, pan: e.target.value.toUpperCase() })
                    }
                    className={`field-input-box ${errors.pan ? 'input-error' : ''}`}
                  />
                  {errors.pan && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.pan}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-two-col" style={{ marginBottom: 0 }}>
                <div className="form-field-group">
                  <label>Year of Establishment (Optional)</label>
                  <div className="field-input-icon-wrap">
                    <Calendar size={16} className="field-leading-icon" />
                    <input
                      type="text"
                      placeholder="Select year"
                      value={formData.establishmentYear}
                      onChange={(e) =>
                        setFormData({ ...formData, establishmentYear: e.target.value })
                      }
                      className="field-input-box"
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label>Website (Optional)</label>
                  <div className="field-input-icon-wrap">
                    <Globe size={16} className="field-leading-icon" />
                    <input
                      type="text"
                      placeholder="https://www.example.com"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData({ ...formData, website: e.target.value })
                      }
                      className="field-input-box"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Primary Contact Person */}
            <div className="vendor-form-card">
              <div className="vendor-card-header">
                <div className="step-num-circle">2</div>
                <div>
                  <h3 className="card-title-text">Primary Contact Person</h3>
                  <p className="card-subtitle-text">
                    Enter the main contact person who will receive the invitation.
                  </p>
                </div>
              </div>

              <div className="form-two-col">
                <div className="form-field-group">
                  <label>
                    Contact Person Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData({ ...formData, contactName: e.target.value })
                    }
                    className={`field-input-box ${errors.contactName ? 'input-error' : ''}`}
                  />
                  {errors.contactName && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.contactName}
                    </span>
                  )}
                </div>

                <div className="form-field-group">
                  <label>
                    Designation <span className="required-star">*</span>
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    className="field-input-box"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Managing Director">Managing Director</option>
                    <option value="Fleet Manager">Fleet Manager</option>
                    <option value="Operations Head">Operations Head</option>
                    <option value="Dispatcher">Dispatcher</option>
                  </select>
                </div>
              </div>

              <div className="form-two-col" style={{ marginBottom: 0 }}>
                <div className="form-field-group">
                  <label>
                    Email Address <span className="required-star">*</span>
                  </label>
                  <div className="field-input-icon-wrap">
                    <Mail size={16} className="field-leading-icon" />
                    <input
                      type="email"
                      required
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className={`field-input-box ${errors.email ? 'input-error' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.email}
                    </span>
                  )}
                </div>

                <div className="form-field-group">
                  <label>
                    Mobile Number <span className="required-star">*</span>
                  </label>
                  <div className="field-prefix-wrap">
                    <span className="prefix-badge">🇮🇳 +91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="Enter 10 digit mobile number"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobile: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      className={`prefix-input ${errors.mobile ? 'input-error' : ''}`}
                    />
                  </div>
                  {errors.mobile && (
                    <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>
                      {errors.mobile}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Operating Details */}
            <div className="vendor-form-card">
              <div className="vendor-card-header">
                <div className="step-num-circle">3</div>
                <div>
                  <h3 className="card-title-text">Operating Details</h3>
                  <p className="card-subtitle-text">
                    Provide initial operating details to understand the vendor profile.
                  </p>
                </div>
              </div>

              {/* Operating Cities / Lanes */}
              <div className="form-field-group" style={{ marginBottom: '16px' }}>
                <label>Operating Cities / Lanes</label>
                <div className="tags-box-container">
                  {operatingLanes.map((lane) => (
                    <span key={lane} className="tag-badge-pill">
                      {lane}
                      <span
                        className="tag-close-btn"
                        onClick={() => removeLane(lane)}
                        title="Remove lane"
                      >
                        <X size={12} />
                      </span>
                    </span>
                  ))}
                  {showAddLane ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder="City/Lane..."
                        value={newLaneInput}
                        onChange={(e) => setNewLaneInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLane();
                          }
                        }}
                        style={{
                          height: '26px',
                          padding: '0 6px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={addLane}
                        className="add-tag-btn"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-tag-btn"
                      onClick={() => setShowAddLane(true)}
                    >
                      + Add More
                    </button>
                  )}
                </div>
              </div>

              {/* Vehicle Types */}
              <div className="form-field-group" style={{ marginBottom: '16px' }}>
                <label>
                  Vehicle Types <span className="required-star">*</span>
                </label>
                <div className="tags-box-container">
                  {vehicleTypes.map((type) => (
                    <span key={type} className="tag-badge-pill">
                      {type}
                      <span
                        className="tag-close-btn"
                        onClick={() => removeVehicleType(type)}
                        title="Remove vehicle type"
                      >
                        <X size={12} />
                      </span>
                    </span>
                  ))}
                  {showAddVehicle ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder="Vehicle type..."
                        value={newVehicleInput}
                        onChange={(e) => setNewVehicleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addVehicleType();
                          }
                        }}
                        style={{
                          height: '26px',
                          padding: '0 6px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={addVehicleType}
                        className="add-tag-btn"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-tag-btn"
                      onClick={() => setShowAddVehicle(true)}
                    >
                      + Add More
                    </button>
                  )}
                </div>
              </div>

              <div className="form-two-col" style={{ marginBottom: 0 }}>
                <div className="form-field-group">
                  <label>No. of Vehicles (Approx)</label>
                  <div className="field-input-icon-wrap">
                    <Truck size={16} className="field-leading-icon" />
                    <input
                      type="number"
                      placeholder="Enter number of vehicles"
                      value={formData.vehicleCount}
                      onChange={(e) =>
                        setFormData({ ...formData, vehicleCount: e.target.value })
                      }
                      className="field-input-box"
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label>Fleet Capacity (MT) (Approx)</label>
                  <div className="field-input-icon-wrap">
                    <Building2 size={16} className="field-leading-icon" />
                    <input
                      type="number"
                      placeholder="Enter total capacity in MT"
                      value={formData.fleetCapacity}
                      onChange={(e) =>
                        setFormData({ ...formData, fleetCapacity: e.target.value })
                      }
                      className="field-input-box"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Cards 4, 5 & Actions) */}
          <div className="add-vendor-right-col">
            {/* Card 4: Invitation Settings */}
            <div className="vendor-form-card">
              <div className="vendor-card-header">
                <div className="step-num-circle">4</div>
                <div>
                  <h3 className="card-title-text">Invitation Settings</h3>
                  <p className="card-subtitle-text">
                    Configure the invitation and access settings.
                  </p>
                </div>
              </div>

              <div className="form-field-group" style={{ marginBottom: '14px' }}>
                <label>Invitation Message (Optional)</label>
                <textarea
                  className="invitation-textarea"
                  rows={4}
                  maxLength={500}
                  placeholder="Enter invitation message"
                  value={formData.invitationMessage}
                  onChange={(e) =>
                    setFormData({ ...formData, invitationMessage: e.target.value })
                  }
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    You are invited to join North Eastern Carriers as a trusted transport partner.
                  </span>
                  <span className="char-counter-text">
                    {formData.invitationMessage.length}/500
                  </span>
                </div>
              </div>

              <div className="form-field-group">
                <label>
                  Valid For <span className="required-star">*</span>
                </label>
                <select
                  value={formData.validDays}
                  onChange={(e) =>
                    setFormData({ ...formData, validDays: e.target.value })
                  }
                  className="field-input-box"
                >
                  <option value="7 Days">7 Days</option>
                  <option value="14 Days">14 Days</option>
                  <option value="30 Days">30 Days</option>
                </select>
                <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                  The invitation link will be valid for the selected period.
                </span>
              </div>
            </div>

            {/* Card 5: Invitation Process */}
            <div className="vendor-form-card">
              <div className="vendor-card-header">
                <div className="step-num-circle">5</div>
                <div>
                  <h3 className="card-title-text">Invitation Process</h3>
                  <p className="card-subtitle-text">
                    The vendor will receive an email and SMS with the registration link.
                  </p>
                </div>
              </div>

              <div className="process-steps-container">
                <div className="process-step-item">
                  <div className="step-small-num">1</div>
                  <div>
                    <h5 className="step-info-title">Fill vendor details</h5>
                    <p className="step-info-desc">Enter business and contact information</p>
                  </div>
                </div>

                <div className="process-step-item">
                  <div className="step-small-num">2</div>
                  <div>
                    <h5 className="step-info-title">Send invitation</h5>
                    <p className="step-info-desc">Vendor will receive an email/SMS with registration link</p>
                  </div>
                </div>

                <div className="process-step-item">
                  <div className="step-small-num">3</div>
                  <div>
                    <h5 className="step-info-title">Vendor registration</h5>
                    <p className="step-info-desc">Vendor completes registration and uploads documents</p>
                  </div>
                </div>

                <div className="process-step-item">
                  <div className="step-small-num">4</div>
                  <div>
                    <h5 className="step-info-title">Verification</h5>
                    <p className="step-info-desc">Admin verifies documents and approves the vendor</p>
                  </div>
                </div>

                <div className="process-step-item">
                  <div className="step-small-num">5</div>
                  <div>
                    <h5 className="step-info-title">Start operations</h5>
                    <p className="step-info-desc">Approved vendor can receive RFQs and submit quotations</p>
                  </div>
                </div>
              </div>

              {/* Important Notes Callout */}
              <div className="important-notes-alert">
                <div className="notes-alert-header">
                  <Info size={16} />
                  <span>Important Notes</span>
                </div>
                <ul className="notes-alert-list">
                  <li>Email or mobile number must be unique.</li>
                  <li>Vendor will be able to register only through the invitation link.</li>
                  <li>Vendor needs to complete document upload for verification.</li>
                  <li>Unverified vendors cannot receive RFQs or submit quotations.</li>
                  <li>You will be notified once the vendor completes registration.</li>
                </ul>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="form-bottom-actions-row">
              <button
                type="button"
                className="btn-form-cancel"
                onClick={onBack}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-send-invitation"
                disabled={isSubmitting}
              >
                <Send size={15} />
                <span>{isSubmitting ? 'Sending...' : 'Send Invitation'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
