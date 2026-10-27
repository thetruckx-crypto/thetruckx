import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Clock, X, Bell } from 'lucide-react-native';
import {
  ScreenId,
  MobileRole,
  ClientProfileFormData,
  AppNotificationItem,
  TransportRequirementDraft,
} from './src/types';
import { authService, AuthSessionData } from './src/services/authService';
import {
  clientService,
  ClientBusinessDetails,
  ClientDocumentItem,
  SavedAddressItem,
} from './src/services/clientService';
import { vendorService } from './src/services/vendorService';
import { driverService } from './src/services/driverService';
import { mobileNotificationService } from './src/services/notificationService';

// The Common Screen Components
import { SplashScreen } from './src/screens/common/onboarding/SplashScreen'; // 01. Splash
import { OnboardingScreen } from './src/screens/common/onboarding/OnboardingScreen'; // 02. Onboarding
import { LoginScreen } from './src/screens/auth/login/LoginScreen'; // 03. Login
import { RegistrationScreen } from './src/screens/auth/registration/RegistrationScreen'; // 04. Registration
import { OtpScreen } from './src/screens/auth/otp/OtpScreen'; // 05. OTP Verification
import { RegistrationStatusScreen } from './src/screens/auth/registration/RegistrationStatusScreen'; // 11. Registration & Account Status (Screen 6)
import { WelcomeToNeclScreen } from './src/screens/common/onboarding/WelcomeToNeclScreen';
import { ProfileScreen } from './src/screens/common/profile/ProfileScreen'; // 12. Profile
import { EditProfileScreen } from './src/screens/common/profile/EditProfileScreen'; // 13. Edit Profile
import { NotificationsScreen } from './src/screens/common/notifications/NotificationsScreen'; // 14. Notifications (Screen 25)
import { NotificationDetailsScreen } from './src/screens/common/notifications/NotificationDetailsScreen'; // 15. Notification Details
import { SettingsScreen } from './src/screens/common/settings/SettingsScreen'; // 16. Settings
import { HelpSupportScreen } from './src/screens/common/settings/HelpSupportScreen'; // 17. Help & Support (Screen 26)

// Role Specific Onboarding Screens
import { DriverOnboardingScreen } from './src/screens/driver/registration/DriverOnboardingScreen';

// Client Module Screens (1 through 24)
import { ClientProfileSetupScreen } from './src/screens/client/onboarding/ClientProfileSetupScreen'; // Screen 1
import { ClientBusinessDetailsScreen } from './src/screens/client/onboarding/ClientBusinessDetailsScreen'; // Screen 2
import { ClientDocumentUploadScreen } from './src/screens/client/onboarding/ClientDocumentUploadScreen'; // Screen 3
import { ClientRegistrationReviewScreen } from './src/screens/client/onboarding/ClientRegistrationReviewScreen'; // Screen 4
import { ClientRegistrationConfirmationScreen } from './src/screens/client/onboarding/ClientRegistrationConfirmationScreen'; // Screen 5
import { ClientDashboardScreen } from './src/screens/client/dashboard/ClientDashboardScreen'; // Screen 7
import { CreateTransportRequirementScreen } from './src/screens/client/requirements/CreateTransportRequirementScreen'; // Screen 8
import { CargoDetailsScreen } from './src/screens/client/requirements/CargoDetailsScreen'; // Screen 9
import { PickupDeliveryDetailsScreen } from './src/screens/client/requirements/PickupDeliveryDetailsScreen'; // Screen 10
import { RequirementReviewScreen } from './src/screens/client/requirements/RequirementReviewScreen'; // Screen 11
import { RequirementConfirmationScreen } from './src/screens/client/requirements/RequirementConfirmationScreen'; // Screen 12
import { MyRequirementsScreen } from './src/screens/client/requirements/MyRequirementsScreen'; // Screen 13
import { RequirementDetailsScreen } from './src/screens/client/requirements/RequirementDetailsScreen'; // Screen 14
import { QuotationsListScreen } from './src/screens/client/quotations/QuotationsListScreen'; // Screen 15
import { QuotationComparisonScreen } from './src/screens/client/quotations/QuotationComparisonScreen'; // Screen 16
import { QuotationDetailsScreen } from './src/screens/client/quotations/QuotationDetailsScreen'; // Screen 17
import { BookingConfirmationScreen } from './src/screens/client/bookings/BookingConfirmationScreen'; // Screen 18
import { MyBookingsScreen } from './src/screens/client/bookings/MyBookingsScreen'; // Screen 19
import { MyShipmentsScreen } from './src/screens/client/shipments/MyShipmentsScreen'; // Dedicated Shipments Screen
import { BookingDetailsScreen } from './src/screens/client/bookings/BookingDetailsScreen'; // Screen 20
import { ShipmentTrackingScreen } from './src/screens/client/shipments/ShipmentTrackingScreen'; // Screen 21
import { ShipmentDocumentsScreen } from './src/screens/client/shipments/ShipmentDocumentsScreen'; // Screen 22
import { ProofOfDeliveryScreen } from './src/screens/client/shipments/ProofOfDeliveryScreen'; // Screen 23
import { SavedAddressesScreen } from './src/screens/common/profile/SavedAddressesScreen'; // Screen 24
import { ClientBottomNavBar, ClientNavTab } from './src/components/ClientBottomNavBar';

// Phase 3: Vendor Registration & Verification Screens (1-11)
import { VendorRegistrationScreen } from './src/screens/vendor/registration/VendorRegistrationScreen'; // Screen 1
import { VendorBusinessInfoScreen } from './src/screens/vendor/registration/VendorBusinessInfoScreen'; // Screen 2
import { VendorAddressContactScreen } from './src/screens/vendor/registration/VendorAddressContactScreen'; // Screen 3
import { VendorOperatingLocationsScreen } from './src/screens/vendor/registration/VendorOperatingLocationsScreen'; // Screen 4
import { VendorFleetInfoScreen } from './src/screens/vendor/registration/VendorFleetInfoScreen'; // Screen 5
import { VendorTransportServicesScreen } from './src/screens/vendor/registration/VendorTransportServicesScreen'; // Screen 6
import { VendorDocumentUploadScreen } from './src/screens/vendor/registration/VendorDocumentUploadScreen'; // Screen 7
import { VendorApplicationReviewScreen } from './src/screens/vendor/registration/VendorApplicationReviewScreen'; // Screen 8
import { VendorSubmissionConfirmationScreen } from './src/screens/vendor/registration/VendorSubmissionConfirmationScreen'; // Screen 9
import { VendorVerificationStatusScreen } from './src/screens/vendor/registration/VendorVerificationStatusScreen'; // Screen 10
import { VendorDocumentCorrectionScreen } from './src/screens/vendor/registration/VendorDocumentCorrectionScreen'; // Screen 11

// Phase 3: Vendor Operations Screens (12-28)
import { VendorDashboardScreen } from './src/screens/vendor/dashboard/VendorDashboardScreen'; // Screen 12
import { VendorRequirementsScreen } from './src/screens/vendor/rfqs/VendorRequirementsScreen'; // Screen 13
import { VendorRequirementDetailsScreen } from './src/screens/vendor/rfqs/VendorRequirementDetailsScreen'; // Screen 14
import { VendorSubmitQuotationScreen } from './src/screens/vendor/rfqs/VendorSubmitQuotationScreen'; // Screen 15
import { VendorQuotationConfirmationScreen } from './src/screens/vendor/rfqs/VendorQuotationConfirmationScreen'; // Screen 16
import { VendorQuotationsListScreen } from './src/screens/vendor/rfqs/VendorQuotationsListScreen'; // Screen 17
import { VendorQuotationDetailsScreen } from './src/screens/vendor/rfqs/VendorQuotationDetailsScreen'; // Screen 18
import { VendorAwardedBookingsScreen } from './src/screens/vendor/bookings/VendorAwardedBookingsScreen'; // Screen 19
import { VendorBookingDetailsScreen } from './src/screens/vendor/bookings/VendorBookingDetailsScreen'; // Screen 20
import { VendorFleetManagementScreen } from './src/screens/vendor/fleet/VendorFleetManagementScreen'; // Screen 21
import { VendorDriverManagementScreen } from './src/screens/vendor/fleet/VendorDriverManagementScreen'; // Screen 22
import { VendorAssignVehicleScreen } from './src/screens/vendor/bookings/VendorAssignVehicleScreen'; // Screen 23
import { VendorAssignDriverScreen } from './src/screens/vendor/bookings/VendorAssignDriverScreen'; // Screen 24
import { VendorAssignmentConfirmationScreen } from './src/screens/vendor/bookings/VendorAssignmentConfirmationScreen'; // Screen 25
import { VendorTripManagementScreen } from './src/screens/vendor/trips/VendorTripManagementScreen'; // Screen 26
import { VendorTripDetailsScreen } from './src/screens/vendor/trips/VendorTripDetailsScreen'; // Screen 27
import { VendorTripDocumentsScreen } from './src/screens/vendor/trips/VendorTripDocumentsScreen'; // Screen 28

// Phase 4: Driver Registration & Verification Screens (1-9)
import { DriverRegistrationScreen } from './src/screens/driver/registration/DriverRegistrationScreen'; // Screen 1
import { DriverPersonalInfoScreen } from './src/screens/driver/registration/DriverPersonalInfoScreen'; // Screen 2
import { DriverLicenceDetailsScreen } from './src/screens/driver/registration/DriverLicenceDetailsScreen'; // Screen 3
import { DriverVehicleAssociationScreen } from './src/screens/driver/registration/DriverVehicleAssociationScreen'; // Screen 4
import { DriverDocumentUploadScreen } from './src/screens/driver/registration/DriverDocumentUploadScreen'; // Screen 5
import { DriverApplicationReviewScreen } from './src/screens/driver/registration/DriverApplicationReviewScreen'; // Screen 6
import { DriverSubmissionConfirmationScreen } from './src/screens/driver/registration/DriverSubmissionConfirmationScreen'; // Screen 7
import { DriverVerificationStatusScreen } from './src/screens/driver/registration/DriverVerificationStatusScreen'; // Screen 8
import { DriverDocumentCorrectionScreen } from './src/screens/driver/registration/DriverDocumentCorrectionScreen'; // Screen 9

// Phase 4: Driver Operations Screens (10-20)
import { DriverDashboardScreen } from './src/screens/driver/dashboard/DriverDashboardScreen'; // Screen 10
import { DriverAssignedTripsScreen } from './src/screens/driver/trips/DriverAssignedTripsScreen'; // Screen 11
import { DriverTripDetailsScreen } from './src/screens/driver/trips/DriverTripDetailsScreen'; // Screen 12
import { DriverPickupConfirmationScreen } from './src/screens/driver/trips/DriverPickupConfirmationScreen'; // Screen 13
import { DriverTripProgressScreen } from './src/screens/driver/trips/DriverTripProgressScreen'; // Screen 14
import { DriverDeliveryConfirmationScreen } from './src/screens/driver/trips/DriverDeliveryConfirmationScreen'; // Screen 16
import { DriverPodUploadScreen } from './src/screens/driver/trips/DriverPodUploadScreen'; // Screen 17
import { DriverTripCompletionScreen } from './src/screens/driver/trips/DriverTripCompletionScreen'; // Screen 18
import { DriverTripHistoryScreen } from './src/screens/driver/trips/DriverTripHistoryScreen'; // Screen 19
import { DriverDocumentsScreen } from './src/screens/driver/documents/DriverDocumentsScreen'; // Screen 20

export const createFreshRequirementDraft = (): TransportRequirementDraft => ({
  draftId: undefined,
  vehicleTypeRequired: '',
  vehicleGroups: [],
  totalVehiclesCount: 0,
  loadingDatetime: '',
  preferredLoadingDate: '',
  preferredLoadingTime: '',
  targetBudget: '',
  handlingRequirements: [],
  customHandlingRequirement: '',
  specialInstructions: '',
  materialType: '',
  requiredCapacityMt: 0,
  packagingType: '',
  numberOfUnits: '',
  isHazardous: false,
  transitInsuranceNeeded: false,
  pickupAddress: '',
  pickupCity: '',
  pickupState: '',
  pickupPincode: '',
  pickupContactName: '',
  pickupContactPhone: '',
  destinationAddress: '',
  destinationCity: '',
  destinationState: '',
  destinationPincode: '',
  dropContactName: '',
  dropContactPhone: '',
});

const VENDOR_STEP_SCREEN_MAP: Record<number, ScreenId> = {
  1: 'VENDOR_REGISTRATION',
  2: 'VENDOR_BUSINESS_INFO',
  3: 'VENDOR_ADDRESS_CONTACT',
  4: 'VENDOR_OPERATING_LOCATIONS',
  5: 'VENDOR_FLEET_INFO',
  6: 'VENDOR_TRANSPORT_SERVICES',
  7: 'VENDOR_DOC_UPLOAD',
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('SPLASH');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<MobileRole>('CLIENT');
  const [testOtpCode, setTestOtpCode] = useState<string | undefined>(
    process.env.EXPO_PUBLIC_MOCK_OTP_CODE
  );
  const [session, setSession] = useState<AuthSessionData | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<AppNotificationItem | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<'LOGIN' | 'REGISTRATION'>('LOGIN');
  const [welcomeData, setWelcomeData] = useState<{
    companyName?: string;
    accountCode?: string;
    userName?: string;
  }>({});
  const [isResumingRegistration, setIsResumingRegistration] = useState<boolean>(false);

  // Client Registration State
  const [profileData, setProfileData] = useState<ClientProfileFormData | undefined>(undefined);
  const [businessDetails, setBusinessDetails] = useState<ClientBusinessDetails | undefined>(undefined);
  const [clientDocuments, setClientDocuments] = useState<ClientDocumentItem[]>([]);
  const [registeredClientId, setRegisteredClientId] = useState<string>('');

  // Pending Verified Registration Submission State (Form -> Review -> Send OTP -> Verify -> Submit)
  const [pendingRegistration, setPendingRegistration] = useState<{
    role: MobileRole;
    targetPhone: string;
    clientSubmissionData?: any;
    vendorFormData?: any;
    driverSubmissionData?: any;
  } | null>(null);

  // Transport Requirement Flow State
  const [requirementDraft, setRequirementDraft] = useState<TransportRequirementDraft>(
    createFreshRequirementDraft()
  );
  const [activeRequirementId, setActiveRequirementId] = useState<string>('');

  const handleStartNewRequirement = async () => {
    const effectiveClientId = session?.userId || registeredClientId;
    try {
      const existingDraft = await clientService.getTransportRequirementDraft(effectiveClientId);
      if (
        existingDraft &&
        (existingDraft.vehicleTypeRequired ||
          existingDraft.materialType ||
          existingDraft.pickupAddress ||
          (existingDraft.vehicleGroups && existingDraft.vehicleGroups.length > 0))
      ) {
        setRequirementDraft((prev) => ({
          ...createFreshRequirementDraft(),
          ...existingDraft,
        }));
      } else {
        setRequirementDraft(createFreshRequirementDraft());
      }
    } catch {
      setRequirementDraft(createFreshRequirementDraft());
    }
    setCurrentScreen('CREATE_REQUIREMENT');
  };

  // Quotation & Booking Flow State
  const [activeQuotations, setActiveQuotations] = useState<any[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string>('');
  const [activeTrackingId, setActiveTrackingId] = useState<string>('');

  // Vendor Registration & Operations Flow State
  const [registeredVendorId, setRegisteredVendorId] = useState<string>('');
  const [vendorApplicationNumber, setVendorApplicationNumber] = useState<string>('');
  const [selectedVendorRequirement, setSelectedVendorRequirement] = useState<any | null>(null);
  const [activeQuotationResult, setActiveQuotationResult] = useState<{
    quotationId: string;
    quotedRate: number;
    transitDays: number;
  }>({
    quotationId: '',
    quotedRate: 0,
    transitDays: 0,
  });
  const [selectedVendorQuotation, setSelectedVendorQuotation] = useState<any | null>(null);
  const [selectedVendorBooking, setSelectedVendorBooking] = useState<any | null>(null);
  const [selectedAssignVehicle, setSelectedAssignVehicle] = useState<any | null>(null);
  const [selectedAssignDriver, setSelectedAssignDriver] = useState<any | null>(null);
  const [activeVendorTripId, setActiveVendorTripId] = useState<string>('');

  const effectiveVendorId = (session as any)?.vendorId || session?.userId || registeredVendorId;

  // Vendor Update / Missing Steps Flow State
  const [vendorUpdateFlow, setVendorUpdateFlow] = useState<{
    active: boolean;
    onlyIncompleteSteps: boolean;
    incompleteStepIndices: number[];
  }>({
    active: false,
    onlyIncompleteSteps: false,
    incompleteStepIndices: [],
  });

  const startVendorUpdateWorkflow = async (targetVendorId?: string, targetPhone?: string) => {
    const vId = targetVendorId || effectiveVendorId;
    const phone = targetPhone || mobileNumber || session?.mobile;
    setIsResumingRegistration(true);
    await vendorService.loadAuthenticatedVendorRegistration(vId, phone);
    const validation = await vendorService.getVendorRegistrationStepValidation(vId, phone);

    if (validation.incompleteSteps.length > 0) {
      const incompleteIndices = validation.incompleteSteps.map((s) => s.stepIndex);
      setVendorUpdateFlow({
        active: true,
        onlyIncompleteSteps: true,
        incompleteStepIndices: incompleteIndices,
      });
      setCurrentScreen(validation.firstIncompleteStep?.screenId || 'VENDOR_APPLICATION_REVIEW');
    } else {
      setVendorUpdateFlow({
        active: true,
        onlyIncompleteSteps: false,
        incompleteStepIndices: [],
      });
      setCurrentScreen('VENDOR_APPLICATION_REVIEW');
    }
  };

  const handleVendorStepNext = async (stepIndex: number, data?: any) => {
    if (data) {
      if (stepIndex === 7) {
        const step7Data = Array.isArray(data) ? { documents: data } : data;
        await vendorService.saveActiveRegistrationStep(7, step7Data, mobileNumber);
      } else {
        await vendorService.saveActiveRegistrationStep(stepIndex, data, mobileNumber);
      }
    }

    if (vendorUpdateFlow.active && vendorUpdateFlow.onlyIncompleteSteps) {
      const remainingIncomplete = vendorUpdateFlow.incompleteStepIndices.filter(
        (idx) => idx > stepIndex
      );
      if (remainingIncomplete.length > 0) {
        const nextStepIdx = remainingIncomplete[0];
        setCurrentScreen(VENDOR_STEP_SCREEN_MAP[nextStepIdx]);
        return;
      }
      setCurrentScreen('VENDOR_APPLICATION_REVIEW');
      return;
    }

    const nextStepIdx = stepIndex + 1;
    if (nextStepIdx <= 7) {
      setCurrentScreen(VENDOR_STEP_SCREEN_MAP[nextStepIdx]);
    } else {
      setCurrentScreen('VENDOR_APPLICATION_REVIEW');
    }
  };

  const handleVendorStepBack = (stepIndex: number) => {
    if (vendorUpdateFlow.active && vendorUpdateFlow.onlyIncompleteSteps) {
      const prevIncomplete = vendorUpdateFlow.incompleteStepIndices.filter(
        (idx) => idx < stepIndex
      );
      if (prevIncomplete.length > 0) {
        const prevStepIdx = prevIncomplete[prevIncomplete.length - 1];
        setCurrentScreen(VENDOR_STEP_SCREEN_MAP[prevStepIdx]);
        return;
      }
      setCurrentScreen('VENDOR_VERIFICATION_STATUS');
      return;
    }

    if (stepIndex === 1) {
      if (vendorUpdateFlow.active) {
        setCurrentScreen('VENDOR_VERIFICATION_STATUS');
      } else {
        vendorService.clearDraftForm();
        setCurrentScreen('LOGIN');
      }
    } else {
      const prevStepIdx = stepIndex - 1;
      setCurrentScreen(VENDOR_STEP_SCREEN_MAP[prevStepIdx]);
    }
  };

  // Driver Registration & Operations Flow State
  const [registeredDriverId, setRegisteredDriverId] = useState<string>('');
  const [driverApplicationNumber, setDriverApplicationNumber] = useState<string>('');
  const [activeDriverTripId, setActiveDriverTripId] = useState<string>('');

  const effectiveDriverId = (session as any)?.driverId || session?.userId || registeredDriverId;

  // In-App Floating Notification Banner State
  const [inAppToast, setInAppToast] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    role?: MobileRole;
  } | null>(null);

  // Initialize notifications for Client, Vendor, or Driver
  const triggerLoginNotification = useCallback(async (userSession: AuthSessionData) => {
    try {
      const res = await mobileNotificationService.initializeLoginNotifications({
        userId: userSession.userId,
        role: userSession.role,
        mobile: userSession.mobile,
        fullName: userSession.fullName || userSession.companyName,
      });
      if (res?.welcome?.title) {
        setInAppToast({
          visible: true,
          title: res.welcome.title,
          subtitle: res.welcome.body,
          role: userSession.role,
        });
        setTimeout(() => {
          setInAppToast(null);
        }, 6000);
      }
    } catch (e) {
      console.warn('Failed to initialize notifications:', e);
    }
  }, []);

  // Foreground FCM Push Notification listener
  useEffect(() => {
    const unsubscribe = mobileNotificationService.setupForegroundHandler((remoteMessage) => {
      const notifTitle = remoteMessage?.notification?.title || remoteMessage?.data?.title || 'THE TRUCKX Alert';
      const notifBody = remoteMessage?.notification?.body || remoteMessage?.data?.body || 'New operational update received.';
      setInAppToast({
        visible: true,
        title: notifTitle,
        subtitle: notifBody,
        role: selectedRole,
      });
      setTimeout(() => {
        setInAppToast(null);
      }, 6000);
    });
    return () => unsubscribe();
  }, [selectedRole]);

  useEffect(() => {
    (async () => {
      const existing = await authService.checkExistingSession();
      if (existing) {
        setSession(existing);
        setMobileNumber(existing.mobile);
        setSelectedRole(existing.role);
        // Automatically trigger OS notification pop-up and fetch all role notifications
        triggerLoginNotification(existing);
      }
    })();
  }, [triggerLoginNotification]);

  const verifiedClientPhoneRef = useRef<string | null>(null);

  // Guard Client Dashboard: Unapproved or incompletely registered clients must NOT bypass onboarding or access dashboard
  useEffect(() => {
    if (currentScreen === 'CLIENT_DASHBOARD' && selectedRole === 'CLIENT') {
      const checkPhone = (mobileNumber || session?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      if (checkPhone && verifiedClientPhoneRef.current === checkPhone) {
        return;
      }
      (async () => {
        if (!checkPhone) {
          if (session?.role === 'CLIENT' && session.userId) {
            return;
          }
          setCurrentScreen('LOGIN');
          return;
        }
        const statusRes = await clientService.getClientAccountStatus(checkPhone);
        if (statusRes.status !== 'APPROVED' && (statusRes as any).status !== 'ACTIVE') {
          setRegisteredClientId(statusRes.companyId || statusRes.clientCode || '');
          if (statusRes.profileCompletionStatus === 'INCOMPLETE' || statusRes.status === 'INACTIVE' || statusRes.status === 'ONBOARDING_INCOMPLETE') {
            setIsResumingRegistration(true);
            const resumed = await clientService.loadClientRegistrationData(checkPhone);
            if (resumed) {
              if (resumed.profileData) setProfileData(resumed.profileData as any);
              if (resumed.businessDetails) setBusinessDetails(resumed.businessDetails);
              if (resumed.documents) setClientDocuments(resumed.documents);
            }
            if (!businessDetails?.companyName && !profileData?.companyName) {
              setCurrentScreen('CLIENT_BUSINESS_DETAILS');
            } else if (clientDocuments.length === 0) {
              setCurrentScreen('CLIENT_DOC_UPLOAD');
            } else {
              setCurrentScreen('CLIENT_REG_REVIEW');
            }
          } else {
            setCurrentScreen('REGISTRATION_STATUS');
          }
        } else {
          verifiedClientPhoneRef.current = checkPhone;
        }
      })();
    }
  }, [currentScreen, selectedRole, mobileNumber, session]);

  // Guard Vendor Dashboard: Unapproved vendors must NOT access dashboard
  useEffect(() => {
    if (currentScreen === 'VENDOR_DASHBOARD' && selectedRole === 'VENDOR') {
      (async () => {
        const vId = effectiveVendorId;
        const phone = mobileNumber || session?.mobile;
        if (vId || phone) {
          const statusRes = await vendorService.getVendorVerificationStatus(vId, phone);
          if (statusRes.status !== 'APPROVED') {
            if (statusRes.status === 'INACTIVE') {
              await startVendorUpdateWorkflow(vId, phone);
            } else {
              setCurrentScreen('VENDOR_VERIFICATION_STATUS');
            }
          }
        }
      })();
    }
  }, [currentScreen, selectedRole, effectiveVendorId, mobileNumber, session]);

  // Guard Driver Dashboard: Unapproved drivers must NOT access dashboard
  useEffect(() => {
    if (currentScreen === 'DRIVER_DASHBOARD' && selectedRole === 'DRIVER') {
      (async () => {
        const dId = effectiveDriverId;
        const phone = mobileNumber || session?.mobile;
        const profile = await driverService.getDriverProfile(dId, phone);
        if (profile && profile.status !== 'APPROVED') {
          if (profile.status === 'INACTIVE') {
            setIsResumingRegistration(true);
            await driverService.loadAuthenticatedDriverRegistration(dId, phone);
            setCurrentScreen('DRIVER_REGISTRATION');
          } else {
            setCurrentScreen('DRIVER_VERIFICATION_STATUS');
          }
        }
      })();
    }
  }, [currentScreen, selectedRole, effectiveDriverId, mobileNumber, session]);

  const routeRoleDestination = (role: MobileRole) => {
    if (role === 'CLIENT') {
      setCurrentScreen('CLIENT_DASHBOARD');
    } else if (role === 'VENDOR') {
      setCurrentScreen('VENDOR_DASHBOARD');
    } else if (role === 'DRIVER') {
      setCurrentScreen('DRIVER_DASHBOARD');
    } else {
      setCurrentScreen('REGISTRATION_STATUS');
    }
  };

  // 01. Splash Callbacks
  const handleSessionFoundFromSplash = async (existing: AuthSessionData) => {
    setSession(existing);
    setMobileNumber(existing.mobile);
    setSelectedRole(existing.role);

    try {
      const completion = await authService.checkRegistrationCompletion(existing.role, existing.mobile, existing);
      if (completion.accountStatus === 'APPROVED' || completion.accountStatus === 'ACTIVE') {
        setIsResumingRegistration(false);
        routeRoleDestination(existing.role);
      } else if (!completion.isComplete) {
        setIsResumingRegistration(true);
        if (existing.role === 'CLIENT') {
          const resumed = completion.resumedData || (await clientService.loadClientRegistrationData(existing.mobile));
          if (resumed) {
            if (resumed.profileData) setProfileData(resumed.profileData as any);
            if (resumed.businessDetails) setBusinessDetails(resumed.businessDetails);
            if (resumed.documents) setClientDocuments(resumed.documents);
          }
        } else if (existing.role === 'VENDOR') {
          const vId = (existing as any).vendorId || existing.userId;
          await vendorService.loadAuthenticatedVendorRegistration(vId, existing.mobile);
        } else if (existing.role === 'DRIVER') {
          const dId = (existing as any).driverId || existing.userId;
          await driverService.loadAuthenticatedDriverRegistration(dId, existing.mobile);
        }
        setCurrentScreen(completion.nextScreen);
      } else {
        // Complete but pending approval / under review
        setIsResumingRegistration(false);
        if (existing.role === 'CLIENT') {
          setCurrentScreen('REGISTRATION_STATUS');
        } else if (existing.role === 'VENDOR') {
          setCurrentScreen('VENDOR_VERIFICATION_STATUS');
        } else {
          setCurrentScreen('DRIVER_VERIFICATION_STATUS');
        }
      }
    } catch {
      routeRoleDestination(existing.role);
    }
  };

  // 03. Login Callbacks
  const handleLoginContinueToOtp = (
    phone: string,
    purpose: 'LOGIN' | 'REGISTRATION' = 'LOGIN',
    testCode?: string
  ) => {
    setMobileNumber(phone);
    setOtpPurpose(purpose);
    setTestOtpCode(testCode || process.env.EXPO_PUBLIC_MOCK_OTP_CODE || '12345');
    setCurrentScreen('OTP');
  };

  const handleNavigateToRoleRegistration = async (role: MobileRole, phone?: string) => {
    setSelectedRole(role);
    if (phone) {
      const clean = phone.replace(/\D/g, '').slice(-10);
      setMobileNumber(clean);
      if (clean.length === 10) {
        try {
          const roleCheck = await authService.checkExistingRoleInDatabase(clean, role);
          if (roleCheck.hasExistingDifferentRole) {
            Alert.alert(
              'Registration Restricted',
              `This mobile number is already registered under the ${roleCheck.previousRoleLabel} role. You cannot register under another role using the same mobile number.`
            );
            return;
          }
        } catch { }
      }
    }
    setIsResumingRegistration(false);

    // Preserve and restore any existing registration draft for this role
    if (role === 'CLIENT') {
      try {
        const clientDraft = await clientService.getRegistrationDraft();
        if (clientDraft) {
          if (clientDraft.profileData) setProfileData(clientDraft.profileData);
          if (clientDraft.businessDetails) setBusinessDetails(clientDraft.businessDetails);
          if (clientDraft.documents) setClientDocuments(clientDraft.documents);
        }
      } catch { }
    }

    if (role === 'CLIENT') {
      setCurrentScreen('REGISTRATION');
    } else if (role === 'VENDOR') {
      setCurrentScreen('VENDOR_REGISTRATION');
    } else if (role === 'DRIVER') {
      setCurrentScreen('DRIVER_REGISTRATION');
    }
  };

  const handleDirectLoginSuccess = async (newSession: AuthSessionData) => {
    setSession(newSession);
    setSelectedRole(newSession.role);
    setMobileNumber(newSession.mobile);

    try {
      const completion = await authService.checkRegistrationCompletion(newSession.role, newSession.mobile, newSession);
      if (completion.accountStatus === 'APPROVED' || completion.accountStatus === 'ACTIVE') {
        setIsResumingRegistration(false);
        routeRoleDestination(newSession.role);
      } else if (!completion.isComplete) {
        setIsResumingRegistration(true);
        setCurrentScreen(completion.nextScreen);
      } else {
        setIsResumingRegistration(false);
        if (newSession.role === 'CLIENT') {
          setCurrentScreen('REGISTRATION_STATUS');
        } else if (newSession.role === 'VENDOR') {
          setCurrentScreen('VENDOR_VERIFICATION_STATUS');
        } else {
          setCurrentScreen('DRIVER_VERIFICATION_STATUS');
        }
      }
    } catch {
      routeRoleDestination(newSession.role);
    }
  };

  // 04. Registration Callbacks (Proceeds to Form completion without initial OTP)
  const handleRegisterSuccess = (
    phone: string,
    role: MobileRole,
    testCode?: string,
    draft?: any
  ) => {
    setMobileNumber(phone);
    setSelectedRole(role);
    setIsResumingRegistration(false);
    if (draft && role === 'CLIENT') {
      setProfileData((prev) => ({
        fullName: draft.fullName,
        emailAddress: draft.emailAddress || draft.email,
        mobileNumber: phone,
        companyPhone: draft.companyPhone || '',
        designation: prev?.designation || '',
        department: prev?.department || '',
        companyName: draft.companyName || prev?.companyName || '',
        gstNumber: prev?.gstNumber || '',
        businessType: prev?.businessType || '',
      }));
      // Move directly to Step 2: Business Details!
      setCurrentScreen('CLIENT_BUSINESS_DETAILS');
      return;
    } else if (role === 'VENDOR') {
      setCurrentScreen('VENDOR_REGISTRATION');
      return;
    } else if (role === 'DRIVER') {
      setCurrentScreen('DRIVER_REGISTRATION');
      return;
    }
  };

  // 05. OTP Callbacks
  const handleOtpVerifiedExistingUser = async (role: MobileRole, profile: any, accountStatus?: string) => {
    setSelectedRole(role);
    const cleanPhone = (mobileNumber || profile?.mobile || session?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone) setMobileNumber(cleanPhone);

    const completion = await authService.checkRegistrationCompletion(role, cleanPhone || mobileNumber, profile);

    const isApproved =
      completion.accountStatus === 'APPROVED' ||
      completion.accountStatus === 'ACTIVE' ||
      accountStatus === 'APPROVED' ||
      accountStatus === 'ACTIVE';

    if (isApproved && completion.isComplete) {
      setIsResumingRegistration(false);
      let activeSession = await authService.checkExistingSession();
      if (!activeSession) {
        const resolvedId =
          profile?.clientId ||
          profile?.vendorId ||
          profile?.driverId ||
          profile?.id ||
          registeredClientId ||
          `${role.toLowerCase()}-${cleanPhone}`;
        activeSession = {
          userId: resolvedId,
          mobile: cleanPhone || mobileNumber,
          role,
          fullName: profile?.name || profile?.fullName || `${role} User`,
          companyName: profile?.company || profile?.companyName || (role === 'CLIENT' ? 'Client Enterprise' : 'Transport Firm'),
          token: 'auth-session-approved-' + Date.now(),
          createdAt: new Date().toISOString(),
          accountStatus: 'APPROVED',
          isRegistrationComplete: true,
        };
        await authService.saveSession(activeSession);
      }
      setSession(activeSession);
      // Automatically trigger OS notification pop-up & pre-fetch role-specific notifications upon login
      triggerLoginNotification(activeSession);

      if (role === 'CLIENT' && (profile?.companyId || profile?.clientId)) {
        setRegisteredClientId(profile?.companyId || profile?.clientId);
      }
      if (role === 'VENDOR' && (profile?.vendorId || profile?.id)) {
        setRegisteredVendorId(profile?.vendorId || profile?.id);
      }
      if (role === 'DRIVER' && (profile?.driverId || profile?.id)) {
        setRegisteredDriverId(profile?.driverId || profile?.id);
      }
      routeRoleDestination(role);
      return;
    }

    // Incomplete registration flow: resume missing steps with preloaded saved draft
    if (!completion.isComplete) {
      setIsResumingRegistration(true);

      if (role === 'CLIENT') {
        const resumed = completion.resumedData || (await clientService.loadClientRegistrationData(cleanPhone || mobileNumber));
        if (resumed) {
          if (resumed.profileData) setProfileData(resumed.profileData as any);
          if (resumed.businessDetails) setBusinessDetails(resumed.businessDetails);
          if (resumed.documents) setClientDocuments(resumed.documents);
        }
        setCurrentScreen(completion.nextScreen || 'CLIENT_BUSINESS_DETAILS');
        return;
      }

      if (role === 'VENDOR') {
        const vId = profile?.vendorId || profile?.id || effectiveVendorId;
        await startVendorUpdateWorkflow(vId, cleanPhone || mobileNumber);
        return;
      }

      if (role === 'DRIVER') {
        const dId = profile?.driverId || profile?.id || effectiveDriverId;
        await driverService.loadAuthenticatedDriverRegistration(dId, cleanPhone || mobileNumber);
        setCurrentScreen('DRIVER_REGISTRATION');
        return;
      }
    }

    // Registration complete, but pending admin approval / verification
    setIsResumingRegistration(false);
    if (role === 'CLIENT') {
      const resolvedClientId =
        completion.resumedData?.companyId ||
        profile?.clientId ||
        profile?.id ||
        registeredClientId ||
        `cli-${cleanPhone}`;
      setRegisteredClientId(resolvedClientId);
      setCurrentScreen('REGISTRATION_STATUS');
      return;
    }

    if (role === 'VENDOR') {
      const vId = profile?.vendorId || profile?.id || effectiveVendorId;
      if (vId) setRegisteredVendorId(vId);
      setCurrentScreen('VENDOR_VERIFICATION_STATUS');
      return;
    }

    if (role === 'DRIVER') {
      const dId = profile?.driverId || profile?.id || effectiveDriverId;
      if (dId) setRegisteredDriverId(dId);
      setCurrentScreen('DRIVER_VERIFICATION_STATUS');
      return;
    }
  };

  const handleOtpVerifiedNewUser = async () => {
    setIsResumingRegistration(false);
    const cleanPhone = (mobileNumber || '').replace(/[^0-9]/g, '').slice(-10);

    // If an application was submitted through the Review -> OTP verification flow:
    if (pendingRegistration) {
      if (pendingRegistration.role === 'CLIENT' && pendingRegistration.clientSubmissionData) {
        try {
          const result = await clientService.submitCompleteRegistration(pendingRegistration.clientSubmissionData);
          const resolvedId = result.clientCode || result.companyId || `CLI-${Date.now()}`;
          setRegisteredClientId(resolvedId);

          const newSession: AuthSessionData = {
            userId: resolvedId,
            mobile: cleanPhone,
            role: 'CLIENT',
            fullName: pendingRegistration.clientSubmissionData.fullName,
            companyName: pendingRegistration.clientSubmissionData.companyName,
            token: 'auth-session-client-' + Date.now(),
            createdAt: new Date().toISOString(),
            accountStatus: 'PENDING_APPROVAL',
            isRegistrationComplete: true,
          };
          await authService.saveSession(newSession);
          setSession(newSession);

          // Automatically trigger OS notification pop-up & pre-fetch client notifications
          triggerLoginNotification(newSession);

          setWelcomeData({
            companyName: pendingRegistration.clientSubmissionData.companyName,
            accountCode: resolvedId,
            userName: pendingRegistration.clientSubmissionData.fullName,
          });
          await clientService.clearRegistrationDraft();
          setPendingRegistration(null);
          setCurrentScreen('WELCOME_TO_NECL');
          return;
        } catch (err: any) {
          Alert.alert('Registration Submission Error', err.message || 'Failed to submit client application.');
          setCurrentScreen('CLIENT_REG_REVIEW');
          return;
        }
      } else if (pendingRegistration.role === 'VENDOR' && pendingRegistration.vendorFormData) {
        try {
          const result = await vendorService.submitVendorRegistration(pendingRegistration.vendorFormData, pendingRegistration.targetPhone);
          const vId = result.vendorId || result.applicationNumber || `VND-${Date.now()}`;
          setRegisteredVendorId(vId);
          setVendorApplicationNumber(result.applicationNumber || vId);

          const newSession: AuthSessionData = {
            userId: vId,
            mobile: cleanPhone,
            role: 'VENDOR',
            fullName: pendingRegistration.vendorFormData.contactPerson || pendingRegistration.vendorFormData.companyName,
            companyName: pendingRegistration.vendorFormData.companyName,
            token: 'auth-session-vendor-' + Date.now(),
            createdAt: new Date().toISOString(),
            accountStatus: 'PENDING_APPROVAL',
            isRegistrationComplete: true,
          };
          await authService.saveSession(newSession);
          setSession(newSession);

          // Trigger vendor welcome notification and token registration
          triggerLoginNotification(newSession);

          setWelcomeData({
            companyName: pendingRegistration.vendorFormData.companyName,
            accountCode: result.applicationNumber || vId,
            userName: pendingRegistration.vendorFormData.contactPerson,
          });
          await vendorService.clearDraftForm();
          setPendingRegistration(null);
          setCurrentScreen('WELCOME_TO_NECL');
          return;
        } catch (err: any) {
          Alert.alert('Registration Submission Error', err.message || 'Failed to submit vendor application.');
          setCurrentScreen('VENDOR_APPLICATION_REVIEW');
          return;
        }
      } else if (pendingRegistration.role === 'DRIVER' && pendingRegistration.driverSubmissionData) {
        try {
          const result = await driverService.submitDriverRegistration(pendingRegistration.driverSubmissionData, pendingRegistration.targetPhone);
          const dId = result.driverId || result.applicationNumber || `DRV-${Date.now()}`;
          setRegisteredDriverId(dId);
          setDriverApplicationNumber(result.applicationNumber || dId);

          const newSession: AuthSessionData = {
            userId: dId,
            mobile: cleanPhone,
            role: 'DRIVER',
            fullName: pendingRegistration.driverSubmissionData.fullName,
            companyName: pendingRegistration.driverSubmissionData.selectedVendorName,
            token: 'auth-session-driver-' + Date.now(),
            createdAt: new Date().toISOString(),
            accountStatus: 'PENDING_APPROVAL',
            isRegistrationComplete: true,
          };
          await authService.saveSession(newSession);
          setSession(newSession);

          // Trigger driver welcome notification and token registration
          triggerLoginNotification(newSession);

          setWelcomeData({
            companyName: pendingRegistration.driverSubmissionData.selectedVendorName,
            accountCode: result.applicationNumber || dId,
            userName: pendingRegistration.driverSubmissionData.fullName,
          });
          await driverService.clearDraftForm();
          try {
            await AsyncStorage.removeItem('@necl_driver_draft_uris');
          } catch { }
          setPendingRegistration(null);
          setCurrentScreen('WELCOME_TO_NECL');
          return;
        } catch (err: any) {
          Alert.alert('Registration Submission Error', err.message || 'Failed to submit driver application.');
          setCurrentScreen('DRIVER_REGISTRATION');
          return;
        }
      }
    }

    // Default fallback
    if (selectedRole === 'CLIENT') {
      setCurrentScreen('CLIENT_BUSINESS_DETAILS');
    } else if (selectedRole === 'VENDOR') {
      setCurrentScreen('VENDOR_REGISTRATION');
    } else {
      setCurrentScreen('DRIVER_REGISTRATION');
    }
  };

  const handleShowTermsNotice = () => {
    Alert.alert(
      'Terms & Privacy Policy',
      'TRUCKS Logistics Platform\n\n' +
      '• Commercial Carriage: All cargo movements strictly adhere to Carriage by Road Act 2007 guidelines.\n' +
      '• Digital POD: Consignees confirm digital delivery sign-off and verification within 24 hours.\n' +
      '• Telematics & Security: Real-time GPS tracking is active solely during active trips for safety and ETA accuracy.\n' +
      '• Privacy & Compliance: KYC and billing credentials are encrypted and never shared with third parties.',
      [{ text: 'Close', style: 'default' }]
    );
  };

  // 18. Secure Logout & Session Termination
  const handleLogout = async () => {
    await authService.clearSession();
    setSession(null);
    setSelectedNotification(null);
    setIsResumingRegistration(false);
    setCurrentScreen('LOGIN');
  };

  const isLightStatusBar = currentScreen === 'ONBOARDING';

  return (
    <View style={styles.rootContainer}>
      <StatusBar
        style={isLightStatusBar ? 'light' : 'dark'}
        backgroundColor={isLightStatusBar ? '#0A1931' : '#FFFFFF'}
        translucent={false}
      />

      {/* Floating In-App Push Notification / Welcome Banner */}
      {inAppToast?.visible && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            setInAppToast(null);
            setCurrentScreen('NOTIFICATIONS');
          }}
          style={styles.floatingToastCard}
        >
          <View style={styles.floatingToastIconWrap}>
            <Bell size={20} color="#FFFFFF" />
          </View>
          <View style={styles.floatingToastTextCol}>
            <View style={styles.floatingToastHeaderRow}>
              <Text style={styles.floatingToastRoleBadge}>
                {inAppToast.role || 'THE TRUCKX'}
              </Text>
              <Text style={styles.floatingToastTime}>Just now</Text>
            </View>
            <Text style={styles.floatingToastTitle} numberOfLines={1}>
              {inAppToast.title}
            </Text>
            <Text style={styles.floatingToastSubtitle} numberOfLines={2}>
              {inAppToast.subtitle}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.floatingToastCloseBtn}
            onPress={() => setInAppToast(null)}
          >
            <X size={16} color="#94A3B8" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {isResumingRegistration &&
        (currentScreen.startsWith('CLIENT_') ||
          currentScreen.startsWith('VENDOR_') ||
          currentScreen.startsWith('DRIVER_') ||
          currentScreen === 'REGISTRATION') &&
        !currentScreen.includes('DASHBOARD') &&
        !currentScreen.includes('STATUS') &&
        !currentScreen.includes('CONFIRM') && (
          <View style={styles.resumingBanner}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#D97706" />
              <Text style={styles.resumingBannerText}>
                Complete Your Registration: Resume remaining required registration steps and submit for TRUCKS verification.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsResumingRegistration(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#92400E" />
            </TouchableOpacity>
          </View>
        )}

      {/* Screen 01: SPLASH SCREEN */}
      {currentScreen === 'SPLASH' && (
        <SplashScreen
          onSessionFound={handleSessionFoundFromSplash}
          onFirstTimeUser={() => setCurrentScreen('LOGIN')}
          onReturningUser={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 02: ONBOARDING SCREEN */}
      {currentScreen === 'ONBOARDING' && (
        <OnboardingScreen
          onFinishOnboarding={() => setCurrentScreen('LOGIN')}
          onSkip={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 03: LOGIN SCREEN */}
      {currentScreen === 'LOGIN' && (
        <LoginScreen
          initialMobile={mobileNumber}
          selectedRole={selectedRole}
          onBack={() => setCurrentScreen('SPLASH')}
          onContinueToOtp={handleLoginContinueToOtp}
          onLoginSuccess={handleDirectLoginSuccess}
          onRoleChanged={(r) => setSelectedRole(r)}
          onRegisterPress={() => handleNavigateToRoleRegistration(selectedRole, mobileNumber)}
          onNavigateToRegistration={(r, m) => handleNavigateToRoleRegistration(r, m)}
        />
      )}

      {/* Screen 04: REGISTRATION SCREEN */}
      {currentScreen === 'REGISTRATION' && (
        <RegistrationScreen
          initialRole={selectedRole}
          onBack={() => setCurrentScreen('LOGIN')}
          onGoToLogin={() => setCurrentScreen('LOGIN')}
          onRegisterSuccess={handleRegisterSuccess}
          onViewTerms={handleShowTermsNotice}
        />
      )}

      {/* Screen 05: OTP VERIFICATION SCREEN */}
      {currentScreen === 'OTP' && (
        <OtpScreen
          role={selectedRole}
          mobileNumber={mobileNumber}
          testCode={testOtpCode}
          purpose={otpPurpose}
          onBack={() => {
            if (otpPurpose === 'REGISTRATION') {
              if (selectedRole === 'CLIENT') {
                setCurrentScreen('CLIENT_REG_REVIEW');
              } else if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_APPLICATION_REVIEW');
              } else {
                setCurrentScreen('DRIVER_REGISTRATION');
              }
            } else {
              setCurrentScreen('LOGIN');
            }
          }}
          onVerifiedNewUser={handleOtpVerifiedNewUser}
          onVerifiedExistingUser={handleOtpVerifiedExistingUser}
        />
      )}

      {/* Screen 11 / Screen 6: REGISTRATION AND ACCOUNT STATUS SCREEN */}
      {currentScreen === 'REGISTRATION_STATUS' && (
        <RegistrationStatusScreen
          userRole={selectedRole}
          userId={session?.userId || registeredClientId || mobileNumber}
          onApprovedContinue={async () => {
            const checkPhone = mobileNumber || session?.mobile;
            let targetComp = businessDetails?.companyName || profileData?.companyName || 'Enterprise Partner';
            let targetCode = registeredClientId || 'CLI-APPROVED';
            let targetName = profileData?.fullName || 'Client Representative';

            if (checkPhone) {
              const statusRes = await clientService.getClientAccountStatus(checkPhone, true);
              if (statusRes.companyName) targetComp = statusRes.companyName;
              if (statusRes.clientCode || statusRes.companyId) targetCode = statusRes.clientCode || statusRes.companyId || 'CLI-APPROVED';
              if (statusRes.fullName) targetName = statusRes.fullName;

              const newSession: AuthSessionData = {
                userId: statusRes.companyId || registeredClientId || 'client-user',
                mobile: checkPhone,
                role: 'CLIENT',
                fullName: targetName,
                companyName: targetComp,
                token: 'auth-session-approved-' + Date.now(),
                createdAt: new Date().toISOString(),
                accountStatus: 'APPROVED',
                isRegistrationComplete: true,
              };
              setSession(newSession);
              await authService.saveSession(newSession);
              verifiedClientPhoneRef.current = checkPhone.replace(/[^0-9]/g, '').slice(-10);
            }

            if (selectedRole === 'CLIENT') {
              setCurrentScreen('CLIENT_DASHBOARD');
            } else if (selectedRole === 'VENDOR') {
              setCurrentScreen('VENDOR_DASHBOARD');
            } else {
              setCurrentScreen('DRIVER_DASHBOARD');
            }
          }}
          onFixCorrections={() => setCurrentScreen('CLIENT_DOC_UPLOAD')}
          onOpenSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onBack={() => (session ? setCurrentScreen('PROFILE') : setCurrentScreen('LOGIN'))}
        />
      )}

      {/* Screen: WELCOME TO NECL SUCCESS SCREEN */}
      {currentScreen === 'WELCOME_TO_NECL' && (
        <WelcomeToNeclScreen
          role={selectedRole}
          companyName={welcomeData.companyName}
          accountCode={welcomeData.accountCode}
          userName={welcomeData.userName}
          onContinueToDashboard={() => {
            const isApproved = session?.accountStatus === 'APPROVED' || session?.accountStatus === 'ACTIVE';
            if (isApproved) {
              if (selectedRole === 'CLIENT') {
                setCurrentScreen('CLIENT_DASHBOARD');
              } else if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_DASHBOARD');
              } else if (selectedRole === 'DRIVER') {
                setCurrentScreen('DRIVER_DASHBOARD');
              }
            } else {
              // Maintain approval workflow: unapproved users remain on verification status screens
              if (selectedRole === 'CLIENT') {
                setCurrentScreen('REGISTRATION_STATUS');
              } else if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_VERIFICATION_STATUS');
              } else if (selectedRole === 'DRIVER') {
                setCurrentScreen('DRIVER_VERIFICATION_STATUS');
              }
            }
          }}
        />
      )}

      {/* Screen 12: PROFILE SCREEN */}
      {currentScreen === 'PROFILE' && (
        <ProfileScreen
          session={session}
          onBack={() => routeRoleDestination(selectedRole)}
          onNavigateToEditProfile={() => setCurrentScreen('EDIT_PROFILE')}
          onNavigateToSavedAddresses={() => setCurrentScreen('SAVED_ADDRESSES')}
          onNavigateToNotifications={() => setCurrentScreen('NOTIFICATIONS')}
          onNavigateToSettings={() => setCurrentScreen('SETTINGS')}
          onNavigateToRegistrationStatus={() => setCurrentScreen('REGISTRATION_STATUS')}
          onNavigateToHelpSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onNavigateToTerms={handleShowTermsNotice}
          onLogoutConfirm={handleLogout}
        />
      )}

      {/* Screen 13: EDIT PROFILE SCREEN */}
      {currentScreen === 'EDIT_PROFILE' && (
        <EditProfileScreen
          session={session}
          onBack={() => setCurrentScreen('PROFILE')}
          onProfileUpdated={(updated) => setSession(updated)}
        />
      )}

      {/* Screen 14 / Screen 25: NOTIFICATIONS SCREEN */}
      {currentScreen === 'NOTIFICATIONS' && (
        <NotificationsScreen
          onBack={() =>
            setCurrentScreen(
              selectedRole === 'CLIENT'
                ? 'CLIENT_DASHBOARD'
                : selectedRole === 'VENDOR'
                  ? 'VENDOR_DASHBOARD'
                  : selectedRole === 'DRIVER'
                    ? 'DRIVER_DASHBOARD'
                    : 'PROFILE'
            )
          }
          onSelectNotification={(item) => {
            setSelectedNotification(item);
            setCurrentScreen('NOTIFICATION_DETAILS');
          }}
        />
      )}

      {/* Screen 15: NOTIFICATION DETAILS SCREEN */}
      {currentScreen === 'NOTIFICATION_DETAILS' && selectedNotification && (
        <NotificationDetailsScreen
          notification={selectedNotification}
          onBack={() => setCurrentScreen('NOTIFICATIONS')}
          onViewRelatedRecord={(refId) => {
            const targetRef = refId || selectedNotification.refId;
            const category = selectedNotification.category;

            if (targetRef?.startsWith('BOK')) {
              setActiveBookingId(targetRef);
              if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_BOOKING_DETAILS');
              } else {
                setCurrentScreen('BOOKING_DETAILS');
              }
            } else if (targetRef?.startsWith('REQ')) {
              setActiveRequirementId(targetRef);
              if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_REQUIREMENT_DETAILS');
              } else {
                setCurrentScreen('REQUIREMENT_DETAILS');
              }
            } else if (
              targetRef?.startsWith('TRP') ||
              targetRef?.startsWith('NEC') ||
              targetRef?.startsWith('SHP') ||
              category === 'shipment'
            ) {
              setActiveTrackingId(targetRef || selectedNotification.id);
              setCurrentScreen('SHIPMENT_TRACKING');
            } else {
              if (selectedRole === 'VENDOR') {
                setCurrentScreen('VENDOR_DASHBOARD');
              } else if (selectedRole === 'DRIVER') {
                setCurrentScreen('DRIVER_DASHBOARD');
              } else {
                setCurrentScreen('CLIENT_DASHBOARD');
              }
            }
          }}
        />
      )}

      {/* Screen 16: SETTINGS SCREEN */}
      {currentScreen === 'SETTINGS' && (
        <SettingsScreen
          onBack={() =>
            setCurrentScreen(
              selectedRole === 'DRIVER' ? 'DRIVER_DASHBOARD' : 'PROFILE'
            )
          }
          onNavigateToTerms={handleShowTermsNotice}
          onNavigateToSupport={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 17 / Screen 26: HELP & SUPPORT SCREEN */}
      {currentScreen === 'HELP_SUPPORT' && (
        <HelpSupportScreen
          session={session}
          onBack={() =>
            setCurrentScreen(
              selectedRole === 'CLIENT'
                ? 'CLIENT_DASHBOARD'
                : selectedRole === 'VENDOR'
                  ? 'VENDOR_DASHBOARD'
                  : selectedRole === 'DRIVER'
                    ? 'DRIVER_DASHBOARD'
                    : 'PROFILE'
            )
          }
        />
      )}



      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CLIENT MODULE SCREENS 1 TO 24                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Screen 1: Client Profile Setup */}
      {currentScreen === 'CLIENT_PROFILE' && (
        <ClientProfileSetupScreen
          initialMobile={mobileNumber}
          initialData={profileData || undefined}
          onBack={() => {
            setProfileData(undefined);
            setBusinessDetails(undefined);
            setClientDocuments([]);
            setCurrentScreen('LOGIN');
          }}
          onSuccess={async (data) => {
            setProfileData(data);
            await clientService.saveActiveRegistrationStep(1, { profileData: data, mobile: mobileNumber });
            setCurrentScreen('CLIENT_BUSINESS_DETAILS');
          }}
        />
      )}

      {/* Screen 2: Client Business Details */}
      {currentScreen === 'CLIENT_BUSINESS_DETAILS' && (
        <ClientBusinessDetailsScreen
          initialCompanyName={profileData?.companyName}
          initialDetails={businessDetails || undefined}
          onBack={() => setCurrentScreen('CLIENT_PROFILE')}
          onContinue={async (details) => {
            setBusinessDetails(details);
            await clientService.saveActiveRegistrationStep(2, { profileData, businessDetails: details, mobile: mobileNumber });
            setCurrentScreen('CLIENT_DOC_UPLOAD');
          }}
        />
      )}

      {/* Screen 3: Client Document Upload */}
      {currentScreen === 'CLIENT_DOC_UPLOAD' && (
        <ClientDocumentUploadScreen
          businessType={businessDetails?.businessType}
          companyName={businessDetails?.companyName}
          initialDocuments={clientDocuments}
          onBack={() => setCurrentScreen('CLIENT_BUSINESS_DETAILS')}
          onContinue={async (docs) => {
            setClientDocuments(docs);
            await clientService.saveActiveRegistrationStep(3, { profileData, businessDetails, documents: docs, mobile: mobileNumber });
            setCurrentScreen('CLIENT_REG_REVIEW');
          }}
        />
      )}

      {/* Screen 4: Client Registration Review */}
      {currentScreen === 'CLIENT_REG_REVIEW' && (
        <ClientRegistrationReviewScreen
          profileData={
            profileData || {
              fullName: 'Enterprise Representative',
              mobileNumber,
              emailAddress: 'logistics@enterprise.in',
              designation: 'Logistics Manager',
              department: 'Supply Chain',
              companyName: businessDetails?.companyName || 'Enterprise Partner',
              gstNumber: businessDetails?.gstin || '',
              businessType: businessDetails?.businessType || 'Private Limited',
            }
          }
          businessDetails={
            businessDetails || {
              companyName: profileData?.companyName || 'Enterprise Partner',
              gstin: profileData?.gstNumber || '',
              pan: '',
              businessType: profileData?.businessType || 'Private Limited',
              registeredAddress: 'Industrial Zone',
              city: 'Guwahati',
              state: 'Assam',
              pincode: '781001',
            }
          }
          documents={clientDocuments}
          onBack={() => setCurrentScreen('CLIENT_DOC_UPLOAD')}
          onEditContact={() => setCurrentScreen('CLIENT_PROFILE')}
          onEditBusiness={() => setCurrentScreen('CLIENT_BUSINESS_DETAILS')}
          onEditDocuments={() => setCurrentScreen('CLIENT_DOC_UPLOAD')}
          onProceedToOtp={(data) => {
            setPendingRegistration({
              role: 'CLIENT',
              targetPhone: data.targetPhone,
              clientSubmissionData: data.submissionData,
            });
            setMobileNumber(data.targetPhone);
            setSelectedRole('CLIENT');
            setOtpPurpose('REGISTRATION');
            setTestOtpCode(data.testCode || '12345');
            setCurrentScreen('OTP');
          }}
          onSubmitSuccess={(assignedId) => {
            setRegisteredClientId(assignedId);
            setBusinessDetails((prev) => ({
              ...prev!,
              submittedAt: new Date().toISOString(),
            }));
            setCurrentScreen('CLIENT_REG_CONFIRM');
          }}
        />
      )}

      {/* Screen 5: Client Registration Confirmation */}
      {currentScreen === 'CLIENT_REG_CONFIRM' && (
        <ClientRegistrationConfirmationScreen
          clientId={registeredClientId}
          mobileNumber={mobileNumber || session?.mobile}
          businessDetails={businessDetails}
          onTrackStatus={() => setCurrentScreen('REGISTRATION_STATUS')}
          onFixCorrections={() => setCurrentScreen('CLIENT_DOC_UPLOAD')}
          onGoToDashboard={async () => {
            const checkPhone = mobileNumber || session?.mobile;
            let targetComp = businessDetails?.companyName || profileData?.companyName || 'Enterprise Partner';
            let targetCode = registeredClientId || 'CLI-APPROVED';
            let targetName = profileData?.fullName || 'Client Representative';

            if (checkPhone) {
              const statusRes = await clientService.getClientAccountStatus(checkPhone, true);
              if (statusRes.status === 'APPROVED' || (statusRes as any).status === 'ACTIVE') {
                if (statusRes.companyName) targetComp = statusRes.companyName;
                if (statusRes.clientCode || statusRes.companyId) targetCode = statusRes.clientCode || statusRes.companyId || 'CLI-APPROVED';
                if (statusRes.fullName) targetName = statusRes.fullName;

                const newSession: AuthSessionData = {
                  userId: statusRes.companyId || registeredClientId || 'client-user',
                  mobile: checkPhone,
                  role: 'CLIENT',
                  fullName: targetName,
                  companyName: targetComp,
                  token: 'auth-session-approved-' + Date.now(),
                  createdAt: new Date().toISOString(),
                  accountStatus: 'APPROVED',
                  isRegistrationComplete: true,
                };
                setSession(newSession);
                await authService.saveSession(newSession);
                verifiedClientPhoneRef.current = checkPhone.replace(/[^0-9]/g, '').slice(-10);

                setCurrentScreen('CLIENT_DASHBOARD');
                return;
              }
            }
            setCurrentScreen('CLIENT_DASHBOARD');
          }}
          onContactSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 7: Client Dashboard */}
      {currentScreen === 'CLIENT_DASHBOARD' && (
        <ClientDashboardScreen
          session={session}
          onLogout={handleLogout}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onNavigateToCreateRequirement={handleStartNewRequirement}
          onNavigateToRequirements={() => setCurrentScreen('MY_REQUIREMENTS')}
          onNavigateToBookings={() => setCurrentScreen('MY_BOOKINGS')}
          onNavigateToShipments={() => setCurrentScreen('MY_SHIPMENTS')}
          onNavigateToTracking={(trackId) => {
            setActiveTrackingId(trackId);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onNavigateToSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onNavigateToSavedAddresses={() => setCurrentScreen('SAVED_ADDRESSES')}
          onNavigateToNotifications={() => setCurrentScreen('NOTIFICATIONS')}
        />
      )}

      {/* Screen 8: Create Transport Requirement */}
      {currentScreen === 'CREATE_REQUIREMENT' && (
        <CreateTransportRequirementScreen
          initialDraft={requirementDraft}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onNext={(draftUpdate) => {
            setRequirementDraft((prev) => ({ ...prev, ...draftUpdate }));
            setCurrentScreen('CARGO_DETAILS');
          }}
        />
      )}

      {/* Screen 9: Cargo Details */}
      {currentScreen === 'CARGO_DETAILS' && (
        <CargoDetailsScreen
          initialDraft={requirementDraft}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CREATE_REQUIREMENT')}
          onNext={(draftUpdate) => {
            setRequirementDraft((prev) => ({ ...prev, ...draftUpdate }));
            setCurrentScreen('PICKUP_DELIVERY_DETAILS');
          }}
        />
      )}

      {/* Screen 10: Pickup and Delivery Details */}
      {currentScreen === 'PICKUP_DELIVERY_DETAILS' && (
        <PickupDeliveryDetailsScreen
          initialDraft={requirementDraft}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CARGO_DETAILS')}
          onNext={(draftUpdate) => {
            setRequirementDraft((prev) => ({ ...prev, ...draftUpdate }));
            setCurrentScreen('REQUIREMENT_REVIEW');
          }}
          onManageSavedAddresses={() => setCurrentScreen('SAVED_ADDRESSES')}
        />
      )}

      {/* Screen 11: Requirement Review */}
      {currentScreen === 'REQUIREMENT_REVIEW' && (
        <RequirementReviewScreen
          draft={requirementDraft}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('PICKUP_DELIVERY_DETAILS')}
          onEditStep={(step) => {
            if (step === 1) setCurrentScreen('CREATE_REQUIREMENT');
            else if (step === 2) setCurrentScreen('CARGO_DETAILS');
            else if (step === 3) setCurrentScreen('PICKUP_DELIVERY_DETAILS');
          }}
          onHelp={() => setCurrentScreen('HELP_SUPPORT')}
          onNavigateToFeature={(feat) => {
            if (feat === 'QUOTES') setCurrentScreen('QUOTATIONS_LIST');
            else if (feat === 'TRACKING') setCurrentScreen('MY_SHIPMENTS');
            else if (feat === 'DOCS') setCurrentScreen('MY_BOOKINGS');
            else if (feat === 'NOTIFICATIONS') setCurrentScreen('NOTIFICATIONS');
          }}
          onSubmitSuccess={(reqId) => {
            setActiveRequirementId(reqId);
            setRequirementDraft(createFreshRequirementDraft());
            setCurrentScreen('REQUIREMENT_CONFIRM');
          }}
        />
      )}

      {/* Screen 12: Requirement Submission Confirmation */}
      {currentScreen === 'REQUIREMENT_CONFIRM' && (
        <RequirementConfirmationScreen
          requirementId={activeRequirementId}
          draft={requirementDraft}
          onViewDetails={(id) => {
            setActiveRequirementId(id);
            setCurrentScreen('REQUIREMENT_DETAILS');
          }}
          onViewQuotations={(id) => {
            setActiveRequirementId(id);
            setCurrentScreen('QUOTATIONS_LIST');
          }}
          onGoToDashboard={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onCreateAnother={handleStartNewRequirement}
        />
      )}

      {/* Screen 13: My Requirements */}
      {currentScreen === 'MY_REQUIREMENTS' && (
        <MyRequirementsScreen
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onSelectRequirement={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('REQUIREMENT_DETAILS');
          }}
          onViewQuotations={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('QUOTATIONS_LIST');
          }}
          onCreateNew={handleStartNewRequirement}
        />
      )}

      {/* Screen 14: Requirement Details */}
      {currentScreen === 'REQUIREMENT_DETAILS' && (
        <RequirementDetailsScreen
          requirementId={activeRequirementId}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('MY_REQUIREMENTS')}
          onViewQuotations={(id) => {
            setActiveRequirementId(id);
            setCurrentScreen('QUOTATIONS_LIST');
          }}
          onEditRequirement={(req) => {
            setRequirementDraft({
              draftId: req.id,
              vehicleTypeRequired: req.vehicle_type || '',
              loadingDatetime: req.loading_datetime || '',
              preferredLoadingDate: req.loading_datetime ? req.loading_datetime.split('T')[0] : '',
              materialType: req.material_type || '',
              requiredCapacityMt: req.required_capacity_mt || 0,
              packagingType: req.packaging_type || '',
              pickupAddress: req.pickup_address || '',
              pickupCity: req.pickup_city || req.pickup_address?.split(',')[0] || '',
              pickupPincode: req.pickup_pincode || '',
              destinationAddress: req.destination_address || '',
              destinationCity: req.destination_city || req.destination_address?.split(',')[0] || '',
              destinationPincode: req.destination_pincode || '',
              pickupContactName: req.pickup_contact_name || '',
              pickupContactPhone: req.pickup_contact_phone || '',
              dropContactName: req.drop_contact_name || '',
              dropContactPhone: req.drop_contact_phone || '',
              specialInstructions: req.special_instructions || '',
            });
            setCurrentScreen('CREATE_REQUIREMENT');
          }}
          onViewBooking={(bokId) => {
            setActiveBookingId(bokId);
            setCurrentScreen('BOOKING_DETAILS');
          }}
        />
      )}

      {/* Screen 15: Quotations List */}
      {currentScreen === 'QUOTATIONS_LIST' && (
        <QuotationsListScreen
          requirementId={activeRequirementId}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('REQUIREMENT_DETAILS')}
          onCompare={(id, quotes) => {
            setActiveRequirementId(id);
            setActiveQuotations(quotes);
            setCurrentScreen('QUOTATION_COMPARISON');
          }}
          onViewQuoteDetails={(quote) => {
            setSelectedQuotation(quote);
            setCurrentScreen('QUOTATION_DETAILS');
          }}
          onAcceptAndBook={(quote) => {
            setSelectedQuotation(quote);
            setCurrentScreen('QUOTATION_DETAILS');
          }}
        />
      )}

      {/* Screen 16: Quotation Comparison */}
      {currentScreen === 'QUOTATION_COMPARISON' && (
        <QuotationComparisonScreen
          requirementId={activeRequirementId}
          quotations={activeQuotations}
          onBack={() => setCurrentScreen('QUOTATIONS_LIST')}
          onSelectAndBook={(quote) => {
            setSelectedQuotation(quote);
            setCurrentScreen('QUOTATION_DETAILS');
          }}
          onViewQuoteDetails={(quote) => {
            setSelectedQuotation(quote);
            setCurrentScreen('QUOTATION_DETAILS');
          }}
        />
      )}

      {/* Screen 17: Quotation Details */}
      {currentScreen === 'QUOTATION_DETAILS' && (
        <QuotationDetailsScreen
          quotation={
            selectedQuotation || {
              id: 'QT-91028471-AS01',
              vendorName: 'Assam Bengal Roadways',
              rate: 32000,
              transitTimeDays: 3,
              vehicleType: '32 FT Multi-Axle (25 MT)',
              rating: 4.8,
              completedTrips: 184,
            }
          }
          requirementId={activeRequirementId}
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('QUOTATIONS_LIST')}
          onBookingCreated={(bokId) => {
            setActiveBookingId(bokId);
            setActiveTrackingId(`NEC${bokId.slice(-8).toUpperCase()}`);
            setCurrentScreen('BOOKING_CONFIRMATION');
          }}
        />
      )}

      {/* Screen 18: Booking Confirmation */}
      {currentScreen === 'BOOKING_CONFIRMATION' && (
        <BookingConfirmationScreen
          bookingId={activeBookingId}
          onViewBookingDetails={(id) => {
            setActiveBookingId(id);
            setCurrentScreen('BOOKING_DETAILS');
          }}
          onTrackShipment={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onGoToMyBookings={() => setCurrentScreen('MY_BOOKINGS')}
          onGoToDashboard={() => setCurrentScreen('CLIENT_DASHBOARD')}
        />
      )}

      {/* Dedicated Shipments Screen */}
      {currentScreen === 'MY_SHIPMENTS' && (
        <MyShipmentsScreen
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onSelectShipment={(shipmentId) => {
            setActiveTrackingId(shipmentId);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onTrackShipment={(shipmentId) => {
            setActiveTrackingId(shipmentId);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onViewDocuments={(shipmentId) => {
            setActiveTrackingId(shipmentId);
            setCurrentScreen('SHIPMENT_DOCUMENTS');
          }}
          onViewPod={(shipmentId) => {
            setActiveTrackingId(shipmentId);
            setCurrentScreen('PROOF_OF_DELIVERY');
          }}
          onBookShipment={handleStartNewRequirement}
          onNavigateToBookingDetails={(bookingId) => {
            setActiveBookingId(bookingId);
            setCurrentScreen('BOOKING_DETAILS');
          }}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onNavigateToNotifications={() => setCurrentScreen('NOTIFICATIONS')}
        />
      )}

      {/* Screen 19: My Bookings (Migrated into Unified Shipments) */}
      {currentScreen === 'MY_BOOKINGS' && (
        <MyBookingsScreen
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('MY_SHIPMENTS')}
          onSelectBooking={(bokId) => {
            setActiveBookingId(bokId);
            setCurrentScreen('BOOKING_DETAILS');
          }}
          onTrackShipment={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onBookShipment={handleStartNewRequirement}
        />
      )}

      {/* Screen 20: Booking Details */}
      {currentScreen === 'BOOKING_DETAILS' && (
        <BookingDetailsScreen
          bookingId={activeBookingId}
          onBack={() => setCurrentScreen('MY_SHIPMENTS')}
          onTrackShipment={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onViewDocuments={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_DOCUMENTS');
          }}
          onViewPod={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('PROOF_OF_DELIVERY');
          }}
          onViewRequirement={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('REQUIREMENT_DETAILS');
          }}
          onContactSupport={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 21: Shipment Tracking */}
      {currentScreen === 'SHIPMENT_TRACKING' && (
        <ShipmentTrackingScreen
          trackingId={activeTrackingId || activeBookingId}
          onBack={() => setCurrentScreen('BOOKING_DETAILS')}
          onViewDocuments={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_DOCUMENTS');
          }}
          onViewPod={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('PROOF_OF_DELIVERY');
          }}
          onViewDetails={(id) => {
            setActiveBookingId(id);
            setCurrentScreen('BOOKING_DETAILS');
          }}
          onHelp={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 22: Shipment Documents */}
      {currentScreen === 'SHIPMENT_DOCUMENTS' && (
        <ShipmentDocumentsScreen
          shipmentId={activeTrackingId || activeBookingId}
          onBack={() => setCurrentScreen('SHIPMENT_TRACKING')}
          onViewPod={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('PROOF_OF_DELIVERY');
          }}
        />
      )}

      {/* Screen 23: Proof of Delivery (POD) */}
      {currentScreen === 'PROOF_OF_DELIVERY' && (
        <ProofOfDeliveryScreen
          shipmentId={activeTrackingId || activeBookingId}
          onBack={() => setCurrentScreen('SHIPMENT_TRACKING')}
          onContactSupport={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 24: Saved Addresses */}
      {currentScreen === 'SAVED_ADDRESSES' && (
        <SavedAddressesScreen
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onSelectAddress={(selectedAddr: SavedAddressItem) => {
            setRequirementDraft((prev) => ({
              ...prev,
              pickupAddress: `${selectedAddr.address}, ${selectedAddr.city}, PIN: ${selectedAddr.pincode}`,
              pickupCity: selectedAddr.city,
              pickupPincode: selectedAddr.pincode,
              pickupContactName: selectedAddr.contactPerson,
              pickupContactPhone: selectedAddr.phone.replace(/[^0-9]/g, '').slice(-10),
            }));
            setCurrentScreen('PICKUP_DELIVERY_DETAILS');
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* PHASE 3: VENDOR REGISTRATION & VERIFICATION (SCREENS 1 TO 11)        */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Screen 1: Vendor Registration */}
      {currentScreen === 'VENDOR_REGISTRATION' && (
        <VendorRegistrationScreen
          initialMobile={mobileNumber}
          onBack={() => handleVendorStepBack(1)}
          onNext={(data) => handleVendorStepNext(1, data)}
          onAlreadyRegistered={async () => {
            await vendorService.clearDraftForm();
            setCurrentScreen('LOGIN');
          }}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(1) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 2: Business Information */}
      {currentScreen === 'VENDOR_BUSINESS_INFO' && (
        <VendorBusinessInfoScreen
          onBack={() => handleVendorStepBack(2)}
          onNext={(data) => handleVendorStepNext(2, data)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(2) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 3: Business Address and Contact Information */}
      {currentScreen === 'VENDOR_ADDRESS_CONTACT' && (
        <VendorAddressContactScreen
          onBack={() => handleVendorStepBack(3)}
          onNext={(data) => handleVendorStepNext(3, data)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(3) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 4: Operating Locations */}
      {currentScreen === 'VENDOR_OPERATING_LOCATIONS' && (
        <VendorOperatingLocationsScreen
          onBack={() => handleVendorStepBack(4)}
          onNext={(data) => handleVendorStepNext(4, data)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(4) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 5: Fleet Information */}
      {currentScreen === 'VENDOR_FLEET_INFO' && (
        <VendorFleetInfoScreen
          onBack={() => handleVendorStepBack(5)}
          onNext={(data) => handleVendorStepNext(5, data)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(5) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 6: Transport Services */}
      {currentScreen === 'VENDOR_TRANSPORT_SERVICES' && (
        <VendorTransportServicesScreen
          onBack={() => handleVendorStepBack(6)}
          onNext={(data) => handleVendorStepNext(6, data)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(6) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 7: Vendor Document Upload */}
      {currentScreen === 'VENDOR_DOC_UPLOAD' && (
        <VendorDocumentUploadScreen
          onBack={() => handleVendorStepBack(7)}
          onNext={(docs) => handleVendorStepNext(7, docs)}
          isUpdateMode={vendorUpdateFlow.active}
          onlyIncompleteSteps={vendorUpdateFlow.onlyIncompleteSteps}
          incompleteStepsCount={vendorUpdateFlow.incompleteStepIndices.length}
          currentIncompleteStepNumber={
            vendorUpdateFlow.incompleteStepIndices.indexOf(7) + 1 || 1
          }
          onToggleViewAllSteps={() =>
            setVendorUpdateFlow((prev) => ({
              ...prev,
              onlyIncompleteSteps: !prev.onlyIncompleteSteps,
            }))
          }
        />
      )}

      {/* Screen 8: Application Review */}
      {currentScreen === 'VENDOR_APPLICATION_REVIEW' && (
        <VendorApplicationReviewScreen
          initialMobile={mobileNumber}
          onBack={() => {
            if (vendorUpdateFlow.active) {
              setCurrentScreen('VENDOR_VERIFICATION_STATUS');
            } else {
              setCurrentScreen('VENDOR_DOC_UPLOAD');
            }
          }}
          onEditSection={(stepIdx) => {
            setVendorUpdateFlow((prev) => ({
              ...prev,
              active: true,
              onlyIncompleteSteps: false,
            }));
            setCurrentScreen(VENDOR_STEP_SCREEN_MAP[stepIdx] || 'VENDOR_REGISTRATION');
          }}
          onProceedToOtp={(data: { targetPhone: string; testCode?: string; formData: any }) => {
            setPendingRegistration({
              role: 'VENDOR',
              targetPhone: data.targetPhone,
              vendorFormData: data.formData,
            });
            setMobileNumber(data.targetPhone);
            setSelectedRole('VENDOR');
            setOtpPurpose('REGISTRATION');
            setTestOtpCode(data.testCode || '12345');
            setCurrentScreen('OTP');
          }}
          onSubmitSuccess={(result) => {
            setVendorUpdateFlow({
              active: false,
              onlyIncompleteSteps: false,
              incompleteStepIndices: [],
            });
            setRegisteredVendorId(result.vendorId);
            setVendorApplicationNumber(result.applicationNumber);
            setCurrentScreen('VENDOR_SUBMISSION_CONFIRM');
          }}
        />
      )}

      {/* Screen 9: Submission Confirmation */}
      {currentScreen === 'VENDOR_SUBMISSION_CONFIRM' && (
        <VendorSubmissionConfirmationScreen
          vendorId={effectiveVendorId}
          applicationNumber={vendorApplicationNumber}
          vendorName="Transport Enterprise"
          onTrackStatus={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
          onGoToDashboard={async () => {
            const vId = effectiveVendorId || vendorApplicationNumber;
            if (vId) {
              const statusRes = await vendorService.getVendorVerificationStatus(vId);
              if (statusRes.status === 'APPROVED') {
                const targetComp = statusRes.vendorName || 'Transport Enterprise';
                const newSession: AuthSessionData = {
                  userId: vId,
                  mobile: mobileNumber || session?.mobile || '',
                  role: 'VENDOR',
                  fullName: targetComp,
                  companyName: targetComp,
                  token: 'auth-session-approved-' + Date.now(),
                  createdAt: new Date().toISOString(),
                };
                setSession(newSession);
                await authService.saveSession(newSession);
                setWelcomeData({
                  companyName: targetComp,
                  accountCode: statusRes.vendorCode || vId,
                });
                setCurrentScreen('WELCOME_TO_NECL');
                return;
              }
            }
            setCurrentScreen('VENDOR_VERIFICATION_STATUS');
          }}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 10: Verification Status */}
      {currentScreen === 'VENDOR_VERIFICATION_STATUS' && (
        <VendorVerificationStatusScreen
          vendorId={effectiveVendorId}
          vendorName="Transport Enterprise"
          onBack={() => setCurrentScreen('LOGIN')}
          onEnterDashboard={async () => {
            const vId = effectiveVendorId;
            if (!vId) {
              Alert.alert(
                'Verification Pending',
                'Your application is currently under compliance review. Access to the operational dashboard will be unlocked once approved by TRUCKS Admin.'
              );
              return;
            }
            const statusRes = await vendorService.getVendorVerificationStatus(vId);
            if (statusRes.status !== 'APPROVED') {
              Alert.alert(
                'Verification Pending',
                'Your application is currently under compliance review. Access to the operational dashboard will be unlocked once approved by TRUCKS Admin.'
              );
              return;
            }
            const targetComp = statusRes.vendorName || 'Transport Enterprise';
            const newSession: AuthSessionData = {
              userId: vId,
              mobile: mobileNumber || session?.mobile || '',
              role: 'VENDOR',
              fullName: targetComp,
              companyName: targetComp,
              token: 'auth-session-approved-' + Date.now(),
              createdAt: new Date().toISOString(),
            };
            setSession(newSession);
            await authService.saveSession(newSession);
            setWelcomeData({
              companyName: targetComp,
              accountCode: statusRes.vendorCode || vId,
            });
            setCurrentScreen('WELCOME_TO_NECL');
          }}
          onApprovedContinue={async () => {
            const vId = effectiveVendorId;
            if (!vId) {
              Alert.alert(
                'Verification Pending',
                'Your application is currently under compliance review. Access to the operational dashboard will be unlocked once approved by TRUCKS Admin.'
              );
              return;
            }
            const statusRes = await vendorService.getVendorVerificationStatus(vId);
            if (statusRes.status !== 'APPROVED') {
              Alert.alert(
                'Verification Pending',
                'Your application is currently under compliance review. Access to the operational dashboard will be unlocked once approved by TRUCKS Admin.'
              );
              return;
            }
            const targetComp = statusRes.vendorName || 'Transport Enterprise';
            const newSession: AuthSessionData = {
              userId: vId,
              mobile: mobileNumber || session?.mobile || '',
              role: 'VENDOR',
              fullName: targetComp,
              companyName: targetComp,
              token: 'auth-session-approved-' + Date.now(),
              createdAt: new Date().toISOString(),
            };
            setSession(newSession);
            await authService.saveSession(newSession);
            setWelcomeData({
              companyName: targetComp,
              accountCode: statusRes.vendorCode || vId,
            });
            setCurrentScreen('WELCOME_TO_NECL');
          }}
          onCorrectDocuments={() => setCurrentScreen('VENDOR_DOC_CORRECTION')}
          onCompleteRegistration={async () => {
            await startVendorUpdateWorkflow();
          }}
          onOpenSupport={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 11: Document Status and Correction */}
      {currentScreen === 'VENDOR_DOC_CORRECTION' && (
        <VendorDocumentCorrectionScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
          onDone={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* PHASE 3: VENDOR OPERATIONS (SCREENS 12 TO 28)                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Screen 12: Vendor Dashboard */}
      {currentScreen === 'VENDOR_DASHBOARD' && (
        <VendorDashboardScreen
          session={session}
          onLogout={handleLogout}
          onBrowseRequirements={() => setCurrentScreen('VENDOR_REQUIREMENTS')}
          onViewRequirementDetails={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('VENDOR_REQUIREMENT_DETAILS');
          }}
          onViewMyQuotations={() => setCurrentScreen('VENDOR_MY_QUOTATIONS')}
          onViewAwardedBookings={() => setCurrentScreen('VENDOR_AWARDED_BOOKINGS')}
          onViewFleet={() => setCurrentScreen('VENDOR_FLEET_MANAGEMENT')}
          onViewDrivers={() => setCurrentScreen('VENDOR_DRIVER_MANAGEMENT')}
          onViewTrips={() => setCurrentScreen('VENDOR_TRIP_MANAGEMENT')}
          onViewVerificationStatus={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
          onOpenNotifications={() => setCurrentScreen('NOTIFICATIONS')}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onAssignFleet={() => setCurrentScreen('VENDOR_AWARDED_BOOKINGS')}
          onSelectNavTab={(tab) => {
            if (tab === 'HOME') setCurrentScreen('VENDOR_DASHBOARD');
            else if (tab === 'LOADS') setCurrentScreen('VENDOR_REQUIREMENTS');
            else if (tab === 'TRIPS') setCurrentScreen('VENDOR_TRIP_MANAGEMENT');
            else if (tab === 'FLEET') setCurrentScreen('VENDOR_FLEET_MANAGEMENT');
          }}
        />
      )}

      {/* Screen 13: Available Transport Requirements */}
      {currentScreen === 'VENDOR_REQUIREMENTS' && (
        <VendorRequirementsScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onContinueRegistration={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
          onSelectRequirement={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('VENDOR_REQUIREMENT_DETAILS');
          }}
          onSelectNavTab={(tab) => {
            if (tab === 'HOME') setCurrentScreen('VENDOR_DASHBOARD');
            else if (tab === 'LOADS') setCurrentScreen('VENDOR_REQUIREMENTS');
            else if (tab === 'TRIPS') setCurrentScreen('VENDOR_TRIP_MANAGEMENT');
            else if (tab === 'FLEET') setCurrentScreen('VENDOR_FLEET_MANAGEMENT');
          }}
        />
      )}

      {/* Screen 14: Requirement Details */}
      {currentScreen === 'VENDOR_REQUIREMENT_DETAILS' && (
        <VendorRequirementDetailsScreen
          requirementId={activeRequirementId}
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_REQUIREMENTS')}
          onSubmitQuotation={(req) => {
            setSelectedVendorRequirement(req);
            setCurrentScreen('VENDOR_SUBMIT_QUOTATION');
          }}
        />
      )}

      {/* Screen 15: Submit Quotation */}
      {currentScreen === 'VENDOR_SUBMIT_QUOTATION' && (
        <VendorSubmitQuotationScreen
          vendorId={effectiveVendorId}
          requirement={selectedVendorRequirement || { id: activeRequirementId }}
          onBack={() => setCurrentScreen('VENDOR_REQUIREMENT_DETAILS')}
          onSubmitSuccess={(data) => {
            setActiveQuotationResult(data);
            setCurrentScreen('VENDOR_QUOTATION_CONFIRM');
          }}
        />
      )}

      {/* Screen 16: Quotation Submission Confirmation */}
      {currentScreen === 'VENDOR_QUOTATION_CONFIRM' && (
        <VendorQuotationConfirmationScreen
          quotationId={activeQuotationResult.quotationId}
          quotedRate={activeQuotationResult.quotedRate}
          transitDays={activeQuotationResult.transitDays}
          onViewMyQuotes={() => setCurrentScreen('VENDOR_MY_QUOTATIONS')}
          onBackToBoard={() => setCurrentScreen('VENDOR_REQUIREMENTS')}
        />
      )}

      {/* Screen 17: My Quotations */}
      {currentScreen === 'VENDOR_MY_QUOTATIONS' && (
        <VendorQuotationsListScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectQuotation={(quote) => {
            setSelectedVendorQuotation(quote);
            setCurrentScreen('VENDOR_QUOTATION_DETAILS');
          }}
        />
      )}

      {/* Screen 18: Quotation Details */}
      {currentScreen === 'VENDOR_QUOTATION_DETAILS' && (
        <VendorQuotationDetailsScreen
          quotation={selectedVendorQuotation}
          onBack={() => setCurrentScreen('VENDOR_MY_QUOTATIONS')}
          onNavigateToBooking={() => setCurrentScreen('VENDOR_AWARDED_BOOKINGS')}
        />
      )}

      {/* Screen 19: Awarded Bookings */}
      {currentScreen === 'VENDOR_AWARDED_BOOKINGS' && (
        <VendorAwardedBookingsScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectBooking={(bookingId) => {
            setActiveBookingId(bookingId);
            setCurrentScreen('VENDOR_BOOKING_DETAILS');
          }}
          onAssignFleet={(booking) => {
            setSelectedVendorBooking(booking);
            setActiveBookingId(booking.id);
            setCurrentScreen('VENDOR_ASSIGN_VEHICLE');
          }}
          onViewTrip={(tripId) => {
            setActiveVendorTripId(tripId);
            setCurrentScreen('VENDOR_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 20: Booking Details */}
      {currentScreen === 'VENDOR_BOOKING_DETAILS' && (
        <VendorBookingDetailsScreen
          bookingId={activeBookingId}
          onBack={() => setCurrentScreen('VENDOR_AWARDED_BOOKINGS')}
          onAssignFleet={(booking) => {
            setSelectedVendorBooking(booking);
            setCurrentScreen('VENDOR_ASSIGN_VEHICLE');
          }}
          onViewTrip={(tripId) => {
            setActiveVendorTripId(tripId);
            setCurrentScreen('VENDOR_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 21: Fleet and Vehicle Management */}
      {currentScreen === 'VENDOR_FLEET_MANAGEMENT' && (
        <VendorFleetManagementScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectNavTab={(tab) => {
            if (tab === 'HOME') setCurrentScreen('VENDOR_DASHBOARD');
            else if (tab === 'LOADS') setCurrentScreen('VENDOR_REQUIREMENTS');
            else if (tab === 'TRIPS') setCurrentScreen('VENDOR_TRIP_MANAGEMENT');
            else if (tab === 'FLEET') setCurrentScreen('VENDOR_FLEET_MANAGEMENT');
          }}
        />
      )}

      {/* Screen 22: Driver Management */}
      {currentScreen === 'VENDOR_DRIVER_MANAGEMENT' && (
        <VendorDriverManagementScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectNavTab={(tab) => {
            if (tab === 'HOME') setCurrentScreen('VENDOR_DASHBOARD');
            else if (tab === 'LOADS') setCurrentScreen('VENDOR_REQUIREMENTS');
            else if (tab === 'TRIPS') setCurrentScreen('VENDOR_TRIP_MANAGEMENT');
            else if (tab === 'FLEET') setCurrentScreen('VENDOR_FLEET_MANAGEMENT');
          }}
        />
      )}

      {/* Screen 23: Assign Vehicle */}
      {currentScreen === 'VENDOR_ASSIGN_VEHICLE' && (
        <VendorAssignVehicleScreen
          vendorId={effectiveVendorId}
          booking={selectedVendorBooking || { id: activeBookingId }}
          onBack={() => setCurrentScreen('VENDOR_BOOKING_DETAILS')}
          onSelectVehicle={(veh) => {
            setSelectedAssignVehicle(veh);
            setCurrentScreen('VENDOR_ASSIGN_DRIVER');
          }}
        />
      )}

      {/* Screen 24: Assign Driver */}
      {currentScreen === 'VENDOR_ASSIGN_DRIVER' && (
        <VendorAssignDriverScreen
          vendorId={effectiveVendorId}
          booking={selectedVendorBooking || { id: activeBookingId }}
          selectedVehicle={selectedAssignVehicle}
          onBack={() => setCurrentScreen('VENDOR_ASSIGN_VEHICLE')}
          onSelectDriver={(drv) => {
            setSelectedAssignDriver(drv);
            setCurrentScreen('VENDOR_ASSIGNMENT_CONFIRM');
          }}
        />
      )}

      {/* Screen 25: Assignment Confirmation */}
      {currentScreen === 'VENDOR_ASSIGNMENT_CONFIRM' && (
        <VendorAssignmentConfirmationScreen
          vendorId={effectiveVendorId}
          booking={selectedVendorBooking || { id: activeBookingId }}
          vehicle={selectedAssignVehicle}
          driver={selectedAssignDriver}
          onBack={() => setCurrentScreen('VENDOR_ASSIGN_DRIVER')}
          onConfirmed={(tripId) => {
            setActiveVendorTripId(tripId);
            setCurrentScreen('VENDOR_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 26: Trip Management */}
      {currentScreen === 'VENDOR_TRIP_MANAGEMENT' && (
        <VendorTripManagementScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectTrip={(tripId) => {
            setActiveVendorTripId(tripId);
            setCurrentScreen('VENDOR_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 27: Trip Details */}
      {currentScreen === 'VENDOR_TRIP_DETAILS' && (
        <VendorTripDetailsScreen
          tripId={activeVendorTripId}
          onBack={() => setCurrentScreen('VENDOR_TRIP_MANAGEMENT')}
          onViewDocuments={(tripId) => {
            setActiveVendorTripId(tripId);
            setCurrentScreen('VENDOR_TRIP_DOCUMENTS');
          }}
        />
      )}

      {/* Screen 28: Trip Documents and Proof of Delivery (POD) */}
      {currentScreen === 'VENDOR_TRIP_DOCUMENTS' && (
        <VendorTripDocumentsScreen
          tripId={activeVendorTripId}
          onBack={() => setCurrentScreen('VENDOR_TRIP_DETAILS')}
        />
      )}

      {/* ========================================================================= */}
      {/* DRIVER REGISTRATION & VERIFICATION (Screens 1 to 9) */}
      {/* ========================================================================= */}

      {/* Single-Screen Driver Registration */}
      {currentScreen === 'DRIVER_REGISTRATION' && (
        <DriverRegistrationScreen
          initialMobile={mobileNumber}
          onBack={async () => {
            await driverService.clearDraftForm();
            setCurrentScreen('LOGIN');
          }}
          onProceedToOtp={(data) => {
            setPendingRegistration({
              role: 'DRIVER',
              targetPhone: data.targetPhone,
              driverSubmissionData: data.submissionData,
            });
            setMobileNumber(data.targetPhone);
            setSelectedRole('DRIVER');
            setOtpPurpose('REGISTRATION');
            setTestOtpCode(data.testCode || '12345');
            setCurrentScreen('OTP');
          }}
          onSubmitSuccess={(data) => {
            setRegisteredDriverId(data.driverId);
            setDriverApplicationNumber(data.applicationNumber);
            setCurrentScreen('DRIVER_SUBMISSION_CONFIRM');
          }}
          onCheckStatus={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
        />
      )}

      {/* Legacy Multi-step Screens redirect to Single-Screen Driver Registration */}
      {(currentScreen === 'DRIVER_PERSONAL_INFO' ||
        currentScreen === 'DRIVER_LICENCE_DETAILS' ||
        currentScreen === 'DRIVER_VEHICLE_ASSOCIATION' ||
        currentScreen === 'DRIVER_DOC_UPLOAD' ||
        currentScreen === 'DRIVER_APPLICATION_REVIEW') && (
          <DriverRegistrationScreen
            initialMobile={mobileNumber}
            onBack={async () => {
              await driverService.clearDraftForm();
              setCurrentScreen('LOGIN');
            }}
            onSubmitSuccess={(data) => {
              setRegisteredDriverId(data.driverId);
              setDriverApplicationNumber(data.applicationNumber);
              setCurrentScreen('DRIVER_SUBMISSION_CONFIRM');
            }}
            onCheckStatus={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
          />
        )}

      {/* Screen 7: Submission Confirmation */}
      {currentScreen === 'DRIVER_SUBMISSION_CONFIRM' && (
        <DriverSubmissionConfirmationScreen
          applicationNumber={driverApplicationNumber}
          onCheckStatus={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
          onGoHome={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onGoToDashboard={async () => {
            const dId = effectiveDriverId;
            const phone = mobileNumber || session?.mobile;
            let driverName = 'Commercial Driver';
            if (dId || phone) {
              const dProfile = await driverService.getDriverProfile(dId, phone);
              if (dProfile && dProfile.status === 'APPROVED') {
                driverName = dProfile.fullName || dProfile.name || 'Commercial Driver';
                const newSession: AuthSessionData = {
                  userId: dId || 'driver-user',
                  mobile: phone || '',
                  role: 'DRIVER',
                  fullName: driverName,
                  token: 'auth-session-approved-' + Date.now(),
                  createdAt: new Date().toISOString(),
                };
                setSession(newSession);
                await authService.saveSession(newSession);
                setWelcomeData({
                  companyName: driverName,
                  userName: driverName,
                  accountCode: dProfile.licenceNumber || dId || 'DRV-APPROVED',
                });
                setCurrentScreen('WELCOME_TO_NECL');
                return;
              }
            }
            setCurrentScreen('DRIVER_DASHBOARD');
          }}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 8: Verification Status */}
      {currentScreen === 'DRIVER_VERIFICATION_STATUS' && (
        <DriverVerificationStatusScreen
          initialMobile={mobileNumber}
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('LOGIN')}
          onGoToDashboard={async () => {
            const dId = effectiveDriverId;
            const phone = mobileNumber || session?.mobile;
            let driverName = 'Commercial Driver';
            if (dId || phone) {
              const dProfile = await driverService.getDriverProfile(dId, phone);
              if (dProfile && dProfile.status === 'APPROVED') {
                driverName = dProfile.fullName || dProfile.name || 'Commercial Driver';
                const newSession: AuthSessionData = {
                  userId: dId || 'driver-user',
                  mobile: phone || '',
                  role: 'DRIVER',
                  fullName: driverName,
                  token: 'auth-session-approved-' + Date.now(),
                  createdAt: new Date().toISOString(),
                };
                setSession(newSession);
                await authService.saveSession(newSession);
                setWelcomeData({
                  companyName: driverName,
                  userName: driverName,
                  accountCode: dProfile.licenceNumber || dId || 'DRV-APPROVED',
                });
                setCurrentScreen('WELCOME_TO_NECL');
                return;
              }
            }
            setCurrentScreen('DRIVER_DASHBOARD');
          }}
          onGoToCorrection={() => setCurrentScreen('DRIVER_DOC_CORRECTION')}
          onCompleteRegistration={async () => {
            setIsResumingRegistration(true);
            await driverService.loadAuthenticatedDriverRegistration(effectiveDriverId, mobileNumber);
            setCurrentScreen('DRIVER_REGISTRATION');
          }}
          onContactSupport={() => setCurrentScreen('HELP_SUPPORT')}
        />
      )}

      {/* Screen 9: Document Status and Correction */}
      {currentScreen === 'DRIVER_DOC_CORRECTION' && (
        <DriverDocumentCorrectionScreen
          initialMobile={mobileNumber}
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
          onCorrectionSubmitted={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
        />
      )}

      {/* ========================================================================= */}
      {/* DRIVER OPERATIONS (Screens 10 to 20) */}
      {/* ========================================================================= */}

      {/* Screen 10: Driver Dashboard */}
      {currentScreen === 'DRIVER_DASHBOARD' && (
        <DriverDashboardScreen
          initialMobile={mobileNumber}
          driverId={effectiveDriverId}
          onNavigateTrips={() => setCurrentScreen('DRIVER_ASSIGNED_TRIPS')}
          onNavigateTripDetails={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_DETAILS');
          }}
          onNavigateTripProgress={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_PROGRESS');
          }}
          onNavigatePickupConfirm={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_PICKUP_CONFIRM');
          }}
          onNavigateDeliveryConfirm={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_DELIVERY_CONFIRM');
          }}
          onNavigatePodUpload={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_POD_UPLOAD');
          }}
          onNavigateTripHistory={() => setCurrentScreen('DRIVER_TRIP_HISTORY')}
          onNavigateDocuments={() => setCurrentScreen('DRIVER_DOCUMENTS')}
          onNavigateNotifications={() => setCurrentScreen('NOTIFICATIONS')}
          onNavigateProfile={() => setCurrentScreen('PROFILE')}
          onNavigateSettings={() => setCurrentScreen('SETTINGS')}
          onNavigateHelpSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onLogout={handleLogout}
        />
      )}

      {/* Screen 11: Assigned Trips */}
      {currentScreen === 'DRIVER_ASSIGNED_TRIPS' && (
        <DriverAssignedTripsScreen
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onSelectTrip={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 12: Trip Details */}
      {currentScreen === 'DRIVER_TRIP_DETAILS' && (
        <DriverTripDetailsScreen
          tripId={activeDriverTripId}
          onBack={() => setCurrentScreen('DRIVER_ASSIGNED_TRIPS')}
          onNavigateProgress={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_PROGRESS');
          }}
          onNavigatePickupConfirm={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_PICKUP_CONFIRM');
          }}
          onNavigateDeliveryConfirm={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_DELIVERY_CONFIRM');
          }}
          onNavigatePodUpload={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_POD_UPLOAD');
          }}
        />
      )}

      {/* Screen 13: Pickup Confirmation */}
      {currentScreen === 'DRIVER_PICKUP_CONFIRM' && (
        <DriverPickupConfirmationScreen
          tripId={activeDriverTripId}
          onBack={() => setCurrentScreen('DRIVER_TRIP_DETAILS')}
          onPickupConfirmed={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_PROGRESS');
          }}
        />
      )}

      {/* Screen 14 & 15: Trip Progress & Navigation */}
      {currentScreen === 'DRIVER_TRIP_PROGRESS' && (
        <DriverTripProgressScreen
          tripId={activeDriverTripId}
          onBack={() => setCurrentScreen('DRIVER_TRIP_DETAILS')}
          onNavigateDeliveryConfirm={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_DELIVERY_CONFIRM');
          }}
          onNavigatePodUpload={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_POD_UPLOAD');
          }}
        />
      )}

      {/* Screen 16: Delivery Confirmation */}
      {currentScreen === 'DRIVER_DELIVERY_CONFIRM' && (
        <DriverDeliveryConfirmationScreen
          tripId={activeDriverTripId}
          onBack={() => setCurrentScreen('DRIVER_TRIP_PROGRESS')}
          onDeliveryConfirmed={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_POD_UPLOAD');
          }}
        />
      )}

      {/* Screen 17: Proof of Delivery (POD) Upload */}
      {currentScreen === 'DRIVER_POD_UPLOAD' && (
        <DriverPodUploadScreen
          tripId={activeDriverTripId}
          onBack={() => setCurrentScreen('DRIVER_TRIP_DETAILS')}
          onTripCompleted={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_COMPLETION');
          }}
        />
      )}

      {/* Screen 18: Trip Completion */}
      {currentScreen === 'DRIVER_TRIP_COMPLETION' && (
        <DriverTripCompletionScreen
          tripId={activeDriverTripId}
          onGoToDashboard={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onGoToTripHistory={() => setCurrentScreen('DRIVER_TRIP_HISTORY')}
        />
      )}

      {/* Screen 19: Trip History */}
      {currentScreen === 'DRIVER_TRIP_HISTORY' && (
        <DriverTripHistoryScreen
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onSelectTrip={(tripId) => {
            setActiveDriverTripId(tripId);
            setCurrentScreen('DRIVER_TRIP_DETAILS');
          }}
        />
      )}

      {/* Screen 20: Driver Documents */}
      {currentScreen === 'DRIVER_DOCUMENTS' && (
        <DriverDocumentsScreen
          initialMobile={mobileNumber}
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onNavigateCorrection={() => setCurrentScreen('DRIVER_DOC_CORRECTION')}
        />
      )}

      {/* Fallback Legacy Vendor & Driver Onboarding */}
      {currentScreen === 'VENDOR_ONBOARDING' && (
        <VendorRegistrationScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('LOGIN')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_BUSINESS_INFO');
          }}
          onAlreadyRegistered={() => setCurrentScreen('LOGIN')}
        />
      )}

      {currentScreen === 'DRIVER_ONBOARDING' && (
        <DriverOnboardingScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('LOGIN')}
          onCompleted={() => setCurrentScreen('REGISTRATION_STATUS')}
        />
      )}

      {/* ── Four-Button Client Bottom Navigation Bar (Home | Shipments | My Requirements | Profile) ── */}
      {selectedRole === 'CLIENT' &&
        (currentScreen === 'CLIENT_DASHBOARD' ||
          currentScreen === 'MY_SHIPMENTS' ||
          currentScreen === 'MY_REQUIREMENTS' ||
          currentScreen === 'MY_BOOKINGS' ||
          currentScreen === 'PROFILE') && (
          <ClientBottomNavBar
            activeTab={
              currentScreen === 'MY_SHIPMENTS' || currentScreen === 'MY_BOOKINGS'
                ? 'SHIPMENTS'
                : currentScreen === 'MY_REQUIREMENTS'
                  ? 'REQUIREMENTS'
                  : currentScreen === 'PROFILE'
                    ? 'PROFILE'
                    : 'HOME'
            }
            onSelectTab={(tab: ClientNavTab | string) => {
              if (tab === 'HOME') setCurrentScreen('CLIENT_DASHBOARD');
              else if (tab === 'SHIPMENT') setCurrentScreen('MY_SHIPMENTS');
              else if (tab === 'SHIPMENTS') setCurrentScreen('MY_SHIPMENTS');
              else if (tab === 'REQUIREMENTS') setCurrentScreen('MY_REQUIREMENTS');
              else if (tab === 'BOOKINGS') setCurrentScreen('MY_BOOKINGS');
              else if (tab === 'PROFILE') setCurrentScreen('PROFILE');
            }}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  resumingBanner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  resumingBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  floatingToastCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 20,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: '#334155',
  },
  floatingToastIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FA5700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  floatingToastTextCol: {
    flex: 1,
  },
  floatingToastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  floatingToastRoleBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FA5700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  floatingToastTime: {
    fontSize: 10,
    color: '#64748B',
  },
  floatingToastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  floatingToastSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 15,
  },
  floatingToastCloseBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
