# NECL Database Schemas & Migrations Guide

## Directory Structure

```text
database/
├── migrations/       # Sequential SQL migrations executed against Supabase
├── schemas/          # Schema documentation, entity relationship references
├── seeds/            # Development/testing seed data SQL files
└── config/           # Database environment configurations and connection templates
```

## Production Tables (21 Tables)

1. **Core Access & Security**:
   - `admin_users` — System administrators and internal operators with RBAC.
   - `audit_logs` — Immutable audit trail of operational actions.

2. **Entities**:
   - `client_companies` — B2B clients booking shipments.
   - `client_users` — Client users and portal credentials.
   - `vendor_companies` — Transport providers and lorry suppliers.
   - `vendor_users` — Vendor management contacts.
   - `vehicles` — Fleet vehicles and shared master vehicles.
   - `drivers` — Vehicle pilots/drivers with license audit trails.
   - `vendor_vehicle_links` — Association between vendors and registered vehicles.

3. **Operations & Lifecycle**:
   - `requirements` — Transport requests from clients.
   - `rfq_batches` — Grouped requests for quotation dispatched to vendors.
   - `vendor_requests` — Individual RFQs sent to selected vendors.
   - `vendor_quotations` — Vendor pricing responses.
   - `client_quotations` — Pricing submitted to clients.
   - `bookings` — Confirmed shipment orders.
   - `trips` — Execution legs for shipments.
   - `trip_events` — Real-time tracking and checkpoint timeline.
   - `weighbridge_records` — Weight scale tickets and tare/gross readings.
   - `documents` — Pre-trip gate clearance, insurance, permits, and PODs.
   - `payment_records` — Client invoices and vendor payouts.
   - `exceptions` — Operational alerts, delays, and breakdowns.

## Migration Sequence

All migrations in `database/migrations/` are applied sequentially:
1. `20261004000001_create_admin_users.sql`
2. `20261004000002_fix_status_enums.sql`
3. `20261004000003_production_rls_policies.sql`
4. `20261004000004_vehicle_verification_system.sql`
5. `20261004000005_auth_otp_system.sql`
6. `20261005000006_mobile_app_access_and_rls.sql`
