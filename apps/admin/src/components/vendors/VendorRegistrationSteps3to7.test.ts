import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Vendor Registration Steps 3–7 Implementation Verification', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');
  const mobileSrcDir = path.join(rootDir, 'apps/mobile/src');
  const screensDir = path.join(mobileSrcDir, 'screens', 'vendor', 'registration');

  const step1Code = fs.readFileSync(path.join(screensDir, 'VendorRegistrationScreen.tsx'), 'utf-8');
  const step2Code = fs.readFileSync(path.join(screensDir, 'VendorBusinessInfoScreen.tsx'), 'utf-8');
  const step3Code = fs.readFileSync(path.join(screensDir, 'VendorAddressContactScreen.tsx'), 'utf-8');
  const step4Code = fs.readFileSync(path.join(screensDir, 'VendorOperatingLocationsScreen.tsx'), 'utf-8');
  const step5Code = fs.readFileSync(path.join(screensDir, 'VendorFleetInfoScreen.tsx'), 'utf-8');
  const step6Code = fs.readFileSync(path.join(screensDir, 'VendorTransportServicesScreen.tsx'), 'utf-8');
  const step7Code = fs.readFileSync(path.join(screensDir, 'VendorDocumentUploadScreen.tsx'), 'utf-8');
  const reviewCode = fs.readFileSync(path.join(screensDir, 'VendorApplicationReviewScreen.tsx'), 'utf-8');
  const typesCode = fs.readFileSync(path.join(mobileSrcDir, 'types.ts'), 'utf-8');
  const serverCode = fs.readFileSync(path.join(rootDir, 'server/src/index.ts'), 'utf-8');
  const vendorServiceCode = fs.readFileSync(path.join(mobileSrcDir, 'services/vendorService.ts'), 'utf-8');

  describe('1. Step 3: Business & Location Details', () => {
    it('should remove manual State selection input and suggested state pills', () => {
      // Manual state textinput should not exist as an editable input
      expect(step3Code).not.toContain("placeholder=\"e.g. Assam\"");
      // Suggested state pills array should be removed
      expect(step3Code).not.toMatch(/const\s+states\s*=\s*\[/);
      expect(step3Code).not.toContain('stateScroll');
      expect(step3Code).not.toContain('statePill');
    });

    it('should automatically detect state from entered PIN code via pincodeService', () => {
      expect(step3Code).toContain('pincodeService.lookupPincode');
      expect(step3Code).toContain('State (Auto-detected from PIN code)');
      expect(step3Code).toContain('readOnlyInputWrap');
      expect(step3Code).toContain('setState(res.data.state)');
    });

    it('should make Official Email ID optional and allow continuation without entering email', () => {
      expect(step3Code).toContain('Official Email Address (Optional)');
      expect(step3Code).toContain('email?: string');
      // Should not block continuation if email is empty
      expect(step3Code).toContain('cleanEmail || undefined');
    });

    it('should enforce mandatory address, valid 6-digit PIN code, and city', () => {
      expect(step3Code).toContain('Please enter your Registered Office Address');
      expect(step3Code).toContain('validatePincodeFormat');
      expect(step3Code).toContain('Please enter City');
    });
  });

  describe('2. Step 4: Route Coverage & Regional Hubs', () => {
    it('should provide a searchable selection field for active regional hubs', () => {
      expect(step4Code).toContain('ADMIN_ACTIVE_REGIONAL_HUBS');
      expect(step4Code).toContain('searchQuery');
      expect(step4Code).toContain('Search active regional hubs by name');
      expect(step4Code).toContain('filteredHubs');
    });

    it('should fetch active regional hubs dynamically from backend/database', () => {
      expect(step4Code).toContain('vendorService.getActiveRegionalHubs');
      expect(vendorServiceCode).toContain('getActiveRegionalHubs');
      expect(serverCode).toContain("app.get('/api/regional-hubs'");
    });

    it('should replace the long hub list with a searchable multi-select dropdown', () => {
      expect(step4Code).toContain('dropdownTrigger');
      expect(step4Code).toContain('dropdownMenu');
      expect(step4Code).toContain('dropdownScrollList');
      expect(step4Code).toContain('isDropdownOpen');
    });

    it('should allow vendors to select multiple hubs', () => {
      expect(step4Code).toContain('selectedHubIds');
      expect(step4Code).toContain('toggleHub');
    });

    it('should provide a "Select All India Active Regional Hubs" option', () => {
      expect(step4Code).toContain('Select All India Active Regional Hubs');
      expect(step4Code).toContain('toggleSelectAllIndia');
      expect(step4Code).toContain('isAllIndiaSelected');
    });

    it('should display selected hubs as removable chips with individual remove buttons', () => {
      expect(step4Code).toContain('removeSelectedHub');
      expect(step4Code).toContain('selectedChip');
      expect(step4Code).toContain('chipRemoveBtn');
    });

    it('should allow vendors to add a missing regional hub manually by entering Name, City, and State and saving to database', () => {
      expect(step4Code).toContain('showAddHubModal');
      expect(step4Code).toContain('newHubName');
      expect(step4Code).toContain('newHubCity');
      expect(step4Code).toContain('newHubState');
      expect(step4Code).toContain('handleSaveNewHub');
      expect(step4Code).toContain('vendorService.addRegionalHub');
      expect(vendorServiceCode).toContain('addRegionalHub');
      expect(serverCode).toContain("app.post('/api/regional-hubs'");
    });

    it('should provide an "Other" option with text field and Add (+) button for manual locations', () => {
      expect(step4Code).toContain('Required hub unavailable? Enter Other Location');
      expect(step4Code).toContain('handleAddManualLocation');
      expect(step4Code).toContain('manualLocations');
      expect(step4Code).toContain('manualTextInput');
      expect(step4Code).toContain('Add');
      expect(step4Code).toContain('removeManualLocation');
      expect(step4Code).toContain('manualChip');
      expect(step4Code).toContain('Custom');
    });

    it('should save selected hub IDs and manual locations separately', () => {
      expect(step4Code).toContain('operatingHubs: selectedHubIds');
      expect(step4Code).toContain('manualOperatingLocations: manualLocations');
      expect(typesCode).toContain('manualOperatingLocations?: string[]');
    });
  });

  describe('3. Step 5: Fleet Strength & Commercial Vehicle Details', () => {
    it('should change Total Active Fleet Count to a numeric input field validated > 0', () => {
      expect(step5Code).toContain('totalFleetCount');
      expect(step5Code).toContain('keyboardType="number-pad"');
      // Increments, decrements, and predefined range buttons removed
      expect(step5Code).not.toContain("'1 - 5 Trucks'");
      expect(step5Code).not.toContain("'6 - 20 Trucks'");
      expect(step5Code).not.toContain("'50+ Heavy Lorries'");
      expect(step5Code).toContain('Valid Fleet Count Required');
    });

    it('should implement the hierarchical commercial vehicle categories (Body Type -> Vehicle Type -> Capacity)', () => {
      // 1. Vehicle Body Type
      expect(step5Code).toContain("'Open Body'");
      expect(step5Code).toContain("'Closed Body'");
      expect(step5Code).toContain('1. Vehicle Body Type *');

      // 2. Vehicle Type
      expect(step5Code).toContain("'Lorry'");
      expect(step5Code).toContain("'Trailer'");
      expect(step5Code).toContain("'Van'");
      expect(step5Code).toContain("'Heavy Carrier'");
      expect(step5Code).toContain('2. Vehicle Type');

      // 3. Vehicle Capacity with units MT, KG, CBM
      expect(step5Code).toContain("'MT'");
      expect(step5Code).toContain("'KG'");
      expect(step5Code).toContain("'CBM'");
      expect(step5Code).toContain('3. Vehicle Capacity & Available Count *');
      expect(step5Code).toContain('capacityInput');
      expect(step5Code).toContain('vehicleCountInput');
    });

    it('should provide Add Vehicle Type (+) button and support multiple configurations with edit/remove', () => {
      expect(step5Code).toMatch(/Add (Vehicle Type|Another Vehicle) \(\+\)/);
      expect(step5Code).toContain('handleAddOrUpdateConfig');
      expect(step5Code).toContain('handleEditConfig');
      expect(step5Code).toContain('handleRemoveConfig');
      expect(step5Code).toContain('vehicleConfigs');
    });

    it('should completely remove Telematics & GPS Compliance and its validations', () => {
      expect(step5Code).not.toContain('TELEMATICS & GPS COMPLIANCE');
      expect(step5Code).not.toContain('gpsCoverage');
      expect(step5Code).not.toContain('gpsOptions');
      expect(step5Code).not.toContain('RadioTower');
      expect(step5Code).not.toContain('FASTag & Toll Gate Tracking');
    });
  });

  describe('4. Step 6: Service Offerings', () => {
    it('should display ONLY the 3 specified service offerings and remove all others', () => {
      expect(step6Code).toContain('Full Truck Load (FTL)');
      expect(step6Code).toContain('ODC (Over-Dimensional Cargo)');
      expect(step6Code).toContain('Heavy Project Cargo');

      // All others must be removed
      expect(step6Code).not.toContain('Part Truckload (PTL / LTL)');
      expect(step6Code).not.toContain('Express Dedicated Transit');
      expect(step6Code).not.toContain('Containerized High-Value Transit');
    });

    it('should allow vendors to select services and save them in draft', () => {
      expect(step6Code).toContain('toggleService');
      expect(step6Code).toContain('servicesOffered: selectedServices');
    });
  });

  describe('5. Step 7: Document Uploads', () => {
    it('should configure PAN Card and Bank Cancelled Cheque as mandatory', () => {
      expect(step7Code).toContain("docType: 'COMPANY_PAN'");
      expect(step7Code).toContain("title: 'PAN Card'");
      expect(step7Code).toContain("isMandatory: true");

      expect(step7Code).toContain("docType: 'BANK_CANCELLED_CHEQUE'");
      expect(step7Code).toContain("title: 'Bank Cancelled Cheque'");
    });

    it('should configure GST Registration Certificate and Transport Declaration as optional', () => {
      expect(step7Code).toContain("docType: 'GST_CERTIFICATE'");
      expect(step7Code).toContain("title: 'GST Registration Certificate'");
      expect(step7Code).toContain("title: 'Transport Undertaking / Declaration'");
    });

    it('should completely remove Bank Statement from UI, validations, and upload flow', () => {
      expect(step7Code).not.toContain("title: 'Bank Cancelled Cheque / Statement'");
      expect(step7Code).not.toContain("'BANK_STATEMENT'");
      expect(serverCode).toContain("doc.docType === 'BANK_STATEMENT'");
    });

    it('should clearly mark mandatory and optional documents in the UI', () => {
      expect(step7Code).toContain('MANDATORY');
      expect(step7Code).toContain('OPTIONAL');
      expect(step7Code).toContain('reqBadgeMandatory');
      expect(step7Code).toContain('reqBadgeOptional');
    });

    it('should allow continuation without optional documents but enforce mandatory documents', () => {
      expect(step7Code).toContain('PAN Card is mandatory for vendor registration');
      expect(step7Code).toContain('Bank Cancelled Cheque is mandatory for settlement verification');
    });

    it('should provide replace and remove options for attached documents', () => {
      expect(step7Code).toContain('Replace File');
      expect(step7Code).toContain('handleRemoveFile');
      expect(step7Code).toContain('Remove');
    });
  });

  describe('6. Application Review & Backend Integration', () => {
    it('should display Steps 3-7 details accurately in VendorApplicationReviewScreen', () => {
      expect(reviewCode).toContain('REGISTERED OFFICE & DEPOT (STEP 3)');
      expect(reviewCode).toContain('ROUTE COVERAGE & OPERATING HUBS (STEP 4)');
      expect(reviewCode).toContain('FLEET STRENGTH & VEHICLE DETAILS (STEP 5)');
      expect(reviewCode).toContain('SERVICE OFFERINGS (STEP 6)');
      expect(reviewCode).toContain('COMPLIANCE KYC DOCUMENTS (STEP 7)');
      expect(reviewCode).toContain('Active Regional Hubs');
      expect(reviewCode).toContain('Manually Added Locations');
      expect(reviewCode).toContain('Vehicle Configurations');
      expect(reviewCode).not.toContain('TELEMATICS');
    });

    it('should support VendorVehicleConfig in types and backend submission', () => {
      expect(typesCode).toContain('export interface VendorVehicleConfig');
      expect(typesCode).toContain("bodyType: 'Open Body' | 'Closed Body'");
      expect(typesCode).toContain("vehicleType: 'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier'");
      expect(typesCode).toContain("capacityUnit: 'MT' | 'KG' | 'CBM'");
      expect(serverCode).toContain('manualOperatingLocations = []');
      expect(serverCode).toContain('vehicleConfigs = []');
    });
  });

  describe('7. Comprehensive Audit: Zero Dummy Data Across All 7 Steps', () => {
    it('should start Step 1 (Enterprise Profile) fields completely empty', () => {
      expect(step1Code).toContain("transporterName, setTransporterName] = useState('')");
      expect(step1Code).toContain("contactPerson, setContactPerson] = useState('')");
      expect(step1Code).toContain("pan, setPan] = useState('')");
      expect(step1Code).toContain("gstin, setGstin] = useState('')");
    });

    it('should start Step 2 (Constitution) entity type unselected and fields empty', () => {
      expect(step2Code).toContain("businessType, setBusinessType] = useState('')");
      expect(step2Code).toContain("yearEstablished, setYearEstablished] = useState('')");
      expect(step2Code).toContain("msmeNumber, setMsmeNumber] = useState('')");
    });

    it('should start Step 3 (Address & Contact) fields empty without hardcoded state', () => {
      expect(step3Code).toContain("registeredAddress, setRegisteredAddress] = useState('')");
      expect(step3Code).toContain("city, setCity] = useState('')");
      expect(step3Code).toContain("state, setState] = useState('')");
      expect(step3Code).toContain("pincode, setPincode] = useState('')");
    });

    it('should start Step 4 (Route Coverage) with empty selections and no preselected hubs', () => {
      expect(step4Code).toContain("selectedHubIds, setSelectedHubIds] = useState<string[]>([])");
      expect(step4Code).toContain("manualLocations, setManualLocations] = useState<string[]>([])");
      expect(step4Code).toContain("selectedPermits, setSelectedPermits] = useState<string[]>([])");
    });

    it('should start Step 5 (Fleet Details) with empty fleet count, no prefilled configs, and unselected types', () => {
      expect(step5Code).toContain("totalFleetCount, setTotalFleetCount] = useState('')");
      expect(step5Code).toContain("vehicleConfigs, setVehicleConfigs] = useState<VendorVehicleConfig[]>([])");
      expect(step5Code).toContain("selectedBodyType, setSelectedBodyType] = useState<'Open Body' | 'Closed Body' | ''>('')");
      expect(step5Code).toContain("selectedVehicleType, setSelectedVehicleType] = useState<'Lorry' | 'Trailer' | 'Van' | 'Heavy Carrier' | ''>('')");
      expect(step5Code).toContain("vehicleCountInput, setVehicleCountInput] = useState('')");
    });

    it('should start Step 6 (Transport Services) with empty service selections', () => {
      expect(step6Code).toContain("selectedServices, setSelectedServices] = useState<string[]>([])");
      expect(step6Code).not.toContain("['Full Truck Load (FTL)']");
    });

    it('should ensure vendorService.saveDraftForm defaults do not inject dummy values', () => {
      expect(vendorServiceCode).toContain("operatingHubs: []");
      expect(vendorServiceCode).toContain("totalFleetCount: 0");
      expect(vendorServiceCode).toContain("vehicleConfigs: []");
      expect(vendorServiceCode).toContain("servicesOffered: []");
      expect(vendorServiceCode).toContain("state: ''");
      expect(vendorServiceCode).not.toContain("businessType: 'Proprietorship'");
      expect(vendorServiceCode).not.toContain("totalFleetCount: 5");
    });

    it('should ensure VendorApplicationReviewScreen eliminates dummy text fallbacks', () => {
      expect(reviewCode).not.toContain("'Guwahati Express'");
      expect(reviewCode).not.toContain("'Authorized Rep'");
      expect(reviewCode).not.toContain("'Regional Logistics Park'");
      expect(reviewCode).not.toContain("'All India National Permit'");
    });
  });
});

