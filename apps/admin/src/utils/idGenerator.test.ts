import { describe, it, expect } from 'vitest';
import {
  formatTruckxId,
  isValidTruckxId,
  TRUCKX_ID_REGEX,
  TruckxEntityType,
  formatNeclId,
  isValidNeclId,
  parseNeclId,
  formatDisplayId,
  getIstDateKey,
  NECL_ID_REGEX,
  NeclEntityType,
} from './idGenerator';
import { pincodeService } from '../services/pincodeService';

describe('THE TRUCKX Unified ID Generation System', () => {
  const truckxEntities: { entity: TruckxEntityType; code: string }[] = [
    { entity: 'AC', code: 'TRUCKX-AC' },
    { entity: 'CL', code: 'TRUCKX-CL' },
    { entity: 'VE', code: 'TRUCKX-VE' },
    { entity: 'DR', code: 'TRUCKX-DR' },
    { entity: 'REQ', code: 'TRUCKX-REQ' },
    { entity: 'QT', code: 'TRUCKX-QT' },
    { entity: 'BK', code: 'TRUCKX-BK' },
    { entity: 'VH', code: 'TRUCKX-VH' },
    { entity: 'TR', code: 'TRUCKX-TR' },
  ];

  describe('0. THE TRUCKX Canonical ID Formats (Task 2)', () => {
    it('should generate valid IDs for all 9 core THE TRUCKX entities', () => {
      for (const { entity, code } of truckxEntities) {
        const id = formatTruckxId(entity, 1, new Date('2026-10-30T12:00:00Z'));
        expect(id).toMatch(TRUCKX_ID_REGEX);
        expect(isValidTruckxId(id)).toBe(true);
        expect(isValidTruckxId(id, entity)).toBe(true);
        expect(id.startsWith(`${code}-`)).toBe(true);
        expect(id.endsWith('-00001')).toBe(true);
      }
    });

    it('should format sequence numbers with 5-digit zero-padding', () => {
      const id1 = formatTruckxId('AC', 1, new Date('2026-10-30T00:00:00Z'));
      expect(id1).toBe('TRUCKX-AC-30102026-00001');

      const id2 = formatTruckxId('CL', 42, new Date('2026-10-30T00:00:00Z'));
      expect(id2).toBe('TRUCKX-CL-30102026-00042');

      const id3 = formatTruckxId('BK', 789, new Date('2026-10-30T00:00:00Z'));
      expect(id3).toBe('TRUCKX-BK-30102026-00789');

      const id4 = formatTruckxId('VE', 99999, new Date('2026-10-30T00:00:00Z'));
      expect(id4).toBe('TRUCKX-VE-30102026-99999');
    });

    it('should normalize legacy aliases to canonical entity codes', () => {
      expect(formatTruckxId('VD', 5, new Date('2026-10-30T00:00:00Z'))).toBe('TRUCKX-VE-30102026-00005');
      expect(formatTruckxId('TRP', 12, new Date('2026-10-30T00:00:00Z'))).toBe('TRUCKX-TR-30102026-00012');
      expect(formatTruckxId('BOK', 99, new Date('2026-10-30T00:00:00Z'))).toBe('TRUCKX-BK-30102026-00099');
    });
  });

  const entityTypes: NeclEntityType[] = [
    'CL', 'VD', 'DR', 'VH', 'BK', 'REQ', 'RFQ', 'QT',
    'PAY', 'INV', 'RFD', 'TXN', 'SHP', 'TRP', 'TKT',
    'DOC', 'NTF', 'CN', 'PO', 'AUD'
  ];

  describe('1. Canonical ID Format Specifications', () => {
    it('should generate valid IDs for all 20 standard entity codes', () => {
      for (const entity of entityTypes) {
        const id = formatNeclId(entity, 42, new Date('2026-10-15T12:00:00Z'));
        expect(id).toMatch(NECL_ID_REGEX);
        expect(isValidNeclId(id)).toBe(true);
        expect(isValidNeclId(id, entity)).toBe(true);
        expect(id.startsWith(`NECL-${entity}-`)).toBe(true);
      }
    });

    it('should format sequence numbers with 5-digit zero-padding', () => {
      const id1 = formatNeclId('CL', 1, new Date('2026-10-15T00:00:00Z'));
      expect(id1.endsWith('-00001')).toBe(true);

      const id2 = formatNeclId('BK', 789, new Date('2026-10-15T00:00:00Z'));
      expect(id2.endsWith('-00789')).toBe(true);

      const id3 = formatNeclId('VD', 99999, new Date('2026-10-15T00:00:00Z'));
      expect(id3.endsWith('-99999')).toBe(true);
    });

    it('should calculate date key in Asia/Kolkata (IST) timezone with midnight rollover', () => {
      // 2026-10-14 18:30:00 UTC is 2026-10-15 00:00:00 IST
      const dateUtc = new Date('2026-10-14T18:30:00.000Z');
      const dateKey = getIstDateKey(dateUtc);
      expect(dateKey).toBe('15102026');
    });
  });

  describe('2. ID Parser Specifications', () => {
    it('should parse components correctly from a valid NECL ID', () => {
      const parsed = parseNeclId('NECL-BK-15102026-00123');
      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe('NECL');
      expect(parsed?.entityType).toBe('BK');
      expect(parsed?.dateKey).toBe('15102026');
      expect(parsed?.day).toBe('15');
      expect(parsed?.month).toBe('10');
      expect(parsed?.year).toBe('2026');
      expect(parsed?.sequence).toBe(123);
    });

    it('should return null for invalid or corrupted IDs', () => {
      expect(parseNeclId('INVALID-ID-123')).toBeNull();
      expect(parseNeclId('NECL-UNKNOWN-15102026-00001')).toBeNull();
      expect(parseNeclId('NECL-BK-151020-00001')).toBeNull();
    });
  });

  describe('3. Deterministic Display Formatter (formatDisplayId)', () => {
    it('should preserve already valid NECL Unique IDs without re-generating', () => {
      const existingId = 'NECL-CL-15102026-00042';
      expect(formatDisplayId('CL', existingId)).toBe(existingId);
    });

    it('should format legacy UUIDs and codes into canonical NECL IDs', () => {
      const legacyId = '550e8400-e29b-41d4-a716-446655440000';
      const formatted = formatDisplayId('CL', legacyId, '2026-10-15T10:00:00Z');
      expect(formatted).toMatch(NECL_ID_REGEX);
      expect(isValidNeclId(formatted, 'CL')).toBe(true);
    });

    it('should produce identical formatted IDs for identical legacy inputs (deterministic)', () => {
      const input = 'CLI-legacy-partner-99';
      const f1 = formatDisplayId('CL', input, '2026-10-15T00:00:00Z');
      const f2 = formatDisplayId('CL', input, '2026-10-15T00:00:00Z');
      expect(f1).toBe(f2);
    });
  });

  describe('4. Pincode Lookup & Offline Logistics Hub Fallbacks', () => {
    it('should resolve North Eastern freight hubs from offline directory', async () => {
      // 781001 is Guwahati / Kamrup Metropolitan
      const res = await pincodeService.lookupPincode('781001');
      expect(res.success).toBe(true);
      expect(res.data?.state).toBe('Assam');
      expect(['Guwahati', 'Kamrup', 'Kamrup Metropolitan']).toContain(res.data?.city);
    });

    it('should resolve Kolkata / West Bengal freight corridors', async () => {
      // 700001 is Kolkata
      const res = await pincodeService.lookupPincode('700001');
      expect(res.success).toBe(true);
      expect(res.data?.state).toBe('West Bengal');
      expect(res.data?.city).toBe('Kolkata');
    });

    it('should return fallback message for unresolvable pin code', async () => {
      const res = await pincodeService.lookupPincode('000000');
      expect(res.success).toBe(false);
      expect(res.error).toContain('PIN code not found');
    });
  });
});
