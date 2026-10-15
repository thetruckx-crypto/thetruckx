import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ClientProfile - Booking History Section Requirements', () => {
  const profileCode = fs.readFileSync(
    path.join(__dirname, 'ClientProfile.tsx'),
    'utf-8'
  );

  describe('1. Booking History Data & Relational Sourcing', () => {
    it('should query real bookings linked to client_id from database', () => {
      expect(profileCode).toContain('.from("bookings")');
      expect(profileCode).toContain('.eq("client_id", compData.id)');
      expect(profileCode).toContain('.order("confirmed_at", { ascending: false })');
    });

    it('should fetch associated trips for bookings from trips table', () => {
      expect(profileCode).toContain('.from("trips")');
      expect(profileCode).toContain('.in("booking_id", bookingIds)');
      expect(profileCode).toContain('vehicle_id, driver_id, vendor_id, vendor_rate, trip_status');
    });

    it('should fetch vehicles, drivers, vendor companies, and client quotes', () => {
      expect(profileCode).toContain('.from("vehicles").select("id, registration_number, vehicle_type")');
      expect(profileCode).toContain('.from("drivers").select("id, full_name, mobile")');
      expect(profileCode).toContain('.from("vendor_companies").select("id, vendor_name")');
      expect(profileCode).toContain('.from("client_quotes")');
    });

    it('should render all required fields in the table columns', () => {
      expect(profileCode).toContain('<th>Booking ID</th>');
      expect(profileCode).toContain('<th>Requirement ID</th>');
      expect(profileCode).toContain('<th>Quotation ID</th>');
      expect(profileCode).toContain('<th>Creation Date</th>');
      expect(profileCode).toContain('<th>Vendor Name</th>');
      expect(profileCode).toContain('<th>Trips Count</th>');
      expect(profileCode).toContain('<th>Booking Status</th>');
      expect(profileCode).toContain('<th>Trip Progress</th>');
      expect(profileCode).toContain('<th>Assigned Vehicle & Driver</th>');
      expect(profileCode).toContain('<th>Expected Delivery Date</th>');
      expect(profileCode).toContain('Actions</th>');
    });

    it('should handle missing fields gracefully with appropriate fallbacks or dashes', () => {
      expect(profileCode).toContain('b.vendor_name || "Pending Assignment"');
      expect(profileCode).toContain('"Unassigned"');
      expect(profileCode).toContain('expected_delivery_display = "—"');
      expect(profileCode).toContain('trip_progress_label = "No trips assigned"');
    });
  });

  describe('2. Accurate Booking Status vs Trip Status', () => {
    it('should strictly keep booking status and trip status distinct', () => {
      expect(profileCode).toContain('badge-booking-status');
      expect(profileCode).toContain('badge-trip-progress');
      expect(profileCode).toContain('b.booking_status');
      expect(profileCode).toContain('b.trip_progress_label');
    });

    it('should display trip progress with completion ratio and status without conflating booking status', () => {
      expect(profileCode).toContain('completedTripsCount');
      expect(profileCode).toContain('tripCount');
      expect(profileCode).toContain('${completedTripsCount}/${tripCount} Completed');
    });
  });

  describe('3. Booking Details Navigation', () => {
    it('should navigate to canonical /admin/bookings/:id on row or view button click', () => {
      expect(profileCode).toContain('navigate(`/admin/bookings/${bookingId}`)');
      expect(profileCode).toContain('handleNavigateToBooking(b.id)');
      expect(profileCode).toContain('<span>View Booking</span>');
    });
  });

  describe('4. Search and Filters', () => {
    it('should provide search across booking ID, requirement ID, quote ID, and vendor name', () => {
      expect(profileCode).toContain('placeholder="Search by Booking ID, Req ID, Quote ID, Vendor..."');
      expect(profileCode).toContain('b.id?.toLowerCase().includes(q)');
      expect(profileCode).toContain('b.displayId?.toLowerCase().includes(q)');
      expect(profileCode).toContain('b.requirement_id?.toLowerCase().includes(q)');
      expect(profileCode).toContain('b.quote_display_id?.toLowerCase().includes(q)');
      expect(profileCode).toContain('b.vendor_name?.toLowerCase().includes(q)');
    });

    it('should provide status dropdown filter for booking statuses', () => {
      expect(profileCode).toContain('bookingStatusFilter');
      expect(profileCode).toContain('<option value="ALL">All Statuses</option>');
      expect(profileCode).toContain('<option value="CONFIRMED">Confirmed</option>');
      expect(profileCode).toContain('<option value="IN_PROGRESS">In Progress</option>');
      expect(profileCode).toContain('<option value="COMPLETED">Completed</option>');
      expect(profileCode).toContain('<option value="CANCELLED">Cancelled</option>');
      expect(profileCode).toContain('<option value="CLIENT_ACCEPTED">Client Accepted</option>');
    });

    it('should provide date sort filter', () => {
      expect(profileCode).toContain('bookingDateSort');
      expect(profileCode).toContain('<option value="NEWEST">Newest First</option>');
      expect(profileCode).toContain('<option value="OLDEST">Oldest First</option>');
    });

    it('should provide pagination controls', () => {
      expect(profileCode).toContain('BOOKINGS_PAGE_SIZE');
      expect(profileCode).toContain('paginatedClientBookings');
      expect(profileCode).toContain('booking-pagination-footer');
    });
  });

  describe('5. Create Booking Workflow and Canonical ID Generation', () => {
    it('should enforce requirement prerequisite before confirming booking', () => {
      expect(profileCode).toContain('Transport Requirement Required');
      expect(profileCode).toContain('Under NECL operational policy, a transport requirement must be created');
      expect(profileCode).toContain('Create Transport Requirement');
    });

    it('should enforce accepted client quotation prerequisite', () => {
      expect(profileCode).toContain('Accepted Client Quotation Required');
      expect(profileCode).toContain('Under NECL commercial workflow, a booking requires an accepted client quotation');
    });

    it('should generate canonical atomic ID via generateDbNeclId("BK")', () => {
      expect(profileCode).toContain('await generateDbNeclId("BK")');
    });

    it('should guard against double submissions with isSubmittingAction', () => {
      expect(profileCode).toContain('if (!client || isSubmittingAction) return;');
      expect(profileCode).toContain('disabled={isSubmittingAction}');
    });

    it('should update requirement status to BOOKED upon confirmation', () => {
      expect(profileCode).toContain('.from("requirements")');
      expect(profileCode).toContain('.update({ status: "BOOKED" })');
    });
  });

  describe('6. Empty State Exact Text Specifications', () => {
    it('should render the exact required empty state heading', () => {
      expect(profileCode).toContain('No bookings found for this client.');
    });

    it('should render the exact required supporting text', () => {
      expect(profileCode).toContain(
        'Bookings will appear here after the required quotation and booking confirmation steps are completed.'
      );
    });

    it('should provide Create Booking button in empty state when user has permission', () => {
      expect(profileCode).toContain('hasPermission("bookings", "create")');
      expect(profileCode).toContain('btn-create-booking-primary');
    });
  });

  describe('7. UI/UX, Design Consistency, and Permissions', () => {
    it('should respect canViewMargins() for displaying quote amounts and margins', () => {
      expect(profileCode).toContain('canViewMargins()');
    });

    it('should respect hasPermission("bookings", "create") for create booking actions', () => {
      expect(profileCode).toContain('hasPermission("bookings", "create")');
    });

    it('should support switching to dedicated bookings tab', () => {
      expect(profileCode).toContain('activeTab === "bookings"');
      expect(profileCode).toContain('renderBookingHistoryCard(true)');
    });
  });
});
