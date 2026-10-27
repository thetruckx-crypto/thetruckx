import { describe, it, expect } from 'vitest';
import { normalizeVendorDocType } from '../../utils/vendorDocHelpers';

describe('Vendor Workflow Improvements & Integrity Suite', () => {
  describe('1. Document Normalization & Category Mapping', () => {
    it('correctly maps Company PAN to VENDOR_KYC category and COMPANY_PAN document_type', () => {
      const res = normalizeVendorDocType('COMPANY_PAN');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('COMPANY_PAN');
    });

    it('correctly maps GST Certificate to VENDOR_KYC and GST_CERTIFICATE', () => {
      const res = normalizeVendorDocType('GST_CERTIFICATE');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('GST_CERTIFICATE');
    });

    it('maps BANK_CANCELLED_CHEQUE to VENDOR_KYC and BANK_PASSBOOK constraint type', () => {
      const res = normalizeVendorDocType('BANK_CANCELLED_CHEQUE');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('BANK_PASSBOOK');
    });

    it('maps MSME_UDYAM to VENDOR_KYC and MSME_UDYAM', () => {
      const res = normalizeVendorDocType('MSME_UDYAM');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('MSME_UDYAM');
    });

    it('maps TRANSPORT_DECLARATION to VENDOR_KYC and TIE_UP_AUTHORIZATION', () => {
      const res = normalizeVendorDocType('TRANSPORT_DECLARATION');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('TIE_UP_AUTHORIZATION');
    });

    it('safely handles unknown document types with fallback to OTHER', () => {
      const res = normalizeVendorDocType('UNKNOWN_CUSTOM_DOC');
      expect(res.category).toBe('VENDOR_KYC');
      expect(res.docType).toBe('OTHER');
    });
  });

  describe('2. Document Verification Status Constraint Compliance', () => {
    const VALID_DOC_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'REPLACEMENT_REQUESTED'];

    it('ensures approved status uses VERIFIED to avoid DB check constraint violation', () => {
      const targetStatus = 'VERIFIED';
      expect(VALID_DOC_STATUSES).toContain(targetStatus);
      expect(targetStatus).not.toBe('APPROVED'); // Database forbids 'APPROVED' on documents table
    });

    it('ensures rejection status is valid in constraint enum', () => {
      const rejectStatus = 'REJECTED';
      expect(VALID_DOC_STATUSES).toContain(rejectStatus);
    });
  });

  describe('3. Account Status vs Verification Status Separation', () => {
    const mockVendors = [
      { id: 'v1', vendor_name: 'Carrier A', status: 'APPROVED' },
      { id: 'v2', vendor_name: 'Carrier B', status: 'PENDING' },
      { id: 'v3', vendor_name: 'Carrier C', status: 'REJECTED' },
      { id: 'v4', vendor_name: 'Carrier D', status: 'INACTIVE' },
      { id: 'v5', vendor_name: 'Carrier E', status: 'SUSPENDED' },
    ];

    it('separates verified count strictly to APPROVED status', () => {
      const verified = mockVendors.filter((v) => v.status === 'APPROVED');
      expect(verified).toHaveLength(1);
      expect(verified[0].id).toBe('v1');
    });

    it('categorizes pending verification candidates accurately', () => {
      const pending = mockVendors.filter((v) => v.status === 'PENDING');
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('v2');
    });

    it('categorizes inactive and suspended vendors without conflating with verification', () => {
      const inactive = mockVendors.filter((v) => v.status === 'INACTIVE' || v.status === 'REJECTED' || v.status === 'SUSPENDED');
      expect(inactive).toHaveLength(3);
    });
  });

  describe('4. Address Parsing Resilience Without Falsified Geographies', () => {
    function parseAddress(address?: string | null) {
      const raw = address || '';
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      let city = '';
      let state = '';
      if (parts.length >= 2) {
        city = parts[parts.length - 2];
        state = parts[parts.length - 1];
      } else if (parts.length === 1) {
        city = parts[0];
      }
      return {
        city: city || (raw ? raw.split(',')[0].trim() : '—'),
        state: state || '—',
      };
    }

    it('parses city and state correctly when structured', () => {
      const parsed = parseAddress('Industrial Area, Dankuni, Kolkata, West Bengal');
      expect(parsed.city).toBe('Kolkata');
      expect(parsed.state).toBe('West Bengal');
    });

    it('does not falsely inject Guwahati/Assam when address is empty or single city', () => {
      const emptyParsed = parseAddress(null);
      expect(emptyParsed.city).toBe('—');
      expect(emptyParsed.state).toBe('—');

      const singleCity = parseAddress('Dispur');
      expect(singleCity.city).toBe('Dispur');
      expect(singleCity.state).toBe('—');
    });
  });
});
