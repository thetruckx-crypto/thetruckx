# THE TRUCKX — Archived Files Report

## 1. Executive Summary

This report catalogues all files, components, test fixtures, legacy screens, and temporary utilities that were identified, retired from active production paths, and preserved under the structured `/archive/` hierarchy. This restructuring ensures that no mock data, dead code, or outdated screens reside in active compilation bundles while maintaining complete revision history.

---

## 2. Archive Taxonomy Overview

The `/archive/` directory has been organized into dedicated categories:

```
archive/
├── README.md                     # Root archive policy and guidelines
├── backups/                      # Cryptographically validated JSON database backups
│   └── database/                 # Full database snapshots before each cleanup phase
├── legacy-screens/               # Retired mobile screens replaced by modern OTP flows
│   ├── auth/login/               # Deprecated separate login screens
│   ├── auth/password/            # Deprecated desktop password reset flows
│   └── common/notifications/     # Deprecated notification onboarding screens
├── mock-data/                    # Deprecated mock datasets and static JSON payloads
├── test-fixtures/                # Deprecated testing fixtures removed from active builds
├── obsolete-components/          # Replaced UI widgets and deprecated legacy forms
├── old-scripts/                  # One-off migration scripts and historical setup probes
└── deprecated-assets/            # Obsolete image assets and icons
```

---

## 3. Inventory of Archived Files

### 3.1 Legacy Screens & Retired Components

| Original File Path | Current Archive Location | Original Purpose | Action Taken | Justification |
|---|---|---|---|---|
| `apps/mobile/src/screens/auth/login/ChooseAccountTypeScreen.tsx` | [`archive/legacy-screens/auth/login/ChooseAccountTypeScreen.tsx`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/auth/login/ChooseAccountTypeScreen.tsx) | Legacy standalone account selector screen | Archived | Replaced by unified in-line role modal (`AccountTypeSelector.tsx`) on the login screen. |
| `apps/mobile/src/screens/auth/password/ForgotPasswordScreen.tsx` | [`archive/legacy-screens/auth/password/ForgotPasswordScreen.tsx`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/auth/password/ForgotPasswordScreen.tsx) | Desktop-style password recovery | Archived | Replaced by passwordless mobile OTP authentication. |
| `apps/mobile/src/screens/auth/password/CreateNewPasswordScreen.tsx` | [`archive/legacy-screens/auth/password/CreateNewPasswordScreen.tsx`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/auth/password/CreateNewPasswordScreen.tsx) | Password creation input screen | Archived | Replaced by secure phone OTP verification tokens. |
| `apps/mobile/src/screens/auth/password/PasswordResetSuccessScreen.tsx` | [`archive/legacy-screens/auth/password/PasswordResetSuccessScreen.tsx`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/auth/password/PasswordResetSuccessScreen.tsx) | Password reset confirmation | Archived | Mobile authentication operates without static passwords. |
| `apps/mobile/src/screens/auth/password/index.ts` | [`archive/legacy-screens/auth/password/index.ts`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/auth/password/index.ts) | Password screen exports | Archived | Retired with password recovery screens. |
| `apps/mobile/src/screens/common/notifications/NotificationPermissionScreen.tsx` | [`archive/legacy-screens/common/notifications/NotificationPermissionScreen.tsx`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/legacy-screens/common/notifications/NotificationPermissionScreen.tsx) | Standalone notification prompt | Archived | Integrated into post-login native permission flows. |

### 3.2 Database Backup Snapshots

| File Path | Timestamp | Size | Contents | Justification |
|---|---|---|---|---|
| [`archive/backups/database/verified_full_backup_2026-10-30T06-43-37-453Z.json`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/backups/database/verified_full_backup_2026-10-30T06-43-37-453Z.json) | 2026-10-30 06:43:37 | 126.73 KB | 130 records across 24 tables | Complete baseline backup prior to clean reset |
| [`archive/backups/database/backup_before_cleanup_2026-10-30T09-14-01-150Z.json`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/backups/database/backup_before_cleanup_2026-10-30T09-14-01-150Z.json) | 2026-10-30 09:14:01 | 56.19 KB | 50 transactional records | Snapshot taken immediately prior to data deletion |
| [`archive/backups/database/exceptions_backup_2026-10-30T07-02-33-488Z.json`](file:///e:/lOGISTICS/North%20eastern%20carriers%20%20logistics/NECL/archive/backups/database/exceptions_backup_2026-10-30T07-02-33-488Z.json) | 2026-10-30 07:02:33 | 3.17 KB | Snapshot of exceptions data | Specialized exceptions module testing backup |

### 3.3 Server Local State Cleared

| File Path | Original Purpose | Action Taken | Justification |
|---|---|---|---|
| `server/data/server_user_registry.json` | Local fallback user registry for mobile logins | Reset to `[]` | Removed cached test phone numbers and session tokens |
| `server/data/device_tokens.json` | Mobile device notification token cache | Reset to `[]` | Removed test device push tokens |
| `server/data/admin_drafts.json` | Admin draft cache | Reset to `[]` | Cleared disposable onboarding draft records |

---

## 4. Certification

All production application bundles (`apps/admin`, `apps/mobile`, `server`) compile exclusively from active source trees with **zero dependencies** on archived files.
