# THE TRUCKX — Database Reset Report

## 1. Executive Summary

This report documents the exact state of all database tables in the Supabase PostgreSQL database before and after the full platform clean reset. The reset removed all test data, demonstration workflows, and operational transactions while preserving the foundational master data, security schema, triggers, and Row Level Security (RLS) policies.

---

## 2. Table-by-Table Record Metrics

| Table Name | Pre-Reset Count | Post-Reset Count | Preserved Justification | Foreign Key Constraint Handling |
|---|---|---|---|---|
| `admin_users` | 1 | 1 | Master Admin Account (`admin@necl.com`) | Preserved root admin; no parent FK |
| `regional_hubs` | 19 | 19 | Master NE Logistics Corridors | Preserved master geographic lookup; no parent FK |
| `client_companies` | 5 | 0 | Test clients cleared for clean testing | Deleted after all child requirements and quotes |
| `vendor_companies` | 6 | 0 | Test vendors cleared for clean testing | Deleted after all child requests and quotations |
| `client_users` | 0 | 0 | Cleared | Deleted after client company linkage |
| `vendor_users` | 0 | 0 | Cleared | Deleted after vendor company linkage |
| `vehicles` | 6 | 0 | Test lorries cleared for fresh enrollment | Deleted after trips and vehicle links |
| `drivers` | 4 | 0 | Test drivers cleared for fresh onboarding | Deleted after trips and vehicle assignments |
| `vendor_vehicle_links` | 0 | 0 | Cleared | Deleted prior to vehicle/vendor deletions |
| `requirements` | 5 | 0 | Test freight requests cleared | Deleted after bookings and quotes |
| `vendor_requests` | 8 | 0 | Sourcing RFQs cleared | Deleted after vendor quotations |
| `vendor_quotations` | 8 | 0 | Bids cleared | Deleted prior to vendor requests |
| `client_quotes` | 5 | 0 | Margin proposals cleared | Deleted prior to requirements |
| `bookings` | 4 | 0 | Confirmed bookings cleared | Deleted prior to requirements |
| `trips` | 4 | 0 | Operational tracking trips cleared | Deleted prior to bookings |
| `documents` | 4 | 0 | Test PODs, RCs, DLs cleared | Deleted prior to trips and entities |
| `weighments` | 0 | 0 | Scale slips cleared | Deleted prior to trips |
| `charge_lines` | 0 | 0 | Invoice items cleared | Deleted prior to bookings |
| `payment_records` | 0 | 0 | Settlement records cleared | Deleted prior to bookings |
| `exceptions` | 0 | 0 | Escalation logs cleared | Deleted prior to trips |
| `audit_logs` | 0 | 0 | Historical test logs cleared | Preserved table structure |
| `chat_threads` | 0 | 0 | Operational communication threads cleared | Deleted prior to bookings |
| `chat_messages` | 0 | 0 | Operational chat messages cleared | Deleted prior to threads |
| `chat_attachments` | 0 | 0 | Realtime attachments cleared | Deleted prior to messages |
| `admin_registration_drafts`| 0 | 0 | Temporary onboarding drafts cleared | Cleared draft table |

---

## 3. Preserved Master Records

### 3.1 Administrator Accounts (`admin_users`)
The primary system administrator account was preserved with complete permissions:

- **ID**: `5fa0f865-0388-4779-99ad-03d8979c484a`
- **Full Name**: Rahul (Admin)
- **Email**: `admin@necl.com`
- **Role**: `ADMIN` (Super Admin privileges)
- **Active Status**: `true`
- **Hub Scope**: Enterprise Master (All Corridors)
- **Role Permissions**: Full CRUD access across Clients, Vendors, Fleet, Sourcing, Quotations, Bookings, Trips, Accounting, and Master Settings.

### 3.2 Regional Logistics Hubs (`regional_hubs`)
All 19 predefined strategic freight corridors across the North Eastern Region and Eastern Gateway hubs were preserved:

1. **Guwahati Central Hub** (Beltola / ISBT, Assam)
2. **Dibrugarh Industrial Gateway** (Assam)
3. **Silchar Logistics Depot** (Cachar, Assam)
4. **Jorhat Freight Terminal** (Assam)
5. **Tezpur Crossing** (Sonitpur, Assam)
6. **Bongaigaon Transshipment Hub** (Assam)
7. **Tinsukia Commercial Corridor** (Assam)
8. **Shillong Hub** (Mawlai, Meghalaya)
9. **Byrnihat Industrial Corridor** (Meghalaya)
10. **Agartala International Depot** (Tripura)
11. **Dharmanagar Freight Depot** (Tripura)
12. **Aizawl Cargo Terminal** (Mizoram)
13. **Dimapur Railhead Depot** (Nagaland)
14. **Kohima Freight Hub** (Nagaland)
15. **Imphal Transshipment Hub** (Manipur)
16. **Itanagar Gateway Hub** (Arunachal Pradesh)
17. **Pasighat Freight Terminal** (Arunachal Pradesh)
18. **Gangtok Cargo Depot** (Sikkim)
19. **Siliguri Eastern Gateway Corridor** (Transport Nagar, West Bengal)

---

## 4. Database Schema Integrity Verification

Post-cleanup audits confirmed that all structural database components remain 100% operational:

1. **Foreign Key Integrity**: All cascade rules and constraints executed cleanly without orphaned records.
2. **Trigger Handlers**:
   - `on_auth_user_created`: Automatically creates associated user profile on OTP signup.
   - `sync_requirement_status`: Updates requirement status upon quotation acceptance or booking creation.
   - `update_timestamp`: Automatically stamps `updated_at` on modified rows.
3. **Row Level Security (RLS)**:
   - Client isolation policies active: Clients can only access their own requirements, quotes, and bookings.
   - Vendor isolation policies active: Vendors can only access dispatched RFQs, their own quotes, vehicles, and assigned trips.
   - Admin bypass policies active: System administrators possess full visibility across all regional tenants.
4. **Unique Indexes**:
   - Mobile number uniqueness verified across `client_users` and `vendor_users`.
   - Vehicle registration number uniqueness verified across `vehicles`.
   - Driving licence number uniqueness verified across `drivers`.

---

## 5. Certification

The database is in a **100% clean, verified, and pristine testing state**. All schema structures, foreign key constraints, indexes, triggers, and administrative credentials remain fully active.
