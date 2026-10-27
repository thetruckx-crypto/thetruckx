import React, { useState, useEffect } from "react";
import {
  X, Building2, User, Mail, Phone, MapPin, CheckCircle,
  AlertCircle, Loader, Save, Truck, Globe, Shield
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { pincodeService } from "../../services/pincodeService";
import { formatDisplayId } from "../../utils/idGenerator";

export interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: any;
  primaryContact?: any;
  userRole?: "ADMIN" | "SUPER_ADMIN";
  onSaved: () => Promise<void> | void;
}

export const VENDOR_TYPES = [
  "Fleet Owner",
  "Transporter",
  "Broker / Agent",
  "3PL / Logistics Partner",
  "Independent Contractor",
  "Aggregator"
];

export const ALL_INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

interface FormData {
  vendor_name: string;
  vendor_type: string;
  gstin: string;
  pan: string;
  website: string;
  status: string;

  contact_name: string;
  designation: string;
  email: string;
  mobile: string;

  address_line_1: string;
  address_line_2: string;
  pincode: string;
  city: string;
  state: string;

  declared_fleet_strength: string;
}

function parseAddressParts(rawAddress?: string, city?: string, state?: string, pincode?: string) {
  if (!rawAddress) {
    return { line1: "", line2: "" };
  }

  let cleaned = rawAddress.trim();

  // Strip pincode suffix if present
  if (pincode && cleaned.endsWith(pincode)) {
    cleaned = cleaned.replace(new RegExp(`[-–,\\s]+${pincode}$`), "").trim();
  }

  // Strip state suffix if present
  if (state && cleaned.toLowerCase().endsWith(state.toLowerCase())) {
    cleaned = cleaned.substring(0, cleaned.length - state.length).replace(/[-–,\\s]+$/, "").trim();
  }

  // Strip city suffix if present
  if (city && cleaned.toLowerCase().endsWith(city.toLowerCase())) {
    cleaned = cleaned.substring(0, cleaned.length - city.length).replace(/[-–,\\s]+$/, "").trim();
  }

  const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return {
      line1: parts[0],
      line2: parts.slice(1).join(", "),
    };
  }

  return {
    line1: cleaned || rawAddress,
    line2: "",
  };
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  isOpen,
  onClose,
  vendor,
  primaryContact,
  userRole = "ADMIN",
  onSaved,
}) => {
  const [formData, setFormData] = useState<FormData>({
    vendor_name: "",
    vendor_type: "Fleet Owner",
    gstin: "",
    pan: "",
    website: "",
    status: "PENDING",
    contact_name: "",
    designation: "Authorized Transporter",
    email: "",
    mobile: "",
    address_line_1: "",
    address_line_2: "",
    pincode: "",
    city: "",
    state: "",
    declared_fleet_strength: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live Pincode lookup state
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<{
    type: "success" | "fallback";
    message: string;
  } | null>(null);

  // Populate data when modal opens or vendor prop changes
  useEffect(() => {
    if (!vendor) return;

    const parsed = parseAddressParts(
      vendor.address,
      vendor.city,
      vendor.state,
      vendor.pincode
    );

    // Auto-derive PAN from GSTIN if PAN is missing
    let initialPan = vendor.pan || "";
    if ((!initialPan || initialPan === "NOT_PROVIDED") && vendor.gstin && vendor.gstin.length >= 12) {
      const derived = vendor.gstin.substring(2, 12).toUpperCase();
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derived)) {
        initialPan = derived;
      }
    } else if (initialPan === "NOT_PROVIDED") {
      initialPan = "";
    }

    const contactPerson = primaryContact?.full_name || vendor.contact_name || "";
    const contactDesig = primaryContact?.designation || vendor.contact_designation || "Authorized Transporter";
    const contactEmail = primaryContact?.email || vendor.contact_email || "";
    const contactMobile = (
      primaryContact?.mobile ||
      vendor.contact_phone ||
      vendor.mobile ||
      ""
    ).replace(/\D/g, "").slice(-10);

    setFormData({
      vendor_name: vendor.vendor_name || "",
      vendor_type: vendor.vendor_type || "Fleet Owner",
      gstin: vendor.gstin || "",
      pan: initialPan,
      website: vendor.website || "",
      status: vendor.status || "PENDING",
      contact_name: contactPerson,
      designation: contactDesig,
      email: contactEmail,
      mobile: contactMobile,
      address_line_1: parsed.line1,
      address_line_2: parsed.line2,
      pincode: vendor.pincode || "",
      city: vendor.city || "",
      state: vendor.state || "",
      declared_fleet_strength: String(vendor.fleet_size || vendor.declared_fleet_strength || ""),
    });

    setErrors({});
    setSubmitError(null);
    setPincodeStatus(null);
  }, [vendor, primaryContact, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Handle live pincode lookup
  const handlePincodeChange = async (newPin: string) => {
    const sanitized = newPin.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: sanitized }));

    if (errors.pincode) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.pincode;
        return next;
      });
    }

    if (sanitized.length === 6) {
      setIsPincodeLoading(true);
      setPincodeStatus(null);
      try {
        const res = await pincodeService.fetchPincode(sanitized);
        if (res && res.city && res.state) {
          setFormData((prev) => ({
            ...prev,
            city: res.city,
            state: res.state,
          }));
          setPincodeStatus({
            type: "success",
            message: `Auto-resolved: ${res.city}, ${res.state}`,
          });
          setErrors((prev) => {
            const next = { ...prev };
            delete next.city;
            delete next.state;
            return next;
          });
        }
      } catch {
        setPincodeStatus({
          type: "fallback",
          message: "PIN lookup failed. Please specify City and State manually.",
        });
      } finally {
        setIsPincodeLoading(false);
      }
    } else {
      setPincodeStatus(null);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.vendor_name.trim()) {
      errs.vendor_name = "Business / Transporter legal name is required";
    }

    const panClean = formData.pan.trim().toUpperCase();
    if (panClean && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      errs.pan = "Invalid PAN format (must be 5 letters, 4 digits, 1 letter, e.g. AABCD1234F)";
    }

    const gstinClean = formData.gstin.trim().toUpperCase();
    if (gstinClean && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinClean)) {
      errs.gstin = "Invalid GSTIN format (e.g. 18AABCD1234F1Z5)";
    }

    if (!formData.contact_name.trim()) {
      errs.contact_name = "Primary contact person name is required";
    }

    const emailClean = formData.email.trim();
    if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      errs.email = "Please enter a valid official email address";
    }

    const mobileClean = formData.mobile.replace(/\D/g, "");
    if (!mobileClean) {
      errs.mobile = "Primary mobile number is required";
    } else if (mobileClean.length !== 10) {
      errs.mobile = "Mobile number must be exactly 10 digits";
    }

    if (!formData.address_line_1.trim()) {
      errs.address_line_1 = "Registered address line 1 is required";
    }

    if (!formData.city.trim()) {
      errs.city = "City is required";
    }

    if (!formData.state.trim()) {
      errs.state = "State is required";
    }

    const pinClean = formData.pincode.trim();
    if (pinClean && !/^\d{6}$/.test(pinClean)) {
      errs.pincode = "PIN code must be exactly 6 digits";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const mobileClean = formData.mobile.replace(/\D/g, "").slice(-10);
      const gstinClean = formData.gstin.trim().toUpperCase();
      const panClean = formData.pan.trim().toUpperCase();

      // Check duplicate mobile in vendor_users across other accounts
      const { data: existingUser } = await supabase
        .from("vendor_users")
        .select("id, vendor_id")
        .eq("mobile", mobileClean)
        .maybeSingle();

      if (
        existingUser &&
        existingUser.vendor_id !== vendor.id &&
        existingUser.id !== primaryContact?.id
      ) {
        setErrors((prev) => ({
          ...prev,
          mobile: "This mobile number is already registered for another vendor account.",
        }));
        setIsSubmitting(false);
        return;
      }

      // Format canonical full address string
      const fullAddressParts = [
        formData.address_line_1.trim(),
        formData.address_line_2.trim(),
        formData.city.trim(),
        `${formData.state.trim()}${formData.pincode.trim() ? " - " + formData.pincode.trim() : ""}`,
      ].filter(Boolean);
      const fullAddress = fullAddressParts.join(", ");

      // 1. Update vendor_companies preserving documents, verification status, and relationships
      const updatePayload: Record<string, any> = {
        vendor_name: formData.vendor_name.trim(),
        gstin: gstinClean || null,
        pan: panClean || null,
        address: fullAddress,
        updated_at: new Date().toISOString(),
      };

      if (formData.declared_fleet_strength.trim()) {
        updatePayload.fleet_size = formData.declared_fleet_strength.trim();
      }

      // If SUPER_ADMIN allows changing status directly
      if (userRole === "SUPER_ADMIN" && formData.status) {
        updatePayload.status = formData.status;
      }

      const { error: compErr } = await supabase
        .from("vendor_companies")
        .update(updatePayload)
        .eq("id", vendor.id);

      if (compErr) {
        throw new Error(`Failed to update vendor company: ${compErr.message}`);
      }

      // 2. Update or insert primary contact user in vendor_users
      if (primaryContact?.id) {
        const { error: userErr } = await supabase
          .from("vendor_users")
          .update({
            full_name: formData.contact_name.trim(),
            email: formData.email.trim() || null,
            mobile: mobileClean,
          })
          .eq("id", primaryContact.id);

        if (userErr) {
          throw new Error(`Failed to update primary contact: ${userErr.message}`);
        }
      } else if (formData.contact_name.trim() || mobileClean) {
        const { error: insertUserErr } = await supabase
          .from("vendor_users")
          .insert({
            vendor_id: vendor.id,
            full_name: formData.contact_name.trim() || formData.vendor_name.trim(),
            email: formData.email.trim() || null,
            mobile: mobileClean,
            status: "ACTIVE",
          });

        if (insertUserErr) {
          throw new Error(`Failed to save contact person: ${insertUserErr.message}`);
        }
      }

      // 3. Record audit trail
      try {
        await supabase.from("auth_audit_log").insert([
          {
            user_id: vendor.id,
            action: "VENDOR_UPDATED",
            details: {
              updated_fields: Object.keys(updatePayload),
              timestamp: new Date().toISOString(),
            },
          },
        ]);
      } catch {
        // Audit log fail should not block modal save
      }

      // 4. Trigger reload in parent page and close modal
      await onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error saving vendor details:", err);
      setSubmitError(err.message || "Failed to update vendor details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !vendor) return null;

  const displayCode = formatDisplayId("VD", vendor.vendor_code || vendor.id, vendor.created_at);

  return (
    <div
      className="edit-client-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-vendor-modal-title"
      id="edit-vendor-modal-overlay"
      style={{ zIndex: 99999 }}
    >
      <div className="edit-client-drawer-card" id="edit-vendor-drawer-panel" style={{ maxWidth: "680px" }}>
        {/* Sticky Header with Navigation Hierarchy Breadcrumb */}
        <div className="edit-client-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
          {/* Breadcrumb Hierarchy */}
          <div
            className="modal-breadcrumb-bar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#64748B",
              fontWeight: 500,
              width: "100%",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ cursor: "pointer", color: "#64748B" }}
              onClick={onClose}
              title="Return to Vendors"
            >
              Vendors
            </span>
            <span style={{ color: "#94A3B8" }}>›</span>
            <span
              style={{ cursor: "pointer", color: "#64748B" }}
              onClick={onClose}
              title="Return to Vendor Directory"
            >
              Vendor Directory
            </span>
            <span style={{ color: "#94A3B8" }}>›</span>
            <span
              style={{ cursor: "pointer", color: "#0F172A", fontWeight: 600 }}
              onClick={onClose}
              title={`Return to ${vendor.vendor_name}`}
            >
              {vendor.vendor_name}
            </span>
            <span style={{ color: "#94A3B8" }}>›</span>
            <span style={{ color: "#F05A22", fontWeight: 700 }}>Edit Vendor</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 className="edit-client-title" id="edit-vendor-modal-title">
                  Edit Vendor Details
                </h2>
                <span className="edit-client-id-badge" style={{ backgroundColor: "#FFF7ED", color: "#F05A22", border: "1px solid #FFEDD5" }}>
                  {displayCode}
                </span>
              </div>
              <p className="edit-client-subtitle">
                Modify business profile, verified contact person, and address for <strong>{vendor.vendor_name}</strong>
              </p>
            </div>

            <button
              type="button"
              className="edit-client-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close edit vendor modal"
              id="btn-close-edit-vendor-modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="edit-client-form-container">
          <div className="edit-client-body">
            {/* Global Error Banner */}
            {submitError && (
              <div className="edit-client-error-banner" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Section 1: Business Information */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <Building2 size={16} color="#F05A22" />
                <span>1. Business & Transporter Information</span>
              </h3>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-vendor-name">
                  Business / Transporter Legal Name <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="edit-vendor-name"
                  type="text"
                  className={`edit-client-input ${errors.vendor_name ? "input-has-error" : ""}`}
                  placeholder="e.g. Northeast Freight Express Pvt Ltd"
                  value={formData.vendor_name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, vendor_name: e.target.value }));
                    if (errors.vendor_name) setErrors((prev) => ({ ...prev, vendor_name: "" }));
                  }}
                  disabled={isSubmitting}
                />
                {errors.vendor_name && (
                  <span className="edit-client-error-text">{errors.vendor_name}</span>
                )}
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-vendor-type">
                    Vendor / Partner Type
                  </label>
                  <select
                    id="edit-vendor-type"
                    className="edit-client-select"
                    value={formData.vendor_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vendor_type: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    {VENDOR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-vendor-status">
                    Account Status {userRole === "SUPER_ADMIN" ? "(Super Admin Override)" : "(System Status)"}
                  </label>
                  <select
                    id="edit-vendor-status"
                    className="edit-client-select"
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={userRole !== "SUPER_ADMIN" || isSubmitting}
                  >
                    <option value="APPROVED">APPROVED (Verified)</option>
                    <option value="PENDING">PENDING (Review Queue)</option>
                    <option value="REJECTED">REJECTED (Declined)</option>
                    <option value="INACTIVE">INACTIVE (Deactivated)</option>
                    <option value="SUSPENDED">SUSPENDED (Restricted)</option>
                  </select>
                </div>
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-vendor-pan">
                    PAN Number
                  </label>
                  <input
                    id="edit-vendor-pan"
                    type="text"
                    maxLength={10}
                    className={`edit-client-input mono-font ${errors.pan ? "input-has-error" : ""}`}
                    placeholder="e.g. AABCD1234F"
                    value={formData.pan}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }));
                      if (errors.pan) setErrors((prev) => ({ ...prev, pan: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {errors.pan && (
                    <span className="edit-client-error-text">{errors.pan}</span>
                  )}
                  <span className="edit-client-hint">10 characters (5 letters, 4 numbers, 1 letter)</span>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-vendor-gstin">
                    GSTIN (Registration)
                  </label>
                  <input
                    id="edit-vendor-gstin"
                    type="text"
                    maxLength={15}
                    className={`edit-client-input mono-font ${errors.gstin ? "input-has-error" : ""}`}
                    placeholder="e.g. 18AABCD1234F1Z5"
                    value={formData.gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setFormData((prev) => {
                        const updated = { ...prev, gstin: val };
                        // Auto-populate PAN if PAN is empty
                        if (!prev.pan && val.length >= 12) {
                          const derived = val.substring(2, 12);
                          if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derived)) {
                            updated.pan = derived;
                          }
                        }
                        return updated;
                      });
                      if (errors.gstin) setErrors((prev) => ({ ...prev, gstin: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {errors.gstin && (
                    <span className="edit-client-error-text">{errors.gstin}</span>
                  )}
                  <span className="edit-client-hint">15 alphanumeric characters (State Code + PAN + Entity Code)</span>
                </div>
              </div>
            </div>

            {/* Section 2: Contact Information */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <User size={16} color="#F05A22" />
                <span>2. Authorized Contact Person</span>
              </h3>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-contact-name">
                    Contact Person Name <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    id="edit-contact-name"
                    type="text"
                    className={`edit-client-input ${errors.contact_name ? "input-has-error" : ""}`}
                    placeholder="e.g. Ramesh Chandra Sharma"
                    value={formData.contact_name}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, contact_name: e.target.value }));
                      if (errors.contact_name) setErrors((prev) => ({ ...prev, contact_name: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {errors.contact_name && (
                    <span className="edit-client-error-text">{errors.contact_name}</span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-contact-desig">
                    Designation / Role
                  </label>
                  <input
                    id="edit-contact-desig"
                    type="text"
                    className="edit-client-input"
                    placeholder="e.g. Fleet Manager / Proprietor"
                    value={formData.designation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-contact-mobile">
                    Primary Mobile Number (OTP Verified) <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{
                      backgroundColor: "#F1F5F9",
                      padding: "8px 12px",
                      border: "1px solid #CBD5E1",
                      borderRight: "none",
                      borderRadius: "6px 0 0 6px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#475569"
                    }}>
                      +91
                    </span>
                    <input
                      id="edit-contact-mobile"
                      type="tel"
                      maxLength={10}
                      className={`edit-client-input ${errors.mobile ? "input-has-error" : ""}`}
                      style={{ borderRadius: "0 6px 6px 0" }}
                      placeholder="9876543210"
                      value={formData.mobile}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, "") }));
                        if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: "" }));
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.mobile && (
                    <span className="edit-client-error-text">{errors.mobile}</span>
                  )}
                  <span className="edit-client-hint">Mobile used for vendor app login and dispatches</span>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-contact-email">
                    Official Email Address
                  </label>
                  <input
                    id="edit-contact-email"
                    type="email"
                    className={`edit-client-input ${errors.email ? "input-has-error" : ""}`}
                    placeholder="dispatch@northeastlogistics.in"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, email: e.target.value }));
                      if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <span className="edit-client-error-text">{errors.email}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Registered Address & Location */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <MapPin size={16} color="#F05A22" />
                <span>3. Registered Office & Operating Hub</span>
              </h3>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-address-1">
                  Street Address Line 1 <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="edit-address-1"
                  type="text"
                  className={`edit-client-input ${errors.address_line_1 ? "input-has-error" : ""}`}
                  placeholder="Plot No. 12, Transport Nagar, NH-37"
                  value={formData.address_line_1}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, address_line_1: e.target.value }));
                    if (errors.address_line_1) setErrors((prev) => ({ ...prev, address_line_1: "" }));
                  }}
                  disabled={isSubmitting}
                />
                {errors.address_line_1 && (
                  <span className="edit-client-error-text">{errors.address_line_1}</span>
                )}
              </div>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-address-2">
                  Address Line 2 (Landmark / Area)
                </label>
                <input
                  id="edit-address-2"
                  type="text"
                  className="edit-client-input"
                  placeholder="Near ISBT Terminal, Lokhra"
                  value={formData.address_line_2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address_line_2: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="edit-client-grid-3">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-pincode">
                    PIN Code {isPincodeLoading && <Loader size={12} className="spin-inline" />}
                  </label>
                  <input
                    id="edit-pincode"
                    type="text"
                    maxLength={6}
                    className={`edit-client-input mono-font ${errors.pincode ? "input-has-error" : ""}`}
                    placeholder="781034"
                    value={formData.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {errors.pincode && (
                    <span className="edit-client-error-text">{errors.pincode}</span>
                  )}
                  {pincodeStatus && (
                    <span style={{ fontSize: "11px", color: pincodeStatus.type === "success" ? "#16A34A" : "#D97706", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                      {pincodeStatus.type === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {pincodeStatus.message}
                    </span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-city">
                    City <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    id="edit-city"
                    type="text"
                    className={`edit-client-input ${errors.city ? "input-has-error" : ""}`}
                    placeholder="Guwahati"
                    value={formData.city}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, city: e.target.value }));
                      if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {errors.city && (
                    <span className="edit-client-error-text">{errors.city}</span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-state">
                    State <span className="req-star" style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <select
                    id="edit-state"
                    className={`edit-client-select ${errors.state ? "input-has-error" : ""}`}
                    value={formData.state}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, state: e.target.value }));
                      if (errors.state) setErrors((prev) => ({ ...prev, state: "" }));
                    }}
                    disabled={isSubmitting}
                  >
                    <option value="">Select State</option>
                    {ALL_INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <span className="edit-client-error-text">{errors.state}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Fleet Strength & Operating Info */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <Truck size={16} color="#F05A22" />
                <span>4. Declared Fleet Strength</span>
              </h3>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-fleet-size">
                  Declared Total Fleet Strength (Commercial Vehicles)
                </label>
                <input
                  id="edit-fleet-size"
                  type="text"
                  className="edit-client-input"
                  placeholder="e.g. 15 Commercial Vehicles"
                  value={formData.declared_fleet_strength}
                  onChange={(e) => setFormData((prev) => ({ ...prev, declared_fleet_strength: e.target.value }))}
                  disabled={isSubmitting}
                />
                <span className="edit-client-hint">
                  Total commercial vehicles declared by vendor. Detailed vehicle configurations and individually registered vehicles are managed in the Fleet tab.
                </span>
              </div>

              {/* Data Integrity Safeguard Box */}
              <div className="edit-client-safeguard-box" style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginTop: "12px"
              }}>
                <Shield size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5" }}>
                  <strong>Data Integrity Safeguard:</strong> Saving edits updates profile and contact details while safely preserving all uploaded KYC documents, individually registered vehicles, drivers, RFQs, and existing quotations.
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="edit-client-footer" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            backgroundColor: "#FFFFFF",
          }}>
            <button
              type="button"
              className="btn-edit-client-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-edit-client-save"
              disabled={isSubmitting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#F05A22",
                color: "#FFFFFF",
                fontWeight: 600,
                padding: "10px 20px",
                borderRadius: "6px",
                border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="spin-inline" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
