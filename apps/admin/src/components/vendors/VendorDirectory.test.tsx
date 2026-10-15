import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VendorDirectory - Vendor Management Module Requirements', () => {
  const directoryCode = fs.readFileSync(
    path.join(__dirname, 'VendorDirectory.tsx'),
    'utf-8'
  );

  describe('1. Page Header Specifications', () => {
    it('should have title "Vendor Directory"', () => {
      expect(directoryCode).toContain('Vendor Directory</h1>');
    });

    it('should have description describing logistics partners and verification', () => {
      expect(directoryCode).toContain(
        'Manage logistics partners, fleet owners, transport companies, and vendor verification.'
      );
    });

    it('should have breadcrumbs "Vendors > Vendor Directory"', () => {
      expect(directoryCode).toContain('<span>Vendors</span>');
      expect(directoryCode).toContain('Vendor Directory</span>');
    });

    it('should provide "+ Add Vendor" primary orange button in header', () => {
      expect(directoryCode).toContain('+ Add Vendor');
      expect(directoryCode).toContain('id="btn-add-vendor"');
    });
  });

  describe('2. Summary Cards Specifications', () => {
    it('should display the 4 required KPI cards', () => {
      expect(directoryCode).toContain('Total Vendors');
      expect(directoryCode).toContain('Verified Vendors');
      expect(directoryCode).toContain('Pending Review');
      expect(directoryCode).toContain('Inactive Vendors');
    });

    it('should support clicking KPI cards to apply filters', () => {
      expect(directoryCode).toContain("setActiveTab('all')");
      expect(directoryCode).toContain("setActiveTab('verified')");
      expect(directoryCode).toContain("setActiveTab('pending')");
      expect(directoryCode).toContain("setActiveTab('inactive')");
    });

    it('should display database counts and handle zero records without placeholders', () => {
      expect(directoryCode).toContain('{loading ? <div className="kpi-bar-skeleton" /> : counts.total}');
      expect(directoryCode).toContain('{loading ? <div className="kpi-bar-skeleton" /> : counts.verified}');
      expect(directoryCode).toContain('{loading ? <div className="kpi-bar-skeleton" /> : counts.pending}');
      expect(directoryCode).toContain('{loading ? <div className="kpi-bar-skeleton" /> : counts.inactive}');
    });
  });

  describe('3. Search and Filter Section Specifications', () => {
    it('should support searching by Vendor Name, ID, GSTIN, Contact Person, Phone, Location', () => {
      expect(directoryCode).toContain('vendor_name?.toLowerCase().includes(q)');
      expect(directoryCode).toContain('gstin?.toLowerCase().includes(q)');
      expect(directoryCode).toContain('contact_name?.toLowerCase().includes(q)');
      expect(directoryCode).toContain('contact_phone?.toLowerCase().includes(q)');
      expect(directoryCode).toContain('address?.toLowerCase().includes(q)');
    });

    it('should support search on Enter keypress', () => {
      expect(directoryCode).toContain("e.key === 'Enter'");
      expect(directoryCode).toContain('setCurrentPage(1)');
    });

    it('should have dropdown filters for Status, Vendor Type, Location, and Services', () => {
      expect(directoryCode).toContain('id="filter-account-status"');
      expect(directoryCode).toContain('id="filter-vendor-type"');
      expect(directoryCode).toContain('id="filter-vendor-location"');
      expect(directoryCode).toContain('id="filter-vendor-services"');
    });

    it('should have a Reset button that clears all filters', () => {
      expect(directoryCode).toContain('id="btn-reset-filters"');
      expect(directoryCode).toContain('handleReset');
    });

    it('should display active filter chips with individual remove buttons', () => {
      expect(directoryCode).toContain('active-filters-chips-bar');
      expect(directoryCode).toContain('filter-chip-tag');
      expect(directoryCode).toContain('filter-chip-remove-btn');
    });
  });

  describe('4. Status Tabs Specifications', () => {
    it('should have the 4 status tabs with live counts', () => {
      expect(directoryCode).toContain('All Vendors ({counts.total})');
      expect(directoryCode).toContain('Verified ({counts.verified})');
      expect(directoryCode).toContain('Pending Verification ({counts.pending})');
      expect(directoryCode).toContain('Inactive ({counts.inactive})');
    });

    it('should highlight the active tab and reset page to 1 on click', () => {
      expect(directoryCode).toContain("activeTab === 'all' ? 'active' : ''");
      expect(directoryCode).toContain("activeTab === 'verified' ? 'active' : ''");
      expect(directoryCode).toContain("activeTab === 'pending' ? 'active' : ''");
      expect(directoryCode).toContain("activeTab === 'inactive' ? 'active' : ''");
    });
  });

  describe('5. Vendor Table & Columns Specifications', () => {
    it('should support sorting on supported columns', () => {
      expect(directoryCode).toContain("handleSort('vendor_name')");
      expect(directoryCode).toContain("handleSort('id')");
      expect(directoryCode).toContain("handleSort('location')");
      expect(directoryCode).toContain("handleSort('status')");
    });

    it('should render initials avatar or company logo', () => {
      expect(directoryCode).toContain('vendor-initial-avatar');
      expect(directoryCode).toContain('getInitials');
      expect(directoryCode).toContain('getAvatarColor');
    });

    it('should have compact 3-dot actions menu with View, Edit, Review Documents, and Verify', () => {
      expect(directoryCode).toContain('vendor-action-menu-dropdown');
      expect(directoryCode).toContain('View Vendor');
      expect(directoryCode).toContain('Edit Vendor');
      expect(directoryCode).toContain('Review Documents');
      expect(directoryCode).toContain('Verify Vendor');
    });
  });

  describe('6. Empty State Specifications', () => {
    it('should show filtered empty state when filters are active', () => {
      expect(directoryCode).toContain('No vendor records match your current filters.');
      expect(directoryCode).toContain('Clear Filters');
    });

    it('should show genuine empty state with Add Vendor when database is empty', () => {
      expect(directoryCode).toContain(
        'Your vendor directory is empty. Add your first vendor to start managing your logistics partners.'
      );
    });
  });

  describe('7. Add Vendor Workflow Specifications', () => {
    it('should include sections A through E in registration modal', () => {
      expect(directoryCode).toContain('A. Company Information');
      expect(directoryCode).toContain('B. Primary Contact Person');
      expect(directoryCode).toContain('C. Business Address');
      expect(directoryCode).toContain('D. Services and Fleet');
      expect(directoryCode).toContain('E. Account Settings');
    });

    it('should perform server-side duplicate checks for mobile and GSTIN', () => {
      expect(directoryCode).toContain("from('vendor_users')");
      expect(directoryCode).toContain("eq('mobile', cleanMobile)");
      expect(directoryCode).toContain("from('vendor_companies')");
      expect(directoryCode).toContain("eq('gstin', formData.gstin.trim().toUpperCase())");
    });
  });

  describe('8. Bulk Actions Specifications', () => {
    it('should render bulk toolbar when rows are selected', () => {
      expect(directoryCode).toContain('selectedRows.size > 0');
      expect(directoryCode).toContain('client-bulk-toolbar');
      expect(directoryCode).toContain('Export Selected');
      expect(directoryCode).toContain('Activate Selected');
      expect(directoryCode).toContain('Deactivate Selected');
    });
  });

  describe('9. Export and Column Settings Specifications', () => {
    it('should provide CSV export with appropriate headers', () => {
      expect(directoryCode).toContain('handleExport');
      expect(directoryCode).toContain('text/csv');
      expect(directoryCode).toContain('Vendor ID');
      expect(directoryCode).toContain('Company Legal Name');
    });

    it('should provide column visibility customization with Restore Defaults', () => {
      expect(directoryCode).toContain('column-visibility-dropdown');
      expect(directoryCode).toContain('column-restore-defaults-btn');
      expect(directoryCode).toContain('Restore Defaults');
    });
  });

  describe('10. Pagination Specifications', () => {
    it('should display "Showing 0 vendors" or formatted pagination counts', () => {
      expect(directoryCode).toContain("'Showing 0 vendors'");
      expect(directoryCode).toContain('of{');
      expect(directoryCode).toContain('vendors');
    });

    it('should include page size selector with 10, 25, 50 options', () => {
      expect(directoryCode).toContain('value={10}>10 / page');
      expect(directoryCode).toContain('value={25}>25 / page');
      expect(directoryCode).toContain('value={50}>50 / page');
    });
  });
});
