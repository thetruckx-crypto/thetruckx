import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Client Mobile App - Shipments & Bookings Separation & Booking Flow Steps 1 & 2', () => {
  const mobileRoot = path.resolve(__dirname, '../../../../mobile');
  const mobileSrc = path.join(mobileRoot, 'src');
  const appPath = path.join(mobileRoot, 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf-8');

  const shipmentsPath = path.join(mobileSrc, 'screens/client/shipments/MyShipmentsScreen.tsx');
  const shipmentsCode = fs.readFileSync(shipmentsPath, 'utf-8');

  const bookingsPath = path.join(mobileSrc, 'screens/client/bookings/MyBookingsScreen.tsx');
  const bookingsCode = fs.readFileSync(bookingsPath, 'utf-8');

  const step1Path = path.join(mobileSrc, 'screens/client/requirements/CreateTransportRequirementScreen.tsx');
  const step1Code = fs.readFileSync(step1Path, 'utf-8');

  const step2Path = path.join(mobileSrc, 'screens/client/requirements/CargoDetailsScreen.tsx');
  const step2Code = fs.readFileSync(step2Path, 'utf-8');

  const typesPath = path.join(mobileSrc, 'types.ts');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');

  const clientServicePath = path.join(mobileSrc, 'services/clientService.ts');
  const clientServiceCode = fs.readFileSync(clientServicePath, 'utf-8');

  const calendarModalPath = path.join(mobileSrc, 'components/InteractiveCalendarModal.tsx');
  const calendarModalCode = fs.readFileSync(calendarModalPath, 'utf-8');

  const clockModalPath = path.join(mobileSrc, 'components/InteractiveAnalogClockModal.tsx');
  const clockModalCode = fs.readFileSync(clockModalPath, 'utf-8');

  const step3Path = path.join(mobileSrc, 'screens/client/requirements/PickupDeliveryDetailsScreen.tsx');
  const step3Code = fs.readFileSync(step3Path, 'utf-8');

  const staticMapTilePath = path.join(mobileSrc, 'components/StaticMapPreviewTile.tsx');
  const staticMapTileCode = fs.readFileSync(staticMapTilePath, 'utf-8');

  const googleMapsUtilPath = path.join(mobileSrc, 'utils/googleMapsUtil.ts');
  const googleMapsUtilCode = fs.readFileSync(googleMapsUtilPath, 'utf-8');

  const driverServicePath = path.join(mobileSrc, 'services/driverService.ts');
  const driverServiceCode = fs.readFileSync(driverServicePath, 'utf-8');

  const myReqPath = path.join(mobileSrc, 'screens/client/requirements/MyRequirementsScreen.tsx');
  const myReqCode = fs.readFileSync(myReqPath, 'utf-8');

  const reqDetailsPath = path.join(mobileSrc, 'screens/client/requirements/RequirementDetailsScreen.tsx');
  const reqDetailsCode = fs.readFileSync(reqDetailsPath, 'utf-8');

  const reqReviewPath = path.join(mobileSrc, 'screens/client/requirements/RequirementReviewScreen.tsx');
  const reqReviewCode = fs.readFileSync(reqReviewPath, 'utf-8');

  const settingsPath = path.join(mobileSrc, 'screens/common/settings/SettingsScreen.tsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf-8');

  const shipmentTrackingPath = path.join(mobileSrc, 'screens/client/shipments/ShipmentTrackingScreen.tsx');
  const shipmentTrackingCode = fs.readFileSync(shipmentTrackingPath, 'utf-8');

  const bottomNavPath = path.join(mobileSrc, 'components/ClientBottomNavBar.tsx');
  const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf-8');

  const dashboardPath = path.join(mobileSrc, 'screens/client/dashboard/ClientDashboardScreen.tsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');

  const notifDetailsPath = path.join(mobileSrc, 'screens/common/notifications/NotificationDetailsScreen.tsx');
  const notifDetailsCode = fs.readFileSync(notifDetailsPath, 'utf-8');

  const bookingDetailsPath = path.join(mobileSrc, 'screens/client/bookings/BookingDetailsScreen.tsx');
  const bookingDetailsCode = fs.readFileSync(bookingDetailsPath, 'utf-8');

  describe('1. Module Separation & Navigation Routing', () => {
    it('should have MY_SHIPMENTS and MY_BOOKINGS as separate screen identifiers in types.ts', () => {
      expect(typesCode).toContain("'MY_SHIPMENTS'");
      expect(typesCode).toContain("'MY_BOOKINGS'");
    });

    it('should import and render MyShipmentsScreen separately in App.tsx', () => {
      expect(appCode).toContain("import { MyShipmentsScreen } from './src/screens/client/shipments/MyShipmentsScreen';");
      expect(appCode).toContain("currentScreen === 'MY_SHIPMENTS'");
      expect(appCode).toContain("<MyShipmentsScreen");
    });

    it('should route bottom tabs to distinct screens: shipments -> MY_SHIPMENTS and bookings -> MY_BOOKINGS', () => {
      expect(appCode).toContain("setCurrentScreen('MY_SHIPMENTS')");
      expect(appCode).toContain("setCurrentScreen('MY_BOOKINGS')");
    });
  });

  describe('2. Shipments Module (Consignment Tracking & Delivery Management)', () => {
    it('should display brand colors and screen title', () => {
      expect(shipmentsCode).toContain("'#0C1A34'");
      expect(shipmentsCode).toContain("'#F15A24'");
      expect(shipmentsCode).toContain("'#F6F8FB'");
      expect(shipmentsCode).toContain('My Shipments');
    });

    it('should provide the 4 summary metric cards: Active, In Transit, Delivered, and Attention', () => {
      expect(shipmentsCode).toContain('Active');
      expect(shipmentsCode).toContain('In Transit');
      expect(shipmentsCode).toContain('Delivered');
      expect(shipmentsCode).toContain('Attention');
      expect(shipmentsCode).toContain('summaryCounts');
    });

    it('should provide search by LR number, docket, or tracking number', () => {
      expect(shipmentsCode).toContain('Search by LR number, docket, route');
      expect(shipmentsCode).toContain('debouncedQuery');
      expect(shipmentsCode).toContain('lr.includes(debouncedQuery)');
      expect(shipmentsCode).toContain('tracking.includes(debouncedQuery)');
    });

    it('should support 10 shipment status filters and date range filters', () => {
      expect(shipmentsCode).toContain("'ALL'");
      expect(shipmentsCode).toContain("'IN_TRANSIT'");
      expect(shipmentsCode).toContain("'DELIVERED'");
      expect(shipmentsCode).toContain("'OUT_FOR_DELIVERY'");
      expect(shipmentsCode).toContain("'PICKED_UP'");
      expect(shipmentsCode).toContain("'PICKUP_SCHEDULED'");
      expect(shipmentsCode).toContain("'ON_HOLD'");
      expect(shipmentsCode).toContain("'DELAYED'");
      expect(shipmentsCode).toContain("'CANCELLED'");
      expect(shipmentsCode).toContain("'CREATED'");
      expect(shipmentsCode).toContain("'ALL_TIME'");
      expect(shipmentsCode).toContain("'TODAY'");
      expect(shipmentsCode).toContain("'THIS_WEEK'");
      expect(shipmentsCode).toContain("'THIS_MONTH'");
    });

    it('should display shipment cards with LR number, route, vehicle/driver, and GPS action', () => {
      expect(shipmentsCode).toContain('LR / CONSIGNMENT NO.');
      expect(shipmentsCode).toContain('origin_city');
      expect(shipmentsCode).toContain('destination_city');
      expect(shipmentsCode).toContain('Track Live GPS');
      expect(shipmentsCode).toContain('Docs');
      expect(shipmentsCode).toContain('POD');
    });

    it('should handle empty, loading, error, and pull-to-refresh states', () => {
      expect(shipmentsCode).toContain('ActivityIndicator');
      expect(shipmentsCode).toContain('No shipments active');
      expect(shipmentsCode).toContain('Failed to load shipments');
      expect(shipmentsCode).toContain('RefreshControl');
    });

    it('should have dedicated service method fetchClientShipments in clientService', () => {
      expect(clientServiceCode).toContain('async fetchClientShipments(');
      expect(clientServiceCode).toContain("from('trips')");
    });
  });

  describe('3. Bookings Module (Freight Orders & Quotation Management)', () => {
    it('should render prominent + New Booking action in header', () => {
      expect(bookingsCode).toContain('+ New Booking');
      expect(bookingsCode).toContain('onBookShipment');
    });

    it('should display booking cards with booking ID, route, and status', () => {
      expect(bookingsCode).toContain('displayBookingId');
      expect(bookingsCode).toContain('origin');
      expect(bookingsCode).toContain('dest');
    });

    it('should link confirmed bookings to their associated shipment LR or trip tracking', () => {
      expect(bookingsCode).toContain('lrNumber');
      expect(bookingsCode).toContain('onTrackShipment');
    });

    it('should keep booking statuses independent from shipment statuses', () => {
      expect(bookingsCode).toContain("{ key: 'ALL', label: 'All' }");
      expect(bookingsCode).toContain("{ key: 'PENDING', label: 'Pending' }");
      expect(bookingsCode).toContain("{ key: 'CONFIRMED', label: 'Confirmed' }");
      expect(bookingsCode).toContain("{ key: 'ASSIGNED', label: 'Assigned' }");
    });
  });

  describe('4. Step 1: Universal Transportation Request Form (CreateTransportRequirementScreen)', () => {
    it('should render header with Step 1 of 4 and 25% progress indicator', () => {
      expect(step1Code).toContain('Step 1 of 4');
      expect(step1Code).toContain('25%');
      expect(step1Code).toContain('Vehicle & Loading Schedule');
    });

    it('should completely remove old time-window categories and preset date chips', () => {
      expect(step1Code).not.toContain('Morning (08:00 - 12:00)');
      expect(step1Code).not.toContain('Afternoon (12:00 - 16:00)');
      expect(step1Code).not.toContain('Evening (16:00 - 20:00)');
      expect(step1Code).not.toContain('Night (20:00 - 04:00)');
      expect(step1Code).not.toContain('Flexible / Any Time');
      expect(step1Code).not.toContain("key: 'TODAY'");
      expect(step1Code).not.toContain("key: 'TOMORROW'");
      expect(step1Code).not.toContain("key: 'IN_2_DAYS'");
    });

    it('should integrate interactive calendar modal for loading date selection', () => {
      expect(step1Code).toContain('InteractiveCalendarModal');
      expect(step1Code).toContain('calendarModalVisible');
      expect(step1Code).toContain('openCalendarForGroup');
      expect(calendarModalCode).toContain('InteractiveCalendarModal');
      expect(calendarModalCode).toContain('DAY_LABELS');
      expect(calendarModalCode).toContain('MONTH_NAMES');
      expect(calendarModalCode).toContain('effectiveMinDate');
    });

    it('should integrate interactive analog clock modal for loading time selection', () => {
      expect(step1Code).toContain('InteractiveAnalogClockModal');
      expect(step1Code).toContain('clockModalVisible');
      expect(step1Code).toContain('openClockForGroup');
      expect(clockModalCode).toContain('InteractiveAnalogClockModal');
      expect(clockModalCode).toContain('CLOCK_RADIUS');
      expect(clockModalCode).toContain('DIAL_SIZE');
      expect(clockModalCode).toContain('getHandPosition');
      expect(clockModalCode).toContain('handPos');
    });

    it('should provide multimodal equipment catalogue with tyre-based trucks and categories', () => {
      expect(step1Code).toContain('VEHICLE_CATALOGUE');
      expect(step1Code).toContain('6-Tyre Truck');
      expect(step1Code).toContain('10-Tyre Truck');
      expect(step1Code).toContain('12-Tyre Truck');
      expect(step1Code).toContain('14-Tyre Truck');
      expect(step1Code).toContain('16-Tyre Truck');
      expect(step1Code).toContain('40 FT Open Flatbed Trailer');
      expect(step1Code).toContain('20 FT Closed Container');
      expect(step1Code).toContain('Refrigerated Truck (Reefer)');
      expect(step1Code).toContain('Search vehicles...');
    });

    it('should support multiple transport modes: Road, Rail, Air, Sea, Multimodal', () => {
      expect(step1Code).toContain('TRANSPORT_MODES');
      expect(step1Code).toContain("'ROAD'");
      expect(step1Code).toContain("'RAIL'");
      expect(step1Code).toContain("'AIR'");
      expect(step1Code).toContain("'SEA'");
      expect(step1Code).toContain("'MULTIMODAL'");
    });

    it('should support multiple vehicle types and quantities with individual/shared schedules', () => {
      expect(step1Code).toContain('vehicleGroups');
      expect(step1Code).toContain('Add Another Vehicle');
      expect(step1Code).toContain('handleAddVehicleGroup');
      expect(step1Code).toContain('handleRemoveVehicleGroup');
      expect(step1Code).toContain('handleApplyScheduleToAll');
      expect(step1Code).toContain('totalVehiclesCount');
      expect(step1Code).toContain('Number of Vehicles *');
    });

    it('should support Other vehicle option with custom vehicle type input', () => {
      expect(step1Code).toContain('group.isCustom');
      expect(step1Code).toContain('Custom Vehicle Type Required *');
      expect(step1Code).toContain('customVehicleName');
    });

    it('should support optional target freight budget in INR', () => {
      expect(step1Code).toContain('Target Freight Budget (Optional)');
      expect(step1Code).toContain('₹ INR');
      expect(step1Code).toContain('targetBudget');
    });

    it('should support configurable handling requirements with multi-selection and custom Other input', () => {
      expect(step1Code).toContain('HANDLING_OPTIONS');
      expect(step1Code).toContain('Tarpaulin Cover Required');
      expect(step1Code).toContain('Keep Dry / Moisture Proof');
      expect(step1Code).toContain('Crane Required at Origin');
      expect(step1Code).toContain('Forklift Loading Available');
      expect(step1Code).toContain('Specify Custom Handling Requirement *');
    });

    it('should autosave drafts and show saving/saved state indicator', () => {
      expect(step1Code).toContain('saveTransportRequirementDraft');
      expect(step1Code).toContain("saveStatus === 'SAVED'");
      expect(step1Code).toContain('Saving...');
      expect(step1Code).toContain('Draft Saved');
    });

    it('should validate before navigating to Step 2 via Continue to Cargo Details', () => {
      expect(step1Code).toContain('Continue to Cargo Details');
      expect(step1Code).toContain('handleContinue');
      expect(step1Code).toContain('inlineErrors');
    });
  });

  describe('5. Step 2: Cargo Specifications (CargoDetailsScreen)', () => {
    it('should render header with Step 2 of 4 and 50% progress indicator', () => {
      expect(step2Code).toContain('Step 2 of 4');
      expect(step2Code).toContain('50%');
      expect(step2Code).toContain('Cargo Specifications');
    });

    it('should provide popular commodity categories, search, and custom Other option', () => {
      expect(step2Code).toContain('Material & Commodity Type');
      expect(step2Code).toContain('Search commodity...');
      expect(step2Code).toContain('FMCG');
      expect(step2Code).toContain('Industrial');
      expect(step2Code).toContain('Steel & Metals');
      expect(step2Code).toContain('Agriculture');
      expect(step2Code).toContain('Electronics');
      expect(step2Code).toContain('Textiles');
      expect(step2Code).toContain('View All');
      expect(step2Code).toContain('Selected Commodity');
      expect(step2Code).toContain('Specify Custom Commodity Name');
    });

    it('should support Total Cargo Weight with kg / MT segmented selector and exact conversion', () => {
      expect(step2Code).toContain('Total Cargo Weight *');
      expect(step2Code).toContain('weightUnit');
      expect(step2Code).toContain('MT');
      expect(step2Code).toContain('kg');
      expect(step2Code).toContain('Equivalent:');
      expect(step2Code).toContain('Metric Tonnes (MT)');
      expect(step2Code).toContain('1000');
    });

    it('should support Package / Unit Count and Package Type selection tiles', () => {
      expect(step2Code).toContain('Package / Unit Count *');
      expect(step2Code).toContain('Enter quantity');
      expect(step2Code).toContain('packages');
      expect(step2Code).toContain('Package Type *');
      expect(step2Code).toContain('Boxes');
      expect(step2Code).toContain('Pallets');
      expect(step2Code).toContain('Crates');
      expect(step2Code).toContain('Drums');
      expect(step2Code).toContain('Bags');
    });

    it('should support multi-select Packaging Modes matching catalogue options', () => {
      expect(step2Code).toContain('Packaging Mode');
      expect(step2Code).toContain('Wooden Pallets');
      expect(step2Code).toContain('Corrugated Boxes / Cartons');
      expect(step2Code).toContain('Heavy Wooden Crates');
      expect(step2Code).toContain('Drums & Barrels');
      expect(step2Code).toContain('Gunny Bags / Sacks');
      expect(step2Code).toContain('Shrink-Wrapped');
      expect(step2Code).toContain('Loose Cargo');
      expect(step2Code).toContain('Other Mode');
    });

    it('should support collapsible Dimensions & Cargo Properties with unit selector and volume calculation', () => {
      expect(step2Code).toContain('Dimensions & Cargo Properties');
      expect(step2Code).toContain('Package Dimensions (L x W x H)');
      expect(step2Code).toContain('dimensionsLength');
      expect(step2Code).toContain('dimensionsWidth');
      expect(step2Code).toContain('dimensionsHeight');
      expect(step2Code).toContain('Calculated Volume');
      expect(step2Code).toContain('ft³');
      expect(step2Code).toContain('m³');
    });

    it('should support functional switches for 5 cargo properties', () => {
      expect(step2Code).toContain('Fragile / Glassware Cargo');
      expect(step2Code).toContain('Liquid / Fluid Cargo');
      expect(step2Code).toContain('Oversized (ODC) Dimensions');
      expect(step2Code).toContain('Moisture-Sensitive Cargo');
      expect(step2Code).toContain('Temperature-Sensitive / Reefer');
      expect(step2Code).toContain('isFragile');
      expect(step2Code).toContain('isLiquid');
      expect(step2Code).toContain('isOversized');
      expect(step2Code).toContain('isMoistureSensitive');
      expect(step2Code).toContain('isTemperatureSensitive');
    });

    it('should support Hazardous (Hazchem) Cargo with Hazard Class, UN Number, Packing Group, and MSDS upload', () => {
      expect(step2Code).toContain('Hazardous (Hazchem) Cargo');
      expect(step2Code).toContain('Hazard Class *');
      expect(step2Code).toContain('UN Number *');
      expect(step2Code).toContain('Proper Shipping Name *');
      expect(step2Code).toContain('Packing Group');
      expect(step2Code).toContain('Upload Safety Document (MSDS)');
    });

    it('should support Transit Insurance Coverage with Declared Cargo Value in INR', () => {
      expect(step2Code).toContain('Transit Insurance Coverage');
      expect(step2Code).toContain('Declared Cargo Value *');
      expect(step2Code).toContain('INR');
      expect(step2Code).toContain('declaredCargoValue');
    });

    it('should autosave drafts and show visual indicator badge', () => {
      expect(step2Code).toContain('saveTransportRequirementDraft');
      expect(step2Code).toContain("saveStatus === 'SAVED'");
      expect(step2Code).toContain('Draft Saved');
    });

    it('should validate and proceed via Continue to Pickup & Delivery button', () => {
      expect(step2Code).toContain('Continue to Pickup & Delivery');
      expect(step2Code).toContain('handleContinue');
    });
  });

  describe('5. Step 3: Pickup & Delivery Details & Zero-Cost Google Maps', () => {
    it('should display Step 3 header, 75% progress, and draft saved indicator', () => {
      expect(step3Code).toContain('STEP 3 OF 4');
      expect(step3Code).toContain('75% Completed');
      expect(step3Code).toContain('Pickup & Delivery Details');
      expect(step3Code).toContain('Draft Saved');
    });

    it('should provide Pickup Origin and Delivery Destination cards with Use Current Location', () => {
      expect(step3Code).toContain('Pickup Origin (Loading)');
      expect(step3Code).toContain('Delivery Destination (Unloading)');
      expect(step3Code).toContain('Use Current Location');
      expect(step3Code).toContain('Saved Hub');
      expect(step3Code).toContain('PIN Code *');
      expect(step3Code).toContain('City / Hub *');
    });

    it('should support zero-cost Google Maps search and link pasting without paid APIs', () => {
      expect(step3Code).toContain('Google Maps Location (Optional)');
      expect(step3Code).toContain('Select on Google Maps');
      expect(step3Code).toContain('Paste Google Maps Link');
      expect(step3Code).toContain('handleSelectOnGoogleMaps');
      expect(step3Code).toContain('handleOpenPasteLinkModal');
    });

    it('should render StaticMapPreviewTile with red marker and Google watermark', () => {
      expect(staticMapTileCode).toContain('StaticMapPreviewTile');
      expect(staticMapTileCode).toContain('Google');
      expect(staticMapTileCode).toContain('MapPin');
      expect(step3Code).toContain('<StaticMapPreviewTile');
    });

    it('should display Location Added badge with removal and View on Google Maps action', () => {
      expect(step3Code).toContain('Location Added');
      expect(step3Code).toContain('View on Google Maps');
      expect(step3Code).toContain('handleRemoveGoogleMapsLocation');
    });

    it('should provide zero-cost URL helpers for directions and search in googleMapsUtil.ts', () => {
      expect(googleMapsUtilCode).toContain('buildGoogleMapsDirectionsUrl');
      expect(googleMapsUtilCode).toContain('buildGoogleMapsSearchUrl');
      expect(googleMapsUtilCode).toContain('isValidGoogleMapsUrl');
      expect(googleMapsUtilCode).toContain('extractCoordinatesFromGoogleMapsUrl');
      expect(googleMapsUtilCode).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    });

    it('should provide driver navigation with exact directions URL format', () => {
      expect(driverServiceCode).toContain('openNavigation');
      expect(driverServiceCode).toContain('buildGoogleMapsDirectionsUrl');
      expect(driverServiceCode).toContain('googleMapsUrl');
    });
  });

  describe('6. My Transport Requirements Screen (Redesign & Production Integration)', () => {
    it('should display brand colors, centered logo, back button, and orange + action button in header', () => {
      expect(myReqCode).toContain("'#101D36'");
      expect(myReqCode).toContain("'#F05A24'");
      expect(myReqCode).toContain("'#F4F6FA'");
      expect(myReqCode).toContain('BrandLogoHeader');
      expect(myReqCode).toContain('onCreateNew');
      expect(myReqCode).toContain('onBack');
    });

    it('should render screen heading and subtitle matching reference', () => {
      expect(myReqCode).toContain('My Transport Requirements');
      expect(myReqCode).toContain('Track freight requests, compare quotations, and manage shipments.');
    });

    it('should calculate and display the 4 summary statistics cards from real authorized records', () => {
      expect(myReqCode).toContain('summaryCounts');
      expect(myReqCode).toContain('Total Requirements');
      expect(myReqCode).toContain('Active RFQs');
      expect(myReqCode).toContain('Booked');
      expect(myReqCode).toContain('Completed');
    });

    it('should provide debounced search input supporting ID, route, PIN codes, material, and vehicle', () => {
      expect(myReqCode).toContain('Search by ID, route, material, vehicle...');
      expect(myReqCode).toContain('item.pickup_address');
      expect(myReqCode).toContain('item.destination_address');
      expect(myReqCode).toContain('item.pickup_pincode');
      expect(myReqCode).toContain('item.destination_pincode');
      expect(myReqCode).toContain('item.material_type');
      expect(myReqCode).toContain('item.vehicle_type');
      expect(myReqCode).toContain('clearSearchBtn');
    });

    it('should support sort modal with Recently Updated, Newest First, and Oldest First', () => {
      expect(myReqCode).toContain('SortOrder');
      expect(myReqCode).toContain('Recently Updated');
      expect(myReqCode).toContain('Newest First');
      expect(myReqCode).toContain('Oldest First');
      expect(myReqCode).toContain('showSortModal');
    });

    it('should provide the 7 horizontal status filter chips matching business lifecycle', () => {
      expect(myReqCode).toContain("'ALL'");
      expect(myReqCode).toContain("'ACTIVE_RFQS'");
      expect(myReqCode).toContain("'QUOTATIONS_RECEIVED'");
      expect(myReqCode).toContain("'BOOKED'");
      expect(myReqCode).toContain("'IN_TRANSIT'");
      expect(myReqCode).toContain("'COMPLETED'");
      expect(myReqCode).toContain("'CANCELLED'");
    });

    it('should render requirement cards with route corridor, origin/destination nodes, and dotted truck', () => {
      expect(myReqCode).toContain('corridorConnector');
      expect(myReqCode).toContain('corridorDotLine');
      expect(myReqCode).toContain('truckIconBadge');
      expect(myReqCode).toContain('originNode');
      expect(myReqCode).toContain('destNode');
      expect(myReqCode).toContain('PIN:');
    });

    it('should provide zero-cost Google Maps directions navigation via View on Map', () => {
      expect(myReqCode).toContain('View on Map');
      expect(myReqCode).toContain('buildGoogleMapsDirectionsUrl');
      expect(myReqCode).toContain('handleOpenMap');
    });

    it('should display vehicle type, verified payload capacity, commodity, and cargo weight', () => {
      expect(myReqCode).toContain('MT Capacity');
      expect(myReqCode).toContain('item.material_type');
      expect(myReqCode).toContain('MT');
      expect(myReqCode).toContain('formatDateTime');
    });

    it('should display quotation count badges and primary View Quotations / View Details actions', () => {
      expect(myReqCode).toContain('Quotations Received');
      expect(myReqCode).toContain('View Quotations');
      expect(myReqCode).toContain('View Details');
      expect(myReqCode).toContain('onViewQuotations');
      expect(myReqCode).toContain('onSelectRequirement');
    });

    it('should support empty states, skeleton loading, and error states with retry', () => {
      expect(myReqCode).toContain('No transport requirements yet');
      expect(myReqCode).toContain('Create Requirement');
      expect(myReqCode).toContain('No matching requirements');
      expect(myReqCode).toContain('RefreshControl');
      expect(myReqCode).toContain('Retry');
    });

    it('should fetch real quotation counts via clientService.fetchClientRequirements', () => {
      expect(clientServiceCode).toContain('quotationsCount: (quotesByReq[r.id] || []).length');
      expect(clientServiceCode).toContain("from('client_quotes')");
    });
  });

  describe('7. Requirement Details Screen (Redesign, Zero-Cost Map & Persistence Flow)', () => {
    it('should render header with back button, brand logo, screen heading and subtitle', () => {
      expect(reqDetailsCode).toContain("'#101D36'");
      expect(reqDetailsCode).toContain("'#F05A24'");
      expect(reqDetailsCode).toContain('Requirement Details');
      expect(reqDetailsCode).toContain('Review your posted freight requirement and check quotations.');
    });

    it('should render Summary Card with requirement ID, status badge, native share, and more menu', () => {
      expect(reqDetailsCode).toContain('REQUIREMENT ID');
      expect(reqDetailsCode).toContain('Posted on');
      expect(reqDetailsCode).toContain('handleShare');
      expect(reqDetailsCode).toContain('Share.share');
      expect(reqDetailsCode).toContain('setShowMoreMenu');
      expect(reqDetailsCode).toContain('handleCopyId');
      expect(reqDetailsCode).toContain('handleConfirmCancel');
    });

    it('should support requirement cancellation in clientService and update status', () => {
      expect(clientServiceCode).toContain('async cancelRequirement(');
      expect(clientServiceCode).toContain("status: 'CANCELLED'");
      expect(reqDetailsCode).toContain('clientService.cancelRequirement');
    });

    it('should render Vehicle & Route Card with vertical timeline and zero-cost View on Map links', () => {
      expect(reqDetailsCode).toContain('Loading Origin');
      expect(reqDetailsCode).toContain('Unloading Destination');
      expect(reqDetailsCode).toContain('timelineVerticalLine');
      expect(reqDetailsCode).toContain('View on Map');
      expect(reqDetailsCode).toContain('buildGoogleMapsDirectionsUrl');
      expect(reqDetailsCode).toContain('handleOpenMap');
    });

    it('should render Cargo & Shipment Specifications with commodity, weight, datetime, and insurance', () => {
      expect(reqDetailsCode).toContain('Cargo & Shipment Specifications');
      expect(reqDetailsCode).toContain('Commodity / Material');
      expect(reqDetailsCode).toContain('Payload Weight');
      expect(reqDetailsCode).toContain('Expected Loading Date');
      expect(reqDetailsCode).toContain('Transit Insurance');
      expect(reqDetailsCode).toContain('Full Value Coverage Requested');
    });

    it('should distinguish transit insurance states: Requested, Confirmed, Pending, and Not Requested', () => {
      expect(reqDetailsCode).toContain('Full Value Coverage Confirmed');
      expect(reqDetailsCode).toContain('Coverage Pending Confirmation');
      expect(reqDetailsCode).toContain('Not Requested');
    });

    it('should render Quotations Received summary banner with Check latest offers action', () => {
      expect(reqDetailsCode).toContain('Quotations Received');
      expect(reqDetailsCode).toContain('Check latest offers');
      expect(reqDetailsCode).toContain('quotesBannerCard');
    });

    it('should render sticky bottom action bar with Edit Requirement and View Quotations & Rates', () => {
      expect(reqDetailsCode).toContain('bottomStickyBar');
      expect(reqDetailsCode).toContain('Edit Requirement');
      expect(reqDetailsCode).toContain('View Quotations & Rates');
      expect(reqDetailsCode).toContain('onEditRequirement');
      expect(reqDetailsCode).toContain('onViewQuotations');
    });

    it('should wire App.tsx navigation to edit requirement drafts preserving packagingType and fields', () => {
      expect(appCode).toContain('onEditRequirement={(req) => {');
      expect(appCode).toContain('packagingType:');
      expect(appCode).toContain("setCurrentScreen('CREATE_REQUIREMENT')");
      expect(appCode).toContain('onViewQuotations={(reqId) => {');
      expect(appCode).toContain("setCurrentScreen('QUOTATIONS_LIST')");
    });
  });

  describe('8. Requirement Review Screen (Step 4 of 4 Redesign - Screenshot 1 Match)', () => {
    it('should display brand colors, centered logo, back button, and Help action in header', () => {
      expect(reqReviewCode).toContain("'#0B1730'");
      expect(reqReviewCode).toContain("'#F15A24'");
      expect(reqReviewCode).toContain("'#169B75'");
      expect(reqReviewCode).toContain("'#F5F7FA'");
      expect(reqReviewCode).toContain('BrandLogoHeader');
      expect(reqReviewCode).toContain('Headphones');
      expect(reqReviewCode).toContain('onBack');
    });

    it('should render 4-step progress indicator and All details verified status badge', () => {
      expect(reqReviewCode).toContain('Details');
      expect(reqReviewCode).toContain('Cargo');
      expect(reqReviewCode).toContain('Schedule');
      expect(reqReviewCode).toContain('Review');
      expect(reqReviewCode).toContain('All details verified');
      expect(reqReviewCode).toContain('Ready to submit');
    });

    it('should render screen heading and subtitle matching reference', () => {
      expect(reqReviewCode).toContain('Requirement Review');
      expect(reqReviewCode).toContain('Please review all details before submitting your transport requirement.');
    });

    it('should render Navy Shipment Summary Card with origin, destination, pickup date/time, and vehicle type without any map', () => {
      expect(reqReviewCode).toContain('navySummaryCard');
      expect(reqReviewCode).toContain('ORIGIN');
      expect(reqReviewCode).toContain('DESTINATION');
      expect(reqReviewCode).toContain('Pickup Date & Time');
      expect(reqReviewCode).toContain('Vehicle Type');
      // Crucial requirement: No route map, map visualization, or route illustration
      expect(reqReviewCode).not.toContain('<StaticMapPreviewTile');
      expect(reqReviewCode).not.toContain('buildGoogleMapsDirectionsUrl');
      expect(reqReviewCode).not.toContain('buildGoogleMapsSearchUrl');
    });

    it('should render Vehicle & Loading Schedule card with vehicle type, loading datetime, target budget, and Edit action', () => {
      expect(reqReviewCode).toContain('Vehicle & Loading Schedule');
      expect(reqReviewCode).toContain('Target Budget');
      expect(reqReviewCode).toContain('Competitive Market RFQ');
      expect(reqReviewCode).toContain('onEditStep(1)');
    });

    it('should render Cargo & Commodity card with material, weight, packaging mode, quantity, transit insurance, and Edit action', () => {
      expect(reqReviewCode).toContain('Cargo & Commodity');
      expect(reqReviewCode).toContain('Steel, Pipes and Structural Materials');
      expect(reqReviewCode).toContain('MT');
      expect(reqReviewCode).toContain('Packaging Mode');
      expect(reqReviewCode).toContain('Packages');
      expect(reqReviewCode).toContain('Transit Insurance');
      expect(reqReviewCode).toContain('Add Insurance');
      expect(reqReviewCode).toContain('onEditStep(2)');
    });

    it('should render Hub & Contact Details with pickup and destination address cards, copy-address, phone, call action, and Edit action', () => {
      expect(reqReviewCode).toContain('Hub & Contact Details');
      expect(reqReviewCode).toContain('PICKUP ADDRESS');
      expect(reqReviewCode).toContain('DESTINATION ADDRESS');
      expect(reqReviewCode).toContain('Clipboard.setString');
      expect(reqReviewCode).toContain('Linking.openURL');
      expect(reqReviewCode).toContain('onEditStep(3)');
    });

    it('should display green validation confirmation panel for verified shipment details', () => {
      expect(reqReviewCode).toContain('Shipment details look good!');
      expect(reqReviewCode).toContain('Submitting will notify verified carriers across the North Eastern corridor.');
      expect(reqReviewCode).toContain('greenValidationPanel');
    });

    it('should provide 4 feature shortcuts: Compare Quotes, Live Tracking, Digital Documents, and Notifications', () => {
      expect(reqReviewCode).toContain('Compare Quotes');
      expect(reqReviewCode).toContain('Get best rates');
      expect(reqReviewCode).toContain('Live Tracking');
      expect(reqReviewCode).toContain('Track your shipment');
      expect(reqReviewCode).toContain('Digital Documents');
      expect(reqReviewCode).toContain('Invoices & POD');
      expect(reqReviewCode).toContain('Notifications');
      expect(reqReviewCode).toContain('Real-time updates');
    });

    it('should render sticky bottom action bar with Back and Submit Transport Requirement buttons with confirmation alert', () => {
      expect(reqReviewCode).toContain('stickyBottomBar');
      expect(reqReviewCode).toContain('Back');
      expect(reqReviewCode).toContain('Submit Transport Requirement');
      expect(reqReviewCode).toContain('Confirm Freight Requirement');
      expect(reqReviewCode).toContain('handleConfirmSubmit');
      expect(reqReviewCode).toContain('clientService.createTransportRequirement');
    });

    it('should wire App.tsx navigation to handle editing steps, help, and feature shortcuts', () => {
      expect(appCode).toContain('onEditStep={(step) => {');
      expect(appCode).toContain("setCurrentScreen('CREATE_REQUIREMENT')");
      expect(appCode).toContain("setCurrentScreen('CARGO_DETAILS')");
      expect(appCode).toContain("setCurrentScreen('PICKUP_DELIVERY_DETAILS')");
      expect(appCode).toContain('onHelp={() => setCurrentScreen(\'HELP_SUPPORT\')}');
      expect(appCode).toContain('onNavigateToFeature=');
    });
  });

  describe('9. Settings Screen Redesign (Screenshot 2 Match)', () => {
    it('should display brand styling, centered logo, back button, title, and subtitle', () => {
      expect(settingsCode).toContain("'#0B1730'");
      expect(settingsCode).toContain("'#F15A24'");
      expect(settingsCode).toContain("'#F5F7FA'");
      expect(settingsCode).toContain('BrandLogoHeader');
      expect(settingsCode).toContain('Settings');
      expect(settingsCode).toContain('Manage your app preferences');
    });

    it('should render Section A: Notifications with ONLY Shipment updates and Quotes & booking updates toggles', () => {
      expect(settingsCode).toContain('Notifications');
      expect(settingsCode).toContain('Choose what updates you want to receive');
      expect(settingsCode).toContain('Shipment updates');
      expect(settingsCode).toContain('Pickup, transit and delivery status');
      expect(settingsCode).toContain('Quotes & booking updates');
      expect(settingsCode).toContain('New freight quotes and booking confirmations');
      expect(settingsCode).toContain('handleToggleShipmentUpdates');
      expect(settingsCode).toContain('handleToggleQuotesUpdates');
    });

    it('should render Section B: Security with Biometric unlock and Privacy & security navigation', () => {
      expect(settingsCode).toContain('Security');
      expect(settingsCode).toContain('Keep your account secure');
      expect(settingsCode).toContain('Biometric unlock');
      expect(settingsCode).toContain('Quick and secure access to your account');
      expect(settingsCode).toContain('Privacy & security');
      expect(settingsCode).toContain('Manage your data and account security');
      expect(settingsCode).toContain('handleToggleBiometrics');
    });

    it('should render Section C: Support with Help & support and Terms & privacy navigation', () => {
      expect(settingsCode).toContain('Support');
      expect(settingsCode).toContain('Get help and learn more');
      expect(settingsCode).toContain('Help & support');
      expect(settingsCode).toContain('FAQs, phone support and ticket submission');
      expect(settingsCode).toContain('Terms & privacy');
      expect(settingsCode).toContain('Read our terms of service and privacy policy');
      expect(settingsCode).toContain('onNavigateToSupport');
      expect(settingsCode).toContain('onNavigateToTerms');
    });

    it('should verify removed unnecessary controls: No SMS Critical Alerts, No System Announcements, No Clear Local Cache', () => {
      expect(settingsCode).not.toContain('SMS Critical Alerts');
      expect(settingsCode).not.toContain('System Announcements');
      expect(settingsCode).not.toContain('Clear Local Cache');
      expect(settingsCode).not.toContain('handleClearCache');
      expect(settingsCode).not.toContain('Passwordless Mobile OTP');
    });

    it('should persist user preferences through authService', () => {
      expect(settingsCode).toContain('authService.getSettings');
      expect(settingsCode).toContain('authService.saveSettings');
    });
  });

  describe('10. Consignment Tracking Screen Redesign (Screenshot 3 Match)', () => {
    it('should render header with back button, brand logo, help button, and CONSIGNMENT TRACKING label', () => {
      expect(shipmentTrackingCode).toContain("'#0B1730'");
      expect(shipmentTrackingCode).toContain("'#F15A24'");
      expect(shipmentTrackingCode).toContain("'#10B981'");
      expect(shipmentTrackingCode).toContain('BrandLogoHeader');
      expect(shipmentTrackingCode).toContain('CONSIGNMENT TRACKING');
      expect(shipmentTrackingCode).toContain('Live Tracking Active');
      expect(shipmentTrackingCode).toContain('handleCopyId');
    });

    it('should render prominent current shipment status card (Lorry Assigned / En route to Pickup)', () => {
      expect(shipmentTrackingCode).toContain('topStatusCard');
      expect(shipmentTrackingCode).toContain('Lorry Assigned');
      expect(shipmentTrackingCode).toContain('En route to Pickup');
    });

    it('should render Navy Origin and Destination card with clean divider and without any route map', () => {
      expect(shipmentTrackingCode).toContain('navyRouteCard');
      expect(shipmentTrackingCode).toContain('ORIGIN');
      expect(shipmentTrackingCode).toContain('DESTINATION');
      expect(shipmentTrackingCode).toContain('navyVerticalDivider');
      // Crucial requirement: No map or route visualization
      expect(shipmentTrackingCode).not.toContain('<StaticMapPreviewTile');
      expect(shipmentTrackingCode).not.toContain('buildGoogleMapsDirectionsUrl');
      expect(shipmentTrackingCode).not.toContain('buildGoogleMapsSearchUrl');
    });

    it('should verify removed strip elements: No Estimated Delivery card, No Distance display, No Travel Time', () => {
      expect(shipmentTrackingCode).not.toContain('Estimated Delivery');
      expect(shipmentTrackingCode).not.toContain('Est. Delivery');
      expect(shipmentTrackingCode).not.toContain('Total Distance');
      expect(shipmentTrackingCode).not.toContain('Distance in km');
      expect(shipmentTrackingCode).not.toContain('Travel Time');
    });

    it('should render Driver Allocation Card with contact driver button and status notice', () => {
      expect(shipmentTrackingCode).toContain('driverCard');
      expect(shipmentTrackingCode).toContain('Driver Allocation Pending');
      expect(shipmentTrackingCode).toContain('Driver details will be updated soon.');
      expect(shipmentTrackingCode).toContain('Contact Driver');
      expect(shipmentTrackingCode).toContain('handleCallDriver');
      expect(shipmentTrackingCode).toContain('contactDriverBtnDisabled');
    });

    it('should render the 7 Consignment Milestones in exact chronological sequence', () => {
      expect(shipmentTrackingCode).toContain('Booking Confirmed');
      expect(shipmentTrackingCode).toContain('Vehicle & Driver Assigned');
      expect(shipmentTrackingCode).toContain('Placed at Loading Gate');
      expect(shipmentTrackingCode).toContain('Cargo Loaded & Dispatched');
      expect(shipmentTrackingCode).toContain('In Transit');
      expect(shipmentTrackingCode).toContain('Reached Destination Hub');
      expect(shipmentTrackingCode).toContain('Delivered & POD Sign-off');
      expect(shipmentTrackingCode).toContain('milestonesSectionCard');
    });

    it('should render the 4 accessible bottom quick actions: Refresh, View Details, Share Tracking, and Need Help', () => {
      expect(shipmentTrackingCode).toContain('quickActionsGrid');
      expect(shipmentTrackingCode).toContain('Refresh');
      expect(shipmentTrackingCode).toContain('Get latest status');
      expect(shipmentTrackingCode).toContain('View Details');
      expect(shipmentTrackingCode).toContain('Consignment info');
      expect(shipmentTrackingCode).toContain('Share Tracking');
      expect(shipmentTrackingCode).toContain('Send to others');
      expect(shipmentTrackingCode).toContain('Need Help?');
      expect(shipmentTrackingCode).toContain('Contact support');
      expect(shipmentTrackingCode).toContain('Share.share');
      expect(shipmentTrackingCode).toContain('handleRefresh');
    });
  });

  describe('11. NECL Client Five-Button Bottom Navigation & End-to-End Connected Journey', () => {
    it('should implement ClientBottomNavBar with exact tab order: Home, Shipment, Requirements, Bookings, Profile', () => {
      expect(bottomNavCode).toContain('Tab 1: Home');
      expect(bottomNavCode).toContain('Tab 2: Shipment');
      expect(bottomNavCode).toContain('Tab 3: My Requirements');
      expect(bottomNavCode).toContain('Tab 4: Bookings');
      expect(bottomNavCode).toContain('Tab 5: Profile');
      expect(bottomNavCode).toContain("'HOME' | 'SHIPMENT' | 'REQUIREMENTS' | 'BOOKINGS' | 'PROFILE'");
    });

    it('should mount ClientBottomNavBar in App.tsx across all 5 client destination screens', () => {
      expect(appCode).toContain("import { ClientBottomNavBar, ClientNavTab } from './src/components/ClientBottomNavBar';");
      expect(appCode).toContain('<ClientBottomNavBar');
      expect(appCode).toContain("currentScreen === 'CLIENT_DASHBOARD'");
      expect(appCode).toContain("currentScreen === 'MY_SHIPMENTS'");
      expect(appCode).toContain("currentScreen === 'MY_REQUIREMENTS'");
      expect(appCode).toContain("currentScreen === 'MY_BOOKINGS'");
      expect(appCode).toContain("currentScreen === 'PROFILE'");
    });

    it('should highlight active tab and route tabs to their exact destination screens in App.tsx', () => {
      expect(appCode).toContain("if (tab === 'HOME') setCurrentScreen('CLIENT_DASHBOARD');");
      expect(appCode).toContain("else if (tab === 'SHIPMENT') setCurrentScreen('MY_SHIPMENTS');");
      expect(appCode).toContain("else if (tab === 'REQUIREMENTS') setCurrentScreen('MY_REQUIREMENTS');");
      expect(appCode).toContain("else if (tab === 'BOOKINGS') setCurrentScreen('MY_BOOKINGS');");
      expect(appCode).toContain("else if (tab === 'PROFILE') setCurrentScreen('PROFILE');");
    });

    it('should link Saved Requirement to Associated Booking when booked in RequirementDetailsScreen', () => {
      expect(reqDetailsCode).toContain('onViewBooking');
      expect(reqDetailsCode).toContain('Confirmed Transport Booking');
      expect(reqDetailsCode).toContain('View Confirmed Booking');
      expect(reqDetailsCode).toContain('bookedBannerCard');
    });

    it('should attach booking_id in clientService.fetchRequirementById', () => {
      expect(clientServiceCode).toContain('booking_id: bookingId');
      expect(clientServiceCode).toContain(".from('bookings')");
      expect(clientServiceCode).toContain(".eq('requirement_id', reqId)");
    });

    it('should link Booking to Associated Requirement in BookingDetailsScreen', () => {
      expect(bookingDetailsCode).toContain('onViewRequirement');
      expect(bookingDetailsCode).toContain('ORIGINATING REQUIREMENT');
      expect(bookingDetailsCode).toContain('viewReqPill');
    });

    it('should link Booking to Associated Shipment via Live GPS tracking in BookingDetailsScreen', () => {
      expect(bookingDetailsCode).toContain('onTrackShipment(trip?.id || bookingId)');
      expect(bookingDetailsCode).toContain('Live GPS');
    });

    it('should connect Notifications to relevant Requirement, Booking, or Shipment in App.tsx', () => {
      expect(appCode).toContain("targetRef?.startsWith('BOK')");
      expect(appCode).toContain("targetRef?.startsWith('REQ')");
      expect(appCode).toContain("targetRef?.startsWith('TRP')");
      expect(appCode).toContain("setCurrentScreen('SHIPMENT_TRACKING')");
    });

    it('should have dynamic notification action label based on reference type in NotificationDetailsScreen', () => {
      expect(notifDetailsCode).toContain('View Related Booking');
      expect(notifDetailsCode).toContain('View Related Requirement');
      expect(notifDetailsCode).toContain('View Live Tracking & Shipment');
    });

    it('should provide bottom padding (90px) on client tab screens for clear navigation clearance', () => {
      expect(shipmentsCode).toContain('paddingBottom: 90');
      expect(myReqCode).toContain('paddingBottom: 90');
      expect(bookingsCode).toContain('paddingBottom: 90');
      expect(dashboardCode).not.toContain('bottomTabBar');
    });
  });
});

