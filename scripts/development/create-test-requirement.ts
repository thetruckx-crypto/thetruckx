/**
 * Script to create a realistic commercial freight requirement for an approved client
 * for end-to-end testing across Client App, Admin RFQ broadcast, Vendor Bidding,
 * and Admin PricingModule.
 */

import { supabase } from '../server/src/supabase';

async function createTestRequirement() {
  console.log('========================================================================');
  console.log('🚀 Creating Transport Requirement for Client Testing');
  console.log('========================================================================\n');

  // 1. Authenticate with Supabase Admin privileges
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123',
  });

  if (authError || !authData?.user) {
    console.error('❌ Failed to authenticate Supabase admin:', authError?.message);
    process.exit(1);
  }
  console.log('✅ Admin session authenticated successfully.');

  // 2. Fetch approved test client
  const { data: clientComp, error: clientErr } = await supabase
    .from('client_companies')
    .select('id, company_name, client_code, city, state, company_phone, company_email, status, client_users(id, full_name, mobile, email)')
    .eq('status', 'APPROVED')
    .limit(1)
    .single();

  if (clientErr || !clientComp) {
    console.error('❌ No approved client company found:', clientErr?.message);
    process.exit(1);
  }

  const clientId = clientComp.id;
  const clientUser = (clientComp.client_users as any)?.[0];
  console.log(`✅ Using Approved Client: "${clientComp.company_name}" (${clientComp.client_code || 'No Code'})`);
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Contact Person: ${clientUser?.full_name || 'Authorized Lead'} (${clientUser?.mobile || clientComp.company_phone || 'N/A'})\n`);

  // 3. Prepare realistic North East corridor requirement payload
  const timestamp = Date.now().toString().slice(-4);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const requirementId = `REQ-${dateStr}-${timestamp}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const vehicleGroups = [
    {
      entryId: `vg-${timestamp}-1`,
      vehicleTypeName: '32 FT Multi-Axle Container',
      bodyType: 'Closed Container High-Cube',
      capacityMt: 18.5,
      vehiclesNeeded: 1,
      dispatchSchedule: tomorrow.toISOString(),
    },
    {
      entryId: `vg-${timestamp}-2`,
      vehicleTypeName: '20 FT Single-Axle Container',
      bodyType: 'Closed Container',
      capacityMt: 9.0,
      vehiclesNeeded: 1,
      dispatchSchedule: tomorrow.toISOString(),
    },
  ];

  const payload: Record<string, any> = {
    id: requirementId,
    client_id: clientId,
    pickup_address: 'Inland Container Depot, Amingaon, Guwahati, Assam',
    pickup_pincode: '781031',
    destination_address: 'Dankuni Logistics Park, NH-19, Hooghly, Kolkata, West Bengal',
    destination_pincode: '712311',
    vehicle_type: '32 FT Multi-Axle Container',
    material_type: 'Processed CTC Tea Bags',
    commodity_type: 'Tea & Agricultural Commodities',
    required_capacity_mt: 27.5,
    total_cargo_weight: 27.5,
    weight_unit: 'MT',
    total_quantity: 480,
    unit_count: 480,
    package_type: 'Wooden Crates & Vacuum Pallets',
    package_mode: 'Palletized',
    package_description: '480 standard moisture-sealed wooden export crates',
    target_budget: '₹95,000 - ₹1,15,000',
    loading_datetime: tomorrow.toISOString(),
    special_instructions: 'Moisture-sensitive premium export grade CTC tea. Mandatory tarpaulin cover and container seal inspection prior to dispatch from Amingaon warehouse.',
    is_hazardous: false,
    is_fragile: false,
    is_stackable: true,
    is_moisture_sensitive: true,
    loading_point_weight_declared: 27.5,
    loading_point_quantity_declared: 480,
    vehicle_groups: vehicleGroups,
    total_vehicles_count: 2,
    total_requirement_entries_count: 2,
    status: 'NEW_REQUIREMENT',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 4. Insert into requirements table
  console.log('--- Inserting Requirement into Database ---');
  const { data: inserted, error: insertErr } = await supabase
    .from('requirements')
    .insert([payload])
    .select(`
      *,
      client_company:client_companies(
        id,
        company_name,
        client_code,
        city,
        state,
        company_phone,
        company_email
      )
    `)
    .single();

  if (insertErr) {
    console.warn('Extended columns insert error, trying base columns fallback:', insertErr.message);
    const basePayload = {
      id: requirementId,
      client_id: clientId,
      pickup_address: payload.pickup_address,
      pickup_pincode: payload.pickup_pincode,
      destination_address: payload.destination_address,
      destination_pincode: payload.destination_pincode,
      vehicle_type: payload.vehicle_type,
      material_type: payload.material_type,
      required_capacity_mt: payload.required_capacity_mt,
      loading_datetime: payload.loading_datetime,
      special_instructions: payload.special_instructions,
      status: 'NEW_REQUIREMENT',
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    };
    const { data: baseData, error: baseErr } = await supabase
      .from('requirements')
      .insert([basePayload])
      .select('*')
      .single();

    if (baseErr) {
      console.error('❌ Failed to insert requirement:', baseErr.message);
      process.exit(1);
    }
    console.log('✅ Requirement created with base columns:', baseData.id);
  } else {
    console.log('✅ Requirement created successfully with extended multi-vehicle specs:');
    console.log(`   Requirement ID: ${inserted.id}`);
    console.log(`   Client: ${inserted.client_company?.company_name} (${inserted.client_company?.client_code})`);
    console.log(`   Route: ${inserted.pickup_address} -> ${inserted.destination_address}`);
    console.log(`   Vehicles: ${inserted.total_vehicles_count} vehicles (${inserted.vehicle_type})`);
    console.log(`   Cargo: ${inserted.material_type} (${inserted.total_cargo_weight || inserted.required_capacity_mt} MT)`);
    console.log(`   Status: ${inserted.status}`);
  }

  // 5. Verify queryability by Admin Modules (PricingModule & RequirementsModule)
  console.log('\n--- Verifying Admin Module Queryability ---');
  const { data: verifyReq, error: verifyErr } = await supabase
    .from('requirements')
    .select(`
      id,
      pickup_address,
      destination_address,
      vehicle_type,
      material_type,
      required_capacity_mt,
      status,
      client_company:client_companies(
        id,
        company_name,
        client_code,
        company_phone,
        company_email,
        city,
        state
      )
    `)
    .eq('id', requirementId)
    .single();

  if (verifyErr || !verifyReq) {
    console.error('❌ Failed to query created requirement with client join:', verifyErr?.message);
    process.exit(1);
  }

  console.log('✅ Admin Query Verification PASSED:');
  console.log(`   Requirement Reference: ${verifyReq.id}`);
  const linkedCompany: any = Array.isArray(verifyReq.client_company) ? verifyReq.client_company[0] : verifyReq.client_company;
  console.log(`   Linked Client: ${linkedCompany?.company_name}`);
  console.log(`   Company Phone: ${linkedCompany?.company_phone}`);
  console.log(`   Company Email: ${linkedCompany?.company_email}`);
  console.log(`   Origin Hub: ${verifyReq.pickup_address}`);
  console.log(`   Destination Hub: ${verifyReq.destination_address}`);
  console.log(`   Status: ${verifyReq.status}`);

  console.log('\n========================================================================');
  console.log(`🎉 Requirement ${requirementId} is ready for live testing!`);
  console.log('========================================================================\n');
}

createTestRequirement().catch(console.error);
