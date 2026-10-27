import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SharedVehicleMasterDirectory Redesign (Reference Image 1)', () => {
  const filePath = path.join(__dirname, 'SharedVehicleMasterDirectory.tsx');
  const code = fs.readFileSync(filePath, 'utf-8');

  it('should export SharedVehicleMasterDirectory component', () => {
    expect(code).toContain('export const SharedVehicleMasterDirectory');
  });

  it('should render hero banner matching Reference Image 1', () => {
    expect(code).toContain('directory-hero-banner');
    expect(code).toContain('Vehicle Directory');
    expect(code).toContain('Manage vendor-registered vehicles, documents, and verification status.');
    expect(code).toContain('+ Register Vehicle');
  });

  it('should render 4 summary KPI cards connected to database counts', () => {
    expect(code).toContain('directory-kpi-grid-4');
    expect(code).toContain('Total Vehicles');
    expect(code).toContain('Verified Vehicles');
    expect(code).toContain('Pending Review');
    expect(code).toContain('Rejected Vehicles');
    expect(code).toContain('stats.totalVehicles');
    expect(code).toContain('stats.verifiedVehicles');
    expect(code).toContain('stats.pendingVerification');
    expect(code).toContain('stats.rejectedVehicles');
  });

  it('should implement filter toolbar with category, body type, and status dropdowns', () => {
    expect(code).toContain('directory-filter-card');
    expect(code).toContain('categoryFilter');
    expect(code).toContain('bodyTypeFilter');
    expect(code).toContain('statusFilter');
    expect(code).toContain('All Categories');
    expect(code).toContain('All Types');
    expect(code).toContain('All Status');
    expect(code).toContain('handleResetFilters');
  });

  it('should implement required table columns matching Reference Image 1', () => {
    expect(code).toContain('Vendor ID & Name');
    expect(code).toContain('Vehicle Number');
    expect(code).toContain('Category & Body Type');
    expect(code).toContain('Rated Capacity (MT)');
    expect(code).toContain('Min Capacity (MT)');
    expect(code).toContain('Ownership');
    expect(code).toContain('Documents');
    expect(code).toContain('Verification Status');
    expect(code).toContain('Updated');
    expect(code).toContain('Actions');
  });

  it('should support action menu items: View Details, Edit Vehicle, Verify Documents, Approve Vehicle, Reject Vehicle, Request Corrections', () => {
    expect(code).toContain('View Details');
    expect(code).toContain('Edit Vehicle');
    expect(code).toContain('Verify Documents');
    expect(code).toContain('Approve Vehicle');
    expect(code).toContain('Reject Vehicle');
    expect(code).toContain('Request Corrections');
  });

  it('should render Dedicated Full View Drawer with Vendor Info, Specs, and Documents', () => {
    expect(code).toContain('detail-drawer-backdrop');
    expect(code).toContain('Vehicle Full View');
    expect(code).toContain('Vendor Information');
    expect(code).toContain('Vehicle Specifications');
    expect(code).toContain('Document Verification Details');
  });
});
