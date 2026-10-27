/**
 * OTP Service - Main Export
 * Easy-to-use OTP service with mock and FCM support
 */

export * from './types';
export * from './MockOTPProvider';
export * from './FCMOTPProvider';
export * from './SMSGatewayProvider';
export * from './OTPServiceFactory';
export { getOTPProvider } from './OTPServiceFactory';
