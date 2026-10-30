# THE TRUCKX — Archived Files & Asset Inventory Report

**Document**: ARCHIVED_FILES_REPORT.md  
**Date**: 2026-10-30T08:00:00Z  
**Repository**: THE TRUCKX / NECL Monorepo  
**Status**: **COMPLETE TAXONOMY ESTABLISHED & ISOLATED**  
**Lead Auditor**: DevOps & Software Quality Assurance Team  

---

## 1. Executive Summary

As part of the project reset and production hardening, all non-production artifacts, historical database backups, deprecated components, exploratory scripts, and development mocks have been removed from runtime code paths and consolidated into a structured `/archive/` directory.

No file located within `/archive/` is bundled or imported into production builds (`apps/admin/dist` or `apps/mobile/build`).

---

## 2. Archive Taxonomy Structure

```
archive/
├── README.md                                # Archive root documentation & governance
├── backups/
│   └── database/                            # Full JSON snapshot backups of PostgreSQL
│       ├── backup_before_cleanup_2026-10-28T11-27-35-652Z.json
│       ├── backup_before_cleanup_2026-10-29T04-00-05-375Z.json
│       ├── backup_before_cleanup_2026-10-29T04-21-17-706Z.json
│       ├── backup_before_cleanup_2026-10-30T06-55-21-407Z.json
│       ├── backup_before_cleanup_2026-10-30T07-04-08-533Z.json
│       └── backup_before_cleanup_2026-10-30T07-59-21-579Z.json
├── mock-data/
│   └── README.md                            # Archived seed and mock data guidelines
├── test-fixtures/
│   └── README.md                            # Isolated test fixtures policy
├── obsolete-components/
│   └── README.md                            # Deprecated UI components changelog
├── old-scripts/
│   └── README.md                            # Retired maintenance & scrapers log
└── deprecated-assets/
    └── README.md                            # Brand asset deprecation record
```

---

## 3. Detailed Inventory by Category

### 3.1 Category: Database Snapshot Backups (`/archive/backups/database/`)

| Snapshot File | Size | Records / Tables | Creation Timestamp | Archival Justification |
| :--- | :---: | :---: | :---: | :--- |
| `backup_before_cleanup_2026-10-30T07-59-21-579Z.json` | 16.65 KB | 24 Tables | 2026-10-30 07:59 UTC | Immediate snapshot prior to clean-state database reset |
| `backup_before_cleanup_2026-10-30T07-04-08-533Z.json` | 16.65 KB | 24 Tables | 2026-10-30 07:04 UTC | Snapshot prior to exceptions module audit |
| `backup_before_cleanup_2026-10-30T06-55-21-407Z.json` | 114.13 KB | 24 Tables | 2026-10-30 06:55 UTC | Snapshot capturing active operational test records |
| `backup_before_cleanup_2026-10-29T04-21-17-706Z.json` | 27.79 KB | 24 Tables | 2026-10-29 04:21 UTC | Historical backup after pricing & quotation milestone |
| `backup_before_cleanup_2026-10-29T04-00-05-375Z.json` | 43.19 KB | 24 Tables | 2026-10-29 04:00 UTC | Historical backup after vendor onboarding audit |
| `backup_before_cleanup_2026-10-28T11-27-35-652Z.json` | 426.36 KB | 24 Tables | 2026-10-28 11:27 UTC | Initial monolithic database snapshot |

### 3.2 Category: Mock Data & Seed Files (`/archive/mock-data/`)
- **Archival Justification**: Previous development iterations relied on offline dummy arrays for UI testing. These have been purged to enforce 100% live PostgreSQL database operations.
- **Reference**: Documented in [`archive/mock-data/README.md`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/mock-data/README.md).

### 3.3 Category: Test Fixtures & Stubs (`/archive/test-fixtures/`)
- **Archival Justification**: Loose, disconnected fixture JSON files were retired in favor of typed Vitest integration tests co-located under `apps/admin/src/` and end-to-end audit scripts under `scripts/validation/`.
- **Reference**: Documented in [`archive/test-fixtures/README.md`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/test-fixtures/README.md).

### 3.4 Category: Obsolete UI Components (`/archive/obsolete-components/`)
- **`ForgotNumberModal.tsx`**: Removed from the active mobile authentication flow per user instructions to simplify the login experience.
- **Legacy Fleet Tables**: Replaced by `SharedVehicleMasterDirectory.tsx` and the newly implemented `VehicleComplianceWorkspace.tsx`.
- **Reference**: Documented in [`archive/obsolete-components/README.md`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/obsolete-components/README.md).

### 3.5 Category: Old Development Scripts (`/archive/old-scripts/`)
- **Scratch Scrapers & Query Probes**: Early diagnostic scripts in `/scratch/` that inspected schemas and routes have been retired.
- **Active Successors**: Consolidated into `scripts/validation/test-complete-workflow-audit.js` and `scripts/validation/verify-master-e2e-workflow.js`.
- **Reference**: Documented in [`archive/old-scripts/README.md`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/old-scripts/README.md).

### 3.6 Category: Deprecated Assets (`/archive/deprecated-assets/`)
- **Unused Logo Variations**: Legacy green/blue NECL badges and low-res PNGs replaced by official SVG/PNG branding assets in `apps/admin/public/` and `apps/mobile/assets/`.
- **Brand Standards Enforced**: Safety Freight Orange (`#F15A24`), Deep Navy (`#172B4D`), Clean White (`#FFFFFF`).
- **Reference**: Documented in [`archive/deprecated-assets/README.md`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/deprecated-assets/README.md).

---

## 4. Restoration & Inspection Procedures

To inspect or restore any archived snapshot:

1. **Inspect an Archived JSON Snapshot**:
   ```bash
   # View tables captured inside a specific backup
   node -e "const b = require('./archive/backups/database/backup_before_cleanup_2026-10-30T07-59-21-579Z.json'); console.log(Object.keys(b));"
   ```

2. **Restore a Specific Table from Cold Storage**:
   ```bash
   node scripts/maintenance/restore_table_from_backup.mjs archive/backups/database/backup_before_cleanup_2026-10-30T07-59-21-579Z.json <table_name>
   ```

3. **Verify Integrity After Restoration**:
   ```bash
   node scripts/maintenance/audit_database_for_cleanup.mjs
   ```

---

## 5. Verification Sign-Off

All archived artifacts are strictly isolated in `/archive/`. Build pipelines (`npm run build:admin`, `npm run build:server`, `npm run test:mobile:types`) execute without referencing any archived file.
