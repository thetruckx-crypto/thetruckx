/**
 * OTP Service Type Definitions
 * Structured for easy FCM integration in the future
 */

export interface OTPRequest {
  phoneNumber: string;
  countryCode: string;
  purpose: 'LOGIN' | 'REGISTRATION' | 'PASSWORD_RESET';
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: Record<string, any>;
  };
}

export interface OTPResponse {
  success: boolean;
  message: string;
  data?: {
    otpId: string;
    expiresIn: number; // seconds
    expiresAt: string; // ISO timestamp
    attemptsLeft: number;
  };
  error?: {
    code: string;
    details?: any;
  };
}

export interface OTPVerifyRequest {
  phoneNumber: string;
  otpCode: string;
  purpose?: 'LOGIN' | 'REGISTRATION' | 'PASSWORD_RESET';
}

export interface OTPVerifyResponse {
  success: boolean;
  verified: boolean;
  message: string;
  data?: {
    userId?: string;
    userType?: string;
    sessionToken?: string;
    requiresApproval?: boolean;
    approvalStatus?: string;
  };
  error?: {
    code: string;
    attemptsLeft?: number;
    lockedUntil?: string;
  };
}

export interface OTPConfig {
  mode: 'MOCK' | 'FCM' | 'SMS_GATEWAY';
  otpLength: number;
  expiryMinutes: number;
  maxAttempts: number;
  rateLimitWindow: number; // minutes
  maxRequestsPerWindow: number;
  mockCode?: string; // For development
}

/**
 * Abstract OTP Provider Interface
 * Implement this interface for different providers (FCM, Twilio, etc.)
 */
export interface IOTPProvider {
  /**
   * Send OTP to phone number
   */
  send(request: OTPRequest): Promise<OTPResponse>;

  /**
   * Verify OTP code
   */
  verify(request: OTPVerifyRequest): Promise<OTPVerifyResponse>;

  /**
   * Resend OTP (invalidates previous code)
   */
  resend(phoneNumber: string, purpose: string): Promise<OTPResponse>;

  /**
   * Check if phone number is rate limited
   */
  checkRateLimit(phoneNumber: string): Promise<boolean>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}

/**
 * FCM-specific configuration (for future implementation)
 */
export interface FCMConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseURL?: string;
}

/**
 * SMS Gateway configuration (alternative provider)
 */
export interface SMSGatewayConfig {
  apiKey: string;
  apiSecret: string;
  senderId: string;
  endpoint: string;
}
