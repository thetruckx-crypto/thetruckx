import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Vendor Registration Update: Missing Steps Validation & Routing', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');
  const mobileSrcDir = path.join(rootDir, 'apps/mobile/src');
  const screensDir = path.join(mobileSrcDir, 'screens', 'vendor', 'registration');

  const appCode = fs.readFileSync(path.join(rootDir, 'apps/mobile/App.tsx'), 'utf-8');
  const serverCode = fs.readFileSync(path.join(rootDir, 'server/src/index.ts'), 'utf-8');
  const authServiceCode = fs.readFileSync(path.join(mobileSrcDir, 'services/authService.ts'), 'utf-8');
  const vendorServiceCode = fs.readFileSync(path.join(mobileSrcDir, 'services/vendorService.ts'), 'utf-8');
  const bannerCode = fs.readFileSync(path.join(mobileSrcDir, 'components/RegistrationUpdateHeaderBanner.tsx'), 'utf-8');
  const reviewCode = fs.readFileSync(path.join(screensDir, 'VendorApplicationReviewScreen.tsx'), 'utf-8');
  const statusScreenCode = fs.readFileSync(path.join(screensDir, 'VendorVerificationStatusScreen.tsx'), 'utf-8');

  const step1Code = fs.readFileSync(path.join(screensDir, 'VendorRegistrationScreen.tsx'), 'utf-8');
  const step2Code = fs.readFileSync(path.join(screensDir, 'VendorBusinessInfoScreen.tsx'), 'utf-8');
  const step3Code = fs.readFileSync(path.join(screensDir, 'VendorAddressContactScreen.tsx'), 'utf-8');
  const step4Code = fs.readFileSync(path.join(screensDir, 'VendorOperatingLocationsScreen.tsx'), 'utf-8');
  const step5Code = fs.readFileSync(path.join(screensDir, 'VendorFleetInfoScreen.tsx'), 'utf-8');
  const step6Code = fs.readFileSync(path.join(screensDir, 'VendorTransportServicesScreen.tsx'), 'utf-8');
  const step7Code = fs.readFileSync(path.join(screensDir, 'VendorDocumentUploadScreen.tsx'), 'utf-8');

  describe('1. Acceptance Criteria: Never Blindly Redirect to Step 2', () => {
    it('ensures backend /api/auth/register-mobile does not hardcode VENDOR_BUSINESS_INFO', () => {
      // Must not hardcode nextStep: 'VENDOR_BUSINESS_INFO' without inspecting actual data
      expect(serverCode).not.toContain("nextStep: 'VENDOR_BUSINESS_INFO'");
    });

    it('ensures authService.checkRegistrationCompletion validates vendor data and does not default to VENDOR_BUSINESS_INFO', () => {
      // Must not check !resumed?.companyName (which was previously undefined and forced Step 2)
      expect(authServiceCode).not.toContain("!resumed?.companyName");
      expect(authServiceCode).toContain("vendorService.validateVendorRegistrationData");
      expect(authServiceCode).toContain("validation.firstIncompleteStep?.screenId");
    });

    it('ensures VendorVerificationStatusScreen onCompleteRegistration triggers smart missing steps workflow', () => {
      expect(appCode).toContain("onCompleteRegistration={async () => {");
      expect(appCode).toContain("await startVendorUpdateWorkflow();");
      // Must not hardcode navigation to Review or Step 2 blindly
      expect(appCode).not.toMatch(/onCompleteRegistration=\{\s*async\s*\(\)\s*=>\s*\{\s*setIsResumingRegistration\(true\);\s*await vendorService\.loadAuthenticatedVendorRegistration[^;]+;\s*setCurrentScreen\('VENDOR_APPLICATION_REVIEW'\);\s*\}\}/);
    });
  });

  describe('2. Intelligent Step Validation Engine in vendorService.ts', () => {
    it('defines validateVendorRegistrationData method returning all steps and incomplete steps', () => {
      expect(vendorServiceCode).toContain("validateVendorRegistrationData(");
      expect(vendorServiceCode).toContain("firstIncompleteStep:");
      expect(vendorServiceCode).toContain("incompleteSteps:");
      expect(vendorServiceCode).toContain("isAllComplete:");
    });

    it('validates Step 1: Transporter Name, Contact Person, Phone, and PAN are mandatory (GSTIN optional)', () => {
      expect(vendorServiceCode).toContain("step1Missing");
      expect(vendorServiceCode).toContain("Enterprise / Firm Name");
      expect(vendorServiceCode).toContain("Authorized Contact Person Name");
      expect(vendorServiceCode).toContain("10-digit Mobile Number");
      expect(vendorServiceCode).toContain("Valid 10-character Permanent Account Number (PAN)");
      // GSTIN must NOT be in step1Missing as mandatory
      expect(vendorServiceCode).not.toContain("step1Missing.push('GSTIN')");
    });

    it('validates Step 2: Business Constitution and Year Established are mandatory (MSME optional)', () => {
      expect(vendorServiceCode).toContain("step2Missing");
      expect(vendorServiceCode).toContain("Business Entity Type");
      expect(vendorServiceCode).toContain("4-digit Year of Establishment");
      // MSME must NOT be mandatory
      expect(vendorServiceCode).not.toContain("step2Missing.push('MSME')");
    });

    it('validates Step 3: Address, City, State, and 6-digit Pincode are mandatory (Email optional)', () => {
      expect(vendorServiceCode).toContain("step3Missing");
      expect(vendorServiceCode).toContain("Registered Office Address");
      expect(vendorServiceCode).toContain("City");
      expect(vendorServiceCode).toContain("State");
      expect(vendorServiceCode).toContain("Valid 6-digit PIN Code");
      // Email must NOT be in step3Missing as mandatory
      expect(vendorServiceCode).not.toContain("step3Missing.push('Official Email')");
    });

    it('validates Step 4: At least 1 hub or operating route is mandatory', () => {
      expect(vendorServiceCode).toContain("step4Missing");
      expect(vendorServiceCode).toContain("Operating Regional Hubs / Freight Routes");
    });

    it('validates Step 5: Total fleet count > 0 and vehicle configurations are mandatory', () => {
      expect(vendorServiceCode).toContain("step5Missing");
      expect(vendorServiceCode).toContain("Total Active Fleet Count");
      expect(vendorServiceCode).toContain("At least one Commercial Vehicle Configuration");
    });

    it('validates Step 6: At least 1 transport service capability is mandatory', () => {
      expect(vendorServiceCode).toContain("step6Missing");
      expect(vendorServiceCode).toContain("At least one Transport Service Capability");
    });

    it('validates Step 7: PAN document and Cancelled Cheque are mandatory; rejected docs trigger incomplete', () => {
      expect(vendorServiceCode).toContain("step7Missing");
      expect(vendorServiceCode).toContain("PAN Card Document Upload");
      expect(vendorServiceCode).toContain("Bank Cancelled Cheque Document Upload");
      expect(vendorServiceCode).toContain("hasPanDoc");
      expect(vendorServiceCode).toContain("hasChequeDoc");
      expect(vendorServiceCode).toContain("rejectedDocs");
      // GST Certificate and Transport Declaration must NOT be mandatory
      expect(vendorServiceCode).not.toContain("step7Missing.push('GST Certificate')");
      expect(vendorServiceCode).not.toContain("step7Missing.push('Transport Declaration')");
    });
  });

  describe('3. RegistrationUpdateHeaderBanner Component', () => {
    it('implements RegistrationUpdateHeaderBanner with toggle options', () => {
      expect(bannerCode).toContain("RegistrationUpdateHeaderBanner");
      expect(bannerCode).toContain("View All Steps / Edit Completed Details");
      expect(bannerCode).toContain("Show Missing Steps Only");
      expect(bannerCode).toContain("Showing only incomplete steps that require your attention.");
    });

    it('displays incomplete step count and missing fields list', () => {
      expect(bannerCode).toContain("missingFields");
      expect(bannerCode).toContain("onlyIncompleteSteps");
      expect(bannerCode).toContain("incompleteStepsCount");
    });
  });

  describe('4. Screens 1–7 Update Mode Integration', () => {
    const screens = [
      { name: 'Step 1: Registration', code: step1Code },
      { name: 'Step 2: Business Info', code: step2Code },
      { name: 'Step 3: Address & Contact', code: step3Code },
      { name: 'Step 4: Operating Locations', code: step4Code },
      { name: 'Step 5: Fleet Info', code: step5Code },
      { name: 'Step 6: Transport Services', code: step6Code },
      { name: 'Step 7: Document Upload', code: step7Code },
    ];

    screens.forEach((screen) => {
      it(`renders RegistrationUpdateHeaderBanner on ${screen.name}`, () => {
        expect(screen.code).toContain("RegistrationUpdateHeaderBanner");
        expect(screen.code).toContain("isUpdateMode");
        expect(screen.code).toContain("onlyIncompleteSteps");
        expect(screen.code).toContain("onToggleViewAllSteps");
      });
    });
  });

  describe('5. Review Screen Improvements (Step 8)', () => {
    it('displays Business Constitution section card with edit section callback', () => {
      expect(reviewCode).toContain("BUSINESS CONSTITUTION");
      expect(reviewCode).toContain("Entity Structure:");
      expect(reviewCode).toContain("Year Established:");
      expect(reviewCode).toContain("onEditSection(2)");
    });

    it('offers View All Steps / Edit Completed Details button at the top of Review Screen', () => {
      expect(reviewCode).toContain("View All Steps / Edit Completed Details");
      expect(reviewCode).toContain("onEditSection(1)");
    });
  });

  describe('6. Data Preservation & Real Data Recovery', () => {
    it('ensures loadAuthenticatedVendorRegistration recovers businessType, fleet, and hubs from DB/audit log', () => {
      expect(vendorServiceCode).toContain("loadAuthenticatedVendorRegistration");
      expect(vendorServiceCode).toContain("auth_audit_log");
      expect(vendorServiceCode).toContain("businessType");
      expect(vendorServiceCode).toContain("yearEstablished");
      expect(vendorServiceCode).toContain("operatingHubs");
      expect(vendorServiceCode).toContain("vehicleConfigs");
      // Must recover businessType from cachedData, auditDetails, or vRecord
      expect(vendorServiceCode).toContain("businessType: cachedData?.businessType || auditDetails?.businessType || vRecord.business_type || '',");
    });

    it('prepopulates form state from cached draft when user edits any step', () => {
      expect(step1Code).toContain("vendorService.getDraftForm()");
      expect(step2Code).toContain("vendorService.getDraftForm()");
      expect(step3Code).toContain("vendorService.getDraftForm()");
      expect(step4Code).toContain("vendorService.getDraftForm()");
      expect(step5Code).toContain("vendorService.getDraftForm()");
      expect(step6Code).toContain("vendorService.getDraftForm()");
    });
  });

  describe('7. App Flow Controller: Sequential Missing Steps Navigation', () => {
    it('manages vendorUpdateFlow state in App.tsx', () => {
      expect(appCode).toContain("vendorUpdateFlow");
      expect(appCode).toContain("onlyIncompleteSteps");
      expect(appCode).toContain("incompleteStepIndices");
    });

    it('implements handleVendorStepNext advancing through incomplete steps only when in update mode', () => {
      expect(appCode).toContain("handleVendorStepNext");
      expect(appCode).toContain("remainingIncomplete");
      expect(appCode).toContain("vendorUpdateFlow.onlyIncompleteSteps");
    });

    it('implements handleVendorStepBack allowing backward navigation', () => {
      expect(appCode).toContain("handleVendorStepBack");
      expect(appCode).toContain("prevIncomplete");
      expect(appCode).toContain("VENDOR_VERIFICATION_STATUS");
    });

    it('passes isUpdateMode and toggle handlers to all 7 vendor step screens', () => {
      expect(appCode).toContain("currentScreen === 'VENDOR_REGISTRATION'");
      expect(appCode).toContain("currentScreen === 'VENDOR_BUSINESS_INFO'");
      expect(appCode).toContain("currentScreen === 'VENDOR_ADDRESS_CONTACT'");
      expect(appCode).toContain("currentScreen === 'VENDOR_OPERATING_LOCATIONS'");
      expect(appCode).toContain("currentScreen === 'VENDOR_FLEET_INFO'");
      expect(appCode).toContain("currentScreen === 'VENDOR_TRANSPORT_SERVICES'");
      expect(appCode).toContain("currentScreen === 'VENDOR_DOC_UPLOAD'");
    });
  });
});
