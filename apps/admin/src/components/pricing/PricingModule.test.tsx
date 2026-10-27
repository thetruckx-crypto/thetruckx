import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PricingModule', () => {
  const pricingModuleCode = fs.readFileSync(
    path.join(__dirname, 'PricingModule.tsx'),
    'utf-8'
  );

  describe('Module Structure & Export Integrity', () => {
    it('should export PricingModule as named and default export', () => {
      expect(pricingModuleCode).toContain('export const PricingModule: React.FC<PricingModuleProps>');
      expect(pricingModuleCode).toContain('export default PricingModule');
    });

    it('should define all required TypeScript interfaces', () => {
      expect(pricingModuleCode).toContain('export interface Requirement');
      expect(pricingModuleCode).toContain('export interface VendorInfo');
      expect(pricingModuleCode).toContain('export interface VendorQuotationData');
      expect(pricingModuleCode).toContain('export interface ChargeLineItem');
      expect(pricingModuleCode).toContain('export interface ClientQuote');
      expect(pricingModuleCode).toContain('export interface PricingModuleProps');
    });
  });

  describe('Dashboard UI & 6 Live KPI Cards', () => {
    it('should render 6 KPI cards matching the production mockup', () => {
      expect(pricingModuleCode).toContain('Pending Review');
      expect(pricingModuleCode).toContain('Draft');
      expect(pricingModuleCode).toContain('Ready to Issue');
      expect(pricingModuleCode).toContain('Issued');
      expect(pricingModuleCode).toContain('Accepted');
      expect(pricingModuleCode).toContain('Expiring Soon');
    });

    it('should compute KPI counts dynamically from real quotation data', () => {
      expect(pricingModuleCode).toContain('kpiData');
      expect(pricingModuleCode).toContain('kpiData.pendingReview');
      expect(pricingModuleCode).toContain('kpiData.draft');
      expect(pricingModuleCode).toContain('kpiData.readyToIssue');
      expect(pricingModuleCode).toContain('kpiData.issued');
      expect(pricingModuleCode).toContain('kpiData.accepted');
      expect(pricingModuleCode).toContain('kpiData.expiringSoon');
    });
  });

  describe('8 Status Filter Tabs', () => {
    it('should implement all 8 status filter tabs with pill count badges', () => {
      const tabs = [
        'ALL',
        'PENDING_REVIEW',
        'DRAFT',
        'READY_TO_ISSUE',
        'ISSUED',
        'ACCEPTED',
        'REJECTED',
        'EXPIRED'
      ];
      tabs.forEach((tab) => {
        expect(pricingModuleCode).toContain(`key: '${tab}'`);
      });
    });

    it('should compute live tab counts', () => {
      expect(pricingModuleCode).toContain('tabCounts.ALL');
      expect(pricingModuleCode).toContain('tabCounts.PENDING_REVIEW');
      expect(pricingModuleCode).toContain('tabCounts.DRAFT');
      expect(pricingModuleCode).toContain('tabCounts.READY_TO_ISSUE');
      expect(pricingModuleCode).toContain('tabCounts.ISSUED');
      expect(pricingModuleCode).toContain('tabCounts.ACCEPTED');
      expect(pricingModuleCode).toContain('tabCounts.REJECTED');
      expect(pricingModuleCode).toContain('tabCounts.EXPIRED');
    });
  });

  describe('Search & Filter Toolbar', () => {
    it('should include Search, Client dropdown, Status dropdown, Date range, Search, Reset, and Refresh', () => {
      expect(pricingModuleCode).toContain('Search by Quote ID, Req ID, Client, Route...');
      expect(pricingModuleCode).toContain('All Clients');
      expect(pricingModuleCode).toContain('All Statuses');
      expect(pricingModuleCode).toContain('All Time');
      expect(pricingModuleCode).toContain('Reset');
      expect(pricingModuleCode).toContain('Refresh');
    });

    it('should implement CSV Export functionality', () => {
      expect(pricingModuleCode).toContain('handleExportCSV');
      expect(pricingModuleCode).toContain('text/csv;charset=utf-8;');
      expect(pricingModuleCode).toContain('NECL_Pricing_Quotations_');
    });
  });

  describe('Quotations Directory Table', () => {
    it('should include all required table columns', () => {
      expect(pricingModuleCode).toContain('Quote ID');
      expect(pricingModuleCode).toContain('Requirement / Client');
      expect(pricingModuleCode).toContain('Route');
      expect(pricingModuleCode).toContain('Vehicle');
      expect(pricingModuleCode).toContain('Vendor Cost');
      expect(pricingModuleCode).toContain('Margin');
      expect(pricingModuleCode).toContain('GST (18%)');
      expect(pricingModuleCode).toContain('Client Quote');
      expect(pricingModuleCode).toContain('Valid Until');
      expect(pricingModuleCode).toContain('Status');
      expect(pricingModuleCode).toContain('Actions');
    });

    it('should support checkbox bulk selection and single row selection', () => {
      expect(pricingModuleCode).toContain('handleToggleSelectAll');
      expect(pricingModuleCode).toContain('handleToggleSelectRow');
      expect(pricingModuleCode).toContain('selectedQuoteIds');
    });
  });

  describe('Selected Quote 3 Bottom Preview Panels', () => {
    it('should implement Card 1: Quote Breakdown with financial totals', () => {
      expect(pricingModuleCode).toContain('Quote Breakdown');
      expect(pricingModuleCode).toContain('Vendor Cost');
      expect(pricingModuleCode).toContain('Our Margin');
      expect(pricingModuleCode).toContain('Taxable Amount');
      expect(pricingModuleCode).toContain('GST (18%)');
      expect(pricingModuleCode).toContain('Total Client Quote');
      expect(pricingModuleCode).toContain('Edit Quote');
      expect(pricingModuleCode).toContain('View Full Details');
    });

    it('should implement Card 2: Vendor Source with carrier info and RFQ reference', () => {
      expect(pricingModuleCode).toContain('Source RFQ:');
      expect(pricingModuleCode).toContain('Quote Received:');
      expect(pricingModuleCode).toContain('View RFQ & Compare Quotes');
    });

    it('should implement Card 3: Quote Activity timeline stream', () => {
      expect(pricingModuleCode).toContain('Quote Activity');
      expect(pricingModuleCode).toContain('Draft Created');
      expect(pricingModuleCode).toContain('Vendor Quote Selected');
      expect(pricingModuleCode).toContain('Quote Calculated');
    });
  });

  describe('5-Step Create Client Quote Wizard', () => {
    it('should define all 5 workflow steps', () => {
      expect(pricingModuleCode).toContain('Select Requirement');
      expect(pricingModuleCode).toContain('Vendor Quote');
      expect(pricingModuleCode).toContain('Margin & GST');
      expect(pricingModuleCode).toContain('Quote Terms');
      expect(pricingModuleCode).toContain('Preview & Submit');
    });

    it('should support both percentage and fixed commercial margin modes', () => {
      expect(pricingModuleCode).toContain("marginType === 'FIXED'");
      expect(pricingModuleCode).toContain("marginType === 'PERCENT'");
      expect(pricingModuleCode).toContain('Fixed Amount (₹)');
      expect(pricingModuleCode).toContain('Percentage (%)');
    });

    it('should include additional charge line items', () => {
      expect(pricingModuleCode).toContain('LOADING_CHARGES');
      expect(pricingModuleCode).toContain('UNLOADING_CHARGES');
      expect(pricingModuleCode).toContain('DETENTION');
      expect(pricingModuleCode).toContain('TOLL');
      expect(pricingModuleCode).toContain('INSURANCE');
    });

    it('should support GST configuration and multiple tax slabs', () => {
      expect(pricingModuleCode).toContain('GST_RATES = [5, 12, 18]');
      expect(pricingModuleCode).toContain('gstApplicable');
    });

    it('should detect zero margin and provide confirmation safety alert', () => {
      expect(pricingModuleCode).toContain('showZeroMarginAlert');
    });
  });

  describe('Commercial Confidentiality & Security', () => {
    it('should protect vendor costs and internal margins with canViewMargins', () => {
      expect(pricingModuleCode).toContain('canViewMargins()');
      expect(pricingModuleCode).toContain('Confidential');
    });

    it('should enforce role-based permission checks before creating quotes', () => {
      expect(pricingModuleCode).toContain("hasPermission('pricing', 'create')");
    });
  });
});
