import React, { useState, useEffect } from "react";
import {
  X, Building2, User, Mail, Phone, MapPin, CheckCircle,
  AlertCircle, Loader, Save, Briefcase, FileText, Check
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { pincodeService } from "../../services/pincodeService";
import { formatDisplayId } from "../../utils/idGenerator";

export interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  primaryContact?: any;
  onSaved: () => Promise<void> | void;
}

export const CLIENT_TYPES = [
  "Private Limited",
  "Public Limited",
  "Partnership",
  "Proprietorship",
  "LLP",
  "Manufacturer",
  "Trader",
  "Distributor",
  "Exporter",
  "Importer",
  "Government",
  "Other",
];

export const INDUSTRY_TYPES = [
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
  "Tea & Plantation",
  "Paper & Packaging",
  "Other",
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
  company_name: string;
  client_type: string;
  industry_type: string;
  gstin: string;
  pan: string;

  contact_name: string;
  designation: string;
  email: string;
  mobile: string;
  company_phone: string;

  address_line_1: string;
  address_line_2: string;
  pincode: string;
  city: string;
  state: string;

  credit_window_days: string;
}

/**
 * Intelligent helper to extract street address components
 * from existing composite registered_address strings.
 */
function parseAddressParts(rawAddress?: string, city?: string, state?: string, pincode?: string) {
  if (!rawAddress) {
    return { line1: "", line2: "" };
  }

  let cleaned = rawAddress.trim();

  // Strip pincode suffix if present (e.g. " - 530001" or ", 530001")
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

export const EditClientModal: React.FC<EditClientModalProps> = ({
  isOpen,
  onClose,
  client,
  primaryContact,
  onSaved,
}) => {
  const [formData, setFormData] = useState<FormData>({
    company_name: "",
    client_type: "Private Limited",
    industry_type: "",
    gstin: "",
    pan: "",
    contact_name: "",
    designation: "",
    email: "",
    mobile: "",
    company_phone: "",
    address_line_1: "",
    address_line_2: "",
    pincode: "",
    city: "",
    state: "",
    credit_window_days: "30",
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

  // Populate data when modal opens or client prop changes
  useEffect(() => {
    if (!client) return;

    const parsed = parseAddressParts(
      client.registered_address,
      client.city,
      client.state,
      client.pincode
    );

    // Auto-derive PAN from GSTIN if PAN is missing
    let initialPan = client.pan || "";
    if (!initialPan && client.gstin && client.gstin.length >= 12) {
      const derived = client.gstin.substring(2, 12).toUpperCase();
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derived)) {
        initialPan = derived;
      }
    }

    const contactPerson = primaryContact?.full_name || client.primary_contact_name || "";
    const contactDesig = primaryContact?.designation || client.primary_contact_designation || "Authorized Contact";
    const contactEmail = primaryContact?.email || client.company_email || client.primary_contact_email || "";
    const contactMobile = (
      primaryContact?.mobile ||
      client.primary_contact_phone ||
      client.company_phone ||
      ""
    ).replace(/\D/g, "").slice(-10);

    setFormData({
      company_name: client.company_name || "",
      client_type: client.business_type || client.client_type || "Private Limited",
      industry_type: client.industry_type || "",
      gstin: client.gstin || "",
      pan: initialPan,
      contact_name: contactPerson,
      designation: contactDesig,
      email: contactEmail,
      mobile: contactMobile,
      company_phone: client.company_phone || "",
      address_line_1: parsed.line1,
      address_line_2: parsed.line2,
      pincode: client.pincode || "",
      city: client.city || "",
      state: client.state || "",
      credit_window_days: String(client.credit_window_days || "30"),
    });

    setErrors({});
    setSubmitError(null);
    setPincodeStatus(null);
  }, [client, primaryContact, isOpen]);

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

  if (!isOpen || !client) return null;

  // Handle GSTIN with automated PAN derivation
  const handleGstinChange = (value: string) => {
    const cleanGst = value.toUpperCase().trim().slice(0, 15);
    setFormData((prev) => {
      const next = { ...prev, gstin: cleanGst };
      if (cleanGst.length >= 12) {
        const derived = cleanGst.substring(2, 12);
        if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derived)) {
          if (!prev.pan || prev.pan === prev.gstin.substring(2, 12)) {
            next.pan = derived;
          }
        }
      }
      return next;
    });

    if (errors.gstin) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.gstin;
        return copy;
      });
    }
  };

  // Handle PIN code with automatic City & State resolution via Postal API
  const handlePincodeChange = async (value: string) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: pin }));

    if (errors.pincode) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.pincode;
        return copy;
      });
    }

    if (pin.length === 6) {
      setIsPincodeLoading(true);
      setPincodeStatus(null);
      try {
        const res = await pincodeService.lookupPincode(pin);
        if (res.success && res.data) {
          setFormData((prev) => ({
            ...prev,
            city: res.data!.city || prev.city,
            state: res.data!.state || prev.state,
          }));
          setPincodeStatus({
            type: "success",
            message: `Postal Circle Resolved: ${res.data.city}, ${res.data.state} (${res.data.source === "api" ? "India Post API" : "Logistics Hub Directory"})`,
          });
          setErrors((prev) => {
            const copy = { ...prev };
            delete copy.city;
            delete copy.state;
            return copy;
          });
        } else {
          setPincodeStatus({
            type: "fallback",
            message: res.error || "PIN code not found in postal directory. You can enter City and State manually.",
          });
        }
      } catch {
        setPincodeStatus({
          type: "fallback",
          message: "Postal service lookup timed out. You can enter City and State manually.",
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

    if (!formData.company_name.trim()) {
      errs.company_name = "Company legal name is required";
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
    if (!emailClean) {
      errs.email = "Official email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
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
    if (!pinClean) {
      errs.pincode = "PIN code is required";
    } else if (!/^\d{6}$/.test(pinClean)) {
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

      // Check duplicate mobile in client_users across other accounts
      const { data: existingUser } = await supabase
        .from("client_users")
        .select("id, client_id")
        .eq("mobile", mobileClean)
        .maybeSingle();

      if (
        existingUser &&
        existingUser.client_id !== client.id &&
        existingUser.id !== primaryContact?.id
      ) {
        setErrors((prev) => ({
          ...prev,
          mobile: "This mobile number is already registered for another client account.",
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

      // 1. Update client_companies without modifying client_code, status, or timestamps
      const { error: compErr } = await supabase
        .from("client_companies")
        .update({
          company_name: formData.company_name.trim(),
          business_type: formData.client_type,
          industry_type: formData.industry_type || null,
          gstin: gstinClean || null,
          pan: panClean || null,
          registered_address: fullAddress,
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
          company_email: formData.email.trim(),
          company_phone: `+91 ${mobileClean}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (compErr) {
        throw new Error(`Failed to update client company: ${compErr.message}`);
      }

      // 2. Update or insert primary contact user in client_users
      if (primaryContact?.id) {
        const { error: userErr } = await supabase
          .from("client_users")
          .update({
            full_name: formData.contact_name.trim(),
            designation: formData.designation.trim() || "Authorized Contact",
            email: formData.email.trim(),
            mobile: mobileClean,
          })
          .eq("id", primaryContact.id);

        if (userErr) {
          throw new Error(`Failed to update primary contact: ${userErr.message}`);
        }
      } else if (formData.contact_name.trim() || mobileClean) {
        const { error: insertUserErr } = await supabase
          .from("client_users")
          .insert({
            client_id: client.id,
            client_company_id: client.id,
            full_name: formData.contact_name.trim() || formData.company_name.trim(),
            designation: formData.designation.trim() || "Authorized Contact",
            email: formData.email.trim() || null,
            mobile: mobileClean,
            status: "ACTIVE",
            phone_verified: true,
            is_primary_contact: true,
            created_at: new Date().toISOString(),
          });

        if (insertUserErr) {
          throw new Error(`Failed to save contact person: ${insertUserErr.message}`);
        }
      }

      // 3. Trigger reload in parent page and close modal
      await onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error saving client details:", err);
      setSubmitError(err.message || "Failed to update client details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayCode = formatDisplayId("CL", client.client_code || client.id, client.created_at);

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
      aria-labelledby="edit-client-modal-title"
      id="edit-client-modal-overlay"
    >
      <div className="edit-client-drawer-card" id="edit-client-drawer-panel">
        {/* Sticky Header */}
        <div className="edit-client-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 className="edit-client-title" id="edit-client-modal-title">
                Edit Client Details
              </h2>
              <span className="edit-client-id-badge">
                {displayCode}
              </span>
            </div>
            <p className="edit-client-subtitle">
              Modify corporate profile, contact person, and address for <strong>{client.company_name}</strong>
            </p>
          </div>

          <button
            type="button"
            className="edit-client-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close edit client modal"
            id="btn-close-edit-client-modal"
          >
            <X size={20} />
          </button>
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

            {/* Section 1: Organization & Business Details */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <Building2 size={16} color="#F05A22" />
                <span>1. Company & Business Entity</span>
              </h3>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-company-name">
                  Company Legal Name <span className="req-star">*</span>
                </label>
                <input
                  id="edit-company-name"
                  type="text"
                  required
                  className={`edit-client-input ${errors.company_name ? "input-has-error" : ""}`}
                  placeholder="e.g. Acme Logistics India Pvt Ltd"
                  value={formData.company_name}
                  onChange={(e) => {
                    setFormData({ ...formData, company_name: e.target.value });
                    if (errors.company_name) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.company_name;
                        return copy;
                      });
                    }
                  }}
                />
                {errors.company_name && (
                  <span className="edit-client-error-text">
                    <AlertCircle size={12} /> {errors.company_name}
                  </span>
                )}
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-business-type">
                    Entity / Business Type <span className="req-star">*</span>
                  </label>
                  <select
                    id="edit-business-type"
                    className="edit-client-select"
                    value={formData.client_type}
                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                  >
                    {CLIENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-industry-type">
                    Industry Sector
                  </label>
                  <select
                    id="edit-industry-type"
                    className="edit-client-select"
                    value={formData.industry_type}
                    onChange={(e) => setFormData({ ...formData, industry_type: e.target.value })}
                  >
                    <option value="">Select industry sector...</option>
                    {INDUSTRY_TYPES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-gstin">
                    GSTIN (15 Digits)
                  </label>
                  <input
                    id="edit-gstin"
                    type="text"
                    maxLength={15}
                    className={`edit-client-input mono-font ${errors.gstin ? "input-has-error" : ""}`}
                    placeholder="e.g. 18AABCD1234F1Z5"
                    value={formData.gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                  />
                  {errors.gstin && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.gstin}
                    </span>
                  )}
                  <span className="edit-client-hint">Auto-populates Company PAN</span>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-pan">
                    Company PAN Number (10 Digits)
                  </label>
                  <input
                    id="edit-pan"
                    type="text"
                    maxLength={10}
                    className={`edit-client-input mono-font ${errors.pan ? "input-has-error" : ""}`}
                    placeholder="e.g. AABCD1234F"
                    value={formData.pan}
                    onChange={(e) => {
                      const cleanPan = e.target.value.toUpperCase().trim().slice(0, 10);
                      setFormData({ ...formData, pan: cleanPan });
                      if (errors.pan) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.pan;
                          return copy;
                        });
                      }
                    }}
                  />
                  {errors.pan && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.pan}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Primary Contact Person */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <User size={16} color="#F05A22" />
                <span>2. Primary Contact Person</span>
              </h3>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-contact-name">
                    Contact Person Name <span className="req-star">*</span>
                  </label>
                  <input
                    id="edit-contact-name"
                    type="text"
                    required
                    className={`edit-client-input ${errors.contact_name ? "input-has-error" : ""}`}
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.contact_name}
                    onChange={(e) => {
                      setFormData({ ...formData, contact_name: e.target.value });
                      if (errors.contact_name) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.contact_name;
                          return copy;
                        });
                      }
                    }}
                  />
                  {errors.contact_name && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.contact_name}
                    </span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-designation">
                    Designation / Role
                  </label>
                  <input
                    id="edit-designation"
                    type="text"
                    className="edit-client-input"
                    placeholder="e.g. Logistics Manager / Director"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-email">
                    Official Email Address <span className="req-star">*</span>
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    required
                    className={`edit-client-input ${errors.email ? "input-has-error" : ""}`}
                    placeholder="e.g. rajesh@company.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.email;
                          return copy;
                        });
                      }
                    }}
                  />
                  {errors.email && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.email}
                    </span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-mobile">
                    Primary Mobile Number (10 Digits) <span className="req-star">*</span>
                  </label>
                  <div className="mobile-input-wrapper">
                    <span className="mobile-prefix">+91</span>
                    <input
                      id="edit-mobile"
                      type="tel"
                      required
                      maxLength={10}
                      className={`edit-client-input mobile-input ${errors.mobile ? "input-has-error" : ""}`}
                      placeholder="9876543210"
                      value={formData.mobile}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setFormData({ ...formData, mobile: num });
                        if (errors.mobile) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.mobile;
                            return copy;
                          });
                        }
                      }}
                    />
                  </div>
                  {errors.mobile && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.mobile}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Registered Office Address */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <MapPin size={16} color="#F05A22" />
                <span>3. Registered Office Address</span>
              </h3>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-address-1">
                  Street Address / Premise / Line 1 <span className="req-star">*</span>
                </label>
                <input
                  id="edit-address-1"
                  type="text"
                  required
                  className={`edit-client-input ${errors.address_line_1 ? "input-has-error" : ""}`}
                  placeholder="e.g. Plot No 42, Industrial Development Area"
                  value={formData.address_line_1}
                  onChange={(e) => {
                    setFormData({ ...formData, address_line_1: e.target.value });
                    if (errors.address_line_1) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.address_line_1;
                        return copy;
                      });
                    }
                  }}
                />
                {errors.address_line_1 && (
                  <span className="edit-client-error-text">
                    <AlertCircle size={12} /> {errors.address_line_1}
                  </span>
                )}
              </div>

              <div className="edit-client-field full-width">
                <label className="edit-client-label" htmlFor="edit-address-2">
                  Address Line 2 / Landmark / Suite (Optional)
                </label>
                <input
                  id="edit-address-2"
                  type="text"
                  className="edit-client-input"
                  placeholder="e.g. Near Container Freight Station, Phase 2"
                  value={formData.address_line_2}
                  onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
                />
              </div>

              <div className="edit-client-grid-3">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-pincode">
                    PIN Code (6 Digits) <span className="req-star">*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="edit-pincode"
                      type="text"
                      required
                      maxLength={6}
                      className={`edit-client-input ${errors.pincode ? "input-has-error" : ""}`}
                      placeholder="e.g. 781001"
                      value={formData.pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                    />
                    {isPincodeLoading && (
                      <span className="pincode-inline-loader">
                        <Loader size={14} className="spin-icon" color="#F05A22" />
                      </span>
                    )}
                  </div>
                  {errors.pincode && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.pincode}
                    </span>
                  )}
                  {pincodeStatus && (
                    <div
                      className={`pincode-status-badge ${pincodeStatus.type}`}
                      style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {pincodeStatus.type === "success" ? (
                        <Check size={12} />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      <span>{pincodeStatus.message}</span>
                    </div>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-city">
                    City <span className="req-star">*</span>
                  </label>
                  <input
                    id="edit-city"
                    type="text"
                    required
                    className={`edit-client-input ${errors.city ? "input-has-error" : ""}`}
                    placeholder="e.g. Guwahati"
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      if (errors.city) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.city;
                          return copy;
                        });
                      }
                    }}
                  />
                  {errors.city && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.city}
                    </span>
                  )}
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-state">
                    State / Union Territory <span className="req-star">*</span>
                  </label>
                  <select
                    id="edit-state"
                    className={`edit-client-select ${errors.state ? "input-has-error" : ""}`}
                    value={formData.state}
                    onChange={(e) => {
                      setFormData({ ...formData, state: e.target.value });
                      if (errors.state) {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.state;
                          return copy;
                        });
                      }
                    }}
                  >
                    <option value="">Select state...</option>
                    {ALL_INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.state && (
                    <span className="edit-client-error-text">
                      <AlertCircle size={12} /> {errors.state}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Commercial & Registration Safeguards */}
            <div className="edit-client-section">
              <h3 className="edit-client-section-title">
                <FileText size={16} color="#F05A22" />
                <span>4. Commercial Safeguards & Status</span>
              </h3>

              <div className="edit-client-grid-2">
                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-credit-window">
                    Credit Period / Payment Terms (Days)
                  </label>
                  <input
                    id="edit-credit-window"
                    type="number"
                    min="0"
                    max="180"
                    className="edit-client-input"
                    value={formData.credit_window_days}
                    onChange={(e) => setFormData({ ...formData, credit_window_days: e.target.value })}
                  />
                  <span className="edit-client-hint">Standard billing credit term window</span>
                </div>

                <div className="edit-client-field">
                  <label className="edit-client-label" htmlFor="edit-company-phone">
                    Secondary Office Phone (Optional)
                  </label>
                  <input
                    id="edit-company-phone"
                    type="tel"
                    className="edit-client-input"
                    placeholder="e.g. +91 361 2456789"
                    value={formData.company_phone}
                    onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Status and Registration Safeguard Card */}
              <div className="edit-client-safeguard-box">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={15} color="#166534" />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#166534" }}>
                    Account Status & Identification Integrity
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  Client Reference ID (<strong>{displayCode}</strong>), registration history, and approval status (<strong>{client.status || "PENDING"}</strong>) are protected and preserved. Saving edits updates information without disrupting existing booking histories, invoices, or compliance documents.
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="edit-client-footer">
            <button
              type="button"
              className="btn-edit-client-cancel"
              onClick={onClose}
              disabled={isSubmitting}
              id="btn-cancel-edit-client"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-edit-client-save"
              disabled={isSubmitting}
              id="btn-save-client-changes"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="spin-icon" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Client Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
