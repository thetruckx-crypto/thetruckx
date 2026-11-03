import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Truck,
  FileText,
  User,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  DollarSign,
  Package,
  Calendar
} from 'lucide-react';
import { supabase, ensureAdminSession } from '../../utils/supabase';
import { generateDbTruckxId } from '../../utils/idGenerator';

interface CreateBookingProps {
  onBack: () => void;
  onCreated: (bookingId: string) => void;
}

interface RequirementItem {
  id: string;
  requirement_code?: string;
  client_id: string;
  client_name?: string;
  pickup_address: string;
  destination_address: string;
  vehicle_type: string;
  required_capacity_mt?: number;
  material_type?: string;
  status: string;
}

interface VendorItem {
  id: string;
  vendor_name: string;
  vendor_code?: string;
}

interface VehicleItem {
  id: string;
  registration_number: string;
  vehicle_type: string;
  rated_capacity_mt: number;
}

interface DriverItem {
  id: string;
  full_name: string;
  mobile: string;
  licence_number?: string;
}

export const CreateBooking: React.FC<CreateBookingProps> = ({
  onBack,
  onCreated,
}) => {
  // Data lists
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form selections
  const [selectedReqId, setSelectedReqId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [vendorRate, setVendorRate] = useState('');
  const [clientAmount, setClientAmount] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('50% Advance, 50% on Delivery');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Fetch eligible requirements, vendors, vehicles, and drivers
  useEffect(() => {
    const loadBookingResources = async () => {
      setLoadingData(true);
      try {
        await ensureAdminSession();

        const [reqRes, venRes, vehRes, drvRes] = await Promise.all([
          supabase
            .from('requirements')
            .select(`
              id, requirement_code, client_id, pickup_address, destination_address,
              vehicle_type, required_capacity_mt, material_type, status,
              client_companies(company_name)
            `)
            .in('status', ['QUOTED', 'UNDER_REVIEW', 'RFQ_SENT', 'NEW_REQUIREMENT'])
            .order('created_at', { ascending: false }),

          supabase
            .from('vendor_companies')
            .select('id, vendor_name, vendor_code')
            .order('vendor_name', { ascending: true }),

          supabase
            .from('vehicles')
            .select('id, registration_number, vehicle_type, rated_capacity_mt')
            .eq('status', 'ACTIVE')
            .order('registration_number', { ascending: true }),

          supabase
            .from('drivers')
            .select('id, full_name, mobile, licence_number')
            .order('full_name', { ascending: true }),
        ]);

        const mappedReqs = (reqRes.data || []).map((r: any) => ({
          id: r.id,
          requirement_code: r.requirement_code || r.id,
          client_id: r.client_id,
          client_name: r.client_companies?.company_name || 'Client Enterprise',
          pickup_address: r.pickup_address,
          destination_address: r.destination_address,
          vehicle_type: r.vehicle_type,
          required_capacity_mt: r.required_capacity_mt,
          material_type: r.material_type,
          status: r.status,
        }));

        setRequirements(mappedReqs);
        if (mappedReqs.length > 0) {
          setSelectedReqId(mappedReqs[0].id);
        }

        setVendors(venRes.data || []);
        if (venRes.data && venRes.data.length > 0) {
          setSelectedVendorId(venRes.data[0].id);
        }

        setVehicles(vehRes.data || []);
        if (vehRes.data && vehRes.data.length > 0) {
          setSelectedVehicleId(vehRes.data[0].id);
        }

        setDrivers(drvRes.data || []);
        if (drvRes.data && drvRes.data.length > 0) {
          setSelectedDriverId(drvRes.data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load booking resources:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadBookingResources();
  }, []);

  const selectedRequirement = requirements.find((r) => r.id === selectedReqId);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedReqId) {
      setError('Please select an eligible transport requirement.');
      return;
    }

    if (!selectedVendorId) {
      setError('Please select an authorized vendor transporter.');
      return;
    }

    if (!selectedVehicleId) {
      setError('Please allocate an eligible vehicle.');
      return;
    }

    if (!selectedDriverId) {
      setError('Please allocate a verified driver.');
      return;
    }

    setSubmitting(true);
    try {
      await ensureAdminSession();

      // Check if requirement already booked (prevent duplicate bookings)
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id, booking_status')
        .eq('requirement_id', selectedReqId)
        .maybeSingle();

      if (existingBooking) {
        throw new Error(`This requirement is already associated with Booking #${existingBooking.id}.`);
      }

      // Concurrency Overlap Guard: Check if selected vehicle is already active on an ongoing trip
      const { data: activeVehicleTrip } = await supabase
        .from('trips')
        .select('id, trip_code, trip_status')
        .eq('vehicle_id', selectedVehicleId)
        .not('trip_status', 'in', '("DELIVERED","COMPLETED","CANCELLED")')
        .limit(1)
        .maybeSingle();

      if (activeVehicleTrip) {
        throw new Error(`Vehicle is currently engaged in active Trip #${activeVehicleTrip.trip_code || activeVehicleTrip.id} (${activeVehicleTrip.trip_status}). Please complete or reassign the previous trip before new allocation.`);
      }

      // Concurrency Overlap Guard: Check if selected driver is already active on an ongoing trip
      const { data: activeDriverTrip } = await supabase
        .from('trips')
        .select('id, trip_code, trip_status')
        .eq('driver_id', selectedDriverId)
        .not('trip_status', 'in', '("DELIVERED","COMPLETED","CANCELLED")')
        .limit(1)
        .maybeSingle();

      if (activeDriverTrip) {
        throw new Error(`Driver is currently engaged in active Trip #${activeDriverTrip.trip_code || activeDriverTrip.id} (${activeDriverTrip.trip_status}). Please complete or reassign the previous trip before new allocation.`);
      }

      // Generate DB TRUCKX Booking ID
      const bookingId = await generateDbTruckxId('BK');

      const vRateNum = vendorRate ? parseFloat(vendorRate) : 80000;
      const cAmountNum = clientAmount ? parseFloat(clientAmount) : vRateNum * 1.15;

      // 1. Insert confirmed booking record
      const bookingPayload = {
        id: bookingId,
        booking_code: bookingId,
        booking_number: bookingId,
        requirement_id: selectedReqId,
        client_id: selectedRequirement?.client_id,
        booking_status: 'CONFIRMED',
        payment_status: 'PAYMENT_PENDING',
        confirmed_at: new Date().toISOString(),
        grand_total: cAmountNum,
        amount_received: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: bkgErr } = await supabase
        .from('bookings')
        .insert([bookingPayload]);

      if (bkgErr) throw bkgErr;

      // 2. Synchronize requirement status to BOOKED
      await supabase
        .from('requirements')
        .update({ status: 'BOOKED', updated_at: new Date().toISOString() })
        .eq('id', selectedReqId);

      // 3. Initialize active trip assignment record
      const tripId = await generateDbTruckxId('TR');
      const tripPayload = {
        id: tripId,
        trip_code: tripId,
        trip_number: tripId,
        booking_id: bookingId,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        vendor_id: selectedVendorId,
        vendor_rate: vRateNum,
        trip_status: 'LORRY_ASSIGNED',
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
      };

      const { error: tripErr } = await supabase
        .from('trips')
        .insert([tripPayload]);

      if (tripErr) {
        console.warn('Trip record creation warning:', tripErr.message);
      }

      setSuccessId(bookingId);
      setTimeout(() => {
        onCreated(bookingId);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to confirm booking:', err);
      setError(err.message || 'Database error occurred while confirming booking.');
      setSubmitting(false);
    }
  };

  return (
    <div className="cli-dir-wrapper" style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Breadcrumb Navigation */}
      <div className="page-breadcrumb" style={{ marginBottom: '16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: 600, fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Bookings</span>
        </button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current" style={{ fontWeight: 700, color: '#0F172A' }}>New Booking</span>
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
            <Truck size={26} color="#F4510B" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.01em', color: '#111827' }}>
              Confirm Transport Booking
            </h1>
            <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
              Convert client freight requirement into an official confirmed booking with fleet and driver allocation.
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
          <span>Booking #{successId} confirmed and trip initialized! Redirecting…</span>
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

      {/* Booking Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Requirement Selection */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <Package size={20} color="#F05A22" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                1. Transport Requirement / Cargo Consignment
              </h2>
            </div>

            {loadingData ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                <Loader2 size={20} className="spin" style={{ display: 'inline', marginRight: '8px' }} />
                Loading eligible requirements…
              </div>
            ) : requirements.length === 0 ? (
              <div style={{ padding: '16px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', color: '#92400E', fontSize: '13.5px' }}>
                No active requirements available for booking. Create a new transport requirement first.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label htmlFor="field-select-requirement" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Select Open Requirement *
                  </label>
                  <select
                    id="field-select-requirement"
                    value={selectedReqId}
                    onChange={(e) => setSelectedReqId(e.target.value)}
                    required
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
                    {requirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.requirement_code} - {r.client_name} ({r.vehicle_type}, {r.required_capacity_mt || 20} MT)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRequirement && (
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
                    <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                      {selectedRequirement.client_name}
                    </span>
                    <span>Route: {selectedRequirement.pickup_address} → {selectedRequirement.destination_address}</span>
                    <span>Cargo: {selectedRequirement.material_type || 'Industrial Goods'} ({selectedRequirement.required_capacity_mt || 20} MT)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Vendor & Commercial Terms */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <Building2 size={20} color="#2563EB" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                2. Transporter & Commercial Rate Agreement
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="field-select-vendor" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Assign Transporter Vendor *
                </label>
                <select
                  id="field-select-vendor"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  required
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
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name} {v.vendor_code ? `(${v.vendor_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="field-vendor-rate" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Agreed Vendor Cost (₹) *
                </label>
                <input
                  id="field-vendor-rate"
                  type="number"
                  placeholder="e.g. 75000"
                  value={vendorRate}
                  onChange={(e) => setVendorRate(e.target.value)}
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
                <label htmlFor="field-client-amount" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Client Grand Total (₹) *
                </label>
                <input
                  id="field-client-amount"
                  type="number"
                  placeholder="e.g. 88500"
                  value={clientAmount}
                  onChange={(e) => setClientAmount(e.target.value)}
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
          </div>

          {/* Section 3: Vehicle & Driver Allocation */}
          <div className="client-table-card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <User size={20} color="#10B981" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                3. Vehicle & Chauffeur Allocation
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label htmlFor="field-select-vehicle" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Allocate Active Vehicle *
                </label>
                <select
                  id="field-select-vehicle"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  required
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
                  {vehicles.map((vh) => (
                    <option key={vh.id} value={vh.id}>
                      {vh.registration_number} — {vh.vehicle_type} ({vh.rated_capacity_mt} MT)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="field-select-driver" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Allocate Verified Driver *
                </label>
                <select
                  id="field-select-driver"
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  required
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
                  {drivers.map((dr) => (
                    <option key={dr.id} value={dr.id}>
                      {dr.full_name} ({dr.mobile}) {dr.licence_number ? `- DL: ${dr.licence_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
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
                  <span>Confirming Booking…</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Confirm Booking & Initialize Trip</span>
                </>
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};
