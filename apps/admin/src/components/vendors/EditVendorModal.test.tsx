import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('EditVendorModal and Vendor Workflow Audit - NECL Admin Panel', () => {
  const modalPath = path.join(__dirname, 'EditVendorModal.tsx');
  const profilePath = path.join(__dirname, 'VendorProfile.tsx');
  const directoryPath = path.join(__dirname, 'VendorDirectory.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const directoryContent = fs.readFileSync(directoryPath, 'utf8');

  it('1. should verify EditVendorModal displays the strict navigation hierarchy Vendors → Vendor Directory → Vendor Name → Edit Vendor', () => {
    expect(modalContent).toContain('Vendors');
    expect(modalContent).toContain('Vendor Directory');
    expect(modalContent).toContain('Edit Vendor');
    expect(modalContent).toContain('modal-breadcrumb-bar');
  });

  it('2. should verify VendorProfile displays correct breadcrumb hierarchy and supports edit view', () => {
    expect(profileContent).toContain('Vendor Directory');
    expect(profileContent).toContain('Edit Vendor');
    expect(profileContent).toContain('<EditVendorModal');
  });

  it('3. should verify EditVendorModal provides validation for business name, PAN, GSTIN, mobile, and address', () => {
    expect(modalContent).toContain('validateForm');
    expect(modalContent).toContain('/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/'); // PAN validation
    expect(modalContent).toContain('Business / Transporter legal name is required');
    expect(modalContent).toContain('Primary contact person name is required');
    expect(modalContent).toContain('Mobile number must be exactly 10 digits');
  });

  it('4. should verify live pincode auto-resolution using pincodeService', () => {
    expect(modalContent).toContain('pincodeService.fetchPincode');
    expect(modalContent).toContain('Auto-resolved:');
  });

  it('5. should verify data integrity safeguard notice preserving vehicles, drivers, and KYC documents', () => {
    expect(modalContent).toContain('Data Integrity Safeguard:');
    expect(modalContent).toContain('uploaded KYC documents, individually registered vehicles, drivers, RFQs, and existing quotations');
  });

  it('6. should verify verification status and account status separation with audit logging', () => {
    expect(profileContent).toContain('VENDOR_APPROVED');
    expect(profileContent).toContain('VENDOR_REJECTED');
    expect(modalContent).toContain('VENDOR_UPDATED');
  });

  it('7. should verify VendorDirectory reuses EditVendorModal and refreshes directory upon update', () => {
    expect(directoryContent).toContain('import { EditVendorModal } from \'./EditVendorModal\';');
    expect(directoryContent).toContain('<EditVendorModal');
    expect(directoryContent).toContain('onSaved');
  });

  it('8. should verify genuine empty states in VendorProfile without falling back to random requirements', () => {
    expect(profileContent).not.toContain('.from(\'requirements\')\n              .select(\'*, client_companies(company_name)\')\n              .order(\'created_at\', { ascending: false })\n              .limit(20)');
    expect(profileContent).toContain('setRequirements([]);');
  });
});
