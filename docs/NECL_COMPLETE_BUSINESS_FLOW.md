# NECL — Complete End-to-End Business Flow & Lifecycle Architecture

**Project**: North Eastern Carriers Logistics (NECL) Platform  
**Document Title**: Complete End-to-End Business Workflow & Lifecycle Specifications  
**Document Version**: 1.0.0  
**Audit Date**: October 23, 2026  
**Auditor**: Senior Product Manager, Business Analyst, Solution Architect, QA Engineer  
**Classification**: Authoritative Operational Workflow Baseline  

---

## 1. Executive Workflow Architecture

The NECL platform orchestrates a high-trust, closed-loop B2B logistics marketplace and execution engine. Unlike retail on-demand delivery apps, freight transportation in the Northeast corridor involves multi-ton consignments, national permit regulations, commercial vehicle tie-ups, commercial credit, tare/gross weighbridge verification, and formal Proof of Delivery (POD) documentation.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                NECL END-TO-END BUSINESS LIFECYCLE                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                   │
  STAGE 1: REGISTRATION & ONBOARDING               ▼
  [Client, Transporter Vendor, Driver] ──────► [Admin Review & Compliance Audit] ──► [Account Active]
                                                   │
  STAGE 2-3: LOAD REQUIREMENT POSTING              ▼
  [Client Submits 5-Step Load Spec] ─────────► [Admin Review & Sourcing Approval] ──► [Status: SOURCING]
                                                   │
  STAGE 4-6: SOURCING & COMPETITIVE QUOTING        ▼
  [Admin Dispatches RFQ to Vendors] ─────────► [Transporters Submit Rate & Fleet] ──► [Admin Compares Quotes]
                                                   │
  STAGE 7-8: CLIENT QUOTE & BOOKING                ▼
  [Admin Adds Margin + 18% GST] ─────────────► [Client Reviews & Accepts] ───────► [Booking Confirmed]
  (Vendor price confidential!)                     │
                                                   │
  STAGE 9: RESOURCE ALLOCATION                     ▼
  [Awarded Vendor Assigns Vehicle & Driver] ──► [Admin Validates Compliance] ────► [Trip Created]
                                                   │
  STAGE 10: LOADING & DUAL WEIGHBILL               ▼
  [Driver Gate-In & Loading] ────────────────► [Dual Weighbill: Client & Driver] ─► [Weight Delta Check]
                                                   │
  STAGE 11-12: TRANSIT & UNLOADING                 ▼
  [Checkpoint Milestone Progression] ────────► [Consignee Arrival & Gate Check] ─► [Cargo Unloaded]
                                                   │
  STAGE 13-14: DOCUMENT CLEARANCE & CLOSURE        ▼
  [Driver Uploads Physical Stamped POD] ─────► [Admin Consignee Stamp Audit] ───► [Trip & Order Closed]
                                                                                       │
                                                                                       ▼
                                                                                 [Invoicing & Payout]
```

---

## 2. Detailed Step-by-Step Business Flow

### Stage 1: Client Registration & Verification

1. **Trigger**: An enterprise shipper initiates onboarding via the Client Mobile Application (`ClientProfileSetupScreen.tsx`).
2. **Step 1 (Basic Identity)**: Client provides mobile number, primary contact name, and corporate email. OTP is verified via `authService.sendOtp()` and `verifyOtp()`.
3. **Step 2 (Business Details)**: Client enters enterprise name, legal constitution (Private Ltd, Public Ltd, Partnership, Proprietorship), PAN, GSTIN, registered office address, and 6-digit PIN code. Automatic state resolution is performed via `pincodeService`.
4. **Step 3 (Document Upload)**: Client uploads mandatory compliance certificates:
   - Certificate of Incorporation / Business Registration.
   - GST Registration Certificate.
   - Company PAN Card.
5. **Step 4 (Pre-Submission Review)**: Pre-submission verification card confirms all fields.
6. **Step 5 (Submission & State Transition)**:
   - `clientService.submitCompleteRegistration()` creates record in `client_companies` with status `PENDING_APPROVAL` and generates unique Client ID (`CLI-XXXXXX`).
   - Unsubmitted local draft is cleared (`clearRegistrationDraft()`).
   - Client is redirected to `RegistrationStatusScreen.tsx`.
7. **Administrative Review (Admin Web Panel)**:
   - Operations Officer inspects submission in `ClientDirectory.tsx`.
   - Officer reviews uploaded documents in `DocumentPreviewModal.tsx`.
   - Actions:
     - **Approve**: Status updates to `APPROVED` / `ACTIVE`. Admin name and timestamp recorded in `approved_by` and `approved_at`. Supabase Realtime event pushes update to Client Mobile App, which automatically transitions to `ClientDashboardScreen.tsx`.
     - **Request Corrections**: Admin inputs specific field corrections and reason. Status updates to `CORRECTIONS_REQUESTED`. Client app displays notification and opens correction workflow.
     - **Reject**: Status updates to `REJECTED` with reason recorded. Account access is blocked.

---

### Stage 2: Client Requirement Submission (Load Posting)

1. **Trigger**: Active Client clicks "Post New Requirement" from `ClientDashboardScreen.tsx`.
2. **Step 1 (Vehicle & Schedule Preferences)**:
   - Required vehicle type (e.g., 32 FT Multi-Axle Container, 20 FT Open, Taurus 16 Ton).
   - Quantity of lorries needed.
   - Preferred loading date and time window.
   - Target budget per trip (optional).
   - Handling preferences (e.g., Side-loading, Crane required, Tarpaulin mandatory).
3. **Step 2 (Cargo & Material Specifications)**:
   - Material category (FMCG, Industrial Machinery, Tea/Agriculture, Steel, Chemicals, etc.).
   - Total cargo weight in Metric Tons (MT).
   - Number of units / package count.
   - Packaging mode (Wooden Pallets, Cartons, Drums, Loose).
   - Hazardous materials flag and transit insurance requirements.
4. **Step 3 (Pickup & Delivery Routing)**:
   - Origin address, city, state, PIN code, and onsite loading contact (name + phone).
   - Destination address, city, state, PIN code, and consignee unloading contact (name + phone).
   - Special gate instructions.
5. **Step 4 (Review & Validation)**:
   - Client verifies lane, vehicle specs, and cargo weight.
6. **Step 5 (Database Persistence & Confirmation)**:
   - `clientService.createTransportRequirement()` generates canonical ID `REQ-YYYYMMDD-XXXX` via database sequence.
   - Requirement inserted into `requirements` table with status `NEW_REQUIREMENT`.
   - Admin operations queue receives real-time notification.

---

### Stage 3: Admin Requirement Review & Sourcing Approval

1. **Admin Verification**: Operations administrator opens `RequirementsModule.tsx` in the Admin Panel.
2. **Feasibility Check**:
   - Lane feasibility (Northeast hill terrain, bridge weight restrictions, monsoon road alerts).
   - Vehicle availability in the origin hub (e.g., Guwahati, Siliguri, Jorhat).
   - Rate reasonability against benchmark market pricing in `PricingModule.tsx`.
3. **Status Transition**:
   - Requirement status updates from `NEW_REQUIREMENT` to `UNDER_REVIEW` or `SOURCING`.
   - If information is ambiguous, admin requests clarification from the client via in-app chat (`chat_threads`).

---

### Stage 4: Requirement Distribution to Transporters (RFQ Dispatch)

1. **Vendor Selection**: Admin filters registered and approved vendors in `RequirementsModule.tsx` based on:
   - Route coverage / Operating hubs matching origin and destination.
   - Fleet strength and vehicle type suitability.
   - Transporter compliance rating.
2. **Dispatch Action**:
   - Admin selects 1 to N eligible transporters and clicks "Send RFQ".
   - System creates records in `vendor_requests` table with:
     - `requirement_id`: Foreign key to `requirements`.
     - `vendor_id`: Foreign key to `vendor_companies`.
     - `deadline_at`: Bidding window expiration (e.g., 4 to 24 hours).
     - `status`: `PENDING`.
3. **Notification**: Dispatched transporters receive push notification: *"New Load Available: [Origin] to [Destination] - [Vehicle Type]"*.

---

### Stage 5: Transporter Quotation Submission

1. **Vendor Review**: Transporter logs into Vendor Mobile App and opens `VendorRequirementsScreen.tsx`.
2. **Evaluation**: Transporter reviews pickup date, material type, weight, and delivery lane.
3. **Bid Preparation (`VendorSubmitQuotationScreen.tsx`)**:
   - Quotation pricing structure: Fixed trip rate OR Rate per Metric Ton (MT).
   - Proposed vehicle registration from transporter's registered fleet.
   - Proposed driver from transporter's registered driver roster.
   - Estimated transit turnaround in days.
   - Commercial remarks / detention terms.
4. **Submission**:
   - `vendorService.submitQuotation()` generates canonical quotation ID `VQ-XXXXXX` and inserts into `vendor_quotations`.
   - Transporter bid is locked (`is_locked: true`).
   - Admin receives notification of submitted quote.

---

### Stage 6: Admin Quotation Comparison & Carrier Selection

1. **Admin Comparison View**: Admin opens `QuotationsModule.tsx`.
2. **Multi-Vendor Matrix**:
   - Table displays all competing bids side-by-side for the target `REQ-YYYYMMDD-XXXX`.
   - Metrics compared: Quoted Base Rate, Rate per MT, Fleet Vehicle RC status, Driver verification status, Transporter historical on-time score, Transit days.
3. **Selection**:
   - Admin selects the optimal transporter quotation.
   - System preserves all losing vendor quotations in the database for audit and market price analytics.

---

### Stage 7: Client Quotation Creation & Margin Confidentiality

1. **Commercial Markup (`QuotationsModule.tsx`)**:
   - Admin selects winning vendor bid (`vendorBaseCost`).
   - Admin inputs authorized NECL operating margin (`adminMargin`).
   - System automatically calculates 18% Goods and Services Tax (`gstAmount = (vendorBaseCost + adminMargin) * 0.18`).
   - System computes total client-facing amount: `totalClientAmount = vendorBaseCost + adminMargin + gstAmount`.
2. **Quotation Generation**:
   - System inserts record into `client_quotes` table with status `SENT`.
   - Expiration timestamp set (`validityExpiresAt`, typically 24-48 hours).
3. **Confidentiality Enforcement**:
   - The Client Mobile Application queries `client_quotes` via `clientService.fetchClientQuotations()`.
   - Database RLS and API filters ensure that `vendor_base_cost` and `admin_margin` are NEVER serialized to the client application.
   - Client views only: Total Base Freight, GST Amount, Total Payable, Transit Timeline, and Commercial Terms.

---

### Stage 8: Client Acceptance & Confirmed Booking Generation

1. **Client Action**: Client reviews quotation in `QuotationDetailsScreen.tsx`.
2. **Decisions**:
   - **Accept & Confirm Booking**:
     - Client clicks "Accept Quotation & Confirm Booking".
     - System executes atomic transaction:
       1. `client_quotes.status` updates to `ACCEPTED`.
       2. Creates booking in `bookings` table with canonical ID `BOOK-YYYYMMDD-XXXX`.
       3. Updates `requirements.status` to `BOOKED`.
       4. Updates winning `vendor_requests.status` to `AWARDED`.
       5. Updates non-selected `vendor_requests` to `CLOSED`.
   - **Reject Quotation**: Client enters rejection reason; quote marked `REJECTED`; admin notified to renegotiate or re-source.

---

### Stage 9: Vehicle & Driver Allocation

1. **Transporter Notification**: Winning transporter receives notification in Vendor Mobile App: *"Booking Confirmed: [BOOK-ID]. Please allocate vehicle and driver."*
2. **Allocation Screen (`VendorAssignVehicleScreen.tsx` & `VendorAssignDriverScreen.tsx`)**:
   - Transporter selects verified vehicle from registered fleet (`vehicles`).
   - Transporter selects verified driver from registered roster (`drivers`).
3. **Trip Generation**:
   - `vendorService.assignVehicleAndDriver()` creates operational trip in `trips` table with:
     - `booking_id`: Foreign key to `bookings`.
     - `vehicle_id`: Foreign key to `vehicles`.
     - `driver_id`: Foreign key to `drivers`.
     - `trip_status`: `LORRY_ASSIGNED`.
4. **Notifications**:
   - Driver receives trip assignment alert on Driver Mobile App (`DriverAssignedTripsScreen.tsx`).
   - Client receives vehicle registration number and driver contact on Client Mobile App.
   - Admin monitors allocation in `BookingsModule.tsx`.

---

### Stage 10: Loading Operations & Dual Weighbill Capture

1. **Gate-In**: Driver arrives at shipper pickup warehouse and taps "Confirm Gate In" (`DriverPickupConfirmationScreen.tsx`).
2. **Loading**: Material loaded into container / lorry.
3. **Dual Weighbill Submission (High-Integrity Control)**:
   - **Driver Action**: Driver drives lorry onto factory weighbridge, captures gross and tare weight, photographs physical weighbridge scale ticket, and uploads via `DriverLoadingWeighbill`.
   - **Client Action**: Client dispatch supervisor uploads factory loading tax invoice and official dispatch weighbill via `ShipmentDocumentsScreen.tsx`.
   - **Vendor Backup**: If driver has connectivity failure or feature difficulty, Transporter can upload weighbill on driver's behalf (`uploadWeighbillOnBehalfOfDriver()`).
4. **Discrepancy Calculation (`documentWorkflowService.ts`)**:
   - System calculates: `weightDeltaMt = Math.abs(clientWeightMt - driverWeightMt)`.
   - If `weightDeltaMt <= 0.2 MT`: Status marked `CONFIRMED_BY_BOTH`.
   - If `weightDeltaMt > 0.2 MT`: System flags `WEIGHT_MISMATCH` alert to Admin Operations and halts auto-clearance.
5. **Loading Complete**: Trip status transitions to `LOADED`.

---

### Stage 11: In-Transit Execution & Milestone Progression

1. **Trip Launch**: Driver taps "Start Trip" → `trips.trip_status` updates to `IN_TRANSIT` with `started_at` timestamp recorded.
2. **Milestone Progression (`DriverTripProgressScreen.tsx`)**:
   - Driver logs checkpoints along the Northeast highway network:
     - Checkpoint 1: Exited Factory Gate / Origin Hub.
     - Checkpoint 2: State Border Checkpost Clearance (Assam/Meghalaya/Nagaland/Tripura/Manipur).
     - Checkpoint 3: Highway Halt / Fuel Checkpoint.
     - Checkpoint 4: Destination City Ring Road Entry.
3. **Delay & Exception Reporting (`ExceptionsModule.tsx`)**:
   - In event of breakdown, road landslide, or permit delay, driver or transporter logs exception with photo and notes.
   - Admin and client receive instant exception alerts.

---

### Stage 12: Consignee Arrival & Unloading Operations

1. **Arrival**: Driver reaches consignee delivery location and taps "Confirm Destination Arrival" (`DriverDeliveryConfirmationScreen.tsx`). Trip status updates to `ARRIVED_DESTINATION`.
2. **Gate-In & Inspection**: Warehouse consignee verifies lorry seals, container locks, and outward packaging.
3. **Unloading**: Material unloaded. Unloading weighbridge ticket recorded if destination weighment is contracted.
4. **Unloading Complete**: Driver taps "Confirm Unloading Complete" → Status updates to `UNLOADED`.

---

### Stage 13: Proof of Delivery (POD) & Document Verification

1. **Physical Stamped POD Capture (`DriverPodUploadScreen.tsx`)**:
   - Driver presents physical Lorry Receipt (LR) / Consignment Note to consignee.
   - Consignee stamps official company seal, writes received quantity, date, and signs.
   - Driver photographs physical stamped document using mobile camera.
2. **Upload & Storage**:
   - Uploaded to Supabase Storage `documents` bucket under `pod/` folder.
   - Inserts record into `documents` table with `document_type = 'POD'`, `verification_status = 'PENDING'`.
3. **Admin Compliance Clearance (`PODModule.tsx` & `DocumentClearanceModule.tsx`)**:
   - Operations officer inspects POD image:
     - Verifies consignee company stamp is legible.
     - Verifies received package count matches dispatched count.
     - Checks for shortage, damage, or leakage endorsements.
   - Officer toggles `consignee_stamp_verified: true` and clicks "Verify & Approve POD".
   - Document status updates to `VERIFIED`.

---

### Stage 14: Trip & Booking Closure, Invoicing & Settlement

1. **Closure Gate Conditions**: A booking is eligible for formal closure ONLY when:
   - Trip status is `UNLOADED`.
   - Dual loading weighbills are verified (no unresolved weight mismatch).
   - Consignee stamped POD is approved by Admin (`consignee_stamp_verified = true`).
   - No unresolved exceptions exist on the trip.
2. **Order Closure**:
   - Admin clicks "Close Order" in `BookingsModule.tsx`.
   - `trips.trip_status` updates to `COMPLETED` with `completed_at` timestamp.
   - `bookings.booking_status` updates to `COMPLETED`.
3. **Financial Records & Invoicing**:
   - Final charge lines compiled in `charge_lines` (base freight + authorized detention / toll adjustments).
   - Invoicing record generated in `payment_records`.
   - Client invoice generated and made available in Client App.
   - Transporter payout processed according to contracted settlement terms.

---

## 3. Cross-Application Interaction & Data Flow Matrix

| Action Event | Triggering App / Actor | API / Service Layer | Database Table Affected | Real-Time Notification & Recipient |
| :--- | :--- | :--- | :--- | :--- |
| **Client Registration** | Client Mobile App | `clientService.submitCompleteRegistration()` | `client_companies`, `client_users` | Admin Panel receives new KYC alert |
| **Client Approved** | NECL Admin Panel | `/api/client/admin-review` / Supabase update | `client_companies.status = 'APPROVED'` | Client Mobile App redirects to Dashboard |
| **Post Requirement** | Client Mobile App | `clientService.createTransportRequirement()` | `requirements` (`status = 'NEW_REQUIREMENT'`) | Admin Dashboard counter increments |
| **Dispatch RFQ** | NECL Admin Panel | `/api/requirements/assign-vendors` | `vendor_requests` (`status = 'PENDING'`) | Push notification to selected Vendors |
| **Submit Quote** | Vendor Mobile App | `vendorService.submitQuotation()` | `vendor_quotations` (`is_locked = true`) | Admin Quotations table updates in real time |
| **Send Client Quote** | NECL Admin Panel | `/api/quotations/create-client-quote` | `client_quotes` (`status = 'SENT'`) | Client App receives quote alert |
| **Accept Quote** | Client Mobile App | `clientService.acceptQuotationAndBook()` | `client_quotes`, `bookings`, `requirements` | Vendor receives Awarded Booking alert |
| **Assign Fleet** | Vendor Mobile App | `vendorService.assignVehicleAndDriver()` | `trips` (`trip_status = 'LORRY_ASSIGNED'`) | Driver receives Trip Assignment alert |
| **Upload Weighbill** | Driver Mobile App | `driverService.uploadLoadingWeighbill()` | `weighments`, `documents` | Dual comparison engine triggers in Admin |
| **Upload POD** | Driver Mobile App | `driverService.uploadPodAndCompleteTrip()` | `documents` (`document_type = 'POD'`) | Admin POD Queue displays new receipt |
| **Approve POD** | NECL Admin Panel | `documentWorkflowService.verifyDocument()` | `documents`, `bookings.status = 'COMPLETED'` | Client & Vendor receive closure confirmation |
