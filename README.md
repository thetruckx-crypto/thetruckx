# NECL B2B Logistics Management Platform

**Enterprise Logistics Operations & Brokerage Ecosystem for North Eastern Carriers Logistics (NECL)**

[![Architecture](https://img.shields.io/badge/architecture-modular--monorepo-orange)]()
[![Admin](https://img.shields.io/badge/admin-react--18%20%7C%20vite--6-blue)]()
[![Mobile](https://img.shields.io/badge/mobile-expo--51%20%7C%20rn--0.74-black)]()
[![Backend](https://img.shields.io/badge/backend-express%20%7C%20prisma-green)]()
[![Database](https://img.shields.io/badge/database-supabase--postgres-emerald)]()

---

## 📖 Table of Contents

- [Overview](#overview)
- [System Architecture & Applications](#system-architecture--applications)
- [Complete Business Workflow](#complete-business-workflow)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Quick Start & Development](#quick-start--development)
- [Scripts & Quality Assurance](#scripts--quality-assurance)
- [Database & Migrations](#database--migrations)
- [Architecture Documentation](#architecture-documentation)

---

## 🎯 Overview

NECL is an end-to-end B2B transport brokerage and operations management platform tailored for the logistics landscape of Northeast India. It connects enterprise clients with verified transporters (vendors) and commercial pilots (drivers) under the strict supervision of NECL administrators.

### Core Ecosystem Pillars

1. **NECL Admin Operations Panel** (`apps/admin`): Complete administrative suite for operations managers, brokerage teams, and super administrators to manage clients, RFQ dispatches, vendor quotation comparisons, vehicle verification, tracking, and financial clearance.
2. **NECL Universal Mobile Application** (`apps/mobile`): Multi-role application serving:
   * **B2B Clients**: Onboarding, KYC, posting freight requirements, comparing quotations, confirming bookings, live GPS tracking, and viewing stamped Proof of Delivery (POD).
   * **Transport Vendors**: 11-step transporter onboarding, fleet and driver management, regional hub route coverage, receiving RFQs, submitting quotations, and trip oversight.
   * **Commercial Drivers**: Single-screen onboarding, license validity auditing, route instructions, consignor gate loading verification, in-transit milestone updates, and physical POD camera upload.
3. **NECL Backend API Service** (`server`): Express server handling persistent user registries, custom JWT tokens, RBAC permission matrices, multi-channel notification dispatchers, and OTP services.
4. **Supabase PostgreSQL Database** (`database`): 21 production tables, Row-Level Security (RLS) policies, database triggers, storage buckets, and 16 sequential migrations.

---

## 🔄 Complete Business Workflow

The platform executes the complete, verified 16-step logistics lifecycle:

```text
Client Company Registration & KYC
        ↓
Client Requirement Submission (Route, Cargo Category, Quantity, Unit)
        ↓
NECL Admin Review & Verification
        ↓
Requirement Distribution to Vendors (RFQ Batching & Regional Hub Matching)
        ↓
Vendor Acceptance & Quotation Submission
        ↓
Admin Quotation Comparison & Margin Evaluation
        ↓
Client-Specific Quotation Dispatch
        ↓
Client Acceptance & Booking Confirmation
        ↓
Vendor Fleet Assignment (Verified Vehicle & Licensed Driver Allocation)
        ↓
Consignor Gate Arrival & Loading Checkpoint
        ↓
In-Transit Real-Time GPS Tracking & Checkpoints
        ↓
Consignee Gate Arrival & Unloading Checkpoint
        ↓
Physical Consignee Stamped Weight Bill / POD Capture
        ↓
Admin Document Clearance & Weighbridge Tolerance Verification
        ↓
Freight Invoicing, Vendor Payout & Financial Settlement
        ↓
Booking Final Closure & Archive
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Admin Panel** | React 18.3, Vite 6.1, TypeScript 5.7, React Router 7.18, Lucide React, Supabase JS 2.117, Vitest 5.0 |
| **Mobile App** | React Native 0.74, Expo 51, TypeScript 5.3, Lucide React Native, AsyncStorage, Expo Camera/ImagePicker |
| **Backend API** | Node.js, Express 4.21, TypeScript 5.7, Prisma 5.22, Supabase JS, JWT, CORS, tsx |
| **Database** | PostgreSQL 15 (Supabase), Row-Level Security (RLS), Supabase Storage, Supabase Realtime |
| **Testing** | Vitest, fast-check (Property-Based Testing), tsx execution suites |

---

## 📁 Repository Structure

```text
NECL/
├── apps/
│   ├── admin/                    # React 18 + Vite 6 Web Admin Panel
│   │   ├── src/
│   │   │   ├── components/       # 19 domain-organized feature modules
│   │   │   ├── config/           # Branding & theme tokens
│   │   │   ├── context/          # Auth & Toast context providers
│   │   │   ├── services/         # API query services
│   │   │   └── utils/            # Helper utilities & Supabase client
│   │   └── package.json
│   │
│   └── mobile/                   # Expo 51 + React Native Universal Mobile App
│       ├── src/
│       │   ├── components/       # Cross-screen UI widgets & navigation
│       │   ├── screens/          # 72 screens categorized by domain
│       │   │   ├── index.ts      # Domain barrel exports
│       │   │   └── README.md     # Screen directory map
│       │   ├── services/         # Client, vendor, driver, auth services
│       │   └── types.ts          # Shared domain contracts
│       ├── App.tsx               # State machine, auth check & role navigation
│       └── package.json
│
├── server/                       # Express + Prisma Backend API Service
│   ├── src/
│   │   ├── services/             # IdGenerator, Notifications, Permissions, OTP
│   │   └── index.ts              # API routes & user registries
│   ├── prisma/schema.prisma      # Prisma schema definition
│   └── package.json
│
├── database/                     # Supabase Database Schemas & Migrations
│   ├── migrations/               # 16 sequential versioned SQL migrations
│   ├── schemas/                  # Entity relationship reference
│   ├── seeds/                    # Development seed data (`dev_sample_data.sql`)
│   └── config/                   # Connection templates
│
├── scripts/                      # Centralized Utility & Test Automation
│   ├── database/                 # Administrative SQL setup scripts
│   ├── validation/               # Master E2E tests, workflow audits, OTP tests
│   ├── development/              # Test requirement creators & icon tools
│   ├── maintenance/              # Pre-cleanup snapshots & database audits
│   └── README.md                 # Scripts documentation
│
├── archive/                      # Historical Backups & Superseded Artifacts
│   ├── build-artifacts/          # Historical distribution ZIP packages
│   ├── legacy-assets/            # Superseded uncompressed artwork
│   └── backups/database/         # Pre-cleanup database state snapshots
│
├── docs/                         # Platform Architectural Documentation
│   └── architecture/             # Structural specifications & maintenance guides
│
├── .gitignore                    # Git exclusions
├── package.json                  # Root development & test runner commands
└── README.md                     # Platform documentation
```

---

## 🚀 Quick Start & Development

### 1. Prerequisites
* Node.js >= 18.0.0
* npm >= 9.0.0
* Supabase Account or Local Supabase CLI

### 2. Install Dependencies
```bash
# Install root tooling
npm install

# Install admin dependencies
npm --prefix apps/admin install

# Install mobile dependencies
npm --prefix apps/mobile install

# Install backend server dependencies
npm --prefix server install
```

### 3. Launch Development Servers

You can launch each application individually from the root directory:

```bash
# Start NECL Admin Panel (default port: 5174)
npm run dev:admin

# Start NECL Mobile App (Expo Metro bundler)
npm run dev:mobile

# Start NECL Backend Server (default port: 3001)
npm run dev:server
```

---

## 🧪 Scripts & Quality Assurance

The repository includes convenient root scripts for testing and end-to-end validation:

```bash
# Run Admin Vitest test suites
npm run test:admin

# Check Mobile TypeScript compilation (0 errors)
npm run test:mobile:types

# Build server for production verification
npm run test:server

# Build admin for production deployment
npm run build:admin

# Execute Master End-to-End Workflow verification
npm run script:e2e

# Run Complete Workflow Database Audit
npm run script:audit

# Generate responsive app icons
npm run script:icons
```

---

## 🗄️ Database & Migrations

All schema definitions and table modifications are maintained in `database/migrations/`:

* `20261004000001_create_admin_users.sql`: Admin accounts, RBAC, and base operational schema.
* `20261004000002_fix_status_enums.sql`: Status enumerations for requirements, RFQs, and bookings.
* `20261004000003_production_rls_policies.sql`: Production Row-Level Security policies.
* `20261004000004_vehicle_verification_system.sql`: Shared vehicle master directory & tie-up verification.
* `20261004000005_auth_otp_system.sql`: OTP authentication tables and triggers.
* `20261005000006_mobile_app_access_and_rls.sql`: Mobile app role-based permissions and access policies.
* `20261013000007_client_registration_kyc_approval_flow.sql`: Client onboarding and instant KYC verification.
* `20261015000008_database_and_storage_healing.sql`: Storage bucket policies and document links.
* `20261015000009_necl_unique_id_and_client_registration_healing.sql`: Standardized NECL ID generators.
* `20261016000010_driver_registration_single_screen.sql`: Single-screen driver registration and license auditing.
* `20261016000011_create_regional_hubs.sql`: Northeast regional hub master dataset.
* `20261017000012_vendor_transporter_compliance_and_operating_locations.sql`: Vendor compliance & route coverage.
* `20261018000013_add_extended_cargo_and_vehicle_fields.sql`: Dimensional cargo units and fleet strength.
* `20261019000014_enable_supabase_realtime_for_client_app.sql`: Supabase Realtime publication setup.
* `20261019000015_add_quantity_unit_and_vendor_quote_fields.sql`: Vendor quotation rate & unit fields.
* `20261019000016_create_admin_registration_drafts.sql`: Administrative registration drafts system.

---

## 📚 Architecture Documentation

Detailed architectural specifications and guides are available in `docs/architecture/`:

* [`PROJECT_STRUCTURE.md`](./docs/architecture/PROJECT_STRUCTURE.md): Detailed component layout and rules for placing new code.
* [`PROJECT_FILE_INVENTORY.md`](./docs/architecture/PROJECT_FILE_INVENTORY.md): Comprehensive inventory of all files, ownership, and responsibilities.
* [`FOLDER_REORGANIZATION_PLAN.md`](./docs/architecture/FOLDER_REORGANIZATION_PLAN.md): Record of structural transitions, mappings, and validations.
* [`ARCHITECTURE_DECISIONS.md`](./docs/architecture/ARCHITECTURE_DECISIONS.md): Architectural Decision Records (ADRs) explaining core design decisions.
* [`STRUCTURE_MAINTENANCE_GUIDE.md`](./docs/architecture/STRUCTURE_MAINTENANCE_GUIDE.md): Developer rules for maintaining structural cleanliness in future features.
