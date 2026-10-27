/**
 * Mock OTP Provider for Development
 * Accepts standard code 123456 and logs OTPs to console
 * Structured for easy swap with FCM provider in production
 */

import { supabase } from '../../supabase';
import {
  IOTPProvider,
  OTPRequest,
  OTPResponse,
  OTPVerifyRequest,
  OTPVerifyResponse,
  OTPConfig,
} from './types';

export class MockOTPProvider implements IOTPProvider {
  private config: OTPConfig;

  constructor(config?: Partial<OTPConfig>) {
    this.config = {
      mode: 'MOCK',
      otpLength: 5,
      expiryMinutes: 5,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxRequestsPerWindow: 5,
      mockCode: '12345',
      ...config,
    };
  }

  getProviderName(): string {
    return 'MockOTPProvider';
  }

  /**
   * Generate a random OTP code
   */
  private generateOTP(): string {
    // In mock mode, always return the standard code for easy testing
    if (this.config.mode === 'MOCK' && this.config.mockCode) {
      return this.config.mockCode;
    }

    // For production, generate random code
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.config.otpLength; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  /**
   * Check rate limit for phone number
   */
  async checkRateLimit(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_otp_rate_limit', {
        p_phone_number: phoneNumber,
        p_max_requests: this.config.maxRequestsPerWindow,
        p_window_minutes: this.config.rateLimitWindow,
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return true; // Allow in case of error
      }

      return data === true;
    } catch (error) {
      console.error('Rate limit check exception:', error);
      return true; // Allow in case of exception
    }
  }

  /**
   * Send OTP to phone number
   */
  async send(request: OTPRequest): Promise<OTPResponse> {
    const { phoneNumber, countryCode, purpose, metadata } = request;
    const fullPhone = `${countryCode}${phoneNumber}`;

    try {
      // Check rate limit
      const allowed = await this.checkRateLimit(fullPhone);
      if (!allowed) {
        return {
          success: false,
          message: 'Too many requests. Please try again later.',
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            details: 'Maximum OTP requests exceeded for this phone number',
          },
        };
      }

      // Generate OTP
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + this.config.expiryMinutes * 60 * 1000);

      // Store OTP in database
      const cleanPhone = fullPhone.replace(/[^0-9]/g, '').slice(-10);
      const { data: otpData, error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          mobile: cleanPhone,
          phone_number: fullPhone,
          country_code: countryCode,
          otp_code: otpCode,
          purpose,
          expires_at: expiresAt.toISOString(),
          max_attempts: this.config.maxAttempts,
          ip_address: metadata?.ipAddress,
          user_agent: metadata?.userAgent,
          device_info: metadata?.deviceInfo,
        })
        .select()
        .single();

      if (otpError) {
        console.error('Error storing OTP:', otpError);
        return {
          success: false,
          message: 'Failed to generate OTP. Please try again.',
          error: {
            code: 'DATABASE_ERROR',
            details: otpError.message,
          },
        };
      }

      // Log OTP to console in mock mode
      console.log('\n========================================');
      console.log('📱 MOCK OTP SERVICE');
      console.log('========================================');
      console.log(`Phone: ${fullPhone}`);
      console.log(`OTP Code: ${otpCode}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`Valid for: ${this.config.expiryMinutes} minutes`);
      console.log('========================================\n');

      // In production with FCM, this would send actual notification
      // await this.sendFCMNotification(fullPhone, otpCode, purpose);

      // Log audit event
      await supabase.from('auth_audit_log').insert({
        user_id: null,
        user_type: null,
        event_type: 'OTP_SENT',
        details: {
          phone: fullPhone,
          purpose,
          provider: this.getProviderName(),
        },
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
      });

      return {
        success: true,
        message: 'OTP sent successfully',
        data: {
          otpId: otpData.id,
          expiresIn: this.config.expiryMinutes * 60,
          expiresAt: expiresAt.toISOString(),
          attemptsLeft: this.config.maxAttempts,
        },
      };
    } catch (error: any) {
      console.error('OTP send error:', error);
      return {
        success: false,
        message: 'An error occurred while sending OTP',
        error: {
          code: 'INTERNAL_ERROR',
          details: error.message,
        },
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verify(request: OTPVerifyRequest): Promise<OTPVerifyResponse> {
    const { phoneNumber, otpCode, purpose = 'LOGIN' } = request;

    try {
      // Get active OTP for this phone
      const { data: otpData, error: otpError } = await supabase.rpc(
        'get_active_otp',
        {
          p_phone_number: phoneNumber,
          p_purpose: purpose,
        }
      );

      if (otpError) {
        console.error('Error fetching OTP:', otpError);
        return {
          success: false,
          verified: false,
          message: 'Failed to verify OTP',
          error: {
            code: 'DATABASE_ERROR',
          },
        };
      }

      if (!otpData || otpData.length === 0) {
        // Log failed attempt
        await supabase.from('auth_audit_log').insert({
          event_type: 'OTP_FAILED',
          details: {
            phone: phoneNumber,
            reason: 'NO_ACTIVE_OTP',
          },
        });

        return {
          success: false,
          verified: false,
          message: 'No active OTP found. Please request a new one.',
          error: {
            code: 'OTP_NOT_FOUND',
          },
        };
      }

      const otp = otpData[0];

      // Check if OTP matches
      if (otp.otp_code !== otpCode) {
        // Increment attempts
        const newAttempts = otp.attempts + 1;
        await supabase
          .from('otp_verifications')
          .update({ attempts: newAttempts })
          .eq('id', otp.id);

        // Log failed attempt
        await supabase.from('auth_audit_log').insert({
          event_type: 'OTP_FAILED',
          details: {
            phone: phoneNumber,
            reason: 'INVALID_CODE',
            attempts: newAttempts,
          },
        });

        const attemptsLeft = otp.max_attempts - newAttempts;

        if (attemptsLeft <= 0) {
          // Mark as expired
          await supabase
            .from('otp_verifications')
            .update({ is_expired: true })
            .eq('id', otp.id);

          return {
            success: false,
            verified: false,
            message: 'Maximum attempts exceeded. Please request a new OTP.',
            error: {
              code: 'MAX_ATTEMPTS_EXCEEDED',
              attemptsLeft: 0,
            },
          };
        }

        return {
          success: false,
          verified: false,
          message: `Invalid OTP code. ${attemptsLeft} attempt(s) remaining.`,
          error: {
            code: 'INVALID_OTP',
            attemptsLeft,
          },
        };
      }

      // OTP is valid - mark as verified
      await supabase
        .from('otp_verifications')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', otp.id);

      // Find or create user based on phone
      let userId: string | null = null;
      let userType: string | null = null;
      let requiresApproval = false;
      let approvalStatus = 'APPROVED';

      // Check if vendor exists
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, verification_status')
        .eq('phone', phoneNumber)
        .single();

      if (vendor) {
        userId = vendor.id;
        userType = 'VENDOR';
        approvalStatus = vendor.verification_status;
        requiresApproval = vendor.verification_status !== 'APPROVED';

        // Update phone verified flag
        await supabase
          .from('vendors')
          .update({
            phone_verified: true,
            phone_verified_at: new Date().toISOString(),
          })
          .eq('id', vendor.id);
      } else {
        // Check if driver exists
        const { data: driver } = await supabase
          .from('drivers')
          .select('id, verification_status')
          .eq('phone', phoneNumber)
          .single();

        if (driver) {
          userId = driver.id;
          userType = 'DRIVER';
          approvalStatus = driver.verification_status;
          requiresApproval = driver.verification_status !== 'APPROVED';

          // Update phone verified flag
          await supabase
            .from('drivers')
            .update({
              phone_verified: true,
              phone_verified_at: new Date().toISOString(),
            })
            .eq('id', driver.id);
        }
      }

      // Log successful verification
      await supabase.from('auth_audit_log').insert({
        user_id: userId,
        user_type: userType,
        event_type: 'OTP_VERIFIED',
        details: {
          phone: phoneNumber,
          purpose,
        },
      });

      return {
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        data: {
          userId: userId || undefined,
          userType: userType || undefined,
          requiresApproval,
          approvalStatus,
        },
      };
    } catch (error: any) {
      console.error('OTP verify error:', error);
      return {
        success: false,
        verified: false,
        message: 'An error occurred while verifying OTP',
        error: {
          code: 'INTERNAL_ERROR',
        },
      };
    }
  }

  /**
   * Resend OTP (invalidates previous code)
   */
  async resend(phoneNumber: string, purpose: string): Promise<OTPResponse> {
    try {
      // Expire previous OTPs
      await supabase
        .from('otp_verifications')
        .update({ is_expired: true })
        .eq('phone_number', phoneNumber)
        .eq('purpose', purpose)
        .eq('is_verified', false);

      // Send new OTP
      return this.send({
        phoneNumber: phoneNumber.replace(/^\+91/, ''),
        countryCode: '+91',
        purpose: purpose as any,
      });
    } catch (error: any) {
      console.error('OTP resend error:', error);
      return {
        success: false,
        message: 'Failed to resend OTP',
        error: {
          code: 'INTERNAL_ERROR',
          details: error.message,
        },
      };
    }
  }

  /**
   * Placeholder for future FCM implementation
   */
  private async sendFCMNotification(
    phoneNumber: string,
    otpCode: string,
    purpose: string
  ): Promise<void> {
    // TODO: Implement FCM notification
    // This will be implemented when integrating Firebase Cloud Messaging
    // Example:
    // const message = {
    //   notification: {
    //     title: 'NECL OTP Verification',
    //     body: `Your OTP code is ${otpCode}. Valid for 5 minutes.`,
    //   },
    //   token: deviceToken,
    // };
    // await admin.messaging().send(message);
    console.log(`[FCM Placeholder] Would send OTP ${otpCode} to ${phoneNumber} for ${purpose}`);
  }
}
