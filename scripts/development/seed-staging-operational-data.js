/**
 * NECL Idempotent Staging Operational Seed Script
 * 
 * Safely seeds baseline staging data required for E2E workflows and audits:
 *   - 2 Enterprise Clients (Tyju Logistics & Tata Steel Logistics)
 *   - 3 Approved Transporter Vendors (Brahmaputra Freight, Assam Bengal Roadways, North East Express)
 *   - 3 Vendor Users with operational credentials
 *   - 4 Verified Commercial Vehicles with vendor-vehicle links
 *   - 4 Approved Commercial Drivers with primary vendor associations
 * 
 * Completely idempotent: Run safely multiple times without duplicate key errors.
 */

const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../../server/node_modules/@supabase/supabase-js'));
require(path.resolve(__dirname, '../../server/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../../server/.env'),
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedStagingData() {
  console.log('========================================================================');
  console.log(' NECL IDEMPOTENT STAGING OPERATIONAL DATA SEED GENERATOR');
  console.log('========================================================================\n');

  // Authenticate as Admin
  try {
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@necl.com',
      password: 'admin123',
    });
    if (authErr) {
      console.warn('Admin sign-in note (proceeding with public key):', authErr.message);
    } else {
      console.log('✓ Admin authenticated successfully.');
    }
  } catch (err) {
    console.warn('Auth notice:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 1. SEED CLIENT COMPANIES
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Enterprise Clients ---');
  const clientsToSeed = [
    {
      company_name: 'Tyju Logistics Pvt Ltd',
      gstin: '18AABCT1234A1Z5',
      pan: 'AABCT1234A',
      registered_address: 'Beltola Logistics Hub, Guwahati, Assam 781028',
      city: 'Guwahati',
      pincode: '781028',
      status: 'ACTIVE',
      user: {
        full_name: 'Tyju Logistics Lead',
        mobile: '9865110001',
        email: 'dispatch@tyjulogistics.com',
      },
    },
    {
      company_name: 'Tata Steel Northeast Distribution',
      gstin: '18AABCT5678B1Z2',
      pan: 'AABCT5678B',
      registered_address: 'Industrial Estate, Byrnihat, Meghalaya 793101',
      city: 'Byrnihat',
      pincode: '793101',
      status: 'ACTIVE',
      user: {
        full_name: 'Tata Supply Chain Manager',
        mobile: '9865110002',
        email: 'supplychain.ne@tatasteel.com',
      },
    },
  ];

  const seededClients = {};
  for (const client of clientsToSeed) {
    const { user, ...cData } = client;
    const { data: existing } = await supabase
      .from('client_companies')
      .select('id, company_name, status')
      .eq('company_name', cData.company_name)
      .maybeSingle();

    let clientId;
    if (existing) {
      clientId = existing.id;
      seededClients[cData.company_name] = clientId;
      console.log(`✓ [EXISTS] Client: ${existing.company_name} (ID: ${clientId})`);
    } else {
      const { data: created, error } = await supabase
        .from('client_companies')
        .insert([cData])
        .select('id, company_name, status')
        .single();

      if (error) {
        console.error(`✗ Error creating client ${cData.company_name}:`, error.message);
        continue;
      }
      clientId = created.id;
      seededClients[cData.company_name] = clientId;
      console.log(`✓ [CREATED] Client: ${created.company_name} (ID: ${clientId})`);
    }

    // Seed client user
    if (clientId && user) {
      const { data: existingUser } = await supabase
        .from('client_users')
        .select('id, full_name')
        .eq('mobile', user.mobile)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('client_users').insert([
          {
            client_id: clientId,
            full_name: user.full_name,
            mobile: user.mobile,
            email: user.email,
            status: 'ACTIVE',
          },
        ]);
        console.log(`  ✓ Linked User: ${user.full_name} (${user.mobile})`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. SEED VENDOR COMPANIES & USERS
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Transporter Vendors & Vendor Users ---');
  const vendorsToSeed = [
    {
      vendor_name: 'Brahmaputra Freight Carriers',
      vendor_code: 'VND-001',
      pan: 'AABCB1234A',
      gstin: '18AABCB1234A1Z1',
      address: 'Amingaon Logistics Park, Guwahati, Assam 781031',
      status: 'APPROVED',
      compliance_status: 'APPROVED',
      onboarding_source: 'SELF_REGISTERED',
      approved_at: new Date().toISOString(),
      user: {
        full_name: 'Brahmaputra Dispatch Desk',
        mobile: '9864000001',
        email: 'dispatch@brahmaputrafreight.com',
      },
    },
    {
      vendor_name: 'Assam Bengal Roadways',
      vendor_code: 'VND-002',
      pan: 'AABCA5678B',
      gstin: '18AABCA5678B1Z3',
      address: 'Beltola Transport Nagar, Guwahati, Assam 781028',
      status: 'APPROVED',
      compliance_status: 'APPROVED',
      onboarding_source: 'SELF_REGISTERED',
      approved_at: new Date().toISOString(),
      user: {
        full_name: 'ABR Fleet Operations',
        mobile: '9864000002',
        email: 'operations@assambengal.com',
      },
    },
    {
      vendor_name: 'North East Express Lines',
      vendor_code: 'VND-003',
      pan: 'AABCN9012C',
      gstin: '18AABCN9012C1Z8',
      address: 'Byrnihat Highway Yard, Ri-Bhoi, Meghalaya 793101',
      status: 'APPROVED',
      compliance_status: 'APPROVED',
      onboarding_source: 'SELF_REGISTERED',
      approved_at: new Date().toISOString(),
      user: {
        full_name: 'NEEL Dispatch Officer',
        mobile: '9864000003',
        email: 'fleet@northeastexpress.in',
      },
    },
  ];

  const seededVendors = {};
  for (const v of vendorsToSeed) {
    const { user, ...vData } = v;
    const { data: existing } = await supabase
      .from('vendor_companies')
      .select('id, vendor_name, vendor_code, status')
      .or(`vendor_name.eq.${vData.vendor_name},pan.eq.${vData.pan}`)
      .maybeSingle();

    let vendorId;
    if (existing) {
      vendorId = existing.id;
      seededVendors[vData.vendor_name] = vendorId;
      console.log(`✓ [EXISTS] Vendor: ${existing.vendor_name} (ID: ${vendorId})`);
    } else {
      const { data: created, error } = await supabase
        .from('vendor_companies')
        .insert([vData])
        .select('id, vendor_name, vendor_code, status')
        .single();

      if (error) {
        console.error(`✗ Error creating vendor ${vData.vendor_name}:`, error.message);
        continue;
      }
      vendorId = created.id;
      seededVendors[vData.vendor_name] = vendorId;
      console.log(`✓ [CREATED] Vendor: ${created.vendor_name} (ID: ${vendorId})`);
    }

    // Seed vendor user
    if (vendorId && user) {
      const { data: existingUser } = await supabase
        .from('vendor_users')
        .select('id, full_name')
        .eq('mobile', user.mobile)
        .maybeSingle();

      if (!existingUser) {
        const { error: uErr } = await supabase.from('vendor_users').insert([
          {
            vendor_id: vendorId,
            full_name: user.full_name,
            mobile: user.mobile,
            email: user.email,
            status: 'ACTIVE',
          },
        ]);
        if (uErr) {
          console.warn(`  Notice creating user for ${vData.vendor_name}:`, uErr.message);
        } else {
          console.log(`  ✓ Linked User: ${user.full_name} (${user.mobile})`);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. SEED FLEET VEHICLES & VENDOR LINKS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Fleet Vehicles & Transporter Links ---');
  const vehiclesToSeed = [
    {
      registration_number: 'AS01GC9988',
      vehicle_type: '32 FT Multi-Axle Container',
      body_type: 'Closed Container',
      rated_capacity_mt: 25.0,
      minimum_capacity_mt: 12.0,
      rc_number: 'AS01GC9988',
      status: 'ACTIVE',
      verification_status: 'APPROVED',
      eligible_for_operations: true,
      vendor_name: 'Brahmaputra Freight Carriers',
    },
    {
      registration_number: 'AS01EC1234',
      vehicle_type: '40 FT High Bed Trailer',
      body_type: 'High Bed Trailer',
      rated_capacity_mt: 35.0,
      minimum_capacity_mt: 20.0,
      rc_number: 'AS01EC1234',
      status: 'ACTIVE',
      verification_status: 'APPROVED',
      eligible_for_operations: true,
      vendor_name: 'Brahmaputra Freight Carriers',
    },
    {
      registration_number: 'ML05D5678',
      vehicle_type: '20 FT Container',
      body_type: 'Closed Container',
      rated_capacity_mt: 15.0,
      minimum_capacity_mt: 7.0,
      rc_number: 'ML05D5678',
      status: 'ACTIVE',
      verification_status: 'APPROVED',
      eligible_for_operations: true,
      vendor_name: 'Assam Bengal Roadways',
    },
    {
      registration_number: 'NL01A9012',
      vehicle_type: '32 FT Multi-Axle Container',
      body_type: 'Closed Container',
      rated_capacity_mt: 25.0,
      minimum_capacity_mt: 12.0,
      rc_number: 'NL01A9012',
      status: 'ACTIVE',
      verification_status: 'APPROVED',
      eligible_for_operations: true,
      vendor_name: 'North East Express Lines',
    },
  ];

  const seededVehicles = {};
  for (const veh of vehiclesToSeed) {
    const { vendor_name, ...vData } = veh;
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, registration_number, verification_status')
      .eq('registration_number', vData.registration_number)
      .maybeSingle();

    let vehicleId;
    if (existing) {
      vehicleId = existing.id;
      seededVehicles[vData.registration_number] = vehicleId;
      console.log(`✓ [EXISTS] Vehicle: ${vData.registration_number} (ID: ${vehicleId})`);
    } else {
      const { data: created, error } = await supabase
        .from('vehicles')
        .insert([vData])
        .select('id, registration_number')
        .single();

      if (error) {
        console.error(`✗ Error creating vehicle ${vData.registration_number}:`, error.message);
        continue;
      }
      vehicleId = created.id;
      seededVehicles[vData.registration_number] = vehicleId;
      console.log(`✓ [CREATED] Vehicle: ${vData.registration_number} (ID: ${vehicleId})`);
    }

    // Link vehicle to vendor
    const vendorId = seededVendors[vendor_name];
    if (vehicleId && vendorId) {
      const { error: linkErr } = await supabase.from('vendor_vehicle_links').upsert(
        [
          {
            vendor_id: vendorId,
            vehicle_id: vehicleId,
            status: 'APPROVED',
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'vendor_id,vehicle_id' }
      );
      if (!linkErr) {
        console.log(`  ✓ Linked to ${vendor_name}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. SEED COMMERCIAL DRIVERS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Commercial Drivers ---');
  const driversToSeed = [
    {
      full_name: 'Bikash Bora',
      mobile: '9864998877',
      licence_number: 'AS0120230099887',
      licence_expiry_date: '2029-12-31',
      date_of_birth: '1988-06-15',
      status: 'APPROVED',
      verification_status: 'APPROVED',
      is_active: true,
      vendor_name: 'Brahmaputra Freight Carriers',
    },
    {
      full_name: 'Ranjan Gogoi',
      mobile: '9864112233',
      licence_number: 'AS0120220011223',
      licence_expiry_date: '2028-09-30',
      date_of_birth: '1990-03-22',
      status: 'APPROVED',
      verification_status: 'APPROVED',
      is_active: true,
      vendor_name: 'Brahmaputra Freight Carriers',
    },
    {
      full_name: 'Deepak Sharma',
      mobile: '9864556677',
      licence_number: 'ML0520210055667',
      licence_expiry_date: '2027-11-15',
      date_of_birth: '1985-12-10',
      status: 'APPROVED',
      verification_status: 'APPROVED',
      is_active: true,
      vendor_name: 'Assam Bengal Roadways',
    },
    {
      full_name: 'Suraj Das',
      mobile: '9864778899',
      licence_number: 'NL0120200077889',
      licence_expiry_date: '2030-05-20',
      date_of_birth: '1992-08-05',
      status: 'APPROVED',
      verification_status: 'APPROVED',
      is_active: true,
      vendor_name: 'North East Express Lines',
    },
  ];

  for (const drv of driversToSeed) {
    const { vendor_name, ...dData } = drv;
    const vendorId = seededVendors[vendor_name];

    const { data: existing } = await supabase
      .from('drivers')
      .select('id, full_name, mobile, status')
      .eq('mobile', dData.mobile)
      .maybeSingle();

    if (existing) {
      if (vendorId) {
        await supabase
          .from('drivers')
          .update({ primary_vendor_id: vendorId, status: 'APPROVED', verification_status: 'APPROVED' })
          .eq('id', existing.id);
      }
      console.log(`✓ [EXISTS] Driver: ${existing.full_name} (${existing.mobile}) (ID: ${existing.id})`);
    } else {
      if (!vendorId) {
        console.warn(`  Warning: Vendor ${vendor_name} not found for driver ${dData.full_name}`);
        continue;
      }
      const { data: created, error } = await supabase
        .from('drivers')
        .insert([{ ...dData, primary_vendor_id: vendorId }])
        .select('id, full_name, mobile')
        .single();

      if (error) {
        console.error(`✗ Error creating driver ${dData.full_name}:`, error.message);
      } else {
        console.log(`✓ [CREATED] Driver: ${created.full_name} (${created.mobile}) (ID: ${created.id})`);
      }
    }
  }

  console.log('\n========================================================================');
  console.log(' STAGING OPERATIONAL DATA SEED COMPLETED SUCCESSFULLY');
  console.log('========================================================================\n');
}

seedStagingData().catch((err) => {
  console.error('Fatal seed failure:', err);
  process.exit(1);
});
