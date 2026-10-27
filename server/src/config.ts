import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || '5000', 10),
  // JWT not needed - Supabase handles auth tokens
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  // CORS origins - remove wildcard for security
  corsOrigin: (process.env.CORS_ORIGINS || 'http://localhost:5174,http://localhost:8081,http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && origin !== '*'),
  // Mock OTP strictly enabled ONLY in development/testing, NEVER in production
  mockOtpEnabled: process.env.NODE_ENV !== 'production' && (process.env.MOCK_OTP_ENABLED === 'true' || process.env.MOCK_OTP_ENABLED === undefined),
  mockOtpCode: process.env.MOCK_OTP_CODE || '12345',
  jwtSecret: process.env.JWT_SECRET || 'necl_super_secret_jwt_key_2026_dev_env',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

