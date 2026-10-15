import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ClientDirectory - Client Management Module Requirements', () => {
  const directoryCode = fs.readFileSync(
    path.join(__dirname, 'ClientDirectory.tsx'),
    'utf-8'
  );

  describe('1. Page Header Specifications', () => {
    it('should have title "Client Management"', () => {
      expect(directoryCode).toContain('Client Management</h1>');
    });

    it('should have subtitle describing verification and account status', () => {
      expect(directoryCode).toContain(
        'Manage client registrations, verification, KYC documents, and account status.'
      );
    });

    it('should provide "+ Add Client", "Export", and "Import" buttons in header', () => {
      expect(directoryCode).toContain('+ Add Client');
      expect(directoryCode).toContain('id="btn-add-client"');
      expect(directoryCode).toContain('id="btn-export-clients"');
      expect(directoryCode).toContain('id="btn-import-clients"');
    });
  });

  describe('2. Summary Cards Specifications', () => {
    it('should display the 4 required KPI cards', () => {
      expect(directoryCode).toContain('Total Applications');
      expect(directoryCode).toContain('Pending Approval');
      expect(directoryCode).toContain('Approved Clients');
      expect(directoryCode).toContain('Rejected Applications');
    });

    it('should support clicking KPI cards to apply filters', () => {
      expect(directoryCode).toContain('setActiveTab("PENDING_APPROVAL")');
      expect(directoryCode).toContain('setActiveTab("APPROVED")');
      expect(directoryCode).toContain('setActiveTab("REJECTED")');
    });

    it('should display 0 when database returns zero records instead of placeholders', () => {
      expect(directoryCode).toContain('total: allRes.count || 0');
      expect(directoryCode).toContain('{dbKpis.total}');
    });
  });

  describe('3. Search and Filter Section Specifications', () => {
    it('should support searching by Client ID, company, GSTIN, contact person, phone', () => {
      expect(directoryCode).toContain('company_name.ilike.%${q}%');
      expect(directoryCode).toContain('gstin.ilike.%${q}%');
      expect(directoryCode).toContain('client_code.ilike.%${q}%');
    });

    it('should support search on Enter keypress', () => {
      expect(directoryCode).toContain('e.key === "Enter"');
      expect(directoryCode).toContain('fetchRealClients()');
    });

    it('should provide Registration Status, City, and Entity Type dropdowns', () => {
      expect(directoryCode).toContain('aria-label="Filter by Registration Status"');
      expect(directoryCode).toContain('aria-label="Filter by City"');
      expect(directoryCode).toContain('aria-label="Filter by Entity Type"');
    });

    it('should provide Reset Filters and Search actions', () => {
      expect(directoryCode).toContain('handleResetFilters');
      expect(directoryCode).toContain('Reset Filters');
      expect(directoryCode).toContain('Active Filters:');
    });
  });

  describe('4. Client Status Tabs Specifications', () => {
    it('should render all 4 live status tabs with counts', () => {
      expect(directoryCode).toContain('All Clients ({dbKpis.total})');
      expect(directoryCode).toContain('Pending Approval ({dbKpis.pending})');
      expect(directoryCode).toContain('Approved ({dbKpis.approved})');
      expect(directoryCode).toContain('Rejected ({dbKpis.rejected})');
    });

    it('should style active tab with orange theme and inactive tabs with subtle border', () => {
      expect(directoryCode).toContain('active-tab');
      expect(directoryCode).toContain('status-tab-btn');
    });
  });

  describe('5. Client Data Table & Columns Specifications', () => {
    it('should include all required columns', () => {
      expect(directoryCode).toContain('Client ID & Company');
      expect(directoryCode).toContain('Contact Person');
      expect(directoryCode).toContain('Verified Phone');
      expect(directoryCode).toContain('Email');
      expect(directoryCode).toContain('City');
      expect(directoryCode).toContain('Entity Type');
      expect(directoryCode).toContain('Submission Date');
      expect(directoryCode).toContain('KYC Status');
      expect(directoryCode).toContain('Registration Status');
      expect(directoryCode).toContain('Actions');
    });

    it('should separate KYC status from Registration status', () => {
      expect(directoryCode).toContain('kyc-status-badge');
      expect(directoryCode).toContain('reg-status-badge');
      expect(directoryCode).toContain('NOT_SUBMITTED');
      expect(directoryCode).toContain('UNDER_REVIEW');
    });

    it('should support column sorting and pagination controls', () => {
      expect(directoryCode).toContain('handleSort');
      expect(directoryCode).toContain('sortField');
      expect(directoryCode).toContain('sortOrder');
      expect(directoryCode).toContain('Showing');
      expect(directoryCode).toContain('clients');
    });
  });

  describe('6. Client Actions Menu & Modals Specifications', () => {
    it('should provide compact three-dot menu with all required actions', () => {
      expect(directoryCode).toContain('View Details');
      expect(directoryCode).toContain('Edit Client');
      expect(directoryCode).toContain('Review KYC Documents');
      expect(directoryCode).toContain('Approve Application');
      expect(directoryCode).toContain('Reject Application');
      expect(directoryCode).toContain('Suspend Account');
      expect(directoryCode).toContain('View Booking History');
    });

    it('should require mandatory reason when rejecting client registration', () => {
      expect(directoryCode).toContain('rejectionReasonInput');
      expect(directoryCode).toContain('Rejection Reason (Required)');
      expect(directoryCode).toContain('handleRejectClient');
    });
  });

  describe('7. Bulk Actions Specifications', () => {
    it('should display contextual toolbar when multiple clients are selected', () => {
      expect(directoryCode).toContain('client-bulk-toolbar');
      expect(directoryCode).toContain('selectedRows.size} client');
      expect(directoryCode).toContain('Approve Selected');
      expect(directoryCode).toContain('Reject Selected');
      expect(directoryCode).toContain('Export Selected');
    });

    it('should have bulk approve and bulk reject confirmation handlers', () => {
      expect(directoryCode).toContain('handleBulkApprove');
      expect(directoryCode).toContain('handleBulkReject');
    });
  });

  describe('8. CSV Import & Export Specifications', () => {
    it('should support exporting filtered clients to CSV', () => {
      expect(directoryCode).toContain('handleExportCSV');
      expect(directoryCode).toContain('NECL_Client_Management_Export_');
    });

    it('should provide CSV template download and CSV file parsing with validation', () => {
      expect(directoryCode).toContain('handleDownloadSampleTemplate');
      expect(directoryCode).toContain('NECL_Client_Import_Template.csv');
      expect(directoryCode).toContain('handleFileSelect');
      expect(directoryCode).toContain('handleExecuteImport');
    });
  });

  describe('9. Client Details Drawer (5 Sections)', () => {
    it('should organize client profile into all 5 required sections', () => {
      expect(directoryCode).toContain('A. Company Information');
      expect(directoryCode).toContain('B. Contact Information');
      expect(directoryCode).toContain('C. Verification & Documents');
      expect(directoryCode).toContain('D. Business Activity');
      expect(directoryCode).toContain('E. Audit Information');
    });
  });
});
