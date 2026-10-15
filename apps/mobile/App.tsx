import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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

// The Common Screen Components
import { SplashScreen } from './src/screens/SplashScreen'; // 01. Splash
import { OnboardingScreen } from './src/screens/OnboardingScreen'; // 02. Onboarding
import { LoginScreen } from './src/screens/LoginScreen'; // 03. Login
import { RegistrationScreen } from './src/screens/RegistrationScreen'; // 04. Registration
import { OtpScreen } from './src/screens/OtpScreen'; // 05. OTP Verification
import { RegistrationStatusScreen } from './src/screens/RegistrationStatusScreen'; // 11. Registration & Account Status (Screen 6)
import { ProfileScreen } from './src/screens/ProfileScreen'; // 12. Profile
import { EditProfileScreen } from './src/screens/EditProfileScreen'; // 13. Edit Profile
import { NotificationsScreen } from './src/screens/NotificationsScreen'; // 14. Notifications (Screen 25)
import { NotificationDetailsScreen } from './src/screens/NotificationDetailsScreen'; // 15. Notification Details
import { SettingsScreen } from './src/screens/SettingsScreen'; // 16. Settings
import { HelpSupportScreen } from './src/screens/HelpSupportScreen'; // 17. Help & Support (Screen 26)

// Role Specific Onboarding Screens
import { VendorOnboardingScreen } from './src/screens/VendorOnboardingScreen';
import { DriverOnboardingScreen } from './src/screens/DriverOnboardingScreen';

// Client Module Screens (1 through 24)
import { ClientProfileSetupScreen } from './src/screens/ClientProfileSetupScreen'; // Screen 1
import { ClientBusinessDetailsScreen } from './src/screens/ClientBusinessDetailsScreen'; // Screen 2
import { ClientDocumentUploadScreen } from './src/screens/ClientDocumentUploadScreen'; // Screen 3
import { ClientRegistrationReviewScreen } from './src/screens/ClientRegistrationReviewScreen'; // Screen 4
import { ClientRegistrationConfirmationScreen } from './src/screens/ClientRegistrationConfirmationScreen'; // Screen 5
import { ClientDashboardScreen } from './src/screens/ClientDashboardScreen'; // Screen 7
import { CreateTransportRequirementScreen } from './src/screens/CreateTransportRequirementScreen'; // Screen 8
import { CargoDetailsScreen } from './src/screens/CargoDetailsScreen'; // Screen 9
import { PickupDeliveryDetailsScreen } from './src/screens/PickupDeliveryDetailsScreen'; // Screen 10
import { RequirementReviewScreen } from './src/screens/RequirementReviewScreen'; // Screen 11
import { RequirementConfirmationScreen } from './src/screens/RequirementConfirmationScreen'; // Screen 12
import { MyRequirementsScreen } from './src/screens/MyRequirementsScreen'; // Screen 13
import { RequirementDetailsScreen } from './src/screens/RequirementDetailsScreen'; // Screen 14
import { QuotationsListScreen } from './src/screens/QuotationsListScreen'; // Screen 15
import { QuotationComparisonScreen } from './src/screens/QuotationComparisonScreen'; // Screen 16
import { QuotationDetailsScreen } from './src/screens/QuotationDetailsScreen'; // Screen 17
import { BookingConfirmationScreen } from './src/screens/BookingConfirmationScreen'; // Screen 18
import { MyBookingsScreen } from './src/screens/MyBookingsScreen'; // Screen 19
import { MyShipmentsScreen } from './src/screens/MyShipmentsScreen'; // Dedicated Shipments Screen
import { BookingDetailsScreen } from './src/screens/BookingDetailsScreen'; // Screen 20
import { ShipmentTrackingScreen } from './src/screens/ShipmentTrackingScreen'; // Screen 21
import { ShipmentDocumentsScreen } from './src/screens/ShipmentDocumentsScreen'; // Screen 22
import { ProofOfDeliveryScreen } from './src/screens/ProofOfDeliveryScreen'; // Screen 23
import { SavedAddressesScreen } from './src/screens/SavedAddressesScreen'; // Screen 24
import { ClientBottomNavBar, ClientNavTab } from './src/components/ClientBottomNavBar';

// Phase 3: Vendor Registration & Verification Screens (1-11)
import { VendorRegistrationScreen } from './src/screens/VendorRegistrationScreen'; // Screen 1
import { VendorBusinessInfoScreen } from './src/screens/VendorBusinessInfoScreen'; // Screen 2
import { VendorAddressContactScreen } from './src/screens/VendorAddressContactScreen'; // Screen 3
import { VendorOperatingLocationsScreen } from './src/screens/VendorOperatingLocationsScreen'; // Screen 4
import { VendorFleetInfoScreen } from './src/screens/VendorFleetInfoScreen'; // Screen 5
import { VendorTransportServicesScreen } from './src/screens/VendorTransportServicesScreen'; // Screen 6
import { VendorDocumentUploadScreen } from './src/screens/VendorDocumentUploadScreen'; // Screen 7
import { VendorApplicationReviewScreen } from './src/screens/VendorApplicationReviewScreen'; // Screen 8
import { VendorSubmissionConfirmationScreen } from './src/screens/VendorSubmissionConfirmationScreen'; // Screen 9
import { VendorVerificationStatusScreen } from './src/screens/VendorVerificationStatusScreen'; // Screen 10
import { VendorDocumentCorrectionScreen } from './src/screens/VendorDocumentCorrectionScreen'; // Screen 11

// Phase 3: Vendor Operations Screens (12-28)
import { VendorDashboardScreen } from './src/screens/VendorDashboardScreen'; // Screen 12
import { VendorRequirementsScreen } from './src/screens/VendorRequirementsScreen'; // Screen 13
import { VendorRequirementDetailsScreen } from './src/screens/VendorRequirementDetailsScreen'; // Screen 14
import { VendorSubmitQuotationScreen } from './src/screens/VendorSubmitQuotationScreen'; // Screen 15
import { VendorQuotationConfirmationScreen } from './src/screens/VendorQuotationConfirmationScreen'; // Screen 16
import { VendorQuotationsListScreen } from './src/screens/VendorQuotationsListScreen'; // Screen 17
import { VendorQuotationDetailsScreen } from './src/screens/VendorQuotationDetailsScreen'; // Screen 18
import { VendorAwardedBookingsScreen } from './src/screens/VendorAwardedBookingsScreen'; // Screen 19
import { VendorBookingDetailsScreen } from './src/screens/VendorBookingDetailsScreen'; // Screen 20
import { VendorFleetManagementScreen } from './src/screens/VendorFleetManagementScreen'; // Screen 21
import { VendorDriverManagementScreen } from './src/screens/VendorDriverManagementScreen'; // Screen 22
import { VendorAssignVehicleScreen } from './src/screens/VendorAssignVehicleScreen'; // Screen 23
import { VendorAssignDriverScreen } from './src/screens/VendorAssignDriverScreen'; // Screen 24
import { VendorAssignmentConfirmationScreen } from './src/screens/VendorAssignmentConfirmationScreen'; // Screen 25
import { VendorTripManagementScreen } from './src/screens/VendorTripManagementScreen'; // Screen 26
import { VendorTripDetailsScreen } from './src/screens/VendorTripDetailsScreen'; // Screen 27
import { VendorTripDocumentsScreen } from './src/screens/VendorTripDocumentsScreen'; // Screen 28

// Phase 4: Driver Registration & Verification Screens (1-9)
import { DriverRegistrationScreen } from './src/screens/DriverRegistrationScreen'; // Screen 1
import { DriverPersonalInfoScreen } from './src/screens/DriverPersonalInfoScreen'; // Screen 2
import { DriverLicenceDetailsScreen } from './src/screens/DriverLicenceDetailsScreen'; // Screen 3
import { DriverVehicleAssociationScreen } from './src/screens/DriverVehicleAssociationScreen'; // Screen 4
import { DriverDocumentUploadScreen } from './src/screens/DriverDocumentUploadScreen'; // Screen 5
import { DriverApplicationReviewScreen } from './src/screens/DriverApplicationReviewScreen'; // Screen 6
import { DriverSubmissionConfirmationScreen } from './src/screens/DriverSubmissionConfirmationScreen'; // Screen 7
import { DriverVerificationStatusScreen } from './src/screens/DriverVerificationStatusScreen'; // Screen 8
import { DriverDocumentCorrectionScreen } from './src/screens/DriverDocumentCorrectionScreen'; // Screen 9

// Phase 4: Driver Operations Screens (10-20)
import { DriverDashboardScreen } from './src/screens/DriverDashboardScreen'; // Screen 10
import { DriverAssignedTripsScreen } from './src/screens/DriverAssignedTripsScreen'; // Screen 11
import { DriverTripDetailsScreen } from './src/screens/DriverTripDetailsScreen'; // Screen 12
import { DriverPickupConfirmationScreen } from './src/screens/DriverPickupConfirmationScreen'; // Screen 13
import { DriverTripProgressScreen } from './src/screens/DriverTripProgressScreen'; // Screen 14
import { DriverDeliveryConfirmationScreen } from './src/screens/DriverDeliveryConfirmationScreen'; // Screen 16
import { DriverPodUploadScreen } from './src/screens/DriverPodUploadScreen'; // Screen 17
import { DriverTripCompletionScreen } from './src/screens/DriverTripCompletionScreen'; // Screen 18
import { DriverTripHistoryScreen } from './src/screens/DriverTripHistoryScreen'; // Screen 19
import { DriverDocumentsScreen } from './src/screens/DriverDocumentsScreen'; // Screen 20

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

  // Client Registration State
  const [profileData, setProfileData] = useState<ClientProfileFormData | undefined>(undefined);
  const [businessDetails, setBusinessDetails] = useState<ClientBusinessDetails | undefined>(undefined);
  const [clientDocuments, setClientDocuments] = useState<ClientDocumentItem[]>([]);
  const [registeredClientId, setRegisteredClientId] = useState<string>('');

  // Transport Requirement Flow State
  const [requirementDraft, setRequirementDraft] = useState<TransportRequirementDraft>(
    createFreshRequirementDraft()
  );
  const [activeRequirementId, setActiveRequirementId] = useState<string>('');

  const handleStartNewRequirement = () => {
    setRequirementDraft(createFreshRequirementDraft());
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

  // Driver Registration & Operations Flow State
  const [registeredDriverId, setRegisteredDriverId] = useState<string>('');
  const [driverApplicationNumber, setDriverApplicationNumber] = useState<string>('');
  const [activeDriverTripId, setActiveDriverTripId] = useState<string>('');

  const effectiveDriverId = (session as any)?.driverId || session?.userId || registeredDriverId;

  useEffect(() => {
    (async () => {
      const existing = await authService.checkExistingSession();
      if (existing) {
        setSession(existing);
        setMobileNumber(existing.mobile);
        setSelectedRole(existing.role);
      }
    })();
  }, []);

  // Guard Client Dashboard: Unapproved or incompletely registered clients must NOT bypass onboarding or access dashboard
  useEffect(() => {
    if (currentScreen === 'CLIENT_DASHBOARD' && selectedRole === 'CLIENT') {
      (async () => {
        const checkPhone = mobileNumber || session?.mobile;
        if (!checkPhone) {
          setCurrentScreen('LOGIN');
          return;
        }
        const statusRes = await clientService.getClientAccountStatus(checkPhone);
        if (statusRes.status !== 'APPROVED' && (statusRes as any).status !== 'ACTIVE') {
          setRegisteredClientId(statusRes.companyId || statusRes.clientCode || '');
          setCurrentScreen('REGISTRATION_STATUS');
        }
      })();
    }
  }, [currentScreen, selectedRole, mobileNumber, session]);

  // Guard Vendor Dashboard: Unapproved vendors must NOT access dashboard
  useEffect(() => {
    if (currentScreen === 'VENDOR_DASHBOARD' && selectedRole === 'VENDOR') {
      (async () => {
        const vId = effectiveVendorId;
        if (vId) {
          const statusRes = await vendorService.getVendorVerificationStatus(vId);
          if (statusRes.status !== 'APPROVED') {
            setCurrentScreen('VENDOR_VERIFICATION_STATUS');
          }
        }
      })();
    }
  }, [currentScreen, selectedRole, effectiveVendorId]);

  // Guard Driver Dashboard: Unapproved drivers must NOT access dashboard
  useEffect(() => {
    if (currentScreen === 'DRIVER_DASHBOARD' && selectedRole === 'DRIVER') {
      (async () => {
        const dId = effectiveDriverId;
        const phone = mobileNumber || session?.mobile;
        const profile = await driverService.getDriverProfile(dId, phone);
        if (profile && profile.status !== 'APPROVED') {
          setCurrentScreen('DRIVER_VERIFICATION_STATUS');
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
  const handleSessionFoundFromSplash = (existing: AuthSessionData) => {
    setSession(existing);
    setMobileNumber(existing.mobile);
    setSelectedRole(existing.role);
    routeRoleDestination(existing.role);
  };

  // 03. Login Callbacks
  const handleLoginContinueToOtp = (
    phone: string,
    purpose: 'LOGIN' | 'REGISTRATION' = 'LOGIN',
    testCode?: string
  ) => {
    setMobileNumber(phone);
    setOtpPurpose(purpose);
    setTestOtpCode(testCode || process.env.EXPO_PUBLIC_MOCK_OTP_CODE || '123456');
    setCurrentScreen('OTP');
  };

  const handleNavigateToRoleRegistration = (role: MobileRole, phone?: string) => {
    setSelectedRole(role);
    if (phone) setMobileNumber(phone);
    if (role === 'CLIENT') {
      setCurrentScreen('REGISTRATION');
    } else if (role === 'VENDOR') {
      setCurrentScreen('VENDOR_REGISTRATION');
    } else if (role === 'DRIVER') {
      setCurrentScreen('DRIVER_REGISTRATION');
    }
  };

  const handleDirectLoginSuccess = (newSession: AuthSessionData) => {
    setSession(newSession);
    setSelectedRole(newSession.role);
    setMobileNumber(newSession.mobile);
    routeRoleDestination(newSession.role);
  };

  // 04. Registration Callbacks
  const handleRegisterSuccess = (
    phone: string,
    role: MobileRole,
    testCode?: string,
    draft?: any
  ) => {
    setMobileNumber(phone);
    setSelectedRole(role);
    setOtpPurpose('REGISTRATION');
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
    }
    setTestOtpCode(testCode || process.env.EXPO_PUBLIC_MOCK_OTP_CODE || '123456');
    setCurrentScreen('OTP');
  };

  // 05. OTP Callbacks
  const handleOtpVerifiedExistingUser = async (role: MobileRole, profile: any) => {
    setSelectedRole(role);
    if (role === 'CLIENT') {
      const statusRes = await clientService.getClientAccountStatus(mobileNumber);
      if (statusRes.status === 'APPROVED' || (statusRes as any).status === 'ACTIVE') {
        const existing = await authService.checkExistingSession();
        if (existing) setSession(existing);
        setCurrentScreen('CLIENT_DASHBOARD');
      } else if (
        statusRes.status === 'PENDING_APPROVAL' ||
        statusRes.status === 'REJECTED' ||
        statusRes.status === 'CORRECTIONS_REQUESTED'
      ) {
        setRegisteredClientId(statusRes.companyId || statusRes.clientCode || '');
        setCurrentScreen('REGISTRATION_STATUS');
      } else if (statusRes.status === 'ONBOARDING_INCOMPLETE' || statusRes.status === 'NEW_USER') {
        // Incomplete registration: redirect to incomplete step
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
      return;
    }

    if (role === 'VENDOR') {
      const vId = profile?.vendorId || profile?.id || effectiveVendorId;
      if (vId) {
        const statusRes = await vendorService.getVendorVerificationStatus(vId);
        if (statusRes.status === 'APPROVED') {
          const existing = await authService.checkExistingSession();
          if (existing) setSession(existing);
          setCurrentScreen('VENDOR_DASHBOARD');
        } else {
          setCurrentScreen('VENDOR_VERIFICATION_STATUS');
        }
        return;
      }
    }

    if (role === 'DRIVER') {
      const dId = profile?.driverId || profile?.id || effectiveDriverId;
      const phone = mobileNumber || profile?.mobile;
      const dProfile = await driverService.getDriverProfile(dId, phone);
      if (dProfile && dProfile.status === 'APPROVED') {
        const existing = await authService.checkExistingSession();
        if (existing) setSession(existing);
        setCurrentScreen('DRIVER_DASHBOARD');
      } else {
        setCurrentScreen('DRIVER_VERIFICATION_STATUS');
      }
      return;
    }

    const existing = await authService.checkExistingSession();
    if (existing) setSession(existing);
    routeRoleDestination(role);
  };

  const handleOtpVerifiedNewUser = () => {
    if (selectedRole === 'CLIENT') {
      // Step 2 of Client Registration: Continue directly to Business Details screen
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
      'North Eastern Carriers Logistics (NECL)\n\n' +
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
          onBack={() => setCurrentScreen('LOGIN')}
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
            if (checkPhone) {
              const statusRes = await clientService.getClientAccountStatus(checkPhone);
              if (!session) {
                const newSession: AuthSessionData = {
                  userId: statusRes.companyId || registeredClientId || 'client-user',
                  mobile: checkPhone,
                  role: 'CLIENT',
                  fullName: statusRes.fullName || profileData?.fullName || 'Client Representative',
                  token: 'auth-session-approved-' + Date.now(),
                  createdAt: new Date().toISOString(),
                };
                setSession(newSession);
                await authService.saveSession(newSession);
              }
            }
            setCurrentScreen('CLIENT_DASHBOARD');
          }}
          onFixCorrections={() => setCurrentScreen('CLIENT_DOC_UPLOAD')}
          onOpenSupport={() => setCurrentScreen('HELP_SUPPORT')}
          onBack={() => (session ? setCurrentScreen('PROFILE') : setCurrentScreen('LOGIN'))}
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
          initialData={profileData}
          onBack={() => setCurrentScreen('LOGIN')}
          onSuccess={(data) => {
            setProfileData(data);
            setCurrentScreen('CLIENT_BUSINESS_DETAILS');
          }}
        />
      )}

      {/* Screen 2: Client Business Details */}
      {currentScreen === 'CLIENT_BUSINESS_DETAILS' && (
        <ClientBusinessDetailsScreen
          initialCompanyName={profileData?.companyName}
          initialDetails={businessDetails}
          onBack={() => setCurrentScreen('REGISTRATION')}
          onContinue={(details) => {
            setBusinessDetails(details);
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
          onContinue={(docs) => {
            setClientDocuments(docs);
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
          onSubmitSuccess={(assignedId) => {
            setRegisteredClientId(assignedId);
            // Intentionally not saving full session here: registration is PENDING_APPROVAL
            setCurrentScreen('CLIENT_REG_CONFIRM');
          }}
        />
      )}

      {/* Screen 5: Client Registration Confirmation */}
      {currentScreen === 'CLIENT_REG_CONFIRM' && (
        <ClientRegistrationConfirmationScreen
          clientId={registeredClientId}
          businessDetails={businessDetails}
          onTrackStatus={() => setCurrentScreen('REGISTRATION_STATUS')}
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
          onBookShipment={() => setCurrentScreen('CREATE_REQUIREMENT')}
          onNavigateToBookingDetails={(bookingId) => {
            setActiveBookingId(bookingId);
            setCurrentScreen('BOOKING_DETAILS');
          }}
        />
      )}

      {/* Screen 19: My Bookings */}
      {currentScreen === 'MY_BOOKINGS' && (
        <MyBookingsScreen
          clientId={session?.userId || registeredClientId}
          onBack={() => setCurrentScreen('CLIENT_DASHBOARD')}
          onSelectBooking={(bokId) => {
            setActiveBookingId(bokId);
            setCurrentScreen('BOOKING_DETAILS');
          }}
          onTrackShipment={(id) => {
            setActiveTrackingId(id);
            setCurrentScreen('SHIPMENT_TRACKING');
          }}
          onBookShipment={() => setCurrentScreen('CREATE_REQUIREMENT')}
        />
      )}

      {/* Screen 20: Booking Details */}
      {currentScreen === 'BOOKING_DETAILS' && (
        <BookingDetailsScreen
          bookingId={activeBookingId}
          onBack={() => setCurrentScreen('MY_BOOKINGS')}
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
          onBack={() => setCurrentScreen('LOGIN')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_BUSINESS_INFO');
          }}
          onAlreadyRegistered={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 2: Business Information */}
      {currentScreen === 'VENDOR_BUSINESS_INFO' && (
        <VendorBusinessInfoScreen
          onBack={() => setCurrentScreen('VENDOR_REGISTRATION')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_ADDRESS_CONTACT');
          }}
        />
      )}

      {/* Screen 3: Business Address and Contact Information */}
      {currentScreen === 'VENDOR_ADDRESS_CONTACT' && (
        <VendorAddressContactScreen
          onBack={() => setCurrentScreen('VENDOR_BUSINESS_INFO')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_OPERATING_LOCATIONS');
          }}
        />
      )}

      {/* Screen 4: Operating Locations */}
      {currentScreen === 'VENDOR_OPERATING_LOCATIONS' && (
        <VendorOperatingLocationsScreen
          onBack={() => setCurrentScreen('VENDOR_ADDRESS_CONTACT')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_FLEET_INFO');
          }}
        />
      )}

      {/* Screen 5: Fleet Information */}
      {currentScreen === 'VENDOR_FLEET_INFO' && (
        <VendorFleetInfoScreen
          onBack={() => setCurrentScreen('VENDOR_OPERATING_LOCATIONS')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_TRANSPORT_SERVICES');
          }}
        />
      )}

      {/* Screen 6: Transport Services */}
      {currentScreen === 'VENDOR_TRANSPORT_SERVICES' && (
        <VendorTransportServicesScreen
          onBack={() => setCurrentScreen('VENDOR_FLEET_INFO')}
          onNext={(data) => {
            vendorService.saveDraftForm(data);
            setCurrentScreen('VENDOR_DOC_UPLOAD');
          }}
        />
      )}

      {/* Screen 7: Vendor Document Upload */}
      {currentScreen === 'VENDOR_DOC_UPLOAD' && (
        <VendorDocumentUploadScreen
          onBack={() => setCurrentScreen('VENDOR_TRANSPORT_SERVICES')}
          onNext={(docs) => {
            vendorService.saveDraftForm({ documents: docs });
            setCurrentScreen('VENDOR_APPLICATION_REVIEW');
          }}
        />
      )}

      {/* Screen 8: Application Review */}
      {currentScreen === 'VENDOR_APPLICATION_REVIEW' && (
        <VendorApplicationReviewScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('VENDOR_DOC_UPLOAD')}
          onEditSection={(stepIdx) => {
            const stepMap: Record<number, ScreenId> = {
              1: 'VENDOR_REGISTRATION',
              2: 'VENDOR_BUSINESS_INFO',
              3: 'VENDOR_ADDRESS_CONTACT',
              4: 'VENDOR_OPERATING_LOCATIONS',
              5: 'VENDOR_FLEET_INFO',
              6: 'VENDOR_TRANSPORT_SERVICES',
              7: 'VENDOR_DOC_UPLOAD',
            };
            setCurrentScreen(stepMap[stepIdx] || 'VENDOR_REGISTRATION');
          }}
          onSubmitSuccess={(result) => {
            setRegisteredVendorId(result.vendorId);
            setVendorApplicationNumber(result.applicationNumber);
            setCurrentScreen('VENDOR_SUBMISSION_CONFIRM');
          }}
        />
      )}

      {/* Screen 9: Submission Confirmation */}
      {currentScreen === 'VENDOR_SUBMISSION_CONFIRM' && (
        <VendorSubmissionConfirmationScreen
          applicationNumber={vendorApplicationNumber}
          vendorName="Transport Enterprise"
          onTrackStatus={() => setCurrentScreen('VENDOR_VERIFICATION_STATUS')}
          onGoToDashboard={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 10: Verification Status */}
      {currentScreen === 'VENDOR_VERIFICATION_STATUS' && (
        <VendorVerificationStatusScreen
          vendorId={effectiveVendorId}
          vendorName="Transport Enterprise"
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onEnterDashboard={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onCorrectDocuments={() => setCurrentScreen('VENDOR_DOC_CORRECTION')}
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
        />
      )}

      {/* Screen 13: Available Transport Requirements */}
      {currentScreen === 'VENDOR_REQUIREMENTS' && (
        <VendorRequirementsScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
          onSelectRequirement={(reqId) => {
            setActiveRequirementId(reqId);
            setCurrentScreen('VENDOR_REQUIREMENT_DETAILS');
          }}
        />
      )}

      {/* Screen 14: Requirement Details */}
      {currentScreen === 'VENDOR_REQUIREMENT_DETAILS' && (
        <VendorRequirementDetailsScreen
          requirementId={activeRequirementId}
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
        />
      )}

      {/* Screen 22: Driver Management */}
      {currentScreen === 'VENDOR_DRIVER_MANAGEMENT' && (
        <VendorDriverManagementScreen
          vendorId={effectiveVendorId}
          onBack={() => setCurrentScreen('VENDOR_DASHBOARD')}
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

      {/* Screen 1: Driver Registration */}
      {currentScreen === 'DRIVER_REGISTRATION' && (
        <DriverRegistrationScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('LOGIN')}
          onStartRegistration={() => setCurrentScreen('DRIVER_PERSONAL_INFO')}
          onCheckStatus={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
        />
      )}

      {/* Screen 2: Personal Information */}
      {currentScreen === 'DRIVER_PERSONAL_INFO' && (
        <DriverPersonalInfoScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('DRIVER_REGISTRATION')}
          onNext={() => setCurrentScreen('DRIVER_LICENCE_DETAILS')}
        />
      )}

      {/* Screen 3: Driving Licence Details */}
      {currentScreen === 'DRIVER_LICENCE_DETAILS' && (
        <DriverLicenceDetailsScreen
          onBack={() => setCurrentScreen('DRIVER_PERSONAL_INFO')}
          onNext={() => setCurrentScreen('DRIVER_VEHICLE_ASSOCIATION')}
        />
      )}

      {/* Screen 4: Vehicle Association */}
      {currentScreen === 'DRIVER_VEHICLE_ASSOCIATION' && (
        <DriverVehicleAssociationScreen
          onBack={() => setCurrentScreen('DRIVER_LICENCE_DETAILS')}
          onNext={() => setCurrentScreen('DRIVER_DOC_UPLOAD')}
        />
      )}

      {/* Screen 5: Driver Document Upload */}
      {currentScreen === 'DRIVER_DOC_UPLOAD' && (
        <DriverDocumentUploadScreen
          onBack={() => setCurrentScreen('DRIVER_VEHICLE_ASSOCIATION')}
          onNext={() => setCurrentScreen('DRIVER_APPLICATION_REVIEW')}
        />
      )}

      {/* Screen 6: Application Review */}
      {currentScreen === 'DRIVER_APPLICATION_REVIEW' && (
        <DriverApplicationReviewScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('DRIVER_DOC_UPLOAD')}
          onSubmitSuccess={(data) => {
            setRegisteredDriverId(data.driverId);
            setDriverApplicationNumber(data.applicationNumber);
            setCurrentScreen('DRIVER_SUBMISSION_CONFIRM');
          }}
          onEditSection={(step) => {
            if (step === 1) setCurrentScreen('DRIVER_PERSONAL_INFO');
            else if (step === 2) setCurrentScreen('DRIVER_LICENCE_DETAILS');
            else if (step === 3) setCurrentScreen('DRIVER_VEHICLE_ASSOCIATION');
            else setCurrentScreen('DRIVER_DOC_UPLOAD');
          }}
        />
      )}

      {/* Screen 7: Submission Confirmation */}
      {currentScreen === 'DRIVER_SUBMISSION_CONFIRM' && (
        <DriverSubmissionConfirmationScreen
          applicationNumber={driverApplicationNumber}
          onCheckStatus={() => setCurrentScreen('DRIVER_VERIFICATION_STATUS')}
          onGoHome={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onBackToLogin={() => setCurrentScreen('LOGIN')}
        />
      )}

      {/* Screen 8: Verification Status */}
      {currentScreen === 'DRIVER_VERIFICATION_STATUS' && (
        <DriverVerificationStatusScreen
          initialMobile={mobileNumber}
          driverId={effectiveDriverId}
          onBack={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onGoToDashboard={() => setCurrentScreen('DRIVER_DASHBOARD')}
          onGoToCorrection={() => setCurrentScreen('DRIVER_DOC_CORRECTION')}
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
        <VendorOnboardingScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('LOGIN')}
          onCompleted={() => setCurrentScreen('REGISTRATION_STATUS')}
        />
      )}

      {currentScreen === 'DRIVER_ONBOARDING' && (
        <DriverOnboardingScreen
          initialMobile={mobileNumber}
          onBack={() => setCurrentScreen('LOGIN')}
          onCompleted={() => setCurrentScreen('REGISTRATION_STATUS')}
        />
      )}

      {/* ── Five-Button Client Bottom Navigation Bar (Home | Shipment | My Requirements | Bookings | Profile) ── */}
      {selectedRole === 'CLIENT' &&
        (currentScreen === 'CLIENT_DASHBOARD' ||
          currentScreen === 'MY_SHIPMENTS' ||
          currentScreen === 'MY_REQUIREMENTS' ||
          currentScreen === 'MY_BOOKINGS' ||
          currentScreen === 'PROFILE') && (
          <ClientBottomNavBar
            activeTab={
              currentScreen === 'MY_SHIPMENTS'
                ? 'SHIPMENT'
                : currentScreen === 'MY_REQUIREMENTS'
                ? 'REQUIREMENTS'
                : currentScreen === 'MY_BOOKINGS'
                ? 'BOOKINGS'
                : currentScreen === 'PROFILE'
                ? 'PROFILE'
                : 'HOME'
            }
            onSelectTab={(tab: ClientNavTab) => {
              if (tab === 'HOME') setCurrentScreen('CLIENT_DASHBOARD');
              else if (tab === 'SHIPMENT') setCurrentScreen('MY_SHIPMENTS');
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
});
