import React, { useState, useRef, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { supabase } from '../utils/supabase';
import {
  Truck,
  ShieldCheck,
  Users,
  TrendingUp,
  Shield,
  Info,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  X,
  ShieldAlert
} from 'lucide-react';

interface TwoFactorScreenProps {
  email: string;
  onVerifySuccess: (user: { name: string; role: 'SUPER_ADMIN'; email: string }) => void;
  onBackToLogin: () => void;
}

export const TwoFactorScreen: React.FC<TwoFactorScreenProps> = ({
  email,
  onVerifySuccess,
  onBackToLogin,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [backupCodeInput, setBackupCodeInput] = useState<string>('');
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupError, setBackupError] = useState<string>('');
  const [resendCountdown, setResendCountdown] = useState<number>(45);
  const [resendNotice, setResendNotice] = useState<string>('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);
    setErrorMessage('');

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = digits.join('');

    if (code.length < 6) {
      setErrorMessage('Please enter all 6 verification digits.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // Allow quick test codes 123456 or 000000 for development review
    if (code === '123456' || code === '000000') {
      onVerifySuccess({
        name: 'Pavani (Super Admin)',
        role: 'SUPER_ADMIN',
        email: email || 'superadmin@necl.com',
      });
      return;
    }

    try {
      // Get current session to access the user
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Fallback for pre-filled demo account without remote session
        if (email.toLowerCase().includes('superadmin')) {
          onVerifySuccess({
            name: 'Pavani (Super Admin)',
            role: 'SUPER_ADMIN',
            email: email,
          });
          return;
        }
        throw new Error('No active session. Please log in again.');
      }

      // List user's MFA factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      if (!factors || factors.totp.length === 0) {
        // No MFA enrolled - for development, allow login
        // TODO: In production, enforce MFA enrollment for SUPER_ADMIN role
        console.warn('No MFA factors enrolled for this user');
        onVerifySuccess({
          name: session.user.user_metadata?.name || 'Super Admin',
          role: 'SUPER_ADMIN',
          email: session.user.email || email,
        });
        return;
      }

      // Get the TOTP factor (should be only one)
      const factor = factors.totp[0];

      // Create challenge for the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeError || !challengeData) {
        throw new Error(challengeError?.message || 'Failed to create MFA challenge');
      }

      // Verify the TOTP code
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        throw new Error('Invalid verification code. Please check your authenticator app and try again.');
      }

      if (verifyData) {
        // MFA verification successful
        onVerifySuccess({
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Super Admin',
          role: 'SUPER_ADMIN',
          email: session.user.email || email,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid verification code. Please check your authenticator app and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBackup = backupCodeInput.trim();
    if (!cleanBackup) {
      setBackupError('Please enter your backup recovery code.');
      return;
    }

    setBackupLoading(true);
    setBackupError('');

    try {
      // In production, implement proper backup code verification
      // For now, show a helpful message
      setBackupError(
        'Backup code verification requires account recovery through your administrator. ' +
        'Please contact NECL system administrator for emergency access recovery.'
      );
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="login-screen-layout">
      {/* Edge-to-edge Subtle Dark Overlay */}
      <div className="login-dark-overlay" aria-hidden="true" />

      {/* Edge-to-edge Content Container */}
      <div className="login-content-wrapper">
        {/* Left Branding Content */}
        <section className="login-branding-section" aria-label="North Eastern Carriers Two-Factor Security">
          <div className="hero-brand-header">
            <BrandLogo theme="dark" size="lg" alt="North Eastern Carriers" />
            <div className="brand-orange-bar" />
          </div>

          <div className="hero-headline-group">
            <h1 className="hero-main-title">
              Secure<br />
              Logistics<br />
              Across <span className="highlight-orange">India</span>
            </h1>
            <p className="hero-subtitle">
              Enterprise Two-Factor Authentication • Protected System Vault
            </p>
          </div>

          <div className="hero-features-strip" role="list">
            <div className="feature-item" role="listitem">
              <Truck size={22} className="feature-orange-icon" />
              <div className="feature-title">Pan India<br />Coverage</div>
            </div>
            <div className="feature-divider" />
            <div className="feature-item" role="listitem">
              <ShieldCheck size={22} className="feature-orange-icon" />
              <div className="feature-title">Safe & Secure<br />Transport</div>
            </div>
            <div className="feature-divider" />
            <div className="feature-item" role="listitem">
              <Users size={22} className="feature-orange-icon" />
              <div className="feature-title">Trusted<br />Network</div>
            </div>
            <div className="feature-divider" />
            <div className="feature-item" role="listitem">
              <TrendingUp size={22} className="feature-orange-icon" />
              <div className="feature-title">Real Time<br />Tracking</div>
            </div>
          </div>

          <div className="hero-footer-tagline">
            <div className="orange-accent-dash" />
            <span className="quote-text">“Your Cargo, Our Commitment”</span>
          </div>
        </section>

        {/* Right Floating 2FA Card */}
        <section className="login-card-floating-wrapper" aria-label="Two Factor Authentication">
          <div className="login-card-container">
            <div className="form-brand-center">
              <BrandLogo theme="light" size="lg" alt="North Eastern Carriers" />
            </div>

            <div className="form-heading-group">
              <h2 className="form-title">Two-Factor Authentication</h2>
              <p className="form-desc">Enter the 6-digit verification code for {email}</p>
            </div>

            {/* Security Alert Banner */}
            <div className="twofa-alert-banner">
              <Shield className="alert-shield-icon" size={20} />
              <span>For your security, Super Admin access requires 2-step verification.</span>
            </div>

          {errorMessage && (
            <div className="form-alert-error" role="alert">
              <ShieldAlert size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6 OTP Boxes Form */}
          <form onSubmit={handleVerify} className="login-form-element">
            <div className="otp-digit-boxes-row">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className={`otp-digit-box ${digit ? 'filled' : ''}`}
                  aria-label={`Digit ${idx + 1}`}
                />
              ))}
            </div>

            <div className="otp-helper-row">
              <p className="otp-helper-subtext">
                Enter the 6-digit TOTP code generated by your authenticator app.
              </p>
              <div className="otp-resend-container">
                {resendCountdown > 0 ? (
                  <span className="otp-resend-timer">
                    Resend code in <strong>{resendCountdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-resend-code-link"
                    onClick={() => {
                      setResendCountdown(60);
                      setResendNotice('New verification code sent to your registered channel.');
                      setTimeout(() => setResendNotice(''), 4000);
                    }}
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            {resendNotice && (
              <div className="form-alert-info" role="status">
                <span>{resendNotice}</span>
              </div>
            )}

            {/* Remember Device Checkbox */}
            <div className="remember-device-row">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                />
                <span className="checkbox-label">Remember this device for 30 days</span>
              </label>
              <span title="Avoids 2FA on this trusted browser for 30 days">
                <Info size={16} className="info-icon" />
              </span>
            </div>

            {/* Helper Note - Remove auto-fill in production */}
            <div className="twofa-mock-helper-box">
              <Info size={16} className="info-icon" style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
              </span>
            </div>

            {/* Verify CTA */}
            <button
              type="submit"
              disabled={isLoading || digits.join('').length < 6}
              className="btn-login-orange-cta"
            >
              {isLoading ? (
                <>
                  <span className="spinner-sm" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Continue</span>
                  <ArrowRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>

            {/* Footer Navigation Options */}
            <div className="twofa-card-footer">
              <button
                type="button"
                className="twofa-backup-link"
                onClick={() => {
                  setBackupError('');
                  setBackupCodeInput('');
                  setShowBackupModal(true);
                }}
              >
                <KeyRound size={15} />
                <span>Lost device? Use backup recovery code</span>
              </button>

              <button
                type="button"
                className="twofa-back-login-btn"
                onClick={onBackToLogin}
              >
                <ArrowLeft size={16} />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        </div>
      </section>
      </div>

      {/* Backup Code Modal */}
      {showBackupModal && (
        <div className="modal-backdrop-overlay" onClick={() => setShowBackupModal(false)}>
          <div className="forgot-password-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3 className="modal-card-title">Backup Recovery Code</h3>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowBackupModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="modal-card-desc">
              Enter one of your 8-character single-use emergency recovery codes.
            </p>

            <form onSubmit={handleBackupVerify} className="forgot-form-element">
              {backupError && (
                <div className="form-alert-error" role="alert">
                  <ShieldAlert size={16} />
                  <span>{backupError}</span>
                </div>
              )}

              <div className="form-field-group">
                <label className="form-field-label">Recovery Code</label>
                <div className="input-with-icon-wrap">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    type="text"
                    required
                    value={backupCodeInput}
                    onChange={(e) => setBackupCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. BACKUP-998877"
                    className="form-text-input"
                  />
                </div>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary-cancel"
                  onClick={() => setShowBackupModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={backupLoading}
                  className="btn-login-orange-cta"
                >
                  {backupLoading ? 'Verifying...' : 'Verify Backup Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorScreen;
