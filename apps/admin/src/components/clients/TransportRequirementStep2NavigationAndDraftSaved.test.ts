import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Client Mobile App - Transport Requirement Step 2 -> Step 3 Navigation & Silent Draft Persistence', () => {
  const mobileRoot = path.resolve(__dirname, '../../../../mobile');
  const mobileSrc = path.join(mobileRoot, 'src');
  const appPath = path.join(mobileRoot, 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf-8');

  const step1Path = path.join(mobileSrc, 'screens/client/requirements/CreateTransportRequirementScreen.tsx');
  const step1Code = fs.readFileSync(step1Path, 'utf-8');

  const step2Path = path.join(mobileSrc, 'screens/client/requirements/CargoDetailsScreen.tsx');
  const step2Code = fs.readFileSync(step2Path, 'utf-8');

  const step3Path = path.join(mobileSrc, 'screens/client/requirements/PickupDeliveryDetailsScreen.tsx');
  const step3Code = fs.readFileSync(step3Path, 'utf-8');

  const step4Path = path.join(mobileSrc, 'screens/client/requirements/RequirementReviewScreen.tsx');
  const step4Code = fs.readFileSync(step4Path, 'utf-8');

  const clientServicePath = path.join(mobileSrc, 'services/clientService.ts');
  const clientServiceCode = fs.readFileSync(clientServicePath, 'utf-8');

  describe('1. Step 2 to Step 3 Navigation Logic & Error Handling', () => {
    it('should have working Continue to Pickup & Delivery button triggering handleContinue', () => {
      expect(step2Code).toContain('Continue to Pickup & Delivery');
      expect(step2Code).toContain('onPress={handleContinue}');
    });

    it('should validate commodity, weight, and package count before navigating', () => {
      expect(step2Code).toContain('selectedCommodity');
      expect(step2Code).toContain('Please select a commodity category.');
      expect(step2Code).toContain('Please enter a valid positive cargo weight.');
      expect(step2Code).toContain('Please enter a valid positive quantity.');
    });

    it('should display meaningful validation errors and scroll to top on validation failure', () => {
      expect(step2Code).toContain('scrollViewRef.current?.scrollTo');
      expect(step2Code).toContain("Alert.alert('Invalid Information'");
      expect(step2Code).toContain('setInlineErrors(errors)');
    });

    it('should invoke onNext with comprehensive payload and proceed to Step 3', () => {
      expect(step2Code).toContain('onNext(updatePayload)');
      expect(step2Code).toContain('requiredCapacityMt: normalizedCapacityMt');
      expect(step2Code).toContain('numberOfUnits: totalQtyNum ? String(totalQtyNum) : undefined');
      expect(step2Code).toContain('packageCount: totalQtyNum || undefined');
      expect(step2Code).toContain("materialType: isCustomCommodity ? 'Other' : selectedCommodity");
    });

    it('should safely auto-save without blocking onNext if autosave encounters network delay', () => {
      expect(step2Code).toMatch(/try\s*\{\s*await autoSaveDraft\(updatePayload\);/);
      expect(step2Code).toContain('onNext(updatePayload);');
    });
  });

  describe('2. Removal of Visible Draft Saved Text From All Steps', () => {
    it('Step 1 should not render visible Draft Saved, Saving..., or Retry Save in UI', () => {
      // JSX should render headerSpacer instead of visible badge
      expect(step1Code).toContain('<View style={styles.headerSpacer} />');
      expect(step1Code).not.toContain('<Text style={styles.saveBadgeTextSuccess}>Draft Saved</Text>');
      expect(step1Code).not.toContain('<Text style={styles.saveBadgeText}>Saving...</Text>');
      expect(step1Code).not.toContain('<Text style={styles.saveBadgeTextFailed}>Retry Save</Text>');
    });

    it('Step 2 should not render visible Draft Saved, Saving..., or Retry Save in UI', () => {
      expect(step2Code).toContain('<View style={styles.headerSpacer} />');
      expect(step2Code).not.toContain('<Text style={styles.saveBadgeTextSuccess}>Draft Saved</Text>');
      expect(step2Code).not.toContain('<Text style={styles.saveBadgeText}>Saving...</Text>');
      expect(step2Code).not.toContain('<Text style={styles.saveBadgeTextFailed}>Retry Save</Text>');
    });

    it('Step 3 should not render visible Draft Saved or Saving... in UI', () => {
      expect(step3Code).toContain('<View style={styles.headerSpacer} />');
      expect(step3Code).not.toContain('<Text style={styles.draftBadgeText}>\n            {saveStatus === \'SAVING\' ? \'Saving...\' : \'Draft Saved\'}\n          </Text>');
    });

    it('Step 4 should not render any Draft Saved text', () => {
      expect(step4Code).not.toContain('Draft Saved');
      expect(step4Code).not.toContain('Draft saved successfully');
    });
  });

  describe('3. Automatic Background Draft Saving & Multi-Step Persistence', () => {
    it('clientService should merge new updates with existing draft in AsyncStorage', () => {
      expect(clientServiceCode).toContain('saveTransportRequirementDraft');
      expect(clientServiceCode).toContain('const existing = await this.getTransportRequirementDraft(clientId);');
      expect(clientServiceCode).toContain('...(existing || {})');
    });

    it('clientService should support draft lookup with fallback across client IDs', () => {
      expect(clientServiceCode).toContain('getTransportRequirementDraft');
      expect(clientServiceCode).toContain('NECL_REQ_DRAFT_default');
    });

    it('Step 1 should preserve initialDraft fields when autosaving', () => {
      expect(step1Code).toContain('...initialDraft,');
      expect(step1Code).toContain('autoSaveDraft');
    });

    it('Step 2 should preserve initialDraft fields when autosaving', () => {
      expect(step2Code).toContain('...initialDraft,');
      expect(step2Code).toContain('autoSaveDraft');
    });

    it('Step 1 and Step 2 should autosave when navigating back', () => {
      expect(step1Code).toContain('const handleBack = () => {');
      expect(step1Code).toContain('autoSaveDraft();');
      expect(step2Code).toContain('const handleBack = () => {');
      expect(step2Code).toContain('autoSaveDraft();');
    });

    it('App.tsx should restore previously saved draft when reopening the form', () => {
      expect(appCode).toContain('handleStartNewRequirement');
      expect(appCode).toContain('clientService.getTransportRequirementDraft');
      expect(appCode).toContain('setRequirementDraft((prev) => ({');
    });

    it('App.tsx should pass clientId to Step 1 and Step 2', () => {
      expect(appCode).toMatch(/<CreateTransportRequirementScreen[\s\S]*?clientId=\{session\?\.userId \|\| registeredClientId\}/);
      expect(appCode).toMatch(/<CargoDetailsScreen[\s\S]*?clientId=\{session\?\.userId \|\| registeredClientId\}/);
    });
  });

  describe('4. Navigation Data Flow & Step Integration', () => {
    it('App.tsx routes CARGO_DETAILS to PICKUP_DELIVERY_DETAILS preserving state', () => {
      expect(appCode).toContain('currentScreen === \'CARGO_DETAILS\'');
      expect(appCode).toContain('setRequirementDraft((prev) => ({ ...prev, ...draftUpdate }));');
      expect(appCode).toContain('setCurrentScreen(\'PICKUP_DELIVERY_DETAILS\');');
    });

    it('Step 2 syncs state with initialDraft to preserve data when moving between steps', () => {
      expect(step2Code).toContain('useEffect(() => {');
      expect(step2Code).toContain('if (initialDraft?.materialType && !selectedCommodity)');
      expect(step2Code).toContain('if ((initialDraft?.weightValue || initialDraft?.requiredCapacityMt) && !cargoWeight)');
    });
  });
});
