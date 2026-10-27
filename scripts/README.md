# NECL Platform - Centralized Scripts Directory

This directory contains all database setup, automation, integration test, asset generation, and maintenance scripts for the North Eastern Carriers Logistics (NECL) platform.

---

## Directory Organization

```text
scripts/
├── database/       # Administrative SQL scripts and user setup utilities
├── validation/     # End-to-end integration tests and automated workflow audits
├── development/    # Local development helpers and asset generation tooling
└── maintenance/    # Production health checks, database audits, and cleanup scripts
```

---

## 1. Database Scripts (`scripts/database/`)

These SQL scripts are designed to be run against Supabase (via the Supabase SQL Editor, Supabase CLI, or `psql`).

| File | Purpose |
|------|---------|
| `create-admin-users.sql` | Inserts primary system administrators with RBAC roles. |
| `setup-admin-users.sql` | Idempotent script ensuring all admin roles and initial credentials exist. |
| `quick-create-admin.sql` | Fast setup for testing admin accounts. |
| `insert-admin-users-only.sql` | Targeted script to insert admin accounts without touching other tables. |
| `check-auth-status.sql` | SQL queries to inspect active auth sessions and user table links. |
| `verify-security.sql` | Verifies Row-Level Security (RLS) policies across all tables. |

---

## 2. Validation & Integration Tests (`scripts/validation/`)

Automated tests and verification suites checking cross-application data flow and business logic.

| Script | Purpose | Execution |
|--------|---------|-----------|
| `verify-master-e2e-workflow.js` | Complete end-to-end lifecycle verification (Client Requirement → Vendor RFQ → Quotation → Comparison → Booking Confirmation → Vehicle/Driver Assignment → Loading → Transit → Unloading → POD → Clearance → Closure). | `node scripts/validation/verify-master-e2e-workflow.js` |
| `test-complete-workflow-audit.js` | Audits all active workflows and validates database consistency. | `node scripts/validation/test-complete-workflow-audit.js` |
| `verify-document-pipeline.mjs` | Verifies document upload to Supabase storage and KYC verification pipelines. | `node scripts/validation/verify-document-pipeline.mjs` |
| `test-auth-flow.ts` | Tests multi-role authentication (Client, Vendor, Driver, Admin). | `npx tsx scripts/validation/test-auth-flow.ts` |
| `test-admin-sync.ts` | Verifies synchronization between mobile user registrations and the admin panel. | `npx tsx scripts/validation/test-admin-sync.ts` |
| `test-client-instant-approval.ts` | Verifies instant KYC approval criteria for enterprise clients. | `npx tsx scripts/validation/test-client-instant-approval.ts` |
| `test-driver-registration.js` | Validates single-screen driver registration and license auditing. | `node scripts/validation/test-driver-registration.js` |
| `test-mobile-otp-flows.ts` | Tests OTP delivery, resend throttles, and verification across roles. | `npx tsx scripts/validation/test-mobile-otp-flows.ts` |
| `test-vendor-quote-to-booking-flow.js` | Simulates vendor bidding and booking confirmation. | `node scripts/validation/test-vendor-quote-to-booking-flow.js` |
| `verify_step2_step3_vendor_features.ts` | Tests extended cargo units, dynamic fleet strength, and PIN auto-resolution. | `npx tsx scripts/validation/verify_step2_step3_vendor_features.ts` |
| `test-fleet-sync-e2e.mjs` | Tests end-to-end fleet and driver synchronization. | `node scripts/validation/test-fleet-sync-e2e.mjs` |
| `test-vendor-phase3-flow.mjs` | Tests 11-step vendor onboarding and compliance flow. | `node scripts/validation/test-vendor-phase3-flow.mjs` |
| `inspect_records.mjs` | Quick inspector for database entities and foreign-key links. | `node scripts/validation/inspect_records.mjs` |

---

## 3. Development Tools (`scripts/development/`)

Utilities for local development and build tooling.

| Script | Purpose | Execution |
|--------|---------|-----------|
| `create-test-requirement.ts` | Seeds an active test requirement into Supabase for quick testing. | `npx tsx scripts/development/create-test-requirement.ts` |
| `generate-app-icons.ts` | Generates Android and iOS app icons, splash screens, and favicons from source logo. | `npx tsx scripts/development/generate-app-icons.ts` |

---

## 4. Maintenance & Cleanup (`scripts/maintenance/`)

Database maintenance and hygiene scripts.

| Script | Purpose | Execution |
|--------|---------|-----------|
| `audit_database_for_cleanup.mjs` | Audits test records and identifies orphaned data safely before cleanup. | `node scripts/maintenance/audit_database_for_cleanup.mjs` |
| `check_admin_users.mjs` | Verifies admin user integrity and role permissions. | `node scripts/maintenance/check_admin_users.mjs` |
| `execute_full_cleanup.mjs` | Creates pre-cleanup snapshot in `archive/backups/database/` and resets test records. | `node scripts/maintenance/execute_full_cleanup.mjs` |
| `verify_clean_state_workflow.mjs` | Validates system readiness after database reset or migration run. | `node scripts/maintenance/verify_clean_state_workflow.mjs` |
