# NECL Mobile Screens Directory Guide

This directory houses the 72 screen components powering the NECL mobile application across all 3 user roles: **Clients**, **Vendors (Transporters)**, and **Drivers**, as well as shared **Authentication** and **Common** screens.

---

## Architecture & Workflow Subdirectories

Screens are categorized into 5 main role domains, and further subdivided into specialized **workflow subfolders** for maximum accessibility, maintainability, and clean code navigation:

```text
screens/
├── index.ts                                       # Master barrel export re-exporting all domains
│
├── auth/                                          # Authentication & Security
│   ├── index.ts                                   # Auth domain barrel
│   ├── login/                                     # Login & role selection
│   │   ├── index.ts
│   │   ├── LoginScreen.tsx
│   │   └── ChooseAccountTypeScreen.tsx
│   ├── otp/                                       # OTP verification
│   │   ├── index.ts
│   │   └── OtpScreen.tsx
│   ├── registration/                              # User registration & verification status
│   │   ├── index.ts
│   │   ├── RegistrationScreen.tsx
│   │   └── RegistrationStatusScreen.tsx
│   └── password/                                  # Password recovery
│       ├── index.ts
│       ├── ForgotPasswordScreen.tsx
│       ├── CreateNewPasswordScreen.tsx
│       └── PasswordResetSuccessScreen.tsx
│
├── common/                                        # Shared Utility & Preferences
│   ├── index.ts                                   # Common domain barrel
│   ├── onboarding/                                # App splash & welcome
│   │   ├── index.ts
│   │   ├── SplashScreen.tsx
│   │   ├── WelcomeToNeclScreen.tsx
│   │   └── OnboardingScreen.tsx
│   ├── profile/                                   # User profile & saved addresses
│   │   ├── index.ts
│   │   ├── ProfileScreen.tsx
│   │   ├── EditProfileScreen.tsx
│   │   └── SavedAddressesScreen.tsx
│   ├── notifications/                             # In-app notifications
│   │   ├── index.ts
│   │   ├── NotificationsScreen.tsx
│   │   ├── NotificationDetailsScreen.tsx
│   │   └── NotificationPermissionScreen.tsx
│   └── settings/                                  # App preferences & legal
│       ├── index.ts
│       ├── SettingsScreen.tsx
│       ├── HelpSupportScreen.tsx
│       └── TermsPrivacyScreen.tsx
│
├── client/                                        # Client Consignor Workflows
│   ├── index.ts                                   # Client domain barrel
│   ├── dashboard/                                 # Consignor home
│   │   ├── index.ts
│   │   └── ClientDashboardScreen.tsx
│   ├── onboarding/                                # Client KYC & business setup
│   │   ├── index.ts
│   │   ├── ClientProfileSetupScreen.tsx           # Step 1: User & Company info
│   │   ├── ClientBusinessDetailsScreen.tsx        # Step 2: Address & PIN auto-detect
│   │   ├── ClientDocumentUploadScreen.tsx         # Step 3: PAN / GSTIN / Certificate
│   │   ├── ClientRegistrationReviewScreen.tsx     # Step 4: Application review
│   │   └── ClientRegistrationConfirmationScreen.tsx # Step 5: Submission confirmed
│   ├── requirements/                              # RFQ creation & management
│   │   ├── index.ts
│   │   ├── CreateTransportRequirementScreen.tsx   # Step 1: Route & timing
│   │   ├── CargoDetailsScreen.tsx                 # Step 2: Cargo category & units
│   │   ├── PickupDeliveryDetailsScreen.tsx        # Step 3: Loading / unloading points
│   │   ├── RequirementReviewScreen.tsx            # Step 4: Review before dispatch
│   │   ├── RequirementConfirmationScreen.tsx      # Step 5: Requirement posted
│   │   ├── MyRequirementsScreen.tsx               # Client requirements directory
│   │   └── RequirementDetailsScreen.tsx           # Requirement overview & RFQ dispatch
│   ├── quotations/                                # Quotations & bidding
│   │   ├── index.ts
│   │   ├── QuotationsListScreen.tsx               # Received quotations
│   │   ├── QuotationComparisonScreen.tsx          # Side-by-side comparison
│   │   └── QuotationDetailsScreen.tsx             # Detailed cost breakdown
│   ├── bookings/                                  # Order & booking management
│   │   ├── index.ts
│   │   ├── BookingConfirmationScreen.tsx          # Booking confirmation
│   │   ├── MyBookingsScreen.tsx                   # Client bookings directory
│   │   └── BookingDetailsScreen.tsx               # Booking details & assigned driver
│   └── shipments/                                 # Consignment tracking & documents
│       ├── index.ts
│       ├── MyShipmentsScreen.tsx                  # Active shipments
│       ├── ShipmentTrackingScreen.tsx             # Real-time GPS & checkpoint timeline
│       ├── ShipmentDocumentsScreen.tsx            # Pre-trip clearance & e-way bills
│       └── ProofOfDeliveryScreen.tsx              # Stamped consignee POD
│
├── vendor/                                        # Transporter & Carrier Operations
│   ├── index.ts                                   # Vendor domain barrel
│   ├── dashboard/                                 # Control tower & analytics
│   │   ├── index.ts
│   │   ├── VendorDashboardScreen.tsx
│   │   └── VendorReportsModal.tsx
│   ├── registration/                              # Vendor KYC steps 1-11
│   │   ├── index.ts
│   │   ├── VendorRegistrationScreen.tsx           # Step 1: Basic info
│   │   ├── VendorBusinessInfoScreen.tsx           # Step 2: Legal entity & tax
│   │   ├── VendorAddressContactScreen.tsx         # Step 3: Registered office
│   │   ├── VendorOperatingLocationsScreen.tsx     # Step 4: Northeast regional hubs
│   │   ├── VendorFleetInfoScreen.tsx              # Step 5: Vehicle fleet strength
│   │   ├── VendorTransportServicesScreen.tsx      # Step 6: FTL, part load, express
│   │   ├── VendorDocumentUploadScreen.tsx         # Step 7: PAN, Cheque, GST upload
│   │   ├── VendorApplicationReviewScreen.tsx      # Step 8: Comprehensive review
│   │   ├── VendorSubmissionConfirmationScreen.tsx # Step 9: Submission confirmed
│   │   ├── VendorVerificationStatusScreen.tsx     # Step 10: KYC verification status
│   │   └── VendorDocumentCorrectionScreen.tsx     # Step 11: Document re-upload
│   ├── rfqs/                                      # Bids & quotation submission
│   │   ├── index.ts
│   │   ├── VendorRequirementsScreen.tsx           # Incoming RFQs from NECL Admin
│   │   ├── VendorRequirementDetailsScreen.tsx     # Requirement cargo & lane details
│   │   ├── VendorSubmitQuotationScreen.tsx        # Bidding and rate submission
│   │   ├── VendorQuotationConfirmationScreen.tsx  # Quote submission confirmation
│   │   ├── VendorQuotationsListScreen.tsx         # Submitted quotes directory
│   │   └── VendorQuotationDetailsScreen.tsx       # Quote details & client decision
│   ├── bookings/                                  # Fleet & driver allocation
│   │   ├── index.ts
│   │   ├── VendorAwardedBookingsScreen.tsx        # Won bookings awaiting allocation
│   │   ├── VendorBookingDetailsScreen.tsx         # Awarded load requirements
│   │   ├── VendorAssignVehicleScreen.tsx          # Select vehicle from fleet
│   │   ├── VendorAssignDriverScreen.tsx           # Assign licensed driver
│   │   └── VendorAssignmentConfirmationScreen.tsx # Fleet allocation confirmation
│   ├── trips/                                     # Active trips & documents
│   │   ├── index.ts
│   │   ├── VendorTripManagementScreen.tsx         # Active trips
│   │   ├── VendorTripDetailsScreen.tsx            # In-transit trip details
│   │   └── VendorTripDocumentsScreen.tsx          # Transit documents & e-way bill
│   └── fleet/                                     # Assets & driver directory
│       ├── index.ts
│       ├── VendorFleetManagementScreen.tsx        # Transporter fleet directory
│       └── VendorDriverManagementScreen.tsx       # Transporter driver directory
│
└── driver/                                        # Commercial Driver Field Operations
    ├── index.ts                                   # Driver domain barrel
    ├── dashboard/                                 # Driver cockpit
    │   ├── index.ts
    │   └── DriverDashboardScreen.tsx
    ├── registration/                              # Single-screen & multi-step KYC
    │   ├── index.ts
    │   ├── DriverOnboardingScreen.tsx             # Onboarding overview
    │   ├── DriverRegistrationScreen.tsx           # Single-screen driver registration
    │   ├── DriverPersonalInfoScreen.tsx           # Contact & emergency details
    │   ├── DriverLicenceDetailsScreen.tsx         # DL number & validity
    │   ├── DriverVehicleAssociationScreen.tsx     # Primary transporter tie-up
    │   ├── DriverDocumentUploadScreen.tsx         # DL photo & Aadhaar upload
    │   ├── DriverApplicationReviewScreen.tsx      # Application review
    │   ├── DriverSubmissionConfirmationScreen.tsx # Application submitted
    │   ├── DriverVerificationStatusScreen.tsx     # DL audit status
    │   └── DriverDocumentCorrectionScreen.tsx     # License re-upload
    ├── trips/                                     # Active trip execution & ePOD
    │   ├── index.ts
    │   ├── DriverAssignedTripsScreen.tsx          # Assigned loads awaiting pickup
    │   ├── DriverTripDetailsScreen.tsx            # Trip instructions & route map
    │   ├── DriverTripProgressScreen.tsx           # Active transit navigation & SOS
    │   ├── DriverPickupConfirmationScreen.tsx     # Consignor gate pickup
    │   ├── DriverDeliveryConfirmationScreen.tsx   # Consignee gate arrival
    │   ├── DriverPodUploadScreen.tsx              # Physical stamped POD capture
    │   ├── DriverTripCompletionScreen.tsx         # Trip closure summary
    │   └── DriverTripHistoryScreen.tsx            # Completed trips archive
    └── documents/                                 # Driver credentials
        ├── index.ts
        └── DriverDocumentsScreen.tsx              # Personal driver credentials & license
```

---

## Import Options

You can import screens using three different convenient methods:

```typescript
// 1. Direct workflow subfolder import (explicit & clear)
import { ClientDashboardScreen } from './screens/client/dashboard/ClientDashboardScreen';
import { MyShipmentsScreen } from './screens/client/shipments/MyShipmentsScreen';

// 2. Workflow barrel import
import { MyShipmentsScreen, ShipmentTrackingScreen } from './screens/client/shipments';

// 3. Domain barrel import
import { ClientDashboardScreen, MyShipmentsScreen } from './screens/client';

// 4. Master barrel import
import { ClientDashboardScreen, VendorDashboardScreen, DriverDashboardScreen } from './screens';
```
