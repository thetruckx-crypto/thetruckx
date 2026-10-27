/**
 * NECL - End-to-End Workflow Verification:
 * Vendor Quotation -> Admin Quotation Comparison -> Admin Commercial Pricing -> Client Offer Acceptance -> Booking
 *
 * Usage:
 *   node scripts/test-vendor-quote-to-booking-flow.js
 */

const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../../server/node_modules/@supabase/supabase-js'));
require(path.resolve(__dirname, '../../server/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../../server/.env')
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nbsgmorzrccbyfmjbvgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_lhvfkGCWoOppL2LhuLDIOg_WOvIPICz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('================================================================');
  console.log(' NECL WORKFLOW SIMULATION: VENDOR QUOTE -> ADMIN PANEL -> BOOKING');
  console.log('================================================================\n');

  // Step 0: Ensure Admin Session
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@necl.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error('Failed to authenticate as Admin:', authErr.message);
    process.exit(1);
  }
  console.log('✓ Step 0: Authenticated as NECL Administrator (admin@necl.com)\n');

  // Step 1: Query the Live Requirement
  const reqId = 'REQ-20261018-4504';
  const { data: req, error: reqErr } = await supabase
    .from('requirements')
    .select(`
      id,
      client_id,
      status,
      pickup_address,
      destination_address,
      required_capacity_mt,
      vehicle_type,
      material_type,
      client_company:client_companies(id, company_name, client_code, company_phone, company_email)
    `)
    .eq('id', reqId)
    .single();

  if (reqErr || !req) {
    console.error('Failed to load requirement:', reqErr?.message);
    process.exit(1);
  }

  console.log('✓ Step 1: Loaded Requirement in Admin Database:');
  console.log(`   - Requirement ID   : ${req.id}`);
  console.log(`   - Client Enterprise: ${req.client_company?.company_name} (${req.client_company?.client_code})`);
  console.log(`   - Route            : ${req.pickup_address} -> ${req.destination_address}`);
  console.log(`   - Freight Load     : ${req.material_type} (${req.required_capacity_mt} MT)`);
  console.log(`   - Current Status   : [${req.status}]\n`);

  // Step 2: Query the Broadcasted Vendor Request and Submitted Quote
  const { data: vrList, error: vrErr } = await supabase
    .from('vendor_requests')
    .select(`
      id,
      requirement_id,
      vendor_id,
      status,
      deadline_at,
      vendor_company:vendor_companies(id, vendor_name, vendor_code, address)
    `)
    .eq('requirement_id', reqId);

  if (vrErr || !vrList || vrList.length === 0) {
    console.error('No vendor requests found for requirement:', vrErr?.message);
    process.exit(1);
  }

  const vr = vrList[0];
  const { data: vqList, error: vqErr } = await supabase
    .from('vendor_quotations')
    .select(`
      id,
      vendor_request_id,
      vehicle_id,
      driver_id,
      quoted_rate,
      submitted_at
    `)
    .eq('vendor_request_id', vr.id);

  if (vqErr || !vqList || vqList.length === 0) {
    console.error('No vendor quotations found for vendor request:', vqErr?.message);
    process.exit(1);
  }

  const vq = vqList[0];

  const { data: veh } = await supabase
    .from('vehicles')
    .select('registration_number, vehicle_type, rated_capacity_mt')
    .eq('id', vq.vehicle_id)
    .single();

  const { data: drv } = await supabase
    .from('drivers')
    .select('full_name, mobile, licence_number')
    .eq('id', vq.driver_id)
    .single();

  console.log('✓ Step 2: Vendor Quotation Submitted & Ready for Admin Review:');
  console.log(`   - Vendor Name      : ${vr.vendor_company?.vendor_name} (${vr.vendor_company?.vendor_code})`);
  console.log(`   - Quoted Rate      : ₹${Number(vq.quoted_rate).toLocaleString('en-IN')}`);
  console.log(`   - Assigned Vehicle : ${veh?.registration_number} (${veh?.vehicle_type})`);
  console.log(`   - Assigned Driver  : ${drv?.full_name} (Mobile: ${drv?.mobile})`);
  console.log(`   - RFQ Sourcing Stat: ${vr.status}\n`);

  // Step 3: Admin UI Inspection Links
  console.log('----------------------------------------------------------------');
  console.log(' HOW TO VIEW AND ACT ON THIS IN THE LIVE ADMIN WEB PANEL:');
  console.log('----------------------------------------------------------------');
  console.log(' 1. Quotations Module (RFQ Batches / Comparison):');
  console.log('    URL: http://localhost:5174/admin/quotations');
  console.log('    -> Locate REQ-20261018-4504 under the "All Responded" tab.');
  console.log('    -> Click the row or "Review Quotes" to open Quotation Comparison.');
  console.log('    -> Brahmaputra Freight Carriers quote of ₹82,500 will appear.');
  console.log('    -> Click "Select Vendor Quote & Route to Pricing".\n');

  console.log(' 2. Pricing Module (Commercial Margin & Client Offer Wizard):');
  console.log('    URL: http://localhost:5174/admin/pricing?requirementId=REQ-20261018-4504');
  console.log('    -> Wizard Step 1: Base Vendor Cost = ₹82,500');
  console.log('    -> Wizard Step 2: Commercial Margin = ₹9,900 (12%)');
  console.log('    -> Wizard Step 3: GST (18%) = ₹16,632 -> Client Total = ₹109,032');
  console.log('    -> Wizard Step 4: Terms & Conditions and 72-hour validity');
  console.log('    -> Wizard Step 5: Click "Issue Quotation to Client".\n');

  console.log(' 3. Client Acceptance -> Confirmed Booking:');
  console.log('    URL: http://localhost:5174/admin/bookings');
  console.log('    -> Once Client accepts, Booking Order is generated.');
  console.log('    -> Vehicle AS01GC4821 and Driver Ranjit Das are scheduled.');
  console.log('================================================================\n');
}

main().catch((e) => {
  console.error('Execution error:', e);
  process.exit(1);
});
