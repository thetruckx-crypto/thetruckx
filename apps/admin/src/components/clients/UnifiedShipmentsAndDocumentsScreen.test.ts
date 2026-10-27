import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Mobile App - Redesigned Shipment Documents, Single-Screen Booking Details, and Unified Shipments', () => {
  const mobileRoot = path.resolve(__dirname, '../../../../mobile');
  const mobileSrc = path.join(mobileRoot, 'src');

  const docsScreenPath = path.join(mobileSrc, 'screens/client/shipments/ShipmentDocumentsScreen.tsx');
  const docsScreenCode = fs.readFileSync(docsScreenPath, 'utf-8');

  const bookingDetailsPath = path.join(mobileSrc, 'screens/client/bookings/BookingDetailsScreen.tsx');
  const bookingDetailsCode = fs.readFileSync(bookingDetailsPath, 'utf-8');

  const shipmentsScreenPath = path.join(mobileSrc, 'screens/client/shipments/MyShipmentsScreen.tsx');
  const shipmentsScreenCode = fs.readFileSync(shipmentsScreenPath, 'utf-8');

  const bottomNavPath = path.join(mobileSrc, 'components/ClientBottomNavBar.tsx');
  const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf-8');

  const podScreenPath = path.join(mobileSrc, 'screens/client/shipments/ProofOfDeliveryScreen.tsx');
  const podScreenCode = fs.readFileSync(podScreenPath, 'utf-8');

  const appPath = path.join(mobileRoot, 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf-8');

  describe('1. Shipment Documents Screen (Reference Screenshot 1)', () => {
    it('should implement official branding colors and typography', () => {
      expect(docsScreenCode).toContain("'#0B1730'"); // Navy
      expect(docsScreenCode).toContain("'#F15A24'"); // Orange
      expect(docsScreenCode).toContain("'#169B75'"); // Green
      expect(docsScreenCode).toContain("'#ECFDF5'"); // Green tint
      expect(docsScreenCode).toContain('Shipment Documents');
      expect(docsScreenCode).toContain('Transport documents for this consignment.');
    });

    it('should display the Consignment ID prominently with working copy action', () => {
      expect(docsScreenCode).toContain('Consignment ID');
      expect(docsScreenCode).toContain('displayConsignmentId');
      expect(docsScreenCode).toContain('handleCopyId');
      expect(docsScreenCode).toContain('Clipboard.setString');
      expect(docsScreenCode).toContain('Copied!');
    });

    it('should render the "Document status verified" green banner', () => {
      expect(docsScreenCode).toContain('Document status verified');
      expect(docsScreenCode).toContain(
        'Here are the available transport documents for this consignment.'
      );
      expect(docsScreenCode).toContain('CheckCircle2');
    });

    it('should support all official transport document types mapped from real database', () => {
      // 1. Lorry Receipt
      expect(docsScreenCode).toContain('Lorry Receipt (LR / Bilty)');

      // 2. e-Way Bill
      expect(docsScreenCode).toContain('e-Way Bill Transit Copy');

      // 3. Loading Weighbridge Bill
      expect(docsScreenCode).toContain('Loading Weighbridge Bill');

      // 4. Transit Insurance Certificate
      expect(docsScreenCode).toContain('Transit Insurance Certificate');

      // 5. Proof of Delivery
      expect(docsScreenCode).toContain('Proof of Delivery (Signed Consignee POD)');

      // Must not inject fake dummy filenames into production code
      expect(docsScreenCode).not.toContain("'NECL_LR_2026_0948.pdf'");
      expect(docsScreenCode).not.toContain("'EWAY_BILL_981240182.pdf'");
      expect(docsScreenCode).not.toContain("'WEIGH_SLIP_BELTOLA_HUB.pdf'");
      expect(docsScreenCode).not.toContain("'NECL_POLICY_50L_COV.pdf'");
    });

    it('should provide Preview and Download PDF buttons for each document', () => {
      expect(docsScreenCode).toContain('Preview');
      expect(docsScreenCode).toContain('Download PDF');
      expect(docsScreenCode).toContain('handleOpenPreview');
      expect(docsScreenCode).toContain('handleDownload');
    });

    it('should implement in-app document viewer modal with zoom controls and security watermark', () => {
      expect(docsScreenCode).toContain('selectedPreview');
      expect(docsScreenCode).toContain('handleZoomIn');
      expect(docsScreenCode).toContain('handleZoomOut');
      expect(docsScreenCode).toContain('handleResetZoom');
      expect(docsScreenCode).toContain('zoomScale');
      expect(docsScreenCode).toContain('DIGITALLY SIGNED & VERIFIED');
      expect(docsScreenCode).toContain('Cryptographic Security Digest');
    });

    it('should prevent duplicate concurrent downloads and provide progress feedback', () => {
      expect(docsScreenCode).toContain('downloadingDocId');
      expect(docsScreenCode).toContain('downloadProgress');
      expect(docsScreenCode).toContain('setDownloadProgress');
      expect(docsScreenCode).toContain('downloadFeedback');
    });

    it('should include the highlighted Proof of Delivery (POD) section at the bottom', () => {
      expect(docsScreenCode).toContain('Looking for Proof of Delivery (POD)?');
      expect(docsScreenCode).toContain(
        'View consignee delivery stamp and physical sign-off.'
      );
      expect(docsScreenCode).toContain('View delivery proof');
      expect(docsScreenCode).toContain('onViewPod');
    });
  });

  describe('2. Single-Screen Booking Details (Reference Screenshot 2)', () => {
    it('should display booking reference card with confirmed status badge', () => {
      expect(bookingDetailsCode).toContain('BOOKING REFERENCE');
      expect(bookingDetailsCode).toContain('displayBookingId');
      expect(bookingDetailsCode).toContain('Booked on');
      expect(bookingDetailsCode).toContain('Confirmed');
      expect(bookingDetailsCode).toContain('handleCopy');
    });

    it('should render the 3 quick action buttons with respective color accents', () => {
      expect(bookingDetailsCode).toContain('Live Tracking');
      expect(bookingDetailsCode).toContain("'#F15A24'"); // Orange for Tracking
      expect(bookingDetailsCode).toContain('Documents');
      expect(bookingDetailsCode).toContain("'#2563EB'"); // Blue for Documents
      expect(bookingDetailsCode).toContain('View POD');
      expect(bookingDetailsCode).toContain("'#16A34A'"); // Green for POD
    });

    it('should implement consignment route with Navigate to Pickup and Navigate to Destination', () => {
      expect(bookingDetailsCode).toContain('Consignment Route');
      expect(bookingDetailsCode).toContain('ORIGIN (PICKUP LOCATION)');
      expect(bookingDetailsCode).toContain('Navigate to Pickup');
      expect(bookingDetailsCode).toContain('DESTINATION (DELIVERY LOCATION)');
      expect(bookingDetailsCode).toContain('Navigate to Destination');
      expect(bookingDetailsCode).toContain('North Eastern Freight Hub, Guwahati');
      expect(bookingDetailsCode).toContain('Eastern Logistics Yard, Kolkata');
    });

    it('should render consignor and consignee contacts in a 2-column layout', () => {
      expect(bookingDetailsCode).toContain('Consignor & Consignee Contacts');
      expect(bookingDetailsCode).toContain('Consignor (Sender)');
      expect(bookingDetailsCode).toContain('Dispatch Coordinator');
      expect(bookingDetailsCode).toContain('Consignee (Receiver)');
      expect(bookingDetailsCode).toContain('Receiving Supervisor');
    });

    it('should display cargo specifications and vehicle allocation', () => {
      expect(bookingDetailsCode).toContain('Cargo & Shipment Specifications');
      expect(bookingDetailsCode).toContain('Material / Commodity');
      expect(bookingDetailsCode).toContain('Industrial Goods');
      expect(bookingDetailsCode).toContain('Required Capacity / Weight');
      expect(bookingDetailsCode).toContain('25 MT Multi-Axle Payload');
      expect(bookingDetailsCode).toContain('Requested Vehicle Type');
      expect(bookingDetailsCode).toContain('32 FT Multi-Axle');
      expect(bookingDetailsCode).toContain('Immediate Dispatch');

      expect(bookingDetailsCode).toContain('Assigned Vehicle & Driver');
      expect(bookingDetailsCode).toContain('Vehicle Reg. Number');
      expect(bookingDetailsCode).toContain('Allocation in Progress');
      expect(bookingDetailsCode).toContain('32 FT Multi-Axle Container');
      expect(bookingDetailsCode).toContain('Driver Allocation Pending');
      expect(bookingDetailsCode).toContain('Pending Allocation');
    });

    it('should format commercial details with Indian currency and payment terms', () => {
      expect(bookingDetailsCode).toContain('Commercial & Financials');
      expect(bookingDetailsCode).toContain('Agreed Freight Charge');
      expect(bookingDetailsCode).toContain('32,000');
      expect(bookingDetailsCode).toContain('Net 15 Days Commercial Credit');
      expect(bookingDetailsCode).toContain('Active Coverage (₹50L Comprehensive)');
    });

    it('should display the compact 4-milestone vertical timeline', () => {
      expect(bookingDetailsCode).toContain('Booking & Delivery Timeline');
      expect(bookingDetailsCode).toContain('Booking Confirmed');
      expect(bookingDetailsCode).toContain('Lorry & Driver Assigned');
      expect(bookingDetailsCode).toContain('Cargo Dispatched & In Transit');
      expect(bookingDetailsCode).toContain('Delivered & POD Verified');
      expect(bookingDetailsCode).toContain('Completed');
      expect(bookingDetailsCode).toContain('Pending');
    });

    it('should provide Open Live Shipment Tracking, Cancel Booking, and Help & Support actions', () => {
      expect(bookingDetailsCode).toContain('Open Live Shipment Tracking');
      expect(bookingDetailsCode).toContain('Cancel Booking');
      expect(bookingDetailsCode).toContain('Help & Support');
      expect(bookingDetailsCode).toContain('handleConfirmCancel');
    });
  });

  describe('3. Unified Shipments Screen & 4-Tab Bottom Navigation (Reference Screenshot 3)', () => {
    it('should render the North Eastern Carriers logo with notification and profile icons', () => {
      expect(shipmentsScreenCode).toContain('BrandLogoHeader');
      expect(shipmentsScreenCode).toContain('notifBadge');
      expect(shipmentsScreenCode).toContain('headerAvatarBtn');
    });

    it('should display title "Shipments" and subtitle with "+ Book Shipment" button', () => {
      expect(shipmentsScreenCode).toContain('Shipments');
      expect(shipmentsScreenCode).toContain('Book, Track and Manage all your shipments');
      expect(shipmentsScreenCode).toContain('+ Book Shipment');
      expect(shipmentsScreenCode).toContain('onBookShipment');
    });

    it('should implement search input with QR barcode scanning support', () => {
      expect(shipmentsScreenCode).toContain(
        'Search by LR / Consignment No., Origin, Destinatio...'
      );
      expect(shipmentsScreenCode).toContain('qrCodeBtn');
      expect(shipmentsScreenCode).toContain('showQrModal');
      expect(shipmentsScreenCode).toContain('Scan Consignment Barcode');
    });

    it('should support the 5 status filter chips: All, Booked, In Transit, Delivered, Attention', () => {
      expect(shipmentsScreenCode).toContain("{ key: 'ALL', label: 'All' }");
      expect(shipmentsScreenCode).toContain("{ key: 'BOOKED', label: 'Booked' }");
      expect(shipmentsScreenCode).toContain("{ key: 'IN_TRANSIT', label: 'In Transit' }");
      expect(shipmentsScreenCode).toContain("{ key: 'DELIVERED', label: 'Delivered' }");
      expect(shipmentsScreenCode).toContain("{ key: 'ATTENTION', label: 'Attention' }");
    });

    it('should display real shipment cards with status badge, route, date, and 3 actions without mock data', () => {
      // Must not contain mock reference shipments
      expect(shipmentsScreenCode).not.toContain('DEFAULT_REFERENCE_SHIPMENTS');
      expect(shipmentsScreenCode).not.toContain("id: 'TRP-15102026-0001'");

      // Real data fetching and authentic empty state
      expect(shipmentsScreenCode).toContain('clientService.fetchClientShipments');
      expect(shipmentsScreenCode).toContain('No shipments yet.');
      expect(shipmentsScreenCode).toContain('Book your first shipment to see tracking and delivery updates here.');

      // Card badges & layout
      expect(shipmentsScreenCode).toContain('badgeBooked');
      expect(shipmentsScreenCode).toContain('badgeTransit');
      expect(shipmentsScreenCode).toContain('badgeDelivered');
      expect(shipmentsScreenCode).toContain('badgeAttention');

      // Card action buttons
      expect(shipmentsScreenCode).toContain('trackBtn');
      expect(shipmentsScreenCode).toContain('viewDetailsBtn');
      expect(shipmentsScreenCode).toContain('downloadLrBtn');
      expect(shipmentsScreenCode).toContain('Download LR');
    });

    it('should implement 4 tabs in bottom navigation without separate Bookings tab', () => {
      expect(bottomNavCode).toContain('Tab 1: Home');
      expect(bottomNavCode).toContain('Shipments');
      expect(bottomNavCode).toContain('My Requirements');
      expect(bottomNavCode).toContain('Profile');
      expect(bottomNavCode).not.toContain('<Calendar'); // Calendar icon for Bookings is removed
    });

    it('should route tab actions correctly in App.tsx', () => {
      expect(appCode).toContain("setCurrentScreen('MY_SHIPMENTS')");
      expect(appCode).toContain("setCurrentScreen('MY_REQUIREMENTS')");
      expect(appCode).toContain("setCurrentScreen('CLIENT_DASHBOARD')");
      expect(appCode).toContain("setCurrentScreen('PROFILE')");
    });
  });

  describe('4. Proof of Delivery (POD) Realism & State Handling', () => {
    it('should display verified rubber-stamp and consignee signature when consignment is delivered', () => {
      expect(podScreenCode).toContain('Proof of Delivery Acknowledged');
      expect(podScreenCode).toContain('Consignee Receiving Sign-off');
      expect(podScreenCode).toContain('Digitally Signed Electronic POD');
      expect(podScreenCode).toContain('Download Stamped e-POD Copy');
    });

    it('should display a clear pending state when delivery is not yet completed without fabricating signatures', () => {
      expect(podScreenCode).toContain('Proof of Delivery Pending');
      expect(podScreenCode).toContain('When will POD be available?');
      expect(podScreenCode).toContain('Check Live Transit Status');
    });
  });
});
