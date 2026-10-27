# NECL Platform - Architectural Decision Records (ADR)

This document records the foundational architectural decisions made during the NECL folder structure audit, cleanup, and reorganization.

---

## ADR 01: Monorepo Architecture with Independent Application Roots

### Context
The NECL repository contains multiple distinct applications: a React 18 / Vite Web Admin Panel, an Expo / React Native Mobile Application, a Node.js / Express Backend, and a Supabase Database schema.

### Decision
Preserve the existing monorepo structure with independent sub-applications (`apps/admin`, `apps/mobile`, `server`, `database`) rather than artificially splitting into separate repositories or imposing an overly rigid monorepo workspace tool (such as Turborepo or Nx) that would alter package manager behavior.

### Rationale
* **Independent Dependencies**: `apps/mobile` requires Expo 51 and React Native 0.74, while `apps/admin` requires React 18.3 and Vite 6. Keeping their `node_modules` separate eliminates dependency version conflicts between mobile React Native and web React DOM.
* **Streamlined CI/CD**: Each application can be built, tested, and containerized independently using prefix commands (`npm --prefix apps/admin run build`).
* **Zero Breaking Changes**: Developers can continue using standard Expo and Vite CLI workflows without learning new tooling syntax.

---

## ADR 02: Physical Screen Preservation in `apps/mobile/src/screens/` with Master Barrel Export

### Context
The mobile application contains 72 screens in `apps/mobile/src/screens/`. While organizing them into subfolders (e.g. `screens/client/`, `screens/vendor/`, `screens/driver/`) appeared aesthetically appealing, deep analysis revealed:
1. Automated Vitest test suites in `apps/admin` (e.g., `VendorRegistrationSteps3to7.test.ts`, `SingleScreenDriverRegistration.test.ts`, `UnifiedShipmentsAndDocumentsScreen.test.ts`) inspect screen files directly via `fs.readFileSync(path.join(screensDir, '...Screen.tsx'))`. Moving them would immediately cause these tests to fail.
2. `apps/mobile/App.tsx` has established static imports for all 72 screens.

### Decision
Retain the physical screen files in `apps/mobile/src/screens/`, and introduce:
1. `apps/mobile/src/screens/index.ts`: A domain-categorized barrel export cleanly grouping all 72 screens into:
   * Auth & Common Screens (20)
   * Client Experience Screens (24)
   * Vendor Experience Screens (27)
   * Driver Experience Screens (19)
2. `apps/mobile/src/screens/README.md`: A comprehensive directory map explaining each screen's role in the NECL logistics workflow.

### Rationale
* **100% Backward Compatibility**: All Vitest tests, scripts, and runtime references continue functioning flawlessly with zero breakage.
* **Modern Developer Ergonomics**: New features and screens can now be imported cleanly from `apps/mobile/src/screens` using clean named imports.

---

## ADR 03: Centralized and Categorized Scripts Directory

### Context
25+ scripts were previously placed in a single flat `scripts/` folder, with additional scripts scattered across `apps/admin/scripts/` and `apps/mobile/scripts/`. Furthermore, root-level ZIP files (`admin-dist.zip`, `server-dist.zip`) and backup files cluttered the workspace.

### Decision
Consolidate all scripts into a four-pillar taxonomy under `scripts/`:
* `scripts/database/`: Administrative SQL provisioning and auth checks.
* `scripts/validation/`: Master E2E tests, workflow audits, and OTP verification scripts.
* `scripts/development/`: Local mock generators and asset processing tools.
* `scripts/maintenance/`: Database health audits, user checks, and safe cleanups.

Relocate ZIP archives and uncompressed original assets into `archive/`:
* `archive/build-artifacts/`
* `archive/legacy-assets/`
* `archive/backups/database/`

### Rationale
* **Discoverability**: Developers can locate relevant scripts immediately without searching through a single unorganized folder.
* **Root Tsconfig Compatibility**: Root `tsconfig.json` specifies `"include": ["scripts/**/*"]`, which automatically covers all subfolders without requiring configuration edits.
* **Clean Working Tree**: Root directory is kept clean, professional, and free of binary build artifacts.

---

## ADR 04: Database Migration Safety and Sequential Preservation

### Context
The `database/migrations/` folder contains 16 chronological SQL migrations (from `20261004000001` to `20261019000016`) applied against Supabase PostgreSQL.

### Decision
Strictly preserve all 16 migration files in their original location with their exact filenames and ordering intact. Under no circumstances should migrations be renamed, deleted, or reordered during folder reorganization.

### Rationale
* **Migration Discovery**: Supabase CLI (`supabase db push`) and the Supabase SQL Editor rely on lexical/chronological order to track applied schema migrations in the `supabase_migrations` table.
* **Zero Production Risk**: Modifying or moving historical migrations risks schema desynchronization, foreign-key corruption, or broken RLS policies in production.

---

## ADR 05: Backend API Service Encapsulation

### Context
`server/src/index.ts` contains the core Express API router, user registry cache handlers, and Supabase security definer bridges.

### Decision
Retain `server/src/index.ts` as the primary API service entry point while preserving helper services in `server/src/services/` (IdGenerator, Notifications, Permissions, OTP).

### Rationale
* Preserves all API endpoint contracts for both the Admin Panel and Mobile App.
* Keeps runtime execution deterministic with zero regression risk to existing route handlers.
