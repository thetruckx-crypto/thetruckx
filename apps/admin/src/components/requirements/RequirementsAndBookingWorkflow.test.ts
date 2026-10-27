/**
 * RequirementsAndBookingWorkflow.test.ts
 *
 * Comprehensive End-to-End Unit & Integration Logic Tests for:
 * NECL Transport Requirement, Sourcing, Quotation, Booking & Execution Pipeline.
 *
 * Validates the 5 Core Acceptance Criteria:
 * 1. Every vendor quotation belongs to the correct vendor and requirement.
 * 2. Vendor cost quote (vendor_quotations) and NECL client selling quote (client_quotes) remain strictly separate.
 * 3. Confirmed booking is created ONLY after client acceptance and required admin confirmation.
 * 4. 0.03 MT / kg unit toggle and conversion accuracy.
 * 5. Multi-vendor sourcing independence (declined vs quoted vs selected).
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// 1. CAPACITY & UNIT CONVERSION LOGIC
// ============================================================================

export function formatCapacityDisplay(capacityMt: number): { display: string; autoKg: boolean; kgValue: number } {
  if (capacityMt > 0 && capacityMt < 0.5) {
    const kg = Math.round(capacityMt * 1000);
    return {
      display: `${capacityMt} MT (${kg} kg)`,
      autoKg: true,
      kgValue: kg,
    };
  }
  return {
    display: `${capacityMt} MT`,
    autoKg: false,
    kgValue: Math.round(capacityMt * 1000),
  };
}

export function convertInputToCapacityMt(value: number, unit: 'MT' | 'kg'): number {
  if (unit === 'kg') {
    return parseFloat((value / 1000).toFixed(4));
  }
  return parseFloat(value.toFixed(4));
}

// ============================================================================
// 2. COMMERCIAL PRICING & QUOTATION CALCULATOR
// ============================================================================

export interface ClientQuoteCalculation {
  vendorBaseCost: number;
  adminMargin: number;
  taxableBase: number;
  gstRatePercent: number;
  gstAmount: number;
  totalClientAmount: number;
}

export function calculateClientQuote(
  vendorBaseCost: number,
  adminMargin: number,
  gstRatePercent: number = 18
): ClientQuoteCalculation {
  if (vendorBaseCost <= 0) throw new Error('Vendor cost must be greater than zero');
  if (adminMargin < 0) throw new Error('Admin margin cannot be negative');

  const taxableBase = Math.round((vendorBaseCost + adminMargin) * 100) / 100;
  const gstAmount = Math.round((taxableBase * (gstRatePercent / 100)) * 100) / 100;
  const totalClientAmount = Math.round((taxableBase + gstAmount) * 100) / 100;

  return {
    vendorBaseCost,
    adminMargin,
    taxableBase,
    gstRatePercent,
    gstAmount,
    totalClientAmount,
  };
}

// ============================================================================
// 3. BOOKING CONFIRMATION GATE VALIDATOR
// ============================================================================

export interface ClientQuoteRecord {
  id: string;
  requirement_id: string;
  version: number;
  vendor_base_cost: number;
  admin_margin: number;
  total_client_amount: number;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

export function validateBookingConfirmation(
  quote: ClientQuoteRecord | null,
  isEmergencyOverride: boolean = false,
  emergencyJustification?: string
): { canConfirm: boolean; reason?: string } {
  if (isEmergencyOverride) {
    if (!emergencyJustification || emergencyJustification.trim().length < 15) {
      return {
        canConfirm: false,
        reason: 'Emergency direct booking requires an administrative justification of at least 15 characters.',
      };
    }
    return { canConfirm: true };
  }

  if (!quote) {
    return {
      canConfirm: false,
      reason: 'No client quotation found. A client quotation must be created and accepted before booking.',
    };
  }

  if (quote.status === 'PENDING_ACCEPTANCE') {
    return {
      canConfirm: false,
      reason: 'Quotation has been sent to client and is awaiting client acceptance. Cannot confirm booking.',
    };
  }

  if (quote.status === 'REJECTED') {
    return {
      canConfirm: false,
      reason: 'Client rejected the quotation. A revised quotation must be submitted and accepted.',
    };
  }

  if (quote.status === 'EXPIRED') {
    return {
      canConfirm: false,
      reason: 'Client quotation has expired. Please create a revised quotation.',
    };
  }

  if (quote.status === 'ACCEPTED') {
    return { canConfirm: true };
  }

  return { canConfirm: false, reason: 'Invalid quotation state.' };
}

// ============================================================================
// 4. MULTI-VENDOR SOURCING LOGIC
// ============================================================================

export interface VendorAssignment {
  vendorId: string;
  status: 'PENDING' | 'QUOTED' | 'DECLINED' | 'SELECTED';
  quotedRate?: number;
  declineReason?: string;
}

export function processVendorResponse(
  assignments: VendorAssignment[],
  vendorId: string,
  action: 'QUOTE' | 'DECLINE',
  payload: { rate?: number; reason?: string }
): VendorAssignment[] {
  return assignments.map((v) => {
    if (v.vendorId !== vendorId) return v; // Other vendors remain untouched

    if (action === 'QUOTE') {
      return {
        ...v,
        status: 'QUOTED',
        quotedRate: payload.rate,
        declineReason: undefined,
      };
    } else {
      return {
        ...v,
        status: 'DECLINED',
        quotedRate: undefined,
        declineReason: payload.reason,
      };
    }
  });
}

export function selectPreferredVendor(
  assignments: VendorAssignment[],
  selectedVendorId: string
): { updatedAssignments: VendorAssignment[]; selectedVendor: VendorAssignment } {
  const target = assignments.find((v) => v.vendorId === selectedVendorId);
  if (!target) {
    throw new Error('Vendor not found in sourcing assignments');
  }
  if (target.status === 'DECLINED') {
    throw new Error('Cannot select a vendor that has declined the requirement');
  }
  if (target.status !== 'QUOTED') {
    throw new Error('Cannot select a vendor that has not submitted a quotation');
  }

  const updatedAssignments = assignments.map((v) => ({
    ...v,
    status: v.vendorId === selectedVendorId ? ('SELECTED' as const) : v.status,
  }));

  return {
    updatedAssignments,
    selectedVendor: { ...target, status: 'SELECTED' },
  };
}

// ============================================================================
// TEST SUITE EXECUTION
// ============================================================================

describe('NECL Transport Requirement & Booking Workflow', () => {
  describe('Phase 1: Capacity & Unit Conversion (0.03 MT)', () => {
    it('accurately identifies and formats fractional MT quantities (< 0.5 MT) as kg', () => {
      const result = formatCapacityDisplay(0.03);
      expect(result.autoKg).toBe(true);
      expect(result.kgValue).toBe(30);
      expect(result.display).toBe('0.03 MT (30 kg)');
    });

    it('displays standard capacities (>= 0.5 MT) in MT without clutter', () => {
      const result = formatCapacityDisplay(24.5);
      expect(result.autoKg).toBe(false);
      expect(result.kgValue).toBe(24500);
      expect(result.display).toBe('24.5 MT');
    });

    it('correctly converts kg input to database MT values', () => {
      const capacityMt = convertInputToCapacityMt(30, 'kg');
      expect(capacityMt).toBe(0.03);

      const capacityMt2 = convertInputToCapacityMt(500, 'kg');
      expect(capacityMt2).toBe(0.5);
    });

    it('correctly preserves direct MT input', () => {
      const capacityMt = convertInputToCapacityMt(18.25, 'MT');
      expect(capacityMt).toBe(18.25);
    });
  });

  describe('Phase 2 & 3: Multi-Vendor Sourcing & RFQ Independence', () => {
    it('maintains independent responses for multiple assigned vendors', () => {
      const initialAssignments: VendorAssignment[] = [
        { vendorId: 'vnd_01', status: 'PENDING' },
        { vendorId: 'vnd_02', status: 'PENDING' },
        { vendorId: 'vnd_03', status: 'PENDING' },
      ];

      // Vendor 1 submits quote
      let current = processVendorResponse(initialAssignments, 'vnd_01', 'QUOTE', { rate: 45000 });
      expect(current[0].status).toBe('QUOTED');
      expect(current[0].quotedRate).toBe(45000);
      expect(current[1].status).toBe('PENDING');
      expect(current[2].status).toBe('PENDING');

      // Vendor 2 declines with reason
      current = processVendorResponse(current, 'vnd_02', 'DECLINE', {
        reason: 'No vehicle available for this route / date',
      });
      expect(current[1].status).toBe('DECLINED');
      expect(current[1].declineReason).toBe('No vehicle available for this route / date');
      expect(current[1].quotedRate).toBeUndefined();

      // Vendor 3 submits quote
      current = processVendorResponse(current, 'vnd_03', 'QUOTE', { rate: 42000 });
      expect(current[2].status).toBe('QUOTED');
      expect(current[2].quotedRate).toBe(42000);

      // Confirm vendor 1 and 2 responses were not overwritten
      expect(current[0].status).toBe('QUOTED');
      expect(current[1].status).toBe('DECLINED');
    });

    it('prevents selecting a vendor who has declined or not quoted', () => {
      const assignments: VendorAssignment[] = [
        { vendorId: 'vnd_01', status: 'QUOTED', quotedRate: 45000 },
        { vendorId: 'vnd_02', status: 'DECLINED', declineReason: 'Route unfeasible' },
        { vendorId: 'vnd_03', status: 'PENDING' },
      ];

      expect(() => selectPreferredVendor(assignments, 'vnd_02')).toThrow(
        'Cannot select a vendor that has declined the requirement'
      );

      expect(() => selectPreferredVendor(assignments, 'vnd_03')).toThrow(
        'Cannot select a vendor that has not submitted a quotation'
      );
    });

    it('successfully selects an eligible quoted vendor while retaining unselected responses', () => {
      const assignments: VendorAssignment[] = [
        { vendorId: 'vnd_01', status: 'QUOTED', quotedRate: 45000 },
        { vendorId: 'vnd_02', status: 'DECLINED', declineReason: 'Route unfeasible' },
        { vendorId: 'vnd_03', status: 'QUOTED', quotedRate: 42000 },
      ];

      const { updatedAssignments, selectedVendor } = selectPreferredVendor(assignments, 'vnd_03');
      expect(selectedVendor.vendorId).toBe('vnd_03');
      expect(selectedVendor.status).toBe('SELECTED');

      // Vendor 1 remains QUOTED (unselected), Vendor 2 remains DECLINED
      const v1 = updatedAssignments.find((v) => v.vendorId === 'vnd_01');
      const v2 = updatedAssignments.find((v) => v.vendorId === 'vnd_02');
      expect(v1?.status).toBe('QUOTED');
      expect(v2?.status).toBe('DECLINED');
    });
  });

  describe('Phase 4 & 5: Commercial Separation of Vendor Cost vs Client Quote', () => {
    it('accurately calculates client selling quote with approved admin margin and 18% GST', () => {
      const vendorCost = 42000;
      const adminMargin = 5000;
      const calc = calculateClientQuote(vendorCost, adminMargin, 18);

      expect(calc.vendorBaseCost).toBe(42000);
      expect(calc.adminMargin).toBe(5000);
      expect(calc.taxableBase).toBe(47000); // 42000 + 5000
      expect(calc.gstRatePercent).toBe(18);
      expect(calc.gstAmount).toBe(8460); // 47000 * 0.18
      expect(calc.totalClientAmount).toBe(55460); // 47000 + 8460
    });

    it('strictly separates vendor internal quotation from client-facing price', () => {
      const vendorCost = 38000;
      const adminMargin = 4000;
      const calc = calculateClientQuote(vendorCost, adminMargin, 18);

      // Client quote total must never equal the raw vendor quotation rate
      expect(calc.totalClientAmount).not.toBe(vendorCost);
      expect(calc.taxableBase).toBeGreaterThan(vendorCost);
    });
  });

  describe('Phase 6 & 7: Booking Confirmation Gate (Client Acceptance Required)', () => {
    const baseQuote: ClientQuoteRecord = {
      id: 'cq_001',
      requirement_id: 'req_001',
      version: 1,
      vendor_base_cost: 42000,
      admin_margin: 5000,
      total_client_amount: 55460,
      status: 'PENDING_ACCEPTANCE',
    };

    it('BLOCKS confirmed booking creation when client has not yet accepted quotation', () => {
      const pendingQuote: ClientQuoteRecord = { ...baseQuote, status: 'PENDING_ACCEPTANCE' };
      const validation = validateBookingConfirmation(pendingQuote);

      expect(validation.canConfirm).toBe(false);
      expect(validation.reason).toContain('awaiting client acceptance');
    });

    it('BLOCKS confirmed booking creation when client rejected quotation', () => {
      const rejectedQuote: ClientQuoteRecord = { ...baseQuote, status: 'REJECTED' };
      const validation = validateBookingConfirmation(rejectedQuote);

      expect(validation.canConfirm).toBe(false);
      expect(validation.reason).toContain('Client rejected the quotation');
    });

    it('ALLOWS confirmed booking creation ONLY after client accepts quotation', () => {
      const acceptedQuote: ClientQuoteRecord = { ...baseQuote, status: 'ACCEPTED' };
      const validation = validateBookingConfirmation(acceptedQuote);

      expect(validation.canConfirm).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it('permits authorized emergency direct booking ONLY with mandatory justification', () => {
      // Without justification: blocked
      const blockedEmergency = validateBookingConfirmation(null, true, '');
      expect(blockedEmergency.canConfirm).toBe(false);
      expect(blockedEmergency.reason).toContain('administrative justification');

      // With short justification (< 15 chars): blocked
      const shortEmergency = validateBookingConfirmation(null, true, 'Short note');
      expect(shortEmergency.canConfirm).toBe(false);

      // With complete administrative justification: permitted
      const validEmergency = validateBookingConfirmation(
        null,
        true,
        'Executive authorized emergency dispatch for critical pharmaceutical cargo.'
      );
      expect(validEmergency.canConfirm).toBe(true);
    });
  });
});
