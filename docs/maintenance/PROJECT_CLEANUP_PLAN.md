# NECL Project Cleanup & Reorganization Plan

**Document**: `docs/maintenance/PROJECT_CLEANUP_PLAN.md`  
**Execution Date**: October 23, 2026  
**Status**: Executed & Validated

---

## 1. Objectives & Safety Directives

The objective of this plan is to transform the NECL monorepo into a clean, predictable, production-grade workspace while guaranteeing:
1. **Zero Functionality Regression**: All business workflows (Client, Vendor, Driver, Admin, Backend) operate without interruption.
2. **Zero Schema Disturbance**: Supabase PostgreSQL migrations (16 files) remain identical in timestamp, content, and ordering.
3. **No Blind Deletions**: Every candidate file is investigated for runtime, build, and test references before relocation, archival, or removal.
4. **Preservation of User Working Work**: Working changes in `apps/mobile/` and `apps/admin/` are strictly protected.

---

## 2. Planned & Executed File Operations

### Phase A: Build Artifacts & Legacy Asset Archival
- **Action**: Move all committed `.zip` archives from root and package directories to `archive/build-artifacts/`.
  - Result: `admin-dist.zip`, `server-dist.zip`, and `apps-admin-dist.zip` archived. Updated `.gitignore` with `*.zip` and `archive/build-artifacts/`.
- **Action**: Relocate raw, uncompressed assets (`*.orig.png`, `*.orig.jpg`) to `archive/legacy-assets/`.
  - Result: 3 raw image originals safely preserved in `archive/legacy-assets/`.
- **Action**: Consolidate redundant logo duplicates (`necl-logo.png` in admin and mobile) to `archive/deprecated-assets/`.
  - Result: Both duplicate copies relocated; active code uses `trucks-logo-header.png`.

### Phase B: Scripts Consolidation & Categorization
- **Action**: Collect all scripts from root, `apps/admin/scripts/`, and `apps/mobile/scripts/` into a single organized `scripts/` directory with 4 domain folders:
  - `scripts/database/`: Admin provisioning SQL and security audit scripts.
  - `scripts/validation/`: 20 end-to-end integration and API verification test scripts.
  - `scripts/development/`: Local mock creators and asset generators.
  - `scripts/maintenance/`: Database state management and cleanup audits.
- **Action**: Update relative root paths (`../../`) across all moved scripts.
- **Action**: Archive obsolete one-time migration script `reorganize-mobile-screens.mjs` to `archive/obsolete-scripts/`.

### Phase C: Mobile Screens Domain & Workflow Partitioning
- **Action**: Physically organize all 72 mobile screens from a single flat folder into role domain folders (`auth/`, `common/`, `client/`, `vendor/`, `driver/`), and further subdivide into intuitive workflow subfolders:
  - `auth/`: `login/`, `otp/`, `registration/`, `password/`
  - `common/`: `onboarding/`, `profile/`, `notifications/`, `settings/`
  - `client/`: `dashboard/`, `onboarding/`, `requirements/`, `quotations/`, `bookings/`, `shipments/`
  - `vendor/`: `dashboard/`, `registration/`, `rfqs/`, `bookings/`, `trips/`, `fleet/`
  - `driver/`: `dashboard/`, `registration/`, `trips/`, `documents/`
- **Action**: Establish multi-tier barrel architecture:
  - Each workflow folder has an `index.ts`.
  - Each domain folder has an `index.ts`.
  - The root `screens/index.ts` re-exports all domains.
- **Action**: Update import depths in all moved screens:
  - Adjusted `from '../../components/` to `from '../../../components/` (and services, types, utils, supabase).
  - Adjusted asset requires in `SplashScreen.tsx` and `OnboardingScreen.tsx` to `../../../../assets/...`.

### Phase D: Admin Vitest Static Inspection Test Alignment
- **Action**: Survey all Vitest test suites in `apps/admin/src/components/` that read mobile code directly via `fs.readFileSync(path.join(...))`.
- **Action**: Update screen paths to their new workflow subfolder paths in:
  - `UnifiedShipmentsAndDocumentsScreen.test.ts`
  - `ShipmentsAndBookingsModules.test.ts`
  - `MyBookingsScreen.test.ts`
  - `ClientRegistrationConfirmationScreen.test.ts`
  - `ClientShipmentsIntegration.test.ts`
  - `ClientDashboardScreen.test.ts`
  - `TransportRequirementStep2NavigationAndDraftSaved.test.ts`
  - `VendorDashboardAndMobileRedesign.test.ts`
  - `VendorRegistrationSteps3to7.test.ts`
  - `VendorUpdateMissingStepsValidation.test.ts`
  - `VendorComplianceAndApprovalWorkflow.test.ts`
  - `SingleScreenDriverRegistration.test.ts`

---

## 3. Validation Procedures

Each stage was validated against the following battery:

1. **Mobile Type Integrity**:
   - Command: `npm run test:mobile:types` (`tsc --noEmit -p apps/mobile/tsconfig.json`)
   - Target: 0 errors.
   - Result: **0 errors (Exit code 0)**.

2. **Admin Production Build**:
   - Command: `npm run build:admin` (`tsc && vite build`)
   - Target: Successful bundle generation with all chunks resolved.
   - Result: **Built in 9.02s (Exit code 0)**.

3. **Server Backend Build**:
   - Command: `npm run test:server` (`tsc -p server/tsconfig.json`)
   - Target: 0 errors.
   - Result: **0 errors (Exit code 0)**.

4. **Vitest Test Discovery & Path Resolution**:
   - Command: `npm --prefix apps/admin run test`
   - Target: All 30 test files discovered; zero `ENOENT` / file-not-found errors.
   - Result: **All 30 test files resolved; 556 tests passed**.

---

## 4. Rollback & Recovery Procedures

If any unanticipated issue arises during further development:
- Every archived file is tracked in [archive/ARCHIVE_MANIFEST.md](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/ARCHIVE_MANIFEST.md) with original path and MD5/byte-size provenance.
- Git commit `0bbcf26` represents the exact pre-audit working tree baseline.
- `archive/backups/database/` contains full point-in-time table state snapshots.
