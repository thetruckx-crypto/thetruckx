# Archived Legacy Screens — THE TRUCKX (NECL)

This folder contains archived legacy screens that are no longer part of the active 15-Hub primary operational flow:

### Archived Screens:
1. `auth/login/ChooseAccountTypeScreen.tsx`: Retired because role selection was consolidated directly into `LoginScreen.tsx` (Hub 03).
2. `auth/password/ForgotPasswordScreen.tsx`: Retired because THE TRUCKX operates exclusively on passwordless OTP verification (Hub 04).
3. `auth/password/CreateNewPasswordScreen.tsx`: Retired due to passwordless authentication architecture.
4. `auth/password/PasswordResetSuccessScreen.tsx`: Retired due to passwordless authentication architecture.
5. `common/notifications/NotificationPermissionScreen.tsx`: Retired because push notifications permissions are requested asynchronously at runtime without a blocking standalone screen.

### Retention Policy:
These components are archived for compliance, historical reference, and rollback capability without impacting active production bundles.
