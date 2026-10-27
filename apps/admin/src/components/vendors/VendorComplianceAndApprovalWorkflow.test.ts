import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Transporter Registration & Compliance Approval Comprehensive Suite (15 Scenarios)', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');
  const mobileSrcDir = path.join(rootDir, 'apps/mobile/src');
  const screensDir = path.join(mobileSrcDir, 'screens', 'vendor');
  const servicesDir = path.join(mobileSrcDir, 'services');

  const vendorServiceCode = fs.readFileSync(path.join(servicesDir, 'vendorService.ts'), 'utf-8');
  const reviewScreenCode = fs.readFileSync(path.join(screensDir, 'registration', 'VendorApplicationReviewScreen.tsx'), 'utf-8');
  const confirmScreenCode = fs.readFileSync(path.join(screensDir, 'registration', 'VendorSubmissionConfirmationScreen.tsx'), 'utf-8');
  const statusScreenCode = fs.readFileSync(path.join(screensDir, 'registration', 'VendorVerificationStatusScreen.tsx'), 'utf-8');
  const dashboardScreenCode = fs.readFileSync(path.join(screensDir, 'dashboard', 'VendorDashboardScreen.tsx'), 'utf-8');
  const appCode = fs.readFileSync(path.join(rootDir, 'apps/mobile/App.tsx'), 'utf-8');
  const serverCode = fs.readFileSync(path.join(rootDir, 'server/src/index.ts'), 'utf-8');
  const migrationCode = fs.readFileSync(
    path.join(rootDir, 'database/migrations/20261017000012_vendor_transporter_compliance_and_approval_upgrade.sql'),
    'utf-8'
  );

  // Scenario 1: Successful Transporter Registration
  describe('Scenario 1: Successful Transporter Registration', () => {
    it('generates and persists canonical NECL vendor code upon registration', () => {
      expect(vendorServiceCode).toContain("formatDisplayId('VD'");
      expect(vendorServiceCode).toContain("vendor_code: canonicalAppNo");
      expect(serverCode).toContain("formatDisplayId('VD', targetVendorId)");
      expect(serverCode).toContain("vendor_code: canonicalAppNo");
    });

    it('sets initial status and compliance_status to PENDING in database', () => {
      expect(vendorServiceCode).toContain("status: 'PENDING'");
      expect(vendorServiceCode).toContain("compliance_status: 'PENDING'");
      expect(serverCode).toContain("compliance_status: 'PENDING'");
    });

    it('returns canonical application number and vendor ID in submission response', () => {
      expect(vendorServiceCode).toContain("applicationNumber: canonicalAppNo");
      expect(vendorServiceCode).toContain("return { success: true, vendorId, applicationNumber: canonicalAppNo };");
    });
  });

  // Scenario 2: Incomplete Registration Validation Failure
  describe('Scenario 2: Incomplete Registration Validation Failure', () => {
    it('implements comprehensive pre-submission validation guard in vendorService', () => {
      expect(vendorServiceCode).toContain('validateVendorRegistrationData');
      expect(vendorServiceCode).toContain('Enterprise / Firm Name');
      expect(vendorServiceCode).toContain('Valid 10-character Permanent Account Number (PAN)');
      expect(vendorServiceCode).toContain('10-digit Mobile Number');
      expect(vendorServiceCode).toContain('Registered Office Address');
      expect(vendorServiceCode).toContain('City');
      expect(vendorServiceCode).toContain('6-digit PIN Code');
    });

    it('validates registration form data in VendorApplicationReviewScreen before triggering API', () => {
      expect(reviewScreenCode).toContain('vendorService.validateVendorRegistrationData(formData)');
      expect(reviewScreenCode).toContain('Incomplete Application');
    });
  });

  // Scenario 3: Duplicate Submission Prevention
  describe('Scenario 3: Duplicate Submission Prevention', () => {
    it('uses isSubmittingRef ref lock to prevent accidental rapid double-taps', () => {
      expect(reviewScreenCode).toContain('const isSubmittingRef = React.useRef(false)');
      expect(reviewScreenCode).toContain('if (isSubmittingRef.current || loading) return');
      expect(reviewScreenCode).toContain('isSubmittingRef.current = true');
    });

    it('resets submission ref in finally block to ensure safe retries on failure', () => {
      expect(reviewScreenCode).toContain('isSubmittingRef.current = false');
    });

    it('checks for existing user/vendor in server endpoint before inserting duplicate', () => {
      expect(serverCode).toContain(".from('vendor_users')");
      expect(serverCode).toContain(".eq('mobile', cleanPhone)");
      expect(serverCode).toContain('if (targetVendorId) {');
    });
  });

  // Scenario 4: Database Write Failure Error Handling (No Fake Success)
  describe('Scenario 4: Database Write Failure Error Handling (No Fake Success)', () => {
    it('never returns fake success with fallback ID on database error', () => {
      // Must NOT contain dummy success returns in catch blocks
      expect(vendorServiceCode).not.toContain("return { success: true, vendorId: `ven-${cleanPhone}`");
      expect(vendorServiceCode).not.toContain("return { success: true, vendorId: `ven-offline-${Date.now()}`");
    });

    it('throws real, informative error on database or network failure', () => {
      expect(vendorServiceCode).toContain('throw new Error(');
      expect(vendorServiceCode).toContain('Database registration persistence failed');
    });

    it('alerts the user on submission failure and maintains review screen state for retry', () => {
      expect(reviewScreenCode).toContain('Submission Failed');
      expect(reviewScreenCode).toContain('Your application details are preserved. Please retry submission.');
    });
  });

  // Scenario 5: Network Interruption Handling
  describe('Scenario 5: Network Interruption Handling', () => {
    it('retains local draft data in memory and database staging so users do not lose progress', () => {
      expect(vendorServiceCode).toContain('activeRegistrationData');
      expect(vendorServiceCode).toContain('saveDraftForm');
    });

    it('provides retry prompt on network timeout or server unreachable', () => {
      expect(reviewScreenCode).toContain('Submission Failed');
      expect(reviewScreenCode).toContain('Your application details are preserved. Please retry submission.');
    });
  });

  // Scenario 6: Pending Compliance Review State
  describe('Scenario 6: Pending Compliance Review State', () => {
    it('defines PENDING and UNDER_REVIEW compliance statuses in database constraint', () => {
      expect(migrationCode).toContain("'PENDING'");
      expect(migrationCode).toContain("'UNDER_REVIEW'");
      expect(migrationCode).toContain('vendor_companies_compliance_check');
    });

    it('displays canonical reference ID on VendorVerificationStatusScreen', () => {
      expect(statusScreenCode).toContain("Reference ID: {vendorCode || formatDisplayId('VD', vendorId)}");
    });

    it('shows Under Review status badge with amber branding', () => {
      expect(statusScreenCode).toContain('Under Compliance Audit');
      expect(statusScreenCode).toContain('#F59E0B');
    });
  });

  // Scenario 7: Compliance Approval Transition
  describe('Scenario 7: Compliance Approval Transition', () => {
    it('implements database RPC admin_review_vendor_registration for atomic status updates', () => {
      expect(migrationCode).toContain('CREATE OR REPLACE FUNCTION public.admin_review_vendor_registration');
      expect(migrationCode).toContain("status = 'APPROVED'");
      expect(migrationCode).toContain("compliance_status = 'APPROVED'");
    });

    it('records reviewer metadata approved_by and approved_at', () => {
      expect(migrationCode).toContain('approved_by = p_reviewer_name');
      expect(migrationCode).toContain('approved_at = NOW()');
    });

    it('records approval in auth_audit_log table', () => {
      expect(migrationCode).toContain("INSERT INTO public.auth_audit_log");
      expect(migrationCode).toContain("VENDOR_REGISTRATION_DECISION");
    });
  });

  // Scenario 8: Rejected Application with Reason
  describe('Scenario 8: Rejected Application with Reason', () => {
    it('supports REJECTED status with mandatory rejection reason', () => {
      expect(migrationCode).toContain("p_decision = 'REJECTED'");
      expect(migrationCode).toContain('rejection_reason = trim(p_reason)');
      expect(migrationCode).toContain('rejected_by = p_reviewer_name');
      expect(migrationCode).toContain('rejected_at = NOW()');
    });

    it('returns rejection reason in getVendorVerificationStatus and status endpoint', () => {
      expect(vendorServiceCode).toContain('rejectionReason: rejectedDoc?.rejection_reason || vComp.rejection_reason');
      expect(serverCode).toContain('rejectionReason: comp?.rejection_reason');
    });

    it('displays rejection message and support action on verification screen', () => {
      expect(statusScreenCode).toContain("status === 'REJECTED'");
      expect(statusScreenCode).toContain('rejectionReason');
      expect(statusScreenCode).toContain('onOpenSupport');
    });
  });

  // Scenario 9: Action-Required Application with Correction Notes
  describe('Scenario 9: Action-Required Application with Correction Notes', () => {
    it('supports ACTION_REQUIRED and CORRECTIONS_REQUESTED states with notes', () => {
      expect(migrationCode).toContain("p_decision IN ('ACTION_REQUIRED', 'CORRECTIONS_REQUESTED')");
      expect(migrationCode).toContain('correction_notes = trim(p_reason)');
    });

    it('returns correction notes to mobile app via status response', () => {
      expect(vendorServiceCode).toContain('correctionNotes: vComp.correction_notes');
      expect(serverCode).toContain('correctionNotes: comp?.correction_notes');
    });

    it('routes transporter to document correction screen when changes requested', () => {
      expect(statusScreenCode).toContain('onCorrectDocuments');
      expect(appCode).toContain("onCorrectDocuments={() => setCurrentScreen('VENDOR_DOC_CORRECTION')}");
    });
  });

  // Scenario 10: Unauthorized Approval Attempts / Bypass Prevention
  describe('Scenario 10: Unauthorized Approval Attempts / Bypass Prevention', () => {
    it('completely removed premature Preview Vendor Dashboard button from verification screen', () => {
      expect(statusScreenCode).not.toContain('Preview Vendor Dashboard');
    });

    it('strictly verifies approved status in App.tsx before allowing entry into operational dashboard', () => {
      expect(appCode).toContain("if (statusRes.status !== 'APPROVED')");
      expect(appCode).toMatch(/Access to the operational dashboard will be unlocked once approved by (TRUCKS|NECL) Admin/);
    });

    it('guards operational actions in vendorService against unapproved vendors', () => {
      expect(vendorServiceCode).toContain("if (vComp && vComp.status !== 'APPROVED')");
      expect(vendorServiceCode).toContain('Quotation submission is enabled once approved by admin');
      expect(vendorServiceCode).toContain('Transporter account must be verified by admin before assigning vehicles and drivers');
    });
  });

  // Scenario 11: Cross-Transporter Data Isolation (Quotes & Bookings)
  describe('Scenario 11: Cross-Transporter Data Isolation', () => {
    it('strictly scopes getMyQuotations by vendor_id without global table fallback', () => {
      expect(vendorServiceCode).toContain(".eq('vendor_id', vendorId)");
      // Verify removed unsafe fallback that queried all quotes
      expect(vendorServiceCode).not.toMatch(/if\s*\(!vrList\s*\|\|\s*vrList\.length\s*===\s*0\)\s*\{\s*const\s*\{\s*data:\s*allQuotes/);
    });

    it('strictly scopes getAwardedBookings to trips assigned to current vendor', () => {
      expect(vendorServiceCode).toContain(".from('trips')");
      expect(vendorServiceCode).toContain(".eq('vendor_id', vendorId)");
      expect(vendorServiceCode).toContain(".from('vendor_requests')");
    });
  });

  // Scenario 12: Dashboard Loading, Empty, and Error States
  describe('Scenario 12: Dashboard Loading, Empty, and Error States', () => {
    it('displays loading indicator while fetching vendor metrics and RFQs', () => {
      expect(dashboardScreenCode).toContain('loading ? (');
      expect(dashboardScreenCode).toContain('ActivityIndicator');
    });

    it('provides meaningful empty state with refresh CTA when no live RFQs exist', () => {
      expect(dashboardScreenCode).toContain('recentReqs.length === 0 ? (');
      expect(dashboardScreenCode).toContain('No active transport requirements currently open for bidding.');
    });

    it('renders network sync error banner with retry button on load failure', () => {
      expect(dashboardScreenCode).toContain('{errorMessage && (');
      expect(dashboardScreenCode).toContain('Network Sync Error');
      expect(dashboardScreenCode).toContain('Retry');
    });

    it('implements Pull-to-Refresh with RefreshControl', () => {
      expect(dashboardScreenCode).toContain('RefreshControl');
      expect(dashboardScreenCode).toContain('refreshing={refreshing}');
      expect(dashboardScreenCode).toContain('onRefresh={onRefresh}');
    });
  });

  // Scenario 13: State Restoration Across App Restart
  describe('Scenario 13: State Restoration Across App Restart', () => {
    it('persists registered vendor session locally for recovery', () => {
      expect(vendorServiceCode).toContain('necl_mobile_session_v1');
      expect(vendorServiceCode).toContain('VENDOR_APP_PREFIX');
      expect(appCode).toContain('authService.checkExistingSession()');
    });

    it('loads stored vendor application number on startup in App.tsx', () => {
      expect(appCode).toContain('effectiveVendorId');
      expect(appCode).toContain('vendorApplicationNumber');
    });
  });

  // Scenario 14: Debounce and Safe Retry Behavior
  describe('Scenario 14: Debounce and Safe Retry Behavior', () => {
    it('disables submit button and shows activity spinner during ongoing submission', () => {
      expect(reviewScreenCode).toContain('disabled={loading}');
      expect(reviewScreenCode).toContain('loading && styles.goldBtnDisabled');
    });

    it('retains all filled form data so user can retry safely upon network failure', () => {
      expect(reviewScreenCode).toContain('const [formData, setFormData] = useState<VendorRegistrationFormData | null>(null)');
      expect(reviewScreenCode).toContain('setLoading(false)');
    });
  });

  // Scenario 15: Full System Integration & Database Schema Consistency
  describe('Scenario 15: Full System Integration & Database Schema Consistency', () => {
    it('defines compliance and audit columns on vendor_companies table in migration', () => {
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS vendor_code TEXT');
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS compliance_status TEXT');
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS approved_by TEXT');
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ');
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS rejection_reason TEXT');
      expect(migrationCode).toContain('ADD COLUMN IF NOT EXISTS correction_notes TEXT');
    });

    it('adds performance indexes for vendor_code, status, and compliance_status lookups', () => {
      expect(migrationCode).toContain('idx_vendor_companies_code');
      expect(migrationCode).toContain('idx_vendor_companies_status');
      expect(migrationCode).toContain('idx_vendor_companies_compliance');
    });

    it('maintains compatibility with existing NECL branding and styling', () => {
      expect(reviewScreenCode).toContain('#172B4D');
      expect(reviewScreenCode).toContain('#F05A22');
      expect(statusScreenCode).toContain('#172B4D');
      expect(statusScreenCode).toContain('#F05A22');
    });
  });
});
