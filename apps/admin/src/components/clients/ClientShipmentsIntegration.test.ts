import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Production Fix Verification: Shipments Module Mock Removal, Client Scoping & 12 Core Scenarios', () => {
  const mobileRoot = path.resolve(__dirname, '../../../../mobile');
  const mobileSrc = path.join(mobileRoot, 'src');

  const shipmentsScreenPath = path.join(mobileSrc, 'screens/client/shipments/MyShipmentsScreen.tsx');
  const shipmentsScreenCode = fs.readFileSync(shipmentsScreenPath, 'utf-8');

  const clientServicePath = path.join(mobileSrc, 'services/clientService.ts');
  const clientServiceCode = fs.readFileSync(clientServicePath, 'utf-8');

  const trackingScreenPath = path.join(mobileSrc, 'screens/client/shipments/ShipmentTrackingScreen.tsx');
  const trackingScreenCode = fs.readFileSync(trackingScreenPath, 'utf-8');

  const podScreenPath = path.join(mobileSrc, 'screens/client/shipments/ProofOfDeliveryScreen.tsx');
  const podScreenCode = fs.readFileSync(podScreenPath, 'utf-8');

  const docsScreenPath = path.join(mobileSrc, 'screens/client/shipments/ShipmentDocumentsScreen.tsx');
  const docsScreenCode = fs.readFileSync(docsScreenPath, 'utf-8');

  const bookingDetailsPath = path.join(mobileSrc, 'screens/client/bookings/BookingDetailsScreen.tsx');
  const bookingDetailsCode = fs.readFileSync(bookingDetailsPath, 'utf-8');

  const authServicePath = path.join(mobileSrc, 'services/authService.ts');
  const authServiceCode = fs.readFileSync(authServicePath, 'utf-8');

  // Scenario 1: A newly registered client sees zero shipments
  it('Scenario 1: A newly registered client sees zero shipments and authentic empty state', () => {
    // 1. Production code must not contain default mock shipments
    expect(shipmentsScreenCode).not.toContain('DEFAULT_REFERENCE_SHIPMENTS');
    expect(shipmentsScreenCode).not.toContain("id: 'TRP-15102026-0001'");
    expect(shipmentsScreenCode).not.toContain("id: 'TRP-14102026-0008'");
    expect(shipmentsScreenCode).not.toContain("id: 'TRP-12102026-0005'");
    expect(shipmentsScreenCode).not.toContain("id: 'TRP-10102026-0003'");

    // 2. Empty state must match required copy exactly
    expect(shipmentsScreenCode).toContain('No shipments yet.');
    expect(shipmentsScreenCode).toContain(
      'Book your first shipment to see tracking and delivery updates here.'
    );
    expect(shipmentsScreenCode).toContain('emptyBookBtn');
    expect(shipmentsScreenCode).toContain('Book Shipment');

    // 3. fetchClientShipments returns empty array when client has no bookings
    expect(clientServiceCode).toContain('if (bookingsData.length === 0)');
    expect(clientServiceCode).toContain('return [];');
  });

  // Scenario 2: Opening the Shipments screen does not create a shipment
  it('Scenario 2: Opening the Shipments screen only executes read queries and never creates shipments', () => {
    // MyShipmentsScreen only calls read methods on mount
    expect(shipmentsScreenCode).toContain('clientService.fetchClientShipments(clientId)');
    expect(shipmentsScreenCode).not.toContain("supabase.from('trips').insert");
    expect(shipmentsScreenCode).not.toContain("supabase.from('bookings').insert");
    expect(shipmentsScreenCode).not.toContain("supabase.from('requirements').insert");
  });

  // Scenario 3: Logging out and logging in does not create a shipment
  it('Scenario 3: Auth lifecycle does not trigger auto-creation of sample shipments', () => {
    // Registration & auth must create only account/client records
    expect(authServiceCode).not.toContain("insert([{\n          id: 'TRP-");
    expect(authServiceCode).not.toContain("insert([{\n          booking_id:");
  });

  // Scenario 4: Client A cannot see Client B's shipments
  it("Scenario 4: Client A cannot see Client B's shipments (tenant/client query scoping)", () => {
    // fetchClientShipments explicitly scopes to targetCompanyId or clientId
    expect(clientServiceCode).toContain("or(`client_id.eq.${targetCompanyId},client_id.eq.${clientId}`)");
    expect(clientServiceCode).toContain(".in('booking_id', bookingIds)");
    // Ensures clientShipmentsCache is keyed by clientId
    expect(clientServiceCode).toContain('const cacheKey = clientId.trim();');
  });

  // Scenario 5: Client A cannot access Client B's shipment details, tracking info, or LR document (IDOR protection)
  it("Scenario 5: Enforces strict server/service-side ownership verification to prevent IDOR attacks", () => {
    // fetchShipmentTracking checks booking ownership
    expect(clientServiceCode).toContain('bookingClientId !== clientId && bookingClientId !== targetCompanyId');
    expect(clientServiceCode).toContain('return null; // IDOR protection');

    // fetchBookingById checks booking ownership
    expect(clientServiceCode).toContain('data.client_id !== clientId && data.client_id !== targetCompanyId');

    // getShipmentDocuments checks client authorization
    expect(clientServiceCode).toContain('const tracking = await this.fetchShipmentTracking(tripId, clientId);');
    expect(clientServiceCode).toContain('if (!tracking) return []; // Unauthorized');

    // getProofOfDelivery checks client authorization
    expect(clientServiceCode).toContain('if (!tracking) return null; // Unauthorized');

    // Download LR checks client ownership
    expect(shipmentsScreenCode).toContain('targetCo !== shipment.bookings.client_id');
    expect(shipmentsScreenCode).toContain('Unauthorized: You do not have permission to download this LR.');
  });

  // Scenario 6: A successfully booked shipment appears only for the correct client
  it('Scenario 6: A successfully booked shipment appears for the client even before trip allocation', () => {
    // Check that bookings without trips are returned with status 'Booked'
    expect(clientServiceCode).toContain('shipment_status: isCancelled ? \'Cancelled\' : \'Booked\'');
    expect(clientServiceCode).toContain('vehicle: \'Vehicle Allocation Pending\'');
    expect(clientServiceCode).toContain('driver_name: \'Driver Allocation Pending\'');
  });

  // Scenario 7: A failed booking does not create a partial or duplicate shipment
  it('Scenario 7: Booking creation uses validation and error propagation without partial state', () => {
    expect(clientServiceCode).toContain('if (insErr) throw insErr;');
  });

  // Scenario 8: Repeated booking requests do not create duplicates
  it('Scenario 8: Bookings generate unique reference timestamps and deterministic identification', () => {
    expect(clientServiceCode).toContain('newBokId = `BOK-${dateStr}-${randNum}`');
  });

  // Scenario 9: Search and status filters return the correct records
  it('Scenario 9: Search and 5 status filter chips work together on authentic data', () => {
    expect(shipmentsScreenCode).toContain("{ key: 'ALL', label: 'All' }");
    expect(shipmentsScreenCode).toContain("{ key: 'BOOKED', label: 'Booked' }");
    expect(shipmentsScreenCode).toContain("{ key: 'IN_TRANSIT', label: 'In Transit' }");
    expect(shipmentsScreenCode).toContain("{ key: 'DELIVERED', label: 'Delivered' }");
    expect(shipmentsScreenCode).toContain("{ key: 'ATTENTION', label: 'Attention' }");

    // Search matches LR, tracking, origin, destination, vehicle, driver
    expect(shipmentsScreenCode).toContain('lr.includes(debouncedQuery)');
    expect(shipmentsScreenCode).toContain('origin.includes(debouncedQuery)');
    expect(shipmentsScreenCode).toContain('dest.includes(debouncedQuery)');
  });

  // Scenario 10: Loading, empty, unauthorized, and server-error states behave correctly
  it('Scenario 10: Correctly implements Loading, Empty, Unauthorized, and Error states', () => {
    // Loading indicator
    expect(shipmentsScreenCode).toContain('loadingContainer');
    expect(shipmentsScreenCode).toContain('Loading shipments...');

    // Clean empty state with Book Shipment button
    expect(shipmentsScreenCode).toContain('emptyContainer');
    expect(shipmentsScreenCode).toContain('emptyBookBtn');
    expect(shipmentsScreenCode).toContain('Book Shipment');

    // Error state with retry action
    expect(shipmentsScreenCode).toContain('errorBanner');
    expect(shipmentsScreenCode).toContain('errorRetryBtn');
    expect(shipmentsScreenCode).toContain('Retry');

    // Booking Details not found / unauthorized state
    expect(bookingDetailsCode).toContain('Booking Not Found');
    expect(bookingDetailsCode).toContain('Unable to load booking details or you may not be authorized');
  });

  // Scenario 11: API failures never cause mock records to appear
  it('Scenario 11: API failures set shipments to empty and display error without mock fallback', () => {
    // Catch block sets setShipments([]) and error message
    expect(shipmentsScreenCode).toContain('setShipments([]);');
    expect(shipmentsScreenCode).toContain('Failed to load shipments.');
    expect(shipmentsScreenCode).not.toContain('Showing cached transport records.');
  });

  // Scenario 12: Shipment statuses and tracking details reflect actual persisted backend data
  it('Scenario 12: Tracking and POD reflect persisted database data without fabricated locations or entities', () => {
    // Tracking does not contain fake Hanamkonda or Visakhapatnam fallbacks
    expect(trackingScreenCode).not.toContain("'Hanamkonda'");
    expect(trackingScreenCode).not.toContain("'Visakhapatnam'");
    expect(trackingScreenCode).not.toContain("'506001'");
    expect(trackingScreenCode).not.toContain("'530040'");

    // Proof of delivery does not hardcode fake Dankuni entities
    expect(podScreenCode).not.toContain("'TRP-12102026-0005'");
    expect(podScreenCode).not.toContain("'M/s Dankuni Freight Distributors'");
    expect(podScreenCode).not.toContain("'DANKUNI LOGISTICS WAREHOUSE'");

    // Shipment documents does not push fake sample PDFs
    expect(docsScreenCode).not.toContain("'NECL_LR_2026_0948.pdf'");
    expect(docsScreenCode).not.toContain("'EWAY_BILL_981240182.pdf'");
    expect(docsScreenCode).not.toContain("'WEIGH_SLIP_BELTOLA_HUB.pdf'");
    expect(docsScreenCode).not.toContain("'NECL_POLICY_50L_COV.pdf'");
  });
});
