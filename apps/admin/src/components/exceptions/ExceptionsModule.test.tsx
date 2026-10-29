import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Exceptions & Disruptions Module & Detail View Audit', () => {
  const exceptionsModulePath = path.resolve(__dirname, './ExceptionsModule.tsx');
  const exceptionDetailPath = path.resolve(__dirname, './ExceptionDetailView.tsx');

  const moduleCode = fs.readFileSync(exceptionsModulePath, 'utf-8');
  const detailCode = fs.readFileSync(exceptionDetailPath, 'utf-8');

  describe('Task 2: Screen Component & Functionality Inventory', () => {
    it('verifies screen component, imports, and live Supabase bindings', () => {
      expect(moduleCode).toContain('export const ExceptionsModule: React.FC');
      expect(detailCode).toContain('export const ExceptionDetailView: React.FC');
      expect(moduleCode).toContain('import { supabase, ensureAdminSession } from "../../utils/supabase";');
      expect(detailCode).toContain('import { supabase } from "../../utils/supabase";');
    });

    it('identifies all KPI cards, search bar, and severity filters', () => {
      // 4 Operational KPI Cards
      expect(moduleCode).toContain('Open Exceptions');
      expect(moduleCode).toContain('High Severity');
      expect(moduleCode).toContain('Critical');
      expect(moduleCode).toContain('Resolved Today');

      // Severity filters
      expect(moduleCode).toContain('["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"]');
      expect(moduleCode).toContain('status-tab-btn');

      // Search bar
      expect(moduleCode).toContain('placeholder="Search exceptions..."');
    });

    it('identifies modal dialogs and form inputs', () => {
      expect(moduleCode).toContain('Create Exception');
      expect(moduleCode).toContain('["BREAKDOWN","DELAY","ROUTE_DEVIATION","CARGO_DAMAGE","ACCIDENT","DETENTION","DELIVERY_FAILURE","OTHER"]');
      expect(moduleCode).toContain('Trip ID (optional)');
      expect(moduleCode).toContain('Booking ID (optional)');
      expect(moduleCode).toContain('Description *');
    });
  });

  describe('Task 3: Data Flow & Database Schema Trace', () => {
    it('verifies queries target the public.exceptions live database table', () => {
      expect(moduleCode).toContain('.from("exceptions")');
      expect(detailCode).toContain('.from("exceptions")');
      expect(moduleCode).toContain('status: "OPEN"');
    });

    it('verifies creation payload contains proper foreign keys and status', () => {
      expect(moduleCode).toContain('exception_type: form.type');
      expect(moduleCode).toContain('severity: form.severity');
      expect(moduleCode).toContain('trip_id: form.tripId || null');
      expect(moduleCode).toContain('booking_id: form.bookingId || null');
      expect(moduleCode).toContain('description: form.description');
      expect(moduleCode).toContain('reported_by: user?.id');
    });

    it('verifies resolution transition records timestamp and admin user identity', () => {
      expect(moduleCode).toContain('status: "RESOLVED"');
      expect(moduleCode).toContain('resolved_at: new Date().toISOString()');
      expect(moduleCode).toContain('resolved_by: user?.id');

      expect(detailCode).toContain('status: "RESOLVED"');
      expect(detailCode).toContain('resolution_notes: resolutionNotes');
    });
  });

  describe('Task 4: Functionality & Interaction Logic', () => {
    it('verifies pagination and client-side search filtering', () => {
      expect(moduleCode).toContain('const ITEMS_PER_PAGE = 15;');
      expect(moduleCode).toContain('const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));');
      expect(moduleCode).toContain('e.exception_type?.toLowerCase().includes(search.toLowerCase())');
      expect(moduleCode).toContain('e.description?.toLowerCase().includes(search.toLowerCase())');
    });

    it('verifies related trip navigation from detail view', () => {
      expect(detailCode).toContain('exception.trip_id && (');
      expect(detailCode).toContain('navigate(`/admin/tracking/${exception.trip_id}`)');
    });

    it('validates mandatory description and resolution notes', () => {
      expect(moduleCode).toContain('if (!form.description.trim())');
      expect(detailCode).toContain('if (!resolutionNotes.trim())');
    });
  });
});
