# THE TRUCKX (NECL) — Database & Supabase Architecture Audit

**Document ID:** `QA-AUDIT-DB-004`  
**Database Host:** Supabase Cloud (`https://nbsgmorzrccbyfmjbvgx.supabase.co`)  
**Database Engine:** PostgreSQL 15.x  
**Evaluation Date:** October 28, 2026  
**Auditor:** Antigravity Advanced Agentic Quality Engineering  

---

## 1. Database Overview & Topology

The database supporting THE TRUCKX logistics platform is hosted on a managed Supabase PostgreSQL instance. It stores operational data spanning 24 relational tables, enforced by relational foreign keys, domain check constraints, and Row Level Security (RLS) access control.

### Current Database Table Inventory & State

| Table Name | Primary Key | Foreign Key Dependencies | Active State | Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `admin_users` | `id` (UUID) | None | **1 Row** (Master) | Administrative credentials, role assignment, permissions |
| `regional_hubs` | `id` (UUID) | None | **19 Rows** (Master) | North Eastern logistics hubs (Guwahati, Siliguri, Shillong, etc.) |
| `client_companies` | `id` (UUID) | None | Verified Clean | Shipper company entities, GSTIN, PAN, registered addresses |
| `client_users` | `id` (UUID) | `client_company_id` ➔ `client_companies(id)` | Verified Clean | Shipper user accounts, mobile numbers, roles |
| `vendor_companies` | `id` (UUID) | None | Verified Clean | Transporter corporate entities, PAN, bank details |
| `vendor_users` | `id` (UUID) | `vendor_company_id` ➔ `vendor_companies(id)` | Verified Clean | Transporter staff & fleet manager logins |
| `vehicles` | `id` (UUID) | None | Verified Clean | Lorry catalogue, RC numbers, capacity MT, fitness dates |
| `drivers` | `id` (UUID) | `primary_vendor_id` ➔ `vendor_companies(id)` | Verified Clean | Commercial drivers, DL numbers, expiry dates, verification |
| `vendor_vehicle_links`| `id` (UUID) | `vendor_id`, `vehicle_id` | Verified Clean | Association between transport companies and lorries |
| `requirements` | `id` (VARCHAR) | `client_id` ➔ `client_companies(id)` | Verified Clean | Freight requests, loading dates, cargo weight, route PINs |
| `vendor_requests` | `id` (UUID) | `requirement_id`, `vendor_id` | Verified Clean | Multi-vendor RFQ broadcast dispatches & deadlines |
| `vendor_quotations` | `id` (UUID) | `vendor_request_id`, `vehicle_id`, `driver_id` | Verified Clean | Transporter bids, assigned lorry and driver, rates |
| `client_quotes` | `id` (UUID) | `requirement_id`, `vendor_quotation_id` | Verified Clean | Admin-issued client quotes with margin & GST |
| `bookings` | `id` (VARCHAR) | `requirement_id`, `client_quote_id` | Verified Clean | Confirmed logistics bookings, payment terms, status |
| `trips` | `id` (UUID) | `booking_id`, `vehicle_id`, `driver_id` | Verified Clean | Active road trips, GPS coordinates, milestone timestamps |
| `documents` | `id` (UUID) | `reference_id` (polymorphic) | Verified Clean | Commercial docs (PAN, Cheque, RC, DL, ePOD) |
| `notifications` | `id` (UUID) | `user_id` (polymorphic) | Verified Clean | System push & in-app alerts for milestone events |
| `client_invoices` | `id` (UUID) | `booking_id`, `client_id` | Verified Clean | Formal GST commercial invoices generated for shippers |
| `transporter_payouts`| `id` (UUID) | `trip_id`, `vendor_id` | Verified Clean | Transporter settlement vouchers with TDS deductions |
| `audit_logs` | `id` (UUID) | `user_id` | Verified Clean | Immutable security and compliance event records |
| `auth_audit_log` | `id` (UUID) | None | Verified Clean | Authentication history and session lifecycle events |
| `pincode_cache` | `pincode` | None | System Cache | Offline hub resolution directory for postal codes |
| `system_settings` | `key` | None | System Config | Platform-wide operational thresholds & margin rules |
| `vehicle_gps_logs` | `id` (UUID) | `trip_id` ➔ `trips(id)` | Verified Clean | High-frequency telemetry breadcrumbs |

---

## 2. Constraints & Foreign Key Integrity

### 2.1. Critical Check Constraints
1. **`drivers_status_check`**:
   ```sql
   ALTER TABLE public.drivers 
     ADD CONSTRAINT drivers_status_check 
     CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'));
   ```
   *Audit Finding:* Attempting to insert `status: 'ACTIVE'` triggers constraint violation. Code was aligned to use `APPROVED` for verified operational drivers.

2. **`vendor_companies_status_check`**:
   ```sql
   ALTER TABLE public.vendor_companies 
     ADD CONSTRAINT vendor_companies_status_check 
     CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE'));
   ```

3. **`vendor_quotations` Foreign Key Mandates**:
   `vendor_quotations` enforces:
   - `vendor_request_id` NOT NULL REFERENCES `vendor_requests(id)`
   - `vehicle_id` NOT NULL REFERENCES `vehicles(id)`
   - `driver_id` NOT NULL REFERENCES `drivers(id)`
   *Audit Finding:* Transporters cannot submit quotations without allocating an active, verified lorry and driver from their roster. This prevents ghost fleet bids.

---

## 3. Row Level Security (RLS) & Permission Policies

### 3.1. RLS Audit Findings
1. **Protected Client Scope**: Shippers cannot query `vendor_quotations`, `transporter_payouts`, or unassigned vendor bids. Queries to `client_quotes` filter out `vendor_base_cost` and `admin_margin`.
2. **Protected Transporter Scope**: Transporters only see `vendor_requests` specifically routed to their `vendor_id`. They cannot view competing transporters' bids on the same RFQ corridor.
3. **Admin Elevated Authority**: The service role client and verified administrators (`admin@necl.com`) authenticate with full cross-table access to manage the quotation comparison matrix and execute document clearance.
4. **Rate Limiting & Connection Burst Throttling**: Direct burst requests (e.g. 50 parallel unauthenticated requests from a single client) triggered Supabase HTTP 500/timeout responses during the load benchmark. This highlights the architectural necessity of server-side connection pooling (PgBouncer) for production deployment.

---

## 4. Storage Bucket Audit

- **Current State:** 0 remote storage buckets are currently configured on the Supabase instance.
- **Current Handling:** In offline development mode, documents (RC, DL, and ePOD images) are stored as data URIs or base64 payloads within the `documents` table metadata.
- **Production Recommendation:**
  1. Initialize a dedicated Supabase Storage bucket: `necl-logistics-documents` (Private).
  2. Configure signed URL generation with 15-minute expiration for viewing sensitive tax and identity documents.
  3. Enforce client-side image compression (max 2 MB per document) prior to upload.

---

## 5. Master Reference Data Preservation

### Regional Hubs Master Data (19 Hubs Preserved)
The audit verified that all 19 strategic freight hubs across Assam, West Bengal, Meghalaya, Tripura, Nagaland, and Manipur remain intact:

```
1.  NECL-HUB-GHY-001 | Guwahati Gateway Hub (Assam) - Central Cross-Dock
2.  NECL-HUB-SLG-002 | Siliguri Junction Hub (West Bengal) - Trunk Feeder
3.  NECL-HUB-DIB-003 | Dibrugarh Upper Assam Hub (Assam)
4.  NECL-HUB-JOR-004 | Jorhat Tea Logistics Hub (Assam)
5.  NECL-HUB-SHL-005 | Shillong Khasi Hills Hub (Meghalaya)
6.  NECL-HUB-AGR-006 | Agartala Border Hub (Tripura)
7.  NECL-HUB-DIM-007 | Dimapur Gateway Hub (Nagaland)
8.  NECL-HUB-IMP-008 | Imphal Valley Logistics Hub (Manipur)
... and 11 additional corridor terminals.
```

### Admin Master Account
- Account: `Rahul (Admin) / admin@necl.com`
- User ID: `5fa7e937-23dc-45eb-92c2-75d15a31a9aa`
- Role: `SUPER_ADMIN`
- Status: `ACTIVE`
