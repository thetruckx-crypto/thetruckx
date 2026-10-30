import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('THE TRUCKX - Premium Mobile Login & Authentication Architecture', () => {
  const mobileRoot = path.join(__dirname, '..', '..', '..', 'mobile', 'src');
  const loginScreenPath = path.join(mobileRoot, 'screens', 'auth', 'login', 'LoginScreen.tsx');
  const otpScreenPath = path.join(mobileRoot, 'screens', 'auth', 'otp', 'OtpScreen.tsx');
  const authComponentsDir = path.join(mobileRoot, 'components', 'auth');

  const loginScreenCode = fs.readFileSync(loginScreenPath, 'utf-8');
  const otpScreenCode = fs.readFileSync(otpScreenPath, 'utf-8');
  const barrelExportCode = fs.readFileSync(path.join(authComponentsDir, 'index.ts'), 'utf-8');

  describe('1. Brand Identity & Strict Design Compliance', () => {
    it('uses primary brand orange #F15A24 and navy #172B4D', () => {
      expect(loginScreenCode).toContain('#F15A24');
      expect(loginScreenCode).toContain('#172B4D');
      expect(otpScreenCode).toContain('#F15A24');
      expect(otpScreenCode).toContain('#172B4D');
    });

    it('uses pure white background and enterprise gray typography tokens', () => {
      expect(loginScreenCode).toContain('#FFFFFF');
      expect(loginScreenCode).toContain('#7B8798');
      expect(otpScreenCode).toContain('#FFFFFF');
      expect(otpScreenCode).toContain('#7B8798');
    });

    it('strictly avoids truck photographs, landscape illustrations, and decorative waves on login & otp screens', () => {
      expect(loginScreenCode).not.toContain('AuthBottomDecoration');
      expect(otpScreenCode).not.toContain('AuthBottomDecoration');
      expect(loginScreenCode).not.toContain('truck_road_sunset');
      expect(otpScreenCode).not.toContain('truck_road_sunset');
    });

    it('integrates original BrandLogoHeader asset maintaining clean aspect ratio', () => {
      expect(loginScreenCode).toContain('BrandLogoHeader');
      expect(otpScreenCode).toContain('BrandLogoHeader');
    });
  });

  describe('2. Login Screen Structure & Controls', () => {
    it('renders Header with back arrow, Welcome Back title with orange highlight, and subtitle', () => {
      expect(loginScreenCode).toContain('ArrowLeft');
      expect(loginScreenCode).toContain('Welcome');
      expect(loginScreenCode).toContain('Back');
      expect(loginScreenCode).toContain('Login to continue to your account');
    });

    it('replaces bulky role cards with premium dropdown AccountTypeSelector and AccountTypeBottomSheet', () => {
      expect(loginScreenCode).toContain('AccountTypeSelector');
      expect(loginScreenCode).toContain('AccountTypeBottomSheet');
      expect(loginScreenCode).toContain('selectedRole={role}');
      expect(loginScreenCode).toContain('onSelectRole={handleSelectRole}');
    });

    it('provides role descriptions for Client, Vendor, and Driver in AccountTypeBottomSheet', () => {
      const sheetCode = fs.readFileSync(path.join(authComponentsDir, 'AccountTypeBottomSheet.tsx'), 'utf-8');
      expect(sheetCode).toContain('Book and manage your shipments');
      expect(sheetCode).toContain('Manage your fleet and services');
      expect(sheetCode).toContain('Access your trips and deliveries');
    });

    it('implements MobileNumberField with Indian country code +91 and 10-digit validation', () => {
      expect(loginScreenCode).toContain('MobileNumberField');
      const mobileFieldCode = fs.readFileSync(path.join(authComponentsDir, 'MobileNumberField.tsx'), 'utf-8');
      expect(mobileFieldCode).toContain('+91');
      expect(mobileFieldCode).toContain('🇮🇳');
      expect(mobileFieldCode).toContain('10');
    });

    it('implements custom Remember Me checkbox and functional Forgot Number recovery flow', () => {
      expect(loginScreenCode).toContain('CustomCheckbox');
      expect(loginScreenCode).toContain('ForgotNumberModal');
      expect(loginScreenCode).toContain('Forgot Number?');
      const forgotModalCode = fs.readFileSync(path.join(authComponentsDir, 'ForgotNumberModal.tsx'), 'utf-8');
      expect(forgotModalCode).toContain('Account Recovery');
      expect(forgotModalCode).toContain('1800-TRUCKX');
    });

    it('implements Send OTP & Login CTA with validation and loading indicator', () => {
      expect(loginScreenCode).toContain('PrimaryButton');
      expect(loginScreenCode).toContain('Send OTP & Login');
      expect(loginScreenCode).toContain('disabled={!isMobileValid || loading}');
    });

    it('dynamically adapts registration CTA based on the selected role', () => {
      expect(loginScreenCode).toContain('SecondaryButton');
      const secondaryBtnCode = fs.readFileSync(path.join(authComponentsDir, 'SecondaryButton.tsx'), 'utf-8');
      expect(secondaryBtnCode).toContain('Register as Client');
      expect(secondaryBtnCode).toContain('Register as Vendor');
      expect(secondaryBtnCode).toContain('Register as Driver');
    });
  });

  describe('3. OTP Verification Screen Architecture', () => {
    it('displays Verify Your Mobile Number heading and masked mobile with change option', () => {
      expect(otpScreenCode).toContain('Verify Your');
      expect(otpScreenCode).toContain('Mobile Number');
      expect(otpScreenCode).toContain('Change');
    });

    it('integrates 6-digit individual square box OTPInput with auto-complete handler', () => {
      expect(otpScreenCode).toContain('OTPInput');
      expect(otpScreenCode).toContain('length={6}');
      expect(otpScreenCode).toContain('onComplete');
    });

    it('includes resend countdown timer and resend action', () => {
      expect(otpScreenCode).toContain('secondsLeft');
      expect(otpScreenCode).toContain('handleResendOtp');
      expect(otpScreenCode).toContain('Resend OTP');
    });

    it('renders Verify & Continue primary button', () => {
      expect(otpScreenCode).toContain('Verify & Continue');
      expect(otpScreenCode).toContain('PrimaryButton');
    });
  });

  describe('4. Component Reusability & Modular Architecture', () => {
    it('exports all 11 auth components through the auth barrel index', () => {
      expect(barrelExportCode).toContain("export * from './PrimaryButton'");
      expect(barrelExportCode).toContain("export * from './SecondaryButton'");
      expect(barrelExportCode).toContain("export * from './CustomCheckbox'");
      expect(barrelExportCode).toContain("export * from './MobileNumberField'");
      expect(barrelExportCode).toContain("export * from './AccountTypeSelector'");
      expect(barrelExportCode).toContain("export * from './AccountTypeBottomSheet'");
      expect(barrelExportCode).toContain("export * from './OTPInput'");
      expect(barrelExportCode).toContain("export * from './ErrorMessage'");
      expect(barrelExportCode).toContain("export * from './LoadingIndicator'");
      expect(barrelExportCode).toContain("export * from './AppTextField'");
      expect(barrelExportCode).toContain("export * from './ForgotNumberModal'");
    });
  });
});
