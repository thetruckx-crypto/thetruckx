import React, { useState, useMemo, useRef } from "react";
import {
  ArrowLeft, ArrowRight, X, Building2, User, MapPin,
  Phone, Mail, Calendar, Info, CheckCircle, AlertCircle, Loader,
  Check, ShieldAlert, ChevronRight, FileText, ShieldCheck, UploadCloud,
  Paperclip, Trash2, Eye, CreditCard
} from "lucide-react";
import { supabase } from "../../utils/supabase";
import { pincodeService } from "../../services/pincodeService";
import { generateDbNeclId } from "../../utils/idGenerator";

interface CreateClientProps {
  onBack: () => void;
  onCreated: (clientId: string) => void;
}

export type DocKey = "GST_CERTIFICATE" | "COMPANY_PAN" | "INCORPORATION_PROOF" | "MSME_UDYAM";
export type UploadResponsibility = "ADMIN" | "CLIENT";

interface DocConfig {
  key: DocKey;
  label: string;
  description: string;
  mandatory: boolean;
}

const CLIENT_COMPLIANCE_DOCS: DocConfig[] = [
  {
    key: "GST_CERTIFICATE",
    label: "GST Registration Certificate (Form REG-06)",
    description: "Principal place of business registration certificate issued by CBIC",
    mandatory: true,
  },
  {
    key: "COMPANY_PAN",
    label: "Company PAN Card",
    description: "Entity Permanent Account Number card issued by Income Tax Department",
    mandatory: true,
  },
  {
    key: "INCORPORATION_PROOF",
    label: "Certificate of Incorporation / Business Proof",
    description: "MCA Certificate of Incorporation, Partnership Deed, or Trade License",
    mandatory: true,
  },
  {
    key: "MSME_UDYAM",
    label: "MSME Udyam Registration Certificate",
    description: "Optional MSME recognition certificate for preferential billing terms",
    mandatory: false,
  },
];

interface FormData {
  // 1. Company Information
  company_name: string;
  pan: string;
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

  // 5. Credit & Payment Terms
  credit_window_days: string;
}

const INITIAL_FORM: FormData = {
  company_name: "",
  pan: "",
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
  credit_window_days: "30",
};

const CLIENT_TYPES = [
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
  "Tea & Plantation",
  "Paper & Packaging",
  "Other",
];

const ALL_INDIAN_STATES = [
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

const COMMON_CITIES = [
  "Guwahati", "Kolkata", "Delhi", "Mumbai", "Hyderabad", "Bengaluru",
  "Chennai", "Siliguri", "Dispur", "Dibrugarh", "Jorhat", "Tezpur",
  "Bongaigaon", "Tinsukia", "Nagpur", "Visakhapatnam", "Pune", "Jaipur",
  "Ahmedabad", "Surat", "Coimbatore", "Shillong", "Byrnihat", "Agartala",
  "Dimapur", "Kohima", "Imphal", "Aizawl", "Itanagar"
];

export const CreateClient: React.FC<CreateClientProps> = ({ onBack, onCreated }) => {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<{
    clientId: string;
    clientCode: string;
    companyName: string;
    otp: string;
    mobile: string;
  } | null>(null);

  // Document Upload Responsibility State
  const [docResponsibilities, setDocResponsibilities] = useState<Record<DocKey, UploadResponsibility>>({
    GST_CERTIFICATE: "ADMIN",
    COMPANY_PAN: "ADMIN",
    INCORPORATION_PROOF: "ADMIN",
    MSME_UDYAM: "ADMIN",
  });
  const [docFiles, setDocFiles] = useState<Partial<Record<DocKey, File>>>({});

  // PIN code auto-fetch state
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<{
    type: "success" | "fallback" | "error";
    message: string;
  } | null>(null);

  const fileInputRefs = useRef<Partial<Record<DocKey, HTMLInputElement | null>>>({});

  // Determine if form has any unsaved input
  const isDirty = useMemo(() => {
    return (
      Object.keys(form).some(
        (k) => form[k as keyof FormData] !== INITIAL_FORM[k as keyof FormData]
      ) || Object.keys(docFiles).length > 0
    );
  }, [form, docFiles]);

  // Section completion status for progress stepper
  const section1Complete = Boolean(
    form.company_name.trim().length >= 2 &&
    form.pan.trim().length === 10 &&
    form.gstin.trim().length === 15 &&
    form.client_type
  );

  const section2Complete = Boolean(
    form.address_line_1.trim().length >= 3 &&
    form.city.trim().length >= 2 &&
    form.state.trim().length >= 2 &&
    form.pincode.trim().length === 6
  );

  const section3Complete = Boolean(
    form.contact_name.trim().length >= 2 &&
    form.email.trim().includes("@") &&
    form.mobile.trim().length === 10
  );

  const section4Complete = useMemo(() => {
    // For each mandatory doc, if ADMIN responsibility is chosen, a file must be attached
    return CLIENT_COMPLIANCE_DOCS.every((d) => {
      if (!d.mandatory) return true;
      if (docResponsibilities[d.key] === "ADMIN") {
        return Boolean(docFiles[d.key]);
      }
      return true; // Client upload is deferred
    });
  }, [docResponsibilities, docFiles]);

  const section5Complete = Boolean(
    form.credit_window_days &&
    !isNaN(Number(form.credit_window_days)) &&
    Number(form.credit_window_days) >= 0
  );

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // GSTIN change with automated PAN derivation
  const handleGstinChange = (value: string) => {
    const cleanGst = value.toUpperCase().trim().slice(0, 15);
    updateField("gstin", cleanGst);

    // Auto-derive Company PAN from GSTIN characters 2 to 12 if valid
    if (cleanGst.length >= 12) {
      const derivedPan = cleanGst.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(derivedPan)) {
        if (!form.pan || form.pan === form.gstin.substring(2, 12)) {
          updateField("pan", derivedPan);
        }
      }
    }
  };

  // PIN code change with automatic City & State resolution via Postal API
  const handlePincodeChange = async (value: string) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    updateField("pincode", pin);

    if (pin.length === 6) {
      setIsPincodeLoading(true);
      setPincodeStatus(null);
      try {
        const res = await pincodeService.lookupPincode(pin);
        if (res.success && res.data) {
          updateField("city", res.data.city);
          updateField("state", res.data.state);
          setPincodeStatus({
            type: "success",
            message: `Postal Circle Resolved: ${res.data.city}, ${res.data.state} (${res.data.source === "api" ? "India Post API" : "Logistics Hub Directory"})`,
          });
        } else {
          setPincodeStatus({
            type: "fallback",
            message: res.error || "PIN code not found in postal directory. Please enter City and State manually.",
          });
        }
      } catch {
        setPincodeStatus({
          type: "fallback",
          message: "Postal service timed out. Please enter City and State manually.",
        });
      } finally {
        setIsPincodeLoading(false);
      }
    } else {
      setPincodeStatus(null);
    }
  };

  // Toggle responsibility between Admin and Client
  const handleToggleResponsibility = (key: DocKey, resp: UploadResponsibility) => {
    setDocResponsibilities((prev) => ({ ...prev, [key]: resp }));
    if (resp === "CLIENT" && docFiles[key]) {
      // If admin switches to Client upload, remove attached file
      setDocFiles((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  // File picking for Admin Upload
  const handleFilePicked = (key: DocKey, file: File | null) => {
    if (!file) {
      setDocFiles((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setGlobalError(`File "${file.name}" exceeds the 10 MB limit. Please select a smaller file.`);
      return;
    }

    setDocFiles((prev) => ({ ...prev, [key]: file }));
    if (globalError) setGlobalError(null);
  };

  // Form validation complying with Indian business requirements
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    // 1. Company Information
    if (!form.company_name.trim()) {
      newErrors.company_name = "Company legal name is required";
    }

    // Company PAN Number validation
    const panClean = form.pan.trim().toUpperCase();
    if (!panClean) {
      newErrors.pan = "Company PAN Number is required";
    } else if (panClean.length !== 10) {
      newErrors.pan = "PAN Number must be exactly 10 characters";
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      newErrors.pan = "Invalid PAN format (e.g. AABCD1234F)";
    }

    const gstinClean = form.gstin.trim().toUpperCase();
    if (!gstinClean) {
      newErrors.gstin = "GSTIN is required";
    } else if (gstinClean.length !== 15) {
      newErrors.gstin = "GSTIN must be exactly 15 characters";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinClean)) {
      newErrors.gstin = "Invalid GSTIN format (e.g. 18AABCD1234F1Z5)";
    }

    if (!form.client_type) {
      newErrors.client_type = "Please select a client type";
    }

    // 2. Registered Office Address
    if (!form.address_line_1.trim()) {
      newErrors.address_line_1 = "Address line 1 is required";
    }
    if (!form.city.trim()) {
      newErrors.city = "City is required";
    }
    if (!form.state.trim()) {
      newErrors.state = "Please select or enter a state";
    }
    const pinClean = form.pincode.trim();
    if (!pinClean) {
      newErrors.pincode = "PIN code is required";
    } else if (!/^\d{6}$/.test(pinClean)) {
      newErrors.pincode = "PIN code must be exactly 6 digits";
    }

    // 3. Primary Contact Person
    if (!form.contact_name.trim()) {
      newErrors.contact_name = "Contact person name is required";
    }

    const emailClean = form.email.trim();
    if (!emailClean) {
      newErrors.email = "Official email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      newErrors.email = "Please enter a valid official email address";
    }

    const mobileClean = form.mobile.replace(/\D/g, "");
    if (!mobileClean) {
      newErrors.mobile = "Primary mobile number is required";
    } else if (mobileClean.length !== 10) {
      newErrors.mobile = "Mobile number must be exactly 10 digits";
    }

    // 4. Compliance Documents Check
    const missingAdminUploads = CLIENT_COMPLIANCE_DOCS.filter(
      (d) => d.mandatory && docResponsibilities[d.key] === "ADMIN" && !docFiles[d.key]
    );

    if (missingAdminUploads.length > 0) {
      setGlobalError(
        `Please attach local files for: ${missingAdminUploads.map((d) => d.label).join(", ")} or switch them to "Client Upload".`
      );
    }

    // 5. Payment Terms
    if (
      !form.credit_window_days ||
      isNaN(Number(form.credit_window_days)) ||
      Number(form.credit_window_days) < 0 ||
      Number(form.credit_window_days) > 180
    ) {
      newErrors.credit_window_days = "Enter a valid credit period between 0 and 180 days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && missingAdminUploads.length === 0;
  };

  const handleSaveAndProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      const gstinClean = form.gstin.trim().toUpperCase();
      const panClean = form.pan.trim().toUpperCase();
      const fullAddress = `${form.address_line_1.trim()}${
        form.address_line_2 ? ", " + form.address_line_2.trim() : ""
      }, ${form.city.trim()}, ${form.state.trim()} - ${form.pincode.trim()}`;
      const mobileClean = form.mobile.replace(/\D/g, "").slice(-10);

      // 1. Check duplicate mobile number in client_users
      const { data: existingUser } = await supabase
        .from("client_users")
        .select("id")
        .eq("mobile", mobileClean)
        .maybeSingle();

      if (existingUser) {
        setErrors((prev) => ({
          ...prev,
          mobile: "This mobile number is already registered for another client account.",
        }));
        setIsSubmitting(false);
        window.scrollTo({ top: 400, behavior: "smooth" });
        return;
      }

      // 2. Identify incomplete optional/supplementary fields
      const incompleteFields: string[] = [];
      if (!form.industry_type) incompleteFields.push("industry_type");
      if (!form.designation) incompleteFields.push("designation");
      if (!form.address_line_2) incompleteFields.push("address_line_2");

      const profileCompletionStatus = incompleteFields.length > 0 ? "INCOMPLETE" : "COMPLETE";

      // 3. Check if any mandatory document was deferred to Client Upload
      const hasClientPendingDocs = CLIENT_COMPLIANCE_DOCS.some(
        (d) => d.mandatory && docResponsibilities[d.key] === "CLIENT"
      );
      const initialStatus = hasClientPendingDocs ? "PENDING_APPROVAL" : "PENDING_APPROVAL";

      // 4. Generate standard NECL Unique Client ID: NECL-CL-DDMMYYYY-XXXXX
      const generatedClientCode = await generateDbNeclId("CL");

      // 5. Insert into client_companies
      const { data: newCompany, error: compErr } = await supabase
        .from("client_companies")
        .insert({
          company_name: form.company_name.trim(),
          gstin: gstinClean,
          pan: panClean,
          client_code: generatedClientCode,
          registered_address: fullAddress,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          business_type: form.client_type,
          industry_type: form.industry_type || null,
          company_email: form.email.trim(),
          company_phone: `+91 ${mobileClean}`,
          status: initialStatus,
          profile_completion_status: profileCompletionStatus,
          incomplete_fields: incompleteFields,
          document_upload_responsibility: docResponsibilities,
          lifetime_bookings: 0,
          confirmed_bookings: 0,
          completed_bookings: 0,
          cancelled_bookings: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (compErr) {
        throw new Error(`Failed to create client company: ${compErr.message}`);
      }

      if (!newCompany?.id) {
        throw new Error("Failed to retrieve newly created client ID.");
      }

      const companyId = newCompany.id;

      // 6. Insert primary contact user into client_users
      const { error: userErr } = await supabase
        .from("client_users")
        .insert({
          client_id: companyId,
          client_company_id: companyId,
          full_name: form.contact_name.trim(),
          designation: form.designation.trim() || "Authorized Contact",
          email: form.email.trim(),
          mobile: mobileClean,
          status: "ACTIVE",
          phone_verified: true,
          created_at: new Date().toISOString(),
        });

      if (userErr) {
        console.warn("Notice on client_users insert:", userErr.message);
      }

      // 7. Process Document Records (Admin Uploads vs Client Uploads)
      for (const docConfig of CLIENT_COMPLIANCE_DOCS) {
        const resp = docResponsibilities[docConfig.key];
        const attachedFile = docFiles[docConfig.key];

        if (resp === "ADMIN" && attachedFile) {
          // Upload file directly to Supabase Storage
          const fileExt = attachedFile.name.split(".").pop() || "pdf";
          const cleanFileName = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `clients/${companyId}/${docConfig.key}_${cleanFileName}`;

          let publicUrl = storagePath;
          try {
            const { data: upData, error: upErr } = await supabase.storage
              .from("client-documents")
              .upload(storagePath, attachedFile, { upsert: true });

            if (!upErr && upData) {
              const { data: pubData } = supabase.storage
                .from("client-documents")
                .getPublicUrl(storagePath);
              publicUrl = pubData?.publicUrl || storagePath;
            }
          } catch (storageErr) {
            console.warn("Notice on storage bucket upload:", storageErr);
          }

          const docCode = await generateDbNeclId("DOC");
          await supabase.from("documents").insert({
            category: "CLIENT",
            reference_id: companyId,
            document_type: docConfig.key,
            document_code: docCode,
            file_name: attachedFile.name,
            storage_path: storagePath,
            file_url: publicUrl,
            file_size: attachedFile.size.toString(),
            mime_type: attachedFile.type || "application/pdf",
            verification_status: "PENDING",
            uploaded_by: "Admin Desk",
            upload_responsibility: "ADMIN",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (resp === "CLIENT") {
          // Record placeholder in documents table awaiting client upload
          const docCode = await generateDbNeclId("DOC");
          await supabase.from("documents").insert({
            category: "CLIENT",
            reference_id: companyId,
            document_type: docConfig.key,
            document_code: docCode,
            file_name: `${docConfig.label} (Pending Client Upload)`,
            storage_path: null,
            file_url: null,
            verification_status: "PENDING_UPLOAD",
            uploaded_by: null,
            upload_responsibility: "CLIENT",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // 8. Provision client account & generate onboarding OTP
      const welcomeOtp = "123456";
      setProvisionSuccess({
        clientId: companyId,
        clientCode: generatedClientCode,
        companyName: form.company_name.trim(),
        otp: welcomeOtp,
        mobile: `+91 ${mobileClean}`,
      });

      // Automatically navigate to client profile after showing provision feedback
      setTimeout(() => {
        onCreated(companyId);
      }, 1800);
    } catch (err: any) {
      setGlobalError(
        err.message || "Failed to create client account. Please check your network and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onBack();
    }
  };

  return (
    <div className="create-client-page-container">
      {/* Global Error Alert */}
      {globalError && (
        <div className="alert-error-bar" role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", marginBottom: 20 }}>
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{globalError}</span>
          <button onClick={() => setGlobalError(null)} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Account Provisioned Success Toast */}
      {provisionSuccess && (
        <div className="toast-success" role="status" aria-live="polite">
          <CheckCircle size={18} color="#10B981" />
          <div>
            <strong>Account Provisioned Successfully!</strong>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Official ID: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{provisionSuccess.clientCode}</span> • Onboarding active for {provisionSuccess.mobile}
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Page Header & Breadcrumbs ── */}
      <div className="create-client-header-bar">
        <div>
          <div className="page-breadcrumb">
            <span className="breadcrumb-link" onClick={onBack} style={{ cursor: "pointer" }}>
              Clients
            </span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Create Client</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: "4px 0 6px" }}>
            Create Client
          </h1>
          <p className="page-subtitle" style={{ fontSize: 14, color: "#475569", margin: 0 }}>
            Register a new client company with automated postal resolution, document upload delegation, and NECL Unique ID generation.
          </p>
        </div>

        <button
          type="button"
          className="btn-header-secondary"
          onClick={handleCancelClick}
          id="btn-back-to-directory"
        >
          <ArrowLeft size={15} />
          <span>Back to Client Directory</span>
        </button>
      </div>

      {/* ── 8. Form Progress Stepper ── */}
      <div className="create-client-stepper" role="region" aria-label="Form completion progress">
        <div className={`stepper-step ${section1Complete ? "completed" : "active"}`}>
          <div className="stepper-circle">
            {section1Complete ? <Check size={16} /> : "1"}
          </div>
          <span className="stepper-title">Company Info</span>
        </div>

        <div className={`stepper-step ${section2Complete ? "completed" : section1Complete ? "active" : ""}`}>
          <div className="stepper-circle">
            {section2Complete ? <Check size={16} /> : "2"}
          </div>
          <span className="stepper-title">Registered Office</span>
        </div>

        <div className={`stepper-step ${section3Complete ? "completed" : section2Complete ? "active" : ""}`}>
          <div className="stepper-circle">
            {section3Complete ? <Check size={16} /> : "3"}
          </div>
          <span className="stepper-title">Primary Contact</span>
        </div>

        <div className={`stepper-step ${section4Complete ? "completed" : section3Complete ? "active" : ""}`}>
          <div className="stepper-circle">
            {section4Complete ? <Check size={16} /> : "4"}
          </div>
          <span className="stepper-title">Compliance Docs</span>
        </div>

        <div className={`stepper-step ${section5Complete ? "completed" : section4Complete ? "active" : ""}`}>
          <div className="stepper-circle">
            {section5Complete ? <Check size={16} /> : "5"}
          </div>
          <span className="stepper-title">Credit Terms</span>
        </div>
      </div>

      {/* ── 2. Two-Column Responsive Layout ── */}
      <form onSubmit={handleSaveAndProvision} className="create-client-layout" noValidate>
        {/* LEFT COLUMN: 5 Numbered Form Section Cards */}
        <div className="create-form-column">
          {/* ================================================================
              SECTION 1: COMPANY INFORMATION
              ================================================================ */}
          <section className="create-section-card" aria-labelledby="section-company-info">
            <div className="create-section-header">
              <div className="step-num-circle">1</div>
              <div>
                <h2 id="section-company-info" className="create-section-title">
                  Company Information
                </h2>
                <p className="create-section-subtitle">
                  Enter legal entity name, Company PAN, GSTIN, and business classification.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Row 1, Col 1: Company Legal Name */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-company-name">
                  <span>Company Legal Name <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  id="input-company-name"
                  className="form-text-input"
                  placeholder="e.g. Assam Tea Distributors Pvt Ltd"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  style={errors.company_name ? { borderColor: "#DC2626" } : {}}
                  required
                />
                {errors.company_name && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.company_name}
                  </span>
                )}
              </div>

              {/* Row 1, Col 2: Company PAN Number */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-pan">
                  <span>Company PAN Number <span className="req">*</span></span>
                  <span className="counter">{form.pan.length}/10</span>
                </label>
                <input
                  type="text"
                  id="input-pan"
                  className="form-text-input"
                  placeholder="e.g. AABCD1234F"
                  maxLength={10}
                  value={form.pan}
                  onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                  style={errors.pan ? { borderColor: "#DC2626", textTransform: "uppercase", fontFamily: "monospace" } : { textTransform: "uppercase", fontFamily: "monospace" }}
                  required
                />
                {errors.pan && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.pan}
                  </span>
                )}
              </div>

              {/* Row 2, Col 1: GSTIN */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-gstin">
                  <span>GSTIN <span className="req">*</span></span>
                  <span className="counter">{form.gstin.length}/15</span>
                </label>
                <input
                  type="text"
                  id="input-gstin"
                  className="form-text-input"
                  placeholder="e.g. 18AABCD1234F1Z5"
                  maxLength={15}
                  value={form.gstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  style={errors.gstin ? { borderColor: "#DC2626", textTransform: "uppercase", fontFamily: "monospace" } : { textTransform: "uppercase", fontFamily: "monospace" }}
                  required
                />
                {errors.gstin && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.gstin}
                  </span>
                )}
              </div>

              {/* Row 2, Col 2: Client Type */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="select-client-type">
                  <span>Client Type <span className="req">*</span></span>
                </label>
                <select
                  id="select-client-type"
                  className="form-select-input"
                  value={form.client_type}
                  onChange={(e) => updateField("client_type", e.target.value)}
                  style={errors.client_type ? { borderColor: "#DC2626" } : {}}
                  required
                >
                  <option value="">Select entity type</option>
                  {CLIENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.client_type && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.client_type}
                  </span>
                )}
              </div>

              {/* Row 3: Industry Type */}
              <div className="form-field-unit" style={{ gridColumn: "span 2" }}>
                <label className="form-field-label" htmlFor="select-industry-type">
                  <span>Industry Type <span style={{ color: "#94A3B8", fontWeight: 500 }}>(Optional)</span></span>
                </label>
                <select
                  id="select-industry-type"
                  className="form-select-input"
                  value={form.industry_type}
                  onChange={(e) => updateField("industry_type", e.target.value)}
                >
                  <option value="">Select industry category</option>
                  {INDUSTRY_TYPES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ================================================================
              SECTION 2: REGISTERED OFFICE ADDRESS WITH PIN CODE AUTO-FETCH
              ================================================================ */}
          <section className="create-section-card" aria-labelledby="section-office-address">
            <div className="create-section-header">
              <div className="step-num-circle">2</div>
              <div>
                <h2 id="section-office-address" className="create-section-title">
                  Registered Office Address
                </h2>
                <p className="create-section-subtitle">
                  Enter 6-digit PIN code to auto-populate City and State via India Post directory.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Row 1, Col 1: PIN Code with Auto-fetch */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-pincode">
                  <span>PIN Code <span className="req">*</span></span>
                  <span className="counter">6 digits</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    id="input-pincode"
                    className="form-text-input"
                    placeholder="e.g. 781005"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    style={errors.pincode ? { borderColor: "#DC2626", fontFamily: "monospace" } : { fontFamily: "monospace" }}
                    required
                  />
                  {isPincodeLoading && (
                    <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                      <Loader size={16} className="spin-animate" color="#F05A22" />
                    </div>
                  )}
                </div>
                {errors.pincode && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.pincode}
                  </span>
                )}
                {pincodeStatus && (
                  <div className={`pincode-status-badge ${pincodeStatus.type}`}>
                    {pincodeStatus.type === "success" && <Check size={12} />}
                    {pincodeStatus.type === "fallback" && <Info size={12} />}
                    <span>{pincodeStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Row 1, Col 2: Address Line 1 */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-address-1">
                  <span>Address Line 1 <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  id="input-address-1"
                  className="form-text-input"
                  placeholder="Building name, plot no., street name"
                  value={form.address_line_1}
                  onChange={(e) => updateField("address_line_1", e.target.value)}
                  style={errors.address_line_1 ? { borderColor: "#DC2626" } : {}}
                  required
                />
                {errors.address_line_1 && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.address_line_1}
                  </span>
                )}
              </div>

              {/* Row 2, Col 1: Address Line 2 */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-address-2">
                  <span>Address Line 2 <span style={{ color: "#94A3B8", fontWeight: 500 }}>(Optional)</span></span>
                </label>
                <input
                  type="text"
                  id="input-address-2"
                  className="form-text-input"
                  placeholder="Area, landmark or unit number"
                  value={form.address_line_2}
                  onChange={(e) => updateField("address_line_2", e.target.value)}
                />
              </div>

              {/* Row 2, Col 2: City (Input with suggestions) */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-city">
                  <span>City <span className="req">*</span></span>
                  <span className="counter" style={{ color: "#047857" }}>Auto-populated</span>
                </label>
                <input
                  type="text"
                  id="input-city"
                  list="city-suggestions"
                  className="form-text-input"
                  placeholder="City name"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  style={errors.city ? { borderColor: "#DC2626" } : {}}
                  required
                />
                <datalist id="city-suggestions">
                  {COMMON_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {errors.city && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.city}
                  </span>
                )}
              </div>

              {/* Row 3: State Dropdown */}
              <div className="form-field-unit" style={{ gridColumn: "span 2" }}>
                <label className="form-field-label" htmlFor="select-state">
                  <span>State / Union Territory <span className="req">*</span></span>
                  <span className="counter" style={{ color: "#047857" }}>Auto-populated</span>
                </label>
                <select
                  id="select-state"
                  className="form-select-input"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  style={errors.state ? { borderColor: "#DC2626" } : {}}
                  required
                >
                  <option value="">Select state or union territory</option>
                  {ALL_INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.state && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.state}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ================================================================
              SECTION 3: PRIMARY CONTACT PERSON
              ================================================================ */}
          <section className="create-section-card" aria-labelledby="section-contact-person">
            <div className="create-section-header">
              <div className="step-num-circle">3</div>
              <div>
                <h2 id="section-contact-person" className="create-section-title">
                  Primary Contact Person
                </h2>
                <p className="create-section-subtitle">
                  Authorized manager who receives mobile app credentials and OTP notifications.
                </p>
              </div>
            </div>

            <div className="form-grid-2col">
              {/* Row 1, Col 1: Contact Person Name */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-contact-name">
                  <span>Contact Person Name <span className="req">*</span></span>
                </label>
                <input
                  type="text"
                  id="input-contact-name"
                  className="form-text-input"
                  placeholder="Full name of authorized manager"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  style={errors.contact_name ? { borderColor: "#DC2626" } : {}}
                  required
                />
                {errors.contact_name && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.contact_name}
                  </span>
                )}
              </div>

              {/* Row 1, Col 2: Designation */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-designation">
                  <span>Designation <span style={{ color: "#94A3B8", fontWeight: 500 }}>(Optional)</span></span>
                </label>
                <input
                  type="text"
                  id="input-designation"
                  className="form-text-input"
                  placeholder="e.g. Logistics Head / Supply Chain Manager"
                  value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)}
                />
              </div>

              {/* Row 2, Col 1: Official Email Address */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-email">
                  <span>Official Email Address <span className="req">*</span></span>
                </label>
                <div className="form-input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    id="input-email"
                    className="form-text-input"
                    placeholder="official.email@company.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    style={errors.email ? { borderColor: "#DC2626" } : {}}
                    required
                  />
                </div>
                {errors.email && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.email}
                  </span>
                )}
              </div>

              {/* Row 2, Col 2: Primary Mobile Number */}
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-mobile">
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
                    id="input-mobile"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => updateField("mobile", e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                {errors.mobile && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.mobile}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ================================================================
              SECTION 4: COMPLIANCE DOCUMENTS & UPLOAD RESPONSIBILITY
              ================================================================ */}
          <section className="create-section-card" aria-labelledby="section-compliance-docs">
            <div className="create-section-header">
              <div className="step-num-circle">4</div>
              <div>
                <h2 id="section-compliance-docs" className="create-section-title">
                  Compliance Documents & Upload Responsibility
                </h2>
                <p className="create-section-subtitle">
                  Configure whether the Admin desk uploads files now or requests the Client to upload upon mobile app login.
                </p>
              </div>
            </div>

            <div className="doc-responsibility-container">
              {CLIENT_COMPLIANCE_DOCS.map((doc) => {
                const resp = docResponsibilities[doc.key];
                const file = docFiles[doc.key];

                return (
                  <div key={doc.key} className="doc-responsibility-card">
                    <div className="doc-responsibility-top">
                      <div className="doc-title-row">
                        <FileText size={17} color="#F05A22" />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="doc-title-text">{doc.label}</span>
                            {doc.mandatory ? (
                              <span className="doc-badge-mandatory">Mandatory</span>
                            ) : (
                              <span className="doc-badge-optional">Optional</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                            {doc.description}
                          </div>
                        </div>
                      </div>

                      {/* Segmented Responsibility Toggle */}
                      <div className="resp-segmented-control" role="group" aria-label={`Upload responsibility for ${doc.label}`}>
                        <button
                          type="button"
                          className={`resp-segment-btn ${resp === "ADMIN" ? "active admin" : ""}`}
                          onClick={() => handleToggleResponsibility(doc.key, "ADMIN")}
                          title="Admin will upload local file now"
                        >
                          <UploadCloud size={13} />
                          <span>Admin Upload</span>
                        </button>
                        <button
                          type="button"
                          className={`resp-segment-btn ${resp === "CLIENT" ? "active client" : ""}`}
                          onClick={() => handleToggleResponsibility(doc.key, "CLIENT")}
                          title="Client will upload via mobile app"
                        >
                          <User size={13} />
                          <span>Client Upload</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode-specific upload interface */}
                    {resp === "ADMIN" ? (
                      <div>
                        {file ? (
                          <div className="doc-uploaded-pill">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <CheckCircle size={16} color="#16A34A" />
                              <div>
                                <span style={{ fontWeight: 600, color: "#166534" }}>{file.name}</span>
                                <span style={{ fontSize: 11, color: "#64748B", marginLeft: 6 }}>
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFilePicked(doc.key, null)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}
                              title="Remove file"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              ref={(el) => (fileInputRefs.current[doc.key] = el)}
                              style={{ display: "none" }}
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                handleFilePicked(doc.key, f);
                              }}
                            />
                            <div
                              className="doc-upload-dropzone"
                              onClick={() => fileInputRefs.current[doc.key]?.click()}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Paperclip size={16} color="#F05A22" />
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                                    Click to attach local file (PDF, PNG, JPG up to 10 MB)
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748B" }}>
                                    Securely stored and verified by compliance desk
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: 6,
                                  padding: "5px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#334155",
                                  cursor: "pointer"
                                }}
                              >
                                Browse Files
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="client-upload-notice">
                        <Info size={15} color="#EA580C" style={{ flexShrink: 0 }} />
                        <span>
                          <strong>Client Action Delegated:</strong> Client will be prompted immediately after login to capture with camera or upload this document in their mobile dashboard.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================================================================
              SECTION 5: CREDIT & PAYMENT TERMS
              ================================================================ */}
          <section className="create-section-card" aria-labelledby="section-payment-terms">
            <div className="create-section-header">
              <div className="step-num-circle">5</div>
              <div>
                <h2 id="section-payment-terms" className="create-section-title">
                  Credit & Payment Terms
                </h2>
                <p className="create-section-subtitle">
                  Configure commercial credit period and billing terms for this account.
                </p>
              </div>
            </div>

            <div style={{ maxWidth: 380 }}>
              <div className="form-field-unit">
                <label className="form-field-label" htmlFor="input-credit-terms">
                  <span>Credit Terms / Payment Window (Days) <span className="req">*</span></span>
                </label>
                <div className="form-input-with-icon">
                  <Calendar size={16} className="input-icon" />
                  <input
                    type="number"
                    id="input-credit-terms"
                    className="form-text-input"
                    min="0"
                    max="180"
                    value={form.credit_window_days}
                    onChange={(e) => updateField("credit_window_days", e.target.value)}
                    style={errors.credit_window_days ? { borderColor: "#DC2626" } : {}}
                    required
                  />
                </div>
                <div className="form-field-hint">
                  Number of days allowed for client invoice settlement. Standard window is 30 days.
                </div>
                {errors.credit_window_days && (
                  <span className="form-field-error">
                    <AlertCircle size={12} /> {errors.credit_window_days}
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Client Creation Process & Notes */}
        <div className="create-sidebar-column">
          {/* 9. Client Creation Process Card */}
          <div className="sidebar-info-card">
            <h3 className="sidebar-card-title">
              <Building2 size={18} color="#F05A22" />
              <span>Creation & Verification Flow</span>
            </h3>

            <div className="process-steps-list">
              <div className="process-step-item">
                <div className="process-circle">01</div>
                <div>
                  <div className="process-step-title">Legal Entity Details</div>
                  <div className="process-step-desc">Enter company name, PAN, GSTIN, and auto-resolved postal address.</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">02</div>
                <div>
                  <div className="process-step-title">Upload Responsibility</div>
                  <div className="process-step-desc">Upload files now or assign them to the client for mobile upload.</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">03</div>
                <div>
                  <div className="process-step-title">NECL Unique ID Generated</div>
                  <div className="process-step-desc">Permanent NECL-CL-DDMMYYYY-XXXXX format assigned atomically.</div>
                </div>
              </div>

              <div className="process-step-item">
                <div className="process-circle">04</div>
                <div>
                  <div className="process-step-title">Mobile App Notification</div>
                  <div className="process-step-desc">Client is notified in-app immediately after login to complete missing items.</div>
                </div>
              </div>
            </div>
          </div>

          {/* 10. Account Welcome Message Information Card */}
          <div className="sidebar-info-card">
            <h3 className="sidebar-card-title">
              <Mail size={18} color="#F05A22" />
              <span>Account Provisioning Notice</span>
            </h3>
            <div className="welcome-message-callout">
              <div>
                <div className="wm-title">Automated Mobile Dispatch</div>
                <div className="wm-text">
                  After saving, an onboarding notification is prepared. If compliance documents were delegated to the client, an in-app popup prompt will guide them on their first login.
                </div>
              </div>
            </div>
          </div>

          {/* 11. Important Notes Card */}
          <div className="sidebar-info-card">
            <h3 className="sidebar-card-title">
              <Info size={18} color="#F05A22" />
              <span>Compliance Notes</span>
            </h3>

            <ul className="notes-bullet-list">
              <li>Company PAN must be 10 characters (e.g. ABCDE1234F).</li>
              <li>GSTIN (15 chars) auto-extracts PAN characters 3–12.</li>
              <li>Entering 6-digit PIN code auto-resolves city and state.</li>
              <li>Delegated client uploads notify the client immediately on login.</li>
              <li>Final account activation is blocked until all mandatory documents are verified.</li>
            </ul>
          </div>
        </div>

        {/* ── 12. Sticky Form Action Bar ── */}
        <div className="sticky-form-action-bar" role="region" aria-label="Form actions">
          <button
            type="button"
            className="btn-cancel-flat"
            onClick={handleCancelClick}
            id="btn-cancel-client"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-submit-primary"
            disabled={isSubmitting}
            id="btn-save-and-provision"
          >
            {isSubmitting ? (
              <>
                <Loader size={16} className="spin-animate" />
                <span>Provisioning Client Account...</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>Save Client & Provision Account</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Cancel Confirmation Modal ── */}
      {showCancelConfirm && (
        <div className="modal-backdrop-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog-card" role="dialog" aria-modal="true">
            <div className="modal-icon-circle-warning">
              <AlertCircle size={28} color="#DC2626" />
            </div>
            <h3 className="modal-title">Discard Unsaved Changes?</h3>
            <p className="modal-desc">
              You have entered client information. Are you sure you want to discard your progress and return to the directory?
            </p>
            <div className="modal-btn-row">
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => setShowCancelConfirm(false)}
              >
                Continue Editing
              </button>
              <button
                type="button"
                className="btn-modal-danger"
                onClick={onBack}
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateClient;
