import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Single-Screen Driver Registration & Admin Email Removal', () => {
  const vendorDirectoryCode = fs.readFileSync(
    path.join(__dirname, '../vendors/VendorDirectory.tsx'),
    'utf-8'
  );

  const inviteVendorCode = fs.readFileSync(
    path.join(__dirname, '../vendors/InviteVendor.tsx'),
    'utf-8'
  );

  const driverQueueCode = fs.readFileSync(
    path.join(__dirname, './DriverVerificationQueue.tsx'),
    'utf-8'
  );

  const driverAuditCode = fs.readFileSync(
    path.join(__dirname, './DriverLicenceAudit.tsx'),
    'utf-8'
  );

  const mobileDriverScreenPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/driver/registration/DriverRegistrationScreen.tsx'
  );
  const mobileDriverScreenCode = fs.existsSync(mobileDriverScreenPath)
    ? fs.readFileSync(mobileDriverScreenPath, 'utf-8')
    : '';

  const mobileConfirmationPath = path.resolve(
    __dirname,
    '../../../../mobile/src/screens/driver/registration/DriverSubmissionConfirmationScreen.tsx'
  );
  const mobileConfirmationCode = fs.existsSync(mobileConfirmationPath)
    ? fs.readFileSync(mobileConfirmationPath, 'utf-8')
    : '';

  const serverIndexPath = path.resolve(
    __dirname,
    '../../../../../server/src/index.ts'
  );
  const serverIndexCode = fs.existsSync(serverIndexPath)
    ? fs.readFileSync(serverIndexPath, 'utf-8')
    : '';

  describe('1. Admin Panel - Email Removal from Vendor & Driver Account Creation', () => {
    it('should NOT require email address for vendor creation in VendorDirectory', () => {
      // In VendorDirectory Section B, Official Email Address input should be removed
      expect(vendorDirectoryCode).not.toContain('<label className="field-label-req">Official Email Address *</label>');
      // Validate function should not mandate email
      expect(vendorDirectoryCode).not.toContain("!formData.email.trim()");
    });

    it('should safely insert nullable email in vendor_users from VendorDirectory', () => {
      expect(vendorDirectoryCode).toContain('email: formData.email?.trim() || null');
    });

    it('should NOT require email address in InviteVendor form', () => {
      // In InviteVendor Section B, Email Address input should be removed
      expect(inviteVendorCode).not.toContain('placeholder="Enter email address"');
      // Validate function should not mandate email
      expect(inviteVendorCode).not.toContain("!formData.email.trim()");
    });

    it('should safely insert nullable email in vendor_users from InviteVendor', () => {
      expect(inviteVendorCode).toContain('email: formData.email?.trim() || null');
    });

    it('should provide Create Driver Account modal in DriverVerificationQueue WITHOUT email field', () => {
      expect(driverQueueCode).toContain('id="btn-create-driver"');
      expect(driverQueueCode).toContain('Create Driver Account');
      expect(driverQueueCode).toContain('createFormData.fullName');
      expect(driverQueueCode).toContain('createFormData.mobile');
      expect(driverQueueCode).toContain('createFormData.dateOfBirth');
      expect(driverQueueCode).toContain('createFormData.licenceNumber');
      expect(driverQueueCode).toContain('createFormData.primaryVendorId');
      // Must NOT contain an email field in the create driver form
      expect(driverQueueCode).not.toContain('createFormData.email');
      expect(driverQueueCode).not.toContain('placeholder="Enter email"');
    });
  });

  describe('2. Mobile App - Single-Screen Driver Registration', () => {
    it('should contain all required sections (A, B, C, D) on a single screen', () => {
      expect(mobileDriverScreenCode).toContain('Personal Details');
      expect(mobileDriverScreenCode).toContain('Driving Licence (DL) Upload');
      expect(mobileDriverScreenCode).toContain('Aadhaar Card Upload');
      expect(mobileDriverScreenCode).toContain('Select Connected Vendor');
    });

    it('should require Full Name, Phone Number, and Date of Birth in Section A', () => {
      expect(mobileDriverScreenCode).toContain('fullName');
      expect(mobileDriverScreenCode).toContain('phone');
      expect(mobileDriverScreenCode).toContain('dateOfBirth');
      expect(mobileDriverScreenCode).toContain('calculateAge');
      expect(mobileDriverScreenCode).toContain('at least 18 years old');
    });

    it('should provide Open Camera and Upload from Device for Driving Licence front and back', () => {
      expect(mobileDriverScreenCode).toContain('Driving Licence — Front Side');
      expect(mobileDriverScreenCode).toContain('Driving Licence — Back Side');
      expect(mobileDriverScreenCode).toContain('Open Camera');
      expect(mobileDriverScreenCode).toContain('Upload from Device');
      expect(mobileDriverScreenCode).toContain('dlFrontUri');
      expect(mobileDriverScreenCode).toContain('dlBackUri');
      expect(mobileDriverScreenCode).toContain('Retake Photo');
      expect(mobileDriverScreenCode).toContain('Replace');
      expect(mobileDriverScreenCode).toContain('Remove');
    });

    it('should provide Open Camera and Upload from Device for Aadhaar Card front and back', () => {
      expect(mobileDriverScreenCode).toContain('Aadhaar Card — Front Side');
      expect(mobileDriverScreenCode).toContain('Aadhaar Card — Back Side');
      expect(mobileDriverScreenCode).toContain('aadhaarFrontUri');
      expect(mobileDriverScreenCode).toContain('aadhaarBackUri');
    });

    it('should handle camera and storage permissions with clear instructions', () => {
      expect(mobileDriverScreenCode).toContain('requestCameraPermissionsAsync');
      expect(mobileDriverScreenCode).toContain('requestMediaLibraryPermissionsAsync');
      expect(mobileDriverScreenCode).toContain('Camera Permission Denied');
      expect(mobileDriverScreenCode).toContain('Gallery Permission Denied');
    });

    it('should fetch active vendors from backend and provide searchable selection', () => {
      expect(mobileDriverScreenCode).toContain('getRegisteredTransporters');
      expect(mobileDriverScreenCode).toContain('selectedVendor');
      expect(mobileDriverScreenCode).toContain('Change Connected Vendor');
      expect(mobileDriverScreenCode).toContain('vendorSearchQuery');
      expect(mobileDriverScreenCode).toContain('1800-NECL-LOGISTICS');
    });

    it('should submit registration for admin approval with disabled button while submitting', () => {
      expect(mobileDriverScreenCode).toContain('Submit for Approval');
      expect(mobileDriverScreenCode).toContain('btn-submit-driver-approval');
      expect(mobileDriverScreenCode).toContain('isSubmitting');
      expect(mobileDriverScreenCode).toContain('submitBtnDisabled');
    });

    it('should display the exact required confirmation message on submission screen', () => {
      expect(mobileConfirmationCode).toContain(
        'Driver registration submitted successfully. Your details are under review by the NECL Admin. You can access the driver account after approval.'
      );
    });
  });

  describe('3. Admin Panel - Driver Review & Approval', () => {
    it('should display drivers with Name, Phone, DOB, Vendor, and Submission Date in Queue table', () => {
      expect(driverQueueCode).toContain('Driver Name ⇅');
      expect(driverQueueCode).toContain('Mobile ⇅');
      expect(driverQueueCode).toContain('Date of Birth ⇅');
      expect(driverQueueCode).toContain('Vendor ⇅');
      expect(driverQueueCode).toContain('Submission Date ⇅');
      expect(driverQueueCode).toContain('driver.date_of_birth || driver.dob');
      expect(driverQueueCode).toContain('driver.created_at');
    });

    it('should preview DL front/back and Aadhaar front/back images in DriverLicenceAudit', () => {
      expect(driverAuditCode).toContain('Driving Licence Upload (Front & Back)');
      expect(driverAuditCode).toContain('Aadhaar Card Upload (Front & Back)');
      expect(driverAuditCode).toContain('dlFrontDoc');
      expect(driverAuditCode).toContain('dlBackDoc');
      expect(driverAuditCode).toContain('aadhaarFrontDoc');
      expect(driverAuditCode).toContain('aadhaarBackDoc');
      expect(driverAuditCode).toContain('setZoomImage');
    });

    it('should display driver details: name, phone, dob, selected vendor, submission date', () => {
      expect(driverAuditCode).toContain('driver.full_name');
      expect(driverAuditCode).toContain('driver.mobile');
      expect(driverAuditCode).toContain('dobFormatted');
      expect(driverAuditCode).toContain('submissionDateFormatted');
    });

    it('should allow admin to review and update driver vendor association', () => {
      expect(driverAuditCode).toContain('handleUpdateVendorAssociation');
      expect(driverAuditCode).toContain('Connected Vendor Association');
      expect(driverAuditCode).toContain('availableVendors');
      expect(driverAuditCode).toContain("update({ primary_vendor_id: selectedVendorId })");
    });

    it('should enforce consistent statuses: Pending Approval, Approved, Rejected', () => {
      expect(driverAuditCode).toContain("'Pending Approval'");
      expect(driverAuditCode).toContain("'Approved'");
      expect(driverAuditCode).toContain("'Rejected'");
    });

    it('should require rejection reason when rejecting driver registration', () => {
      expect(driverAuditCode).toContain('Please enter a rejection reason before rejecting.');
      expect(driverAuditCode).toContain('handleReject');
      expect(driverAuditCode).toContain('presetReasons');
      expect(driverAuditCode).toContain('rejection_reason');
    });
  });

  describe('4. Backend Integration & Data Validation', () => {
    it('should support single-screen driver registration in /api/driver/submit-registration', () => {
      expect(serverIndexCode).toContain('/api/driver/submit-registration');
      expect(serverIndexCode).toContain('dateOfBirth');
      expect(serverIndexCode).toContain('dlFrontUri');
      expect(serverIndexCode).toContain('dlBackUri');
      expect(serverIndexCode).toContain('aadhaarFrontUri');
      expect(serverIndexCode).toContain('aadhaarBackUri');
      expect(serverIndexCode).toContain('cleanLicence');
    });
  });
});
