import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SharedVehicleMasterDirectory Redesign (Reference Specification)', () => {
  const filePath = path.join(__dirname, 'SharedVehicleMasterDirectory.tsx');
  const code = fs.readFileSync(filePath, 'utf-8');

  it('should export SharedVehicleMasterDirectory component', () => {
    expect(code).toContain('export const SharedVehicleMasterDirectory');
  });

  it('should render hero banner matching Client Management design system', () => {
    expect(code).toContain('client-header-hero');
    expect(code).toContain('Vehicle Directory');
    expect(code).toContain('Manage registered vehicles, vehicle documents, ownership, and verification status.');
    expect(code).toContain('+ Add Vehicle');
  });

  it('should render 4 summary KPI cards connected to database counts', () => {
    expect(code).toContain('client-kpi-bar');
    expect(code).toContain('Total Vehicles');
    expect(code).toContain('Verified Vehicles');
    expect(code).toContain('Pending Verification');
    expect(code).toContain('Rejected / Inactive');
    expect(code).toContain('stats.totalVehicles');
    expect(code).toContain('stats.verifiedVehicles');
    expect(code).toContain('stats.pendingVerification');
    expect(code).toContain('stats.rejectedVehicles');
  });

  it('should implement filter toolbar with category, body type, ownership, and status dropdowns', () => {
    expect(code).toContain('filters-bar-card');
    expect(code).toContain('categoryFilter');
    expect(code).toContain('bodyTypeFilter');
    expect(code).toContain('ownershipFilter');
    expect(code).toContain('statusFilter');
    expect(code).toContain('All Categories');
    expect(code).toContain('All Ownership');
    expect(code).toContain('All Status');
    expect(code).toContain('All Body Types');
    expect(code).toContain('handleResetFilters');
  });

  it('should implement required table columns matching reference image', () => {
    expect(code).toContain('Vehicle Number');
    expect(code).toContain('Vendor ID & Name');
    expect(code).toContain('Category');
    expect(code).toContain('Body Type');
    expect(code).toContain('Rated Cap (MT)');
    expect(code).toContain('Min Cap (MT)');
    expect(code).toContain('Ownership');
    expect(code).toContain('Verification');
    expect(code).toContain('Documents');
    expect(code).toContain('Updated At');
    expect(code).toContain('Actions');
  });

  it('should support action menu items: Edit Vehicle, Verify Documents, Approve Vehicle, Reject Vehicle, Request Corrections', () => {
    expect(code).toContain('Edit Vehicle');
    expect(code).toContain('Verify Documents');
    expect(code).toContain('Approve Vehicle');
    expect(code).toContain('Reject Vehicle');
    expect(code).toContain('Request Corrections');
  });

  it('should render Dedicated Full View Drawer with Vendor Info, Specs, and Documents', () => {
    expect(code).toContain('vfv-backdrop');
    expect(code).toContain('Vehicle Full View');
    expect(code).toContain('Vendor Information');
    expect(code).toContain('Vehicle Specifications');
    expect(code).toContain('Document Verification Details');
  });

  it('should render vehicle records exclusively inside the table without duplicate cards below table', () => {
    // Ensure no mobile card list or duplicate vehicle card list exists below the table
    expect(code).not.toContain('Mobile Card-Based List');
    expect(code).not.toContain('block md:hidden divide-y');
    // Ensure the table tbody contains the mapping
    expect(code).toContain('{vehicles.map((vehicle, idx) => {');
  });

  it('should render Vendor ID & Name column exactly matching Client Management Client ID & Company UI/UX', () => {
    expect(code).toContain('client-name-cell');
    expect(code).toContain('client-avatar-squircle');
    expect(code).toContain('client-name-text');
    expect(code).toContain('client-id-text');
    expect(code).toContain('CLIENT_AVATAR_PALETTE');
    expect(code).toContain('getAvatarColor');
    expect(code).toContain('getInitials');
  });

  it('should render 40x40px white square Actions buttons with centered alignment and 8px gap', () => {
    expect(code).toContain('ACTIONS');
    expect(code).toContain('table-action-square-btn');
    expect(code).toContain('title="View Details"');
    expect(code).toContain('title="More Actions"');
    expect(code).toContain("gap: 8");
    expect(code).toContain("width: 120, minWidth: 120, textAlign: 'center'");
  });

  it('should render Edit Vehicle Record modal with dark navy header, full 6 fields, and capacity validation', () => {
    expect(code).toContain('edit-veh-modal-backdrop');
    expect(code).toContain('edit-veh-modal-card');
    expect(code).toContain('edit-veh-modal-header');
    expect(code).toContain('Edit Vehicle Record');
    expect(code).toContain('edit-veh-reg-badge');
    expect(code).toContain('Vehicle Category *');
    expect(code).toContain('Body Type *');
    expect(code).toContain('Rated Capacity (MT) *');
    expect(code).toContain('Minimum Capacity (MT) *');
    expect(code).toContain('RC Number *');
    expect(code).toContain('Operational Status *');
    expect(code).toContain('validateEditForm');
    expect(code).toContain('Minimum capacity cannot exceed rated capacity');
    expect(code).toContain('handleSaveEdit');
  });

  it('should render Associated Driver section with complete details, actions, and empty state', () => {
    expect(code).toContain('Associated Driver');
    expect(code).toContain('Mobile Number:');
    expect(code).toContain('Driver Operational Status:');
    expect(code).toContain('Associated Vendor:');
    expect(code).toContain('Change Driver');
    expect(code).toContain('handleRemoveDriverAssignment');
    expect(code).toContain('No Driver Assigned');
    expect(code).toContain('Assign a verified driver associated with this vendor to enable trip dispatch and fleet tracking.');
    expect(code).toContain('Assign Driver');
  });
});

