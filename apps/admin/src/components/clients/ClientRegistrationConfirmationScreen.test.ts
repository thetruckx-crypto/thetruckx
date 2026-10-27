import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('NECL Client Registration Success Screen Redesign Requirements', () => {
  const screenPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/client/onboarding/ClientRegistrationConfirmationScreen.tsx'
  );
  const screenCode = fs.readFileSync(screenPath, 'utf-8');

  describe('1. Header and Success State', () => {
    it('should reduce the height of the illustrated banner by ~30-40% (height 120)', () => {
      expect(screenCode).toContain('<ScenicHeroBanner height={120} />');
    });

    it('should preserve the NECL branding while minimizing unnecessary decorative space', () => {
      expect(screenCode).toContain('<BrandLogoHeader size="sm" showSubtitle={false} />');
      expect(screenCode).toContain('brandLogoCard');
    });

    it('should display a clean green success icon with the exact heading', () => {
      expect(screenCode).toContain('<CheckCircle2 size={34} color="#16A779" strokeWidth={2.4} />');
      expect(screenCode).toContain('Registration Submitted Successfully');
      expect(screenCode).toContain('styles.mainHeading');
    });

    it('should add the concise supporting text stating awaiting admin verification', () => {
      expect(screenCode).toContain(
        'Your registration has been submitted and is awaiting admin verification.'
      );
    });

    it('should ensure success state communicates successful submission, not account approval', () => {
      expect(screenCode).toContain('Registration Submitted Successfully');
      expect(screenCode).not.toContain('Account Approved Successfully');
    });
  });

  describe('2. Application Status and Client ID', () => {
    it('should create a compact, visually prominent card displaying Assigned Client ID and Status', () => {
      expect(screenCode).toContain('ASSIGNED CLIENT ID');
      expect(screenCode).toContain('Application Status');
      expect(screenCode).toContain('Pending');
    });

    it('should use orange for Client ID and subtle amber badge for pending status', () => {
      expect(screenCode).toContain("color: '#F15A29'"); // Client ID
      expect(screenCode).toContain("backgroundColor: '#FFF0C2'"); // Pending amber badge
      expect(screenCode).toContain("color: '#B45309'"); // Amber badge text
    });

    it('should add a copy icon beside Client ID and implement brief "Client ID copied" confirmation', () => {
      expect(screenCode).toContain('<Copy size={17} color="#F15A29" strokeWidth={2.2} />');
      expect(screenCode).toContain('handleCopyClientId');
      expect(screenCode).toContain('Client ID copied');
      expect(screenCode).toContain('Clipboard.setString(displayClientId)');
    });

    it('should clearly communicate that dashboard access will be available after approval', () => {
      expect(screenCode).toContain('Dashboard access will be automatically unlocked upon admin approval.');
    });
  });

  describe('3. Application Summary', () => {
    it('should display clean, compact card with consistent label-value alignment and exact fallbacks', () => {
      expect(screenCode).toContain("companyName = businessDetails?.companyName || 'Enterprise Partner'");
      expect(screenCode).toContain("entityType = businessDetails?.businessType || 'Private Limited'");
      expect(screenCode).toContain("gstin = businessDetails?.gstin || '18AAAAA0000A1Z5'");
      expect(screenCode).toContain('formattedSubmissionDate');
    });

    it('should render all 4 required summary fields with proper typography and formatting', () => {
      expect(screenCode).toContain('<Text style={styles.summaryLabel}>Company Name</Text>');
      expect(screenCode).toContain('<Text style={styles.summaryLabel}>Entity Type</Text>');
      expect(screenCode).toContain('<Text style={styles.summaryLabel}>GSTIN</Text>');
      expect(screenCode).toContain('<Text style={styles.summaryLabel}>Submission Date</Text>');
    });
  });

  describe('4. Compliance Information', () => {
    it('should create a subtle informational card with shield icon and light warm background', () => {
      expect(screenCode).toContain('<Shield size={17} color="#C2410C" strokeWidth={2.2} />');
      expect(screenCode).toContain("backgroundColor: '#FFF8F5'");
      expect(screenCode).toContain("borderColor: '#FED7AA'");
    });

    it('should display the exact compliance notice text', () => {
      expect(screenCode).toContain(
        'Transport bookings, rate contracting, and dispatches will be enabled after NECL compliance officers verify your submitted commercial certificates.'
      );
    });
  });

  describe('5. Action Buttons Hierarchy', () => {
    it('should render primary CTA "Track Application Status" with orange styling', () => {
      expect(screenCode).toContain('<Text style={styles.primaryBtnText}>Track Application Status</Text>');
      expect(screenCode).toContain("backgroundColor: '#F15A29'");
      expect(screenCode).toContain('onTrackStatus');
    });

    it('should render secondary CTA "Back to Login" with dark navy styling', () => {
      expect(screenCode).toContain('<Text style={styles.secondaryBtnText}>Back to Login</Text>');
      expect(screenCode).toContain("backgroundColor: '#0B1933'");
      expect(screenCode).toContain('onBackToLogin');
    });

    it('should render support action "Contact NECL Compliance Support" without invented numbers', () => {
      expect(screenCode).toContain('Contact NECL Compliance Support');
      expect(screenCode).toContain('handleSupportPress');
      expect(screenCode).toContain('tel:18002584567'); // Verified NECL helpline
    });
  });

  describe('6. Visual Design System & Touch Targets', () => {
    it('should adhere to the specified palette and spacing tokens', () => {
      expect(screenCode).toContain('#F15A29'); // Primary orange
      expect(screenCode).toContain('#0B1933'); // Dark navy
      expect(screenCode).toContain('#16A779'); // Success green
      expect(screenCode).toContain('#FFF0C2'); // Pending amber
    });

    it('should provide touch targets of at least 44-48px', () => {
      expect(screenCode).toContain('minWidth: 44');
      expect(screenCode).toContain('minHeight: 44');
      expect(screenCode).toContain('height: 52');
      expect(screenCode).toContain('height: 50');
    });

    it('should use card corner radii between 16-20px', () => {
      expect(screenCode).toContain('borderRadius: 18');
      expect(screenCode).toContain('borderRadius: 16');
    });
  });
});
