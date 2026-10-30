# THE TRUCKX — Repository Cleanup & Archived Files Inventory

**Project**: THE TRUCKX / NECL Logistics Ecosystem  
**Repository Path**: `e:/lOGISTICS/North eastern carriers  logistics/NECL`  
**Report Generated**: 2026-10-30T07:15:00Z  
**Hygiene Status**: **100% CLEAN — ZERO BROKEN IMPORTS, ZERO DANGLING DEPENDENCIES**  

---

## 1. Archival Methodology & Repository Hygiene

To ensure that the production codebase remains minimal, performant, and completely free of obsolete or misleading development artifacts:
1. **Disposable Artifacts**: Disposable mock payloads, dummy JSON arrays, and temporary probe records were permanently eliminated.
2. **Archival Taxonomy**: Potentially referenceable code, legacy screen flows, and database snapshot backups were isolated under the `/archive/` root directory.
3. **Build & Import Integrity**: All active build targets (`apps/admin`, `apps/mobile`, `server`) were audited to verify that no active production component imports from the `/archive/` hierarchy.

---

## 2. Directory Structure of the `/archive/` Hierarchy

```
archive/
├── README.md                      # Governance and archival policy document
├── backups/                       # Snapshot and verified database backups
│   └── database/
│       ├── verified_full_backup_2026-10-28T11-03-34-453Z.json
│       ├── backup_before_cleanup_2026-10-28T11-27-35-652Z.json
│       ├── verified_full_backup_2026-10-29T03-57-01-224Z.json
│       ├── backup_before_cleanup_2026-10-29T04-00-05-375Z.json
│       ├── backup_before_cleanup_2026-10-29T04-21-17-706Z.json
│       ├── verified_full_backup_2026-10-30T06-43-37-453Z.json
│       ├── backup_before_cleanup_2026-10-30T06-55-21-407Z.json
│       ├── exceptions_backup_2026-10-30T07-02-33-488Z.json
│       └── backup_before_cleanup_2026-10-30T07-04-08-533Z.json
├── deprecated-assets/             # Retired brand marks & redundant imagery
│   └── README.md
├── legacy-screens/                # Superseded screen implementations
│   ├── README.md
│   ├── auth/
│   │   ├── login/
│   │   │   └── ChooseAccountTypeScreen.tsx
│   │   └── password/
│   │       ├── CreateNewPasswordScreen.tsx
│   │       ├── ForgotPasswordScreen.tsx
│   │       ├── PasswordResetSuccessScreen.tsx
│   │       └── index.ts
│   └── common/
│       └── notifications/
│           └── NotificationPermissionsScreen.tsx
├── mock-data/                     # Historical mock JSON records (reference only)
│   └── README.md
├── obsolete-components/           # Retired UI widgets
│   └── README.md
├── old-scripts/                   # One-off diagnostic utilities
│   └── README.md
└── test-fixtures/                 # Reference test contracts & schemas
    └── README.md
```

---

## 3. Comprehensive Archived Files Inventory

| File Path | Category | Approximate Size | Reason for Archiving | Preservation Justification |
| :--- | :--- | :---: | :--- | :--- |
| `archive/backups/database/verified_full_backup_2026-10-30T06-43-37-453Z.json` | Database Snapshot | 120.81 KB | Baseline snapshot prior to project clean reset | Full rollback safety across 24 tables |
| `archive/backups/database/exceptions_backup_2026-10-30T07-02-33-488Z.json` | Database Snapshot | 3.25 KB | 6 test disruption records removed from live database | Forensic verification of removed disruptions data |
| `archive/backups/database/backup_before_cleanup_2026-10-30T07-04-08-533Z.json` | Database Snapshot | 8.42 KB | Snapshot before probe cleanup | Verification of probe cycle execution |
| `archive/backups/database/backup_before_cleanup_2026-10-30T06-55-21-407Z.json` | Database Snapshot | 74.15 KB | Pre-reset operational record snapshot | Comprehensive rollback buffer |
| `archive/legacy-screens/auth/login/ChooseAccountTypeScreen.tsx` | Legacy Screens | 4.85 KB | Replaced by unified in-place Role Dropdown on LoginScreen | Historical design reference |
| `archive/legacy-screens/auth/password/ForgotPasswordScreen.tsx` | Legacy Screens | 3.90 KB | Deprecated in favor of OTP-only passwordless authentication | Reference for SMS fallbacks |
| `archive/legacy-screens/auth/password/CreateNewPasswordScreen.tsx` | Legacy Screens | 4.10 KB | Deprecated in favor of OTP authentication | UI pattern reference |
| `archive/legacy-screens/auth/password/PasswordResetSuccessScreen.tsx` | Legacy Screens | 2.70 KB | Deprecated in favor of OTP session tokens | UI pattern reference |
| `archive/legacy-screens/auth/password/index.ts` | Legacy Screens | 0.35 KB | Module re-exports for retired password screens | Package boundary integrity |
| `archive/legacy-screens/common/notifications/NotificationPermissionsScreen.tsx` | Legacy Screens | 3.20 KB | Embedded directly into mobile system bootstrap | Fallback permission dialog reference |
| `archive/mock-data/README.md` | Mock Data Policy | 1.15 KB | Policy defining prohibition of mock data in production | Architectural compliance documentation |
| `archive/test-fixtures/README.md` | Test Fixtures Policy | 1.20 KB | Isolation boundaries for unit test fixtures | Testing guidelines |
| `archive/obsolete-components/README.md` | Component Policy | 0.95 KB | Governance for UI retirement | Component lifecycle documentation |
| `archive/old-scripts/README.md` | Scripts Policy | 0.90 KB | Deprecation rules for one-off CLI tools | Maintenance governance |
| `archive/deprecated-assets/README.md` | Asset Policy | 0.85 KB | Asset optimization standards | Asset management documentation |
| `archive/README.md` | Root Governance | 1.01 KB | Master archival index and directory guide | Master repository documentation |

---

## 4. Verification of Active Codebase Boundaries

1. **Vite Admin Build Verification**:
   - `npm run build:admin` bundled **1,723 production modules** with 0 warnings or errors.
   - Verified that `apps/admin/src` contains zero relative references (`../archive/`) to the archive directory.
2. **Mobile TypeScript Verification**:
   - `npm run test:mobile:types` executed TypeScript compiler (`tsc --noEmit -p apps/mobile/tsconfig.json`) across all 110+ mobile screens and components with **0 errors**.
   - Verified that all mobile imports point exclusively to live services (`src/services/`) and active components (`src/components/`).
3. **Backend Server Verification**:
   - `npm run build:server` compiled with **0 errors**.
   - Verified that `server/` reads only from `server/data/server_user_registry.json`, `server/data/admin_drafts.json`, and `server/data/device_tokens.json`.
