/**
 * OTP Service Factory
 * Creates the appropriate OTP provider based on configuration
 * Makes it easy to switch between Mock and FCM providers
 */

import { IOTPProvider, OTPConfig } from './types';
import { MockOTPProvider } from './MockOTPProvider';
import { FCMOTPProvider, createFCMProvider } from './FCMOTPProvider';
import { SMSGatewayProvider } from './SMSGatewayProvider';

export type OTPProviderType = 'MOCK' | 'FCM' | 'SMS_GATEWAY';

export class OTPServiceFactory {
  private static instance: IOTPProvider | null = null;

  /**
   * Get OTP provider instance (singleton)
   */
  static getProvider(type?: OTPProviderType): IOTPProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = type || this.getProviderTypeFromEnv();

    switch (providerType) {
      case 'FCM':
        console.log('🔥 Initializing FCM OTP Provider');
        this.instance = createFCMProvider();
        break;

      case 'SMS_GATEWAY':
        console.log('📡 Initializing Production SMS Gateway Provider');
        this.instance = new SMSGatewayProvider();
        break;

      case 'MOCK':
      default:
        console.log('📱 Initializing Mock OTP Provider (Dev Mode)');
        this.instance = new MockOTPProvider({
          mode: 'MOCK',
          mockCode: process.env.MOCK_OTP_CODE || '12345',
        });
        break;
    }

    return this.instance;
  }

  /**
   * Reset provider instance (useful for testing)
   */
  static resetProvider(): void {
    this.instance = null;
  }

  /**
   * Get provider type from environment variables
   */
  private static getProviderTypeFromEnv(): OTPProviderType {
    const envProvider = process.env.OTP_PROVIDER?.toUpperCase();

    switch (envProvider) {
      case 'FCM':
        return 'FCM';
      case 'SMS_GATEWAY':
        return 'SMS_GATEWAY';
      case 'MOCK':
      default:
        return 'MOCK';
    }
  }

  /**
   * Get default OTP configuration
   */
  static getDefaultConfig(): OTPConfig {
    return {
      mode: 'MOCK',
      otpLength: parseInt(process.env.OTP_LENGTH || '5', 10),
      expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
      rateLimitWindow: parseInt(process.env.OTP_RATE_LIMIT_WINDOW || '60', 10),
      maxRequestsPerWindow: parseInt(process.env.OTP_MAX_REQUESTS_PER_WINDOW || '5', 10),
      mockCode: process.env.MOCK_OTP_CODE || '12345',
    };
  }
}

/**
 * Convenience function to get OTP provider
 */
export function getOTPProvider(): IOTPProvider {
  return OTPServiceFactory.getProvider();
}
