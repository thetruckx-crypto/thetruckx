import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('BookingsModule Redesign (Reference Image 2)', () => {
  const filePath = path.join(__dirname, 'BookingsModule.tsx');
  const code = fs.readFileSync(filePath, 'utf-8');

  it('should export BookingsModule component and Booking interface', () => {
    expect(code).toContain('export const BookingsModule');
    expect(code).toContain('export interface Booking');
  });

  it('should render hero banner matching Reference Image 2', () => {
    expect(code).toContain('directory-hero-banner');
    expect(code).toContain('Bookings & Multi-Trip Operations');
    expect(code).toContain('Manage confirmed bookings, assign vehicles and drivers to trips, and track multi-trip operations.');
    expect(code).toContain('Create Booking');
  });

  it('should render 5 summary KPI cards connected to database counts', () => {
    expect(code).toContain('directory-kpi-grid-5');
    expect(code).toContain('Total Bookings');
    expect(code).toContain('Confirmed');
    expect(code).toContain('In Progress');
    expect(code).toContain('Completed');
    expect(code).toContain('Cancelled');
    expect(code).toContain('dbKpis.total');
    expect(code).toContain('dbKpis.confirmed');
    expect(code).toContain('dbKpis.inProgress');
    expect(code).toContain('dbKpis.completed');
    expect(code).toContain('dbKpis.cancelled');
  });

  it('should implement filter toolbar with search, status, date range, client, and payment status', () => {
    expect(code).toContain('directory-filter-card');
    expect(code).toContain('searchQuery');
    expect(code).toContain('statusFilter');
    expect(code).toContain('dateRangeFilter');
    expect(code).toContain('clientFilter');
    expect(code).toContain('paymentFilter');
    expect(code).toContain('All Status');
    expect(code).toContain('All Clients');
    expect(code).toContain('Payment Status');
  });

  it('should implement status tabs with live counts', () => {
    expect(code).toContain('directory-tabs');
    expect(code).toContain('All ({dbKpis.total})');
    expect(code).toContain('Confirmed ({dbKpis.confirmed})');
    expect(code).toContain('In Progress ({dbKpis.inProgress})');
    expect(code).toContain('Completed ({dbKpis.completed})');
    expect(code).toContain('Cancelled ({dbKpis.cancelled})');
  });

  it('should implement required table columns matching Reference Image 2', () => {
    expect(code).toContain('Booking Reference');
    expect(code).toContain('Client Company');
    expect(code).toContain('Route Summary');
    expect(code).toContain('Trips');
    expect(code).toContain('Assigned Vehicle / Driver');
    expect(code).toContain('Booking Status');
    expect(code).toContain('Payment Status');
    expect(code).toContain('Last Updated');
    expect(code).toContain('Actions');
  });

  it('should support action menu items: View Booking, Assign Vehicle & Driver, View Trips, Update Status, Cancel Booking', () => {
    expect(code).toContain('View Booking');
    expect(code).toContain('Assign Vehicle & Driver');
    expect(code).toContain('View Trips');
    expect(code).toContain('Update Status');
    expect(code).toContain('Cancel Booking');
  });
});
