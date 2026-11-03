import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  Building2,
  MapPin,
  Truck,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Save,
  Loader2,
  Info
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { pincodeService } from '../../services/pincodeService';
import { generateDbTruckxId, generateDbNeclId } from '../../utils/idGenerator';

interface CreateRequirementProps {
  onBack: () => void;
  onCreated: (requirementId: string) => void;
}

interface ClientOption {
  id: string;
  company_name: string;
  client_code?: string;
  city?: string;
  state?: string;
  company_phone?: string;
}

export const CreateRequirement: React.FC<CreateRequirementProps> = ({
  onBack,
  onCreated,
}) => {
  // Client selection
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');

  // Pickup Details
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupPincode, setPickupPincode] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupState, setPickupState] = useState('');
  const [loadingPickupPin, setLoadingPickupPin] = useState(false);

  // Delivery Details
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [loadingDeliveryPin, setLoadingDeliveryPin] = useState(false);

  // Cargo Information
  const [materialType, setMaterialType] = useState('Industrial Goods');
  const [materialDescription, setMaterialDescription] = useState('');
  const [cargoWeight, setCargoWeight] = useState('20');
  const [weightUnit, setWeightUnit] = useState<'MT' | 'kg'>('MT');
  const [packageType, setPackageType] = useState('Palletized');
  const [isFragile, setIsFragile] = useState(false);
  const [isStackable, setIsStackable] = useState(true);
  const [isHazardous, setIsHazardous] = useState(false);

  // Vehicle Requirements
  const [vehicleType, setVehicleType] = useState('32FT_MXL');
  const [totalVehicles, setTotalVehicles] = useState('1');
  const [loadingDatetime, setLoadingDatetime] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });

  // Commercial & Special Instructions
  const [budgetScope, setBudgetScope] = useState('FIXED');
  const [targetBudget, setTargetBudget] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Fetch available registered clients
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        await ensureAdminSession();
        const { data, error: cErr } = await supabase
          .from('client_companies')
          .select('id, company_name, client_code, city, state, company_phone')
          .order('company_name', { ascending: true });

        if (cErr) throw cErr;
        setClients(data || []);
        if (data && data.length > 0) {
          setSelectedClientId(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load clients:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Handle Pickup Pincode lookup
  const handlePickupPincodeChange = async (pin: string) => {
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    setPickupPincode(cleanPin);
    if (cleanPin.length === 6) {
      setLoadingPickupPin(true);
      try {
        const details = await pincodeService.fetchPincode(cleanPin);
        if (details) {
          setPickupCity(details.city);
          setPickupState(details.state);
        }
      } catch (e) {
        console.warn('Pincode lookup error:', e);
      } finally {
        setLoadingPickupPin(false);
      }
    }
  };

  // Handle Delivery Pincode lookup
  const handleDeliveryPincodeChange = async (pin: string) => {
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    setDeliveryPincode(cleanPin);
    if (cleanPin.length === 6) {
      setLoadingDeliveryPin(true);
      try {
        const details = await pincodeService.fetchPincode(cleanPin);
        if (details) {
          setDeliveryCity(details.city);
          setDeliveryState(details.state);
        }
      } catch (e) {
        console.warn('Pincode lookup error:', e);
      } finally {
        setLoadingDeliveryPin(false);
      }
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedClientId) {
      setError('Please select a registered client or add a new client first.');
      return;
    }
    if (!pickupAddress.trim()) {
      setError('Pickup address is required.');
      return;
    }
    if (pickupPincode.length !== 6) {
      setError('Valid 6-digit pickup pincode is required.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setError('Destination address is required.');
      return;
    }
    if (deliveryPincode.length !== 6) {
      setError('Valid 6-digit destination pincode is required.');
      return;
    }

    const weightVal = parseFloat(cargoWeight);
    if (isNaN(weightVal) || weightVal <= 0) {
      setError('Cargo weight must be a positive number.');
      return;
    }

    const capacityMt = weightUnit === 'kg' ? weightVal / 1000 : weightVal;
    const numVehicles = parseInt(totalVehicles, 10) || 1;

    setSubmitting(true);
    try {
      await ensureAdminSession();

      // Generate canonical TRUCKX Requirement ID
      const reqId = await generateDbTruckxId('REQ');

      const pickupFull = pickupCity && pickupState
        ? `${pickupAddress.trim()}, ${pickupCity}, ${pickupState} ${pickupPincode}`
        : `${pickupAddress.trim()} - ${pickupPincode}`;

      const deliveryFull = deliveryCity && deliveryState
        ? `${deliveryAddress.trim()}, ${deliveryCity}, ${deliveryState} ${deliveryPincode}`
        : `${deliveryAddress.trim()} - ${deliveryPincode}`;

      const payload = {
        id: reqId,
        requirement_code: reqId,
        client_id: selectedClientId,
        pickup_address: pickupFull,
        pickup_pincode: pickupPincode,
        pickup_city: pickupCity || null,
        destination_address: deliveryFull,
        destination_pincode: deliveryPincode,
        destination_city: deliveryCity || null,
        origin: pickupCity || pickupAddress,
        destination: deliveryCity || deliveryAddress,
        vehicle_type: vehicleType,
        required_capacity_mt: capacityMt,
        material_type: materialType,
        material_description: materialDescription.trim() || null,
        package_type: packageType,
        is_fragile: isFragile,
        is_stackable: isStackable,
        is_hazardous: isHazardous,
        total_vehicles_count: numVehicles,
        loading_datetime: loadingDatetime ? new Date(loadingDatetime).toISOString() : new Date().toISOString(),
        budget_scope: budgetScope,
        target_budget: targetBudget ? parseFloat(targetBudget) : null,
        special_instructions: specialInstructions.trim() || null,
        status: 'UNDER_REVIEW',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase
        .from('requirements')
        .insert([payload]);

      if (insErr) throw insErr;

      setSuccessId(reqId);
      setTimeout(() => {
        onCreated(reqId);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to create requirement:', err);
      setError(err.message || 'Database error occurred while creating requirement.');
      setSubmitting(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="cli-dir-wrapper" style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb" style={{ marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: 600, fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Requirements</span>
        </button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current" style={{ fontWeight: 700, color: '#0F172A' }}>New Requirement</span>
      </div>

      {/* Header Banner */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#111827',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(17, 24, 39, 0.05)',
          border: '1px solid #E5EAF1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#FFF3EC',
              border: '1px solid #FFE8DF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={26} color="#F4510B" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.01em', color: '#111827' }}>
              Create Transport Requirement (RFQ)
            </h1>
            <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
              Specify client consignment, pickup and delivery freight corridors, and vehicle capacity.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          style={{
            background: '#FFFFFF',
            color: '#475569',
            border: '1px solid #D9E1EC',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Success Alert */}
      {successId && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #6EE7B7',
            color: '#065F46',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={20} color="#10B981" />
          <span>Requirement #{successId} created successfully! Redirecting to Sourcing & RFQ dashboard…</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section 1: Client Selection */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <Building2 size={20} color="#F05A22" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                1. Client Enterprise Account
              </h2>
            </div>

            {loadingClients ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                <Loader2 size={20} className="spin" style={{ display: 'inline', marginRight: '8px' }} />
                Loading registered clients…
              </div>
            ) : clients.length === 0 ? (
              <div style={{ padding: '16px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', color: '#92400E', fontSize: '13.5px' }}>
                No approved clients found. Please register a client first before creating a requirement.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label htmlFor="req-field-client" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Select Client Enterprise *
                  </label>
                  <select
                    id="req-field-client"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                    }}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} {c.client_code ? `(${c.client_code})` : ''} - {c.city || 'NE Hub'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClient && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12.5px',
                      color: '#64748B',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{selectedClient.company_name}</span>
                    <span>Location: {selectedClient.city || 'Guwahati'}, {selectedClient.state || 'Assam'}</span>
                    <span>Contact: {selectedClient.company_phone || 'Verified Client Enterprise'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2 & 3: Route Locations (Pickup & Destination) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>

            {/* Pickup Location */}
            <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <MapPin size={20} color="#10B981" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  2. Pickup / Origin
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="req-field-pickup-pincode" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Pickup Pincode *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="req-field-pickup-pincode"
                      type="text"
                      maxLength={6}
                      value={pickupPincode}
                      onChange={(e) => handlePickupPincodeChange(e.target.value)}
                      placeholder="e.g. 781001"
                      required
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                      }}
                    />
                    {loadingPickupPin && (
                      <Loader2 size={16} className="spin" style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8' }} />
                    )}
                  </div>
                  {pickupCity && (
                    <span style={{ fontSize: '11.5px', color: '#10B981', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                      ✓ Auto-detected: {pickupCity}, {pickupState}
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="req-field-pickup-address" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Pickup Address / Warehouse Details *
                  </label>
                  <textarea
                    id="req-field-pickup-address"
                    rows={2}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Factory, Inland Container Depot or Gate No."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Delivery Location */}
            <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <MapPin size={20} color="#F05A22" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  3. Delivery / Destination
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="req-field-delivery-pincode" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Delivery Pincode *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="req-field-delivery-pincode"
                      type="text"
                      maxLength={6}
                      value={deliveryPincode}
                      onChange={(e) => handleDeliveryPincodeChange(e.target.value)}
                      placeholder="e.g. 734001"
                      required
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                      }}
                    />
                    {loadingDeliveryPin && (
                      <Loader2 size={16} className="spin" style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8' }} />
                    )}
                  </div>
                  {deliveryCity && (
                    <span style={{ fontSize: '11.5px', color: '#10B981', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                      ✓ Auto-detected: {deliveryCity}, {deliveryState}
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor="req-field-delivery-address" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Destination Address / Consignee Hub *
                  </label>
                  <textarea
                    id="req-field-delivery-address"
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Transport Nagar, Consignee Plant or Unloading Bay"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section 4: Cargo & Vehicle Specifications */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <Truck size={20} color="#2563EB" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                4. Cargo & Vehicle Specifications
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="req-field-material-type" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Material / Commodity Type *
                </label>
                <input
                  id="req-field-material-type"
                  type="text"
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  placeholder="e.g. Steel Coils, Cement, FMCG"
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label htmlFor="req-field-vehicle-type" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Required Vehicle Type *
                </label>
                <select
                  id="req-field-vehicle-type"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    background: '#FFFFFF',
                  }}
                >
                  <option value="32FT_MXL">32 FT Multi-Axle Container (14-22 MT)</option>
                  <option value="32FT_SXL">32 FT Single-Axle Container (7-9 MT)</option>
                  <option value="20FT">20 FT Standard Container (8-12 MT)</option>
                  <option value="40FT_TRAILER">40 FT High-Capacity Trailer (28-40 MT)</option>
                  <option value="24FT_LORRY">24 FT Open Body Lorry (12-16 MT)</option>
                  <option value="19FT_LORRY">19 FT Open Body Lorry (8-10 MT)</option>
                  <option value="TAURUS_21T">Taurus 10-Wheeler (21 MT)</option>
                </select>
              </div>

              <div>
                <label htmlFor="req-field-cargo-weight" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Consignment Weight *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="req-field-cargo-weight"
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                    }}
                  />
                  <select
                    id="req-field-weight-unit"
                    value={weightUnit}
                    aria-label="Weight Unit"
                    onChange={(e) => setWeightUnit(e.target.value as 'MT' | 'kg')}
                    style={{
                      width: '80px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: '#F8FAFC',
                    }}
                  >
                    <option value="MT">MT</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="req-field-total-vehicles" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Number of Vehicles *
                </label>
                <input
                  id="req-field-total-vehicles"
                  type="number"
                  min="1"
                  max="50"
                  value={totalVehicles}
                  onChange={(e) => setTotalVehicles(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Packaging & Handling Flags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isStackable}
                  onChange={(e) => setIsStackable(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#F05A22' }}
                />
                <span>Stackable Cargo</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isFragile}
                  onChange={(e) => setIsFragile(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#F05A22' }}
                />
                <span>Fragile / Sensitive Material</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1E293B', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isHazardous}
                  onChange={(e) => setIsHazardous(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#DC2626' }}
                />
                <span>Hazardous (Hazmat / MSDS)</span>
              </label>
            </div>
          </div>

          {/* Section 5: Schedule & Commercial Information */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <Calendar size={20} color="#7C3AED" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                5. Schedule & Commercial Instructions
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="req-field-loading-datetime" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Target Loading Date & Time *
                </label>
                <input
                  id="req-field-loading-datetime"
                  type="datetime-local"
                  value={loadingDatetime}
                  onChange={(e) => setLoadingDatetime(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div>
                <label htmlFor="req-field-target-budget" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Target Freight Budget (Optional, ₹)
                </label>
                <input
                  id="req-field-target-budget"
                  type="number"
                  placeholder="e.g. 85000"
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="req-field-special-instructions" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Special Handling Instructions / Notes
              </label>
              <textarea
                id="req-field-special-instructions"
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Tarpaulin covers mandatory, Consignee gate pass required, Weight scale certificate needed..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13.5px',
                  resize: 'none',
                }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              style={{
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#F05A22',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.8 : 1,
                boxShadow: '0 4px 14px rgba(240, 90, 34, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Creating Requirement…</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Create Transport Requirement</span>
                </>
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};
