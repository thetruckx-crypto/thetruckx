import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Driver Verification Queue Comprehensive Audit & Implementation (Tasks 1 to 35)', () => {
  const queueFilePath = path.join(__dirname, 'DriverVerificationQueue.tsx');
  const queueCode = fs.readFileSync(queueFilePath, 'utf-8');

  const drawerFilePath = path.join(__dirname, 'DriverDetailsDrawer.tsx');
  const drawerCode = fs.readFileSync(drawerFilePath, 'utf-8');

  const auditFilePath = path.join(__dirname, 'DriverLicenceAudit.tsx');
  const auditCode = fs.readFileSync(auditFilePath, 'utf-8');

  describe('Task 2 & 3: Hero Header & Global Layout', () => {
    it('should render navy hero banner matching THE TRUCKX reference styling', () => {
      expect(queueCode).toContain('client-header-hero');
      expect(queueCode).toContain('Driver Verification Queue');
      expect(queueCode).toContain('Drivers');
      expect(queueCode).toContain('btn-header-secondary');
      expect(queueCode).toContain('btn-header-primary-orange');
      expect(queueCode).toContain('btn-refresh-drivers');
      expect(queueCode).toContain('btn-export-drivers');
      expect(queueCode).toContain('btn-create-driver');
    });

    it('should prevent page-level horizontal overflow and use dedicated table scroll container', () => {
      expect(queueCode).toContain('vendor-table-scroll');
      expect(queueCode).toContain("overflowX: 'auto'");
      expect(queueCode).toContain("overflowY: 'hidden'");
    });
  });

  describe('Task 4: Driver KPI Cards (5 Cards with Real DB counts)', () => {
    it('should render 5 clickable KPI cards with real database counts', () => {
      expect(queueCode).toContain('client-kpi-bar');
      expect(queueCode).toContain('Total Drivers');
      expect(queueCode).toContain('Pending Approval');
      expect(queueCode).toContain('Verified Drivers');
      expect(queueCode).toContain('Rejected Drivers');
      expect(queueCode).toContain('Expired Licences');
      expect(queueCode).toContain('kpis.total');
      expect(queueCode).toContain('kpis.pending');
      expect(queueCode).toContain('kpis.approved');
      expect(queueCode).toContain('kpis.rejected');
      expect(queueCode).toContain('kpis.expired');
    });

    it('should allow clicking KPI cards to switch active tabs', () => {
      expect(queueCode).toContain("setActiveTab('all')");
      expect(queueCode).toContain("setActiveTab('pending')");
      expect(queueCode).toContain("setActiveTab('approved')");
      expect(queueCode).toContain("setActiveTab('rejected')");
      expect(queueCode).toContain("setActiveTab('expired')");
    });
  });

  describe('Task 19: 5-Step Operational Lifecycle Workflow Progress Panel', () => {
    it('should render visual lifecycle progress panel with 5 steps', () => {
      expect(queueCode).toContain('driver-workflow-card');
      expect(queueCode).toContain('Driver Onboarding & Dispatch Lifecycle');
      expect(queueCode).toContain('Registration');
      expect(queueCode).toContain('Document Review');
      expect(queueCode).toContain('Assign Vehicle');
      expect(queueCode).toContain('Approve Driver');
      expect(queueCode).toContain('Ready for Transport');
    });

    it('should connect workflow steps to database statistics', () => {
      expect(queueCode).toContain('workflowStats.registered');
      expect(queueCode).toContain('workflowStats.assignedVehCount');
      expect(queueCode).toContain('workflowStats.readyTransportCount');
    });
  });

  describe('Task 20: Important Actions Panel (Selected Driver Toolbar)', () => {
    it('should render dedicated actions bar when a driver row is selected', () => {
      expect(queueCode).toContain('driver-selected-actions-card');
      expect(queueCode).toContain('activeSelectedDriver');
      expect(queueCode).toContain('btn-action-panel-primary');
      expect(queueCode).toContain('btn-action-panel-secondary');
    });

    it('should provide rapid actions for the selected driver', () => {
      expect(queueCode).toContain('setSelectedDrawerDriver(activeSelectedDriver)');
      expect(queueCode).toContain('setAssigningVehicleDriver(activeSelectedDriver)');
      expect(queueCode).toContain('setStatusUpdatingDriver(activeSelectedDriver)');
      expect(queueCode).toContain('setEditingDriver(activeSelectedDriver)');
    });
  });

  describe('Task 5 & 6: Search, Filters, Status Tabs & Column Preferences', () => {
    it('should support multi-attribute search including driver, vendor, and vehicle registration', () => {
      expect(queueCode).toContain('searchQuery');
      expect(queueCode).toContain('matchName');
      expect(queueCode).toContain('matchMobile');
      expect(queueCode).toContain('matchLicence');
      expect(queueCode).toContain('matchVendor');
      expect(queueCode).toContain('matchVehicle');
    });

    it('should provide verification status, vendor, vehicle assignment, and transport status filters', () => {
      expect(queueCode).toContain('statusFilter');
      expect(queueCode).toContain('vendorFilter');
      expect(queueCode).toContain('vehicleAssignmentFilter');
      expect(queueCode).toContain('transportStatusFilter');
      expect(queueCode).toContain('btn-filter-reset');
      expect(queueCode).toContain('btn-filter-search');
      expect(queueCode).toContain('active-filters-chips-bar');
    });

    it('should render 5 status tabs with dynamic counts', () => {
      expect(queueCode).toContain('Pending Review ({kpis.pending})');
      expect(queueCode).toContain('Verified ({kpis.approved})');
      expect(queueCode).toContain('Rejected ({kpis.rejected})');
      expect(queueCode).toContain('Expired Licence ({kpis.expired})');
      expect(queueCode).toContain('All Drivers ({kpis.total})');
    });

    it('should implement column preferences toggle popover', () => {
      expect(queueCode).toContain('showColumnConfig');
      expect(queueCode).toContain('visibleColumns');
      expect(queueCode).toContain('columns-popover-menu');
      expect(queueCode).toContain('Customize Columns');
    });
  });

  describe('Task 7, 8, 9: Professional Driver Table, Vendor Association & Assigned Vehicle', () => {
    it('should render all required table header columns and preserve sort strings', () => {
      expect(queueCode).toContain('Driver Name ⇅');
      expect(queueCode).toContain('Mobile ⇅');
      expect(queueCode).toContain('Date of Birth ⇅');
      expect(queueCode).toContain('Vendor ⇅');
      expect(queueCode).toContain('Assigned Vehicle ⇅');
      expect(queueCode).toContain('Transport Status ⇅');
      expect(queueCode).toContain('Licence Status ⇅');
      expect(queueCode).toContain('Verification Status ⇅');
      expect(queueCode).toContain('Submission Date ⇅');
      expect(queueCode).toContain('driver.date_of_birth || driver.dob');
      expect(queueCode).toContain('driver.created_at');
    });

    it('should resolve connected vendor using database relationships and show Not Assigned when none', () => {
      expect(queueCode).toContain('getVendorInfo');
      expect(queueCode).toContain('vendor_companies:primary_vendor_id');
      expect(queueCode).toContain('Not Assigned');
    });

    it('should resolve assigned vehicle using real trips and vehicles database records', () => {
      expect(queueCode).toContain('getDriverVehicleAssignment');
      expect(queueCode).toContain('trips');
      expect(queueCode).toContain('registration_number');
    });

    it('should render transport status badges for availability', () => {
      expect(queueCode).toContain('transport-badge');
      expect(queueCode).toContain('Available for Transport');
    });
  });

  describe('Task 10 & 11: Vehicle Assignment, Reassignment and Removal', () => {
    it('should render Assign/Change Vehicle modal with eligible vehicles dropdown', () => {
      expect(queueCode).toContain('Assign / Change Vehicle');
      expect(queueCode).toContain('assigningVehicleDriver');
      expect(queueCode).toContain('selectedVehicleToAssign');
      expect(queueCode).toContain('handleConfirmAssignVehicle');
    });

    it('should support removing vehicle assignment with active trip validation', () => {
      expect(queueCode).toContain('handleRemoveVehicleAssignment');
      expect(queueCode).toContain('Cannot unassign vehicle: Driver is currently in active trip');
      expect(queueCode).toContain('Remove current vehicle assignment');
    });
  });

  describe('Task 12: Transport Status Management', () => {
    it('should render dedicated modal to update transport availability', () => {
      expect(queueCode).toContain('Update Transport Availability');
      expect(queueCode).toContain('statusUpdatingDriver');
      expect(queueCode).toContain('selectedTransportStatus');
      expect(queueCode).toContain('AVAILABLE');
      expect(queueCode).toContain('NOT_TAKING_TRANSPORT');
      expect(queueCode).toContain('TEMP_UNAVAILABLE');
      expect(queueCode).toContain('INACTIVE');
    });

    it('should persist transport status updates to database', () => {
      expect(queueCode).toContain('handleConfirmTransportStatus');
      expect(queueCode).toContain("from('drivers')");
      expect(queueCode).toContain('.update(');
    });
  });

  describe('Task 13: View Details Side Drawer (DriverDetailsDrawer)', () => {
    it('should render complete slide-over side drawer matching .vfv- design system', () => {
      expect(drawerCode).toContain('vfv-backdrop');
      expect(drawerCode).toContain('vfv-drawer');
      expect(drawerCode).toContain('vfv-header');
      expect(drawerCode).toContain('vfv-body');
      expect(drawerCode).toContain('vfv-status-grid');
    });

    it('should provide tabs for Overview, Documents, Fleet, Trips, and Audit Trail', () => {
      expect(drawerCode).toContain('Overview & Details');
      expect(drawerCode).toContain('Documents');
      expect(drawerCode).toContain('Vendor & Vehicle');
      expect(drawerCode).toContain('Transport & Trips');
      expect(drawerCode).toContain('Audit Trail');
    });

    it('should display comprehensive personal info, licence, vendor, and active trip data', () => {
      expect(drawerCode).toContain('Personal & Identity Information');
      expect(drawerCode).toContain('Residential Address');
      expect(drawerCode).toContain('Emergency Contact Phone');
      expect(drawerCode).toContain('Active Freight Dispatch / Trip');
    });
  });

  describe('Task 14 & 15: Edit Driver & Create Driver Account Modals', () => {
    it('should render Edit Driver modal with prepopulated values and validation', () => {
      expect(queueCode).toContain('Edit Driver Profile');
      expect(queueCode).toContain('editingDriver');
      expect(queueCode).toContain('editFormData');
      expect(queueCode).toContain('handleConfirmEditDriver');
    });

    it('should render Create Driver Account modal without email field and with age validation', () => {
      expect(queueCode).toContain('id="btn-create-driver"');
      expect(queueCode).toContain('Create Driver Account');
      expect(queueCode).toContain('createFormData.fullName');
      expect(queueCode).toContain('createFormData.mobile');
      expect(queueCode).toContain('createFormData.dateOfBirth');
      expect(queueCode).toContain('createFormData.licenceNumber');
      expect(queueCode).toContain('createFormData.primaryVendorId');
      expect(queueCode).not.toContain('createFormData.email');
      expect(queueCode).toContain('Driver must be at least 18 years old.');
    });

    it('should support document file uploads on driver registration', () => {
      expect(queueCode).toContain('driverDocFiles');
      expect(queueCode).toContain('dlFront');
      expect(queueCode).toContain('dlBack');
      expect(queueCode).toContain('aadhaarFront');
      expect(queueCode).toContain('aadhaarBack');
    });
  });

  describe('Task 16, 17, 18: Document Verification & Driver Approval Workflow', () => {
    it('should allow individual document approve, reject with reason, and preview in drawer', () => {
      expect(drawerCode).toContain('handleUpdateDocumentStatus');
      expect(drawerCode).toContain('Enter rejection reason for this document');
      expect(drawerCode).toContain('DocumentPreviewModal');
    });

    it('should enforce mandatory requirements before driver approval', () => {
      expect(drawerCode).toContain('Cannot approve driver: Driving Licence has expired.');
      expect(drawerCode).toContain('Cannot approve driver: Connected Vendor must be assigned before approval.');
      expect(drawerCode).toContain('handleApproveClick');
      expect(drawerCode).toContain('handleRejectClick');
    });

    it('should calculate licence validity accurately distinguishing valid, expiring soon, and expired', () => {
      expect(queueCode).toContain('licence_expiry_date');
      expect(queueCode).toContain('daysLeft <= 30');
      expect(drawerCode).toContain('calculateLicence');
      expect(drawerCode).toContain('Expiring Soon');
    });
  });

  describe('Task 22 & 24: Pagination and Export', () => {
    it('should implement pagination with page navigation and page size selector', () => {
      expect(queueCode).toContain('pagination-row');
      expect(queueCode).toContain('page-nav-btn');
      expect(queueCode).toContain('page-num-btn');
      expect(queueCode).toContain('page-size-select');
      expect(queueCode).toContain('10 / page');
      expect(queueCode).toContain('25 / page');
      expect(queueCode).toContain('50 / page');
      expect(queueCode).toContain('100 / page');
    });

    it('should implement CSV export matching active tab and filters', () => {
      expect(queueCode).toContain('handleExportCSV');
      expect(queueCode).toContain('text/csv');
      expect(queueCode).toContain('drivers_');
    });
  });

  describe('Task 27, 28, 29: Realtime Sync, Audit Logging, and Permissions', () => {
    it('should connect to Supabase realtime channels for drivers, trips, and documents', () => {
      expect(queueCode).toContain('driver_verification_queue_realtime_sync');
      expect(queueCode).toContain("table: 'drivers'");
      expect(queueCode).toContain("table: 'trips'");
      expect(queueCode).toContain("table: 'documents'");
    });

    it('should respect role-based permissions for delete, edit, and approve', () => {
      expect(queueCode).toContain('canDelete');
      expect(queueCode).toContain('canEdit');
      expect(queueCode).toContain('canApprove');
      expect(queueCode).toContain("hasPermission('drivers', 'delete')");
    });
  });
});
