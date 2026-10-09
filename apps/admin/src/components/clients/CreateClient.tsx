import React, { useState } from "react";
import {
  ArrowLeft, ArrowRight, Save, X, Building2, User, MapPin,
  Phone, Mail, Calendar, Info, CheckCircle, AlertCircle, Loader,
  Check, ShieldAlert
} from "lucide-react";
import { supabase } from "../../utils/supabase";

interface CreateClientProps {
  onBack: () => void;
  onCreated: (clientId: string) => void;
}

interface FormData {
  // 1. Company Information
  company_name: string;
  gstin: string;
  client_type: string;
  industry_type: string;

  // 2. Registered Office Address
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;

  // 3. Primary Contact Person
  contact_name: string;
  designation: string;
  email: string;
  mobile: string;

  // 4. Credit & Payment Terms
  credit_window_days: string;
}

const INITIAL_FORM: FormData = {
  company_name: "",
  gstin: "",
  client_type: "",
  industry_type: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  pincode: "",
  contact_name: "",
  designation: "",
  email: "",
  mobile: "",
  credit_window_days: "30"
};

const CLIENT_TYPES = [
  "Manufacturer",
  "Trader",
  "Distributor",
  "Exporter",
  "Importer",
  "Retailer",
  "Government",
  "Other"
];

const INDUSTRY_TYPES = [
  "Construction Materials",
  "Automotive & Ancillary",
  "Steel & Heavy Metals",
  "Pharmaceuticals & Healthcare",
  "FMCG & Consumer Goods",
  "Textiles & Garments",
  "Agriculture & Farming",
  "Electronics & Appliances",
  "Cement & Minerals",
  "Chemicals & Petrochemicals",
  "Other"
];

const CITIES = [
  "Hyderabad",
  "Bengaluru",
  "Chennai",
  "Mumbai",
  "Delhi",
  "Nagpur",
  "Visakhapatnam",
  "Pune",
  "Jaipur",
  "Kolkata",
  "Ahmedabad",
  "Surat",
  "Coimbatore"
];

const STATES = [
  "Telangana",
  "Andhra Pradesh",
  "Karnataka",
  "Tamil Nadu",
  "Maharashtra",
  "Gujarat",
  "Rajasthan",
  "Delhi",
  "Uttar Pradesh",
  "West Bengal",
  "Madhya Pradesh",
  "Punjab",
  "Haryana"
];

export const CreateClient: React.FC<CreateClientProps> = ({ onBack, onCreated }) => {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<{
    clientId: string;
    companyName: string;
    otp: string;
    mobile: string;
  } | null>(null);

  const updateField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Validation logic complying with PRD and Image 1
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    // 1. Company info
    if (!form.company_name.trim()) {
      newErrors.company_name = "Company legal name is required";
    }

    const gstinClean = form.gstin.trim().toUpperCase();
    if (!gstinClean) {
      newErrors.gstin = "GSTIN is required";
    } else if (gstinClean.length !== 15) {
      newErrors.gstin = "GSTIN must be exactly 15 characters";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinClean)) {
      newErrors.gstin = "Invalid GSTIN format (e.g. 36AABCD1234F1Z5)";
    }

    if (!form.client_type) {
      newErrors.client_type = "Please select a client type";
    }

    // 2. Address
    if (!form.address_line_1.trim()) {
      newErrors.address_line_1 = "Address line 1 is required";
    }
    if (!form.city) {
      newErrors.city = "Please select a city";
    }
    if (!form.state) {
      newErrors.state = "Please select a state";
    }
    const pinClean = form.pincode.trim();
    if (!pinClean) {
      newErrors.pincode = "PIN code is required";
    } else if (!/^\d{6}$/.test(pinClean)) {
      newErrors.pincode = "PIN code must be exactly 6 digits";
    }

    // 3. Contact person
    if (!form.contact_name.trim()) {
      newErrors.contact_name = "Contact person name is required";
    }
    if (!form.designation.trim()) {
      newErrors.designation = "Designation is required";
    }

    const emailClean = form.email.trim();
    if (!emailClean) {
      newErrors.email = "Official email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      newErrors.email = "Please enter a valid email address";
    }

    const mobileClean = form.mobile.replace(/\D/g, "");
    if (!mobileClean) {
      newErrors.mobile = "Primary mobile number is required";
    } else if (mobileClean.length !== 10) {
      newErrors.mobile = "Mobile number must be exactly 10 digits";
    }

    // 4. Payment terms
    if (!form.credit_window_days || isNaN(Number(form.credit_window_days)) || Number(form.credit_window_days) < 0) {
      newErrors.credit_window_days = "Valid payment window (in days) is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAndProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      const gstinClean = form.gstin.trim().toUpperCase();
      const panClean = gstinClean.length >= 12 ? gstinClean.substring(2, 12) : null;
      const fullAddress = `${form.address_line_1.trim()}${form.address_line_2 ? ", " + form.address_line_2.trim() : ""}, ${form.city}, ${form.state} - ${form.pincode.trim()}`;
      const mobileClean = form.mobile.replace(/\D/g, "");

      // 1. Check duplicate mobile number in client_users
      const { data: existingUser } = await supabase
        .from("client_users")
        .select("id")
        .eq("mobile", mobileClean)
        .maybeSingle();

      if (existingUser) {
        setErrors(prev => ({
          ...prev,
          mobile: "This mobile number is already registered for another client account."
        }));
        setIsSubmitting(false);
        return;
      }

      // 2. Insert into client_companies
      const { data: newCompany, error: compErr } = await supabase
        .from("client_companies")
        .insert({
          company_name: form.company_name.trim(),
          gstin: gstinClean,
          pan: panClean,
          registered_address: fullAddress,
          city: form.city,
          pincode: form.pincode.trim(),
          status: "ACTIVE"
        })
        .select()
        .single();

      if (compErr) {
        throw new Error(`Failed to create client company: ${compErr.message}`);
      }

      if (!newCompany?.id) {
        throw new Error('Failed to retrieve newly created client ID.');
      }

      const generatedId = newCompany.id;

      // 3. Insert primary contact into client_users
      const { error: userErr } = await supabase
        .from("client_users")
        .insert({
          client_id: newCompany.id,
          full_name: form.contact_name.trim(),
          email: form.email.trim(),
          mobile: mobileClean,
          status: "ACTIVE"
        });

      if (userErr) {
        throw new Error(`Failed to create primary contact: ${userErr.message}`);
      }

      // 4. Provision client account & generate OTP
      const welcomeOtp = Math.floor(100000 + Math.random() * 900000).toString();

      setProvisionSuccess({
        clientId: generatedId,
        companyName: form.company_name.trim(),
        otp: welcomeOtp,
        mobile: `+91 ${mobileClean}`
      });

      // Auto-navigate to client profile after showing provision feedback
      setTimeout(() => {
        onCreated(generatedId);
      }, 1600);
    } catch (err: any) {
      setGlobalError(err.message || "Failed to create client account. Please check your network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cli-dir-wrapper">
      {/* Global Error Banner */}
      {globalError && (
        <div className="alert-error-bar" style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C" }}>
          <AlertCircle size={16} />
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Account Provisioned Success Banner */}
      {provisionSuccess && (
        <div
          className="toast-success"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            background: "#16A34A",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
          }}
        >
          <CheckCircle size={18} />
          <div>
            <strong>Account Provisioned Successfully!</strong>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Welcome OTP <strong>{provisionSuccess.otp}</strong> sent to {provisionSuccess.mobile}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>Clients</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">Create Client</span>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Create Client</h1>
          <p className="page-subtitle">
            Add a new client company to manage transport requirements and bookings.
          </p>
        </div>

        <button className="btn-back-outline" onClick={onBack} id="btn-back-directory">
          <ArrowLeft size={15} />
          <span>Back to Client Directory</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Layout (Image 1) */}
      <form onSubmit={handleSaveAndProvision} className="create-client-layout">
        {/* Left Column: 4 Numbered Section Cards */}
        <div className="create-form-column">
          {/* ================================================================
              SECTION 1: COMPANY INFORMATION
              ================================================================ */}
          <div className="create-section-card">
            <div className="create-section-header">
              <div className="step-num-circle">1</div>
              <div>
                <h3 className="create-section-title">Company Information</h3>
                <p className="create-section-subtitle">
                  Enter the client company's legal details and tax information.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Company Legal Name */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Company Legal Name <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Enter company legal name"
                  value={form.company_name}
                  onChange={e => updateField("company_name", e.target.value)}
                  style={errors.company_name ? { borderColor: "#DC2626" } : {}}
                  id="input-company-name"
                />
                {errors.company_name && (
                  <span className="form-field-error">{errors.company_name}</span>
                )}
              </div>

              {/* GSTIN */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>GSTIN (15 Characters) <span className="req">*</span></span>
                  <span className="counter">{form.gstin.length}/15</span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Enter GSTIN (e.g. 36AABCD1234F1Z5)"
                  maxLength={15}
                  value={form.gstin}
                  onChange={e => updateField("gstin", e.target.value.toUpperCase())}
                  style={errors.gstin ? { borderColor: "#DC2626", textTransform: "uppercase" } : { textTransform: "uppercase" }}
                  id="input-gstin"
                />
                {errors.gstin && (
                  <span className="form-field-error">{errors.gstin}</span>
                )}
              </div>

              {/* Client Type */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Client Type <span className="req">*</span></span>
                </label>
                <select
                  className="form-select-input"
                  value={form.client_type}
                  onChange={e => updateField("client_type", e.target.value)}
                  style={errors.client_type ? { borderColor: "#DC2626" } : {}}
                  id="select-client-type"
                >
                  <option value="">Select client type</option>
                  {CLIENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.client_type && (
                  <span className="form-field-error">{errors.client_type}</span>
                )}
              </div>

              {/* Industry Type */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Industry Type</span>
                </label>
                <select
                  className="form-select-input"
                  value={form.industry_type}
                  onChange={e => updateField("industry_type", e.target.value)}
                  id="select-industry-type"
                >
                  <option value="">Select industry type</option>
                  {INDUSTRY_TYPES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ================================================================
              SECTION 2: REGISTERED OFFICE ADDRESS
              ================================================================ */}
          <div className="create-section-card">
            <div className="create-section-header">
              <div className="step-num-circle">2</div>
              <div>
                <h3 className="create-section-title">Registered Office Address</h3>
                <p className="create-section-subtitle">
                  Enter the official registered address of the client company.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Address Line 1 */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Address Line 1 <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Building name, plot no., street name"
                  value={form.address_line_1}
                  onChange={e => updateField("address_line_1", e.target.value)}
                  style={errors.address_line_1 ? { borderColor: "#DC2626" } : {}}
                  id="input-address-1"
                />
                {errors.address_line_1 && (
                  <span className="form-field-error">{errors.address_line_1}</span>
                )}
              </div>

              {/* Address Line 2 */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Address Line 2</span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Area, landmark (optional)"
                  value={form.address_line_2}
                  onChange={e => updateField("address_line_2", e.target.value)}
                  id="input-address-2"
                />
              </div>

              {/* City */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>City <span className="req">*</span></span>
                </label>
                <select
                  className="form-select-input"
                  value={form.city}
                  onChange={e => updateField("city", e.target.value)}
                  style={errors.city ? { borderColor: "#DC2626" } : {}}
                  id="select-city"
                >
                  <option value="">Select city</option>
                  {CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.city && (
                  <span className="form-field-error">{errors.city}</span>
                )}
              </div>

              {/* State */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>State <span className="req">*</span></span>
                </label>
                <select
                  className="form-select-input"
                  value={form.state}
                  onChange={e => updateField("state", e.target.value)}
                  style={errors.state ? { borderColor: "#DC2626" } : {}}
                  id="select-state"
                >
                  <option value="">Select state</option>
                  {STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.state && (
                  <span className="form-field-error">{errors.state}</span>
                )}
              </div>

              {/* PIN Code */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>PIN Code <span className="req">*</span></span>
                  <span className="counter">6 digits</span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Enter PIN code"
                  maxLength={6}
                  value={form.pincode}
                  onChange={e => updateField("pincode", e.target.value.replace(/\D/g, ""))}
                  style={errors.pincode ? { borderColor: "#DC2626" } : {}}
                  id="input-pincode"
                />
                {errors.pincode && (
                  <span className="form-field-error">{errors.pincode}</span>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================
              SECTION 3: PRIMARY CONTACT PERSON
              ================================================================ */}
          <div className="create-section-card">
            <div className="create-section-header">
              <div className="step-num-circle">3</div>
              <div>
                <h3 className="create-section-title">Primary Contact Person</h3>
                <p className="create-section-subtitle">
                  Enter the main contact details for this client.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Contact Person Name */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Contact Person Name <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Enter full name"
                  value={form.contact_name}
                  onChange={e => updateField("contact_name", e.target.value)}
                  style={errors.contact_name ? { borderColor: "#DC2626" } : {}}
                  id="input-contact-name"
                />
                {errors.contact_name && (
                  <span className="form-field-error">{errors.contact_name}</span>
                )}
              </div>

              {/* Designation */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Designation <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  className="form-text-input"
                  placeholder="Enter designation (e.g. Purchase Manager)"
                  value={form.designation}
                  onChange={e => updateField("designation", e.target.value)}
                  style={errors.designation ? { borderColor: "#DC2626" } : {}}
                  id="input-designation"
                />
                {errors.designation && (
                  <span className="form-field-error">{errors.designation}</span>
                )}
              </div>

              {/* Official Email */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Official Email Address <span className="req">*</span></span>
                </label>
                <div className="form-input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    className="form-text-input"
                    placeholder="Enter official email address"
                    value={form.email}
                    onChange={e => updateField("email", e.target.value)}
                    style={errors.email ? { borderColor: "#DC2626" } : {}}
                    id="input-email"
                  />
                </div>
                {errors.email && (
                  <span className="form-field-error">{errors.email}</span>
                )}
              </div>

              {/* Primary Mobile Number */}
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Primary Mobile Number <span className="req">*</span></span>
                </label>
                <div
                  className="phone-input-group"
                  style={errors.mobile ? { borderColor: "#DC2626" } : {}}
                >
                  <div className="country-code-pill">
                    <span role="img" aria-label="India flag">🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="Enter 10 digit mobile number"
                    maxLength={10}
                    value={form.mobile}
                    onChange={e => updateField("mobile", e.target.value.replace(/\D/g, ""))}
                    id="input-mobile"
                  />
                </div>
                {errors.mobile && (
                  <span className="form-field-error">{errors.mobile}</span>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================
              SECTION 4: CREDIT & PAYMENT TERMS
              ================================================================ */}
          <div className="create-section-card">
            <div className="create-section-header">
              <div className="step-num-circle">4</div>
              <div>
                <h3 className="create-section-title">Credit & Payment Terms</h3>
                <p className="create-section-subtitle">
                  Configure credit period and payment terms for this client.
                </p>
              </div>
            </div>

            <div style={{ maxWidth: 360 }}>
              <div className="form-field-unit">
                <label className="form-field-label">
                  <span>Credit Terms / Payment Window (Days) <span className="req">*</span></span>
                </label>
                <div className="form-input-with-icon">
                  <Calendar size={16} className="input-icon" />
                  <input
                    type="number"
                    className="form-text-input"
                    min="0"
                    max="180"
                    value={form.credit_window_days}
                    onChange={e => updateField("credit_window_days", e.target.value)}
                    style={errors.credit_window_days ? { borderColor: "#DC2626" } : {}}
                    id="input-credit-terms"
                  />
                </div>
                <div className="form-field-hint">
                  Number of days allowed for client payment (e.g. 30, 45, 60)
                </div>
                {errors.credit_window_days && (
                  <span className="form-field-error">{errors.credit_window_days}</span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="create-form-actions-bar">
            <button
              type="button"
              className="btn-cancel-flat"
              onClick={onBack}
              id="btn-cancel-create"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-save-provision"
              disabled={isSubmitting}
              id="btn-save-provision"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="spin-icon" />
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <>
                  <span>Save & Provision Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Sidebar: Creation Process & Important Notes (Image 1) */}
        <div className="create-sidebar-column">
          {/* Client Creation Process Card */}
          <div className="sidebar-info-card">
            <h4 className="sidebar-card-title">Client Creation Process</h4>

            <div className="process-steps-list">
              <div className="process-step-item">
                <div className="process-circle">1</div>
                <div>
                  <div className="process-step-title">Fill client company details</div>
                  <div className="process-step-desc">Add legal, address and contact information</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">2</div>
                <div>
                  <div className="process-step-title">Save and provision account</div>
                  <div className="process-step-desc">Client will be created in the system</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">3</div>
                <div>
                  <div className="process-step-title">Send welcome message</div>
                  <div className="process-step-desc">An OTP will be sent to the mobile number</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">4</div>
                <div>
                  <div className="process-step-title">Client can start raising requirements</div>
                  <div className="process-step-desc">After OTP verification</div>
                </div>
              </div>
            </div>

            {/* Welcome Message Callout Box */}
            <div className="welcome-message-callout">
              <Mail size={18} color="#E85D26" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div className="wm-title">Welcome Message</div>
                <div className="wm-text">
                  After saving, a welcome message with OTP will be sent to the registered mobile number. The client can use this OTP to set their password and access the portal.
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes Card */}
          <div className="sidebar-info-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Info size={17} color="#2563EB" />
              <h4 className="sidebar-card-title" style={{ margin: 0 }}>Important Notes</h4>
            </div>

            <ul className="notes-bullet-list">
              <li>Company Legal Name and GSTIN are required.</li>
              <li>GSTIN must be 15 characters.</li>
              <li>Mobile number must be 10 digits and unique.</li>
              <li>Email address must be valid.</li>
              <li>Client will receive OTP for account activation.</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
};

