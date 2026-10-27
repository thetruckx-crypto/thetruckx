import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Client Mobile App Home Screen (ClientDashboardScreen) Redesign Requirements', () => {
  const screenPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/client/dashboard/ClientDashboardScreen.tsx'
  );
  const screenCode = fs.readFileSync(screenPath, 'utf-8');

  describe('1. Brand Identity & Design System Tokens', () => {
    it('should define and utilize the specified primary navy (#0C1A34)', () => {
      expect(screenCode).toContain("'#0C1A34'");
    });

    it('should define and utilize the primary orange (#F15A24)', () => {
      expect(screenCode).toContain("'#F15A24'");
    });

    it('should define and utilize the canvas background (#F6F8FB)', () => {
      expect(screenCode).toContain("'#F6F8FB'");
    });

    it('should define and utilize primary text (#1D2D46) and secondary text (#667085)', () => {
      expect(screenCode).toContain("'#1D2D46'");
      expect(screenCode).toContain("'#667085'");
    });

    it('should define and utilize semantic colors (green, amber, red)', () => {
      expect(screenCode).toContain("'#16A34A'"); // success green
      expect(screenCode).toContain("'#D97706'"); // warning amber
      expect(screenCode).toContain("'#DC2626'"); // error red
    });
  });

  describe('2. Header & Profile Personalization', () => {
    it('should display the company logo using BrandLogoHeader', () => {
      expect(screenCode).toContain('<BrandLogoHeader size="sm" theme="light" />');
    });

    it('should show a personalized time-based greeting for the authenticated customer', () => {
      expect(screenCode).toContain('const greeting = useMemo(');
      expect(screenCode).toContain('Good Morning');
      expect(screenCode).toContain('Good Afternoon');
      expect(screenCode).toContain('Good Evening');
      expect(screenCode).toContain('{greeting},');
    });

    it('should render a notification bell with an unread badge when count > 0', () => {
      expect(screenCode).toContain('<Bell size={20} color="#1D2D46" strokeWidth={2} />');
      expect(screenCode).toContain('unreadNotificationsCount > 0');
      expect(screenCode).toContain('notificationBadge');
    });

    it('should provide a profile shortcut avatar', () => {
      expect(screenCode).toContain('onOpenProfile ? onOpenProfile() : setShowProfileModal(true)');
      expect(screenCode).toContain('profileAvatarBtn');
    });
  });

  describe('3. Shipment Tracking Section (Primary Action)', () => {
    it('should provide LR / tracking number input with simple label and search icon', () => {
      expect(screenCode).toContain('Enter LR / Consignment Number to Track Shipment');
      expect(screenCode).toContain('<Search size={17} color="#667085" />');
    });

    it('should have a clear-input action button when text is present', () => {
      expect(screenCode).toContain("setTrackingNumber('')");
      expect(screenCode).toContain('<X size={16} color="#667085" />');
    });

    it('should completely remove QR / barcode scan option and buttons', () => {
      expect(screenCode).not.toContain('<QrCode size={19} color="#0C1A34" strokeWidth={2.2} />');
      expect(screenCode).not.toContain('setShowScanModal(true)');
    });

    it('should feature a prominent orange Track Shipment button', () => {
      expect(screenCode).toContain('primaryTrackBtn: {');
      expect(screenCode).toContain("backgroundColor: '#F15A24'");
      expect(screenCode).toContain('Track Shipment');
    });

    it('should handle validation, loading indicator, and readable error with retry', () => {
      expect(screenCode).toContain('handleTrackShipment');
      expect(screenCode).toContain('Please enter a valid LR or Consignment Tracking number.');
      expect(screenCode).toContain('isSearchingTracking ? (');
      expect(screenCode).toContain('trackingError && (');
      expect(screenCode).toContain('handleTrackShipment()'); // retry
    });
  });

  describe('4. Quick Actions Grid', () => {
    it('should provide a 2-column grid of 4 core action tiles', () => {
      expect(screenCode).toContain('quickActionsGrid');
      expect(screenCode).toContain('quickActionTile');
      expect(screenCode).toContain('My Shipments');
      expect(screenCode).toContain('Book Shipment');
      expect(screenCode).toContain('Request Quotation');
      expect(screenCode).toContain('Help & Support');
    });

    it('should navigate to the respective workflows on tile tap', () => {
      expect(screenCode).toContain("handleQuickAction('shipments')");
      expect(screenCode).toContain("handleQuickAction('book')");
      expect(screenCode).toContain("handleQuickAction('quote')");
      expect(screenCode).toContain("handleQuickAction('support')");
    });
  });

  describe('5. Shipment Overview Metrics', () => {
    it('should display the 4 summary count categories (Active, In Transit, Delivered, Attention)', () => {
      expect(screenCode).toContain('overviewStats.active');
      expect(screenCode).toContain('overviewStats.inTransit');
      expect(screenCode).toContain('overviewStats.delivered');
      expect(screenCode).toContain('overviewStats.attention');
      expect(screenCode).toContain('Active');
      expect(screenCode).toContain('In Transit');
      expect(screenCode).toContain('Delivered');
      expect(screenCode).toContain('Attention');
    });

    it('should allow filtering recent shipments by tapping on a summary category', () => {
      expect(screenCode).toContain("setSelectedFilter(selectedFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')");
      expect(screenCode).toContain("setSelectedFilter(selectedFilter === 'TRANSIT' ? 'ALL' : 'TRANSIT')");
      expect(screenCode).toContain("setSelectedFilter(selectedFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED')");
      expect(screenCode).toContain("setSelectedFilter(selectedFilter === 'ATTENTION' ? 'ALL' : 'ATTENTION')");
      expect(screenCode).toContain('filteredShipments');
    });
  });

  describe('6. Recent Shipments List & Empty State', () => {
    it('should render shipment details including LR, route, vehicle, dates, and status pill', () => {
      expect(screenCode).toContain('item.trackingNumber');
      expect(screenCode).toContain('item.origin');
      expect(screenCode).toContain('item.destination');
      expect(screenCode).toContain('item.statusText');
      expect(screenCode).toContain('item.vehicle');
      expect(screenCode).toContain('Track Details');
    });

    it('should provide a View All action that navigates to the complete shipment list', () => {
      expect(screenCode).toContain('View All');
      expect(screenCode).toContain('onNavigateToShipments');
    });

    it('should provide a compact empty state with Book Consignment and Track by LR buttons', () => {
      expect(screenCode).toContain('No active shipments found');
      expect(screenCode).toContain('Book Consignment');
      expect(screenCode).toContain('Track by LR');
    });

    it('should not contain fabricated dummy shipment data', () => {
      expect(screenCode).not.toContain('LR-9999');
      expect(screenCode).not.toContain('Demo Consignment');
    });
  });

  describe('7. Bottom Navigation Bar Architecture', () => {
    it('should delegate to the unified five-button bottom navigation bar: Home, Shipment, My Requirements, Bookings, Profile', () => {
      const bottomNavPath = path.resolve(
        __dirname,
        '../../../../mobile/src/components/ClientBottomNavBar.tsx'
      );
      const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf-8');
      expect(bottomNavCode).toContain('Tab 1: Home');
      expect(bottomNavCode).toContain('Tab 2: Shipment');
      expect(bottomNavCode).toContain('Tab 3: My Requirements');
      expect(bottomNavCode).toContain('Tab 4: Bookings');
      expect(bottomNavCode).toContain('Tab 5: Profile');
      expect(bottomNavCode).toContain('bottomTabBar: {');
      expect(bottomNavCode).toContain('tabItem: {');
      expect(bottomNavCode).toContain('tabLabelActive: {');
      expect(bottomNavCode).toContain('activeTabIndicator: {');
    });

    it('should support navigation callbacks to all client modules from the dashboard', () => {
      expect(screenCode).toContain('onNavigateToShipments');
      expect(screenCode).toContain('onNavigateToBookings');
      expect(screenCode).toContain('onNavigateToCreateRequirement');
      expect(screenCode).toContain('onNavigateToRequirements');
      expect(screenCode).toContain('onOpenProfile');
    });
  });
});
