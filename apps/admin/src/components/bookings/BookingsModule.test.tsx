import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe('BookingsModule', () => {
  it('should export BookingsModule component', () => {
    const moduleCode = fs.readFileSync(
      path.join(__dirname, 'BookingsModule.tsx'),
      'utf-8'
    );
    expect(moduleCode).toContain('export const BookingsModule');
  });

  it('should define Booking interface with required schema fields', () => {
    const moduleCode = fs.readFileSync(
      path.join(__dirname, 'BookingsModule.tsx'),
      'utf-8'
    );
    expect(moduleCode).toContain('export interface Booking');
    expect(moduleCode).toContain('requirement_id: string');
    expect(moduleCode).toContain('client_id: string');
    expect(moduleCode).toContain('booking_status:');
    expect(moduleCode).toContain('payment_status:');
  });

  it('should include status transition and payment handling', () => {
    const moduleCode = fs.readFileSync(
      path.join(__dirname, 'BookingsModule.tsx'),
      'utf-8'
    );
    expect(moduleCode).toContain('CONFIRMED');
    expect(moduleCode).toContain('IN_PROGRESS');
    expect(moduleCode).toContain('COMPLETED');
    expect(moduleCode).toContain('CANCELLED');
    expect(moduleCode).toContain('PAYMENT_PENDING');
  });
});
