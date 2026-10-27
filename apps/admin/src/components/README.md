# NECL Admin Panel Components Architecture

This directory houses all user interface modules, dialogs, directories, and data visualizers for the NECL Admin Panel.

---

## Directory Organization & Domain Responsibilities

All components are strictly organized into 19 feature folders matching the core logistics business domains:

```text
components/
├── bookings/          # Shipment booking confirmations, allocation reviews & cancellations
│   ├── BookingsModule.tsx
│   └── BookingsModule.redesign.test.tsx
│
├── clients/           # B2B client enterprise directory, KYC approvals & profiles
│   ├── ClientDirectory.tsx
│   ├── ClientProfile.tsx
│   ├── CreateClient.tsx
│   ├── EditClientModal.tsx
│   └── integration tests...
│
├── common/            # Reusable UI primitives across admin modules
│   ├── DocumentPreviewModal.tsx
│   ├── Skeleton.tsx
│   └── ToastContainer.tsx
│
├── communications/    # Internal operational messaging & urgent broadcast notices
│   └── CommunicationsModule.tsx
│
├── documents/         # Gate clearances, transit permits, e-way bills & compliance checks
│   ├── DocumentClearanceModule.tsx
│   └── DocumentClearanceModule.test.tsx
│
├── drivers/           # Commercial driver verification, DL validity checks & audit logs
│   ├── DriverLicenceAudit.tsx
│   └── DriverVerificationQueue.tsx
│
├── exceptions/        # Transit incidents, route delays, breakdowns & resolution workflows
│   ├── ExceptionsModule.tsx
│   └── ExceptionDetailView.tsx
│
├── fleet/             # Shared vehicle master directory, vehicle verification & tie-ups
│   ├── SharedVehicleMasterDirectory.tsx
│   ├── CreateSharedVehicle.tsx
│   ├── VehicleVerificationScreen.tsx
│   └── VendorVehicleTieupApproval.tsx
│
├── payments/          # Client invoicing, vendor payouts, freight audits & transactions
│   ├── PaymentsModule.tsx
│   └── PaymentHistoryView.tsx
│
├── pod/               # Proof of delivery verification and consignee receipt sign-off
│   └── PODModule.tsx
│
├── pricing/           # Contract pricing, lane rates, spot margins & base fare tables
│   ├── PricingModule.tsx
│   └── PricingModule.test.tsx
│
├── quotations/        # Multi-vendor RFQ bidding comparison & client quotation creation
│   ├── QuotationsModule.tsx
│   └── QuotationsModule.test.tsx
│
├── reports/           # Operational performance analytics, lane profitability & exports
│   └── ReportsModule.tsx
│
├── requirements/      # Inbound client transport requirements, RFQ dispatch & matching
│   ├── RequirementsModule.tsx
│   └── RequirementsModule.test.tsx
│
├── settings/          # System parameters, regional hub master & operational defaults
│   └── SettingsModule.tsx
│
├── superadmin/        # Super administrator RBAC matrix, admin user provisioning & audit trails
│   └── SuperAdminModules.tsx
│
├── tracking/          # Live vehicle GPS telemetry, milestone updates & transit timeline
│   ├── TrackingModule.tsx
│   └── TripDetailView.tsx
│
├── vendors/           # Transport vendor directory, 11-step onboarding audit & profiles
│   ├── VendorDirectory.tsx
│   ├── VendorProfile.tsx
│   ├── InviteVendor.tsx
│   ├── EditVendorModal.tsx
│   ├── VendorDocumentApprovals.tsx
│   ├── VendorVerificationRequests.tsx
│   └── compliance tests...
│
└── weighbridge/       # Tare and gross weight scale slips, tolerance checks & overloading
    └── WeighbridgeModule.tsx
```

---

## Developer Guidelines

* **Adding a New Admin Feature**: Place it inside the corresponding domain subfolder (e.g., a new invoice generator goes in `payments/`).
* **Shared UI Primitives**: Modals, loaders, or cards used by 3+ modules belong in `common/`.
* **State Management**: Domain state belongs in services (`src/services/`) or local component hooks, consumed via props or React Context.
* **Lazy Loading**: Route pages in `App.tsx` should use `React.lazy()` chunking to maintain instantaneous initial bundle loading.
