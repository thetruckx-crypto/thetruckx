import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Client Mobile App - My Bookings & Orders Screen Redesign Requirements', () => {
  const bookingsScreenPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/MyBookingsScreen.tsx'
  );
  const bookingsScreenCode = fs.readFileSync(bookingsScreenPath, 'utf-8');

  const bookingDetailsPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/BookingDetailsScreen.tsx'
  );
  const bookingDetailsCode = fs.readFileSync(bookingDetailsPath, 'utf-8');

  describe('1. Brand Identity & Design System Tokens', () => {
    it('should use the official primary navy (#0C1A34)', () => {
      expect(bookingsScreenCode).toContain("'#0C1A34'");
      expect(bookingDetailsCode).toContain("'#0C1A34'");
    });

    it('should use the official brand orange (#F15A24)', () => {
      expect(bookingsScreenCode).toContain("'#F15A24'");
      expect(bookingDetailsCode).toContain("'#F15A24'");
    });

    it('should use the page background (#F6F8FB) and card background (#FFFFFF)', () => {
      expect(bookingsScreenCode).toContain("'#F6F8FB'");
      expect(bookingsScreenCode).toContain("'#FFFFFF'");
      expect(bookingDetailsCode).toContain("'#F6F8FB'");
      expect(bookingDetailsCode).toContain("'#FFFFFF'");
    });

    it('should use primary text (#1D2D46) and secondary text (#667085)', () => {
      expect(bookingsScreenCode).toContain("'#1D2D46'");
      expect(bookingsScreenCode).toContain("'#667085'");
      expect(bookingDetailsCode).toContain("'#1D2D46'");
      expect(bookingDetailsCode).toContain("'#667085'");
    });
  });

  describe('2. Header & Page Title', () => {
    it('should render compact header with company logo and back button', () => {
      expect(bookingsScreenCode).toContain('<BrandLogoHeader size="sm" showSubtitle={false} />');
      expect(bookingsScreenCode).toContain('<ArrowLeft size={22} color="#1D2D46" strokeWidth={2.4} />');
      expect(bookingsScreenCode).toContain('onPress={onBack}');
    });

    it('should display the exact requested title and subtitle', () => {
      expect(bookingsScreenCode).toContain('My Bookings & Orders');
      expect(bookingsScreenCode).toContain('Manage your bookings, assigned vehicles, and shipment status.');
    });
  });

  describe('3. Functional Search Field', () => {
    it('should provide search input with placeholder and clear button', () => {
      expect(bookingsScreenCode).toContain('placeholder="Search by Booking ID, LR number, route..."');
      expect(bookingsScreenCode).toContain('<Search size={18} color="#667085" strokeWidth={2.2} />');
      expect(bookingsScreenCode).toContain("onPress={() => setSearchQuery('')}");
    });

    it('should support multi-attribute debounced search', () => {
      expect(bookingsScreenCode).toContain('debouncedQuery');
      expect(bookingsScreenCode).toContain('displayBookingId.toLowerCase().includes(debouncedQuery)');
      expect(bookingsScreenCode).toContain('lrNumber.includes(debouncedQuery)');
      expect(bookingsScreenCode).toContain('origin.includes(debouncedQuery)');
      expect(bookingsScreenCode).toContain('dest.includes(debouncedQuery)');
      expect(bookingsScreenCode).toContain('vehicleNum.includes(debouncedQuery)');
      expect(bookingsScreenCode).toContain('driverName.includes(debouncedQuery)');
    });
  });

  describe('4. Horizontally Scrollable 7 Status Filter Chips', () => {
    it('should support all 7 required status categories with dynamic counts', () => {
      expect(bookingsScreenCode).toContain("{ key: 'ALL', label: 'All' }");
      expect(bookingsScreenCode).toContain("{ key: 'PENDING', label: 'Pending' }");
      expect(bookingsScreenCode).toContain("{ key: 'CONFIRMED', label: 'Confirmed' }");
      expect(bookingsScreenCode).toContain("{ key: 'ASSIGNED', label: 'Assigned' }");
      expect(bookingsScreenCode).toContain("{ key: 'TRANSIT', label: 'Active / In Transit' }");
      expect(bookingsScreenCode).toContain("{ key: 'DELIVERED', label: 'Delivered' }");
      expect(bookingsScreenCode).toContain("{ key: 'CANCELLED', label: 'Cancelled' }");
      expect(bookingsScreenCode).toContain('statusCounts');
    });

    it('should distinguish selected (navy) and unselected (white with border) chip styles', () => {
      expect(bookingsScreenCode).toContain('filterChipSelected: {');
      expect(bookingsScreenCode).toContain("backgroundColor: '#0C1A34'");
      expect(bookingsScreenCode).toContain('filterChipUnselected: {');
      expect(bookingsScreenCode).toContain("backgroundColor: '#FFFFFF'");
    });

    it('should preserve search query when switching status filters', () => {
      expect(bookingsScreenCode).toContain('onPress={() => setSelectedFilter(chip.key)}');
    });
  });

  describe('5. Booking Cards & Information Display', () => {
    it('should show booking ID with copy action and formatted booking date', () => {
      expect(bookingsScreenCode).toContain('displayBookingId');
      expect(bookingsScreenCode).toContain('handleCopyId(displayBookingId)');
      expect(bookingsScreenCode).toContain('Booked on {bookingDate}');
    });

    it('should render route in ORIGIN ➔ DESTINATION layout', () => {
      expect(bookingsScreenCode).toContain('ORIGIN');
      expect(bookingsScreenCode).toContain('DESTINATION');
      expect(bookingsScreenCode).toContain('routeArrowText');
      expect(bookingsScreenCode).toContain('➔');
      expect(bookingsScreenCode).toContain('pickupCity');
      expect(bookingsScreenCode).toContain('destCity');
    });

    it('should show LR number badge with Live GPS shortcut when assigned', () => {
      expect(bookingsScreenCode).toContain('LR NUMBER');
      expect(bookingsScreenCode).toContain('lrNumber');
      expect(bookingsScreenCode).toContain('Live GPS');
    });

    it('should show assigned vehicle and driver details', () => {
      expect(bookingsScreenCode).toContain('vehicleNumber');
      expect(bookingsScreenCode).toContain('driverName');
    });

    it('should provide View Details, Track, and Cancel Booking actions', () => {
      expect(bookingsScreenCode).toContain('View Details');
      expect(bookingsScreenCode).toContain('onSelectBooking(b.id)');
      expect(bookingsScreenCode).toContain('Track');
      expect(bookingsScreenCode).toContain('onTrackShipment');
      expect(bookingsScreenCode).toContain('Cancel');
      expect(bookingsScreenCode).toContain('setCancelTargetBooking(b)');
    });

    it('should require confirmation before cancelling and allow selecting reason', () => {
      expect(bookingsScreenCode).toContain('Cancel Booking?');
      expect(bookingsScreenCode).toContain('Select Cancellation Reason');
      expect(bookingsScreenCode).toContain('clientService.cancelBooking');
    });
  });

  describe('6. Empty States Handling', () => {
    it('should show "No bookings yet" with Book a Shipment button when database is empty', () => {
      expect(bookingsScreenCode).toContain('No bookings yet');
      expect(bookingsScreenCode).toContain('Your confirmed bookings will appear here once you create a booking.');
      expect(bookingsScreenCode).toContain('Book a Shipment');
      expect(bookingsScreenCode).toContain('Track an Existing Shipment');
    });

    it('should show "No matching bookings" with Clear Search button when search returns 0', () => {
      expect(bookingsScreenCode).toContain('No matching bookings');
      expect(bookingsScreenCode).toContain('Try a different booking ID, LR number, or route.');
      expect(bookingsScreenCode).toContain('Clear Search');
    });

    it('should show "No bookings in this category" with View All button when filtered status is 0', () => {
      expect(bookingsScreenCode).toContain('No bookings in this category');
      expect(bookingsScreenCode).toContain('There are no bookings matching this status right now.');
      expect(bookingsScreenCode).toContain('View All Bookings');
    });

    it('should handle API / network errors with clear message and retry action', () => {
      expect(bookingsScreenCode).toContain('Failed to load bookings');
      expect(bookingsScreenCode).toContain('onPress={loadBookings}');
    });
  });

  describe('7. Booking Details Screen Requirements', () => {
    it('should show booking reference, status, and creation date', () => {
      expect(bookingDetailsCode).toContain('BOOKING REFERENCE');
      expect(bookingDetailsCode).toContain('displayBookingId');
      expect(bookingDetailsCode).toContain('Booked on');
    });

    it('should show consignment pickup and delivery locations', () => {
      expect(bookingDetailsCode).toContain('ORIGIN (PICKUP LOCATION)');
      expect(bookingDetailsCode).toContain('DESTINATION (DELIVERY LOCATION)');
      expect(bookingDetailsCode).toContain('PIN Code:');
    });

    it('should show consignor and consignee contacts', () => {
      expect(bookingDetailsCode).toContain('Consignor & Consignee Contacts');
      expect(bookingDetailsCode).toContain('Consignor (Sender)');
      expect(bookingDetailsCode).toContain('Consignee (Receiver)');
    });

    it('should show cargo specifications and capacity', () => {
      expect(bookingDetailsCode).toContain('Cargo & Shipment Specifications');
      expect(bookingDetailsCode).toContain('Material / Commodity');
      expect(bookingDetailsCode).toContain('Required Capacity / Weight');
    });

    it('should show assigned vehicle and driver with call driver button', () => {
      expect(bookingDetailsCode).toContain('Assigned Vehicle & Driver');
      expect(bookingDetailsCode).toContain('Vehicle Reg. Number');
      expect(bookingDetailsCode).toContain('Call Driver');
      expect(bookingDetailsCode).toContain('handleCallDriver');
    });

    it('should display booking and delivery milestones timeline', () => {
      expect(bookingDetailsCode).toContain('Booking & Delivery Timeline');
      expect(bookingDetailsCode).toContain('Booking Confirmed');
      expect(bookingDetailsCode).toContain('Lorry & Driver Assigned');
      expect(bookingDetailsCode).toContain('Cargo Dispatched & In Transit');
      expect(bookingDetailsCode).toContain('Delivered & POD Verified');
    });

    it('should provide tracking, documents, POD, and cancellation actions', () => {
      expect(bookingDetailsCode).toContain('Open Live Shipment Tracking');
      expect(bookingDetailsCode).toContain('onTrackShipment');
      expect(bookingDetailsCode).toContain('onViewDocuments');
      expect(bookingDetailsCode).toContain('onViewPod');
      expect(bookingDetailsCode).toContain('Cancel Booking');
    });
  });
});
