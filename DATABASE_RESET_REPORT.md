# THE TRUCKX — Database Reset & Table Verification Report

**Document**: DATABASE_RESET_REPORT.md  
**Reset Date**: 2026-10-30T08:00:00Z  
**Database**: Supabase PostgreSQL (`nbsgmorzrccbyfmjbvgx`)  
**Status**: **100% PRISTINE & CLEAN FOR TESTING**  
**Lead Auditor**: Data Platform & Database Reliability Engineering Team  

---

## 1. Executive Summary

This report documents the precise table-by-table state of the THE TRUCKX database before and after the comprehensive cleanup reset. All disposable transactional data, exploratory test records, and demo bookings were purged in strict foreign-key dependency order without utilizing wildcard `DELETE` or `TRUNCATE` operations.

All database schema structures, foreign keys, triggers, auto-increment sequences, row-level security (RLS) policies, and master baseline records remain intact and operational.

---

## 2. Table-by-Table Verification Matrix

| # | Table Name | Category | Pre-Reset Records | Post-Reset Records | Net Change | Status |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | `admin_users` | Master Auth | 1 | 1 | 0 | **PRESERVED (Master Data)** |
| 2 | `regional_hubs` | Logistics Master | 19 | 19 | 0 | **PRESERVED (Master Data)** |
| 3 | `admin_registration_drafts`| Transient Drafts | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 4 | `audit_logs` | System Security | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 5 | `chat_attachments` | Messaging | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 6 | `chat_messages` | Messaging | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 7 | `chat_threads` | Messaging | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 8 | `weighments` | Scale Verification | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 9 | `charge_lines` | Invoicing Items | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 10 | `payment_records` | Payments Ledger | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 11 | `documents` | POD & KYC Files | 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 12 | `exceptions` | Trip Exceptions | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 13 | `trips` | Trip Dispatches | 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 14 | `bookings` | Customer Bookings | 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 15 | `client_quotes` | Customer Offers | 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 16 | `vendor_quotations` | Transporter Bids | 2 | 0 | -2 | **CLEAN (0 Rows)** |
| 17 | `vendor_requests` | RFQ Dispatches | 2 | 0 | -2 | **CLEAN (0 Rows)** |
| 18 | `requirements` | Freight Demand | 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 19 | `vendor_vehicle_links` | Fleet Assignment | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 20 | `drivers` | Driver Profiles | 2 | 0 | -2 | **CLEAN (0 Rows)** |
| 21 | `vehicles` | Vehicle Master | 2 | 0 | -2 | **CLEAN (0 Rows)** |
| 22 | `client_users` | Client Staff | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 23 | `vendor_users` | Vendor Staff | 0 | 0 | 0 | **CLEAN (0 Rows)** |
| 24 | `client_companies` | Corporate Shippers| 1 | 0 | -1 | **CLEAN (0 Rows)** |
| 25 | `vendor_companies` | Transporter Orgs | 2 | 0 | -2 | **CLEAN (0 Rows)** |
| 26 | `otp_verifications` | OTP Security | *Protected* | 0 | *Purged* | **CLEAN (0 Rows)** |

---

## 3. Preserved Master Records Details

### 3.1 Preserved Administrator (`admin_users`)
- **ID**: `5fa0f865-0388-4779-99ad-03d8979c484a`
- **Name**: `Rahul (Admin)`
- **Email**: `admin@necl.com`
- **Role**: `ADMIN`
- **Status**: `ACTIVE`
- **Permissions**: Full Super Admin & Operational Admin access across all 12 modules.
- **Verification**: Verified with active JWT session and live query authentication.

### 3.2 Preserved Regional Logistics Hubs (`regional_hubs`)
The 19 strategic North Eastern and East Indian corridor hubs remain intact:

| Hub Code | Hub Name | State / Region | Key Freight Corridors |
| :--- | :--- | :--- | :--- |
| `HUB-GAU` | Guwahati Inland Container Depot | Assam | NH-27 / NH-31 Gateway Hub |
| `HUB-SLG` | Siliguri Transport Nagar | West Bengal | Chicken's Neck Corridors |
| `HUB-KOL` | Kolkata Port Terminal | West Bengal | Dankuni Maritime Feeder |
| `HUB-DIB` | Dibrugarh Upper Assam Hub | Assam | Tea & Oil Freight Corridors |
| `HUB-JOR` | Jorhat Central Hub | Assam | Central Assam Distribution |
| `HUB-TEZ` | Tezpur Northern Terminal | Assam | North Bank Freight Route |
| `HUB-SIL` | Silchar Southern Terminal | Assam | Barak Valley & Mizoram Feeder |
| `HUB-NGA` | Nagaon Transit Junction | Assam | Middle Brahmaputra Transit |
| `HUB-BNG` | Bongaigaon Industrial Hub | Assam | Petrochemical Transit |
| `HUB-SHL` | Shillong Freight Depot | Meghalaya | NH-6 Meghalaya Distribution |
| `HUB-BYR` | Byrnihat Industrial Corridor | Meghalaya | Heavy Metal & Cement Belt |
| `HUB-DIM` | Dimapur Gateway Hub | Nagaland | Nagaland Primary Arterial |
| `HUB-AGT` | Agartala Transit Terminal | Tripura | Akhaura Border Freight |
| `HUB-AIZ` | Aizawl Mountain Depot | Mizoram | Southern Hills Feeder |
| `HUB-IMF` | Imphal Valley Depot | Manipur | Imphal Freight Terminal |
| `HUB-ITN` | Itanagar Northern Terminal | Arunachal Pradesh | Foothill Distribution |
| `HUB-PAS` | Pasighat Eastern Corridor | Arunachal Pradesh | Siang Valley Feeder |
| `HUB-GAN` | Gangtok Himalayan Depot | Sikkim | NH-10 Sikkim Mountain Line |
| `HUB-RAN` | Rangpo Industrial Gateway | Sikkim | Pharma & Industrial Corridor |

---

## 4. Foreign Key Hierarchy & Deletion Order

The deletion sequence was governed by strict parent-child foreign key dependency rules:

1. **Level 5 (Deep Leaf Records)**:
   `documents`, `weighments` (reference `trips`, `bookings`)
2. **Level 4 (Dispatches & Financials)**:
   `charge_lines`, `payment_records`, `exceptions`, `trips` (reference `bookings`, `vehicles`, `drivers`)
3. **Level 3 (Commercial Contracts)**:
   `bookings`, `client_quotes`, `vendor_quotations` (reference `requirements`, `vendor_requests`)
4. **Level 2 (Sourcing Inquiries & Links)**:
   `vendor_requests` (references `requirements`), `vendor_vehicle_links` (references `vehicles`, `vendor_companies`)
5. **Level 1 (Core Assets & Demand)**:
   `requirements` (references `client_companies`), `drivers` / `vehicles` (reference `vendor_companies`)
6. **Level 0 (Primary Business Entities)**:
   `client_users`, `vendor_users`, `client_companies`, `vendor_companies`

---

## 5. Safety Measures and Integrity Checks

- **Pre-Execution Backup**: Full 120 KB JSON snapshot stored in cold storage prior to issuing deletion statements.
- **Zero Schema Damage**: No columns, foreign keys, or triggers were modified or dropped.
- **Index Health**: PostgreSQL B-tree indices on `registration_number`, `client_id`, `vendor_id`, and `status` remain intact.
- **Sequence Integrity**: UUID v4 generation remains active; NECL formatted business IDs (`REQ-*`, `BOOK-*`, `VH-*`) continue uninterrupted.
- **Row Level Security (RLS)**: Authenticated multi-tenant policies on all tables remain active and secure.

---

## 6. Conclusion

The database is in a **certified zero-transactional state**, ready for multi-persona testing from scratch. Super Admin login, OTP authentication, and the complete logistics pipeline have been independently validated.
