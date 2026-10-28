# THE TRUCKX (NECL) — Bugs & Fixes Tracker

**Document ID:** `QA-AUDIT-BUGS-008`  
**Evaluation Scope:** All Defects Discovered, Root Cause Analysis, Fixes Applied, Regression Evidence  
**Evaluation Date:** October 28, 2026  
**Auditor:** Antigravity Advanced Agentic Quality Engineering  

---

## 1. Defect Tracker Summary

During the comprehensive audit, 6 defects were identified across UI modal rendering, database constraints, workflow assumptions, and test scripts. All 6 defects were systematically analyzed, corrected, and verified against automated regression suites.

| Defect ID | Severity | Module / Surface | Summary | Status |
| :---: | :---: | :--- | :--- | :---: |
| **BUG-001** | **High (UI/UX)** | Admin Fleet Directory | Vehicle verification and action modals rendered stacked below table instead of centered popup modal | **RESOLVED & VERIFIED** |
| **BUG-002** | **High (DB)** | Quotations Module | Quotation insert failed: `vehicle_id` NOT NULL constraint violation | **RESOLVED & VERIFIED** |
| **BUG-003** | **High (DB)** | Quotations Module | Quotation insert failed: `driver_id` NOT NULL constraint violation | **RESOLVED & VERIFIED** |
| **BUG-004** | **Medium (DB)** | Driver Registration | Driver insert violated check constraint `drivers_status_check` (`ACTIVE` not permitted) | **RESOLVED & VERIFIED** |
| **BUG-005** | **Medium (Script)** | E2E Master Workflow | Script crashed on clean database when querying empty `vehicles` and `drivers` tables | **RESOLVED & VERIFIED** |
| **BUG-006** | **Low (Script)** | Verification Probe | Static probe registration plate caused unique key collision on aborted test runs | **RESOLVED & VERIFIED** |

---

## 2. Detailed Bug Reports & Resolution Evidence

### BUG-001: Vehicle Verification Modals Rendering Below Table
- **Discovered On:** Shared Vehicle Master Directory (`apps/admin/src/components/fleet/SharedVehicleMasterDirectory.tsx`).
- **Symptom:** When clicking "Verify Vehicle", "Reject Vehicle", or "Driver Profile", modal content appeared below the table rather than as an overlay dialog, elongating the viewport and breaking the user journey.
- **Root Cause:** Missing fixed overlay CSS rules and viewport centering in `index.css`. The backdrop was positioned relatively inside the table scroll wrapper.
- **Fix Applied:**
  1. Updated `apps/admin/src/index.css` with `.vdir-modal-backdrop` (`position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(11, 25, 44, 0.6); backdrop-filter: blur(4px);`).
  2. Styled `.vdir-modal-card` with THE TRUCKX theme (`background: #FFFFFF; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);`).
  3. Ensured action buttons use `#0B192C` navy and `#F05A22` brand orange.
- **Verification Evidence:**
  - Vitest: 33/33 tests passed in `SharedVehicleMasterDirectory.bug2-preservation.test.tsx` and `SharedVehicleMasterDirectory.redesign.test.tsx`.
  - Production build: `✓ built in 38.23s` without CSS or layout errors.

---

### BUG-002: `vehicle_id` NOT NULL Constraint Violation on Quotation Submission
- **Discovered On:** `vendor_quotations` database table.
- **Symptom:** `null value in column "vehicle_id" of relation "vendor_quotations" violates not-null constraint`.
- **Root Cause:** Database schema mandates that every quotation must specify which physical vehicle from the transporter's fleet is allocated. Sourcing scripts attempted to quote without a vehicle ID.
- **Fix Applied:** Updated the quotation workflow to enroll a verified vehicle in the `vehicles` table and link it to `vendor_quotations.vehicle_id`.
- **Verification Evidence:** Clean state probe `scripts/maintenance/verify_clean_state_workflow.mjs` successfully inserted quotations with associated vehicles.

---

### BUG-003: `driver_id` NOT NULL Constraint Violation on Quotation Submission
- **Discovered On:** `vendor_quotations` database table.
- **Symptom:** `null value in column "driver_id" of relation "vendor_quotations" violates not-null constraint`.
- **Root Cause:** Schema also mandates that every vendor quotation allocate an active commercial driver.
- **Fix Applied:** Added probe driver registration with verified DL number, linking `vendor_quotations.driver_id` to the driver record.
- **Verification Evidence:** Probe script Stage 5c executed cleanly with zero constraint violations.

---

### BUG-004: Driver Status Check Constraint Violation (`drivers_status_check`)
- **Discovered On:** `drivers` database table.
- **Symptom:** `new row for relation "drivers" violates check constraint "drivers_status_check"`.
- **Root Cause:** The probe script passed `status: 'ACTIVE'`. However, migration `20261004000002_fix_status_enums.sql` enforces:
  ```sql
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'))
  ```
  `ACTIVE` is not a valid enum value for `drivers.status` (operational drivers are designated `APPROVED` with `is_active: true`).
- **Fix Applied:** Changed driver payload in `verify_clean_state_workflow.mjs` and related scripts to `status: 'APPROVED'`.
- **Verification Evidence:** Driver created with ID `1417feeb-2364-472f-b4d2-ecd2e9b9e1a3` and confirmed in database.

---

### BUG-005: E2E Workflow Script Failure on Clean Database State
- **Discovered On:** `scripts/validation/verify-master-e2e-workflow.js`.
- **Symptom:** `TypeError: Cannot read properties of undefined (reading 'id')` at Stage 4.
- **Root Cause:** The script queried `vehicles` and `drivers` assuming legacy test rows would be present. Following the authorized database cleanup, the tables were empty.
- **Fix Applied:** Added self-healing fallback logic to check if `approvedVehicles` or `approvedDrivers` are empty, and if so, dynamically create two approved test vehicles (`AS-01-E2E-...`) and two approved drivers before quoting.
- **Verification Evidence:** `verify-master-e2e-workflow.js` passed all 12 stages with exit code 0.

---

### BUG-006: Unique Key Collision on Aborted Test Runs
- **Discovered On:** `vehicles` database table.
- **Symptom:** `duplicate key value violates unique constraint "vehicles_registration_number_key"`.
- **Root Cause:** Using hardcoded registration plate `AS-01-PROBE-9999` caused collision if a prior test crashed before reaching the `finally` cleanup block.
- **Fix Applied:**
  1. Added pre-cleanup logic at the start of the probe script to remove any stale probe rows before inserting.
  2. Appended dynamic millisecond timestamps to registration numbers (`AS-01-PRB-${Date.now().toString().slice(-4)}`).
- **Verification Evidence:** Re-runs execute cleanly with 100% idempotency.
