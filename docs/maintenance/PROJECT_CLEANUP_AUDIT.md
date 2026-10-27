# NECL Project Cleanup Audit

**Audit Date**: October 23, 2026  
**Repository**: North Eastern Carriers Logistics (NECL) Platform  
**Auditor**: Principal Software Architect & DevOps Lead  
**Branch**: `master` | **Base Commit**: `0bbcf26` ("Updated UI UX and fixed functionality")

---

## 1. Executive Summary

This audit evaluates the structure, file organization, dependencies, and code hygiene of the NECL platform. The platform is a full-stack logistics solution operating across three frontend interfaces (Web Admin, Client Mobile, Vendor/Carrier Mobile, and Driver Mobile) powered by an Express/TypeScript server and Supabase PostgreSQL with real-time replication.

### Key Pre-Audit Findings & Problems Discovered
1. **Flat Screens Clutter**: Previously, all 72 mobile screens resided in a single flat directory `apps/mobile/src/screens/`, making domain discovery and navigation difficult.
2. **Build Artifacts in Source Control**: 3 ZIP archives totaling ~2.9 MB (`admin-dist.zip`, `server-dist.zip`, `apps/admin/dist.zip`) were committed in the repository root and nested admin folders.
3. **Scattered Automation Scripts**: Scripts were distributed haphazardly across root, `apps/admin/scripts/`, and `apps/mobile/scripts/`, creating duplicate execution paths and unclear maintenance ownership.
4. **Duplicate & Uncompressed Asset Clutter**: Raw `.orig.png` and `.orig.jpg` files coexisted with production-optimized assets, and byte-for-byte duplicate logos (`necl-logo.png` vs. `trucks-logo-header.png`) were unreferenced in both `apps/admin/` and `apps/mobile/`.
5. **Database State Backups in Active Folders**: Multiple timestamped JSON snapshots from earlier database cleanup runs were scattered across `server/data/` and root.
6. **Sub-subfolder Relative Import Discrepancies**: Newly reorganized mobile screens inside domain workflow folders required import adjustments (`../../../` vs `../../`) for components, services, and asset references.

---

## 2. Platform Architecture Baseline

```text
NECL Monorepo Root
├── apps/
│   ├── admin/               # Web Admin Management Portal (React 18 + Vite 6 + Tailwind/Vanilla CSS)
│   └── mobile/              # Unified Mobile Application (React Native 0.76 + Expo 52)
│       └── src/screens/     # 72 screens partitioned into auth/, common/, client/, vendor/, driver/
├── server/                  # Backend REST API Service (Node.js + Express + Prisma 5 + Supabase)
├── database/                # Supabase PostgreSQL Configuration & Migrations (16 versioned SQL migrations)
├── scripts/                 # Categorized automation (database/, validation/, development/, maintenance/)
├── archive/                 # Non-runtime archives (build-artifacts/, legacy-assets/, deprecated-assets/, backups/)
└── docs/                    # Architecture (docs/architecture/) & Maintenance (docs/maintenance/)
```

### Verified Active Workflows
1. **Consignor Request Flow**: Client Requirement Creation (Steps 1–5) -> Admin Review -> RFQ Dispatch to Northeast Transporters.
2. **Vendor Bidding & Allocation**: Transporter quotation submission -> Admin price margin comparison -> Client rate acceptance -> Vehicle & Driver assignment.
3. **Transit & Closure**: Driver route navigation -> SOS tracking -> ePOD upload -> Admin weighment check & closure.

---

## 3. Comprehensive File Classification (Categories A–G)

### Category A — Active & Required
* **Admin Application**: `apps/admin/src/App.tsx`, `main.tsx`, `index.css`, `theme.css`, `components/` (all domain modules), `services/`, `utils/`, `config/`.
* **Mobile Application**: `apps/mobile/App.tsx`, `src/screens/` (all 72 domain screens across 18 workflow subfolders), `src/components/`, `src/services/`, `src/types.ts`, `src/supabase.ts`, `src/config/branding.ts`.
* **Backend API**: `server/src/index.ts`, `server/src/config.ts`, `server/src/services/`, `server/src/supabase.ts`, `server/prisma/schema.prisma`.
* **Active Data Registries**: `server/data/server_user_registry.json`, `server/data/admin_permissions.json`.
* **Database Migrations**: `database/migrations/20261004000001_create_admin_users.sql` through `20261019000016_create_admin_registration_drafts.sql` (16 total).
* **Core Documentation**: Root `README.md`, `package.json`, `.gitignore`, `.env.example`, `tsconfig.json`.

### Category B — Duplicate or Redundant
* `apps/admin/src/assets/images/necl-logo.png` (248.5 KB) — Identical byte duplicate of `trucks-logo-header.png`.
* `apps/mobile/assets/necl-logo.png` (248.5 KB) — Identical byte duplicate of `trucks-logo-header.png`.
* `scripts/development/reorganize-mobile-screens.mjs` — Temporary migration script superseded by permanent subfolder structure.
* Redundant copies of `backup_before_cleanup_*.json` in root and nested directories.

### Category C — Confirmed Unnecessary
* `*.zip` build bundles in repository directories.
* Empty directories left after script consolidation (`apps/admin/scripts/`, `apps/mobile/scripts/`).
* Temporary migration test artifacts (`scripts/maintenance/migrate_screens_subfolders.js`, `fix_import_depths.js`).

### Category D — Inactive but Potentially Useful (Archived)
* `archive/build-artifacts/admin-dist.zip`, `server-dist.zip`, `apps-admin-dist.zip`.
* `archive/legacy-assets/admin-necl-logo.orig.png`, `mobile-necl-logo.orig.png`, `mobile-necl-splash-bg-clean.orig.jpg`.
* `archive/deprecated-assets/admin-necl-logo.png`, `mobile-necl-logo.png`.
* `archive/obsolete-scripts/reorganize-mobile-screens.mjs`.
* `archive/backups/database/backup_before_cleanup_*.json` (4 point-in-time database snapshots).

### Category E — Development-Only & Test-Only
* `apps/admin/src/components/**/*.test.ts` and `*.test.tsx` (30 test suites covering admin workflows and mobile screen specifications).
* `database/seeds/dev_sample_data.sql` — Development mock data (kept strictly isolated in `database/seeds/`).
* `scripts/validation/` — 20 end-to-end integration and API verification test scripts.
* `scripts/development/create-test-requirement.ts`, `generate-app-icons.ts`.

### Category F — Generated or Framework-Managed
* `apps/admin/dist/` — Generated production build output from `vite build` (gitignored).
* `node_modules/` across root, admin, mobile, and server (gitignored).
* `package-lock.json` manifests tracking deterministic dependency versions.

### Category G — Unknown or Uncertain
* None. Every file in the repository has been surveyed, mapped, and assigned a specific role or archived.

---

## 4. Dependencies, Risks & Mitigation Strategy

| Risk Identified | Potential Impact | Mitigation Implemented |
|:---|:---|:---|
| **Breaking `fs.readFileSync` in Admin Tests** | Admin test suites inspecting mobile screens fail if screen paths change. | All 30 test files surveyed; updated paths precisely to new workflow subfolders (`screens/client/shipments/`, etc.). 556 tests pass. |
| **Breaking Relative Imports in Deeper Folders** | Screen components moving from depth 2 to depth 3/4 lose access to `components/` and `services/`. | Re-indexed all relative import paths (`../../../`) and verified zero TypeScript errors via `npm run test:mobile:types`. |
| **Breaking Asset Require Calls** | Expo runtime crashes if `require('../../assets/...')` cannot find images. | Updated `SplashScreen.tsx` and `OnboardingScreen.tsx` to `../../../../assets/...`. Verified asset resolution. |
| **Accidental Database Migration Corruption** | Breaking Supabase CLI migration discovery or remote migration state table. | `database/migrations/` was strictly isolated and untouched. Zero schema modifications. |
| **Active Runtime Data Loss** | Discarding local server session data during cleanup. | Preserved active runtime registries `server/data/server_user_registry.json` and `admin_permissions.json`. |
