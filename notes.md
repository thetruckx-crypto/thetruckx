# NECL — COMPLETE PROJECT AUDIT & COMPREHENSIVE PRODUCT REQUIREMENTS DOCUMENT

## 1. ROLE AND OBJECTIVE

Act as a Senior Product Manager, Business Analyst, Solution Architect, QA Engineer, Database Architect, UI/UX Auditor, and Technical Documentation Specialist.

Conduct a complete, evidence-based audit of the existing NECL (North Eastern Carriers Logistics) project.

The project includes:

* NECL Admin Panel
* Client Mobile Application
* Vendor Mobile Application
* Driver Mobile Application
* Super Admin controls and configuration
* Backend services and APIs
* Database schemas, migrations, relationships, and constraints
* Authentication and authorization
* Document uploads and verification
* Requirement management and vendor quotations
* Client quotations and booking management
* Vehicle and driver assignment
* Trip execution and tracking
* Weight bills and document verification
* Notifications and status updates
* Financial transactions, invoices, and related records, wherever implemented or required

**The primary objective is to understand everything that has happened in the project so far, establish the actual current implementation status, audit the complete business flow, identify every missing requirement, and produce a comprehensive PRD describing the complete system.**

Do not assume that a feature works merely because its screen exists.

Do not assume that a database table, API, button, or form is functional until its implementation and connections have been verified.

This phase is an **audit and documentation phase**. Do not begin large-scale implementation, redesign, deletion, or refactoring until the audit and PRD are completed.

---

# 2. PHASE 1 — UNDERSTAND THE COMPLETE PROJECT

Before making any changes, inspect the entire repository.

## 2.1 Project Structure Audit

Identify and document:

* All applications and their entry points.
* Frontend frameworks and versions.
* Mobile application frameworks and configurations.
* Backend frameworks and services.
* Database technology and schema.
* Authentication providers and session management.
* API routes and service layers.
* Database migrations and seed scripts.
* State management and caching mechanisms.
* File and document storage.
* Notification infrastructure.
* External integrations.
* Environment configuration.
* Build, development, deployment, and testing scripts.
* Shared components, utilities, and libraries.

Create an architecture inventory that identifies each component, its purpose, its dependencies, and its current status.

For each important feature, trace the complete connection:

UI → Form or Action → Validation → API or Service → Database or External Service → Response → UI Update.

Where relevant, also trace:

Database Change → Backend Event or Trigger → Notification → Recipient Application → Updated Status.

Identify broken connections, missing implementations, duplicate logic, disconnected components, and unhandled errors.

## 2.2 Review Existing Project Documentation

Inspect all relevant existing documentation, including:

* Previous PRDs.
* Business flow documents.
* Implementation plans.
* Testing reports.
* Bug reports.
* Migration documentation.
* API specifications.
* Architecture notes.
* Existing TODO and FIXME comments.
* Recent project changes and available Git history.

Review existing Git history where available to understand significant changes and identify potentially unfinished work.

Use repository evidence to reconstruct the project's development progress.

Do not invent historical events or claim that a feature was implemented on a particular date unless supporting evidence exists.

Distinguish between:

1. Requirements explicitly provided by the business.
2. Features currently implemented in code.
3. Features that appear partially implemented.
4. Features that are planned but not implemented.
5. Historical changes that can be verified.
6. New recommendations proposed by the auditor.

---

# 3. PHASE 2 — COMPLETE ROLE-BASED SYSTEM AUDIT

Audit every application and user role independently.

## 3.1 Super Admin

Audit the following areas where implemented or required:

* Super Admin authentication.
* Administrator account management.
* Role and permission management.
* Admin account activation and deactivation.
* Access to operational dashboards.
* Configuration and feature toggles.
* Client, vendor, and driver management.
* Approval workflows and exceptional overrides.
* Operational settings.
* Audit logs.
* System health and error visibility.
* Global business settings.
* Security-sensitive administrative operations.

Identify which permissions belong exclusively to Super Admin and which may be delegated to ordinary administrators.

Do not assume that hiding a menu item provides sufficient authorization.

Verify backend enforcement of permissions.

## 3.2 NECL Admin Panel

Audit every existing module, screen, table, form, action, and workflow.

Include:

* Dashboard and KPIs.
* Client Directory.
* Client Registration Review.
* Client Requirements.
* Requirement Details.
* Requirement Assignment to Vendors.
* Vendor Directory.
* Vendor Registration Review.
* Vendor Quotations.
* Quotation Comparison.
* Client Quotation Creation.
* Client Quotation History.
* Booking Management.
* Booking Confirmation.
* Vehicle Assignment.
* Driver Assignment.
* Loading Management.
* Transit Monitoring.
* Unloading Management.
* Weight Bill Management.
* Document Verification.
* Trip Closure.
* Notifications.
* Reports.
* Settings.
* Administrative permissions.
* Audit history.

For each module, document:

1. Business purpose.
2. Current screens and routes.
3. Available actions.
4. Required input fields.
5. Validation rules.
6. API connections.
7. Database tables and relationships.
8. Role permissions.
9. Status transitions.
10. Notifications.
11. Error handling.
12. Current implementation status.
13. Missing functionality.
14. Test scenarios.

Do not add modules merely because they appear in this list. Verify whether they already exist and whether the business requires them.

## 3.3 Client Mobile Application

Audit the complete client journey, including:

* Account creation.
* Login and authentication.
* Client profile.
* Company information.
* Business verification.
* Registration status.
* Pickup location and delivery location.
* Requirement submission.
* Cargo and service details.
* Supporting document uploads.
* Requirement submission confirmation.
* Requirement tracking.
* Admin clarification requests.
* Registration corrections.
* Vendor quotation processing, where applicable.
* Client quotation receipt.
* Quotation review.
* Quotation acceptance or rejection.
* Booking confirmation.
* Booking details.
* Vehicle and driver information.
* Loading updates.
* Transit updates.
* Unloading updates.
* Weight bill uploads or visibility, as appropriate.
* Booking completion.
* Notifications.
* Support and issue reporting.

Verify each screen's navigation, form validation, persistence, API integration, and status synchronization.

A registration form must not remain accessible as though the registration were incomplete after successful submission if the intended workflow requires a verification-status screen.

Once approved, the client should enter the appropriate dashboard.

If corrections are required, clearly show the administrator's reason and the specific fields requiring correction.

Do not allow unsubmitted draft data to persist if the intended registration workflow explicitly requires fresh forms when users leave midway.

Verify these behaviors against the actual implementation and existing business requirements.

## 3.4 Vendor Mobile Application

Audit:

* Account creation and login.
* Vendor registration.
* Business details.
* Contact information.
* Address and PIN code.
* State and regional hub detection.
* Route coverage.
* Fleet strength.
* Service offerings.
* Supporting documents.
* Registration submission.
* Admin verification.
* Approval and rejection.
* Correction requests.
* Vendor dashboard.
* Assigned requirements.
* Requirement acceptance or rejection.
* Vendor quotation creation.
* Quotation submission.
* Quotation revisions, if supported.
* Booking acceptance.
* Vehicle assignment.
* Driver assignment.
* Loading coordination.
* Transit coordination.
* Unloading confirmation.
* Weight bill handling.
* Document submission.
* Trip completion.
* Notifications and history.

Apply the following existing business requirements when auditing the implementation:

* State detection should be based on the vendor's PIN code when reliable data and services are available.
* Regional hub selection should support search.
* Fleet strength should support the intended manual-entry workflow.
* The service offerings should include Full Truck and ODC & Heavy Project Cargo where applicable.
* Vendor registration should be reviewed by an authorized administrator.
* Approved vendors should proceed to their dashboard.
* Registration corrections must be explicitly communicated.
* Vendor email fields should not be required in account-creation screens if the approved requirements specify their removal.

Check these requirements against the current code and report any discrepancies.

## 3.5 Driver Mobile Application

Audit the complete driver journey:

* Driver account creation.
* Driver name and phone number.
* Date of birth.
* Driving licence upload, front and back.
* Aadhaar upload, front and back.
* Camera and local-file upload.
* Image preview and validation.
* Vendor association.
* Driver verification and approval.
* Driver profile.
* Assigned trips.
* Booking and cargo information.
* Assigned vehicle.
* Pickup location.
* Loading status.
* Transit status.
* Delivery location.
* Unloading status.
* Weight bill upload.
* Supporting documents.
* Trip completion.
* Notifications.
* Driver trip history.

Check that drivers are associated with the correct vendor and that unauthorized users cannot access other drivers' information.

Verify whether GPS or live-location functionality is implemented, required, or merely planned.

Do not claim live tracking works unless the implementation has been verified.

---

# 4. PHASE 3 — AUDIT THE COMPLETE END-TO-END BUSINESS FLOW

The central business workflow must be documented from initial registration through final trip closure.

Audit the following sequence against the actual system.

## Stage 1: Client Registration

1. Client creates an account.
2. Client provides company and contact details.
3. Client submits required business information and documents.
4. The system validates the submission.
5. The registration status becomes Pending Review.
6. Admin reviews the registration.
7. Admin approves, rejects, or requests corrections according to the approved business rules.
8. The client receives the appropriate status update.
9. An approved client can access the authorized application features.

Document all possible states, transitions, failure scenarios, and permissions.

## Stage 2: Client Requirement Submission

1. Client submits a logistics requirement.
2. The client enters pickup and delivery details.
3. The client provides cargo information.
4. The client provides required vehicle or service preferences.
5. The client attaches supporting documents where necessary.
6. The system validates the requirement.
7. A unique requirement ID is generated.
8. The requirement is saved to the database.
9. Admin can view the submitted requirement.
10. The client can track its status.

Define required fields, optional fields, validation rules, and status transitions.

## Stage 3: Admin Requirement Review

1. Admin opens the requirement.
2. Admin reviews its details and supporting documents.
3. Admin checks for incomplete or inconsistent information.
4. Admin requests clarification where needed.
5. Admin updates the requirement's review status.
6. The client receives relevant updates.
7. The requirement becomes eligible for vendor sourcing once the applicable business conditions are satisfied.

Determine whether the current implementation supports all these actions.

## Stage 4: Requirement Distribution to Vendors

1. Admin selects one or more eligible vendors.
2. Admin reviews vendor service offerings and route coverage.
3. The system records which vendors received the requirement.
4. Each vendor receives an appropriate notification.
5. Each vendor can view the requirement details they are authorized to access.
6. Each vendor can accept or reject the opportunity.
7. The system records each vendor's response independently.
8. Admin can track response status and outstanding responses.

Ensure that distributing one requirement to multiple vendors does not create duplicate or conflicting requirement records.

Define how duplicate distribution, expired opportunities, vendor rejection, and no-response scenarios should work.

## Stage 5: Vendor Quotation Submission

1. An eligible vendor accepts the requirement or enters the quotation workflow as permitted by the business rules.
2. The vendor reviews the transport details.
3. The vendor prepares a quotation.
4. The quotation includes the required pricing components and commercial terms.
5. The system validates the quotation.
6. The quotation is saved with a unique quotation ID.
7. Admin can review the quotation.
8. The vendor can view its submission status.
9. Quotation revisions, if supported, must preserve the appropriate history.

Determine whether quotation submission requires explicit acceptance of the requirement first. Document the final rule rather than assuming it.

## Stage 6: Admin Quotation Comparison

1. Admin views all relevant vendor responses.
2. Admin compares eligible vendor quotations.
3. Admin evaluates price, vehicle availability, service suitability, route coverage, delivery timing, and other configured criteria.
4. Admin identifies a suitable vendor quotation or sourcing option.
5. The system preserves the original vendor quotation.
6. Admin records the selection and its rationale where required.

Do not assume that the cheapest quotation must always win.

Ensure that comparisons use the correct requirement and that unrelated quotations cannot be mixed.

## Stage 7: Client Quotation Creation

1. Admin prepares a separate quotation for the client.
2. Admin selects the relevant sourcing option.
3. Admin enters the client-facing price and applicable commercial terms.
4. Admin can apply authorized price adjustments or margins.
5. The system validates the client quotation.
6. The quotation is saved independently from the vendor's quotation.
7. The client quotation is sent to the client.
8. The client can review the quotation.
9. The system records acceptance or rejection.

Important controls:

* Preserve the original vendor quotation.
* Keep vendor pricing and client-facing pricing logically separate.
* Restrict margin and price-editing permissions.
* Record quotation versions and changes where required.
* Prevent unauthorized access to internal vendor pricing.
* Define quotation expiry and revision rules.

## Stage 8: Client Acceptance and Booking Confirmation

1. Client accepts or rejects the quotation.
2. The system records the decision and timestamp.
3. An accepted quotation becomes eligible for booking confirmation.
4. The system creates or confirms the booking according to the approved workflow.
5. A unique booking ID is generated.
6. Relevant users receive notifications.
7. Admin, client, and selected vendor can view the correct booking status.

Define duplicate-acceptance protection, quotation expiry, cancellation rules, and the handling of concurrent updates.

## Stage 9: Vehicle and Driver Assignment

1. Vendor identifies an eligible vehicle.
2. Vendor assigns the vehicle to the confirmed booking.
3. Vendor assigns a registered driver.
4. The system validates the vehicle and driver associations.
5. Admin can review the assignment according to the permission model.
6. Client receives the appropriate vehicle and driver details.
7. Driver receives the assigned trip.
8. The system records assignment history.

Define whether vehicle and driver assignments require approval and what happens when an assignment changes.

## Stage 10: Loading

1. Driver reaches the pickup location.
2. The applicable arrival status is recorded.
3. Loading begins.
4. Loading progress is updated.
5. Required loading documents or evidence are uploaded where applicable.
6. Loading completion is recorded.
7. Authorized users receive updates.

Identify required timestamps, documents, status transitions, and validation rules.

## Stage 11: Transit

1. The trip enters the appropriate in-transit state.
2. Driver and vendor can view the active trip.
3. Admin can monitor trip progress.
4. Client can view authorized status updates.
5. Relevant notifications are generated.
6. Delays, exceptions, and trip problems can be recorded where supported.

Clearly distinguish ordinary status tracking from actual GPS-based live tracking.

## Stage 12: Unloading and Delivery

1. Driver reaches the delivery location.
2. Arrival is recorded.
3. Unloading begins.
4. Required unloading evidence or documents are uploaded.
5. Unloading completion is recorded.
6. The system captures the required delivery details.
7. Relevant users receive notifications.

Define how incomplete deliveries, delivery disputes, shortages, and failed deliveries should be handled.

## Stage 13: Weight Bills and Document Verification

1. The driver or another authorized party uploads the applicable weight bill.
2. The client uploads or provides any required corresponding documentation.
3. The system associates each document with the correct booking.
4. Admin reviews the submitted documents.
5. Admin verifies, rejects, or requests corrections.
6. The system records verification status and review history.
7. Relevant users receive updates.
8. The booking remains open while mandatory documents or verifications are outstanding, unless an explicitly approved exception applies.

Document file validation, access control, duplicate uploads, replacement versions, missing documents, and audit requirements.

## Stage 14: Trip and Booking Closure

1. The system verifies the required delivery and document conditions.
2. Outstanding mandatory tasks are identified.
3. Authorized users resolve outstanding issues.
4. Admin confirms completion where required.
5. The booking is closed according to the approved rules.
6. The final trip status becomes visible to authorized users.
7. The system preserves all relevant records and timestamps.
8. Reports and dashboard counts reflect the final status.

Define the distinction between trip completion, document verification, booking closure, and any later financial reconciliation.

Do not mark a booking complete solely because the driver has reached the destination.

---

# 5. PHASE 4 — DATABASE, API, AND INTEGRATION AUDIT

## 5.1 Database

Inspect the actual database schema, migrations, constraints, indexes, and relationships.

Identify:

* Tables and their purposes.
* Primary and foreign keys.
* Missing relationships.
* Duplicate or redundant tables.
* Inconsistent naming.
* Missing required columns.
* Nullable fields that should be required.
* Missing constraints.
* Inconsistent status values.
* Orphaned records.
* Duplicate records.
* Incorrect ownership relationships.
* Missing timestamps.
* Incomplete migration history.
* Unsafe or conflicting migrations.
* Seeded or mock records that affect operational data.

Pay special attention to the relationships between:

* Clients.
* Client requirements.
* Requirement distribution records.
* Vendors.
* Vendor responses.
* Vendor quotations.
* Client quotations.
* Bookings.
* Vehicles.
* Drivers.
* Vehicle and driver assignments.
* Trips.
* Loading records.
* Unloading records.
* Weight bills.
* Documents.
* Notifications.
* Users and roles.
* Audit logs.

Do not assume all these entities require separate tables. Determine the appropriate design from the existing schema and business rules.

## 5.2 API and Service Layer

For every critical workflow, verify:

* API endpoint or server action.
* Request validation.
* Authentication.
* Authorization.
* Database operation.
* Response structure.
* Error handling.
* Duplicate-submission protection.
* Transaction boundaries.
* Status-transition validation.
* Notification behavior.
* UI refresh and cache invalidation.

Identify UI components that use hardcoded values, mock arrays, placeholder responses, or simulated success messages instead of real backend operations.

## 5.3 Storage and Documents

Audit:

* Storage buckets.
* File paths.
* Upload permissions.
* File size and type validation.
* Signed URL handling where applicable.
* Access restrictions.
* Document ownership.
* Preview functionality.
* Replacement and deletion rules.
* Failed-upload handling.

Sensitive documents must not be publicly accessible without appropriate authorization.

## 5.4 Authentication and Security

Verify:

* Login and registration.
* Session persistence.
* Logout behavior.
* Role-based access control.
* Route protection.
* Backend authorization.
* Row-level security where supported.
* Password recovery.
* OTP handling, if implemented.
* Access to company, vendor, driver, and booking records.
* Protection against unauthorized status changes.
* Sensitive information exposure.

Never expose credentials, API secrets, private keys, access tokens, or personal identity documents in the generated PRD.

---

# 6. PHASE 5 — UI/UX AND NAVIGATION AUDIT

Review the actual screens and navigation across the Admin Panel and all mobile applications.

Audit:

* Screen-to-screen navigation.
* Missing routes.
* Broken buttons.
* Nonfunctional actions.
* Incomplete forms.
* Incorrect field labels.
* Missing required-field indicators.
* Incorrect table columns.
* Missing search and filtering.
* Pagination behavior.
* Incorrect sorting.
* Responsive layouts.
* Logo sizing and alignment.
* Empty states.
* Loading states.
* Error states.
* Success feedback.
* Modal and dropdown behavior.
* Document previews.
* Status badges.
* Confirmation dialogs.
* Mobile keyboard behavior.
* Accessibility and readability.

Pay particular attention to previously reported problems:

1. Registration Step 3 does not open after Step 2.
2. The Continue to Pickup & Delivery button does not navigate correctly.
3. Registration steps remain visible after successful submission.
4. Admin approval does not consistently redirect users to the appropriate dashboard.
5. Vendor ID and vendor name appear in incorrect positions.
6. The admin panel lacks the required client and requirement details in certain tables.
7. Action menus must display the relevant document or action.
8. Tables should avoid unnecessary vertical scrolling when the intended design calls for horizontal scrolling.
9. Unwanted sticky or blue interface elements should be identified and traced to their actual cause.
10. Registration status changes must be reflected in the correct application.

Verify each issue against the current project before classifying it as resolved or unresolved.

---

# 7. PHASE 6 — REAL DATA AND OPERATIONAL RELIABILITY

The production workflow must not depend on fake operational data.

Audit every dashboard, table, counter, list, chart, and status indicator.

Verify that:

* Dashboard counts come from real database queries.
* Newly created records appear in the correct lists.
* Updates appear in all relevant applications.
* Deleted or deactivated records are handled correctly.
* Pending and completed counts use consistent status definitions.
* Search and filters operate on actual records.
* Pagination returns the correct records.
* Failed requests display errors instead of false success messages.
* Cache invalidation and data refresh work correctly.
* Authorization rules do not silently hide legitimate records.
* Mock data is not accidentally included in production workflows.

Do not classify a feature as functional merely because it displays sample information.

If a development seed script is required, document its purpose and ensure it cannot silently populate production with fake business transactions.

---

# 8. PHASE 7 — STATUS LIFECYCLE AND BUSINESS RULES

Create a centralized status lifecycle for each major business entity.

At minimum, examine:

* Client registration.
* Vendor registration.
* Driver verification.
* Client requirement.
* Vendor requirement response.
* Vendor quotation.
* Client quotation.
* Booking.
* Vehicle assignment.
* Driver assignment.
* Loading.
* Transit.
* Unloading.
* Weight bill verification.
* Trip completion.
* Booking closure.

For each entity, define:

| Attribute               | Required Definition                    |
| ----------------------- | -------------------------------------- |
| Status                  | Exact status value                     |
| Meaning                 | What the status represents             |
| Allowed previous status | Valid starting states                  |
| Allowed next status     | Valid transitions                      |
| Trigger                 | User action or system event            |
| Authorized role         | Who may perform the action             |
| Validation              | Required conditions                    |
| Database update         | Records that must change               |
| Notification            | Users who must be notified             |
| Error handling          | What happens when the transition fails |
| Audit history           | Information that must be recorded      |

Avoid duplicate or contradictory statuses across the Admin Panel and mobile applications.

Identify any business rules that remain undecided and document them as open decisions rather than inventing final rules.

---

# 9. PHASE 8 — COMPREHENSIVE GAP ANALYSIS

Create a detailed list of all identified issues.

Classify each issue into one of these categories:

* Missing Feature.
* Partially Implemented Feature.
* Broken Functionality.
* UI/UX Defect.
* Database Defect.
* API Integration Defect.
* Security Risk.
* Data Integrity Risk.
* Notification Defect.
* Performance Issue.
* Testing Gap.
* Documentation Gap.
* Business Rule Ambiguity.
* Technical Debt.
* Verified Working Feature.

Assign each issue:

* Unique issue ID.
* Module.
* Application.
* Description.
* Evidence from the code or test results.
* Expected behavior.
* Actual behavior.
* Business impact.
* Technical impact.
* Priority.
* Dependencies.
* Recommended solution.
* Acceptance criteria.

Use the following priority definitions:

**P0 — Critical:** Security vulnerabilities, severe data corruption, or fundamental blockers that make the system unsafe or unusable.

**P1 — High:** Critical business workflows are broken or cannot be completed.

**P2 — Medium:** Important functionality is incomplete, unreliable, or significantly inconvenient.

**P3 — Low:** Cosmetic issues, minor usability improvements, and lower-impact technical debt.

Do not assign priorities based on appearance alone. Consider operational impact and business risk.

---

# 10. PHASE 9 — GENERATE THE COMPLETE PRD

Create a comprehensive Product Requirements Document based on verified project evidence and explicit business requirements.

The PRD must include the following sections.

## Section 1: Document Control

* Project name.
* Document title.
* Version.
* Audit date.
* Scope.
* Intended audience.
* Status of the document.
* Assumptions and limitations.

## Section 2: Executive Summary

* What NECL does.
* The business problem it solves.
* The intended users.
* The current project status.
* The most important findings.
* The major implementation risks.

## Section 3: Product Vision and Objectives

* Product vision.
* Business objectives.
* Operational objectives.
* User experience objectives.
* Reliability and security objectives.
* Success metrics.

## Section 4: Scope

* Included applications.
* Included features.
* Excluded features.
* Existing functionality.
* Planned functionality.
* Out-of-scope integrations.

## Section 5: User Roles and Permissions

Document the responsibilities, permissions, restrictions, and access boundaries of every role.

## Section 6: Complete Business Workflow

Describe the complete flow from registration to final booking closure.

Include normal flows, alternate flows, failure scenarios, and approval paths.

## Section 7: Application-Wise Functional Requirements

Document the requirements for:

* Super Admin.
* NECL Admin Panel.
* Client Mobile Application.
* Vendor Mobile Application.
* Driver Mobile Application.

Assign unique requirement IDs, such as:

* FR-AUTH-001.
* FR-ADMIN-001.
* FR-CLIENT-001.
* FR-VENDOR-001.
* FR-DRIVER-001.
* FR-BOOKING-001.
* FR-DOC-001.

For each requirement, specify its description, role, inputs, validations, expected results, dependencies, and acceptance criteria.

## Section 8: Screen Inventory and Navigation

List every existing screen and every required but missing screen.

Include:

* Screen name.
* Application.
* Route or navigation entry point.
* Purpose.
* User actions.
* Data displayed.
* API dependencies.
* Access permissions.
* Loading, empty, error, and success states.

## Section 9: Data Model and Database Requirements

Document the verified current schema, required entities, relationships, constraints, and any proposed schema changes.

Separate existing database facts from proposed changes.

## Section 10: API and Integration Requirements

Document existing APIs and required API behavior.

Include authentication, validation, response handling, error codes, transaction safety, and external integration dependencies.

## Section 11: Status Lifecycle

Provide centralized state definitions and valid transitions for every major entity.

## Section 12: Notifications

Specify:

* Triggering events.
* Recipients.
* Notification channels.
* Notification content.
* Delivery and failure handling.
* Read/unread behavior.
* Duplicate-notification prevention.

## Section 13: Document Management

Define upload, preview, validation, verification, correction, versioning, access control, and retention requirements.

## Section 14: Security and Privacy

Document authentication, authorization, sensitive data protection, document access, audit logging, and security requirements.

## Section 15: Non-Functional Requirements

Cover:

* Performance.
* Scalability.
* Availability.
* Reliability.
* Accessibility.
* Responsive design.
* Maintainability.
* Security.
* Observability.
* Backup and recovery.
* Data retention.
* Compatibility.

Do not invent numeric service-level commitments. Mark values requiring business approval.

## Section 16: Reporting and Dashboards

Define dashboard KPIs, their calculation rules, filters, date ranges, and underlying data sources.

## Section 17: Error Handling and Edge Cases

Document failures, retries, duplicate submissions, concurrent updates, expired quotations, rejected registrations, missing documents, failed uploads, and interrupted workflows.

## Section 18: Testing Strategy

Define unit, integration, API, database, security, end-to-end, regression, and device testing requirements.

## Section 19: Acceptance Criteria

Provide testable acceptance criteria for every critical business workflow.

## Section 20: Gap Analysis

Include all verified defects, missing features, incomplete integrations, and unresolved business decisions.

## Section 21: Implementation Roadmap

Organize future work into logical phases, with dependencies and priorities.

Do not invent delivery dates or effort estimates without sufficient evidence.

## Section 22: Risks and Dependencies

Identify technical, operational, security, data, and business risks.

## Section 23: Open Questions

List all decisions requiring confirmation from the business owner.

## Section 24: Requirement Traceability Matrix

Map each business requirement to:

* Application.
* Screen or component.
* API or service.
* Database entity.
* Implementation status.
* Test case.
* Outstanding issue.

## Section 25: Final Audit Summary

Summarize what is working, what is incomplete, what is broken, what is missing, and what must be addressed first.

---

# 11. REQUIRED DOCUMENTATION OUTPUTS

Create a dedicated documentation directory if one does not already exist.

Use the existing project documentation conventions where possible.

Generate the following files:

### 1. NECL_COMPLETE_PROJECT_AUDIT.md

Contains:

* Repository overview.
* Architecture inventory.
* Existing functionality.
* Verified implementation status.
* Database and API findings.
* Security findings.
* UI/UX findings.
* Real-data verification.
* Historical findings supported by available evidence.

### 2. NECL_COMPLETE_BUSINESS_FLOW.md

Contains:

* End-to-end business workflow.
* Role responsibilities.
* Decision points.
* Approval workflows.
* Status transitions.
* Exceptions and failure paths.
* Cross-application interactions.

### 3. NECL_COMPREHENSIVE_PRODUCT_REQUIREMENTS_DOCUMENT.md

Contains the complete PRD described in Phase 10.

### 4. NECL_GAP_ANALYSIS_AND_BUG_REGISTER.md

Contains:

* Verified defects.
* Missing features.
* Incomplete implementations.
* Severity and priority.
* Evidence.
* Dependencies.
* Recommended solutions.
* Acceptance criteria.

### 5. NECL_DATABASE_API_AND_INTEGRATION_AUDIT.md

Contains:

* Database inventory.
* Relationships.
* Migration findings.
* API inventory.
* Authentication and authorization.
* File storage.
* Notification integrations.
* Data consistency risks.

### 6. NECL_TESTING_AND_ACCEPTANCE_PLAN.md

Contains:

* Test scenarios.
* End-to-end test cases.
* Role-based test cases.
* Regression tests.
* Security tests.
* Expected results.
* Acceptance criteria.
* Testing status and blockers.

### 7. NECL_IMPLEMENTATION_ROADMAP.md

Contains:

* Prioritized work.
* Dependencies.
* Recommended implementation sequence.
* Required validation.
* Completion criteria.
* Unresolved business decisions.

### 8. NECL_REQUIREMENT_TRACEABILITY_MATRIX.md

Maps each requirement to its implementation evidence, affected modules, database entities, tests, and outstanding issues.

If equivalent documents already exist, review and update them rather than creating unnecessary duplicates.

---

# 12. EVIDENCE AND ACCURACY RULES

The audit must be based on the actual project.

Follow these rules:

1. Inspect source files before making implementation claims.
2. Trace critical user actions into the backend and database.
3. Inspect relevant migrations and API definitions.
4. Run existing tests and safe verification commands where possible.
5. Use browser or device previews when available.
6. Record exact file paths and relevant functions as evidence.
7. Distinguish confirmed facts from assumptions.
8. Mark inaccessible integrations as unverified.
9. Never report an untested workflow as fully functional.
10. Never fabricate test results, database records, APIs, or screenshots.
11. Never expose secrets or sensitive personal information in the documentation.
12. Do not delete or modify existing business data during the audit.
13. Do not execute destructive migrations or production-affecting operations.
14. Do not create fake business records to make features appear functional.
15. Preserve all existing code and assets during this phase.

Use these implementation status values:

* **Verified Working**
* **Implemented, Not Fully Tested**
* **Partially Implemented**
* **Broken**
* **Not Implemented**
* **Blocked**
* **Not Applicable**
* **Requires Business Decision**

Use these evidence levels:

* **Verified:** Directly inspected or successfully tested.
* **Partially Verified:** Some implementation evidence exists, but the complete workflow has not been validated.
* **Unverified:** Insufficient evidence to establish actual behavior.

A visible screen does not prove that its business workflow works.

A successful build does not prove that the application is functionally correct.

A database table does not prove that the application uses it.

A button does not prove that its associated action is connected.

---

# 13. STRICT EXECUTION ORDER

Follow this sequence without skipping steps.

### Step 1 — Discover

Inspect the project structure, applications, documentation, and available Git history.

### Step 2 — Inventory

Identify the existing screens, components, APIs, database entities, and business workflows.

### Step 3 — Trace

Follow critical workflows across the frontend, backend, database, and notification systems.

### Step 4 — Verify

Run safe tests and inspect implementation evidence.

### Step 5 — Audit

Document current behavior, missing functionality, defects, security concerns, and unresolved requirements.

### Step 6 — Reconstruct

Produce the complete end-to-end business flow and role-specific workflows.

### Step 7 — Write the PRD

Generate the comprehensive PRD and supporting audit documents.

### Step 8 — Cross-Check

Verify that the PRD, business flow, gap register, testing plan, and traceability matrix are consistent.

### Step 9 — Report

Provide an executive summary and a clear account of what has been completed and what remains.

**Do not start large-scale feature development during these steps.** The goal is to establish an accurate baseline before deciding what to implement next.

---

# 14. FINAL ACCEPTANCE CRITERIA

The audit is complete only when:

* All discoverable applications have been inventoried.
* Every major business workflow has been documented.
* Existing implementation status has been assessed using evidence.
* Critical UI actions have been traced toward their underlying operations.
* Database and API dependencies have been documented.
* Previously reported issues have been checked.
* Mock-data and real-data concerns have been assessed.
* Registration and approval workflows have been audited.
* Requirement distribution and quotation workflows have been audited.
* Booking, assignment, trip, and document workflows have been audited.
* Missing features and unresolved business decisions have been recorded.
* The comprehensive PRD has been generated.
* Supporting audit documents have been created or updated.
* Requirements can be traced to implementation evidence and test cases.
* No unrelated application code or production data has been changed.

If repository access, external integrations, credentials, test environments, or device access are unavailable, explicitly document the limitation. Do not claim that the corresponding functionality has been verified.

# FINAL INSTRUCTION

Perform a complete and objective audit of the NECL project as it exists today.

**Understand what has already happened, what currently works, what is partially implemented, what is broken, what is missing, and what the business requires next.**

Produce the comprehensive PRD and all supporting documentation based on verified evidence.

Do not merely describe the intended product. Document the difference between the intended product and the actual implementation.

Preserve existing functionality and code. Do not delete, rewrite, or redesign unrelated components during the audit.

At the end, provide:

1. The location of every generated document.
2. A summary of verified working features.
3. A summary of broken and incomplete features.
4. A prioritized list of critical gaps.
5. Any unverified areas or access limitations.
6. The recommended next implementation phase.

The final result must serve as the authoritative baseline for all future NECL development, testing, and release decisions.
