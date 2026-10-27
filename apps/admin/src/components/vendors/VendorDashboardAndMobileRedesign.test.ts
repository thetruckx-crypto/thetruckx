import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Vendor Mobile App Redesign: Carrier Control Tower, Available Loads & Driver Roster', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');
  const mobileDir = path.join(rootDir, 'apps/mobile');

  const dashboardPath = path.join(mobileDir, 'src/screens/vendor/dashboard/VendorDashboardScreen.tsx');
  const availableLoadsPath = path.join(mobileDir, 'src/screens/vendor/rfqs/VendorRequirementsScreen.tsx');
  const driverRosterPath = path.join(mobileDir, 'src/screens/vendor/fleet/VendorDriverManagementScreen.tsx');
  const bottomNavPath = path.join(mobileDir, 'src/components/VendorBottomNavBar.tsx');
  const reportsModalPath = path.join(mobileDir, 'src/screens/vendor/dashboard/VendorReportsModal.tsx');
  const appPath = path.join(mobileDir, 'App.tsx');

  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
  const availableLoadsCode = fs.readFileSync(availableLoadsPath, 'utf8');
  const driverRosterCode = fs.readFileSync(driverRosterPath, 'utf8');
  const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf8');
  const reportsModalCode = fs.readFileSync(reportsModalPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  // ─── 1. Decorative Banner Image Removal Across All Screens ────────────────
  describe('Requirement 1: Complete Removal of Decorative Landscape/Sunset Banner', () => {
    it('ensures ScenicHeroBanner is not used in VendorDashboardScreen', () => {
      expect(dashboardCode).not.toContain('<ScenicHeroBanner');
      expect(dashboardCode).not.toContain('import { ScenicHeroBanner }');
    });

    it('ensures ScenicHeroBanner is not used in VendorRequirementsScreen', () => {
      expect(availableLoadsCode).not.toContain('<ScenicHeroBanner');
      expect(availableLoadsCode).not.toContain('import { ScenicHeroBanner }');
    });

    it('ensures ScenicHeroBanner is not used in VendorDriverManagementScreen', () => {
      expect(driverRosterCode).not.toContain('<ScenicHeroBanner');
      expect(driverRosterCode).not.toContain('import { ScenicHeroBanner }');
    });

    it('ensures BottomGoldWings decorative illustration is removed', () => {
      expect(dashboardCode).not.toContain('<BottomGoldWings');
      expect(availableLoadsCode).not.toContain('<BottomGoldWings');
      expect(driverRosterCode).not.toContain('<BottomGoldWings');
    });
  });

  // ─── 2. Screen 1: Carrier Control Tower (Vendor Dashboard) ────────────────
  describe('Screen 1: Carrier Control Tower (VendorDashboardScreen)', () => {
    it('renders Header with CARRIER CONTROL TOWER and carrier company name', () => {
      expect(dashboardCode).toContain('CARRIER CONTROL TOWER');
      expect(dashboardCode).toContain('carrierCompanyName');
      expect(dashboardCode).toContain('unreadBadgeDot');
    });

    it('implements logout confirmation dialog modal with cancel and confirm', () => {
      expect(dashboardCode).toContain('showLogoutModal');
      expect(dashboardCode).toContain('Log Out');
      expect(dashboardCode).toContain('Are you sure you want to log out');
      expect(dashboardCode).toContain('dialogCancelBtn');
      expect(dashboardCode).toContain('dialogConfirmBtn');
    });

    it('renders Welcome Card with dynamic formatted Date and Time badge', () => {
      expect(dashboardCode).toContain('Welcome Back,');
      expect(dashboardCode).toContain("Let's move your business forward today.");
      expect(dashboardCode).toContain('dateTimeBadge');
      expect(dashboardCode).toContain('formattedDate');
      expect(dashboardCode).toContain('formattedTime');
      expect(dashboardCode).toContain('currentDateTime');
    });

    it('renders 4 clickable summary cards in a 2x2 grid with live counts', () => {
      expect(dashboardCode).toContain('metricsGrid');
      expect(dashboardCode).toContain('Available RFQs');
      expect(dashboardCode).toContain('My Quotations');
      expect(dashboardCode).toContain('Awarded Bookings');
      expect(dashboardCode).toContain('Active Trips');
      expect(dashboardCode).toContain('onBrowseRequirements');
      expect(dashboardCode).toContain('onViewMyQuotations');
      expect(dashboardCode).toContain('onViewAwardedBookings');
      expect(dashboardCode).toContain('onViewTrips');
    });

    it('renders Fleet & Operations Shortcuts with Manage link', () => {
      expect(dashboardCode).toContain('FLEET & OPERATIONS SHORTCUTS');
      expect(dashboardCode).toContain('manageLinkText');
      expect(dashboardCode).toContain('Fleet (');
      expect(dashboardCode).toContain('Drivers');
      expect(dashboardCode).toContain('Assign Fleet');
      expect(dashboardCode).toContain('onViewFleet');
      expect(dashboardCode).toContain('onViewDrivers');
    });

    it('renders Live RFQs empty state matching screenshot with Browse Loads button', () => {
      expect(dashboardCode).toContain('OPEN FREIGHT LOADS (LIVE RFQS)');
      expect(dashboardCode).toContain('No active transport requirements');
      expect(dashboardCode).toContain('Currently there are no loads open for bidding.');
      expect(dashboardCode).toContain('Browse Loads');
      expect(dashboardCode).toContain('clipboardIllustrationWrap');
    });

    it('ensures Quick Actions section is removed from VendorDashboardScreen', () => {
      expect(dashboardCode).not.toContain('<Text style={styles.sectionHeading}>QUICK ACTIONS</Text>');
      expect(dashboardCode).not.toContain('style={styles.quickActionsGrid}');
    });

    it('opens verified operational analytics in VendorReportsModal', () => {
      expect(dashboardCode).toContain('showReportsModal');
      expect(dashboardCode).toContain('VendorReportsModal');
      expect(reportsModalCode).toContain('CARRIER PERFORMANCE');
      expect(reportsModalCode).toContain('Operational Reports');
      expect(reportsModalCode).toContain('Commercial Award Conversion');
    });
  });

  // ─── 3. Screen 2: Available Transport Loads ───────────────────────────────
  describe('Screen 2: Available Transport Loads (VendorRequirementsScreen)', () => {
    it('renders compact header with back button, Title and refresh action', () => {
      expect(availableLoadsCode).toContain('Available');
      expect(availableLoadsCode).toContain('Transport Loads');
      expect(availableLoadsCode).toContain('ChevronLeft');
      expect(availableLoadsCode).toContain('RefreshCw');
    });

    it('renders dismissible Registration Reminder Banner with clock icon and close button', () => {
      expect(availableLoadsCode).toContain('Complete Your Registration:');
      expect(availableLoadsCode).toMatch(/Resume remaining required registration steps and submit for (NECL|TRUCKS) verification\./);
      expect(availableLoadsCode).toContain('showRegBanner');
      expect(availableLoadsCode).toContain('setShowRegBanner(false)');
    });

    it('renders search field with clear-search capability', () => {
      expect(availableLoadsCode).toContain('Search by city, hub or cargo material...');
      expect(availableLoadsCode).toContain('searchQuery');
      expect(availableLoadsCode).toContain('setSearchQuery');
    });

    it('renders horizontal filter chips: All, Guwahati Corridor, Kolkata Trunk, Heavy Cargo', () => {
      expect(availableLoadsCode).toContain('filterChipsScroll');
      expect(availableLoadsCode).toContain('Guwahati Corridor');
      expect(availableLoadsCode).toContain('Kolkata Trunk');
      expect(availableLoadsCode).toContain('Heavy Cargo');
      expect(availableLoadsCode).toContain('counts.total');
      expect(availableLoadsCode).toContain('counts.ghy');
      expect(availableLoadsCode).toContain('counts.ccu');
      expect(availableLoadsCode).toContain('counts.heavy');
    });

    it('renders load cards with RFQ ID, Bid deadline, pickup/delivery route and View Details', () => {
      expect(availableLoadsCode).toContain('getRfqDisplayNumber');
      expect(availableLoadsCode).toContain('Bid till');
      expect(availableLoadsCode).toContain('Pickup');
      expect(availableLoadsCode).toContain('Delivery');
      expect(availableLoadsCode).toContain('View Details');
      expect(availableLoadsCode).toContain('- - - →');
    });

    it('renders empty state matching screenshot with Clear Filters action', () => {
      expect(availableLoadsCode).toContain('No Matching Requirements Found');
      expect(availableLoadsCode).toContain('Try clearing filters or search parameters.');
      expect(availableLoadsCode).toContain('Clear Filters');
    });
  });

  // ─── 4. Screen 3: Driver Roster ───────────────────────────────────────────
  describe('Screen 3: Driver Roster (VendorDriverManagementScreen)', () => {
    it('renders compact header with Driver Roster and orange Add Driver button', () => {
      expect(driverRosterCode).toContain('Driver');
      expect(driverRosterCode).toContain('Roster');
      expect(driverRosterCode).toContain('Manage verified commercial heavy vehicle pilots & drivers.');
      expect(driverRosterCode).toContain('Add Driver');
    });

    it('supports search by driver name and phone number', () => {
      expect(driverRosterCode).toContain('Search driver name or phone number');
      expect(driverRosterCode).toContain('searchQuery');
    });

    it('renders filter chips: All, Verified, and Pending', () => {
      expect(driverRosterCode).toContain('All (');
      expect(driverRosterCode).toContain('Verified (');
      expect(driverRosterCode).toContain('Pending (');
    });

    it('renders empty state matching screenshot with illustration and Add Your First Driver button', () => {
      expect(driverRosterCode).toContain('No Drivers Enrolled');
      expect(driverRosterCode).toContain('Add your first driver to manage driver details, verification and fleet assignments.');
      expect(driverRosterCode).toContain('Add Your First Driver');
      expect(driverRosterCode).toContain('sunburstRays');
    });

    it('renders driver licence and verification guidance info callout card', () => {
      expect(driverRosterCode).toContain('Keep driver licence and verification details up to date.');
      expect(driverRosterCode).toContain('This helps ensure smooth fleet operations and faster load assignments.');
      expect(driverRosterCode).toContain('infoCalloutCard');
    });

    it('provides Add Driver modal for registering full name, 10-digit mobile, and DL number', () => {
      expect(driverRosterCode).toContain('showAddModal');
      expect(driverRosterCode).toContain('DRIVER FULL NAME *');
      expect(driverRosterCode).toContain('10-DIGIT MOBILE NUMBER *');
      expect(driverRosterCode).toContain('DRIVING LICENCE (DL) NUMBER *');
      expect(driverRosterCode).toContain('vendorService.addVendorDriver');
    });
  });

  // ─── 5. Persistent 5-Tab Bottom Navigation & App Routing ──────────────────
  describe('Requirement 5: Persistent 5-Tab Bottom Navigation Bar & Seamless Navigation', () => {
    it('defines 5 destinations: Home, Loads, Trips, Fleet, More', () => {
      expect(bottomNavCode).toContain('Home');
      expect(bottomNavCode).toContain('Loads');
      expect(bottomNavCode).toContain('Trips');
      expect(bottomNavCode).toContain('Fleet');
      expect(bottomNavCode).toContain('More');
      expect(bottomNavCode).toContain('activeTabIndicator');
    });

    it('wires all navigation handlers in App.tsx across the 3 screens and fleet management', () => {
      expect(appCode).toContain("currentScreen === 'VENDOR_DASHBOARD'");
      expect(appCode).toContain("currentScreen === 'VENDOR_REQUIREMENTS'");
      expect(appCode).toContain("currentScreen === 'VENDOR_DRIVER_MANAGEMENT'");
      expect(appCode).toContain("currentScreen === 'VENDOR_FLEET_MANAGEMENT'");
      expect(appCode).toContain("onSelectNavTab");
    });
  });
});
