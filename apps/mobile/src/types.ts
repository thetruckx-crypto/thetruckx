// ============================================================================
// NECL Mobile Application Type Definitions
// ============================================================================

export type MobileRole = 'CLIENT' | 'VENDOR' | 'DRIVER';

export type ScreenId =
  | 'SPLASH'                  // 01. Splash Screen
  | 'ONBOARDING'              // 02. Onboarding Screen
  | 'LOGIN'                   // 03. Login Screen
  | 'REGISTRATION'            // 04. Registration Screen
  | 'OTP'                     // 05. Verify OTP Screen
  | 'NOTIFICATION_PERMISSION' // 09. Notification Permission Screen
  | 'REGISTRATION_STATUS'     // 11. Registration & Account Status Screen
  | 'PROFILE'                 // 12. Profile Screen
  | 'EDIT_PROFILE'            // 13. Edit Profile Screen
  | 'NOTIFICATIONS'           // 14. Notifications Screen
  | 'NOTIFICATION_DETAILS'    // 15. Notification Details Screen
  | 'SETTINGS'                // 16. Settings Screen
  | 'HELP_SUPPORT'            // 17. Help & Support Screen
  | 'CLIENT_DASHBOARD'        // Role destination for client
  | 'CHOOSE_ROLE'             // Role selector flow
  | 'CLIENT_PROFILE'          // Client profile details (Screen 1)
  | 'CLIENT_BUSINESS_DETAILS' // Client business details (Screen 2)
  | 'CLIENT_DOC_UPLOAD'       // Client document upload (Screen 3)
  | 'CLIENT_REG_REVIEW'       // Client registration review (Screen 4)
  | 'CLIENT_REG_CONFIRM'      // Client registration confirmation (Screen 5)
  | 'CREATE_REQUIREMENT'      // Create transport requirement (Screen 8)
  | 'CARGO_DETAILS'           // Cargo details (Screen 9)
  | 'PICKUP_DELIVERY_DETAILS' // Pickup and delivery details (Screen 10)
  | 'REQUIREMENT_REVIEW'      // Requirement review (Screen 11)
  | 'REQUIREMENT_CONFIRM'     // Requirement confirmation (Screen 12)
  | 'MY_REQUIREMENTS'         // My requirements list (Screen 13)
  | 'REQUIREMENT_DETAILS'     // Requirement details (Screen 14)
  | 'QUOTATIONS_LIST'         // Quotations list (Screen 15)
  | 'QUOTATION_COMPARISON'    // Quotation comparison (Screen 16)
  | 'QUOTATION_DETAILS'       // Quotation details (Screen 17)
  | 'BOOKING_CONFIRMATION'    // Booking confirmation (Screen 18)
  | 'MY_SHIPMENTS'            // Dedicated Shipments Screen
  | 'MY_BOOKINGS'             // My bookings list (Screen 19)
  | 'BOOKING_DETAILS'         // Booking details (Screen 20)
  | 'SHIPMENT_TRACKING'       // Shipment tracking (Screen 21)
  | 'SHIPMENT_DOCUMENTS'      // Shipment documents (Screen 22)
  | 'PROOF_OF_DELIVERY'       // Proof of delivery POD (Screen 23)
  | 'SAVED_ADDRESSES'         // Saved addresses (Screen 24)
  | 'CLIENT_ADDRESS'          // Client address details
  | 'VENDOR_ONBOARDING'       // Vendor onboarding
  | 'DRIVER_ONBOARDING'       // Driver onboarding
  // Phase 3: Vendor Registration & Verification (Screens 1 to 11)
  | 'VENDOR_REGISTRATION'           // 01. Vendor Registration
  | 'VENDOR_BUSINESS_INFO'          // 02. Business Information
  | 'VENDOR_ADDRESS_CONTACT'        // 03. Business Address & Contact Info
  | 'VENDOR_OPERATING_LOCATIONS'    // 04. Operating Locations
  | 'VENDOR_FLEET_INFO'             // 05. Fleet Information
  | 'VENDOR_TRANSPORT_SERVICES'     // 06. Transport Services
  | 'VENDOR_DOC_UPLOAD'             // 07. Vendor Document Upload
  | 'VENDOR_APPLICATION_REVIEW'     // 08. Application Review
  | 'VENDOR_SUBMISSION_CONFIRM'     // 09. Submission Confirmation
  | 'VENDOR_VERIFICATION_STATUS'    // 10. Verification Status
  | 'VENDOR_DOC_CORRECTION'         // 11. Document Status and Correction
  // Phase 3: Vendor Operations (Screens 12 to 28)
  | 'VENDOR_DASHBOARD'              // 12. Vendor Dashboard
  | 'VENDOR_REQUIREMENTS'           // 13. Available Transport Requirements
  | 'VENDOR_REQUIREMENT_DETAILS'    // 14. Requirement Details
  | 'VENDOR_SUBMIT_QUOTATION'       // 15. Submit Quotation
  | 'VENDOR_QUOTATION_CONFIRM'      // 16. Quotation Submission Confirmation
  | 'VENDOR_MY_QUOTATIONS'          // 17. My Quotations
  | 'VENDOR_QUOTATION_DETAILS'      // 18. Quotation Details
  | 'VENDOR_AWARDED_BOOKINGS'       // 19. Awarded Bookings
  | 'VENDOR_BOOKING_DETAILS'        // 20. Booking Details
  | 'VENDOR_FLEET_MANAGEMENT'       // 21. Fleet and Vehicle Management
  | 'VENDOR_DRIVER_MANAGEMENT'      // 22. Driver Management
  | 'VENDOR_ASSIGN_VEHICLE'         // 23. Assign Vehicle
  | 'VENDOR_ASSIGN_DRIVER'          // 24. Assign Driver
  | 'VENDOR_ASSIGNMENT_CONFIRM'     // 25. Assignment Confirmation
  | 'VENDOR_TRIP_MANAGEMENT'        // 26. Trip Management
  | 'VENDOR_TRIP_DETAILS'           // 27. Trip Details
  | 'VENDOR_TRIP_DOCUMENTS'         // 28. Trip Documents and POD
  // Driver Registration & Verification (Screens 1 to 9)
  | 'DRIVER_REGISTRATION'           // 01. Driver Registration
  | 'DRIVER_PERSONAL_INFO'          // 02. Personal Information
  | 'DRIVER_LICENCE_DETAILS'        // 03. Driving Licence Details
  | 'DRIVER_VEHICLE_ASSOCIATION'    // 04. Vehicle Association
  | 'DRIVER_DOC_UPLOAD'             // 05. Driver Document Upload
  | 'DRIVER_APPLICATION_REVIEW'     // 06. Application Review
  | 'DRIVER_SUBMISSION_CONFIRM'     // 07. Submission Confirmation
  | 'DRIVER_VERIFICATION_STATUS'    // 08. Verification Status
  | 'DRIVER_DOC_CORRECTION'         // 09. Document Status and Correction
  // Driver Operations (Screens 10 to 20)
  | 'DRIVER_DASHBOARD'              // 10. Driver Dashboard
  | 'DRIVER_ASSIGNED_TRIPS'         // 11. Assigned Trips
  | 'DRIVER_TRIP_DETAILS'           // 12. Trip Details
  | 'DRIVER_PICKUP_CONFIRM'         // 13. Pickup Confirmation
  | 'DRIVER_TRIP_PROGRESS'          // 14. Trip Progress
  | 'DRIVER_DELIVERY_CONFIRM'       // 16. Delivery Confirmation
  | 'DRIVER_POD_UPLOAD'             // 17. Proof of Delivery (POD) Upload
  | 'DRIVER_TRIP_COMPLETION'        // 18. Trip Completion
  | 'DRIVER_TRIP_HISTORY'           // 19. Trip History
  | 'DRIVER_DOCUMENTS';             // 20. Driver Documents


export interface VehicleRequirementGroup {
  id: string;
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SEA' | 'MULTIMODAL' | 'OTHER';
  vehicleTypeId: string;
  vehicleTypeName: string;
  vehicleCategory?: string;
  tyreCount?: number;
  axleConfig?: string;
  payloadMt?: number;
  dimensions?: string;
  specialCapabilities?: string;
  isCustom?: boolean;
  customVehicleName?: string;
  quantity: number;
  requestedDate: string; // YYYY-MM-DD
  requestedTime: string; // e.g. 09:30 AM
  scheduleScope?: 'COMMON' | 'INDIVIDUAL';
  specificHandlingReqs?: string[];
  notes?: string;
}

export interface CargoItemSpecification {
  id: string;
  commodityCategory: string;
  commodityName: string;
  isCustomCommodity?: boolean;
  customCommodityDesc?: string;
  grossWeight: number;
  weightUnit: 'MT' | 'kg';
  netWeight?: number;
  packageCount: number;
  packagingUnit: string;
  customPackagingUnit?: string;
  packagingModes: string[];
  customPackagingMode?: string;
  dimensionsLength?: string;
  dimensionsWidth?: string;
  dimensionsHeight?: string;
  dimensionsUnit?: 'ft' | 'cm' | 'm' | 'in';
  volumePerPackage?: number;
  totalVolume?: number;
  isFragile?: boolean;
  fragileInstructions?: string;
  isLiquid?: boolean;
  liquidDetails?: string;
  isOversized?: boolean;
  oversizedConstraints?: string;
  isMoistureSensitive?: boolean;
  moistureProtection?: string;
  isTemperatureSensitive?: boolean;
  temperatureMin?: string;
  temperatureMax?: string;
  temperatureUnit?: 'C' | 'F';
  temperatureMonitoring?: boolean;
  cargoNotes?: string;
}

export interface CustomCatalogueProposal {
  id: string;
  type: 'VEHICLE_TYPE' | 'COMMODITY' | 'PACKAGING_METHOD' | 'HANDLING_REQ' | 'TRANSPORT_MODE';
  name: string;
  description?: string;
  category?: string;
  submittedBy?: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface TransportRequirementDraft {
  draftId?: string;
  // Step 1: Vehicle & Loading Schedule
  transportMode?: string;
  vehicleTypeRequired: string;
  vehicleCategory?: string;
  customVehicleType?: string;
  loadingDatetime: string;
  preferredLoadingDate?: string;
  preferredLoadingTime?: string;
  preferredTimeWindow?: string;
  schedulingNotes?: string;
  targetBudget?: string;
  targetBudgetCurrency?: string;
  handlingRequirements?: string[];
  customHandlingRequirement?: string;
  specialInstructions?: string;

  // Multiple vehicle groups support
  vehicleGroups?: VehicleRequirementGroup[];
  totalVehiclesCount?: number;

  // Step 2: Cargo Specifications
  materialType: string;
  customCommodityName?: string;
  requiredCapacityMt: number;
  weightValue?: number;
  weightUnit?: 'MT' | 'kg';
  packagingType: string;
  numberOfUnits?: string;
  packageCount?: number;
  packagingUnit?: string;
  customPackagingUnit?: string;
  packagingModes?: string[];
  customPackagingMode?: string;
  dimensionsLength?: string;
  dimensionsWidth?: string;
  dimensionsHeight?: string;
  dimensionsUnit?: 'ft' | 'cm' | 'm' | 'in';
  calculatedVolume?: number;
  isFragile?: boolean;
  isTemperatureSensitive?: boolean;
  temperatureMin?: string;
  temperatureMax?: string;
  isLiquid?: boolean;
  isOversized?: boolean;
  isMoistureSensitive?: boolean;
  isHazardous?: boolean;
  hazardousName?: string;
  unNumber?: string;
  hazardClass?: string;
  packingGroup?: string;
  sdsDocumentUri?: string;
  transitInsuranceNeeded?: boolean;
  declaredCargoValue?: string;
  declaredValueCurrency?: string;
  insuranceInvoiceUri?: string;
  termsAcknowledged?: boolean;

  // Multiple cargo items support
  cargoItems?: CargoItemSpecification[];
  totalCargoItemsCount?: number;
  totalCalculatedWeightMt?: number;
  totalCalculatedVolumeCuFt?: number;

  // Step 3: Pickup & Delivery Details
  pickupAddress: string;
  pickupCity: string;
  pickupState?: string;
  pickupPincode: string;
  pickupContactName: string;
  pickupContactPhone: string;
  destinationAddress: string;
  destinationCity: string;
  destinationState?: string;
  destinationPincode: string;
  dropContactName: string;
  dropContactPhone: string;

  // Step 3: Zero-Cost Google Maps Location Fields
  pickupGoogleMapsUrl?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  destinationGoogleMapsUrl?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
}


export interface MobileAuthState {
  mobileNumber: string;
  countryCode: string;
  role: MobileRole;
  isExistingUser: boolean;
  otpCode: string;
  sessionToken?: string;
  userId?: string;
  clientCompanyId?: string;
}

export interface ClientRegistrationDraft {
  companyName: string;
  fullName: string; // Logistics Contact Person Name
  contactPhone: string; // Contact Person Phone Number
  companyPhone: string; // Company Contact Number
  otpDestination: 'CONTACT_PERSON' | 'COMPANY_PHONE'; // OTP Destination Selection
  emailAddress: string; // Company Email ID
}

export interface ClientProfileFormData {
  fullName: string;
  mobileNumber: string;
  emailAddress: string;
  designation: string;
  department: string;
  companyName: string;
  gstNumber?: string;
  businessType?: string;
  companyPhone?: string;
}

export interface ShipmentItem {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  status: 'Booked' | 'In Transit' | 'Delivered' | 'Pending';
  date: string;
  carrier?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
}

export interface AppNotificationItem {
  id: string;
  category: 'shipment' | 'booking' | 'system' | 'driver' | 'account';
  title: string;
  subtitle: string;
  time: string;
  refId?: string;
  isRead: boolean;
  isImportant?: boolean;
  content?: string;
  createdAt?: string;
}

export interface UserSettingsData {
  pushTripUpdates: boolean;
  pushQuotations: boolean;
  pushSystemAlerts: boolean;
  biometricLogin: boolean;
  smsAlerts: boolean;
  darkMode: boolean;
  language: string;
}

export interface VendorDocumentItem {
  id: string;
  docType: 'GST_CERTIFICATE' | 'COMPANY_PAN' | 'BANK_CANCELLED_CHEQUE' | 'TRANSPORT_DECLARATION' | 'OWNER_ID';
  title: string;
  fileName?: string;
  fileUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  uploadedAt?: string;
}

export interface VendorRegistrationFormData {
  transporterName: string;
  businessType: string;
  yearEstablished?: string;
  msmeNumber?: string;
  pan: string;
  gstin: string;
  registeredAddress: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  email: string;
  phone: string;
  altPhone?: string;
  operatingHubs: string[];
  interstatePermits: string[];
  fleetStrength: string;
  truckCategories: string[];
  servicesOffered: string[];
  documents: VendorDocumentItem[];
}

export interface DriverDocumentItem {
  id: string;
  docType: 'DRIVING_LICENCE' | 'AADHAR_CARD' | 'MEDICAL_FITNESS' | 'POLICE_VERIFICATION';
  title: string;
  fileName?: string;
  fileUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  expiryDate?: string;
  uploadedAt?: string;
}

export interface DriverRegistrationFormData {
  // Personal Info
  fullName: string;
  fatherName?: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Driving Licence
  licenceNumber: string;
  licenceExpiryDate: string;
  rtoState: string;
  vehicleCategory: string;
  badgeNumber?: string;
  // Vehicle / Vendor Association
  associationType: 'VENDOR_FLEET' | 'INDEPENDENT_ATTACHED';
  primaryVendorId?: string;
  transporterName?: string;
  vehicleRegistrationNumber?: string;
  vehicleType?: string;
  // Documents
  documents: DriverDocumentItem[];
}

export interface DriverTripItem {
  id: string;
  bookingId: string;
  tripStatus: 'LORRY_ASSIGNED' | 'AT_LOADING' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'DELIVERED' | 'COMPLETED';
  origin: string;
  destination: string;
  pickupAddress: string;
  pickupPincode?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  destinationAddress: string;
  destinationPincode?: string;
  dropContactName?: string;
  dropContactPhone?: string;
  material: string;
  capacityMt?: number;
  loadingDatetime?: string;
  clientName?: string;
  vendorName?: string;
  vehicleNumber: string;
  vehicleType: string;
  rate?: number;
  startedAt?: string;
  completedAt?: string;
  weighmentLoadingGross?: number;
  weighmentLoadingTare?: number;
  weighmentUnloadingGross?: number;
  receiverName?: string;
  receiverPhone?: string;
  documents?: {
    id: string;
    type: string;
    fileUrl: string;
    status: string;
    consigneeStampVerified?: boolean;
    uploadedAt?: string;
  }[];
}

