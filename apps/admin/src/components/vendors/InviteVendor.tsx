import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Calendar,
  Globe,
  AlertTriangle,
  ChevronRight,
  Truck,
  Building2,
  X,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Upload,
  Check,
  ShieldCheck,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Layers,
  Save,
  Bookmark,
  Loader,
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { generateDbNeclId } from '../../utils/idGenerator';
import { pincodeService } from '../../services/pincodeService';
import { draftService } from '../../services/draftService';
import { optimizeFileForUpload } from '../../utils/fileCompressor';

interface InviteVendorProps {
  onBack: () => void;
  onInvited: (vendorId: string) => void;
  draftId?: string;
}

export interface AdminVendorVehicle {
  id: string;
  registrationNumber: string;
  vehicleCategory: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
  bodyType: 'Open Body' | 'Closed Body';
  capacity: string;
  capacityUnit: 'MT' | 'KG' | 'CBM';
  ownership: 'Owned' | 'Attached' | 'Both';
  makeModel?: string;
  driverName?: string;
  driverPhone?: string;
  driverLicence?: string;
  // Vehicle-specific files
  rcFile?: File | null;
  cBookFile?: File | null;
  permitFile?: File | null;
  insuranceFile?: File | null;
  pucFile?: File | null;
  driverDlFile?: File | null;
}

const VEHICLE_CATEGORIES: ('Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier')[] = [
  'Lorry',
  'Trailer',
  'Van',
  'Heavy Carrier',
];

const VEHICLE_BODY_TYPES: ('Open Body' | 'Closed Body')[] = [
  'Open Body',
  'Closed Body',
];

const CAPACITY_UNITS: ('MT' | 'KG' | 'CBM')[] = ['MT', 'KG', 'CBM'];

const SERVICES_OPTIONS = [
  'Full Truck Load (FTL)',
  'ODC (Over-Dimensional Cargo)',
  'Heavy Project Cargo',
  'Container',
  'Part Truckload (PTL)',
  'Cold Chain',
];

export const InviteVendor: React.FC<InviteVendorProps> = ({ onBack, onInvited, draftId: propDraftId }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    vendorType: 'Fleet Owner',
    businessType: 'Proprietorship',
    gstin: '',
    pan: '',
    establishmentYear: '',
    website: '',
    contactName: '',
    designation: 'Owner',
    email: '',
    mobile: '',
    addressLine1: '',
    addressLine2: '',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '781001',
    totalFleetCount: '1',
    accountStatus: 'PENDING',
    onboardingNotes: '',
  });

  // Dynamic tags for Operating Cities and Lanes
  const [operatingLanes, setOperatingLanes] = useState<string[]>(['Guwahati - Siliguri Corridor', 'Kolkata - Guwahati Lane']);
  const [newLaneInput, setNewLaneInput] = useState('');
  const [showAddLane, setShowAddLane] = useState(false);

  // Selected Services
  const [selectedServices, setSelectedServices] = useState<string[]>([
    'Full Truck Load (FTL)',
    'ODC (Over-Dimensional Cargo)',
    'Heavy Project Cargo',
  ]);

  // Step 5: Multi-Vehicle Fleet List
  const [vehicles, setVehicles] = useState<AdminVendorVehicle[]>([]);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Draft Management State
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => {
    if (propDraftId) return propDraftId;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('draftId') || null;
    }
    return null;
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftToast, setDraftToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null);

  // Restore Draft on mount if draftId exists or check local backup
  useEffect(() => {
    const restoreDraft = async () => {
      const targetId = activeDraftId || propDraftId;
      if (targetId) {
        try {
          const draft = await draftService.getDraftById(targetId);
          if (draft) {
            if (draft.form_data) {
              setFormData((prev) => ({
                ...prev,
                ...(draft.form_data as any),
              }));
            }
            if (Array.isArray(draft.operating_lanes)) {
              setOperatingLanes(draft.operating_lanes);
            }
            if (Array.isArray(draft.selected_services)) {
              setSelectedServices(draft.selected_services);
            }
            if (Array.isArray(draft.vehicle_details)) {
              setVehicles(draft.vehicle_details as AdminVendorVehicle[]);
            }
            setDraftLastSaved(draft.updated_at);
            setDraftToast({
              message: `Draft "${draft.title}" loaded successfully.`,
              type: 'info',
            });
            setTimeout(() => setDraftToast(null), 4000);
          }
        } catch (err: any) {
          console.warn('Failed to load vendor draft:', err);
        }
      } else {
        const backup = draftService.getLocalBackup('VENDOR');
        if (backup?.formData && Object.values(backup.formData).some((v) => Boolean(v))) {
          setFormData((prev) => ({ ...prev, ...(backup.formData as any) }));
          if (backup.operatingLanes) setOperatingLanes(backup.operatingLanes);
          if (backup.selectedServices) setSelectedServices(backup.selectedServices);
          if (backup.vehicleDetails) setVehicles(backup.vehicleDetails as AdminVendorVehicle[]);
          if (backup.id) setActiveDraftId(backup.id);
          if (backup.updatedAt) setDraftLastSaved(backup.updatedAt);
        }
      }
    };

    restoreDraft();
  }, [activeDraftId, propDraftId]);

  // Save Vendor Draft
  const handleSaveDraft = async (exitAfter = false) => {
    setIsSavingDraft(true);
    try {
      const draftTitle =
        formData.businessName.trim() ||
        (formData.contactName.trim() ? `Draft - ${formData.contactName.trim()}` : 'Untitled Vendor Registration');

      const serializedVehicles = vehicles.map((v) => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        vehicleCategory: v.vehicleCategory,
        bodyType: v.bodyType,
        capacity: v.capacity,
        capacityUnit: v.capacityUnit,
        ownership: v.ownership,
        makeModel: v.makeModel || '',
        driverName: v.driverName || '',
        driverPhone: v.driverPhone || '',
        driverLicence: v.driverLicence || '',
      }));

      const saved = await draftService.saveDraft({
        id: activeDraftId || undefined,
        entityType: 'VENDOR',
        title: draftTitle,
        formData: formData,
        vehicleDetails: serializedVehicles,
        operatingLanes: operatingLanes,
        selectedServices: selectedServices,
        stepProgress:
          vehicles.length > 0
            ? `${vehicles.length} Commercial Vehicles Added`
            : operatingLanes.length > 0
            ? 'Operating Lanes & Services'
            : formData.addressLine1
            ? 'Operating Address'
            : 'Company Profile',
      });

      setActiveDraftId(saved.id);
      setDraftLastSaved(saved.updated_at);
      draftService.setLocalBackup('VENDOR', {
        id: saved.id,
        entityType: 'VENDOR',
        formData: formData,
        vehicleDetails: serializedVehicles,
        operatingLanes: operatingLanes,
        selectedServices: selectedServices,
        updatedAt: saved.updated_at,
      });

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('draftId', saved.id);
        window.history.replaceState({}, '', url.toString());
      }

      setDraftToast({
        message: 'Vendor draft saved successfully! You can resume it anytime from the Vendor Directory.',
        type: 'success',
      });
      setTimeout(() => setDraftToast(null), 4000);

      if (exitAfter) {
        onBack();
      }
    } catch (err: any) {
      console.error('Save vendor draft error:', err);
      setDraftToast({
        message: err.message || 'Failed to save vendor draft. Please try again.',
        type: 'error',
      });
      setTimeout(() => setDraftToast(null), 5000);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Vehicle Modal Form State
  const [vehicleForm, setVehicleForm] = useState<{
    registrationNumber: string;
    vehicleCategory: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier';
    bodyType: 'Open Body' | 'Closed Body';
    capacity: string;
    capacityUnit: 'MT' | 'KG' | 'CBM';
    ownership: 'Owned' | 'Attached' | 'Both';
    makeModel: string;
    driverName: string;
    driverPhone: string;
    driverLicence: string;
    rcFile: File | null;
    cBookFile: File | null;
    permitFile: File | null;
    insuranceFile: File | null;
    pucFile: File | null;
    driverDlFile: File | null;
  }>({
    registrationNumber: '',
    vehicleCategory: 'Lorry',
    bodyType: 'Open Body',
    capacity: '15',
    capacityUnit: 'MT',
    ownership: 'Owned',
    makeModel: '',
    driverName: '',
    driverPhone: '',
    driverLicence: '',
    rcFile: null,
    cBookFile: null,
    permitFile: null,
    insuranceFile: null,
    pucFile: null,
    driverDlFile: null,
  });
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null);

  // Step 7: Company KYC Documents
  const [companyKycFiles, setCompanyKycFiles] = useState<{
    panFile: File | null;
    chequeFile: File | null;
    gstFile: File | null;
    declarationFile: File | null;
  }>({
    panFile: null,
    chequeFile: null,
    gstFile: null,
    declarationFile: null,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPincodeLoading, setIsPincodeLoading] = useState<boolean>(false);
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

  const toggleService = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter((s) => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  // PIN code auto lookup
  const handlePincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, pincode: clean }));

    if (clean.length === 6) {
      setIsPincodeLoading(true);
      try {
        const res = await pincodeService.lookupPincode(clean);
        if (res.success && res.data) {
          setFormData((prev) => ({
            ...prev,
            city: res.data?.city || prev.city,
            state: res.data?.state || prev.state,
          }));
        }
      } catch (err) {
        console.warn('PIN lookup timeout:', err);
      } finally {
        setIsPincodeLoading(false);
      }
    }
  };

  // Vehicle Management Handlers
  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    setVehicleForm({
      registrationNumber: '',
      vehicleCategory: 'Lorry',
      bodyType: 'Open Body',
      capacity: '15',
      capacityUnit: 'MT',
      ownership: 'Owned',
      makeModel: '',
      driverName: '',
      driverPhone: '',
      driverLicence: '',
      rcFile: null,
      cBookFile: null,
      permitFile: null,
      insuranceFile: null,
      pucFile: null,
      driverDlFile: null,
    });
    setVehicleFormError(null);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: AdminVendorVehicle) => {
    setEditingVehicleId(veh.id);
    setVehicleForm({
      registrationNumber: veh.registrationNumber,
      vehicleCategory: veh.vehicleCategory,
      bodyType: veh.bodyType,
      capacity: veh.capacity,
      capacityUnit: veh.capacityUnit,
      ownership: veh.ownership,
      makeModel: veh.makeModel || '',
      driverName: veh.driverName || '',
      driverPhone: veh.driverPhone || '',
      driverLicence: veh.driverLicence || '',
      rcFile: veh.rcFile || null,
      cBookFile: veh.cBookFile || null,
      permitFile: veh.permitFile || null,
      insuranceFile: veh.insuranceFile || null,
      pucFile: veh.pucFile || null,
      driverDlFile: veh.driverDlFile || null,
    });
    setVehicleFormError(null);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicleModal = () => {
    const cleanReg = vehicleForm.registrationNumber.trim().toUpperCase();
    if (!cleanReg) {
      setVehicleFormError('Vehicle registration number is required (e.g. AS-01-EC-9944).');
      return;
    }

    const capNum = parseFloat(vehicleForm.capacity);
    if (isNaN(capNum) || capNum <= 0) {
      setVehicleFormError('Please enter a valid positive vehicle capacity.');
      return;
    }

    if (editingVehicleId) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicleId
            ? {
                ...v,
                registrationNumber: cleanReg,
                vehicleCategory: vehicleForm.vehicleCategory,
                bodyType: vehicleForm.bodyType,
                capacity: vehicleForm.capacity,
                capacityUnit: vehicleForm.capacityUnit,
                ownership: vehicleForm.ownership,
                makeModel: vehicleForm.makeModel,
                driverName: vehicleForm.driverName,
                driverPhone: vehicleForm.driverPhone,
                driverLicence: vehicleForm.driverLicence,
                rcFile: vehicleForm.rcFile,
                cBookFile: vehicleForm.cBookFile,
                permitFile: vehicleForm.permitFile,
                insuranceFile: vehicleForm.insuranceFile,
                pucFile: vehicleForm.pucFile,
                driverDlFile: vehicleForm.driverDlFile,
              }
            : v
        )
      );
    } else {
      const newVeh: AdminVendorVehicle = {
        id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        registrationNumber: cleanReg,
        vehicleCategory: vehicleForm.vehicleCategory,
        bodyType: vehicleForm.bodyType,
        capacity: vehicleForm.capacity,
        capacityUnit: vehicleForm.capacityUnit,
        ownership: vehicleForm.ownership,
        makeModel: vehicleForm.makeModel,
        driverName: vehicleForm.driverName,
        driverPhone: vehicleForm.driverPhone,
        driverLicence: vehicleForm.driverLicence,
        rcFile: vehicleForm.rcFile,
        cBookFile: vehicleForm.cBookFile,
        permitFile: vehicleForm.permitFile,
        insuranceFile: vehicleForm.insuranceFile,
        pucFile: vehicleForm.pucFile,
        driverDlFile: vehicleForm.driverDlFile,
      };
      setVehicles((prev) => [...prev, newVeh]);
      setFormData((prev) => ({ ...prev, totalFleetCount: String(vehicles.length + 1) }));
    }

    setIsVehicleModalOpen(false);
  };

  const handleRemoveVehicle = (id: string) => {
    const updated = vehicles.filter((v) => v.id !== id);
    setVehicles(updated);
    setFormData((prev) => ({ ...prev, totalFleetCount: String(Math.max(1, updated.length)) }));
  };

  const validate = async (): Promise<boolean> => {
    await ensureAdminSession();
    const errs: { [key: string]: string } = {};

    if (!formData.businessName.trim()) {
      errs.businessName = 'Company / Transporter Legal Name is required.';
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

    if (formData.email && formData.email.trim() && !formData.email.includes('@')) {
      errs.email = 'Valid Email Address format is required if provided.';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length !== 10) {
      errs.mobile = '10-digit Mobile Number is required.';
    }

    if (!formData.addressLine1.trim()) {
      errs.addressLine1 = 'Registered Office Address Line 1 is required.';
    }

    if (!formData.city.trim()) {
      errs.city = 'City is required.';
    }

    if (!formData.state.trim()) {
      errs.state = 'State is required.';
    }

    if (!formData.pincode.trim() || formData.pincode.replace(/\D/g, '').length !== 6) {
      errs.pincode = 'Valid 6-digit PIN code is required.';
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
        // network timeout fallback
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
        // network timeout fallback
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validate();
    if (!isValid) {
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      await ensureAdminSession();

      const cleanMobile = formData.mobile.replace(/\D/g, '');
      const fullAddress = `${formData.addressLine1.trim()}${formData.addressLine2 ? ', ' + formData.addressLine2.trim() : ''}, ${formData.city.trim()}, ${formData.state.trim()} - ${formData.pincode.trim()}`;

      // 1. Generate atomic NECL Vendor ID
      const vendorCode = await generateDbNeclId('VD');

      // 2. Insert Vendor Company Record
      const { data: comp, error: compErr } = await supabase
        .from('vendor_companies')
        .insert([
          {
            vendor_code: vendorCode,
            vendor_name: formData.businessName.trim(),
            pan: formData.pan.trim().toUpperCase() || 'NOT_PROVIDED',
            gstin: formData.gstin.trim().toUpperCase() || null,
            address: fullAddress,
            status: formData.accountStatus as any,
            compliance_status: formData.accountStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
            onboarding_source: 'ADMIN_PORTAL',
            fleet_size: String(vehicles.length || formData.totalFleetCount || 1),
            services: selectedServices,
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (compErr) throw compErr;

      // 3. Insert Primary Contact Person into vendor_users
      const { error: userErr } = await supabase.from('vendor_users').insert([
        {
          vendor_id: comp.id,
          full_name: formData.contactName.trim(),
          email: formData.email?.trim() || null,
          mobile: cleanMobile,
          status: formData.accountStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING',
        },
      ]);

      if (userErr) console.warn('vendor_users insert notice:', userErr);

      // 4. Multi-Vehicle Fleet Persistence & Vehicle-Specific Documents
      for (const veh of vehicles) {
        try {
          const rawReg = veh.registrationNumber.trim().toUpperCase();
          const category = veh.vehicleCategory;
          const bodyType = veh.bodyType;
          const ratedCap = Number(veh.capacity) || 15;
          const minCap = Math.max(1, Math.round(ratedCap * 0.7));

          // Upsert into vehicles table
          const { data: vRecord, error: vErr } = await supabase
            .from('vehicles')
            .upsert([
              {
                registration_number: rawReg,
                vehicle_type: category,
                body_type: bodyType,
                rated_capacity_mt: ratedCap,
                minimum_capacity_mt: minCap,
                rc_number: rawReg,
                status: 'ACTIVE',
                verification_status: formData.accountStatus === 'APPROVED' ? 'VERIFIED' : 'PENDING_DOCS',
                rc_verification_status: veh.rcFile ? 'PENDING' : 'PENDING',
                insurance_verification_status: veh.insuranceFile ? 'PENDING' : 'PENDING',
                fitness_verification_status: veh.cBookFile ? 'PENDING' : 'PENDING',
                permit_verification_status: veh.permitFile ? 'PENDING' : 'PENDING',
              },
            ], { onConflict: 'registration_number' })
            .select('id, registration_number')
            .maybeSingle();

          if (vErr) console.warn(`Vehicle insertion notice for ${rawReg}:`, vErr.message);

          const targetVehId = vRecord?.id;
          if (targetVehId) {
            // Link vehicle to vendor
            await supabase
              .from('vendor_vehicle_links')
              .upsert([
                {
                  vendor_id: comp.id,
                  vehicle_id: targetVehId,
                  status: formData.accountStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING',
                },
              ], { onConflict: 'vendor_id,vehicle_id' });

            // Driver association if info provided
            let driverRecordId: string | null = null;
            if (veh.driverName || veh.driverPhone || veh.driverLicence) {
              const drvPhone = (veh.driverPhone || cleanMobile).replace(/[^0-9]/g, '').slice(-10);
              const drvLicence = (veh.driverLicence || `DL-${drvPhone || Date.now().toString().slice(-6)}`).trim().toUpperCase();
              const drvName = (veh.driverName || `Driver for ${rawReg}`).trim();

              const { data: dRecord } = await supabase
                .from('drivers')
                .insert([
                  {
                    primary_vendor_id: comp.id,
                    full_name: drvName,
                    name: drvName,
                    mobile: drvPhone,
                    phone: drvPhone,
                    licence_number: drvLicence,
                    license_number: drvLicence,
                    licence_expiry_date: '2029-12-31',
                    status: formData.accountStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
                  },
                ])
                .select('id')
                .maybeSingle();

              if (dRecord?.id) {
                driverRecordId = dRecord.id;
                await supabase.from('vehicles').update({ assigned_driver_id: dRecord.id }).eq('id', targetVehId);
              }
            }

            // Upload vehicle-specific documents linked directly to targetVehId
            const vehDocSlots = [
              { file: veh.rcFile, type: 'RC', label: `[${rawReg}] Registration Certificate (RC)` },
              { file: veh.cBookFile, type: 'FITNESS', label: `[${rawReg}] C-Book / Fitness Certificate` },
              { file: veh.permitFile, type: 'PERMIT', label: `[${rawReg}] Route / Goods Permit` },
              { file: veh.insuranceFile, type: 'INSURANCE', label: `[${rawReg}] Vehicle Insurance Certificate` },
              { file: veh.pucFile, type: 'OTHER', label: `[${rawReg}] Pollution Under Control Certificate (PUC)` },
              { file: veh.driverDlFile, type: 'LICENCE', label: `[${rawReg}] Driver Driving Licence` },
            ];

            for (const slot of vehDocSlots) {
              if (!slot.file) continue;
              try {
                const ext = slot.file.name.split('.').pop() || 'pdf';
                const storagePath = `vendors/${comp.id}/vehicles/${targetVehId}/${slot.type.toLowerCase()}_${Date.now()}.${ext}`;

                let publicUrl = storagePath;
                try {
                  const optimizedFile = await optimizeFileForUpload(slot.file);
                  const { data: upData, error: upErr } = await supabase.storage
                    .from('client-documents')
                    .upload(storagePath, optimizedFile, { upsert: true });
                  if (!upErr && upData) {
                    publicUrl = storagePath;
                  }
                } catch (storErr) {
                  console.warn('Storage upload notice for vehicle doc:', storErr);
                }

                const isDriverDoc = slot.type === 'LICENCE';
                await supabase.from('documents').insert([
                  {
                    category: isDriverDoc ? 'DRIVER' : 'VEHICLE',
                    document_type: slot.type,
                    reference_id: isDriverDoc ? (driverRecordId || targetVehId) : targetVehId,
                    file_name: `${slot.label}: ${slot.file.name}`,
                    file_url: publicUrl,
                    storage_path: storagePath,
                    file_size: `${Math.round(slot.file.size / 1024)} KB`,
                    mime_type: slot.file.type || 'application/pdf',
                    verification_status: 'PENDING',
                    uploaded_by: 'Admin Desk',
                  },
                ]);
              } catch (vdErr) {
                console.warn('Vehicle document insert notice:', vdErr);
              }
            }
          }
        } catch (vehLoopErr) {
          console.warn('Vehicle enrollment loop notice:', vehLoopErr);
        }
      }

      // 5. Company KYC Documents Upload
      const kycSlots = [
        { file: companyKycFiles.panFile, type: 'COMPANY_PAN', label: 'Company PAN Card' },
        { file: companyKycFiles.chequeFile, type: 'BANK_CANCELLED_CHEQUE', label: 'Bank Cancelled Cheque' },
        { file: companyKycFiles.gstFile, type: 'GST_CERTIFICATE', label: 'GST Registration Certificate' },
        { file: companyKycFiles.declarationFile, type: 'TRANSPORT_DECLARATION', label: 'Transport Undertaking / Declaration' },
      ];

      for (const slot of kycSlots) {
        if (!slot.file) continue;
        try {
          const ext = slot.file.name.split('.').pop() || 'pdf';
          const storagePath = `vendors/${comp.id}/${slot.type.toLowerCase()}_${Date.now()}.${ext}`;

          let publicUrl = storagePath;
          try {
            const optimizedFile = await optimizeFileForUpload(slot.file);
            const { data: upData, error: upErr } = await supabase.storage
              .from('client-documents')
              .upload(storagePath, optimizedFile, { upsert: true });
            if (!upErr && upData) {
              publicUrl = storagePath;
            }
          } catch (storErr) {
            console.warn('Storage upload notice for vendor kyc doc:', storErr);
          }

          await supabase.from('documents').insert([
            {
              category: 'VENDOR',
              document_type: slot.type,
              reference_id: comp.id,
              file_name: `${slot.label}: ${slot.file.name}`,
              file_url: publicUrl,
              storage_path: storagePath,
              file_size: `${Math.round(slot.file.size / 1024)} KB`,
              mime_type: slot.file.type || 'application/pdf',
              verification_status: 'PENDING',
              uploaded_by: 'Admin Desk',
            },
          ]);
        } catch (kErr) {
          console.warn('Vendor KYC document insert notice:', kErr);
        }
      }

      // 6. Log audit record with fleet configs for review modal parity
      try {
        const vehicleConfigsForAudit = vehicles.map((v) => ({
          id: v.id,
          registrationNumber: v.registrationNumber,
          vehicleType: v.vehicleCategory,
          bodyType: v.bodyType,
          capacity: Number(v.capacity) || 15,
          capacityUnit: v.capacityUnit,
          count: 1,
          driverName: v.driverName || '',
          driverPhone: v.driverPhone || '',
          driverLicence: v.driverLicence || '',
        }));

        await supabase.from('auth_audit_log').insert([
          {
            user_id: comp.id,
            event_type: 'VENDOR_REGISTRATION_SUBMITTED',
            action: 'VENDOR_REGISTRATION_SUBMITTED',
            details: {
              vehicleConfigs: vehicleConfigsForAudit,
              totalFleetCount: vehicles.length || Number(formData.totalFleetCount) || 1,
              fleetStrength: `${vehicles.length || formData.totalFleetCount || 1} Commercial Vehicles`,
            },
          },
        ]);
      } catch (auditErr) {
        console.warn('Audit log write notice:', auditErr);
      }

      showToast(`✅ Vendor "${formData.businessName}" (${vendorCode}) registered successfully!`);

      // Cleanup completed draft
      if (activeDraftId) {
        try {
          await draftService.completeDraft(activeDraftId);
        } catch (cleanupErr) {
          console.warn('Draft cleanup notice:', cleanupErr);
        }
      }
      draftService.clearLocalBackup('VENDOR');

      setTimeout(() => {
        onInvited(comp.id);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to create vendor record:', err);
      setErrors({
        global: err.message || 'Database error occurred while registering vendor.',
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

      {/* Draft Notification Alert */}
      {draftToast && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 8,
            marginBottom: 16,
            background: draftToast.type === 'error' ? '#FEF2F2' : draftToast.type === 'info' ? '#EFF6FF' : '#F0FDF4',
            border: `1px solid ${draftToast.type === 'error' ? '#FECACA' : draftToast.type === 'info' ? '#BFDBFE' : '#BBF7D0'}`,
            color: draftToast.type === 'error' ? '#B91C1C' : draftToast.type === 'info' ? '#1D4ED8' : '#15803D',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <Bookmark size={16} />
          <span style={{ flex: 1 }}>{draftToast.message}</span>
          <button
            type="button"
            onClick={() => setDraftToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active Draft Indicator */}
      {activeDraftId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#E2E8F0', color: '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
              DRAFT ACTIVE
            </span>
            <span>
              Draft ID: <strong style={{ fontFamily: 'monospace' }}>{activeDraftId.slice(0, 8)}...</strong>
              {draftLastSaved && ` • Saved at ${new Date(draftLastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSaveDraft(false)}
            disabled={isSavingDraft}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isSavingDraft ? <Loader size={12} className="spin-animate" /> : <Save size={12} />}
            <span>Save Now</span>
          </button>
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
            Complete transport vendor onboarding with fleet vehicles, specifications, and documents.
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

      <form onSubmit={handleSubmit} className="add-vendor-form-container">
        {/* Section 1: Enterprise Information */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">1</div>
            <div>
              <h3 className="card-title-text">Enterprise Information</h3>
              <p className="card-subtitle-text">Legal transporter enterprise details and primary contact.</p>
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-field-group">
              <label>
                Company / Transporter Legal Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Brahmaputra Logistics & Fleet Pvt Ltd"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className={`field-input-box ${errors.businessName ? 'input-error' : ''}`}
              />
              {errors.businessName && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.businessName}</span>}
            </div>

            <div className="form-field-group">
              <label>
                Vendor Type <span className="required-star">*</span>
              </label>
              <select
                value={formData.vendorType}
                onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                className="field-input-box"
              >
                <option value="Fleet Owner">Fleet Owner</option>
                <option value="Transporter">Transporter</option>
                <option value="Broker / Agent">Broker / Agent</option>
                <option value="3PL / Logistics Partner">3PL / Logistics Partner</option>
              </select>
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-field-group">
              <label>Company PAN Card Number</label>
              <input
                type="text"
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className={`field-input-box ${errors.pan ? 'input-error' : ''}`}
              />
              {errors.pan && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.pan}</span>}
            </div>

            <div className="form-field-group">
              <label>GSTIN (Optional)</label>
              <input
                type="text"
                maxLength={15}
                placeholder="e.g. 18AABCN1234F1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className={`field-input-box ${errors.gstin ? 'input-error' : ''}`}
              />
              {errors.gstin && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.gstin}</span>}
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
                placeholder="Full name of fleet manager or owner"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className={`field-input-box ${errors.contactName ? 'input-error' : ''}`}
              />
              {errors.contactName && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.contactName}</span>}
            </div>

            <div className="form-field-group">
              <label>
                Designation <span className="required-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Managing Partner / Fleet Manager"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className={`field-input-box ${errors.designation ? 'input-error' : ''}`}
              />
              {errors.designation && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.designation}</span>}
            </div>
          </div>

          <div className="form-two-col" style={{ marginBottom: 0 }}>
            <div className="form-field-group">
              <label>
                Primary Mobile Number <span className="required-star">*</span>
              </label>
              <div className="field-prefix-wrap">
                <span className="prefix-badge">🇮🇳 +91</span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                  className={`prefix-input ${errors.mobile ? 'input-error' : ''}`}
                />
              </div>
              {errors.mobile && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.mobile}</span>}
            </div>

            <div className="form-field-group">
              <label>Official Email Address (Optional)</label>
              <input
                type="email"
                placeholder="e.g. contact@transporter.com (optional)"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`field-input-box ${errors.email ? 'input-error' : ''}`}
              />
              {errors.email && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.email}</span>}
            </div>
          </div>
        </div>

        {/* Section 2: Business Constitution & Legal Entity */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">2</div>
            <div>
              <h3 className="card-title-text">Business Constitution</h3>
              <p className="card-subtitle-text">Entity legal constitution and MSME certificate details.</p>
            </div>
          </div>

          <div className="form-two-col" style={{ marginBottom: 0 }}>
            <div className="form-field-group">
              <label>Legal Entity Type</label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="field-input-box"
              >
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="Private Limited">Private Limited</option>
                <option value="Public Limited">Public Limited</option>
                <option value="LLP">LLP</option>
              </select>
            </div>

            <div className="form-field-group">
              <label>Year of Establishment (Optional)</label>
              <div className="field-input-icon-wrap">
                <Calendar size={16} className="field-leading-icon" />
                <input
                  type="text"
                  placeholder="e.g. 2018"
                  value={formData.establishmentYear}
                  onChange={(e) => setFormData({ ...formData, establishmentYear: e.target.value })}
                  className="field-input-box"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Registered Office Address */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">3</div>
            <div>
              <h3 className="card-title-text">Registered Office Address</h3>
              <p className="card-subtitle-text">Headquarters depot or office location with PIN code resolution.</p>
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
              <label>
                Address Line 1 <span className="required-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Plot no., Freight Complex, Hub Street"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                className={`field-input-box ${errors.addressLine1 ? 'input-error' : ''}`}
              />
              {errors.addressLine1 && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.addressLine1}</span>}
            </div>

            <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
              <label>Address Line 2 (Optional)</label>
              <input
                type="text"
                placeholder="Landmark, Transport Nagar, Depot area"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                className="field-input-box"
              />
            </div>
          </div>

          <div className="form-two-col" style={{ marginBottom: 0 }}>
            <div className="form-field-group">
              <label>
                PIN Code <span className="required-star">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="6-digit PIN"
                  value={formData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className={`field-input-box ${errors.pincode ? 'input-error' : ''}`}
                />
                {isPincodeLoading && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#F05A22' }}>
                    Resolving...
                  </span>
                )}
              </div>
              {errors.pincode && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.pincode}</span>}
            </div>

            <div className="form-field-group">
              <label>
                City <span className="required-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Guwahati"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className={`field-input-box ${errors.city ? 'input-error' : ''}`}
              />
              {errors.city && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.city}</span>}
            </div>

            <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
              <label>
                State <span className="required-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Assam"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className={`field-input-box ${errors.state ? 'input-error' : ''}`}
              />
              {errors.state && <span className="field-error-text" style={{ color: '#EF4444', fontSize: '11.5px' }}>{errors.state}</span>}
            </div>
          </div>
        </div>

        {/* Section 4: Operating Hubs & Corridors */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">4</div>
            <div>
              <h3 className="card-title-text">Operating Corridors & Hubs</h3>
              <p className="card-subtitle-text">Active freight routes, gateway hubs, and regional corridors.</p>
            </div>
          </div>

          <div className="form-field-group" style={{ marginBottom: 0 }}>
            <label>Freight Lanes & Gateway Hubs</label>
            <div className="tags-box-container">
              {operatingLanes.map((lane) => (
                <span key={lane} className="tag-badge-pill">
                  {lane}
                  <span className="tag-close-btn" onClick={() => removeLane(lane)} title="Remove lane">
                    <X size={12} />
                  </span>
                </span>
              ))}
              {showAddLane ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Siliguri - Dimapur"
                    value={newLaneInput}
                    onChange={(e) => setNewLaneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLane();
                      }
                    }}
                    style={{ height: '26px', padding: '0 6px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '12px' }}
                  />
                  <button type="button" onClick={addLane} className="add-tag-btn">
                    Add
                  </button>
                </div>
              ) : (
                <button type="button" className="add-tag-btn" onClick={() => setShowAddLane(true)}>
                  + Add Corridor
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Step 5 Fleet Strength & Vehicles */}
        <div className="vendor-form-card">
          <div className="vendor-card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="step-num-circle">5</div>
              <div>
                <h3 className="card-title-text">Fleet Strength & Vehicles</h3>
                <p className="card-subtitle-text">
                  Add commercial vehicles with category (Lorry, Trailer, Van, Heavy Carrier) and body type (Open/Closed Body).
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-create-orange"
              onClick={handleOpenAddVehicle}
              style={{ padding: '6px 14px', fontSize: '12.5px', height: '34px' }}
            >
              <Plus size={14} />
              <span>+ Add Vehicle</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '10px' }}>
              <Truck size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                No vehicles added yet
              </p>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px' }}>
                Add individual vehicles to associate fleet registration numbers, capacities, and driver details.
              </p>
              <button
                type="button"
                className="btn-create-orange"
                onClick={handleOpenAddVehicle}
                style={{ padding: '6px 16px', fontSize: '12.5px', margin: '0 auto' }}
              >
                <Plus size={14} />
                <span>Add First Vehicle</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {vehicles.map((v, idx) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#FFF5ED',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F05A22',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px', letterSpacing: '0.02em' }}>
                          {v.registrationNumber}
                        </span>
                        <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                          {v.vehicleCategory}
                        </span>
                        <span style={{ background: v.bodyType === 'Open Body' ? '#EFF6FF' : '#F5F3FF', color: v.bodyType === 'Open Body' ? '#2563EB' : '#7C3AED', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                          {v.bodyType}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Capacity: <strong>{v.capacity} {v.capacityUnit}</strong> • Ownership: {v.ownership}
                        {v.driverName ? ` • Driver: ${v.driverName} (${v.driverPhone || 'No Phone'})` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditVehicle(v)}
                      style={{ padding: '6px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicle(v.id)}
                      style={{ padding: '6px 10px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#E11D48', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 6: Transport Services */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">6</div>
            <div>
              <h3 className="card-title-text">Service Offerings</h3>
              <p className="card-subtitle-text">Transport service capabilities provided to clients.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SERVICES_OPTIONS.map((srv) => {
              const isSelected = selectedServices.includes(srv);
              return (
                <button
                  type="button"
                  key={srv}
                  className={`service-tag-pill ${isSelected ? 'selected' : ''}`}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: isSelected ? '1px solid #F05A22' : '1px solid #CBD5E1',
                    background: isSelected ? 'rgba(240, 90, 34, 0.12)' : '#FFFFFF',
                    color: isSelected ? '#F05A22' : '#334155',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => toggleService(srv)}
                >
                  {isSelected && <Check size={13} />}
                  <span>{srv}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 7: Document Vault (Company KYC & Vehicle Documents) */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">7</div>
            <div>
              <h3 className="card-title-text">Document Vault & Compliance</h3>
              <p className="card-subtitle-text">Mandatory transporter PAN, Bank Cheque, and vehicle-specific uploads.</p>
            </div>
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#172B4D', margin: '0 0 10px' }}>
            A. Transporter KYC Documents
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {/* PAN Card */}
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '12px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>Company PAN Card *</span>
                <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#FEE2E2', color: '#991B1B' }}>MANDATORY</span>
              </div>
              <input
                type="file"
                accept=".pdf,image/*"
                style={{ fontSize: '11px', width: '100%' }}
                onChange={(e) => setCompanyKycFiles({ ...companyKycFiles, panFile: e.target.files?.[0] || null })}
              />
              {companyKycFiles.panFile && (
                <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
                  ✓ {companyKycFiles.panFile.name}
                </div>
              )}
            </div>

            {/* Cancelled Cheque */}
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '12px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>Bank Cancelled Cheque *</span>
                <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#FEE2E2', color: '#991B1B' }}>MANDATORY</span>
              </div>
              <input
                type="file"
                accept=".pdf,image/*"
                style={{ fontSize: '11px', width: '100%' }}
                onChange={(e) => setCompanyKycFiles({ ...companyKycFiles, chequeFile: e.target.files?.[0] || null })}
              />
              {companyKycFiles.chequeFile && (
                <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
                  ✓ {companyKycFiles.chequeFile.name}
                </div>
              )}
            </div>

            {/* GST Certificate */}
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '12px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B' }}>GST Registration Certificate</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B' }}>OPTIONAL</span>
              </div>
              <input
                type="file"
                accept=".pdf,image/*"
                style={{ fontSize: '11px', width: '100%' }}
                onChange={(e) => setCompanyKycFiles({ ...companyKycFiles, gstFile: e.target.files?.[0] || null })}
              />
              {companyKycFiles.gstFile && (
                <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
                  ✓ {companyKycFiles.gstFile.name}
                </div>
              )}
            </div>

            {/* Declaration */}
            <div style={{ border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '12px', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B' }}>Transport Undertaking / Declaration</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B' }}>OPTIONAL</span>
              </div>
              <input
                type="file"
                accept=".pdf,image/*"
                style={{ fontSize: '11px', width: '100%' }}
                onChange={(e) => setCompanyKycFiles({ ...companyKycFiles, declarationFile: e.target.files?.[0] || null })}
              />
              {companyKycFiles.declarationFile && (
                <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
                  ✓ {companyKycFiles.declarationFile.name}
                </div>
              )}
            </div>
          </div>

          {vehicles.length > 0 && (
            <>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#172B4D', margin: '0 0 10px' }}>
                B. Vehicle-Specific Documents ({vehicles.length} Vehicle{vehicles.length > 1 ? 's' : ''})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vehicles.map((v) => (
                  <div key={v.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                        Vehicle: {v.registrationNumber} ({v.vehicleCategory} - {v.bodyType})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditVehicle(v)}
                        style={{ fontSize: '11.5px', color: '#F05A22', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Manage Vehicle Docs →
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: v.rcFile ? '#DCFCE7' : '#FEE2E2', color: v.rcFile ? '#166534' : '#991B1B', fontWeight: 600 }}>
                        RC: {v.rcFile ? 'Attached' : 'Missing'}
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: v.insuranceFile ? '#DCFCE7' : '#F1F5F9', color: v.insuranceFile ? '#166534' : '#64748B' }}>
                        Insurance: {v.insuranceFile ? 'Attached' : 'Optional'}
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: v.permitFile ? '#DCFCE7' : '#F1F5F9', color: v.permitFile ? '#166534' : '#64748B' }}>
                        Permit: {v.permitFile ? 'Attached' : 'Optional'}
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: v.pucFile ? '#DCFCE7' : '#F1F5F9', color: v.pucFile ? '#166534' : '#64748B' }}>
                        PUC: {v.pucFile ? 'Attached' : 'Optional'}
                      </span>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: v.driverDlFile ? '#DCFCE7' : '#F1F5F9', color: v.driverDlFile ? '#166534' : '#64748B' }}>
                        Driver DL: {v.driverDlFile ? 'Attached' : 'Optional'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Section 8: Account Settings & Verification Status */}
        <div className="vendor-form-card">
          <div className="vendor-card-header">
            <div className="step-num-circle">8</div>
            <div>
              <h3 className="card-title-text">Account Settings</h3>
              <p className="card-subtitle-text">Initial verification status and administrative onboarding notes.</p>
            </div>
          </div>

          <div className="form-two-col" style={{ marginBottom: 0 }}>
            <div className="form-field-group">
              <label>Initial Verification Status</label>
              <select
                value={formData.accountStatus}
                onChange={(e) => setFormData({ ...formData, accountStatus: e.target.value })}
                className="field-input-box"
              >
                <option value="PENDING">Pending Review (Default)</option>
                <option value="APPROVED">Verified & Approved</option>
              </select>
            </div>

            <div className="form-field-group">
              <label>Internal Onboarding Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Registered via Admin Desk - North East Region"
                value={formData.onboardingNotes}
                onChange={(e) => setFormData({ ...formData, onboardingNotes: e.target.value })}
                className="field-input-box"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="form-bottom-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn-form-cancel" onClick={onBack} disabled={isSubmitting}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-save-draft"
              onClick={() => handleSaveDraft(false)}
              disabled={isSavingDraft || isSubmitting}
              id="btn-save-draft-vendor"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#F1F5F9',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                height: '42px',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isSavingDraft ? <Loader size={15} className="spin-animate" /> : <Save size={15} />}
              <span>{isSavingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>
            <button type="submit" className="btn-send-invitation" disabled={isSubmitting} style={{ minWidth: '160px', justifyContent: 'center' }}>
              <Send size={15} />
              <span>{isSubmitting ? 'Registering...' : 'Save & Register Vendor'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Vehicle Add / Edit Modal */}
      {isVehicleModalOpen && (
        <div className="client-modal-overlay">
          <div className="client-modal-container" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="client-modal-header">
              <div>
                <h3 className="client-modal-title">
                  {editingVehicleId ? 'Edit Fleet Vehicle' : 'Add Fleet Vehicle'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Capture commercial vehicle specifications, driver assignment, and individual documents.
                </p>
              </div>
              <button className="client-modal-close" onClick={() => setIsVehicleModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="client-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {vehicleFormError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#B91C1C', fontSize: '13px' }}>
                  {vehicleFormError}
                </div>
              )}

              {/* Registration Number */}
              <div className="form-field-group">
                <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AS-01-EC-9944"
                  value={vehicleForm.registrationNumber}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value.toUpperCase() })}
                  className="client-field-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              {/* Vehicle Category & Body Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-field-group">
                  <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600 }}>
                    Vehicle Category *
                  </label>
                  <select
                    className="client-field-input"
                    value={vehicleForm.vehicleCategory}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleCategory: e.target.value as any })}
                  >
                    {VEHICLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600 }}>
                    Body Type *
                  </label>
                  <select
                    className="client-field-input"
                    value={vehicleForm.bodyType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, bodyType: e.target.value as any })}
                  >
                    {VEHICLE_BODY_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-field-group">
                  <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600 }}>
                    Vehicle Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15"
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                    className="client-field-input"
                  />
                </div>

                <div className="form-field-group">
                  <label className="field-label-req" style={{ fontSize: '13px', fontWeight: 600 }}>
                    Unit *
                  </label>
                  <select
                    className="client-field-input"
                    value={vehicleForm.capacityUnit}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacityUnit: e.target.value as any })}
                  >
                    {CAPACITY_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Associated Driver Information */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                  Associated Driver Information (Optional)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-field-group">
                    <label style={{ fontSize: '12px', color: '#475569' }}>Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Gurpreet Singh"
                      value={vehicleForm.driverName}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                      className="client-field-input"
                    />
                  </div>
                  <div className="form-field-group">
                    <label style={{ fontSize: '12px', color: '#475569' }}>Driver Mobile</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={vehicleForm.driverPhone}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value.replace(/\D/g, '') })}
                      className="client-field-input"
                    />
                  </div>
                  <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px', color: '#475569' }}>Driver Driving Licence Number</label>
                    <input
                      type="text"
                      placeholder="e.g. DL-0420220019284"
                      value={vehicleForm.driverLicence}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverLicence: e.target.value.toUpperCase() })}
                      className="client-field-input"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle-Specific Documents */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: '8px' }}>
                  Vehicle-Specific Documents
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* RC */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>RC (Registration Certificate) *</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, rcFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.rcFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.rcFile.name}</div>}
                  </div>

                  {/* Insurance */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Vehicle Insurance Certificate</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.insuranceFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.insuranceFile.name}</div>}
                  </div>

                  {/* C-Book / Fitness */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>C-Book / Fitness Certificate</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, cBookFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.cBookFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.cBookFile.name}</div>}
                  </div>

                  {/* Permit */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Vehicle Permit</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, permitFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.permitFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.permitFile.name}</div>}
                  </div>

                  {/* PUC */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Pollution Certificate (PUC)</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, pucFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.pucFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.pucFile.name}</div>}
                  </div>

                  {/* Driver DL */}
                  <div style={{ border: '1px dashed #CBD5E1', borderRadius: '6px', padding: '8px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>Driver Driving Licence (DL)</div>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ fontSize: '11px', width: '100%' }}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverDlFile: e.target.files?.[0] || null })}
                    />
                    {vehicleForm.driverDlFile && <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '2px' }}>✓ {vehicleForm.driverDlFile.name}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="client-modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsVehicleModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-modal-submit" onClick={handleSaveVehicleModal}>
                {editingVehicleId ? 'Update Vehicle' : 'Add Vehicle to Fleet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
