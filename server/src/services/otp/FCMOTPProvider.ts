/**
 * FCM OTP Provider (Future Implementation)
 * Ready-to-use structure for Firebase Cloud Messaging integration
 */

import {
  IOTPProvider,
  OTPRequest,
  OTPResponse,
  OTPVerifyRequest,
  OTPVerifyResponse,
  FCMConfig,
} from './types';

export class FCMOTPProvider implements IOTPProvider {
  private config: FCMConfig;
  private mockProvider: any; // Fallback to mock for now

  constructor(config: FCMConfig) {
    this.config = config;
    // TODO: Initialize Firebase Admin SDK
    // admin.initializeApp({
    //   credential: admin.credential.cert({
    //     projectId: config.projectId,
    //     privateKey: config.privateKey,
    //     clientEmail: config.clientEmail,
    //   }),
    //   databaseURL: config.databaseURL,
    // });
  }

  getProviderName(): string {
    return 'FCMOTPProvider';
  }

  async send(request: OTPRequest): Promise<OTPResponse> {
    // TODO: Implement FCM-based OTP sending
    // 1. Generate OTP
    // 2. Store in database
    // 3. Look up device token for phone number
    // 4. Send FCM notification with OTP
    // 5. Return response

    throw new Error('FCM OTP Provider not yet implemented. Use MockOTPProvider for development.');
  }

  async verify(request: OTPVerifyRequest): Promise<OTPVerifyResponse> {
    // TODO: Implement OTP verification (same logic as MockOTPProvider)
    throw new Error('FCM OTP Provider not yet implemented. Use MockOTPProvider for development.');
  }

  async resend(phoneNumber: string, purpose: string): Promise<OTPResponse> {
    // TODO: Implement OTP resend
    throw new Error('FCM OTP Provider not yet implemented. Use MockOTPProvider for development.');
  }

  async checkRateLimit(phoneNumber: string): Promise<boolean> {
    // TODO: Implement rate limit check (same logic as MockOTPProvider)
    return true;
  }

  /**
   * Send FCM notification with OTP
   */
  private async sendFCMMessage(
    deviceToken: string,
    otpCode: string,
    purpose: string
  ): Promise<void> {
    // TODO: Implement FCM message sending
    // const message = {
    //   notification: {
    //     title: 'NECL Verification Code',
    //     body: `Your OTP is ${otpCode}. Valid for 5 minutes.`,
    //   },
    //   data: {
    //     type: 'OTP_VERIFICATION',
    //     otp: otpCode,
    //     purpose,
    //   },
    //   token: deviceToken,
    //   android: {
    //     priority: 'high',
    //   },
    //   apns: {
    //     payload: {
    //       aps: {
    //         contentAvailable: true,
    //       },
    //     },
    //   },
    // };
    //
    // const response = await admin.messaging().send(message);
    // return response;
  }

  /**
   * Get device token for phone number from database
   */
  private async getDeviceToken(phoneNumber: string): Promise<string | null> {
    // TODO: Query database for device token
    // This would require a device_tokens table:
    // - user_id
    // - phone_number
    // - fcm_token
    // - platform (android/ios)
    // - created_at
    return null;
  }
}

/**
 * Helper to initialize FCM provider from environment variables
 */
export function createFCMProvider(): FCMOTPProvider {
  const config: FCMConfig = {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
    databaseURL: process.env.FCM_DATABASE_URL,
  };

  return new FCMOTPProvider(config);
}
